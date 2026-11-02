// Let's Go! V2. One focus, one or more actions, each with its own schedule.
// Step 1 of the V2 build: saved on this device only. Sign-in, sync, AI and reminders follow.
import * as M from './model.js?v=20261102a';

const KEY = 'letsgo-v2';
const $ = s => document.querySelector(s);
const main = $('#main'), tabs = $('#tabs'), sheet = $('#sheet');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brand = '<span class="brand">Let’s Go<span class="bang">!</span></span>';
const uid = () => Math.random().toString(36).slice(2, 10);
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];

// ---------- state ----------
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
let S = Object.assign({ name: '', focus: null, past: [], settings: { focused: false, big: false, calm: false }, draft: null, tab: 'today' }, load());
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} showSave(); }
function showSave() { const el = $('#save'); el.className = 'save local'; el.textContent = S.sample ? 'Sample plan' : 'Saved on this phone'; }
function applySettings() { document.documentElement.classList.toggle('big', !!S.settings.big); document.documentElement.classList.toggle('calm', !!S.settings.calm); document.body.classList.toggle('focused', !!S.settings.focused); }

function toast(msg, undo) {
  const t = $('#toast'); t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button">Undo</button>' : '');
  if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('on'); };
  t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), undo ? 6000 : 2600);
}
function go(tab) { S.tab = tab; save(); render(); main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
tabs.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) go(b.dataset.tab); });

function fmt(k, opts) { return M.parseDate(k).toLocaleDateString('en-GB', opts || { weekday: 'long', day: 'numeric', month: 'long' }); }
function partOfDay() { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; }
function grow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
document.addEventListener('input', e => { if (e.target.tagName === 'TEXTAREA') grow(e.target); });

// ---------- speak instead of typing (ported from V1) ----------
// Transcribes exactly what's said and keeps listening through pauses (up to 10 minutes) until they tap stop.
// Android Chrome repeats earlier words in "continuous" mode, so there it listens one phrase at a time and restarts.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IS_ANDROID = /android/i.test(navigator.userAgent), MIC_MAX_MS = 10 * 60 * 1000;
let mic = null;
function micBtn(id) { return SR ? '<button type="button" class="mic" data-mic-for="' + id + '" aria-pressed="false" aria-label="Speak instead of typing"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span>Speak</span></button>' : ''; }
function micIdle(b) { if (b && b.isConnected) { b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Speak'; } }
function stopMic() { if (!mic) return; const m = mic; mic = null; m.wanted = false; try { m.rec && m.rec.stop(); } catch (e) {} micIdle(m.btn); }
function addHeard(m, text) {
  text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) return;
  const prev = m.lastFinal; let add = text;
  if (prev && text === prev) return;
  if (prev && text.indexOf(prev) === 0) add = text.slice(prev.length).trim();
  m.lastFinal = text; if (add) m.done = (m.done ? m.done.replace(/\s*$/, ' ') : '') + add;
}
function micListen(m) {
  const r = new SR(); m.rec = r;
  r.lang = navigator.language && /^en/i.test(navigator.language) ? navigator.language : 'en-GB';
  r.continuous = !IS_ANDROID; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = ev => { let tmp = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { if (ev.results[i].isFinal) addHeard(m, ev.results[i][0].transcript); else tmp += ev.results[i][0].transcript; } m.ta.value = (m.done || '') + (tmp ? (m.done ? ' ' : '') + tmp.trim() : ''); grow(m.ta); };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { m.wanted = false; toast('Microphone blocked. You can allow it in your browser settings.'); } };
  r.onend = () => {
    m.ta.value = m.done || ''; grow(m.ta); m.ta.dispatchEvent(new Event('input', { bubbles: true }));
    if (m.wanted && mic === m && Date.now() - m.started < MIC_MAX_MS && m.ta.isConnected) { setTimeout(() => { if (m.wanted && mic === m) { try { micListen(m); } catch (e) { stopMic(); } } }, 120); return; }
    if (mic === m) { mic = null; micIdle(m.btn); }
  };
  r.start();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mic-for]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (mic) return stopMic();
  const ta = document.getElementById(b.dataset.micFor); if (!ta) return;
  const m = { btn: b, ta, wanted: true, started: Date.now(), done: ta.value.replace(/\s+$/, ''), lastFinal: '' }; mic = m;
  try { micListen(m); b.setAttribute('aria-pressed', 'true'); b.querySelector('span').textContent = 'Listening… tap to stop'; }
  catch (err) { mic = null; toast('Speaking isn’t available here. Typing works just as well.'); }
}, true);

// ---------- render ----------
function render() {
  stopMic();
  applySettings(); showSave();
  const setup = !S.focus;
  tabs.hidden = setup; main.classList.toggle('setup', setup);
  if (setup) return renderSetup();
  tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
  ({ today: renderToday, progress: renderProgress, plan: renderPlan, support: renderSupport })[S.tab || 'today']();
  main.querySelectorAll('textarea').forEach(grow);
}

// ---------- Today ----------
function dayNum(f, k) { return M.diffDays(k, f.start) + 1; }
const ICON = {
  today: '<path d="M12 4v2M12 18v2M4 12H2M22 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
  week: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  chart: '<path d="M5 20V12M10 20V7M15 20v-5M20 20V4"/>',
  task: '<path d="M9 11l2.5 2.5L16 9"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
  stu: '<path d="M4 18c0-3.5 3.6-5 8-5s8 1.5 8 5M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>'
};
const icon = (k, cls) => '<span class="ic ' + (cls || '') + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + ICON[k] + '</svg></span>';
function secHead(k, title, right) { return '<div class="sec-h">' + icon(k) + '<h2>' + title + '</h2>' + (right ? '<span class="sec-r">' + right + '</span>' : '') + '</div>'; }

