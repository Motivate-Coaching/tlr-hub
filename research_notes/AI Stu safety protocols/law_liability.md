# AI Stu: law, regulation and the limits of liability protection

Scope: a chat feature ("AI Stu") inside Let's Go!, a paid consumer habit app sold by Stuart Fairbairns (South African resident sole trader, trading as Motivate Coaching) to adults in the UK, South Africa, the EU and elsewhere, possibly through Paddle as merchant of record. Built on the Anthropic API, data in Supabase (London). Research date: 6 November 2026. Not legal advice. Items marked "Judgement" are the researcher's reasoning, not sourced fact. Items marked "Verify" were not confirmed against the primary text in this session and a lawyer should check them.

Headline judgement: no combination of terms, consent and disclaimers can make a sole trader "completely indemnified". In the UK and South Africa the law voids some exclusions outright (death or injury caused by negligence in the UK; gross negligence in South Africa) and tests the rest for fairness. What design, consent and terms can do is (a) keep the product outside the regulated categories (medical device, therapy, high-risk AI), (b) meet the disclosure and crisis-protocol rules so there is no statutory breach to sue on, (c) make the remaining exclusions enforceable by drawing them clearly to the user's attention, and (d) transfer the residual risk to an insurer. A limited company would also separate personal assets from business debts; as a sole trader Stu is personally liable without limit (Judgement; a lawyer or accountant should advise on incorporation).

## 1. Disclosure and AI-specific chatbot laws (EU, UK, US states)

### Takeaway
AI Stu must clearly tell every user, at the start of each chat, that they are talking to an AI and not to Stu himself. This is required by the EU AI Act Article 50 (from 2 August 2026), by New York and California companion chatbot laws for users in those states regardless of where the seller is based, and by Anthropic's own usage policy. New York and California also require a suicide and self-harm protocol. Illinois and Nevada ban AI from providing therapy or mental health care, so AI Stu must never be framed or behave as therapy.

