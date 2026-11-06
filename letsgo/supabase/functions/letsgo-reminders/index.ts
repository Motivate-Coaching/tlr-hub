// letsgo-reminders/index.ts
// Let's Go! V2 nudges, run every 15 minutes by pg_cron. Reads only V2's own tables (lg_*).
// Each person gets at most one nudge per channel per local day, at the time they chose, in their own time zone,
// and only on days something in their plan is due (or a weekly target is still open) and not yet logged.
// Never during a break, before the plan starts, after it ends, or once it's finished. Links open V2.
// Secret: RESEND_API_KEY lives in Supabase secrets. The phone-notification key pair lives in showup_server_keys (server-made).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = '"Let\'s Go!" <letsgo@motivate-coaching.com>'
const REPLY_TO = 'letsgo@motivate-coaching.com'
const APP_URL = 'https://letsgo.motivate-coaching.com/'
const WINDOW_MINS = 60

const LINES = [
  'Showing up beats consistency.',
  'Follow the plan, not the feeling.',
  'On any given day, if you only have 20% to give and you give that 20%, you’re giving 100%.',
  'It’s a dimmer switch, not a light switch. Some days a 10, some days a 1. Both count.',
  'You don’t need to feel like it. You just need to start.',
  'Small and done beats big and someday.',
  'Missed one? The next one is a comeback, and comebacks count.',
]

type Rule = { from: string; type: 'days' | 'every' | 'weekly'; days?: number[]; n?: number; anchor?: string; times?: number }
type Action = { id: string; focus_id: string; text: string; small: string; cue: string; schedules: Rule[]; active_from: string | null; until: string | null; extra: { retired?: boolean } }
type Focus = { id: string; user_id: string; title: string; mode: string; start_date: string; length_days: number; pauses: { from: string; to?: string }[]; finished_on: string | null; matters?: string; extra: { mine?: string; deeper?: string } }

function localParts(now: Date, tz: string): { date: string; minutes: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: +get('hour') * 60 + +get('minute') }
  } catch { return localParts(now, 'Europe/London') }
}
const ms = (k: string) => Date.parse(k + 'T12:00:00Z')
const diffDays = (a: string, b: string) => Math.round((ms(a) - ms(b)) / 86_400_000)
const addDays = (k: string, n: number) => new Date(ms(k) + n * 86_400_000).toISOString().slice(0, 10)
const weekday = (k: string) => new Date(ms(k)).getUTCDay()
const weekStart = (k: string) => addDays(k, -((weekday(k) + 6) % 7))
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// The same schedule rules as the app (model.js).
function ruleFor(a: Action, k: string) { const v = (a.schedules || []).filter((s) => s.from <= k); return v.length ? v[v.length - 1] : (a.schedules || [])[0] }
function paused(f: Focus, k: string) { return (f.pauses || []).some((p) => k >= p.from && (!p.to || k <= p.to)) }
function inRange(f: Focus, a: Action, k: string) { const end = addDays(f.start_date, f.length_days - 1); return k >= f.start_date && k <= end && (!a.active_from || k >= a.active_from) && (!a.until || k <= a.until) && (!f.finished_on || k <= f.finished_on) }
function isDue(f: Focus, a: Action, k: string) {
  if (!inRange(f, a, k) || paused(f, k)) return false
  const r = ruleFor(a, k); if (!r) return false
  if (r.type === 'days') return (r.days || []).includes(weekday(k))
  if (r.type === 'every') { const d = diffDays(k, r.anchor || f.start_date); return d >= 0 && d % (r.n || 2) === 0 }
  return false
}

