/* ───────────────────────────────────────────────────────────────────────────
 * remap/curve.js — The remap itself: app grey to palette grey.
 *
 * Builds the source-to-theme tone curve out of the baseline's own anchors, so
 * it works from a dark app and a light app alike, and returns the function
 * that recolours one token value.
 * ─────────────────────────────────────────────────────────────────────────── */


  /** Contrast floors separate chrome without imposing text-level contrast.
   *  Light borders use 1.65:1, deep surfaces 1.18:1, raised surfaces 1.10:1.
   *  Explicit `raised` colours and custom `borderMin` values remain overrides. */
  const effBorder = t => ensureContrast(t.border, t.base, t.borderMin || (t.mode === 'light' ? 1.65 : 1.45));
  const effDeep = t => t.mode === 'light' && !t.slug?.startsWith('user:') && t.slug !== '__custom'
    ? ensureContrast(t.deep, t.base, 1.18) : t.deep;
  const effRaised = t => t.raised
    || (t.mode === 'light' ? ensureContrast(shade(t.base, -0.055), t.base, 1.10)
                         : ensureContrast(shade(t.base, 0.05), t.base, 1.15));
  const effRaised2 = t => t.raised2 || (t.mode === 'light'
    ? ensureContrast(shade(effRaised(t), -0.035), t.base, 1.16)
    : ensureContrast(shade(effRaised(t), 0.04), t.base, 1.28));

  function makeRemapper(theme, text) {
    const L = h => hex2hsl(h)[2];
    const baseHSL = hex2hsl(theme.base);
    const hue = baseHSL[0];
    const satCap = Math.min(baseHSL[1], 0.22);
    // "Brighter" means further from the page background, so the sign flips on
    // a light palette where the text is the dark end of the ramp.
    const b = (text.brightness - 50) / 180 * (theme.mode === 'light' ? -1 : 1);

    // Tone curve: the app's lightness -> the theme's lightness.
    //
    // Anchored on the app's own key colours as captured live, each mapped onto
    // the theme's matching colour: surface 0 -> deep, surface 1 -> base,
    // surfaces 2/3 -> raised, border -> border, the three text levels -> the
    // theme's three. Everything in between interpolates.
    //
    // This replaces a fixed curve that assumed the app was in LIGHT mode
    // (surfaces near white, text near black) and inverted accordingly. With
    // the app in dark mode its colours arrive already dark, and that curve
    // turned them inside out: white "lighten" overlays (the effort slider's
    // track, hover fills) came out dark and vanished, and dark surfaces that
    // are not pinned came out at text lightness, as pale bands. Reading the
    // anchors from the baseline makes the map correct for either source.
    const srcL = n => { const v = firstHex(baseline?.get(n) || ''); return v ? L(v) : null; };
    const raised = effRaised(theme);
    const tgt = {
      text: clamp(L(theme.text) + b, 0, 1),
      text2: clamp(L(theme.text2 || theme.text) + b * 0.7, 0, 1),
      muted: clamp(L(theme.muted) + b * 0.5, 0, 1),
      border: L(effBorder(theme)),
      deep: L(effDeep(theme)), base: L(theme.base), raised: L(raised),
      raised2: L(theme.raised2 || (theme.mode === 'light' ? effRaised2(theme) : shade(raised, 0.04))),
    };
    const anchors = [
      ['--cds-surface-0', tgt.deep], ['--cds-surface-1', tgt.base],
      ['--cds-surface-2', tgt.raised], ['--cds-surface-3', tgt.raised2],
      ['--cds-border', tgt.border], ['--cds-text-muted', tgt.muted],
      ['--cds-text-secondary', tgt.text2], ['--cds-text-primary', tgt.text],
    ].map(([n, y]) => [srcL(n), y]).filter(([x]) => x != null);
    const srcText = srcL('--cds-text-primary'), srcPage = srcL('--cds-surface-1');
    const srcDark = srcText != null && srcPage != null && srcText > srcPage;
    let curve;
    if (anchors.length >= 5 && srcText != null && srcPage != null) {
      // Sorted by source lightness and forced monotonic in the right
      // direction, so two app tokens that happen to cross can never fold the
      // map back on itself.
      anchors.sort((p, q) => p[0] - q[0]);
      const up = srcDark === (theme.mode !== 'light');
      const mono = [];
      for (const [x, y] of anchors) {
        const last = mono.at(-1);
        if (last && Math.abs(x - last[0]) < 1e-4) continue;
        if (last && (up ? y < last[1] : y > last[1])) continue;
        mono.push([x, y]);
      }
      const lo = up ? Math.max((theme.mode === 'light' ? tgt.text : tgt.deep) - 0.03, 0.01)
                    : clamp((theme.mode === 'light' ? tgt.base : tgt.text) + 0.02, 0, 1);
      const hi = up ? clamp((theme.mode === 'light' ? tgt.base : tgt.text) + 0.03, 0, 1)
                    : theme.mode === 'light' ? tgt.text : tgt.raised;
      curve = [[0, lo], ...mono.filter(([x]) => x > 0 && x < 1), [1, hi]];
    } else {
      // Fallback for a baseline without the anchors: the original fixed curve.
      curve = [
        [0.000, clamp(tgt.text + 0.02, 0, 1)], [0.060, tgt.text], [0.320, tgt.text2],
        [0.520, tgt.muted], [0.720, tgt.border], [0.930, Math.max(tgt.deep - 0.02, 0.015)],
        [0.975, tgt.deep], [0.990, tgt.base], [1.000, L(shade(theme.base, 0.08))],
      ];
    }
    const mapL = t => {
      if (t <= curve[0][0]) return curve[0][1];
      for (let i = 0; i < curve.length - 1; i++) {
        const [x0, y0] = curve[i], [x1, y1] = curve[i + 1];
        if (t <= x1) return lerp(y0, y1, x1 === x0 ? 0 : (t - x0) / (x1 - x0));
      }
      return curve.at(-1)[1];
    };

    const toLight = theme.mode === 'light';

    // Saturation fades towards the surfaces (where a strong tint reads as a
    // colour cast) and is fullest at text lightness. Measured on the OUTPUT
    // lightness, so it behaves the same whichever mode the app is in.
    const span = Math.abs(tgt.text - tgt.base) || 1;
    const neutralRamp = l => {
      const out = mapL(l);
      const k = clamp(Math.abs(out - tgt.base) / span, 0, 1);
      return hsl2hex([hue, theme.tint ?? satCap * (0.35 + 0.65 * k), out]);
    };

    return function remapHex(raw, shadowy, tintBg) {
      // Normalised to 6 digits up front. The "leave it alone" branches below
      // used to return the matched text verbatim, and the caller then appended
      // the alpha it had already parsed off — so #0006 came back as #000666
      // and #0000001f as #0000001f1f. Every branch now returns 6 digits and
      // the caller owns the alpha.
      const hex = rgb2hex(hex2rgb(raw));
      const [h, s, l] = hex2hsl(hex);
      if (shadowy) {
        if (s <= NEUTRAL_MAX_SAT) {
          // A near-white inside a shadow token is not shadow — it is the
          // surface showing through an inset hairline (--cds-focus-shadow's
          // `inset 0 0 0 1px #fcfcfb`), so it still follows the palette.
          // Everything darker is occlusion and is left exactly as the app
          // set it.
          return l >= 0.35 ? neutralRamp(l) : hex;
        }
        // A pale tinted halo is drawn to read against a white page; on a dark
        // one it flares. Hold the hue, drop it to mid lightness, and the focus
        // ring stays a focus ring instead of becoming a lamp.
        if (!toLight && l > 0.75) return hsl2hex([h, Math.min(s, 0.6), 0.45]);
        // No contrast floor here: that floor exists for text, and applying it
        // to a 20%-alpha glow colour only makes the glow brighter.
        return hex;
      }
      if (s > NEUTRAL_MAX_SAT) {
        // Semantic colours only need adjusting when the surface under them
        // flips. Targeting a light palette from light-mode defaults leaves
        // them already correct, so touching them would only degrade them.
        if (toLight) return hex;
        // A palette that names its own semantic hues swaps Claude's for the
        // nearest family; the lightness handling below still applies.
        const target = theme.semantic && semanticTarget(theme.semantic, h);
        const [th, ts] = target ? hex2hsl(target) : [h, s];
        // Pale saturated fills (#fad6d6 danger, #caeac7 success, #cde2fb
        // accent) are *backgrounds*, not text — on a dark surface they have to
        // become dark tints of the same hue or they glare.
        if (l > 0.80) return hsl2hex([th, Math.min(ts, 0.55), 0.22]);
        // The same backgrounds captured with the app already in dark mode
        // arrive as dark tints (--cds-bg-danger is role-danger-800 there).
        // They are correct as they are; the foreground lift below would turn
        // them into solid mid-tone blocks with unreadable text on top.
        if (tintBg && l < 0.42) return hsl2hex([th, Math.min(ts, 0.55), clamp(l, 0.14, 0.26)]);
        // From a dark app, the deep end of every colour scale (--cds-red-800
        // is #3c0e0e there) is a tinted surface too, whatever its name. Swapping
        // in the palette's full-strength colour turned those into bright blocks.
        if (srcDark && l < 0.32) return hsl2hex([th, Math.min(ts, 0.55), clamp(l, 0.1, 0.3)]);
        // Saturated foregrounds only need enough lift to stay legible.
        let out = target
          || (l < 0.42 ? hsl2hex([h, s, clamp(l + 0.18, 0.42, 0.72)]) : hex);
        // A fixed lightness threshold is not enough on its own: colours in the
        // middle of the range (inline code's #c7254e at L=0.46) clear it yet
        // are still barely readable on a dark page. Raise lightness, keeping
        // hue and saturation, until the contrast floor is met.
        let li = hex2hsl(out)[2], guard = 0;
        while (contrast(out, theme.base) < 3.4 && li < 0.82 && guard++ < 14) {
          li += 0.04;
          out = hsl2hex([th, ts, li]);
        }
        return out;
      }
      // Neutral chrome: run it through the curve, retinted to the theme's hue.
      return neutralRamp(l);
    };
  }