function actionCard(f, a, k, weekly) {
  const e = M.entry(a, k), rule = M.ruleFor(a, k);
  const meta = [a.cue ? 'After I ' + esc(a.cue) : '', weekly ? weekly.done + ' of ' + weekly.target + ' this week' : esc(M.describe(rule))].filter(Boolean).map(x => '<span>' + x + '</span>').join('');
  if (M.counted(e)) {
    const small = e.kind === 'small';
    return '<div class="action ' + (small ? 'smalldone' : 'done') + '"><div class="status"><span style="display:flex;gap:10px;align-items:center"><span class="tick' + (small ? ' half' : '') + '" aria-hidden="true">✓</span>' + esc(a.text) + '</span><button class="link" data-undo="' + a.id + '">Undo</button></div>' +
      '<p class="hint">' + (small ? 'Smaller version done. That counts.' : e.up ? 'Turned it up. Brilliant. Notice how that felt.' : 'Done. Nice work.') + '</p></div>';
  }
  return '<div class="action"><div class="what">' + esc(a.text) + '</div><div class="meta">' + meta + '</div>' +
    '<div class="btns"><button class="btn" data-do="' + a.id + '" data-kind="full">Done</button><button class="btn outline" data-do="' + a.id + '" data-kind="small">Smaller version</button></div>' +
    (a.small ? '<p class="hint full-only">Smaller version: ' + esc(a.small) + '</p>' : '') +
    (a.up ? '<button class="link up" data-do="' + a.id + '" data-kind="full" data-up="1">I turned it up: ' + esc(a.up) + '</button>' : '') + '</div>';
}
function weekStrip(f, now) {
  const ws = M.weekStart(now); let h = '<div class="week" role="list">';
  for (let i = 0; i < 7; i++) {
    const k = M.addDays(ws, i), t = M.tally(Object.assign({}, f), k, k, now);
    let cls = 'future', inner = '', label = '';
    const anyDue = f.actions.some(a => M.isDue(f, a, k)), done = f.actions.filter(a => M.counted(M.entry(a, k))).length;
    const due = f.actions.filter(a => M.isDue(f, a, k)).length;
    if (k < f.start || k > M.endDate(f)) { cls = 'rest'; label = 'outside your plan'; }
    else if (M.isPaused(f, k)) { cls = 'rest'; label = 'paused'; }
    else if (k > now) { cls = anyDue ? 'future' : 'rest'; label = anyDue ? due + ' planned' : 'rest day'; }
    else if (done && done >= due) { cls = f.actions.some(a => (M.entry(a, k) || {}).kind === 'full') ? 'full' : 'small'; inner = '✓'; label = done + ' done'; }
    else if (done) { cls = 'part'; label = done + ' of ' + due + ' done'; }
    else if (anyDue) { cls = 'open'; label = k === now ? 'still to do' : 'not logged'; }
    else { cls = 'rest'; label = 'rest day'; }
    const p = due ? Math.round(done / due * 100) : 0;
    h += '<button role="listitem" data-day="' + k + '" class="' + (k === now ? 'now' : '') + '" aria-label="' + fmt(k) + ', ' + label + '"><span>' + DN[M.weekday(k)] + '</span><span class="ring ' + cls + '" style="--p:' + p + '%">' + inner + '</span></button>';
    void t;
  }
  return h + '</div>';
}
function legend() { return '<div class="legend"><span><i style="background:var(--green)"></i>Done</span><span><i style="background:var(--amber)"></i>Smaller version</span><span><i style="border:2px dashed #B8AFA0"></i>Not logged</span><span><i style="border:2px solid var(--cream-deep)"></i>Rest</span></div>'; }

function chart(f, now, height) {
  const s = M.weeklySeries(f, now).slice(-8); if (!s.length) return '';
  const W = 320, H = height || 120, pad = 22, n = s.length, bw = Math.min(28, (W - 20) / n - 10), max = Math.max(1, ...s.map(x => x.planned));
  let g = '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + pad) + '" role="img" aria-label="Sessions done each week against sessions planned">';
  s.forEach((x, i) => {
    const cx = 10 + (i + 0.5) * ((W - 20) / n), ph = x.planned / max * (H - 8), fh = x.full / max * (H - 8), sh = x.small / max * (H - 8);
    const xl = cx - bw / 2, base = H;
    g += '<rect x="' + xl + '" y="' + (base - ph) + '" width="' + bw + '" height="' + ph + '" rx="4" fill="none" stroke="#C9BFAE" stroke-width="1.5" stroke-dasharray="3 3"/>';
    if (fh) g += '<rect x="' + xl + '" y="' + (base - fh) + '" width="' + bw + '" height="' + fh + '" rx="4" fill="#3B6D11"/>';
    if (sh) g += '<rect x="' + xl + '" y="' + (base - fh - sh) + '" width="' + bw + '" height="' + sh + '" rx="4" fill="#C9930A"/>';
    g += '<text x="' + cx + '" y="' + (H + 16) + '" font-size="11" text-anchor="middle" fill="#4A4A4A" font-family="Poppins, sans-serif">' + (i === n - 1 ? 'This wk' : M.parseDate(x.week).getDate() + ' ' + M.parseDate(x.week).toLocaleDateString('en-GB', { month: 'short' })) + '</text>';
  });
  return g + '</svg>';
}

