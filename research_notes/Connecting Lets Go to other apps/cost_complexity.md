# Cost, complexity and risk of app and health integrations for Let's Go!

Researched 4 November 2026. Lines marked **[Judgement]** are my inference, not a sourced fact. Two primary sources (developer.apple.com review guidelines and developer.android.com Fit end of service page) were blocked from this session, so some Apple and Google wording comes via secondary sources, noted where it does.

## 1. Wrapping the PWA with Capacitor: effort, Guideline 4.2 risk, accounts, review times, health plugins

### Takeaway
Reading Apple Health is only possible from a native app, so a wrapper is unavoidable for that route. Capacitor keeps one web codebase, but the store fees, a Google closed-testing hurdle for new personal accounts, Apple's "not just a website" rule and a young plugin ecosystem are the real costs.

### Cited Findings
- HealthKit "requires native iOS apps"; web-only apps cannot read it because data lives on the iPhone and "There is no public server API for Apple Health app." — [Momentum: what you can and can't do with HealthKit](https://www.themomentum.ai/blog/what-you-can-and-cant-do-with-apple-healthkit-data)
- HealthKit "is not a live stream": new data arrives when the user opens the app or when Health triggers background updates, "but not continuously". Every data type needs separate explicit user consent. — [Momentum](https://www.themomentum.ai/blog/what-you-can-and-cant-do-with-apple-healthkit-data)
- Apple Guideline 4.2 (as quoted by MobiLoud): an app "should include features, content, and UI that elevate it beyond a repackaged website"; apps that are not "particularly useful, unique, or 'app-like'" do not belong. 4.2.2 bars apps that are mainly marketing, web clippings or link collections. Approval helpers: native navigation (tab bar), phone-designed screens, device features (push, share sheet etc.), offline and error screens, a working demo login and review notes. Push alone "won't carry an app that otherwise looks like a website". No rejection rate is published. — [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- Google Play is more lenient on wrappers: its webview spam policy only targets showing a site you do not own; its functionality policy excludes apps with "only limited functionality and content" or that crash. — [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- Fees: Apple Developer Program $99 a year (recurring; lapsing can remove the app); Google Play one-time $25. — [iLab: publishing in 2026](https://ilab.md/en/articles/publishing-on-the-app-store-and-google-play-in-2026-timelines-costs-and-7-hidden-requirements-that-could-derail-your-launch)
- Review times: Apple officially about 90% within 24 hours, new apps typically 2 to 5 days, updates 24 to 48 hours, with 2026 reports of 7 to 30+ days delays. Google Play: established accounts 1 to 3 days, new accounts 7 to 14 days. — [iLab](https://ilab.md/en/articles/publishing-on-the-app-store-and-google-play-in-2026-timelines-costs-and-7-hidden-requirements-that-could-derail-your-launch)
- Google Play personal accounts created after 13 Nov 2023 must run a closed test with at least 12 opted-in testers for 14 consecutive days before production. Organisation accounts are exempt but need D-U-N-S and business verification (typically 2 to 4 weeks; Apple organisation enrolment 1 to 4 weeks). — [iLab](https://ilab.md/en/articles/publishing-on-the-app-store-and-google-play-in-2026-timelines-costs-and-7-hidden-requirements-that-could-derail-your-launch)
- Apple's most common rejection reason is privacy policy issues under 5.1.1; privacy labels must match actual data collection. Paid apps need the Paid Applications Agreement and tax forms; Google needs a Payments profile. — [iLab](https://ilab.md/en/articles/publishing-on-the-app-store-and-google-play-in-2026-timelines-costs-and-7-hidden-requirements-that-could-derail-your-launch)
- Capacitor's own docs now list one health plugin, `@capacitor/health-fitness`, for Health Connect and HealthKit, not available on web. Licence and price not stated on that page. — [Capacitor docs: Health and Fitness](https://capacitorjs.com/docs/apis/health-fitness)
- Capawesome Health plugin: HealthKit plus Health Connect, about 20 data types (steps, sleep, workouts, heart rate, weight, hydration and more), commercial "Capawesome Insiders" only with a Polar licence key, version 0.x, needs Capacitor 8+, Android minSdk 26. On Android, history reads are limited to 30 days before permission was first granted. Background reading not documented. — [Capawesome Health docs](https://capawesome.io/docs/sdks/capacitor/health/); [announcement](https://capawesome.io/blog/announcing-the-capacitor-health-plugin/)
- Capgo `capacitor-health`: open source (MPL-2.0), 14 GitHub stars, last pushed 8 March 2026, v8 line matches Capacitor 8, iOS 14+ and Android 8+. — [ecosyste.ms record for cap-go/capacitor-health](https://awesome.ecosyste.ms/api/v1/projects/github.com%2Fcap-go%2Fcapacitor-health)

### Inferences
- **[Judgement]** Let's Go! already has push, offline, a phone-first UI and per-person plans, so it is well placed to pass 4.2, especially once HealthKit is in it. The bigger risk is review delay and the 5.1.1 privacy checks, not 4.2 itself.
- **[Judgement]** Plugin maturity is thin: one commercial 0.x plugin, one small open-source repo, and a newly listed official one. Expect to pin versions and retest every Capacitor or OS major release (yearly at least).
- **[Judgement]** Effort with AI help: a basic Capacitor shell for both stores is days, not weeks; health read plus store approvals realistically adds 2 to 6 weeks of elapsed time, mostly waiting (closed test 14 days, declarations, reviews). As a sole trader, Stu would use personal accounts, so the 12-tester closed test applies; TLR members could be those testers.
- **[Judgement]** Background syncing (auto-ticking a habit without opening the app) is the hardest part and is not reliably supported on iOS.

### Gaps
- Exact text of Apple 4.2 from Apple itself (developer.apple.com blocked here); any published rejection rate for wrapped apps.
- Price of Capawesome Insiders; licence and maturity of `@capacitor/health-fitness`.
- Apple Small Business Program commission (believed 15% but not verified in this session) and UK price of the Apple fee.

## 2. Apple HealthKit and Google Health Connect review rules

### Takeaway
Both platforms allow health reading for a habit app, but both demand minimum data, a matching privacy policy and no advertising or data-mining use. Google adds a mandatory Health apps declaration per data type, reviewed per package name.

### Cited Findings
- Apple Guideline 5.1.3(i): "Apps may not use or disclose to third parties data gathered in the health, fitness, and medical research context... for advertising, marketing, or other use-based data mining purposes other than improving health management... or for the purpose of health research, and then only with permission." Captured from Apple's guidelines dated 16 Oct 2026. — [ConductAtlas capture of Apple guidelines](https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/health-data-use-and-sharing-restrictions/)
- Apple has long barred storing personal health information in iCloud for HealthKit apps (5.1.3(ii)); a 2026 developer forum thread asks what counts as personal health information for CloudKit. — [MobiHealthNews](https://www.mobihealthnews.com/news/apple-bans-icloud-and-7-other-rules-healthkit-developers); [Apple Developer Forums thread 844159](https://developer.apple.com/forums/thread/844159)
- Google Play publishing for Health Connect: complete the Data Safety section and the Health apps declaration form (App content page); for each data type give a detailed explanation of user benefit; request only data types that support user-facing features; the privacy policy on the Play listing must be the same one shown in Health Connect. — [Android Developers: publish your health app](https://developer.android.com/health-and-fitness/health-connect/publish)
- Access is allow-listed per package name; new versions do not need a new request but "may trigger a re-review". If the app is public without approved data types, users see an error when linking Health Connect. — [Android Developers](https://developer.android.com/health-and-fitness/health-connect/publish)
- Google's Play Console help page for the declaration form. — [Play Console Help: Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291)

### Inferences
- **[Judgement]** For Let's Go!, asking only for steps, exercise sessions and sleep, with a plain-English reason each ("ticks your walking habit for you"), is the lowest-risk declaration. Asking for heart rate or reproductive data would invite scrutiny with no habit benefit.
- **[Judgement]** Sending health data to the AI coach (Anthropic) could be read as disclosure to a third party under 5.1.3(i). It is arguably "improving health management", but the safer design keeps raw health data out of AI calls.

### Gaps
- Exact text of 5.1.3(ii) to (iv) from Apple (blocked).
- Published Health Connect declaration review times and common rejection reasons: I found no reliable source.

## 3. Maintenance burden: how often integrations break

### Takeaway
Direct wearable integrations have broken repeatedly in 2024 to 2026: Strava restricted use, Google Fit APIs end in 2026, Fitbit's Web API shuts in September 2026, Garmin froze new access, Oura gates data behind a paid membership. A solo developer should expect at least one forced rework a year per direct integration.

### Cited Findings
- Strava API agreement change effective 11 Nov 2024: third-party apps may only show a user's data to that user, may not use API data in AI models, and partners got about 30 days' notice (DC Rainmaker). Intervals.icu had to hide data from coaches. Strava said under 0.1% of apps affected. — [road.cc](https://road.cc/content/news/strava-users-cant-publicly-share-data-third-party-apps-311329); [DC Rainmaker](https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html/comment-page-3)
- Google Fit APIs "will be supported until the end of 2026", with migration to Health Connect. — [Android Developers](https://developer.android.com/health-and-fitness/health-connect/publish); [Android Central](https://androidcentral.com/apps-software/google-has-set-a-deadline-to-shut-down-the-google-fit-api)
- Fitbit legacy Web API shuts in September 2026; move to the Google Health API; existing OAuth tokens do not transfer, so every user must re-authorise; dedup of overlapping sources needed; estimated "a few weeks" for an experienced team. — [Momentum: Fitbit Web API deprecation](https://www.themomentum.ai/blog/fitbit-web-api-deprecation-google-health-migration); [Fitbit community announcement](https://community.fitbit.com/t5/Web-API-Development/Introducing-the-next-phase-of-the-Fitbit-Web-API/m-p/5830905)
- Garmin Connect Developer Program stopped processing new applications in spring 2026, form removed, no reopening date; one applicant waited from 2 March to at least 11 September 2026; Hevy was refused full access. Existing partners unaffected. — [the5krunner](https://the5krunner.com/2026/09/14/garmin-developer-api-access-paused/); [Terra blog](https://tryterra.co/blog/garmin-connect-developer-program-pause)
- Oura: "Gen3 and later users without active Oura Membership can't access their data through the Oura API", and partner apps lose access to those users. — [Oura support](https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API)

### Inferences
- **[Judgement]** Apple Health and Health Connect act as on-phone hubs that Garmin, Fitbit, Oura, Samsung and others already write into, so reading only those two avoids every one of the breakages above. That is the strongest maintenance argument in this research.
- **[Judgement]** Each break above carried a short deadline; Stu would need to notice and react within weeks, which conflicts with leaving work running unattended.

### Gaps
- Indie first-hand accounts (Exist.io, Gyroscope, Streaks, Hacker News threads) of maintenance load: my searches did not surface reliable primary posts in the time available.

## 4. Aggregator services: pricing for small apps

### Takeaway
Aggregators remove per-brand maintenance but start at roughly $300 to $500 a month, which at £7.99 per user needs roughly 40 to 60 paying users just to cover that line. Most still need a native app for Apple Health.

### Cited Findings
- Terra (own docs): 100,000 credits a month included; each active user costs 200 credits a month (about $1 per user at $0.005 a credit beyond the allowance); add-ons from $99 a month. — [Terra pricing docs](https://docs.tryterra.co/health-and-fitness-api/pricing)
- Junction (formerly Vital), own page: Launch $300 a month for 1 to 500 connected users; free sandbox. — [Junction pricing](https://www.junction.com/pricing)
- Vendor comparison (published by Sahha, so biased): Sahha Starter $299 a month annual (1,000 users, 30-day trial); Terra Quick Start $399 a month annual (about 500 users); ROOK Core $399 a month (750 users); Thryve from EUR 499 a month (500 users); Spike from $450 a month; Open Wearables free, self-hosted (MIT), cost shifts to engineering time. — [Sahha: Terra alternatives](https://sahha.ai/compare/terra-alternatives/)

### Inferences
- **[Judgement]** For a launch with tens of users, an aggregator is poor value. It only pays off if Let's Go! wants Garmin, Oura or Whoop cloud data directly, and those mostly already flow into Apple Health or Health Connect.
- **[Judgement]** Aggregators do reduce maintenance (they absorbed the Fitbit and Fit changes), but sending data via them adds a processor to the GDPR picture.

### Gaps
- Terra's monthly plan fee is stated by Sahha ($399), not on Terra's own page as fetched; verify with Terra.

## 5. UK GDPR: health data as special category data

### Takeaway
Steps, sleep or workout data linked to a person is health data, so it is special category data. The practical lawful route for Let's Go! is explicit consent, separate from other consents. Keeping raw data on the phone and storing only a yes/no tick sharply reduces the burden.

### Cited Findings
- Article 9(2)(a) condition: "the data subject has given explicit consent". Explicit consent "must be confirmed in a clear statement", must "specify the nature of the special category data" and "should be separate from any other consents"; it must be freely given (gym facial recognition example: not free if it is the only way in). — [ICO: conditions for processing special category data](https://cy.ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)
- Condition (h) health or social care needs processing under a professional bound by secrecy, so it does not fit a coaching habit app. — [ICO](https://cy.ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-conditions-for-processing/)
- ICO special category guidance overview (secondary commentary). — [Inside Privacy](https://www.insideprivacy.com/eu-data-protection/uk-ico-publishes-new-guidance-on-special-category-data/)

### Inferences
- **[Judgement]** If the phone reads Apple Health, decides "walked 20 minutes, yes", and only sends "showed up today" to Supabase (as now), the server arguably holds no new health data beyond what the habit itself implies. That avoids storing synced health records in Supabase and keeps the existing data model.
- **[Judgement]** Storing raw step or sleep records in Supabase would mean a DPIA, an explicit-consent screen, updated privacy policy and data safety labels, deletion paths, and processor terms with Supabase. eu-west-2 London hosting helps with UK transfer rules but does not remove these.
- **[Judgement]** Habit content itself (for example "drink less", "take my medication") may already be health data, so a DPIA is sensible regardless of integrations.

### Gaps
- ICO DPIA guidance page (when a DPIA is mandatory for special category data at scale) was not fetched; it is generally understood that ICO lists large-scale special category processing as likely high risk, but I did not verify that wording in this session.

## 6. Zapier, IFTTT, Shortcuts and webhook route

### Takeaway
A webhook endpoint (a Supabase Edge Function that accepts "I showed up" from outside) is cheap to build and works without app stores, but it pushes cost and setup onto the user and is less reliable than a native read.

### Cited Findings
- Zapier free plan: 100 tasks a month, two-step Zaps only, 15-minute polling, and "Webhooks by Zapier" is a premium app (not on Free). Pro is $19.99 a month annual or $29.99 monthly (750 tasks, webhooks, 2-minute polling). — [DEV: Zapier free plan in 2026](https://dev.to/trackstack/zapier-free-plan-in-2026-what-100-tasks-actually-buy-you-3h8k)
- Apple users report "Get contents of URL" not behaving as expected inside Shortcuts personal automations. — [Apple Community thread](https://discussions-jp-prz.apple.com/thread/256003716)
- Developers do use Shortcuts to export Apple Health data to their own servers (example write-up). — [jngiam: syncing Apple Health data](https://jngiam.bearblog.dev/syncing-apple-health-data-to-claude-code/)

### Inferences
- **[Judgement]** Build effort for a personal webhook link per user: about a day with AI help (a token per user, one Edge Function, a settings screen with the link). Running cost close to zero on Supabase.
- **[Judgement]** User cost: Zapier webhooks need Pro ($19.99+ a month), more than Let's Go! itself, so Zapier suits only power users. iOS Shortcuts is free but iPhone-only (Stu himself is on Android), and setup is fiddly for the ADHD and anxiety audience the Focus view serves.
- **[Judgement]** Reliability: polling delays, user-side breakage and silent failures mean this route should never decide whether a day counts; it could pre-fill a suggestion the person confirms.

### Gaps
- IFTTT 2026 pricing and webhook limits were not checked.
- Hard data on Shortcuts automation reliability; only anecdotal reports found.
