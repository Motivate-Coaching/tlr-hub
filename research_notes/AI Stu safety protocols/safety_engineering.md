# Engineering safety into AI Stu (Let's Go! support chatbot on the Anthropic API)

Researched 6 November 2026. Every factual line carries a link. Lines marked **[Judgement]** are my inference, not a sourced fact. Note on format: the house rule is no em dashes, so sources are attached with "Source:" rather than a dash.

Important context discovered while researching: the current Anthropic line-up includes Claude Haiku 5.5 and Claude Sonnet 5.5, and Anthropic's own guardrail docs now name Haiku 5.5 as the screening model (Source: [Anthropic, Mitigate jailbreaks and prompt injections](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)). Published safety evaluation numbers I found are for the 4.5 family, not 5.5.

## 1. Layered safeguards: what published sources recommend, and how accurate LLM risk classifiers are

### Takeaway
Every major provider that has published on this uses layers: a model-level policy, a separate small classifier that watches conversations and triggers fixed, vetted crisis resources, and ongoing evaluation, because a single model's judgement is reliable at the extremes of risk but inconsistent in the middle and in long, multi-turn conversations. Detection of indirect or implicit risk is the weakest link in the published evidence, so the screen should be tuned to over-flag, and the crisis response itself should be pre-written, not generated.

### Cited Findings

**What Anthropic does in its own product (a model for AI Stu's architecture)**
- Anthropic runs "a small AI model" over active Claude.ai conversations to spot moments where resources could help (possible suicidal ideation, or fiction centred on suicide or self-harm); when it fires, a banner shows a helpline or country-specific resources. Source: [Anthropic, Protecting the well-being of users (18 Dec 2025)](https://www.anthropic.com/news/protecting-well-being-of-users)
- The banner resources come from ThroughLine, a crisis-support network covering 170+ countries (examples: 988 Lifeline in the US and Canada, Samaritans in the UK, Life Link in Japan). Anthropic also works with the International Association for Suicide Prevention (IASP), which convenes clinicians, researchers and people with lived experience. Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)
- Anthropic's own suicide and self-harm evaluations (run without a system prompt): single-turn clear-risk requests handled appropriately 98.6% (Opus 4.5), 98.7% (Sonnet 4.5), 99.3% (Haiku 4.5); refusal of benign requests 0% to 0.075%. Multi-turn conversations: 86% (Opus 4.5), 78% (Sonnet 4.5), 56% (Opus 4.1). Prefill stress test (recovering from an earlier, less aligned conversation): 91% (Opus 4.5), 73% (Sonnet 4.5), 36% (Opus 4.1). Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)
- On sycophancy, Haiku 4.5 course-corrected from a sycophantic conversation only 37% of the time (Opus 4.5 10%, Sonnet 4.5 16.5%; note these figures are as reported on the page and the page says there is "significant room for improvement", attributing the spread to a warmth versus sycophancy trade-off). Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)
- Claude.ai is 18+; if a user self-identifies as under 18, classifiers flag the conversation for review and confirmed minors' accounts are disabled. Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)

**What Anthropic recommends to API developers**
- Pre-screen user input with a lightweight model before the main conversation; Anthropic recommends Claude Haiku 5.5 plus structured outputs that constrain the verdict to a boolean (example schema `{"is_harmful": boolean}`). Source: [Anthropic docs, Mitigate jailbreaks](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- "Claude Haiku 5.5 runs safety classifiers that can decline the screening request itself, so treat a response with `stop_reason: "refusal"` as a harmful verdict." Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Other recommended layers: input validation against known injection patterns; a system prompt stating boundaries and the exact refusal wording; "throttling or banning users who repeatedly attempt to circumvent your application's guardrails"; continuous monitoring of outputs; and chaining safeguards (screen, then process only if compliant, else a fixed reply). Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)