function renderToday() {
  const f = S.focus, now = M.today(), list = M.todayList(f, now);
  const total = M.tally(f, f.start, M.endDate(f), now);
  const n = Math.max(1, Math.min(dayNum(f, now), f.length)), pct = Math.round(n / f.length * 100);
  let h = (S.sample ? '<div class="samplebar"><span>This is a sample plan.</span><button class="link" data-act="mine">Make my own</button></div>' : '') +
    '<div><div class="eyebrow">' + fmt(now) + '</div><h1>' + partOfDay() + (S.name ? ', ' + esc(S.name) : '') + '.</h1></div>' +
    '<section class="card hero"><span class="pill">Day ' + n + ' of ' + f.length + '</span><div class="eyebrow">My focus</div><h1>' + esc(f.title) + '</h1>' +
    (f.why ? '<p style="color:#D9D4CA" class="full-only">Moving towards: ' + esc(f.why) + '</p>' : '') +
    '<div class="meter" aria-hidden="true"><i style="width:' + pct + '%"></i></div></section>';

  if (M.isPaused(f, now)) {
    const p = f.pauses.find(p => now >= p.from && (!p.to || now <= p.to));
    h += '<section class="card"><h2>Your plan is paused</h2><p class="lead">Nothing is due' + (p.to ? ' until ' + fmt(M.addDays(p.to, 1), { weekday: 'long', day: 'numeric', month: 'short' }) : '') + '. Pausing never counts against you.</p><button class="btn outline" data-act="resume">Resume now</button></section>';
  } else if (now > M.endDate(f)) {
    h += '<section class="card"><h2>Your review day has come</h2><p class="lead">You recorded ' + total.done + ' of ' + total.planned + ' planned sessions. Take a minute to look back and choose what happens next.</p><button class="btn" data-act="review">Look back</button></section>';
  } else {
    const doneN = list.due.filter(a => M.counted(M.entry(a, now))).length, allDone = list.due.length && doneN === list.due.length;
    h += '<section class="card sec today">' + secHead('today', 'Today', list.due.length ? '<span class="pill dark">' + doneN + ' of ' + list.due.length + ' done</span>' : '');
    if (!list.due.length && !list.weekly.length) {
      const next = f.actions.map(a => M.nextDue(f, a, now)).filter(Boolean).sort()[0];
      h += '<div class="banner rest"><strong>Nothing planned today</strong><span>Rest days are part of the plan.' + (next ? ' Next up: ' + fmt(next, { weekday: 'long', day: 'numeric', month: 'short' }) + '.' : '') + '</span></div>';
    }
    if (allDone) h += '<div class="banner ok"><span class="tick" aria-hidden="true">✓</span><strong>All done for today</strong></div>';
    list.due.forEach(a => { h += actionCard(f, a, now); });
    list.weekly.forEach(w => { h += '<div class="tag">Any day this week</div>' + actionCard(f, w.a, now, w.p); });
    h += '</section>';
  }

  h += '<section class="card sec">' + secHead('week', 'This week', '<button class="link" data-tab-go="progress">Progress</button>') + weekStrip(f, now) + '<div class="full-only">' + legend() + '</div></section>';

  if (total.planned) {
    const wk = M.tally(f, M.weekStart(now), M.addDays(M.weekStart(now), 6), now);
    const backs = f.actions.reduce((n, a) => n + Object.keys(a.entries || {}).filter(k => M.isComeback(f, a, k, now)).length, 0);
    h += '<section class="card sec full-only">' + secHead('chart', 'Your progress') +
      '<div class="tiles"><div class="tile"><b>' + total.done + '</b><span>sessions done</span></div><div class="tile"><b>' + wk.done + '<small>/' + wk.planned + '</small></b><span>this week</span></div><div class="tile"><b>' + backs + '</b><span>comebacks</span></div></div>' +
      chart(f, now, 100) + '<p class="hint">Green is done, amber is a smaller version. Both count.</p></section>';
  }

  const tasks = (f.tasks || []).filter(t => !t.done);
  if (tasks.length) h += '<section class="card sec sort full-only">' + secHead('task', 'To sort out') + '<p class="hint">One-off jobs that make the plan easier.</p>' +
    tasks.map(t => '<div class="taskrow"><button class="box" data-task="' + t.id + '" aria-label="Mark ‘' + esc(t.text) + '’ as sorted"></button><span class="tt">' + esc(t.text) + '</span>' +
      '<a class="btn small light srch" href="' + searchUrl(t.text) + '" target="_blank" rel="noopener">' + icon('search', 'bare') + 'Search</a></div>').join('') + '</section>';

  h += '<section class="card sec stucard full-only"><div class="stu"><img src="../stuart.jpg" alt=""><div class="stack" style="gap:8px"><div class="eyebrow">A thought from Stu</div><q>' + esc(stuLine(f, now)) + '</q></div></div></section>';
  main.innerHTML = h;
}

// One-off tasks open a Google search in a new tab. Places (courts, gyms, classes) open Google Maps,
// which uses the person's own Google location settings. Nothing about their location reaches us.
function searchUrl(text) {
  const q = text.replace(/^(find|look for|search for|book|get|choose|pick)\s+(a|an|the|some)?\s*/i, '').trim();
  const place = /\b(near|nearby|local|court|courts|gym|club|class|classes|pool|studio|park|centre|center|coach|physio|venue)\b/i.test(text);
  return place ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(/near/i.test(q) ? q : q + ' near me') : 'https://www.google.com/search?q=' + encodeURIComponent(q);
}

const STU = [
  'Some days are a 10, some days are a 1. Both count. Showing up is the point.',
  'If you only have 20% to give today and you give it, that is you giving 100%.',
  'Make it small enough to start. The rest tends to follow.',
  'Missed a day? Nothing is lost. The next planned day is the only one that matters.',
  'Notice what made it easier this week. That is gold. Do more of that.'
];
function stuLine(f, now) {
  const d = dayNum(f, now);
  if (d === 1) return 'Day one. Keep it light. Just do the first one and tick it off.';
  if (d === 3) return 'This is usually where life gets in the way. A smaller version still counts.';
  return STU[(d + f.title.length) % STU.length];
}

main.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const f = S.focus, now = M.today();
  if (t.dataset.do) {
    const a = f.actions.find(x => x.id === t.dataset.do); a.entries = a.entries || {};
    a.entries[now] = { kind: t.dataset.kind, at: new Date().toISOString() }; if (t.dataset.up) a.entries[now].up = true; save(); render();
    const card = main.querySelector('[data-undo="' + a.id + '"]'); if (card) card.closest('.action').classList.add('pop');
    if (navigator.vibrate && !S.settings.calm) try { navigator.vibrate(20); } catch (err) {}
    const comeback = M.isComeback(f, a, now, now);
    toast(comeback ? 'Welcome back. Comebacks are what count.' : t.dataset.up ? 'Turned up. Brilliant.' : t.dataset.kind === 'small' ? 'Smaller version logged. It counts.' : 'Logged. Nice work.', () => { delete a.entries[now]; save(); render(); });
    return;
  }
  if (t.dataset.undo) { const a = f.actions.find(x => x.id === t.dataset.undo); const old = a.entries[now]; delete a.entries[now]; save(); render(); toast('Undone.', () => { a.entries[now] = old; save(); render(); }); return; }
  if (t.dataset.tabGo) return go(t.dataset.tabGo);
  if (t.dataset.task) { const k = f.tasks.find(x => x.id === t.dataset.task); k.done = true; save(); render(); toast('Sorted.', () => { k.done = false; save(); render(); }); return; }
  if (t.dataset.day) return dayDetail(t.dataset.day);
  const act = t.dataset.act;
  if (act === 'mine') { S.focus = null; S.sample = false; S.draft = null; save(); render(); return; }
  if (act === 'resume') { const p = f.pauses.find(p => now >= p.from && (!p.to || now <= p.to)); if (p) p.to = M.addDays(now, -1); f.pauses = f.pauses.filter(p => !p.to || p.to >= p.from); save(); render(); toast('Welcome back.'); return; }
  if (act === 'review') return review();
  if (act === 'pause') return pauseSheet();
  if (act === 'edit') return editAction(t.dataset.id);
  if (act === 'addaction') return editAction(null);
  if (act === 'toggle') { S.settings[t.dataset.k] = !S.settings[t.dataset.k]; save(); render(); return; }
  if (act === 'export') return exportData();
  if (act === 'newfocus') return confirmSheet('Start a new focus?', 'Your current focus and its history are kept under Previous focuses.', 'Start a new focus', () => { archive(); S.focus = null; S.draft = null; save(); render(); });
  if (act === 'struggle') return struggle(t.dataset.k);
  if (act === 'rename') return nameSheet();
  if (act === 'length') return lengthSheet();
});

