// showup-reflect/index.ts
// Find my focus: reads back what someone wrote and reflects it in their own words ("What I'm hearing").
// Signed-in users only, a few times a day each. Nothing they write is stored here.
// Secret: ANTHROPIC_API_KEY lives in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODEL = 'claude-haiku-5-5'
const DAILY_LIMIT = 5
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `You help someone choose one focus for a 30-day habit, inside an app made by Stuart Fairbairns, an ICF PCC coach.
They have answered a few open questions. Reflect back what you hear, using their own words as much as possible.
Speak to them directly as "you", never "they" or "someone". Don't add numbers or details they didn't give, such as minutes, unless they wrote them.

Voice: warm, direct, grounded, a little playful. British English. Short sentences. Never generic self-help, never gushing, no clichés.
Never use em dashes or en dashes. Never use exclamation marks. Never diagnose, judge or give advice beyond the focus itself.
Only use what they wrote. Do not invent facts about them.

If anything they wrote suggests they may be at risk of harming themselves or are in crisis, do not suggest a focus.
Instead set "care" to a short, kind message encouraging them to talk to someone they trust or a local helpline, and leave the other fields empty.

Use the reflect tool to give your answer.
Give 2 or 3 options, the strongest first. Options can include trying a past challenge again.`

// Forces a well-formed answer every time.
const TOOL = {
  name: 'reflect',
  description: 'Give the reflection back to the person.',
  input_schema: {
    type: 'object',
    properties: {
      heard: { type: 'string', description: "2 or 3 sentences to them, starting with 'What I'm hearing is'. Empty if care is set." },
      themes: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short themes, 1 to 3 words each.' },
      options: { type: 'array', items: { type: 'object', properties: { focus: { type: 'string', description: 'A focus in their words, under 8 words.' }, why: { type: 'string', description: 'One short sentence on why it might matter to them.' }, daily: { type: 'string', description: 'One small thing they could do most days, under 10 words.' } }, required: ['focus', 'why', 'daily'] }, description: '2 or 3 options, strongest first. Empty if care is set.' },
      care: { type: 'string', description: 'Only if they may be at risk or in crisis: a short, kind message. Otherwise empty.' },
    },
    required: ['heard', 'themes', 'options', 'care'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503)

  // Who is asking? Signed-in users only.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return json({ error: 'sign_in' }, 401)

  // A few reflections per person per day, counted on their account (they can't edit this).
  const today = new Date().toISOString().slice(0, 10)
  const usage = (user.app_metadata?.showup_ai || {}) as { day?: string; n?: number }
  const used = usage.day === today ? usage.n || 0 : 0
  if (used >= DAILY_LIMIT) return json({ error: 'limit' }, 429)

  let body: { answers?: Record<string, string>; wins?: { name: string; outcome: string }[]; horizon?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const labels: Record<string, string> = {
    proud: `Looking back from ${body.horizon || 'three months'} from now, what would make you insanely proud`,
    years: 'Something wanted for years and never got round to',
    new: 'Something new to explore',
    admire: 'Someone admired, and what they would love to get better at',
  }
  const lines: string[] = []
  for (const [k, v] of Object.entries(body.answers || {})) {
    const t = String(v || '').trim().slice(0, 800)
    if (t && labels[k]) lines.push(`${labels[k]}: ${t}`)
  }
  const out: Record<string, string> = { did: 'did it', partly: 'partly', not: "didn't stick" }
  const wins = (body.wins || []).slice(0, 10).map((w) => `${String(w.name).slice(0, 120)} (${out[w.outcome] || 'done before'})`)
  if (wins.length) lines.push(`Things taken on before: ${wins.join('; ')}`)
  if (!lines.length) return json({ error: 'empty' }, 400)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: 'reflect' }, messages: [{ role: 'user', content: lines.join('\n') }] }),
  })
  if (!res.ok) { console.error('[showup-reflect] anthropic', res.status, (await res.text()).slice(0, 300)); return json({ error: 'ai_unavailable' }, 502) }
  const data = await res.json()
  const call = (data.content || []).find((c: { type?: string; name?: string }) => c.type === 'tool_use' && c.name === 'reflect')
  if (!call) { console.error('[showup-reflect] no tool result', data.stop_reason); return json({ error: 'ai_unavailable' }, 502) }
  const parsed = call.input || {}
  const clean = (s: unknown) => String(s || '').replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/!/g, '.').trim()
  const result = {
    heard: clean(parsed.heard),
    themes: (parsed.themes || []).slice(0, 3).map(clean),
    options: (parsed.options || []).slice(0, 3).map((o: { focus?: string; why?: string; daily?: string }) => ({ focus: clean(o.focus), why: clean(o.why), daily: clean(o.daily) })).filter((o: { focus: string }) => o.focus),
    care: clean(parsed.care),
  }

  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), showup_ai: { day: today, n: used + 1 } } })
  console.log(`[showup-reflect] ok user=${user.id.slice(0, 8)} used=${used + 1} in=${data.usage?.input_tokens} out=${data.usage?.output_tokens}`)
  return json({ ...result, left: DAILY_LIMIT - used - 1 })
})
