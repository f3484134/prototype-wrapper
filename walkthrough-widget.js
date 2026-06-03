(function() {
  'use strict';

  // === CONFIG ===
  const STORAGE_KEY = 'pw-scenarios';
  const MODE = new URLSearchParams(window.location.search).get('mode') === 'designer' ? 'designer' : 'reviewer';
  const STEP_DELAY = 800;
  const MAX_DELAY = 3000;
  const SCROLL_DEBOUNCE = 500;

  // === STORAGE ===
  function loadScenarios() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }
  function saveScenarios(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

  // === SELECTOR ENGINE ===
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.dataset && el.dataset.testid) return '[data-testid="' + CSS.escape(el.dataset.testid) + '"]';
    // Build path
    const path = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) { path.unshift('#' + CSS.escape(cur.id)); break; }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (siblings.length > 1) seg += ':nth-of-type(' + (siblings.indexOf(cur) + 1) + ')';
      }
      path.unshift(seg);
      cur = parent;
    }
    return path.join(' > ');
  }

  // === SHADOW DOM HOST ===
  const host = document.createElement('div');
  host.id = 'pw-widget-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // === STYLES ===
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .fab {
      position: fixed; bottom: 24px; right: 24px; width: 52px; height: 52px;
      border-radius: 50%; background: #2563eb; color: #fff; border: none;
      font-size: 22px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.2);
      display: flex; align-items: center; justify-content: center;
      pointer-events: auto; transition: transform .2s, background .2s; z-index: 99999;
    }
    .fab:hover { transform: scale(1.08); }
    .fab.recording { background: #dc2626; animation: pulse-rec 1.2s infinite; }
    @keyframes pulse-rec { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)} 50%{box-shadow:0 0 0 12px rgba(220,38,38,0)} }
    .panel {
      position: fixed; top: 0; right: -340px; width: 320px; height: 100vh;
      background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,.12);
      transition: right .3s ease; pointer-events: auto; overflow-y: auto;
      padding: 20px; z-index: 99998; display: flex; flex-direction: column; gap: 12px;
    }
    .panel.open { right: 0; }
    .panel h2 { font-size: 16px; font-weight: 600; color: #1e293b; }
    .panel h3 { font-size: 13px; font-weight: 600; color: #475569; margin-top: 8px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
      border-radius: 6px; border: 1px solid #e2e8f0; background: #f8fafc;
      cursor: pointer; font-size: 13px; color: #334155; transition: background .15s;
    }
    .btn:hover { background: #e2e8f0; }
    .btn-primary { background: #2563eb; color: #fff; border-color: #2563eb; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-danger { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
    .btn-danger:hover { background: #fecaca; }
    .scenario-item {
      padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px;
      cursor: pointer; transition: border-color .15s;
    }
    .scenario-item:hover { border-color: #2563eb; }
    .scenario-item .name { font-weight: 500; font-size: 14px; color: #1e293b; }
    .scenario-item .meta { font-size: 11px; color: #94a3b8; margin-top: 4px; }
    .scenario-actions { display: flex; gap: 6px; margin-top: 6px; }
    .scenario-actions button { font-size: 11px; padding: 3px 8px; }
    input, textarea {
      width: 100%; padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 6px;
      font-size: 13px; outline: none;
    }
    input:focus, textarea:focus { border-color: #2563eb; }
    .step-list { display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow-y: auto; }
    .step-item { padding: 6px 8px; border: 1px solid #f1f5f9; border-radius: 4px; font-size: 12px; color: #475569; }
    /* Playback bar */
    .playback-bar {
      position: fixed; bottom: 0; left: 0; right: 0; background: rgba(30,41,59,.92);
      color: #fff; padding: 12px 20px; display: flex; align-items: center; gap: 12px;
      pointer-events: auto; z-index: 99997; backdrop-filter: blur(4px);
    }
    .playback-bar .progress { flex: 1; font-size: 13px; }
    .playback-bar button { background: transparent; border: 1px solid rgba(255,255,255,.3); color: #fff; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .playback-bar button:hover { background: rgba(255,255,255,.1); }
    .narration-overlay {
      position: fixed; bottom: 56px; left: 50%; transform: translateX(-50%);
      background: rgba(15,23,42,.85); color: #fff; padding: 10px 20px;
      border-radius: 8px; font-size: 14px; max-width: 600px; text-align: center;
      pointer-events: none; z-index: 99996; backdrop-filter: blur(4px);
    }
    .close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 18px; cursor: pointer; color: #94a3b8; pointer-events: auto; }
    .close-btn:hover { color: #1e293b; }
    .export-section { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  `;
  shadow.appendChild(style);

  // === UI ELEMENTS ===
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = MODE === 'designer' ? '⏺' : '▶';
  shadow.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'panel';
  shadow.appendChild(panel);

  let panelOpen = false;
  fab.addEventListener('click', () => { panelOpen = !panelOpen; panel.classList.toggle('open', panelOpen); renderPanel(); });

  // === STATE ===
  let recording = false;
  let currentSteps = [];
  let playbackState = null; // { scenarioId, stepIndex, paused, timer }

  // === HIGHLIGHT OVERLAY (outside shadow, on main page) ===
  const highlight = document.createElement('div');
  highlight.style.cssText = 'position:absolute;pointer-events:none;border:3px solid #2563eb;border-radius:4px;z-index:2147483646;transition:all .3s;box-shadow:0 0 0 4px rgba(37,99,235,.2);display:none;';
  document.body.appendChild(highlight);

  function highlightEl(el) {
    if (!el) { highlight.style.display = 'none'; return; }
    const r = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = (r.left + window.scrollX - 3) + 'px';
    highlight.style.top = (r.top + window.scrollY - 3) + 'px';
    highlight.style.width = (r.width + 6) + 'px';
    highlight.style.height = (r.height + 6) + 'px';
  }

  // === NARRATION ===
  let narrationEl = null;
  function showNarration(text) {
    if (!text) { hideNarration(); return; }
    if (!narrationEl) { narrationEl = document.createElement('div'); narrationEl.className = 'narration-overlay'; shadow.appendChild(narrationEl); }
    narrationEl.textContent = text;
    narrationEl.style.display = 'block';
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW';
      window.speechSynthesis.speak(u);
    }
  }
  function hideNarration() {
    if (narrationEl) narrationEl.style.display = 'none';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  // === PLAYBACK BAR ===
  let playbackBar = null;
  function showPlaybackBar() {
    if (!playbackBar) { playbackBar = document.createElement('div'); playbackBar.className = 'playback-bar'; shadow.appendChild(playbackBar); }
    playbackBar.style.display = 'flex';
    updatePlaybackBar();
  }
  function hidePlaybackBar() { if (playbackBar) playbackBar.style.display = 'none'; }
  function updatePlaybackBar() {
    if (!playbackBar || !playbackState) return;
    const sc = loadScenarios().find(s => s.id === playbackState.scenarioId);
    if (!sc) return;
    playbackBar.innerHTML = '';
    const progress = document.createElement('span');
    progress.className = 'progress';
    progress.textContent = `Step ${playbackState.stepIndex + 1} / ${sc.steps.length} — ${sc.name}`;
    playbackBar.appendChild(progress);
    const pauseBtn = document.createElement('button');
    pauseBtn.textContent = playbackState.paused ? '▶ Resume' : '⏸ Pause';
    pauseBtn.onclick = () => { playbackState.paused = !playbackState.paused; if (!playbackState.paused) playNext(); updatePlaybackBar(); };
    playbackBar.appendChild(pauseBtn);
    const stopBtn = document.createElement('button');
    stopBtn.textContent = '⏹ Stop';
    stopBtn.onclick = stopPlayback;
    playbackBar.appendChild(stopBtn);
    const freeBtn = document.createElement('button');
    freeBtn.textContent = '🔓 Free Explore';
    freeBtn.onclick = stopPlayback;
    playbackBar.appendChild(freeBtn);
  }

  // === RECORDING ENGINE ===
  let scrollTimer = null;
  function startRecording() {
    recording = true; currentSteps = [];
    fab.classList.add('recording'); fab.textContent = '⏹';
    document.addEventListener('click', recClick, true);
    document.addEventListener('input', recInput, true);
    window.addEventListener('scroll', recScroll, true);
    window.addEventListener('popstate', recNav);
    window.addEventListener('hashchange', recNav);
  }
  function stopRecording() {
    recording = false;
    fab.classList.remove('recording'); fab.textContent = '⏺';
    document.removeEventListener('click', recClick, true);
    document.removeEventListener('input', recInput, true);
    window.removeEventListener('scroll', recScroll, true);
    window.removeEventListener('popstate', recNav);
    window.removeEventListener('hashchange', recNav);
    // Save
    const name = prompt('Scenario name:', 'Scenario ' + (loadScenarios().length + 1));
    if (name === null && currentSteps.length === 0) return;
    const scenarios = loadScenarios();
    scenarios.push({ id: Date.now().toString(36), name: name || 'Untitled', createdAt: new Date().toISOString(), steps: currentSteps });
    saveScenarios(scenarios);
    currentSteps = [];
    renderPanel();
  }
  function recClick(e) {
    if (host.contains(e.target) || e.target === host) return;
    const r = e.target.getBoundingClientRect();
    currentSteps.push({ type: 'click', selector: getSelector(e.target), url: location.pathname + location.hash, scrollPos: [window.scrollX, window.scrollY], timestamp: Date.now(), rect: { x: r.x, y: r.y, w: r.width, h: r.height } });
  }
  function recInput(e) {
    if (host.contains(e.target)) return;
    const last = currentSteps[currentSteps.length - 1];
    const sel = getSelector(e.target);
    if (last && last.type === 'input' && last.selector === sel) { last.value = e.target.value; return; }
    currentSteps.push({ type: 'input', selector: sel, value: e.target.value, url: location.pathname + location.hash, scrollPos: [window.scrollX, window.scrollY], timestamp: Date.now() });
  }
  function recScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      currentSteps.push({ type: 'scroll', selector: null, url: location.pathname + location.hash, scrollPos: [window.scrollX, window.scrollY], timestamp: Date.now() });
    }, SCROLL_DEBOUNCE);
  }
  function recNav() {
    currentSteps.push({ type: 'navigate', selector: null, url: location.pathname + location.hash, scrollPos: [window.scrollX, window.scrollY], timestamp: Date.now() });
  }

  // === PLAYBACK ENGINE ===
  function startPlayback(scenarioId) {
    const sc = loadScenarios().find(s => s.id === scenarioId);
    if (!sc || sc.steps.length === 0) return;
    playbackState = { scenarioId, stepIndex: 0, paused: false };
    // Navigate to first step URL
    const firstUrl = sc.steps[0].url;
    if (firstUrl && (location.pathname + location.hash) !== firstUrl) {
      location.href = firstUrl;
      return; // page will reload
    }
    showPlaybackBar();
    panelOpen = false; panel.classList.remove('open');
    playNext();
  }
  function playNext() {
    if (!playbackState || playbackState.paused) return;
    const sc = loadScenarios().find(s => s.id === playbackState.scenarioId);
    if (!sc || playbackState.stepIndex >= sc.steps.length) { stopPlayback(); return; }
    const step = sc.steps[playbackState.stepIndex];
    executeStep(step).then(() => {
      playbackState.stepIndex++;
      updatePlaybackBar();
      if (playbackState.stepIndex >= sc.steps.length) { stopPlayback(); return; }
      // Delay
      const nextStep = sc.steps[playbackState.stepIndex];
      const prevTs = step.timestamp;
      const nextTs = nextStep.timestamp;
      let delay = STEP_DELAY;
      if (prevTs && nextTs) delay = Math.min(nextTs - prevTs, MAX_DELAY);
      if (delay < 200) delay = STEP_DELAY;
      setTimeout(() => playNext(), delay);
    });
  }
  function executeStep(step) {
    return new Promise(resolve => {
      // Show narration
      if (step.narration) showNarration(step.narration); else hideNarration();
      // Find element
      let el = step.selector ? document.querySelector(step.selector) : null;
      if (!el && step.rect) {
        // coordinate fallback
        el = document.elementFromPoint(step.rect.x + step.rect.w / 2, step.rect.y + step.rect.h / 2);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightEl(el);
      }
      setTimeout(() => {
        if (step.type === 'click' && el) { el.click(); }
        else if (step.type === 'input' && el) {
          el.value = step.value || '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        else if (step.type === 'scroll') { window.scrollTo(step.scrollPos[0], step.scrollPos[1]); }
        else if (step.type === 'navigate' && step.url) {
          if ((location.pathname + location.hash) !== step.url) location.href = step.url;
        }
        setTimeout(() => { highlightEl(null); resolve(); }, 400);
      }, 400);
    });
  }
  function stopPlayback() {
    playbackState = null;
    hidePlaybackBar(); hideNarration(); highlightEl(null);
  }

  // === PANEL RENDERING ===
  function renderPanel() {
    const scenarios = loadScenarios();
    if (MODE === 'designer') renderDesignerPanel(scenarios);
    else renderReviewerPanel(scenarios);
  }
  function renderDesignerPanel(scenarios) {
    panel.innerHTML = '<button class="close-btn">✕</button><h2>🎬 Designer Mode</h2>';
    panel.querySelector('.close-btn').onclick = () => { panelOpen = false; panel.classList.remove('open'); };
    // Record button
    const recBtn = document.createElement('button');
    recBtn.className = 'btn btn-primary';
    recBtn.textContent = recording ? '⏹ Stop Recording' : '⏺ Start Recording';
    recBtn.onclick = () => { recording ? stopRecording() : startRecording(); renderPanel(); };
    panel.appendChild(recBtn);
    if (recording) {
      const info = document.createElement('div');
      info.style.cssText = 'font-size:12px;color:#dc2626;';
      info.textContent = `Recording... ${currentSteps.length} steps captured`;
      panel.appendChild(info);
    }
    // Export/Import
    const exportSec = document.createElement('div');
    exportSec.className = 'export-section';
    const expBtn = document.createElement('button');
    expBtn.className = 'btn'; expBtn.textContent = '📤 Export';
    expBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(scenarios, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'pw-scenarios.json'; a.click();
    };
    exportSec.appendChild(expBtn);
    const impBtn = document.createElement('button');
    impBtn.className = 'btn'; impBtn.textContent = '📥 Import';
    impBtn.onclick = () => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
      input.onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => { try { const d = JSON.parse(r.result); saveScenarios([...loadScenarios(), ...d]); renderPanel(); } catch {} };
        r.readAsText(f);
      };
      input.click();
    };
    exportSec.appendChild(impBtn);
    panel.appendChild(exportSec);
    // Scenario list
    if (scenarios.length) {
      const h3 = document.createElement('h3'); h3.textContent = 'Saved Scenarios'; panel.appendChild(h3);
      scenarios.forEach(sc => {
        const item = document.createElement('div'); item.className = 'scenario-item';
        item.innerHTML = `<div class="name">${esc(sc.name)}</div><div class="meta">${sc.steps.length} steps · ${new Date(sc.createdAt).toLocaleString()}</div>`;
        const actions = document.createElement('div'); actions.className = 'scenario-actions';
        const renBtn = document.createElement('button'); renBtn.className = 'btn'; renBtn.textContent = '✏️';
        renBtn.onclick = (e) => { e.stopPropagation(); const n = prompt('New name:', sc.name); if (n) { sc.name = n; saveScenarios(scenarios); renderPanel(); } };
        const delBtn = document.createElement('button'); delBtn.className = 'btn btn-danger'; delBtn.textContent = '🗑';
        delBtn.onclick = (e) => { e.stopPropagation(); saveScenarios(scenarios.filter(s => s.id !== sc.id)); renderPanel(); };
        const narBtn = document.createElement('button'); narBtn.className = 'btn'; narBtn.textContent = '💬 Narration';
        narBtn.onclick = (e) => { e.stopPropagation(); renderNarrationEditor(sc); };
        actions.append(renBtn, delBtn, narBtn);
        item.appendChild(actions);
        panel.appendChild(item);
      });
    }
  }
  function renderNarrationEditor(sc) {
    panel.innerHTML = '<button class="close-btn">✕</button><h2>💬 Narration: ' + esc(sc.name) + '</h2>';
    panel.querySelector('.close-btn').onclick = () => renderPanel();
    const backBtn = document.createElement('button'); backBtn.className = 'btn'; backBtn.textContent = '← Back';
    backBtn.onclick = () => renderPanel();
    panel.appendChild(backBtn);
    const list = document.createElement('div'); list.className = 'step-list';
    sc.steps.forEach((step, i) => {
      const item = document.createElement('div'); item.className = 'step-item';
      item.innerHTML = `<div style="font-weight:500;margin-bottom:4px">Step ${i + 1}: ${step.type}</div>`;
      const ta = document.createElement('textarea'); ta.rows = 2; ta.placeholder = 'Add narration...';
      ta.value = step.narration || '';
      ta.onchange = () => { step.narration = ta.value; const all = loadScenarios(); const idx = all.findIndex(s => s.id === sc.id); if (idx >= 0) { all[idx] = sc; saveScenarios(all); } };
      item.appendChild(ta);
      list.appendChild(item);
    });
    panel.appendChild(list);
  }
  function renderReviewerPanel(scenarios) {
    panel.innerHTML = '<button class="close-btn">✕</button><h2>▶ Walkthrough Scenarios</h2>';
    panel.querySelector('.close-btn').onclick = () => { panelOpen = false; panel.classList.remove('open'); };
    if (!scenarios.length) {
      const empty = document.createElement('p');
      empty.style.cssText = 'font-size:13px;color:#94a3b8;';
      empty.textContent = 'No scenarios yet. Switch to ?mode=designer to record.';
      panel.appendChild(empty);
      return;
    }
    scenarios.forEach(sc => {
      const item = document.createElement('div'); item.className = 'scenario-item';
      item.innerHTML = `<div class="name">${esc(sc.name)}</div><div class="meta">${sc.steps.length} steps · ${new Date(sc.createdAt).toLocaleString()}</div>`;
      item.onclick = () => startPlayback(sc.id);
      panel.appendChild(item);
    });
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  // === AUTO-RESUME PLAYBACK AFTER NAV ===
  const pendingPlayback = sessionStorage.getItem('pw-playback');
  if (pendingPlayback) {
    sessionStorage.removeItem('pw-playback');
    try {
      const state = JSON.parse(pendingPlayback);
      playbackState = state;
      showPlaybackBar();
      setTimeout(() => playNext(), 500);
    } catch {}
  }
  // Before unload, save playback state
  window.addEventListener('beforeunload', () => {
    if (playbackState) sessionStorage.setItem('pw-playback', JSON.stringify(playbackState));
  });
})();