// Tap a day in the week strip: see and correct what happened.
function dayDetail(k) {
  const f = S.focus, now = M.today();
  if (k > now) { toast('That day hasn’t happened yet.'); return; }
  const rows = f.actions.filter(a => M.inRange(f, a, k)).map(a => {
    const s = M.dayState(f, a, k, now);
    const lab = { full: 'Done', small: 'Smaller version', skip: 'Didn’t happen', unlogged: 'Not logged yet', today: 'Still to do', rest: 'Rest day', paused: 'Paused', open: 'Any day this week' }[s] || s;
    return '<div class="stack" style="gap:6px"><div class="row"><strong>' + esc(a.text) + '</strong><span class="hint">' + lab + '</span></div>' +
      (s === 'paused' ? '' : '<div class="chips">' + ['full', 'small', 'skip', 'clear'].map(c => '<button class="chip" data-set="' + a.id + '" data-c="' + c + '" aria-pressed="' + ((M.entry(a, k) || {}).kind === c) + '">' + { full: 'Done', small: 'Smaller', skip: 'Didn’t happen', clear: 'Clear' }[c] + '</button>').join('') + '</div>') + '</div>';
  }).join('<hr style="border:0;border-top:1px solid var(--border);margin:4px 0">');
  sheet.innerHTML = '<div class="stack"><h2>' + fmt(k) + '</h2><p class="hint">Fill in or correct any day. Nothing is ever lost.</p>' + rows + '<button class="btn" value="close">Done</button></div>';
  sheet.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.value === 'close') return sheet.close();
    if (b.dataset.set) { const a = f.actions.find(x => x.id === b.dataset.set); a.entries = a.entries || {}; if (b.dataset.c === 'clear') delete a.entries[k]; else a.entries[k] = { kind: b.dataset.c, at: new Date().toISOString(), late: k !== now }; save(); render(); dayDetail(k); }
  };
  if (!sheet.open) sheet.showModal();
}

// ---------- Progress ----------
// Running total of sessions done against sessions planned, day by day. A smooth area for done, a dashed line for planned.
function lineChart(f, now) {
  const end = M.endDate(f) < now ? M.endDate(f) : now, days = [];
  for (let k = f.start; k <= end; k = M.addDays(k, 1)) days.push(k);
  if (days.length < 2) return '<p class="hint">Your running total appears here after your first couple of days.</p>';
  let done = 0, plan = 0; const pts = days.map(k => { const t = M.tally(f, k, k, now); done += t.done; plan += t.planned; return { done, plan }; });
  const W = 320, H = 130, max = Math.max(1, ...pts.map(p => Math.max(p.done, p.plan))), x = i => 6 + i / (pts.length - 1) * (W - 12), y = v => H - 6 - v / max * (H - 18);
  const path = key => pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1)).join(' ');
  const area = path('done') + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - 6) + ' L' + x(0) + ' ' + (H - 6) + ' Z';
  const last = pts[pts.length - 1];
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="Running total: ' + last.done + ' sessions done of ' + last.plan + ' planned">' +
    '<defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3B6D11" stop-opacity=".35"/><stop offset="1" stop-color="#3B6D11" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#lg)"/><path d="' + path('plan') + '" fill="none" stroke="#B8AFA0" stroke-width="1.5" stroke-dasharray="4 4"/>' +
    '<path d="' + path('done') + '" fill="none" stroke="#3B6D11" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + x(pts.length - 1) + '" cy="' + y(last.done) + '" r="5" fill="#fff" stroke="#3B6D11" stroke-width="2.5"/>' +
    '<text x="6" y="' + (H + 14) + '" font-size="11" fill="#4A4A4A" font-family="Poppins, sans-serif">' + M.parseDate(f.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</text>' +
    '<text x="' + (W - 6) + '" y="' + (H + 14) + '" font-size="11" text-anchor="end" fill="#4A4A4A" font-family="Poppins, sans-serif">Today</text></svg>';
}

function renderProgress() {
  const f = S.focus, now = M.today(), t = M.tally(f, f.start, M.endDate(f), now);
  const wk = M.tally(f, M.weekStart(now), M.addDays(M.weekStart(now), 6), now);
  let h = '<div><div class="eyebrow">Progress</div><h1>How it’s going</h1></div>' +
    '<section class="card sec">' + secHead('chart', 'Running total') + '<div class="row" style="align-items:flex-end"><div><span class="big-num">' + t.done + '</span> <span class="hint">of ' + t.planned + ' planned sessions</span></div><span class="pill dark">This week ' + wk.done + ' of ' + wk.planned + '</span></div>' +
    lineChart(f, now) + '<div class="legend"><span><i style="background:var(--green)"></i>Sessions done</span><span><i style="border:1.5px dashed #B8AFA0"></i>Sessions planned</span></div></section>' +
    '<section class="card sec">' + secHead('week', 'Week by week') + chart(f, now, 120) + legendBars() +
    '<p class="hint">Rest days and paused days never count against you. Days you haven’t logged are shown as not logged, not as missed. Tap any day on Today to fill it in.</p></section>';
  if (t.unlogged) h += '<section class="card soft"><h2>' + t.unlogged + ' planned ' + (t.unlogged === 1 ? 'day isn’t' : 'days aren’t') + ' logged</h2><p class="lead">If you did them, fill them in. If not, that’s fine too.</p><button class="btn outline" data-tab-go="today">Go to this week</button></section>';
  h += '<section class="stack"><h2>Each action</h2>';
  f.actions.forEach(a => {
    const one = Object.assign({}, f, { actions: [a] }), at = M.tally(one, f.start, M.endDate(f), now);
    let dots = '';
    const from = M.weekStart(M.addDays(now, -21));
    for (let i = 0; i < 28; i++) {
      const k = M.addDays(from, i), s = M.dayState(f, a, k, now);
      const c = s === 'full' ? 'var(--green)' : s === 'small' ? 'var(--amber)' : (s === 'unlogged' || s === 'today' || s === 'outside' || s === 'planned') ? 'transparent' : 'var(--cream-deep)';
      const bd = (s === 'unlogged' || s === 'today') ? '1.5px dashed #B8AFA0' : s === 'planned' ? '1.5px dotted #C9BFAE' : '0';
      dots += '<i title="' + k + '" style="display:block;aspect-ratio:1;border-radius:4px;background:' + c + ';border:' + bd + '"></i>';
    }
    h += '<div class="card"><div class="row"><strong>' + esc(a.text) + '</strong><span class="hint">' + at.done + ' of ' + at.planned + '</span></div><p class="hint">' + esc(M.describe(M.ruleFor(a, now))) + (at.small ? ' · ' + at.small + ' smaller' : '') + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:260px" aria-label="Last four weeks, Monday to Sunday">' + ['M','T','W','T','F','S','S'].map(x => '<span class="hint" style="text-align:center;font-size:11px">' + x + '</span>').join('') + dots + '</div></div>';
  });
  h += '</section>';
  main.innerHTML = h;
}
function legendBars() { return '<div class="legend"><span><i style="background:var(--green);border-radius:2px"></i>Done</span><span><i style="background:var(--amber);border-radius:2px"></i>Smaller version</span><span><i style="border:1.5px dashed #C9BFAE;border-radius:2px"></i>Planned</span></div>'; }

