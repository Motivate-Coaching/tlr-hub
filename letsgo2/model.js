(function (root) {
'use strict';
// Let's Go! V2: dates, schedules and progress. Pure functions, no DOM, so they can be tested.
// A focus holds one or more actions. Each action has its own schedule, kept as versions
// so a change applies from a date onwards and never rewrites the past.
//
// Schedule rules:
//   { type: 'days', days: [1,3,5] }          set weekdays (0 Sunday ... 6 Saturday)
//   { type: 'every', n: 2, anchor: 'YYYY-MM-DD' }   every n days from an anchor date
//   { type: 'weekly', times: 1 }             a flexible number of times per week (weeks start Monday)
// Entry kinds: 'full' (did it), 'small' (did the smaller version), 'skip' (said it didn't happen).
// A planned day with no entry is "not logged", never assumed missed.

function dateKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const today = () => dateKey(new Date());
function parseDate(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); }
function addDays(k, n) { const d = parseDate(k); d.setDate(d.getDate() + n); return dateKey(d); }
function diffDays(a, b) { const u = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((u(a) - u(b)) / 864e5); }
function weekday(k) { return parseDate(k).getDay(); }
function weekStart(k) { const wd = (weekday(k) + 6) % 7; return addDays(k, -wd); }
function endDate(f) { return addDays(f.start, f.length - 1); }

function ruleFor(a, k) {
  const v = (a.schedules || []).filter(s => s.from <= k);
  return v.length ? v[v.length - 1] : (a.schedules || [])[0];
}
function isPaused(f, k) { return (f.pauses || []).some(p => k >= p.from && (!p.to || k <= p.to)); }
function inRange(f, a, k) { return k >= f.start && k <= endDate(f) && (!a.from || k >= a.from) && (!a.until || k <= a.until) && (!f.finishedOn || k <= f.finishedOn); }

// True when the action is planned for this exact day. Weekly targets are never "due" on a given day.
function isDue(f, a, k) {
  if (!inRange(f, a, k) || isPaused(f, k)) return false;
  const r = ruleFor(a, k); if (!r) return false;
  if (r.type === 'days') return r.days.includes(weekday(k));
  if (r.type === 'every') { const d = diffDays(k, r.anchor || f.start); return d >= 0 && d % r.n === 0; }
  return false;
}
function isWeekly(a, k) { const r = ruleFor(a, k); return !!r && r.type === 'weekly'; }
function entry(a, k) { return (a.entries || {})[k]; }
function counted(e) { return !!e && (e.kind === 'full' || e.kind === 'small'); }

// What a single day looks like for one action.
function dayState(f, a, k, now = today()) {
  if (!inRange(f, a, k)) return 'outside';
  const e = entry(a, k);
  if (counted(e)) return e.kind;
  if (k > now) return isPaused(f, k) ? 'paused' : (isDue(f, a, k) ? 'planned' : (isWeekly(a, k) ? 'open' : 'rest'));
  if (isPaused(f, k)) return 'paused';
  if (isWeekly(a, k)) return e && e.kind === 'skip' ? 'skip' : 'open';
  if (!isDue(f, a, k)) return 'rest';
  if (e && e.kind === 'skip') return 'skip';
  return k === now ? 'today' : 'unlogged';
}

// Weekly target for one action in the week containing k, as { target, done }.
function weeklyProgress(f, a, k, now = today()) {
  const ws = weekStart(k), r = ruleFor(a, k); if (!r || r.type !== 'weekly') return null;
  let done = 0, open = 0;
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (!inRange(f, a, d) || isPaused(f, d)) continue; open++; if (counted(entry(a, d))) done++; }
  return { target: open ? Math.min(r.times, open) : 0, done };
}

