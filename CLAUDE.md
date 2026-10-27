# TLR Hub: project guide for Claude

Read this before doing anything in this repo.

## What this is

The Living Room (TLR) is Stuart Fairbairns's paid monthly group coaching membership (Motivate Coaching). Each month has a theme, with weekly tools and twice-weekly group sessions. Framework language: drift, autopilot, mental noise, replay, coping, unmade decisions. Voice: warm, direct, grounded, "Do It Your Way" and "Hold It Lightly". Never generic self-help tone.

The TLR Hub is the private members' space: sign in, complete worksheets, save named versions, restore past versions, print or share, and track progress across themes.

Stuart is coach and product owner. Claude builds. Stuart is not a developer: explain everything in plain language and handle git yourself.

- Live site: https://motivate-coaching.github.io/tlr-hub/
- Repo: https://github.com/Motivate-Coaching/tlr-hub
- Supabase project ref: tsusrzkpzevpiuvsppls (eu-west-2 London, chosen for GDPR)

## Stack

Plain HTML, CSS and vanilla JS on GitHub Pages. No framework, no build step, no npm. Supabase JS v2 from the jsDelivr CDN for auth and data. Google Fonts: Poppins (all UI and body text) and Playfair Display (the one headline per page), as set in tlr-design-system.html. Most older Hub pages still load Inter; that is a known inconsistency, not the standard. GitHub Pages deploys automatically from main, usually live within 1 to 2 minutes.

## How to work in this repo

1. Work on a branch and open a pull request. Merging to main makes changes live for members, so before merging anything that changes pages members use, tell Stuart what will change and get his OK.
2. Database changes go in supabase/migrations/ as a new timestamped .sql file (YYYYMMDDHHMMSS_short_name.sql). Never edit an existing migration. Cloud sessions can reach Supabase through the Supabase connector, but the database is live, so show Stuart the change in plain language and get his OK before applying any migration.
3. Never commit secrets. The Supabase anon key in auth.js is public by design and fine. Any other key (service role, Resend, Mailchimp, Stripe) must never appear in any file.
4. When auth.js or history.js change, bump the ?v= query string on every page that loads them. Pages are currently mixed (auth.js?v=20260922 on most, 20260930 on a few; history.js?v=20260930 on most, 20260922b on a few), so set every page to the new value when you next bump.
5. Back buttons always use onclick="history.back()". Never hardcode index.html.
6. Verify before saying anything is done: run it, look at screenshots, and for live changes confirm the GitHub Pages deployment for the merge commit succeeded (gh api repos/Motivate-Coaching/tlr-hub/deployments). github.io and jsdelivr are blocked from cloud sessions, so check deployments via the API, not by fetching the site.
7. GitHub GraphQL is blocked here, so `gh pr create` fails. Open and merge pull requests with the REST API (gh api repos/Motivate-Coaching/tlr-hub/pulls ...). After a push, wait for mergeable_state to be clean before merging.
8. Secrets Stuart must set himself go in Supabase, Edge Functions, Secrets. Never ask him to paste a secret into chat, and never put one in a file. If you generate one for him, give it to him privately and delete it afterwards.

## Working with Stuart

- Keep replies short. Plain English, no jargon. No em dashes anywhere, in copy or in replies.
- He wants decisions grounded in evidence that works, not assumptions, with hyperlinked sources.
- He often leaves work running, so keep pauses to the ones the rules above require.
- Write his name as Stuart Fairbairns (with the s), and Stuart Fairbairns PCC professionally. He goes by Stu.

## Shared JS

auth.js: the single authenticated _supabase client. Global functions: requireAuth(), getUser(), signOut(), saveProgress(toolId, completed, data), loadProgress(), saveSnapshot(toolKey, label, data, completed), loadSnapshots(toolKey), showUserBadge(selector), logActivity(eventType, page, metadata). loadProgress() restores whichever of Supabase or localStorage is newer. Page views and exits are logged, and on page hide all tlr-* localStorage keys are backed up to member_progress.

history.js: IIFE exposing window.TLRHistory with init(toolKey, collectFn, applyFn), promptSave(), showHistory(), clearAll(). It injects into every tool: the button row (My history, Print, Share, Clear all fields) inside .complete-wrap, the history drawer, save dialog, clear confirmation, save-first guard, share panel (WhatsApp and email), print styles and toasts. All Supabase calls go through auth.js so the signed-in client is always used.

## Standard tool pattern