### Cited Findings
EU AI Act Article 50
- Providers of AI systems intended to interact directly with people must design them so users are informed they are interacting with AI. [artificialintelligenceact.eu practical guide](https://artificialintelligenceact.eu/?p=6131)
- Exception: not needed where AI use is "obvious from the point of view of a natural person who is reasonably well-informed, observant and circumspect"; the guide warns against over-relying on it. [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131)
- Timing: "at the latest at the time of the first interaction or exposure"; in sensitive contexts a one-time notice may not be enough and may need repeating; must be clear and distinguishable. [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131)
- Applies from 2 August 2026. [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131); [BSI press release, Aug 2026](https://www.bsigroup.com/en-GB/insights-and-media/media-centre/press-releases/2026/august/eu-ai-act-article-50-transparency-obligations/)
- A May 2026 "AI Omnibus" provisional agreement gives generative systems already on the market until 2 December 2026 for the Article 50(2) machine-readable marking duty; the source does not say this extends Article 50(1) chatbot disclosure. Commission draft guidelines on Article 50 were out for consultation. [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131); [McCann FitzGerald on draft guidelines](https://www.mccannfitzgerald.com/knowledge/technology/european-commission-publishes-draft-guidelines-on-transparency-obligations-under-the-eu-ai-act)
- Territorial reach: the AI Act applies to providers placing systems on the EU market and to third-country providers and deployers where the output is used in the EU (Article 2). [Article 2 text](https://artificialintelligenceact.eu/article/2/) (Verify: not fetched this session)
- Penalties for breaching Article 50 are up to EUR 15m or 3% of worldwide turnover, the lower of the two for SMEs (Article 99). [Article 99 text](https://artificialintelligenceact.eu/article/99/) (Verify: not fetched this session)

New York (AI companion law, General Business Law Article 47)
- "AI companion" means a system that simulates a sustained relationship by retaining prior interactions, asking unprompted emotion-based questions and maintaining ongoing dialogue about personal matters. [Morrison Foerster](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai)
- Duties: notify all users they are interacting with AI at session start and at least every three hours; maintain a protocol to detect suicidal ideation or self-harm and refer to crisis providers. In force 5 November 2025. Attorney General may seek up to $15,000 per day per violation. Applies to operators offering AI companions to New York users regardless of where the operator is based. [Morrison Foerster](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai); [Governor Hochul letter to AI companion companies, Nov 2025](https://www.governor.ny.gov/news/governor-hochul-pens-letter-ai-companion-companies-notifying-them-safeguard-requirements-are); [Fenwick](https://www.fenwick.com/insights/publications/new-yorks-ai-companion-safeguard-law-takes-effect)

California SB 243 (companion chatbots)
- "Companion chatbot": AI that gives adaptive, human-like responses and can meet a user's social needs, including by exhibiting anthropomorphic features and sustaining a relationship across interactions. Exclusions: bots used only for customer service or business operations, video game bots limited to the game, and stand-alone consumer devices that do not sustain a relationship. [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law)
- Duties: clear and conspicuous AI notice if a reasonable person could think they are talking to a human; disclosure that companion chatbots may not be suitable for some minors; for known minors, three-hourly reminders and break prompts plus blocking sexual content; a protocol to prevent suicide and self-harm content and refer to crisis services, with protocol details published on the operator's website; annual reports to the Office of Suicide Prevention from 1 July 2027. [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law); [bill text, LegiScan](https://legiscan.com/CA/text/SB243/)
- Enforcement: private right of action, greater of actual damages or $1,000 per violation, plus attorneys' fees. In force 1 January 2026; applies to operators offering to California users regardless of location. [Morrison Foerster](https://www.mofo.com/resources/insights/251120-new-york-and-california-enact-landmark-ai); [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law)
- Skadden notes the law does not explain how to apply the "reasonable person" test or what "sustain a relationship" means, and suggests a conservative approach. [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law)

Illinois, Nevada, Utah (mental health AI laws)
- Illinois HB 1806 (Wellness and Oversight for Psychological Resources Act), signed and effective 4 August 2025: bans offering therapy or psychotherapy to the public in Illinois, including through internet-based AI, unless a licensed professional conducts it; civil penalties via the state licensing department. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots); [HeplerBroom](https://www.heplerbroom.com/blog/illinois-legislation-ai-mental-health-services)
- Nevada (2025, AB 406): bars AI providers from offering systems programmed to provide services that would be professional mental or behavioural health care if done by a person, and from representing that a system can provide such care. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots)
- Utah HB 452: suppliers of "mental health chatbots" must disclose the bot is AI and not human, and are restricted in sharing user data and in advertising through the bot. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots)
- DLA Piper's summary does not address whether general wellness or self-help tools are exempt from these three laws. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots)

Anthropic's own disclosure rule
- Consumer-facing bots must disclose to users that they are talking to AI, "at a minimum at the beginning of each chat session or in the product interface"; naming Claude or Anthropic is not required. Policy page shows an effective date of 12 November 2026. [Anthropic Usage Policy](https://www.anthropic.com/aup)

### Inferences
- Judgement: AI Stu, with memory, emotional check-ins ("how are you feeling about it?") and Stu's warm persona, plausibly meets the New York "AI companion" and California "companion chatbot" definitions. It is not a customer service bot. The safe course is to comply with both: AI notice at the start of every session and a repeat at least every three hours of continuous chat, a published crisis protocol, and refusal to engage in suicide or self-harm content beyond referral. Because the Utah, Illinois and Nevada laws are aimed at mental health services, the best protection there is product design and copy that never offers, implies or performs therapy or mental health care.
- Judgement: for a non-US sole trader with a few US users, practical enforcement risk is low but not zero, and the California private right of action means any user could sue. Geo-blocking US states is an option but is weaker than simply complying, which costs little.
- Judgement: a single design satisfies EU Article 50, the US states and Anthropic at once: a persistent label in the chat interface ("AI Stu is an AI, not Stu. Stu wrote its style and values; it is not Stu typing") plus a session-start line.
- UK: no UK statute requires AI chat disclosure equivalent to Article 50 (see Gaps), but misleading people into thinking they are talking to the real Stu would risk misleading-practice rules under consumer law (Judgement).

### Gaps
- Exact Utah HB 452 duties (disclosure timing, affirmative defence by filing a policy) and Nevada and Illinois penalty amounts were not confirmed from statute text in this session. Verify on [le.utah.gov](https://le.utah.gov/), [leg.state.nv.us](https://www.leg.state.nv.us/) and [ilga.gov](https://www.ilga.gov/).
- Whether the UK has, by November 2026, extended the Online Safety Act or issued binding rules covering one-to-one AI chatbots was not confirmed. A lawyer should check current Ofcom and DSIT positions.
- AI Act Articles 2 and 99 were cited from memory of their content, not fetched. Also check whether Stu, as an EU-market provider outside the EU, needs an EU authorised representative for Article 50 purposes (I found no source saying Article 50 alone triggers that duty).
- Final text of the Commission's Article 50 guidelines (expected before August 2026) was not located.

## 2. Data protection (UK GDPR, ICO, EU GDPR, POPIA, Anthropic API)

### Takeaway
Chats about habits will regularly contain health information (sleep, drinking, anxiety, ADHD, weight), which is special category data. That needs a DPIA before launch, a lawful basis plus an Article 9 condition (in practice explicit consent for a consumer app), tight retention, clear privacy notices and processor contracts with Anthropic and Supabase. Anthropic's commercial API does not train on inputs by default and deletes them within 30 days, with zero data retention available only by arrangement. As a South African domiciled person, Stu is also bound by POPIA for all his processing.

### Cited Findings
- Anthropic commercial API: standard inputs and outputs deleted from the backend within up to 30 days, with exceptions for storage features (Files API), contracts, policy enforcement and legal requirements; flagged content or legal holds can require longer retention. [Anarlog summary of Anthropic policy](https://anarlog.so/blog/anthropic-data-retention-policy/), citing [Anthropic Privacy Center: commercial retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) and [API and data retention docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Training: commercial products have a no-training default; training can occur if the customer explicitly opts in or submits feedback. [Anarlog](https://anarlog.so/blog/anthropic-data-retention-policy/), citing [Anthropic: is my data used for training](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training)
- Zero data retention: under an approved ZDR arrangement, eligible API prompts and responses are not stored at rest after the response; stateful features can still retain data. [Anarlog](https://anarlog.so/blog/anthropic-data-retention-policy/)
- Anthropic offers a Data Processing Addendum. [Anthropic DPA page](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa)
- ICO guidance on AI and data protection is the UK regulator's main reference for lawful basis, fairness, DPIAs and special category data in AI systems. [ICO: guidance on AI and data protection](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/) (Verify: not fetched this session); see also [NatLawReview on the ICO's updated AI guidance](https://natlawreview.com/article/uk-ico-issues-updated-guidance-ai-and-data-protection)
- POPIA: health information is "special personal information" (s.26) and may only be processed under a s.27 authorisation, the first of which is the data subject's consent; s.72 governs transfers outside South Africa. [POPIA full text, acts.co.za](https://source.acts.co.za/protection-of-personal-information-act-2013/protection-of-personal-information-act-2013_content.php) (Verify section numbers against the Act)
- The South African Information Regulator published draft regulations on processing health and sex life data under POPIA. [Mondaq](https://webiis08.mondaq.com/southafrica/healthcare/1516004/draft-regulations-on-processing-health-and-sex-life-data-under-popia)
- Utah HB 452 restricts mental health chatbot suppliers from sharing user information in certain ways. [DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/08/ai-mental-health-chatbots)

### Inferences
- Judgement, practical checklist for a lawyer to confirm:
  1. DPIA before launch (new technology plus special category data is a classic DPIA trigger under UK GDPR Article 35).
  2. Lawful basis: contract for running the chat; Article 9(2)(a) explicit consent for health content, captured by an unticked, specific, separate opt-in before first chat ("AI Stu may process things you tell it about your health. Tick to agree"), withdrawable at any time with chat history deleted.
  3. Do not use chats to improve the bot by default. If Stu wants to review transcripts to improve prompts, make that a second, separate, optional consent, and pseudonymise.
  4. Retention: short, stated, enforced (for example, chat logs auto-deleted after 30 or 90 days unless the user saves them). Ask Anthropic about ZDR.
  5. Processor terms: sign Anthropic's DPA; Supabase DPA; record international transfers (UK to US for Anthropic: UK IDTA/addendum or UK-US data bridge if Anthropic is certified, to be verified).
  6. Representatives: a controller outside the UK offering services to UK people generally needs a UK representative (UK GDPR Article 27), and similarly an EU representative for EU users, with an exemption only for occasional processing that does not include large-scale special category data. Health chats likely remove that exemption.
  7. POPIA: as a South African domiciled responsible party, Stu's processing is in scope for all users; register an Information Officer with the Information Regulator and cover cross-border transfer to London and the US.
- Paddle as merchant of record handles payment data, not chat data, so it does not change the chat data analysis (Judgement).

### Gaps
- The ICO guidance pages and UK GDPR Articles 9, 27, 35 were not fetched in this session; links given are canonical. Check whether the Data (Use and Access) Act 2025 changed anything relevant to consent or automated decisions for this use.
- Whether Anthropic's ZDR is available to a small customer, and on what terms, was not confirmed. Ask Anthropic sales.
- Whether Stu needs to pay the ICO data protection fee as a non-UK controller was not resolved.

## 3. Medical device boundary (MHRA, EU MDR)

### Takeaway
Software is a medical device when its intended purpose is medical (diagnose, prevent, monitor, treat or alleviate a condition) and its function is more than simple. A habit app whose intended purpose is general wellbeing and behaviour change stays outside, provided the claims, marketing, app store text and the bot's behaviour all stay non-medical. A bot that assesses symptoms, names conditions or delivers treatment (for example "CBT for your depression") could cross the line.

### Cited Findings
- MHRA guidance (February 2025) on digital mental health technology explains when products qualify as medical devices; products that "diagnose, prevent, or treat conditions using complex software must meet medical device standards". [GOV.UK press release](https://www.gov.uk/government/news/digital-mental-health-technologies-guidance-launched-to-help-manufacturers-and-safeguard-users)
- The guidance turns on two characteristics: intended purpose ("what the manufacturer intends it to be used for", for example supporting wellbeing versus aiding treatment of a mental health condition) and functionality (examples include AI algorithms and chatbots). A product generally needs regulation as software as a medical device when it has a medical purpose and its functionality is considered complex. [MHRA: digital mental health technology qualification and classification](https://www.gov.uk/government/publications/digital-mental-health-technology-qualification-and-classification)
- Class I devices are self-certified; Classes IIa, IIb and III need approved or notified body assessment. [MHRA guidance page](https://www.gov.uk/government/publications/digital-mental-health-technology-qualification-and-classification)
- EU MDR: software intended for life-style and well-being purposes is not a medical device (Recital 19). [Regulation (EU) 2017/745, EUR-Lex](https://eur-lex.europa.eu/eli/reg/2017/745/oj) (Verify recital wording); detailed qualification guidance in [MDCG 2019-11](https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_qualification_classification_software_en_0.pdf) (not fetched this session)
- Anthropic's high-risk requirements (human review of recommendations) cover medical diagnosis and treatment and "assessing, diagnosing, or treating a mental health condition", but general education and wellness content is excluded. [Anthropic Usage Policy](https://www.anthropic.com/aup)

### Inferences
- Judgement, how to stay outside: state the intended purpose in one sentence used everywhere ("AI Stu helps you build and keep everyday habits. It is not a medical, therapy or mental health service"). Never use words like diagnose, treat, symptoms, therapy, CBT, depression management, anxiety treatment in marketing or the bot's own replies. Instruct the bot not to assess or label conditions, not to give medication or dose advice, and to signpost to a GP, NHS 111, a crisis line or a professional when the user raises a condition. The same design keeps it outside Anthropic's high-risk category, outside Illinois and Nevada's therapy bans, and outside MDR and UK MDR.
- Judgement: the existing Focus view "for ADHD and anxiety" is fine as accessibility framing, but copy should not claim it helps treat ADHD or anxiety.

### Gaps
- The 54-page MHRA PDF (sections 6 and 6.2 on non-qualification and functionality) could not be fetched in this session, so its specific wellbeing examples are not quoted. A regulatory adviser should read sections 6 to 8.

## 4. Liability: what disclaimers can and cannot do, and insurance

### Takeaway
UK law makes any term excluding liability for death or personal injury caused by negligence void, and all other consumer terms must pass a fairness and transparency test. South African law bans exclusion of gross negligence and requires risk and liability-limiting terms to be brought prominently to the consumer's attention before agreement; courts read such clauses narrowly against the drafter (confirmed again by the Supreme Court of Appeal in January 2026). So "not therapy" statements and consent do not create indemnity; they help define the service, show reasonable care and make permissible limits enforceable. Insurance is the real backstop.

### Cited Findings
UK
- Consumer Rights Act 2015 s.65: a trader cannot by a term or notice exclude or restrict liability for death or personal injury resulting from negligence; a person's agreement to or awareness of such a term is not, of itself, taken as voluntary acceptance of the risk. [CRA 2015 s.65, legislation.gov.uk](https://www.legislation.gov.uk/ukpga/2015/15/section/65)
- CRA s.62: an unfair term is not binding on the consumer (unfair if contrary to good faith it causes a significant imbalance to the consumer's detriment); s.68 requires written terms to be transparent; Schedule 2 lists terms that may be regarded as unfair. [CRA 2015 Part 2, fairness rules](https://www.legislation.gov.uk/ukpga/2015/15/part/2/crossheading/what-are-the-general-rules-about-fairness-of-contract-terms-and-notices)
- CRA Part 1 Chapter 3 gives statutory rights for digital content (satisfactory quality, fit for purpose, as described) which cannot be excluded (s.47). [CRA 2015 s.47](https://www.legislation.gov.uk/ukpga/2015/15/section/47) (Verify: not fetched this session)

South Africa
- In a 27 January 2026 Supreme Court of Appeal judgment (tour operator v injured tourist), the Court held CPA risk notices must meet requirements of prominence, timing and assent; unusual or serious risks must be specifically drawn to the consumer's attention (s.58); exemption clauses are read restrictively against the drafter and must exclude liability in clear and unequivocal terms; the Court indicated it would have found a disclaimer contrary to public policy where the operator itself created the risk. [Mondaq, SCA turning point](https://www.mondaq.com/southafrica/insurance-laws-and-products/1738294/delictual-liability-consumer-protection-and-public-policy-an-sca-turning-point)
- CPA s.51 prohibits terms that limit or exempt a supplier from liability for loss caused by gross negligence; s.49 requires terms limiting liability or assuming risk to be drawn to the consumer's attention in plain language before agreement. [Consumer Protection Act 68 of 2008, gov.za](https://www.gov.za/documents/consumer-protection-act) (Verify: section wording not fetched this session)

Insurance
- The Association for Coaching requires coaches who coach privately to hold individual professional indemnity insurance; PI covers defence costs and damages where a client claims advice or services were inadequate and caused loss. It gives no costs and does not mention AI or digital products. [Association for Coaching](https://www.associationforcoaching.com/page/ProfessionalIndemnityInsuranceanddoIneedit)
- Hiscox UK offers PI for coaching, training and education businesses. [Hiscox policy summary](https://www.hiscox.co.uk/sites/uk/files/documents/2017-03/10166-pi-coaching-training-education-ire-summary.pdf)

### Inferences
- Judgement, what the terms and design can achieve:
  - A clear service definition ("a habit support tool, not coaching, therapy, medical or crisis care") narrows what a court treats as the promised service and the standard of care, which is the strongest legitimate lever.
  - A fair cap on liability for financial loss (for example the fees paid in the last 12 months) is commonly used and may pass the UK fairness test if transparent and prominent; it cannot touch death or personal injury from negligence (UK) or gross negligence (SA).
  - Clear consent at first use, plain-language risk notices shown before the first chat (not buried), and an 18+ age confirmation make the permissible limits enforceable and support the "free will" goal, but agreement does not by itself mean the user accepted the risk of negligence (CRA s.65(2)).
  - A crisis protocol (detect, stop coaching, show crisis numbers by country, encourage human contact, do not continue the habit conversation) is required in New York and California and is also the main evidence of reasonable care everywhere.
  - Age gating: Anthropic treats under 18s as minors with extra requirements, and California adds minor-specific duties, so an 18+ gate with a confirmation step is sensible. Self-declaration is not verification; if the bot sees signs a user is a minor, it should end and signpost (Judgement).
  - Paddle as merchant of record is the seller of record for the payment, which may move some consumer-contract obligations (refunds, cancellation) to Paddle, but Stu stays responsible for what the bot says (Judgement; check Paddle's buyer and seller terms).
- Judgement on insurance: ask a broker specifically for a combined professional indemnity plus technology errors and omissions policy that names AI-generated output and covers worldwide sales excluding or including the US. Many standard coaching PI policies exclude US/Canada jurisdiction and may exclude AI output or software; this must be checked in writing.

### Gaps
- No reliable published premium figures for coach PI with AI or tech E&O cover were found in the UK or South Africa. Quotes needed from brokers (UK examples to approach: Hiscox, specialist coaching insurers; SA: a short-term insurance broker familiar with professional liability). Do not rely on unverified price ranges.
- Whether UK and SA courts would treat a habit chatbot as owing a duty of care in negligence for psychological harm is untested; no case law found.
- CPA s.49 and s.51, and CRA s.47, were cited from canonical statute pages without fetching the current text this session.

## 5. Using Stu's own likeness and voice

### Takeaway
Because Stu himself consents, there is no misappropriation problem. The legal risks lie elsewhere: misleading users into thinking they are talking to the real Stu (consumer law, the AI disclosure laws above, and Anthropic's impersonation rule), and, if a cloned voice or face is used, deepfake labelling under the EU AI Act.

### Cited Findings
- Anthropic prohibits using its models to "impersonate real individuals or entities, or create fake personas" where used to mislead about origin or to pass a bot off as human; clearly disclosed fiction is not prohibited. [Anthropic Usage Policy](https://www.anthropic.com/aup)
- California SB 243 requires a clear notice where a reasonable person could believe they are talking to a human. [Skadden](https://www.skadden.com/insights/publications/2025/10/new-california-companion-chatbot-law)
- EU AI Act Article 50 also covers synthetic audio, image and video content (machine-readable marking under 50(2); deepfake disclosure under 50(4)), with a voluntary Code of Practice on AI-generated content in preparation. [artificialintelligenceact.eu](https://artificialintelligenceact.eu/?p=6131)

### Inferences
- Judgement: the name "AI Stu" plus a visible "AI, not Stu" label meets the anti-deception aim. Avoid wording like "Stu is here for you" without the AI label, and never let the bot claim to be the human Stu or to remember personal meetings.
- Judgement: write down Stu's consent and the scope of use (text persona; any future voice or video clone) in a short document, and decide what happens to the persona if the business is sold, he stops trading or he dies. This matters more if a cloned voice is later added (several US states have digital replica laws aimed at unauthorised use; with his own consent these are low risk).
- Judgement: the UK has no general image right; passing off protects a famous person's endorsement, not relevant where Stu is the owner.

### Gaps
- No source specific to a person running a bot of themselves was found; the analysis above is reasoning from the general rules.

## 6. Anthropic usage policy requirements

### Takeaway
Anthropic's current Usage Policy (page shows effective 12 November 2026) requires AI disclosure at the start of each session or in the interface for any consumer-facing bot, compliance with extra minor-safety guidelines if minors are served, no promotion of suicide, self-harm or eating disorders, and human review for "high-risk" recommendations, which include mental health assessment and treatment but exclude general wellness content.

### Cited Findings
- Disclosure: bots that talk directly with external users must disclose that they are AI, "at a minimum at the beginning of each chat session or in the product interface". [Anthropic Usage Policy](https://www.anthropic.com/aup)
- High-risk areas include medical ("diagnosing a condition; recommending, starting, stopping, or adjusting a treatment or medication") and mental health ("assessing, diagnosing, or treating a mental health condition"); a qualified person must meaningfully review high-risk AI recommendations and recipients must be told AI was used; general education and wellness content is excluded. [Anthropic Usage Policy](https://www.anthropic.com/aup)
- Minors: anyone under 18; products serving minors must follow additional guidelines in Anthropic's support article. [Anthropic Usage Policy](https://www.anthropic.com/aup)
- Prohibited: promoting, facilitating or glamorising suicide or self-harm; promoting eating disorders; shaming or bullying; deceptive techniques intended to cause emotional harm. [Anthropic Usage Policy](https://www.anthropic.com/aup)
- The policy sets no specific crisis-response requirement for operators; it links to Anthropic's own Claude.ai mental health safeguards. [Anthropic Usage Policy](https://www.anthropic.com/aup)

### Inferences
- Judgement: AI Stu fits inside the "wellness" exclusion only if it is genuinely kept to habits and behaviour change. If it drifts into assessing mood disorders or advising on medication, Anthropic would expect qualified human review, which a solo coach could not provide at scale. The system prompt should hard-limit this.
- Judgement: the "never shaming" copy rule already in the Let's Go! brand aligns with the anti-bullying prohibition.

### Gaps
- The policy page carried an effective date of 12 November 2026, six days after this research, which suggests a recent revision. Re-check the live page at launch. Anthropic's separate support article on minors was not reviewed.
