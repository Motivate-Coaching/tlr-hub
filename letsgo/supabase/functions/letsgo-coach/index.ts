// letsgo-coach/index.ts
// Let's Go! V2 setup coach. Two jobs:
//   kind 'understand': reads what someone wrote or said, notices if there is more than one focus in it,
//                      reframes each as what they are moving towards, and offers outcome examples.
//   kind 'actions':    for the one focus they chose, with the outcome and why they gave, drafts a few
//                      actions with schedules, smaller and turn-it-up versions, asks at most two questions
//                      it genuinely needs, and suggests up to two one-off helpers (things to search for).
// Signed-in or guest users only, a limited number of times a day each. Nothing they write is stored here.
// Secret: ANTHROPIC_API_KEY lives in Supabase secrets, never in this file.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MODEL = 'claude-haiku-5-5'
const DAILY_LIMIT = 25
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const VOICE = `You are the setup coach inside Let's Go!, an app made by Stuart Fairbairns, an ICF PCC coach.
Voice: warm, direct, grounded, like a good coach. British English. Short sentences. Speak to them as "you".
Never generic self-help, never gushing, no clichés. Never use em dashes or en dashes. Never use exclamation marks.
Use their own words where you can. Never invent facts about them. Never diagnose, judge or shame.
If anything suggests they may be at risk of harming themselves, are in crisis, or shows signs of disordered eating, set at_risk to true, write a short kind "care" message encouraging them to talk to someone they trust, their doctor or a local helpline, and give nothing else.`

const UNDERSTAND = `${VOICE}

They have just written or spoken what they want to work on. It may be messy, negative ("I feel fat", "I'm broke") or contain several different things.
Your job:
1. Write "reply": one or two sentences that show you heard them, using their words. Thank them briefly. No advice yet.
2. Find each separate focus in what they wrote. A focus is a distinct outcome area (for example losing weight and growing a business are two focuses; stretching, weights and padel for fitness are one focus with several actions). Give at most 3, most important to them first. Never split one focus into several.
3. For each focus give:
   - "title": a short name, 2 to 6 words, framed as moving towards something good (for example "Feel lighter and healthier", "A steady, growing business"). No full stop.
   - "heard": what they said about it, in their words, one short line.
   - "towards": what life looks like when it's sorted, in the first person, one sentence (for example "I feel comfortable in my body and have energy all day"). If they already said what they are moving towards, use their words.
   - "outcome_examples": 3 short, concrete, first-person things that could be true in 30 days that would show it is working (for example "My jeans fit comfortably again", "I've done 12 sessions this month"). Realistic for 30 days. No medical targets, no calorie numbers, no promises of a specific weight.
   - "actions_mentioned": true if they already named specific things they will do for this focus.`

const ACTIONS = `${VOICE}

They have chosen one focus, and told you the outcome they want and why it matters. Draft their plan of actions.
Rules:
- First include every specific action they already mentioned for this focus, in their words, with the schedule they gave ("every other day", "once a week"). Mark these from_user true.
- Then, only if needed to reach the outcome, suggest well-established ways people make progress on this kind of goal, so the total is 2 to 3 actions. Prefer the levers that make the biggest real difference. For weight loss, that means eating habits as well as movement (for example "Have a protein-rich breakfast", "Swap evening snacks for fruit"), never only stretching. For business consistency, that means protected time and regular outreach (for example "Block 60 minutes for income-generating work", "Send 3 follow-up messages"). Never prescribe diets, calorie numbers, medication or medical advice.
- Each action: "text" starts with a verb and finishes the sentence "I'm going to..."; specific and small enough to do on an ordinary day.
- "why": one short line on why it helps, in plain words. Do not cite studies or claim guarantees.
- "schedule": how often. type "days" with weekday numbers (0 Sunday to 6 Saturday), or type "every" with n (2 means every other day), or type "weekly" with times (1 to 5). Respect anything they said. Default to a realistic frequency, not every day for everything.
- "small": a smaller version for a tough day, starting with a verb. "up": a turned-up version for a good day, starting with a verb.
- "questions": at most 2, and only if the answer would genuinely change the plan (for example "Do you have access to a gym?" with options "Yes", "At home only", "Not yet"). Never ask what they already told you. If the answers are given, don't ask again.
- "helpers": at most 2 optional one-off things to sort out that would make starting easier, phrased as searches they can tap, starting with a verb (for example "Find a gym near me", "Find beginner baking classes near me", "Find a 10 minute stretch routine"). Only if genuinely useful. Use "near me" only for places.
- "note": optional, one honest sentence if needed (for example "If you have a health condition, check with your doctor before changing how you eat or train."). Leave it out otherwise.`

