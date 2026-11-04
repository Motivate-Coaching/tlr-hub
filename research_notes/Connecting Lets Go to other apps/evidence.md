# Connecting Let's Go! to other apps: does automatic data import help habit apps?

Research date: 4 November 2026.

**How far these notes can be trusted.** Items marked **[checked]** were opened and read in this session (abstract or full text). Items marked **[not re-checked]** were found by live search (so the source exists), but the page could not be opened (blocked or captcha); their descriptions come from prior knowledge of the paper and should be confirmed before quoting.

Quality key: **RCT** = randomised controlled trial; **MA** = meta-analysis; **Obs** = observational data, no random allocation; **Qual** = interviews or surveys; **Position** = expert essay, no new data; **Vendor** = company claim or company-run analysis.

## 1. Does automatic capture (wearables, health hubs, app integrations) improve retention or habit success compared with manual logging?

### Takeaway
The evidence splits by study type. The largest observational dataset (455,341 users of a Walgreens rewards programme) found people whose data uploaded automatically stayed engaged about four times longer than manual loggers, but users chose to connect, were paid points to do so, and the analysis was unadjusted, so it shows association, not cause. The best randomised evidence (the IDEA trial, n = 470, 24 months) found the opposite on outcomes: adding a wearable gave *less* weight loss than manual self-monitoring. No RCT was found that tests "connect your apps" against manual ticking for retention in a general habit app.