// ---------- Plan ----------
function renderPlan() {
  const f = S.focus, now = M.today();
  let h = '<div><div class="eyebrow">My plan</div><h1>' + esc(f.title) + '</h1>' + (f.why ? '<p class="lead" style="margin-top:8px">Moving towards: ' + esc(f.why) + '</p>' : '') + '</div>';
  h += '<section class="stack"><h2>Actions</h2>';
  f.actions.forEach(a => {
    h += '<div class="card"><div class="row"><strong>' + esc(a.text) + '</strong><button class="link" data-act="edit" data-id="' + a.id + '">Change</button></div>' +
      '<p class="hint">' + esc(M.describe(M.ruleFor(a, now))) + (a.cue ? ' · After I ' + esc(a.cue) : '') + '</p>' + (a.small ? '<p class="hint">Turn it down: ' + esc(a.small) + '</p>' : '') + (a.up ? '<p class="hint">Turn it up: ' + esc(a.up) + '</p>' : '<button class="link" data-act="edit" data-id="' + a.id + '">Add a turn-it-up version</button>') + '</div>';
  });
  h += '<button class="btn outline" data-act="addaction">Add an action</button></section>';
  h += '<section class="card"><div class="row"><h2>Review day</h2><button class="link" data-act="length">Change</button></div><p class="lead">' + fmt(M.endDate(f)) + ', after ' + f.length + ' days. You can keep going after that.</p></section>';
  h += '<section class="card"><h2>Need a break?</h2><p class="lead">Pause the whole plan. Nothing is due while it’s paused, and it never counts against you.</p><button class="btn outline" data-act="pause">Pause my plan</button></section>';
  h += '<section class="card"><h2>Settings</h2>' +
    toggleRow('focused', 'Focused view', 'Fewer details on screen. Everything is still one tap away.') +
    toggleRow('big', 'Larger text', '') + toggleRow('calm', 'Less movement', '') +
    '<div class="row"><span>Your name</span><button class="link" data-act="rename">' + (S.name ? esc(S.name) : 'Add') + '</button></div>' +
    '<button class="link" data-act="export">Download my data</button></section>';
  if ((S.past || []).length) h += '<section class="card"><h2>Previous focuses</h2>' + S.past.map(p => { const t = M.tally(p, p.start, M.endDate(p), M.today()); return '<div class="row"><span>' + esc(p.title) + '</span><span class="hint">' + t.done + ' of ' + t.planned + '</span></div>'; }).join('') + '</section>';
  h += '<button class="btn outline" data-act="newfocus">Start a new focus</button>';
  main.innerHTML = h;
}
function toggleRow(k, label, hint) { return '<div class="row"><div><div>' + label + '</div>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div><button class="btn small ' + (S.settings[k] ? '' : 'outline') + '" data-act="toggle" data-k="' + k + '" aria-pressed="' + !!S.settings[k] + '">' + (S.settings[k] ? 'On' : 'Off') + '</button></div>'; }

// ---------- Support ----------
const STRUGGLE = {
  start: { t: 'I can’t get started today', q: 'What’s the smallest version you could do in the next five minutes?' },
  off: { t: 'I’ve fallen off track', q: 'What got in the way? Naming it makes the next plan smarter.' },
  spark: { t: 'I’ve lost the spark', q: 'What did you want this for, in your own words?' },
  life: { t: 'Something came up', q: 'What happened? You can pause the plan if you need to.' }
};
function renderSupport() {
  let h = '<div><div class="eyebrow">Support</div><h1>Struggling means it matters</h1></div>' +
    '<section class="card soft"><div class="stu"><img src="../stuart.jpg" alt=""><p class="lead">Which feels closest right now? Pick one and we’ll find one small next step.</p></div></section><section class="stack">' +
    Object.keys(STRUGGLE).map(k => '<button class="btn outline" style="justify-content:flex-start;text-transform:none;letter-spacing:0;font-size:16px" data-act="struggle" data-k="' + k + '">' + STRUGGLE[k].t + '</button>').join('') + '</section>';
  const notes = (S.focus.worked || []).slice(-3).reverse();
  if (notes.length) h += '<section class="card"><h2>What’s worked for you</h2>' + notes.map(n => '<p class="lead">“' + esc(n.text) + '”</p>').join('') + '</section>';
  main.innerHTML = h;
}
function struggle(k) {
  const f = S.focus, s = STRUGGLE[k], smalls = f.actions.filter(a => a.small);
  sheet.innerHTML = '<div class="stack"><h2>' + s.t + '</h2>' +
    (k === 'start' && smalls.length ? '<p class="lead">Your smaller versions are ready:</p>' + smalls.map(a => '<div class="card"><strong>' + esc(a.text) + '</strong><span class="hint">' + esc(a.small) + '</span></div>').join('') : '') +
    '<label class="field">' + s.q + '<textarea rows="1" id="sq"></textarea></label>' +
    (k === 'life' ? '<button class="btn outline" value="pause">Pause my plan</button>' : '') +
    '<button class="btn" value="save">Save this</button><button class="link" value="close">Close</button></div>';
  sheet.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.value === 'close') return sheet.close();
    if (b.value === 'pause') { sheet.close(); return pauseSheet(); }
    if (b.value === 'save') { const v = $('#sq').value.trim(); if (v) { f.worked = f.worked || []; f.worked.push({ at: M.today(), kind: k, text: v }); save(); } sheet.close(); render(); toast('Saved. Past you will thank you.'); }
  };
  sheet.showModal();
}

