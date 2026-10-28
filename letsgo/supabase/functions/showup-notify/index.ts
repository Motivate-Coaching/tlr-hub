// showup-notify/index.ts
// Emails Stuart when someone sends tester feedback (called by feedback.html after saving), and when someone new finishes
// setting up a habit (called by the app, checked against its own usage stats so it can't be faked or repeated).
// Reads what it reports from the database itself, so nobody can send made-up text through it.
// Secret: RESEND_API_KEY lives in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = '"Let\'s Go!" <stuart@motivate-coaching.com>'
const TO = 'stuart@motivate-coaching.com'
const ADMIN_URL = 'https://motivate-coaching.github.io/tlr-hub/letsgo/admin.html#feedback'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').slice(0, 300).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// Someone new finished setting up a habit. Works before they've given an email, so it's checked against the app's
// own usage stats: the session must have just finished setup, each session alerts once, and there's a daily cap.
// It never includes anything they wrote.
async function started(admin: ReturnType<typeof createClient>, sid: string) {
  if (!sid) return json({ ok: false })
  const since = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: done } = await admin.from('showup_events').select('detail,view_mode,platform,installed,user_id').eq('session_id', sid).eq('event', 'setup_done').gte('created_at', since).limit(1)
  if (!done?.length) return json({ ok: false, reason: 'not_found' })
  const { data: prior } = await admin.from('showup_events').select('id').eq('session_id', sid).eq('event', 'notified_start').limit(1)
  if (prior?.length) return json({ ok: true, already: true })
  const { count } = await admin.from('showup_events').select('id', { count: 'exact', head: true }).eq('event', 'notified_start').gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
  if ((count || 0) >= 50) return json({ ok: false, reason: 'cap' })
  await admin.from('showup_events').insert({ session_id: sid, event: 'notified_start' })
  const d = done[0] as { detail?: string; view_mode?: string; platform?: string; user_id?: string | null }
  const kind = d.detail === 'less' ? 'Break a habit' : 'Build a habit'
  const plat = ({ android: 'Android phone', ios: 'iPhone', desktop: 'Computer', other: 'Other device' } as Record<string, string>)[d.platform || ''] || 'Unknown device'
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px 16px;background:#F5F1EB;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:10px;"><tr><td style="padding:28px;">
<p style="margin:0 0 10px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#1A1A1A;">Let’s Go<span style="color:#C9930A;">!</span></p>
<h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:26px;color:#1A1A1A;">Someone new just set up a habit</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1A1A;">${esc(kind)} · ${d.view_mode === 'focus' ? 'Focused view' : 'Full view'} · ${esc(plat)}</p>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4A4A4A;">${d.user_id ? 'They already have an account.' : 'They haven’t added their email yet. If they activate their plan, they’ll show in your view.'}</p>
<a href="${ADMIN_URL.replace('#feedback', '')}" style="display:inline-block;background:#0F1215;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:14px 28px;border-radius:4px;">Open your view</a>
</td></tr></table></body></html>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject: `Someone new started Let’s Go! (${kind.toLowerCase()})`, html }),
  })
  if (!res.ok) { console.error('[showup-notify] Resend start', res.status, (await res.text()).slice(0, 200)); return json({ error: 'email_failed' }, 502) }
  console.log('[showup-notify] start sent')
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!RESEND_API_KEY) return json({ error: 'not_configured' }, 503)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  let body: { kind?: string; sid?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }
  if (body.kind === 'started') return started(admin, String(body.sid || '').slice(0, 36))
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return json({ error: 'sign_in' }, 401)

  // Only their own feedback from the last few minutes, and only once per row.
  const since = new Date(Date.now() - 10 * 60_000).toISOString()
  const { data: rows } = await admin.from('showup_feedback').select('id,answer,created_at').eq('user_id', user.id).eq('question', 'tester-feedback').gte('created_at', since).order('created_at', { ascending: false }).limit(1)
  const row = rows?.[0]
  if (!row) return json({ ok: false, reason: 'none' })
  const sent = (user.app_metadata?.showup_notified || []) as string[]
  if (sent.includes(String(row.id))) return json({ ok: true, already: true })

  let j: { route?: string; answers?: Record<string, { pick?: string | string[]; text?: string }>; usage?: { showups?: number; day?: number; length?: number } } = {}
  try { j = JSON.parse(row.answer) } catch { /* keep going with what we have */ }
  const a = j.answers || {}
  const pick = (k: string) => { const p = a[k]?.pick; return Array.isArray(p) ? p.join(', ') : p || '' }
  const lines = [
    ['How much they had used it', j.route || ''],
    ['If it disappeared tomorrow', pick('ellis')],
    ['Setup ease (out of 7)', pick('ease')],
    ['Where they hesitated', pick('hesitate')],
    ['Words for it', pick('words')],
    ['Habit feels automatic (out of 5)', pick('automatic')],
    ['Show-ups so far', j.usage ? `${j.usage.showups ?? 0} (day ${j.usage.day} of ${j.usage.length})` : ''],
  ].filter((l) => l[1])
  const written = Object.values(a).filter((x) => (x?.text || '').trim()).length
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:24px 16px;background:#F5F1EB;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:10px;"><tr><td style="padding:28px;">
<p style="margin:0 0 10px;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#1A1A1A;">Let’s Go<span style="color:#C9930A;">!</span></p>
<h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:26px;color:#1A1A1A;">New tester feedback</h1>
${lines.map((l) => `<p style="margin:0 0 2px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4A4A;">${esc(l[0])}</p><p style="margin:0 0 12px;font-size:16px;color:#1A1A1A;">${esc(l[1])}</p>`).join('')}
<p style="margin:0 0 20px;font-size:14px;color:#4A4A4A;">${written ? `Plus ${written} written answer${written === 1 ? '' : 's'}.` : 'No written answers.'} Their name, if they add one, shows in your view.</p>
<a href="${ADMIN_URL}" style="display:inline-block;background:#0F1215;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:14px 28px;border-radius:4px;">Read it in full</a>
</td></tr></table></body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject: `New Let’s Go! feedback${pick('ellis') ? `: ${pick('ellis')}` : ''}`, html }),
  })
  if (!res.ok) { console.error('[showup-notify] Resend', res.status, (await res.text()).slice(0, 200)); return json({ error: 'email_failed' }, 502) }
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), showup_notified: [...sent, String(row.id)].slice(-20) } })
  console.log('[showup-notify] sent')
  return json({ ok: true })
})