### Cited Findings
- **Kim, Wineinger, Taitel et al., "Self-Monitoring Utilization Patterns Among Individuals in an Incentivized Program for Healthy Behaviors" (J Med Internet Res, Nov 2016), Obs and Vendor co-authored (Walgreens with Scripps), N = 455,341 users of Walgreens Balance Rewards for healthy choices, 2014 data. [checked]**
  - Automatic upload users averaged 24.01 weeks of participation versus 10.54 weeks for manual users; active weeks (at least one log) 20.15 versus 5.23 (both P < .001). Authors summarise this as "roughly four times longer".
  - By activity, active weeks automatic versus manual: exercise 20.41 vs 5.71; sleep 13.61 vs 3.25; weight 10.76 vs 5.18 (all P < .001). Blood pressure and glucose showed no significant difference (automatic upload rare for both).
  - Caveats stated or evident in the paper: users chose whether to link a device; linking earned 250 reward points; comparisons were unadjusted (no multivariable model); duration data skewed but analysed by t-test; about a third of users stopped after one week; 81.7% of those reporting gender were female; Walgreens employees were authors (declared conflict). Outcome is engagement, not health or habit success.
  - [JMIR full text PDF](https://jmir.org/2016/11/e292/PDF); [JMIR article page](https://www.jmir.org/2016/11/e292); news coverage at [MobiHealthNews](https://www.mobihealthnews.com/news/connected-health-tools-boost-long-term-patient-engagement-study-finds) [checked]
- **IDEA trial (Jakicic et al., JAMA, Sept 2016; DOI 10.1001/jama.2016.12858), RCT, 470 to 471 adults aged 18 to 35, BMI 25 to under 40, 24 months. [checked via ScienceDaily]** Everyone had a low-calorie diet, more activity and group counselling. At 6 months they were split: one group carried on self-monitoring by hand (website), the other added a wearable tracking energy expenditure and activity. At 24 months the wearable group lost an average of 7.7 lb (about 3.5 kg) against 13 lb (about 5.9 kg) without it. About 77% women. — [ScienceDaily, 20 Sept 2016](https://www.sciencedaily.com/releases/2016/09/160920131932.htm); [TCTMD](https://www.tctmd.com/news/step-wrong-direction-weight-loss-efforts-could-be-hampered-addition-wearable-device); [NHLBI BioLINCC trial record](https://biolincc.nhlbi.nih.gov/studies/idea); [AAFP summary, 2018](https://www.aafp.org/pubs/afp/issues/2018/1201/p670.pdf)
  - Caveats (judgement): 2010s upper-arm device; young adults; outcome was weight, not habit retention. It shows automation is not automatically better; it does not prove automation is worse for a habit app.
- **GoalTracker RCT (Patel, Hopkins, Brooks, Bennett; JMIR mHealth and uHealth, Feb 2019), N = 105 randomised (100 analysed), 12 weeks, MyFitnessPal. [checked]** Not a manual versus automatic test: compared *what* to track and when (weight and diet from the start; weight first then diet from week 5; diet only). Weight loss at 3 months was similar (−2.8, −2.7, −2.4 kg; no significant difference). Diet logging days per week (median): 5.3, 1.9, 2.9. Retention 76% at 3 months. Relevant only as evidence that simpler tracking loads can work as well as heavier ones. — [DOAJ abstract](https://doaj.org/article/efd4a362000e415ca4fac400ea958990); [PubMed 30816851](https://pubmed.ncbi.nlm.nih.gov/30816851/)

### Inferences
- Judgement: the Walgreens result is the most-quoted "integrations boost engagement" figure and is real, but it is the classic self-selection pattern: keener people connect devices. It is also measuring *data arriving*, not the person choosing to engage. A passive device can keep uploading while the person has mentally left (Epstein 2015 notes exactly this; see section 2).
- Judgement: in the Walgreens data the gap was large for exercise, sleep and weight (things devices measure) and absent for blood pressure and glucose (where automation was rare). Let's Go! actions such as writing, Spanish practice or a tough-day lighter version are mostly invisible to sensors, so only a minority of actions could benefit at all.

### Gaps
- No RCT found comparing retention between randomly assigned "connected" and "manual" users of a habit app.
- Patel MS et al. (JAMA 2015, "Wearable devices as facilitators, not drivers, of health behaviour change") is relevant but no URL was returned in search.

## 2. Does manual logging carry its own benefits that automation removes?

### Takeaway
This is the strongest and most consistent part of the evidence. A large meta-analysis shows monitoring progress improves goal attainment, with a bigger effect when progress is physically recorded. HCI researchers argue full automation cuts awareness, accountability and involvement, and recommend "semi-automated" designs. Lapsing is normal, and passive tools can hide disengagement because data keeps flowing.

### Cited Findings
- **Harkin et al. (Psychological Bulletin, 2016; online Oct 2015), MA of 138 studies, 19,951 participants. [checked via APA release]** Prompting progress monitoring improved goal attainment; monitoring "had an even greater effect if the information was physically recorded or publicly reported." The paper reports an overall effect of about d+ = 0.40 [effect size not shown on the press page; not re-checked]. — [APA press release, Oct 2015](https://www.apa.org/news/press/releases/2015/10/progress-goals); [White Rose eprint](https://eprints.whiterose.ac.uk/91437/); [EurekAlert](https://www.eurekalert.org/news-releases/598512)
- **Choe et al. (13 authors), "Semi-Automated Tracking: A Balanced Approach for Self-Monitoring Applications" (IEEE Pervasive Computing, Jan to Mar 2017), Position. [checked]** Manual tracking supports awareness and engagement but its capture burden makes long-term use hard; the authors suspect full automation "significantly reduces the awareness, accountability, and involvement" manual tracking provides. Semi-automation is proposed to lower burden, capture hard-to-sense data and keep awareness. Designers should weigh data-capture feasibility, purpose of tracking, and the person's motivation. Examples include SleepTight (quick lock-screen logging), MoodRhythm (manual core activities plus passive sensing). No new experiment; synthesises earlier studies and the authors' judgement. — [PDF, UT Austin](https://users.ece.utexas.edu/~ethomaz/papers/j1.pdf); [Penn State record](https://pure.psu.edu/en/publications/semi-automated-tracking-a-balanced-approach-for-self-monitoring-a/); [Microsoft Research](https://www.microsoft.com/en-us/research/?p=337103)
- **Epstein, Ping, Fogarty, Munson, "A Lived Informatics Model of Personal Informatics" (UbiComp 2015), Qual: survey of 168 unique respondents (physical activity n = 105, finances n = 99, location n = 83) plus 22 interviews. [checked]**
  - Four kinds of lapse: forgetting, upkeep (8 people mentioned forgetting to charge wearables, leaving long gaps), skipping (entries too tedious, too private, or already known), and suspending (holidays, breaks).
  - 44% of physical activity and 45% of location trackers abandoned their tools within three months, versus 26% of finance trackers.
  - Finance trackers, 63% of whom used heavily manual spreadsheets, were the *most* persistent: effort is tolerated when people value the data.
  - Passive tools (HealthKit, Moves, Mint) keep collecting until disabled, so some long-term "trackers" keep the tool without interacting with it.
  - [PDF](https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf); [Self Research library](https://library.selfresearch.org/research/a-lived-informatics-model-of-personal-informatics/)
- **Epstein et al., "Beyond Abandonment to Next Steps" (UbiComp 2016), Qual survey, 141 lapsed Fitbit users (915 reactions to their own data). [checked]** About half (70 of 141) felt guilt or frustration about stopping and often blamed themselves; 97% of that group would consider returning. Short users (under four months) mostly lost interest; intermittent users cited the daily wearing requirement and charging. Participants found barrier-focused prompts judgemental; recommendations: positive framing, invite guilty lapsers back, highlight best days. — [PDF](https://homes.cs.washington.edu/~jfogarty/publications/ubicomp2016.pdf)
- **OmniTrack (Kim, Jeon, Lee, Choe, Seo; IMWUT 2017), field deployment.** Flexible tracker letting people combine manual fields with automatic data from services; people valued choosing what to track. [not re-checked] — [PDF](https://terpconnect.umd.edu/~choe/download/IMWUT-2017-Kim-OmniTrack.pdf)
- **Attig and Franke (Computers in Human Behavior, 2020), review plus survey on wearable tracker attrition.** Reasons for stopping include lost motivation, unmet expectations and practical hassles; automatic capture did not prevent attrition. [not re-checked] — [University of Lübeck record](https://research.uni-luebeck.de/en/publications/abandonment-of-personal-quantification-a-review-and-empirical-stu/); [TU Chemnitz press release, Sept 2019](https://www.tu-chemnitz.de/tu/pressestelle/2019/09.18-14.51.html)
- **Ayobi et al., "Reflections on 5 Years of Personal Informatics" (CHI 2016 workshop).** Reviews rising concerns: burden, data that does not lead to reflection, negative emotions. [not re-checked] — [UCL PDF](https://discovery-pp.ucl.ac.uk/id/eprint/1490266/2/Ayobi_Reflections%20on%205%20Years%20of%20Personal%20Informatics%20-%20Rising%20Concerns%20and%20Emerging%20Directions.pdf)

### Inferences
- Judgement: Let's Go!'s one-tap "I showed up today" already matches the semi-automated ideal: very low burden but still a deliberate act of noticing. Silent auto-ticking would remove the part Harkin shows matters most (physically recording progress).
- Judgement: the evidence-consistent way to use an integration is "suggest and confirm" ("Your watch logged a run this morning. Count it?"), which tackles forgetting, the top lapse cause, while keeping the act of recording.
- Judgement: Epstein 2016's guilt findings support Let's Go!'s comeback counting and its rule never to shame; an integration that shows "no data" days risks re-creating the guilt.

### Gaps
- Michie et al. 2009 meta-regression (122 studies; self-monitoring works best with another self-regulation technique) is relevant but no URL was returned.
- No study found that directly tests "suggest and confirm" against silent auto-ticking for habit retention.
- Clawson et al. 2015 ("No longer wearing", resale ads for trackers) relevant but no URL returned.

## 3. Does aggregating many data sources in one place (Exist.io, Gyroscope, Apple Health) help, and do people value correlations?

### Takeaway
The main peer-reviewed study used real Exist users. Most automatically generated correlations were not seen as interesting; several users felt overloaded ("analysis paralysis"). People valued a few surprising, useful, cross-category patterns. Filtering hard roughly halved the number shown and lifted the share rated interesting to about 81%.

### Cited Findings
- **Jones and Kelly, "Dealing with Information Overload in Multifaceted Personal Informatics Systems" (Human-Computer Interaction, 2018), mixed methods, 20 participants aged 21 to 60 in Bath, UK, three months using Exist with Fitbit, RescueTime, Last.fm, social media, calendar, weather and daily mood. [checked]**
  - Each person had 12 to 113 correlations (mean 62.4). Each rated 10 random correlations (200 ratings).
  - Strongest predictors of "interesting": surprising or useful. Cross-category correlations, low p-values, and those not involving weather, weekday, productivity or social media rated higher. Obvious ones ("more steps, more active minutes") were low value.
  - Only 46.7% of correlations matched participants' predictions; 37.8% contradicted them.
  - At least four became frustrated by the effort of reviewing them; one described "analysis paralysis". People struggled to recall earlier insights.
  - The authors' filters cut displayed correlations by about 55% and raised the share rated interesting to about 81%, 34 percentage points above filtering by p < 0.05 alone.
  - [Open access PDF via CORE](https://core.ac.uk/download/161917369.pdf); [University of Bath record](https://researchportal.bath.ac.uk/en/publications/dealing-with-information-overload-in-multifaceted-personal-inform/)
- Earlier stages of the same work: "Finding 'Interesting' Correlations in Multi-Faceted Personal Informatics Systems" (CHI 2016 extended abstract) and "Exploring Correlational Information in Aggregated Quantified Self Data Dashboards" (UbiComp 2015 workshop). [not re-checked] — [University of Melbourne record](https://findanexpert.unimelb.edu.au/scholarlywork/1283008-finding-%22interesting%22-correlations-in-multi-faceted-personal-informatics-systems); [Bath record](https://researchportal.bath.ac.uk/en/publications/exploring-correlational-information-in-aggregated-quantified-self/)

### Inferences
- Judgement: this strongly supports V2's existing "Patterns worth noticing" (day 21 onwards, strict thresholds, few results, worded as something to notice). Adding more streams multiplies possible correlations and so trivial or false "patterns" unless thresholds stay strict. Cross-category links (for example sleep against show-ups) are the ones people find most interesting, which is the one real argument for importing a data stream such as sleep or steps.
- Judgement: n = 20 is small; treat as strong design guidance, not a measured retention effect.

### Gaps
- No independent evidence found that aggregation hubs (Exist, Gyroscope, Apple Health, Health Connect) improve retention for the apps feeding them. Nothing peer-reviewed found from Gyroscope.

## 4. Industry and vendor data on integrations and retention

### Takeaway
Baseline retention for health and fitness apps is very low (about 3% to 8% still active at day 30). No published company figure was found from Strava, Habitify, Streaks, Duolingo or Garmin linking integrations to retention. What exists beyond Walgreens (section 1) is marketing from companies that sell integrations.

### Cited Findings
- **Benchmarks (industry aggregators, 2023):** health and fitness apps retain about 27% of users on day 1 (Adjust) and 3% (AppsFlyer) to 8% (Adjust) on day 30. Sources differ in method. [checked] — [Business of Apps, health and fitness app benchmarks](https://businessofapps.com/data/health-fitness-app-benchmarks); see also [Adjust, US app retention by vertical](https://www.adjust.com/blog/US-app-retention-by-vertical/) [not re-checked]
- **Vendor:** Walgreens' own co-authored analysis (section 1) is the only company dataset found with numbers: automatic users engaged about four times longer. Company-authored and self-selected. [checked] — [JMIR 2016](https://jmir.org/2016/11/e292/PDF)
- **Vendor:** Terra, ROOK and Sahha sell unified wearable APIs and market them as engagement and personalisation drivers; no independent retention data on the pages found. [not re-checked] — [Terra enterprise](https://tryterra.co/enterprise); [Terra wearable data API](https://tryterra.co/wearable-data-api); [Athletech News on ROOK](https://athletechnews.com/rook-api-integration/); [Sahha comparison page](https://sahha.ai/compare/terra-alternatives/)
- **Company disclosure:** Fitbit reported its community passing 25 million active users; a scale figure, not evidence about syncing and retention. [not re-checked] — [Google blog](https://blog.google/products/fitbit/fitbit-community-grows-25m-active-users)

### Inferences
- Judgement: with day-30 retention around 3% to 8%, anything that reduces forgetting is worth testing, but the cheapest proven levers in the literature are the act of recording and kind, positive framing, not data plumbing.
- Judgement: device makers whose data is fully automatic (Fitbit, wearables generally) still lose many users (Epstein 2015: 44% of activity trackers abandoned within three months), so automation alone does not solve retention.

### Gaps
- Strava, Habitify, Streaks, Duolingo and Garmin disclosures on integrations and retention: searched, none found.

## 5. Evidence specific to ADHD and anxiety

### Takeaway
Direct evidence is very thin. No study compares automatic and manual tracking for ADHD or anxiety. The nearest evidence: a small 2026 qualitative preprint finds self-tracking places heavy emotional and interpretive demands on autistic and ADHD people, and an RCT in adults with ADHD found SMS reminders did not improve overall completion.

### Cited Findings
- **"Chasing Shadows: Understanding Personal Data Externalization and Self-Tracking for Neurodivergent Individuals" (arXiv preprint 2603.22609, March 2026), Qual, not peer-reviewed. [checked]** Six autistic and/or ADHD participants in a workshop; three went on to design and use personalised self-tracking for one to two weeks. Self-tracking imposed "substantial interpretive and emotional demands"; the authors describe emotional weight, self-reflection and burden, suggest peer support may ease them, and argue reflection can be valuable without behaviour change. Does not compare manual and automated tracking. — [arXiv](https://arxiv.org/abs/2603.22609); [HTML](https://arxiv.org/html/2603.22609v2)
- **Nordby et al., "The Effect of SMS Reminders on Adherence in a Self-Guided Internet-Delivered Intervention for Adults With ADHD" (Frontiers in Digital Health, 2022), RCT within a trial, n = 109. [checked]** Reminders sped up logins in some modules and increased time spent, but had no overall effect on module completion, number of logins or coping practice. — [Frontiers](https://www.frontiersin.org/articles/10.3389/fdgth.2022.821031/text); [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9149073/)
- SmarTasko, a research prototype for short daily tasks for adults with ADHD. [not re-checked] — [CETYS repository](https://repositorio.cetys.mx/items/e9463b23-615d-4c6e-b68e-cd54fb37716e/full)

### Inferences
- Judgement, not evidence: two pulls in opposite directions. A suggested tick from a connected app could help people who forget to log (forgetting is the top lapse type in Epstein 2015, and plausibly more common with ADHD). But connecting apps adds setup steps, permission screens, sync failures and more numbers, which the neurodivergent preprint suggests already weigh heavily. An optional, off-by-default connection that only suggests ticks, and never shows "no data" as failure, fits both. The Nordby result also cautions that nudges alone do not create meaningful engagement for adults with ADHD.

### Gaps
- No RCT or observational study found on automatic versus manual logging for ADHD or anxiety users.
- No anxiety-specific self-tracking burden evidence found in this session.
