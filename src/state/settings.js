/* ───────────────────────────────────────────────────────────────────────────
 * state/settings.js — Everything the user set, read once at install.
 *
 * The chosen theme, the text options, border style and width, fill intensity
 * and the pane settings — each with its migration for values written by an
 * older version.
 * ─────────────────────────────────────────────────────────────────────────── */

  let current = storedTheme() || DEFAULT_THEME;
  let sessionMap = readJSON(LS_SESSIONS, {});
  // v1 wrote weight:'normal' as its *default*, which was itself an override.
  // Anyone carrying that value never chose it, so it migrates to 'App'.
  const storedText = readJSON(LS_TEXT, {});
  if (!(storedText.v >= 2) && storedText.weight === 'normal') delete storedText.weight;
  // v3 split the one font picker into app and transcript fonts. The old
  // picker changed both, so a font chosen before keeps applying to both.
  if (!(storedText.v >= 3) && storedText.font) storedText.tfont = storedText.font;
  storedText.v = 3;
  let textOpts = Object.assign(
    { weight: 'default', brightness: 50, font: '', tfont: '', mono: '' }, storedText);
  const brightnessTheme = `${appMode()}:${current.slug}`;
  textOpts.brightness = (!storedText.brightnessTheme || storedText.brightnessTheme === brightnessTheme) && Number.isFinite(storedText.brightness)
    ? clamp(storedText.brightness, 0, 100) : paletteBrightness(current);
  textOpts.brightnessTheme = brightnessTheme;
  scanned = readJSON(LS_FONTS, null);
  const BORDER_STYLES = ['line', 'glow', 'fill'];
  let borderStyle = BORDER_STYLES.includes(localStorage.getItem(LS_BORDER))
    ? localStorage.getItem(LS_BORDER) : 'line';
  // Clamped: below 1 the line vanishes, above 6 the glow eats the transcript.
  const WIDTH_MIN = 1, WIDTH_MAX = 6;
  let borderWidth = clamp(parseFloat(localStorage.getItem(LS_WIDTH)) || 2, WIDTH_MIN, WIDTH_MAX);
  // Fill intensity, 0-100 on the slider. The curve is steep at the top and
  // nearly flat at the bottom, so the first half of the slider is all very
  // light tints and only the far end reaches an opaque wash.
  const LS_FILL = 'cdt:fill';
  let fillLevel = clamp(parseFloat(localStorage.getItem(LS_FILL)) || 25, 0, 100);
  const fillPct = () => Math.round((2 + 98 * (fillLevel / 100) ** 2.4) * 10) / 10;
  // Panes tab: hover-to-expand ('off' | 'most') and status-tinted titles. An
  // 'all' mode existed briefly; it now means 'most'.
  const LS_EXPAND = 'cdt:expand', LS_TSTATUS = 'cdt:titleStatus';
  const EXPAND_MODES = ['off', 'most'];
  let expandMode = localStorage.getItem(LS_EXPAND) === 'all' ? 'most'
    : EXPAND_MODES.includes(localStorage.getItem(LS_EXPAND)) ? localStorage.getItem(LS_EXPAND) : 'off';
  let titleStatus = localStorage.getItem(LS_TSTATUS) !== 'off';
  const TEXT_DEFAULTS = { weight: 'default', brightness: 50, font: '', tfont: '', mono: '' };
