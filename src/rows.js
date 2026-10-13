/* ───────────────────────────────────────────────────────────────────────────
 * rows.js — Paint the sidebar lick in each session's colour.
 *
 * The attribute that carries a session id on a sidebar row is discovered
 * once,
 * by scanning for an attribute whose value contains an id we already know,
 * rather than assuming the rows are plain anchors.
 * ─────────────────────────────────────────────────────────────────────────── */


  /** Which attribute carries a session id on a sidebar row.
   *  Assuming `a[href]` was wrong — the rows evidently are not plain anchors —
   *  so instead of guessing again this is discovered once by scanning for any
   *  attribute whose value contains a session id we already know about, on an
   *  element the size of a row. After that it is a cheap selector. */
  let rowAttr = null, lastScan = 0;

  const rowSized = r =>
    r.width > 0 && r.width <= 460 && r.height > 0 && r.height <= 220;

  /** Bounded, and it gives up.
   *
   *  The first version walked document.querySelectorAll('*') with an
   *  el.closest() per element — an ancestor walk per node — and re-ran every
   *  two seconds for as long as it failed to find anything. In a long
   *  transcript that is on the order of a million operations every two
   *  seconds, forever, on the main thread. Now: a node budget per pass, no
   *  per-element closest(), and a hard attempt cap, because if eight passes
   *  over the sidebar have not found a session id in an attribute then the
   *  rows do not carry one and no amount of rescanning will change that. */
  const SCAN_BUDGET = 3000, SCAN_TRIES = 8;
  let scanTries = 0;

  function discoverRowAttr(ids) {
    if (rowAttr || !ids.length || scanTries >= SCAN_TRIES) return;
    if (Date.now() - lastScan < 3000) return;
    lastScan = Date.now();
    scanTries++;
    // Scoped to the sidebar region when we can find it, so the budget is
    // spent where rows actually live rather than on the transcript.
    const root = document.querySelector('nav, aside, [class*="sidebar"]') || document.body;
    const all = root.querySelectorAll('*');
    const n = Math.min(all.length, SCAN_BUDGET);
    for (let i = 0; i < n; i++) {
      const el = all[i];
      if (el.getRootNode() !== document || el.id === HOST_ID) continue;
      for (const at of el.attributes) {
        if (!at.value || at.value.length > 300) continue;
        if (!ids.some(id => at.value.includes(id))) continue;
        if (rowSized(el.getBoundingClientRect())) { rowAttr = at.name; return; }
      }
    }
  }

  function rowsFor(id) {
    if (!rowAttr) return [];
    try {
      return [...document.querySelectorAll(`[${rowAttr}*="${CSS.escape(id)}"]`)]
        .filter(el => !el.closest(PANE_SEL) && !el.closest(`#${HOST_ID}`));
    } catch { return []; }
  }

  function paintRows() {
    const ids = [...new Set([...Object.keys(sessionMap).filter(k => sessionMap[k]), ...Object.keys(sessionIcons)])];
    discoverRowAttr(ids);

    const want = new Map();
    for (const id of ids) {
      for (const el of rowsFor(id)) {
        if (rowSized(el.getBoundingClientRect())) want.set(el, { color: colorForSession(id), icon: iconForSession(id) });
      }
    }
    for (const el of document.querySelectorAll('[data-cdt-row]')) {
      if (!want.has(el) || !want.get(el).color) { el.removeAttribute('data-cdt-row'); el.style.removeProperty('--cdt-row-accent'); }
    }
    for (const el of document.querySelectorAll('[data-cdt-avatar]')) {
      if (!want.get(el)?.icon) {
        el.removeAttribute('data-cdt-avatar');
        el.style.removeProperty('--cdt-avatar-mask');
        el.style.removeProperty('--cdt-avatar-pad');
      }
    }
    for (const [el, { color, icon }] of want) {
      if (color) {
        el.setAttribute('data-cdt-row', '');
        el.style.setProperty('--cdt-row-accent', color);
      }
      if (icon) {
        if (!el.hasAttribute('data-cdt-avatar')) {
          el.style.setProperty('--cdt-avatar-pad', getComputedStyle(el).paddingInlineStart);
        }
        el.setAttribute('data-cdt-avatar', icon);
        el.style.setProperty('--cdt-avatar-mask', iconMask(icon));
      }
    }
  }

  const clearRows = () => {
    for (const a of document.querySelectorAll('[data-cdt-avatar]')) {
      a.removeAttribute('data-cdt-avatar');
      a.style.removeProperty('--cdt-avatar-mask');
      a.style.removeProperty('--cdt-avatar-pad');
    }
    for (const a of document.querySelectorAll('[data-cdt-row]')) {
      a.removeAttribute('data-cdt-row');
      a.style.removeProperty('--cdt-row-accent');
    }
  };