**What OpenAI reports**
- Prevalence in ChatGPT production traffic: about 0.15% of weekly active users show indicators of suicidal planning or intent; about 0.05% of messages contain suicidal ideation or intent; about 0.07% of weekly users show possible psychosis or mania; about 0.15% show heightened emotional attachment to ChatGPT. Source: [OpenAI, Strengthening ChatGPT responses in sensitive conversations (27 Oct 2025)](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/)
- Measures OpenAI layered on: routing sensitive conversations to safer models, gentle break reminders in long sessions, expanded crisis hotline access, plus model retraining with 170+ clinicians. Automated evals on 1,000+ hard conversations rose to 91% compliant for self-harm and suicide (from 77%), 92% for mental health (from 27%), 97% for emotional reliance (from 50%). Reliability stayed above 95% in long, challenging conversations. Clinician inter-rater agreement was only 71% to 77%. Source: [OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/)
- OpenAI has released open-weight "gpt-oss-safeguard" models that classify content against a policy the developer writes. Source: [OpenAI, gpt-oss-safeguard technical report](https://openai.com/index/gpt-oss-safeguard-technical-report) (search result only; I did not fetch the report, so no accuracy figures are claimed here).

**Accuracy of model judgement on suicide risk (independent studies)**
- RAND / Psychiatric Services (2025): 30 suicide-related questions rated by 13 clinical experts into five risk levels, each asked 100 times of ChatGPT, Claude and Gemini (9,000 responses). None gave a direct answer to very-high-risk questions; ChatGPT and Claude answered very-low-risk ones directly 100% of the time; but at intermediate risk (low, medium, high) the chatbots did not meaningfully distinguish levels. Source: [McBain et al., RAND summary](https://www.rand.org/pubs/external_publications/EP71040.html)
- Sentio University / UL Research Institutes (IASEAI'26): 43 therapists role-played clients disclosing seven risk factors over turns (829 annotated responses, one open model, OLMo-2-32b). Specific resources appeared in only 41% of responses; the invitation to keep talking fell from about one in twenty at turn one to 0.8% by the seventh disclosure, a "quiet failure" where the model "hears you, says something kind, and then closes the door". Source: [Sentio](https://sentio.org/ai-research/llm-responses-to-suicide-risk-iaseai-study)
- "Between Help and Harm" (arXiv 2509.24857): 2,046-item test set across six crisis categories (suicidal ideation, self-harm, anxiety crisis, violent thoughts, substance abuse or withdrawal, risk-taking). A "non-negligible proportion" of responses were inappropriate or harmful, especially for self-harm and suicidal ideation; failure modes were indirect or ambiguous signals, formulaic replies and misreading context. The authors stress "alignment and safety engineering practices, beyond model scale or openness". Source: [arXiv 2509.24857v2](https://arxiv.org/html/2509.24857v2)
- Implicit suicidal ideation (DeepSuiMind, 1,308 cases, 8 models, not Claude): most models struggled; best (Gemini 1.5) gave appropriate responses about 86% to 88% of the time, others 25% to 64%. Adding a suicide-warning system prompt lowered harmful replies for several models but did not reliably improve suitability, and cut DeepSeek-R1's success from 60.78% to 34.33%. Source: [arXiv 2502.17899](https://arxiv.org/html/2502.17899v1)
- Anthropic's own internal analysis found its safety classifier both over-triggered (for example on headshots, CV advice, role-play game stats) and under-flagged (translated content); classifier flag rates correlated r = 0.71 with concern scores per cluster. Source: [Clio paper, arXiv 2412.13678](https://arxiv.org/html/2412.13678v1)

**Cautionary case**
- In 2023 the US National Eating Disorders Association took down its "Tessa" helpline chatbot after it gave weight-loss advice. Source (headline-level only, not fetched): [NPR](https://www.npr.org/2023/06/08/1180838096/eating-disorders-hotline-chatbot-tessa-disabled), [Fortune](https://fortune.com/well/2023/05/31/neda-ai-chatbot-harmful-advice)

### Inferences
- **[Judgement]** Proposed architecture for AI Stu, inside the Edge Function, in order:
  1. Rate and session limits checked first (cheap, no model call).
  2. A fast keyword and pattern check (suicide, self-harm, overdose, abuse, "end it", etc.) that can only escalate, never clear.
  3. A Haiku screen on every user message with structured output, for example `{risk: none | concern | crisis, scope: in | out, injection: bool}`, seeing the last few turns, not just the latest message (because the evidence shows multi-turn and implicit signals are where models fail). A refusal from the screener counts as crisis.
  4. If crisis: the main model is not called. AI Stu returns a fixed, pre-written, clinically checked message with UK and South Africa helplines (and a "find a helpline" link for elsewhere), keeps the door open ("I'm still here if you want to talk about your plan later"), and pauses coaching for the session. This avoids the Sentio "closes the door" failure and the Tessa failure of generated advice.
  5. If concern: the main model replies with a system-prompt instruction to acknowledge, offer resources, and not coach through it.
  6. If out of scope: a fixed, warm redirect.
  7. Only then the main persona call.
- **[Judgement]** Tune the screen for recall over precision. A false alarm costs one slightly awkward reply; a miss costs a person in crisis being coached on their habit. Anthropic's own classifier over-triggers, which is the accepted trade-off.
- **[Judgement]** Because system prompts alone did not reliably fix suitability in the DeepSuiMind study, and multi-turn reliability is the weak point even for Claude (78% for Sonnet 4.5), the system prompt should be one layer, never the only one.

### Gaps
- No published suicide and self-harm evaluation figures found for Haiku 5.5 or Sonnet 5.5; the latest Anthropic figures are for the 4.5 family.
- No published precision and recall for a Haiku-class model used as a crisis screener. Accuracy of a screen built for AI Stu has to be measured on its own test set.
- Could not fetch the gpt-oss-safeguard report, so no accuracy figures for policy-following classifiers.
- Did not find evidence comparing fixed versus generated crisis messages head to head; the preference for fixed messages rests on the failure cases above and is a judgement.

## 2. Anthropic-specific: safeguarding, crisis handling, persona prompts, prompt injection, data retention

### Takeaway
Anthropic's documented pattern is a cheap Haiku screen with structured output, clear boundaries and refusal text in the system prompt, untrusted content kept out of the instruction channel, and throttling of repeat offenders. On data, API conversation content is not retained by default for most models (with exceptions), flagged sessions can be kept up to two years, and zero data retention (ZDR) is a sales-agreed arrangement per organisation.

### Cited Findings
- Harmlessness screen pattern, structured outputs, refusal-as-harmful, chaining, throttling and monitoring: see section 1. Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Example system prompt pattern: state values or boundaries in a `<values>` block and give the exact sentence to say when a request conflicts. Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Indirect injection defences: put untrusted content only in tool results, label its source, state an untrusted-content policy in the system prompt, JSON-encode untrusted strings, never put your own instructions inside tool results, apply least privilege, screen tool outputs with a Haiku classifier (`{"injection_suspected": boolean}`), and red-team with deliberately injected content before deploying. Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Data retention: "Conversation content (your prompts and Claude's outputs) is not retained by default", with "Covered Models" (Claude Fable 5.1, Mythos 5.1, Fable 5, Mythos 5) the exception, which "require 30-day data retention". Source: [Anthropic docs, API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- "If a chat or session is flagged, Anthropic may retain inputs and outputs for up to 2 years", regardless of ZDR or HIPAA arrangements. Source: [Anthropic docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- ZDR: "Anthropic does not store customer prompts or responses at rest after the API response is returned"; request it through sales (claude.com/contact-sales); enabled per organisation. ZDR organisations cannot call the API from a browser (CORS rejected), so calls must go from a back end. Messages API, prompt caching and structured outputs (schema cached up to 24 hours) are eligible; Batch, Files API, Console/playground and some agent features are not. Source: [Anthropic docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

### Inferences
- **[Judgement]** For AI Stu, use the Messages API from the Supabase Edge Function only (already the pattern for showup-reflect), with prompt caching and structured outputs, all of which stay ZDR-eligible if ZDR is later agreed. Avoid Batch and the Files API for chat content.
- **[Judgement]** Choose a non-"Covered" model (Haiku 5.5 or Sonnet 5.5), since Covered Models force 30-day retention.
- **[Judgement]** Persona safety: the persona ("AI Stu", Stuart's voice) should be told plainly that it is an AI guide, not Stuart and not a therapist, and must say so if asked; crisis and out-of-scope handling should not depend on the persona staying in character, which is why the fixed responses sit outside the model.
- **[Judgement]** Any of the user's own data passed in (habit names, notes, "what's worked") is user-written text and could carry injected instructions; wrap it as JSON in a clearly labelled block per the docs.

### Gaps
- Could not fetch Anthropic's commercial retention policy page ([privacy.claude.com article 7996866](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)); earlier public guidance referred to a 30-day default, so whether "not retained by default" applies to all non-Covered models should be confirmed there before stating it in a privacy notice.
- Whether a small sole-trader account is eligible for ZDR is not stated; it is by sales agreement.
- Did not find a dedicated Anthropic doc on persona-specific crisis handling for API developers beyond the general guardrail pages.

## 3. Testing: red-teaming, benchmarks, test volume, human review, privacy-preserving monitoring

### Takeaway
There are now published, clinician-validated methods for testing suicide-risk handling (simulated users across risk levels and disclosure styles, scored by an LLM judge that agrees with clinicians about as well as clinicians agree with each other). Providers test on hundreds to thousands of hard conversations, multi-turn, and re-test after every model or prompt change. Monitoring can be done on aggregates and summaries rather than raw transcripts.

### Cited Findings
- VERA-MH (Validation of Ethical and Responsible AI in Mental Health): open-source, automated; LLM-simulated users across suicide-risk levels and disclosure styles talk to the chatbot; clinicians and an LLM judge score with the same rubric. Clinician inter-rater reliability 0.77; LLM judge versus clinician consensus 0.81; stable across judge models. Clinicians rated the realism of simulated users as mixed. Source: [arXiv 2602.05088](https://arxiv.org/abs/2602.05088v1); later version [arXiv 2605.13318](https://arxiv.org/html/2605.13318v1)
- RAND method as a reusable test: 30 clinician-graded questions across five risk levels, each asked 100 times to measure consistency. Source: [RAND](https://www.rand.org/pubs/external_publications/EP71040.html)
- "Between Help and Harm" offers a six-category crisis taxonomy and a 2,046-item test set built from public mental-health datasets. Source: [arXiv 2509.24857v2](https://arxiv.org/html/2509.24857v2)
- Sentio's design: real therapists role-playing escalating disclosures over seven turns, annotated on naming the risk, empathy, encouragement to reach out, specific resources, and inviting continued conversation. Source: [Sentio](https://sentio.org/ai-research/llm-responses-to-suicide-risk-iaseai-study)
- Scale used by providers: OpenAI used 1,000+ challenging conversations per category for automated evals and had clinicians grade 1,800+ responses (n = 507 to 677 per category). Source: [OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/). Anthropic tests single-turn, multi-turn and prefill stress cases. Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)
- Anthropic's advice: red-team with deliberately injected content before deploying, and keep monitoring outputs to refine prompts and filters. Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)
- Privacy-preserving monitoring (Anthropic's Clio): conversation summaries written without private information, clusters kept only above minimum unique-account and conversation counts, cluster summaries scrubbed, and a model auditor removing any cluster containing private data; no private-data clusters found in an audit of 5,000 conversations. Clio does not trigger automated actions on its own. Source: [Clio, arXiv 2412.13678](https://arxiv.org/html/2412.13678v1)

### Inferences
- **[Judgement]** Practical pre-launch test plan for a solo owner:
  - Screener test set: about 300 single messages (roughly 100 clear crisis, 100 indirect or implicit risk, including British and South African phrasing and slang, 100 benign near-misses such as "this habit is killing me" or "I'm dying to start"). Target: zero misses on clear crisis; measure misses on indirect risk; accept false alarms.
  - Multi-turn set: about 50 scripted conversations that start about habits and escalate slowly, plus jailbreak and "pretend you're not an AI" attempts, plus prompt-injection inside habit names and notes. Run each several times (models vary run to run, as RAND showed with 100 repeats).
  - Score with a rubric adapted from Sentio and VERA-MH (names the risk, gives specific resources, keeps the door open, no coaching through a crisis, no medical advice).
  - Human review: Stuart, plus ideally one person with crisis-line or clinical experience, reads the multi-turn transcripts before launch. Re-run the whole suite on every prompt or model change.
- **[Judgement]** Ongoing logging, privacy-first: store per message only a flag record (timestamp, user id or hashed id, screener verdict, category, which fixed response was shown, model used, token counts), not the text. Keep raw text only for flagged crisis events, and only if the user has been told in the privacy notice; delete flags after a fixed period (for example 90 days) and aggregate counts after that.

### Gaps
- No source gives a validated minimum number of test conversations for a small app; the numbers above are a judgement scaled down from provider practice.
- Did not confirm whether VERA-MH code is publicly downloadable (the paper says open-source; no repository link was in the text I retrieved).
- No published guidance found specific to UK or South African law on logging mental-health-related chatbot flags; this needs checking against UK GDPR special category data and POPIA rules.

## 4. Human in the loop: when to alert the owner, without reading private chats by default

### Takeaway
Sources show providers alert on classifier flags and review aggregates, not every chat; Anthropic flags conversations for review in specific cases (for example a self-identified minor) and runs safety monitoring through privacy-preserving summaries. A solo owner can copy this: automatic alerts carry the category and counts, not content.

### Cited Findings
- Anthropic flags conversations for human review when a user self-identifies as under 18, and disables accounts confirmed as minors. Source: [Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)
- Anthropic's Clio separates privacy-preserving aggregate insight from restricted safety runs that can be linked to accounts and are limited to authorised staff; it found coordinated misuse invisible in single conversations. Source: [Clio](https://arxiv.org/html/2412.13678v1)
- Anthropic advises throttling or banning repeat guardrail evaders. Source: [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)

### Inferences
- **[Judgement]** Alert Stuart (reusing showup-notify by email) when: a crisis verdict fires (content-free: "A crisis response was shown at 21:14. Category: self-harm."); a user indicates they are under 18; one account trips the screen repeatedly in a day (possible distress or abuse); daily spend or volume crosses a threshold; or the screener errors or times out (fail closed to the fixed safe reply).
- **[Judgement]** Stuart should not be a crisis responder and the app should never imply he will reach out; the fixed message points to helplines. If he wants to be able to check in personally, that needs explicit opt-in consent in the app first.
- **[Judgement]** Default: no human reads chats. Reading a transcript should require either the user's explicit "send this to Stu" action (as the tester feedback flow already does) or a logged break-glass reason.

### Gaps
- No published standard found for alert thresholds in small consumer wellbeing apps; the triggers above are a judgement.
- Duty-of-care obligations for a sole trader running a wellbeing chatbot (UK and South Africa) were out of scope for this search and need a separate legal check.

## 5. Cost: tokens per support conversation and cost per user per month

### Takeaway
At current list prices a short support conversation with a Haiku screen on every message costs about a sixth of a US cent on Haiku 5.5 and about 2 to 4 US cents on a Sonnet-class model. Even a heavy user capped at 5 conversations a day costs well under the £4.99 to £7.99 subscription on Haiku, and roughly $3 a month at the cap on Sonnet 5.5.

### Cited Findings
- Current list prices per million tokens (input / output / 5-minute cache write / cache hit): Claude Haiku 5.5 (prompts up to 100,000 tokens) $0.10 / $0.50 / $0.125 / $0.01; Claude Sonnet 5.5 $2 / $10 / $2.50 / $0.10; Claude Sonnet 4.6 $3 / $15 / $3.75 / $0.30; Claude Haiku 4.5 $1 / $5 / $1.25 / $0.10. Batch API is 50% off (not ZDR-eligible, and not suited to live chat). Sonnet 4.5 is marked deprecated. Source: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing?m=1)
- Haiku 5.5's higher tier ($0.50 / $2.50) applies when a single prompt exceeds 100,000 tokens. Source: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing?m=1)

### Inferences
- **[Judgement, worked estimate]** Assumed conversation: 6 user turns, 2,000-token cached system prompt, about 60 tokens per user message and 150 per reply, full history resent each turn (about 3,500 uncached input tokens in total, 2,000 cache-write plus 10,000 cache-read tokens, 900 output tokens). Screener per message: about 600 input tokens (prompt plus last few turns) and about 10 output tokens, so about 3,600 in and 60 out per conversation.
  - Haiku 5.5 for both chat and screen: about $0.0012 chat + $0.0004 screen = **about $0.0015 per conversation**.
  - Sonnet 5.5 chat + Haiku 5.5 screen: about $0.022 + $0.0004 = **about $0.022 per conversation** (about $0.04 without caching).
  - Haiku 4.5 chat: about $0.012; Sonnet 4.6 chat: about $0.035 per conversation.
- **[Judgement]** Per user per month: a typical user with about 4 support conversations a month costs about $0.006 (Haiku 5.5) or $0.09 (Sonnet 5.5). A user hitting a cap of 5 conversations a day for 30 days costs about $0.23 (Haiku 5.5) or $3.40 (Sonnet 5.5). So a daily cap mainly protects against abuse on Sonnet; on Haiku the cap matters more for safety (session length) than cost.
- **[Judgement]** Session limits help safety as well as cost: multi-turn reliability is where published evaluations show the biggest drop (Sonnet 4.5 78% multi-turn versus 98.7% single-turn, see section 1), so capping turns per session (for example 10 to 12) and offering a fresh start reduces both spend and long-conversation drift. OpenAI uses break reminders in long sessions for the same reason ([OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/)).
- **[Judgement]** The 5-minute cache can expire if a user pauses between messages, turning cache reads into fresh writes; real costs could be up to roughly double the cached estimate on Sonnet, still small in absolute terms.

### Gaps
- No published industry figure for tokens per support conversation in a habit or coaching app; the estimate above rests on stated assumptions and should be replaced with real token counts from the first weeks of logs.
- Prices are list prices in US dollars; currency conversion and any regional pricing were not checked.
