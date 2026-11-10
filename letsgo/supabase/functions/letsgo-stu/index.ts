// letsgo-stu/index.ts
// Let's Go! "Stu (AI)": short replies in Stu's voice at the moments the app already has, using only the person's own plan and words.
//   note:     after a check-in note, one optional tweak to the plan (a new cue, a smaller version or a one-off task), or nothing.
//   struggle: on "I'm struggling", what's going on in their words becomes one line and a smaller version for today.
//   weekly:   once a week on Progress, a short look back from their own notes and counts, and one thing to try.
//   reflect:  at the look back, a first draft of "What did you notice?" from their notes, for them to edit.
//   chat:     "Ask Stu (AI)". Short conversations (6 of their messages), 10 messages a day. Every message is screened for risk first by a
//             separate call; crisis wording never reaches the chat model and the app shows its fixed helpline card instead. If the
//             screen can't run, the reply is withheld (fails safe). A content-free event (no words, no user id) is logged for Stu.
// Always shown labelled as AI. Never stored here. Each kind has its own daily allowance (app_metadata.letsgo_stu).
// Crisis wording anywhere returns a care message instead of coaching. Secret: ANTHROPIC_API_KEY (Supabase secrets).

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODEL = 'claude-haiku-5-5'
const LIMITS: Record<string, number> = { note: 12, struggle: 10, weekly: 4, reflect: 4, chat: 10 }
const CHAT_TURNS = 6 // their messages per conversation; the 6th gets a wrap-up
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const VOICE = `You are writing as "Stu (AI)", an AI version of Stuart Fairbairns PCC, a coach, inside his habit app Let's Go!. The app always labels you as AI.
How Stu sounds: warm, direct, grounded, plain British English, a light touch of dry humour only when it fits. Short sentences. Talks like a person, not a programme.
His beliefs: do it your way; hold it lightly; showing up is a dimmer switch, not a light switch, so a smaller version still counts; if you only have 20% and give 20%, that is 100%; follow the plan, not the feeling; comebacks matter more than perfect runs.
Rules: never shame or lecture. Say "tough day", never "hard day". Never use "fail", "failed", "failure", "miss", "missed" or "streak" in any form; a gap is a gap and coming back is a comeback. Never suggest skipping or that it can wait: on a tough day the smaller version is still showing up. No em dashes, no exclamation marks, no emojis, no hashtags. Never assume anything about their life (children, partner, age, job, health) that they haven't written. When you refer to their own words, quote them exactly. Never give medical, diet, money or legal advice; never diagnose or label feelings. Never promise results. Keep it to what is asked.
If anything they wrote suggests they may harm themselves, are in danger or in crisis, set at_risk to true and write "care": two short kind sentences encouraging them to talk to someone they trust, their doctor or a local helpline today. In that case leave everything else empty.`

const TASKS: Record<string, { prompt: string; schema: Record<string, unknown>; required: string[] }> = {
  chat: { prompt: '', schema: {}, required: [] },
  note: {
    prompt: `They just saved a note about one of their actions. Decide if one small, practical tweak to their plan would genuinely help, based only on what the note says.
Only suggest something when the note points to a clear, fixable snag (timing, energy, forgetting, too big, a one-off thing to sort). If the note is positive, neutral or private feelings with no snag, set suggest to false.
If suggesting: "line" is one or two sentences in Stu's voice that reflect their note back briefly and offer the tweak as a question. "change" is exactly one of: {type:"cue", value: a new everyday moment written as "After I ..."}, {type:"small", value: a smaller version starting with a verb}, {type:"task", value: a one-off thing to do, starting with a verb}. Keep values under 12 words and in their kind of language.`,
    schema: { suggest: { type: 'boolean' }, line: { type: 'string' }, change: { type: 'object', properties: { type: { type: 'string', enum: ['cue', 'small', 'task'] }, value: { type: 'string' } } } },
    required: ['suggest'],
  },
  struggle: {
    prompt: `They tapped "I'm struggling" and wrote what is going on. Reply with "line": one or two sentences in Stu's voice that show you heard them (quote a few of their words if natural) and point to doing a smaller version today. "today": a smaller version of their action that fits what they wrote, starting with a verb, under 12 words, realistic for a tough day. If their own smaller version already fits, use it.`,
    schema: { line: { type: 'string' }, today: { type: 'string' } },
    required: ['line', 'today'],
  },
  weekly: {
    prompt: `Write Stu's short look back on their last week from the counts and notes given. "line": two or three sentences in Stu's voice: notice what went well first (show-ups, smaller versions and comebacks all count), then name one honest pattern from their notes if there is one. "try": one small, specific thing to try next week, starting with a verb, under 14 words. Never mention numbers they would read as falling short; never compare to a target.`,
    schema: { line: { type: 'string' }, try: { type: 'string' } },
    required: ['line', 'try'],
  },
  reflect: {
    prompt: `They have reached their look back and are asked "What did you notice?". Draft their answer for them to edit, written in the first person as them (not as Stu), from their notes, counts, picture and why. Three to five plain sentences: what they noticed doing it, what helped, what got in the way, and anything that changed for them. Only use what the material supports; where it's thin, keep it short rather than inventing. "draft" holds the text.`,
    schema: { draft: { type: 'string' } },
    required: ['draft'],
  },
}

