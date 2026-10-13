/* ───────────────────────────────────────────────────────────────────────────
 * palettes/index.js — The palette list, and which half of it to offer.
 *
 * Joins the two tables into THEMES, keeps the "app default" entry that means
 * "no overrides", and follows the app's own light/dark setting rather than
 * warning about a mismatch.
 * ─────────────────────────────────────────────────────────────────────────── */


  const DEFAULT_THEME = { slug: '__default', label: 'Claude (app default)', isDefault: true,
                          base: '#2a2a28', text: '#f5f5f3', muted: '#8d8b85',
                          accent: '#d97757', border: '#3a3a37', brightness: 50 };

  // An optional 11th entry carries per-palette extras the remap honours:
  //   tint     — saturation for remapped chrome, held flat instead of fading
  //              towards the surfaces. For palettes whose identity IS a
  //              coloured background (tiki's wood-brown); the default ramp
  //              would grey it out.
  //   semantic — the palette's own hues for saturated colours (errors,
  //              warnings, diffs, git status), by hue family, in place of
  //              Claude's. See semanticTarget().
  const toTheme = mode => ([slug, label, code, deep, base, text, text2, muted, accent, border, extra]) =>
    ({ slug, label, code, deep, base, text, text2, muted, accent, border, mode, brightness: 50, ...extra });
  const paletteBrightness = t => Number.isFinite(t.brightness) ? clamp(t.brightness, 0, 100) : 50;

  const THEMES = [DEFAULT_THEME,
    ...RAW.map(toTheme('dark')), ...RAW_LIGHT.map(toTheme('light'))];

  /** Which palettes to offer. Rather than warning about a mismatch, the list
   *  simply follows the app: dark palettes in dark mode, light in light. */
  function appMode() {
    const m = document.documentElement.dataset.mode;
    if (m === 'light' || m === 'dark') return m;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const themesForMode = () => {
    const m = appMode();
    return allThemes().filter(t => t.isDefault || t.mode === m);
  };