const SCHEDULE = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['days', 'every', 'weekly'] },
    days: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } },
    n: { type: 'integer', minimum: 2, maximum: 7 },
    times: { type: 'integer', minimum: 1, maximum: 5 },
  },
  required: ['type'],
}
const T_UNDERSTAND = {
  name: 'understand', description: 'What you heard, and the focuses in it.',
  input_schema: {
    type: 'object',
    properties: {
      at_risk: { type: 'boolean' }, care: { type: 'string' }, reply: { type: 'string' },
      focuses: { type: 'array', maxItems: 3, items: { type: 'object', properties: {
        title: { type: 'string' }, heard: { type: 'string' }, towards: { type: 'string' },
        outcome_examples: { type: 'array', items: { type: 'string' }, maxItems: 3 }, actions_mentioned: { type: 'boolean' },
      }, required: ['title', 'heard', 'towards', 'outcome_examples'] } },
    },
    required: ['at_risk', 'focuses'],
  },
}
const T_ACTIONS = {
  name: 'plan', description: 'The draft plan for this focus.',
  input_schema: {
    type: 'object',
    properties: {
      at_risk: { type: 'boolean' }, care: { type: 'string' }, intro: { type: 'string' },
      actions: { type: 'array', maxItems: 4, items: { type: 'object', properties: {
        text: { type: 'string' }, why: { type: 'string' }, schedule: SCHEDULE, small: { type: 'string' }, up: { type: 'string' }, from_user: { type: 'boolean' },
      }, required: ['text', 'schedule', 'small'] } },
      questions: { type: 'array', maxItems: 2, items: { type: 'object', properties: { q: { type: 'string' }, options: { type: 'array', items: { type: 'string' }, maxItems: 4 } }, required: ['q', 'options'] } },
      helpers: { type: 'array', maxItems: 2, items: { type: 'string' } },
      note: { type: 'string' },
    },
    required: ['at_risk', 'actions'],
  },
}

// Small models sometimes send lists back as JSON text. Read those as lists too.
function asList(v: unknown): unknown[] { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } } return []; }
const clean = (s: unknown, n = 300) => String(s ?? '').replace(/[–—]/g, ',').replace(/!/g, '.').trim().slice(0, n)
const realCare = (c: unknown) => { const t = clean(c, 600); return /[a-z]{3}/i.test(t) ? t : '' }
const CARE_DEFAULT = "It sounds like a lot is weighing on you right now. Please talk to someone you trust, your doctor or a local helpline today. You don't have to sort this out on your own."

async function ask(system: string, tool: Record<string, unknown>, prompt: string, maxTokens: number) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!r.ok) throw new Error('model ' + r.status)
  const d = await r.json()
  const use = (d.content || []).find((c: { type: string }) => c.type === 'tool_use')
  if (!use) throw new Error('no answer')
  return use.input as Record<string, unknown>
}

