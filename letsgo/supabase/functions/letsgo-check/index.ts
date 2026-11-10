// letsgo-check/index.ts
// Let's Go! answer check. When someone taps Next on a written answer, this reads the question and their answer and says:
//   fits:      does it actually answer the question? Generous: short answers are fine. Only clear non-answers are flagged
//              (a random word, a test, keyboard mash, something unrelated), never their choices or ambitions.
//   corrected: their exact words with only spelling slips and typos fixed (British English), or '' when nothing needs fixing.
//   note:      if it doesn't fit, one or two kind sentences in Stu's voice asking for another go.
//   sharpen:   for an action that fits but is too vague or too big for an ordinary day, a question and 2 to 3 doable first steps to tap.
// The app never changes their words without a tap ("Use this" / "Keep mine") and never blocks them ("Keep it").
// Signed-in or guest users only, its own daily allowance (separate from the setup coach). Nothing they write is stored here.
// Secret: ANTHROPIC_API_KEY lives in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODEL = 'claude-haiku-5-5'
const DAILY_LIMIT = 150
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SYSTEM = `You check one answer someone typed while setting up a habit plan in Let's Go!, an app by coach Stuart Fairbairns.
You get one or more answers, each with the question they were asked and what the answer is for. For each answer, decide these things and return them under its id.

1. fits: does the answer genuinely respond to the question?
- Be generous. Short, plain, casual or unusual answers are fine if they answer it ("Run", "Read more", "be less grumpy", "after the school run").
- Their choices, goals and ambitions are theirs. Never judge whether something is a good idea, too big or too small.
- Only set fits to false when it clearly does not answer: a single unrelated word or object ("cheese" to "what would make you proud"), a test or placeholder ("test", "asdf", "xxx", "idk"), keyboard mash, or something plainly about a different question.
- If fits is false, write "note": one or two short, warm sentences in Stu's voice. Quote what they wrote, say kindly it doesn't seem to answer this one, and invite another go, maybe with a tiny prompt to help. No telling off, no exclamation marks, no em dashes, British English. Example: "Just checking: “cheese” doesn't quite answer this one, unless there's a story there. What would make you proud a year from now?"

2. corrected: their answer with only spelling mistakes and obvious typos fixed, in British English.
- Keep their exact words, order, tone and meaning. Do not rephrase, add or remove words, change their grammar style, or add punctuation they didn't use, except fixing a clear typo.
- Leave names, slang and deliberate informal spelling alone ("gonna", "wanna").
- If nothing needs fixing, return an empty string.

3. sharpen: only for answers whose purpose is an action they will do (the action, a first step, a challenge, what instead). If it fits but is too vague or too big to do on an ordinary day ("get fit", "sort my life out", "be healthier", "write a book"), add "sharpen" with "question": one short line in the voice of Stu, a warm direct coach (no exclamation marks, no em dashes, British English), quoting their words and asking what a first doable step would be; and "options": two or three concrete first steps in their kind of language, each starting with a verb, under 10 words, realistic for a tough day too. Never invent details about their life. Otherwise leave sharpen out.

Also: if any answer suggests they may be at risk of harming themselves or are in crisis, set at_risk to true and write a short kind "care" message encouraging them to talk to someone they trust, their doctor or a local helpline.`

const TOOL = {
  name: 'check', description: 'For each answer: whether it fits its question, and any spelling fixes.',
  input_schema: {
    type: 'object',
    properties: {
      results: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, fits: { type: 'boolean' }, note: { type: 'string' }, corrected: { type: 'string' }, sharpen: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } } } }, required: ['id', 'fits', 'corrected'] } },
      at_risk: { type: 'boolean' }, care: { type: 'string' },
    },
    required: ['results', 'at_risk'],
  },
}

const clean = (s: unknown, n = 400) => String(s ?? '').replace(/\s*[–—]\s*/g, ', ').replace(/!/g, '.').trim().slice(0, n)
const CARE_DEFAULT = "It sounds like a lot is weighing on you right now. Please talk to someone you trust, your doctor or a local helpline today. You don't have to sort this out on your own."
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return json({ error: 'sign_in' }, 401)

  const today = new Date().toISOString().slice(0, 10)
  const usage = (user.app_metadata?.letsgo_check || {}) as { day?: string; n?: number }
  const used = usage.day === today ? usage.n || 0 : 0
  if (used >= DAILY_LIMIT) return json({ error: 'limit' }, 429)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 6).map((i) => { const x = i as Record<string, unknown>; return { id: String(x.id ?? '').slice(0, 40), question: String(x.question ?? '').trim().slice(0, 400), purpose: String(x.purpose ?? '').trim().slice(0, 200), answer: String(x.answer ?? '').trim().slice(0, 1500) } }).filter((i) => i.id && i.question && i.answer)
  const context = String(body.context ?? '').trim().slice(0, 300)
  if (!items.length) return json({ error: 'empty' }, 400)

  let out: Record<string, unknown>
  try {
    const prompt = (context ? `Their focus so far: ${context}\n\n` : '') + items.map((i) => `id: ${i.id}\nQuestion: ${i.question}\n` + (i.purpose ? `What it's for: ${i.purpose}\n` : '') + `Their answer:\n${i.answer}`).join('\n\n---\n\n')
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'tool', name: 'check' }, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!r.ok) throw new Error('model ' + r.status)
    const d = await r.json()
    const x = ((d.content || []).find((c: { type: string }) => c.type === 'tool_use') || {}).input as Record<string, unknown> | undefined
    if (!x) throw new Error('no answer')
    if (x.at_risk) out = { at_risk: true, care: clean(x.care, 600) || CARE_DEFAULT, results: [] }
    else {
      let list: unknown = x.results; if (typeof list === 'string') { try { list = JSON.parse(list) } catch { list = [] } }
      const results = (Array.isArray(list) ? list : []).map((y) => {
        const z = y as Record<string, unknown>, item = items.find((i) => i.id === String(z.id)); if (!item) return null
        let corrected = String(z.corrected ?? '').trim().slice(0, 1500)
        // Only ever a spelling fix: ignore anything that adds or drops words, or changes nothing.
        if (!corrected || norm(corrected).toLowerCase() === norm(item.answer).toLowerCase()) corrected = ''
        else { const a = norm(item.answer).split(' ').length, c = norm(corrected).split(' ').length; if (Math.abs(a - c) > Math.max(1, Math.round(a * 0.15))) corrected = '' }
        const sh = (z.sharpen || null) as Record<string, unknown> | null
        const opts = sh && Array.isArray(sh.options) ? sh.options.map((o) => clean(o, 80)).filter(Boolean).slice(0, 3) : []
        const sharpen = z.fits !== false && sh && clean(sh.question, 240) && opts.length >= 2 ? { question: clean(sh.question, 240), options: opts } : undefined
        return { id: item.id, fits: z.fits !== false, note: z.fits === false ? clean(z.note, 300) : '', corrected, ...(sharpen ? { sharpen } : {}) }
      }).filter(Boolean)
      out = { at_risk: false, results }
    }
  } catch (e) {
    console.error(e)
    return json({ error: 'ai_failed' }, 502)
  }

  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), letsgo_check: { day: today, n: used + 1 } } })
  return json(out)
})