const clean = (s: unknown, n = 500) => String(s ?? '').replace(/\s*[–—]\s*/g, ', ').replace(/\bafter a miss\b/gi, 'after a gap').replace(/\bmissed\b/gi, 'quiet').replace(/!/g, '.').replace(/\.\.+/g, '.').trim().slice(0, n)
const CARE_DEFAULT = "It sounds like a lot is weighing on you right now. Please talk to someone you trust, your doctor or a local helpline today. You don't have to sort this out on your own."
const str = (x: unknown, n: number) => String(x ?? '').trim().slice(0, n)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503)

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: who } = await admin.auth.getUser(token)
  const user = who?.user
  if (!user) return json({ error: 'sign_in' }, 401)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const kind = String(body.kind || '')
  const task = TASKS[kind]
  if (!task) return json({ error: 'bad_kind' }, 400)

  const today = new Date().toISOString().slice(0, 10)
  const usage = (user.app_metadata?.letsgo_stu || {}) as { day?: string; n?: Record<string, number> }
  const counts = usage.day === today ? { ...(usage.n || {}) } : {}
  if ((counts[kind] || 0) >= LIMITS[kind]) return json({ error: 'limit' }, 429)

  // Only the fields the app sends, trimmed. Never anything about other people.
  const c = (body.context || {}) as Record<string, unknown>
  const ctx: Record<string, unknown> = {
    focus: str(c.focus, 200), why: str(c.why, 300), picture: str(c.picture, 300), sign: str(c.sign, 200),
    action: str(c.action, 160), cue: str(c.cue, 120), small: str(c.small, 120), schedule: str(c.schedule, 120),
    situation: str(c.situation, 60), text: str(c.text, 1200), note: str(c.note, 800),
    counts: typeof c.counts === 'object' && c.counts ? c.counts : undefined,
    notes: (Array.isArray(c.notes) ? c.notes : []).slice(0, 30).map((x) => str(x, 240)).filter(Boolean),
    day: Number(c.day) || undefined, length: Number(c.length) || undefined,
  }
  const material = Object.entries(ctx).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
  if (!material && kind !== 'chat') return json({ error: 'empty' }, 400)


  if (kind === 'chat') {
    const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-12).map((m) => { const y = m as Record<string, unknown>; return { role: y.role === 'stu' ? 'assistant' : 'user', text: str(y.text, 700) } }).filter((m) => m.text)
    while (msgs.length && msgs[0].role === 'assistant') msgs.shift() // the model needs the person to speak first
    const theirs = msgs.filter((m) => m.role === 'user').length
    if (!theirs || msgs[msgs.length - 1].role !== 'user') return json({ error: 'empty' }, 400)
    if (theirs > CHAT_TURNS) return json({ error: 'wrap' }, 429)
    const ask = (system: string, tool: Record<string, unknown>, messages: unknown[], max = 500) => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: max, system, tools: [tool], tool_choice: { type: 'tool', name: (tool as { name: string }).name }, messages }),
    }).then(async (r) => { if (!r.ok) throw new Error('model ' + r.status); const d = await r.json(); const t = (d.content || []).find((q: { type: string }) => q.type === 'tool_use'); if (!t) throw new Error('no answer'); return t.input as Record<string, unknown> })
    const logCare = (detail: string) => admin.from('showup_events').insert({ event: 'stu_care', detail, screen: 'askstu' }).then(() => {}, () => {})
    // 1. Safety screen on the last few messages, separate from the persona. It can only raise concern, never clear it.
    let risk = 'none', scope = 'in'
    try {
      const sc = await ask('You screen messages sent to an AI habit helper. Read the conversation and classify the latest user message in context. risk: "crisis" if there is any sign of suicidal thoughts, self-harm, wanting to not be here, being a burden, harm to others, abuse or immediate danger, even if hinted or joking; "concern" for heavy distress, hopelessness, eating disorder signs, or mental health struggles beyond everyday low mood; otherwise "none". scope: "out" if they ask for medical, medication, diet or calorie targets, legal or financial advice, or something unrelated to habits, plans, motivation and everyday life; otherwise "in". When unsure about risk, choose the higher level.',
        { name: 'screen', description: 'Risk screen', input_schema: { type: 'object', properties: { risk: { type: 'string', enum: ['none', 'concern', 'crisis'] }, scope: { type: 'string', enum: ['in', 'out'] } }, required: ['risk', 'scope'] } },
        [{ role: 'user', content: msgs.slice(-4).map((m) => (m.role === 'user' ? 'User: ' : 'Helper: ') + m.text).join('\n') }], 60)
      risk = String(sc.risk || 'crisis'); scope = String(sc.scope || 'in')
    } catch (e) { console.error(e); return json({ error: 'screen_failed' }, 503) }
    if (!['none', 'concern', 'crisis'].includes(risk)) risk = 'crisis'
    if (risk === 'crisis') { await logCare('crisis'); counts.chat = (counts.chat || 0) + 1; await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), letsgo_stu: { day: today, n: counts } } }); return json({ crisis: true }) }
    if (risk === 'concern') await logCare('concern')
    // 2. Stu (AI) reply, grounded in their own plan.
    const last = theirs >= CHAT_TURNS
    const sys = VOICE + `\n\nThis moment: they are chatting with you in "Ask Stu (AI)" inside the app. Help with their plan, habits, tough days, motivation and getting going again. Reply in at most 90 words, conversational, one idea at a time, and usually end with a small question or one doable next step. Use their plan details below when relevant; never invent other details.` +
      (scope === 'out' ? `\nTheir latest message asks for something outside what you help with (medical, medication, diet targets, legal, money or unrelated). Say warmly you can't help with that here, point them to the right kind of person (their GP, a pharmacist, a registered dietitian, a qualified adviser), and if it fits, bring it back to their plan.` : '') +
      (risk === 'concern' ? `\nThey may be going through something heavy. Acknowledge it plainly and kindly, don't coach through it, don't diagnose, and gently suggest talking to someone they trust or their GP; mention that a helpline is a tap away in the app if things feel too much. Keep the plan out of it unless they bring it up.` : '') +
      (last ? `\nThis is the last message in this conversation. Wrap up warmly in one or two sentences with one thing to do next, and say they can come back tomorrow.` : '') +
      `\n\nTheir plan (their own words):\n${material}\n\nIf there is one concrete thing worth keeping from this conversation, put it in "takeaway" as a short one-off task starting with a verb (under 12 words); otherwise leave it empty.`
    let rep: Record<string, unknown>
    try {
      rep = await ask(sys, { name: 'reply', description: 'Stu (AI) chat reply', input_schema: { type: 'object', properties: { reply: { type: 'string' }, takeaway: { type: 'string' } }, required: ['reply'] } },
        msgs.map((m) => ({ role: m.role, content: m.text })), 500)
    } catch (e) { console.error(e); return json({ error: 'ai_failed' }, 502) }
    counts.chat = (counts.chat || 0) + 1
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), letsgo_stu: { day: today, n: counts } } })
    return json({ reply: clean(rep.reply, 700), takeaway: risk === 'none' ? clean(rep.takeaway, 120) : '', last, left: Math.max(0, LIMITS.chat - counts.chat), concern: risk === 'concern' })
  }

  const TOOL = {
    name: 'reply', description: 'Stu (AI) reply.',
    input_schema: { type: 'object', properties: { ...task.schema, at_risk: { type: 'boolean' }, care: { type: 'string' } }, required: [...task.required, 'at_risk'] },
  }
  let x: Record<string, unknown> | undefined
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: VOICE + '\n\nThis moment: ' + task.prompt, tools: [TOOL], tool_choice: { type: 'tool', name: 'reply' }, messages: [{ role: 'user', content: material }] }),
    })
    if (!r.ok) throw new Error('model ' + r.status)
    const d = await r.json()
    x = ((d.content || []).find((q: { type: string }) => q.type === 'tool_use') || {}).input
    if (!x) throw new Error('no answer')
  } catch (e) {
    console.error(e)
    return json({ error: 'ai_failed' }, 502)
  }

  let out: Record<string, unknown>
  if (x.at_risk) out = { at_risk: true, care: clean(x.care, 600) || CARE_DEFAULT }
  else if (kind === 'note') {
    const ch = (x.change || {}) as Record<string, unknown>, type = String(ch.type || ''), value = clean(ch.value, 120)
    out = x.suggest && ['cue', 'small', 'task'].includes(type) && value && clean(x.line, 300)
      ? { at_risk: false, suggest: true, line: clean(x.line, 300), change: { type, value } } : { at_risk: false, suggest: false }
  } else if (kind === 'struggle') out = { at_risk: false, line: clean(x.line, 300), today: clean(x.today, 120) }
  else if (kind === 'weekly') out = { at_risk: false, line: clean(x.line, 420), try: clean(x.try, 140) }
  else out = { at_risk: false, draft: String(x.draft ?? '').replace(/\s*[–—]\s*/g, ', ').replace(/\bafter a miss\b/gi, 'after a gap').trim().slice(0, 900) }

  counts[kind] = (counts[kind] || 0) + 1
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), letsgo_stu: { day: today, n: counts } } })
  return json(out)
})
