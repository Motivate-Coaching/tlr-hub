// ── TLR Auth Layer ─────────────────────────────────────────────
const SUPABASE_URL = 'https://tsusrzkpzevpiuvsppls.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdXNyemtwemV2cGl1dnNwcGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NDAzMzUsImV4cCI6MjEwMTMxNjMzNX0.UQD9BaOjYWNOEVeV3QCF2sdlNc9SYJ2PrcZgpCtlQ8s';

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// _logToSupabase — internal helper; actually awaits the insert so it executes
async function _logToSupabase(row) {
  try {
    await _supabase.from('activity_log').insert(row);
  } catch (e) {
    // silently ignore network errors — never block the page
  }
}

// _backupAllTools — sweeps every tlr-* key in localStorage and upserts to Supabase
// Called on page hide so tools that don't explicitly call saveProgress are still covered
async function _backupAllTools() {
  try {
    const { data: { session } } = await _supabase.auth.getSession();
    if (!session) return;
    const uid = session.user.id;
    const saves = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Only back up tool data keys (tlr-*); skip derived/meta keys
      if (!key || !key.startsWith('tlr-')) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const toolData = JSON.parse(raw);
        if (!toolData || typeof toolData !== 'object') continue;
        saves.push(
          _supabase.from('member_progress').upsert(
            {
              user_id: uid,
              tool_id: key,
              completed: !!toolData._completed,
              data: toolData,
              last_updated: toolData.lastSaved || new Date().toISOString()
            },
            { onConflict: 'user_id,tool_id' }
          )
        );
      } catch(e) { /* skip malformed entries silently */ }
    }
    if (saves.length) await Promise.allSettled(saves);
  } catch(e) { /* never surface backup errors to the user */ }
}

// requireAuth — call on any protected page; redirects to login if no session
async function requireAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.replace('login.html'); return null; }

  const page = window.location.pathname.split('/').pop().replace('.html', '') || 'home';

  // Log page view
  void _logToSupabase({
    user_id: session.user.id,
    user_email: session.user.email,
    event_type: 'page_view',
    page: page
  });

  // Track time on page — log page_exit with duration_seconds on leave
  const _pageStart = Date.now();
  let _exitLogged = false;
  const _logExit = () => {
    if (_exitLogged) return;
    _exitLogged = true;
    const duration = Math.round((Date.now() - _pageStart) / 1000);
    if (duration < 3) return; // ignore accidental bounces
    void _logToSupabase({
      user_id: session.user.id,
      user_email: session.user.email,
      event_type: 'page_exit',
      page: page,
      metadata: { duration_seconds: duration }
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      _logExit();
      void _backupAllTools(); // belt-and-suspenders: back up all tool data on every page hide
    }
  });
  window.addEventListener('beforeunload', _logExit);

  return session.user;
}

// logActivity — call for specific events (tool complete, game play, etc.)
async function logActivity(eventType, page, metadata = {}) {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return;
  void _logToSupabase({
    user_id: session.user.id,
    user_email: session.user.email,
    event_type: eventType,
    page: page,
    metadata: metadata
  });
}

async function getUser() {
  const { data: { session } } = await _supabase.auth.getSession();
  return session ? session.user : null;
}

async function signOut() {
  await _supabase.auth.signOut();
  window.location.replace('login.html');
}

// saveProgress — upsert a tool result to Supabase + keep localStorage in sync
async function saveProgress(toolId, completed, data = {}) {
  const user = await getUser();
  if (!user) return;
  if (completed) {
    const done = JSON.parse(localStorage.getItem('tlr_completed') || '[]');
    if (!done.includes(toolId)) { done.push(toolId); localStorage.setItem('tlr_completed', JSON.stringify(done)); }
  }
  try {
    await _supabase.from('member_progress').upsert(
      { user_id: user.id, tool_id: toolId, completed, data, last_updated: new Date().toISOString() },
      { onConflict: 'user_id,tool_id' }
    );
  } catch (e) { /* silently ignore */ }
}

// loadProgress — pull all progress from Supabase, restore to localStorage, return rows
// This runs on every page load and acts as the cross-device restore mechanism:
// — if localStorage is missing or older than Supabase, Supabase wins
// — individual tool pages can then read from localStorage as normal
async function loadProgress() {
  const user = await getUser();
  if (!user) return null;
  try {
    const { data } = await _supabase.from('member_progress').select('*').eq('user_id', user.id);
    if (!data) return null;

    // Rebuild the completed list from Supabase as the authoritative source
    localStorage.setItem('tlr_completed', JSON.stringify(
      data.filter(r => r.completed).map(r => r.tool_id)
    ));

    // Restore each tool's data to localStorage if local copy is absent or older
    data.forEach(row => {
      if (!row.tool_id || !row.data || typeof row.data !== 'object') return;
      try {
        const localRaw = localStorage.getItem(row.tool_id);
        const local    = localRaw ? JSON.parse(localRaw) : null;
        const localTs  = local && local.lastSaved ? new Date(local.lastSaved) : new Date(0);
        const remoteTs = row.last_updated          ? new Date(row.last_updated) : new Date(0);
        if (!local || remoteTs > localTs) {
          // Supabase is newer — restore to localStorage so the tool page sees it instantly next time
          const restored = { ...row.data, _completed: !!row.completed };
          if (row.last_updated) restored.lastSaved = row.last_updated;
          localStorage.setItem(row.tool_id, JSON.stringify(restored));
        }
      } catch(e) { /* never let one bad row break the rest */ }
    });

    return data;
  } catch (e) { return null; }
}

// showUserBadge — inject first name + sign-out into a CSS selector
function showUserBadge(selector) {
  getUser().then(user => {
    if (!user) return;
    const el = document.querySelector(selector);
    if (!el) return;
    // Extract first name: try metadata fields, fall back to email prefix
    const meta = user.user_metadata || {};
    let firstName = meta.first_name || meta.name || meta.full_name || '';
    if (!firstName && user.email) firstName = user.email.split('@')[0].split('.')[0];
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    const initials = firstName.charAt(0).toUpperCase();
    el.innerHTML = `<span style="display:flex;align-items:center;gap:0.6rem;">
      <span style="background:var(--gold,#E8A800);color:#111;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;">${initials}</span>
      <span style="font-size:0.8rem;color:rgba(255,255,255,0.75);font-weight:500;">${firstName}</span>
      <button onclick="signOut()" style="background:none;border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.45);padding:0.2rem 0.6rem;border-radius:3px;cursor:pointer;font-size:0.62rem;letter-spacing:0.05em;text-transform:uppercase;">Sign out</button>
    </span>`;
  });
}
