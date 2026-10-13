/* ───────────────────────────────────────────────────────────────────────────
 * apply-theme.js
 *   Switch the active theme and republish everything that depends on it.
 * ─────────────────────────────────────────────────────────────────────────── */


  function applyTheme(theme) {
    current = theme;
    textOpts.brightness = paletteBrightness(theme);
    textOpts.brightnessTheme = `${appMode()}:${theme.slug}`;
    writeJSON(LS_TEXT, textOpts);
    localStorage.setItem(themeKey(), theme.slug);
    applyStyle();
    paintAccent();
    renderUI();
  }