function schedule(s: Record<string, unknown> | undefined) {
  const t = s?.type
  if (t === 'every') return { type: 'every', n: Math.min(7, Math.max(2, Number(s?.n) || 2)) }
  if (t === 'weekly') return { type: 'weekly', times: Math.min(5, Math.max(1, Number(s?.times) || 1)) }
  const days = asList(s?.days).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6)
  return { type: 'days', days: days.length ? [...new Set(days)] : [0, 1, 2, 3, 4, 5, 6] }
}

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
  const usage = (user.app_metadata?.letsgo_coach || {}) as { day?: string; n?: number }
  const used = usage.day === today ? usage.n || 0 : 0
  if (used >= DAILY_LIMIT) return json({ error: 'limit' }, 429)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const t = (k: string, n = 3000) => String(body[k] ?? '').trim().slice(0, n)

  let out: Record<string, unknown>
  try {
    if (body.kind === 'understand') {
      const said = t('said', 4000), towards = t('towards', 1500)
      if (!said && !towards) return json({ error: 'empty' }, 400)
      const r = await ask(UNDERSTAND, T_UNDERSTAND, `What they want to work on:\n${said || '(nothing)'}\n\nWhat they said they are moving towards:\n${towards || '(not answered yet)'}`, 1200)
      if (r.at_risk) out = { at_risk: true, care: realCare(r.care) || CARE_DEFAULT, focuses: [] }
      else {
        const focuses = asList(r.focuses).slice(0, 3).map((f) => { const x = f as Record<string, unknown>; return {
          title: clean(x.title, 60).replace(/\.$/, ''), heard: clean(x.heard, 200), towards: clean(x.towards, 240),
          outcome_examples: asList(x.outcome_examples).map((o) => clean(o, 120)).filter(Boolean).slice(0, 3), actions_mentioned: !!x.actions_mentioned,
        } }).filter((f) => f.title)
        if (!focuses.length) return json({ error: 'empty_result' }, 502)
        out = { at_risk: false, reply: clean(r.reply, 400), focuses }
      }
    } else if (body.kind === 'actions') {
      const answers = asList(body.answers).slice(0, 4).map((a) => { const x = a as Record<string, unknown>; return `${clean(x.q, 160)} ${clean(x.a, 160)}` }).join('\n')
      const prompt = `Everything they first wrote:\n${t('said', 4000)}\n\nThe focus they chose: ${t('title', 120)}\nWhat they are moving towards: ${t('towards', 300)}\nWhat would be true in 30 days: ${t('outcome', 300)}\nWhy it matters to them: ${t('why', 500)}\n` + (answers ? `\nTheir answers to your questions:\n${answers}\nDo not ask questions again.` : '') + (body.more ? '\nThey asked for more ideas. Suggest different actions from these: ' + t('have', 600) : '')
      const r = await ask(ACTIONS, T_ACTIONS, prompt, 1400)
      if (r.at_risk) out = { at_risk: true, care: realCare(r.care) || CARE_DEFAULT, actions: [] }
      else {
        const actions = asList(r.actions).slice(0, 4).map((a) => { const x = a as Record<string, unknown>; return {
          text: clean(x.text, 120).replace(/\.$/, ''), why: clean(x.why, 160), schedule: schedule(x.schedule as Record<string, unknown>),
          small: clean(x.small, 120).replace(/\.$/, ''), up: clean(x.up, 120).replace(/\.$/, ''), from_user: !!x.from_user,
        } }).filter((a) => a.text)
        if (!actions.length) return json({ error: 'empty_result' }, 502)
        const questions = answers ? [] : asList(r.questions).slice(0, 2).map((q) => { const x = q as Record<string, unknown>; return { q: clean(x.q, 160), options: asList(x.options).map((o) => clean(o, 40)).filter(Boolean).slice(0, 4) } }).filter((q) => q.q && q.options.length)
        out = { at_risk: false, intro: clean(r.intro, 300), actions, questions, helpers: asList(r.helpers).map((h) => clean(h, 80).replace(/\.$/, '')).filter(Boolean).slice(0, 2), note: clean(r.note, 240) }
      }
    } else return json({ error: 'bad_request' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: 'ai_failed' }, 502)
  }

  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata || {}), letsgo_coach: { day: today, n: used + 1 } } })
  return json({ ...out, left: DAILY_LIMIT - used - 1 })
})