function emailHtml(o: { focus: string; less: boolean; items: { text: string; small: string; cue: string; weekly?: string }[]; line: string; mine?: string; day: number; length: number }) {
  const year = new Date().getUTCFullYear()
  const list = o.items.map((i) => `<tr><td style="padding:14px 18px;border-bottom:1px solid #E5DDD1;">
      <p style="margin:0 0 4px;font-size:17px;font-weight:600;color:#1A1A1A;">${esc(i.text)}</p>
      ${i.cue || i.weekly ? `<p style="margin:0 0 6px;font-size:14px;color:#4A4A4A;">${esc([i.cue, i.weekly].filter(Boolean).join(' · '))}</p>` : ''}
      ${i.small ? `<p style="margin:0;font-size:14px;color:#4A4A4A;">Tough day? <b style="color:#1A1A1A;">${esc(i.small)}</b> still counts.</p>` : ''}
    </td></tr>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Today</title></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:28px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td bgcolor="#0F1215" align="center" style="background:#0F1215;border-radius:10px 10px 0 0;padding:22px 32px 18px;">
    <a href="${APP_URL}" style="text-decoration:none;font-size:26px;font-weight:700;color:#FFFFFF;">Let’s Go<span style="color:#C9930A;">!</span></a>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:30px 32px 28px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4A4A;">${o.less ? 'Cutting back on' : 'My focus'}: ${esc(o.focus)}</p>
    <h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:30px;line-height:1.15;color:#1A1A1A;">Today counts.</h1>
    ${o.mine ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#1A1A1A;border-left:3px solid #C9930A;padding-left:12px;">“${esc(o.mine)}”</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;border-radius:6px;margin-bottom:24px;">${list}</table>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr><td align="center">
      <a href="${APP_URL}?from=email" style="display:inline-block;background:#0F1215;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:16px 36px;border-radius:4px;">Open my plan</a>
    </td></tr></table>
    <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:19px;line-height:1.4;color:#1A1A1A;text-align:center;">${esc(o.line)}</p>
  </td></tr>
  <tr><td style="background:#EDE8DF;border-radius:0 0 10px 10px;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#4A4A4A;line-height:1.7;">You chose this nudge. Change the time, take a break or switch it off any time in <a href="${APP_URL}" style="color:#0F1215;">Settings</a>. <a href="https://letsgo.motivate-coaching.com/privacy.html" style="color:#0F1215;">Privacy</a><br>© ${year} Motivate Coaching</p>
  </td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async () => {
  const now = new Date()
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: vk } = await admin.from('showup_server_keys').select('name,value').in('name', ['vapid_public', 'vapid_private'])
  const VPUB = vk?.find((r: { name: string }) => r.name === 'vapid_public')?.value || ''
  const VPRIV = vk?.find((r: { name: string }) => r.name === 'vapid_private')?.value || ''
  if (VPRIV) webpush.setVapidDetails('mailto:stuart@motivate-coaching.com', VPUB, VPRIV)

  const { data: profiles, error } = await admin.from('lg_profiles').select('user_id,timezone,reminder_time,remind_email,remind_push').or('remind_email.eq.true,remind_push.eq.true')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const due: { uid: string; email: boolean; push: boolean; date: string }[] = []
  for (const p of profiles || []) {
    const local = localParts(now, p.timezone || 'Europe/London')
    const [h, m] = String(p.reminder_time || '07:00').split(':').map(Number)
    const since = local.minutes - (h * 60 + m)
    if (since >= 0 && since < WINDOW_MINS) due.push({ uid: p.user_id, email: p.remind_email, push: p.remind_push, date: local.date })
  }
  if (!due.length) return new Response(JSON.stringify({ due: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const ids = due.map((d) => d.uid)
  const [{ data: focuses }, { data: actions }] = await Promise.all([
    admin.from('lg_focuses').select('id,user_id,title,mode,start_date,length_days,pauses,finished_on,matters,extra').in('user_id', ids).eq('status', 'active'),
    admin.from('lg_actions').select('id,focus_id,text,small,cue,schedules,active_from,until,extra').in('user_id', ids),
  ])
  let emails = 0, pushes = 0, skipped = 0
  for (const d of due) {
    const f = ((focuses || []) as Focus[]).filter((x) => x.user_id === d.uid).sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
    if (!f) { skipped++; continue }
    const acts = ((actions || []) as Action[]).filter((a) => a.focus_id === f.id && !a.extra?.retired)
    const ws = weekStart(d.date)
    const { data: checks } = await admin.from('lg_checkins').select('action_id,day,kind').in('action_id', acts.map((a) => a.id)).gte('day', ws)
    const counted = (aid: string, day: string) => (checks || []).some((c: { action_id: string; day: string; kind: string }) => c.action_id === aid && c.day === day && (c.kind === 'full' || c.kind === 'small'))
    const items: { text: string; small: string; cue: string; weekly?: string }[] = []
    const cue = (c: string) => { const x = String(c || '').trim(); return x ? (f.mode === 'less' ? 'Usually ' + x : /^when /i.test(x) ? x : 'After I ' + x) : '' }
    for (const a of acts) {
      if (!inRange(f, a, d.date) || paused(f, d.date)) continue
      const r = ruleFor(a, d.date); if (!r) continue
      if (r.type === 'weekly') {
        let done = 0; for (let i = 0; i < 7; i++) if (counted(a.id, addDays(ws, i))) done++
        if (done < (r.times || 1) && !counted(a.id, d.date)) items.push({ text: a.text, small: a.small, cue: cue(a.cue), weekly: `${done} of ${r.times} this week` })
      } else if (isDue(f, a, d.date) && !counted(a.id, d.date)) items.push({ text: a.text, small: a.small, cue: cue(a.cue) })
    }
    if (!items.length) { skipped++; continue }
    const day = diffDays(d.date, f.start_date) + 1
    // Every third day, their own why (word for word, never reworded) replaces the quote, to bring the feeling back.
    const why = String(f.extra?.deeper || f.matters || '').trim().slice(0, 160)
    const whyDay = !!why && day % 3 === 0
    const line = whyDay ? `Why it matters to you: “${why}”` : LINES[(day - 1 + LINES.length) % LINES.length]
    const subject = items.length === 1 ? `Today: ${items[0].text}` : `Today: ${items.length} things in your plan`

    if (d.email) {
      const { error: logErr } = await admin.from('lg_reminder_log').insert({ user_id: d.uid, local_date: d.date, channel: 'email' })
      if (!logErr) {
        const { data: u } = await admin.auth.admin.getUserById(d.uid)
        const to = u?.user?.email
        if (to) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html: emailHtml({ focus: f.title, less: f.mode === 'less', items, line, mine: String(f.extra?.mine || '').trim(), day, length: f.length_days }) }),
          })
          if (res.ok) emails++
          else { console.error('[letsgo-reminders] Resend', res.status); await admin.from('lg_reminder_log').delete().match({ user_id: d.uid, local_date: d.date, channel: 'email' }) }
        }
      }
    }
    if (d.push && VPRIV) {
      const { error: logErr } = await admin.from('lg_reminder_log').insert({ user_id: d.uid, local_date: d.date, channel: 'push' })
      if (!logErr) {
        const { data: subs } = await admin.from('lg_push_subscriptions').select('*').eq('user_id', d.uid)
        const first = items[0]
        const payload = JSON.stringify({ title: subject, body: whyDay ? `Why it matters to you: “${why}”` : (first.cue && f.mode !== 'less' ? first.cue + '. ' : '') + (first.small ? `Tough day? ${first.small}` : 'One tap when it’s done.'), url: APP_URL + '?from=push' })
        for (const s of subs || []) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3 * 3600 }); pushes++ }
          catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) await admin.from('lg_push_subscriptions').delete().eq('endpoint', s.endpoint); else console.error('[letsgo-reminders] push', code) }
        }
      }
    }
  }
  console.log(`[letsgo-reminders] due=${due.length} emails=${emails} pushes=${pushes} skipped=${skipped}`)
  return new Response(JSON.stringify({ due: due.length, emails, pushes, skipped }), { headers: { 'Content-Type': 'application/json' } })
})
