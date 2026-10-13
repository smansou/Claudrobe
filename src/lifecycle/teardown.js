/* ───────────────────────────────────────────────────────────────────────────
 * lifecycle/teardown.js
 *   __cdtUninstall(): undo every listener, observer and style.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Teardown ───────────────────────────────────────────────────────────────

  window.__cdtUninstall = () => {
    observer.disconnect(); modeObserver.disconnect();
    clearTimeout(pending); clearInterval(visTimer);
    if (rafId) cancelAnimationFrame(rafId);
    if (accentRaf) cancelAnimationFrame(accentRaf);
    if (visRaf) cancelAnimationFrame(visRaf);
    mql.removeEventListener?.('change', onModeChange);
    history.pushState = origPush; history.replaceState = origReplace;
    window.open = origOpen;
    window.removeEventListener('popstate', onPop);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey, true);
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('pointermove', onPointerMove, { capture: true });
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.documentElement.removeEventListener('pointerleave', onPointerLeaveDoc);
    resetExpand();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(HOST_ID)?.remove();
    document.documentElement.style.removeProperty(VAR);
    document.documentElement.removeAttribute('data-cdt-accent');
    document.documentElement.removeAttribute('data-cdt-border');
    document.documentElement.style.removeProperty('--cdt-border-w');
    document.documentElement.style.removeProperty('--cdt-fill');
    if (styleRaf) cancelAnimationFrame(styleRaf);
    clearPanes();
    clearRows();
    delete window.__cdtUninstall; delete window.__cdtStatus;
    console.log('%cclaude-theme removed', 'color:#8be9fd');
  };
