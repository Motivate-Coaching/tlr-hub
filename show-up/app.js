/* Show Up: habit tracker web app (pilot).
   Works signed out first (saved on this device), then saves to Supabase once signed in.
   Same Supabase project as TLR Hub; the anon key is public by design. */
(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  var SUPABASE_URL = 'https://tsusrzkpzevpiuvsppls.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdXNyemtwemV2cGl1dnNwcGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAzMzUsImV4cCI6MjEwMTMxNjMzNX0.UQD9BaOjYWNOEVeV3QCF2sdlNc9SYJ2PrcZgpCtlQ8s';
  // Public half of the phone-notification key pair (the private half lives only in Supabase secrets).
  var VAPID_PUBLIC = 'BHJYn9pn53bnDmtHCvr-ysfBqueL-9zH4_0hvmPRvgpEBhfLeNxBeuBOSgCKiGzar2NOPyghfanKgdud1DbxjOk';
  var KEY = 'showup-v1';
  var ADMIN_EMAIL = 'stuart.fairbairns@gmail.com';

  var sb = null;
  try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch (e) { sb = null; }

  // ── Content ───────────────────────────────────────────────────────────────
  var FEELINGS = ['Proud', 'Strong', 'Calm', 'Alive', 'Like I trust myself', 'Free', 'Clear-headed', 'Like me again', 'Lighter', 'In control', 'Grounded', 'Brave'];
  var GIVES = ['A reward', 'Comfort', 'A break', 'Switching off', 'Energy', 'Something to do'];
  // For cutting back: what you're moving towards (outcomes and feelings together).
  var GAINS = ['Better sleep', 'More energy', 'Better health', 'Lighter', 'Clear-headed', 'In control', 'Proud', 'Calm', 'Money saved', 'Like me again', 'Free', 'More present'];
  var STARTERS_MORE = ['A 10 minute walk', 'Read before bed', 'In bed by 10:30', 'Drink more water'];
  var STARTERS_LESS = ['Phone in bed', 'Afternoon snacking', 'Wine on weeknights', 'Mindless scrolling'];
  var IDEAS = [
    ['A 10 minute walk after lunch', 'Health'], ['In bed by 10:30 on work nights', 'Rest'],
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
      draft: { mode: 'more', what: '', gives: [], instead: '', feel: [], ownFeel: '', dimmer: '', length: 30 },
      habit: null, // { id, mode, what, gives, instead, feel, ownFeel, dimmer, length, start, status, createdAt }
      entries: {}, // day -> { kind, comeback, felt, note, at }
      settings: { tz: tzGuess(), time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], email: true, push: false, pausedUntil: null, view: 'full', text: 'standard', calm: false, buzz: true, marketing: false, name: '' },
      fb: {}, later: false, installDismissed: false, updatedAt: 0
    };
  }
  var S = fresh();
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') { S = Object.assign(fresh(), saved); S.settings = Object.assign(fresh().settings, saved.settings || {}); S.draft = Object.assign(fresh().draft, saved.draft || {}); } } catch (e) {}
  var user = null; // signed-in Supabase user
  var syncState = 'local'; // local | saving | saved | error
  var ui = { ideasOpen: false, wordsFrom: null, returnTo: null, authMode: null, moreChips: false };

  function save(touch) { if (touch !== false) S.updatedAt = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} if (user) queueSync(); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  var view = document.getElementById('view');
  var app = document.getElementById('app');
  var backBtn = document.getElementById('back');
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
  function steps() { return S.draft.mode === 'less' ? ['what', 'feel', 'less', 'dimmer'] : ['what', 'feel', 'dimmer']; }
  var STEP_LABEL = { what: 'Your habit', less: 'What you’ll do instead', feel: 'How it’ll feel', dimmer: 'Your tough-day plan' };
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
  function toast(msg) { var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg; app.appendChild(el); setTimeout(function () { el.remove(); }, 2800); }
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
      }
      if (S.habit && h.data && S.habit.id === h.data.id) {
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
    what: 'landing', less: 'feel', feel: 'what', dimmer: function () { return S.draft.mode === 'less' ? 'less' : 'feel'; },
    length: function () { return ui.returnTo || 'ready'; }, note: 'tracker', slipped: 'tracker', share: 'tracker', science: function () { return S.habit ? 'settings' : 'landing'; },
    words: function () { return ui.wordsFrom || 'tracker'; }, settings: 'tracker', edit: function () { return ui.returnTo || 'settings'; }, plan: 'tracker', reflect: 'tracker', install: 'settings', account: function () { return ui.returnTo || 'tracker'; }
  };

  function todayCard(name, line, done, decorative, id) {
    return '<div class="today-card"' + (decorative ? ' aria-hidden="true"' : '') + '><div class="txt"><span class="eyebrow" style="font-size:12px">Today</span>' +
      '<span class="name"' + (id ? ' id="' + id + '"' : '') + '>' + esc(name) + '</span><span class="line">' + esc(line) + '</span></div>' +
      '<span class="disc' + (done ? '' : ' open') + '">' + (done ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + '</span></div>';
  }

  var screens = {
    landing: function () {
      return '<section class="screen landing">' +
        '<h1>Build a habit that sticks.</h1>' +
        '<p class="sub">Or break one that doesn’t.</p>' +
        '<p class="sub2">One minute to set up, one tap a day.</p>' +
        '<div class="full-only">' + todayCard('Morning walk', 'Day 12 · Felt proud', true, true) + '</div>' +
        '<ul class="points full-only">' +
        '<li><b>Plan for the tough days</b><span>One bad day never ends it.</span></li>' +
        '<li><b>Miss a day, lose nothing</b><span>Nothing resets. Comebacks count.</span></li>' +
        '<li><b>See it working</b><span>A morning nudge, then one quick tick.</span></li>' +
        '</ul>' +
        '<div class="spacer"></div><div class="btns"><button class="btn" data-start="more">Build a habit</button>' +
        '<button class="btn outline" data-start="less">Break a habit</button></div>' +
        '<p class="byline">No sign-up to start. Created by Stuart Fairbairns PCC, using <button class="link inline" data-go="science">proven behaviour science</button>.</p>' +
        (user ? '' : '<button class="link center" data-account="landing" style="margin-top:-12px">Already started? Sign in</button>') + '</section>';
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
        '<div class="full-only" id="previewWrap" style="flex-direction:column;gap:8px;display:' + (d.what.trim() ? 'flex' : 'none') + '"><span class="eyebrow">Your tracker</span>' + todayCard(d.what.trim() || 'Your habit', 'Day 1 · Today', false, false, 'previewName') + '</div>' +
        '<div class="spacer"></div>' + stepButton('what') + '</section>' +
        (ui.ideasOpen ? ideasSheet() : '');
    },
    less: function () {
      var d = S.draft;
      var gives = '<span class="label">It usually gives me...</span><div class="chips" style="margin-top:8px">' +
        GIVES.map(function (g) { return '<button class="chip" data-give="' + esc(g) + '" aria-pressed="' + (d.gives.indexOf(g) >= 0) + '">' + esc(g) + '</button>'; }).join('') + '</div>';
      return '<section class="screen">' + progress('less') + '<h1>When it pulls at you, what will you do instead?</h1>' +
        '<p class="lede full-only">No judgement. It’s there for a reason.</p>' +
        optional('What does it usually give you?', gives) +
        '<div class="field"><label class="label" for="instead">Instead, I’ll...</label>' +
        '<textarea id="instead" rows="1" data-bind="instead" placeholder="Go for a 20 minute walk and make a proper cup of tea">' + esc(d.instead) + '</textarea>' +
        '<span class="hint full-only">Something that gives you some of the same, and moves you towards what you want.</span></div>' +
        optional('See how the swap works', loopCard()) +
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
        '<p class="lede"><span class="full-only">Nobody’s consistent every day. Deciding now what you’ll do on the tough days is what keeps you going.</span><span class="focus-only">A plan for tough days keeps you going.</span></p>' +
        '<p class="hint full-only" style="margin-top:-12px">Turn it down, don’t switch it off. Some days a 10, some days a 1. Both count.</p>' +
        '<div class="field"><label class="label" for="dim">On a tough day, I’ll...</label>' +
        '<textarea id="dim" rows="1" data-bind="dimmer" placeholder="' + (less ? 'Have one block of chocolate, not the whole bar' : 'A quick dip, or a cold shower at home') + '">' + esc(d.dimmer) + '</textarea></div>' +
        optional('Show me examples', '<div class="card small">' +
        (less ? '<span>Chocolate? <b>One block, not the whole bar.</b></span><span>Wine on weeknights? <b>One small glass, or something fizzy instead.</b></span><span>Your instead? <b>Five minutes of it, not the full twenty.</b></span>'
          : '<span>A gym session? <b>A shorter workout, a brisk walk, or kit on and a stretch.</b></span><span>Reading 10 pages? <b>Five pages, one page, or one paragraph.</b></span><span>A cold sea swim? <b>A quick dip, feet in, or a cold shower at home.</b></span>') + '</div>') +
        '<div class="spacer"></div>' + stepButton('dimmer') + '</section>';
    },
    ready: function () {
      var ticked = !!S.entries[1];
      var h = '<section class="screen"><div><div class="eyebrow">Your plan is ready</div><h1>Here’s your plan.</h1></div>' + planCard('ready');
      if (!ticked) {
        h += '<div class="card"><b style="font-size:20px;font-weight:600">' + (S.habit.mode === 'less' ? 'Kept to it today?' : 'Done it today?') + '</b><span style="color:var(--text-mid)">If you have, tick day one now. Starting counts.</span>' +
          '<button class="btn" data-tick="full">' + checkIcon('#FFFFFF') + 'Tick day one</button>' +
          (S.later ? '<p style="margin:0;text-align:center">Lovely. Day one is tomorrow.</p>' : '<button class="link center" data-act="later">I’ll start tomorrow</button>') + '</div>';
      } else {
        var e = S.entries[1];
        h += '<div class="card" style="flex-direction:row;align-items:center;gap:14px"><span class="bigstar" style="width:32px;height:32px"></span>' +
          '<span><b>Day one, done' + (e.felt && e.felt !== 'Honestly, tough' ? '. ' + esc(e.felt) : '') + '.</b> You’ve started, and that’s the hardest bit.</span></div>';
      }
      if (!user && (ticked || S.later)) {
        h += '<div class="card"><b style="font-size:18px;font-weight:600">Keep your progress safe</b><span style="color:var(--text-mid)">Sign in so nothing is lost, your morning nudge can find you, and you can use it on any device.</span>' +
          '<button class="btn outline" data-account="ready">Save to my account</button></div>';
      }
      h += '<div class="field"><label class="label" for="pname">What should we call you?</label><textarea id="pname" rows="1" data-name="1" autocomplete="given-name" placeholder="Your first name">' + esc(firstName()) + '</textarea></div>' +
        nextNudge() +
        '<div class="spacer"></div><button class="btn" data-go="tracker">Go to my tracker</button><button class="link center full-only" data-words="ready">See my words</button></section>';
      return h;
    },
    plan: function () {
      if (!S.habit) return screens.landing();
      return '<section class="screen"><div><div class="eyebrow">My plan</div><h1>' + esc(habitName()) + '</h1></div>' + planCard('plan') +
        '<p class="hint">Change anything, any time. Your ticks stay as they are.</p>' +
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
      var h = '<section class="screen" style="gap:16px"><div><div class="row"><span class="eyebrow">My habit</span><button class="plan-link" data-go="plan">' + iconPlan() + 'My plan</button></div><h1>' + esc(habitName()) + '</h1>' +
        '<div style="color:var(--text-mid)">' + (t > L ? 'All ' + L + ' days · complete' : 'Day ' + t + ' of ' + L) + '</div></div>';
      h += '<div class="card" style="padding:16px">' + gridHTML(t) + '<div class="legend"><span><i style="background:var(--navy)"></i>Full on</span><span><i style="background:var(--muted)"></i>Turned down</span><span><span class="star"></span>Got back up</span></div></div>';
      if (t > L) {
        h += '<div class="card"><b style="font-size:20px;font-weight:600">You gave it ' + L + ' days.</b><span style="color:var(--text-mid)">Time for your look back: what you noticed, and what’s next. Your call.</span><button class="btn" data-go="reflect">Start my look back</button></div>';
      } else if (!e) {
        h += '<div style="display:flex;flex-direction:column;gap:8px"><b style="font-weight:600">' + (S.habit.mode === 'less' ? 'Kept to it today?' : 'Showed up today?') + '</b><div class="tick-row">' +
          '<button class="btn" data-tick="full">' + iconFull('#FFFFFF', 16) + (S.habit.mode === 'less' ? 'Kept to it' : 'Full on') + '</button>' +
          '<button class="btn grey" data-tick="dimmer">' + iconDown('#0F1215', 16) + 'Turned down</button>' +
          '<button class="note-btn" data-go="note" aria-label="Add a note">' + pencil() + '</button></div></div>';
      } else {
        h += '<div class="done"><span class="bigstar"></span><span class="msg">' + esc(doneMsg(e)) + '</span><button data-go="note">' + (e.note ? 'Edit note' : 'Add a note') + '</button></div>' +
          '<button class="link center" data-act="undo" style="margin-top:-10px;font-size:14px;font-weight:500">Tapped by mistake? Undo today</button>';
        if (t === L && !S.fb.reflect) h += '<div class="card soft"><b style="font-weight:600">That’s your last day.</b><button class="btn" data-go="reflect">Start my look back</button></div>';
      }
      h += extraCards(t);
      var felt = {}; Object.keys(S.entries).forEach(function (k) { var f = S.entries[k].felt; if (f && f !== 'Honestly, tough') felt[f] = (felt[f] || 0) + 1; });
      var top = Object.keys(felt).sort(function (a, b) { return felt[b] - felt[a]; })[0];
      h += '<div class="statline"><div><b>' + count(function () { return true; }) + '</b><small>Show-ups</small></div>' +
        '<div><b>' + count(function (x) { return x.kind === 'dimmer'; }) + '</b><small>Turned down</small></div>' +
        '<div><b>' + count(function (x) { return x.comeback; }) + '</b><small>Comebacks</small></div></div>' +
        (top ? '<p class="felt-line">Most often you’ve felt <b>' + esc(top.toLowerCase()) + '</b>.</p>' : '');
      h += '<button class="btn outline" data-go="share">Share my progress</button>' +
        '<div class="row" style="justify-content:center;flex-wrap:wrap;gap:4px 16px"><button class="link" data-words="tracker">My words</button><button class="link" data-go="slipped">Slipped off track?</button>' +
        '</div></section>';
      return h;
    },
    note: function () {
      var t = todayNum(), e = S.entries[t] || {};
      return '<section class="screen"><div><div class="eyebrow">Day ' + t + '</div><h1>How did it go?</h1></div>' +
        '<div class="field"><label class="label" for="note">A word or a paragraph. Whatever’s true today.</label>' +
        '<textarea id="note" rows="3" style="min-height:120px">' + esc(e.note || '') + '</textarea></div>' +
        '<p class="hint">Your notes are only ever seen by you, unless you choose to share one.</p>' +
        '<div class="spacer"></div><button class="btn" data-act="savenote">Save note</button></section>';
    },
    slipped: function () {
      var h = S.habit;
      return '<section class="screen"><h1>Hey. It happens.</h1><p class="lede">Falling off isn’t the end of anything. Getting back on is where the real work lives.</p>' +
        '<div class="card"><div class="eyebrow">What you told yourself on day one</div>' +
        '<div><div class="hint">' + (h.mode === 'less' ? 'You’re moving towards' : 'You want to feel') + '</div><div style="font-weight:600">' + esc(words().join(', ')) + '</div></div>' +
        (h.mode === 'less' && (h.instead || '').trim() ? '<div><div class="hint">When it pulls at you</div><div style="font-weight:600">' + esc(h.instead) + '</div></div>' : '') +
        '<div><div class="hint">On a tough day</div><div style="font-weight:600">' + esc(h.dimmer || 'Your turned-down version') + '</div></div></div>' +
        '<div class="card soft small"><span>Today doesn’t need to be a 10. Turned down still counts as showing up.</span></div>' +
        '<div class="spacer"></div>' + (S.entries[todayNum()] ? '<p style="margin:0;text-align:center">You’ve already shown up today.</p>' :
        '<button class="btn" data-tick="full" data-from="slipped"><span class="star" style="margin:0"></span>I’m back. Count me in today</button><button class="btn grey" data-tick="dimmer" data-from="slipped">Back, turned down</button>') + '</section>';
    },
    share: function () {
      var t = Math.min(todayNum(), S.habit.length), e = S.entries[todayNum()] || {};
      return '<section class="screen"><h1>Share your progress</h1><p class="lede">People who share how they’re getting on tend to keep going. This is what others will see.</p>' +
        '<div class="sharecard" id="sharecard"><div class="head"><span class="eyebrow" style="color:var(--cream-dark)">Day ' + t + ' of ' + S.habit.length + '</span><img src="logo-white.png" alt="The Living Room (TLR), Tools for life"></div>' +
        '<h2>' + esc(habitName()) + '</h2>' + gridHTML(todayNum()) +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;color:var(--cream-dark);font-size:14px"><span>' + count(function () { return true; }) + ' show-ups</span><span>Feeling: ' + esc(words().slice(0, 2).join(', ').toLowerCase()) + '</span></div>' +
        (e.note && ui.shareNote ? '<div class="note">“' + esc(e.note) + '”</div>' : '') + '</div>' +
        (e.note ? '<button class="switch" role="switch" aria-checked="' + !!ui.shareNote + '" data-act="sharenote"><span><b>Include today’s note</b><span class="hint">Off unless you choose it.</span></span><span class="track"></span></button>' : '') +
        '<button class="btn" data-act="shareimg">Share my card</button>' +
        '<button class="btn outline" data-act="whatsapp">Send on WhatsApp</button>' +
        '<p class="hint">To post in the Members Lounge, tap Share my card, choose Facebook, then pick the group.</p></section>';
    },
    words: function () {
      var w = words();
      var h = '<section class="screen"><h1>Your words</h1><p class="lede">Spin it with your finger. Tap any word.</p><div class="sphere" id="sphere"><button class="core" data-act="whole">' + esc(habitName()) + '</button>';
      w.forEach(function (x, i) { h += '<button class="w" data-word="' + i + '">' + esc(x.toLowerCase()) + '</button>'; });
      return h + '</div><div id="wordcard"></div></section>';
    },
    reflect: function () {
      var L = S.habit.length, n = count(function () { return true; }), next = { 10: 30, 30: 60, 60: 90 }[L];
      var q = ui.reflect || (ui.reflect = { noticed: '', next: '', pmf: '', quote: '', ok: false });
      var h = '<section class="screen"><div><div class="eyebrow">Your look back</div><h1>' + L + ' days. ' + n + ' show-ups.</h1></div>' +
        '<p class="lede">No marks out of ten. Just what you noticed.</p>' +
        '<div class="field"><label class="label" for="noticed">What did you notice?</label><textarea id="noticed" rows="2" data-rbind="noticed" placeholder="About the habit, about you, about your days">' + esc(q.noticed) + '</textarea></div>' +
        '<div class="field"><span class="label">What’s next?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        (next ? '<button class="choice" data-rnext="extend" aria-pressed="' + (q.next === 'extend') + '"><b>Keep going</b><small>Carry on to ' + next + ' days, with everything you’ve done so far</small></button>' : '') +
        '<button class="choice" data-rnext="new" aria-pressed="' + (q.next === 'new') + '"><b>Try something new</b><small>Start a fresh habit</small></button>' +
        '<button class="choice" data-rnext="done" aria-pressed="' + (q.next === 'done') + '"><b>Stop here</b><small>That’s a perfectly good answer too</small></button></div></div>' +
        '<div class="card"><span class="eyebrow">Helping Stuart improve this</span><span class="label">How would you feel if you could no longer use this?</span><div style="display:flex;flex-direction:column;gap:8px">' +
        ['Very disappointed', 'Somewhat disappointed', 'Not disappointed'].map(function (o) { return '<button class="chip" style="text-align:left" data-rpmf="' + o + '" aria-pressed="' + (q.pmf === o) + '">' + o + '</button>'; }).join('') + '</div>' +
        '<div class="field"><label class="label" for="quote">In a sentence, what would you tell a friend about it?</label><textarea id="quote" rows="1" data-rbind="quote">' + esc(q.quote) + '</textarea></div>' +
        '<button class="switch" role="switch" aria-checked="' + q.ok + '" data-act="quoteok"><span><b>Happy for Stuart to share that</b><span class="hint">With your first name only.</span></span><span class="track"></span></button></div>' +
        '<div class="spacer"></div><button class="btn" data-act="savereflect" ' + (q.next ? '' : 'disabled') + '>Save my look back</button></section>';
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
      var h = '<section class="screen"><h1>Settings</h1><p class="lede" id="syncStatus">' + syncLabel() + '</p>';
      if (user) h += '<div class="card soft small"><b style="font-weight:600">You’re a founding tester.</b><span>Thank you for helping shape this. Anything confusing or brilliant, tell Stuart.</span></div>';
      // View
      h += '<div class="card"><span class="eyebrow">How it looks</span><div class="choices">' +
        '<button class="choice" data-view="full" aria-pressed="' + (s.view === 'full') + '"><b>Full</b><small>Everything on one page</small></button>' +
        '<button class="choice" data-view="focus" aria-pressed="' + (s.view === 'focus') + '"><b>Focus</b><small>Just today’s one thing</small></button></div>' +
        '<span class="label">Text size</span><div class="chips">' + [['standard', 'Standard'], ['large', 'Large'], ['larger', 'Larger']].map(function (o) { return '<button class="chip" data-text="' + o[0] + '" aria-pressed="' + (s.text === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        (s.view === 'focus' ? '<p class="hint">Focus keeps screens still and calm.</p>' : '<button class="switch" role="switch" aria-checked="' + !!s.calm + '" data-toggle="calm"><span><b>Less movement</b><span class="hint">Calmer screens, no animation.</span></span><span class="track"></span></button>') +
        '<button class="switch" role="switch" aria-checked="' + !!s.buzz + '" data-toggle="buzz"><span><b>Buzz when I tick</b><span class="hint">On phones that support it.</span></span><span class="track"></span></button></div>';
      // Reminders
      h += '<div class="card" id="reminders"><span class="eyebrow">Morning nudge</span>' +
        '<div class="field"><label class="label" for="rtime">What time?</label><input class="input" id="rtime" type="time" step="900" value="' + esc(s.time) + '" style="max-width:200px"></div>' +
        '<span class="label full-only">Which days?</span><div class="days full-only">' + DAY_NAMES.map(function (n, i) { return '<button class="chip" data-rday="' + i + '" aria-pressed="' + (s.days.indexOf(i) >= 0) + '" aria-label="' + DAY_LABELS[i] + '">' + n + '</button>'; }).join('') + '</div>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.email + '" data-toggle="email"><span><b>Email</b><span class="hint">' + (user ? 'To ' + esc(user.email) : 'Sign in to switch this on') + '</span></span><span class="track"></span></button>' +
        '<button class="switch" role="switch" aria-checked="' + !!s.push + '" data-act="push"><span><b>Phone notification</b><span class="hint" id="pushHint">' + pushHint() + '</span></span><span class="track"></span></button>' +
        '<div class="divider"></div><span class="label">Need a break?</span>' +
        (s.pausedUntil && s.pausedUntil >= todayStr() ? '<div class="row"><span>Nudges paused until ' + esc(prettyDate(s.pausedUntil)) + '.</span><button class="chip" data-pause="0">Resume</button></div>' :
          '<div class="chips">' + [[1, 'Tomorrow'], [3, '3 days'], [7, '7 days']].map(function (o) { return '<button class="chip" data-pause="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>') +
        '<p class="hint">Nudges skip any day you’ve already ticked, and pausing never touches your progress.</p></div>';
      var focusMode = s.view === 'focus';
      if (focusMode) h += '<details class="ask"><summary>More settings</summary><div style="display:flex;flex-direction:column;gap:22px">';
      // Habit
      if (S.habit) h += '<div class="card"><span class="eyebrow">My habit</span><b style="font-weight:600;font-size:18px">' + esc(habitName()) + '</b>' +
        '<button class="btn outline" data-go="plan">See my plan</button>' +
        '<button class="btn outline" data-edit="settings">Edit my habit and words</button>' +
        '<button class="btn outline" data-length="settings">Length: ' + S.habit.length + ' days</button>' +
        '<button class="link" data-act="newhabit">Start a new habit</button></div>';
      // Install
      h += '<div class="card"><span class="eyebrow">On your home screen</span>' + (isStandalone() ? '<span>It’s installed. Nice.</span>' : '<span>Put it on your home screen or desktop so it opens like an app.</span><button class="btn outline" data-act="install">Show me how</button>') + '</div>';
      // Account
      h += '<div class="card"><span class="eyebrow">Account and privacy</span>' +
        '<div class="field"><label class="label" for="sname">Your first name</label><textarea id="sname" rows="1" data-name="1" autocomplete="given-name" placeholder="So we can say hello">' + esc(firstName()) + '</textarea></div>' +
        (user ? '<span>Signed in as <b>' + esc(user.email) + '</b></span>' : '<span>Not signed in. Your progress is saved on this device only.</span><button class="btn" data-account="settings">Sign in to save</button>') +
        '<p class="hint">Your notes are only ever seen by you. During the pilot, Stuart sees how often people show up and any feedback you send, never your notes.</p>' +
        (user ? '<button class="switch" role="switch" aria-checked="' + !!s.marketing + '" data-toggle="marketing"><span><b>Ideas and updates from Stuart</b><span class="hint">Occasional emails. Off unless you choose.</span></span><span class="track"></span></button><button class="link" data-act="signout">Sign out</button>' : '') +
        '</div>' + (focusMode ? '</div></details>' : '') + '<button class="link center" data-go="science">The science behind it</button>' + '<a class="link center tlr-link" href="https://www.motivate-coaching.com/thelivingroom" target="_blank" rel="noopener">About The Living Room (TLR) <span aria-hidden="true">↗</span><span class="sr"> (opens in a new tab)</span></a>' + '</section>';
      return h;
    },
    edit: function () {
      var h = S.habit;
      var w = '<section class="screen"><h1>Edit my habit</h1>' +
        '<div class="field"><label class="label" for="ewhat">' + (h.mode === 'less' ? 'I’m cutting back on...' : 'I’m going to...') + '</label><textarea id="ewhat" rows="1" data-hbind="what">' + esc(h.what) + '</textarea></div>' +
        '<div class="field"><label class="label" for="edim">On a tough day, I’ll...</label><textarea id="edim" rows="1" data-hbind="dimmer">' + esc(h.dimmer) + '</textarea></div>' +
        (h.mode === 'less' ? '<div class="field"><label class="label" for="einst">When it pulls at me, I’ll...</label><textarea id="einst" rows="1" data-hbind="instead">' + esc(h.instead) + '</textarea></div>' : '') +
        '<span class="label">' + (h.mode === 'less' ? 'What I’m moving towards' : 'How I’ll feel') + '</span><div class="chips">';
      (h.mode === 'less' ? GAINS : FEELINGS).forEach(function (f) { w += '<button class="chip" data-hfeel="' + esc(f) + '" aria-pressed="' + (h.feel.indexOf(f) >= 0) + '">' + esc(f) + '</button>'; });
      return w + '</div><div class="field"><label class="label" for="eown">My own words</label><textarea id="eown" rows="1" data-hbind="ownFeel" placeholder="Separate with commas">' + esc(h.ownFeel) + '</textarea></div>' +
        '<div class="spacer"></div><button class="btn" data-back="1">Done</button></section>';
    },
    install: function () {
      var how;
      if (isIOS()) how = '<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open it from your home screen. Phone notifications work from there.</li></ol>';
      else if (deferredInstall) how = '<span>One tap and it’s on your ' + (/android/i.test(navigator.userAgent) ? 'home screen' : 'desktop') + '.</span><button class="btn" data-act="doinstall">Install</button>';
      else how = '<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:10px"><li>Open your browser menu (the three dots or the share button).</li><li>Choose <b>Install app</b> or <b>Add to Home Screen</b>.</li></ol>';
      return '<section class="screen"><h1>Put it on your home screen</h1><p class="lede">It opens like an app, with its own icon, on your phone, tablet or computer.</p><div class="card">' + how + '</div></section>';
    },
    account: function () {
      var m = ui.authMode || 'signin';
      return '<section class="screen"><h1>' + 'Save to my account' + '</h1>' +
        '<p class="lede">During the pilot, sign in with the email and password you use for The Living Room (TLR) Hub. Anything you’ve done on this device comes with you.</p>' +
        '<div class="field"><label class="label" for="aemail">Email</label><input class="input" id="aemail" type="email" autocomplete="email" inputmode="email"></div>' +
        '<div class="field"><label class="label" for="apass">Password</label><input class="input" id="apass" type="password" autocomplete="current-password"></div>' +
        '<p class="err" id="aerr" hidden></p>' +
        '<button class="btn" data-act="signin">Sign in</button>' +
        '<a class="link center" href="../login.html" style="display:flex;align-items:center">Forgotten your password?</a>' +
        '<p class="hint">Not a member yet? The pilot is for members for now. You can still use it on this device without signing in.</p></section>';
    }
  };

  function focusTracker() {
    var t = todayNum(), L = S.habit.length, e = S.entries[t], less = S.habit.mode === 'less';
    var h = '<section class="screen focus"><div class="row" style="justify-content:flex-end;margin-bottom:-12px"><button class="plan-link" data-go="plan">' + iconPlan() + 'My plan</button></div><h1 style="text-align:center">' + esc(habitName()) + '</h1>' + ring(t, L) +
      '<p class="hint" style="text-align:center;margin-top:-12px">' + (t > L ? 'All ' + L + ' days done' : 'Day ' + t + ' of ' + L) + '</p>';
    if (t > L) h += '<div class="big"><button class="btn" data-go="reflect">Start my look back</button></div>';
    else if (!e) h += '<div class="big"><button class="btn" data-tick="full">' + iconFull('#FFFFFF') + (less ? 'Kept to it' : 'Full on') + '</button>' +
      '<button class="btn grey" data-tick="dimmer">' + iconDown('#0F1215') + 'Turned down</button></div>' +
      '<div class="plan">' + iconDown('#888880', 32) + '<div><small>Tough day? Turn it down to</small><b>' + esc(S.habit.dimmer) + '</b></div></div>';
    else h += '<div class="done"><span class="bigstar"></span><span class="msg">' + esc(doneMsg(e)) + '</span><button data-go="note">' + (e.note ? 'Edit note' : 'Note') + '</button></div>' + nextNudge();
    h += '<details class="ask" style="align-self:center"><summary>See all my days</summary><div class="card" style="padding:16px">' + gridHTML(t) + '</div></details>';
    return h + '<div class="spacer"></div></section>';
  }

  function extraCards(t) {
    var h = '';
    if (t >= 3 && !S.fb.day3 && t <= S.habit.length) {
      h += '<div class="card soft"><span class="eyebrow">Quick one for Stuart</span><label class="label" for="fb3">Anything confusing or annoying so far?</label><textarea id="fb3" rows="1" placeholder="Nothing is fine too"></textarea>' +
        '<div class="row"><button class="link" data-act="fb3skip">Skip</button><button class="chip" data-act="fb3send" style="background:var(--navy);color:var(--white);border-color:var(--navy);font-weight:600">Send</button></div></div>';
    } else if (t >= 2 && !isStandalone() && !S.installDismissed) {
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
  function gridHTML(t) {
    var h = '<div class="grid">';
    for (var n = 1; n <= S.habit.length; n++) {
      var e = S.entries[n], c = 'day';
      if (e) c += ' ' + e.kind + (e.comeback ? ' comeback' : '');
      else if (n < t) c += ' missed';
      else if (n === t) c += ' today';
      h += '<span class="' + c + '">' + n + '</span>';
    }
    return h + '</div>';
  }
  function doneMsg(e) {
    if (e.felt === 'Honestly, tough') return 'Tough one, and you still showed up. Logged.';
    var total = count(function () { return true; }) + ' show-up' + (count(function () { return true; }) === 1 ? '' : 's');
    if (e.felt) return e.felt + '. Logged. That’s ' + total + '.';
    return (e.kind === 'dimmer' ? 'Turned down, still counts. ' : 'Done. ') + 'That’s ' + total + '.';
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
    document.querySelectorAll('#viewbar [data-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === S.settings.view)); });
    view.innerHTML = screens[s]();
    backBtn.classList.toggle('ghost', !BACK[s]);
    settingsBtn.classList.toggle('ghost', !S.habit || s === 'settings' || ['what', 'less', 'feel', 'dimmer'].indexOf(s) >= 0);
    view.querySelectorAll('textarea').forEach(grow);
    if (s === 'words') startSphere();
    window.scrollTo(0, 0);
  }
  function go(s) { S.screen = s; save(false); render(); }
  function goBack() { var b = BACK[S.screen]; if (typeof b === 'function') b = b(); go(b || (S.habit ? 'tracker' : 'landing')); }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 3, 58) + 'px'; }

  // ── The tick ──────────────────────────────────────────────────────────────
  function tick(kind, from) {
    if (notStarted()) { S.habit.start = todayStr(); S.later = false; }
    var t = todayNum();
    if (S.entries[t]) return;
    var prev = t > 1 && !S.entries[t - 1];
    S.entries[t] = { kind: kind, comeback: prev && count(function () { return true; }) > 0, at: new Date().toISOString() };
    save(); buzz();
    var title = t === 1 ? 'Day one. Done.' : (kind === 'dimmer' ? 'Day ' + t + '. Still counts.' : 'Day ' + t + '. Done.');
    var n = count(function () { return true; });
    var sub = S.entries[t].comeback ? 'You got back up. That’s the real work.' : (t === 1 ? 'You’ve started. That’s the hardest bit.' : (kind === 'dimmer' ? 'Turned down is still showing up.' : 'That’s ' + n + ' show-ups.'));
    var sparks = ''; for (var i = 0; i < 10; i++) sparks += '<span class="spark" style="transform:rotate(' + (i * 36) + 'deg)"><i style="animation-delay:' + (180 + (i % 3) * 40) + 'ms"></i></span>';
    var el = document.createElement('div');
    el.className = 'celebrate'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Day logged');
    el.innerHTML = '<div class="burst"><span class="ring"></span>' + sparks + '<div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">' + title + '</div><div class="s">' + sub + '</div></div><div id="ask"></div>';
    app.appendChild(el);
    setTimeout(function () {
      var ask = el.querySelector('#ask'); if (!ask) return;
      var h = '<div class="ask"><span class="eyebrow">How did it feel?</span><div class="chips" style="justify-content:center">';
      words().slice(0, 3).concat(['Honestly, tough']).forEach(function (w) { h += '<button class="chip" data-felt="' + esc(w) + '">' + esc(w) + '</button>'; });
      ask.innerHTML = h + '</div><button class="skip" data-felt="">Skip</button></div>';
      var first = ask.querySelector('button'); if (first) first.focus({ preventScroll: true });
    }, S.settings.calm ? 300 : 1150);
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-felt]'); if (!b) return;
      if (b.dataset.felt) S.entries[t].felt = b.dataset.felt;
      save(); el.remove();
      if (from === 'slipped' || from === 'ready') { if (from === 'slipped') go('tracker'); else render(); } else render();
    });
  }

  // ── Share image ───────────────────────────────────────────────────────────
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  async function shareImage() {
    try { await document.fonts.load('400 72px "Playfair Display"'); await document.fonts.load('600 32px Poppins'); } catch (e) {}
    var W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d'), t = todayNum(), L = S.habit.length;
    g.fillStyle = '#0F1215'; g.fillRect(0, 0, W, H);
    try { var logo = await loadImg('logo-white.png'); g.drawImage(logo, W - 80 - 160, 80, 160, 160 * logo.height / logo.width); } catch (e) {}
    g.fillStyle = '#EDE8DF'; g.font = '600 34px Poppins, sans-serif'; g.fillText(('Day ' + Math.min(t, L) + ' of ' + L).toUpperCase(), 80, 140);
    g.fillStyle = '#FFFFFF'; g.font = '400 88px "Playfair Display", Georgia, serif';
    var lines = wrap(g, habitName(), W - 160), y = 330; lines.slice(0, 3).forEach(function (l) { g.fillText(l, 80, y); y += 100; });
    var cols = 10, gap = 18, size = (W - 160 - gap * (cols - 1)) / cols; y += 20;
    for (var n = 1; n <= L; n++) {
      var col = (n - 1) % cols, row = Math.floor((n - 1) / cols), x = 80 + col * (size + gap), yy = y + row * (size + gap), e = S.entries[n];
      g.beginPath(); g.arc(x + size / 2, yy + size / 2, size / 2, 0, Math.PI * 2);
      if (e) { g.fillStyle = e.kind === 'dimmer' ? '#888880' : '#F5F1EB'; g.fill(); if (e.comeback) { g.lineWidth = 6; g.strokeStyle = '#C9930A'; g.stroke(); } }
      else if (n < t) { g.lineWidth = 2; g.strokeStyle = '#1C2B3A'; g.stroke(); }
      else { g.fillStyle = '#1C2B3A'; g.fill(); }
    }
    y += Math.ceil(L / cols) * (size + gap) + 60;
    g.fillStyle = '#EDE8DF'; g.font = '500 38px Poppins, sans-serif';
    g.fillText(count(function () { return true; }) + ' show-ups  ·  ' + count(function (x) { return x.comeback; }) + ' comebacks', 80, y);
    var e = S.entries[t];
    if (ui.shareNote && e && e.note) { g.fillStyle = '#FFFFFF'; g.font = '400 40px Poppins, sans-serif'; y += 80; wrap(g, '“' + e.note + '”', W - 160).slice(0, 4).forEach(function (l) { g.fillText(l, 80, y); y += 54; }); }
    var blob = await new Promise(function (r) { c.toBlob(r, 'image/png'); });
    var file = new File([blob], 'my-progress.png', { type: 'image/png' });
    var text = 'Day ' + Math.min(t, L) + ' of ' + L + ': ' + habitName();
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
      var sub2 = await reg2.pushManager.getSubscription() || await reg2.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
      var j = sub2.toJSON();
      var r = await sb.from('showup_push_subscriptions').upsert({ endpoint: j.endpoint, user_id: user.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
      if (r.error) throw r.error;
      S.settings.push = true; save(); toast('Done. Your nudge will arrive at ' + fmtTime(S.settings.time) + '.'); render();
    } catch (e) { console.warn(e); toast('That didn’t work just now. Email still works.'); }
  }

  // ── Install prompt ────────────────────────────────────────────────────────
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });

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
    if (t.dataset.hbind && S.habit) { if (t.dataset.hbind === 'what' && !t.value.trim()) return; S.habit[t.dataset.hbind] = t.value; save(); }
    if (t.dataset.rbind) { ui.reflect[t.dataset.rbind] = t.value; }
  });
  view.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.name) { e.preventDefault(); e.target.blur(); } });
  view.addEventListener('change', function (e) {
    if (e.target.dataset && e.target.dataset.name) { e.target.value = e.target.value.replace(/\s+/g, ' ').trim(); saveName(e.target.value); if (e.target.value.trim()) toast('Lovely to meet you, ' + e.target.value.trim() + '.'); return; }
    if (e.target.id === 'rtime' && e.target.value) { S.settings.time = e.target.value; save(); toast('Nudge moved to ' + fmtTime(S.settings.time) + '.'); }
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('button, [data-act="closeideas"]'); if (!b || b.closest('.celebrate')) return;
    var d = b.dataset;
    if (d.go) { if (d.go === 'reflect') ui.reflect = null; return go(d.go); }
    if (d.back) return goBack();
    if (d.start) { S.draft.mode = d.start; return go('what'); }
    if (d.starter) { S.draft.what = d.starter; save(false); return render(); }
    if (d.stepNext) { if (!stepValid(d.stepNext)) return; var nx = nextStep(d.stepNext); if (nx) return go(nx); return finishSetup(); }
    if (d.give) { var gi = S.draft.gives.indexOf(d.give); gi >= 0 ? S.draft.gives.splice(gi, 1) : S.draft.gives.push(d.give); save(false); b.setAttribute('aria-pressed', gi < 0); view.querySelectorAll('[data-loop="gives"]').forEach(function (lg) { lg.textContent = S.draft.gives.length ? S.draft.gives.join(', ') : 'Tap above'; }); view.querySelectorAll('[data-give="' + d.give + '"]').forEach(function (x) { x.setAttribute('aria-pressed', gi < 0); }); return; }
    if (d.feel) { var fi = S.draft.feel.indexOf(d.feel); fi >= 0 ? S.draft.feel.splice(fi, 1) : S.draft.feel.push(d.feel); save(false); b.setAttribute('aria-pressed', fi < 0); var nb = view.querySelector('[data-step-next]'); if (nb) nb.disabled = !stepValid(nb.dataset.stepNext); return; }
    if (d.hfeel) { var hf = S.habit.feel.indexOf(d.hfeel); hf >= 0 ? S.habit.feel.splice(hf, 1) : S.habit.feel.push(d.hfeel); save(); b.setAttribute('aria-pressed', hf < 0); return; }
    if (d.len) { if (S.habit) S.habit.length = +d.len; else S.draft.length = +d.len; save(); return render(); }
    if (d.length) { ui.returnTo = d.length; return go('length'); }
    if (d.edit) { ui.returnTo = d.edit; return go('edit'); }
    if (d.idea) { S.draft.what = IDEAS[+d.idea][0]; ui.ideasOpen = false; save(false); return render(); }
    if (d.words) { ui.wordsFrom = d.words; return go('words'); }
    if (d.account) { ui.returnTo = d.account; return go('account'); }
    if (d.tick) { var from = d.from || (S.screen === 'ready' ? 'ready' : 'tracker'); return tick(d.tick, from); }
    if (d.view) { if (S.settings.view !== d.view) { S.settings.view = d.view; save(); toast(d.view === 'focus' ? 'Focus view: just the one thing.' : 'Full view: everything in one place.'); } return render(); }
    if (d.text) { S.settings.text = d.text; applyComfort(); save(); return render(); }
    if (d.toggle) {
      if (d.toggle === 'email' && !user) { ui.returnTo = 'settings'; return go('account'); }
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
      case 'savenote': { var t = todayNum(); var v = document.getElementById('note').value.trim(); if (!S.entries[t] && v) { toast('Tick today first, then your note is saved with it.'); return; } if (S.entries[t]) { S.entries[t].note = v; S.entries[t].at = new Date().toISOString(); } save(); toast('Note saved.'); return go('tracker'); }
      case 'morechips': ui.moreChips = true; return render();
      case 'undo': delete S.entries[todayNum()]; save(); toast('Undone.'); return render();
      case 'sharenote': ui.shareNote = !ui.shareNote; return render();
      case 'shareimg': return void shareImage();
      case 'whatsapp': { var tt = Math.min(todayNum(), S.habit.length); window.open('https://wa.me/?text=' + encodeURIComponent('Day ' + tt + ' of ' + S.habit.length + ': ' + habitName() + '. ' + count(function () { return true; }) + ' show-ups so far.'), '_blank', 'noopener'); return; }
      case 'fb3send': { var v3 = (document.getElementById('fb3') || {}).value || ''; void feedback('day3', v3.trim() || '(nothing)'); toast('Thank you. Stuart reads every one.'); return render(); }
      case 'fb3skip': S.fb.day3 = true; save(); return render();
      case 'installno': S.installDismissed = true; save(); return render();
      case 'install': return go('install');
      case 'doinstall': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } return;
      case 'push': return void togglePush();
      case 'quoteok': ui.reflect.ok = !ui.reflect.ok; return render();
      case 'savereflect': return void saveReflect();
      case 'newhabit': return confirmSheet('Start a new habit?', 'Your current habit and its ticks are kept in your account, just put away.', 'Start a new habit', function () {
        if (S.habit) { S.habit.status = 'archived'; save(); if (user) void syncAll().then(function () { resetForNew(); }); else resetForNew(); } else resetForNew();
      });
      case 'signin': return void doSignIn();
      case 'signout': return void (async function () { await sb.auth.signOut(); user = null; S = fresh(); save(false); applyComfort(); go('landing'); })();
    }
  });
  backBtn.addEventListener('click', goBack);
  settingsBtn.addEventListener('click', function () { go('settings'); });
  document.getElementById('homeBtn').addEventListener('click', function () { ui.ideasOpen = false; go(S.habit ? 'tracker' : 'landing'); });

  // Suggestions and examples: always shown in Full; in Focus they wait behind one tap.
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
    var s = S.settings; if (!(s.email || s.push)) return '';
    return '<p class="next-up">' + iconClock('#888880') + '<span>What happens next: <b>your nudge arrives tomorrow at ' + esc(fmtTime(s.time)) + '</b>. Change it any time in Settings.</span></p>';
  }

  function iconPlan() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>'; }
  var PICON = {
    what: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="#0F1215"/></svg>',
    why: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" fill="#C9930A"/></svg>',
    swap: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    when: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
  };
  // The plan: their own answers, laid out simply, each one editable.
  function planCard(from) {
    var h = S.habit, less = h.mode === 'less', s = S.settings;
    var row = function (icon, label, body, edit) {
      return '<div class="prow"><span class="pic">' + icon + '</span><div class="pbody"><small>' + label + '</small>' + body + '</div>' + edit + '</div>';
    };
    var ed = '<button class="pedit" data-edit="' + from + '">Edit</button>';
    var chips = '<div class="pchips">' + words().map(function (w, i) { return '<span' + (i === 0 ? ' class="first"' : '') + '>' + esc(w.toLowerCase()) + '</span>'; }).join('') + '</div>';
    var out = '<div class="plancard">' +
      row(PICON.what, less ? 'I’m cutting back on' : 'I’m going to', '<b>' + esc(h.what) + '</b>', ed) +
      row(PICON.why, less ? 'What I’m moving towards' : 'How I’ll feel', chips, ed);
    if (less && (h.instead || '').trim()) out += row(PICON.swap, 'When it pulls at me, I’ll', '<b>' + esc(h.instead) + '</b>', ed);
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
    S.habit = { id: uuid(), mode: dr.mode, what: dr.what.trim(), gives: dr.gives.slice(), instead: dr.instead, feel: dr.feel.slice(), ownFeel: dr.ownFeel, dimmer: dr.dimmer.trim(), length: dr.length, start: todayStr(), status: 'active', extra: {}, createdAt: new Date().toISOString() };
    S.entries = {}; S.later = false; S.fb = {}; save();
    finishMoment();
  }
  // The end of setup: a proper moment, then their plan (peak-end rule).
  function finishMoment() {
    var calm = document.documentElement.classList.contains('calm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var el = document.createElement('div');
    el.className = 'celebrate finish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Your plan is ready');
    var bits = '';
    if (!calm) {
      var cols = ['#C9930A', '#F5F1EB', '#FFFFFF', '#888880', '#EDE8DF'];
      for (var i = 0; i < 70; i++) {
        var x = Math.random() * 100, dx = (Math.random() * 60 - 30).toFixed(0), rot = (Math.random() * 720 - 360).toFixed(0);
        var w = 6 + Math.random() * 6, h2 = 8 + Math.random() * 10, d = (1.6 + Math.random() * 1.4).toFixed(2), del = (Math.random() * 0.5).toFixed(2);
        bits += '<i class="cf" style="left:' + x.toFixed(1) + '%;width:' + w.toFixed(0) + 'px;height:' + h2.toFixed(0) + 'px;background:' + cols[i % cols.length] + ';--dx:' + dx + 'vw;--rot:' + rot + 'deg;animation-duration:' + d + 's;animation-delay:' + del + 's;border-radius:' + (i % 3 ? '2px' : '50%') + '"></i>';
      }
    }
    el.innerHTML = '<div class="confetti" aria-hidden="true">' + bits + '</div>' +
      '<div class="burst"><span class="ring"></span><div class="disc"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#0F1215" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div></div>' +
      '<div><div class="t">Your plan is ready.</div><div class="s">' + esc(habitName()) + ', for ' + S.habit.length + ' days. In your words.</div></div>' +
      '<button class="btn" style="max-width:320px;background:var(--amber);color:var(--navy)" data-finish="1">See my plan</button>';
    buzz();
    app.appendChild(el);
    var done = function () { if (el.parentNode) { el.remove(); go('ready'); } };
    el.addEventListener('click', function (ev) { if (ev.target.closest('[data-finish]')) done(); });
    var b = el.querySelector('[data-finish]'); if (b) b.focus({ preventScroll: true });
  }
  function resetForNew() { S.habit = null; S.entries = {}; S.fb = {}; S.later = false; S.draft = fresh().draft; save(); go('landing'); }

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
  if (S.habit && ['landing', 'what', 'less', 'feel', 'dimmer'].indexOf(S.screen) >= 0) S.screen = 'tracker';
  if (!S.habit && ['tracker', 'note', 'share', 'slipped', 'reflect', 'edit', 'settings'].indexOf(S.screen) >= 0) S.screen = 'landing';
  if (['account', 'install', 'length', 'words'].indexOf(S.screen) >= 0) S.screen = S.habit ? 'tracker' : 'landing';
  if (S.habit && ['ready', 'plan', 'settings', 'science', 'share', 'note', 'slipped'].indexOf(S.screen) >= 0) S.screen = 'tracker';
  greet();
  render();
  (async function () {
    if (!sb) return;
    try {
      var sres = await sb.auth.getSession();
      user = sres.data.session ? sres.data.session.user : null;
      if (user) { await pullRemote(); await syncAll(); render(); }
    } catch (e) {}
    sb.auth.onAuthStateChange(function (ev, session) { if (ev === 'SIGNED_OUT') user = null; else if (session) user = session.user; });
  })();
  window.addEventListener('online', function () { if (user) queueSync(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.habit && S.screen === 'tracker') render(); });

  // Test hook (used by automated tests only): shift the start date.
  window.__showupShift = function (days) { if (S.habit) { S.habit.start = addDays(S.habit.start, -days); save(); render(); } };
})();
