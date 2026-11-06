// letsgo-reminders/index.ts
// Let's Go! V2 nudges, run every 15 minutes by pg_cron. Reads only V2's own tables (lg_*).
// Each person gets at most one nudge per channel per local day, at the time they chose, in their own time zone,
// and only on days something in their plan is due (or a weekly target is still open) and not yet logged.
// Never during a break, before the plan starts, after it ends, or once it's finished. Links open V2.
// Wording rotates from a pool in Stu's voice and never repeats within 14 days (lg_reminder_log.msg). Rhythm (lg_profiles.settings.rhythm):
// 'all' every planned day, 'some' at most 3 in any 7 days, 'quiet' only a come-back note after they go quiet.
// Their own why appears only in a come-back note, word for word, at most once in 7 days. Evidence: Let's Go! planning doc, Nudges section.
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

type Ctx = { action: string; cue: string; small: string; week: number; total: number; day: number; length: number; why: string; weekday: number; less: boolean }
type Msg = { id: string; ok?: (c: Ctx) => boolean; text: (c: Ctx) => string }
const low = (t: string) => t ? t.charAt(0).toLowerCase() + t.slice(1) : t
// Everyday nudges. Every one is Stu's voice; edits come from his review table.
const EVERYDAY: Msg[] = [
  { id: 'e01', ok: (c) => !!c.cue && !c.less, text: (c) => `${c.cue}. That’s your moment today.` },
  { id: 'e02', ok: (c) => c.week >= 1, text: (c) => `${c.week} show-up${c.week === 1 ? '' : 's'} this week so far. Today could make it ${c.week + 1}.` },
  { id: 'e03', ok: (c) => c.total >= 5, text: (c) => `${c.total} show-ups so far. That’s not luck, that’s you.` },
  { id: 'e04', ok: (c) => c.day >= 1 && c.day <= c.length, text: (c) => `Day ${c.day} of ${c.length}. One small step, then get on with your day.` },
  { id: 'e05', text: () => 'Follow the plan, not the feeling.' },
  { id: 'e06', text: () => 'If you’ve only got 20% today, give the 20%. That’s you giving 100%.' },
  { id: 'e07', text: () => 'It’s a dimmer switch, not a light switch. Some days a 10, some days a 1. Both count.' },
  { id: 'e08', text: () => 'You don’t need to feel like it. You just need to start.' },
  { id: 'e09', text: () => 'Small and done beats big and someday.' },
  { id: 'e10', text: () => 'Five minutes counts. So does two.' },
  { id: 'e11', text: () => 'No need to be brilliant today. Just be there.' },
  { id: 'e12', text: () => 'Here’s your nudge. You did ask for it, to be fair.' },
  { id: 'e13', text: (c) => `Quick one: ${low(c.action)}. Then tick it off and enjoy feeling slightly smug.` },
  { id: 'e14', text: () => 'The hardest part is the first minute. It gets easier from there.' },
  { id: 'e15', text: () => 'Done beats perfect. Every single time.' },
  { id: 'e16', ok: (c) => c.weekday === 0 || c.weekday === 6, text: () => 'Weekend. Do today’s bit early and the rest of the day is yours.' },
  { id: 'e17', ok: (c) => c.weekday === 1, text: () => 'New week. Same you, one small step.' },
  { id: 'e18', text: () => 'Showing up beats consistency.' },
  { id: 'e19', text: () => 'Your plan, your way. Today’s bit is a small one.' },
  { id: 'e20', text: () => 'Hold it lightly. Just do today’s bit.' },
]
// Come-back notes, only after they've gone quiet. w* quote their own why, word for word.
const COMEBACK: Msg[] = [
  { id: 'w1', ok: (c) => !!c.why, text: (c) => `You said this matters because: “${c.why}”. One small step today brings you back.` },
  { id: 'w2', ok: (c) => !!c.why, text: (c) => `Remember why you started: “${c.why}”. The lighter version counts.` },
  { id: 'c1', text: (c) => `It’s been a couple of days. No guilt and no catching up. Just today: ${low(c.small || c.action)}.` },
  { id: 'c2', text: () => 'Life gets busy. Your plan is still here. One tap today is a comeback.' },
  { id: 'c3', text: () => 'Comebacks count. Today could be one.' },
  { id: 'c4', text: (c) => `No need to start over. Just pick it back up: ${low(c.small || c.action)}.` },
  { id: 'c5', text: () => 'Still here, still on your side. Today’s step is a small one.' },
  { id: 'c6', text: (c) => `Whenever you’re ready: ${low(c.small || c.action)}. That’s all it takes to be back.` },
]
function hash(t: string) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h) }
// Never a message used in the last 14 days; their why at most once in 7. If everything has been used, the least recently used wins.
function choose(pool: Msg[], c: Ctx, recent: { msg: string; date: string }[], today: string, seed: string): Msg | null {
  const whyRecent = recent.some((r) => r.msg.startsWith('w') && diffDays(today, r.date) < 7)
  const elig = pool.filter((m) => (!m.ok || m.ok(c)) && !(m.id.startsWith('w') && whyRecent))
  if (!elig.length) return null
  const fresh = elig.filter((m) => !recent.some((r) => r.msg === m.id && diffDays(today, r.date) < 14))
  if (fresh.length) {
    const why = fresh.filter((m) => m.id.startsWith('w')) // when their why is allowed, it leads the come-back note
    const from = why.length ? why : fresh
    return from[hash(seed + today) % from.length]
  }
  const last = (m: Msg) => recent.filter((r) => r.msg === m.id).map((r) => r.date).sort().pop() || ''
  return elig.slice().sort((a, b) => (last(a) < last(b) ? -1 : 1))[0]
}

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

