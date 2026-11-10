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
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    // A dated schedule change never claims completions from another schedule segment.
    if (!inRange(f, a, d) || isPaused(f, d) || ruleFor(a, d) !== r) continue;
    open++; if (d <= now && counted(entry(a, d))) done++;
  }
  return { target: open ? Math.min(r.times, open) : 0, done };
}

// Count dated activity independently from planned opportunities. An extra never becomes planned.
// Fixed schedules count up to yesterday (today once logged). Flexible targets count once per finished week, and what's done so far this week.
function tally(f, from, to, now = today()) {
  const out = { planned: 0, full: 0, small: 0, skip: 0, unlogged: 0, rest: 0, paused: 0 };
  const last = to < now ? to : now;
  for (const a of f.actions) {
    const weeks = new Map();
    for (let k = from; k <= last; k = addDays(k, 1)) {
      if (!inRange(f, a, k)) continue;
      const e = entry(a, k), s = dayState(f, a, k, now);
      if (counted(e)) out[e.kind]++;
      if (isPaused(f, k)) { out.paused++; continue; }
      if (isWeekly(a, k)) { weeks.set(weekStart(k) + '|' + ruleFor(a, k).from, k); if (e && e.kind === 'skip') out.skip++; continue; }
      if (isDue(f, a, k)) {
        // Today only counts as planned once it's logged: an unticked today is never held against anyone (Stu, 10 Nov 2026).
        if (k >= now && !counted(e) && !(e && e.kind === 'skip')) continue;
        out.planned++;
        if (e && e.kind === 'skip') out.skip++;
        else if (!counted(e) && k < now) out.unlogged++;
      } else if (!counted(e)) out.rest++;
    }
    for (const [key, ref] of weeks) {
      const ws = key.split('|')[0];
      const p = weeklyProgress(f, a, ref, now); if (!p) continue;
      // A week still in progress only counts what's been done so far; a finished week counts its whole target.
      if (addDays(ws, 6) < now) { out.planned += p.target; out.unlogged += Math.max(0, p.target - p.done); }
      else out.planned += Math.min(p.done, p.target);
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
  if (!counted(entry(a, k))) return false;
  if (isWeekly(a, k)) {
    const ws = weekStart(k);
    for (let d = ws; d < k; d = addDays(d, 1)) if (counted(entry(a, d))) return false;
    let gap = false;
    for (let w = addDays(ws, -7), n = 0; n < 104 && addDays(w, 6) >= f.start; w = addDays(w, -7), n++) {
      let ref = null, did = false;
      for (let i = 0; i < 7; i++) { const d = addDays(w, i); if (!inRange(f, a, d) || isPaused(f, d)) continue; if (isWeekly(a, d)) ref = d; if (counted(entry(a, d))) did = true; }
      if (did && gap) return true;
      if (ref) { const p = weeklyProgress(f, a, ref, now); if (p.target && p.done < p.target) gap = true; else if (p.done >= p.target && p.target) return false; }
    }
    return false;
  }
  let gap = 0, before = false;
  for (let d = addDays(k, -1), i = 0; i < 60 && d >= f.start; d = addDays(d, -1), i++) {
    if (!isDue(f, a, d)) continue;
    if (counted(entry(a, d))) { before = true; break; }
    gap++;
  }
  return gap > 0 && before;
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

// ── Patterns: gentle, honest links worth noticing ─────────────────────────
// Self-tracking research: people want these links but small samples throw up false ones,
// so we only speak when there's enough data and the difference is large and unlikely to be chance.
// Only days where the person logged something count: a blank day is "not logged", never "didn't".
const PAT = { minDays: 21, minGroup: 5, minDiff: 0.3, maxP: 0.02, minWeekday: 4, minWeekdayDiff: 0.4, maxWeekdayP: 0.01 };
function lfact(n) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; }
// Two-sided Fisher exact test for a 2x2 table [[a,b],[c,d]].
function fisher(a, b, c, d) {
  const r1 = a + b, r2 = c + d, c1 = a + c, n = r1 + r2;
  const pr = x => Math.exp(lfact(r1) + lfact(r2) + lfact(c1) + lfact(n - c1) - lfact(n) - lfact(x) - lfact(r1 - x) - lfact(c1 - x) - lfact(r2 - c1 + x));
  const p0 = pr(a); let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) { const q = pr(x); if (q <= p0 * (1 + 1e-7)) p += q; }
  return Math.min(1, p);
}
function patterns(f, now = today(), acts) {
  acts = acts || f.actions || [];
  const last = endDate(f) < now ? endDate(f) : now, out = { ready: false, daysLeft: 0, links: [], weekday: null };
  const days = diffDays(last, f.start) + 1;
  if (days < PAT.minDays) { out.daysLeft = PAT.minDays - Math.max(0, days); return out; }
  out.ready = true;
  // Logged days: any entry of any kind in this focus that day, not paused.
  const logged = [];
  for (let k = f.start; k <= last; k = addDays(k, 1)) if (!isPaused(f, k) && acts.some(a => inRange(f, a, k) && entry(a, k) && entry(a, k).kind !== 'none')) logged.push(k);
  const live = (a, k) => inRange(f, a, k) && (isDue(f, a, k) || isWeekly(a, k));
  // Links between two actions on the same day.
  const found = [];
  for (const A of acts) for (const B of acts) {
    if (A === B) continue;
    let yy = 0, yn = 0, ny = 0, nn = 0;
    for (const k of logged) {
      if (!isDue(f, A, k) || !live(B, k)) continue;
      const a = counted(entry(A, k)), b = counted(entry(B, k));
      if (a) { if (b) yy++; else yn++; } else { if (b) ny++; else nn++; }
    }
    const g1 = yy + yn, g0 = ny + nn; if (g1 < PAT.minGroup || g0 < PAT.minGroup) continue;
    const r1 = yy / g1, r0 = ny / g0; if (r1 - r0 < PAT.minDiff) continue;
    const p = fisher(yy, yn, ny, nn); if (p > PAT.maxP) continue;
    found.push({ a: A.id, b: B.id, with: [yy, g1], without: [ny, g0], diff: r1 - r0, p });
  }
  // Keep the clearest link per pair of actions, then the two clearest overall.
  found.sort((x, y) => x.p - y.p || y.diff - x.diff);
  const seen = new Set();
  for (const x of found) { const key = [x.a, x.b].sort().join('|'); if (seen.has(key)) continue; seen.add(key); out.links.push(x); if (out.links.length === 2) break; }
  // Days of the week: across all planned (non-weekly) action-days that have passed.
  const wd = [0, 1, 2, 3, 4, 5, 6].map(() => [0, 0]);
  for (const a of acts) for (let k = f.start; k <= last; k = addDays(k, 1)) {
    if (!isDue(f, a, k) || (k === now && !counted(entry(a, k)))) continue;
    wd[weekday(k)][1]++; if (counted(entry(a, k))) wd[weekday(k)][0]++;
  }
  const ok = wd.map((x, i) => ({ d: i, done: x[0], of: x[1], r: x[1] ? x[0] / x[1] : 0 })).filter(x => x.of >= PAT.minWeekday);
  // A day stands out only against all the other days together, corrected for checking seven days.
  if (ok.length >= 2) {
    const tot = ok.reduce((t, x) => [t[0] + x.done, t[1] + x.of], [0, 0]);
    const vsRest = x => { const rd = tot[0] - x.done, ro = tot[1] - x.of; return { diff: x.r - (ro ? rd / ro : 0), p: fisher(x.done, x.of - x.done, rd, ro - rd) }; };
    ok.sort((x, y) => y.r - x.r || y.of - x.of);
    const best = ok[0], low = ok[ok.length - 1], b = vsRest(best), l = vsRest(low);
    const pick = [b.diff >= PAT.minWeekdayDiff / 2 && b.p <= PAT.maxWeekdayP ? 'best' : '', -l.diff >= PAT.minWeekdayDiff / 2 && l.p <= PAT.maxWeekdayP ? 'low' : ''];
    if (best.r - low.r >= PAT.minWeekdayDiff && (pick[0] || pick[1])) out.weekday = { best, low };
  }
  return out;
}

const api = { patterns, fisher, PAT, dateKey, today, parseDate, addDays, diffDays, weekday, weekStart, endDate, ruleFor, isPaused, inRange, isDue, isWeekly, entry, counted, dayState, weeklyProgress, tally, weeklySeries, todayList, nextDue, isComeback, changeSchedule, describe };
root.LGM = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
