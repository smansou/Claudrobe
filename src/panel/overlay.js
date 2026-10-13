/* ───────────────────────────────────────────────────────────────────────────
 * panel/overlay.js
 *   The panel's own chrome: where it sits, and when it is stale.
 *
 * Docks the trigger after the sidebar's back/forward buttons, positions the
 * panel and the per-pane colour popover against the pane they belong to, and
 * exposes a signature so a repaint only happens when something actually
 * changed.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── UI ─────────────────────────────────────────────────────────────────────

  let shadow = null, host = null, open = false, tab = 'theme';
  let accentOpen = -1;   // index into paneInfo of the pane whose colour popover is open
  let paneInfo = [];     // [{ el, id, visible, x, y }] — one entry per pane
  let navRect = null;    // the sidebar's top-bar button the theme trigger docks after

  /** Colours for our own chrome. On a themed palette these come from the
   *  palette; on "Claude (app default)" they must come from the live captured
   *  tokens instead. Hardcoding dark values there made the controls invisible
   *  in light mode — white at 45% opacity on a white page. */
  function uiPalette() {
    if (!current.isDefault) return current;
    const pick = (n, fb) => firstHex(baseline.get(n) || '') || fb;
    const text = pick('--cds-text-primary', '#f5f5f3');
    return {
      base: pick('--cds-surface-1', '#2a2a28'),
      text,
      text2: pick('--cds-text-secondary', text),
      muted: pick('--cds-text-muted', '#8d8b85'),
      border: `color-mix(in srgb, ${text} 18%, transparent)`,
      accent: DEFAULT_THEME.accent,
    };
  }

  function mountUI() {
    host = document.createElement('div');
    host.id = HOST_ID;
    Object.assign(host.style, { position: 'fixed', inset: '0', pointerEvents: 'none',
                                zIndex: '2147483647' });
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    syncPanes();
    renderUI();
  }

  // ── Where our controls sit ──
  // Nothing is inserted into the app's own DOM: React owns it, and an element
  // it does not know about either gets thrown away on the next render or
  // shifts the app's layout. The controls live in our fixed overlay and are
  // positioned against the app's elements instead.

  const notOurs = e => e !== host && !(host && host.contains(e));

  /** The pane's title bar and its right-hand button group, as the app names
   *  them. The stylesheet reserves a fixed slot at the start of the button
   *  group (see baseCSS), so the dot sits there at any pane width: the title
   *  truncates a little earlier instead of the dot landing on the repo chip,
   *  and buttons the app adds later only push the group, slot included. */
  function titleAnchor(p) {
    const bar = p.querySelector('.epitaxy-titlebar');
    const end = bar?.querySelector('.epitaxy-titlebar-end');
    if (!bar || !end) return { x: 0, y: 0, ok: false };
    const bb = bar.getBoundingClientRect(), eb = end.getBoundingClientRect();
    if (!bb.width || !eb.width) return { x: 0, y: 0, ok: false };
    const pb = p.getBoundingClientRect();
    const x = eb.left + DOT_SLOT / 2, y = bb.top + bb.height / 2;
    return { x, y, ok: x >= pb.left + 12 && x <= pb.right - 12 && y >= pb.top && y <= pb.bottom };
  }

  /** The last of the sidebar's top-bar buttons (back / forward / search). A
   *  cached element that has been hidden (the app keeps copies of the bar
   *  for other views) is dropped and the search runs again. */
  let navEl = null;
  function findNav() {
    let r = navEl?.isConnected ? navEl.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height || r.right <= 0 || r.left >= innerWidth || r.top < 0
        || getComputedStyle(navEl).visibility === 'hidden') {
      const cands = [...document.querySelectorAll('button[aria-label], a[aria-label], [role="button"][aria-label]')]
        .filter(b => { const x = b.getBoundingClientRect();
          return x.width && x.height && x.width <= 48 && x.top >= 0 && x.top < 120
            && x.left >= 0 && x.left < Math.min(700, innerWidth) && !b.closest(PANE_SEL)
            && getComputedStyle(b).visibility !== 'hidden' && notOurs(b); });
      const by = re => cands.filter(b => re.test(b.getAttribute('aria-label')))
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
      navEl = by(/^forward$|forward/i) || by(/^back$|\bback\b/i) || by(/sidebar|navigation/i) || null;
      r = navEl ? navEl.getBoundingClientRect() : null;
    }
    return r && r.width ? r : null;
  }

  function syncPanes() {
    const panes = listPanes();
    paneInfo = panes.map(p => {
      const r = p.getBoundingClientRect();
      const info = { el: p, id: paneSessionId(p, panes), visible: false, x: 0, y: 0 };
      if (r.width < 160 || r.height < 120) return info;
      const a = titleAnchor(p);
      info.x = a.x; info.y = a.y;
      // Covered by a modal (Settings) → hide, or it would float over it.
      const hit = document.elementsFromPoint(Math.round(a.x), Math.round(a.y)).find(notOurs);
      info.visible = a.ok && !!info.id && !!hit && (hit === p || p.contains(hit));
      return info;
    });
    navRect = findNav();
  }

  function syncPaneIdentity(panes = listPanes()) {
    if (panes.length !== paneInfo.length || panes.some((p, i) => paneInfo[i].el !== p)) {
      syncPanes();
      return;
    }
    for (const info of paneInfo) info.id = paneSessionId(info.el, panes);
  }

  function freshSessionTarget() {
    const p = paneInfo[accentOpen];
    const panes = listPanes();
    if (!p || !panes.includes(p.el)) return null;
    forgetPaneIds();
    p.id = paneSessionId(p.el, panes);
    return p.id;
  }

  const TRIG = 26, PANEL_W = 284, DOTS_W = 232, DOT_SLOT = 30;
  function triggerPos() {
    if (navRect) {
      const left = Math.round(navRect.right + 4), top = Math.round(navRect.top + navRect.height / 2 - TRIG / 2);
      const hits = document.elementsFromPoint(left + TRIG / 2, top + TRIG / 2).filter(notOurs);
      const blocked = hits.some(el => el.closest?.(`${PANE_SEL}, button, a, input, [role="button"]`));
      if (!blocked && left + TRIG < innerWidth - 8 && top >= 8) return { left, top, docked: true };
    }
    return { left: innerWidth - 16 - TRIG, top: innerHeight - 16 - TRIG, docked: false };
  }
  function panelStyle(t) {
    if (!t.docked) return `right:16px; bottom:${16 + TRIG + 8}px; max-height:72vh;`;
    const top = t.top + TRIG + 8;
    return `left:${clamp(t.left - 120, 8, innerWidth - PANEL_W - 8)}px; top:${top}px;` +
           ` max-height:${Math.max(240, innerHeight - top - 16)}px;`;
  }

  /** The cheap update: move everything, rebuild nothing. renderUI() replaces
   *  the shadow root's markup wholesale, and the app mutates its DOM
   *  constantly; rebuilding on every mutation destroyed the panel under the
   *  pointer, so a click never completed. Following the app around only ever
   *  needs this. */
  function positionOverlay() {
    if (!shadow) return;
    const t = triggerPos();
    const trig = shadow.querySelector('.trigger');
    if (trig) {
      trig.style.cssText = `left:${t.left}px; top:${t.top}px;`;
      trig.toggleAttribute('data-floating', !t.docked);
    }
    const panel = shadow.querySelector('.panel');
    if (panel) panel.style.cssText = panelStyle(t);
    // Individual properties, not cssText: each dot carries its colour in an
    // inline custom property that a cssText write would wipe.
    shadow.querySelectorAll('.pick').forEach(b => {
      const p = paneInfo[+b.dataset.i];
      if (p && p.visible) {
        b.style.left = `${Math.round(p.x)}px`; b.style.top = `${Math.round(p.y)}px`; b.style.display = '';
      } else b.style.display = 'none';
    });
    const dots = shadow.querySelector('.dots');
    if (dots) {
      const p = paneInfo[accentOpen];
      const height = dots.offsetHeight;
      const top = p && p.y + 16 + height <= innerHeight - 8 ? p.y + 16 : Math.max(8, (p?.y || 8) - height - 16);
      dots.style.cssText = p && p.visible
        ? `left:${clamp(Math.round(p.x - 16), 8, Math.max(8, innerWidth - DOTS_W - 8))}px; top:${Math.round(top)}px; max-height:${innerHeight - 16}px; overflow:auto;`
        : 'display:none;';
    }
  }

  /** What the overlay's markup depends on, so a pass only rebuilds it when
   *  one of these actually changed. */
  const overlaySig = () => paneInfo.map(p => `${p.id}:${colorForSession(p.id)}:${p.visible}`).join('|')
    + `|${!!navRect}` + paneInfo.map(p => `:${iconForSession(p.id)}`).join('');
  let lastSig = '';