// ---------- sheets ----------
function confirmSheet(title, text, yes, fn) {
  sheet.innerHTML = '<div class="stack"><h2>' + esc(title) + '</h2><p class="lead">' + esc(text) + '</p><button class="btn" value="yes">' + esc(yes) + '</button><button class="link" value="no">Cancel</button></div>';
  sheet.onclick = e => { const b = e.target.closest('button'); if (!b) return; sheet.close(); if (b.value === 'yes') fn(); };
  sheet.showModal();
}
function pauseSheet() {
  const now = M.today();
  sheet.innerHTML = '<div class="stack"><h2>Pause my plan</h2><p class="lead">For how long?</p><div class="chips">' + [3, 7, 14].map(d => '<button class="chip" value="' + d + '">' + d + ' days</button>').join('') + '<button class="chip" value="0">Until I resume</button></div><button class="link" value="x">Cancel</button></div>';
  sheet.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; sheet.close(); if (b.value === 'x') return;
    const f = S.focus, d = +b.value; f.pauses = f.pauses || []; f.pauses.push({ from: now, to: d ? M.addDays(now, d - 1) : null });
    save(); go('today'); toast('Paused. Look after yourself.');
  };
  sheet.showModal();
}
function lengthSheet() {
  const f = S.focus;
  sheet.innerHTML = '<div class="stack"><h2>When should we look back?</h2><p class="hint">A review point, not a deadline. You can keep going after it.</p><div class="chips">' + [30, 60, 90, 180, 365].map(d => '<button class="chip" value="' + d + '" aria-pressed="' + (f.length === d) + '">' + (d === 365 ? 'A year' : d + ' days') + '</button>').join('') + '</div><button class="link" value="x">Cancel</button></div>';
  sheet.onclick = e => { const b = e.target.closest('button'); if (!b) return; sheet.close(); if (b.value === 'x') return; f.length = +b.value; save(); render(); };
  sheet.showModal();
}
function nameSheet() {
  sheet.innerHTML = '<div class="stack"><h2>What should we call you?</h2><textarea rows="1" id="nm">' + esc(S.name) + '</textarea><button class="btn" value="ok">Save</button></div>';
  sheet.onclick = e => { const b = e.target.closest('button'); if (!b) return; S.name = $('#nm').value.trim().split(/\s+/)[0] || ''; save(); sheet.close(); render(); };
  sheet.showModal();
}
function review() {
  const f = S.focus, t = M.tally(f, f.start, M.endDate(f), M.today());
  sheet.innerHTML = '<div class="stack"><h2>' + f.length + ' days. ' + t.done + ' sessions.</h2><p class="lead">Habits often take longer than a month to feel automatic. In one well-known study the middle was 66 days. What you’ve started counts.</p>' +
    '<label class="field">What did you notice?<textarea rows="1" id="rv"></textarea></label>' +
    '<button class="btn" value="more">Keep going 30 more days</button><button class="btn outline" value="new">Start a new focus</button><button class="link" value="x">Not now</button></div>';
  sheet.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; sheet.close();
    const note = ($('#rv') || {}).value; if (note) { f.reviews = f.reviews || []; f.reviews.push({ at: M.today(), text: note }); }
    if (b.value === 'more') { f.length += 30; save(); render(); toast('Keep going. Everything is kept.'); }
    else if (b.value === 'new') { archive(); S.focus = null; S.draft = null; save(); render(); }
  };
  sheet.showModal();
}
function archive() { if (S.focus && !S.sample) { S.focus.finishedOn = M.today(); S.past = (S.past || []).concat([S.focus]); } }
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lets-go-my-data.json'; a.click();
}

// ---------- action editor (used in setup and plan) ----------
function ruleUI(r, id) {
  const type = r.type === 'days' && r.days.length === 7 ? 'daily' : r.type;
  const opts = [['daily', 'Every day'], ['days', 'Set days'], ['every', 'Every other day'], ['weekly', 'Times a week']];
  let h = '<div class="chips" role="group" aria-label="How often">' + opts.map(o => '<button type="button" class="chip" data-rule="' + o[0] + '" data-for="' + id + '" aria-pressed="' + (type === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
  if (type === 'days') h += '<div class="days">' + MON_FIRST.map(d => '<button type="button" class="chip" data-wd="' + d + '" data-for="' + id + '" aria-pressed="' + r.days.includes(d) + '" aria-label="' + DN[d] + '">' + DN[d].slice(0, 2) + '</button>').join('') + '</div>';
  if (type === 'weekly') h += '<div class="chips">' + [1, 2, 3, 4, 5].map(n => '<button type="button" class="chip" data-times="' + n + '" data-for="' + id + '" aria-pressed="' + (r.times === n) + '">' + n + (n === 1 ? ' time' : ' times') + '</button>').join('') + '</div>';
  return h;
}
function applyRuleClick(b, r) {
  if (b.dataset.rule === 'daily') return { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] };
  if (b.dataset.rule === 'days') return { type: 'days', days: r.type === 'days' && r.days.length < 7 ? r.days : [1, 3, 5] };
  if (b.dataset.rule === 'every') return { type: 'every', n: 2, anchor: r.anchor || null };
  if (b.dataset.rule === 'weekly') return { type: 'weekly', times: r.times || 1 };
  if (b.dataset.wd) { const d = +b.dataset.wd, days = r.days.includes(d) ? r.days.filter(x => x !== d) : r.days.concat([d]); return { type: 'days', days: days.length ? days : r.days }; }
  if (b.dataset.times) return { type: 'weekly', times: +b.dataset.times };
  return r;
}
function editAction(id) {
  const f = S.focus, now = M.today(), a = id ? f.actions.find(x => x.id === id) : null;
  const d = { text: a ? a.text : '', cue: a ? a.cue || '' : '', small: a ? a.small || '' : '', up: a ? a.up || '' : '', rule: a ? Object.assign({}, M.ruleFor(a, now)) : { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] } };
  const paint = () => {
    sheet.innerHTML = '<div class="stack"><h2>' + (a ? 'Change this action' : 'Add an action') + '</h2>' +
      '<label class="field">I’m going to...<textarea rows="1" id="ea-text">' + esc(d.text) + '</textarea></label>' +
      '<div class="field" style="font-weight:600">How often</div>' + ruleUI(d.rule, 'ea') +
      '<label class="field">After I... <span class="hint" style="font-weight:400">(optional)</span><textarea rows="1" id="ea-cue">' + esc(d.cue) + '</textarea></label>' +
      '<label class="field">Smaller version for tough days<textarea rows="1" id="ea-small">' + esc(d.small) + '</textarea></label>' +
      '<label class="field">Turn it up <span class="hint" style="font-weight:400">(optional)</span><textarea rows="1" id="ea-up" placeholder="Stretch for 20 minutes">' + esc(d.up) + '</textarea><span class="hint" style="font-weight:400">Up for more on a good day? Make it more challenging if you fancy it, and notice what you notice. If you stop showing up, turn the volume back down so you can get back in.</span></label>' +
      (a ? '<p class="hint">Changes apply from today. Past days stay as they were.</p>' : '') +
      '<button class="btn" value="save">Save</button>' + (a && f.actions.length > 1 ? '<button class="link" value="remove">Stop this action</button>' : '') + '<button class="link" value="x">Cancel</button></div>';
    sheet.querySelectorAll('textarea').forEach(grow);
  };
  const keep = () => { ['text', 'cue', 'small', 'up'].forEach(k => { const el = $('#ea-' + k); if (el) d[k] = el.value; }); };
  sheet.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.for) { keep(); d.rule = applyRuleClick(b, d.rule); paint(); return; }
    if (b.value === 'x') return sheet.close();
    keep();
    if (b.value === 'remove') { a.until = M.addDays(now, -1); if (a.until < f.start) f.actions = f.actions.filter(x => x !== a); save(); sheet.close(); render(); return; }
    if (b.value === 'save') {
      if (!d.text.trim()) { $('#ea-text').focus(); return; }
      if (d.rule.type === 'every' && !d.rule.anchor) d.rule.anchor = now;
      if (a) { a.text = d.text.trim(); a.cue = d.cue.trim(); a.small = d.small.trim(); a.up = d.up.trim(); const old = M.ruleFor(a, now); if (JSON.stringify(Object.assign({}, old, { from: 0 })) !== JSON.stringify(Object.assign({}, d.rule, { from: 0 }))) M.changeSchedule(a, now, d.rule); }
      else f.actions.push({ id: uid(), text: d.text.trim(), cue: d.cue.trim(), small: d.small.trim(), up: d.up.trim(), from: now, schedules: [Object.assign({ from: now }, d.rule)], entries: {} });
      save(); sheet.close(); render();
    }
  };
  paint(); sheet.showModal();
}

