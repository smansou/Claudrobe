/* ───────────────────────────────────────────────────────────────────────────
 * panes.js — Find the split panes and which session each one is.
 *
 * The URL only names the focused session, so each pane's id is read from
 * React's own props on the pane element — walking the fiber, since the value
 * is only ever in a memoised dependency array. Every failure falls back to
 * the
 * URL rather than guessing.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Panes ──────────────────────────────────────────────────────────────────
  // Every pane carries its own session colour, so a split view shows two. The
  // URL only names the focused session, so each pane's session is read from
  // React's props on the pane itself.

  const PANE_SEL = '.dframe-pane';
  const SID = /^(local|cse|session)_[0-9a-z-]{8,}$/i;
  const listPanes = () => [...document.querySelectorAll(PANE_SEL)]
    .filter(p => !p.parentElement?.closest(PANE_SEL));

  const fiberOf = el => {
    const k = Object.keys(el).find(n => n.startsWith('__reactFiber$'));
    return k ? el[k] : null;
  };
  const propSession = mp => {
    if (!mp || typeof mp !== 'object') return null;
    for (const k of ['sessionId', 'sessionID', 'session_id', 'activeSessionId']) {
      if (typeof mp[k] === 'string' && SID.test(mp[k])) return mp[k];
    }
    const s = mp.session;
    return s && typeof s.id === 'string' && SID.test(s.id) ? s.id : null;
  };
  /** Down through the pane's own subtree first (it names the session it is
   *  showing), then a short way up. Bounded either way. */
  function fiberSession(pane) {
    const f = fiberOf(pane);
    if (!f) return null;
    const q = [f];
    for (let n = 0; q.length && n < 600; n++) {
      const x = q.shift();
      const id = propSession(x.memoizedProps);
      if (id) return id;
      if (x.child) q.push(x.child);
      if (x !== f && x.sibling) q.push(x.sibling);
    }
    for (let x = f.return, k = 0; x && k < 40; x = x.return, k++) {
      const id = propSession(x.memoizedProps);
      if (id) return id;
    }
    return null;
  }

  const paneIds = new WeakMap(); // pane -> { id, at }
  function paneSessionId(pane, panes) {
    const c = paneIds.get(pane);
    if (c && Date.now() - c.at < 48) return c.id;
    let id = null;
    try { id = fiberSession(pane); } catch {}
    if (!id) {
      const m = pane.querySelector('a[href*="/epitaxy/"]')?.getAttribute('href')?.match(/\/epitaxy\/([^/?#]+)/);
      if (m) id = m[1];
    }
    // Last resort: the URL names the focused session, which is the only pane
    // or the primary one.
    if (!id && (panes.length === 1 || pane.classList.contains('dframe-pane-primary'))) id = sessionId();
    paneIds.set(pane, { id, at: Date.now() });
    return id;
  }
  const forgetPaneIds = () => { for (const p of listPanes()) paneIds.delete(p); };

  function paintAccent() {
    const html = document.documentElement;
    html.setAttribute('data-cdt-border', borderStyle);
    html.style.setProperty('--cdt-border-w', String(borderWidth));
    html.style.setProperty('--cdt-fill', String(fillPct()));
    const panes = listPanes();
    paintPaneAccents(panes);
    paintRows();
    paintStatus(panes);
  }
  function paintPaneAccents(panes = listPanes()) {
    for (const p of panes) {
      const color = colorForSession(paneSessionId(p, panes));
      if (color) {
        if (p.style.getPropertyValue(VAR) !== color) p.style.setProperty(VAR, color);
        if (!p.hasAttribute('data-cdt-accent')) p.setAttribute('data-cdt-accent', '');
      } else if (p.hasAttribute('data-cdt-accent')) {
        p.style.removeProperty(VAR); p.removeAttribute('data-cdt-accent');
      }
    }
  }
  const clearPanes = () => {
    for (const p of document.querySelectorAll('[data-cdt-accent]')) {
      p.style.removeProperty(VAR); p.removeAttribute('data-cdt-accent');
    }
    clearStatus();
  };