Canonical reference: identity-audit.html. Every worksheet loads supabase-js, auth.js and history.js; defines a unique STORAGE_KEY (tlr-[tool-name]); has collectData() and populateData(d); has updateProgress() driving the progress bar and gating the mark-complete button; auto-saves to localStorage on input; boots inside requireAuth().then(...) with showUserBadge, TLRHistory.init(STORAGE_KEY, collectData, populateData), then loadProgress() with localStorage fallback; has markComplete() that saves with completed = true and logs tool_complete; and has a "💾 Save my progress" button calling TLRHistory.promptSave() inside .complete-wrap.

## The 30 tools

- M1 Decisions: decision-audit, clean-decisions, cost-of-unmade-decision, decision-self-trust
- M2 Autopilot: autopilot-awareness, cost-of-drift, pattern-break, living-with-intention, autopilot-advantage
- M3 What's Mine: where-your-time-goes, the-gap, whats-actually-mine, clear-response
- M4 Energy: energy-map, more-like-me-compass, energy-investment-board, aliveness-blueprint
- M5 Momentum (redesigned): momentum-ladder, compound-effect, momentum-loop, momentum-that-lasts, momentum-playbook
- M6 Difficult Conversations: getting-clear-before-you-speak, having-the-conversation, after-the-conversation, why-we-avoid-them
- M7 Identity (redesigned): identity-audit, stories-i-inherited, who-am-i-now, identity-i-choose

Show Up (show-up/): see the Show Up section below.

Other pages: index.html (resource library), dashboard.html, login.html, reset-password.html, my-wheel.html, my-journal.html, values-discovery.html (public, no login), tlr-quiz.html (Clarity Scorecard), tlr-5states.html (The 5 Ways We Get Lost), tlr-admin.html (analytics, Stuart only, enforced by RLS), tlr-design-system.html.

## Database

- member_progress: one auto-save row per user per tool, unique on (user_id, tool_id). RLS: own rows only.
- tool_snapshots: named version history. RLS: own rows only, authenticated role.
- activity_log: page views and events. RLS: own rows, plus Stuart's email can read all.
- values_responses: public Values Discovery submissions. Anyone can insert; nobody can update; only Stuart's email can read. Email is not unique, so retakes add a new row.
- Old showup_* tables in this project are from the first pilot week and are no longer used; Show Up now has its own project (see Show Up below).
Tables created with raw SQL need explicit GRANTs, including for service_role when an Edge Function reads them.

## Edge functions and schedules

- session-reminders: TLR session reminder emails (1 hour and 24 hours before), run by pg_cron every 30 minutes.
- showup-reminders: Show Up morning nudges by email (Resend, from "TLR Show Up" <stuart@motivate-coaching.com>) and web push, run by pg_cron every 15 minutes. Sends once per person per day (showup_reminder_log), only to people with a profile row, so a person must be signed in inside Show Up to get nudges.
- showup-reflect: the "What I'm hearing" reflection in Help me choose. Signed-in users only, 5 a day each (counted in app_metadata.showup_ai), Claude Haiku via forced tool output, nothing stored.
- Secret names (values live only in Supabase secrets): RESEND_API_KEY, VAPID_PRIVATE_KEY, ANTHROPIC_API_KEY. The VAPID public key in show-up/app.js and the function is public by design.

## Show Up (habit app, show-up/)

