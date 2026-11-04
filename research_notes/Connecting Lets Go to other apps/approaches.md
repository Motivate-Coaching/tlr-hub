# Connecting Let's Go! to other apps: integration approaches

Research date: 4 November 2026. Every finding below has a source. Anything marked "Judgement" is my reasoning from those sources, not a stated fact. Search snippets were sparse on several pages, so the Gaps sections are honest about what I could not confirm.

## How do the leading habit and self-tracking apps connect to other apps?

### Takeaway
The leaders lean on two things: the phone's health hub (Apple Health on iPhone, Health Connect on Android) for anything body-related, and a short list of direct API connections (Strava, Fitbit, RescueTime, Todoist, GitHub, Last.fm, calendar) for everything else. Only a few (Habitify, Exist) offer a public API or IFTTT so users can wire up the long tail themselves. Several popular "gentle" apps (Finch) connect to nothing at all.

### Cited Findings
**Streaks (iOS only)**
- Completes habits automatically from "more than 80 types of Apple Health data", including steps, workouts, sleep, water, mindful minutes and calories; water, mindful minutes and toothbrushing logged in Streaks are written back to Health. [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)
- Has Siri and Shortcuts support (actions include Record Note and Get Note; v11.4 added creating and completing tasks with Siri), Screen Time habits that track time in apps, widgets, Apple Watch and Live Activities. No calendar or third-party service integrations are listed. [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)
- A worked guide to driving Streaks from Shortcuts automations. [The Sweet Setup](https://thesweetsetup.com/automating-habit-tracking-streaks-shortcuts/)

**Habitify (iOS, Android, web)**
- March 2026 release names integrations with Apple Health, Strava, Fitbit and RescueTime, and launched API V2 with on-demand API keys replacing legacy permanent keys. [Habitify changelog, 10 Mar 2026](https://feedback.habitify.me/changelog/habitify-ios-340-api-v2-higher-goals-and-better-sync)
- Has an official IFTTT integration (example: a Strava run or ride automatically updates the matching habit). [IFTTT: best habit tracker apps](https://ifttt.com/explore/best-habit-tracker-apps); [Habitify IFTTT guide](https://intercom.help/habitify-app/en/articles/6113785-the-basic-guide-for-habitify-integration-via-ifttt)

**Exist.io (iOS, Android, web)**
- Lists 17 sources: Health Connect (Android), Apple Health (iPhone), Calendar, Foreground, Garmin, GitHub, Instapaper, Last.fm, Mastodon, Oura, RescueTime, Strava, Swarm, Todoist, Toggl, Trakt, Withings. Also custom tracking, manual tracking and a developer API. Fitbit, Google Fit, Zapier and IFTTT are not listed. [Exist: what data can you bring](https://exist.io/apps-data-syncing/)
- Todoist integration counts tasks completed and finds correlations. [Exist blog: Todoist](https://exist.io/blog/todoist/)

**Bearable (iOS, Android)**
- Direct integration with Fitbit only (resting heart rate, HRV, sleep, steps, weight). Everything else arrives indirectly through Apple Health, Google Fit or Health Connect: Samsung Health steps, Garmin steps and activity, Oura. [Bearable: sync with other devices](https://bearable.app/support/howto/sync-with-other-devices/)
- Bearable notes Garmin did not sync to Health Connect as of January 2025 (support expected from June 2025) and suggests the third-party HealthSync app as a bridge. [Bearable: sync with other devices](https://bearable.app/support/howto/sync-with-other-devices/)

**Gyroscope**
- RescueTime has an official connector to Gyroscope. [RescueTime: Gyroscope integration](https://www.rescuetime.com/integrations/gyroscope)
- Gyroscope's integrations FAQ now redirects to its homepage, so I could not get the current list. [Gyroscope FAQ (redirects)](https://about.gyrosco.pe/faqs/which-devices-and-apps-do-you-recommend-and-what-does-each-track)

**Daylio**
- Syncs with Apple Health to pull in steps, sleep and exercise time for mood correlation. [Daylio on X, 2025](https://x.com/hellodaylio/status/1939796586399141963)

**Finch**
- App Store listing describes no integrations with Apple Health, Shortcuts or other apps. [App Store: Finch](https://apps.apple.com/us/app/finch-self-care-pet/id1528595748)

**Welltory (for comparison)**
- Uses IFTTT to bring in completed Todoist tasks, Apple Reminders, YouTube and Spotify. [IFTTT: best habit tracker apps](https://ifttt.com/explore/best-habit-tracker-apps)

### Inferences
- Judgement: the pattern across the field is "health hub plus a handful of direct APIs plus an escape hatch (API, IFTTT or Shortcuts)". Exist is the broadest at about 17 sources, and it reached that over a decade of app-by-app builds, which is exactly what Stu wants to avoid.
- Judgement: Streaks shows how far a health hub alone goes (80+ data types) with zero per-app work, but it needed a native iOS app to do it.

### Gaps
- Could not confirm current integrations for Loop Habit Tracker, Way of Life, Atoms (James Clear) or Fabulous: their help pages were not reachable from this session. From prior knowledge (unverified): Loop is open source Android with a Tasker/Locale plugin and no health sync; Atoms and Way of Life are largely manual. Treat as unconfirmed.
- Gyroscope's current integration list is unconfirmed.
- Whether Habitify supports Health Connect / Google Fit on Android, Zapier or Make is not stated in the sources found.

## Health hubs: what Apple HealthKit and Health Connect cover, who writes to them, and whether a web app can read them

### Takeaway
The hubs cover almost every body and wellbeing habit (steps, workouts, sleep, mindful minutes, water, nutrition), and big apps like Headspace, Calm and Samsung Health write to them, so one hub connection replaces dozens of app integrations. But neither hub can be read by a website or PWA: both need an installed native app (Capacitor wrapper is enough), and on Android also a Play Console health declaration.

### Cited Findings
**Coverage and writers**
- Samsung Health syncs both ways with Health Connect: steps, exercise sessions (with calories, distance, heart rate, power, speed, VO2max), heart rate, sleep sessions and stages, nutrition, weight and body composition, blood glucose, oxygen and pressure. Supported since Samsung Health 6.22.5 (October 2022). Samsung's own "activity tracker" data does not sync. [Samsung Developer blog](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect)
- Health Connect has guides for tracking steps, mindfulness, sleep sessions and workouts. [Android: Google Fit migration FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)
- Calm writes completed guided sessions (meditations, Sleep Stories) to Apple Health as Mindful Minutes; Background Scenes are not recorded. [Calm help](https://support.calm.com/hc/en-us/articles/115005140814-Apple-Health)
- Headspace writes meditation time to Apple Health as Mindful Minutes. [Headspace help](https://help.headspace.com/hc/en-us/articles/115003793088-How-do-I-connect-Headspace-to-the-iOS-Health-App)
- Streaks reads 80+ Apple Health types including steps, workouts, sleep, water, mindful minutes. [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)
- Daylio reads steps, sleep and exercise time from Apple Health. [Daylio on X](https://x.com/hellodaylio/status/1939796586399141963)
- Garmin, Oura and Samsung Health reach habit apps via Apple Health / Health Connect / Google Fit routes; Garmin's Health Connect support lagged (not available January 2025). [Bearable](https://bearable.app/support/howto/sync-with-other-devices/)

**Web access**
- "There's no web API. HealthKit only works inside an iOS app." The workaround is an Apple Shortcut that reads Health samples and POSTs them to a server; it fails while the phone is locked (Health data is encrypted), so the author recommends an "App is opened" trigger. [DEV Community pipeline](https://dev.to/rudratosh/apple-wont-give-you-an-api-for-your-health-data-a-free-shortcut-will-heres-the-whole-pipeline-1j9k)
- Health Connect stores data on the device; it is read by an installed Android app with user-revocable permission, and a backend only gets the data if that app relays it. [Sahha: Google Fit sunset](https://sahha.ai/blog/google-fit-api-sunset-migration/); [Android FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)
- Google Fit APIs (including the REST API) are deprecated, supported until end of 2026, closed to new sign-ups since 1 May 2024. Google points cloud users to the Google Health API, which is account-based and cloud-reachable. [Android FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)
- The Google Health API needs OAuth and a Restricted-scope review; its documented sources are Fitbit devices, Pixel watches and manual entries. The Fitbit Web API moves to it and shuts down on 2 November 2026. [Sahha: Google Fit sunset](https://sahha.ai/blog/google-fit-api-sunset-migration/)

**What a wrapped app needs**
- Capacitor plugin `@capgo/capacitor-health` reads HealthKit and Health Connect. iOS: HealthKit capability plus `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription`. Android: minSdk 26, Health Connect permissions, a privacy policy shown on the permission sheet, the Play Console Health apps declaration and permission justification, Data safety form; extra permissions are the most common rejection reason and review is longer. On iOS, read denials are hidden, so empty results can mean "no data" or "no access". [Capgo](https://capgo.app/blog/google-fit-to-health-connect-migration-in-capacitor/)

### Inferences
- Judgement: for Let's Go!, the health hubs are the single biggest win once wrapped: running (Strava, Garmin, Samsung), sleep, steps, meditation (Headspace, Calm) all arrive through two connections. Without wrapping, Stu gets none of it except via a user-built Shortcut on iPhone.
- Judgement: do not build on Google Fit or the Fitbit Web API; both are ending in 2026.
- Judgement: hubs do not cover learning, reading, writing or productivity habits. Duolingo, Kindle and Todoist are not health-hub writers as far as I found.

### Gaps
- Android developer data-types page was blocked, so I could not list every Health Connect type (for example confirm hydration, nutrition and mindfulness session record names directly). Apple's HealthKit type list was not fetched either.
- Could not confirm whether Headspace or Calm write to Health Connect on Android (their help pages only cover Apple Health).
- Could not confirm whether Duolingo writes anything to Apple Health or Health Connect. I found no source saying it does.
- Whether Garmin now writes to Health Connect (expected from June 2025) is unconfirmed.

## Non-health apps: public APIs and automation triggers for "did I do it today?"

### Takeaway
Productivity tools (Todoist, calendars, GitHub, RescueTime) have usable APIs and Zapier triggers. Consumer learning and reading apps mostly do not: Goodreads closed its API to new developers in 2020, and Duolingo only has unofficial, unsupported scraping libraries. For those, the realistic routes are calendar, Shortcuts "app opened" triggers, or a one-tap check-in.

### Cited Findings
- Todoist: Zapier trigger "New Completed Task" fires on completed tasks including recurring ones, polling every 15 minutes on the free plan; it can be paired with "Webhooks by Zapier" Custom Request to POST anywhere. Webhooks by Zapier sits in Zapier's Premium category. [Zapier: Todoist to Webhooks](https://zapier.com/apps/todoist/integrations/webhook/1364399/send-custom-webhooks-from-webhooks-by-zapier-for-new-completed-tasks-in-todoist)
- Todoist, RescueTime, GitHub, Last.fm, Calendar, Toggl, Instapaper all have connectors in Exist, which shows each has a usable API. [Exist](https://exist.io/apps-data-syncing/)
- Goodreads stopped issuing new API keys on 8 December 2020 and said it plans to retire its API tools. [Slashdot](https://developers.slashdot.org/story/20/12/17/1522242/goodreads-is-retiring-its-current-api-and-book-loving-developers-arent-happy); [Goodreads developer discussion](https://www.goodreads.com/topic/show/21788520-api-deprecation)
- Duolingo: only unofficial libraries exist (for example the `duolingo-api` Python package, described as an "Unofficial API for duolingo.com"). [PyPI: duolingo-api](https://pypi.org/project/duolingo-api/0.5.2/)
- Strava: webhook events fire when an athlete uploads or manually creates an activity; access to webhooks is limited to approved applications. [Strava webhook events](https://strava.github.io/api/v3/events) (note: this is the older docs site; current docs may differ)
- Garmin has a Connect Developer Program (Activity API) for approved business partners. [Garmin Developers](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/)

### Inferences
- Judgement: "did I do it today" for Duolingo, Kindle, Speechify, Scrivener or Ulysses is best answered by an iPhone Shortcuts "App opened/closed" automation (see next section) or by asking the person, not by an API.
- Judgement: calendars are the universal fallback. Many habits (gym class, writing block, lesson) already live there, and Google Calendar and Apple Calendar can be read via standard APIs or a calendar subscription. Not verified in this pass.

### Gaps
- Could not confirm the current state of APIs or Zapier/IFTTT triggers for Kindle, Speechify, Scrivener, Ulysses, Google Docs, Notion, Headspace, Calm, Google Calendar or Apple Calendar in this session (pages not reached). Prior knowledge (unverified): Kindle and Speechify have no public consumer APIs; Notion and Google Calendar have official APIs and Zapier triggers; Google Docs revision data is reachable via the Drive API.
- Oura API v2 webhook details were not confirmed.

## Generic routes: webhooks, Shortcuts, Tasker, URL schemes, calendar

### Takeaway
One inbound webhook endpoint on Let's Go!'s Supabase backend, plus an iPhone Shortcut, gives the widest reach for the least build: Zapier, IFTTT, Make, Apple Shortcuts and Android Tasker can all POST to it, so any app those tools know about can tick a habit. On iPhone, the "App opened/closed" automation now runs without asking, which covers apps with no API at all (Duolingo, Kindle, Speechify).

### Cited Findings
- iOS personal automations that can run without asking include Time of Day, Sleep, Arrive/Leave, Wi-Fi, Bluetooth, Apple Watch Workout, NFC, and App (opened or closed). Only "Before I Commute" always asks. [Apple Support: Shortcuts automations](https://support.apple.com/en-gb/guide/shortcuts/apd602971e63/ios)
- A Shortcut can read Apple Health samples and POST them as JSON with "Get Contents of URL" to a server; best triggered on "App is opened" because Health data is locked while the phone is locked. [DEV Community](https://dev.to/rudratosh/apple-wont-give-you-an-api-for-your-health-data-a-free-shortcut-will-heres-the-whole-pipeline-1j9k)
- Zapier's Webhooks Custom Request can send any trigger (example: Todoist completed task) to a URL; it is a Premium feature. [Zapier](https://zapier.com/apps/todoist/integrations/webhook/1364399/send-custom-webhooks-from-webhooks-by-zapier-for-new-completed-tasks-in-todoist)
- IFTTT already links Strava to Habitify, and Todoist/Reminders/Spotify to Welltory, showing the pattern works for habit apps. [IFTTT](https://ifttt.com/explore/best-habit-tracker-apps)
- Streaks uses Shortcuts and NFC triggers; one reviewer reported an NFC shortcut failed unless Streaks was open (single report). [App Store: Streaks](https://apps.apple.com/us/app/streaks/id963034692)

### Inferences
- Judgement, ranked by reach per unit of build effort:
  1. **Personal webhook URL + ready-made Shortcut** (small build: a Supabase Edge Function taking a per-user secret token). Works today as a PWA. Covers any iPhone app via "App opened/closed", Apple Health via Shortcut, and anything Zapier/IFTTT/Make/Tasker can see.
  2. **Calendar check** (medium build): read the person's Google or Apple calendar for the habit's event. Covers scheduled habits across every app.
  3. **Health hubs via Capacitor wrapper** (bigger build and store review): covers all body and wellbeing habits automatically.
  4. **Direct APIs** (Strava, Todoist etc.): only where demand proves it.
- Judgement: an official Zapier or IFTTT app listing for Let's Go! (with a "Log a show-up" action) would make the webhook route non-technical for members, but costs build and review time.
- Judgement: Android has no built-in equivalent to Shortcuts app triggers; Tasker (paid) can do it but is a power-user tool.

### Gaps
- Zapier, IFTTT and Make current plan prices and which tiers include webhooks were not confirmed.
- Tasker's current capabilities and Android 14+ restrictions were not checked.
- Whether a PWA can register as a Shortcuts action (it cannot have App Intents; only native apps can, prior knowledge, unverified) and iOS widget support for PWAs were not confirmed.

## Aggregator APIs: coverage, pricing and native-app needs

### Takeaway
Aggregators (Terra, ROOK, Junction/Vital, Sahha, Thryve, Spike, Open Wearables) save per-device work for wearables, but start around $300 to $500 a month, cover only health and fitness, and still need a native app SDK for Apple Health, Health Connect and Samsung Health. Only cloud wearables (Garmin, Oura, WHOOP, and similar) connect without an app. Judgement: poor fit for Let's Go! at this stage.

### Cited Findings
All figures below come from a comparison page written by Sahha (a competitor), verified by them in July 2026; check vendor pages before deciding. [Sahha: Terra alternatives](https://sahha.ai/compare/terra-alternatives/)
- Terra: from $399/month billed annually (Quick Start, 100k credits); reads Apple Health and Health Connect through its Mobile SDK.
- ROOK: Core $399/month for 750 active users, add-ons $99 to $249/month; device-level SDKs for Apple Health, Health Connect, Samsung Health.
- Junction (formerly Vital): pricing not published; an undated Vital page listed $0.50/user/month with a $300 minimum.
- Sahha: 30-day trial; Starter $299/month billed annually for 1,000 users; only 4 providers (including Garmin, Oura, WHOOP) connect cloud-to-cloud, everything else via in-app SDK.
- Thryve: trial for 25 users; from EUR 499/month for 500 users.
- Open Wearables: free (MIT licence); Apple Health SDK "coming soon" as of July 2026.
- Spike: from $450/month; mobile SDK plus about 23 cloud OAuth providers.
- Terra's own pricing page exists but was not fetched. [Terra pricing](https://tryterra.co/community/pricing)

### Inferences
- Judgement: because every aggregator still needs a native SDK for the phone hubs, wrapping the app with Capacitor and reading HealthKit / Health Connect directly gives most of the same coverage for free. Aggregators only add cloud wearables that do not write to the hubs, and those mostly do.
- Judgement: none of them help with Duolingo, Kindle, writing or Todoist habits.

### Gaps
- Pricing not confirmed directly from Terra, ROOK, Junction or Thryve pages.
- Whether Junction and Thryve need a mobile SDK for phone hubs was not stated in the source (very likely yes, by the same on-device logic, but unconfirmed).
