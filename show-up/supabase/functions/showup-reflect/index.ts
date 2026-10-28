// showup-reflect/index.ts
// Challenge ideas: reads what someone wrote or said, pulls out the main life areas, and suggests a few challenges for each.
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

const SYSTEM = `You help someone find one focus for a habit challenge, inside an app made by Stuart Fairbairns, an ICF PCC coach.
They have written or spoken freely, so it may be long, messy and full of ums. Read all of it and find the life areas that come up most, such as fitness and health, sleep, relationships, work, confidence, money, creativity or calm.
Speak to them directly as "you", never "they" or "someone". Use their own words where you can. Don't add numbers or details they didn't give unless they are part of a simple daily action.

Voice: warm, direct, grounded. British English. Short sentences. Never generic self-help, never gushing, no clichés.
Never use em dashes or en dashes. Never use exclamation marks. Never diagnose or judge.
Only use what they wrote. Do not invent facts about them.

Keep it hopeful and practical. This is about one everyday change: something they'd love more of, or something to do less of.
If they share a lot of heavy, negative or tangled things, acknowledge it briefly and kindly, then focus on what is within their reach. Never read their problems back to them as a list, and never make life sound hopeless.
Frame challenges as bringing something good in where you can (for example "A 10 minute walk after lunch" rather than "Stop sitting all day"), because people stick with goals framed that way more often.

Less is more. Give up to 3 areas, the most prominent first, and only include an area if it genuinely comes up.
For each area give 2 or 3 challenges for the next 30 days. Each should be one small, specific thing they could do most days, small enough to still do on a tough day.

If anything they wrote suggests they may be at risk of harming themselves or are in crisis, do not suggest challenges.
Instead set "care" to a short, kind message encouraging them to talk to someone they trust or a local helpline, and leave areas empty.

Use the ideas tool to give your answer.`

// Forces a well-formed answer every time.
const TOOL = {
  name: 'ideas',
  description: 'Give the areas and challenge ideas back to the person.',
  input_schema: {
    type: 'object',
    properties: {
      areas: {
        type: 'array',
        description: 'Up to 3 life areas, most prominent first. Empty if care is set.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'The area, 1 to 3 words, e.g. Fitness and health.' },
            noticed: { type: 'string', description: "One sentence to them about what came up, starting 'You mentioned'." },
            insight: { type: 'string', description: "One sentence on what they seem to want here, starting 'It sounds like you want to'." },
            challenges: {
              type: 'array',
              description: '2 or 3 challenges for the next 30 days.',
              items: { type: 'object', properties: { title: { type: 'string', description: 'A short name, under 7 words.' }, daily: { type: 'string', description: 'The small thing to do most days, under 10 words.' } }, required: ['title', 'daily'] },
            },
          },
          required: ['name', 'noticed', 'insight', 'challenges'],
        },
      },
      care: { type: 'string', description: 'Only if they may be at risk or in crisis: a short, kind message. Otherwise empty.' },
    },
    required: ['areas', 'care'],
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

  let body: { mode?: string; answers?: Record<string, string>; wins?: { name: string; outcome: string }[]; horizon?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const labels: Record<string, string> = {
    proud: `Looking back from ${body.horizon || 'three months'} from now, what would make you insanely proud`,
    years: 'Something wanted for years and never got round to',
    new: 'Something new to explore',
    admire: 'Someone admired, and what they would love to get better at',
    drain: 'Something they do that costs them more than it gives',
    lighter: `Looking back from ${body.horizon || 'three months'} from now, what they cut back on that made life feel lighter`,
    tried: 'What they have tried to cut back on before, and what got in the way',
  }
  const less = body.mode === 'less'
  const lines: string[] = []
  for (const [k, v] of Object.entries(body.answers || {})) {
    const t = String(v || '').trim().slice(0, 4000)
    if (t && labels[k]) lines.push(`${labels[k]}: ${t}`)
  }
  const out: Record<string, string> = { did: 'did it', partly: 'partly', not: "didn't stick" }
  const wins = (body.wins || []).slice(0, 10).map((w) => `${String(w.name).slice(0, 120)} (${out[w.outcome] || 'done before'})`)
  if (wins.length) lines.push(`Things taken on before: ${wins.join('; ')}`)
  if (!lines.length) return json({ error: 'empty' }, 400)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1400, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: 'ideas' }, messages: [{ role: 'user', content: (less ? 'They want to cut back on or stop something. For each challenge, "title" is the behaviour to cut back on, in plain words, such as "Scrolling in bed late at night". "daily" is the simple rule or swap for most days, such as "Phone charges outside the bedroom".\n\n' : '') + lines.join('\n') }] }),
  })
  if (!res.ok) { console.error('[showup-reflect] anthropic', res.status, (await res.text()).slice(0, 300)); return json({ error: 'ai_unavailable' }, 502) }
  const data = await res.json()
  const call = (data.content || []).find((c: { type?: string; name?: string }) => c.type === 'tool_use' && c.name === 'ideas')
  if (!call) { console.error('[showup-reflect] no tool result', data.stop_reason); return json({ error: 'ai_unavailable' }, 502) }
  const parsed = call.input || {}
  const clean = (s: unknown) => String(s || '').replace(/\s*[–—]\s*/g, ', ').replace(/!/g, '.').trim()
  type Ch = { title?: string; daily?: string }
  type Ar = { name?: string; noticed?: string; insight?: string; challenges?: Ch[] }
  const result = {
    areas: (parsed.areas || []).slice(0, 3).map((a: Ar) => ({
      name: clean(a.name), noticed: clean(a.noticed), insight: clean(a.insight),
      challenges: (a.challenges || []).slice(0, 3).map((c: Ch) => ({ title: clean(c.title), daily: clean(c.daily) })).filter((c: Ch) => c.title),
    })).filter((a: Ar) => a.name && a.challenges && a.challenges.length),
    care: clean(parsed.care),
  }

  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), showup_ai: { day: today, n: used + 1 } } })
  console.log(`[showup-reflect] ok user=${user.id.slice(0, 8)} used=${used + 1} in=${data.usage?.input_tokens} out=${data.usage?.output_tokens}`)
  return json({ ...result, left: DAILY_LIMIT - used - 1 })
})
