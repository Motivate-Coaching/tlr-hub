// scorecard-submit/index.ts
// Saves a completed Clarity Scorecard and emails the person their results.
// Called by https://the-living-room.com/scorecard/ (no sign-in). Scores are worked out here, not trusted from the page.
// Secrets (RESEND_API_KEY) live in Supabase secrets, never in this file.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('TLR_EMAIL_FROM') ?? 'The Living Room <stuart@motivate-coaching.com>'
const REPLY_TO = 'stuart@motivate-coaching.com'
const SITE = 'https://the-living-room.com'
const ALLOWED = ['https://the-living-room.com', 'https://www.the-living-room.com', 'https://tlr-the-living-room.netlify.app', 'http://localhost:8765']

const AREAS = [
  { name: 'Mental Clarity', q: 'What’s one open loop you could close, or deliberately park, this week?',
    desc: { low: 'Your answers suggest your mind may be working overtime, carrying open loops and background noise even when nothing urgent is happening.', mid: 'You seem to have moments of real clarity, but they may be fragile, especially when life gets full.', high: 'Your answers suggest the background noise is mostly quiet, leaving room to focus on what matters.' } },
  { name: 'Energy & Agency', q: 'Where are you saying yes when you’d really like to say no?',
    desc: { low: 'You may be giving a lot of your energy to obligations and other people’s priorities, and it could be costing more than it looks.', mid: 'You’re making some intentional choices, though old patterns of saying yes may still pull at you.', high: 'Your time and energy seem largely directed by choice rather than obligation.' } },
  { name: 'Self-Trust', q: 'Think of a decision you got right. What did you know then that you’re doubting now?',
    desc: { low: 'You may find yourself second-guessing decisions after making them, replaying them or looking for reassurance.', mid: 'You often back yourself, though some decisions may still come with a quiet round of doubt.', high: 'Your answers suggest you generally back your own judgement, even when others see it differently.' } },
  { name: 'Direction', q: 'If your diary matched what matters most, what would change first?',
    desc: { low: 'There may be a gap between what you say matters and where your time actually goes, with several things pulling for first place.', mid: 'Parts of your life seem to line up with what matters, and a few key areas may be asking for a rethink.', high: 'What you say matters and how you spend your time seem to be largely in step.' } },
  { name: 'Support', q: 'Who helps you move forward, not just feel better? Who could?',
    desc: { low: 'Your support around growth may feel thin right now, or you may tend to keep things to yourself.', mid: 'You seem to have people who reassure you. You may have fewer who also stretch you.', high: 'You seem to have people who both back you and push you forward, and you ask for help when you need it.' } },
]
// question area and type: n = agreeing scores low, p = agreeing scores high, c = choice
const QS: [number, 'n' | 'p' | 'c'][] = [[0,'n'],[0,'n'],[0,'n'],[1,'n'],[1,'p'],[1,'n'],[2,'n'],[2,'p'],[2,'c'],[3,'p'],[3,'n'],[3,'c'],[4,'p'],[4,'p'],[4,'c']]
const CHOICE = [5, 4, 2, 1]
const LVL: Record<string, string> = { low: 'Asking for attention', mid: 'Room to grow', high: 'Working well' }
const lvl = (s: number) => (s <= 3 ? 'low' : s <= 6 ? 'mid' : 'high')
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function scores(ans: number[]): number[] {
  const t = [0, 0, 0, 0, 0]
  QS.forEach(([c, ty], i) => { const a = ans[i]; t[c] += ty === 'n' ? a + 1 : ty === 'p' ? 5 - a : CHOICE[a] })
  return t.map(x => Math.round((x / 15) * 10))
}

