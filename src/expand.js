/* ───────────────────────────────────────────────────────────────────────────
 * expand.js — Grow the pane under the pointer, and put everything back.
 *
 * In a split, hovering a pane grows it over the others by absolutely
 * positioning the grid's items inside a pinned host. Clicking locks it;
 * clicking outside lets go. Every saved property is restored on collapse, on
 * teardown, and whenever a layout pass finds a pane that has been replaced.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Hover to expand ──
  // In a split, the pane under the pointer grows over its neighbours towards
  // the far side of the pane area — sideways for halves, diagonally for
  // quarters — and shrinks back when the pointer leaves it.
  //
  // The pane area is .dframe-pane-host, which already excludes whichever
  // sidebars are open. A pane cannot grow in place without pushing the
  // others, so for the duration every child of the host is pinned:
  // absolutely positioned at exactly the box it already had, which changes
  // nothing on screen. Only then does the hovered pane animate to its larger
  // box. Once everything is back in its slot, the pins come off and the
  // app's own layout takes over again. Anything that changes the layout
  // underneath (a pane opened or closed, a sidebar toggled, the window
  // resized) drops the pins at once rather than fighting it.
  //
  // The host is a CSS grid, and an absolutely positioned grid item with a
  // grid placement is positioned against its own cell rather than the host,
  // so pinning clears the placement as well.
  //
  // A strip of each covered pane stays showing, so the pointer can move onto
  // a neighbour.
  //
  // Clicking an expanded pane locks it large: hovering elsewhere no longer moves
  // anything until a click lands outside it, which releases the lock and
  // lets the pane under the pointer take over as if it had just been hovered.
  // Menus the pane opens (portalled outside it) and our own controls count
  // as inside, so using them does not release the lock.

  const EXPAND_MS = 420, HOVER_DELAY = 550, LEAVE_DELAY = 160, PEEK = 64;
  const PIN_PROPS = ['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'margin',
                     'min-width', 'min-height', 'max-width', 'max-height', 'z-index', 'transition',
                     'box-shadow', 'background-color', 'filter', 'opacity', 'isolation', 'mix-blend-mode',
                     'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'];
  const PORTALS = '[data-radix-popper-content-wrapper], [role="menu"], [role="dialog"], [role="listbox"], [role="tooltip"]';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let pin = null;        // { host, items: Map(el -> { saved, slot }), panes, area, ro }
  let expanded = null;   // the pane that is (or is growing) large
  let hoverPane = null, hoverPoint = null, hoverTimer = 0, leaveTimer = 0, settleTimer = 0, followUntil = 0, followRaf = 0;
  let locked = false;    // the expanded pane was clicked and stays large

  const topPane = el => {
    let p = el?.closest?.(PANE_SEL);
    while (p && p.parentElement?.closest(PANE_SEL)) p = p.parentElement.closest(PANE_SEL);
    return p || null;
  };
  const paneHost = () => listPanes()[0]?.parentElement || null;

  /** The colour behind the panes: they are transparent in the app and would
   *  otherwise show their neighbours through them once overlapping. */
  function backdropOf(el) {
    for (let x = el; x; x = x.parentElement) {
      const c = getComputedStyle(x).backgroundColor;
      if (!c || c === 'transparent') continue;
      const alpha = c.includes('/') ? c.slice(c.lastIndexOf('/') + 1, -1).trim()
        : /^(rgba|hsla)\(/.test(c) ? c.slice(c.lastIndexOf(',') + 1, -1).trim() : null;
      if (alpha === null || parseFloat(alpha) === (alpha.endsWith('%') ? 100 : 1)) return c;
    }
    return uiPalette().base;
  }

  function pinAll() {
    const host = paneHost();
    const panes = listPanes();
    if (!host || panes.length < 2 || panes.some(p => p.parentElement !== host)) return null;
    const hb = host.getBoundingClientRect();
    const ox = hb.left + host.clientLeft - host.scrollLeft, oy = hb.top + host.clientTop - host.scrollTop;
    // Measure everything first, then write, so pinning costs one layout.
    const kids = [...host.children].filter(c => getComputedStyle(c).position !== 'fixed');
    const boxes = kids.map(c => c.getBoundingClientRect());
    const items = new Map();
    kids.forEach((c, i) => {
      const r = boxes[i];
      if (!r.width && !r.height) return;
      items.set(c, {
        saved: PIN_PROPS.map(n => [n, c.style.getPropertyValue(n), c.style.getPropertyPriority(n)]),
        slot: { left: r.left - ox, top: r.top - oy, width: r.width, height: r.height },
      });
    });
    const slots = panes.map(p => items.get(p)?.slot).filter(Boolean);
    if (slots.length !== panes.length) return null;
    const area = { left: Math.min(...slots.map(s => s.left)), top: Math.min(...slots.map(s => s.top)),
                   right: Math.max(...slots.map(s => s.left + s.width)),
                   bottom: Math.max(...slots.map(s => s.top + s.height)) };
    const backgrounds = new Map(panes.map(p => [p, backdropOf(p)]));
    for (const [c, { slot }] of items) {
      const st = c.style;
      st.setProperty('position', 'absolute', 'important');
      st.setProperty('left', `${slot.left}px`, 'important');
      st.setProperty('top', `${slot.top}px`, 'important');
      st.setProperty('width', `${slot.width}px`, 'important');
      st.setProperty('height', `${slot.height}px`, 'important');
      for (const n of ['right', 'bottom']) st.setProperty(n, 'auto', 'important');
      st.setProperty('margin', '0', 'important');
      for (const n of ['min-width', 'min-height']) st.setProperty(n, '0', 'important');
      for (const n of ['max-width', 'max-height']) st.setProperty(n, 'none', 'important');
      for (const n of ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end']) st.setProperty(n, 'auto', 'important');
      if (backgrounds.has(c)) {
        st.setProperty('background-color', backgrounds.get(c), 'important');
        st.setProperty('isolation', 'isolate', 'important');
        st.setProperty('z-index', '0', 'important');
      }
    }
    // Nothing should have moved. If the host itself resized (its size came
    // from its children after all), undo and leave the layout alone.
    const after = host.getBoundingClientRect();
    if (Math.abs(after.width - hb.width) > 1 || Math.abs(after.height - hb.height) > 1) {
      restorePins(items); return null;
    }
    void host.offsetWidth; // commit the pinned boxes before transitions apply
    const ms = reduceMotion.matches ? 0 : EXPAND_MS;
    const ease = 'cubic-bezier(.4,0,.2,1)';
    for (const c of items.keys()) {
      c.style.setProperty('transition',
        ['left', 'top', 'width', 'height', 'box-shadow'].map(n => `${n} ${ms}ms ${ease}`).join(', '), 'important');
    }
    // A sidebar opening or closing resizes the host without a window resize.
    const ro = new ResizeObserver(() => {
      if (pin?.ro !== ro) return;
      const r = host.getBoundingClientRect();
      if (Math.abs(r.width - hb.width) > 1 || Math.abs(r.height - hb.height) > 1) resetExpand();
    });
    ro.observe(host);
    return { host, items, panes, area, ro };
  }

  function restorePins(items) {
    for (const [c, { saved }] of items) {
      for (const [n, v, pr] of saved) v ? c.style.setProperty(n, v, pr) : c.style.removeProperty(n);
    }
  }

  /** The box a pane grows to: out to the area's edge on every side, stopping
   *  short of the far edges so the panes it covers keep a strip showing. */
  function bigBox(slot, area) {
    const peek = PEEK, E = 2;
    const left = slot.left <= area.left + E ? area.left : area.left + peek;
    const top = slot.top <= area.top + E ? area.top : area.top + peek;
    const right = slot.left + slot.width >= area.right - E ? area.right : area.right - peek;
    const bottom = slot.top + slot.height >= area.bottom - E ? area.bottom : area.bottom - peek;
    return { left, top, width: right - left, height: bottom - top };
  }

  function placePane(c, box, z, lifted) {
    const st = c.style;
    st.setProperty('left', `${box.left}px`, 'important');
    st.setProperty('top', `${box.top}px`, 'important');
    st.setProperty('width', `${box.width}px`, 'important');
    st.setProperty('height', `${box.height}px`, 'important');
    st.setProperty('z-index', String(z), 'important');
    // The app dims unfocused panes with filter: opacity(), which would let
    // the covered panes show through a grown one.
    // A locked pane swaps the hairline for an accent ring, so the lock shows.
    if (lifted) {
      st.setProperty('box-shadow', '0 14px 48px -10px rgba(0,0,0,.55), ' + (locked
        ? '0 0 0 2px var(--cds-fill-accent, #d97757)' : '0 0 0 1px rgba(127,127,127,.18)'), 'important');
      st.setProperty('filter', 'none', 'important');
      st.setProperty('opacity', '1', 'important');
      st.setProperty('mix-blend-mode', 'normal', 'important');
    } else {
      for (const [n, v, pr] of pin.items.get(c).saved) {
        if (n !== 'box-shadow' && !(z !== 49 && ['filter', 'opacity', 'mix-blend-mode'].includes(n))) continue;
        v ? st.setProperty(n, v, pr) : st.removeProperty(n);
      }
    }
  }

  /** Our dots and the trigger follow the panes frame by frame while they move. */
  function follow() {
    followUntil = performance.now() + (reduceMotion.matches ? 0 : EXPAND_MS + 80);
    if (followRaf) return;
    const tick = () => {
      followRaf = 0;
      if (!pin) return;
      syncPanes(); positionOverlay();
      if (pin && performance.now() < followUntil) followRaf = requestAnimationFrame(tick);
    };
    followRaf = requestAnimationFrame(tick);
  }

  function expandPane(p) {
    if (expandMode === 'off' || p === expanded) return;
    clearTimeout(settleTimer); settleTimer = 0;
    if (!pin) pin = pinAll();
    if (!pin || !pin.items.has(p)) { resetExpand(); return; }
    const prev = expanded;
    expanded = p;
    for (const [c, { slot }] of pin.items) {
      if (c === p) placePane(c, bigBox(slot, pin.area), 50, true);
      else if (c === prev) placePane(c, slot, 49, false);   // stays on top while it shrinks
      else if (listPanes().includes(c)) placePane(c, slot, 0, false);
    }
    follow();
  }

  function collapsePane() {
    if (!expanded || !pin) return;
    const it = pin.items.get(expanded);
    if (it) placePane(expanded, it.slot, 49, false);
    expanded = null;
    follow();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { settleTimer = 0; if (!expanded) unpin(); }, (reduceMotion.matches ? 0 : EXPAND_MS) + 60);
  }

  function unpin() {
    if (followRaf) cancelAnimationFrame(followRaf);
    followRaf = 0; followUntil = 0;
    if (!pin) return;
    pin.ro.disconnect();
    restorePins(pin.items);
    pin = null;
    syncPanes(); positionOverlay();
  }

  /** Straight back to the app's layout, no animation. */
  function resetExpand() {
    clearTimeout(hoverTimer); clearTimeout(leaveTimer); clearTimeout(settleTimer);
    hoverTimer = 0; leaveTimer = 0; settleTimer = 0;
    expanded = null; hoverPane = null; hoverPoint = null; locked = false;
    unpin();
  }

  function hoverTo(p) {
    if (p === hoverPane) return;
    hoverPane = p;
    if (locked) return;   // remembered, acted on when the lock is released
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    hoverTimer = 0; leaveTimer = 0;
    if (p && p === expanded) return;
    if (!p) { leaveTimer = setTimeout(() => { leaveTimer = 0; collapsePane(); }, LEAVE_DELAY); return; }
    hoverTimer = setTimeout(() => {
      hoverTimer = 0;
      if (locked || hoverPane !== p || expandMode === 'off') return;
      if (hoverPoint) {
        const hit = document.elementFromPoint(hoverPoint.x, hoverPoint.y);
        if (hit === host || hit?.closest(PORTALS) || topPane(hit) !== p) { pauseHover(); return; }
      }
      const panes = listPanes();
      if (panes.length < 2 || !panes.includes(p)) { resetExpand(); return; }
      expandPane(p);
    }, HOVER_DELAY);
  }

  function pauseHover() {
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    hoverTimer = 0; leaveTimer = 0; hoverPane = undefined;
  }

  const onPointerMove = e => {
    if (expandMode === 'off') return;
    hoverPoint = { x: e.clientX, y: e.clientY };
    if (host && e.composedPath?.().includes(host)) { pauseHover(); return; }   // our own controls
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest(PORTALS)) { pauseHover(); return; }
    const p = topPane(t);
    if (p) return hoverTo(p);
    if (t.closest('.dframe-pane-host')) return;             // a divider between panes
    hoverTo(null);
  };
  const onPointerLeaveDoc = () => { if (expandMode !== 'off') hoverTo(null); };

  /** Capture phase, so it sees the press before the app can stop it. A press
   *  on an expanded pane locks it; a press outside the locked pane releases it.
   *  Other panes still wait for the hover delay. */
  const onPointerDown = e => {
    if (expandMode === 'off' || e.button !== 0) return;
    hoverPoint = { x: e.clientX, y: e.clientY };
    if (host && e.composedPath?.().includes(host)) { pauseHover(); return; }
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest(PORTALS)) { pauseHover(); return; }
    const p = topPane(t);
    if (locked) {
      if (p === expanded) return;
      locked = false;
      if (expanded) placePane(expanded, bigBox(pin.items.get(expanded).slot, pin.area), 50, true);
      const under = p || (t.closest('.dframe-pane-host') ? expanded : null);
      hoverPane = undefined;   // force hoverTo to act on the pane under the pointer
      hoverTo(under);
      return;
    }
    if (!p || listPanes().length < 2) return;
    if (p !== expanded) { hoverTo(p); return; }
    clearTimeout(hoverTimer); clearTimeout(leaveTimer);
    hoverTimer = 0; leaveTimer = 0;
    hoverPane = p;
    locked = true;
    placePane(p, bigBox(pin.items.get(p).slot, pin.area), 50, true);
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeaveDoc);

  function setExpandMode(m) {
    expandMode = m;
    localStorage.setItem(LS_EXPAND, m);
    resetExpand();
  }

  /** Called from the layout pass: pins describe a layout that no longer exists
   *  once panes are added, removed or replaced. */
  function checkExpand() {
    if (!pin) return;
    const panes = listPanes();
    if (!pin.host.isConnected || panes.length < 2 || panes.length !== pin.panes.length
        || panes.some(p => !pin.items.has(p) || p.parentElement !== pin.host)
        || [...pin.items.keys()].some(c => c.parentElement !== pin.host)) resetExpand();
  }