// Planned opportunities in a date range, up to "now". Weekly targets count as their target per week.
function tally(f, from, to, now = today()) {
  const out = { planned: 0, full: 0, small: 0, skip: 0, unlogged: 0, rest: 0, paused: 0 };
  const last = to < now ? to : now;
  for (const a of f.actions) {
    const weeks = new Set();
    for (let k = from; k <= last; k = addDays(k, 1)) {
      if (!inRange(f, a, k)) continue;
      const s = dayState(f, a, k, now);
      if (s === 'paused') { out.paused++; continue; }
      if (isWeekly(a, k)) { weeks.add(weekStart(k)); continue; }
      if (s === 'rest') { if (counted(entry(a, k))) { out[entry(a, k).kind]++; } else out.rest++; continue; }
      out.planned++;
      if (s === 'full' || s === 'small') out[s]++; else if (s === 'skip') out.skip++; else if (s === 'unlogged') out.unlogged++;
    }
    for (const ws of weeks) {
      const p = weeklyProgress(f, a, ws, now); if (!p) continue;
      const weekOver = addDays(ws, 6) < now;
      let full = 0, small = 0;
      for (let i = 0; i < 7; i++) { const e = entry(a, addDays(ws, i)); if (e && e.kind === 'full') full++; if (e && e.kind === 'small') small++; }
      out.planned += p.target; out.full += Math.min(full, p.target); out.small += Math.max(0, Math.min(small, p.target - full));
      const short = p.target - Math.min(p.done, p.target); if (short > 0) { if (weekOver) out.unlogged += short; else out.planned -= short; }
    }
  }
  out.done = out.full + out.small;
  return out;
}

// One bar per week from the start: done (full + smaller) against planned. Used for the progress graph.
function weeklySeries(f, now = today()) {
  const out = [], end = endDate(f) < now ? endDate(f) : now;
  for (let ws = weekStart(f.start); ws <= end; ws = addDays(ws, 7)) {
    const from = ws < f.start ? f.start : ws, to = addDays(ws, 6);
    const t = tally(f, from, to, now);
    out.push({ week: ws, planned: t.planned, full: t.full, small: t.small, done: t.done });
  }
  return out;
}

// Today's list: actions due today, then weekly targets still open this week.
function todayList(f, now = today()) {
  const due = [], weekly = [];
  for (const a of f.actions) {
    if (!inRange(f, a, now) || isPaused(f, now)) continue;
    if (isDue(f, a, now) || (counted(entry(a, now)) && !isWeekly(a, now))) due.push(a);
    else if (isWeekly(a, now)) { const p = weeklyProgress(f, a, now, now); if (p && (p.done < p.target || counted(entry(a, now)))) weekly.push({ a, p }); }
  }
  return { due, weekly };
}

// Next planned day for an action after a date.
function nextDue(f, a, after = today()) {
  for (let k = addDays(after, 1), i = 0; i < 400 && k <= endDate(f); k = addDays(k, 1), i++) if (isDue(f, a, k)) return k;
  return null;
}

// A comeback: a counted day after at least one planned day that wasn't counted, having counted before.
function isComeback(f, a, k, now = today()) {
  let gap = 0, before = false;
  for (let d = addDays(k, -1), i = 0; i < 60 && d >= f.start; d = addDays(d, -1), i++) {
    if (!isDue(f, a, d)) continue;
    if (counted(entry(a, d))) { before = true; break; }
    gap++;
  }
  return gap > 0 && before && counted(entry(a, k));
}

// Change an action's schedule from a date onwards. Past days keep the rule that applied then.
function changeSchedule(a, from, rule) {
  const keep = (a.schedules || []).filter(s => s.from < from);
  a.schedules = keep.concat([Object.assign({ from }, rule)]);
  return a;
}

// Short human description of a rule, for plan screens and reminders.
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function describe(r) {
  if (!r) return '';
  if (r.type === 'weekly') return r.times === 1 ? 'Once a week, any day' : r.times + ' times a week, any days';
  if (r.type === 'every') return r.n === 2 ? 'Every other day' : 'Every ' + r.n + ' days';
  const d = [...r.days].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7));
  if (d.length === 7) return 'Every day';
  if (d.join() === '1,2,3,4,5') return 'Weekdays';
  if (d.join() === '6,0') return 'Weekends';
  return d.map(x => DN[x]).join(', ');
}

const api = { dateKey, today, parseDate, addDays, diffDays, weekday, weekStart, endDate, ruleFor, isPaused, inRange, isDue, isWeekly, entry, counted, dayState, weeklyProgress, tally, weeklySeries, todayList, nextDue, isComeback, changeSchedule, describe };
root.LGM = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