function emailHtml(name: string, cats: number[]): string {
  const o = cats.map((s, k) => [s, k]); const lo = o.reduce((a, b) => (b[0] < a[0] ? b : a)); const hi = o.reduce((a, b) => (b[0] > a[0] ? b : a))
  const link = `${SITE}/scorecard/?s=${cats.join('-')}`
  const rows = cats.map((s, k) => `
    <tr><td style="padding:14px 0 4px;font-size:15px;font-weight:600;color:#111111;">${AREAS[k].name}</td>
        <td align="right" style="padding:14px 0 4px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8A6A32;">${LVL[lvl(s)]}</td></tr>
    <tr><td colspan="2" style="padding:0 0 4px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#E3DCD0;border-radius:6px;"><tr>
      <td width="${Math.max(s, 0.5) * 10}%" style="background:#BF9A60;height:10px;border-radius:6px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
    <tr><td colspan="2" style="padding:6px 0 0;font-size:14px;color:#5E584F;line-height:1.6;">${AREAS[k].desc[lvl(s) as 'low']}</td></tr>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Clarity Scorecard</title></head>
<body style="margin:0;padding:0;background:#FAF6EF;font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;">Your five areas, and one question to bring to The Living Room.</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF6EF;padding:28px 14px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
  <tr><td bgcolor="#000000" style="background:#000000;border-radius:10px 10px 0 0;padding:26px 32px 30px;">
    <img src="${SITE}/assets/tlr-logo.png" width="150" alt="TLR, Tools for life" style="display:block;width:150px;height:auto;border:0;color:#FAF6EF;">
    <p style="margin:22px 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#BF9A60;">Clarity Scorecard</p>
    <h1 style="margin:0;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:34px;line-height:1.05;text-transform:uppercase;color:#FAF6EF;">${esc(name)}, here’s what your answers show</h1>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:28px 32px 8px;">
    <p style="margin:0 0 6px;font-size:15px;color:#111111;line-height:1.65;">Thanks for taking the scorecard. Here are your five areas. It reflects how you feel today, and it will shift as life does.</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:22px 32px 6px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" width="50%" style="padding:16px;border:1px solid #E3DCD0;border-top:4px solid #111111;border-radius:6px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#111111;">Where you’re strongest</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#111111;">${AREAS[hi[1]].name}</p></td>
      <td width="12"></td>
      <td valign="top" width="50%" style="padding:16px;border:1px solid #E3DCD0;border-top:4px solid #BF9A60;border-radius:6px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8A6A32;">Your growth edge</p>
        <p style="margin:0;font-size:17px;font-weight:600;color:#111111;">${AREAS[lo[1]].name}</p></td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#FFFFFF;padding:18px 32px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE3CC;border-radius:6px;"><tr><td style="padding:18px 20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8A6A32;">Your question to bring to The Living Room</p>
      <p style="margin:0;font-size:18px;font-weight:600;color:#111111;line-height:1.45;">${AREAS[lo[1]].q}</p>
    </td></tr></table>
    <p style="margin:18px 0 22px;font-size:15px;color:#5E584F;line-height:1.65;">Bring it to a live session and explore it with Stu and the group. You don’t need to have it worked out first.</p>
    <a href="${link}" style="display:inline-block;background:#BF9A60;color:#000000;text-decoration:none;font-size:15px;font-weight:600;padding:14px 26px;border-radius:4px;">See your full results and charts</a>
  </td></tr>
  <tr><td style="background:#F1EBE1;border-radius:0 0 10px 10px;padding:18px 32px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#5E584F;line-height:1.7;">Your scorecard isn’t a diagnosis or a test you can pass or fail. Take it again in three months and see what’s moved.<br>The Living Room · <a href="${SITE}/privacy" style="color:#5E584F;">Privacy</a></p>
  </td></tr>
</table></td></tr></table></body></html>`
}

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: h })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: h })
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } })

  let body: { name?: unknown; email?: unknown; answers?: unknown }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  const answers = Array.isArray(body.answers) ? body.answers : []
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'bad_contact' }, 400)
  if (answers.length !== QS.length || answers.some((a, i) => !Number.isInteger(a) || a < 0 || a > (QS[i][1] === 'c' ? 3 : 4))) return json({ error: 'bad_answers' }, 400)

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await db.from('scorecard_responses').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since)
  if ((count ?? 0) >= 5) return json({ error: 'too_many' }, 429)

  const cats = scores(answers as number[])
  const { error } = await db.from('scorecard_responses').insert({ first_name: name, email, answers, scores: cats })
  if (error) { console.error('[scorecard-submit] insert failed', error.message); return json({ error: 'save_failed' }, 500) }

  let emailed = false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [email], subject: 'Your Clarity Scorecard results', html: emailHtml(name, cats) }),
  })
  if (res.ok) emailed = true; else console.error('[scorecard-submit] Resend error', await res.text())
  return json({ ok: true, emailed })
})
