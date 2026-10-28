// showup-code/index.ts
// Passwordless sign-in for Let’s Go: email a 6-digit code, then swap a correct code for a one-time sign-in token.
// Also hands the app the public half of the phone-notification key (the server creates the pair itself).
// Secret: RESEND_API_KEY lives in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = '"Let\'s Go!" <stuart@motivate-coaching.com>'
const CODE_MINUTES = 10
const MAX_ATTEMPTS = 5
const MAX_SENDS_PER_HOUR = 5
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('')
}
function sixDigits() {
  const a = new Uint32Array(1); crypto.getRandomValues(a)
  return String(a[0] % 1_000_000).padStart(6, '0')
}
type Plan = { what?: string; mine?: string; anchor?: string; dimmer?: string; length?: number; mode?: string; name?: string }
function esc(s: unknown) {
  return String(s ?? '').slice(0, 300).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
function planBlock(p: Plan) {
  const row = (label: string, value: string) => value ? `<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4A4A4A;">${label}</p><p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1A1A1A;">${value}</p>` : ''
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;border-radius:6px;margin:0 0 24px;"><tr><td style="padding:18px 20px 6px;">
${row('My habit', `<b>${esc(p.what)}</b>${p.length ? `, for ${Number(p.length) || 30} days` : ''}`)}
${row('My words', p.mine ? `“${esc(p.mine)}”` : '')}
${row('When', esc(p.anchor))}
${row(p.mode === 'less' ? 'Tough day? My smaller version' : 'Tough day? My lighter version', esc(p.dimmer))}
</td></tr></table>`
}
function emailHtml(code: string, plan?: Plan) {
  const hasPlan = !!(plan && plan.what)
  const hi = hasPlan && plan!.name ? `${esc(plan!.name)}, your plan is ready.` : 'Your plan is ready.'
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${hasPlan ? 'Activate your plan' : 'Your Let’s Go! code'}</title></head>
<body style="margin:0;padding:0;background:#F5F1EB;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F1EB;padding:28px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:10px;"><tr><td style="padding:32px;">
<p style="margin:0 0 10px;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:#1A1A1A;">Let’s Go<span style="color:#C9930A;">!</span></p>
<h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,serif;font-weight:400;font-size:28px;color:#1A1A1A;">${hasPlan ? hi : 'Your sign-in code'}</h1>
${hasPlan ? planBlock(plan!) + '<p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#4A4A4A;">Your code to activate it:</p>' : ''}
<p style="margin:0 0 18px;font-size:42px;font-weight:600;letter-spacing:0.18em;color:#0F1215;">${code}</p>
<p style="margin:0;font-size:14px;line-height:1.6;color:#4A4A4A;">${hasPlan ? 'Type it into the app to activate your plan and get started today.' : 'Type it into the app to sign in.'} It works for ${CODE_MINUTES} minutes. If you didn't ask for this, you can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`
}
async function vapidPublic() {
  const { data } = await admin.from('showup_server_keys').select('name,value').in('name', ['vapid_public', 'vapid_private'])
  const pub = data?.find((r) => r.name === 'vapid_public')?.value
  if (pub) return pub
  const keys = webpush.generateVAPIDKeys()
  await admin.from('showup_server_keys').upsert([{ name: 'vapid_public', value: keys.publicKey }, { name: 'vapid_private', value: keys.privateKey }], { onConflict: 'name', ignoreDuplicates: true })
  const { data: again } = await admin.from('showup_server_keys').select('value').eq('name', 'vapid_public').single()
  return again?.value || keys.publicKey
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let body: { action?: string; email?: string; code?: string; plan?: Plan }
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }

  if (body.action === 'vapid') return json({ key: await vapidPublic() })

  // Delete my Let’s Go data: removes the signed-in person's account, and with it everything they saved.
  if (body.action === 'delete') {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: who } = await admin.auth.getUser(token)
    if (!who?.user) return json({ error: 'sign_in' }, 401)
    const del = await admin.auth.admin.deleteUser(who.user.id)
    if (del.error) { console.error('[showup-code] delete', del.error.message); return json({ error: 'delete_failed' }, 500) }
    return json({ ok: true })
  }

  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ error: 'email' }, 400)

  if (body.action === 'send') {
    if (!RESEND_API_KEY) return json({ error: 'not_configured' }, 503)
    const { data: row } = await admin.from('showup_login_codes').select('*').eq('email', email).maybeSingle()
    const now = Date.now()
    let sends = 1
    if (row) {
      const since = now - Date.parse(row.sent_at)
      if (since < 30_000) return json({ error: 'wait' }, 429)
      sends = since < 3_600_000 ? row.sends_this_hour + 1 : 1
      if (sends > MAX_SENDS_PER_HOUR) return json({ error: 'too_many' }, 429)
    }
    const code = sixDigits()
    await admin.from('showup_login_codes').upsert({ email, code_hash: await sha256(email + ':' + code), expires_at: new Date(now + CODE_MINUTES * 60_000).toISOString(), attempts: 0, sent_at: new Date(now).toISOString(), sends_this_hour: sends }, { onConflict: 'email' })
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [email], subject: body.plan?.what ? `Activate your plan: ${code}` : `Your Let’s Go! code: ${code}`, html: emailHtml(code, body.plan), text: body.plan?.what ? `Your plan: ${String(body.plan.what).slice(0, 300)}. Your code to activate it is ${code}. It works for ${CODE_MINUTES} minutes.` : `Your Let’s Go! code is ${code}. It works for ${CODE_MINUTES} minutes.` }),
    })
    if (!res.ok) { console.error('[showup-code] Resend', res.status, (await res.text()).slice(0, 200)); return json({ error: 'email_failed' }, 502) }
    return json({ ok: true })
  }

  if (body.action === 'verify') {
    const code = String(body.code || '').replace(/\D/g, '')
    const { data: row } = await admin.from('showup_login_codes').select('*').eq('email', email).maybeSingle()
    if (!row || Date.parse(row.expires_at) < Date.now()) return json({ error: 'expired' }, 400)
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: 'too_many' }, 429)
    if ((await sha256(email + ':' + code)) !== row.code_hash) {
      await admin.from('showup_login_codes').update({ attempts: row.attempts + 1 }).eq('email', email)
      return json({ error: 'wrong', left: MAX_ATTEMPTS - row.attempts - 1 }, 400)
    }
    await admin.from('showup_login_codes').delete().eq('email', email)
    // New here? Create the account. Already have one? Carry on.
    const created = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (created.error && !/already|registered|exists/i.test(created.error.message)) { console.error('[showup-code] create', created.error.message); return json({ error: 'account' }, 500) }
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const token_hash = link.data?.properties?.hashed_token
    if (!token_hash) { console.error('[showup-code] link', link.error?.message); return json({ error: 'account' }, 500) }
    // Tidy up: if they were using a guest session for challenge ideas, remove that guest account now they have a real one.
    try {
      const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
      const { data: g } = await admin.auth.getUser(bearer)
      if (g?.user?.is_anonymous) {
        // Keep anything they sent as a guest (like tester feedback) by moving it to their real account first.
        const realId = link.data?.user?.id || created.data?.user?.id
        if (realId) await admin.from('showup_feedback').update({ user_id: realId }).eq('user_id', g.user.id)
        await admin.auth.admin.deleteUser(g.user.id)
      }
    } catch { /* not a guest, nothing to tidy */ }
    // Let Stuart know when someone new activates (not for his own addresses).
    if (!created.error && !['stuart.fairbairns@gmail.com', 'stuart@motivate-coaching.com'].includes(email) && RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: ['stuart@motivate-coaching.com'], subject: `New Let’s Go! account: ${email}`, html: `<p style="font-family:Poppins,Helvetica,Arial,sans-serif;font-size:16px;color:#1A1A1A;">${esc(email)} just activated their plan in <b>Let’s Go<span style="color:#C9930A;">!</span></b></p><p style="font-family:Poppins,Helvetica,Arial,sans-serif;"><a href="https://motivate-coaching.github.io/tlr-hub/letsgo/admin.html" style="color:#0F1215;">Open your view</a></p>` }),
        })
      } catch { /* the sign-in matters more than the alert */ }
    }
    return json({ token_hash, isNew: !created.error })
  }
  return json({ error: 'action' }, 400)
})
