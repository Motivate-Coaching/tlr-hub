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

Plain HTML, CSS and vanilla JS on GitHub Pages. No framework, no build step, no npm. Supabase JS v2 from the jsDelivr CDN for auth and data. Google Fonts: Playfair Display (headings) and Inter (body). GitHub Pages deploys automatically from main, usually live within 1 to 2 minutes.

## How to work in this repo

1. Work on a branch and open a pull request. Merging to main makes changes live for members, so before merging anything that changes pages members use, tell Stuart what will change and get his OK.
2. Database changes go in supabase/migrations/ as a new timestamped .sql file (YYYYMMDDHHMMSS_short_name.sql). Never edit an existing migration. Cloud sessions can reach Supabase through the Supabase connector, but the database is live, so show Stuart the change in plain language and get his OK before applying any migration.
3. Never commit secrets. The Supabase anon key in auth.js is public by design and fine. Any other key (service role, Resend, Mailchimp, Stripe) must never appear in any file.
4. When auth.js or history.js change, bump the ?v= query string on every page that loads them. Current: auth.js?v=20260922, history.js?v=20260922b.
5. Back buttons always use onclick="history.back()". Never hardcode index.html.

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

Other pages: index.html (resource library), dashboard.html, login.html, reset-password.html, my-wheel.html, my-journal.html, values-discovery.html (public, no login), tlr-quiz.html (Clarity Scorecard), tlr-5states.html (The 5 Ways We Get Lost), tlr-admin.html (analytics, Stuart only, enforced by RLS), tlr-design-system.html.

## Database

- member_progress: one auto-save row per user per tool, unique on (user_id, tool_id). RLS: own rows only.
- tool_snapshots: named version history. RLS: own rows only, authenticated role.
- activity_log: page views and events. RLS: own rows, plus Stuart's email can read all.
- values_responses: public Values Discovery submissions. Anyone can insert; nobody can update; only Stuart's email can read. Email is not unique, so retakes add a new row.
Tables created with raw SQL need explicit GRANTs.

## Known issues and open work

1. Design and tone pass on M1, M2, M3, M4 and M6 (21 tools) to match the redesigned M5 and M7, plus checking each tool follows the standard pattern.
2. Research what members value on Skool, Circle and similar platforms.
3. Long term: white-label platform for other coaches (workspace_id multi-tenancy with RLS, Stripe billing, coach admin view, course builder).

## Design system

--navy #0F1215, --navy-mid #1C2B3A, --gold #E8A800, --gold-light #F5C842, --cream #F9F7F2, --cream-dark #EFE9DF, --white #FFFFFF, --text-dark #111820, --text-mid #445566, --text-muted #8899AA, --border #E2D9CE, --accent #1A6B72 (teal, history.js UI). Full reference: tlr-design-system.html.
