// history.js — TLR Worksheet Versioning
// Adds snapshot saving, history drawer, and clear-all to every tool page.
//
// Usage (inside requireAuth().then()):
//   TLRHistory.init(STORAGE_KEY, collectData, applyData);
//   — applyData may also be called populateData in some tools; pass whichever exists.

(function () {
  'use strict';

  // Uses saveSnapshot() and loadSnapshots() defined in auth.js,
  // which share the same authenticated _supabase client.

  let _toolKey, _collectFn, _applyFn;
  let _lastSavedLabel = null; // tracks the label of the most recent saved snapshot this session

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
    showHistory() { _guardedShowHistory(); },
    clearAll()    { _confirmAndClear(); }
  };

  // ── Supabase helpers (delegate to auth.js globals) ────────────────────
  async function _doSaveSnapshot(label, data, completed) {
    // saveSnapshot() is defined in auth.js and uses the authenticated _supabase client
    await saveSnapshot(_toolKey, label, data, completed);
  }

  async function _doLoadSnapshots() {
    // loadSnapshots() is defined in auth.js
    return loadSnapshots(_toolKey);
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

/* ── Snapshot restore view ── */
.tlr-snap-view-header{display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem}
.tlr-snap-view-back{background:transparent;border:1.5px solid rgba(0,0,0,0.1);color:var(--text-mid,#4A4A4A);padding:0.45rem 0.9rem;border-radius:7px;font-family:var(--font-body,sans-serif);font-size:0.8rem;cursor:pointer;transition:border-color .15s,color .15s;display:inline-flex;align-items:center}
.tlr-snap-view-back:hover{border-color:var(--accent,#1A6B72);color:var(--accent,#1A6B72)}
.tlr-snap-view-title{font-family:var(--font-display,'Playfair Display',Georgia,serif);font-size:1.1rem;color:var(--text-dark,#1A1A1A)}
.tlr-snap-view-meta{font-size:0.78rem;color:var(--text-muted,#8A8880);margin-bottom:1.5rem}
.tlr-restore-box{background:var(--cream,#F5F1EB);border-radius:12px;padding:1.5rem;text-align:center}
.tlr-restore-icon{font-size:2rem;margin-bottom:0.75rem}
.tlr-restore-msg{font-size:0.87rem;color:var(--text-mid,#4A4A4A);line-height:1.6;margin-bottom:1.25rem}
.tlr-restore-btn{background:var(--navy,#1B2B4B);color:#fff;border:none;padding:0.75rem 1.75rem;border-radius:9px;font-family:var(--font-body,sans-serif);font-size:0.88rem;font-weight:600;cursor:pointer;transition:opacity .15s;width:100%;margin-bottom:0}
.tlr-restore-btn:hover{opacity:0.85}

/* ── Share panel ── */
.tlr-share-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.42);z-index:9100;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .22s;pointer-events:none}
.tlr-share-overlay.open{opacity:1;pointer-events:auto}
.tlr-share-drawer{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:1.75rem 1.75rem 2.5rem;transform:translateY(100%);transition:transform .28s cubic-bezier(.25,.8,.25,1)}
.tlr-share-overlay.open .tlr-share-drawer{transform:translateY(0)}
.tlr-share-handle{width:36px;height:4px;background:rgba(0,0,0,0.1);border-radius:2px;margin:0 auto 1.4rem}
.tlr-share-title{font-family:var(--font-display,'Playfair Display',Georgia,serif);font-size:1.2rem;color:var(--text-dark,#1A1A1A);margin-bottom:1.1rem}
.tlr-share-btn{display:flex;align-items:center;gap:0.75rem;width:100%;padding:0.8rem 1rem;border-radius:10px;border:1.5px solid rgba(0,0,0,0.1);background:#fff;color:var(--text-dark,#1A1A1A);font-family:var(--font-body,sans-serif);font-size:0.9rem;font-weight:500;cursor:pointer;margin-bottom:0.6rem;transition:border-color .15s,background .15s;text-align:left}
.tlr-share-btn:hover{border-color:var(--accent,#1A6B72);background:rgba(26,107,114,0.03)}
.tlr-share-btn.wa{color:#128C7E;border-color:rgba(18,140,126,0.3)}
.tlr-share-btn.wa:hover{background:rgba(18,140,126,0.05);border-color:#128C7E}
.tlr-share-btn svg{flex-shrink:0;width:18px;height:18px}

/* ── Print styles ── */
@media print{
  .topbar,.complete-wrap,.tlr-history-row,.tlr-overlay,.tlr-share-overlay,
  #completionView,.completion-actions,#completed-banner,.tool-progress{display:none!important}
  body{background:#fff;font-size:12px}
  .page,.step-block{box-shadow:none!important;border:1px solid #ddd!important}
}

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

    const printBtn = document.createElement('button');
    printBtn.className = 'tlr-history-btn';
    printBtn.innerHTML = _printIcon() + ' Print';
    printBtn.onclick = () => window.print();

    const shareBtn = document.createElement('button');
    shareBtn.className = 'tlr-history-btn';
    shareBtn.innerHTML = _shareIcon() + ' Share';
    shareBtn.onclick = () => _showSharePanel();

    const clearBtn = document.createElement('button');
    clearBtn.className = 'tlr-clear-btn';
    clearBtn.textContent = 'Clear all fields';
    clearBtn.onclick = () => TLRHistory.clearAll();

    row.appendChild(histBtn);
    row.appendChild(printBtn);
    row.appendChild(shareBtn);
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
</div>
<div class="tlr-overlay center" id="tlr-save-first-overlay" onclick="if(event.target===this)_tlrClose('tlr-save-first-overlay')">
  <div class="tlr-confirm-dialog">
    <div class="tlr-confirm-title">💾 Save your work first?</div>
    <div class="tlr-confirm-msg">You have unsaved progress on this worksheet. If you restore a previous version without saving, what you're working on now will be lost.<br><br>Would you like to save it first so you can come back to it?</div>
    <div class="tlr-confirm-btns" style="flex-direction:column;gap:0.5rem">
      <button class="tlr-dialog-save" style="width:100%;padding:0.7rem" onclick="_tlrSaveFirstThenHistory()">Save my progress, then open history</button>
      <button class="tlr-confirm-cancel" style="width:100%;text-align:center" onclick="_tlrSkipSaveOpenHistory()">Open history without saving</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(el);

    // Share panel (separate overlay)
    if (!document.getElementById('tlr-share-panel')) {
      const sp = document.createElement('div');
      sp.id = 'tlr-share-panel';
      sp.className = 'tlr-share-overlay';
      sp.onclick = (e) => { if (e.target === sp) _closeShare(); };
      sp.innerHTML = `
<div class="tlr-share-drawer">
  <div class="tlr-share-handle"></div>
  <div class="tlr-share-title">Share or print</div>
  <button class="tlr-share-btn wa" onclick="_tlrShareWhatsApp()">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
    Share on WhatsApp
  </button>
  <button class="tlr-share-btn" onclick="_tlrShareEmail()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
    Email to myself
  </button>
  <button class="tlr-share-btn" onclick="window.print();_closeShare()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Print worksheet
  </button>
</div>`;
      document.body.appendChild(sp);
    }
  }

  function _showSharePanel() {
    const sp = document.getElementById('tlr-share-panel');
    if (sp) sp.classList.add('open');
  }
  function _closeShare() {
    const sp = document.getElementById('tlr-share-panel');
    if (sp) sp.classList.remove('open');
  }
  window._closeShare = _closeShare;

  window._tlrShareWhatsApp = function () {
    const title = document.title.replace(/\s*[–—|].*$/, '').trim();
    const url = window.location.href;
    const msg = encodeURIComponent('I\'ve been working on "' + title + '" in The Living Room 🌿\n' + url);
    window.open('https://wa.me/?text=' + msg, '_blank');
    _closeShare();
  };

  window._tlrShareEmail = function () {
    const title = document.title.replace(/\s*[–—|].*$/, '').trim();
    const url = window.location.href;
    const sub = encodeURIComponent(title + ' — The Living Room');
    const body = encodeURIComponent('I\'ve been working on "' + title + '" in The Living Room.\n\nYou can find it here:\n' + url);
    window.location.href = 'mailto:?subject=' + sub + '&body=' + body;
    _closeShare();
  };

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
    // If this session already has a saved version, warn rather than re-prompting blindly
    if (_lastSavedLabel !== null) {
      const lbl = _lastSavedLabel ? '“' + _lastSavedLabel + '”' : 'an unnamed version';
      // Show a lighter confirmation: already saved, do they want to save a new snapshot?
      const inp = document.getElementById('tlr-snap-label');
      if (inp) inp.value = '';
      const sub = document.querySelector('#tlr-name-overlay .tlr-dialog-sub');
      if (sub) sub.textContent = 'Already saved as ' + lbl + ' this session. Give the new version a different name, or leave blank to save another copy.';
    } else {
      const sub = document.querySelector('#tlr-name-overlay .tlr-dialog-sub');
      if (sub) sub.textContent = 'Give it a name so you can find it later — something like “September 2026”, “After the redundancy”, or “Starting fresh”.';
      const inp = document.getElementById('tlr-snap-label');
      if (inp) inp.value = '';
    }
    _open('tlr-name-overlay');
    setTimeout(() => {
      const inp = document.getElementById('tlr-snap-label');
      if (inp) inp.focus();
    }, 280);
  }

  window._tlrDoSave = async function () {
    const label = (document.getElementById('tlr-snap-label').value || '').trim();
    _tlrClose('tlr-name-overlay');
    const data = _collectFn ? _collectFn() : {};
    const completed = !!(data && data._completed);
    _showToast('Saving…');
    try {
      // Save named snapshot to history
      await _doSaveSnapshot(label, data, completed);
      _lastSavedLabel = label;
      // Also explicitly flush to main progress slot
      if (typeof saveProgress === 'function') {
        try { await saveProgress(_toolKey, completed, data); } catch (e) {}
      }
      // Update the topbar saved badge if it exists
      const badge = document.getElementById('saved-badge');
      if (badge) { badge.style.display = 'flex'; setTimeout(() => { badge.style.display = 'none'; }, 2000); }
      _showToast(label ? '”' + label + '” saved to history' : 'Version saved to history');
      // If the user clicked “save first, then open history”, now open it
      if (_pendingHistoryAfterSave) {
        _pendingHistoryAfterSave = false;
        setTimeout(_loadAndShowHistory, 400);
      }
    } catch (e) {
      _pendingHistoryAfterSave = false;
      console.error('[TLRHistory] _tlrDoSave error:', e);
      _showToast('Could not save: ' + (e.message || 'unknown error'));
    }
  };

  // ── History: check for unsaved work before opening ───────────────────
  function _hasUnsavedContent() {
    // Returns true if the page has any filled-in fields and nothing has been
    // explicitly saved to history this session
    if (_lastSavedLabel !== null) return false; // already saved a named version this session
    const inputs = document.querySelectorAll(
      'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, [contenteditable]'
    );
    for (const el of inputs) {
      if ((el.value || el.textContent || '').trim()) return true;
    }
    return false;
  }

  function _guardedShowHistory() {
    if (_hasUnsavedContent()) {
      _open('tlr-save-first-overlay');
    } else {
      _loadAndShowHistory();
    }
  }

  window._tlrSaveFirstThenHistory = function () {
    _tlrClose('tlr-save-first-overlay');
    // Open the name dialog; after saving, automatically open history
    _pendingHistoryAfterSave = true;
    _showNameDialog();
  };

  window._tlrSkipSaveOpenHistory = function () {
    _tlrClose('tlr-save-first-overlay');
    _loadAndShowHistory();
  };

  let _pendingHistoryAfterSave = false;

  // ── History drawer ────────────────────────────────────────────────────
  async function _loadAndShowHistory() {
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    content.innerHTML = '<div class="tlr-drawer-title">My history</div><div class="tlr-drawer-sub">Loading…</div>';
    _open('tlr-hist-overlay');
    const snaps = await _doLoadSnapshots();
    window._tlrSnaps = {};
    snaps.forEach(s => { window._tlrSnaps[s.id] = s; });
    _renderList(snaps);
  }

  function _renderList(snaps) {
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    if (!snaps || snaps.length === 0) {
      content.innerHTML = `<div class="tlr-drawer-title">My history</div>
<div class="tlr-snap-empty"><div class="tlr-snap-empty-icon">📂</div>No saved versions yet.<br>Use <strong>💾 Save my progress</strong> to capture a named snapshot of your work at any point.</div>`;
      return;
    }
    const cards = snaps.map(s => {
      const d = new Date(s.created_at);
      const ds = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const ts = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const lbl = _esc(s.label || 'Unnamed version');
      const bc = s.completed ? 'done' : 'prog';
      const bt = s.completed ? 'Complete' : 'In progress';
      return `<div class="tlr-snap-card" onclick="_tlrConfirmRestore('${_esc(s.id)}')"><div class="tlr-snap-meta"><div class="tlr-snap-label">${lbl}</div><div class="tlr-snap-date">${ds} at ${ts}</div></div><span class="tlr-snap-badge ${bc}">${bt}</span></div>`;
    }).join('');
    content.innerHTML = `<div class="tlr-drawer-title">My history</div><div class="tlr-drawer-sub">${snaps.length} saved version${snaps.length !== 1 ? 's' : ''} &mdash; tap one to restore it to the worksheet</div><div class="tlr-snap-list">${cards}</div>`;
  }

  window._tlrConfirmRestore = function (id) {
    const snap = window._tlrSnaps && window._tlrSnaps[id];
    if (!snap) return;
    const content = document.getElementById('tlr-hist-content');
    if (!content) return;
    const d = new Date(snap.created_at);
    const ds = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const ts = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const lbl = _esc(snap.label || 'Unnamed version');
    const statusText = snap.completed ? 'Completed' : 'In progress';
    content.innerHTML = `
<div class="tlr-snap-view-header">
  <button class="tlr-snap-view-back" onclick="_tlrBackToList()">← Back</button>
  <div class="tlr-snap-view-title">${lbl}</div>
</div>
<div class="tlr-snap-view-meta">${ds} at ${ts} &nbsp;&middot;&nbsp; ${statusText}</div>
<div class="tlr-restore-box">
  <div class="tlr-restore-icon">↩️</div>
  <div class="tlr-restore-msg">This will load <strong>${lbl}</strong> into the worksheet so you can continue where you left off. Your current answers will be replaced — save them first if you want to keep them.</div>
  <button class="tlr-restore-btn" onclick="_tlrDoRestore('${_esc(id)}')">Restore this version</button>
  <button class="tlr-snap-view-back" onclick="_tlrBackToList()" style="margin-top:0.5rem;width:100%;justify-content:center">Cancel — keep my current answers</button>
</div>`;
  };

  window._tlrDoRestore = function (id) {
    const snap = window._tlrSnaps && window._tlrSnaps[id];
    if (!snap || !_applyFn) return;
    _tlrClose('tlr-hist-overlay');
    try {
      _applyFn(snap.data || {});
      // Persist to localStorage so auto-save picks it up
      if (_toolKey) {
        const toStore = Object.assign({}, snap.data, { lastSaved: new Date().toISOString() });
        localStorage.setItem(_toolKey, JSON.stringify(toStore));
      }
      if (typeof updateProgress === 'function') try { updateProgress(); } catch (e) {}
      const lbl = snap.label || 'Unnamed version';
      _showToast('Restored: "' + lbl + '"');
    } catch (e) {
      console.error('[TLRHistory] restore error:', e);
      _showToast('Could not restore: ' + (e.message || 'unknown error'));
    }
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
    _lastSavedLabel = null;
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

  function _printIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
  }

  function _shareIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
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
