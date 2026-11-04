/* Let’s Go: habit tracker web app (pilot).
   Works signed out first (saved on this device), then saves to Supabase once signed in.
   Its own Supabase project (Let’s Go, London), separate from the TLR Hub; the anon key is public by design. */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://ycxmhilwaixfwiedkkzj.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeG1oaWx3YWl4ZndpZWRra3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODY1MjUsImV4cCI6MjEwODU2MjUyNX0.XRe4jBt4RYwwnAxwnSmVVGf_DtEiHn7yasgk6Rfb3tU';
  // The phone-notification key pair is made and kept by the server; the app asks for the public half when needed.
  var KEY = 'letsgo-v2-state'; // V2 keeps its own copy on the phone; on first open it starts from the V1 plan if there is one
  var ADMIN_EMAIL = 'stuart.fairbairns@gmail.com';

  var sb = null;
  try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { sb = null; }

  // ── Content ───────────────────────────────────────────────────────────────
  var FEELINGS = ['Proud', 'Strong', 'Calm', 'Alive', 'Like I trust myself', 'Free', 'Clear-headed', 'Like me again', 'Lighter', 'In control', 'Grounded', 'Brave'];
  var ANCHORS_MORE = ['make my morning coffee', 'brush my teeth', 'get home', 'have lunch', 'close my laptop', 'put the kids to bed'];
  var ANCHORS_LESS = ['in bed at night', 'after dinner', 'when I get home', 'when I’m bored at work', 'when I’m stressed', 'at the weekend'];
  // Their own words for a habit that needs them (for example the sentence they say each morning).
  function mineLine(h) { h = h || S.habit; return h && h.extra && h.extra.mine ? String(h.extra.mine).trim() : ''; }
  // Walk it through: a minute picturing the moment, doing it, what might get in the way, and how it feels to have done it.
  // Imagining the steps (not just the result) plus one specific plan is what the evidence supports. It never decides whether a day counts.
  function walks() { var x = extra(); if (!x.walks || typeof x.walks !== 'object') x.walks = {}; return x.walks; }
  function walkWhen() { return S.settings.walkWhen === 'evening' ? 'evening' : 'morning'; }
  // The day being walked through: today, or tomorrow when they walk it through the night before.
  function walkDay() { return walkWhen() === 'evening' && new Date().getHours() >= 17 ? addDays(todayStr(), 1) : todayStr(); }
  function lastPlan() { var w = walks(), ks = Object.keys(w).sort().reverse(); for (var i = 0; i < ks.length; i++) if (w[ks[i]].plan) return w[ks[i]].plan; return ''; }
  function anyCountedOn(d) { return acts().some(function (a) { return counted((a.entries || {})[d]); }); }
  function walkCard(t, focus) {
    if (!S.habit) return '';
    var w = walks(), h = '', yd = addDays(todayStr(), -1), y = w[yd];
    if (y && y.plan && y.did == null && yd >= S.habit.start) h += '<div class="card soft small walkreview"><span class="eyebrow">Yesterday you planned</span><b style="font-weight:600">' + esc(y.plan) + '</b><span>Did it happen?</span>' +
      '<div class="chips"><button class="chip" data-walkdid="yes">Yes</button><button class="chip" data-walkdid="partly">Partly</button><button class="chip" data-walkdid="no">Not this time</button></div></div>';
    if (todayStr() > lastDate()) return h;
    var d = walkDay(); if (d > lastDate()) return h;
    var tom = d > todayStr();
    if (w[d]) return h + '<p class="walked">' + checkIcon('#3B6D11') + '<span>Walked through' + (tom ? ' for tomorrow' : '') + (w[d].plan ? ': ' + esc(w[d].plan) : '') + '</span></p>';
    if (!tom && anyCountedOn(d)) return h;
    if (!acts().some(function (a) { return M.isDue(S.habit, a, d) || M.isWeekly(a, d); })) return h;
    return h + '<button class="card askhelp walkcard" data-go="walk"><span class="ahtxt"><b>Walk it through' + (tom ? ' for tomorrow' : '') + '</b><span>About a minute. See yourself doing it.</span></span><span class="chev" aria-hidden="true">›</span></button>';
  }
  // The cue for an action ("After I make my morning coffee"). For cutting back, the cue is when the urge usually comes.
  function cueLine(cue, mode) { var c = String(cue || '').trim().replace(/^(after i|usually|when)\b[\s,.:]*/i, function (m) { return /^when/i.test(m) ? 'when ' : ''; }); if (!c) return ''; return mode === 'less' ? 'Usually ' + c : (/^when /i.test(c) ? c.charAt(0).toUpperCase() + c.slice(1) : 'After I ' + c); }
  function anchorLine(x) {
    if (x && x.schedules) return cueLine(x.cue, S.habit ? S.habit.mode : 'more');
    if (!x || x === S.draft) return cueLine(S.draft.anchor, S.draft.mode);
    var m = mainAct(); return m ? cueLine(m.cue, S.habit.mode) : '';
  }
  var GIVES = ['Autopilot', 'Tired', 'Stressed', 'Bored', 'Comfort', 'A reward', 'A break', 'Not sure'];
  // For cutting back: what you're moving towards (outcomes and feelings together).
  var GAINS = ['Better sleep', 'More energy', 'Better health', 'Lighter', 'Clear-headed', 'In control', 'Proud', 'Calm', 'Money saved', 'Like me again', 'Free', 'More present'];
  var STARTERS_MORE = ['Go for a 10 minute walk', 'Read before bed', 'Be in bed by 10:30pm', 'Drink more water'];
  var STARTERS_LESS = ['Phone in bed', 'Afternoon snacking', 'Wine on weeknights', 'Mindless scrolling'];
  var IDEAS = [
    ['Go for a 10 minute walk after lunch', 'Health'], ['Be in bed by 10:30pm on work nights', 'Rest'],
    ['Keep my phone off for the first hour', 'Me time'], ['Read for 20 minutes before bed', 'Me time'],
    ['Have a cold shower each morning', 'Energy'], ['Take five minutes of stillness before the day starts', 'Calm'],
    ['Message one friend a day', 'Connection'], ['Write tomorrow’s top three tonight', 'Clarity']
  ];
  var SCIENCE = [
    ['Plan for the tough days', 'Deciding in advance what you’ll do when it gets hard (an if-then plan) had a medium-to-large effect on reaching goals, across 94 tests.', 'Gollwitzer & Sheeran (2006), Advances in Experimental Social Psychology', 'https://doi.org/10.1016/S0065-2601(06)38002-1'],
    ['Picture it, then plan for what’s in the way', 'Imagining how it will feel, then planning around the obstacles, helped people reach their goals (21 studies, 15,907 people).', 'Wang and colleagues (2021), Frontiers in Psychology', 'https://www.frontiersin.org/articles/10.3389/fpsyg.2021.565202/full'],
    ['Tick it off', 'Tracking progress helped people reach their goals (138 studies, 19,951 people), and worked better when it was written down or shared.', 'Harkin and colleagues (2016), Psychological Bulletin', 'https://doi.org/10.1037/bul0000025'],
    ['Miss a day, lose nothing', 'New habits took 66 days on average to become automatic, with a wide range (18 to 254). A single missed day made little difference.', 'Lally and colleagues (2010), European Journal of Social Psychology', 'https://doi.org/10.1002/ejsp.674'],
    ['Be kind to yourself when you slip', 'Across four experiments, people who treated their mistakes with kindness were more motivated to improve, not less.', 'Breines & Chen (2012), Personality and Social Psychology Bulletin', 'https://pubmed.ncbi.nlm.nih.gov/22645164/'],
    ['Notice how it feels today', 'Enjoying something now predicted sticking with it better than distant payoffs did, across five studies.', 'Woolley & Fishbach (2017), Personality and Social Psychology Bulletin', 'https://www.chicagobooth.edu/media-relations-and-communications/press-releases/implement-immediate-rewards-as-you-pursue-that-long-term-goal'],
    ['Focus on what you’ll gain', 'In a study of 1,066 people, goals to start or do something succeeded more often than goals to stop or avoid something.', 'Oscarsson and colleagues (2020), PLOS ONE', 'https://www.su.se/english/news/articles/2022-02-07-how-to-succeed-in-keeping-your-new-years-resolution']
  ];
  var DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ── State ─────────────────────────────────────────────────────────────────
  // V2 keeps one focus at a time (S.habit), holding one or more actions. Each action has its own schedule
  // (kept as dated versions, so a change never rewrites the past) and its own check-ins, keyed by date.
  // Past focuses live in S.archive. Nothing here is shared with V1's storage.
  var M = window.LGM; // dates, schedules and progress (model.js)
  function tzGuess() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'; } catch (e) { return 'Europe/London'; } }
  function fresh() {
    return {
      v: 3, screen: 'landing',
      draft: { mode: 'more', what: '', reduce: '', gives: [], instead: '', feel: [], ownFeel: '', dimmer: '', driveOwn: '', anchor: '', mine: '', mineQ: '', hardStart: '', hardOff: '', hardSpark: '', length: 30, sched: null },
      habit: null, // the focus: { id, mode, title, towards, feel, gives, length, start, status, pauses, finishedOn, later, extra, createdAt, u, actions: [] }
      archive: [], // past focuses, whole
      dirty: { f: {}, a: {}, c: {}, p: false }, // what still needs saving to the account
      settings: { tz: tzGuess(), time: '07:00', email: false, push: false, view: 'full', text: 'standard', calm: false, buzz: true, marketing: false, name: '' },
      fb: {}, later: false, installDismissed: false, updatedAt: 0, pu: ''
    };
  }
  // Start fresh (for trying the app as a brand-new person): open the app with ?fresh in the link.
  // Clears this device and signs out here. Nothing saved to an account is deleted.
  // Stuart's test devices: open the app once with ?tester to show "Start again" in Settings.
  var TESTER_EMAILS = ['stuart.fairbairns@gmail.com', 'stuart@motivate-coaching.com'];
  if (/[?&]tester\b/.test(location.search)) { try { localStorage.setItem('showup-tester', '1'); history.replaceState(null, '', location.pathname); } catch (e) {} }
  function isTester() { var f = false; try { f = localStorage.getItem('showup-tester') === '1'; } catch (e) {} var byEmail = !!(user && TESTER_EMAILS.indexOf((user.email || '').toLowerCase()) >= 0); if (byEmail && !f) { try { localStorage.setItem('showup-tester', '1'); } catch (e) {} } return f || byEmail; }
  var FRESH = /[?&]fresh\b/.test(location.search);
  var FROM_QR = /[?&]from=qr\b/.test(location.search); // opened from the QR code on a computer
  if (FRESH) {
    try { Object.keys(localStorage).forEach(function (k) { if (k === KEY || k.indexOf('sb-') === 0) localStorage.removeItem(k); }); } catch (e) {}
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  function nowISO() { return new Date().toISOString(); }
  // Older saved shapes (V1's single habit with numbered days, or early V2) become a focus with one action.
  // The action keeps the V1 habit's id, so a plan copied to the account and the one on this phone are the same record.
  function upgrade(s) {
    if (!s.archive) s.archive = [];
    if (!s.dirty) s.dirty = { f: {}, a: {}, c: {}, p: true };
    var h = s.habit;
    if (h && !h.actions) {
      var ex = h.extra || {}, start = h.start || todayStr(), less = h.mode === 'less', days = (s.settings && s.settings.days && s.settings.days.length) ? s.settings.days.slice() : [0, 1, 2, 3, 4, 5, 6];
      var act = { id: h.id, text: less ? ((h.instead || '').trim() || 'Cut back on ' + String(h.what || '').toLowerCase()) : h.what, small: h.dimmer || '', up: ex.upVersion || '', cue: ex.anchor || '',
        schedules: [{ from: start, type: 'days', days: days }], sort: 0, entries: {}, extra: {}, u: nowISO() };
      Object.keys(s.entries || {}).forEach(function (k) { var e = s.entries[k], d = addDays(start, +k - 1); act.entries[d] = { kind: e.kind === 'dimmer' ? 'small' : 'full', note: e.note || '', felt: e.felt || '', u: e.at || nowISO() }; });
      var conv = function (o) { var out = {}; Object.keys(o || {}).forEach(function (k) { out[/^\d+$/.test(k) ? addDays(start, +k - 1) : k] = o[k]; }); return out; };
      ex.noticed = conv(ex.noticed); ex.walks = conv(ex.walks); delete ex.anchor; delete ex.upVersion;
      s.habit = { id: h.id, mode: less ? 'less' : 'more', title: h.what, towards: h.ownFeel || '', feel: h.feel || [], gives: h.gives || [], length: h.length || 30, start: start, status: h.status === 'archived' ? 'archived' : 'active',
        pauses: [], finishedOn: null, later: (ex.later || []).map(function (t) { return typeof t === 'string' ? { kind: 'focus', title: t } : t; }), extra: ex, createdAt: h.createdAt || nowISO(), u: nowISO(), actions: [act] };
      delete ex.later; s.entries = {}; s.catchup = []; s.stuSeen = {};
      s.dirty = { f: {}, a: {}, c: {}, p: true }; markAll(s, s.habit);
    }
    if (s.settings && s.settings.pausedUntil && s.habit && s.settings.pausedUntil >= todayStr() && !(s.habit.pauses || []).length) s.habit.pauses = [{ from: todayStr(), to: s.settings.pausedUntil }];
    if (s.settings) delete s.settings.pausedUntil;
    s.v = 3; return s;
  }
  function markAll(s, f) { s.dirty.f[f.id] = 1; (f.actions || []).forEach(function (a) { s.dirty.a[a.id] = 1; Object.keys(a.entries || {}).forEach(function (d) { s.dirty.c[a.id + '|' + d] = 1; }); }); }
  var S = fresh();
  // First open of V2: start from the V1 plan on this phone, so nothing has to be set up twice. V1's own copy is never changed.
  try { if (!localStorage.getItem(KEY) && localStorage.getItem('showup-v1')) localStorage.setItem(KEY, localStorage.getItem('showup-v1')); } catch (e) {}
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') { S = Object.assign(fresh(), saved); S.settings = Object.assign(fresh().settings, saved.settings || {}); S.draft = Object.assign(fresh().draft, saved.draft || {}); S = upgrade(S); } } catch (e) { S = fresh(); }
  var user = null; // signed-in Supabase user (with an email)
  var guest = null; // a quiet guest session, so challenge ideas work before anyone adds an email
  var syncState = 'local'; // local | saving | saved | error
  var ui = { hist: [], fwd: [], vp: null, ideasOpen: false, wordsFrom: null, returnTo: null, authMode: null, moreChips: false, lastSig: null };
  ui.lastSig = JSON.stringify([S.settings, S.wins || [], S.consentAt || null]);

  // Saving on this phone. If the phone refuses (storage full or blocked), say so once rather than pretending it saved.
  var saveWarned = false;
  function profSig() { return JSON.stringify([S.settings, S.wins || [], S.consentAt || null]); }
  function save(touch) {
    if (touch !== false) S.updatedAt = Date.now();
    var sig = profSig(); if (ui.lastSig != null && sig !== ui.lastSig) touchP(); ui.lastSig = sig;
    try { localStorage.setItem(KEY, JSON.stringify(S)); ui.saveFailed = false; }
    catch (e) { ui.saveFailed = true; if (!saveWarned) { saveWarned = true; setTimeout(function () { toast(user ? 'This phone couldn’t save just now. Your account still has it.' : 'This phone couldn’t save just now. Free up some space, or add your email so nothing gets lost.'); }, 0); } }
    if (user) queueSync();
  }
  // Every change says which record changed, so syncing sends just that, and the newest change wins.
  function touchF() { if (!S.habit) return; S.habit.u = nowISO(); S.dirty.f[S.habit.id] = 1; }
  function touchA(a) { a.u = nowISO(); S.dirty.a[a.id] = 1; }
  function touchC(a, d) { var e = a.entries[d]; if (e) e.u = nowISO(); S.dirty.c[a.id + '|' + d] = 1; }
  function touchP() { S.pu = nowISO(); S.dirty.p = true; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  S.viewChosen = true; // V2: no view choice in setup (research: a choice made before seeing either view). It stays in Settings.
  var view = document.getElementById('view');
  var tabsEl = document.getElementById('tabs');
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (b && b.dataset.tab !== S.screen) go(b.dataset.tab); });
  var app = document.getElementById('app');
  var backBtn = document.getElementById('back');
  var fwdBtn = document.getElementById('fwd');
  var settingsBtn = document.getElementById('settingsBtn');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function todayStr() { return ymd(new Date()); }
  function daysBetween(a, b) { var x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00'); return Math.round((y - x) / 86400000); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
  function todayNum() { return S.habit ? Math.max(1, daysBetween(S.habit.start, todayStr()) + 1) : 1; }
  function notStarted() { return !!S.habit && daysBetween(S.habit.start, todayStr()) < 0; }
  function dayDate(n) { return addDays(S.habit.start, n - 1); }
  function dayNumOf(d) { return daysBetween(S.habit.start, d) + 1; }
  function lastDate() { return addDays(S.habit.start, S.habit.length - 1); }
  // Actions that are part of the plan (an action removed from the plan keeps its history but stops showing).
  function acts(f) { f = f || S.habit; return f ? (f.actions || []).filter(function (a) { return !(a.extra && a.extra.retired); }).sort(function (x, y) { return (x.sort || 0) - (y.sort || 0); }) : []; }
  function liveActs(f, d) { d = d || todayStr(); return acts(f).filter(function (a) { return (!a.until || a.until >= d); }); }
  function mainAct() { var l = liveActs(); if (!l.length) return null; var due = l.filter(function (a) { return M.isDue(S.habit, a, todayStr()) || M.isWeekly(a, todayStr()); }); return due[0] || l[0]; }
  function actById(id) { return acts().filter(function (a) { return a.id === id; })[0] || null; }
  function counted(e) { return M.counted(e); }
  // Every counted check-in across the plan's actions, optionally filtered: fn(entry, date, action).
  function count(fn) { var n = 0; acts().forEach(function (a) { Object.keys(a.entries || {}).forEach(function (d) { var e = a.entries[d]; if (counted(e) && (!fn || fn(e, d, a))) n++; }); }); return n; }
  // How a single date looks across all actions: done (some counted), small (all counted were smaller versions), planned, today, unlogged or rest.
  function daySummary(d) {
    var now = todayStr(), any = false, allSmall = true, due = false, paused = M.isPaused(S.habit, d), note = false;
    acts().forEach(function (a) {
      var e = (a.entries || {})[d]; if (e && e.note) note = true;
      if (counted(e)) { any = true; if (e.kind !== 'small') allSmall = false; }
      else if (M.isDue(S.habit, a, d)) due = true;
    });
    if (any) return { s: allSmall ? 'small' : 'full', note: note };
    if (d > now) return { s: paused ? 'paused' : due ? 'planned' : 'rest', note: note };
    if (paused) return { s: 'paused', note: note };
    if (!due) return { s: 'rest', note: note };
    return { s: d === now ? 'today' : 'unlogged', note: note };
  }
  function words() { var h = S.habit || S.draft; var w = (h.feel || []).slice(), own = h.towards != null ? h.towards : h.ownFeel; if ((own || '').trim()) w.push(own.trim()); return w.length ? w : ['Proud']; }
  function habitName() { var h = S.habit; if (h) return (h.title || '').trim() || (acts()[0] ? acts()[0].text : 'My focus'); var d = S.draft; return ((d.mode === 'less' ? d.reduce : (d.focusTitle || d.what)) || '').trim() || (d.mode === 'less' ? 'Cutting back' : 'My habit'); }
  function actText(a) { return a ? a.text : (S.draft.what || '').trim(); }
  function buzz() { if (!S.settings.buzz) return; try { if (navigator.vibrate) navigator.vibrate([15, 60, 25]); } catch (e) {} }
  function checkIcon(c) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; }
  function pencil() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>'; }
  // Setup steps: a numbered label, a bar that fills as you go, and the newest segment animates in.
  function steps() { return S.draft.mode === 'less' ? ['feel', 'what', 'when', 'less', 'often', 'dimmer'] : ['feel', 'what', 'when', 'often', 'dimmer']; }
  var STEP_LABEL = { what: 'Your first action', less: 'What you’ll do instead', feel: 'How it’ll feel', dimmer: 'Your tough-day plan', hard: 'When it gets hard', when: 'When', often: 'How often' };
  function stepLabel(k) { return k === 'feel' ? 'Picture it' : k === 'what' && S.draft.mode === 'less' ? 'What you’re cutting back on' : STEP_LABEL[k]; }
  function nextStep(k) { var st = steps(); return st[st.indexOf(k) + 1]; }
  function stepValid(k) { var d = S.draft; return k === 'what' ? !!(d.mode === 'less' ? (d.reduce || '') : d.what).trim() : k === 'feel' ? !!(d.feel.length || d.ownFeel.trim()) : k === 'less' ? !!d.what.trim() : k === 'often' ? !!(d.sched && (d.sched.type !== 'days' || d.sched.days.length)) : k === 'dimmer' ? !!d.dimmer.trim() : true; }
  function stepButton(k) { var nx = nextStep(k); return '<button class="btn" data-step-next="' + k + '" ' + (stepValid(k) ? '' : 'disabled') + '>' + (nx ? 'Next: ' + stepLabel(nx).toLowerCase() : 'Finish setup') + '</button>'; }
  function progress(key) {
    var st = steps(), n = st.indexOf(key) + 1, T = st.length;
    var h = '<div class="stepper"><div class="progress" style="grid-template-columns:repeat(' + T + ',1fr)" role="progressbar" aria-valuemin="1" aria-valuemax="' + T + '" aria-valuenow="' + n + '">';
    for (var i = 1; i <= T; i++) h += '<span class="' + (i < n ? 'on' : (i === n ? 'on now' : '')) + '"></span>';
    return h + '</div><span class="eyebrow">Step ' + n + ' of ' + T + ' · ' + stepLabel(key) + '</span></div>';
  }
  function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function fmtTime(t) { var p = t.split(':'), h = +p[0], m = +p[1]; return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + (h < 12 ? 'am' : 'pm'); }
  // The brand name always shows as Let's Go! with the amber exclamation mark.
  function brand(t) { return esc(t).replace(/Let’s Go(?!!)/g, '<span class="brand">Let’s Go<span class="bang">!</span></span>'); }
  function toast(msg) { document.querySelectorAll('.toast').forEach(function (t) { t.remove(); }); var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = brand(msg); app.appendChild(el); setTimeout(function () { el.remove(); }, 2800); }
  function applyComfort() {
    var r = document.documentElement;
    r.classList.toggle('size-large', S.settings.text === 'large');
    r.classList.toggle('size-larger', S.settings.text === 'larger');
    r.classList.toggle('calm', !!S.settings.calm || S.settings.view === 'focus');
  }

  function stage() {
    if (!S.habit) return 'started';
    var t = todayNum(), n = count();
    if (t > S.habit.length) return 'finished';
    if (!n) return 'started';
    return n === 1 ? 'day_one' : 'active';
  }

  // ── Sync with Supabase (V2's own lg_* tables) ─────────────────────────────
  // Only what changed is sent. The server keeps whichever change is newest, so an older phone can never
  // overwrite a newer one, and nothing is deleted by syncing: an undone day is kept as "none".
  var syncTimer = null, syncRetry = 0, syncing = false, syncAgain = false;
  function queueSync(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(syncAll, ms == null ? 700 : ms); }
  function setSync(s) { syncState = s; var el = document.getElementById('syncStatus'); if (el) el.innerHTML = syncLabel(); }
  function pendingCount() { var d = S.dirty; return Object.keys(d.f).length + Object.keys(d.a).length + Object.keys(d.c).length + (d.p ? 1 : 0); }
  function syncLabel() {
    if (!user) return 'Saved on this phone only.' + (ui.saveFailed ? ' <b>This phone couldn’t save the last change.</b>' : '');
    if (syncState === 'saving') return 'Saving…';
    if (syncState === 'error') return 'Not saved to your account yet. We’ll keep trying. <button class="link inline" data-act="syncnow">Try now</button>';
    if (pendingCount()) return 'Saving soon…';
    return '<span class="saved-dot"></span>Saved to your account.';
  }
  function focusRow(f) {
    return { id: f.id, user_id: user.id, title: f.title || '', mode: f.mode === 'less' ? 'less' : 'more', intent: '', towards: f.towards || '', outcome: '', matters: '',
      later: f.later || [], start_date: f.start, length_days: f.length, pauses: f.pauses || [], tasks: [],
      extra: Object.assign({}, f.extra || {}, { feel: f.feel || [], gives: f.gives || [] }), status: f.status === 'active' ? 'active' : 'archived', finished_on: f.finishedOn || null,
      created_at: f.createdAt || nowISO(), updated_at: f.u || nowISO() };
  }
  function actionRow(f, a) {
    return { id: a.id, focus_id: f.id, user_id: user.id, text: a.text || '', small: a.small || '', up: a.up || '', cue: a.cue || '', schedules: a.schedules || [], sort: a.sort || 0,
      active_from: a.from || null, until: a.until || null, extra: a.extra || {}, created_at: a.createdAt || f.createdAt || nowISO(), updated_at: a.u || nowISO() };
  }
  function checkRow(a, d) {
    var e = a.entries[d];
    return { action_id: a.id, user_id: user.id, day: d, kind: e.kind || 'none', up: !!e.up, note: e.note || '', late: !!e.late, deleted: e.kind === 'none', felt: e.felt || '', updated_at: e.u || nowISO() };
  }
  function allFocuses() { return (S.habit ? [S.habit] : []).concat(S.archive || []); }
  function profileRow() {
    var s = S.settings;
    return { user_id: user.id, name: s.name || '', timezone: s.tz, reminder_time: s.time, remind_email: !!s.email, remind_push: !!s.push, paused_until: null, marketing_opt_in: !!s.marketing, consent_at: S.consentAt || null,
      settings: { view: s.view, text: s.text, calm: !!s.calm, buzz: !!s.buzz, walkWhen: s.walkWhen || null, tlrMember: s.tlrMember == null ? null : !!s.tlrMember, analytics: s.analytics !== false }, wins: S.wins || [], updated_at: S.pu || nowISO() };
  }
  async function syncAll() {
    if (!user || !sb) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true; setSync('saving');
    var d = S.dirty, sent = { f: Object.assign({}, d.f), a: Object.assign({}, d.a), c: Object.assign({}, d.c), p: d.p }, stamp = {};
    try {
      var F = [], A = [], C = [];
      allFocuses().forEach(function (f) {
        if (sent.f[f.id]) { F.push(focusRow(f)); stamp['f' + f.id] = f.u; }
        (f.actions || []).forEach(function (a) {
          if (sent.a[a.id]) { A.push(actionRow(f, a)); stamp['a' + a.id] = a.u; }
          Object.keys(a.entries || {}).forEach(function (day) { var k = a.id + '|' + day; if (sent.c[k]) { C.push(checkRow(a, day)); stamp['c' + k] = a.entries[day].u; } });
        });
        // A check-in or action can't arrive before its focus: send the parents too.
        if ((A.length || C.length) && !sent.f[f.id] && f.actions.some(function (a) { return sent.a[a.id] || Object.keys(a.entries || {}).some(function (day) { return sent.c[a.id + '|' + day]; }); })) F.push(focusRow(f));
      });
      allFocuses().forEach(function (f) { (f.actions || []).forEach(function (a) { if (!sent.a[a.id] && C.some(function (c) { return c.action_id === a.id; })) A.push(actionRow(f, a)); }); });
      if (F.length || A.length || C.length) { var r = await sb.rpc('lg_push', { focuses: F, actions: A, checkins: C }); if (r.error) throw r.error; }
      if (sent.p) { var p = await sb.from('lg_profiles').upsert(profileRow(), { onConflict: 'user_id' }); if (p.error) throw p.error; }
      // Someone moving over from V1: once V2's nudges are on, V1's stop, so they never get two.
      if ((S.settings.email || S.settings.push) && !S.v1Muted) { try { var m1 = await sb.from('showup_profiles').update({ remind_email: false, remind_push: false }).eq('user_id', user.id); if (!m1.error) S.v1Muted = true; } catch (e) {} }
      // Clear only what hasn't changed again while we were sending.
      allFocuses().forEach(function (f) {
        if (sent.f[f.id] && stamp['f' + f.id] === f.u) delete d.f[f.id];
        (f.actions || []).forEach(function (a) {
          if (sent.a[a.id] && stamp['a' + a.id] === a.u) delete d.a[a.id];
          Object.keys(a.entries || {}).forEach(function (day) { var k = a.id + '|' + day; if (sent.c[k] && stamp['c' + k] === a.entries[day].u) delete d.c[k]; });
        });
      });
      if (sent.p && d.p === sent.p) d.p = false;
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
      syncRetry = 0; setSync('saved');
    } catch (e) {
      console.warn('[letsgo] sync failed', e && e.message); setSync('error');
      syncRetry = Math.min(syncRetry + 1, 6); queueSync([5, 15, 30, 60, 120, 300][syncRetry - 1] * 1000);
    }
    syncing = false;
    if (syncAgain) { syncAgain = false; queueSync(300); }
  }
  // Bring the account's records in, newest change winning record by record. Local changes not yet sent are kept and sent.
  async function pullRemote() {
    if (!user || !sb) return;
    try {
      var res = await Promise.all([sb.from('lg_profiles').select('*').eq('user_id', user.id).maybeSingle(), sb.from('lg_focuses').select('*').eq('user_id', user.id),
        sb.from('lg_actions').select('*').eq('user_id', user.id), sb.from('lg_checkins').select('*').eq('user_id', user.id)]);
      for (var i = 0; i < res.length; i++) if (res[i].error) throw res[i].error;
      var pr = res[0].data;
      if (pr && (!S.pu || new Date(pr.updated_at) > new Date(S.pu))) {
        var st = pr.settings || {};
        S.settings = Object.assign(S.settings, { tz: pr.timezone || S.settings.tz, time: String(pr.reminder_time || '07:00').slice(0, 5), email: !!pr.remind_email, push: !!pr.remind_push, marketing: !!pr.marketing_opt_in,
          name: pr.name || S.settings.name, view: st.view || S.settings.view, text: st.text || S.settings.text, calm: !!st.calm, buzz: st.buzz !== false, walkWhen: st.walkWhen || S.settings.walkWhen, tlrMember: st.tlrMember == null ? S.settings.tlrMember : st.tlrMember, analytics: st.analytics !== false });
        if (pr.consent_at) S.consentAt = pr.consent_at;
        if (Array.isArray(pr.wins) && pr.wins.length) S.wins = pr.wins;
        S.pu = pr.updated_at; S.dirty.p = false;
      } else if (!pr) S.dirty.p = true;
      // Index what's on this phone.
      var local = {}; allFocuses().forEach(function (f) { local[f.id] = f; });
      var actsBy = {}; allFocuses().forEach(function (f) { (f.actions || []).forEach(function (a) { actsBy[a.id] = { a: a, f: f }; }); });
      var newer = function (remoteAt, localAt) { return !localAt || new Date(remoteAt) > new Date(localAt); };
      (res[1].data || []).forEach(function (x) {
        var f = local[x.id], ex = x.extra || {};
        var fields = { mode: x.mode, title: x.title, towards: x.towards, feel: ex.feel || [], gives: ex.gives || [], length: x.length_days, start: x.start_date, status: x.status, pauses: x.pauses || [], finishedOn: x.finished_on, later: x.later || [], createdAt: x.created_at, u: x.updated_at };
        var exx = Object.assign({}, ex); delete exx.feel; delete exx.gives;
        if (!f) { f = Object.assign({ id: x.id, actions: [], extra: exx }, fields); local[x.id] = f; (x.status === 'active' ? (S._incoming = S._incoming || []) : (S._arch = S._arch || [])).push(f); }
        else if (newer(x.updated_at, f.u)) { Object.assign(f, fields); f.extra = exx; delete S.dirty.f[f.id]; }
        else if (new Date(x.updated_at) < new Date(f.u)) S.dirty.f[f.id] = 1;
      });
      (res[2].data || []).forEach(function (x) {
        if (x.extra && x.extra.retired && !actsBy[x.id]) return;
        var have = actsBy[x.id], f = local[x.focus_id]; if (!f) return;
        var fields = { text: x.text, small: x.small, up: x.up, cue: x.cue, schedules: x.schedules || [], sort: x.sort, from: x.active_from, until: x.until, extra: x.extra || {}, createdAt: x.created_at, u: x.updated_at };
        if (!have) { var a = Object.assign({ id: x.id, entries: {} }, fields); f.actions = f.actions || []; f.actions.push(a); actsBy[x.id] = { a: a, f: f }; }
        else if (newer(x.updated_at, have.a.u)) { Object.assign(have.a, fields); delete S.dirty.a[x.id]; }
        else if (new Date(x.updated_at) < new Date(have.a.u)) S.dirty.a[x.id] = 1;
      });
      (res[3].data || []).forEach(function (x) {
        var have = actsBy[x.action_id]; if (!have) return;
        var a = have.a, mine = a.entries[x.day], k = x.action_id + '|' + x.day;
        if (!mine || newer(x.updated_at, mine.u)) { a.entries[x.day] = { kind: x.kind, note: x.note || '', felt: x.felt || '', up: !!x.up, late: !!x.late, u: x.updated_at }; delete S.dirty.c[k]; }
        else if (new Date(x.updated_at) < new Date(mine.u)) S.dirty.c[k] = 1;
      });
      // One focus at a time: if this phone and the account each have a different active focus, the newer one stays, the other is put away (never deleted).
      var incoming = S._incoming || [], arch = S._arch || []; delete S._incoming; delete S._arch;
      incoming.forEach(function (f) {
        if (!S.habit) { S.habit = f; return; }
        if (new Date(f.createdAt) > new Date(S.habit.createdAt || 0)) { S.habit.status = 'archived'; S.habit.u = nowISO(); S.dirty.f[S.habit.id] = 1; S.archive.unshift(S.habit); S.habit = f; }
        else { f.status = 'archived'; f.u = nowISO(); S.dirty.f[f.id] = 1; S.archive.unshift(f); }
      });
      arch.forEach(function (f) { S.archive.push(f); });
      if (S.habit && S.habit.status !== 'active') { S.archive.unshift(S.habit); S.habit = null; }
      S.archive = S.archive.filter(function (f) { if (f.status === 'active' && (!S.habit || S.habit.id !== f.id)) { if (!S.habit) { S.habit = f; return false; } } return true; });
      S.archive.sort(function (x, y) { return new Date(y.createdAt || 0) - new Date(x.createdAt || 0); });
      // Anything on this phone the account doesn't have yet gets sent.
      var onServer = {}; (res[1].data || []).forEach(function (x) { onServer['f' + x.id] = 1; }); (res[2].data || []).forEach(function (x) { onServer['a' + x.id] = 1; }); (res[3].data || []).forEach(function (x) { onServer['c' + x.action_id + '|' + x.day] = 1; });
      allFocuses().forEach(function (f) { if (!onServer['f' + f.id]) S.dirty.f[f.id] = 1; (f.actions || []).forEach(function (a) { if (!onServer['a' + a.id]) S.dirty.a[a.id] = 1; Object.keys(a.entries || {}).forEach(function (day) { if (!onServer['c' + a.id + '|' + day]) S.dirty.c[a.id + '|' + day] = 1; }); }); });
      if (!S.settings.name && user.user_metadata && user.user_metadata.first_name) S.settings.name = user.user_metadata.first_name;
      if (!S.dirty.p) ui.lastSig = profSig();
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
      if (S.habit && ['landing', 'what', 'less', 'feel', 'dimmer', 'often'].indexOf(S.screen) >= 0) S.screen = 'tracker';
      applyComfort();
    } catch (e) { console.warn('[letsgo] load failed', e && e.message); setSync('error'); }
  }
  async function feedback(question, answer) {
    S.fb[question] = true; save();
    if (!user || !sb || !answer) return;
    try { await sb.from('showup_feedback').insert({ user_id: user.id, habit_id: null, question: question, answer: String(answer).slice(0, 4000) }); } catch (e) {}
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  var BACK = {
    say: 'landing', hearing: function () { var d = S.draft; if (d.focusIdx != null && ((d.coach && d.coach.focuses) || []).length > 1) { d.focusIdx = null; d.acts = null; d.pick = null; save(false); return 'hearing'; } return 'say'; },
    what: function () { return S.draft.mineQ ? 'mine' : 'feel'; }, mine: 'find', walk: 'tracker', name: function () { return S.draft.coach ? 'hearing' : 'landing'; }, viewpick: function () { return S.nameAsked ? 'landing' : 'name'; }, wins: 'tracker', less: 'when',
    find: function () { var f = S.find || {}; if (f.step > 0) { f.step--; save(false); return 'find'; } return 'landing'; }, feel: function () { return S.draft.coach ? 'hearing' : S.draft.found ? 'find' : 'landing'; }, when: 'what', dimmer: 'often', hard: 'dimmer',
    often: function () { return S.draft.mode === 'less' ? 'less' : 'when'; }, actedit: 'plan', length: function () { return ui.returnTo || 'ready'; }, progress: 'tracker', note: 'tracker', slipped: 'tracker', share: 'tracker', science: function () { return S.habit ? 'settings' : 'landing'; },
    words: function () { return ui.wordsFrom || 'tracker'; }, sendplan: 'ready', settings: 'tracker', edit: function () { return ui.returnTo || 'settings'; }, plan: 'tracker', reflect: 'tracker', calendar: function () { return ui.calFrom === 'install' ? 'install' : ui.calFrom || 'tracker'; }, install: function () { return ui.installFrom || (S.habit ? 'settings' : 'landing'); }, account: function () { return ui.returnTo || 'tracker'; }
  };


  var screens = {
    landing: function () {
      return '<section class="screen landing v2land">' +
        '<div class="v2with"><img src="../letsgo/stuart.jpg" alt="" width="40" height="40"><span>with Stuart Fairbairns PCC</span></div>' +
        '<div class="hero"><h1>Build a habit you want. Or break one you don’t.</h1>' +
        '<p class="sub">Wherever you’re starting from, we’ll help you shape a plan that fits your life, and help you stick with it.</p></div>' +
        '<div class="btns"><button class="btn" data-act="startplan" data-mode="more">Build a habit</button>' +
        '<button class="btn outline" data-act="startplan" data-mode="less">Break a habit</button>' +
        '<button class="link center" data-find="start">Not sure what to work on? <b>Help me choose</b></button></div>' +
        (user ? '' : '<div class="card soft small' + (FROM_QR ? ' fromqr' : '') + '"><b style="font-weight:600">' + (FROM_QR ? 'Carrying on from your computer?' : 'Already set up on another device?') + '</b><span>Sign in with the same email and your plan comes with you.</span><button class="btn' + (FROM_QR ? '' : ' outline') + '" data-account="landing">Sign in</button></div>') +
        '<div class="spacer"></div>' +
        '<p class="hint" style="text-align:center;margin:0">A few minutes to set up. One tap a day after that.</p>' +
        '<p class="foot">' +
        '<a class="link inline" href="../letsgo/privacy.html">Privacy</a> · <a class="link inline" href="../letsgo/terms.html">Terms</a></p>' +
        (isTester() ? '<button class="link center" data-act="testerreset" style="font-size:13px;color:var(--muted)">Testing: start again from scratch</button>' : '') + '</section>';
    },
    say: function () {
      var d = S.draft, less = d.mode === 'less', ex = less ? ['scroll on my phone in bed', 'snack in the evenings', 'say yes to everything', 'hit snooze every morning'] : ['get moving most mornings', 'read before bed', 'make proper time for the business', 'drink more water'];
      return '<section class="screen"><div class="sdots" aria-label="Getting started"><i class="on"></i><i></i><i></i></div>' +
        '<h1>' + (less ? 'What habit would you like to break?' : 'What habit would you like to build?') + '</h1>' +
        '<p class="lede">Write or speak whatever comes to mind. It doesn’t need to be neat or decided. We’ll work through it together and shape it into something that really works for you.</p>' +
        '<div class="field"><textarea id="sayans" rows="3" style="min-height:120px" placeholder="' + (less ? 'I’d like to stop...' : 'I’d like to...') + '">' + esc(d.say || '') + '</textarea>' + micButton() + '</div>' +
        '<div class="starters">' + ex.map(function (s) { return '<button class="chip" data-sayex="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
        '<button class="chip" data-find="start" data-mode="' + (d.mode || 'more') + '" style="align-self:flex-start">I’m not sure yet. Help me choose.</button>' +
        '<p class="hint">Private. Sent to our AI provider, Anthropic, only to shape your plan. We don’t keep what you write here.</p>' +
        '<div class="spacer"></div><button class="btn" data-act="shape"' + ((d.say || '').trim() ? '' : ' disabled') + '>Next</button></section>';
    },
    hearing: function () {
      var d = S.draft, c = d.coach || {};
      var top = '<section class="screen"><div class="sdots" aria-label="Getting started"><i class="on"></i><i class="on"></i><i></i></div>';
      if (ui.coachBusy) return top + '<div class="thinking" role="status"><span class="tdots" aria-hidden="true"><i></i><i></i><i></i></span><p class="lede" style="margin:0">' + (ui.coachBusy === 'actions' ? 'Finding a good first step…' : 'Reading what you wrote…') + '</p></div></section>';
      if (c.care) return top + '<h1>Before anything else</h1>' + stuCard(esc(c.care)) + '<button class="btn outline" data-go="say">Back</button></section>';
      var fs = c.focuses || [];
      if (d.focusIdx == null && fs.length > 1) {
        return top + '<h1>Here’s what I’m hearing</h1>' + (c.reply ? '<p class="lede">' + esc(c.reply) + '</p>' : '') +
          stuCard('I’m hearing more than one thing here. Working on one at a time is what makes it stick. Which one first? The others will wait in Later.') +
          fs.map(function (f, i) { return '<button class="pickcard" data-focus="' + i + '"><b>' + esc(f.title) + '</b><span>You said: “' + esc(f.heard) + '”</span></button>'; }).join('') +
          '<div class="spacer"></div></section>';
      }
      var f = fs[d.focusIdx || 0] || { title: d.say }, acts = d.acts || [];
      return top + '<div class="eyebrow">Your focus</div><h1>' + esc(f.title) + '</h1>' +
        (fs.length < 2 && c.reply ? '<p class="lede">' + esc(c.reply) + '</p>' : '') +
        '<div class="allgood"><span class="bigstar" style="width:18px;height:18px"></span>That gives us something clear to work with.</div>' +
        ((d.coachQs || []).length ? '<div class="qcard"><span class="eyebrow">One quick question</span><b style="font-weight:600;font-size:18px">' + esc(d.coachQs[0].q) + '</b><div class="chips">' + d.coachQs[0].options.map(function (o) { return '<button class="chip" data-coachans="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div><span class="hint">So the plan fits what you meant.</span></div>' : '') +
        (acts.length ? '<h2>Pick a first small step</h2><p class="hint" style="margin-top:-6px">Start with one. The others wait in Later, ready to add when you want.</p>' + acts.map(function (x, i) { return '<button class="pickcard" data-act1="' + i + '" aria-pressed="' + (d.pick === i) + '"><b>' + esc(x.text) + '</b><span class="psched">' + esc(describeRule(x.schedule)) + (x.schedule_from_user ? '' : ' (suggested)') + '</span>' + (x.why ? '<span>' + esc(x.why) + '</span>' : '') + '</button>'; }).join('') +
          '<button class="link" data-act1="own">I’ll write my own</button>' : '<button class="btn outline" data-act="coachacts">Suggest a first step</button><button class="btn" data-act1="own">I’ll write my own</button>') +
        (d.later && d.later.length ? '<p class="hint">Waiting in Later: ' + d.later.map(esc).join(', ') + '</p>' : '') +
        '<div class="spacer"></div><button class="btn" data-act="hearingnext"' + (d.pick != null ? '' : ' disabled') + '>Next</button></section>';
    },
    what: function () {
      var d = S.draft, more = d.mode === 'more';
      if (!more) return '<section class="screen">' + progress('what') +
        '<h1>What do you want to cut back on?</h1>' +
        '<div class="field"><label class="label" for="reduce">I’m cutting back on...</label>' +
        '<textarea id="reduce" rows="1" data-bind="reduce" placeholder="Scrolling on my phone in bed">' + esc(d.reduce) + '</textarea>' +
        '<span class="hint">The habit you want less of. Next, you’ll choose what you’ll do instead.</span></div>' +
        optional('Show me some ideas', '<div class="starters">' + STARTERS_LESS.map(function (s) { return '<button class="chip" data-reduceidea="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>') +
        '<button class="card askhelp" data-find="start" data-mode="less"><span class="ahtxt"><b><span class="spark" aria-hidden="true">✦</span> Challenge idea generator</b><span>Not sure what to pick? Answer two questions and we’ll suggest a few.</span></span><span class="chev" aria-hidden="true">›</span></button>' +
        '<div class="spacer"></div>' + stepButton('what') + '</section>';
      return '<section class="screen">' + progress('what') +
        '<h1>What will you do?</h1>' +
        '<div class="field"><label class="label" for="what">I’m going to...</label>' +
        '<textarea id="what" rows="1" data-bind="what" placeholder="Go for a 20 minute walk">' + esc(d.what) + '</textarea>' +
        '<span class="hint">In your own words. Start with what you’ll actually do.</span></div>' +
        ((d.mineQ && (d.mine || '').trim()) ? '<div class="card soft small"><span class="eyebrow">Your words</span><span>“' + esc(d.mine.trim()) + '”</span><button class="link" data-go="mine" style="align-self:flex-start">Change my words</button></div>' : '') +
        optional('Show me some ideas', '<div class="starters">' + STARTERS_MORE.map(function (s) { return '<button class="chip" data-starter="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
          '<button class="link" data-act="ideas">More ideas</button>') +
        '<button class="card askhelp" data-find="start" data-mode="more"><span class="ahtxt"><b><span class="spark" aria-hidden="true">✦</span> Challenge idea generator</b><span>Not sure what to pick? Answer two questions and we’ll suggest a few.</span></span><span class="chev" aria-hidden="true">›</span></button>' +
        '<div class="spacer"></div>' + stepButton('what') + '</section>' +
        (ui.ideasOpen ? ideasSheet() : '');
    },
    often: function () {
      var d = S.draft, ai = d.sched && !d.schedFromUser && d.fromCoach;
      return '<section class="screen">' + progress('often') + '<h1>How often?</h1>' +
        '<p class="lede">' + (ai ? 'We’ve suggested this from what you shared. Change it to whatever fits your week.' : 'Pick what’s realistic for an ordinary week. You can change it any time.') + '</p>' +
        '<div class="card soft small"><span class="eyebrow">' + (d.mode === 'less' ? 'Instead, you’ll' : 'You’re going to') + '</span><b style="font-weight:600">' + esc((d.what || '').trim()) + '</b></div>' +
        schedPicker(d.sched, 'draft') +
        '<p class="hint full-only">Rest days are part of the plan. They never count against you.</p>' +
        '<div class="spacer"></div>' + stepButton('often') + '</section>';
    },
    when: function () {
      var d = S.draft, more = d.mode === 'more', opts = more ? ANCHORS_MORE : ANCHORS_LESS;
      return '<section class="screen">' + progress('when') +
        '<h1>' + (more ? 'When will you do it?' : 'When does it usually happen?') + '</h1>' +
        '<p class="lede">' + (more ? 'Linking it to something you already do gives you a reliable cue to remember it.' : 'Knowing when the urge tends to come means you can be ready for it.') + '</p>' +
        '<div class="field"><label class="label" for="anchor">' + (more ? 'After I...' : 'Usually...') + '</label>' +
        '<textarea id="anchor" rows="1" data-bind="anchor" placeholder="' + (more ? 'make my morning coffee' : 'in bed at night') + '">' + esc(d.anchor || '') + '</textarea></div>' +
        '<div class="starters">' + opts.map(function (x) { return '<button class="chip" data-anchor="' + esc(x) + '" aria-pressed="' + ((d.anchor || '') === x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
        '<div class="spacer"></div>' + stepButton('when') + '</section>';
    },
    less: function () {
      var d = S.draft;
      var drives = '<div class="field"><span class="label">First, what usually drives it?</span><span class="hint">Tap any that fit. Not sure is fine too.</span><div class="chips" style="margin-top:8px">' +
        GIVES.map(function (g) { return '<button class="chip" data-give="' + esc(g) + '" aria-pressed="' + (d.gives.indexOf(g) >= 0) + '">' + esc(g) + '</button>'; }).join('') + '</div>' +
        '<textarea id="driveown" rows="1" data-bind="driveOwn" placeholder="Or in your own words" style="margin-top:8px">' + esc(d.driveOwn || '') + '</textarea></div>';
      return '<section class="screen">' + progress('less') + '<h1>What will you do instead?</h1>' +
        ((d.reduce || '').trim() ? '<p class="hint" style="margin-top:-8px">Instead of: <b>' + esc(d.reduce.trim()) + '</b></p>' : '') +
        (S.settings.view === 'focus' ? tapToSee('What usually drives it?', drives) : drives) +
        '<div class="field"><label class="label" for="instead">Instead, I’ll...</label>' +
        '<textarea id="instead" rows="1" data-bind="what" placeholder="e.g. Charge my phone outside the bedroom">' + esc(d.what) + '</textarea>' +
        '<span class="hint full-only">Something you’ll do: a swap, or a change to your surroundings that makes it easier.</span></div>' +
        '<div class="spacer"></div>' + stepButton('less') + '</section>';
    },
    feel: function () {
      var d = S.draft;
      return '<section class="screen">' + progress('feel') + '<h1>Picture it going well a month from now. What’s different?</h1>' +
        '<p class="lede">One line is plenty. This is what you’re moving towards.' + (d.ownFeelFromCoach && d.ownFeel === d.ownFeelFromCoach ? ' We’ve started it from what you shared. Change anything that doesn’t sound like you.' : '') + '</p>' +
        '<div class="field"><textarea id="own" rows="2" data-bind="ownFeel" placeholder="I feel lighter, I’ve got energy for the kids and I trust myself again">' + esc(d.ownFeel) + '</textarea></div>' +
        '<div class="spacer"></div>' + stepButton('feel') + '</section>';
    },
    dimmer: function () {
      var d = S.draft, less = d.mode === 'less', what = (d.what || '').trim(), lt = d.lighter && d.lighter.for === what ? d.lighter.opts : null;
      if (what && !lt && !ui.lighterBusy && ui.lighterTried !== what) setTimeout(fetchLighter, 0);
      return '<section class="screen">' + progress('dimmer') + '<h1>On a tough day, what’s the lighter version?</h1>' +
        '<p class="lede">Some days a 10, some days a 1. Both count.</p>' +
        (what ? '<div class="card soft small"><span class="eyebrow">' + (less ? 'Instead, you’ll' : 'Your action') + '</span><b style="font-weight:600">' + esc(what) + '</b>' + (anchorLine(d) ? '<span style="color:var(--text-mid)">' + esc(anchorLine(d)) + '</span>' : '') + '</div>' : '') +
        '<div class="field"><label class="label" for="dim">On a tough day, I’ll...</label>' +
        '<textarea id="dim" rows="1" data-bind="dimmer" placeholder="Something much smaller that still counts">' + esc(d.dimmer) + '</textarea></div>' +
        '<div class="lighter"><span class="label">' + (lt ? 'Ideas for yours' : ui.lighterBusy ? 'Finding ideas for yours…' : '') + '</span>' +
        (lt ? '<div class="starters">' + lt.map(function (o) { return '<button class="chip" data-dimidea="' + esc(o) + '" aria-pressed="' + ((d.dimmer || '').trim() === o) + '">' + esc(o) + '</button>'; }).join('') + '</div><span class="hint">Tap one to use it, then make it yours.</span>' : '') + '</div>' +
        '<div class="spacer"></div>' + stepButton('dimmer') + '</section>';
    },
    walk: function () {
      var d = walkDay(), tom = d > todayStr(), hb = S.habit, less = hb.mode === 'less', mine = mineLine();
      var wa = liveActs(null, d).filter(function (x) { return M.isDue(hb, x, d) || M.isWeekly(x, d); })[0] || mainAct(), a = anchorLine(wa);
      var day = tom ? 'tomorrow' : 'today', plan = ui.walkPlan != null ? ui.walkPlan : lastPlan();
      var steps2 = [
        a ? 'Picture the moment it happens: <b>' + esc(a.charAt(0).toLowerCase() + a.slice(1)) + '</b>.' : 'Picture the moment it happens ' + day + ': where you are, what’s around you.',
        less ? 'See yourself choosing what you’ll do instead: <b>' + esc(actText(wa)) + '</b>.' : 'See yourself doing it: <b>' + esc(actText(wa)) + '</b>. The first step, then the rest.',
        'What might get in the way? See yourself handling it.',
        'Notice how good it feels to have done it.'
      ];
      var field = '<div class="field"><label class="label" for="walkplan">' + (tom ? 'Tomorrow' : 'Today') + ' I will…</label><textarea id="walkplan" rows="1" placeholder="One specific thing. Small is fine.">' + esc(plan) + '</textarea>' + micButton() + '</div>';
      return '<section class="screen walk"><div><div class="eyebrow">Walk it through · about a minute</div><h1>See yourself doing it ' + day + '.</h1></div>' +
        (mine ? '<div class="mineline">Start with your words: “' + esc(mine) + '”</div>' : '') +
        '<ol class="walksteps">' + steps2.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ol>' +
        '<div class="walktimer" id="walktimer"><button class="btn outline" data-act="walktimer">Start a 1 minute timer</button><span class="hint">Close your eyes if you like. It’s fine not to.</span></div>' +
        (mine ? field : '<details class="ask"' + (plan ? ' open' : '') + '><summary>Write one thing for ' + day + ' (optional)</summary>' + field + '</details>') +
        '<div class="spacer"></div><button class="btn" data-act="walkdone">Done</button></section>';
    },
    // Make it yours: for ideas that only work once they've decided the actual content (what to say, write, who to message).
    mine: function () {
      var d = S.draft;
      return '<section class="screen"><div><div class="eyebrow">Make it yours</div><h1>' + esc(d.mineQ || 'Make it yours') + '</h1></div>' +
        '<div class="card soft small"><span class="eyebrow">Your challenge</span><b style="font-weight:600">' + esc(d.what) + '</b>' + (d.mineWhy ? '<span style="color:var(--text-mid)">' + esc(d.mineWhy) + '</span>' : '') + '</div>' +
        '<div class="field"><label class="label" for="mine">In your own words</label><textarea id="mine" rows="3" data-bind="mine" style="min-height:120px" placeholder="Type, or tap Speak">' + esc(d.mine || '') + '</textarea>' + micButton() +
        '<span class="hint">' + (d.mine ? 'We’ve started it from what you shared. Change anything that doesn’t sound like you. ' : '') + 'Take a few minutes. This is what you’ll come back to every day.</span></div>' +
        '<div class="spacer"></div><button class="btn" data-act="minedone"' + ((d.mine || '').trim() ? '' : ' disabled') + '>This is mine</button></section>';
    },
    hard: function () {
      var d = S.draft, focus = S.settings.view === 'focus';
      var f = function (key, id, label, q, ph) {
        var field = '<div class="field"><label class="label" for="' + id + '">' + q + '</label><textarea id="' + id + '" rows="2" data-bind="' + key + '" placeholder="' + ph + '">' + esc(d[key] || '') + '</textarea></div>';
        return focus ? '<details class="ask hardq"' + ((d[key] || '').trim() ? ' open' : '') + '><summary>' + label + '</summary>' + field + '</details>' : '<div class="hardblock"><span class="eyebrow">' + label + '</span>' + field + '</div>';
      };
      return '<section class="screen">' + progress('hard') + '<h1>When it gets hard, what gets you going again?</h1>' +
        '<p class="lede">Be really honest with yourself. When you need it most, we’ll show you what you wrote.' + (focus ? '' : ' Answer one, or all three.') + '</p>' +
        f('hardStart', 'hstart', 'When I can’t get started', 'Think of a day you didn’t feel like it and did it anyway. What got you going?', 'e.g. I just put my shoes on and told myself five minutes') +
        f('hardOff', 'hoff', 'When I fall off track', 'When you’ve fallen off something before and got back on, what did it?', 'e.g. I stopped waiting for Monday and started the next day') +
        f('hardSpark', 'hspark', 'When the spark goes', 'Picture finishing this. How does it feel, and what will remind you why it matters?', 'e.g. Feeling proud I kept a promise to myself') +
        '<div class="spacer"></div>' + stepButton('hard') + '<p class="hint c">Not sure yet? Skip it. You can add these later.</p></section>';
    },
    ready: function () {
      if (ui.planEdit) return focusEditor();
      var a = mainAct(), d = todayStr(), done = anyCountedOn(d), due = a && (M.isDue(S.habit, a, d) || M.isWeekly(a, d)), nx = nextPlanned();
      var h = '<section class="screen"><div><div class="eyebrow">Your plan is ready</div><h1>Here’s your plan.</h1></div>' +
        stuCard((firstName() ? esc(firstName()) + ', you’ve' : 'You’ve') + ' made a plan that fits your life. Some days will be a 10, some a 1. Both count. I’ll be with you along the way.') + planCard('ready');
      if (!done && due && !S.later) {
        h += '<div class="card"><b style="font-size:20px;font-weight:600">Done it already today?</b><span style="color:var(--text-mid)">Count it now. A lighter version counts too.</span>' +
          '<button class="btn" data-log="full" data-a="' + a.id + '">' + checkIcon('#FFFFFF') + 'I showed up today</button>' +
          '<button class="link center" data-act="later">I’ll start tomorrow</button><button class="link center" data-act="startdate">Already started before today?</button></div>';
      } else if (!done && !due) {
        h += '<div class="card soft"><b style="font-weight:600">Nothing planned today.</b><span>Your first one is ' + esc(nx ? relDay(nx.d) : 'soon') + (nx ? ': ' + esc(nx.a.text) : '') + '.</span></div>';
      } else if (S.later && !done) {
        h += '<div class="card soft"><b style="font-weight:600">Day one is tomorrow.</b><span>Your plan is saved and ready.</span></div>';
      } else {
        h += '<div class="card" style="flex-direction:row;align-items:center;gap:14px"><span class="bigstar" style="width:32px;height:32px"></span><span><b>First one done.</b> You’ve started.</span></div>';
      }
      if (!user) h += '<div class="card"><b style="font-size:18px;font-weight:600">Save your progress</b><span style="color:var(--text-mid)">Right now your plan is only on this phone. Add your email so it’s backed up and your nudges can reach you. No password needed.</span>' +
        '<button class="btn outline" data-account="ready">Save my progress</button></div>';
      h += (firstName() ? '' : '<div class="field"><label class="label" for="pname">What should we call you?</label><textarea id="pname" rows="1" data-name="1" autocomplete="given-name" placeholder="Your first name"></textarea></div>') +
        nextNudge() + '<div class="spacer"></div><button class="btn" data-act="readydone">Go to my tracker</button></section>';
      return h;
    },
    plan: function () {
      if (!S.habit) return screens.landing();
      if (ui.planEdit) return focusEditor();
      return '<section class="screen"><div><div class="eyebrow">My plan</div><h1>' + esc(habitName()) + '</h1></div>' + planCard('plan') + archiveCard() +
        '<div class="spacer"></div><button class="btn" data-go="tracker">Back to today</button></section>';
    },
    actedit: function () { if (!S.habit || !ui.edit) return screens.plan(); return actEditor(); },
    length: function () {
      var cur = S.habit ? S.habit.length : S.draft.length, std = [10, 30, 60, 90, 365];
      var h = '<section class="screen"><h1>How long before you review it?</h1><p class="lede">Pick a point to look back and decide what’s next. It isn’t a deadline, and you can change it any time.</p><div style="display:flex;flex-direction:column;gap:10px">';
      [[10, 'A test drive'], [30, 'A month, then a look back'], [60, 'Two months'], [90, 'Three months'], [365, 'A year']].forEach(function (o) {
        h += '<button class="choice" style="min-height:66px" data-len="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"><b>' + (o[0] === 365 ? '1 year' : o[0] + ' days') + '</b><small>' + o[1] + '</small></button>';
      });
      h += '</div><div class="field"><label class="label" for="lencustom">Or your own number of days</label><input class="input" id="lencustom" type="number" inputmode="numeric" min="7" max="730" value="' + (std.indexOf(cur) < 0 ? cur : '') + '" placeholder="e.g. 45"></div>';
      return h + '<div class="spacer"></div><button class="btn" data-act="lensave">Save</button></section>';
    },
    tracker: function () {
      if (!S.habit) return screens.landing();
      if (notStarted()) return '<section class="screen"><div><div class="eyebrow">My focus</div><h1>' + esc(habitName()) + '</h1></div>' +
        '<div class="card"><b style="font-size:20px;font-weight:600">Day one is ' + esc(relDay(S.habit.start)) + '.</b><span style="color:var(--text-mid)">' + esc(reminderLine()) + '. Changed your mind?</span><button class="btn outline" data-act="starttoday">Start today instead</button></div>' +
        planCard('tracker') + '</section>';
      if (S.settings.view === 'focus') return focusTracker();
      var t = todayNum(), L = S.habit.length, st = stats();
      var h = '<section class="screen home">' +
        '<div class="focushero"><span class="pill">' + (S.habit.finishedOn ? 'Finished' : t > L ? L + ' days' : 'Day ' + t + ' of ' + L) + '</span><div class="eyebrow">' + (S.habit.mode === 'less' ? 'Cutting back on' : 'My focus') + '</div><h1>' + esc(habitName()) + '</h1>' +
        (mineLine() ? '<p class="fh-line">“' + esc(mineLine()) + '”</p>' : '') +
        '<div class="meter" role="img" aria-label="Review period: day ' + Math.min(t, L) + ' of ' + L + '"><i style="width:' + Math.round(Math.min(t, L) / L * 100) + '%"></i></div><span class="fh-cap">Review in ' + Math.max(0, L - t + 1) + ' day' + (L - t + 1 === 1 ? '' : 's') + '</span></div>';
      h += '<section class="sec today">' + secHead('today', 'Today') + todaySection(false) + '</section>';
      h += catchUpCard();
      h += '<section class="sec">' + secHead('week', 'This week', '<button class="link" data-go="progress" style="min-height:0;font-size:13px">Progress</button>') + weekHTML() +
        '<div class="legend2"><span><i style="background:var(--green)"></i>Done</span><span><i style="background:var(--amber)"></i>Lighter</span><span><i class="rest"></i>Rest day</span></div></section>';
      if (st.planned || st.done) h += '<section class="sec full-only">' + secHead('chart', 'Your progress') +
        '<div class="tiles"><div class="tile"><b>' + st.done + '</b><span>show-ups</span></div><div class="tile"><b>' + st.week + '<small>/' + st.weekOf + '</small></b><span>planned, last 7 days</span></div><div class="tile"><b>' + st.backs + '</b><span>comebacks</span></div></div>' +
        barChart(90) + '<p class="hint">Green is the full version, amber the lighter one. Both count. The dashed outline is what was planned.</p></section>';
      else h += '<section class="sec full-only">' + secHead('chart', 'Your progress') + '<p class="hint" style="margin:0">Your first planned action is ready. Your progress will show here.</p></section>';
      var na = nudgeAsk(); h += stuDay(t) + (na || (signInCard() + extraCards(t)));
      if (t <= 5 && !S.viewTipDone) h += '<div class="card soft small"><b style="font-weight:600">Prefer fewer details on screen?</b><span>Focused view shows just today, calmly. You can switch back any time.</span><div class="row" style="gap:12px;justify-content:flex-start"><button class="chip" data-act="tryfocus">Try Focused view</button><button class="link" data-act="viewtipno" style="font-size:14px">No thanks</button></div></div>';
      return h + '</section>';
    },
    progress: function () {
      if (!S.habit) return screens.landing();
      var st = stats();
      if (!st.planned && !st.done) return '<section class="screen"><div><div class="eyebrow">Progress</div><h1>How it’s going</h1></div><div class="card soft"><b style="font-weight:600">Nothing to show yet.</b><span>Your progress appears here from your first planned day.</span></div>' +
        '<section class="sec">' + secHead('task', 'Every day') + gridHTML(todayNum(), true) + '</section><button class="link center" data-go="wins">My past wins</button></section>';
      return '<section class="screen"><div><div class="eyebrow">Progress</div><h1>How it’s going</h1></div>' +
        '<section class="sec">' + secHead('chart', 'Running total') + '<div><span class="bignum">' + st.done + '</span> <span class="hint" style="display:inline">show-up' + (st.done === 1 ? '' : 's') + ', from ' + st.planned + ' planned so far</span></div>' + lineChart() +
        '<div class="legend2"><span><i style="background:var(--green)"></i>Show-ups</span><span><i style="border:1.5px dashed #9A907F"></i>Planned</span></div></section>' +
        '<section class="sec">' + secHead('week', 'Week by week') + barChart(120) + '<div class="legend2"><span><i style="background:var(--green)"></i>Full version</span><span><i style="background:var(--amber)"></i>Lighter version</span><span><i style="border:1.5px dashed #9A907F"></i>Planned</span></div></section>' +
        '<section class="sec">' + secHead('task', 'Every day') + gridHTML(todayNum(), true) + '<p class="hint">Tap any day to fill it in, change it or add a note. Days not logged stay plain, never red. Rest days are part of the plan.</p></section>' +
        '<div class="tiles"><div class="tile"><b>' + st.full + '</b><span>full versions</span></div><div class="tile"><b>' + st.light + '</b><span>lighter versions</span></div><div class="tile"><b>' + st.backs + '</b><span>comebacks</span></div></div>' +
        (st.unlogged ? '<p class="hint">' + st.unlogged + ' planned ' + (st.unlogged === 1 ? 'day isn’t' : 'days aren’t') + ' logged. If you did them, tap the day to fill it in.</p>' : '') +
        '<button class="btn outline" data-go="share">Share my progress</button><button class="link center" data-go="wins">My past wins</button></section>';
    },
    note: function () {
      var d = ui.noteDay || todayStr(), a = actById(ui.noteAct) || mainAct(), e = (a && a.entries[d]) || {};
      return '<section class="screen"><div><div class="eyebrow">' + esc(relDay(d).charAt(0).toUpperCase() + relDay(d).slice(1)) + (a && liveActs().length > 1 ? ' · ' + esc(a.text) : '') + '</div><h1>How did it go?</h1></div>' +
        '<div class="field"><label class="label" for="note">A word or a paragraph. Whatever’s true today.</label>' +
        '<textarea id="note" rows="3" style="min-height:120px">' + esc(e.note || '') + '</textarea></div>' +
        '<p class="hint">Your notes stay private to you. They’re saved on this phone, and in your account if you’ve added your email. Stuart never sees them.</p>' +
        '<div class="spacer"></div><button class="btn" data-act="savenote">Save note</button></section>';
    },
    share: function () {
      var L = S.habit.length, st = stats(), dots = '<div class="sharedots">';
      for (var i = 1; i <= L; i++) { var s = daySummary(dayDate(i)).s; dots += '<i class="' + (s === 'full' || s === 'small' ? 'on' : s === 'unlogged' ? 'off' : 'ahead') + '"></i>'; }
      dots += '</div>';
      return '<section class="screen"><div><div class="eyebrow">Share that I did it</div><h1>Your progress</h1></div><p class="lede">This card shows your focus and how often you showed up. Never your notes. Check it before you send it.</p>' +
        '<div class="sharecard" id="sharecard"><div class="head"><span class="eyebrow" style="color:var(--cream-dark)">' + (L === 365 ? '1-year' : L + '-day') + ' plan</span><span class="wordmark">Let’s Go<span class="bang">!</span><sup class="tm" aria-hidden="true">™</sup></span></div>' +
        '<h2>' + esc(habitName()) + '</h2>' + dots +
        '<div class="sharestat"><b>' + st.done + '</b><span>show-up' + (st.done === 1 ? '' : 's') + (st.planned ? ' from ' + st.planned + ' planned' : '') + '</span></div></div>' +
        '<button class="btn" data-act="shareimg">Share my card</button>' +
        '<button class="btn outline" data-act="whatsapp">Send on WhatsApp</button></section>';
    },
    reflect: function () {
      var L = S.habit.length, st = stats(), nexts = { 10: 30, 30: 60, 60: 90, 90: 180, 180: 365 }, next = nexts[L] || L + 90;
      var q = ui.reflect || (ui.reflect = { noticed: '', next: '', pmf: '', quote: '', ok: false, shareNoticed: false });
      var h = '<section class="screen"><div><div class="eyebrow">Your look back</div><h1>' + (L === 365 ? 'A year' : L + ' days') + '. ' + st.done + ' show-up' + (st.done === 1 ? '' : 's') + '.</h1></div>' +
        stuCard('However many show-ups, you kept coming back. No marks out of ten here. Just what you noticed.') +
        '<div class="field"><label class="label" for="noticed">What did you notice?</label><textarea id="noticed" rows="2" data-rbind="noticed" placeholder="About the habit, about you, about your days">' + esc(q.noticed) + '</textarea>' +
        '<span class="hint">Private to you, unless you choose to share it below.</span></div>' +
        '<p class="hint">Worth knowing: in one well-known study, new habits took anywhere from 18 to 254 days to feel automatic. Needing longer is normal, not a sign it didn’t work.</p>' +
        '<div class="field"><span class="label">What’s next?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        '<button class="choice" data-rnext="extend" aria-pressed="' + (q.next === 'extend') + '"><b>Keep going</b><small>Carry on to ' + (next === 365 ? 'a year' : next + ' days') + ', with everything you’ve done so far</small></button>' +
        '<button class="choice" data-rnext="new" aria-pressed="' + (q.next === 'new') + '"><b>Try something new</b><small>Start a fresh plan. This one is kept in Past plans.</small></button>' +
        '<button class="choice" data-rnext="done" aria-pressed="' + (q.next === 'done') + '"><b>Stop here</b><small>That’s a perfectly good answer too</small></button></div></div>' +
        '<div class="card"><span class="eyebrow">Helping Stuart improve this (optional, goes to Stuart)</span><span class="label">How would you feel if you could no longer use this?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        ['Very disappointed', 'Somewhat disappointed', 'Not disappointed'].map(function (o) { return '<button class="chip" style="text-align:left" data-rpmf="' + o + '" aria-pressed="' + (q.pmf === o) + '">' + o + '</button>'; }).join('') + '</div>' +
        '<div class="field"><label class="label" for="quote">In a sentence, what would you tell a friend about it?</label><textarea id="quote" rows="1" data-rbind="quote">' + esc(q.quote) + '</textarea></div>' +
        '<button class="switch" role="switch" aria-checked="' + q.ok + '" data-act="quoteok"><span><b>Happy for Stuart to share that</b><span class="hint">With your first name only.</span></span><span class="track"></span></button>' +
        '<button class="switch" role="switch" aria-checked="' + q.shareNoticed + '" data-act="sharenoticed"><span><b>Send Stuart what I noticed too</b><span class="hint">Off unless you choose.</span></span><span class="track"></span></button></div>' +
        '<div class="spacer"></div><button class="btn" data-act="savereflect" ' + (q.next ? '' : 'disabled') + '>Save my look back</button><button class="link center" data-go="share">Share that I did it</button></section>';
      return h;
    },
    calendar: function () {
      var c = ui.cal || (ui.cal = { time: S.settings.time || '07:00', start: calDefaultStart() }), list = liveActs();
      var ios = isIOS(), android = /android/i.test(navigator.userAgent);
      var ics = '<button class="btn' + (android ? ' outline' : '') + '" data-act="calics">' + iconCal() + (ios ? 'Add to my iPhone calendar' : android ? 'Other calendars (.ics file)' : 'Apple or Outlook calendar') + '</button>';
      var g = list.map(function (a) { return '<button class="btn' + (android ? '' : ' outline') + '" data-calgoogle="' + a.id + '">' + iconCal() + (list.length > 1 ? 'Google Calendar: ' + esc(a.text) : 'Add to Google Calendar') + '</button>'; }).join('');
      return '<section class="screen"><div><div class="eyebrow">Your calendar</div><h1>Put it in your calendar</h1></div>' +
        '<p class="lede">A reminder in the calendar you already use, on the days each action is planned, with your own words in it.</p>' +
        '<div class="card"><div class="row"><label class="label" for="caltime" style="margin:0">Time</label><input class="input" id="caltime" type="time" step="300" value="' + esc(c.time) + '" style="max-width:160px"></div>' +
        '<div class="row"><label class="label" for="calstart" style="margin:0">Starting</label><input class="input" id="calstart" type="date" value="' + esc(c.start) + '" style="max-width:180px"></div>' +
        list.map(function (a) { return '<span class="hint"><b>' + esc(a.text) + '</b>: ' + esc(describeRule(ruleNow(a))) + ', until ' + esc(prettyDate(lastDate())) + '.</span>'; }).join('') + '</div>' +
        (reminderState() === 'email' || reminderState() === 'push' ? '<p class="hint">You also get the app’s nudge. Want just one? Switch it off in Settings after adding this.</p>' : '') +
        '<div class="spacer"></div>' + (android ? g + ics : ics + g) + '</section>';
    },
    length: function () {
      var cur = S.habit ? S.habit.length : S.draft.length;
      var h = '<section class="screen"><h1>How long do you want to give it?</h1><p class="lede">We set 30 days to start. Change it any time.</p><div style="display:flex;flex-direction:column;gap:10px">';
      [[10, 'A test drive'], [30, 'Long enough to feel a difference'], [60, 'Time for it to settle in'], [90, 'All in']].forEach(function (o) {
        h += '<button class="choice" style="min-height:66px" data-len="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '"><b>' + o[0] + ' days' + (o[0] === 30 ? ' · recommended' : '') + '</b><small>' + o[1] + '</small></button>';
      });
      h += '</div>' + (cur === 10 ? '<div class="card small soft">Great for testing. Most things take about 30 days to feel like yours, so you can add more at the end.</div>' : '');
      return h + '<div class="spacer"></div><button class="btn" data-back="1">Save</button></section>';
    },
    slipped: function () { return struggleScreen(); },
    find: function () { return findScreen(); },
    wins: function () { return winsScreen(false); },
    viewpick: function () {
      var v = ui.vp || S.settings.view || 'full', n = firstName(), simple = v === 'focus';
      var seg = '<div class="seg2" role="group" aria-label="Try a view"><button data-vp="full" aria-pressed="' + !simple + '">Detailed</button><button data-vp="focus" aria-pressed="' + simple + '">Focused</button></div>';
      var go = '<div class="spacer"></div><button class="btn" data-act="vpgo">Continue with ' + (simple ? 'Focused' : 'Detailed') + '</button>';
      var hello = n ? '<p class="vphello">Lovely to meet you, ' + esc(n) + '.</p>' : '';
      var title = hello + '<h1>Choose your view</h1>';
      if (simple) return '<section class="screen vpage simple">' + title + seg + '<p class="lede c">Just what you need. Nothing else.</p>' + go + '</section>';
      return '<section class="screen vpage"><div>' + (n ? '' : '<div class="eyebrow">Before we start</div>') + title + '</div>' +
        '<div class="vpintro"><p class="lede">Tap each one to try it. This page changes to show you. You can switch any time in Settings.</p></div>' + seg +
        '<ul class="vplist"><li><b>Examples and ideas</b><span>to help you get started</span></li><li><b>Tips and the science</b><span>behind each step</span></li><li><b>Your whole week</b><span>at a glance, plus your past wins</span></li></ul>' +
        '<p class="hint">Good if you like to see the full picture. Prefer fewer words on screen? Try Focused.</p>' + go + '</section>';
    },
    name: function () {
      return '<section class="screen">' + stuCard('Lovely start. I’m Stu, and I’ll be checking in with you along the way.') + '<h1>What should Stu call you?</h1>' +
        '<div class="field"><label class="label" for="firstname">Your name</label><textarea id="firstname" rows="1" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="next" maxlength="40" placeholder="First name, or a nickname">' + esc(firstName()) + '</textarea></div>' +
        '<div class="spacer"></div><button class="btn" data-namego="go">Continue</button><button class="link center" data-namego="skip">Skip for now</button></section>';
    },
    science: function () {
      var h = '<section class="screen"><h1>The science behind it</h1>' +
        '<div class="author"><img src="../letsgo/stuart.jpg" alt="Stuart Fairbairns" loading="lazy"><div class="body">' +
        '<span class="eyebrow">Created by</span><span class="name">Stuart Fairbairns PCC</span>' +
        '<p>Executive coach with over 5,000 hours helping people change how they live and lead. Built using research on planning, tracking progress and coming back after setbacks.</p></div></div><ul class="science">';
      SCIENCE.forEach(function (x) { h += '<li><b>' + esc(x[0]) + '</b><p>' + esc(x[1]) + '</p><a href="' + x[3] + '" target="_blank" rel="noopener">' + esc(x[2]) + '</a></li>'; });
      return h + '</ul><h2 style="margin-top:12px;font-size:24px">More about Stuart</h2>' +
        '<div class="facts"><div><b>5,000+</b><span>hours of one-to-one and group coaching</span></div>' +
        '<div><b>1,000+</b><span>people a year supported by the coaching team he built and led</span></div>' +
        '<div><b>PCC</b><span>ICF Professional Certified Coach, with distinction</span></div>' +
        '<div><b>3</b><span>continents: Europe, Africa and the Americas</span></div></div>' +
        '<div class="bio"><p>Stuart is the founder of Motivate Coaching. He coaches entrepreneurs, senior leaders and whole leadership teams, and has spent more than a decade designing programmes that help people make changes that last.</p>' +
        '<p>As Head of Coaching at One Year No Beer, he built and led a team of 15 coaches supporting more than 1,000 people a year to change one of the most stubborn habits there is.</p>' +
        '<p>His work rests on two ideas: <b>Do It Your Way</b>, because change sticks when it fits who you are, and <b>Hold It Lightly</b>, because a bad day is part of the process, not the end of it. Both run through this tool, and through his forthcoming book, <i>Do It Your Way</i>. He is also the author of <i>10 Ways to Be Happy Today</i>.</p>' +
        '<p>He never stops learning. He is working towards Master Certified Coach, the International Coaching Federation’s highest credential, and has trained further in neuroscience and positive psychology. You may have heard him on Coaches Rising, The Coaching Hour or Coach Conversations.</p>' +
        '<p>What drives him is simple: helping people understand themselves, lead themselves, and build a life that feels like their own.</p></div>' +
        '<p class="hint">This page explains the research the tool is built on. The researchers named here have not reviewed or endorsed it.</p>' + '<a class="link center tlr-link" href="https://www.motivate-coaching.com/thelivingroom" target="_blank" rel="noopener">About The Living Room (TLR) <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a>' + '</section>';
    },
    settings: function () {
      var s = S.settings;
      var sect = function (title, body, open) { return '<details class="sect"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div class="sbody">' + body + '</div></details>'; };
      var h = '<section class="screen settings"><div><h1>Settings</h1><p class="hint" id="syncStatus" style="margin:4px 0 0">' + syncLabel() + '</p></div>';
      // Stuart's own tools sit at the top so they're one tap away.
      if (isTester()) h += '<div class="card soft small"><span class="eyebrow">Your tools (only you see this)</span><a class="btn" href="../letsgo/admin.html">Analytics</a><a class="btn outline" href="../letsgo/admin.html#feedback">Feedback responses</a>' +
        '<button class="btn outline" data-act="copyfeedback">Copy the feedback link</button></div>';
      if (isTester()) h += '<div class="card soft small"><span class="eyebrow">For testing</span><span>Wipes everything, including your account, so you can go through it all again as a new person. Sign in again with the same email and you start blank.</span><button class="btn outline" data-act="testerreset">Start again from scratch</button><button class="btn outline" data-act="testerreload">Reload the latest version</button></div>';
      // The essentials: your nudge, described as it really is.
      var rs = reminderState();
      h += '<div class="card" id="reminders"><span class="eyebrow">Nudges</span><b style="font-weight:600">' + esc(reminderLine()) + '</b>' +
        (user || !sb || !authChecked ? '' : '<div class="card soft small" style="padding:12px 14px"><span>Nudges need somewhere to go. Add your email and you can switch them on.</span><button class="chip" data-account="settings" style="align-self:flex-start;background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Add my email</button></div>') +
        '<div class="row"><label class="label" for="rtime" style="margin:0">Time</label><input class="input" id="rtime" type="time" step="900" value="' + esc(s.time) + '" style="max-width:160px"></div>' +
        '<span class="hint" style="margin-top:-4px">Sent only on days something is planned, and not once you’ve logged it.</span>' +
        '<button class="switch" role="switch" aria-checked="' + !!(user && s.email) + '" data-toggle="email"' + (user ? '' : ' aria-disabled="true"') + '><span><b>Email</b><span class="hint">' + (user ? esc(user.email) : 'Add your email first') + '</span></span><span class="track"></span></button>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.push + '" data-act="push"><span><b>Phone notification</b><span class="hint" id="pushHint">' + pushHint() + '</span></span><span class="track"></span></button>' +
        '<button class="link" data-cal="settings" style="align-self:flex-start;margin-top:8px;display:inline-flex;gap:8px;align-items:center">' + iconCal() + 'Add it to my calendar</button></div>';
      // Everything else, one tap away
      h += '<div class="sects">';
      if (S.habit) {
        var pz = (S.habit.pauses || []).filter(function (x) { return !x.to || x.to >= todayStr(); })[0];
        h += sect('Take a break', '<span>Going away, ill, or just need a few days? Pause your plan. Those days won’t count against you, and your nudges stop too.</span>' +
          (pz ? '<div class="row"><span>' + (pz.from > todayStr() ? 'Break from ' + esc(prettyDate(pz.from)) + ' to ' : 'On a break until ') + esc(prettyDate(pz.to)) + '.</span><button class="chip" data-act="resume">End the break</button></div>' :
            '<div class="chips">' + [[1, 'Today'], [3, '3 days'], [7, 'A week'], [14, 'Two weeks']].map(function (o) { return '<button class="chip" data-pause="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>') +
          '<p class="hint">Your history stays exactly as it is.</p>');
      }
      h += sect('Walk it through', '<span>A minute to see yourself doing it. When suits you?</span><div class="chips">' + [['evening', 'The night before'], ['morning', 'In the morning']].map(function (o) { return '<button class="chip" data-walkwhen="' + o[0] + '" aria-pressed="' + (walkWhen() === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div><p class="hint">The night before suits early habits, like the gym first thing.</p>');
      h += sect('How it looks', '<div class="choices">' +
        '<button class="choice" data-view="full" aria-pressed="' + (s.view === 'full') + '"><b>Detailed</b><small>Examples, tips and your full progress</small></button>' +
        '<button class="choice" data-view="focus" aria-pressed="' + (s.view === 'focus') + '"><b>Focused</b><small>Just the essentials, calmer screens</small></button></div>' +
        '<span class="label">Text size</span><div class="chips">' + [['standard', 'Standard'], ['large', 'Large'], ['larger', 'Larger']].map(function (o) { return '<button class="chip" data-text="' + o[0] + '" aria-pressed="' + (s.text === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        (s.view === 'focus' ? '' : '<button class="switch" role="switch" aria-checked="' + !!s.calm + '" data-toggle="calm"><span><b>Less movement</b></span><span class="track"></span></button>') +
        '<button class="switch" role="switch" aria-checked="' + !!s.buzz + '" data-toggle="buzz"><span><b>Buzz when I tick</b></span><span class="track"></span></button>');
      if (S.habit) h += sect('My plan', '<b style="font-weight:600">' + esc(habitName()) + '</b>' +
        '<button class="btn outline" data-go="plan">See and change my plan</button>' +
        '<button class="btn outline" data-length="settings">Review after: ' + (S.habit.length === 365 ? '1 year' : S.habit.length + ' days') + '</button>' +
        '<button class="link" data-act="newhabit" style="align-self:flex-start">Start a new plan</button>');
      h += sect('You and your data', '<div class="field"><label class="label" for="sname">Your first name</label><textarea id="sname" rows="1" data-name="1" autocomplete="given-name" placeholder="So we can say hello">' + esc(firstName()) + '</textarea></div>' +
        (user ? '<span>Signed in as <b>' + esc(user.email) + '</b></span>' : '<span>Saved on this device only.</span><button class="btn" data-account="settings">Save my progress</button>') +
        '<button class="switch" role="switch" aria-checked="' + (s.analytics !== false) + '" data-toggle="analytics"><span><b>Help improve <span class="brand">Let’s Go<span class="bang">!</span></span></b><span class="hint">Shares which buttons you tap, never what you write.</span></span><span class="track"></span></button>' +
        (user ? '<button class="switch" role="switch" aria-checked="' + !!s.marketing + '" data-toggle="marketing"><span><b>Ideas and updates from Stuart</b><span class="hint">Occasional emails. Off unless you choose.</span></span><span class="track"></span></button>' : '') +
        '<p class="hint">Your notes are private to you. During the pilot, Stuart can see your plan and how often you show up, never your notes. Words you type into the AI helper are sent to our AI provider, Anthropic, only to suggest ideas, and we don’t keep them.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px;justify-content:flex-start"><button class="chip" data-act="exportdata">Download my data</button><button class="chip" data-act="deletedata">Delete my <span class="brand">Let’s Go<span class="bang">!</span></span> data</button></div>' +
        '<a class="link" href="../letsgo/privacy.html" style="align-self:flex-start">Privacy notice</a>' + '<a class="link" href="../letsgo/terms.html" style="align-self:flex-start">Terms of use</a>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.tlrMember + '" data-act="tlrtoggle"><span><b>I’m in The Living Room</b><span class="hint">Shows member prices for booster calls.</span></span><span class="track"></span></button>' + (user ? '<button class="link" data-act="signout" style="align-self:flex-start">Sign out</button>' : ''));
      if (!isStandalone()) h += sect('Get the app', '<span>Put it on your home screen so it opens like an app.</span><button class="btn outline" data-act="install">Show me how</button>');
      h += sect('About', '<button class="link" data-go="science" style="align-self:flex-start">The science behind it</button><a class="link tlr-link" href="https://www.motivate-coaching.com/thelivingroom" target="_blank" rel="noopener" style="align-self:flex-start">About The Living Room (TLR) <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a><p class="hint" style="margin:4px 0 0">Let’s Go!™ is a trade mark of Stuart Fairbairns, trading as Motivate Coaching.</p>');
      return h + '</div></section>';
    },
    edit: function () { ui.planEdit = true; return focusEditor(); },
    install: function () {
      var ios = isIOS(), android = /android/i.test(navigator.userAgent), phone = ios || android, after = ui.installFrom === 'tracker';
      var h = '<section class="screen"><div><div class="eyebrow">' + (after ? 'One last thing' : 'Get the app') + '</div><h1>Put it on your phone</h1></div>' +
        (android && deferredInstall ? '<p class="lede">One tap and it’s on your home screen, like any other app.</p>' : '<p class="lede"><span class="full-only">A few taps and it’s on your home screen, like any other app. No app store needed.</span><span class="focus-only">A few taps. That’s it.</span></p>');
      if (isStandalone()) h += '<div class="card soft"><b style="font-weight:600">You’re all set.</b><span>It’s already on this device as an app.</span></div>';
      else if (android && deferredInstall) {
        h += '<button class="btn" data-act="doinstall">' + iconDownload() + 'Add to my phone</button>' +
          '<details class="ask"><summary>Button not working?</summary>' + installSteps('android') + '</details>';
      }
      else if (phone) {
        if (ios) h += '<p class="hint" style="margin-top:-8px">iPhones don’t allow a one-tap button, so it’s two quick taps in Safari.</p>';
        h += installSteps(ios ? 'ios' : 'android');
        h += '<details class="ask"><summary>' + (ios ? 'On Android instead?' : 'On an iPhone instead?') + '</summary>' + installSteps(ios ? 'android' : 'ios') + '</details>';
      } else {
        h += '<div class="card qrcard"><img src="qr.svg" width="132" height="132" alt="QR code for the Let’s Go! app"><div><b>Point your phone’s camera here</b><span class="hint">Then tap the link that pops up.</span><button class="chip" data-act="copylink">Or copy the link</button></div></div>' +
          (user ? '<p class="hint">On your phone, sign in with ' + esc(user.email) + ' and your plan will be there.</p>' : '<p class="hint">The code opens the app, not your plan. To bring your plan to your phone, <button class="link inline" data-account="install">add your email here first</button>, then sign in with it on your phone.</p>') +
          '<details class="ask"><summary>Then what?</summary><span class="eyebrow" style="display:block;margin:10px 0 6px">iPhone</span>' + installSteps('ios') + '<span class="eyebrow" style="display:block;margin:16px 0 6px">Android</span>' + installSteps('android') + '</details>' +
          (deferredInstall ? '<button class="btn outline" data-act="doinstall">Or install it on this computer</button>' : '');
      }
      h += '<button class="link" data-cal="install" style="align-self:flex-start;display:inline-flex;gap:8px;align-items:center;text-align:left">' + iconCal() + 'Prefer a calendar reminder? Add it to my calendar</button>';
      return h + '<div class="spacer"></div>' + (after ? '<button class="btn' + (isStandalone() ? '' : ' outline') + '" data-act="installdone">' + (isStandalone() ? 'Go to my tracker' : 'Done, take me to my tracker') + '</button>' :
        '<button class="btn outline" data-back="1">Back</button>') + '</section>';
    },
    sendplan: function () {
      if (ui.authStep === 'code') return screens.account();
      return '<section class="screen"><div><div class="eyebrow">Your plan is ready</div><h1>Who should we send your plan to?</h1></div>' +
        '<p class="lede">We’ll email you your plan and a 6-digit code to activate it. No password needed.</p>' +
        '<div class="field"><label class="label" for="aemail">Email</label><input class="input" id="aemail" type="email" autocomplete="email" inputmode="email" value="' + esc(ui.authEmail || '') + '"></div>' +
        (S.consentAt ? '' : '<label class="consent"><input type="checkbox" id="aconsent"><span>I agree to <span class="brand">Let’s Go<span class="bang">!</span></span> storing my habit, progress and notes so it can run for me. <a href="../letsgo/privacy.html">Privacy</a></span></label>') +
        '<p class="err" id="aerr" hidden></p><button class="btn" data-act="sendcode">Send my plan</button>' +
        '<button class="link center" data-act="plannotnow">Not now</button>' +
        '<p class="hint">Your plan is saved to your account, so it’s backed up and your morning nudge can reach you. <a href="../letsgo/privacy.html">How we look after your data</a></p></section>';
    },
    account: function () {
      var priv = '<p class="hint">Saving to an account backs up your progress and lets your nudges reach you. <a href="../letsgo/privacy.html">How we look after your data</a></p>';
      var pl = ui.authFrom === 'plan';
      if (ui.authStep === 'code') return '<section class="screen"><div><div class="eyebrow">' + (pl ? 'Activate your plan' : 'Save my progress') + '</div><h1>Check your email</h1></div>' +
        '<p class="lede">' + (pl ? 'We’ve sent your plan and a 6-digit code to <b>' + esc(ui.authEmail) + '</b>. Pop the code in below to activate your plan and get started today.' : 'We’ve sent a 6-digit code to <b>' + esc(ui.authEmail) + '</b>.') + '</p>' +
        '<div class="field"><label class="label" for="acode">Your code</label><div class="otp"><input id="acode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-describedby="aerr"><div class="otp-boxes" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div></div></div>' +
        '<p class="err" id="aerr" hidden></p><button class="btn" data-act="verifycode">' + (pl ? 'Activate my plan' : 'Sign in') + '</button>' +
        '<div class="row" style="justify-content:center;gap:16px"><button class="link" data-act="sendcode">Send a new code</button><button class="link" data-act="authback">Use a different email</button></div>' +
        '<p class="hint">Can’t see it? Check your spam or promotions folder.</p></section>';
      return '<section class="screen"><div><div class="eyebrow">Save my progress</div><h1>Sign in or create your account</h1></div>' +
        '<p class="lede">Just your email. We’ll send you a 6-digit code, so there’s no password to remember.</p>' +
        '<div class="field"><label class="label" for="aemail">Email</label><input class="input" id="aemail" type="email" autocomplete="email" inputmode="email" value="' + esc(ui.authEmail || '') + '"></div>' +
        (S.consentAt ? '' : '<label class="consent"><input type="checkbox" id="aconsent"><span>I agree to <span class="brand">Let’s Go<span class="bang">!</span></span> storing my habit, progress and notes so it can run for me. <a href="../letsgo/privacy.html">Privacy</a></span></label>') +
        '<p class="err" id="aerr" hidden></p><button class="btn" data-act="sendcode">Send my code</button>' + priv + '</section>';
    }
  };



  function ideasSheet() {
    var h = '<div class="sheet-bg" data-act="closeideas"><div class="sheet" role="dialog" aria-label="Ideas" data-stop="1"><div class="row"><b style="font-size:20px;font-weight:600">Some ideas</b><button class="link" data-act="closeideas">Close</button></div>' +
      '<p class="hint">Pick one that genuinely pulls at you.</p>';
    IDEAS.forEach(function (i, k) { h += '<button class="idea" data-idea="' + k + '"><span>' + esc(i[0]) + '<small>' + esc(i[1]) + '</small></span><b style="font-size:14px">Use</b></button>'; });
    return h + '</div></div>';
  }
  function prettyDate(s) { try { return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return s; } }
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function pushHint() {
    if (S.settings.push) return 'On for this device.';
    if (isIOS() && !isStandalone()) return 'Add it to your home screen first, then switch this on.';
    if (!pushSupported()) return 'This browser can’t do it. Email still works.';
    if (window.Notification && Notification.permission === 'denied') return 'Blocked in your browser settings.';
    return 'A gentle buzz at the same time.';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Their name: what they told us, else their account, else a careful guess from the email.
  function guessName() {
    var m = (user && user.user_metadata) || {}, n = m.first_name || m.name || '';
    if (!n && user && user.email) { var p = user.email.split('@')[0].split(/[._-]/)[0]; if (/^[a-z]{2,}$/i.test(p)) n = p; }
    return n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '';
  }
  // Ask their name once, right after they choose to begin (skipped if we already know it).
  function askNameThen(next) {
    ui.afterName = next;
    if (firstName() || S.nameAsked) return go(S.viewChosen ? next : 'viewpick');
    return go('name');
  }
  function nameDone(skip) {
    var el = document.getElementById('firstname'), v = el ? el.value.replace(/\s+/g, ' ').trim() : '';
    S.nameAsked = true;
    if (!skip && v) { saveName(v); if (S.viewChosen && ui.afterName !== 'find') toast('Lovely to meet you, ' + v + '.'); }
    else save(false);
    if (!S.viewChosen) return go('viewpick');
    go(ui.afterName || 'what');
  }
  function firstName() { return (S.settings.name || '').trim() || guessName(); }
  function saveName(n) {
    S.settings.name = n.trim(); save();
    if (user && sb && n.trim()) sb.auth.updateUser({ data: { first_name: n.trim() } }).catch(function () {});
  }
  function dayPart(h) { return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }
  // Greeting: appears instantly, holds long enough to read, leaves quickly. Once per part of the day.
  function greet() {
    if (!S.habit) return;
    var now = new Date(), part = dayPart(now.getHours()), key = todayStr() + '-' + part;
    if (S.lastGreet === key) return;
    S.lastGreet = key; save(false);
    var n = firstName();
    var el = document.createElement('div');
    el.className = 'greet'; el.setAttribute('role', 'status');
    el.innerHTML = '<p>Good ' + part + (n ? ',<br>' + esc(n) + '.' : '.') + '</p>';
    document.body.appendChild(el);
    var calm = document.documentElement.classList.contains('calm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var gone = false;
    var leave = function () {
      if (gone) return; gone = true;
      if (calm) { el.remove(); return; }
      el.classList.add('out'); setTimeout(function () { el.remove(); }, 220);
    };
    el.addEventListener('pointerdown', leave);
    setTimeout(leave, 900);
  }
  window.__showupGreetReset = function () { S.lastGreet = ''; save(false); };


  // ── V2 layer helpers: section headings, honest stats and the two charts ──
  var ICON = {
    today: '<path d="M12 4v2M12 18v2M4 12H2M22 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
    week: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    chart: '<path d="M5 20V12M10 20V7M15 20v-5M20 20V4"/>',
    task: '<path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="4" width="16" height="16" rx="3"/>'
  };
  function secHead(k, title, right) { return '<div class="sec-h"><span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICON[k] + '</svg></span><h2>' + title + '</h2>' + (right ? '<span class="sec-r">' + right + '</span>' : '') + '</div>'; }
  // "So far" counts days up to yesterday, plus today once it's ticked, so an unticked today never looks like a gap.

  function render() {
    var s = screens[S.screen] ? S.screen : 'landing';
    if (s === 'tracker' && !S.habit) s = 'landing';
    document.documentElement.setAttribute('data-screen', s);
    var focus = S.settings.view === 'focus';
    document.documentElement.classList.toggle('focus-mode', focus);

    var TABS = { tracker: 1, progress: 1, plan: 1, slipped: 1 }, showTabs = !!S.habit && !!TABS[s] && !(s === 'plan' && ui.planEdit);
    tabsEl.hidden = !showTabs; document.documentElement.classList.toggle('has-tabs', showTabs);
    tabsEl.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === s ? 'page' : 'false'); });
    view.innerHTML = screens[s]();
    // V2 design layer: on setup question screens, the question and its answer sit together in one clear card.
    if (['feel', 'what', 'when', 'less', 'often', 'dimmer', 'hard', 'mine', 'say', 'name', 'note', 'sendplan', 'account', 'length'].indexOf(s) >= 0) {
      var sec = view.querySelector('section.screen'), h1 = sec && sec.querySelector(':scope > h1, :scope > div > h1');
      if (h1) {
        var card = document.createElement('div'); card.className = 'qcard';
        var node = h1, stop = false; // a heading wrapped with an eyebrow moves in on its own
        if (h1.parentElement !== sec) { var wrap = h1.parentElement; wrap.parentElement.insertBefore(card, wrap.nextSibling); card.appendChild(h1); node = card.nextElementSibling; }
        else { sec.insertBefore(card, h1); node = h1; }
        while (node && !stop) { var nx = node.nextElementSibling; if (node.classList.contains('spacer') || node.matches('button.btn, [data-step-next]')) stop = true; else if (node !== card) card.appendChild(node); node = nx; }
      }
    }
    backBtn.classList.toggle('ghost', !BACK[s] && !ui.hist.length);
    fwdBtn.classList.toggle('ghost', !ui.fwd.length);
    settingsBtn.classList.toggle('ghost', s === 'settings' || (!isTester() && (!S.habit || ['what', 'when', 'less', 'feel', 'often', 'dimmer', 'hard'].indexOf(s) >= 0)));
    view.querySelectorAll('textarea').forEach(grow);
    if (s === 'words') startSphere();
    window.scrollTo(0, 0);
  }
  // Back goes to the screen they were just on; forward returns them to where they were. What they typed is kept.
  // ── Usage stats (which buttons and screens, never anything written). Off via Settings. ──
  var statQ = [], statSid = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).slice(0, 36), statTimer = null, statShown = Date.now();
  function stat(event, detail) {
    if (S.settings.analytics === false || !sb) return;
    var now = Date.now(), ms = event === 'screen' ? Math.min(now - statShown, 86400000) : null;
    var ua = navigator.userAgent, plat = isIOS() ? 'ios' : /android/i.test(ua) ? 'android' : /mobile/i.test(ua) ? 'other' : 'desktop';
    statQ.push({ user_id: user ? user.id : null, session_id: statSid, event: String(event).slice(0, 40), screen: String(S.screen || '').slice(0, 30), detail: detail == null ? null : String(detail).slice(0, 60),
      view_mode: S.settings.view === 'focus' ? 'focus' : 'full', platform: plat, installed: isStandalone(), local_hour: new Date().getHours(), day_num: S.habit ? Math.min(todayNum(), 999) : null, ms: ms });
    if (event === 'screen') statShown = now;
    if (!statTimer) statTimer = setTimeout(flushStats, 5000);
  }
  function flushStats() {
    clearTimeout(statTimer); statTimer = null;
    if (!statQ.length || !sb || S.settings.analytics === false) { statQ = []; return; }
    var rows = statQ.splice(0, 50);
    try { sb.from('showup_events').insert(rows).then(function () {}, function () {}); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushStats(); });
  function go(s, nav) {
    if (s !== S.screen) stat('screen', s);
    if (s !== S.screen) {
      ui.planEdit = false;
      if (!nav) {
        if (s === 'tracker' || s === 'landing' || s === 'ready') ui.hist = [];
        else if (S.screen && S.screen !== s) ui.hist.push(S.screen);
        ui.fwd = [];
      }
    }
    // Keep the phone's own Back button in step with the app, so it steps back through screens instead of leaving.
    if (!nav && s !== S.screen) { try { history.pushState({ lg: 1 }, ''); ui.depth = (ui.depth || 0) + 1; } catch (e) {} }
    S.screen = s; save(false); render();
    var h1 = view.querySelector('h1'); if (h1 && !nav) { h1.setAttribute('tabindex', '-1'); try { h1.focus({ preventScroll: true }); } catch (e) {} }
  }
  window.addEventListener('popstate', function () { if (ui.depth > 0) ui.depth--; if (document.querySelector('.sheet-bg')) { var sh = document.querySelector('.sheet-bg'); sh.remove(); return; } goBack(true); });
  function appBack() { if (ui.depth > 0) { try { history.back(); return; } catch (e) {} } goBack(); }
  function goBack() {
    if (S.screen === 'find' && S.find && S.find.focus) {
      var ff = S.find;
      if (ff.step >= FIND_QS().length) { ff.step = 1; ff.ai = null; ff.aiTried = false; save(false); return render(); }
      if (ff.step === 1) { ff.focus = null; save(false); return render(); }
    }
    if (S.screen === 'find' && S.find && S.find.ai && S.find.r && S.find.r !== 'areas') { S.find.r = S.find.r === 'ideas' ? 'insight' : 'areas'; save(false); return render(); }
    if (S.screen === 'find' && S.find && S.find.step > 0) { S.find.step--; save(false); return render(); }
    var prev = ui.hist.pop();
    if (prev && screens[prev]) { ui.fwd.push(S.screen); return go(prev, true); }
    var b = BACK[S.screen]; if (typeof b === 'function') b = b(); go(b || (S.habit ? 'tracker' : 'landing'));
  }
  function goForward() {
    var next = ui.fwd[ui.fwd.length - 1]; if (!next) return;
    var nb = view.querySelector('[data-step-next]');
    if (nb && nb.disabled) return toast('Fill this one in first.');
    ui.fwd.pop(); ui.hist.push(S.screen); go(next, true);
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 3, 58) + 'px'; }

  // ── The tick ──────────────────────────────────────────────────────────────
  var authChecked = false;
  function isCalm() { return document.documentElement.classList.contains('calm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function confettiHTML(n) {
    if (isCalm()) return '';
    var bits = '', cols = ['#C9930A', '#F5F1EB', '#FFFFFF', '#888880', '#EDE8DF'];
    for (var i = 0; i < n; i++) {
      var x = Math.random() * 100, dx = (Math.random() * 60 - 30).toFixed(0), rot = (Math.random() * 720 - 360).toFixed(0);
      var w = 6 + Math.random() * 6, h2 = 8 + Math.random() * 10, d = (1.6 + Math.random() * 1.4).toFixed(2), del = (Math.random() * 0.5).toFixed(2);
      bits += '<i class="cf" style="left:' + x.toFixed(1) + '%;width:' + w.toFixed(0) + 'px;height:' + h2.toFixed(0) + 'px;background:' + cols[i % cols.length] + ';--dx:' + dx + 'vw;--rot:' + rot + 'deg;animation-duration:' + d + 's;animation-delay:' + del + 's;border-radius:' + (i % 3 ? '2px' : '50%') + '"></i>';
    }
    return '<div class="confetti" aria-hidden="true">' + bits + '</div>';
  }
  function extra() { if (!S.habit) return {}; if (!S.habit.extra || typeof S.habit.extra !== 'object') S.habit.extra = {}; return S.habit.extra; }
  // A comeback is the first show-up after a gap. Worked out from the whole record, so filling in past days keeps it right.
  function clearBadge() { try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') clearBadge(); });

  // ── One day, opened from the grid ─────────────────────────────────────────

  // ── Catch-up after a gap ──────────────────────────────────────────────────

  // ── The two buttons that matter ───────────────────────────────────────────
  // The last seven days as tappable dots, today last.

  // ── Not signed in: nudges can't reach you ─────────────────────────────────
  // ── Stu as the guide: his photo and a short line at the moments that matter ──


  // ══ V2 engine: actions, schedules, check-ins and progress ═════════════════
  // Everything here reads the plan through model.js, so Today, Progress, reminders and the calendar agree.

  var DN3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function describeRule(r) { return r ? M.describe(r) : ''; }
  function ruleNow(a) { return M.ruleFor(a, todayStr()) || (a.schedules || [])[0]; }
  function weekdayLong(d) { return DAY_LABELS[new Date(d + 'T12:00:00').getDay()]; }
  function relDay(d) { var t = todayStr(); if (d === t) return 'today'; if (d === addDays(t, 1)) return 'tomorrow'; if (d === addDays(t, -1)) return 'yesterday'; var n = daysBetween(t, d); return n > 0 && n < 7 ? weekdayLong(d) : prettyDate(d); }
  function nextPlanned() { var best = null; liveActs().forEach(function (a) { var n = M.nextDue(S.habit, a, todayStr()); if (n && (!best || n < best.d)) best = { d: n, a: a }; }); return best; }

  // ── Recording ──────────────────────────────────────────────────────────────
  // kind: 'full' (did it), 'small' (the lighter version), 'none' (not counted, but any note is kept).
  function setEntry(a, d, kind, extraFields) {
    var e = a.entries[d] || { kind: 'none', note: '' };
    e.kind = kind; if (kind !== 'none') e.late = d < todayStr();
    if (extraFields) Object.assign(e, extraFields);
    a.entries[d] = e; touchC(a, d);
    if (kind !== 'none') { var nt = extra().noticed; if (nt && nt[d]) { delete nt[d]; touchF(); } }
  }
  function comebackOn(a, d) { return M.isComeback(S.habit, a, d); }
  function comebacks() { var n = 0; acts().forEach(function (a) { Object.keys(a.entries || {}).forEach(function (d) { if (d <= todayStr() && comebackOn(a, d)) n++; }); }); return n; }
  // Log an action for a date. From Today this celebrates; from the past it just counts.
  function logAct(id, kind, d, from) {
    var a = actById(id); if (!a || !S.habit) return;
    d = d || todayStr();
    if (notStarted() && d === todayStr()) { S.habit.start = todayStr(); S.later = false; touchF(); }
    var wasAny = anyCountedOn(d);
    setEntry(a, d, kind === 'small' ? 'small' : 'full');
    save(); buzz();
    stat('log', kind + (d === todayStr() ? '' : ':late'));
    if (d !== todayStr()) { toast(relDay(d).charAt(0).toUpperCase() + relDay(d).slice(1) + ' counted. That’s ' + count() + ' show-up' + (count() === 1 ? '' : 's') + '.'); return render(); }
    var n = count(), cb = comebackOn(a, d), name = firstName();
    // A bigger moment for the first show-up, a comeback and every seventh; otherwise a quick, quiet thank-you.
    if (!wasAny && (n === 1 || cb || n % 7 === 0)) {
      var title = (n === 1 ? 'First one done' : cb ? 'Welcome back' : n + ' show-ups') + (name ? ', ' + esc(name) : '') + '.';
      var sub = cb ? 'You came back. That’s the bit that builds it.' : n === 1 ? 'You’ve started. Some days a 10, some a 1. Both count.' : 'Showing up, again and again. That’s how it becomes yours.';
      return celebrate(title, sub, from);
    }
    toast((kind === 'small' ? 'Lighter version counted. ' : 'Counted. ') + 'That’s ' + n + ' show-up' + (n === 1 ? '' : 's') + '.');
    if (from === 'slipped') return go('tracker');
    render();
  }
  function unlogAct(id, d) {
    var a = actById(id); if (!a) return;
    d = d || todayStr(); if (!a.entries[d]) return;
    setEntry(a, d, 'none'); save(); toast('Undone. Any note is kept.'); render();
  }
  function celebrate(title, sub, from) {
    var el = document.createElement('div');
    el.className = 'celebrate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', title.replace(/<[^>]+>/g, ''));
    el.innerHTML = confettiHTML(60) + '<div class="burst"><span class="ring"></span><div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">' + title + '</div><div class="s">' + esc(sub) + '</div></div><button class="tapon" data-c="close">Carry on</button>';
    app.appendChild(el);
    var closed = false, close = function () { if (closed) return; closed = true; el.remove(); document.removeEventListener('keydown', onKey); if (from === 'slipped') go('tracker'); else render(); };
    var onKey = function (ev) { if (ev.key === 'Escape' || ev.key === 'Enter') close(); };
    el.addEventListener('click', close); document.addEventListener('keydown', onKey);
    var b = el.querySelector('[data-c]'); if (b) b.focus({ preventScroll: true });
    setTimeout(close, isCalm() ? 2200 : 3200);
  }

  // ── Progress numbers, honestly counted ─────────────────────────────────────
  // Planned days only: rest days and paused days never count against anyone, and an unticked today is not a gap yet.
  function todayOpen() { var t = todayStr(), n = 0; liveActs().forEach(function (a) { if (M.isDue(S.habit, a, t) && !counted(a.entries[t])) n++; }); return n; }
  function stats() {
    var f = S.habit, end = todayStr() < lastDate() ? todayStr() : lastDate();
    if (end < f.start) return { done: 0, full: 0, light: 0, planned: 0, unlogged: 0, backs: 0, week: 0, weekOf: 0 };
    var all = M.tally(f, f.start, end), open = end === todayStr() ? todayOpen() : 0;
    var wFrom = addDays(end, -6) < f.start ? f.start : addDays(end, -6), wk = M.tally(f, wFrom, end);
    return { done: all.done, full: all.full, light: all.small, planned: Math.max(0, all.planned - open), unlogged: all.unlogged, backs: comebacks(), week: wk.done, weekOf: Math.max(0, wk.planned - open) };
  }
  function barChart(H) {
    var series = M.weeklySeries(S.habit).slice(-8); if (!series.length) return '';
    var W = 320, n = series.length, bw = Math.min(30, (W - 20) / n - 10), max = Math.max(3, Math.max.apply(null, series.map(function (x) { return Math.max(x.planned, x.done); })));
    var first = M.weekStart(S.habit.start);
    var g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 22) + '" role="img" aria-label="Show-ups each week">';
    series.forEach(function (x, i) {
      var cx = 10 + (i + 0.5) * ((W - 20) / n), xl = cx - bw / 2, sc = (H - 8) / max, wn = Math.round(daysBetween(first, x.week) / 7) + 1;
      if (x.planned) g += '<rect x="' + xl + '" y="' + (H - x.planned * sc) + '" width="' + bw + '" height="' + (x.planned * sc) + '" rx="4" fill="none" stroke="#9A907F" stroke-width="1.5" stroke-dasharray="3 3"/>';
      if (x.full) g += '<rect x="' + xl + '" y="' + (H - x.full * sc) + '" width="' + bw + '" height="' + (x.full * sc) + '" rx="4" fill="#3B6D11"/>';
      if (x.small) g += '<rect x="' + xl + '" y="' + (H - (x.full + x.small) * sc) + '" width="' + bw + '" height="' + (x.small * sc) + '" rx="4" fill="#C9930A"/>';
      g += '<text x="' + cx + '" y="' + (H + 16) + '" font-size="11" text-anchor="middle" fill="#4A4A4A" font-family="Poppins, sans-serif">Wk ' + wn + '</text>';
    });
    return g + '</svg>' + '<p class="sr">' + series.map(function (x, i) { return 'Week ' + (i + 1) + ': ' + x.done + ' of ' + x.planned + ' planned.'; }).join(' ') + '</p>';
  }
  function lineChart() {
    var f = S.habit, end = todayStr() < lastDate() ? todayStr() : lastDate(), days = daysBetween(f.start, end) + 1;
    if (days < 2) return '<p class="hint">Your running total appears here after your first couple of days.</p>';
    var pts = [], done = 0, plan = 0;
    for (var i = 0; i < days; i++) {
      var d = addDays(f.start, i), t = M.tally(f, d, d);
      done += t.done; plan += t.planned - (d === todayStr() ? todayOpen() : 0); pts.push({ done: done, plan: Math.max(plan, 0) });
    }
    var W = 320, H = 130, max = Math.max(1, plan, done), x = function (i) { return 6 + i / (pts.length - 1) * (W - 12); }, y = function (v) { return H - 6 - v / max * (H - 18); };
    var path = function (k) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1); }).join(' '); };
    var last = pts[pts.length - 1];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="' + last.done + ' show-ups from ' + last.plan + ' planned so far">' +
      '<defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3B6D11" stop-opacity=".35"/><stop offset="1" stop-color="#3B6D11" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + path('done') + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - 6) + ' L' + x(0) + ' ' + (H - 6) + ' Z" fill="url(#lg)"/>' +
      '<path d="' + path('plan') + '" fill="none" stroke="#9A907F" stroke-width="1.5" stroke-dasharray="4 4"/>' +
      '<path d="' + path('done') + '" fill="none" stroke="#3B6D11" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + x(pts.length - 1) + '" cy="' + y(last.done) + '" r="5" fill="#fff" stroke="#3B6D11" stroke-width="2.5"/>' +
      '<text x="6" y="' + (H + 14) + '" font-size="11" fill="#4A4A4A" font-family="Poppins, sans-serif">Day 1</text><text x="' + (W - 6) + '" y="' + (H + 14) + '" font-size="11" text-anchor="end" fill="#4A4A4A" font-family="Poppins, sans-serif">Today</text></svg>';
  }
  var DAY_WORD = { full: 'showed up', small: 'lighter version', rest: 'rest day', paused: 'paused', planned: 'planned', today: 'today', unlogged: 'not logged' };
  function dayClass(sm, d) { var nt = (extra().noticed || {})[d]; return { full: 'full', small: 'full small', rest: 'rest', paused: 'rest paused', planned: 'ahead', today: 'today', unlogged: 'missed' + (nt ? ' noticed' : '') }[sm.s] + (sm.note ? ' has-note' : ''); }
  function gridHTML(t, tappable) {
    var h = '<div class="grid">', L = S.habit.length;
    for (var n = 1; n <= L; n++) {
      var d = dayDate(n), sm = daySummary(d), c = 'day ' + dayClass(sm, d), lab = 'Day ' + n + ', ' + prettyDate(d) + ', ' + DAY_WORD[sm.s];
      if (tappable && d <= todayStr()) h += '<button class="' + c + '" data-date="' + d + '" aria-label="' + esc(lab) + '">' + n + '</button>';
      else h += '<span class="' + c + '" aria-label="' + esc(lab) + '">' + n + '</span>';
    }
    return h + '</div>';
  }
  // This week, Monday to Sunday, so a weekly target reads the way people think about it.
  function weekHTML() {
    var ws = M.weekStart(todayStr()), h = '<div class="week">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), inPlan = d >= S.habit.start && d <= lastDate(), sm = inPlan ? daySummary(d) : { s: 'out' };
      var c = 'wd' + (sm.s === 'full' ? ' on' : sm.s === 'small' ? ' on small' : sm.s === 'today' ? ' today' : sm.s === 'rest' || sm.s === 'paused' ? ' rest' : sm.s === 'planned' ? ' ahead' : sm.s === 'out' ? ' out' : '');
      var lab = DAY_LABELS[new Date(d + 'T12:00:00').getDay()] + (sm.s === 'out' ? ', outside your plan' : ', ' + DAY_WORD[sm.s]);
      var inner = '<span>' + DN3[new Date(d + 'T12:00:00').getDay()].charAt(0) + '</span><i></i>';
      h += inPlan && d <= todayStr() ? '<button class="' + c + '" data-date="' + d + '" aria-label="' + esc(lab) + '">' + inner + '</button>' : '<span class="' + c + '" aria-label="' + esc(lab) + '">' + inner + '</span>';
    }
    return h + '</div>';
  }

  // ── Today ──────────────────────────────────────────────────────────────────
  function actionCard(a, wk, compact) {
    var d = todayStr(), e = a.entries[d], done = counted(e), many = liveActs().length > 1;
    var sub = [];
    if (anchorLine(a)) sub.push(anchorLine(a));
    if (wk) sub.push(wk.done + ' of ' + wk.target + ' this week');
    var h = '<div class="actcard' + (done ? ' done' : '') + '" data-actcard="' + a.id + '"><div class="act-top"><b class="act-t">' + esc(a.text) + '</b>' + (sub.length ? '<span class="act-s">' + esc(sub.join(' · ')) + '</span>' : '') + '</div>';
    if (done) {
      h += '<div class="act-done"><span class="tickdot' + (e.kind === 'small' ? ' small' : '') + '">' + checkIcon('#FFFFFF') + '</span><span>' + (e.kind === 'small' ? 'Lighter version done' : 'Done today') + '</span></div>' +
        '<div class="row act-tools"><button class="link" data-note="' + a.id + '">' + (e.note ? 'Edit note' : 'Add a note') + '</button><button class="link" data-unlog="' + a.id + '">Undo</button></div>';
    } else {
      h += '<button class="btn showup-btn" data-log="full" data-a="' + a.id + '">' + checkIcon('#FFFFFF') + (many ? 'Done' : 'I showed up today') + '</button>' +
        (a.small ? '<button class="btn outline lighter-btn" data-log="small" data-a="' + a.id + '"><span>Lighter version</span><small>' + esc(a.small) + '</small></button>' : '') +
        (compact ? '' : (e && e.note ? '<button class="link" data-note="' + a.id + '" style="align-self:flex-start">Edit note</button>' : ''));
    }
    return h + '</div>';
  }
  function todaySection(focus) {
    var f = S.habit, t = todayNum(), L = f.length, h = '';
    if (f.finishedOn) return '<b style="font-size:18px;font-weight:600">You finished on ' + esc(prettyDate(f.finishedOn)) + '.</b><span style="color:var(--text-mid)">Ready for what’s next?</span><button class="btn" data-act="newhabit">Start something new</button><button class="link center" data-act="reopen">Keep going with this one</button>';
    if (t > L) return '<b style="font-size:18px;font-weight:600">You gave it ' + L + ' days.</b><span style="color:var(--text-mid)">Time for your look back: what you noticed, and what’s next.</span><button class="btn" data-go="reflect">Start my look back</button>';
    if (M.isPaused(f, todayStr())) { var p = (f.pauses || []).filter(function (x) { return todayStr() >= x.from && (!x.to || todayStr() <= x.to); })[0]; return '<div class="allgood"><span class="bigstar" style="width:20px;height:20px"></span>On a break' + (p && p.to ? ' until ' + esc(prettyDate(p.to)) : '') + '. These days don’t count against you.</div><button class="link" data-act="resume" style="align-self:flex-start">I’m back. Resume now</button>'; }
    var list = M.todayList(f), items = list.due.map(function (a) { return { a: a }; }).concat(list.weekly.map(function (w) { return { a: w.a, wk: w.p }; }));
    items = items.filter(function (x) { return liveActs().indexOf(x.a) >= 0; });
    if (!liveActs().length) return '<span>Your plan has no actions yet.</span><button class="btn" data-editact="new">Add an action</button>';
    if (!items.length) {
      var nx = nextPlanned();
      return '<div class="allgood restday"><span class="bigstar" style="width:20px;height:20px"></span>Nothing planned today. Rest is part of the plan.</div>' +
        (nx ? '<span class="hint">Next up: <b>' + esc(nx.a.text) + '</b>, ' + esc(relDay(nx.d)) + '.</span>' : '') +
        '<button class="link" data-act="logextra" style="align-self:flex-start">Did something anyway? Log it</button>' + walkCard(t, focus);
    }
    h += walkCard(t, focus);
    items.forEach(function (x) { h += actionCard(x.a, x.wk, focus); });
    var allDone = items.every(function (x) { return counted(x.a.entries[todayStr()]); });
    if (allDone) h += '<div class="allgood"><span class="bigstar" style="width:20px;height:20px"></span>' + esc(doneMsg()) + '</div>' + (t === L && !S.fb.reflect ? '<button class="btn" data-go="reflect">That’s your last day. Start my look back</button>' : '');
    else h += '<button class="link center struggle-link" data-go="slipped">Finding today tough?</button>';
    return h;
  }
  function doneMsg() { var n = count(); return 'All done for today. That’s ' + n + ' show-up' + (n === 1 ? '' : 's') + '.'; }
  function focusTracker() {
    var t = todayNum(), L = S.habit.length;
    var h = '<section class="screen focus fmin"><h1>' + esc(habitName()) + '</h1><p class="hint c">' + (t > L ? 'All ' + L + ' days done' : 'Day ' + t + ' of ' + L) + '</p>' + (mineLine() && t <= L ? '<p class="mineline c">“' + esc(mineLine()) + '”</p>' : '');
    h += '<div class="big">' + todaySection(true) + '</div>';
    if (t <= L) h += stuDay(t);
    var catchUp = catchDays().length;
    h += '<div class="spacer"></div><div class="fminfoot"><details class="ask"' + (catchUp ? ' open' : '') + '><summary>' + (catchUp ? 'Fill in a past day' : 'My days') + '</summary><div class="card" style="padding:16px">' + (catchUp ? catchUpCard() : '') + gridHTML(t, true) + '<p class="hint" style="margin:0">Tap any day to fill it in, change it or add a note.</p></div></details>' +
      '<button class="link" data-go="plan">My plan</button></div>';
    return h + '</section>';
  }

  // ── One day, opened from the week or the grid ─────────────────────────────
  var GOT_IN_WAY = ['I just forgot', 'Ran out of time', 'Too tired', 'Plans changed', 'Wasn’t feeling it'];
  function openDay(d) {
    if (!S.habit || d > todayStr() || d < S.habit.start) return;
    var n = dayNumOf(d), list = acts().filter(function (a) { return M.inRange(S.habit, a, d); });
    var nt = (extra().noticed || {})[d] || { why: [], note: '' };
    var rows = list.map(function (a) {
      var e = a.entries[d], k = counted(e) ? e.kind : '', due = M.isDue(S.habit, a, d) || M.isWeekly(a, d);
      return '<div class="dayact"><div><b>' + esc(a.text) + '</b><span class="hint">' + (due ? (k === 'full' ? 'Done' : k === 'small' ? 'Lighter version done' : 'Not logged') : (k ? (k === 'small' ? 'Lighter version, on a rest day' : 'Done, on a rest day') : 'Rest day for this one')) + '</span></div>' +
        '<div class="seg3" role="group" aria-label="' + esc(a.text) + '"><button data-dset="full" data-a="' + a.id + '" aria-pressed="' + (k === 'full') + '">Did it</button>' + (a.small ? '<button data-dset="small" data-a="' + a.id + '" aria-pressed="' + (k === 'small') + '">Lighter</button>' : '') + '<button data-dset="none" data-a="' + a.id + '" aria-pressed="' + (!k) + '">Not done</button></div></div>';
    }).join('');
    var noteA = list.filter(function (a) { return a.entries[d] && a.entries[d].note; })[0] || list[0], note = noteA && noteA.entries[d] ? noteA.entries[d].note : '';
    var anyDone = list.some(function (a) { return counted(a.entries[d]); });
    var body = '<div class="row"><span><span class="eyebrow">Day ' + n + '</span><b style="display:block;font-size:20px;font-weight:600">' + esc(prettyDate(d)) + '</b></span><button class="link" data-x="close">Close</button></div>' + rows +
      '<div class="field"><label class="label" for="dnote">Anything to remember about this day?</label><textarea id="dnote" rows="2" placeholder="Only you see this">' + esc(note) + '</textarea></div>';
    if (!anyDone && list.some(function (a) { return M.isDue(S.habit, a, d); })) body += '<span class="eyebrow">If it didn’t happen</span><b style="font-weight:600">What got in the way?</b><span class="hint" style="margin-top:-6px">Spotting it is how you learn to work around it. Totally optional.</span>' +
      '<div class="chips">' + GOT_IN_WAY.map(function (w) { return '<button class="chip" data-why="' + esc(w) + '" aria-pressed="' + (nt.why.indexOf(w) >= 0) + '">' + esc(w) + '</button>'; }).join('') + '</div>';
    body += '<button class="btn" data-x="save">Save</button>';
    var why = (nt.why || []).slice();
    var el = openSheet('Day ' + n, body, function (ev, b, close) {
      if (b.dataset.why) { var i = why.indexOf(b.dataset.why); i >= 0 ? why.splice(i, 1) : why.push(b.dataset.why); b.setAttribute('aria-pressed', i < 0); return; }
      if (b.dataset.dset) { b.parentElement.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); return; }
      if (b.dataset.x === 'close') return close();
      if (b.dataset.x === 'save') {
        el.querySelectorAll('.seg3').forEach(function (g) {
          var on = g.querySelector('[aria-pressed="true"]'); if (!on) return;
          var a = actById(on.dataset.a), want = on.dataset.dset, cur = a.entries[d] && counted(a.entries[d]) ? a.entries[d].kind : 'none';
          if (want !== cur) setEntry(a, d, want);
        });
        var nv = el.querySelector('#dnote').value.trim();
        if (noteA && (nv || (noteA.entries[d] && noteA.entries[d].note))) { if (!noteA.entries[d]) noteA.entries[d] = { kind: 'none', note: '' }; noteA.entries[d].note = nv; touchC(noteA, d); }
        var ex = extra(); ex.noticed = ex.noticed || {};
        if (!list.some(function (a) { return counted(a.entries[d]); }) && why.length) ex.noticed[d] = { why: why, note: '', at: nowISO() }; else delete ex.noticed[d];
        touchF(); save(); close(); toast('Saved.'); return render();
      }
    });
  }
  // One reusable sheet: focus moves in, Tab stays inside, Escape closes, and focus goes back where it was.
  function openSheet(label, html, onClick) {
    var back = document.activeElement, el = document.createElement('div'); el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(label) + '">' + html + '</div>';
    app.appendChild(el);
    var close = function () { el.remove(); document.removeEventListener('keydown', onKey, true); try { if (back && back.isConnected) back.focus(); } catch (e) {} };
    var onKey = function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); return close(); }
      if (ev.key !== 'Tab') return;
      var f = Array.prototype.slice.call(el.querySelectorAll('button, [href], textarea, input, select')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return; var i = f.indexOf(document.activeElement);
      if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); } else if (!ev.shiftKey && i === f.length - 1) { ev.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    el.querySelectorAll('textarea').forEach(grow);
    el.addEventListener('input', function (ev) { if (ev.target.tagName === 'TEXTAREA') grow(ev.target); });
    el.addEventListener('click', function (ev) { if (ev.target === el) return close(); var b = ev.target.closest('button, [data-c]'); if (b && onClick) onClick(ev, b, close); });
    var first = el.querySelector('.sheet button.btn, .sheet button, .sheet textarea'); if (first) first.focus({ preventScroll: true });
    return el;
  }

  // ── Catch-up after a gap ──────────────────────────────────────────────────
  function catchDays() {
    var out = [], nt = extra().noticed || {}, dis = S.catchup || [], t = todayStr();
    for (var i = 7; i >= 1; i--) { var d = addDays(t, -i); if (d < S.habit.start || d > lastDate()) continue; if (daySummary(d).s === 'unlogged' && !nt[d] && dis.indexOf(d) < 0) out.push(d); }
    return out;
  }
  function catchUpCard() {
    if (!S.habit || S.habit.finishedOn) return '';
    var days = catchDays(); if (!days.length) return '';
    var gap = days.length > 1, yest = !gap && days[0] === addDays(todayStr(), -1), one = liveActs().length === 1;
    var h = '<div class="card soft"><span class="eyebrow">' + (gap ? 'Welcome back' : yest ? 'Yesterday' : 'Catching up') + '</span>' +
      '<b style="font-weight:600">' + (gap ? 'Did you show up on any of these days?' : yest ? 'Did you show up yesterday?' : 'Did you show up on ' + weekdayLong(days[0]) + '?') + '</b>' +
      '<span class="hint" style="margin-top:-6px">Life gets busy. Tap any you did' + (one ? ', and they’ll count.' : ' to fill them in.') + '</span><div class="chips">';
    days.forEach(function (d) { var lab = !gap ? 'Yes, I did' : d === addDays(todayStr(), -1) ? 'Yesterday' : new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }); h += '<button class="chip" data-catch="' + d + '">' + esc(lab) + '</button>'; });
    return h + '</div><button class="link" data-act="catchdone" style="align-self:flex-start;font-size:14px">' + (gap ? 'That’s everything' : 'No, carry on') + '</button></div>';
  }
  function catchDay(d) {
    var due = liveActs(null, d).filter(function (a) { return M.isDue(S.habit, a, d); });
    if (due.length === 1) return logAct(due[0].id, 'full', d);
    openDay(d);
  }

  // ── Stu as the guide ──────────────────────────────────────────────────────
  function stuCard(text, extraHtml) {
    return '<div class="stu"><img src="../letsgo/stuart.jpg" alt="Stuart" width="44" height="44"><div class="stutxt"><b>Stu</b><span>' + text + '</span>' + (extraHtml || '') + '</div></div>';
  }
  // Moments that scale with the length they chose, rather than assuming 30 days.
  function stuMsg(t) {
    var L = S.habit.length, half = Math.round(L / 2);
    if (t === 3) return 'Day 3. This is usually where life gets in the way. If today’s a 1 out of 10, that still counts.';
    if (t === 7 && L > 10) return 'A week in. Whatever the dots look like, you’re building the skill of coming back. That’s the bit that lasts.';
    if (t === half && L >= 20) return 'Halfway. If it’s feeling like hard work, turn the dimmer down, not off.';
    if (t === 21 && L > 28) return 'Three weeks. Notice what feels easier now than it did on day one.';
    if (t === L - 2 && L >= 10) return 'Nearly there. However it’s gone, you kept coming back. That’s the whole point.';
    return '';
  }
  function stuDay(t) {
    var msg = stuMsg(t), seen = (S.stuSeen || {})[todayStr()];
    if (!msg || seen || !S.habit || t > S.habit.length || S.habit.finishedOn) return '';
    var check = t >= 7 && user;
    return stuCard(esc(msg), check
      ? '<span class="stuq">How’s it going? One tap, and I’ll see it.</span><div class="chips"><button class="chip" data-act="stucheck" data-v="Going well">Going well</button><button class="chip" data-act="stucheck" data-v="Mixed">Mixed</button><button class="chip" data-act="stucheck" data-v="Tough">Tough</button></div>'
      : '<button class="link" data-act="stuok" style="align-self:flex-start;font-size:14px">Thanks, Stu</button>');
  }
  function nudgeAsk() {
    var a = S.pushAsk || {};
    if (!anyCountedOn(todayStr()) || S.settings.push || !sb) return '';
    if (!pushSupported() || (window.Notification && Notification.permission === 'denied')) return '';
    if (isIOS() && !isStandalone()) return '';
    if (a.n >= 2 || (a.n === 1 && daysBetween(a.at, todayStr()) < 3) || a.at === todayStr()) return '';
    return '<div class="card soft nudgeask"><b style="font-weight:600">Want a gentle nudge on your phone?</b>' +
      '<span>At ' + esc(fmtTime(S.settings.time)) + ' on days something’s planned, your time, wherever you are.</span>' +
      (user ? '' : '<span class="hint">First we’ll ask for your email, so the nudge knows where to find you.</span>') +
      '<div class="row" style="gap:12px;justify-content:flex-start"><button class="chip" data-act="nudgeyes" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">' + (user ? 'Turn on' : 'Add my email') + '</button><button class="link" data-act="nudgeno">Not now</button></div></div>';
  }
  function signInCard() {
    if (user || !sb || !authChecked || S.signinLater === todayStr() || (S.habit && todayNum() < 2)) return '';
    return '<div class="card soft small"><b style="font-weight:600">Save your progress?</b><span>Right now it’s only on this phone. Add your email so it’s backed up, your nudges can reach you, and you can use it on another device.</span>' +
      '<div class="row" style="gap:12px;justify-content:flex-start"><button class="chip" data-account="tracker" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Save my progress</button><button class="link" data-act="signinlater" style="font-size:14px">Not now</button></div></div>';
  }
  function extraCards(t) {
    if (t >= 3 && !S.fb.day3 && t <= S.habit.length) return '<div class="card soft"><span class="eyebrow">Quick one for Stuart</span><label class="label" for="fb3">Anything confusing or annoying so far?</label><textarea id="fb3" rows="1" placeholder="Nothing is fine too"></textarea>' +
      '<p class="hint" style="margin:0">This goes to Stuart.</p><div class="row"><button class="link" data-act="fb3skip">Skip</button><button class="chip" data-act="fb3send" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Send</button></div></div>';
    return '';
  }

  // ── Reminders: say what's actually happening, not what was hoped for ───────
  function reminderState() {
    var s = S.settings;
    if (S.habit && M.isPaused(S.habit, todayStr())) return 'paused';
    if (!user) return 'setup';
    if (s.push) return 'push';
    if (s.email) return 'email';
    return 'off';
  }
  function reminderLine() {
    var st = reminderState(), t = fmtTime(S.settings.time);
    return { paused: 'Nudges paused while you’re on a break', setup: 'Nudges are off until you add your email', push: 'Phone nudge at ' + t + ' on planned days', email: 'Email nudge at ' + t + ' on planned days', off: 'Nudges are off' }[st];
  }
  function nextNudge() {
    var st = reminderState(); if (st !== 'email' && st !== 'push') return '';
    var nx = nextPlanned(), hm = S.settings.time.split(':'), past = new Date().getHours() * 60 + new Date().getMinutes() >= (+hm[0]) * 60 + (+hm[1]);
    var dueToday = liveActs().some(function (a) { return M.isDue(S.habit, a, todayStr()) && !counted(a.entries[todayStr()]); });
    var when = dueToday && !past ? 'today' : nx ? relDay(nx.d) : '';
    if (!when) return '';
    return '<p class="next-up">' + iconClock('#4A4A4A') + '<span>What happens next: <b>your nudge arrives ' + esc(when) + ' at ' + esc(fmtTime(S.settings.time)) + '</b>. Change it any time in Settings.</span></p>';
  }

  // ── Schedules: one picker, used in setup and when editing an action ───────
  function schedPicker(rule, from) {
    var r = rule || {}, k = !r.type ? '' : r.type === 'every' ? 'every' : r.type === 'weekly' ? 'weekly' : (r.days.length === 7 ? 'daily' : r.days.join() === '1,2,3,4,5' ? 'weekdays' : 'days');
    var opt = function (key, label) { return '<button class="choice sched" data-sched="' + key + '" data-sfrom="' + from + '" aria-pressed="' + (k === key) + '"><b>' + label + '</b></button>'; };
    var h = '<div class="schedpick" role="group" aria-label="How often">' + opt('daily', 'Every day') + opt('weekdays', 'Weekdays') + opt('every', 'Every other day') + opt('weekly', 'A few times a week, any days') + opt('days', 'On set days') + '</div>';
    if (k === 'days') h += '<span class="label">Which days?</span><div class="days">' + [1, 2, 3, 4, 5, 6, 0].map(function (i) { return '<button class="chip" data-sday="' + i + '" data-sfrom="' + from + '" aria-pressed="' + (r.days.indexOf(i) >= 0) + '" aria-label="' + DAY_LABELS[i] + '">' + DAY_NAMES[i] + '</button>'; }).join('') + '</div>';
    if (k === 'weekly') h += '<span class="label">How many times a week?</span><div class="chips">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<button class="chip" data-stimes="' + n + '" data-sfrom="' + from + '" aria-pressed="' + (r.times === n) + '">' + n + '</button>'; }).join('') + '</div>';
    if (k === 'every') h += '<span class="label">How often?</span><div class="chips">' + [2, 3].map(function (n) { return '<button class="chip" data-severy="' + n + '" data-sfrom="' + from + '" aria-pressed="' + (r.n === n) + '">Every ' + (n === 2 ? 'other' : n + 'rd') + ' day</button>'; }).join('') + '</div>';
    return h;
  }
  function schedRuleFor(from) { return from === 'edit' ? (ui.edit || {}).rule : S.draft.sched; }
  function schedSet(from, rule) { if (from === 'edit') { ui.edit.rule = rule; } else { S.draft.sched = rule; S.draft.schedFromUser = true; save(false); } }
  function schedClick(d) {
    var from = d.sfrom, r = schedRuleFor(from) || {};
    if (d.sched) {
      var k = d.sched;
      schedSet(from, k === 'daily' ? { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] } : k === 'weekdays' ? { type: 'days', days: [1, 2, 3, 4, 5] } : k === 'every' ? { type: 'every', n: 2 } : k === 'weekly' ? { type: 'weekly', times: r.type === 'weekly' ? r.times : 3 } : { type: 'days', days: r.type === 'days' && r.days.length < 7 && r.days.join() !== '1,2,3,4,5' ? r.days : [1, 3, 5] });
    } else if (d.sday != null) { var days = (r.days || []).slice(), i = days.indexOf(+d.sday); i >= 0 ? days.splice(i, 1) : days.push(+d.sday); if (!days.length) return toast('Pick at least one day.'); schedSet(from, { type: 'days', days: days.sort() }); }
    else if (d.stimes) schedSet(from, { type: 'weekly', times: +d.stimes });
    else if (d.severy) schedSet(from, { type: 'every', n: +d.severy });
    render();
  }

  // ── Calendar: a repeating event per action, following its own schedule ────
  var BYD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  function calRule(a, start) {
    var r = M.ruleFor(a, start) || ruleNow(a), until = lastDate().replace(/-/g, '') + 'T235959';
    if (r.type === 'every') return 'FREQ=DAILY;INTERVAL=' + r.n + ';UNTIL=' + until;
    if (r.type === 'weekly') return 'FREQ=WEEKLY;BYDAY=MO;UNTIL=' + until;
    return r.days.length === 7 ? 'FREQ=DAILY;UNTIL=' + until : 'FREQ=WEEKLY;BYDAY=' + r.days.map(function (x) { return BYD[x]; }).join(',') + ';UNTIL=' + until;
  }
  function calFirst(a, from) { var r = M.ruleFor(a, from) || ruleNow(a); if (r.type === 'weekly') { var d = from; while (new Date(d + 'T12:00:00').getDay() !== 1) d = addDays(d, 1); return d; } if (M.isDue(S.habit, a, from)) return from; return M.nextDue(S.habit, a, from) || from; }
  function calTimes(a) {
    var c = ui.cal || {}, start = calFirst(a, c.start || todayStr()), d = start.replace(/-/g, ''), t = (c.time || '07:00').split(':');
    var st = d + 'T' + t[0].padStart(2, '0') + t[1].padStart(2, '0') + '00';
    var endMin = (+t[0]) * 60 + (+t[1]) + 15, endD = endMin >= 1440 ? addDays(start, 1).replace(/-/g, '') : d; endMin %= 1440;
    var en = endD + 'T' + String(Math.floor(endMin / 60)).padStart(2, '0') + String(endMin % 60).padStart(2, '0') + '00';
    return { st: st, en: en, rule: calRule(a, start) };
  }
  function calTitle(a) { var r = ruleNow(a); return 'Let’s Go! ' + a.text + (r && r.type === 'weekly' ? ' (' + r.times + ' this week)' : ''); }
  function calDescription(a) {
    var ex = extra(), hard = ex.hard || {}, w = words().map(function (x) { return x.toLowerCase(); }), L = [];
    L.push((S.habit.mode === 'less' ? 'Cutting back on: ' + habitName() + '. Instead: ' : 'Today: ') + a.text + '.');
    if (anchorLine(a)) L.push('When: ' + anchorLine(a) + '.');
    if (mineLine()) L.push('My words: ' + mineLine());
    if (a.small) L.push('Tough day? ' + a.small + '. That counts too.');
    L.push('');
    L.push('Why it matters to you: ' + (w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0]) + '.');
    if ((hard.start || '').trim()) L.push('When you can’t get started, you said: “' + hard.start.trim() + '”');
    if ((hard.spark || '').trim()) L.push('What reminds you why it matters: “' + hard.spark.trim() + '”');
    L.push('');
    L.push('Showing up is the point, at whatever size you’ve got today.');
    L.push('');
    L.push('Tick it off when you’re done: ' + APPLINK);
    return L.join('\n');
  }
  function buildICS(list) {
    var now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Motivate Coaching//Lets Go//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    list.forEach(function (a) {
      var t = calTimes(a);
      lines.push('BEGIN:VEVENT', 'UID:' + a.id + '@letsgo.motivate-coaching.com', 'DTSTAMP:' + now, 'DTSTART:' + t.st, 'DTEND:' + t.en, 'RRULE:' + t.rule,
        'SUMMARY:' + icsEsc(calTitle(a)), 'DESCRIPTION:' + icsEsc(calDescription(a)), 'URL:' + APPLINK,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Time to show up: ' + a.text), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }
  function downloadICS() {
    var ics = buildICS(liveActs()), name = 'lets-go-' + habitName().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '.ics';
    stat('calendar', 'ics'); window.__lastICS = ics;
    try {
      var file = new File([ics], name, { type: 'text/calendar' });
      if (/android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(function () {}); return; }
    } catch (e) {}
    if (isIOS()) { window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Calendar file downloaded. Open it to add the reminders.');
  }
  function googleCalURL(a) {
    var t = calTimes(a);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(calTitle(a)) + '&dates=' + t.st + '/' + t.en +
      '&details=' + encodeURIComponent(calDescription(a)) + '&recur=' + encodeURIComponent('RRULE:' + t.rule) + '&ctz=' + encodeURIComponent(S.settings.tz || 'UTC');
  }
  function calDefaultStart() { var n = new Date(), hm = (S.settings.time || '07:00').split(':'); return n.getHours() * 60 + n.getMinutes() < (+hm[0]) * 60 + (+hm[1]) ? todayStr() : addDays(todayStr(), 1); }

  // ── My plan ───────────────────────────────────────────────────────────────
  function planCard(from) {
    var h = S.habit, less = h.mode === 'less', focus = S.settings.view === 'focus';
    var row = function (icon, label, body, edit) { return '<div class="prow"><span class="pic">' + icon + '</span><div class="pbody"><small>' + label + '</small>' + body + '</div>' + (edit || '') + '</div>'; };
    var ws = words(), chips = ws.length === 1 && /\s/.test(ws[0]) ? '<b>' + esc(ws[0].charAt(0).toUpperCase() + ws[0].slice(1)) + '</b>' : '<div class="pchips">' + ws.map(function (w, i) { return '<span' + (i === 0 ? ' class="first"' : '') + '>' + esc(w.toLowerCase()) + '</span>'; }).join('') + '</div>';
    var out = '<div class="plancard">' + row(PICON.what, less ? 'I’m cutting back on' : 'My focus', '<b>' + esc(habitName()) + '</b>', focus ? '' : '<button class="pedit" data-act="editfocus">Edit</button>');
    if (mineLine()) out += row(PICON.why, 'My words', '<b>“' + esc(mineLine()) + '”</b>', '');
    if (!focus) out += row(PICON.why, less ? 'What I’m moving towards' : 'What I’m moving towards', chips, '');
    out += '</div>';
    out += '<div class="sec-h" style="margin-top:4px"><h2 style="font-size:20px">' + (less ? 'What I’ll do instead' : 'My actions') + '</h2></div><div class="plancard">';
    liveActs().forEach(function (a) {
      out += '<div class="prow act"><span class="pic">' + PICON.when + '</span><div class="pbody"><b>' + esc(a.text) + '</b><span class="psub">' + esc(describeRule(ruleNow(a))) + (anchorLine(a) ? ' · ' + esc(anchorLine(a)) : '') + '</span>' +
        (a.small ? '<span class="psub">Tough day: ' + esc(a.small) + '</span>' : '') + '</div><button class="pedit" data-editact="' + a.id + '">Edit</button></div>';
    });
    out += '</div><button class="btn outline" data-editact="new">' + (liveActs().length ? 'Add another action' : 'Add an action') + '</button>';
    out += '<div class="plancard">' + row(PICON.when, 'Review after', '<b>' + h.length + ' days</b><span class="psub">From ' + esc(prettyDate(h.start)) + ' to ' + esc(prettyDate(lastDate())) + '</span><button class="link" data-act="startdate" style="align-self:flex-start;font-size:14px;min-height:36px">Change start date</button>', '<button class="pedit" data-length="' + from + '">Change</button>') +
      row(iconClock('#0F1215'), 'Nudges', '<b>' + esc(reminderLine()) + '</b>', '<button class="pedit" data-act="gosettings">Change</button>') + '</div>';
    var hp = extra().helpers || [];
    if (hp.length) out += '<div class="card soft"><span class="eyebrow">Might help you get started</span>' + hp.map(function (x) { return '<a class="link" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + encodeURIComponent(x) + '" style="align-self:flex-start">' + esc(x) + ' <span aria-hidden="true">↗</span><span class="sr"> (opens a search in a new tab)</span></a>'; }).join('') + '</div>';
    out += laterCard();
    return out;
  }
  function laterCard() {
    var L = (S.habit.later || []).filter(function (x) { return !x.used; }); if (!L.length) return '';
    var h = '<div class="card soft later"><span class="eyebrow">Waiting in Later</span><span class="hint" style="margin-top:-4px">Ideas you set aside. Use one whenever you’re ready.</span>';
    S.habit.later.forEach(function (x, i) {
      if (x.used) return;
      h += '<div class="laterrow"><div><b>' + esc(x.kind === 'action' ? x.text : x.title) + '</b><span class="hint">' + (x.kind === 'action' ? 'An action for this focus' + (x.schedule ? ' · ' + esc(describeRule(x.schedule)) : '') : 'Another focus') + '</span></div>' +
        '<div class="row" style="gap:10px;justify-content:flex-start">' + (x.kind === 'action' ? '<button class="chip" data-lateruse="' + i + '">Add to my plan</button>' : '<button class="chip" data-laterfocus="' + i + '">Start this next</button>') + '<button class="link" data-laterdrop="' + i + '" style="font-size:14px">Remove</button></div></div>';
    });
    return h + '</div>';
  }
  function archiveCard() {
    var A = S.archive || []; if (!A.length) return '';
    var h = '<div class="card"><span class="eyebrow">Past plans</span>';
    A.forEach(function (f, i) {
      var n = 0; (f.actions || []).forEach(function (a) { Object.keys(a.entries || {}).forEach(function (d) { if (counted(a.entries[d])) n++; }); });
      h += '<div class="laterrow"><div><b>' + esc(f.title || ((f.actions || [])[0] || {}).text || 'A plan') + '</b><span class="hint">' + esc(prettyDate(f.start)) + ' · ' + n + ' show-up' + (n === 1 ? '' : 's') + '</span></div><button class="chip" data-reopen="' + i + '">Make this my focus again</button></div>';
    });
    return h + '</div>';
  }
  // Editing one action: words, cue, schedule (from today, so the past keeps its own rule) and the lighter version.
  function actEditor() {
    var e = ui.edit, isNew = e.id === 'new';
    return '<section class="screen"><div><div class="eyebrow">My plan</div><h1>' + (isNew ? 'Add an action' : 'Change this action') + '</h1></div>' +
      '<div class="qcard"><div class="field"><label class="label" for="eatext">' + (S.habit.mode === 'less' ? 'Instead, I’ll...' : 'I’m going to...') + '</label><textarea id="eatext" rows="1" data-ebind="text" placeholder="e.g. Go for a 20 minute walk">' + esc(e.text) + '</textarea></div>' +
      '<div class="field"><label class="label" for="eacue">' + (S.habit.mode === 'less' ? 'It usually happens...' : 'After I... (optional)') + '</label><textarea id="eacue" rows="1" data-ebind="cue" placeholder="e.g. get home from work">' + esc(e.cue) + '</textarea></div>' +
      '<span class="label">How often</span>' + schedPicker(e.rule, 'edit') + (isNew ? '' : '<span class="hint">A change applies from today. Your past days keep the schedule they had.</span>') +
      '<div class="field"><label class="label" for="easmall">On a tough day, the lighter version</label><textarea id="easmall" rows="1" data-ebind="small" placeholder="Something much smaller that still counts">' + esc(e.small) + '</textarea></div></div>' +
      '<div class="spacer"></div><button class="btn" data-act="actsave">' + (isNew ? 'Add to my plan' : 'Save') + '</button>' +
      (isNew ? '' : '<button class="link center" data-act="actremove">Take this out of my plan</button>') + '</section>';
  }
  function focusEditor() {
    var h = S.habit, ex = extra(), less = h.mode === 'less';
    var w = '<section class="screen"><div><div class="eyebrow">My plan</div><h1>Change your focus</h1></div><div class="qcard">' +
      '<div class="field"><label class="label" for="ftitle">' + (less ? 'I’m cutting back on...' : 'My focus') + '</label><textarea id="ftitle" rows="1" data-fbind="title">' + esc(h.title || '') + '</textarea></div>' +
      (ex.mineQ ? '<div class="field"><label class="label" for="emine">' + esc(ex.mineQ) + '</label><textarea id="emine" rows="2" data-xbind="mine">' + esc(ex.mine || '') + '</textarea></div>' : '') +
      '<div class="field"><label class="label" for="ftow">What I’m moving towards</label><textarea id="ftow" rows="2" data-fbind="towards" placeholder="One line about how life feels when it’s going well">' + esc(h.towards || '') + '</textarea></div>';
    return w + '</div><div class="spacer"></div><button class="btn" data-act="focusdone">Done</button></section>';
  }
  function addActionFrom(x) {
    var a = { id: uuid(), text: x.text, small: x.small || '', up: x.up || '', cue: x.cue || '', schedules: [Object.assign({ from: todayStr() < S.habit.start ? S.habit.start : todayStr() }, x.schedule || { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] })],
      sort: acts().length, from: todayStr() < S.habit.start ? S.habit.start : todayStr(), entries: {}, extra: {}, createdAt: nowISO() };
    S.habit.actions.push(a); touchA(a); touchF(); return a;
  }

  // ── Help me choose ─────────────────────────────────────────────────────────
  // Open questions first (their words), then they choose one thing, then why one thing matters.
  var HORIZONS = [['30', '30 days'], ['90', 'three months'], ['365', 'a year']];
  function horizonLabel() { var f = S.find || {}, h = HORIZONS.filter(function (x) { return x[0] === f.horizon; })[0] || HORIZONS[1]; return h[1]; }
  function FIND_QS() {
    var fc = S.find && S.find.focus;
    var proud = { key: 'proud', q: fc ? 'Picture yourself a year from now, feeling insanely proud of yourself. When it comes to ' + fc.charAt(0).toLowerCase() + fc.slice(1) + ', what did you do?' : 'Picture yourself a year from now. You’re feeling insanely proud of yourself. What did you do to feel this way?', hint: fc ? 'Picture how life feels, not just the thing you did. Write or speak as much as you like.' : 'Picture how life feels, not just the thing you did.', ph: fc ? 'What did you do, and how does life feel now?' : 'e.g. I finally sorted my sleep, and my evenings are mine again' };
    if (S.find && S.find.mode === 'less') return [
      { key: 'drain', q: 'What’s something you do regularly that costs you more than it gives you?', hint: 'Write or speak as much as you like. Share whatever comes to mind, and we’ll pick out a few things you could focus on.', ph: 'e.g. Scrolling in bed at night, too much chocolate, not being present with family' },
      proud
    ];
    return [
      { key: 'years', q: 'What’s something you’ve always wanted to do, but never quite got round to?', hint: 'Write or speak as much as you like. Share whatever comes to mind, and we’ll pick out a few things you could focus on.', ph: 'e.g. Get fit again, learn the guitar, write more, be calmer' },
      proud
    ];
  }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  function micButton() {
    if (!SR) return '';
    return '<button class="mic" data-mic="1" aria-pressed="false" aria-label="Speak instead of typing"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Speak</span></button>';
  }
  // Dictation: transcribes exactly what's said, keeps listening through pauses (up to 10 minutes) until they tap stop.
  // Android Chrome repeats earlier words if left in "continuous" mode, so there we listen one phrase at a time and restart.
  var IS_ANDROID = /android/i.test(navigator.userAgent), MIC_MAX_MS = 10 * 60 * 1000, mic = null;
  function stopMic() { if (!mic) return; var m = mic; mic = null; m.wanted = false; try { m.rec && m.rec.stop(); } catch (e) {} micIdle(m.btn); }
  function micIdle(btn) { if (btn && btn.isConnected) { btn.setAttribute('aria-pressed', 'false'); var sp = btn.querySelector('span'); if (sp) sp.textContent = 'Speak'; } }
  function addHeard(m, text) {
    text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) return;
    var prev = m.lastFinal, add = text;
    if (prev && text === prev) return; // the same phrase sent twice
    if (prev && text.indexOf(prev) === 0) add = text.slice(prev.length).trim(); // a longer copy of the last phrase
    m.lastFinal = text;
    if (add) m.done = (m.done ? m.done.replace(/\s*$/, ' ') : '') + add;
  }
  function micListen(m) {
    var r = new SR(); m.rec = r;
    r.lang = navigator.language && /^en/i.test(navigator.language) ? navigator.language : 'en-GB';
    r.continuous = !IS_ANDROID; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = function (ev) {
      var tmp = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) addHeard(m, ev.results[i][0].transcript); else tmp += ev.results[i][0].transcript;
      }
      m.ta.value = (m.done || '') + (tmp ? (m.done ? ' ' : '') + tmp.trim() : ''); grow(m.ta); if (m.onchange) m.onchange();
    };
    r.onerror = function (e) { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { m.wanted = false; toast('Microphone blocked. You can allow it in your browser settings.'); } };
    r.onend = function () {
      m.ta.value = m.done || ''; grow(m.ta); if (m.onchange) m.onchange();
      if (m.wanted && mic === m && Date.now() - m.started < MIC_MAX_MS && m.ta.isConnected) { setTimeout(function () { if (m.wanted && mic === m) { try { micListen(m); } catch (e) { stopMic(); } } }, 120); return; }
      if (mic === m && m.wanted && Date.now() - m.started >= MIC_MAX_MS) toast('Stopped listening after 10 minutes. Tap Speak to carry on.');
      if (mic === m) { mic = null; micIdle(m.btn); }
    };
    r.start();
  }
  function toggleMic(btn, ta, onchange) {
    ta = ta || document.getElementById('findans'); if (!SR || !ta) return;
    if (mic) return stopMic();
    var m = { btn: btn, ta: ta, onchange: onchange || findSave, wanted: true, started: Date.now(), done: ta.value.replace(/\s+$/, ''), lastFinal: '' };
    mic = m;
    try { micListen(m); btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = 'Listening… tap to stop'; }
    catch (e) { mic = null; toast('Speaking isn’t available here. Typing works just as well.'); }
  }
  function findSave() {
    var ta = document.getElementById('findans'), f = S.find; if (!ta || !f) return;
    var q = FIND_QS()[f.step]; if (q) { f.answers[q.key] = ta.value; save(false); }
  }
  function findScreen() {
    var f = S.find || (S.find = { step: 0, answers: {} }), qs = FIND_QS();
    if (f.step === 1 && !f.focus && (f.answers[qs[0].key] || '').trim()) return themesScreen(f);
    if (f.step < qs.length) {
      var q = qs[f.step], v = f.answers[q.key] || '';
      var bar = '<div class="progress" style="grid-template-columns:repeat(' + qs.length + ',1fr)" aria-hidden="true">' + qs.map(function (x, i) { return '<span' + (i <= f.step ? ' class="on"' : '') + '></span>'; }).join('') + '</div>';
      return '<section class="screen"><div class="stepper">' + bar + '<div class="eyebrow" style="margin-top:12px">Challenge ideas · ' + (f.step + 1) + ' of ' + qs.length + '</div>' +
        (f.step === 0 ? '<div class="v2hero">' + (firstName() ? '<p class="findwelcome">Welcome, ' + esc(firstName()) + '.</p><p class="fwsub">Let’s get you on track and find the right thing for you to focus on.</p>' : '<p class="findwelcome">Let’s find the right thing for you to focus on.</p>') + '</div>' : '') + (f.step === 0 ? '<p class="lede workintro">This is about one change in your everyday life: something you’d love more of, or something to do less of. Together we’ll shape it into something you can make happen.</p>' : '') +
        '</div><div class="qcard"><h1 class="findq">' + esc(q.q) + '</h1>' +
        '<p class="hint">' + esc(q.hint) + '</p>' +
        '<div class="field"><textarea id="findans" rows="5" style="min-height:180px" placeholder="' + esc(q.ph) + '">' + esc(v) + '</textarea>' + micButton() + '<span class="hint">Private. Sent to our AI provider, Anthropic, only to suggest ideas. We don’t keep what you write here.</span></div></div>' +
        '<div class="spacer"></div><button class="btn" data-find="next">' + (f.step === qs.length - 1 ? 'Show me ideas' : 'Next') + '</button>' +
        '<button class="link center" data-find="skip">Skip this one</button></section>';
    }
    return ideasScreen(f);
  }
  // Step 1 of the funnel: everything they said, as themes. They choose one; the rest wait in Later.
  // Choosing one wish first, then picturing the best outcome for it, follows WOOP (Oettingen); one goal at a time follows Dalton and Spiller (2012).
  function themesScreen(f) {
    var top = '<section class="screen"><div><div class="eyebrow">Challenge ideas · 1 of 2</div>';
    var src = (f.answers[FIND_QS()[0].key] || '').trim();
    if (f.themes && f.themesFor !== src) f.themes = null;
    var th = f.themes;
    if (th && careText(th)) return top + '<h1>Before anything else.</h1></div><div class="why"><span>' + esc(careText(th)) + '</span></div></section>';
    if (!th || !(th.themes || []).length) {
      if (!user && !guest) {
        if (authChecked && !ui.guestFailed && !ui.guestTrying) { ui.guestTrying = true; ensureGuest().then(function (ok) { ui.guestTrying = false; if (!ok) ui.guestFailed = true; render(); }); }
        if (ui.guestFailed) return top + '<h1>Add your email to carry on.</h1></div><p class="lede">We’ll read what you shared and pick out what you could focus on. It also saves your progress.</p><button class="btn" data-account="find">Add my email</button>' + themeOwn() + '</section>';
      } else if (!ui.themesBusy && !ui.themesFailed) setTimeout(themesAI, 0);
      if (ui.themesFailed) return top + '<h1>We couldn’t reach it just now.</h1></div><button class="btn" data-find="themesretry">Try again</button>' + themeOwn() + '</section>';
      return top + '<h1>Reading what you shared…</h1></div><p class="lede">Picking out everything you mentioned. This takes a few seconds.</p><div class="dotpulse" aria-hidden="true"><span></span><span></span><span></span></div></section>';
    }
    var h = top + '<h1>Here’s what we heard.</h1></div><p class="lede">You mentioned ' + (th.themes.length === 1 ? 'one thing' : th.themes.length + ' things') + '. Which one would you like to work on first? The others wait for you in Later.</p><div style="display:flex;flex-direction:column;gap:10px">';
    th.themes.forEach(function (t, i) { h += '<button class="pickcard" data-find="theme" data-i="' + i + '"><b>' + esc(t.name) + '</b><span>' + esc(t.noticed) + '</span></button>'; });
    var why = '<div class="why"><span class="eyebrow">Why one thing</span><span>A clear plan helps people follow through on one goal, but stops helping once they take on several. Pick the one that matters most right now. You can come back for the others.</span></div>';
    h += '</div>' + (S.settings.view === 'focus' ? tapToSee('Why just one?', why) : why);
    return h + themeOwn() + '</section>';
  }
  function themeOwn() { return '<div class="field"><label class="label" for="ownfocus">Something else?</label><textarea id="ownfocus" rows="1" placeholder="e.g. Time with my parents"></textarea></div><button class="btn outline" data-find="themeown">Use this</button>'; }
  async function themesAI() {
    var f = S.find; if (!f || !sb || (!user && !guest) || ui.themesBusy) return;
    var src = (f.answers[FIND_QS()[0].key] || '').trim(); if (!src) return;
    ui.themesBusy = true; ui.themesFailed = false;
    try {
      var r = await sb.functions.invoke('showup-reflect', { body: { kind: 'themes', mode: f.mode || 'more', text: src } });
      if (r.error) { var st = r.error.context && r.error.context.status; ui.themesFailed = true; toast(st === 429 ? 'That’s today’s limit reached. Write your own focus below.' : st === 422 ? 'I couldn’t pick anything out of that. Write your own focus below, or go back and add a little more.' : 'Couldn’t reach it just now. Try again in a moment.'); }
      else if (r.data && (((r.data.themes || []).length) || careText(r.data))) { f.themes = r.data; f.themesFor = src; save(false); }
      else ui.themesFailed = true;
    } catch (e) { ui.themesFailed = true; toast('Couldn’t reach it just now. Try again in a moment.'); }
    ui.themesBusy = false; render();
  }
  // After the questions: the AI pulls out the areas, they pick one, check it rings true, then choose a challenge.
  // A care message only counts if it has real words in it (an early version could save an empty "" and show a blank card).
  function careText(ai) { var c = String((ai && ai.care) || '').replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, ''); return /[a-z]{3}/i.test(c) ? c : ''; }
  function ideasScreen(f) {
    if (f.ai && !careText(f.ai) && !(f.ai.areas || []).length) { f.ai = null; f.aiTried = false; }
    var top = '<section class="screen"><div><div class="eyebrow">Challenge ideas</div>';
    var own = '<div class="field"><label class="label" for="ownch">Or write my own</label><textarea id="ownch" rows="1" placeholder="' + (f.mode === 'less' ? 'e.g. Leave my phone in the kitchen at night' : 'e.g. A 20 minute walk each day') + '">' + esc(f.own || '') + '</textarea></div><button class="btn outline" data-find="own">Use mine</button>';
    var ai = f.ai || {}, areas = ai.areas || [];
    if (careText(ai)) return top + '<h1>Before anything else.</h1></div><div class="why"><span>' + esc(careText(ai)) + '</span></div><div class="spacer"></div>' + own + '</section>';
    if (!areas.length) {
      if (!user && !guest) {
        if (authChecked && !ui.guestFailed && !ui.guestTrying) { ui.guestTrying = true; ensureGuest().then(function (ok) { ui.guestTrying = false; if (!ok) ui.guestFailed = true; render(); }); }
        if (!ui.guestFailed) return top + '<h1>Reading what you shared…</h1></div><p class="lede">Looking for what matters most to you. This takes a few seconds.</p><div class="dotpulse" aria-hidden="true"><span></span><span></span><span></span></div></section>';
        return top + '<h1>Add your email to see your ideas.</h1></div><p class="lede">We’ll read what you shared and suggest where to focus. It also saves your progress.</p>' +
          '<button class="btn" data-account="find">Add my email</button><div class="spacer"></div>' + own + '</section>';
      }
      if (!f.aiTried && !ui.aiBusy) setTimeout(reflectAI, 0);
      if (ui.aiBusy || !f.aiTried) return top + '<h1>Reading what you shared…</h1></div><p class="lede">Looking for what matters most to you. This takes a few seconds.</p><div class="dotpulse" aria-hidden="true"><span></span><span></span><span></span></div></section>';
      return top + (ui.aiNothing ? '<h1>I couldn’t quite find ideas in that.</h1></div><p class="lede">Try again, or go back and add a little more about what you’d love to change.</p>' : '<h1>We couldn’t reach it just now.</h1></div>') + '<button class="btn" data-act="reflectai">Try again</button><div class="spacer"></div>' + own + '</section>';
    }
    var r = f.r || 'areas', ar = areas[f.area || 0] || areas[0];
    if (r === 'areas') {
      var h = top + '<h1>Your habit challenge ideas are ready.</h1></div><p class="lede">' + (S.settings.view === 'focus' ? 'Here’s what stood out. This sounds like where to focus right now.' : 'Here’s what stood out. From what you shared, this sounds like the area that most needs your focus right now.') + '</p>';
      h += '<button class="choice area main" data-find="area" data-i="0"><small>Most prominent</small><b>' + esc(areas[0].name) + '</b><span>' + esc(areas[0].noticed) + '</span></button>';
      if (areas.length > 1) {
        h += '<span class="eyebrow" style="margin-top:4px">What else stood out for you</span>';
        areas.slice(1).forEach(function (x, i) { h += '<button class="choice area minor" data-find="area" data-i="' + (i + 1) + '"><b>' + esc(x.name) + '</b></button>'; });
      }
      var why1 = '<div class="why"><span class="eyebrow">Why one thing</span><span>Studies at UCLA and the Hong Kong University of Science and Technology found that a clear plan helps people follow through on one goal, but stops helping once they take on several. Real traction comes from one thing you commit to and show up for.</span><span>Pick one now. You can always come back for another.</span></div>';
      h += S.settings.view === 'focus' ? tapToSee('Why just one?', why1) : why1;
      return h + '<div class="spacer"></div>' + own.replace('Or write my own', 'Already know what you want to do?').replace(/placeholder="[^"]*"/, 'placeholder="Actually, I’ve worked out what I want to do..."') + '</section>';
    }
    if (r === 'insight') {
      return top + '<h1>' + esc(ar.name) + '</h1></div><div class="why"><span class="eyebrow">What we noticed</span><span>' + esc(ar.noticed) + '</span><span style="font-weight:600">' + esc(ar.insight) + '</span></div>' +
        '<p class="lede">Does this ring true?</p><div class="spacer"></div><button class="btn" data-find="resonates">Yes, that’s it</button><button class="btn outline" data-find="toareas">Not quite. Show me the other areas</button></section>';
    }
    var h2 = top + '<h1>A few challenges to try.</h1></div>' + (f.focus && ar.insight ? '<div class="why"><span class="eyebrow">' + esc(f.focus) + '</span><span>' + esc(ar.insight) + '</span></div>' : '') + '<p class="lede">Within ' + esc((f.focus || ar.name).toLowerCase()) + ', pick the one that gives you a little jolt.</p><div style="display:flex;flex-direction:column;gap:10px">';
    (ar.challenges || []).forEach(function (c, i) { h2 += '<button class="choice" data-find="take" data-i="' + i + '"><b>' + esc(c.title) + '</b>' + (c.daily ? '<small>' + esc(c.daily.replace(/^i[’']?m going to\s+|^i[’']ll\s+/i, '').replace(/^./, function (x) { return x.toUpperCase(); })) + '</small>' : '') + '</button>'; });
    return h2 + '</div>' + own + '<div class="spacer"></div><button class="link center" data-find="' + (f.focus ? 'tothemes' : 'toareas') + '">' + (f.focus ? 'Not convinced? Choose a different focus' : 'Not convinced? Back to the areas') + '</button></section>';
  }
  function aiCard(f, n) {
    if (!n || !sb) return '';
    if (careText(f.ai)) return '<div class="why"><span class="eyebrow">Before anything else</span><span>' + esc(careText(f.ai)) + '</span></div>';
    if (f.ai && f.ai.heard) {
      var h = '<div class="card heard"><span class="eyebrow">What I’m hearing</span><p>' + esc(f.ai.heard) + '</p>' +
        (f.ai.themes && f.ai.themes.length ? '<div class="chips">' + f.ai.themes.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') + '</div>';
      if (f.ai.options && f.ai.options.length) {
        h += '<span class="eyebrow">Ideas from what you wrote</span><div style="display:flex;flex-direction:column;gap:10px">';
        f.ai.options.forEach(function (o, i) { h += '<button class="choice findpick" data-find="pick" data-key="ai:' + i + '" aria-pressed="' + (f.pick === 'ai:' + i) + '"><b>' + esc(o.focus) + '</b><small>' + esc(o.why) + '</small></button>'; });
        h += '</div>';
      }
      return h;
    }
    if (!user && !guest) return authChecked ? '<div class="card soft small"><b style="font-weight:600">Want challenges made for you?</b><span>Add your email and we’ll suggest a few, based on what you wrote. It also saves your progress.</span><button class="chip" data-account="find" style="align-self:flex-start;background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Add my email</button></div>' : '';
    if (!f.aiTried && !ui.aiBusy) setTimeout(reflectAI, 0);
    return '<div class="card soft"><b style="font-weight:600">Want challenges made for you?</b><span>We’ll read what you wrote and suggest a few that fit.</span>' +
      '<button class="btn outline" data-act="reflectai"' + (ui.aiBusy ? ' disabled' : '') + '>' + (ui.aiBusy ? 'Finding challenges for you…' : 'Suggest challenges for me') + '</button></div>';
  }
  async function reflectAI() {
    var f = S.find; if (!f || !sb || (!user && !guest) || ui.aiBusy) return;
    f.aiTried = true; ui.aiBusy = true; ui.aiNothing = false; render();
    try {
      var r = await sb.functions.invoke('showup-reflect', { body: { mode: f.mode || 'more', answers: f.answers, focus: f.focus || undefined, wins: (S.wins || []).map(function (w) { return { name: w.name, outcome: w.outcome }; }), horizon: horizonLabel() } });
      if (r.error) {
        var st = r.error.context && r.error.context.status;
        toast(st === 429 ? 'That’s today’s ideas used. Write your own below, or come back tomorrow.' : st === 422 ? (ui.aiNothing = true, 'I couldn’t quite find ideas in that. Try again, or add a little more about what you’d love to change.') : 'Couldn’t reach it just now. Try again in a moment.');
      } else if (r.data && ((r.data.areas && r.data.areas.length) || careText(r.data))) { f.ai = r.data; f.r = f.focus ? 'ideas' : 'areas'; f.area = 0; save(false); }
      else { ui.aiNothing = true; toast('I couldn’t quite find ideas in that. Try again, or add a little more about what you’d love to change.'); }
    } catch (e) { toast('Couldn’t reach it just now. Try again in a moment.'); }
    ui.aiBusy = false; render();
  }
  function pickText(f) {
    if (f.pick && f.pick.indexOf('ai:') === 0) { var o = f.ai && f.ai.options[+f.pick.slice(3)]; return o ? o.focus : ''; }
    if (f.pick && f.pick.indexOf('win:') === 0) { var w = (S.wins || []).filter(function (x) { return x.id === f.pick.slice(4); })[0]; return w ? w.name : ''; }
    return (f.answers[f.pick] || '').trim();
  }

  // ── Past wins: things they've taken on before ─────────────────────────────
  // Remembering past successes is the strongest builder of self-belief (Bandura's mastery experiences).
  var OUTCOME = { did: 'I did it', partly: 'Partly', not: 'Didn’t stick' };
  var WIN_IDEAS = ['30 days of exercise', 'No sugar', 'A month off alcohol', 'Learning a language', 'Waking up earlier', 'Speaking up more', 'A new hobby'];
  function syncWins() { if (S.habit) extra().wins = (S.wins || []).slice(); save(); }
  function winsScreen(inFind) {
    var wins = S.wins || [], did = wins.filter(function (w) { return w.outcome === 'did'; }).length, qs = FIND_QS();
    var h = '<section class="screen"><div><div class="eyebrow">' + (inFind ? 'Let’s work it out · ' + (qs.length + 1) + ' of ' + (qs.length + 1) : 'My past wins') + '</div><h1 class="findq">' + (inFind ? 'What have you taken on before?' : 'Things you’ve taken on') + '</h1></div>' +
      '<p class="hint" style="margin-top:-8px">A 30-day challenge, giving something up, learning a skill. Big or small, it all counts, even the ones that didn’t stick.</p>';
    if (wins.length) {
      h += '<div class="winlist">';
      wins.forEach(function (w) { h += '<button class="win" data-win="' + w.id + '"><span class="wo ' + w.outcome + '">' + esc(OUTCOME[w.outcome]) + '</span><b>' + esc(w.name) + '</b><small>' + (w.helped || w.felt ? 'Tap to read what you noticed' : 'Tap to look back on it') + '</small></button>'; });
      h += '</div>';
      if (did) h += '<div class="why"><span>Look at that. You’ve done ' + (did === 1 ? 'a hard thing' : did + ' hard things') + ' before. That’s proof you can do it again.</span></div>';
    }
    h += '<div class="card"><label class="label" for="winname">' + (wins.length ? 'Add another' : 'Add one') + '</label>' +
      '<textarea id="winname" rows="1" placeholder="e.g. 30 days of yoga">' + esc(ui.winDraft || '') + '</textarea>' +
      (wins.length ? '' : '<div class="chips starters">' + WIN_IDEAS.map(function (x) { return '<button class="chip" data-winidea="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>') +
      '<span class="label" style="margin-top:4px">How did it go?</span><div class="chips">' + Object.keys(OUTCOME).map(function (k) { return '<button class="chip" data-winout="' + k + '">' + OUTCOME[k] + '</button>'; }).join('') + '</div></div>';
    h += '<div class="spacer"></div>';
    if (inFind) h += '<button class="btn" data-find="next">See what I wrote</button>' + (wins.length ? '' : '<button class="link center" data-find="skip">Skip this one</button>');
    else h += '<button class="btn outline" data-back="1">Back</button>';
    return h + '</section>';
  }
  function addWin(outcome) {
    var ta = document.getElementById('winname'), name = ta ? ta.value.replace(/\s+/g, ' ').trim() : '';
    if (!name) { toast('Write what it was first, then tap how it went.'); if (ta) ta.focus(); return; }
    S.wins = (S.wins || []).concat([{ id: uuid().slice(0, 8), name: name, outcome: outcome, at: new Date().toISOString() }]);
    ui.winDraft = ''; syncWins(); toast(outcome === 'did' ? 'Added. Nice one.' : 'Added. Worth learning from.'); render();
  }
  function openWin(id) {
    var w = (S.wins || []).filter(function (x) { return x.id === id; })[0]; if (!w) return;
    var q2 = w.outcome === 'did' ? 'How does it feel, looking back on it now?' : 'What got in the way, and what would you do differently?';
    var el = openSheet(w.name, '<div class="row"><span><span class="wo ' + w.outcome + '">' + esc(OUTCOME[w.outcome]) + '</span><b style="display:block;font-size:20px;font-weight:600;margin-top:6px">' + esc(w.name) + '</b></span><button class="link" data-x="close">Close</button></div>' +
      '<div class="field"><label class="label" for="whelped">What helped?</label><textarea id="whelped" rows="2" placeholder="Even small things count">' + esc(w.helped || '') + '</textarea></div>' +
      '<div class="field"><label class="label" for="wfelt">' + q2 + '</label><textarea id="wfelt" rows="2" placeholder="A few words is plenty">' + esc(w.felt || '') + '</textarea></div>' +
      '<button class="btn" data-x="save">Save</button><button class="link center" data-x="remove" style="font-size:14px">Remove this one</button>', function (ev, b, close) {
      if (b.dataset.x === 'close') return close();
      if (b.dataset.x === 'save') { w.helped = el.querySelector('#whelped').value.trim(); w.felt = el.querySelector('#wfelt').value.trim(); syncWins(); close(); toast('Saved.'); return render(); }
      if (b.dataset.x === 'remove') { S.wins = S.wins.filter(function (x) { return x.id !== id; }); syncWins(); close(); return render(); }
    });
  }
  function findAct(a, b) {
    var f = S.find || (S.find = { step: 0, answers: {} }), qs = FIND_QS();
    stopMic();
    if (a === 'start') { var md = (b && b.dataset.mode) || 'more', keep = S.find && S.find.mode === md ? S.find.answers : {}; S.find = { step: 0, mode: md, answers: keep || {}, horizon: '365' }; save(false); return askNameThen('find'); }
    if (a === 'next' || a === 'skip') { if (a === 'next') findSave(); f.step++; f.ai = null; f.aiTried = false; f.r = 'areas'; f.area = 0; f.pick = null; save(false); return go('find'); }
    if (a === 'theme' || a === 'themeown') {
      var all = (f.themes && f.themes.themes) || [], pick = a === 'theme' ? (all[+b.dataset.i] || {}).name : ((document.getElementById('ownfocus') || {}).value || '').replace(/\s+/g, ' ').trim();
      if (!pick) { toast('Write a few words first.'); return; }
      f.focus = pick; f.later = all.map(function (t) { return t.name; }).filter(function (n) { return n !== pick; });
      f.ai = null; f.aiTried = false; save(false); stat('themes', a === 'theme' ? 'picked' : 'own'); return render();
    }
    if (a === 'themesretry') { ui.themesFailed = false; return render(); }
    if (a === 'tothemes') { f.step = 1; f.focus = null; f.ai = null; f.aiTried = false; save(false); return render(); }
    if (a === 'area') { f.area = +b.dataset.i; f.r = 'insight'; save(false); return render(); }
    if (a === 'resonates') { f.r = 'ideas'; save(false); return render(); }
    if (a === 'toareas') { f.r = 'areas'; save(false); return render(); }
    if (a === 'ownonly') { f.r = 'ideas'; f.ownOnly = true; save(false); return render(); }
    if (a === 'take' || a === 'own') {
      var ar = ((f.ai || {}).areas || [])[f.area || 0] || {}, c = a === 'take' ? (ar.challenges || [])[+b.dataset.i] : null;
      var tidy = function (s) { return String(s || '').replace(/^i[’']?m going to\s+|^i[’']ll\s+/i, '').replace(/^./, function (x) { return x.toUpperCase(); }).replace(/\.$/, ''); };
      var txt = c ? tidy(c.daily || c.title) : ((document.getElementById('ownch') || {}).value || '').trim();
      if (!txt) { toast('Write a few words first.'); return; }
      if (a === 'own') f.own = txt;
      // Cutting back: the challenge names the habit to reduce, and its daily line is what they'll do instead.
      S.draft.mode = f.mode || 'more'; S.draft.what = txt; S.draft.found = c ? c.title : txt; f.chosen = txt; S.draft.fromCoach = false; S.draft.sched = null;
      if (S.draft.mode === 'less') S.draft.reduce = c ? tidy(c.title) : (f.focus || S.draft.reduce || '');
      else S.draft.focusTitle = f.focus || '';
      if (f.focus) S.draft.later = (f.later || []).slice();
      // Some ideas need them to decide the actual content first (the words to say, who to message, what to write). Do that now, while it's fresh.
      var pq = c && String(c.personal_question || '').trim();
      if (pq) { S.draft.mineQ = pq; S.draft.mine = String(c.personal_draft || '').trim(); S.draft.mineWhy = ar.insight || ''; } else { S.draft.mineQ = ''; S.draft.mine = ''; S.draft.mineWhy = ''; }
      save(false);
      stat('ideas', a === 'take' ? 'took:' + (ar.name || '') : 'own'); return go(pq ? 'mine' : 'what');
    }
    if (a === 'pick') { f.pick = b.dataset.key; save(false); return render(); }
    if (a === 'chosen') { if (!f.pick) return; if (f.pick.indexOf('ai:') === 0 && f.ai && !f.daily) { var ao = f.ai.options[+f.pick.slice(3)]; if (ao && ao.daily) f.daily = ao.daily; } f.step = qs.length + 1; save(false); return go('find'); }
    if (a === 'daily') {
      var big = f.pick === 'own' ? ((document.getElementById('findbig') || {}).value || '').trim() : pickText(f);
      var daily = ((document.getElementById('finddo') || {}).value || '').trim();
      if (f.pick === 'own') f.own = big;
      if (!daily) { toast('Write one small thing you could do most days.'); return; }
      f.big = big; f.daily = daily; f.step = qs.length + 2; save(false); return go('find');
    }
    if (a === 'go') { S.draft.mode = f.mode || 'more'; S.draft.what = f.daily; S.draft.found = f.big || f.daily; save(false); return go('what'); }
  }

  // ── I'm struggling ────────────────────────────────────────────────────────
  // Stuart's videos go here when they're ready (a URL per situation). Empty = no video shown.
  var STRUGGLE_VIDEO = { start: '', off: '', spark: '' };
  var STRUGGLE = {
    start: { label: 'I can’t get started today', qs: ['What’s helped you get going before, even a little?', 'What’s the smallest version you could do in the next five minutes?', 'What’s one thing you could move out of the way right now?'] },
    off: { label: 'I’ve fallen off track', qs: ['What helped you get back on last time?', 'What would make tomorrow easier to show up for?', 'Who or what could help you get going again?'] },
    spark: { label: 'I’ve lost the spark', qs: ['What made you want this in the first place?', 'What would make it feel fresh again?', 'What could you change so it feels more like you?'] }
  };
  var PAST_YOU = ['Past you left you a note.', 'You told us this would help.', 'Here’s what you said, in your own words.'];
  function struggleScreen() {
    var hb = S.habit, k = ui.struggle, ex = extra(), worked = ex.worked || [], hard = ex.hard || {};
    var h = '<section class="screen"><div><div class="eyebrow">Support</div><h1>' + (k === 'life' ? 'Life happens.' : k ? esc(STRUGGLE[k].label) + '.' : 'Make today easier.') + '</h1></div>';
    if (!k) {
      h += stuCard('Thanks for saying so. Let’s work out what would help today. Which feels closest?') + '<div style="display:flex;flex-direction:column;gap:10px">';
      Object.keys(STRUGGLE).forEach(function (key) { h += '<button class="choice" style="min-height:62px" data-struggle="' + key + '"><b>' + esc(STRUGGLE[key].label) + '</b></button>'; });
      h += '<button class="choice" style="min-height:62px" data-struggle="life"><b>Something came up</b></button></div>';
      return h + '</section>';
    }
    var ma = mainAct(), td = todayStr(), canTick = !!ma && !counted(ma.entries[td]) && td <= lastDate() && (M.isDue(hb, ma, td) || M.isWeekly(ma, td));
    var small = ma && ma.small ? ma.small : 'a lighter version';
    if (k === 'life') {
      var nt = (ex.noticed || {})[td] || {};
      h += '<p class="lede">Give yourself a break. This isn’t about a perfect run. It’s about showing up again.</p>' +
        (ma ? '<div class="why"><span class="eyebrow">If you can</span><span>Do the lighter version: <b>' + esc(small) + '</b>. That still counts.</span></div>' : '') +
        '<div class="field"><label class="label" for="lifenote">What came up? (just for you)</label><textarea id="lifenote" rows="1" placeholder="e.g. Kids were ill, long day at work">' + esc(nt.note || '') + '</textarea></div>' +
        '<div class="spacer"></div>' + (canTick ? '<button class="btn" data-log="' + (ma.small ? 'small' : 'full') + '" data-a="' + ma.id + '" data-from="slipped">' + checkIcon('#FFFFFF') + (ma.small ? 'I did the lighter version' : 'I did it') + '</button>' : '') +
        '<button class="btn outline" data-act="lifesave">Note it and come back tomorrow</button>';
      return h + '<button class="link center" data-struggle-back="1">Something else</button></section>';
    }
    if (STRUGGLE_VIDEO[k]) h += '<video controls playsinline preload="metadata" src="' + esc(STRUGGLE_VIDEO[k]) + '" style="width:100%;border-radius:10px;background:#0F1215"></video>';
    ex.sq = ex.sq || {};
    if (!ui.struggleQ || ui.struggleKey !== k) { var i = ex.sq[k] || 0; ui.struggleQ = STRUGGLE[k].qs[i % STRUGGLE[k].qs.length]; ui.pastYou = PAST_YOU[i % PAST_YOU.length]; ex.sq[k] = i + 1; ui.struggleKey = k; ui.struggleSaved = false; save(false); }
    var mine = (hard[k] || '').trim(), before = worked.filter(function (w) { return !w.k || w.k === k; }).slice(-2).reverse();
    if (mine || before.length) {
      h += '<div class="card heard"><span class="eyebrow">' + esc(ui.pastYou || PAST_YOU[0]) + '</span>' + (mine ? '<p class="quote">“' + esc(mine) + '”</p>' : '') +
        before.map(function (w) { return '<span>“' + esc(w.a) + '”</span>'; }).join('') + '</div>';
    }
    if (ui.struggleSaved) h += '<div class="card small"><b style="font-weight:600">Saved.</b><span>It’ll be here next time you need it.</span></div>';
    else h += '<div class="field"><label class="label" for="worked">' + (mine || before.length ? 'What will you try this time?' : esc(ui.struggleQ)) + '</label><textarea id="worked" rows="1" placeholder="A few words is plenty"></textarea></div>' +
      '<button class="btn outline" data-act="saveworked">Save it</button>';
    var step = k === 'start' ? 'Do your lighter version: <b>' + esc(small) + '</b>. That counts as showing up.' :
      k === 'off' ? 'Show up once today, any size. That’s you back on.' :
      'Make it yours again. If your plan doesn’t fit any more, change it. Do it your way.';
    h += '<div class="why"><span class="eyebrow">One small step</span><span>' + step + '</span></div>';
    h += supportCard();
    h += '<div class="spacer"></div>';
    if (k === 'spark' || k === 'off') h += '<button class="btn' + (k === 'off' ? ' outline' : '') + '" data-go="plan">Adjust my plan</button>';
    if (canTick) { h += '<button class="btn' + (k === 'spark' ? ' outline' : '') + '" data-log="full" data-a="' + ma.id + '" data-from="slipped">' + checkIcon(k === 'spark' ? '#0F1215' : '#FFFFFF') + 'I showed up today</button>'; if (ma.small) h += '<button class="btn outline" data-log="small" data-a="' + ma.id + '" data-from="slipped">I did the lighter version</button>'; }
    else h += '<button class="btn outline" data-go="tracker">Back to my tracker</button>';
    return h + '<button class="link center" data-struggle-back="1">Something else</button></section>';
  }

  // ── Share image ───────────────────────────────────────────────────────────
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  async function shareImage() {
    try { await document.fonts.load('400 72px "Playfair Display"'); await document.fonts.load('600 32px Poppins'); await document.fonts.load('700 56px Poppins'); } catch (e) {}
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), L = S.habit.length, st = stats();
    g.fillStyle = '#0F1215'; g.fillRect(0, 0, W, H);
    try { await document.fonts.load('700 56px Poppins'); } catch (e) {}
    g.font = '700 56px Poppins, sans-serif'; g.textAlign = 'right';
    var bw = g.measureText('!').width; g.fillStyle = '#C9930A'; g.fillText('!', W - 80, 142);
    g.fillStyle = '#FFFFFF'; g.fillText('Let\u2019s Go', W - 80 - bw, 142); g.textAlign = 'left';
    g.fillStyle = '#EDE8DF'; g.font = '600 34px Poppins, sans-serif'; g.fillText(((L === 365 ? '1-year' : L + '-day') + ' plan').toUpperCase(), 80, 140);
    g.fillStyle = '#FFFFFF'; g.font = '400 88px "Playfair Display", Georgia, serif';
    var lines = wrap(g, habitName(), W - 160), y = 330; lines.slice(0, 3).forEach(function (l) { g.fillText(l, 80, y); y += 100; });
    var cols = L > 200 ? 28 : L > 100 ? 20 : 10, gap = L > 100 ? 6 : 18, size = (W - 160 - gap * (cols - 1)) / cols; y += 20;
    for (var n = 1; n <= L; n++) {
      var col = (n - 1) % cols, row = Math.floor((n - 1) / cols), x = 80 + col * (size + gap), yy = y + row * (size + gap), ds = daySummary(dayDate(n)).s;
      g.beginPath(); g.arc(x + size / 2, yy + size / 2, size / 2, 0, Math.PI * 2);
      if (ds === 'full' || ds === 'small') { g.fillStyle = '#C9930A'; g.fill(); }
      else if (ds === 'unlogged') { g.lineWidth = 2; g.strokeStyle = '#1C2B3A'; g.stroke(); }
      else { g.fillStyle = '#1C2B3A'; g.fill(); }
    }
    y += Math.ceil(L / cols) * (size + gap) + 60;
    g.fillStyle = '#FFFFFF'; g.font = '600 120px Poppins, sans-serif'; g.fillText(String(st.done), 80, y + 60);
    g.fillStyle = '#EDE8DF'; g.font = '500 40px Poppins, sans-serif'; g.fillText('show-up' + (st.done === 1 ? '' : 's') + (st.planned ? ' from ' + st.planned + ' planned' : ''), 80, y + 130);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    var file = new File([blob], 'my-progress.png', { type: 'image/png' });
    var text = habitName() + ': ' + st.done + ' show-up' + (st.done === 1 ? '' : 's') + (st.planned ? ' from ' + st.planned + ' planned' : '') + ' so far.';
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text }); } catch (err) { /* cancelled */ }
    } else {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-progress.png'; document.body.appendChild(a); a.click(); a.remove();
      toast('Image saved. Post it wherever you like.');
    }
  }
  function wrap(g, text, max) { var out = [], line = ''; String(text).split(' ').forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }

  // ── Phone notifications ──────────────────────────────────────────────────
  var swReg = null;
  if ('serviceWorker' in navigator) {
    // Always check for a newer version on open, and switch to it straight away (unless they're mid-typing).
    var hadSW = !!navigator.serviceWorker.controller, swReloaded = false;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (r) { swReg = r; try { r.update(); } catch (e) {} }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      var typing = document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
      if (hadSW && !swReloaded && !typing) { swReloaded = true; location.reload(); }
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && swReg) { try { swReg.update(); } catch (e) {} } });
  }
  function b64ToBytes(b) { var p = '='.repeat((4 - b.length % 4) % 4), s = (b + p).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  async function togglePush() {
    if (S.settings.push) {
      try { var reg = swReg || await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); if (sub) { if (user) await sb.from('lg_push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch (e) {}
      S.settings.push = false; save(); return render();
    }
    if (!user) { toast('Sign in first, so we know where to send it.'); ui.returnTo = 'settings'; return go('account'); }
    if (isIOS() && !isStandalone()) { return go('install'); }
    if (!pushSupported()) { toast('This browser can’t do phone notifications. Email still works.'); return; }
    try {
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('No problem. You can switch it on later in your browser settings.'); return render(); }
      var reg2 = swReg || await navigator.serviceWorker.ready;
      var sub2 = await reg2.pushManager.getSubscription() || await reg2.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(await vapidKey()) });
      var j = sub2.toJSON();
      var r = await sb.from('lg_push_subscriptions').upsert({ endpoint: j.endpoint, user_id: user.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
      if (r.error) throw r.error;
      var hadEmail = S.settings.email; S.settings.push = true; S.settings.email = false; save(); toast(hadEmail ? 'Done. One nudge on your phone at ' + fmtTime(S.settings.time) + ', so we’ve switched the email off. Change it any time in Settings.' : 'Done. Your nudge will arrive at ' + fmtTime(S.settings.time) + '.'); render();
    } catch (e) { console.warn(e); toast('That didn’t work just now. Email still works.'); }
  }

  // ── Install prompt ────────────────────────────────────────────────────────
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (S.screen === 'install') render(); });
  window.addEventListener('appinstalled', function () { deferredInstall = null; toast('Added to your phone.'); if (S.screen === 'install') render(); });
  function iconDownload() { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>'; }

  // ── Word sphere ───────────────────────────────────────────────────────────
  var sphereRAF = null;
  function startSphere() {
    var box = document.getElementById('sphere'); if (!box) return;
    var els = Array.prototype.slice.call(box.querySelectorAll('.w'));
    var w = words(), colours = ['#C9930A', '#FFFFFF', '#EDE8DF'];
    var n = els.length, golden = Math.PI * (3 - Math.sqrt(5));
    var pts = els.map(function (_, i) { var y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i; return [Math.cos(th) * r, y, Math.sin(th) * r]; });
    var ax = -0.35, ay = 0, drag = false, moved = 0, lx = 0, ly = 0;
    var still = S.settings.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw() {
      var size = box.clientWidth, R = size * 0.37, C = size / 2;
      var cax = Math.cos(ax), sax = Math.sin(ax), cay = Math.cos(ay), say = Math.sin(ay);
      pts.forEach(function (p, i) {
        var x1 = p[0] * cay + p[2] * say, z1 = -p[0] * say + p[2] * cay;
        var y2 = p[1] * cax - z1 * sax, z2 = p[1] * sax + z1 * cax, d = (z2 + 1) / 2;
        var el = els[i];
        el.style.transform = 'translate(' + (C + x1 * R) + 'px,' + (C + y2 * R) + 'px) translate(-50%,-50%) scale(' + (0.7 + 0.5 * d).toFixed(3) + ')';
        el.style.opacity = (0.3 + 0.7 * d).toFixed(2); el.style.zIndex = Math.round(d * 100); el.style.color = colours[i % 3];
      });
    }
    function loop() { if (!document.getElementById('sphere')) return; if (!drag && !still) ay += 0.008; draw(); sphereRAF = requestAnimationFrame(loop); }
    cancelAnimationFrame(sphereRAF); loop();
    box.addEventListener('pointerdown', function (e) { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; });
    box.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy); ay += dx * 0.012; ax = Math.max(-1.3, Math.min(1.3, ax - dy * 0.012)); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { box.addEventListener(ev, function () { drag = false; }); });
    box.addEventListener('click', function (e) {
      if (moved > 6) { e.stopPropagation(); moved = 0; return; }
      var b = e.target.closest('[data-word]'), card = document.getElementById('wordcard');
      if (b) card.innerHTML = '<div class="card"><div class="eyebrow">You’ll feel</div><div style="font-family:var(--display);font-size:38px;line-height:1">' + esc(w[+b.dataset.word].toLowerCase()) + '</div><div>Because you’re showing up for <b>' + esc(habitName().toLowerCase()) + '</b>.</div></div>';
      if (e.target.closest('[data-act="whole"]')) { card.innerHTML = '<div class="why"><div class="eyebrow">The whole picture</div><div style="font-family:var(--display);font-size:24px;line-height:1.35">It’s an ordinary morning. You’ve done it: ' + esc(habitName().toLowerCase()) + '. You feel ' + esc(w.join(', ').toLowerCase()) + '.</div><div class="soft" style="font-size:14px">And on the tough days: ' + esc((S.habit || S.draft).dimmer) + '.</div></div>'; e.stopPropagation(); }
    });
  }

  // ── Events ────────────────────────────────────────────────────────────────
  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.tagName === 'TEXTAREA') grow(t);
    if (t.id === 'walkplan') ui.walkPlan = t.value;
    if (t.id === 'sayans') { S.draft.say = t.value; save(false); var sb2 = view.querySelector('[data-act="shape"]'); if (sb2) sb2.disabled = !t.value.trim(); }
    if (t.dataset.bind) {
      S.draft[t.dataset.bind] = t.value; save(false);
      var pn = document.getElementById('previewName'); if (pn && t.dataset.bind === 'what') { pn.textContent = t.value.trim() || 'Your habit'; var pw = document.getElementById('previewWrap'); if (pw) pw.style.display = t.value.trim() ? 'flex' : 'none'; }
      if (t.dataset.bind === 'mine') { var mb = view.querySelector('[data-act="minedone"]'); if (mb) mb.disabled = !t.value.trim(); }
      if (t.dataset.bind === 'instead') { view.querySelectorAll('[data-loop="instead"]').forEach(function (li) { li.textContent = t.value.trim() || 'Your instead'; }); }
      var next = view.querySelector('[data-step-next]');
      if (next) next.disabled = !stepValid(next.dataset.stepNext);
    }
    if (t.dataset.xbind && S.habit) { extra()[t.dataset.xbind] = t.value; touchF(); save(); }
    if (t.dataset.fbind && S.habit) { if (t.dataset.fbind === 'title' && !t.value.trim()) return; S.habit[t.dataset.fbind] = t.value; touchF(); save(); }
    if (t.dataset.ebind && ui.edit) { ui.edit[t.dataset.ebind] = t.value; }
    if (t.dataset.rbind) { ui.reflect[t.dataset.rbind] = t.value; }
    if (t.id === 'findans') findSave();
    if (t.id === 'winname') ui.winDraft = t.value;
    if (t.id === 'finddo' && S.find) { S.find.daily = t.value; save(false); }
    if (t.id === 'findbig' && S.find) { S.find.own = t.value; save(false); }
  });
  view.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'firstname') { e.preventDefault(); nameDone(false); } if (e.key === 'Enter' && e.target.id === 'aemail') { e.preventDefault(); void sendCode(); } if (e.key === 'Enter' && e.target.id === 'acode') { e.preventDefault(); void verifyCode(); } });
  function paintOtp() {
    var c = document.getElementById('acode'); if (!c) return;
    var v = c.value.replace(/\D/g, '').slice(0, 6); if (c.value !== v) c.value = v;
    var bx = view.querySelectorAll('.otp-boxes span');
    bx.forEach(function (b, i) { b.textContent = v[i] || ''; b.classList.toggle('on', i === Math.min(v.length, 5) && document.activeElement === c); });
  }
  view.addEventListener('input', function (e) { if (e.target.id === 'acode') { paintOtp(); var er = document.getElementById('aerr'); if (er) er.hidden = true; if (e.target.value.length === 6) void verifyCode(); } });
  view.addEventListener('focusin', function (e) { if (e.target.id === 'acode') paintOtp(); });
  view.addEventListener('focusout', function (e) { if (e.target.id === 'acode') paintOtp(); });
  view.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.name) { e.preventDefault(); e.target.blur(); } });
  view.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.name) { e.target.value = e.target.value.replace(/\s+/g, ' ').trim(); saveName(e.target.value); if (e.target.value.trim()) toast('Lovely to meet you, ' + e.target.value.trim() + '.'); return; }
    if (e.target.id === 'rtime' && e.target.value) { S.settings.time = e.target.value; save(); toast('Nudge moved to ' + fmtTime(S.settings.time) + '.'); }
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('button, [data-act="closeideas"]'); if (!b || b.closest('.celebrate')) return;
    var d = b.dataset;
    var dk = Object.keys(d)[0]; if (dk) stat('tap', dk + ':' + d[dk]); else if (b.id) stat('tap', b.id);
    if (d.go) { if (d.go === 'reflect') ui.reflect = null; if (d.go === 'note') ui.noteDay = null; if (d.go === 'install') ui.installFrom = null; if (d.go === 'slipped') ui.struggle = null; return go(d.go); }
    if (d.date) return openDay(d.date);
    if (d.catch) return catchDay(d.catch);
    if (d.log) return logAct(d.a, d.log, null, d.from || (S.screen === 'slipped' ? 'slipped' : S.screen));
    if (d.unlog) return unlogAct(d.unlog);
    if (d.note) { ui.noteDay = todayStr(); ui.noteAct = d.note; return go('note'); }
    if (d.sfrom) return schedClick(d);
    if (d.editact) { var ea = d.editact === 'new' ? null : actById(d.editact); ui.edit = ea ? { id: ea.id, text: ea.text, cue: ea.cue || '', small: ea.small || '', rule: JSON.parse(JSON.stringify(ruleNow(ea))) } : { id: 'new', text: '', cue: '', small: '', rule: null }; return go('actedit'); }
    if (d.lateruse) { var lx = S.habit.later[+d.lateruse]; if (lx) { ui.edit = { id: 'new', text: lx.text || '', cue: '', small: lx.small || '', rule: lx.schedule || null, later: +d.lateruse }; return go('actedit'); } return; }
    if (d.laterdrop) { S.habit.later[+d.laterdrop].used = true; touchF(); save(); return render(); }
    if (d.laterfocus) { var lf = S.habit.later[+d.laterfocus]; return confirmSheet('Start “' + lf.title + '” next?', 'Your current plan is kept in Past plans, with everything you’ve done.', 'Start it', function () { lf.used = true; touchF(); var t2 = lf.title; archiveAndReset(); S.draft = fresh().draft; S.draft.say = t2; save(false); go('say'); }); }
    if (d.reopen) { var rf = S.archive[+d.reopen]; return confirmSheet('Make this your focus again?', S.habit ? 'Your current plan is kept in Past plans.' : 'You can pick up where you left off.', 'Yes, bring it back', function () { reopenFocus(+d.reopen); }); }
    if (d.calgoogle) { calRead(); var ga = actById(d.calgoogle); try { window.open(googleCalURL(ga), '_blank', 'noopener'); } catch (e2) {} stat('calendar', 'google'); return; }
    if (d.reduceidea) { S.draft.reduce = d.reduceidea; save(false); return render(); }
    if (d.struggle) { ui.struggle = d.struggle; return render(); }
    if (d.find) return findAct(d.find, b);
    if (d.winout) return addWin(d.winout);
    if (d.win) return openWin(d.win);
    if (d.winidea) { var wt = document.getElementById('winname'); if (wt) { wt.value = d.winidea; ui.winDraft = d.winidea; grow(wt); wt.focus(); } return; }
    if (d.walkdid) { var yw = walks()[addDays(todayStr(), -1)]; if (yw) { yw.did = d.walkdid; save(); stat('walkdid', d.walkdid); } if (d.walkdid !== 'no') toast(d.walkdid === 'yes' ? 'Good. That’s how it builds.' : 'Partly still counts.'); else toast('Noted. Today’s a fresh go.'); return render(); }
    if (d.walkwhen) { S.settings.walkWhen = d.walkwhen; save(); return render(); }
    if (d.sayex) { var st0 = document.getElementById('sayans'); st0.value = (st0.value.trim() ? st0.value.trim() + '. ' : (S.draft.mode === 'less' ? 'I’d like to stop ' : 'I’d like to ')) + d.sayex; st0.dispatchEvent(new Event('input', { bubbles: true })); grow(st0); return; }
    if (d.focus != null && S.screen === 'hearing') return pickFocus(+d.focus);
    if (d.coachans) { var dq = S.draft, q0 = (dq.coachQs || [])[0]; dq.coachAnswers = (dq.coachAnswers || []).concat([{ q: q0 ? q0.q : '', a: d.coachans }]); dq.coachQs = []; save(false); return void coachActions(); }
    if (d.act1 != null) { if (d.act1 === 'own') { S.draft.pick = -1; S.draft.what = ''; S.draft.dimmer = ''; save(false); return askNameThen('feel'); } S.draft.pick = +d.act1; save(false); return render(); }
    if (d.mic) { if (S.screen === 'say') { var sa = document.getElementById('sayans'); return toggleMic(b, sa, function () { S.draft.say = sa.value; save(false); var sb3 = view.querySelector('[data-act="shape"]'); if (sb3) sb3.disabled = !sa.value.trim(); }); } if (S.screen === 'walk') { var wpt = document.getElementById('walkplan'); return toggleMic(b, wpt, function () { ui.walkPlan = wpt.value; }); } if (S.screen === 'mine') { var mt = document.getElementById('mine'); return toggleMic(b, mt, function () { S.draft.mine = mt.value; save(false); var mb = view.querySelector('[data-act="minedone"]'); if (mb) mb.disabled = !mt.value.trim(); }); } return toggleMic(b); }
    if (d.horizon) { findSave(); S.find.horizon = d.horizon; save(false); return render(); }
    if (d.struggleBack) { ui.struggle = null; return render(); }
    if (d.back) return appBack();
    if (d.start) { S.draft.mode = d.start; return askNameThen('what'); }
    if (d.namego) return nameDone(d.namego === 'skip');
    if (d.dimidea) { S.draft.dimmer = d.dimidea; save(false); render(); var dt = document.getElementById('dim'); if (dt) { dt.focus(); dt.setSelectionRange(dt.value.length, dt.value.length); } return; }
    if (d.starter) { S.draft.what = d.starter; save(false); return render(); }
    if (d.stepNext) { if (!stepValid(d.stepNext)) return; var nx = nextStep(d.stepNext); if (nx) return go(nx); return finishSetup(); }
    if (d.give) { var gi = S.draft.gives.indexOf(d.give); gi >= 0 ? S.draft.gives.splice(gi, 1) : S.draft.gives.push(d.give); save(false); b.setAttribute('aria-pressed', gi < 0); view.querySelectorAll('[data-loop="gives"]').forEach(function (lg) { lg.textContent = S.draft.gives.length ? S.draft.gives.join(', ') : 'Tap above'; }); view.querySelectorAll('[data-give="' + d.give + '"]').forEach(function (x) { x.setAttribute('aria-pressed', gi < 0); }); return; }
    if (d.feel) { var fi = S.draft.feel.indexOf(d.feel); fi >= 0 ? S.draft.feel.splice(fi, 1) : S.draft.feel.push(d.feel); save(false); b.setAttribute('aria-pressed', fi < 0); var nb = view.querySelector('[data-step-next]'); if (nb) nb.disabled = !stepValid(nb.dataset.stepNext); return; }
    if (d.len) { var lc = document.getElementById('lencustom'); if (lc) lc.value = ''; view.querySelectorAll('[data-len]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); ui.lenPick = +d.len; return; }
    if (d.length) { ui.returnTo = d.length; return go('length'); }
    if (d.edit) { ui.planEdit = true; return go('plan'); }
    if (d.idea) { S.draft.what = IDEAS[+d.idea][0]; ui.ideasOpen = false; save(false); return render(); }
    if (d.words) { ui.wordsFrom = d.words; return go('words'); }
    if (d.account) { ui.returnTo = d.account; ui.authFrom = null; return go('account'); }
    if (d.anchor !== undefined && S.screen === 'when') { S.draft.anchor = d.anchor; save(false); return render(); }
    if (d.vp) { ui.vp = d.vp; return render(); }
    if (d.cal) { ui.calFrom = d.cal; ui.cal = null; return go('calendar'); }
    if (d.act === 'vpgo') { S.settings.view = ui.vp || S.settings.view || 'full'; S.viewChosen = true; ui.vp = null; save(); return go(ui.afterName || 'what'); }
    if (d.view) {
      if (S.settings.view !== d.view) { S.settings.view = d.view; save(); toast(d.view === 'focus' ? 'Focused view on.' : 'Detailed view on.'); }
      return render();
    }
    if (d.text) { S.settings.text = d.text; applyComfort(); save(); return render(); }
    if (d.toggle) {
      if (d.toggle === 'email' && !user) { ui.returnTo = 'settings'; return go('account'); }
      if (d.toggle === 'analytics') { S.settings.analytics = S.settings.analytics === false; if (!S.settings.analytics) statQ = []; save(); return render(); }
      S.settings[d.toggle] = !S.settings[d.toggle]; applyComfort(); save(); return render();
    }
    if (d.pause) { S.habit.pauses = (S.habit.pauses || []).concat([{ from: todayStr(), to: addDays(todayStr(), +d.pause - 1) }]); touchF(); save(); stat('pause', d.pause); toast('Enjoy the break. Back on ' + prettyDate(addDays(todayStr(), +d.pause)) + '.'); return render(); }
    if (d.rnext) { ui.reflect.next = d.rnext; return render(); }
    if (d.rpmf) { ui.reflect.pmf = d.rpmf; return render(); }
    switch (d.act) {
      case 'ideas': ui.ideasOpen = true; return render();
      case 'closeideas': if (e.target.closest('[data-stop]') && !b.matches('button')) return; ui.ideasOpen = false; return render();
      case 'startplan': S.draft = fresh().draft; S.draft.mode = b.dataset.mode || 'more'; save(false); return go('say');
      case 'shape': return void coachUnderstand();
      case 'coachacts': return void coachActions();
      case 'hearingnext': return hearingNext();
      case 'finish': return finishSetup();
      case 'later': S.later = true; if (S.habit && !count()) { S.habit.start = addDays(todayStr(), 1); acts().forEach(function (x) { x.schedules.forEach(function (r) { if (r.from < S.habit.start) r.from = S.habit.start; }); x.from = x.from && x.from < S.habit.start ? S.habit.start : x.from; touchA(x); }); touchF(); } save(); return render();
      case 'gosettings': return go('settings');
      case 'starttoday': S.habit.start = todayStr(); S.later = false; acts().forEach(function (x) { x.schedules.forEach(function (r) { if (r.from > todayStr()) r.from = todayStr(); }); if (x.from && x.from > todayStr()) x.from = todayStr(); touchA(x); }); touchF(); save(); return render();
      case 'resume': S.habit.pauses = (S.habit.pauses || []).map(function (p) { if (!p.to || p.to >= todayStr()) p.to = addDays(todayStr(), -1); return p; }).filter(function (p) { return p.to >= p.from; }); touchF(); save(); toast('Welcome back.'); return render();
      case 'reopen': S.habit.finishedOn = null; S.habit.length = Math.max(S.habit.length, todayNum() + 29); touchF(); save(); toast('Keep going. Your next look back is in ' + (S.habit.length - todayNum() + 1) + ' days.'); return render();
      case 'logextra': return logExtraSheet();
      case 'syncnow': syncRetry = 0; return void syncAll();
      case 'startdate': return startDateSheet();
      case 'tryfocus': S.viewTipDone = true; S.settings.view = 'focus'; save(); toast('Focused view on. Switch back in Settings, under How it looks.'); return render();
      case 'viewtipno': S.viewTipDone = true; save(false); return render();
      case 'lensave': { var lc2 = document.getElementById('lencustom'), cv = lc2 && +lc2.value, L2 = cv ? Math.max(7, Math.min(730, Math.round(cv))) : (ui.lenPick || (S.habit ? S.habit.length : S.draft.length)); ui.lenPick = null; if (S.habit) { S.habit.length = L2; touchF(); } else S.draft.length = L2; save(); return appBack(); }
      case 'actsave': return saveActEdit();
      case 'actremove': return confirmSheet('Take this out of your plan?', 'It stops from today. Everything you’ve already logged for it is kept.', 'Take it out', function () { var ra = actById(ui.edit.id); ra.until = addDays(todayStr(), -1) < (ra.from || S.habit.start) ? (ra.from || S.habit.start) : addDays(todayStr(), -1); if (!Object.keys(ra.entries).some(function (k) { return counted(ra.entries[k]); }) && ra.until <= S.habit.start) { ra.extra = Object.assign({}, ra.extra, { retired: true }); } touchA(ra); save(); ui.edit = null; toast('Taken out of your plan.'); go('plan'); });
      case 'editfocus': ui.planEdit = true; return render();
      case 'focusdone': ui.planEdit = false; save(); toast('Plan updated.'); return render();
      case 'sharenoticed': ui.reflect.shareNoticed = !ui.reflect.shareNoticed; return render();
      case 'savenote': { var nd = ui.noteDay || todayStr(), na = actById(ui.noteAct) || mainAct(), v = document.getElementById('note').value.trim(); ui.noteDay = null; ui.noteAct = null; if (!na) return go('tracker'); if (!na.entries[nd]) na.entries[nd] = { kind: 'none', note: '' }; na.entries[nd].note = v; touchC(na, nd); save(); toast('Note saved.'); return go('tracker'); }
      case 'morechips': ui.moreChips = true; return render();
      case 'catchdone': { var cd = catchDays(); S.catchup = (S.catchup || []).concat(cd).slice(-40); save(false); return render(); }
      case 'reflectai': return void reflectAI();
      case 'saveworked': { var wv = (document.getElementById('worked') || {}).value || ''; if (!wv.trim()) { toast('Write a few words first, or skip it.'); return; }
        var ex = extra(); ex.worked = (ex.worked || []).concat([{ k: ui.struggle || '', q: ui.struggleQ || '', a: wv.trim(), at: new Date().toISOString() }]); save(); ui.struggleSaved = true; return render(); }
      case 'lifesave': { var lv = ((document.getElementById('lifenote') || {}).value || '').trim(), lx = extra(), td = todayStr(); lx.noticed = lx.noticed || {}; var cur = lx.noticed[td] || { why: [] }; cur.why = cur.why || []; if (cur.why.indexOf('Plans changed') < 0) cur.why.push('Plans changed'); if (lv) cur.note = lv; cur.at = nowISO(); lx.noticed[td] = cur; touchF(); save(); ui.struggle = null; toast('Noted. See you next time.'); return go('tracker'); }
      case 'calics': calRead(); downloadICS(); return;
      case 'testerreload': return void (async function () { try { if (window.caches) { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return k.indexOf('letsgo-v2-') === 0; }).map(function (k) { return caches.delete(k); })); } } catch (e) {} location.reload(); })();
      case 'copyfeedback': { var fl = location.origin + location.pathname.replace(/[^/]*$/, '') + '../letsgo/feedback.html'; try { navigator.clipboard.writeText(fl).then(function () { toast('Copied. Paste it anywhere to share.'); }, function () { toast(fl); }); } catch (e) { toast(fl); } return; }
      case 'walktimer': {
        var wt = document.getElementById('walktimer'); if (!wt) return;
        wt.innerHTML = '<div class="tbar"><i></i></div><span class="hint" id="wtl">One minute. Take your time.</span>';
        clearTimeout(ui.walkT); ui.walkT = setTimeout(function () { var l = document.getElementById('wtl'); if (l) l.textContent = 'That’s a minute. Nicely done.'; buzz(); }, 60000);
        return;
      }
      case 'walkdone': {
        stopMic(); clearTimeout(ui.walkT);
        var wd = walkDay(), wp = ((document.getElementById('walkplan') || {}).value || '').trim().slice(0, 300);
        walks()[wd] = { at: new Date().toISOString(), plan: wp }; ui.walkPlan = null; save();
        stat('walk', wp ? 'plan' : 'done');
        toast(wd > todayStr() ? 'Walked through. Tomorrow’s ready.' : 'Walked through. Now go and do it.'); return go('tracker');
      }
      case 'minedone': stopMic(); if (!(S.draft.mine || '').trim()) return; S.draft.mine = S.draft.mine.trim(); save(false); return go('what');
      case 'testerreset': return confirmSheet('Start again from scratch?', 'Everything on this phone and in your account goes, so you start as a new person.', 'Start again', testerReset);
      case 'sharenote': ui.shareNote = !ui.shareNote; return render();
      case 'shareimg': return void shareImage();
      case 'whatsapp': { var sw = stats(); window.open('https://wa.me/?text=' + encodeURIComponent(habitName() + ': I’ve shown up ' + sw.done + ' time' + (sw.done === 1 ? '' : 's') + (sw.planned ? ' from ' + sw.planned + ' planned' : '') + ' so far, with Let’s Go!'), '_blank', 'noopener'); return; }
      case 'fb3send': { var v3 = (document.getElementById('fb3') || {}).value || ''; void feedback('day3', v3.trim() || '(nothing)'); toast('Thank you. Stuart reads every one.'); return render(); }
      case 'fb3skip': S.fb.day3 = true; save(); return render();
      case 'installno': S.installDismissed = true; save(); return render();
      case 'install': ui.installFrom = null; return go('install');
      case 'readydone': if (!isStandalone() && !S.installShown) { S.installShown = true; save(false); ui.installFrom = 'tracker'; return go('install'); } return go('tracker');
      case 'installdone': ui.installFrom = null; S.installDismissed = true; save(false); return go('tracker');
      case 'copylink': try { navigator.clipboard.writeText(location.origin + location.pathname); toast('Link copied. Open it on your phone.'); } catch (e) { toast(location.origin + location.pathname); } return;
      case 'doinstall': if (deferredInstall) { var dp = deferredInstall; dp.prompt(); (dp.userChoice || Promise.resolve({})).then(function (c) { if (c && c.outcome === 'accepted') { deferredInstall = null; render(); } }); } return;
      case 'push': return void togglePush();
      case 'quoteok': ui.reflect.ok = !ui.reflect.ok; return render();
      case 'savereflect': return void saveReflect();
      case 'planedit': ui.planEditFrom = S.screen; ui.planEdit = true; if (S.screen !== 'ready') return go('plan'); return render();
      case 'planeditdone': ui.planEdit = false; save(); toast('Plan updated.'); return render();
      case 'newhabit': return confirmSheet('Start a new plan?', 'Your current plan and everything you’ve logged is kept in Past plans' + (user ? ', on this phone and in your account.' : ' on this phone. Add your email to keep it safe in an account too.'), 'Start a new plan', function () { archiveAndReset(); go('landing'); });
      case 'signin': return void doSignIn();
      case 'sendcode': return void sendCode();
      case 'verifycode': return void verifyCode();
      case 'authback': ui.authStep = null; return render();
      case 'plannotnow': ui.authFrom = null; ui.authStep = null; stat('sendplan', 'later'); return go('ready');
      case 'nudgeyes': stat('nudgeask', user ? 'yes' : 'email'); if (!user) { ui.returnTo = 'tracker'; return go('account'); } var pa2 = S.pushAsk || { n: 0 }; S.pushAsk = { n: (pa2.n || 0) + 1, at: todayStr() }; save(false); return void togglePush();
      case 'nudgeno': var pa = S.pushAsk || { n: 0 }; S.pushAsk = { n: (pa.n || 0) + 1, at: todayStr() }; save(false); stat('nudgeask', 'not now'); return render();
      case 'stuok': S.stuSeen = S.stuSeen || {}; S.stuSeen[todayStr()] = true; save(false); return render();
      case 'stucheck': S.stuSeen = S.stuSeen || {}; S.stuSeen[todayStr()] = true; feedback('checkin-day' + todayNum(), b.dataset.v); stat('checkin', b.dataset.v); toast('Thanks. Stu reads these.'); return render();
      case 'tlrmember': S.settings.tlrMember = b.dataset.v === 'yes'; save(); stat('support', 'member:' + b.dataset.v); return render();
      case 'booster': return openLink(S.settings.tlrMember ? SUPPORT.boosterMember : SUPPORT.boosterStandard, S.settings.tlrMember ? 'booster-member' : 'booster');
      case 'tlrbridge': return tlrBridge();
      case 'tlrtoggle': S.settings.tlrMember = !S.settings.tlrMember; save(); return render();
      case 'signinlater': S.signinLater = todayStr(); save(false); return render();
      case 'exportdata': return exportData();
      case 'deletedata': return confirmSheet('Delete your Let’s Go data?', 'This deletes your habit, show-ups, notes, past wins and settings from this device' + (user ? ', and deletes your account' : '') + '. It can’t be undone.', 'Delete my data', function () { void deleteData(); });
      case 'signout': return void (async function () { if (pendingCount()) { await syncAll(); if (pendingCount()) return toast('Some changes haven’t reached your account yet. Check your connection, then try again.'); } await sb.auth.signOut(); user = null; guest = null; S = fresh(); save(false); applyComfort(); go('landing'); })();
    }
  });
  backBtn.addEventListener('click', appBack);
  fwdBtn.addEventListener('click', goForward);
  settingsBtn.addEventListener('click', function () { if (!S.habit && isTester()) return confirmSheet('Start again from scratch?', 'Testing only. Everything on this phone and in your account goes, so you start as a new person.', 'Start again', testerReset); go('settings'); });
  // Tester tools: tap the Let's Go! logo 5 times quickly to switch them on (survives reinstalls, no link needed).
  var logoTaps = [];
  document.getElementById('homeBtn').addEventListener('click', function () {
    var now = Date.now(); logoTaps = logoTaps.filter(function (t) { return now - t < 3000; }); logoTaps.push(now);
    if (logoTaps.length >= 5 && !isTester()) { logoTaps = []; try { localStorage.setItem('showup-tester', '1'); } catch (e) {} toast('Tester tools on. Your cog is top right.'); return render(); }
    ui.ideasOpen = false; go(S.habit ? 'tracker' : 'landing');
  });

  // Suggestions and examples: always shown in Full; in Focus they wait behind one tap.
  // Extras that wait behind one tap in both views.
  function tapToSee(label, html) { return '<details class="ask"><summary>' + esc(label) + '</summary>' + html + '</details>'; }
  function optional(label, html) {
    return '<div class="full-only">' + html + '</div><details class="ask focus-only"><summary>' + esc(label) + '</summary>' + html + '</details>';
  }
  function iconFull(c, z) { z = z || 20; return '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="' + c + '"/></svg>'; }
  function iconDown(c, z) { z = z || 20; return '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="' + c + '" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="' + c + '"/></svg>'; }
  function iconClock(c) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'; }


  // ── Install steps: three pictures, a few words each ───────────────────────
  var IV = {
    share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10H6v10h12V10h-2"/><path d="M12 3v11M8.5 6.5L12 3l3.5 3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/></svg>'
  };
  function visBar(icon, top) {
    var dim = '<i></i><i></i>';
    return '<div class="iv bar' + (top ? ' top' : '') + '">' + (top ? '<span class="url"></span><b class="hit">' + icon + '</b>' : dim + '<b class="hit">' + icon + '</b>' + dim) + '</div>';
  }
  function visMenu(icon, label) { return '<div class="iv menu"><i></i><i></i><b class="hit row">' + icon + '<span>' + label + '</span></b><i></i></div>'; }
  function visHome() { return '<div class="iv ivhome"><i></i><i></i><i></i><i></i><b class="hit ivapp"><img src="icons/icon-192.png" alt=""></b><i></i></div>'; }
  function installSteps(kind) {
    var st = kind === 'ios' ? [
      [visBar(IV.share), 'Tap Share', 'The square with an arrow. On newer iPhones, tap ··· first.'],
      [visMenu(IV.plus, 'Add to Home Screen'), 'Tap Add to Home Screen', 'Scroll down a little if you can’t see it.'],
      [visHome(), 'Open it and sign in', 'Sign in with your email to bring your progress.']
    ] : [
      [visBar(IV.dots, true), 'Tap the three dots', 'Top right in Chrome.'],
      [visMenu(IV.down, 'Install app'), 'Tap Install app', 'Some phones say Add to Home screen.'],
      [visHome(), 'Open it and sign in', 'Sign in with your email to bring your progress.']
    ];
    var h = '<ol class="isteps">';
    st.forEach(function (x, i) { h += '<li class="istep">' + x[0] + '<div class="itxt"><span class="inum">' + (i + 1) + '</span><b>' + x[1] + '</b><small class="full-only">' + x[2] + '</small></div></li>'; });
    if (kind === 'ios' && /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)) h += '<li class="hint" style="list-style:none">Using Chrome on iPhone? The Share button is at the top right.</li>';
    return h + '</ol>';
  }
  function phoneIcon() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>'; }
  function iconPlan() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'; }
  var PICON = {
    what: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="#0F1215"/></svg>',
    why: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#C9930A"/></svg>',
    swap: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    when: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  // ── Calendar: a repeating reminder in their own calendar, in their own words ──
  var APPLINK = 'https://motivate-coaching.github.io/tlr-hub/letsgo2/';
  function iconCal() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'; }
  function calRead() { var t = document.getElementById('caltime'), d = document.getElementById('calstart'); ui.cal = ui.cal || {}; if (t && t.value) ui.cal.time = t.value; if (d && d.value) ui.cal.start = d.value; }
  function icsEsc(x) { return String(x).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // Calendar lines must stay under 75 bytes; long ones carry on after a space.
  function icsFold(line) {
    var out = [], cur = '', n = 0, enc = window.TextEncoder ? new TextEncoder() : null;
    Array.from(line).forEach(function (ch) { var b = enc ? enc.encode(ch).length : 1; if (n + b > 73) { out.push(cur); cur = ' '; n = 1; } cur += ch; n += b; });
    out.push(cur); return out.join('\r\n');
  }
  // The plan: their own answers, laid out simply, each one editable.

  // The habit loop: the pull still comes, you choose what happens next, you still get something.
  function loopCard() {
    var d = S.draft;
    return '<div class="loop" aria-label="How the swap works">' +
      '<div class="lp"><span class="n">1</span><div><b>The pull</b><span>The urge, the moment, the 4pm slump</span></div></div>' +
      '<div class="arrow" aria-hidden="true"></div>' +
      '<div class="lp choose"><span class="n">2</span><div><b>What you do</b><span class="old">' + esc(d.what.trim() || 'The old habit') + '</span>' +
      '<span class="new" data-loop="instead">' + esc(d.instead.trim() || 'Your instead') + '</span></div></div>' +
      '<div class="arrow" aria-hidden="true"></div>' +
      '<div class="lp"><span class="n">3</span><div><b>What you get</b><span data-loop="gives">' + esc(d.gives.length ? d.gives.join(', ') : 'Tap above') + '</span></div></div>' +
      '<p class="cap">The pull still comes. You choose what happens next.</p></div>';
  }
  function finishSetup() {
    var dr = S.draft, start = todayStr(), less = dr.mode === 'less';
    var rule = dr.sched || { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] };
    var act = { id: uuid(), text: dr.what.trim(), small: (dr.dimmer || '').trim(), up: (dr.upVersion || '').trim(), cue: (dr.anchor || '').trim(), schedules: [Object.assign({ from: start }, rule)], sort: 0, from: start, entries: {}, extra: dr.coachWhy ? { why: dr.coachWhy } : {}, createdAt: nowISO() };
    var later = (dr.laterActs || []).map(function (x) { return { kind: 'action', text: x.text, small: x.small || '', up: x.up || '', schedule: x.schedule || null }; })
      .concat((dr.later || []).map(function (t) { return { kind: 'focus', title: t }; }));
    var title = less ? (dr.reduce || dr.focusTitle || '').trim() : (dr.focusTitle || dr.what || '').trim();
    var ex = Object.assign({ hard: { start: (dr.hardStart || '').trim(), off: (dr.hardOff || '').trim(), spark: (dr.hardSpark || '').trim() } }, dr.found ? { found: dr.found } : {}, dr.barriers && dr.barriers.length ? { barriers: dr.barriers.slice() } : {},
      dr.mineQ && (dr.mine || '').trim() ? { mine: dr.mine.trim(), mineQ: dr.mineQ } : {}, dr.coachHelpers && dr.coachHelpers.length ? { helpers: dr.coachHelpers.slice() } : {});
    S.habit = { id: uuid(), mode: less ? 'less' : 'more', title: title, towards: (dr.ownFeel || '').trim(), feel: dr.feel.slice(), gives: dr.gives.concat((dr.driveOwn || '').trim() ? [dr.driveOwn.trim()] : []),
      length: dr.length || 30, start: start, status: 'active', pauses: [], finishedOn: null, later: later, extra: ex, createdAt: nowISO(), u: nowISO(), actions: [act] };
    S.later = false; S.fb = {}; S.catchup = []; S.stuSeen = {};
    markAll(S, S.habit); save();
    // Let Stuart know someone new has started (no words they wrote, and only if usage stats are on). Not for his own test runs.
    stat('setup_done', less ? 'less' : 'more'); flushStats();
    if (sb && !isTester() && S.settings.analytics !== false) setTimeout(function () { try { sb.functions.invoke('showup-notify', { body: { kind: 'started', sid: statSid } }).catch(function () {}); } catch (e) {} }, 2500);
    finishMoment();
  }
  // A new plan: the current one is put away whole (on this phone, and in the account when signed in), never deleted.
  function archiveAndReset() {
    if (S.habit) { S.habit.status = 'archived'; touchF(); S.archive = [S.habit].concat(S.archive || []); }
    S.habit = null; S.fb = {}; S.later = false; S.catchup = []; S.stuSeen = {}; S.draft = fresh().draft; save();
  }
  function reopenFocus(i) {
    var f = S.archive[i]; if (!f) return;
    S.archive.splice(i, 1);
    if (S.habit) { S.habit.status = 'archived'; touchF(); S.archive.unshift(S.habit); }
    f.status = 'active'; f.finishedOn = null; S.habit = f;
    if (todayNum() > f.length) f.length = todayNum() + 29;
    touchF(); save(); toast('Welcome back to ' + habitName() + '.'); go('tracker');
  }
  // Already started before today? Move the start back (up to 90 days), then fill in the days since.
  function startDateSheet() {
    var f = S.habit, min = addDays(todayStr(), -90), first = null;
    acts().forEach(function (x) { Object.keys(x.entries || {}).forEach(function (d) { if (counted(x.entries[d]) && (!first || d < first)) first = d; }); });
    var max = first && first < todayStr() ? first : todayStr();
    var body = '<div class="row"><b style="font-size:20px;font-weight:600">When did you start?</b><button class="link" data-c="close">Close</button></div>' +
      '<span class="hint">If you began before you set this up, pick the day you started. Then you can fill in the days since.</span>' +
      '<div class="field"><label class="label" for="sdate">Start date</label><input class="input" id="sdate" type="date" min="' + min + '" max="' + max + '" value="' + esc(f.start) + '"></div>' +
      '<button class="btn" data-c="save">Save</button>';
    var el = openSheet('When did you start?', body, function (ev, b, close) {
      if (b.dataset.c === 'close') return close();
      if (b.dataset.c !== 'save') return;
      var v = el.querySelector('#sdate').value;
      if (!v || v < min || v > max) return toast(v > max ? 'Pick a day on or before your first show-up.' : 'Pick a day in the last 90 days.');
      close(); setStart(v);
    });
  }
  // The plan and its first schedules begin on the new date. Actions added later keep their own start. Nothing logged is moved.
  function setStart(d) {
    var f = S.habit, old = f.start; if (d === old) return;
    f.start = d; S.later = false;
    acts().forEach(function (x) {
      var orig = !x.from || x.from === old || x.from <= d;
      (x.schedules || []).forEach(function (r, i) { if ((i === 0 && orig) || r.from < d) r.from = d; });
      if (orig) x.from = d;
      touchA(x);
    });
    touchF(); save(); stat('startdate', String(daysBetween(d, todayStr())));
    toast(d < todayStr() ? 'Start moved to ' + prettyDate(d) + '. Tap any day to fill it in.' : 'Starting today.'); go('tracker');
  }
  // Did something on a day it wasn't planned? It counts, and it doesn't change the plan.
  function logExtraSheet() {
    var list = liveActs(); if (list.length === 1) return logAct(list[0].id, 'full');
    var body = '<div class="row"><b style="font-size:20px;font-weight:600">What did you do?</b><button class="link" data-c="close">Close</button></div>' + list.map(function (x) { return '<button class="choice" data-c="' + x.id + '"><b>' + esc(x.text) + '</b></button>'; }).join('');
    openSheet('Log something extra', body, function (ev, b, close) { var id = b.dataset.c; close(); if (id && id !== 'close') logAct(id, 'full'); });
  }
  function saveActEdit() {
    var e = ui.edit, txt = (e.text || '').trim(); if (!txt) return toast('Write what you’ll do first.');
    if (!e.rule || (e.rule.type === 'days' && !e.rule.days.length)) return toast('Choose how often.');
    var from = todayStr() < S.habit.start ? S.habit.start : todayStr();
    if (e.id === 'new') { addActionFrom({ text: txt, cue: e.cue, small: e.small, schedule: e.rule }); if (e.later != null && S.habit.later[e.later]) S.habit.later[e.later].used = true; toast('Added to your plan.'); }
    else {
      var a = actById(e.id), cur = ruleNow(a), same = JSON.stringify(Object.assign({}, cur, { from: 0 })) === JSON.stringify(Object.assign({}, e.rule, { from: 0 }));
      a.text = txt; a.cue = (e.cue || '').trim(); a.small = (e.small || '').trim();
      if (!same) { var r = Object.assign({}, e.rule); delete r.from; M.changeSchedule(a, from, r); }
      touchA(a); toast('Saved.');
    }
    touchF(); save(); ui.edit = null; go('plan');
  }
  // The end of setup: a proper moment, then their plan (peak-end rule).
  function finishMoment() {
    var el = document.createElement('div');
    el.className = 'celebrate finish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Your plan is ready');
    el.innerHTML = confettiHTML(70) +
      '<div class="burst"><span class="ring"></span><div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">Your plan is ready.</div><div class="s">' + esc(acts()[0].text) + ', ' + esc(describeRule(ruleNow(acts()[0])).toLowerCase()) + '. In your words.</div></div>' +
      '<button class="btn" style="max-width:320px;background:var(--amber);color:var(--navy)" data-finish="1">See my plan</button>';
    buzz();
    app.appendChild(el);
    var done = function () { if (el.parentNode) { el.remove(); if (!user && sb) { ui.authFrom = 'plan'; ui.authStep = null; ui.returnTo = 'ready'; return go('sendplan'); } go('ready'); } };
    el.addEventListener('click', function (ev) { if (ev.target.closest('[data-finish]')) done(); });
    var b = el.querySelector('[data-finish]'); if (b) b.focus({ preventScroll: true });
  }

  // ── Your data: download and delete ────────────────────────────────────────
  function exportData() {
    var out = { exported: nowISO(), app: 'Let’s Go!', account: user ? user.email : null, name: S.settings.name || '', current: S.habit, pastPlans: S.archive || [], pastWins: S.wins || [], settings: S.settings };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lets-go-my-data.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Downloaded.');
  }
  async function testerReset() {
    try { if (user && sb) { await sb.functions.invoke('showup-code', { body: { action: 'delete' } }); await sb.auth.signOut(); user = null; } } catch (e) {}
    try { Object.keys(localStorage).forEach(function (k) { if (k === KEY || k.indexOf('sb-') === 0) localStorage.removeItem(k); }); localStorage.setItem('showup-tester', '1'); } catch (e) {}
    ui.hist = []; ui.fwd = []; S = fresh(); save(false); applyComfort(); go('landing'); toast('Fresh start. Over to you.');
  }
  async function deleteData() {
    try {
      if (user && sb) {
        var uid = user.id, r;
        var d = await sb.functions.invoke('showup-code', { body: { action: 'delete' } });
        if (d.error) throw d.error;
        await sb.auth.signOut(); user = null;
      }
      try { localStorage.removeItem(KEY); } catch (e) {}
      S = fresh(); save(false); applyComfort(); go('landing'); toast('Deleted. Your Let’s Go data is gone.');
    } catch (e) { toast('Couldn’t delete just now. Please try again, or email stuart@motivate-coaching.com.'); }
  }
  // ── More support: a booster call with Stu, or joining The Living Room. ──
  // Shown to everyone once a booster link is set.
  var SUPPORT = {
    // Pay first on Stripe; each Payment Link then sends them on to the Calendly booster event to pick a time.
    boosterMember: 'https://buy.stripe.com/14A00jfHmeDW7FAeXnebu06',   // £45, The Living Room member price
    boosterStandard: 'https://buy.stripe.com/7sY7sLan22Ve6BwdTjebu07', // £75, standard price
    priceMember: '£45', priceStandard: '£75',
    tlrJoin: 'https://buy.stripe.com/4gMdR966MgM41hcdTjebu00', // The Living Room payment page
    tlrInfo: 'https://www.motivate-coaching.com/thelivingroom',  // The Living Room landing page
    tlrPrice: '£99 a month'
  };
  function supportLive() { return !!(SUPPORT.boosterMember || SUPPORT.boosterStandard || SUPPORT.tlrJoin); }
  function supportCard() {
    if (!supportLive() && !isTester()) return '';
    var m = S.settings.tlrMember, h = '<div class="card soft supportcard"><span class="eyebrow">Want more support?</span>';
    if (m === undefined || m === null) {
      return h + '<span>Are you part of The Living Room?</span><div class="row" style="gap:10px;justify-content:flex-start"><button class="chip" data-act="tlrmember" data-v="yes">Yes</button><button class="chip" data-act="tlrmember" data-v="no">Not yet</button></div></div>';
    }
    h += '<button class="choice" data-act="booster"><b>Book a 30-minute booster call with Stu</b><small>Get back on track, one to one. ' + esc(m ? SUPPORT.priceMember + ' for members' : SUPPORT.priceStandard) + '</small></button>';
    // Join only shows once its payment link exists (Stuart always sees it, to check it).
    if (!m && (SUPPORT.tlrJoin || isTester())) h += '<button class="choice" data-act="tlrbridge"><b>Join The Living Room</b><small>Ongoing support from Stu and people doing the same work.</small></button>';
    if (!supportLive()) h += '<span class="hint">Only you can see this until the links are added.</span>';
    return h + '</div>';
  }
  function openLink(url, what) {
    if (!url) return toast('Link coming soon.');
    stat('support', what); try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; }
  }


  function confirmSheet(title, body, yes, fn) {
    openSheet(title.replace(/Let’s Go(?!!)/g, 'Let’s Go!'), '<b style="font-size:20px;font-weight:600">' + brand(title) + '</b><p class="hint">' + esc(body) + '</p><button class="btn" data-c="yes">' + esc(yes) + '</button><button class="link center" data-c="no">Cancel</button>',
      function (ev, b, close) { if (!b.dataset.c) return; close(); if (b.dataset.c === 'yes') fn(); });
  }
  function tlrBridge() {
    stat('support', 'tlr-bridge');
    openSheet('The Living Room', '<div class="row" style="justify-content:space-between"><span class="eyebrow">Ongoing support</span><button class="link" data-c="close">Close</button></div>' +
      '<b style="font-family:var(--display);font-weight:400;font-size:28px;line-height:1.15">The Living Room (TLR)</b>' +
      '<p class="hint" style="margin:0">Less overthinking. More getting on with it. Stu’s membership for people who want to make real progress, with others doing the same.</p>' +
      '<ul class="tlrlist"><li>Regular live group sessions with Stu</li><li>A practical new tool for each theme</li><li>People doing the same work, so you’re not doing it alone</li></ul>' +
      (SUPPORT.tlrPrice ? '<p style="margin:0;font-weight:600">' + esc(SUPPORT.tlrPrice) + '</p>' : '') +
      '<p class="hint" style="margin:0">Try it for 30 days. If it’s not for you, email Stu and get every penny back.</p>' +
      '<button class="btn" data-c="join">Join now</button><button class="link center" data-c="info">Find out more first</button>',
      function (ev, b, close) { var c = b.dataset.c; if (!c) return; close(); if (c === 'join') openLink(SUPPORT.tlrJoin, 'tlr-join'); if (c === 'info') openLink(SUPPORT.tlrInfo, 'tlr-info'); });
  }
  async function saveReflect() {
    var q = ui.reflect, h = S.habit; if (!q || !q.next) return;
    h.extra = Object.assign({}, h.extra, { lookback: { noticed: q.noticed, next: q.next, at: nowISO() } }); touchF();
    S.fb.reflect = true;
    // Only what they chose to send goes to Stuart. What they noticed stays theirs unless they switch it on.
    if (q.pmf) void feedback('pmf', q.pmf);
    if (q.quote.trim()) void feedback(q.ok ? 'quote_ok' : 'quote_private', q.quote.trim());
    if (q.shareNoticed && q.noticed.trim()) void feedback('noticed', q.noticed.trim());
    if (q.next === 'extend') { var nexts = { 10: 30, 30: 60, 60: 90, 90: 180, 180: 365 }; h.length = nexts[h.length] || h.length + 90; touchF(); save(); toast('Keep going. Your next look back is on ' + prettyDate(lastDate()) + '.'); return go('tracker'); }
    if (q.next === 'new') { save(); archiveAndReset(); return go('landing'); }
    h.finishedOn = todayStr(); touchF(); save(); toast('Saved. Well done for giving it a proper go.'); go('tracker');
  }

  // Guest sign-in: lets the AI ideas run (and stay rate-limited per person) without asking for an email yet.
  // Tough-day ideas written for their own habit. Falls back to the general examples if it can't reach the AI.
  async function fetchLighter() {
    var d = S.draft, what = (d.what || '').trim(); if (!what || !sb || ui.lighterBusy) return;
    ui.lighterBusy = true; ui.lighterTried = what; if (S.screen === 'dimmer') render();
    try {
      if (await ensureGuest()) {
        var r = await sb.functions.invoke('showup-reflect', { body: { kind: 'lighter', what: what, mode: d.mode, anchor: anchorLine(d) } });
        if (!r.error && r.data && r.data.options && r.data.options.length && (S.draft.what || '').trim() === what) { S.draft.lighter = { for: what, opts: r.data.options.slice(0, 3) }; save(false); }
      }
    } catch (e) {}
    ui.lighterBusy = false; if (S.screen === 'dimmer') render();
  }
  // ── V2 setup coach (letsgo-coach): hears what they wrote, spots more than one focus, suggests a first small step ──
  async function coachCall(body) {
    if (!sb || !(await ensureGuest())) throw new Error('sign_in');
    var r = await sb.functions.invoke('letsgo-coach', { body: body });
    if (r.error) { var m = 'failed'; try { m = (await r.error.context.json()).error || m; } catch (e) {} throw new Error(m); }
    return r.data || {};
  }
  function guessMode(text) { return /\b(stop|quit|cut (back|down)|less|no more|give up|fewer)\b/i.test(text || '') ? 'less' : 'more'; }
  async function coachUnderstand() {
    var d = S.draft; if (!(d.say || '').trim()) return;
    d.coach = null; d.focusIdx = null; d.acts = null; d.pick = null; d.later = []; d.coachQs = []; d.coachAnswers = [];
    ui.coachBusy = 'understand'; save(false); go('hearing');
    try {
      var r = await coachCall({ kind: 'understand', said: d.say, mode: d.mode });
      d.coach = r.at_risk ? { care: r.care } : { reply: r.reply || '', focuses: r.focuses || [] };
      stat('coach', r.at_risk ? 'care' : 'focuses:' + (r.focuses || []).length);
    } catch (e) {
      d.coach = { reply: '', focuses: [{ title: d.say.trim().split(/[.:;\n]/)[0].slice(0, 60), heard: d.say.trim(), towards: '', outcome_examples: [] }] };
      toast(e.message === 'limit' ? 'That’s the AI helper’s limit for today. You can carry on and write your own step.' : 'Couldn’t reach the AI helper just now. You can carry on and write your own step.');
    }
    ui.coachBusy = null; save(false);
    if (!d.coach.care && (d.coach.focuses || []).length < 2) return pickFocus(0);
    render();
  }
  function pickFocus(i) {
    var d = S.draft, fs = (d.coach && d.coach.focuses) || [], f = fs[i] || {};
    d.focusIdx = i; d.later = fs.filter(function (x, j) { return j !== i; }).map(function (x) { return x.title; });
    d.focusTitle = f.title || ''; if (f.towards && !d.ownFeel) { d.ownFeel = f.towards; d.ownFeelFromCoach = f.towards; }
    if (f.mode) d.mode = f.mode; else if (!d.mode) d.mode = guessMode((f.heard || '') + ' ' + (d.say || ''));
    if (d.mode === 'less') d.reduce = f.title || d.reduce; d.barriers = f.barriers || []; save(false);
    return void coachActions();
  }
  async function coachActions() {
    var d = S.draft, f = ((d.coach && d.coach.focuses) || [])[d.focusIdx || 0] || {};
    ui.coachBusy = 'actions'; render();
    try {
      var r = await coachCall({ kind: 'actions', said: d.say, mode: d.mode, title: f.title || d.say, towards: f.towards || '', outcome: (f.outcome_examples || [])[0] || '', why: '', barriers: (f.barriers || []).join('; '), answers: d.coachAnswers || [] });
      if (r.at_risk) d.coach = { care: r.care };
      else { d.acts = (r.actions || []).slice(0, 4); d.coachHelpers = r.helpers || []; d.coachNote = r.note || ''; d.coachQs = (r.questions || []).slice(0, 2); d.pick = d.acts.length === 1 ? 0 : null; }
    } catch (e) { d.acts = []; toast('Couldn’t reach the AI helper just now. You can write your own first step.'); }
    ui.coachBusy = null; save(false); render();
  }
  function hearingNext() {
    var d = S.draft, x = (d.acts || [])[d.pick];
    if (x) {
      d.what = x.text; d.dimmer = x.small || d.dimmer; d.upVersion = x.up || ''; d.sched = x.schedule || null; d.schedFromUser = !!x.schedule_from_user; d.fromCoach = true; d.coachWhy = x.why || '';
      d.laterActs = (d.acts || []).filter(function (y, j) { return j !== d.pick; }).map(function (y) { return { text: y.text, small: y.small, up: y.up, schedule: y.schedule }; });
    }
    save(false); askNameThen('feel');
  }

  async function ensureGuest() {
    if (user || guest) return true;
    if (!sb || !sb.auth || !sb.auth.signInAnonymously) return false;
    try { var r = await sb.auth.signInAnonymously(); if (r.error || !r.data || !r.data.user) return false; guest = r.data.user; return true; } catch (e) { return false; }
  }
  function sessionUser(session) { var u = session && session.user; if (!u) { user = null; guest = null; return; } if (u.is_anonymous) { guest = u; user = null; } else { user = u; guest = null; } }

  async function vapidKey() { var r = await sb.functions.invoke('showup-code', { body: { action: 'vapid' } }); if (r.error || !r.data || !r.data.key) throw new Error('no key'); return r.data.key; }
  async function codeCall(body) {
    var r = await sb.functions.invoke('showup-code', { body: body });
    if (r.error) { var j = {}; try { j = await r.error.context.json(); } catch (e) {} return { error: j.error || 'network', left: j.left }; }
    return r.data || {};
  }
  async function sendCode() {
    var el = document.getElementById('aemail'), err = document.getElementById('aerr'), email = ((el && el.value) || ui.authEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { if (err) { err.textContent = 'That email doesn’t look quite right.'; err.hidden = false; } return; }
    var ck = document.getElementById('aconsent');
    if (ck && !ck.checked) { if (err) { err.textContent = 'Tick the box to agree, so we can save your progress.'; err.hidden = false; } return; }
    if (ck) { S.consentAt = new Date().toISOString(); save(false); }
    var btn = view.querySelector('[data-act="sendcode"]'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    var body = { action: 'send', email: email };
    if (S.habit && ui.authFrom === 'plan') { var pa = mainAct(); body.plan = { what: pa ? pa.text : habitName(), mine: mineLine(), anchor: anchorLine(pa), dimmer: pa ? pa.small : '', length: S.habit.length, mode: S.habit.mode, name: firstName() || '', app: 'v2' }; }
    var r = await codeCall(body);
    if (r.error) {
      if (btn) { btn.disabled = false; btn.textContent = ui.authFrom === 'plan' ? 'Send my plan' : 'Send my code'; }
      var msg = r.error === 'wait' ? 'Code just sent. Give it a moment, then check your inbox.' : r.error === 'too_many' ? 'That’s a few codes in a row. Try again in an hour.' : 'Couldn’t send just now. Please try again.';
      if (ui.authStep === 'code') return toast(msg);
      if (err) { err.textContent = msg; err.hidden = false; } return;
    }
    ui.authEmail = email; ui.authStep = 'code'; render(); toast(ui.authFrom === 'plan' ? 'Your plan is on its way to ' + email + '.' : 'Code sent to ' + email + '.');
    var c = document.getElementById('acode'); if (c) c.focus();
  }
  async function verifyCode() {
    var c = document.getElementById('acode'), err = document.getElementById('aerr'), code = ((c && c.value) || '').replace(/\D/g, '');
    if (code.length !== 6) { err.textContent = 'The code is 6 numbers.'; err.hidden = false; return; }
    var btn = view.querySelector('[data-act="verifycode"]'); btn.disabled = true; btn.textContent = 'Checking…';
    var r = await codeCall({ action: 'verify', email: ui.authEmail, code: code });
    var signLabel = ui.authFrom === 'plan' ? 'Activate my plan' : 'Sign in';
    if (r.error || !r.token_hash) {
      btn.disabled = false; btn.textContent = signLabel;
      err.textContent = r.error === 'wrong' ? 'That code didn’t match.' + (r.left ? ' ' + r.left + ' tries left.' : '') : r.error === 'expired' ? 'That code has run out. Tap “Send a new code”.' : r.error === 'too_many' ? 'Too many tries. Tap “Send a new code”.' : 'Couldn’t sign in just now. Please try again.';
      err.hidden = false; c.value = ''; paintOtp(); c.focus(); var ob = view.querySelector('.otp'); if (ob) { ob.classList.remove('shake'); void ob.offsetWidth; ob.classList.add('shake'); } return;
    }
    var v = await sb.auth.verifyOtp({ token_hash: r.token_hash, type: 'email' });
    if (v.error) { btn.disabled = false; btn.textContent = signLabel; err.textContent = 'Couldn’t sign in just now. Please try again.'; err.hidden = false; return; }
    user = v.data.user; guest = null; ui.authStep = null; authChecked = true; var fromPlan = ui.authFrom === 'plan'; ui.authFrom = null;
    if (S.settings.name && !(user.user_metadata && user.user_metadata.first_name)) saveName(S.settings.name);
    await pullRemote(); await syncAll();
    toast(fromPlan ? 'Your plan is activated. Let’s go!' : r.isNew ? 'You’re in. Your progress is saved.' : 'Welcome back. You’re signed in.');
    go(S.habit ? (ui.returnTo && ui.returnTo !== 'landing' ? ui.returnTo : 'tracker') : 'landing');
  }
  async function doSignIn() {
    var email = (document.getElementById('aemail').value || '').trim(), pass = document.getElementById('apass').value || '', err = document.getElementById('aerr');
    if (!email || !pass) { err.textContent = 'Pop in your email and password.'; err.hidden = false; return; }
    var btn = view.querySelector('[data-act="signin"]'); btn.disabled = true; btn.textContent = 'Signing in…';
    var r = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) { btn.disabled = false; btn.textContent = 'Sign in'; err.textContent = 'That email and password didn’t match. Try again, or reset your password.'; err.hidden = false; return; }
    user = r.data.user;
    await pullRemote(); await syncAll();
    toast('Saved to your account.');
    go(S.habit ? (ui.returnTo && ui.returnTo !== 'landing' ? ui.returnTo : 'tracker') : 'landing');
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  applyComfort();
  if (S.habit && ['landing', 'what', 'when', 'less', 'feel', 'dimmer', 'often', 'hard', 'find', 'name', 'viewpick'].indexOf(S.screen) >= 0) S.screen = 'tracker';
  if (!S.habit && ['tracker', 'note', 'share', 'slipped', 'reflect', 'edit', 'settings', 'actedit', 'progress', 'plan'].indexOf(S.screen) >= 0) S.screen = 'landing';
  ui.authStep = null;
  if (['account', 'install', 'length', 'words', 'calendar', 'actedit'].indexOf(S.screen) >= 0) S.screen = S.habit ? 'tracker' : 'landing';
  if (S.habit && ['ready', 'plan', 'settings', 'science', 'share', 'note', 'slipped', 'sendplan'].indexOf(S.screen) >= 0) S.screen = 'tracker';
  if (S.settings.tz !== tzGuess()) { S.settings.tz = tzGuess(); save(); }
  render();
  stat('open', S.habit ? 'has_habit' : 'new');
  clearBadge();
  (async function () {
    if (!sb) { greet(); return; }
    try {
      var sres = await sb.auth.getSession();
      sessionUser(sres.data.session);
      authChecked = true; if (!user) render();
      if (user && user.user_metadata && user.user_metadata.first_name && !S.settings.name) { S.settings.name = user.user_metadata.first_name; save(false); }
      greet(); // after sign-in is known, so the greeting can use their name
      if (user) { await pullRemote(); await syncAll(); render(); }
    } catch (e) { authChecked = true; greet(); }
    sb.auth.onAuthStateChange(function (ev, session) { if (ev === 'SIGNED_OUT') { user = null; guest = null; } else if (session) sessionUser(session); });
  })();
  window.addEventListener('online', function () { if (user) queueSync(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.habit && S.screen === 'tracker') render(); });

  // Test hook (used by automated tests only): shift the start date.
  // Moves the whole plan back in time (start, schedules and every check-in), as if it began N days ago.
  window.__showupShift = function (days) {
    if (!S.habit) return; var f = S.habit; f.start = addDays(f.start, -days);
    acts().forEach(function (a) { (a.schedules || []).forEach(function (r) { r.from = addDays(r.from, -days); if (r.anchor) r.anchor = addDays(r.anchor, -days); }); if (a.from) a.from = addDays(a.from, -days); if (a.until) a.until = addDays(a.until, -days);
      var e2 = {}; Object.keys(a.entries).forEach(function (d) { e2[addDays(d, -days)] = a.entries[d]; }); a.entries = e2; });
    (f.pauses || []).forEach(function (p) { p.from = addDays(p.from, -days); if (p.to) p.to = addDays(p.to, -days); });
    save(); render();
  };
})();