A separate product from TLR, with its own Supabase project: Show Up, ref ycxmhilwaixfwiedkkzj (eu-west-2 London, free plan, same organisation). Its migrations live in show-up/supabase/migrations and its Edge Functions in show-up/supabase/functions (showup-code: email-code sign-in, account deletion, and the server-made phone-notification key; showup-reminders; showup-reflect). Secrets in that project: RESEND_API_KEY, ANTHROPIC_API_KEY. Anyone can sign up: email, then a 6-digit code, no password. Piloted with TLR members and a few others as founding testers. Price: see Positioning below (earlier idea was $9.99 a month or $59.99 a year). Renamed "Let's Go" on 27 Oct 2026 (Stuart's decision; legal clearance with a trade mark lawyer still to do). Folder, tables and functions keep their showup names.

- Files: show-up/index.html (shell and all CSS), app.js (all logic, one IIFE), sw.js (service worker, network-first cache), manifest.webmanifest, icons/, qr.svg, logo-white.png, stuart.jpg. When app.js changes, bump app.js?v= in index.html and the CACHE name and shell entry in sw.js together.
- State lives in localStorage key showup-v1 and syncs to Supabase when signed in. Sign-in is Show Up's own (email code), not the TLR Hub account. Extra per-habit data (noticed days, what's worked, past wins, chosen focus) lives in showup_habits.extra.
- Two views of the same data: Full (everything, examples shown) and Focus (for ADHD and anxiety: one thing per screen, extras behind one tap, calm motion). Use optional(label, html), .full-only and .focus-only. Check both views for every change.
- Core flow: name (once), view choice, then Build, Break or Let's work it out (AI challenge ideas), then what, when (the "After I..." anchor, stored in extra.anchor), feel, (instead), tough-day plan, then a confetti finish, the plan (Stu's welcome note), and once, install steps with the calendar option. "When it gets hard" is asked just in time on I'm struggling, not in setup.
- Stu as the guide: stuCard() with stuart.jpg on the plan, home on days 3, 7, 14, 21 and 28 (signed-in people get a one-tap weekly check-in that lands in showup_feedback as checkin-dayN), I'm struggling and the day-30 look back. Phone nudges replace email by default when switched on.
- Daily: one "I showed up today" button (every show-up counts the same, lighter versions included) and an "I'm struggling" button (three situations, a rotating question, What's worked for me, one small step; video slots in STRUGGLE_VIDEO). Missed days stay plain and can be tapped later to count or to note what got in the way. Count show-ups and comebacks, never streaks.
- Positioning (Stuart's decisions, held for launch): a paid add-on, never free, because the price brings in committed users. Not on the TLR landing page or in the checkout; offer it straight after joining, on the welcome page and in the welcome call. Working price £5 to £9 a month for members (standalone habit apps run about $5 a month or $30 to $50 a year). No "proven" claims until the app has its own results. "Showing up" is a brand thread across TLR and the app, not a front-door hook.
- Copy rules: warm, direct, never shaming. "Tough day", not "hard day". Never "failed" or "missed".
- Tests: Playwright scripts against a local server (python3 -m http.server 8765 from the repo root), Chromium at /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell, phone viewport 390x844. Block external requests in tests; stub window.supabase when a test needs the signed-out state.

## Known issues and open work

1. Show Up parking lot: Stuart's struggling videos, email capture for the public launch (separate unticked marketing box), prescriptive challenges (for example a fitness challenge), real app name, sales page, Stripe product.
2. Design and tone pass on M1, M2, M3, M4 and M6 (21 tools) to match the redesigned M5 and M7, plus checking each tool follows the standard pattern.
3. Research what members value on Skool, Circle and similar platforms.
4. Long term: white-label platform for other coaches (workspace_id multi-tenancy with RLS, Stripe billing, coach admin view, course builder).

## Design system

tlr-design-system.html (TLR Design System v1.0) is the single source of truth for anything members see, including mockups and emails. Read it in full before designing or styling anything, and check finished work against it before showing Stuart. If this file and the design system disagree, the design system wins.

Summary (from the design system):
- Fonts: Poppins for everything functional (body, labels, inputs, buttons). Playfair Display 400 for the page or tool title only. Never introduce other fonts.
- Base palette: --navy #0F1215 (headers, topbar, primary buttons), --navy-mid #1C2B3A, --cream #F5F1EB (page background), --cream-dark #EDE8DF, --cream-deep #E5DDD1, --text-dark #1A1A1A, --text-mid #4A4A4A, --text-muted #888880, --border rgba(0,0,0,0.1). Green #3B6D11 for success states only.
- Theme accents (one per theme): Theme 1 #2B4A6F slate, Theme 2 #5C6B3A olive, Theme 3 #8C4A2F terracotta, Theme 4 #1A6B72 teal, Theme 5 #C9930A amber. Show Up uses amber #C9930A as its accent. Never introduce a colour outside this system.
- Radius: 4px buttons, 6px inputs and cards, 10px major panels. Spacing on a 4px base.
- Buttons: uppercase, 0.08em letter-spacing.
- Inputs: auto-expanding textarea rows="1", never input type="text".
- Copy: no em dashes; write "The Living Room (TLR)" in full on first use; say "theme" or "topic", never "month" or "week"; sentence case; no clichés; at most one exclamation mark per tool.

Known inconsistencies to fix over time: 38 of 49 pages still load Inter instead of Poppins; 15 pages use cream #F9F7F2 instead of #F5F1EB; the dashboard uses gold #E8A800, which is not in the design system.
