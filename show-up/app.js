/* Let’s Go: habit tracker web app (pilot).
   Works signed out first (saved on this device), then saves to Supabase once signed in.
   Its own Supabase project (Let’s Go, London), separate from the TLR Hub; the anon key is public by design. */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://ycxmhilwaixfwiedkkzj.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljeG1oaWx3YWl4ZndpZWRra3pqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5ODY1MjUsImV4cCI6MjEwODU2MjUyNX0.XRe4jBt4RYwwnAxwnSmVVGf_DtEiHn7yasgk6Rfb3tU';
  // The phone-notification key pair is made and kept by the server; the app asks for the public half when needed.
  var KEY = 'showup-v1';
  var ADMIN_EMAIL = 'stuart.fairbairns@gmail.com';

  var sb = null;
  try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { sb = null; }

  // ── Content ───────────────────────────────────────────────────────────────
  var FEELINGS = ['Proud', 'Strong', 'Calm', 'Alive', 'Like I trust myself', 'Free', 'Clear-headed', 'Like me again', 'Lighter', 'In control', 'Grounded', 'Brave'];
  var ANCHORS_MORE = ['make my morning coffee', 'brush my teeth', 'get home', 'have lunch', 'close my laptop', 'put the kids to bed'];
  var ANCHORS_LESS = ['in bed at night', 'after dinner', 'when I get home', 'when I’m bored at work', 'when I’m stressed', 'at the weekend'];
  function anchorLine(h) { h = h || S.habit || S.draft; var a = ((h.extra && h.extra.anchor) || h.anchor || '').trim(); if (!a) return ''; return h.mode === 'less' ? 'Usually ' + a : 'After I ' + a; }
  var GIVES = ['Autopilot', 'Tired', 'Stressed', 'Bored', 'Comfort', 'A reward', 'A break', 'Not sure'];
  // For cutting back: what you're moving towards (outcomes and feelings together).
  var GAINS = ['Better sleep', 'More energy', 'Better health', 'Lighter', 'Clear-headed', 'In control', 'Proud', 'Calm', 'Money saved', 'Like me again', 'Free', 'More present'];
  var STARTERS_MORE = ['A 10 minute walk', 'Read before bed', 'In bed by 10:30pm', 'Drink more water'];
  var STARTERS_LESS = ['Phone in bed', 'Afternoon snacking', 'Wine on weeknights', 'Mindless scrolling'];
  var IDEAS = [
    ['A 10 minute walk after lunch', 'Health'], ['In bed by 10:30pm on work nights', 'Rest'],
    ['Phone off for the first hour', 'Me time'], ['20 minutes of reading before bed', 'Me time'],
    ['A cold shower each morning', 'Energy'], ['Five minutes of stillness before the day starts', 'Calm'],
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
  function tzGuess() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'; } catch (e) { return 'Europe/London'; } }
  function fresh() {
    return {
      screen: 'landing',
      draft: { mode: 'more', what: '', gives: [], instead: '', feel: [], ownFeel: '', dimmer: '', driveOwn: '', anchor: '', hardStart: '', hardOff: '', hardSpark: '', length: 30 },
      habit: null, // { id, mode, what, gives, instead, feel, ownFeel, dimmer, length, start, status, createdAt }
      entries: {}, // day -> { kind, comeback, felt, note, at }
      settings: { tz: tzGuess(), time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], email: true, push: false, pausedUntil: null, view: 'full', text: 'standard', calm: false, buzz: true, marketing: false, name: '' },
      fb: {}, later: false, installDismissed: false, updatedAt: 0
    };
  }
  // Start fresh (for trying the app as a brand-new person): open the app with ?fresh in the link.
  // Clears this device and signs out here. Nothing saved to an account is deleted.
  // Stuart's test devices: open the app once with ?tester to show "Start again" in Settings.
  var TESTER_EMAILS = ['stuart.fairbairns@gmail.com', 'stuart@motivate-coaching.com'];
  if (/[?&]tester\b/.test(location.search)) { try { localStorage.setItem('showup-tester', '1'); history.replaceState(null, '', location.pathname); } catch (e) {} }
  function isTester() { var f = false; try { f = localStorage.getItem('showup-tester') === '1'; } catch (e) {} return f || !!(user && TESTER_EMAILS.indexOf((user.email || '').toLowerCase()) >= 0); }
  var FRESH = /[?&]fresh\b/.test(location.search);
  if (FRESH) {
    try { Object.keys(localStorage).forEach(function (k) { if (k === KEY || k.indexOf('sb-') === 0) localStorage.removeItem(k); }); } catch (e) {}
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
  }
  var S = fresh();
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') { S = Object.assign(fresh(), saved); S.settings = Object.assign(fresh().settings, saved.settings || {}); S.draft = Object.assign(fresh().draft, saved.draft || {}); } } catch (e) {}
  var user = null; // signed-in Supabase user (with an email)
  var guest = null; // a quiet guest session, so challenge ideas work before anyone adds an email
  var syncState = 'local'; // local | saving | saved | error
  var ui = { hist: [], fwd: [], vp: null, ideasOpen: false, wordsFrom: null, returnTo: null, authMode: null, moreChips: false };

  function save(touch) { if (touch !== false) S.updatedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} if (user) queueSync(); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  var view = document.getElementById('view');
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
  function count(fn) { return Object.keys(S.entries).filter(function (k) { return fn(S.entries[k], +k); }).length; }
  function words() { var h = S.habit || S.draft; var w = (h.feel || []).slice(); if ((h.ownFeel || '').trim()) h.ownFeel.split(',').forEach(function (x) { x = x.trim(); if (x) w.push(x); }); return w.length ? w : ['Proud']; }
  function habitName() { var h = S.habit || S.draft; return (h.what || '').trim() || (h.mode === 'less' ? 'Cutting back' : 'My habit'); }
  function buzz() { if (!S.settings.buzz) return; try { if (navigator.vibrate) navigator.vibrate([15, 60, 25]); } catch (e) {} }
  function checkIcon(c) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'; }
  function pencil() { return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>'; }
  // Setup steps: a numbered label, a bar that fills as you go, and the newest segment animates in.
  function steps() { return S.draft.mode === 'less' ? ['what', 'when', 'feel', 'less', 'dimmer'] : ['what', 'when', 'feel', 'dimmer']; }
  var STEP_LABEL = { what: 'Your habit', less: 'What you’ll do instead', feel: 'How it’ll feel', dimmer: 'Your tough-day plan', hard: 'When it gets hard', when: 'When' };
  function stepLabel(k) { return k === 'feel' && S.draft.mode === 'less' ? 'What you’re moving towards' : STEP_LABEL[k]; }
  function nextStep(k) { var st = steps(); return st[st.indexOf(k) + 1]; }
  function stepValid(k) { var d = S.draft; return k === 'what' ? !!d.what.trim() : k === 'feel' ? !!(d.feel.length || d.ownFeel.trim()) : k === 'less' ? !!d.instead.trim() : k === 'dimmer' ? !!d.dimmer.trim() : true; }
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
  function toast(msg) { document.querySelectorAll('.toast').forEach(function (t) { t.remove(); }); var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; app.appendChild(el); setTimeout(function () { el.remove(); }, 2800); }
  function applyComfort() {
    var r = document.documentElement;
    r.classList.toggle('size-large', S.settings.text === 'large');
    r.classList.toggle('size-larger', S.settings.text === 'larger');
    r.classList.toggle('calm', !!S.settings.calm || S.settings.view === 'focus');
  }

  function stage() {
    if (!S.habit) return 'started';
    var t = todayNum(), n = count(function () { return true; });
    if (t > S.habit.length) return 'finished';
    if (!n) return 'started';
    var last = Math.max.apply(null, Object.keys(S.entries).map(Number));
    if (t - last >= 3) return 'slipped';
    if (S.entries[last] && S.entries[last].comeback) return 'back_on';
    return n === 1 ? 'day_one' : 'active';
  }

  // ── Sync with Supabase ────────────────────────────────────────────────────
  var syncTimer = null;
  function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncAll, 700); }
  function setSync(s) { syncState = s; var el = document.getElementById('syncStatus'); if (el) el.innerHTML = syncLabel(); }
  function syncLabel() {
    if (!user) return 'Saved on this device only.';
    if (syncState === 'saving') return 'Saving…';
    if (syncState === 'error') return 'Couldn’t save just now. We’ll try again.';
    return '<span class="saved-dot"></span>Saved to your account.';
  }
  function profileRow() {
    var s = S.settings;
    return { user_id: user.id, timezone: s.tz, reminder_time: s.time, reminder_days: s.days, remind_email: !!s.email, remind_push: !!s.push,
      paused_until: s.pausedUntil, view_mode: s.view, text_size: s.text, reduce_motion: !!s.calm, buzz: !!s.buzz,
      marketing_opt_in: !!s.marketing, stage: stage(), updated_at: new Date().toISOString() };
  }
  function habitRow() {
    var h = S.habit;
    return { id: h.id, user_id: user.id, mode: h.mode, what: h.what, gives: h.gives || [], instead: h.instead || '', feelings: h.feel || [],
      own_feel: h.ownFeel || '', dimmer: h.dimmer || '', length_days: h.length, start_date: h.start, status: h.status || 'active',
      extra: h.extra || {}, updated_at: new Date().toISOString() };
  }
  async function syncAll() {
    if (!user || !sb) return;
    setSync('saving');
    try {
      var r = await sb.from('showup_profiles').upsert(profileRow(), { onConflict: 'user_id' });
      if (r.error) throw r.error;
      if (S.habit) {
        r = await sb.from('showup_habits').upsert(habitRow(), { onConflict: 'id' });
        if (r.error) throw r.error;
        var rows = Object.keys(S.entries).map(function (k) { var e = S.entries[k]; return { habit_id: S.habit.id, user_id: user.id, day: +k, kind: e.kind, comeback: !!e.comeback, felt: e.felt || null, note: e.note || null, logged_at: e.at || new Date().toISOString() }; });
        if (rows.length) { r = await sb.from('showup_entries').upsert(rows, { onConflict: 'habit_id,day' }); if (r.error) throw r.error; }
        var keep = Object.keys(S.entries).map(Number);
        var del = sb.from('showup_entries').delete().eq('habit_id', S.habit.id);
        if (keep.length) del = del.not('day', 'in', '(' + keep.join(',') + ')');
        r = await del; if (r.error) throw r.error;
      }
      setSync('saved');
    } catch (e) { console.warn('[showup] sync failed', e && e.message); setSync('error'); }
  }
  async function pullRemote() {
    if (!user || !sb) return;
    try {
      var p = await sb.from('showup_profiles').select('*').eq('user_id', user.id).maybeSingle();
      if (p.data) {
        var d = p.data;
        S.settings = Object.assign(S.settings, { tz: d.timezone, time: String(d.reminder_time).slice(0, 5), days: d.reminder_days, email: d.remind_email, push: d.remind_push,
          pausedUntil: d.paused_until, view: d.view_mode, text: d.text_size, calm: d.reduce_motion, buzz: d.buzz, marketing: d.marketing_opt_in });
      }
      var h = await sb.from('showup_habits').select('*').eq('user_id', user.id).neq('status', 'archived').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (h.error) throw h.error;
      if (h.data && (!S.habit || S.habit.id !== h.data.id)) {
        if (S.habit && S.habit.id !== h.data.id && !S.habit.synced) {
          // A habit started on this device before signing in: keep the newer one.
          if (new Date(S.habit.createdAt || 0) > new Date(h.data.created_at)) { S.habit.synced = true; save(); return; }
        }
        var x = h.data;
        S.habit = { id: x.id, mode: x.mode, what: x.what, gives: x.gives || [], instead: x.instead, feel: x.feelings || [], ownFeel: x.own_feel, dimmer: x.dimmer, length: x.length_days, start: x.start_date, status: x.status, extra: x.extra || {}, createdAt: x.created_at, synced: true };
        S.entries = {};
        if (x.extra && x.extra.wins && (!S.wins || !S.wins.length)) S.wins = x.extra.wins.slice();
      }
      if (S.habit && h.data && S.habit.id === h.data.id) {
        // Merge what was noticed and what's worked across devices.
        var rx = h.data.extra || {}, lx = extra();
        if (rx.noticed) { lx.noticed = lx.noticed || {}; Object.keys(rx.noticed).forEach(function (k) { var a = lx.noticed[k], b2 = rx.noticed[k]; if (!a || new Date(b2.at || 0) > new Date(a.at || 0)) lx.noticed[k] = b2; }); }
        if (rx.worked) { var seenAt = {}; (lx.worked || []).forEach(function (w) { seenAt[w.at] = 1; }); lx.worked = (lx.worked || []).concat(rx.worked.filter(function (w) { return !seenAt[w.at]; })).sort(function (a, b2) { return new Date(a.at) - new Date(b2.at); }); }
        if (rx.sq) lx.sq = Object.assign({}, rx.sq, lx.sq || {});
        if (rx.wins && (!S.wins || !S.wins.length)) { S.wins = rx.wins.slice(); lx.wins = rx.wins.slice(); }
        var e = await sb.from('showup_entries').select('*').eq('habit_id', S.habit.id);
        if (e.error) throw e.error;
        (e.data || []).forEach(function (r) {
          var mine = S.entries[r.day];
          if (!mine || new Date(r.logged_at) >= new Date(mine.at || 0)) S.entries[r.day] = { kind: r.kind, comeback: r.comeback, felt: r.felt, note: r.note, at: r.logged_at };
        });
      }
      if (S.habit) S.habit.synced = true;
      if (!S.settings.name && user.user_metadata && user.user_metadata.first_name) S.settings.name = user.user_metadata.first_name;
      save();
      if (S.habit && ['landing', 'what', 'less', 'feel', 'dimmer'].indexOf(S.screen) >= 0) S.screen = 'tracker';
      applyComfort();
    } catch (e) { console.warn('[showup] load failed', e && e.message); setSync('error'); }
  }
  async function feedback(question, answer) {
    S.fb[question] = true; save();
    if (!user || !sb || !answer) return;
    try { await sb.from('showup_feedback').insert({ user_id: user.id, habit_id: S.habit ? S.habit.id : null, question: question, answer: String(answer).slice(0, 4000) }); } catch (e) {}
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  var BACK = {
    what: function () { return S.draft.found ? 'find' : 'landing'; }, name: 'landing', viewpick: function () { return S.nameAsked ? 'landing' : 'name'; }, wins: 'tracker', less: 'feel',
    find: function () { var f = S.find || {}; if (f.step > 0) { f.step--; save(false); return 'find'; } return 'landing'; }, feel: 'when', when: 'what', dimmer: function () { return S.draft.mode === 'less' ? 'less' : 'feel'; }, hard: 'dimmer',
    length: function () { return ui.returnTo || 'ready'; }, note: 'tracker', slipped: 'tracker', share: 'tracker', science: function () { return S.habit ? 'settings' : 'landing'; },
    words: function () { return ui.wordsFrom || 'tracker'; }, sendplan: 'ready', settings: 'tracker', edit: function () { return ui.returnTo || 'settings'; }, plan: 'tracker', reflect: 'tracker', calendar: function () { return ui.calFrom === 'install' ? 'install' : ui.calFrom || 'tracker'; }, install: function () { return ui.installFrom || (S.habit ? 'settings' : 'landing'); }, account: function () { return ui.returnTo || 'tracker'; }
  };

  function todayCard(name, line, done, decorative, id) {
    return '<div class="today-card"' + (decorative ? ' aria-hidden="true"' : '') + '><div class="txt"><span class="eyebrow" style="font-size:12px">Today</span>' +
      '<span class="name"' + (id ? ' id="' + id + '"' : '') + '>' + esc(name) + '</span><span class="line">' + esc(line) + '</span></div>' +
      '<span class="disc' + (done ? '' : ' open') + '">' + (done ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</span></div>';
  }

  var screens = {
    landing: function () {
      return '<section class="screen landing">' +
        '<div class="hero"><h1>Build a habit that sticks.</h1>' +
        '<p class="sub">Or break one that doesn’t.</p>' +
        '<p class="sub2">One minute to set up, one tap a day.</p></div>' +
        '<div class="btns"><button class="btn" data-start="more">Build a habit</button>' +
        '<button class="btn outline" data-start="less">Break a habit</button>' +
        '<button class="link center" data-find="start">Not sure what to try? <b>Let’s work it out</b></button></div>' +
        '<div class="spacer"></div>' +
        '<p class="foot">' + (user ? '' : '<button class="link inline" data-account="landing">Sign in</button> · ') +
        (isStandalone() ? '' : '<button class="link inline" data-act="install">Get the app</button> · ') +
        '<button class="link inline" data-go="science">How it works</button> · <a class="link inline" href="privacy.html">Privacy</a> · <a class="link inline" href="terms.html">Terms</a></p>' +
        (isTester() ? '<button class="link center" data-act="testerreset" style="font-size:13px;color:var(--muted)">Testing: start again from scratch</button>' : '') + '</section>';
    },
    what: function () {
      var d = S.draft, more = d.mode === 'more';
      return '<section class="screen">' + progress('what') +
        '<h1>' + (more ? 'What habit do you want to build?' : 'What do you want to cut back on?') + '</h1>' +
        '<div class="field"><label class="label" for="what">' + (more ? 'I’m going to...' : 'I’m cutting back on...') + '</label>' +
        '<textarea id="what" rows="1" data-bind="what" placeholder="' + (more ? 'Have a cold sea swim every morning' : 'Chocolate in the afternoons') + '">' + esc(d.what) + '</textarea>' +
        '<span class="hint">In your own words.' + (more ? ' Small enough to do on a rubbish day.' : '') + '</span></div>' +
        optional('Show me some ideas', '<div class="starters">' + (more ? STARTERS_MORE : STARTERS_LESS).map(function (s) { return '<button class="chip" data-starter="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
          (more ? '<button class="link" data-act="ideas">More ideas</button>' : '')) +
        '<button class="card soft askhelp" data-find="start" data-mode="' + d.mode + '"><b>Not sure yet? Let’s work it out together.</b><span>Two questions, then we’ll suggest where to focus.</span></button>' +
        '<div class="spacer"></div>' + stepButton('what') + '</section>' +
        (ui.ideasOpen ? ideasSheet() : '');
    },
    when: function () {
      var d = S.draft, more = d.mode === 'more', opts = more ? ANCHORS_MORE : ANCHORS_LESS;
      return '<section class="screen">' + progress('when') +
        '<h1>' + (more ? 'When will you do it?' : 'When does it usually happen?') + '</h1>' +
        '<p class="lede">' + (more ? 'Tie it to something you already do every day. That’s what turns it into a habit.' : 'Knowing when the urge tends to hit means you can be ready for it.') + '</p>' +
        '<div class="field"><label class="label" for="anchor">' + (more ? 'After I...' : 'Usually...') + '</label>' +
        '<textarea id="anchor" rows="1" data-bind="anchor" placeholder="' + (more ? 'make my morning coffee' : 'in bed at night') + '">' + esc(d.anchor || '') + '</textarea></div>' +
        '<div class="starters">' + opts.map(function (a) { return '<button class="chip" data-anchor="' + esc(a) + '" aria-pressed="' + ((d.anchor || '') === a) + '">' + esc(a) + '</button>'; }).join('') + '</div>' +
        '<div class="spacer"></div>' + stepButton('when') + '</section>';
    },
    less: function () {
      var d = S.draft;
      var drives = '<div class="field"><span class="label">First, what usually drives it?</span><span class="hint">Tap any that fit. Not sure is fine too.</span><div class="chips" style="margin-top:8px">' +
        GIVES.map(function (g) { return '<button class="chip" data-give="' + esc(g) + '" aria-pressed="' + (d.gives.indexOf(g) >= 0) + '">' + esc(g) + '</button>'; }).join('') + '</div>' +
        '<textarea id="driveown" rows="1" data-bind="driveOwn" placeholder="Or in your own words" style="margin-top:8px">' + esc(d.driveOwn || '') + '</textarea></div>';
      return '<section class="screen">' + progress('less') + '<h1>When the urge hits, what will you do instead?</h1>' +
        (d.what.trim() ? '<p class="hint" style="margin-top:-8px">Instead of: <b>' + esc(d.what.trim()) + '</b></p>' : '') +
        (S.settings.view === 'focus' ? tapToSee('What usually drives it?', drives) : drives) +
        '<div class="field"><label class="label" for="instead">' + (S.settings.view === 'focus' ? 'Instead, I’ll...' : 'Then, instead, I’ll...') + '</label>' +
        '<textarea id="instead" rows="1" data-bind="instead" placeholder="e.g. Stand up, stretch and roll my shoulders">' + esc(d.instead) + '</textarea>' +
        '<span class="hint full-only">Something that gives you some of the same, and moves you towards what you want.</span></div>' +
        '<div class="spacer"></div>' + stepButton('less') + '</section>';
    },
    feel: function () {
      var d = S.draft, less = d.mode === 'less', list = less ? GAINS : FEELINGS;
      var h = '<section class="screen">' + progress('feel') + '<h1>' + (less ? 'What are you moving towards?' : 'When you’ve done it, how will you feel?') + '</h1>' +
        '<p class="lede">' + (less ? 'Cutting back is the how. This is the why. Tap a few.' : 'Tap a few.') + '</p><div class="chips">';
      list.forEach(function (f, i) { h += '<button class="chip' + (i >= 6 && !ui.moreChips && d.feel.indexOf(f) < 0 ? ' extra' : '') + '" data-feel="' + esc(f) + '" aria-pressed="' + (d.feel.indexOf(f) >= 0) + '">' + esc(f) + '</button>'; });
      h += '</div>' + (ui.moreChips ? '' : '<button class="link focus-only" data-act="morechips">Show more words</button>');
      return h + '<div class="field"><label class="label" for="own">Your own words (optional)</label>' +
        '<textarea id="own" rows="1" data-bind="ownFeel" placeholder="' + (less ? 'Fit into my jeans, wake up fresh' : 'Separate with commas') + '">' + esc(d.ownFeel) + '</textarea></div>' +
        '<div class="spacer"></div>' + stepButton('feel') + '</section>';
    },
    dimmer: function () {
      var d = S.draft, less = d.mode === 'less';
      return '<section class="screen">' + progress('dimmer') + '<h1>On a tough day, how far will you turn it down?</h1>' +
        '<p class="lede">Some days a 10, some days a 1. Both count.</p>' +
        '<div class="field"><label class="label" for="dim">On a tough day, I’ll...</label>' +
        '<textarea id="dim" rows="1" data-bind="dimmer" placeholder="' + (less ? 'Have one block of chocolate, not the whole bar' : 'A quick dip, or a cold shower at home') + '">' + esc(d.dimmer) + '</textarea></div>' +
        tapToSee('Show me examples', '<div class="card small">' +
        (less ? '<span>Chocolate? <b>One block, not the whole bar.</b></span><span>Wine on weeknights? <b>One small glass, or something fizzy instead.</b></span><span>Your instead? <b>Five minutes of it, not the full twenty.</b></span>'
          : '<span>A gym session? <b>A shorter workout, a brisk walk, or kit on and a stretch.</b></span><span>Reading 10 pages? <b>Five pages, one page, or one paragraph.</b></span><span>A cold sea swim? <b>A quick dip, feet in, or a cold shower at home.</b></span>') + '</div>') +
        '<div class="spacer"></div>' + stepButton('dimmer') + '</section>';
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
    calendar: function () {
      var c = ui.cal || (ui.cal = { time: S.settings.time || '07:00', start: calDefaultStart() }), hb = S.habit;
      var ios = isIOS(), android = /android/i.test(navigator.userAgent);
      var ics = '<button class="btn' + (android ? ' outline' : '') + '" data-act="calics">' + iconCal() + (ios ? 'Add to my iPhone calendar' : android ? 'Other calendars (.ics file)' : 'Apple or Outlook calendar') + '</button>';
      var gcal = '<button class="btn' + (android ? '' : ' outline') + '" data-act="calgoogle">' + iconCal() + 'Add to Google Calendar</button>';
      return '<section class="screen"><div><div class="eyebrow">Your calendar</div><h1>Put it in your calendar</h1></div>' +
        '<p class="lede">A daily reminder in the calendar you already use, with your own words in it.</p>' +
        '<div class="card"><div class="row"><label class="label" for="caltime" style="margin:0">Time</label><input class="input" id="caltime" type="time" step="300" value="' + esc(c.time) + '" style="max-width:160px"></div>' +
        '<div class="row"><label class="label" for="calstart" style="margin:0">Starting</label><input class="input" id="calstart" type="date" value="' + esc(c.start) + '" style="max-width:180px"></div>' +
        '<span class="hint">' + daysPhrase() + ' for ' + hb.length + ' days, with an alert at that time.</span></div>' +
        (S.settings.push || (user && S.settings.email) ? '<p class="hint">You also get the app’s morning nudge. Want just one? Switch it off in Settings after adding this.</p>' : '') +
        '<div class="spacer"></div>' + (android ? gcal + ics : ics + gcal) + '</section>';
    },
    ready: function () {
      if (ui.planEdit) return planEditor();
      var ticked = !!S.entries[1];
      var h = '<section class="screen"><div><div class="eyebrow">Your plan is ready</div><h1>Here’s your plan.</h1></div>' +
        stuCard((firstName() ? esc(firstName()) + ', you’ve' : 'You’ve') + ' just made a plan most people never get round to. Some days will be a 10, some a 1. Both count. I’ll be with you along the way.') + planCard('ready');
      if (!ticked) {
        h += '<div class="card"><b style="font-size:20px;font-weight:600">' + 'Showed up today?</b><span style="color:var(--text-mid)">If you have, count day one now. A lighter version counts too.</span>' +
          '<button class="btn" data-tick="full">' + checkIcon('#FFFFFF') + 'I showed up today</button>' +
          (S.later ? '<p style="margin:0;text-align:center">Lovely. Day one is tomorrow.</p>' : '<button class="link center" data-act="later">I’ll start tomorrow</button>') + '</div>';
      } else {
        var e = S.entries[1];
        h += '<div class="card" style="flex-direction:row;align-items:center;gap:14px"><span class="bigstar" style="width:32px;height:32px"></span>' +
          '<span><b>You showed up on day one' + (e.felt && e.felt !== 'Honestly, tough' ? '. ' + esc(e.felt) : '') + '.</b> You’ve started, and that’s the hardest bit.</span></div>';
      }
      if (!user && (ticked || S.later)) {
        h += '<div class="card"><b style="font-size:18px;font-weight:600">Save your progress</b><span style="color:var(--text-mid)">Add your email so your morning nudge can find you and nothing gets lost. No password needed.</span>' +
          '<button class="btn outline" data-account="ready">Save my progress</button></div>';
      }
      h += (firstName() ? '' : '<div class="field"><label class="label" for="pname">What should we call you?</label><textarea id="pname" rows="1" data-name="1" autocomplete="given-name" placeholder="Your first name"></textarea></div>') +
        nextNudge() +
        '<div class="spacer"></div><button class="btn" data-act="readydone">Go to my tracker</button></section>';
      return h;
    },
    plan: function () {
      if (!S.habit) return screens.landing();
      if (ui.planEdit) return planEditor();
      return '<section class="screen"><div><div class="eyebrow">My plan</div><h1>' + esc(habitName()) + '</h1></div>' + planCard('plan') +
        '<div class="spacer"></div><button class="btn" data-go="tracker">Back to my tracker</button></section>';
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
    tracker: function () {
      if (!S.habit) return screens.landing();
      if (daysBetween(S.habit.start, todayStr()) < 0) return '<section class="screen"><div><div class="eyebrow">My habit</div><h1>' + esc(habitName()) + '</h1></div>' +
        '<div class="card"><b style="font-size:20px;font-weight:600">Day one is tomorrow.</b><span style="color:var(--text-mid)">Your nudge arrives at ' + esc(fmtTime(S.settings.time)) + '. Changed your mind?</span><button class="btn outline" data-act="starttoday">Start today instead</button></div>' +
        whyCard(false) + '</section>';
      if (S.settings.view === 'focus') return focusTracker();
      var t = todayNum(), L = S.habit.length, e = S.entries[t];
      var h = '<section class="screen home"><div><h1>' + esc(habitName()) + '</h1>' +
        (anchorLine() ? '<p class="anchorline">' + esc(anchorLine()) + '</p>' : '') +
        '<div class="row homesub"><span>' + (t > L ? 'All ' + L + ' days · complete' : 'Day ' + t + ' of ' + L) + '</span><button class="plan-link" data-go="plan">' + iconPlan() + 'My plan</button></div></div>';
      if (t > L) {
        h += '<div class="card"><b style="font-size:20px;font-weight:600">You gave it ' + L + ' days.</b><span style="color:var(--text-mid)">Time for your look back: what you noticed, and what’s next.</span><button class="btn" data-go="reflect">Start my look back</button><button class="link center" data-go="share">Share that I did it</button></div>';
      } else if (!e) {
        h += showUpButtons();
      } else {
        h += '<div class="done"><span class="bigstar"></span><span class="msg">' + esc(doneMsg(e)) + '</span><button data-go="note">' + (e.note ? 'Edit note' : 'Add a note') + '</button></div>' +
          '<button class="link center" data-act="undo" style="margin-top:-10px;font-size:14px;font-weight:500">Tapped by mistake? Undo today</button>';
        if (t === L && !S.fb.reflect) h += '<div class="card soft"><b style="font-weight:600">That’s your last day.</b><button class="btn" data-go="reflect">Start my look back</button></div>';
      }
      h += catchUpCard(t);
      h += '<div class="card weekcard"><span class="eyebrow">This week</span>' + weekHTML(t) +
        '<details class="alldays"><summary>See all ' + L + ' days</summary>' + gridHTML(t, true) + '<p class="hint" style="margin:8px 0 0">Tap any day to fill it in or add a note.</p></details></div>';
      var na = nudgeAsk(t); h += stuDay(t) + (na || (signInCard() + extraCards(t)));
      h += '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:4px 16px">' + (e ? '<button class="link" data-go="slipped">I’m struggling</button>' : '') + '<button class="link" data-go="wins">My past wins</button></div></section>';
      return h;
    },
    note: function () {
      var t = ui.noteDay || todayNum(), e = S.entries[t] || {};
      return '<section class="screen"><div><div class="eyebrow">Day ' + t + '</div><h1>How did it go?</h1></div>' +
        '<div class="field"><label class="label" for="note">A word or a paragraph. Whatever’s true today.</label>' +
        '<textarea id="note" rows="3" style="min-height:120px">' + esc(e.note || '') + '</textarea></div>' +
        '<p class="hint">Your notes are only ever seen by you, unless you choose to share one.</p>' +
        '<div class="spacer"></div><button class="btn" data-act="savenote">Save note</button></section>';
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
      return '<section class="screen"><div><div class="eyebrow">Before we start</div><h1>What should we call you?</h1></div>' +
        '<p class="lede" style="margin-top:-6px">We’ll use it when we check in with you.</p>' +
        '<div class="field"><label class="label" for="firstname">Your name</label><textarea id="firstname" rows="1" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="next" maxlength="40" placeholder="First name, or a nickname">' + esc(firstName()) + '</textarea></div>' +
        '<div class="spacer"></div><button class="btn" data-namego="go">Continue</button><button class="link center" data-namego="skip">Skip for now</button></section>';
    },
    share: function () {
      var L = S.habit.length, days = Math.min(todayNum(), L), n = count(function (x, k) { return k <= L; }), pct = Math.round(n / Math.max(1, days) * 100);
      var dots = '<div class="sharedots">'; for (var i = 1; i <= L; i++) dots += '<i class="' + (S.entries[i] ? 'on' : (i <= days ? 'off' : 'ahead')) + '"></i>'; dots += '</div>';
      return '<section class="screen"><div><div class="eyebrow">Share that I did it</div><h1>Your progress</h1></div><p class="lede">Only your habit and the days you showed up. Never your notes.</p>' +
        '<div class="sharecard" id="sharecard"><div class="head"><span class="eyebrow" style="color:var(--cream-dark)">' + L + '-day challenge</span><span class="wordmark">Let’s Go<span class="bang">!</span></span></div>' +
        '<h2>' + esc(habitName()) + '</h2>' + dots +
        '<div class="sharestat"><b>' + pct + '%</b><span>Showed up ' + n + ' of ' + days + ' days</span></div></div>' +
        '<button class="btn" data-act="shareimg">Share my card</button>' +
        '<button class="btn outline" data-act="whatsapp">Send on WhatsApp</button></section>';
    },
    reflect: function () {
      var L = S.habit.length, n = count(function () { return true; }), next = { 10: 30, 30: 60, 60: 90 }[L];
      var q = ui.reflect || (ui.reflect = { noticed: '', next: '', pmf: '', quote: '', ok: false });
      var h = '<section class="screen"><div><div class="eyebrow">Your look back</div><h1>' + L + ' days. ' + n + ' show-ups.</h1></div>' +
        stuCard('However many show-ups, you kept coming back. No marks out of ten here. Just what you noticed.') +
        '<div class="field"><label class="label" for="noticed">What did you notice?</label><textarea id="noticed" rows="2" data-rbind="noticed" placeholder="About the habit, about you, about your days">' + esc(q.noticed) + '</textarea></div>' +
        '<p class="hint">Worth knowing: habits often take longer than 30 days to feel automatic. In one study the middle was 66 days. Keeping going is normal, not a sign it didn’t work.</p>' +
        '<div class="field"><span class="label">What’s next?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        (next ? '<button class="choice" data-rnext="extend" aria-pressed="' + (q.next === 'extend') + '"><b>Keep going</b><small>Carry on to ' + next + ' days, with everything you’ve done so far</small></button>' : '') +
        '<button class="choice" data-rnext="new" aria-pressed="' + (q.next === 'new') + '"><b>Try something new</b><small>Start a fresh habit</small></button>' +
        '<button class="choice" data-rnext="done" aria-pressed="' + (q.next === 'done') + '"><b>Stop here</b><small>That’s a perfectly good answer too</small></button></div></div>' +
        '<div class="card"><span class="eyebrow">Helping Stuart improve this</span><span class="label">How would you feel if you could no longer use this?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        ['Very disappointed', 'Somewhat disappointed', 'Not disappointed'].map(function (o) { return '<button class="chip" style="text-align:left" data-rpmf="' + o + '" aria-pressed="' + (q.pmf === o) + '">' + o + '</button>'; }).join('') + '</div>' +
        '<div class="field"><label class="label" for="quote">In a sentence, what would you tell a friend about it?</label><textarea id="quote" rows="1" data-rbind="quote">' + esc(q.quote) + '</textarea></div>' +
        '<button class="switch" role="switch" aria-checked="' + q.ok + '" data-act="quoteok"><span><b>Happy for Stuart to share that</b><span class="hint">With your first name only.</span></span><span class="track"></span></button></div>' +
        '<div class="spacer"></div><button class="btn" data-act="savereflect" ' + (q.next ? '' : 'disabled') + '>Save my look back</button><button class="link center" data-go="share">Share that I did it</button></section>';
      return h;
    },
    science: function () {
      var h = '<section class="screen"><h1>The science behind it</h1>' +
        '<div class="author"><img src="stuart.jpg" alt="Stuart Fairbairns" loading="lazy"><div class="body">' +
        '<span class="eyebrow">Created by</span><span class="name">Stuart Fairbairns PCC</span>' +
        '<p>Executive coach with over 5,000 hours helping people change how they live and lead. Every part of this tool is there because research shows it works.</p></div></div><ul class="science">';
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
      // The essentials: your nudge
      h += '<div class="card" id="reminders"><span class="eyebrow">Morning nudge</span>' + (user || !sb || !authChecked ? '' : '<div class="card soft small" style="padding:12px 14px"><b style="font-weight:600">Add your email to get your nudge</b><button class="chip" data-account="settings" style="align-self:flex-start;background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Save my progress</button></div>') +
        '<div class="row"><label class="label" for="rtime" style="margin:0">Time</label><input class="input" id="rtime" type="time" step="900" value="' + esc(s.time) + '" style="max-width:160px"></div>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.email + '" data-toggle="email"><span><b>Email</b><span class="hint">' + (user ? esc(user.email) : 'Save your progress first') + '</span></span><span class="track"></span></button>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.push + '" data-act="push"><span><b>Phone notification</b><span class="hint" id="pushHint">' + pushHint() + '</span></span><span class="track"></span></button>' +
        '<button class="link" data-cal="settings" style="align-self:flex-start;margin-top:8px;display:inline-flex;gap:8px;align-items:center">' + iconCal() + 'Add it to my calendar</button></div>';
      // Everything else, one tap away
      h += '<div class="sects">';
      h += sect('Days and breaks', '<span class="label">Which days?</span><div class="days">' + DAY_NAMES.map(function (n, i) { return '<button class="chip" data-rday="' + i + '" aria-pressed="' + (s.days.indexOf(i) >= 0) + '" aria-label="' + DAY_LABELS[i] + '">' + n + '</button>'; }).join('') + '</div>' +
        '<span class="label">Need a break?</span>' +
        (s.pausedUntil && s.pausedUntil >= todayStr() ? '<div class="row"><span>Paused until ' + esc(prettyDate(s.pausedUntil)) + '.</span><button class="chip" data-pause="0">Resume</button></div>' :
          '<div class="chips">' + [[1, 'Tomorrow'], [3, '3 days'], [7, '7 days']].map(function (o) { return '<button class="chip" data-pause="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>') +
        '<p class="hint">Pausing never touches your progress.</p>');
      h += sect('How it looks', '<div class="choices">' +
        '<button class="choice" data-view="full" aria-pressed="' + (s.view === 'full') + '"><b>Detailed</b><small>Examples, tips and your full progress</small></button>' +
        '<button class="choice" data-view="focus" aria-pressed="' + (s.view === 'focus') + '"><b>Focused</b><small>Just the essentials, calmer screens</small></button></div>' +
        '<span class="label">Text size</span><div class="chips">' + [['standard', 'Standard'], ['large', 'Large'], ['larger', 'Larger']].map(function (o) { return '<button class="chip" data-text="' + o[0] + '" aria-pressed="' + (s.text === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        (s.view === 'focus' ? '' : '<button class="switch" role="switch" aria-checked="' + !!s.calm + '" data-toggle="calm"><span><b>Less movement</b></span><span class="track"></span></button>') +
        '<button class="switch" role="switch" aria-checked="' + !!s.buzz + '" data-toggle="buzz"><span><b>Buzz when I tick</b></span><span class="track"></span></button>');
      if (S.habit) h += sect('My habit', '<b style="font-weight:600">' + esc(habitName()) + '</b>' +
        '<button class="btn outline" data-go="plan">My plan</button>' +
        '<button class="btn outline" data-length="settings">Length: ' + S.habit.length + ' days</button>' +
        '<button class="link" data-act="newhabit" style="align-self:flex-start">Start a new habit</button>');
      h += sect('You and your data', '<div class="field"><label class="label" for="sname">Your first name</label><textarea id="sname" rows="1" data-name="1" autocomplete="given-name" placeholder="So we can say hello">' + esc(firstName()) + '</textarea></div>' +
        (user ? '<span>Signed in as <b>' + esc(user.email) + '</b></span>' : '<span>Saved on this device only.</span><button class="btn" data-account="settings">Save my progress</button>') +
        '<button class="switch" role="switch" aria-checked="' + (s.analytics !== false) + '" data-toggle="analytics"><span><b>Help improve Let’s Go</b><span class="hint">Shares which buttons you tap, never what you write.</span></span><span class="track"></span></button>' +
        (user ? '<button class="switch" role="switch" aria-checked="' + !!s.marketing + '" data-toggle="marketing"><span><b>Ideas and updates from Stuart</b><span class="hint">Occasional emails. Off unless you choose.</span></span><span class="track"></span></button>' : '') +
        '<p class="hint">Your notes are only ever seen by you. During the pilot, Stuart sees your habit and how often you show up, never your notes.</p>' +
        '<div class="row" style="flex-wrap:wrap;gap:8px;justify-content:flex-start"><button class="chip" data-act="exportdata">Download my data</button><button class="chip" data-act="deletedata">Delete my Let’s Go data</button></div>' +
        '<a class="link" href="privacy.html" style="align-self:flex-start">Privacy notice</a>' + '<a class="link" href="terms.html" style="align-self:flex-start">Terms of use</a>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.tlrMember + '" data-act="tlrtoggle"><span><b>I’m in The Living Room</b><span class="hint">Shows member prices for booster calls.</span></span><span class="track"></span></button>' + (user ? '<button class="link" data-act="signout" style="align-self:flex-start">Sign out</button>' : ''));
      if (!isStandalone()) h += sect('Get the app', '<span>Put it on your home screen so it opens like an app.</span><button class="btn outline" data-act="install">Show me how</button>');
      if (isTester()) h += '<div class="card soft small"><span class="eyebrow">Only you see this</span><a class="btn" href="admin.html">How it’s going: your view</a></div>';
      if (isTester()) h += '<div class="card soft small"><span class="eyebrow">For testing (only you see this)</span><span>Wipes everything, including your account, so you can go through it all again as a new person. Sign in again with the same email and you start blank.</span><button class="btn outline" data-act="testerreset">Start again from scratch</button></div>';
      h += sect('About', '<button class="link" data-go="science" style="align-self:flex-start">The science behind it</button><a class="link tlr-link" href="https://www.motivate-coaching.com/thelivingroom" target="_blank" rel="noopener" style="align-self:flex-start">About The Living Room (TLR) <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a>');
      return h + '</div></section>';
    },
    edit: function () { ui.planEdit = true; return planEditor(); },
    _editform: function () {
      var h = S.habit;
      var w = '<section class="screen"><div><div class="eyebrow">My plan</div><h1>Change your plan</h1></div>' +
        '<div class="field"><label class="label" for="ewhat">' + (h.mode === 'less' ? 'I’m cutting back on...' : 'I’m going to...') + '</label><textarea id="ewhat" rows="1" data-hbind="what">' + esc(h.what) + '</textarea></div>' +
        '<div class="field"><label class="label" for="eanchor">' + (h.mode === 'less' ? 'It usually happens...' : 'After I...') + '</label><textarea id="eanchor" rows="1" data-xbind="anchor">' + esc(extra().anchor || '') + '</textarea></div>' +
        '<div class="field"><label class="label" for="edim">On a tough day, I’ll...</label><textarea id="edim" rows="1" data-hbind="dimmer">' + esc(h.dimmer) + '</textarea></div>' +
        (h.mode === 'less' ? '<div class="field"><label class="label" for="einst">When the urge hits, I’ll...</label><textarea id="einst" rows="1" data-hbind="instead">' + esc(h.instead) + '</textarea></div>' : '') +
        '<span class="label">' + (h.mode === 'less' ? 'What I’m moving towards' : 'How I’ll feel') + '</span><div class="chips">';
      (h.mode === 'less' ? GAINS : FEELINGS).forEach(function (f) { w += '<button class="chip" data-hfeel="' + esc(f) + '" aria-pressed="' + (h.feel.indexOf(f) >= 0) + '">' + esc(f) + '</button>'; });
      return w + '</div><div class="field"><label class="label" for="eown">My own words</label><textarea id="eown" rows="1" data-hbind="ownFeel" placeholder="Separate with commas">' + esc(h.ownFeel) + '</textarea></div>' +
        '<div class="spacer"></div><button class="btn" data-act="planeditdone">Done</button></section>';
    },
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
        h += '<div class="card qrcard"><img src="qr.svg" width="132" height="132" alt="QR code for the Let’s Go app"><div><b>Point your phone’s camera here</b><span class="hint">Then tap the link that pops up.</span><button class="chip" data-act="copylink">Or copy the link</button></div></div>' +
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
        (S.consentAt ? '' : '<label class="consent"><input type="checkbox" id="aconsent"><span>I agree to Let’s Go storing my habit, progress and notes so it can run for me. <a href="privacy.html">Privacy</a></span></label>') +
        '<p class="err" id="aerr" hidden></p><button class="btn" data-act="sendcode">Send my plan</button>' +
        '<button class="link center" data-act="plannotnow">Not now</button>' +
        '<p class="hint">Your plan is saved to your account, so it’s backed up and your morning nudge can reach you. <a href="privacy.html">How we look after your data</a></p></section>';
    },
    account: function () {
      var priv = '<p class="hint">Saving to an account backs up your progress and lets your nudges reach you. <a href="privacy.html">How we look after your data</a></p>';
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
        (S.consentAt ? '' : '<label class="consent"><input type="checkbox" id="aconsent"><span>I agree to Let’s Go storing my habit, progress and notes so it can run for me. <a href="privacy.html">Privacy</a></span></label>') +
        '<p class="err" id="aerr" hidden></p><button class="btn" data-act="sendcode">Send my code</button>' + priv + '</section>';
    }
  };

  function focusTracker() {
    var t = todayNum(), L = S.habit.length, e = S.entries[t];
    var h = '<section class="screen focus fmin"><h1>' + esc(habitName()) + '</h1><p class="hint c">' + (t > L ? 'All ' + L + ' days done' : anchorLine() ? esc(anchorLine()) : 'Day ' + t + ' of ' + L) + '</p>';
    if (t > L) h += '<div class="big"><button class="btn" data-go="reflect">Start my look back</button><button class="link center" data-go="share">Share that I did it</button></div>';
    else if (!e) h += '<div class="big">' + showUpButtons(true) + '</div>';
    else {
      h += '<div class="donemin"><span class="bigstar"></span><p>' + esc(doneMsg(e)) + '</p><button class="link center" data-go="note">' + (e.note ? 'Edit my note' : 'Add a note') + '</button></div>';
      h += nudgeAsk(t) || signInCard() || extraCards(t);
    }
    if (t <= L && !(S.entries[t] && nudgeAsk(t))) { h += stuDay(t);
    }
    var catchUp = t <= L + 1 && catchDays(t).length;
    h += '<div class="spacer"></div><div class="fminfoot"><details class="ask"><summary>' + (catchUp ? 'Fill in a past day' : 'My days') + '</summary><div class="card" style="padding:16px">' + (catchUp ? catchUpCard(t) : '') + gridHTML(t, true) + '<p class="hint" style="margin:0">Tap any day to fill it in.</p></div></details>' +
      '<button class="link" data-go="plan">My plan</button></div>';
    return h + '</section>';
  }

  function extraCards(t) {
    var h = '';
    if (t >= 3 && !S.fb.day3 && t <= S.habit.length) {
      h += '<div class="card soft"><span class="eyebrow">Quick one for Stuart</span><label class="label" for="fb3">Anything confusing or annoying so far?</label><textarea id="fb3" rows="1" placeholder="Nothing is fine too"></textarea>' +
        '<div class="row"><button class="link" data-act="fb3skip">Skip</button><button class="chip" data-act="fb3send" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Send</button></div></div>';
    } else if (false) {
      h += '<div class="card soft small"><b style="font-weight:600">Put it on your home screen</b><span>It opens like an app, one tap away.</span><div class="row"><button class="link" data-act="installno">Not now</button><button class="chip" data-go="install">Show me how</button></div></div>';
    }
    return h;
  }

  function reminderCard() {
    var s = S.settings;
    return '<div class="card" style="gap:0;padding:6px 16px"><div class="row" style="min-height:56px"><span style="color:var(--text-mid)">Morning nudge at <b style="color:var(--text)">' + esc(fmtTime(s.time)) + '</b></span>' +
      '<button class="chip" style="min-height:44px;padding:0 14px;background:var(--cream-dark);border:0;font-weight:600;font-size:14px" data-act="gosettings">Change</button></div></div>';
  }
  function whyCard(editable) {
    var hb = S.habit || S.draft;
    var h = '<div class="why"><div class="top"><span class="eyebrow">Your why</span>' + (editable ? '<button class="mini" data-length="ready">' + hb.length + ' days · Change</button>' : '') + '</div>' +
      '<div class="habit">' + esc(habitName()) + '</div><div class="words">';
    words().forEach(function (w) { h += '<span>' + esc(w.toLowerCase()) + '</span>'; });
    h += '</div>';
    if (hb.mode === 'less' && (hb.instead || '').trim()) h += '<div class="soft" style="font-size:14px">Instead: ' + esc(hb.instead) + '</div>';
    return h + '<div class="soft" style="font-size:14px">Tough day: ' + esc(hb.dimmer || '') + '</div></div>';
  }
  function gridHTML(t, tappable) {
    var h = '<div class="grid">', nt = extra().noticed || {};
    for (var n = 1; n <= S.habit.length; n++) {
      var e = S.entries[n], c = 'day', lab = 'Day ' + n;
      if (e) { c += ' full' + (e.comeback ? ' comeback' : ''); lab += ', showed up'; }
      else if (n < t) { c += ' missed' + (nt[n] ? ' noticed' : ''); }
      else if (n === t) { c += ' today'; lab += ', today'; }
      if (e && e.note) c += ' has-note';
      if (tappable && n <= t) h += '<button class="' + c + '" data-day="' + n + '" aria-label="' + lab + '">' + n + '</button>';
      else h += '<span class="' + c + '">' + n + '</span>';
    }
    return h + '</div>';
  }
  function doneMsg(e) {
    var total = count(function () { return true; }) + ' show-up' + (count(function () { return true; }) === 1 ? '' : 's');
    if (e.felt === 'Honestly, tough') return 'Tough one, and you still showed up. That’s ' + total + '.';
    if (e.felt) return 'You showed up today. ' + e.felt + '. That’s ' + total + '.';
    return 'You showed up today. That’s ' + total + '.';
  }
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
    if (!skip && v) { saveName(v); if (S.viewChosen) toast('Lovely to meet you, ' + v + '.'); }
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

  function render() {
    var s = screens[S.screen] ? S.screen : 'landing';
    if (s === 'tracker' && !S.habit) s = 'landing';
    var focus = S.settings.view === 'focus';
    document.documentElement.classList.toggle('focus-mode', focus);

    view.innerHTML = screens[s]();
    backBtn.classList.toggle('ghost', !BACK[s] && !ui.hist.length);
    fwdBtn.classList.toggle('ghost', !ui.fwd.length);
    settingsBtn.classList.toggle('ghost', s === 'settings' || (!isTester() && (!S.habit || ['what', 'when', 'less', 'feel', 'dimmer', 'hard'].indexOf(s) >= 0)));
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
    S.screen = s; save(false); render();
  }
  function goBack() {
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
  function recomputeComebacks() {
    var seen = false;
    for (var n = 1; n <= Math.max(todayNum(), S.habit ? S.habit.length : 0); n++) {
      var e = S.entries[n]; if (!e) continue;
      var cb = seen && n > 1 && !S.entries[n - 1];
      if (!!e.comeback !== cb) { e.comeback = cb; e.at = new Date().toISOString(); }
      seen = true;
    }
  }
  function markDay(n) {
    if (!S.habit || n < 1 || n > todayNum() || S.entries[n]) return;
    S.entries[n] = { kind: 'full', comeback: false, at: new Date().toISOString() };
    var nt = extra().noticed; if (nt && nt[n]) delete nt[n];
    recomputeComebacks(); save(); buzz();
    var c = count(function () { return true; });
    toast('Day ' + n + ' counted. That’s ' + c + ' show-up' + (c === 1 ? '' : 's') + '.');
  }
  function clearBadge() { try { if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') clearBadge(); });
  function tick(kind, from) {
    if (notStarted()) { S.habit.start = todayStr(); S.later = false; }
    var t = todayNum();
    if (S.entries[t]) return;
    S.entries[t] = { kind: 'full', comeback: false, at: new Date().toISOString() };
    recomputeComebacks();
    save(); buzz();
    var n = count(function () { return true; }), name = firstName();
    var title = 'Good work' + (name ? ', ' + esc(name) : '') + '.';
    var sub = S.entries[t].comeback ? 'You showed up today. Getting back on is the real work.' :
      (t === 1 ? 'You showed up on day one. That’s the hardest bit done.' : 'You showed up today. That’s ' + n + ' show-ups.');
    var el = document.createElement('div');
    el.className = 'celebrate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'You showed up today');
    el.innerHTML = confettiHTML(60) + '<div class="burst"><span class="ring"></span><div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">' + title + '</div><div class="s">' + sub + '</div></div><p class="tapon">Tap to carry on</p>';
    app.appendChild(el);
    // Celebrate, then get out of the way: closes itself, or on a tap.
    var closed = false, close = function () { if (closed) return; closed = true; el.remove(); if (from === 'slipped') go('tracker'); else render(); };
    el.addEventListener('click', close);
    setTimeout(close, isCalm() ? 2200 : 3200);
  }

  // ── One day, opened from the grid ─────────────────────────────────────────
  var GOT_IN_WAY = ['I just forgot', 'Ran out of time', 'Too tired', 'Plans changed', 'Wasn’t feeling it'];
  function openDay(n) {
    if (!S.habit) return;
    var t = todayNum(); if (n > t) return;
    if (n === t && !S.entries[n]) { var sc = document.querySelector('[data-tick]'); if (sc) { sc.scrollIntoView({ behavior: isCalm() ? 'auto' : 'smooth', block: 'center' }); sc.focus({ preventScroll: true }); } return; }
    var e = S.entries[n], nt = (extra().noticed || {})[n] || { why: [], note: '' };
    var date = prettyDate(addDays(S.habit.start, n - 1));
    var el = document.createElement('div'); el.className = 'sheet-bg';
    var h = '<div class="sheet" role="dialog" aria-label="Day ' + n + '"><div class="row"><span><span class="eyebrow">Day ' + n + '</span><b style="display:block;font-size:20px;font-weight:600">' + esc(date) + '</b></span><button class="link" data-x="close">Close</button></div>';
    if (e) {
      h += '<div class="done" style="background:var(--white)"><span class="bigstar"></span><span class="msg">You showed up' + (e.felt ? '. ' + esc(e.felt) : '') + '.</span></div>' +
        '<div class="field"><label class="label" for="dnote">Anything to remember about this day?</label><textarea id="dnote" rows="2" placeholder="Only you see this">' + esc(e.note || '') + '</textarea></div>' +
        '<button class="btn" data-x="savenote">Save</button>' +
        '<button class="link center" data-x="unmark" style="font-size:14px">Tapped this by mistake? Remove it</button>';
    } else {
      h += '<button class="btn" data-x="mark">' + checkIcon('#FFFFFF') + 'I showed up this day</button>' +
        '<div class="divider" style="margin:6px 0"></div>' +
        '<span class="eyebrow">If it didn’t happen</span>' +
        '<b style="font-weight:600">Looking back, what do you notice about this day?</b>' +
        '<span class="hint" style="margin-top:-6px">Spotting what gets in the way is useful. It’s how you learn to work around it.</span>' +
        '<div class="chips">' + GOT_IN_WAY.map(function (w) { return '<button class="chip" data-why="' + esc(w) + '" aria-pressed="' + (nt.why.indexOf(w) >= 0) + '">' + esc(w) + '</button>'; }).join('') + '</div>' +
        '<textarea id="dwhy" rows="1" placeholder="Something else? Say what it was (just for you)">' + esc(nt.note || '') + '</textarea>' +
        '<button class="btn outline" data-x="savewhy">Save what I noticed</button>' +
        '<p class="hint" style="text-align:center;margin:0">Totally optional. Some days you’d rather leave be, and that’s fine.</p>';
    }
    el.innerHTML = h + '</div>';
    app.appendChild(el);
    el.querySelectorAll('textarea').forEach(grow);
    var why = nt.why.slice();
    el.addEventListener('input', function (ev) { if (ev.target.tagName === 'TEXTAREA') grow(ev.target); });
    el.addEventListener('click', function (ev) {
      if (ev.target === el) return el.remove();
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.why) { var i = why.indexOf(b.dataset.why); i >= 0 ? why.splice(i, 1) : why.push(b.dataset.why); b.setAttribute('aria-pressed', i < 0); return; }
      var x = b.dataset.x;
      if (x === 'close') return el.remove();
      if (x === 'mark') { el.remove(); markDay(n); return render(); }
      if (x === 'savenote') { e.note = el.querySelector('#dnote').value.trim(); e.at = new Date().toISOString(); save(); el.remove(); toast('Saved.'); return render(); }
      if (x === 'unmark') { delete S.entries[n]; recomputeComebacks(); save(); el.remove(); toast('Removed.'); return render(); }
      if (x === 'savewhy') {
        var note = el.querySelector('#dwhy').value.trim(), ex = extra(); ex.noticed = ex.noticed || {};
        if (!why.length && !note) delete ex.noticed[n];
        else ex.noticed[n] = { why: why, note: note, at: new Date().toISOString() };
        save(); el.remove(); toast(why.length || note ? 'Saved. Good noticing.' : 'Cleared.'); return render();
      }
    });
    var f = el.querySelector('button.btn'); if (f) f.focus({ preventScroll: true });
  }

  // ── Catch-up after a gap ──────────────────────────────────────────────────
  function catchDays(t) {
    var out = [], nt = extra().noticed || {}, dis = S.catchup || [];
    for (var n = Math.max(1, t - 7); n < t && n <= S.habit.length; n++) if (!S.entries[n] && !nt[n] && dis.indexOf(n) < 0) out.push(n);
    return out;
  }
  function catchUpCard(t) {
    if (!S.habit || t > S.habit.length + 1) return '';
    var days = catchDays(t); if (!days.length) return '';
    var gap = days.length > 1, yest = !gap && days[0] === t - 1;
    var dayName = new Date(addDays(S.habit.start, days[0] - 1) + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
    var h = '<div class="card soft"><span class="eyebrow">' + (gap ? 'Welcome back' : yest ? 'Yesterday' : 'Catching up') + '</span>' +
      '<b style="font-weight:600">' + (gap ? 'Did you show up on any of these days?' : yest ? 'Did you show up yesterday?' : 'Did you show up on ' + dayName + '?') + '</b>' +
      '<span class="hint" style="margin-top:-6px">Life gets busy. Tap any you did, and they’ll count.</span><div class="chips">';
    days.forEach(function (n) {
      var d = new Date(addDays(S.habit.start, n - 1) + 'T12:00:00');
      var lab = !gap ? 'Yes, I did' : n === t - 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      h += '<button class="chip" data-catch="' + n + '">' + esc(lab) + '</button>';
    });
    return h + '</div><button class="link" data-act="catchdone" style="align-self:flex-start;font-size:14px">' + (gap ? 'That’s everything' : 'No, carry on') + '</button></div>';
  }

  // ── The two buttons that matter ───────────────────────────────────────────
  function showUpButtons(big) {
    return '<div class="showup">' +
      '<button class="btn showup-btn" data-tick="full">' + checkIcon('#FFFFFF') + 'I showed up today</button>' +
      (big ? '' : '<p class="hint" style="margin:0;text-align:center">A lighter version on a tough day counts too.</p>') +
      '<button class="link center struggle-link" data-go="slipped">I’m struggling</button></div>';
  }
  // The last seven days as tappable dots, today last.
  function weekHTML(t) {
    var h = '<div class="week">', from = Math.max(1, t - 6), to = Math.min(t, S.habit.length);
    for (var n = from; n <= Math.max(to, from); n++) {
      var e = S.entries[n], d = new Date(addDays(S.habit.start, n - 1) + 'T12:00:00'), c = 'wd' + (e ? ' on' : n === t ? ' today' : '');
      h += '<button class="' + c + '" data-day="' + n + '" aria-label="Day ' + n + (e ? ', showed up' : '') + '"><span>' + d.toLocaleDateString('en-GB', { weekday: 'narrow' }) + '</span><i></i></button>';
    }
    return h + '</div>';
  }

  // ── Not signed in: nudges can't reach you ─────────────────────────────────
  // ── Stu as the guide: his photo and a short line at the moments that matter ──
  function stuCard(text, extraHtml) {
    return '<div class="stu"><img src="stuart.jpg" alt="Stuart" width="44" height="44"><div class="stutxt"><b>Stu</b><span>' + text + '</span>' + (extraHtml || '') + '</div></div>';
  }
  var STU_DAYS = {
    3: 'Day 3. This is usually where life gets in the way. If today’s a 1 out of 10, that still counts as showing up.',
    7: 'A week in. Whatever the dots look like, you’re building the skill of coming back. That’s the bit that lasts.',
    14: 'Halfway. If it’s feeling like hard work, turn the dimmer down, not off.',
    21: 'Three weeks. Notice what feels easier now than it did on day one.',
    28: 'Nearly there. However the month has gone, you kept coming back. That’s the whole point.'
  };
  function stuDay(t) {
    var msg = STU_DAYS[t], seen = (S.stuSeen || {})[t];
    if (!msg || seen || !S.habit || t > S.habit.length) return '';
    var check = t >= 7 && user;
    return stuCard(esc(msg), check
      ? '<span class="stuq">How’s it going? One tap, and I’ll see it.</span><div class="chips"><button class="chip" data-act="stucheck" data-v="Going well">Going well</button><button class="chip" data-act="stucheck" data-v="Mixed">Mixed</button><button class="chip" data-act="stucheck" data-v="Tough">Tough</button></div>'
      : '<button class="link" data-act="stuok" style="align-self:flex-start;font-size:14px">Thanks, Stu</button>');
  }
  function nudgeAsk(t) {
    var e = S.entries[t], a = S.pushAsk || {};
    if (!e || S.settings.push || !sb) return '';
    if (!pushSupported() || (window.Notification && Notification.permission === 'denied')) return '';
    if (isIOS() && !isStandalone()) return '';
    if (a.n >= 2 || (a.n === 1 && daysBetween(a.at, todayStr()) < 3) || a.at === todayStr()) return '';
    return '<div class="card soft nudgeask"><b style="font-weight:600">Want a gentle nudge on your phone each morning?</b>' +
      '<span>At ' + esc(fmtTime(S.settings.time)) + ', your time, wherever you are. Change it any time in Settings.</span>' +
      (user ? '' : '<span class="hint">First we’ll ask for your email, so the nudge knows where to find you.</span>') +
      '<div class="row" style="gap:12px;justify-content:flex-start"><button class="chip" data-act="nudgeyes" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">' + (user ? 'Turn on' : 'Add my email') + '</button><button class="link" data-act="nudgeno">Not now</button></div></div>';
  }
  function signInCard() {
    if (user || !sb || !authChecked || S.signinLater === todayStr() || (S.habit && todayNum() < 2)) return '';
    return '<div class="card soft small"><b style="font-weight:600">Save your progress?</b><span>Add your email and your nudges can reach you, and nothing gets lost.</span>' +
      '<div class="row" style="gap:12px;justify-content:flex-start"><button class="chip" data-account="tracker" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Save my progress</button><button class="link" data-act="signinlater" style="font-size:14px">Not now</button></div></div>';
  }

  // ── Help me choose ─────────────────────────────────────────────────────────
  // Open questions first (their words), then they choose one thing, then why one thing matters.
  var HORIZONS = [['30', '30 days'], ['90', 'three months'], ['365', 'a year']];
  function horizonLabel() { var f = S.find || {}, h = HORIZONS.filter(function (x) { return x[0] === f.horizon; })[0] || HORIZONS[1]; return h[1]; }
  function FIND_QS() {
    var proud = { key: 'proud', q: 'Picture yourself a year from now. You’re feeling insanely proud of yourself. What did you do to feel this way?', hint: 'Picture how life feels, not just the thing you did.', ph: 'e.g. I finally sorted my sleep, and my evenings are mine again' };
    if (S.find && S.find.mode === 'less') return [
      { key: 'drain', q: 'What do you notice you do regularly that costs you more than it gives you?', hint: 'Jot down whatever comes. We’ll narrow it down together.', ph: 'e.g. Scrolling in bed at night, too much chocolate, not being present with family' },
      proud
    ];
    return [
      { key: 'years', q: 'What have you wanted to do for years, or keep thinking about trying?', hint: 'Jot down whatever comes. We’ll narrow it down together.', ph: 'e.g. Get fit again, learn the guitar, write more, be calmer' },
      proud
    ];
  }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = null;
  function micButton() {
    if (!SR) return '';
    return '<button class="mic" data-mic="1" aria-pressed="false" aria-label="Speak instead of typing"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Speak</span></button>';
  }
  function toggleMic(btn) {
    var ta = document.getElementById('findans'); if (!SR || !ta) return;
    if (rec) { rec.stop(); return; }
    try {
      rec = new SR(); rec.lang = 'en-GB'; rec.continuous = true; rec.interimResults = true;
      var base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
      rec.onresult = function (ev) {
        var fin = '', tmp = '';
        for (var i = 0; i < ev.results.length; i++) { if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; else tmp += ev.results[i][0].transcript; }
        ta.value = base + fin + tmp; grow(ta); findSave();
      };
      rec.onend = function () { rec = null; btn.setAttribute('aria-pressed', 'false'); btn.querySelector('span').textContent = 'Speak'; };
      rec.onerror = function (e) { if (e.error === 'not-allowed') toast('Microphone blocked. You can allow it in your browser settings.'); };
      rec.start(); btn.setAttribute('aria-pressed', 'true'); btn.querySelector('span').textContent = 'Listening… tap to stop';
    } catch (e) { rec = null; toast('Speaking isn’t available here. Typing works just as well.'); }
  }
  function findSave() {
    var ta = document.getElementById('findans'), f = S.find; if (!ta || !f) return;
    var q = FIND_QS()[f.step]; if (q) { f.answers[q.key] = ta.value; save(false); }
  }
  function findScreen() {
    var f = S.find || (S.find = { step: 0, answers: {} }), qs = FIND_QS();
    if (f.step < qs.length) {
      var q = qs[f.step], v = f.answers[q.key] || '';
      var bar = '<div class="progress" style="grid-template-columns:repeat(' + qs.length + ',1fr)" aria-hidden="true">' + qs.map(function (x, i) { return '<span' + (i <= f.step ? ' class="on"' : '') + '></span>'; }).join('') + '</div>';
      return '<section class="screen"><div class="stepper">' + bar + '<div class="eyebrow" style="margin-top:12px">Challenge ideas · ' + (f.step + 1) + ' of ' + qs.length + '</div>' +
        (f.step === 0 ? '<p class="lede workintro">' + (S.settings.view === 'focus' ? 'Take your time. Ramble, ums and all. The more you share, the better the ideas.' : 'Take your time. Write or speak whatever comes up, ums and all, as much as you like. The more you share, the better we can help you find a challenge that genuinely matters to you.') + '</p>' : '') +
        '<h1 class="findq">' + esc(q.q) + '</h1></div>' +
        '<p class="hint" style="margin-top:-8px">' + esc(q.hint) + '</p>' +
        '<div class="field"><textarea id="findans" rows="5" style="min-height:180px" placeholder="' + esc(q.ph) + '">' + esc(v) + '</textarea>' + micButton() + '<span class="hint">Private. Read by our AI helper to suggest ideas, never shared or kept.</span></div>' +
        '<div class="spacer"></div><button class="btn" data-find="next">' + (f.step === qs.length - 1 ? 'Show me ideas' : 'Next') + '</button>' +
        '<button class="link center" data-find="skip">Skip this one</button></section>';
    }
    return ideasScreen(f);
  }
  // After the questions: the AI pulls out the areas, they pick one, check it rings true, then choose a challenge.
  function ideasScreen(f) {
    var top = '<section class="screen"><div><div class="eyebrow">Challenge ideas</div>';
    var own = '<div class="field"><label class="label" for="ownch">Or write my own</label><textarea id="ownch" rows="1" placeholder="' + (f.mode === 'less' ? 'e.g. No phone in bed' : 'e.g. A 20 minute walk each day') + '">' + esc(f.own || '') + '</textarea></div><button class="btn outline" data-find="own">Use mine</button>';
    var ai = f.ai || {}, areas = ai.areas || [];
    if (ai.care) return top + '<h1>Before anything else.</h1></div><div class="why"><span>' + esc(ai.care) + '</span></div><div class="spacer"></div>' + own + '</section>';
    if (!areas.length) {
      if (!user && !guest) {
        if (authChecked && !ui.guestFailed && !ui.guestTrying) { ui.guestTrying = true; ensureGuest().then(function (ok) { ui.guestTrying = false; if (!ok) ui.guestFailed = true; render(); }); }
        if (!ui.guestFailed) return top + '<h1>Reading what you shared…</h1></div><p class="lede">Looking for what matters most to you. This takes a few seconds.</p><div class="dotpulse" aria-hidden="true"><span></span><span></span><span></span></div></section>';
        return top + '<h1>Add your email to see your ideas.</h1></div><p class="lede">We’ll read what you shared and suggest where to focus. It also saves your progress.</p>' +
          '<button class="btn" data-account="find">Add my email</button><div class="spacer"></div>' + own + '</section>';
      }
      if (!f.aiTried && !ui.aiBusy) setTimeout(reflectAI, 0);
      if (ui.aiBusy || !f.aiTried) return top + '<h1>Reading what you shared…</h1></div><p class="lede">Looking for what matters most to you. This takes a few seconds.</p><div class="dotpulse" aria-hidden="true"><span></span><span></span><span></span></div></section>';
      return top + '<h1>We couldn’t reach it just now.</h1></div><button class="btn" data-act="reflectai">Try again</button><div class="spacer"></div>' + own + '</section>';
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
    var h2 = top + '<h1>A few challenges to try.</h1></div><p class="lede">Within ' + esc(ar.name.toLowerCase()) + ', pick the one that gives you a little jolt.</p><div style="display:flex;flex-direction:column;gap:10px">';
    (ar.challenges || []).forEach(function (c, i) { h2 += '<button class="choice" data-find="take" data-i="' + i + '"><b>' + esc(c.title) + '</b><small>' + esc(c.daily) + '</small></button>'; });
    return h2 + '</div>' + own + '<div class="spacer"></div><button class="link center" data-find="toareas">Not convinced? Back to the areas</button></section>';
  }
  function aiCard(f, n) {
    if (!n || !sb) return '';
    if (f.ai && f.ai.care) return '<div class="why"><span class="eyebrow">Before anything else</span><span>' + esc(f.ai.care) + '</span></div>';
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
    f.aiTried = true; ui.aiBusy = true; render();
    try {
      var r = await sb.functions.invoke('showup-reflect', { body: { mode: f.mode || 'more', answers: f.answers, wins: (S.wins || []).map(function (w) { return { name: w.name, outcome: w.outcome }; }), horizon: horizonLabel() } });
      if (r.error) {
        var st = r.error.context && r.error.context.status;
        toast(st === 429 ? 'That’s today’s ideas used. Write your own below, or come back tomorrow.' : 'Couldn’t reach it just now. Try again in a moment.');
      } else if (r.data && ((r.data.areas && r.data.areas.length) || r.data.care)) { f.ai = r.data; f.r = 'areas'; f.area = 0; save(false); }
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
    var el = document.createElement('div'); el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-label="' + esc(w.name) + '"><div class="row"><span><span class="wo ' + w.outcome + '">' + esc(OUTCOME[w.outcome]) + '</span><b style="display:block;font-size:20px;font-weight:600;margin-top:6px">' + esc(w.name) + '</b></span><button class="link" data-x="close">Close</button></div>' +
      '<div class="field"><label class="label" for="whelped">What helped?</label><textarea id="whelped" rows="2" placeholder="Even small things count">' + esc(w.helped || '') + '</textarea></div>' +
      '<div class="field"><label class="label" for="wfelt">' + q2 + '</label><textarea id="wfelt" rows="2" placeholder="A few words is plenty">' + esc(w.felt || '') + '</textarea></div>' +
      '<button class="btn" data-x="save">Save</button><button class="link center" data-x="remove" style="font-size:14px">Remove this one</button></div>';
    app.appendChild(el);
    el.querySelectorAll('textarea').forEach(grow);
    el.addEventListener('input', function (ev) { if (ev.target.tagName === 'TEXTAREA') grow(ev.target); });
    el.addEventListener('click', function (ev) {
      if (ev.target === el) return el.remove();
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.x === 'close') return el.remove();
      if (b.dataset.x === 'save') { w.helped = el.querySelector('#whelped').value.trim(); w.felt = el.querySelector('#wfelt').value.trim(); syncWins(); el.remove(); toast('Saved.'); return render(); }
      if (b.dataset.x === 'remove') { S.wins = S.wins.filter(function (x) { return x.id !== id; }); syncWins(); el.remove(); return render(); }
    });
  }
  function findAct(a, b) {
    var f = S.find || (S.find = { step: 0, answers: {} }), qs = FIND_QS();
    if (rec) { try { rec.stop(); } catch (e) {} }
    if (a === 'start') { var md = (b && b.dataset.mode) || 'more', keep = S.find && S.find.mode === md ? S.find.answers : {}; S.find = { step: 0, mode: md, answers: keep || {}, horizon: '365' }; save(false); return askNameThen('find'); }
    if (a === 'next' || a === 'skip') { if (a === 'next') findSave(); f.step++; f.ai = null; f.aiTried = false; f.r = 'areas'; f.area = 0; f.pick = null; save(false); return go('find'); }
    if (a === 'area') { f.area = +b.dataset.i; f.r = 'insight'; save(false); return render(); }
    if (a === 'resonates') { f.r = 'ideas'; save(false); return render(); }
    if (a === 'toareas') { f.r = 'areas'; save(false); return render(); }
    if (a === 'ownonly') { f.r = 'ideas'; f.ownOnly = true; save(false); return render(); }
    if (a === 'take' || a === 'own') {
      var ar = ((f.ai || {}).areas || [])[f.area || 0] || {}, c = a === 'take' ? (ar.challenges || [])[+b.dataset.i] : null;
      var txt = c ? ((f.mode === 'less' ? c.title : c.daily) || c.title) : ((document.getElementById('ownch') || {}).value || '').trim();
      if (c && f.mode === 'less' && c.daily && !(S.draft.instead || '').trim()) S.draft.instead = c.daily;
      if (!txt) { toast('Write a few words first.'); return; }
      if (a === 'own') f.own = txt;
      S.draft.mode = f.mode || 'more'; S.draft.what = txt; S.draft.found = c ? c.title : txt; f.chosen = txt; save(false);
      stat('ideas', a === 'take' ? 'took:' + (ar.name || '') : 'own'); return go('what');
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
    var h = '<section class="screen"><div><div class="eyebrow">I’m struggling</div><h1>' + (k === 'life' ? 'Life happens.' : k ? esc(STRUGGLE[k].label) + '.' : 'Thanks for being honest.') + '</h1></div>';
    if (!k) {
      h += stuCard('Struggling doesn’t mean you’ve failed. It means it matters. Which feels closest?') + '<div style="display:flex;flex-direction:column;gap:10px">';
      Object.keys(STRUGGLE).forEach(function (key) { h += '<button class="choice" style="min-height:62px" data-struggle="' + key + '"><b>' + esc(STRUGGLE[key].label) + '</b></button>'; });
      h += '<button class="choice" style="min-height:62px" data-struggle="life"><b>Something came up</b></button></div>';
      return h + '</section>';
    }
    var t = todayNum(), canTick = !S.entries[t] && t <= hb.length;
    if (k === 'life') {
      var nt = (ex.noticed || {})[t] || {};
      h += '<p class="lede">Give yourself a break. This isn’t about a perfect run. It’s about showing up again.</p>' +
        '<div class="why"><span class="eyebrow">If you can</span><span>Do the tiniest version: <b>' + esc(hb.dimmer || 'a lighter version') + '</b>. That still counts.</span></div>' +
        '<div class="field"><label class="label" for="lifenote">What came up? (just for you)</label><textarea id="lifenote" rows="1" placeholder="e.g. Kids were ill, long day at work">' + esc(nt.note || '') + '</textarea></div>' +
        '<div class="spacer"></div>' + (canTick ? '<button class="btn" data-tick="dimmer" data-from="slipped">' + checkIcon('#FFFFFF') + 'I did the tiny version</button>' : '') +
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
    var step = k === 'start' ? 'Do your tough-day version: <b>' + esc(hb.dimmer || 'a lighter version') + '</b>. That counts as showing up.' :
      k === 'off' ? 'Show up once today, any size. That’s you back on.' :
      'Make it yours again. If your plan doesn’t fit any more, change it. Do it your way.';
    h += '<div class="why"><span class="eyebrow">One small step</span><span>' + step + '</span></div>';
    h += supportCard();
    h += '<div class="spacer"></div>';
    if (k === 'spark') h += '<button class="btn" data-go="plan">Change my plan</button>';
    if (canTick) h += '<button class="btn' + (k === 'spark' ? ' outline' : '') + '" data-tick="full" data-from="slipped">' + checkIcon(k === 'spark' ? '#0F1215' : '#FFFFFF') + 'I showed up today</button>';
    else h += '<button class="btn outline" data-go="tracker">Back to my tracker</button>';
    return h + '<button class="link center" data-struggle-back="1">Something else</button></section>';
  }

  // ── Share image ───────────────────────────────────────────────────────────
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  async function shareImage() {
    try { await document.fonts.load('400 72px "Playfair Display"'); await document.fonts.load('600 32px Poppins'); await document.fonts.load('700 56px Poppins'); } catch (e) {}
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), t = todayNum(), L = S.habit.length;
    g.fillStyle = '#0F1215'; g.fillRect(0, 0, W, H);
    try { await document.fonts.load('700 56px Poppins'); } catch (e) {}
    g.font = '700 56px Poppins, sans-serif'; g.textAlign = 'right';
    var bw = g.measureText('!').width; g.fillStyle = '#C9930A'; g.fillText('!', W - 80, 142);
    g.fillStyle = '#FFFFFF'; g.fillText('Let\u2019s Go', W - 80 - bw, 142); g.textAlign = 'left';
    g.fillStyle = '#EDE8DF'; g.font = '600 34px Poppins, sans-serif'; g.fillText((L + '-day challenge').toUpperCase(), 80, 140);
    g.fillStyle = '#FFFFFF'; g.font = '400 88px "Playfair Display", Georgia, serif';
    var lines = wrap(g, habitName(), W - 160), y = 330; lines.slice(0, 3).forEach(function (l) { g.fillText(l, 80, y); y += 100; });
    var cols = 10, gap = 18, size = (W - 160 - gap * (cols - 1)) / cols; y += 20;
    for (var n = 1; n <= L; n++) {
      var col = (n - 1) % cols, row = Math.floor((n - 1) / cols), x = 80 + col * (size + gap), yy = y + row * (size + gap), e = S.entries[n];
      g.beginPath(); g.arc(x + size / 2, yy + size / 2, size / 2, 0, Math.PI * 2);
      if (e) { g.fillStyle = '#C9930A'; g.fill(); }
      else if (n < t) { g.lineWidth = 2; g.strokeStyle = '#1C2B3A'; g.stroke(); }
      else { g.fillStyle = '#1C2B3A'; g.fill(); }
    }
    y += Math.ceil(L / cols) * (size + gap) + 60;
    var days = Math.min(t, L), shown = count(function (x, k) { return k <= L; }), pct = Math.round(shown / Math.max(1, days) * 100);
    g.fillStyle = '#FFFFFF'; g.font = '600 120px Poppins, sans-serif'; g.fillText(pct + '%', 80, y + 60);
    g.fillStyle = '#EDE8DF'; g.font = '500 40px Poppins, sans-serif'; g.fillText('Showed up ' + shown + ' of ' + days + ' days', 80, y + 130);
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    var file = new File([blob], 'my-progress.png', { type: 'image/png' });
    var text = habitName() + ': showed up ' + count(function (x, k) { return k <= L; }) + ' of ' + Math.min(t, L) + ' days.';
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(function (r) { swReg = r; }).catch(function () {});
  function b64ToBytes(b) { var p = '='.repeat((4 - b.length % 4) % 4), s = (b + p).replace(/-/g, '+').replace(/_/g, '/'), raw = atob(s), a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  async function togglePush() {
    if (S.settings.push) {
      try { var reg = swReg || await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); if (sub) { if (user) await sb.from('showup_push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch (e) {}
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
      var r = await sb.from('showup_push_subscriptions').upsert({ endpoint: j.endpoint, user_id: user.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
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
    if (t.dataset.bind) {
      S.draft[t.dataset.bind] = t.value; save(false);
      var pn = document.getElementById('previewName'); if (pn && t.dataset.bind === 'what') { pn.textContent = t.value.trim() || 'Your habit'; var pw = document.getElementById('previewWrap'); if (pw) pw.style.display = t.value.trim() ? 'flex' : 'none'; }
      if (t.dataset.bind === 'instead') { view.querySelectorAll('[data-loop="instead"]').forEach(function (li) { li.textContent = t.value.trim() || 'Your instead'; }); }
      var next = view.querySelector('[data-step-next]');
      if (next) next.disabled = !stepValid(next.dataset.stepNext);
    }
    if (t.dataset.xbind && S.habit) { extra()[t.dataset.xbind] = t.value; save(); }
    if (t.dataset.hbind && S.habit) { if (t.dataset.hbind === 'what' && !t.value.trim()) return; S.habit[t.dataset.hbind] = t.value; save(); }
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
    if (d.day) return openDay(+d.day);
    if (d.catch) { markDay(+d.catch); return render(); }
    if (d.struggle) { ui.struggle = d.struggle; return render(); }
    if (d.find) return findAct(d.find, b);
    if (d.winout) return addWin(d.winout);
    if (d.win) return openWin(d.win);
    if (d.winidea) { var wt = document.getElementById('winname'); if (wt) { wt.value = d.winidea; ui.winDraft = d.winidea; grow(wt); wt.focus(); } return; }
    if (d.mic) return toggleMic(b);
    if (d.horizon) { findSave(); S.find.horizon = d.horizon; save(false); return render(); }
    if (d.struggleBack) { ui.struggle = null; return render(); }
    if (d.back) return goBack();
    if (d.start) { S.draft.mode = d.start; return askNameThen('what'); }
    if (d.namego) return nameDone(d.namego === 'skip');
    if (d.starter) { S.draft.what = d.starter; save(false); return render(); }
    if (d.stepNext) { if (!stepValid(d.stepNext)) return; var nx = nextStep(d.stepNext); if (nx) return go(nx); return finishSetup(); }
    if (d.give) { var gi = S.draft.gives.indexOf(d.give); gi >= 0 ? S.draft.gives.splice(gi, 1) : S.draft.gives.push(d.give); save(false); b.setAttribute('aria-pressed', gi < 0); view.querySelectorAll('[data-loop="gives"]').forEach(function (lg) { lg.textContent = S.draft.gives.length ? S.draft.gives.join(', ') : 'Tap above'; }); view.querySelectorAll('[data-give="' + d.give + '"]').forEach(function (x) { x.setAttribute('aria-pressed', gi < 0); }); return; }
    if (d.feel) { var fi = S.draft.feel.indexOf(d.feel); fi >= 0 ? S.draft.feel.splice(fi, 1) : S.draft.feel.push(d.feel); save(false); b.setAttribute('aria-pressed', fi < 0); var nb = view.querySelector('[data-step-next]'); if (nb) nb.disabled = !stepValid(nb.dataset.stepNext); return; }
    if (d.hfeel) { var hf = S.habit.feel.indexOf(d.hfeel); hf >= 0 ? S.habit.feel.splice(hf, 1) : S.habit.feel.push(d.hfeel); save(); b.setAttribute('aria-pressed', hf < 0); return; }
    if (d.len) { if (S.habit) S.habit.length = +d.len; else S.draft.length = +d.len; save(); return render(); }
    if (d.length) { ui.returnTo = d.length; return go('length'); }
    if (d.edit) { ui.planEdit = true; return go('plan'); }
    if (d.idea) { S.draft.what = IDEAS[+d.idea][0]; ui.ideasOpen = false; save(false); return render(); }
    if (d.words) { ui.wordsFrom = d.words; return go('words'); }
    if (d.account) { ui.returnTo = d.account; ui.authFrom = null; return go('account'); }
    if (d.tick) { var from = d.from || (S.screen === 'ready' ? 'ready' : 'tracker'); return tick(d.tick, from); }
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
    if (d.rday) { var di = S.settings.days.indexOf(+d.rday); di >= 0 ? S.settings.days.splice(di, 1) : S.settings.days.push(+d.rday); S.settings.days.sort(); save(); b.setAttribute('aria-pressed', di < 0); return; }
    if (d.pause) { S.settings.pausedUntil = +d.pause ? addDays(todayStr(), +d.pause) : null; save(); toast(+d.pause ? 'Nudges paused. Your progress is safe.' : 'Nudges back on.'); return render(); }
    if (d.rnext) { ui.reflect.next = d.rnext; return render(); }
    if (d.rpmf) { ui.reflect.pmf = d.rpmf; return render(); }
    switch (d.act) {
      case 'ideas': ui.ideasOpen = true; return render();
      case 'closeideas': if (e.target.closest('[data-stop]') && !b.matches('button')) return; ui.ideasOpen = false; return render();
      case 'finish': return finishSetup();
      case 'later': S.later = true; if (S.habit && !count(function () { return true; })) S.habit.start = addDays(todayStr(), 1); save(); return render();
      case 'gosettings': return go('settings');
      case 'starttoday': S.habit.start = todayStr(); S.later = false; save(); return render();
      case 'savenote': { var t = ui.noteDay || todayNum(); ui.noteDay = null; var v = document.getElementById('note').value.trim(); if (!S.entries[t] && v) { toast('Tick today first, then your note is saved with it.'); return; } if (S.entries[t]) { S.entries[t].note = v; S.entries[t].at = new Date().toISOString(); } save(); toast('Note saved.'); return go('tracker'); }
      case 'morechips': ui.moreChips = true; return render();
      case 'undo': delete S.entries[todayNum()]; recomputeComebacks(); save(); toast('Undone.'); return render();
      case 'catchdone': { var cd = catchDays(todayNum()); S.catchup = (S.catchup || []).concat(cd); save(false); return render(); }
      case 'reflectai': return void reflectAI();
      case 'saveworked': { var wv = (document.getElementById('worked') || {}).value || ''; if (!wv.trim()) { toast('Write a few words first, or skip it.'); return; }
        var ex = extra(); ex.worked = (ex.worked || []).concat([{ k: ui.struggle || '', q: ui.struggleQ || '', a: wv.trim(), at: new Date().toISOString() }]); save(); ui.struggleSaved = true; return render(); }
      case 'lifesave': { var lv = ((document.getElementById('lifenote') || {}).value || '').trim(), lx = extra(); lx.noticed = lx.noticed || {}; var cur = lx.noticed[todayNum()] || { why: [] }; cur.why = cur.why || []; if (cur.why.indexOf('Plans changed') < 0) cur.why.push('Plans changed'); if (lv) cur.note = lv; cur.at = new Date().toISOString(); lx.noticed[todayNum()] = cur; save(); ui.struggle = null; toast('Noted. See you tomorrow.'); return go('tracker'); }
      case 'calics': calRead(); downloadICS(); return;
      case 'calgoogle': calRead(); try { window.open(googleCalURL(), '_blank', 'noopener'); } catch (e) {} stat('calendar', 'google'); return;
      case 'testerreset': return confirmSheet('Start again from scratch?', 'Everything on this phone and in your account goes, so you start as a new person.', 'Start again', testerReset);
      case 'sharenote': ui.shareNote = !ui.shareNote; return render();
      case 'shareimg': return void shareImage();
      case 'whatsapp': { var tt = Math.min(todayNum(), S.habit.length); window.open('https://wa.me/?text=' + encodeURIComponent(habitName() + ': I showed up ' + count(function (x, k) { return k <= S.habit.length; }) + ' of ' + tt + ' days.'), '_blank', 'noopener'); return; }
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
      case 'newhabit': return confirmSheet('Start a new habit?', 'Your current habit and its ticks are kept in your account, just put away.', 'Start a new habit', function () {
        if (S.habit) { S.habit.status = 'archived'; save(); if (user) void syncAll().then(function () { resetForNew(); }); else resetForNew(); } else resetForNew();
      });
      case 'signin': return void doSignIn();
      case 'sendcode': return void sendCode();
      case 'verifycode': return void verifyCode();
      case 'authback': ui.authStep = null; return render();
      case 'plannotnow': ui.authFrom = null; ui.authStep = null; stat('sendplan', 'later'); return go('ready');
      case 'nudgeyes': stat('nudgeask', user ? 'yes' : 'email'); if (!user) { ui.returnTo = 'tracker'; return go('account'); } var pa2 = S.pushAsk || { n: 0 }; S.pushAsk = { n: (pa2.n || 0) + 1, at: todayStr() }; save(false); return void togglePush();
      case 'nudgeno': var pa = S.pushAsk || { n: 0 }; S.pushAsk = { n: (pa.n || 0) + 1, at: todayStr() }; save(false); stat('nudgeask', 'not now'); return render();
      case 'stuok': S.stuSeen = S.stuSeen || {}; S.stuSeen[todayNum()] = true; save(false); return render();
      case 'stucheck': S.stuSeen = S.stuSeen || {}; S.stuSeen[todayNum()] = true; feedback('checkin-day' + todayNum(), b.dataset.v); stat('checkin', b.dataset.v); toast('Thanks. Stu reads these.'); return render();
      case 'tlrmember': S.settings.tlrMember = b.dataset.v === 'yes'; save(); stat('support', 'member:' + b.dataset.v); return render();
      case 'booster': return openLink(S.settings.tlrMember ? SUPPORT.boosterMember : SUPPORT.boosterStandard, S.settings.tlrMember ? 'booster-member' : 'booster');
      case 'tlrbridge': return tlrBridge();
      case 'tlrtoggle': S.settings.tlrMember = !S.settings.tlrMember; save(); return render();
      case 'signinlater': S.signinLater = todayStr(); save(false); return render();
      case 'exportdata': return exportData();
      case 'deletedata': return confirmSheet('Delete your Let’s Go data?', 'This deletes your habit, show-ups, notes, past wins and settings from this device' + (user ? ', and deletes your account' : '') + '. It can’t be undone.', 'Delete my data', function () { void deleteData(); });
      case 'signout': return void (async function () { await sb.auth.signOut(); user = null; guest = null; S = fresh(); save(false); applyComfort(); go('landing'); })();
    }
  });
  backBtn.addEventListener('click', goBack);
  fwdBtn.addEventListener('click', goForward);
  settingsBtn.addEventListener('click', function () { if (!S.habit && isTester()) return confirmSheet('Start again from scratch?', 'Testing only. Everything on this phone and in your account goes, so you start as a new person.', 'Start again', testerReset); go('settings'); });
  document.getElementById('homeBtn').addEventListener('click', function () { ui.ideasOpen = false; go(S.habit ? 'tracker' : 'landing'); });

  // Suggestions and examples: always shown in Full; in Focus they wait behind one tap.
  // Extras that wait behind one tap in both views.
  function tapToSee(label, html) { return '<details class="ask"><summary>' + esc(label) + '</summary>' + html + '</details>'; }
  function optional(label, html) {
    return '<div class="full-only">' + html + '</div><details class="ask focus-only"><summary>' + esc(label) + '</summary>' + html + '</details>';
  }
  function iconFull(c, z) { z = z || 20; return '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="' + c + '"/></svg>'; }
  function iconDown(c, z) { z = z || 20; return '<svg width="' + z + '" height="' + z + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="' + c + '" stroke-width="2"/><path d="M12 3a9 9 0 0 1 0 18z" fill="' + c + '"/></svg>'; }
  function iconClock(c) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'; }
  function ring(t, L) {
    var r = 56, c = 2 * Math.PI * r, n = count(function () { return true; }), f = Math.min(1, n / L);
    return '<div class="ring" role="img" aria-label="' + n + ' show-ups, day ' + Math.min(t, L) + ' of ' + L + '"><svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="' + r + '" fill="none" stroke="#E5DDD1" stroke-width="10"/>' +
      (n ? '<circle cx="66" cy="66" r="' + r + '" fill="none" stroke="#0F1215" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '"/>' : '') + '</svg>' +
      '<div class="lbl"><b>' + n + '</b><small>show-up' + (n === 1 ? '' : 's') + '</small></div></div>';
  }
  function nextNudge() {
    var s = S.settings; if (!user && sb) return ''; if (!(s.email || s.push)) return '';
    return '<p class="next-up">' + iconClock('#888880') + '<span>What happens next: <b>your nudge arrives tomorrow at ' + esc(fmtTime(s.time)) + '</b>. Change it any time in Settings.</span></p>';
  }


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
  function planEditor() { return screens._editform(); }
  // ── Calendar: a repeating reminder in their own calendar, in their own words ──
  var APPLINK = 'https://motivate-coaching.github.io/tlr-hub/show-up/';
  function iconCal() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'; }
  function calDefaultStart() { var n = new Date(), hm = (S.settings.time || '07:00').split(':'); return n.getHours() * 60 + n.getMinutes() < (+hm[0]) * 60 + (+hm[1]) ? todayStr() : addDays(todayStr(), 1); }
  function calRead() { var t = document.getElementById('caltime'), d = document.getElementById('calstart'); ui.cal = ui.cal || {}; if (t && t.value) ui.cal.time = t.value; if (d && d.value) ui.cal.start = d.value; }
  function calDescription() {
    var hb = S.habit, ex = extra(), hard = ex.hard || {}, w = words().map(function (x) { return x.toLowerCase(); }), L = [];
    L.push('Today: ' + habitName() + '.');
    if (anchorLine()) L.push('When: ' + anchorLine() + '.');
    if (hb.mode === 'less' && (hb.instead || '').trim()) L.push('When the urge hits: ' + hb.instead.trim() + '.');
    L.push('Tough day? ' + (hb.dimmer || 'A lighter version') + '. That counts too.');
    L.push('');
    L.push('Why it matters to you: you want to feel ' + (w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0]) + '.');
    if ((hard.start || '').trim()) L.push('When you can’t get started, you said: “' + hard.start.trim() + '”');
    if ((hard.spark || '').trim()) L.push('What reminds you why it matters: “' + hard.spark.trim() + '”');
    L.push('');
    L.push('It might be tempting to let today slide. Showing up is the whole point, at whatever size you’ve got. Each time you do, you prove to yourself that you keep your word. That’s how self-trust is built, one day at a time, and how you become the person you want to be.');
    L.push('');
    L.push('Tick it off when you’re done: ' + APPLINK);
    return L.join('\n');
  }
  function calTimes() {
    var c = ui.cal || {}, start = c.start || todayStr(), d = start.replace(/-/g, ''), t = (c.time || '07:00').split(':');
    var st = d + 'T' + t[0].padStart(2, '0') + t[1].padStart(2, '0') + '00';
    var endMin = (+t[0]) * 60 + (+t[1]) + 15, endD = endMin >= 1440 ? addDays(start, 1).replace(/-/g, '') : d; endMin %= 1440;
    var en = endD + 'T' + String(Math.floor(endMin / 60)).padStart(2, '0') + String(endMin % 60).padStart(2, '0') + '00';
    var until = addDays(start, S.habit.length - 1).replace(/-/g, '') + 'T235959';
    var days = (S.settings.days || []).slice().sort(), BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    var rule = days.length && days.length < 7 ? 'FREQ=WEEKLY;BYDAY=' + days.map(function (x) { return BY[x]; }).join(',') + ';UNTIL=' + until : 'FREQ=DAILY;UNTIL=' + until;
    return { st: st, en: en, rule: rule };
  }
  function icsEsc(x) { return String(x).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  // Calendar lines must stay under 75 bytes; long ones carry on after a space.
  function icsFold(line) {
    var out = [], cur = '', n = 0, enc = window.TextEncoder ? new TextEncoder() : null;
    Array.from(line).forEach(function (ch) { var b = enc ? enc.encode(ch).length : 1; if (n + b > 73) { out.push(cur); cur = ' '; n = 1; } cur += ch; n += b; });
    out.push(cur); return out.join('\r\n');
  }
  function buildICS() {
    var t = calTimes(), now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Motivate Coaching//Lets Go//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + (S.habit.id || uuid()) + '@showup.motivate-coaching.com', 'DTSTAMP:' + now, 'DTSTART:' + t.st, 'DTEND:' + t.en, 'RRULE:' + t.rule,
      'SUMMARY:' + icsEsc('Let’s Go: ' + habitName()), 'DESCRIPTION:' + icsEsc(calDescription()), 'URL:' + APPLINK,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Time to show up: ' + habitName()), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }
  function downloadICS() {
    var ics = buildICS(), name = 'show-up-' + habitName().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '.ics';
    stat('calendar', 'ics'); window.__lastICS = ics;
    try {
      var file = new File([ics], name, { type: 'text/calendar' });
      if (/android/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(function () {}); return; }
    } catch (e) {}
    if (isIOS()) { window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Calendar file downloaded. Open it to add the reminder.');
  }
  function googleCalURL() {
    var t = calTimes();
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Let’s Go: ' + habitName()) + '&dates=' + t.st + '/' + t.en +
      '&details=' + encodeURIComponent(calDescription()) + '&recur=' + encodeURIComponent('RRULE:' + t.rule) + '&ctz=' + encodeURIComponent(S.settings.tz || 'UTC');
  }
  function daysPhrase() {
    var d = (S.settings.days || []).slice().sort(), N = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (d.length === 7 || !d.length) return 'Each day';
    if (d.join() === '1,2,3,4,5') return 'Each weekday';
    if (d.join() === '0,6') return 'Each weekend day';
    return 'On ' + d.map(function (x) { return N[x]; }).join(', ');
  }
  // The plan: their own answers, laid out simply, each one editable.
  function planCard(from) {
    var h = S.habit, less = h.mode === 'less', s = S.settings;
    var row = function (icon, label, body, edit) {
      return '<div class="prow"><span class="pic">' + icon + '</span><div class="pbody"><small>' + label + '</small>' + body + '</div>' + edit + '</div>';
    };
    var ed = '<button class="pedit" data-act="planedit">Edit</button>';
    var chips = '<div class="pchips">' + words().map(function (w, i) { return '<span' + (i === 0 ? ' class="first"' : '') + '>' + esc(w.toLowerCase()) + '</span>'; }).join('') + '</div>';
    if (S.settings.view === 'focus') {
      return '<div class="plancard">' + row(PICON.what, less ? 'I’m cutting back on' : 'I’m going to', '<b>' + esc(h.what) + '</b><span class="psub">' + daysPhrase() + '</span>', '') +
        (anchorLine(h) ? row(PICON.when, 'When', '<b>' + esc(anchorLine(h)) + '</b>', '') : '') +
        row(iconDown('#0F1215', 22), 'On a tough day', '<b>' + esc(h.dimmer) + '</b>', '') + '</div>' +
        '<button class="link" data-act="planedit" style="align-self:flex-start">Change my plan</button>';
    }
    var out = '<div class="plancard">' +
      row(PICON.what, less ? 'I’m cutting back on' : 'I’m going to', '<b>' + esc(h.what) + '</b><span class="psub">' + daysPhrase() + '</span>', ed) +
      row(PICON.why, less ? 'What I’m moving towards' : 'How I’ll feel', chips, ed);
    if (anchorLine(h)) out += row(PICON.when, less ? 'When it happens' : 'When', '<b>' + esc(anchorLine(h)) + '</b>', ed);
    if (less && (h.instead || '').trim()) out += row(PICON.swap, 'When the urge hits, I’ll', '<b>' + esc(h.instead) + '</b>', ed);
    out += row(iconDown('#0F1215', 22), 'On a tough day, I’ll turn it down to', '<b>' + esc(h.dimmer) + '</b>', ed) +
      row(PICON.when, 'For how long', '<b>' + h.length + ' days</b><span class="psub">Morning nudge at ' + esc(fmtTime(s.time)) + '</span>', '<button class="pedit" data-length="' + from + '">Change</button>') +
      '</div>';
    return out;
  }

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
    var dr = S.draft;
    S.habit = { id: uuid(), mode: dr.mode, what: dr.what.trim(), gives: dr.gives.concat((dr.driveOwn || '').trim() ? [dr.driveOwn.trim()] : []), instead: dr.instead, feel: dr.feel.slice(), ownFeel: dr.ownFeel, dimmer: dr.dimmer.trim(), length: dr.length, start: todayStr(), status: 'active', extra: Object.assign({ anchor: (dr.anchor || '').trim(), hard: { start: (dr.hardStart || '').trim(), off: (dr.hardOff || '').trim(), spark: (dr.hardSpark || '').trim() } }, dr.found ? { found: dr.found } : {}, S.wins && S.wins.length ? { wins: S.wins.slice() } : {}), createdAt: new Date().toISOString() };
    S.entries = {}; S.later = false; S.fb = {}; save();
    finishMoment();
  }
  // The end of setup: a proper moment, then their plan (peak-end rule).
  function finishMoment() {
    var el = document.createElement('div');
    el.className = 'celebrate finish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Your plan is ready');
    el.innerHTML = confettiHTML(70) +
      '<div class="burst"><span class="ring"></span><div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">Your plan is ready.</div><div class="s">' + esc(habitName()) + ', for ' + S.habit.length + ' days. In your words.</div></div>' +
      '<button class="btn" style="max-width:320px;background:var(--amber);color:var(--navy)" data-finish="1">See my plan</button>';
    buzz();
    app.appendChild(el);
    var done = function () { if (el.parentNode) { el.remove(); if (!user && sb) { ui.authFrom = 'plan'; ui.authStep = null; ui.returnTo = 'ready'; return go('sendplan'); } go('ready'); } };
    el.addEventListener('click', function (ev) { if (ev.target.closest('[data-finish]')) done(); });
    var b = el.querySelector('[data-finish]'); if (b) b.focus({ preventScroll: true });
  }
  function resetForNew() { S.habit = null; S.entries = {}; S.fb = {}; S.later = false; S.draft = fresh().draft; save(); go('landing'); }

  // ── Your data: download and delete ────────────────────────────────────────
  function exportData() {
    var out = { exported: new Date().toISOString(), app: 'Let’s Go', account: user ? user.email : null, name: S.settings.name || '', habit: S.habit, entries: S.entries, pastWins: S.wins || [], settings: S.settings };
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'show-up-my-data.json';
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
  // Paste the links in when they exist. Until then only Stuart sees this (so he can check it).
  var SUPPORT = {
    boosterMember: '',   // Calendly link for the 30-minute booster call, member price
    boosterStandard: '', // Calendly link for the 30-minute booster call, standard price
    priceMember: '£45', priceStandard: '£75',
    tlrJoin: '',         // The Living Room payment page
    tlrInfo: '',         // The Living Room landing page
    tlrPrice: ''         // e.g. '£XX a month'
  };
  function supportLive() { return !!(SUPPORT.boosterMember || SUPPORT.boosterStandard || SUPPORT.tlrJoin); }
  function supportCard() {
    if (!supportLive() && !isTester()) return '';
    var m = S.settings.tlrMember, h = '<div class="card soft supportcard"><span class="eyebrow">Want more support?</span>';
    if (m === undefined || m === null) {
      return h + '<span>Are you part of The Living Room?</span><div class="row" style="gap:10px;justify-content:flex-start"><button class="chip" data-act="tlrmember" data-v="yes">Yes</button><button class="chip" data-act="tlrmember" data-v="no">Not yet</button></div></div>';
    }
    h += '<button class="choice" data-act="booster"><b>Book a 30-minute booster call with Stu</b><small>Get back on track, one to one. ' + esc(m ? SUPPORT.priceMember + ' for members' : SUPPORT.priceStandard) + '</small></button>';
    if (!m) h += '<button class="choice" data-act="tlrbridge"><b>Join The Living Room</b><small>Ongoing support from Stu and people doing the same work.</small></button>';
    if (!supportLive()) h += '<span class="hint">Only you can see this until the links are added.</span>';
    return h + '</div>';
  }
  function openLink(url, what) {
    if (!url) return toast('Link coming soon.');
    stat('support', what); try { window.open(url, '_blank', 'noopener'); } catch (e) { location.href = url; }
  }
  function tlrBridge() {
    stat('support', 'tlr-bridge');
    var el = document.createElement('div'); el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-label="The Living Room"><div class="row" style="justify-content:space-between"><span class="eyebrow">Ongoing support</span><button class="link" data-c="close">Close</button></div>' +
      '<b style="font-family:var(--display);font-weight:400;font-size:28px;line-height:1.15">The Living Room (TLR)</b>' +
      '<p class="hint" style="margin:0">Stu’s coaching community, for people whose life works on paper but doesn’t quite feel like theirs.</p>' +
      '<ul class="tlrlist"><li>Regular live group sessions with Stu</li><li>A practical new tool for each theme</li><li>People doing the same work, so you’re not doing it alone</li></ul>' +
      (SUPPORT.tlrPrice ? '<p style="margin:0;font-weight:600">' + esc(SUPPORT.tlrPrice) + '</p>' : '') +
      '<p class="hint" style="margin:0">Try it for 30 days. If it’s not for you, email Stu and get every penny back.</p>' +
      '<button class="btn" data-c="join">Join now</button><button class="link center" data-c="info">Find out more first</button></div>';
    app.appendChild(el);
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-c]'); if (!b && ev.target !== el) return;
      el.remove(); if (!b) return;
      if (b.dataset.c === 'join') openLink(SUPPORT.tlrJoin, 'tlr-join');
      if (b.dataset.c === 'info') openLink(SUPPORT.tlrInfo, 'tlr-info');
    });
  }
  function confirmSheet(title, body, yes, fn) {
    var el = document.createElement('div'); el.className = 'sheet-bg';
    el.innerHTML = '<div class="sheet" role="dialog" aria-label="' + esc(title) + '"><b style="font-size:20px;font-weight:600">' + esc(title) + '</b><p class="hint">' + esc(body) + '</p><button class="btn" data-c="yes">' + esc(yes) + '</button><button class="link center" data-c="no">Cancel</button></div>';
    app.appendChild(el);
    el.addEventListener('click', function (ev) { var b = ev.target.closest('[data-c]'); if (!b && ev.target !== el) return; el.remove(); if (b && b.dataset.c === 'yes') fn(); });
  }

  async function saveReflect() {
    var q = ui.reflect, h = S.habit; if (!q || !q.next) return;
    h.extra = Object.assign({}, h.extra, { lookback: { noticed: q.noticed, next: q.next, at: new Date().toISOString() } });
    S.fb.reflect = true;
    if (q.pmf) void feedback('pmf', q.pmf);
    if (q.quote.trim()) void feedback(q.ok ? 'quote_ok' : 'quote_private', q.quote.trim());
    if (q.noticed.trim()) void feedback('noticed', q.noticed.trim());
    if (q.next === 'extend') { h.length = { 10: 30, 30: 60, 60: 90 }[h.length] || h.length; save(); toast('Keep going. ' + h.length + ' days it is.'); return go('tracker'); }
    h.status = 'complete'; save();
    if (q.next === 'new') { if (user) await syncAll(); h.status = 'archived'; save(); if (user) await syncAll(); return resetForNew(); }
    toast('Saved. Well done for giving it a proper go.'); go('tracker');
  }

  // Guest sign-in: lets the AI ideas run (and stay rate-limited per person) without asking for an email yet.
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
    if (S.habit && ui.authFrom === 'plan') body.plan = { what: habitName(), anchor: anchorLine(), dimmer: S.habit.dimmer || '', length: S.habit.length, mode: S.habit.mode, name: firstName() || '' };
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
  if (S.habit && ['landing', 'what', 'when', 'less', 'feel', 'dimmer', 'hard', 'find', 'name', 'viewpick'].indexOf(S.screen) >= 0) S.screen = 'tracker';
  if (!S.habit && ['tracker', 'note', 'share', 'slipped', 'reflect', 'edit', 'settings'].indexOf(S.screen) >= 0) S.screen = 'landing';
  ui.authStep = null;
  if (['account', 'install', 'length', 'words', 'calendar'].indexOf(S.screen) >= 0) S.screen = S.habit ? 'tracker' : 'landing';
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
  window.__showupShift = function (days) { if (S.habit) { S.habit.start = addDays(S.habit.start, -days); save(); render(); } };
})();
