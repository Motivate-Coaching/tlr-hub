// history.js — TLR Worksheet Versioning
// Adds snapshot saving, history drawer, and clear-all to every tool page.
//
// Usage (inside requireAuth().then()):
//   TLRHistory.init(STORAGE_KEY, collectData, applyData);
//   — applyData may also be called populateData in some tools; pass whichever exists.

(function () {
  'use strict';

  // Shares the _supabase client already initialised by auth.js
  // (both scripts run in the same page scope, so _supabase is accessible here)

  let _toolKey, _collectFn, _applyFn;

  // ── Public API ────────────────────────────────────────────────────────
  window.TLRHistory = {
    init(toolKey, collectFn, applyFn) {
      _toolKey  = toolKey;
      _collectFn = collectFn;
      _applyFn   = applyFn;
      _injectStyles();
      _injectButtons();
      _injectModals();
    },
    promptSave()  { _showNameDialog(); },
    showHistory() { _loadAndShowHistory(); },
    clearAll()    { _confirmAndClear(); }
  };

  // ── Supabase helpers ──────────────────────────────────────────────────
  async function _getUserId() {
    const { data: { session } } = await _supabase.auth.getSession();
    return session ? session.user.id : null;
  }

  async function _saveSnapshot(label, data, completed) {
    const uid = await _getUserId();
    if (!uid) return;
    const { error } = await _supabase.from('tool_snapshots').insert({
      user_id:    uid,
      tool_key:   _toolKey,
      label:      label || null,
      data:       data,
      completed:  !!completed,
      created_at: new Date().toISOString()
    });
    if (error) console.error('[TLRHistory] save error:', error.message);
  }

  async function _loadSnapshots() {
    const uid = await _getUserId();
    if (!uid) return [];
    const { data, error } = await _supabase
      .from('tool_snapshots')
      .select('*')
      .eq('user_id', uid)
      .eq('tool_key', _toolKey)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) { console.error('[TLRHistory] load error:', error.message); return []; }
    return data || [];
  }

  // ── Styles ────────────────────────────────────────────────────────────
  function _injectStyles() {
    if (document.getElementById('tlr-history-styles')) return;
    const s = document.createElement('style');
    s.id = 'tlr-history-styles';
    s.textContent = `
/* ── History row ── */
.tlr-history-row{width:100%;display:flex;gap:0.65rem;justify-content:center;flex-wrap:wrap;margin-top:0.75rem;padding-top:0.85rem;border-top:1px solid rgba(0,0,0,0.07)}
.tlr-history-btn{background:transparent;color:var(--text-muted,#8A8880);border:1.5px solid rgba(0,0,0,0.12);padding:0.6rem 1.2rem;border-radius:9px;font-family:var(--font-body,sans-serif);font-size:0.84rem;font-weight:500;cursor:pointer;transition:border-color .15s,color .15s,background .15s;display:inline-flex;align-items:center;gap:0.35rem;line-height:1}
.tlr-history-btn:hover{border-color:var(--accent,#1A6B72);color:var(--accent,#1A6B72);background:rgba(26,107,114,0.04)}
.tlr-clear-btn{background:transparent;color:rgba(0,0,0,0.26);border:1.5px solid rgba(0,0,0,0.09);padding:0.6rem 1.2rem;border-radius:9px;font-family:var(--font-body,sans-serif);font-size:0.82rem;font-weight:400;cursor:pointer;transition:border-color .15s,color .15s,background .15s}
.tlr-clear-btn:hover{border-color:rgba(200,50,50,0.35);color:rgba(170,30,30,0.8);background:rgba(200,50,50,0.04)}

/* ── Overlay backdrop ── */
.tlr-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.42);z-index:9000;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .22s;pointer-events:none}
.tlr-overlay.open{opacity:1;pointer-events:auto}
.tlr-overlay.center{align-items:center}

/* ── History drawer ── */
.tlr-drawer{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:680px;max-height:84vh;overflow-y:auto;padding:1.75rem 2rem 3rem;transform:translateY(100%);transition:transform .28s cubic-bezier(.25,.8,.25,1)}
.tlr-overlay.open .tlr-drawer{transform:translateY(0)}
.tlr-drawer-handle{width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 1.5rem}
.tlr-drawer-title{font-family:var(--font-display,'Playfair Display',Georgia,serif);font-size:1.4rem;color:var(--text-dark,#1A1A1A);margin-bottom:0.25rem}
.tlr-drawer-sub{font-size:0.83rem;color:var(--text-muted,#8A8880);margin-bottom:1.5rem;line-height:1.5}

/* ── Snapshot list ── */
.tlr-snap-list{display:flex;flex-direction:column;gap:0.6rem}
.tlr-snap-card{border:1.5px solid rgba(0,0,0,0.08);border-radius:12px;padding:0.9rem 1.2rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;cursor:pointer;transition:border-color .15s,background .15s}
.tlr-snap-card:hover{border-color:var(--accent,#1A6B72);background:rgba(26,107,114,0.03)}
.tlr-snap-meta{flex:1;min-width:0}
.tlr-snap-label{font-weight:600;font-size:0.88rem;color:var(--text-dark,#1A1A1A);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tlr-snap-date{font-size:0.76rem;color:var(--text-muted,#8A8880);margin-top:0.12rem}
.tlr-snap-badge{font-size:0.68rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;padding:0.18rem 0.6rem;border-radius:20px;flex-shrink:0;white-space:nowrap}
.tlr-snap-badge.done{background:#F0FAF5;color:#2A9D6F;border:1px solid rgba(42,157,111,0.25)}
.tlr-snap-badge.prog{background:#FFF8E8;color:#966A00;border:1px solid rgba(176,125,0,0.25)}
.tlr-snap-empty{text-align:center;padding:2.5rem 1rem;color:var(--text-muted,#8A8880);font-size:0.88rem;line-height:1.7}
.tlr-snap-empty-icon{font-size:2rem;margin-bottom:0.6rem}

/* ── Snapshot read-only view ── */
.tlr-snap-view-header{display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem}
.tlr-snap-view-back{background:transparent;border:1.5px solid rgba(0,0,0,0.1);color:var(--text-mid,#4A4A4A);padding:0.45rem 0.9rem;border-radius:7px;font-family:var(--font-body,sans-serif);font-size:0.8rem;cursor:pointer;transition:border-color .15s,color .15s}
.tlr-snap-view-back:hover{border-color:var(--accent,#1A6B72);color:var(--accent,#1A6B72)}
.tlr-snap-view-title{font-family:var(--font-display,'Playfair Display',Georgia,serif);font-size:1.1rem;color:var(--text-dark,#1A1A1A)}
.tlr-snap-view-meta{font-size:0.78rem;color:var(--text-muted,#8A8880);margin-bottom:1.5rem}
.tlr-snap-field{margin-bottom:0.85rem}
.tlr-snap-field-key{font-size:0.7rem;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:var(--text-muted,#8A8880);margin-bottom:0.28rem}
.tlr-snap-field-val{font-size:0.88rem;color:var(--text-dark,#1A1A1A);line-height:1.55;background:var(--cream,#F5F1EB);border-radius:8px;padding:0.55rem 0.8rem;white-space:pre-wrap;word-break:break-word}

/* ── Name dialog ── */
.tlr-name-dialog{background:#fff;border-radius:16px;width:calc(100% - 2.5rem);max-width:460px;padding:1.75rem;transform:translateY(16px) scale(0.97);transition:transform .24s cubic-bezier(.25,.8,.25,1),opacity .24s;opacity:0}
.tlr-overlay.open .tlr-name-dialog{transform:translateY(0) scale(1);opacity:1}
.tlr-dialog-title{font-family:var(--font-display,'Playfair Display',Georgia,serif);font-size:1.2rem;color:var(--text-dark,#1A1A1A);margin-bottom:0.35rem}
.tlr-dialog-sub{font-size:0.83rem;color:var(--text-muted,#8A8880);margin-bottom:1.2rem;line-height:1.5}
.tlr-dialog-input{width:100%;border:1.5px solid rgba(0,0,0,0.12);border-radius:8px;padding:0.75rem 0.95rem;font-family:var(--font-body,sans-serif);font-size:0.92rem;color:var(--text-dark,#1A1A1A);outline:none;transition:border-color .15s;margin-bottom:1.1rem;box-sizing:border-box}
.tlr-dialog-input:focus{border-color:var(--accent,#1A6B72)}
.tlr-dialog-input::placeholder{color:var(--text-muted,#8A8880)}
.tlr-dialog-btns{display:flex;gap:0.65rem;justify-content:flex-end}
.tlr-dialog-cancel{background:transparent;border:1.5px solid rgba(0,0,0,0.1);color:var(--text-muted,#8A8880);padding:0.6rem 1.2rem;border-radius:8px;font-family:var(--font-body,sans-serif);font-size:0.85rem;cursor:pointer;transition:all .15s}
.tlr-dialog-save{background:var(--navy,#0F1215);color:#fff;border:none;padding:0.6rem 1.4rem;border-radius:8px;font-family:var(--font-body,sans-serif);font-size:0.85rem;font-weight:600;cursor:pointer;transition:opacity .15s}
.tlr-dialog-save:hover{opacity:0.85}

/* ── Confirm (clear) dialog ── */
.tlr-confirm-dialog{background:#fff;border-radius:16px;width:calc(100% - 2.5rem);max-width:400px;padding:1.6rem;transform:translateY(16px) scale(0.97);transition:transform .24s cubic-bezier(.25,.8,.25,1),opacity .24s;opacity:0}
.tlr-overlay.open .tlr-confirm-dialog{transform:translateY(0) scale(1);opacity:1}
.tlr-confirm-title{font-size:0.95rem;font-weight:600;color:var(--text-dark,#1A1A1A);margin-bottom:0.45rem}
.tlr-confirm-msg{font-size:0.84rem;color:var(--text-mid,#4A4A4A);line-height:1.55;margin-bottom:1.2rem}
.tlr-confirm-btns{display:flex;gap:0.65rem;justify-content:flex-end}
.tlr-confirm-cancel{background:transparent;border:1.5px solid rgba(0,0,0,0.1);color:var(--text-muted,#8A8880);padding:0.55rem 1.1rem;border-radius:8px;font-family:var(--font-body,sans-serif);font-size:0.84rem;cursor:pointer}
.tlr-confirm-ok{background:#C83232;color:#fff;border:none;padding:0.55rem 1.1rem;border-radius:8px;font-family:var(--font-body,sans-serif);font-size:0.84rem;font-weight:600;cursor:pointer;transition:opacity .15s}
.tlr-confirm-ok:hover{opacity:0.85}

/* ── Toast ── */
#tlr-toast{position:fixed;bottom:1.75rem;left:50%;transform:translateX(-50%);background:rgba(15,18,21,0.88);color:#fff;padding:0.6rem 1.2rem;border-radius:24px;font-family:var(--font-body,sans-serif);font-size:0.84rem;z-index:9999;pointer-events:none;white-space:nowrap}

@media(max-width:600px){
  .tlr-drawer{padding:1.4rem 1.25rem 2.5rem}
  .tlr-name-dialog,.tlr-confirm-dialog{border-radius:16px}
}
    `;
    document.head.appendChild(s);
  }

  // ── Buttons (appended below the existing complete-wrap buttons) ───────
  function _injectButtons() {
    const wrap = document.querySelector('.complete-wrap');
    if (!wrap) return;

    const row = document.createElement('div');
    row.className = 'tlr-history-row';

    const histBtn = document.createElement('button');
    histBtn.className = 'tlr-history-btn';
    histBtn.innerHTML = _clockIcon() + ' My history';
    histBtn.onclick = () => TLRHistory.showHistory();

    const snapBtn = document.createElement('button');
    snapBtn.className = 'tlr-history-btn';
    snapBtn.innerHTML = _saveIcon() + ' Save this version';
    snapBtn.onclick = () => TLRHistory.promptSave();

    const clearBtn = document.createElement('button');
    clearBtn.className = 'tlr-clear-btn';
    clearBtn.textContent = 'Clear all fields';
    clearBtn.onclick = () => TLRHistory.clearAll();

    row.appendChild(histBtn);
    row.appendChild(snapBtn);
    row.appendChild(clearBtn);
    wrap.appendChild(row);
  }

  // ── Modal HTML ────────────────────────────────────────────────────────
  function _injectModals() {
    if (document.getElementById('tlr-history-overlays')) return;
    const el = document.createElement('div');
    el.id = 'tlr-history-overlays';
    el.innerHTML = `
<div class="tlr-overlay" id="tlr-hist-overlay" onclick="if(event.target===this)_tlrClose('tlr-hist-overlay')">
  <div class="tlr-drawer"><div class="tlr-drawer-handle"></div><div id="tlr-hist-content"></div></div>
</div>
<div class="tlr-overlay center" id="tlr-name-overlay" onclick="if(event.target===this)_tlrClose('tlr-name-overlay')">
  <div class="tlr-name-dialog">
    <div class="tlr-dialog-title">Save this version</div>
    <div class="tlr-dialog-sub">Give it a name so you can find it later — something like "September 2026", "After the redundancy", or "Starting fresh".</div>
    <input class="tlr-dialog-input" id="tlr-snap-label" type="text" placeholder="e.g. September 2026 (optional — leave blank to skip)" maxlength="80">
    <div class="tlr-dialog-btns">
      <button class="tlr-dialog-cancel" onclick="_tlrClose('tlr-name-overlay')">Cancel</button>
      <button class="tlr-dialog-save" onclick="_tlrDoSave()">Save version</button>
    </div>
  </div>
</div>
<div class="tlr-overlay center" id="tlr-clear-overlay" onclick="if(event.target===this)_tlrClose('tlr-clear-overlay')">
  <div class="tlr-confirm-dialog">
    <div class="tlr-confirm-title">Clear all fields?</div>
    <div class="tlr-confirm-msg">This will remove everything you've written on this page. Your saved versions are safe — this only clears what's on screen now.</div>
    <div class="tlr-confirm-btns">
      <button class="tlr-confirm-cancel" onclick="_tlrClose('tlr-clear-overlay')">Keep my work</button>
      <button class="tlr-confirm-ok" onclick="_tlrDoClear()">Yes, clear it</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(el);
  }

  // ── Global helpers (used by inline onclick attrs) ─────────────────────
  window._tlrClose = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  };

  function _open(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  // ── Name dialog flow ──────────────────────────────────────────────────
  function _showNameDialog() {
    const inp = document.getElementById('tlr-snap-label');
    if (inp) inp.value = '';
    _open('tlr-name-overlay');
    setTimeout(() => { if (inp) inp.focus(); }, 280);
  }

  window._tlrDoSave = async function () {
    const label = (document.getElementById('tlr-snap-label').value || '').trim();
    _tlrClose('tlr-name-overlay');
    const data = _collectFn ? _collectFn() : {};
    const completed = !!(data && data._completed);
    _showToast('Saving…');
    try {
      await _saveSnapshot(label, data, completed);
      _showToast(label ? '“' + label + '” saved' : 'Version saved');
    } catch (e) {
      _showToast('Could not save — check your connection');
    }
  };

  // ── History drawer ────────────────────────────────────────────────────
  async function _loadAndShowHistory() {
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    content.innerHTML = '<div class="tlr-drawer-title">My history</div><div class="tlr-drawer-sub">Loading…</div>';
    _open('tlr-hist-overlay');
    const snaps = await _loadSnapshots();
    window._tlrSnaps = {};
    snaps.forEach(s => { window._tlrSnaps[s.id] = s; });
    _renderList(snaps);
  }

  function _renderList(snaps) {
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    if (!snaps || snaps.length === 0) {
      content.innerHTML = `<div class="tlr-drawer-title">My history</div>
<div class="tlr-snap-empty"><div class="tlr-snap-empty-icon">📂</div>No saved versions yet.<br>Use <strong>Save this version</strong> to capture a snapshot of your work at any point.</div>`;
      return;
    }
    const cards = snaps.map(s => {
      const d = new Date(s.created_at);
      const ds = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const ts = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const lbl = _esc(s.label || 'Unnamed version');
      const bc = s.completed ? 'done' : 'prog';
      const bt = s.completed ? 'Complete' : 'In progress';
      return `<div class="tlr-snap-card" onclick="_tlrViewSnap('${_esc(s.id)}')"><div class="tlr-snap-meta"><div class="tlr-snap-label">${lbl}</div><div class="tlr-snap-date">${ds} at ${ts}</div></div><span class="tlr-snap-badge ${bc}">${bt}</span></div>`;
    }).join('');
    content.innerHTML = `<div class="tlr-drawer-title">My history</div><div class="tlr-drawer-sub">${snaps.length} saved version${snaps.length !== 1 ? 's' : ''} &mdash; tap one to read it</div><div class="tlr-snap-list">${cards}</div>`;
  }

  window._tlrViewSnap = function (id) {
    const snap = window._tlrSnaps && window._tlrSnaps[id];
    if (!snap) return;
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    const d = new Date(snap.created_at);
    const ds = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const ts = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const lbl = snap.label || 'Unnamed version';
    const skip = new Set(['_completed', 'lastSaved']);
    const data = snap.data || {};
    const fields = Object.entries(data)
      .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && String(v).trim())
      .map(([k, v]) => `<div class="tlr-snap-field"><div class="tlr-snap-field-key">${_esc(k.replace(/_/g, ' '))}</div><div class="tlr-snap-field-val">${_esc(String(v))}</div></div>`)
      .join('') || '<div style="color:var(--text-muted,#8A8880);font-size:0.85rem;padding:0.5rem 0">No text content in this version.</div>';
    content.innerHTML = `<div class="tlr-snap-view-header"><button class="tlr-snap-view-back" onclick="_tlrBackToList()">← Back</button><div class="tlr-snap-view-title">${_esc(lbl)}</div></div><div class="tlr-snap-view-meta">${ds} at ${ts} &nbsp;&middot;&nbsp; ${snap.completed ? 'Completed' : 'In progress'}</div>${fields}`;
  };

  window._tlrBackToList = function () {
    const snaps = Object.values(window._tlrSnaps || {}).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    _renderList(snaps);
  };

  // ── Clear all ─────────────────────────────────────────────────────────
  function _confirmAndClear() {
    _open('tlr-clear-overlay');
  }

  window._tlrDoClear = function () {
    _tlrClose('tlr-clear-overlay');
    // Clear all visible inputs and textareas
    document.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]), textarea').forEach(el => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Clear localStorage entry and completed flag
    if (_toolKey) {
      localStorage.removeItem(_toolKey);
      try {
        const done = JSON.parse(localStorage.getItem('tlr_completed') || '[]');
        const idx = done.indexOf(_toolKey);
        if (idx > -1) { done.splice(idx, 1); localStorage.setItem('tlr_completed', JSON.stringify(done)); }
      } catch (e) {}
    }
    // Remove the completed banner if it's showing
    const banner = document.getElementById('completed-banner');
    if (banner) banner.remove();
    // Trigger progress update if the page defines one
    if (typeof updateProgress === 'function') try { updateProgress(); } catch (e) {}
    _showToast('All fields cleared');
  };

  // ── Toast ─────────────────────────────────────────────────────────────
  function _showToast(msg) {
    const prev = document.getElementById('tlr-toast');
    if (prev) prev.remove();
    const t = document.createElement('div');
    t.id = 'tlr-toast';
    t.textContent = msg;
    t.style.cssText = 'opacity:0;transition:opacity .18s';
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 2500);
  }

  // ── SVG icons ─────────────────────────────────────────────────────────
  function _clockIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  }

  function _saveIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';
  }

  // ── Escape HTML ───────────────────────────────────────────────────────
  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

})();
