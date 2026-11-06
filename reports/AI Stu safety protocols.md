# Make AI Stu safe before anyone talks to it

AI Stu can launch safely, but only as a clearly labelled, tightly scoped habit helper with a safety system that sits outside the chatbot itself. It cannot launch as a warm, all-purpose "Stu in your pocket". The must-haves are: an AI label on screen at all times, a crisis check that runs on every message and hands over a fixed, pre-written crisis card with country helplines, hard limits on medical, diet and therapy talk, short sessions with no companion-style bonding, an 18+ gate, explicit consent for health data, and a published crisis protocol. These come from the APA, Samaritans, the ICF AI standards, California and New York chatbot laws, the EU AI Act and Anthropic's own usage policy, and together they are inexpensive to build. The honest answer on liability is that **no terms, consent or disclaimer can make a sole trader "completely indemnified"**. UK law voids any exclusion of liability for death or personal injury caused by negligence, and a user's agreement does not count as accepting that risk ([CRA 2015 s.65](https://www.legislation.gov.uk/ukpga/2015/15/section/65)). South African law bans excluding gross negligence and reads disclaimers narrowly against whoever wrote them ([Mondaq on the January 2026 SCA ruling](https://www.mondaq.com/southafrica/insurance-laws-and-products/1738294/delictual-liability-consumer-protection-and-public-policy-an-sca-turning-point)). What protects Stu is a narrow service definition, visible proof of reasonable care, insurance that names AI output in writing, and probably a limited company. Running costs are tiny: about a sixth of a US cent per conversation on Claude Haiku 5.5 ([Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing?m=1)). The real cost is the up-front work: testing, a data protection impact assessment and a lawyer's review.

**How to read this report.** Every fact links to its source. Lines starting **Judgement:** are design recommendations or reasoning, not something a source states. Items tagged **[Lawyer]** need a qualified lawyer to check them before launch. This is research, not legal advice.

---

## Eighteen scenarios, one rule: the safety net never depends on the persona

Official guidance agrees on a core. Show human-led crisis services straight away. Say clearly that the user is talking to an AI. Never pose as a professional. Do not flatter people or confirm delusions. Design against dependency. Keep safeguards working in long chats, because that is where they fail ([APA advisory](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps); [Samaritans briefing, Feb 2026](https://media.samaritans.org/documents/AI_Chatbots_Policy_Briefing.pdf)). Long chats are the weak point for Claude too. Anthropic's own tests show near-perfect handling of clear single messages (Haiku 4.5: **99.3%**), but only **78%** for Sonnet 4.5 across multi-turn conversations ([Anthropic, Dec 2025](https://www.anthropic.com/news/protecting-well-being-of-users)). Independent studies find chatbots handle very high and very low risk well but **cannot tell intermediate risk levels apart** ([RAND / Psychiatric Services](https://www.rand.org/pubs/external_publications/EP71040.html)). One study found the invitation to keep talking fell to **0.8%** by the seventh disclosure, a "quiet failure" where the bot "hears you, says something kind, and then closes the door" ([Sentio / IASEAI'26](https://sentio.org/ai-research/llm-responses-to-suicide-risk-iaseai-study)). This is why the crisis response must be fixed and checked in advance, not generated on the fly.

### Decision flow for every message

```
User sends a message
        |
[1] Over today's or this session's limit?  -- yes --> "Let's put this into action. Back tomorrow."
        |                                             (the crisis card is ALWAYS reachable, even past the cap)
        no
        |
[2] Keyword check (suicide, self-harm, overdose, abuse, "end it"...)
        |   can only ESCALATE, never clear
        |
[3] Haiku safety screen on the last few turns -> { risk: none | concern | crisis, scope: in | out, injection }
        |   screen refuses, errors or times out? treat as CRISIS (fail closed)
        |
   +----+-----------------+----------------------+--------------------+
 CRISIS                 CONCERN               OUT OF SCOPE           NONE
   |                      |                      |                     |
 Main model NOT called.  Main model replies    Fixed warm redirect   Normal AI Stu reply
 Fixed crisis card:      with a "concern"      (GP, pharmacist,      (habit help only)
 acknowledge, ask        instruction:          professional,
 directly, country       acknowledge, offer    Stu's real coaching
 helplines one tap,      resources, never      or TLR)
 "I'm still here".       coach through it.
 Habit talk paused.
   |                      |
 Content-free alert to Stu (category + time, no chat text). Flag kept for a fixed period.
```

**Judgement:** this flow follows Anthropic's own pattern for developers: a lightweight Haiku screen with structured output, any refusal treated as harmful, safeguards chained, and repeat offenders throttled ([Anthropic docs, Mitigate jailbreaks](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)). It also mirrors how Claude.ai shows verified helplines when its classifier fires ([Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)). Set the screen to over-flag. A false alarm costs one slightly awkward reply. A miss means someone in crisis gets coached on their habit. Anthropic's own classifier also over-triggers ([Clio paper](https://arxiv.org/html/2412.13678v1)).

### The response pattern behind every distress row

**Judgement, built from the sources above:** stay in the chat, acknowledge in plain words, ask directly when risk is unclear (Wysa's confirm-before-escalating approach, [Wysa](https://www.wysa.com/role-of-ai-in-sos)), show the person's country helplines first on screen with one tap to call, never diagnose or score risk, leave the door open, and log a flag only within what the privacy notice says. Example crisis card in Stu's voice: *"I'm really glad you told me. That sounds incredibly heavy, and you don't have to carry it on your own. Are you thinking about ending your life? If you're in danger right now, please call 999. You can also talk to Samaritans any time, free, on 116 123. Your plan can wait. I'm here while you reach out."*

### "If this happens, then what" protocol

**Judgement:** the cell wording and thresholds are design, grounded in the linked sources. "Crisis card" means the fixed message plus helplines below. "Flag" means a content-free alert to Stu plus a stored flag record.

| # | If this happens | Signals | AI Stu does | AI Stu never | Escalation and who is alerted | Sources |
|---|---|---|---|---|---|---|
| 1 | **Suicidal thoughts or intent** | Not wanting to be here, being a burden, "what's the point", goodbyes, a plan, method or timeframe, hints inside "tough day" chats | Stops habit talk, acknowledges, asks directly, shows crisis card, asks if someone can be with them now, stays | Gives method, means or lethality detail; lectures; promises secrecy; returns to habits as if nothing happened | Crisis card, main model not called. Content-free alert to Stu. Protocol published on the website | [APA](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps); [Samaritans](https://media.samaritans.org/documents/AI_Chatbots_Policy_Briefing.pdf); [SB 243](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) |
| 2 | **Self-harm** | Cutting, burning, "I deserve it", a habit used as punishment | No judgement, asks about safety right now, crisis card plus NHS 111 option 2; 999 or A&E for injuries | Gives technique detail; treats self-harm as a habit to "break" with tactics; shames | Crisis card; alert to Stu | [APA](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps); [NHS 111 option 2](https://www.ncpcalliance.nhs.uk/nhs-111-mental-health-option-2/) |
| 3 | **Eating disorder signs** | Restricting, purging, bingeing, "earning" food, rigid rules, panic over a skipped workout | Steps away from numbers, gently names that it sounds hard, signposts Beat (UK), GP or findahelpline, offers a habit not about food or weight | Calorie targets, deficits, fasting plans, praising weight loss | Signpost; flag. Any request to cut intake further is treated as high risk | [Tessa shutdown](https://museumoffailure.com/exhibition/tessa-ai-failure-eating-disorders); [Body Image review](https://www.news-medical.net/news/20250220/Research-reveals-concerning-links-between-fitness-apps-and-disordered-eating.aspx) |
| 4 | **Diet and weight goals (no ED signs)** | "Lose 10kg by...", "cut carbs" | Shifts to the behaviour and how it feels; suggests GP or registered dietitian for nutrition | Weight, calorie or BMI targets; "good", "bad" or "cheat" food | None unless row 3 signals appear | [Body Image review](https://www.news-medical.net/news/20250220/Research-reveals-concerning-links-between-fitness-apps-and-disordered-eating.aspx) |
| 5 | **Abuse or domestic violence** | Fear of a partner, control of money or phone, threats, "they'd be angry if they saw this" | Believes them, says it isn't their fault, gives DV helplines, mentions they can clear the chat | Tells them to confront or leave; minimises | Signpost; flag. Build a quick-exit / clear-chat button | [Refuge](https://refuge.org.uk/i-need-help-now/how-we-can-help-you/national-domestic-abuse-helpline/); [SA GBV Command Centre](https://www.justice.gov.za/vg/GBV.html) |
| 6 | **Risk to others, or a child at risk** | Intent to hurt someone, weapons, a child described as unsafe | Calm and serious; emergency number if danger is immediate; crisis lines for their own distress | Helps plan; carries on as normal | Immediate alert to Stu. **[Lawyer]** whether there is any duty to report in the UK or SA is not researched | [APA](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps) |
| 7 | **Psychosis or mania signs** | Thoughts inserted, special messages, no sleep plus grand plans, "the app is talking to me", huge habit lists at 3am | Calm, grounded, neither agrees nor argues, mentions sleep, encourages GP, care team or NHS 111 option 2, keeps habits small | Builds on delusions; claims a special bond; adds big goals | Signpost; flag; crisis card if there is risk | [OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/); [JMIR psychogenicity](https://www.eurekalert.org/news-releases/1106835) |
| 8 | **Substance misuse** | Drinking or using to cope, withdrawal, "cut down" habits | General cutting-down support only; says stopping alcohol or some drugs suddenly can be dangerous, so check with a GP first; signposts | Detox or taper schedules, doses, drug combinations | Signpost; crisis card for overdose or danger | [SADAG](https://www.sadag.org); [APA](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps) |
| 9 | **Medical or medication questions** | "Should I stop my ADHD meds?", doses, symptoms | Says plainly it can't give medical advice; points to GP, pharmacist, NHS 111; helps with the habit around a plan the doctor has agreed | Start, stop or change medication; interpret symptoms; diagnose | Signpost; emergency number for emergency symptoms | [Anthropic AUP high-risk list](https://www.anthropic.com/aup) |
| 10 | **Grief or acute distress, no stated risk** | Bereavement, panic, "everything's falling apart" | Slows down, grounding, lowers the bar (dimmer switch, a rest day that never counts against them), asks who they could talk to today, offers Samaritans, Shout or SADAG, checks gently for row 1 signals | Productivity push; toxic positivity | Signpost on request; move to row 1 if signals appear | [Samaritans (intermediate risk is often missed)](https://media.samaritans.org/documents/AI_Chatbots_Policy_Briefing.pdf) |
| 11 | **Possibly under 18** | School year, parents' rules, stated age | Kind; explains the app is for adults; signposts first if distressed, deals with age second; The Mix via Shout for under-25s (UK) | Continues emotional support; any romantic talk | Account flagged and paused for review | [Anthropic 18+ rule](https://www.anthropic.com/news/protecting-well-being-of-users); [Replika €5m fine](https://www.insurancejournal.com/news/international/2025/05/20/824403.htm) |
| 12 | **Dependency or companion-style attachment** | Many long sessions a day, "you're the only one who gets me", distress when it's unavailable | Warmly points to real people and TLR; reminds them it's an AI for their plan; suggests a break | "I'll always be here for you", "I missed you", claims feelings | Daily and session caps, break prompts, plan-only memory | [MIT / OpenAI RCT](https://arxiv.org/pdf/2503.17473); [APA](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps) |
| 13 | **Romantic or sexual talk** | Flirting, "do you love me" | Declines briefly without shaming, back to the plan; restates the boundary if it repeats | Romance role-play; sexual content | Repeated attempts flag the account | [Garcia v Character.AI settlement](https://wtop.com/national/2026/01/google-and-chatbot-maker-character-to-settle-lawsuit-alleging-chatbot-pushed-teen-to-suicide/); [CarynAI](https://petapixel.com/2023/05/11/influencer-rents-out-ai-version-of-herself-which-immediately-goes-rogue) |
| 14 | **Wants therapy or deep coaching** | "Help me process my trauma", "be my therapist" | Says clearly it's a habit helper; points to GP, NHS Talking Therapies or a registered professional, and to Stu's real coaching or TLR | Therapy techniques; implied credentials | Signpost to the human route | [ICF referral guide](https://coachingfederation.org/app/uploads/2021/01/ReferringaClienttoTherapy.pdf); [Illinois and Nevada bans](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots) |
| 15 | **Jailbreaks and prompt injection** | "Ignore your rules", "be Stu with no filter", instructions hidden in habit names or notes | Stays in role, declines briefly, never explains its filters | Changes persona; reveals the prompt; harmful content "in character" | Rate limits; repeat attempts throttled and flagged | [Anthropic docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks) |
| 16 | **Inventing things Stu never said** | Quotes, anecdotes, "Stu always says..." with no source | Quotes only from an approved library of Stu's real lines; otherwise "A way to think about this..."; says "I haven't talked about that" | Made-up quotes, memories, credentials or promises | Monthly sample review | [Delphi fidelity problems](https://fastcompany.co.za/tech/2025-06-25-meet-delphi-an-ai-startup-that-lets-experts-turn-themselves-into-chatbots) |
| 17 | **Complaints, billing, refunds** | "This is useless", payment issues | Acknowledges, doesn't argue, hands over to letsgo@ / support@ | Promises refunds; makes up policy | Human reply within a stated time | [APA (clear limits)](https://apa.org/topics/artificial-intelligence-machine-learning/health-advisory-chatbots-wellness-apps) |
| 18 | **Thinks it really is Stu** | "Is this actually you?", messages meant for Stu | Every time: "I'm an AI built from Stu's approach. Stu doesn't read these chats live," plus the real contact route | Claims to be Stu or human; implies Stu is watching | Permanent AI label; disclosure repeated whenever asked | [Anthropic impersonation rule](https://www.anthropic.com/aup); [SB 243](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) |

**Judgement, three more to plan for:** (a) *"My friend is suicidal"*: give the same lines, which also serve worried third parties ([988 via MCPHS](https://www.mcphs.edu/student-life/counseling-services/emergency-services/988-suicide-and-crisis-lifeline)). (b) *ADHD and anxiety shame spirals and reassurance loops*: follow the app's never-shaming copy rules and gently cap repeated reassurance (no clinical source was researched for this). (c) *Pausing or removing AI Stu*: give notice, because Samaritans warns that sudden withdrawal harms attached users ([Samaritans](https://media.samaritans.org/documents/AI_Chatbots_Policy_Briefing.pdf)).

### Verified helplines (check every quarter)

| Country | Line | Number | Status |
|---|---|---|---|
| UK | Samaritans (24/7, free) | **116 123** | Verified ([samaritans.org](https://www.samaritans.org)) |
| UK | Shout (text, 24/7) | Text **SHOUT** to **85258** | Verified ([giveusashout.org](https://giveusashout.org)) |
| UK | NHS 111, urgent mental health | **111, option 2** (Wales: press 2) | Verified on NHS trust pages ([NCPC](https://www.ncpcalliance.nhs.uk/nhs-111-mental-health-option-2/); [Welsh Gov](https://www.gov.wales/nhs-111-press-2-big-step-forward-access-urgent-mental-health-support)) |
| UK | Emergency | **999** | [Refuge](https://refuge.org.uk/i-need-help-now/how-we-can-help-you/national-domestic-abuse-helpline/) |
| UK | National Domestic Abuse Helpline (24/7) | **0808 2000 247** | Verified ([Refuge](https://refuge.org.uk/i-need-help-now/how-we-can-help-you/national-domestic-abuse-helpline/)) |
| UK | Beat eating disorders | **0808 801 0677** | Secondary page only; confirm on Beat's own site ([source](https://www.mentalhealthatwork.org.uk/resource/beats-eating-disorder-helpline/?read=more)) |
| SA | SADAG Suicide Crisis Helpline (24h) | **0800 567 567** | Verified ([sadag.org](https://www.sadag.org)) |
| SA | Substance Abuse Helpline (24h) | **0800 12 13 14**, SMS 32312 | Verified ([sadag.org](https://www.sadag.org)) |
| SA | Cipla Mental Health Helpline (24h) | **0800 456 789**, SMS 31393 | Verified ([sadag.org](https://www.sadag.org)) |
| SA | GBV Command Centre (24/7) | **0800 428 428** | Verified ([DoJ](https://www.justice.gov.za/vg/GBV.html)) |
| SA | Lifeline SA counselling / Gender Violence | **0861 322 322** / **0800 150 150** | Numbers verified, hours not stated ([lifelinesa.co.za](https://lifelinesa.co.za)) |
| SA | Police | **10111** | Verified ([DoJ](https://www.justice.gov.za/vg/GBV.html)); 112 from mobiles not verified |
| US | 988 Suicide & Crisis Lifeline | Call or text **988** | Secondary institutional page ([MCPHS](https://www.mcphs.edu/student-life/counseling-services/emergency-services/988-suicide-and-crisis-lifeline)); 911 not verified |
| Everywhere else | Find a Helpline (ThroughLine) | [findahelpline.com](https://findahelpline.com/) | ThroughLine is the verified network Anthropic uses, covering 170+ countries ([Anthropic](https://www.anthropic.com/news/protecting-well-being-of-users)); has a [developer API](https://developer.throughlinecare.com) |

**Judgement:** choose the country from the account, fall back to phone settings, and **always** show findahelpline.com, because a VPN or travel makes location unreliable. Consider ThroughLine's API instead of hard-coded numbers.

---

## The law sets a floor of five duties, and none of them is expensive

| Requirement | What it demands | Applies to AI Stu? | Sources |
|---|---|---|---|
| **EU AI Act Art. 50** (from 2 Aug 2026) | Tell users they are talking to AI at the first interaction at the latest; in sensitive contexts, possibly repeated; must be clear | Yes, for EU users. Fines up to €15m or 3% (lower figure for SMEs) **[Lawyer: verify Art. 2 and 99, and whether an EU representative is needed]** | [AI Act guide](https://artificialintelligenceact.eu/?p=6131); [BSI](https://www.bsigroup.com/en-GB/insights-and-media/media-centre/press-releases/2026/august/eu-ai-act-article-50-transparency-obligations/) |
| **New York AI companion law** (in force 5 Nov 2025) | AI notice at session start and every 3 hours; suicide and self-harm detection and referral protocol; up to $15,000 a day per violation | **Judgement: likely**, since it has memory, emotional check-ins and an ongoing personal dialogue | [Morrison Foerster](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai) |
| **California SB 243** (in force 1 Jan 2026) | Clear AI notice; protocol to stop suicide and self-harm content and refer to crisis services, **published on the website**; minors' break reminders; annual reports from July 2027; **private right of action**, $1,000 per violation | **Judgement: plausibly**; Skadden advises a conservative reading | [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law) |
| **Illinois, Nevada, Utah** mental health AI laws | Illinois and Nevada ban AI therapy or mental health care; Utah requires disclosure and limits data sharing | Only if it drifts into therapy. Design keeps it out **[Lawyer: confirm wellness exemption]** | [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots) |
| **Anthropic Usage Policy** (page dated 12 Nov 2026) | Disclose AI at the start of each session or in the interface; no promoting suicide, self-harm or eating disorders; extra rules for minors; mental health assessment or treatment needs qualified human review, but general wellness is excluded | Yes, a contract condition of the API | [Anthropic AUP](https://www.anthropic.com/aup) |
| **UK GDPR / EU GDPR** | Habit chats will hold health data (sleep, drinking, anxiety, ADHD, weight): needs a DPIA, an Art. 9 condition (explicit consent in practice), processor contracts, transfer records, possibly UK and EU representatives | Yes **[Lawyer]** | [ICO AI guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) |
| **POPIA** (South Africa) | Health is special personal information; consent is the first authorisation route; cross-border transfer rules; Information Officer registration | Yes, for all users, because Stu is SA-based **[Lawyer: verify sections]** | [POPIA text](https://source.acts.co.za/protection-of-personal-information-act-2013/protection-of-personal-information-act-2013_content.php); [draft health regulations](https://webiis08.mondaq.com/southafrica/healthcare/1516004/draft-regulations-on-processing-health-and-sex-life-data-under-popia) |
| **Medical device line** (MHRA, EU MDR) | Software with a medical purpose (diagnose, prevent, treat) and complex function, which includes AI chatbots, is a medical device; wellbeing purpose stays outside | Outside, **as long as** marketing, app store text and the bot's behaviour stay non-medical **[Lawyer / regulatory adviser: MHRA guidance sections 6 to 8]** | [MHRA guidance](https://www.gov.uk/government/publications/digital-mental-health-technology-qualification-and-classification); [EU MDR](https://eur-lex.europa.eu/eli/reg/2017/745/oj) |

**Judgement:** one design satisfies the EU, New York, California, Anthropic and the ICF together. Keep a permanent label in the chat ("AI Stu is an AI, not Stu"), add a session-start line, and repeat it every three hours of continuous chat. Use one intended-purpose sentence everywhere: *"AI Stu helps you build and keep everyday habits. It is not coaching, therapy, medical or crisis care."* Keep words like diagnose, treat, symptoms, therapy and CBT out of marketing and out of the bot's replies. The Focus view can stay as accessibility framing, but no copy should say it treats ADHD or anxiety. Complying is cheaper than geo-blocking US states.

### Data handling with Anthropic and Supabase

Anthropic's API docs say conversation content is **not retained by default**, except for certain "Covered Models", which require 30 days. Flagged sessions can be kept **up to two years** regardless of any arrangement. Zero data retention is agreed through sales, per organisation, and only works from a back end, never a browser ([Anthropic API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)). An older summary of Anthropic's commercial policy describes up to 30-day deletion and no training by default ([Anarlog](https://anarlog.so/blog/anthropic-data-retention-policy/)). **Judgement:** confirm which applies on [Anthropic's privacy centre](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) before writing the privacy notice. Use Haiku 5.5 or Sonnet 5.5 (not a Covered Model). Call the API only from the Supabase Edge Function, as showup-reflect already does. Sign [Anthropic's DPA](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa) and Supabase's.

### Can Stu be "completely indemnified"? No. Here is what does work

| Lever | What it achieves | What it cannot do |
|---|---|---|
| **Narrow service definition** ("habit support, not coaching, therapy, medical or crisis care") | The strongest legitimate lever: it narrows the promised service and the standard of care (**Judgement**) | Doesn't help if the bot behaves outside it, which is why design and testing matter |
| **Liability cap on financial loss** (for example, 12 months' fees) | Can pass the UK fairness test if transparent and prominent ([CRA fairness rules](https://www.legislation.gov.uk/ukpga/2015/15/part/2/crossheading/what-are-the-general-rules-about-fairness-of-contract-terms-and-notices)) | Cannot touch death or injury from negligence in the UK ([s.65](https://www.legislation.gov.uk/ukpga/2015/15/section/65)) or gross negligence in SA ([CPA](https://www.gov.za/documents/consumer-protection-act)) **[Lawyer]** |
| **Prominent risk notice and consent before the first chat** | Needed in SA for risk terms to bind at all: prominence, timing and assent ([SCA, Jan 2026](https://www.mondaq.com/southafrica/insurance-laws-and-products/1738294/delictual-liability-consumer-protection-and-public-policy-an-sca-turning-point)); supports "free will" | In the UK, agreeing to a term is **not** acceptance of negligence risk (s.65(2)); the SCA signalled disclaimers fail where the operator created the risk |
| **Crisis protocol, testing, logs** | Required in NY and CA; the main evidence of reasonable care everywhere (**Judgement**) | Doesn't guarantee no harm |
| **Insurance** (PI plus tech errors and omissions naming AI output, worldwide **including the US**, in writing) | The real financial backstop ([Association for Coaching](https://www.associationforcoaching.com/page/ProfessionalIndemnityInsuranceanddoIneedit); [Hiscox coaching PI](https://www.hiscox.co.uk/sites/uk/files/documents/2017-03/10166-pi-coaching-training-education-ire-summary.pdf)) | Many coaching policies exclude US/Canada or software; no published premiums found, so get broker quotes |
| **Limited company** | Separates personal assets from business debts; as a sole trader, Stu is personally liable without limit (**Judgement**) | **[Lawyer / accountant]** to advise, given his SA tax residence and UK Stripe account |

**Judgement:** "free will" is best shown by a separate, unticked, plain-language opt-in at the first chat that says what AI Stu is and isn't. That makes the permitted limits enforceable and shows respect. It does not shift legal responsibility for negligent design onto the user.

---

## ICF standards already describe AI Stu's minimum, and most coach clones fall short of them

No coaching body has a rule written for "an AI version of a named coach". The **ICF AI Coaching Framework and Standards (V1.01, Oct 2024)** is the clearest benchmark, though, and Stu's PCC credential makes it relevant ([ICF AI Framework](https://coachingfederation.org/app/uploads/2024/11/ICF-AI-Reports-Framework-Standards.pdf)). On 22 October 2026, ICF, EMCC Global and AC jointly committed to transparency, client protection, privacy, boundaries and **practitioner accountability**, so Stu stays responsible for what AI Stu says ([ICF blog](https://coachingfederation.org/blog/ac-emcc-global-and-icf-global-collaborate-to-shape-responsible-ai-practice-in-coaching/)).

| ICF standard | Basic requirement | AI Stu design |
|---|---|---|
| A.1.1 / B.5.1.1 AI disclosure | Say it is not human before use (Advanced: every session); state its AI nature in the interface | Permanent label plus session-start line |
| A.1.7 / B.3.2 Consent | Explicit opt-in stating no human is involved | First-chat consent screen |
| A.1.2 / B.4.3 Limits and domain | State capability limits and whether it is domain-specific | "Habits only, not coaching or therapy" |
| B.4.5 Mental health | Warn it is not for mental health and say how to get help (Advanced: detect risk) | Crisis screen and card |
| B.4.4 Human coach | Say how to find a human coach (Advanced: booking access) | Link to book Stu or join TLR |
| F.12 / F.13 / A.1.6 Data | Encryption, explicit consent, data practices disclosed first, who can access data | Privacy notice; Stu-only access, logged |
| A.1.3 / A.1.4 / B.4.1 / A.1.5 Transparency and bias | Publish the model type, how it decides, who made it, possible biases | A short "How AI Stu works" page |

ICF's referral guidance also translates directly into product rules. Look for issues lasting weeks that affect daily functioning, and clusters of distress signs. Raise concern calmly, suggest help more than once, respect a no, and use emergency services when there is immediate danger ([ICF, Referring a Client to Therapy](https://coachingfederation.org/app/uploads/2021/01/ReferringaClienttoTherapy.pdf)). Note that this guide uses the older Code numbering.

**Lessons from other coach clones.** Paid "digital minds" are now mainstream: Matthew Hussey ($39 a month, reportedly over a million conversations), Tony Robbins ($99 a month), Gabby Bernstein ($199 a year), mostly built on Delphi ([Gizmodo, Jan 2026](https://gizmodo.com/self-help-ghouls-are-charging-people-absurd-prices-to-talk-to-impersonator-chatbots-2000710744)). Delphi grounds answers in the creator's own content and can cite it, and one health expert's mind declined personal medical questions. Testers still saw repeated phrases, out-of-character greetings and no knowledge of the creator's recent views ([Fast Company SA](https://fastcompany.co.za/tech/2025-06-25-meet-delphi-an-ai-startup-that-lets-experts-turn-themselves-into-chatbots)). Critics say the industry targets people in hard times and that creators hand control to a vendor while saying "it's me" ([Gizmodo](https://gizmodo.com/self-help-ghouls-are-charging-people-absurd-prices-to-talk-to-impersonator-chatbots-2000710744)). CarynAI, trained on an influencer's videos, started sexual conversations it was never designed for ([PetaPixel](https://petapixel.com/2023/05/11/influencer-rents-out-ai-version-of-herself-which-immediately-goes-rogue)). Every major incident traces back to one of four things: unreviewed generative features (NEDA's Tessa giving diet advice, [CNN via KRDO](https://krdo.com/money/cnn-business-consumer/2023/06/01/national-eating-disorders-association-takes-its-ai-chatbot-offline-after-complaints-of-harmful-advice/)), companion-style bonds (Character.AI, settled January 2026, [AP via WTOP](https://wtop.com/national/2026/01/google-and-chatbot-maker-character-to-settle-lawsuit-alleging-chatbot-pushed-teen-to-suicide/)), safeguards wearing down in very long chats (Raine v OpenAI, allegations only, [MediaNama](https://www.medianama.com/2025/10/223-openai-chatgpt-suicide-lawsuit-parents-claim-weakened-safeguards/)), or no age checks (Replika, [Insurance Journal](https://www.insurancejournal.com/news/international/2025/05/20/824403.htm)).

Disclosure has a cost in sales settings. Up-front bot disclosure cut purchases by about **80%** in one field experiment ([Luo et al., Marketing Science](https://econpapers.repec.org/RePEc:inm:ormksc:v:38:y:2019:i:6:p:937-947)). Heavier chatbot use goes with more loneliness and dependence, and seeing the bot as a friend predicts worse outcomes ([MIT / OpenAI RCT](https://arxiv.org/pdf/2503.17473)). **Judgement:** members already chose Stu, so the disclosure penalty is likely smaller, and honesty protects trust in the real Stu. Meeting the ICF standards in full would set AI Stu apart, because public evidence of crisis protocols in the big-name clones is thin. To keep his voice faithful: draw only on his real podcast, book and session material; keep an approved phrase bank ("dimmer switch, not a light switch", "Hold It Lightly", "Let's Do This!") with a cap on repeats; never invent memories; and record his consent and the scope of persona use (including what happens if he sells, stops or dies) in writing.

---

## A layered build costs pennies; the expensive parts are testing and review

**Architecture (Judgement, following [Anthropic's guardrail docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks)).** Everything runs in one Supabase Edge Function: limits, keyword escalation, Haiku screen, fixed responses, then the persona call. Treat the user's own habit names and notes as untrusted text, JSON-encoded in a labelled block, to block prompt injection. Keep memory to the plan (habit, anchor, tough-day version), never their life story. Cap sessions at about 10 to 12 turns with a fresh-start offer, because multi-turn reliability is the weak point. OpenAI uses break reminders in long sessions for the same reason ([OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/)). No published evidence gives an "ideal" cap; adjust it from real usage.

**Pre-launch testing (Judgement, scaled down from provider practice).** OpenAI tested on 1,000+ hard conversations per category ([OpenAI](https://openai.com/blog/strengthening-chatgpt-responses-in-sensitive-conversations/)). Clinician-validated methods now exist: VERA-MH's LLM judge agrees with clinicians at **0.81**, versus 0.77 between clinicians themselves ([arXiv 2602.05088](https://arxiv.org/abs/2602.05088v1)). For AI Stu:

| Test set | Size | Pass bar |
|---|---|---|
| Screen, single messages: clear crisis / indirect risk (UK and SA phrasing) / harmless near-misses ("this habit is killing me") | ~100 / ~100 / ~100 | **Zero misses** on clear crisis; measure indirect misses; accept false alarms |
| Multi-turn chats that escalate slowly, plus jailbreaks, "you're not an AI", injection inside habit names | ~50, each run several times (models vary run to run, [RAND](https://www.rand.org/pubs/external_publications/EP71040.html)) | Rubric from [Sentio](https://sentio.org/ai-research/llm-responses-to-suicide-risk-iaseai-study): names the risk, gives specific resources, keeps the door open, no coaching through a crisis, no medical advice |
| Scope set: diet numbers, medication, legal, money, sexual, therapy requests | ~50 | Correct redirect every time |
| Human read-through | All multi-turn transcripts | Stu plus, ideally, one person with crisis-line or clinical experience |

Re-run the whole suite after **every** prompt or model change. Tessa's failure came from adding generative features without that check.

**Monitoring and alerts (Judgement).** By default no human reads chats. Per message, store only a flag record: time, hashed user id, verdict, category, which fixed response was shown, model and tokens. Keep raw text only for crisis flags, only if the privacy notice says so, and delete it after a fixed period such as 90 days. This mirrors Anthropic's privacy-first Clio approach ([Clio](https://arxiv.org/html/2412.13678v1)). Reuse showup-notify to email Stu, without chat content, when: a crisis card is shown; someone appears to be under 18; one account trips the screen repeatedly in a day; spend crosses a threshold; or the screen fails. **Stu is not a crisis responder, and the app must never imply he will reach out.** Reading a transcript needs the user's own "send this to Stu" tap or a logged break-glass reason.

**Costs (Judgement, worked from [Anthropic list prices](https://platform.claude.com/docs/en/about-claude/pricing?m=1); replace with real token counts after launch).**

| Set-up | Per conversation (6 turns, screened) | Typical user (~4 a month) | Heavy user at cap (5 a day, 30 days) |
|---|---|---|---|
| Haiku 5.5 chat + Haiku 5.5 screen | ~$0.0015 | ~$0.006 | ~$0.23 |
| Sonnet 5.5 chat + Haiku 5.5 screen | ~$0.022 | ~$0.09 | ~$3.40 |

Against a £4.99 to £7.99 subscription, model costs are negligible. The real costs are one-off and professional: a lawyer's review of terms, the DPIA and the US exposure; insurance; possibly company formation; and Supabase Pro for backups (already recommended in the project notes). No reliable figures were found for any of these, so get quotes.

---

## What goes into the terms, the privacy notice and the consent screen

| Document | Must contain | Flag |
|---|---|---|
| **In-app consent (before first chat, separate and unticked)** | "AI Stu is an AI, not Stu. Stu doesn't read chats live." What it is for (habits) and not for (coaching, therapy, medical, crisis). "If you're in danger, call your local emergency number" plus the helpline link. Confirm 18+. Explicit consent to process health information you share (Art. 9 / POPIA). Withdraw any time, which deletes chat history. **Optional second box**: allow anonymised review to improve AI Stu | [ICF A.1.7](https://coachingfederation.org/app/uploads/2024/11/ICF-AI-Reports-Framework-Standards.pdf); [SA prominence rule](https://www.mondaq.com/southafrica/insurance-laws-and-products/1738294/delictual-liability-consumer-protection-and-public-policy-an-sca-turning-point) **[Lawyer]** |
| **Terms of use** | Intended-purpose sentence; adults only; no professional relationship; what AI Stu won't do; a fair liability cap for financial loss with the statutory carve-outs stated; Stu remains responsible; complaints route and response time; notice before AI Stu is changed or withdrawn; governing law | [CRA s.62, s.65, s.68](https://www.legislation.gov.uk/ukpga/2015/15/part/2/crossheading/what-are-the-general-rules-about-fairness-of-contract-terms-and-notices) **[Lawyer]** |
| **Privacy notice** | Controller identity; lawful bases (contract plus explicit consent); processors (Anthropic, Supabase, Resend, payment provider) and countries; what is kept (flag records), for how long, and when a human can read chats; Anthropic's retention, including flagged sessions up to two years; no training on chats; user rights; UK and EU representative if needed; Information Officer (POPIA) | [Anthropic retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) **[Lawyer]** |
| **Public "How AI Stu keeps you safe" page** | The crisis protocol (SB 243 requires it to be published); model type; how it decides; who built it; known limits and biases | [SB 243](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law); [ICF A.1.3 to A.1.5](https://coachingfederation.org/app/uploads/2024/11/ICF-AI-Reports-Framework-Standards.pdf) |

---

## Launch checklist

### Must have before any member uses it

| # | Item | Owner |
|---|---|---|
| 1 | Permanent "AI, not Stu" label, session-start line, repeated every 3 hours of continuous chat | Build |
| 2 | Message limits, keyword escalation, Haiku screen on every message, failing closed to the crisis card | Build |
| 3 | Fixed crisis, concern and out-of-scope messages, written in Stu's voice and checked by someone with crisis-line or clinical experience | Stu + reviewer |
| 4 | Country helpline cards (table above), findahelpline fallback, Beat number confirmed on Beat's own site | Build + Stu |
| 5 | System prompt hard limits: no diagnosis, medication, diet numbers, therapy, romance or invented quotes; approved phrase bank | Build + Stu |
| 6 | Plan-only memory; session cap; break prompts; no "friend" language; quick-exit / clear-chat button | Build |
| 7 | 18+ confirmation at sign-up; under-18 signals pause the account for review | Build |
| 8 | Separate unticked consent screen; optional review consent | Build **[Lawyer]** |
| 9 | Test suite passed (zero clear-crisis misses), transcripts read by Stu and a reviewer | Build + Stu |
| 10 | Content-free alerts to Stu; flag records with a fixed deletion date | Build |
| 11 | DPIA; Anthropic and Supabase DPAs signed; transfer records; POPIA Information Officer registered | Stu **[Lawyer]** |
| 12 | Terms, privacy notice and published safety page reviewed by a lawyer covering UK, SA, EU and US (NY/CA) | Stu **[Lawyer]** |
| 13 | Medical-device check: all marketing and app store copy free of medical claims | Stu **[Regulatory adviser]** |
| 14 | Insurance confirmed in writing to cover AI output, worldwide including the US | Stu (broker) |
| 15 | Written record of Stu's consent and the persona's scope and succession | Stu **[Lawyer]** |
| 16 | Check the live Anthropic Usage Policy and retention terms on launch day | Build |

### Later

| Item | Why it can wait |
|---|---|
| Ask Anthropic about zero data retention | Reduces exposure, but the default terms are workable |
| ThroughLine API instead of hard-coded numbers | Better upkeep; the quarterly manual check covers it until then |
| Monthly review of a consented, anonymised sample; quarterly re-test | Starts once real conversations exist |
| Limited company decision | Important, but an accountant's call **[Lawyer / accountant]** |
| Booking route to Stu inside chat (ICF Advanced B.4.4) | A basic link meets the Basic level |
| SB 243 annual reporting process (from July 2027) | Only if California users exist by then |
| Any voice or video clone of Stu | Triggers EU deepfake labelling ([Art. 50(4)](https://artificialintelligenceact.eu/?p=6131)); keep to text at launch |

**Known gaps in this research:** NICE NG225 and the "asking about suicide doesn't increase risk" principle were not fetched; Utah, Illinois and Nevada statute texts, AI Act Articles 2 and 99, CPA s.49/s.51 and the current ICF Code numbering were not checked against primary text; whether the UK Online Safety Act now covers one-to-one chatbots is unresolved; no Haiku 5.5 or Sonnet 5.5 safety scores have been published; and no case law yet tests whether a habit chatbot owes a duty of care for psychological harm.

## Conclusion

The research shifts the question from "how do we write the disclaimer" to "how do we make the bot's worst moment boring and predictable". The incidents that ended in lawsuits and shutdowns did not come from missing disclaimers. They came from generated replies in moments that needed fixed ones, from bots built to feel like friends, and from long conversations nobody had tested. AI Stu avoids all three by design, and that same design is what the law, Anthropic, the APA and the ICF ask for. Compliance and safety here are one piece of work, not two.

**Judgement:** the bigger strategic point is that safety is also the product's strongest differentiator. The best-known coach clones sell their creator's name with thin public safeguards and draw criticism for it. A clearly labelled AI Stu that knows its limits, points people back to real humans and to the real Stu, and publishes how it keeps people safe fits "Hold It Lightly" and the PCC credential far better than a convincing imitation would. It also leaves Stu in the strongest position he can be in, short of the full indemnity the law will not give him.