function emailHtml(o: { focus: string; less: boolean; items: { text: string; small: string; cue: string; weekly?: string }[]; line: string; mine?: string; day: number; length: number; href: string }) {
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
      <a href="${o.href}" style="display:inline-block;background:#0F1215;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:16px 36px;border-radius:4px;">Open my plan</a>
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

  const { data: profiles, error } = await admin.from('lg_profiles').select('user_id,timezone,reminder_time,remind_email,remind_push,settings').or('remind_email.eq.true,remind_push.eq.true')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  const due: { uid: string; email: boolean; push: boolean; date: string; rhythm: string }[] = []
  for (const p of profiles || []) {
    const local = localParts(now, p.timezone || 'Europe/London')
    const [h, m] = String(p.reminder_time || '07:00').split(':').map(Number)
    const since = local.minutes - (h * 60 + m)
    if (since >= 0 && since < WINDOW_MINS) due.push({ uid: p.user_id, email: p.remind_email, push: p.remind_push, date: local.date, rhythm: String(p.settings?.rhythm || 'all') })
  }
  if (!due.length) return new Response(JSON.stringify({ due: 0 }), { headers: { 'Content-Type': 'application/json' } })

  const ids = due.map((d) => d.uid)
  const [{ data: focuses }, { data: actions }] = await Promise.all([
    admin.from('lg_focuses').select('id,user_id,title,mode,start_date,length_days,pauses,finished_on,matters,extra').in('user_id', ids).eq('status', 'active'),
    admin.from('lg_actions').select('id,focus_id,text,small,cue,schedules,active_from,until,extra').in('user_id', ids),
  ])
  const logSince = addDays(due.map((d) => d.date).sort()[0], -14)
  const { data: logRows } = await admin.from('lg_reminder_log').select('user_id,local_date,msg').in('user_id', ids).gte('local_date', logSince)
  let emails = 0, pushes = 0, skipped = 0
  for (const d of due) {
    const f = ((focuses || []) as Focus[]).filter((x) => x.user_id === d.uid).sort((a, b) => (a.start_date < b.start_date ? 1 : -1))[0]
    if (!f) { skipped++; continue }
    const acts = ((actions || []) as Action[]).filter((a) => a.focus_id === f.id && !a.extra?.retired)
    const ws = weekStart(d.date)
    const { data: checks } = await admin.from('lg_checkins').select('action_id,day,kind').in('action_id', acts.map((a) => a.id)).gte('day', addDays(d.date, -14) < ws ? addDays(d.date, -14) : ws)
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
    const anyCounted = (k: string) => acts.some((a) => counted(a.id, k))
    // Gone quiet: nothing logged on the last 2 planned days before today (or, for weekly-only plans, nothing in 4 days). Never in the first 3 days.
    let quiet = false
    if (day > 3) {
      const dueDays: string[] = []
      for (let i = 1; i <= 14 && dueDays.length < 2; i++) { const k = addDays(d.date, -i); if (k < f.start_date) break; if (acts.some((a) => isDue(f, a, k))) dueDays.push(k) }
      if (dueDays.length === 2) quiet = !dueDays.some(anyCounted)
      else { quiet = true; for (let i = 1; i <= 4; i++) if (anyCounted(addDays(d.date, -i))) quiet = false }
    }
    const recentAll = ((logRows || []) as { user_id: string; local_date: string; msg: string | null }[]).filter((r) => r.user_id === d.uid)
    const sentDays = [...new Set(recentAll.map((r) => r.local_date))]
    const sentWithin = (n: number) => sentDays.filter((k) => diffDays(d.date, k) < n && k !== d.date).length
    if (d.rhythm === 'quiet' && (!quiet || sentWithin(3) > 0)) { skipped++; continue }
    if (d.rhythm === 'some' && sentWithin(7) >= 3) { skipped++; continue }
    // Long quiet spells: no more than one note every 3 days, so we never nag.
    let longQuiet = day > 10
    for (let i = 1; i <= 10 && longQuiet; i++) if (anyCounted(addDays(d.date, -i))) longQuiet = false
    if (longQuiet && sentWithin(3) > 0) { skipped++; continue }
    let week = 0; for (let i = 0; i < 7; i++) { const k = addDays(ws, i); if (k <= d.date) acts.forEach((a) => { if (counted(a.id, k)) week++ }) }
    const { count: total } = await admin.from('lg_checkins').select('action_id', { count: 'exact', head: true }).in('action_id', acts.map((a) => a.id)).in('kind', ['full', 'small'])
    const first = items[0]
    const ctx: Ctx = { action: first.text, cue: first.cue, small: first.small, week, total: total || 0, day, length: f.length_days, why: String(f.extra?.deeper || f.matters || '').trim().slice(0, 160), weekday: weekday(d.date), less: f.mode === 'less' }
    const recent = recentAll.filter((r) => r.msg).map((r) => ({ msg: r.msg as string, date: r.local_date }))
    const pick = choose(quiet ? COMEBACK : EVERYDAY, ctx, recent, d.date, d.uid) || EVERYDAY[4]
    const line = pick.text(ctx)
    const subject = quiet ? 'Ready when you are' : items.length === 1 ? `Today: ${items[0].text}` : `Today: ${items.length} things in your plan`
    const link = (from: string) => `${APP_URL}?from=${from}&m=${pick.id}`

    if (d.email) {
      const { error: logErr } = await admin.from('lg_reminder_log').insert({ user_id: d.uid, local_date: d.date, channel: 'email', msg: pick.id })
      if (!logErr) {
        const { data: u } = await admin.auth.admin.getUserById(d.uid)
        const to = u?.user?.email
        if (to) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html: emailHtml({ focus: f.title, less: f.mode === 'less', items, line, mine: String(f.extra?.mine || '').trim(), day, length: f.length_days, href: link('email') }) }),
          })
          if (res.ok) emails++
          else { console.error('[letsgo-reminders] Resend', res.status); await admin.from('lg_reminder_log').delete().match({ user_id: d.uid, local_date: d.date, channel: 'email' }) }
        }
      }
    }
    if (d.push && VPRIV) {
      const { error: logErr } = await admin.from('lg_reminder_log').insert({ user_id: d.uid, local_date: d.date, channel: 'push', msg: pick.id })
      if (!logErr) {
        const { data: subs } = await admin.from('lg_push_subscriptions').select('*').eq('user_id', d.uid)
        const payload = JSON.stringify({ title: subject, body: line, url: link('push') })
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
