// showup-reminders/index.ts
// Supabase Edge Function, run every 15 minutes by pg_cron.
// Sends each Show Up user their morning nudge at the time they chose, in their own time zone,
// by email and/or phone notification. Skips quiet days, paused nudges and days already ticked.
// Secrets (RESEND_API_KEY, VAPID_PRIVATE_KEY) live in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_PUBLIC_KEY = 'BHJYn9pn53bnDmtHCvr-ysfBqueL-9zH4_0hvmPRvgpEBhfLeNxBeuBOSgCKiGzar2NOPyghfanKgdud1DbxjOk'

const FROM = 'Stuart Fairbairns <stuart@motivate-coaching.com>'
const APP_URL = 'https://motivate-coaching.github.io/tlr-hub/show-up/'
const LOGO_URL = 'https://motivate-coaching.github.io/tlr-hub/email/tlr-logo-email.png'
const WINDOW_MINS = 60 // send any time in the hour after their chosen time, once

const LINES = [
  'Showing up beats consistency.',
  'Follow the plan, not the feeling.',
  'Imperfect action beats perfect inaction.',
  'It’s a dimmer switch, not a light switch. Some days a 10, some days a 1. Both count.',
  'You don’t need to feel like it. You just need to start.',
  'Small and done beats big and someday.',
  'Missed a day? The next one is a comeback, and comebacks count.',
]

type Profile = {
  user_id: string; timezone: string; reminder_time: string; reminder_days: number[]
  remind_email: boolean; remind_push: boolean; paused_until: string | null
}
type Habit = { id: string; user_id: string; what: string; dimmer: string; length_days: number; start_date: string; mode: string }

