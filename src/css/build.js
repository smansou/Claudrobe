/* ───────────────────────────────────────────────────────────────────────────
 * css/build.js — Build the stylesheet for a theme.
 *
 * Splits into the themed path, which remaps every captured colour, and the
 * "app default" path, which emits only the text rules. Pins the handful of
 * tokens that define the theme's identity so surfaces do not drift apart, and
 * gives the accent, hover states and the app's variable font the treatment
 * each one needs.
 * ─────────────────────────────────────────────────────────────────────────── */


  /** Brightness on the unthemed app palette. The themed path folds this into
   *  the tone curve, but "Claude (app default)" emits no colour overrides at
   *  all, so the slider needs its own pass or the Text tab looks broken there.
   *  "Up" means away from the page background, which reads as brighter on a
   *  dark page and as deeper ink on a light one — correct either way. */
  function defaultTextCSS(text) {
    if (text.brightness === 50) return '';
    const amt = (text.brightness - 50) / 100;
    const page = firstHex(baseline.get('--cds-surface-1') || '') || '#ffffff';
    const dir = lum(page) < 0.4 ? 1 : -1;
    const lines = [];
    for (const [name, value] of baseline) {
      if (!/^--cds-(text|fg)/.test(name)) continue;
      const next = remapValue(value, h => shade(h, dir * amt * 0.8));
      if (next !== value) lines.push(`    ${name}: ${next} !important;`);
    }
    return lines.length ? `.cds-root.cds-root {\n${lines.join('\n')}\n}\n` : '';
  }

  function buildCSS(theme, text) {
    if (theme.isDefault) return defaultTextCSS(text) + baseCSS(text);

    const remapHex = makeRemapper(theme, text);
    const toDark = theme.mode !== 'light';
    // Overlay alphas only need raising when light-mode overlays (5% black
    // on white) are being moved onto a dark page. Captured from a dark app
    // they are already tuned for dark.
    const pageHex = firstHex(baseline.get('--cds-surface-1') || '');
    const srcLight = !pageHex || hex2hsl(pageHex)[2] > 0.5;
    const lines = [];
    for (const [name, value] of baseline) {
      if (ON_CONTENT.test(name)) continue;
      // Alpha first, while the source hex is still the app's own: the test
      // for "is this a neutral overlay" only works on the original value.
      const src = (toDark && srcLight && !SHADOWY.test(name)) ? boostOverlayAlpha(value) : value;
      const next = remapValue(src, remapHex, name);
      if (next !== value) lines.push(`    ${name}: ${next} !important;`);
    }

    // Pin the handful of tokens that define the theme's identity, so surfaces
    // land exactly on the palette rather than on an interpolated approximation.
    const border = effBorder(theme);
    const deep = effDeep(theme);
    const s2 = effRaised(theme);
    const s3 = effRaised2(theme);
    const titlebar = theme.titlebar || shade(deep, 0.035);
    const sidebar = theme.sidebar || deep;
    const input = theme.input || s3;
    const b = (text.brightness - 50) / 100 * (theme.mode === 'light' ? -1 : 1);
    const fg = b >= 0 ? shade(theme.text, b * 0.9) : shade(theme.text, b * 0.55);
    const muted = ensureContrast(shade(theme.muted, b * 0.5), theme.base, 2.4);
    // Overlay fills, given as (light %, dark %) — dark surfaces need the
    // larger share for the same apparent step.
    const over = (c, lightPct, darkPct) =>
      `color-mix(in srgb, ${c} ${theme.mode === 'light' ? lightPct : darkPct}%, transparent)`;

    // Accent, darkened until a white label clears 3.2:1, then pushed until it
    // also separates from the page. Both loops are usually no-ops on a light
    // palette, whose accents are already dark.
    let primary = theme.accent, g = 0;
    while (contrast(primary, '#ffffff') < 3.2 && g++ < 20) primary = shade(primary, -0.08);
    for (g = 0; contrast(primary, theme.base) < 1.9 && g < 20; g++) {
      primary = shade(primary, theme.mode === 'light' ? -0.06 : 0.06);
    }
    const pinned = {
      '--cds-surface-0': deep, '--cds-surface-1': theme.base,
      '--cds-surface-2': s2, '--cds-surface-3': s3,
      '--cds-surface-panel': s2, '--cds-surface-popover': s3,
      '--cds-text-primary': fg,
      '--cds-text-secondary': ensureContrast(shade(theme.text2, b * 0.6), theme.base, 3.2),
      '--cds-text-muted': muted,
      '--cds-border': border,
      '--cds-border-strong': shade(border, toDark ? 0.12 : -0.10),
      '--cds-border-stronger': shade(border, toDark ? 0.26 : -0.20),
      '--cds-text-accent': theme.accent,
      '--cds-border-accent': `color-mix(in srgb, ${theme.accent} 55%, transparent)`,
      '--cds-bg-accent': `color-mix(in srgb, ${theme.accent} 20%, transparent)`,

      // Hover and selected states for sidebar rows, buttons and chips.
      // These ship as `hsl(from #0b0b0b h s l / 5%)` — 5% black over a white
      // page, which is clearly visible. Remapping the hex alone produces 5%
      // of a pale colour over a dark page, which is almost nothing, so these
      // need their alpha raised rather than just their hue moved.
      // The app gives all of these the same two steps (5% resting, 10%
      // hovered), so they keep the same two steps here rather than drifting
      // apart per token.
      '--cds-bg-neutral': over(fg, 9, 11),
      '--cds-bg-neutral-hover': over(fg, 15, 18),
      '--cds-bg-neutral-chip': over(fg, 9, 11),
      '--cds-bg-neutral-chip-hover': over(fg, 15, 18),

      // The hover and selected states the sidebar rows and the
      // terminal/browser/explorer buttons actually use. Pinning --cds-bg-*
      // alone missed them: those controls read the fill-ghost family.
      '--cds-fill-ghost-hover': over(fg, 9, 11),
      '--cds-fill-ghost-selected': over(fg, 15, 18),
      '--cds-fill-secondary-hover': over(fg, 9, 11),
      '--cds-fill-control': over(fg, 10, 13),
      '--cds-fill-control-hover': over(fg, 17, 21),
      '--cds-fill-disabled': over(fg, 7, 9),
      // Without this the user's own turns are indistinguishable from Claude's:
      // the app ships 5% black, which recolours to 5% of a pale tint.
      '--cds-bg-user-message': over(fg, 8, 10),

      // Primary buttons: the New button's disc, the Submit in a question
      // card. The app's #0b0b0b is "the opposite of the page", and neither
      // reading of that survives a dark theme — keep it dark and it vanishes
      // into the page, invert it and the white label on it vanishes instead.
      // The theme's accent is the way out: saturated, so it separates from
      // the page in every palette, and darkened here only as far as a white
      // label needs. Verified across all 32 palettes — label ≥ 3.23:1 on the
      // fill, fill ≥ 3.15:1 against the page.
      '--cds-fill-primary': primary,
      '--cds-fill-primary-hover': shade(primary, theme.mode === 'light' ? -0.1 : 0.12),
    };
    if (!toDark) {
      Object.assign(pinned, {
        '--cdt-surface-titlebar': titlebar,
        '--cdt-surface-input': input,
      });
      for (const name of baseline.keys()) {
        const role = name.match(/^--cds-(?:surface|bg|fill)-(titlebar|sidebar|input)$/)?.[1];
        if (role) pinned[name] = { titlebar, sidebar, input }[role];
      }
    }
    const sectionCSS = toDark ? '' : `
.cds-root.cds-root .dframe-pane .epitaxy-titlebar {
    background-color: var(--cdt-surface-titlebar) !important;
    border-bottom-color: var(--cds-border) !important;
}
.cds-root.cds-root :is(input:not([type]), input[type="text"], input[type="search"],
    input[type="email"], input[type="url"], input[type="password"], input[type="number"], textarea) {
    background-color: var(--cdt-surface-input) !important;
}
`;
    for (const [k, v] of Object.entries(pinned)) lines.push(`    ${k}: ${v} !important;`);

    return `/* claude-theme.js — ${theme.label} */
.cds-root.cds-root {
${lines.join('\n')}
    color-scheme: ${theme.mode};
}
${sectionCSS}${baseCSS(text)}`;
  }
