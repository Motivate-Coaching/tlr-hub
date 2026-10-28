// showup-notify/index.ts
// Emails Stuart when someone sends tester feedback, with a short summary and a link to his view.
// Called by feedback.html straight after the feedback row is saved. Reads the row itself, so nobody can send made-up text through it.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!RESEND_API_KEY) return json({ error: 'not_configured' }, 503)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
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