function localParts(now: Date, tz: string) {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(now)
  } catch {
    return localParts(now, 'Europe/London')
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: +get('hour') * 60 + +get('minute'), dow }
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86_400_000)
}
function esc(s: string) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function emailHtml(o: { day: number; length: number; what: string; dimmer: string; line: string; comeback: boolean }) {
  const year = new Date().getUTCFullYear()
  const headline = o.comeback ? `Day ${o.day}. A comeback day.` : `Day ${o.day}. Today counts.`
  const intro = o.comeback
    ? 'Yesterday didn’t happen. That’s fine. Today is the one that matters, and getting back on is the real work.'
    : 'Done it already, or about to? One tap and it’s logged.'
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(headline)}</title></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(o.what)}. Hard day? ${esc(o.dimmer)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:28px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td bgcolor="#0F1215" align="center" style="background:#0F1215;border-radius:10px 10px 0 0;padding:22px 32px 18px;">
    <a href="${APP_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" width="96" height="78" alt="The Living Room" style="display:block;margin:0 auto;width:96px;height:78px;border:0;color:#FFFFFF;font-size:16px;font-weight:700;"></a>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:34px 32px 30px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4A4A;">Day ${o.day} of ${o.length}</p>
    <h1 style="margin:0 0 10px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.15;color:#1A1A1A;">${esc(headline)}</h1>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4A4A4A;">${intro}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;border-radius:6px;margin-bottom:24px;"><tr><td style="padding:18px 20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4A4A;">My habit</p>
      <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#1A1A1A;">${esc(o.what)}</p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#4A4A4A;">Hard day? Your dimmer version still counts: <b style="color:#1A1A1A;">${esc(o.dimmer)}</b></p>
    </td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:26px;"><tr><td align="center">
      <a href="${APP_URL}?from=email" style="display:inline-block;background:#0F1215;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:16px 36px;border-radius:4px;">Tick today</a>
    </td></tr></table>
    <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:19px;line-height:1.4;color:#1A1A1A;text-align:center;">${esc(o.line)}</p>
  </td></tr>
  <tr><td style="background:#EDE8DF;border-radius:0 0 10px 10px;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#4A4A4A;line-height:1.7;">You chose this nudge. Change the time, pick quiet days or pause it any time in <a href="${APP_URL}" style="color:#0F1215;">Settings</a>.<br>© ${year} Motivate Coaching</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async () => {
  const now = new Date()
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  if (VAPID_PRIVATE_KEY) webpush.setVapidDetails('mailto:stuart@motivate-coaching.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const { data: profiles, error } = await admin.from('showup_profiles').select('*').or('remind_email.eq.true,remind_push.eq.true')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  // Who is due right now?
  const due: { p: Profile; local: ReturnType<typeof localParts> }[] = []
  for (const p of (profiles || []) as Profile[]) {
    const local = localParts(now, p.timezone)
    const [h, m] = String(p.reminder_time).split(':').map(Number)
    const since = local.minutes - (h * 60 + m)
    if (since < 0 || since >= WINDOW_MINS) continue
    if (!(p.reminder_days || []).includes(local.dow)) continue
    if (p.paused_until && p.paused_until >= local.date) continue
    due.push({ p, local })
  }
  if (!due.length) return new Response(JSON.stringify({ due: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const ids = due.map((d) => d.p.user_id)
  const { data: habits } = await admin.from('showup_habits').select('id,user_id,what,dimmer,length_days,start_date,mode').in('user_id', ids).eq('status', 'active').order('created_at', { ascending: false })
  const habitByUser = new Map<string, Habit>()
  for (const h of (habits || []) as Habit[]) if (!habitByUser.has(h.user_id)) habitByUser.set(h.user_id, h)
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map((users?.users || []).map((u: { id: string; email?: string }) => [u.id, u.email || '']))

  let emails = 0, pushes = 0
  for (const { p, local } of due) {
    const habit = habitByUser.get(p.user_id)
    if (!habit) continue
    const day = daysBetween(habit.start_date, local.date) + 1
    if (day < 1 || day > habit.length_days) continue
    const { data: ticks } = await admin.from('showup_entries').select('day').eq('habit_id', habit.id)
    const ticked = new Set((ticks || []).map((t: { day: number }) => t.day))
    if (ticked.has(day)) continue
    const comeback = day > 1 && !ticked.has(day - 1) && ticked.size > 0
    const line = LINES[(day - 1) % LINES.length]

    if (p.remind_email && emailById.get(p.user_id)) {
      const { error: logErr } = await admin.from('showup_reminder_log').insert({ user_id: p.user_id, local_date: local.date, channel: 'email' })
      if (!logErr) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [emailById.get(p.user_id)], subject: `Day ${day}: ${habit.what}`, html: emailHtml({ day, length: habit.length_days, what: habit.what, dimmer: habit.dimmer, line, comeback }) }),
        })
        if (res.ok) emails++
        else { console.error('[showup-reminders] Resend error', await res.text()); await admin.from('showup_reminder_log').delete().match({ user_id: p.user_id, local_date: local.date, channel: 'email' }) }
      }
    }

    if (p.remind_push && VAPID_PRIVATE_KEY) {
      const { error: logErr } = await admin.from('showup_reminder_log').insert({ user_id: p.user_id, local_date: local.date, channel: 'push' })
      if (!logErr) {
        const { data: subs } = await admin.from('showup_push_subscriptions').select('*').eq('user_id', p.user_id)
        const payload = JSON.stringify({ title: comeback ? `Day ${day}: a comeback day` : `Day ${day}: ${habit.what}`, body: `Done it? One tap. Hard day? ${habit.dimmer}`, url: APP_URL + '?from=push' })
        for (const s of subs || []) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3 * 3600 })
            pushes++
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode
            if (code === 404 || code === 410) await admin.from('showup_push_subscriptions').delete().eq('endpoint', s.endpoint)
            else console.error('[showup-reminders] push error', code, (e as Error).message)
          }
        }
      }
    }
  }
  console.log(`[showup-reminders] due=${due.length} emails=${emails} pushes=${pushes}`)
  return new Response(JSON.stringify({ due: due.length, emails, pushes }), { headers: { 'Content-Type': 'application/json' } })
})
