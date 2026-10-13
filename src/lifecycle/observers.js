/* ───────────────────────────────────────────────────────────────────────────
 * lifecycle/observers.js — Keep the theme applied as the app changes.
 *
 * Everything that measures runs inside requestAnimationFrame, on a debounce
 * with a watchdog that backs off if a pass ever gets expensive. Accents
 * repaint synchronously on navigation because they are one attribute on
 * <html>; the debounced pass only re-measures the rail.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Staying applied ────────────────────────────────────────────────────────
  // Accent repaints synchronously on navigation (one attribute on <html>), so
  // there is no visible lag. The debounced pass only re-measures the rail —
  // deliberately NOT renderUI(), which would rebuild the panel on every DOM
  // change the app makes, i.e. continuously while a session is streaming.

  // Everything that measures runs inside requestAnimationFrame, so it reads
  // layout at the point in the frame where the browser is about to compute it
  // anyway instead of forcing an extra reflow mid-task. The watchdog backs the
  // whole thing off if a pass ever gets expensive: a slow pass should make the
  // overlay lazier, never make the app unusable.
  let pending = null, rafId = 0, debounce = 160, slowRun = 0, warned = false;
  const DEBOUNCE_MAX = 2000;

  function measurePass() {
    rafId = 0;
    const t0 = performance.now();
    checkExpand(); syncPanes(); paintAccent();
    if (overlaySig() !== lastSig) renderUI(); else positionOverlay();
    const dt = performance.now() - t0;
    if (dt > 10) {
      if (++slowRun >= 3) {
        slowRun = 0;
        debounce = Math.min(DEBOUNCE_MAX, Math.round(debounce * 2));
        if (!warned) {
          warned = true;
          console.warn(`claude-theme: measurement is slow (${dt.toFixed(1)}ms); ` +
            `backing off to ${debounce}ms. __cdtUninstall() to remove.`);
        }
      }
    } else if (slowRun) slowRun--;
  }

  const schedule = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      if (document.hidden || rafId) return;
      rafId = requestAnimationFrame(measurePass);
    }, debounce);
  };

  // The last path that could still rebuild the panel under the pointer: apps
  // call replaceState for things other than navigation. Only a genuine
  // session change needs the panel redrawn.
  let lastSession = sessionId();
  const immediate = () => {
    const id = sessionId();
    if (id !== lastSession) { lastSession = id; forgetPaneIds(); }
    paintAccent(); syncPanes(); scheduleAccents();
    if (overlaySig() !== lastSig) renderUI(); else positionOverlay();
  };

  let accentRaf = 0;
  function scheduleAccents() {
    if (accentRaf || document.hidden) return;
    accentRaf = requestAnimationFrame(() => {
      accentRaf = 0;
      forgetPaneIds();
      const panes = listPanes();
      paintPaneAccents(panes);
      syncPaneIdentity(panes);
      if (overlaySig() !== lastSig) renderUI();
    });
  }

  // Our own writes must not feed back in: applyStyle() appends the stylesheet
  // to <html>, which is itself a childList mutation on the observed root.
  const ours = n => n && (n.id === STYLE_ID || n.id === HOST_ID);
  const observer = new MutationObserver(records => {
    for (const r of records) {
      if (r.target && r.target.nodeType === 1 && r.target.closest?.(`#${HOST_ID}`)) continue;
      if (r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(ours)) continue;
      scheduleAccents();
      schedule();
      return;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true,
    attributes: true, attributeFilter: ['class', 'href', 'data-session-id'] });

  const origPush = history.pushState, origReplace = history.replaceState;
  history.pushState = function (...a) { const r = origPush.apply(this, a); immediate(); return r; };
  history.replaceState = function (...a) { const r = origReplace.apply(this, a); immediate(); return r; };
  const onPop = () => immediate();
  window.addEventListener('popstate', onPop);
  // paintRows must run here too: a sidebar resize changes row geometry without
  // a DOM mutation, and the size guard can un-decorate rows that nothing then
  // re-checks.
  const onResize = () => { if (pin) resetExpand(); syncPanes(); paintRows(); positionOverlay(); };

  // The MutationObserver watches childList only, so a modal that appears via a
  // style/class change never triggers a re-check and the accent control stays
  // floating over Settings. One cheap hit-test on a timer covers that, and
  // only re-renders when the answer actually changes.
  // Was 400ms, unconditional, each tick forcing a reflow. A modal opening is
  // not a 400ms-latency problem, and nothing needs checking while the window
  // is in the background.
  let visRaf = 0;
  const visTimer = setInterval(() => {
    if (document.hidden || rafId || visRaf) return;
    visRaf = requestAnimationFrame(() => {
      visRaf = 0;
      forgetPaneIds(); paintPaneAccents();
      checkExpand(); syncPanes(); paintStatus(listPanes());
      if (overlaySig() !== lastSig) renderUI(); else positionOverlay();
    });
  }, 1200);
  window.addEventListener('resize', onResize);

  // ── Following the app's light/dark mode ────────────────────────────────────
  // When the app flips mode the captured baseline is stale — it holds the
  // values of the mode we installed under — so it has to be recaptured with
  // our own overrides removed first, or we would snapshot our own output.
  // The remembered palette for the new mode is then restored.

  let lastMode = appMode();
  function onModeChange() {
    const m = appMode();
    if (m === lastMode) return;
    lastMode = m;
    document.getElementById(STYLE_ID)?.remove();
    baseline = captureBaseline();
    fontBase = captureFonts();
    applyTheme(storedTheme() || DEFAULT_THEME);
  }

  const modeObserver = new MutationObserver(onModeChange);
  modeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
  const mql = matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener?.('change', onModeChange);