// ---------- Setup ----------
// Step 1 what you want to work on (messy words welcome), 2 the actions, 3 review and start.
function draft() { if (!S.draft) S.draft = { step: 1, intent: '', title: '', why: '', actions: [], tasks: [], length: 30, start: M.today() }; return S.draft; }
function renderSetup() {
  const d = draft();
  const bar = '<div class="steps" aria-label="Step ' + d.step + ' of 3">' + [1, 2, 3].map(i => '<span class="' + (i <= d.step ? 'on' : '') + '"></span>').join('') + '</div>';
  let h = '';
  if (d.step === 0 || (!S.started && d.step === 1 && !d.intent)) {
    h = '<div style="padding-top:12px"><div class="eyebrow">Welcome to ' + brand + '</div><h1 style="margin-top:8px">Turn what matters into a plan you’ll actually follow.</h1></div>' +
      '<p class="lead">Tell us what you want to work on, in your own words. We’ll shape it into small actions, show you what’s on each day, and help you keep going when life gets in the way.</p>' +
      '<button class="btn" data-s="begin">Let’s go</button><button class="btn outline" data-s="sample">Take a look around first</button>' +
      '<p class="hint">Version 2 preview. Saved on this phone only for now.</p>';
  } else if (d.step === 1) {
    h = bar + '<div><div class="eyebrow">Step 1 of 3</div><h1>What do you want to work on?</h1></div>' +
      '<p class="lead">Something you want more of, or something you’re fed up with. Write or speak it however it comes out. Messy is fine.</p>' +
      '<label class="field"><span class="sr">What you want to work on</span><textarea rows="3" id="intent" placeholder="I feel unfit and sluggish. I want to stretch every day, lift weights every other day and play padel once a week">' + esc(d.intent) + '</textarea>' + micBtn('intent') + '</label>' +
      '<label class="field">Now picture it sorted. What’s different for you? <span class="hint" style="font-weight:400">This is what you’re moving towards.</span><textarea rows="2" id="why" placeholder="I feel strong in my body, I have energy for the kids and I enjoy moving again">' + esc(d.why) + '</textarea>' + micBtn('why') + '</label>' +
      '<label class="field">Give it a short name<textarea rows="1" id="title" placeholder="Feel stronger and move more">' + esc(d.title) + '</textarea></label>' +
      '<button class="btn" data-s="next1">Next: the actions</button>';
  } else if (d.step === 2) {
    if (!d.actions.length) d.actions.push(newDraftAction(''));
    h = bar + '<div><div class="eyebrow">Step 2 of 3</div><h1>What will you actually do?</h1></div>' +
      '<p class="lead">Split it into actions. Each one gets its own days.</p>' +
      (d.intent ? '<div class="card soft"><span class="hint">You wrote</span><p>“' + esc(d.intent) + '”</p></div>' : '') +
      d.actions.map((a, i) => '<div class="actionedit"><div class="row"><h2>Action ' + (i + 1) + '</h2>' + (d.actions.length > 1 ? '<button class="x" data-s="rm" data-i="' + i + '" aria-label="Remove action ' + (i + 1) + '">×</button>' : '') + '</div>' +
        '<label class="field">I’m going to...<textarea rows="1" data-f="text" data-i="' + i + '" placeholder="' + ['Stretch for 10 minutes', 'Do a weights session', 'Play padel'][i % 3] + '">' + esc(a.text) + '</textarea></label>' +
        '<div style="font-weight:600">How often</div>' + ruleUI(a.rule, 'd' + i) +
        '<label class="field">Smaller version for tough days<textarea rows="1" data-f="small" data-i="' + i + '" placeholder="' + ['Stretch for 2 minutes', 'One set of each exercise', 'Have a hit against the wall'][i % 3] + '">' + esc(a.small) + '</textarea></label>' +
        '<label class="field">After I... <span class="hint" style="font-weight:400">(optional)</span><textarea rows="1" data-f="cue" data-i="' + i + '" placeholder="make my morning coffee">' + esc(a.cue) + '</textarea></label>' +
        '<details class="more"><summary>Turn it up on a good day (optional)</summary><label class="field"><span class="sr">Turn it up</span><textarea rows="1" data-f="up" data-i="' + i + '" placeholder="' + ['Stretch for 20 minutes', 'Add an extra set', 'Play a full match'][i % 3] + '">' + esc(a.up || '') + '</textarea></label><p class="hint">Up for more on a good day? Make it more challenging if you fancy it, and notice what you notice. If you stop showing up, turn the volume back down so you can get back in.</p></details></div>').join('') +
      '<button class="btn outline" data-s="add">Add another action</button>' +
      '<label class="field">Anything to sort out first? <span class="hint" style="font-weight:400">(optional, one per line)</span><textarea rows="2" id="tasks" placeholder="Find a padel court near me">' + esc(d.tasks.join('\n')) + '</textarea></label>' +
      '<button class="btn" data-s="next2">Next: check your plan</button><button class="link" data-s="back">Back</button>';
  } else {
    h = bar + '<div><div class="eyebrow">Step 3 of 3</div><h1>Here’s your plan</h1></div>' +
      '<section class="card hero"><div class="eyebrow">My focus</div><h1>' + esc(d.title) + '</h1>' + (d.why ? '<p style="color:#D9D4CA">Moving towards: ' + esc(d.why) + '</p>' : '') + '</section>' +
      d.actions.map(a => '<div class="card"><strong>' + esc(a.text) + '</strong><span class="hint">' + esc(M.describe(a.rule)) + (a.cue ? ' · After I ' + esc(a.cue) : '') + '</span>' + (a.small ? '<span class="hint">Tough day: ' + esc(a.small) + '</span>' : '') + (a.up ? '<span class="hint">Good day: ' + esc(a.up) + '</span>' : '') + '</div>').join('') +
      (d.tasks.length ? '<div class="card soft"><strong>To sort out</strong>' + d.tasks.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' : '') +
      '<div class="stack" style="gap:8px"><div style="font-weight:600">Start</div><div class="chips"><button class="chip" data-s="start" data-v="today" aria-pressed="' + (d.start === M.today()) + '">Today</button><button class="chip" data-s="start" data-v="tomorrow" aria-pressed="' + (d.start === M.addDays(M.today(), 1)) + '">Tomorrow</button></div></div>' +
      '<div class="stack" style="gap:8px"><div style="font-weight:600">Look back after</div><div class="chips">' + [30, 60, 90].map(n => '<button class="chip" data-s="len" data-v="' + n + '" aria-pressed="' + (d.length === n) + '">' + n + ' days</button>').join('') + '</div><p class="hint">A review point, not a finish line. You can keep going.</p></div>' +
      '<button class="btn" data-s="go">Start my plan</button><button class="link" data-s="back">Back</button>';
  }
  main.innerHTML = h;
  main.querySelectorAll('textarea').forEach(grow);
}
function newDraftAction(text) { return { text: text || '', small: '', cue: '', up: '', rule: { type: 'days', days: [0, 1, 2, 3, 4, 5, 6] } }; }
function keepDraft() {
  const d = draft();
  ['intent', 'title', 'why'].forEach(k => { const el = $('#' + k); if (el) d[k] = el.value; });
  main.querySelectorAll('textarea[data-f]').forEach(el => { d.actions[+el.dataset.i][el.dataset.f] = el.value; });
  const t = $('#tasks'); if (t) d.tasks = t.value.split('\n').map(x => x.trim()).filter(Boolean);
}
main.addEventListener('click', e => {
  if (S.focus) return;
  const b = e.target.closest('button'); if (!b) return;
  const d = draft(); keepDraft();
  if (b.dataset.for && b.dataset.for[0] === 'd') { const i = +b.dataset.for.slice(1); d.actions[i].rule = applyRuleClick(b, d.actions[i].rule); save(); renderSetup(); return; }
  const s = b.dataset.s;
  if (s === 'begin') { S.started = true; d.step = 1; }
  if (s === 'sample') { S.sample = true; S.focus = sampleFocus(); S.tab = 'today'; save(); render(); return; }
  if (s === 'next1') {
    if (!d.intent.trim() && !d.title.trim()) { $('#intent').focus(); return toast('Write a few words first.'); }
    if (!d.title.trim()) d.title = d.intent.trim().split(/[.:;\n]/)[0].slice(0, 60);
    d.step = 2;
  }
  if (s === 'add') d.actions.push(newDraftAction(''));
  if (s === 'rm') d.actions.splice(+b.dataset.i, 1);
  if (s === 'next2') {
    d.actions = d.actions.filter(a => a.text.trim());
    if (!d.actions.length) { d.actions.push(newDraftAction('')); save(); renderSetup(); return toast('Add at least one action.'); }
    d.step = 3;
  }
  if (s === 'back') d.step = Math.max(1, d.step - 1);
  if (s === 'start') d.start = b.dataset.v === 'today' ? M.today() : M.addDays(M.today(), 1);
  if (s === 'len') d.length = +b.dataset.v;
  if (s === 'go') {
    S.focus = { id: uid(), title: d.title.trim(), why: d.why.trim(), intent: d.intent.trim(), start: d.start, length: d.length, pauses: [], worked: [],
      tasks: d.tasks.map(t => ({ id: uid(), text: t, done: false })),
      actions: d.actions.map(a => { const r = Object.assign({}, a.rule); if (r.type === 'every' && !r.anchor) r.anchor = d.start; return { id: uid(), text: a.text.trim(), small: a.small.trim(), up: (a.up || '').trim(), cue: a.cue.trim(), schedules: [Object.assign({ from: d.start }, r)], entries: {} }; }) };
    S.draft = null; S.sample = false; S.tab = 'today'; save(); render(); toast('Your plan is ready. Let’s go.'); return;
  }
  save(); renderSetup(); window.scrollTo(0, 0);
});

// A clearly labelled sample, with two weeks of made-up history, so people can look around.
function sampleFocus() {
  const now = M.today(), start = M.addDays(now, -15);
  const f = { id: 'sample', title: 'Feel stronger and move more', why: 'feeling strong, more energy and enjoying moving again', start, length: 30, pauses: [], worked: [{ at: now, kind: 'start', text: 'Laying my mat out the night before' }],
    tasks: [{ id: 't1', text: 'Find a padel court near me', done: false }, { id: 't2', text: 'Choose a 10 minute stretch routine', done: true }],
    actions: [
      { id: 'a1', text: 'Stretch for 10 minutes', small: 'Stretch for 2 minutes', up: 'Stretch for 20 minutes', cue: 'make my morning coffee', schedules: [{ from: start, type: 'days', days: [0, 1, 2, 3, 4, 5, 6] }], entries: {} },
      { id: 'a2', text: 'Do a weights session', small: 'One set of each exercise', up: 'Add an extra set', cue: 'get home from work', schedules: [{ from: start, type: 'every', n: 2, anchor: start }], entries: {} },
      { id: 'a3', text: 'Play padel', small: 'Have a hit against the wall', cue: '', schedules: [{ from: start, type: 'weekly', times: 1 }], entries: {} }] };
  const pat = [1, 1, 0, 1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 1, 0];
  for (let i = 0; i < 15; i++) {
    const k = M.addDays(start, i);
    f.actions.forEach((a, j) => { if (!M.isDue(f, a, k)) return; const v = pat[(i + j) % pat.length]; if (v) a.entries[k] = { kind: v === 2 ? 'small' : 'full', at: k }; });
    if (M.weekday(k) === 6 && i < 14) f.actions[2].entries[k] = { kind: 'full', at: k };
  }
  return f;
}

sheet.addEventListener('close', () => { sheet.onclick = null; });
render();
