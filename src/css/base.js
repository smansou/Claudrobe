/* ───────────────────────────────────────────────────────────────────────────
 * css/base.js — The parts of the stylesheet that are the same for every theme.
 *
 * Where our own controls sit, in shadow DOM so the app's CSS cannot reach
 * them; the panel, the colour wheel, the session dots and popover; the pane
 * accent in its line, glow and fill forms; and the sidebar lick.
 * ─────────────────────────────────────────────────────────────────────────── */


  /** Rules that apply regardless of palette (text controls + session accent). */
  function baseCSS(text) {
    // "App" emits nothing, so deselecting restores the app's own weights
    // exactly rather than flattening everything to 400.
    // Inheritance does the work; the only elements that need an explicit rule
    // are the ones carrying a Tailwind weight utility, because their own
    // declaration beats what they would otherwise inherit. Overriding only
    // the *light* utilities leaves medium/semibold/bold — and headings, and
    // <strong> — exactly as the app set them, so the hierarchy survives.
    //
    // The previous form matched :is(p,li,span,div,a,…):not(:is(…10 more…))
    // across the whole document. Correct, but it makes every style
    // recalculation walk that list for most of the DOM, and style recalc runs
    // on every mutation batch the app produces.
    // The app's type is a VARIABLE font driven by a wght axis — it exposes
    // --cds-font-axis-wght plus named steps, and applies them through
    // font-variation-settings. font-variation-settings beats font-weight
    // outright, so every font-weight rule I wrote before was inert in the
    // real app no matter how the selector was shaped (it worked in a test
    // page only because that page used a static font).
    //
    // The named steps move with the base so the hierarchy survives: pick
    // Thin and bold text becomes lighter too, but still visibly bolder than
    // body text. font-weight is still emitted for anything static.
    //
    // Two token families carry weight, and both have to move:
    //  - --cds-font-weight-* (numbers, 400/500/580/600) feed font-weight
    //    directly. The transcript's response text is one of these consumers
    //    (.font-claude-response-body uses --cds-font-weight-regular), so
    //    leaving them alone is why the main text ignored the setting.
    //  - --cds-font-wght-* hold axis tuples ("wght" 360), not numbers, and feed
    //    --cds-font-axis-wght-* and from there font-variation-settings. Writing
    //    bare numbers into the axis tokens made every one of those
    //    declarations invalid. The app sets the tuples only in dark mode
    //    (light mode uses `normal` and lets font-weight drive), so they are
    //    only overridden in dark mode too.
    const w = WEIGHTS[text.weight] || 400;
    const d = w - 400; // shift from the app's regular weight
    const num = n => clamp(Math.round(n), 100, 900);
    const axis = n => `"wght" ${num(n)}`;
    const STEPS = [['regular', 400, 360], ['medium', 500, 460],
                   ['semibold', 580, 540], ['bold', 600, 560]]; // [name, weight, dark-mode axis]
    const weightCSS = text.weight === 'default' ? '' : `
.cds-root.cds-root {
    --cdt-weight: ${w};
${STEPS.map(([n, wt]) => `    --cds-font-weight-${n}: ${num(wt + d)} !important;`).join('\n')}
${appMode() === 'dark'
    ? STEPS.map(([n, , ax]) => `    --cds-font-wght-${n}: ${axis(ax + d)} !important;`).join('\n') : ''}
    font-weight: var(--cdt-weight);
}
.cds-root.cds-root [class*="font-normal"],
.cds-root.cds-root [class*="font-light"],
.cds-root.cds-root [class*="font-thin"] { font-weight: var(--cdt-weight); }
`;

    // The app resolves every family through a token — --cds-font-sans,
    // --cds-font-mono, --_prose-font-body and friends — and then writes
    // `font-family: var(--cds-font-sans)` onto the elements themselves. An
    // author declaration on the element beats anything inherited, which is
    // why setting a family on a container changed nothing. Redefining the
    // tokens is both the thing that actually works and the cheapest possible
    // rule: one selector, no matching cost, and it reaches every consumer
    // including ones not enumerated here.
    //
    // Three independent families: the app's chrome, the transcript (Claude's
    // replies and your own messages), and code. The transcript reads its own
    // tokens (--font-claude-response, --font-user-message, the .prose ones),
    // but it sits inside the app, so an app font would otherwise reach it
    // through the inherited family and the shared --font-ui token. The
    // transcript container therefore re-declares the app tokens back to the
    // app's originals (captured at install) unless a transcript font is set —
    // its own tokens too, since --font-user-message is var(--font-ui) resolved
    // at :root, so restoring --font-ui alone arrives too late.
    const app = proseStackOf(text);
    const tr = transcriptStackOf(text);
    const mono = monoStackOf(text);
    const TR = '[data-testid="epitaxy-virtual-transcript"]';
    const decl = (names, stack) =>
      names.map(n => `    ${n}: ${stack} !important;`).join('\n');
    const restore = names => names.map(n => fontBase[n]
      ? `    ${n}: ${fontBase[n]} !important;` : '').filter(Boolean).join('\n');

    let fontCSS = '';
    if (app) fontCSS += `
.cds-root.cds-root {
${decl(APP_FONT_TOKENS, app)}
    font-family: ${app} !important;
}
.cds-root.cds-root :is([class*="font-sans"], [class*="font-ui"], [class*="font-serif"]):not(${TR} *) {
    font-family: ${app} !important;
}
.cds-root.cds-root ${TR} {
${tr ? decl(APP_FONT_TOKENS, tr) : restore([...APP_FONT_TOKENS, ...TRANSCRIPT_FONT_TOKENS])}
    font-family: ${tr || fontBase.family || 'inherit'} !important;
}
`;
    if (tr) fontCSS += `
.cds-root.cds-root,
.cds-root.cds-root :is(.prose, [class*="--font-claude-response"], [class*="--font-user-message"], ${TR}) {
${decl(TRANSCRIPT_FONT_TOKENS, tr)}
}
.cds-root.cds-root ${TR},
.cds-root.cds-root ${TR} :is(p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd,
    [class*="font-claude-response"], [class*="font-user-message"], [class*="font-sans"],
    [class*="font-ui"], [class*="font-serif"]) {
    font-family: ${tr} !important;
}
`;
    if (mono) fontCSS += `
.cds-root.cds-root {
${decl(['--cds-font-mono', '--cds-font-mono-ui', '--_prose-font-mono', '--font-mono'], mono)}
}
.cds-root.cds-root :is(code, kbd, samp, pre, [class*="font-mono"]),
.cds-root.cds-root ${TR} :is(code, kbd, samp, pre, [class*="font-mono"]) {
    font-family: ${mono} !important;
}
`;

    return weightCSS + fontCSS + `

/* A fixed slot at the start of each pane's title-bar button group for the
   session-colour dot (drawn by our overlay). Reserving it in layout is what
   keeps the dot off the title and the repo chip at narrow widths. */
.dframe-pane .epitaxy-titlebar-start { min-width: 0; }
.dframe-pane .epitaxy-titlebar-end { padding-left: 30px !important; flex-shrink: 0; }

/* Session accent, per pane: each .dframe-pane carries its own colour, so a
   split view can show two. The style (line, glow, fill) and its strength are
   global, set on <html>. */
.dframe-pane[data-cdt-accent]::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 40;
    border-radius: 10px;
}
html[data-cdt-border="line"] .dframe-pane[data-cdt-accent]::after {
    border: calc(var(--cdt-border-w, 2) * 1px) solid var(${VAR});
}
/* A wash over the whole pane. At the low end of the slider it is a faint
   tint; at the top it is opaque and covers the transcript entirely, which is
   allowed on purpose. */
html[data-cdt-border="fill"] .dframe-pane[data-cdt-accent]::after {
    background: color-mix(in srgb, var(${VAR}) calc(var(--cdt-fill, 8) * 1%), transparent);
}
/* Soft inner glow: three stacked inset shadows rather than one. A single
   shadow either reads as a blurry line or washes the whole pane; layering a
   hairline edge, a tight falloff and a wide faint bloom gives the gradient a
   believable depth while keeping the pane's content readable. */
html[data-cdt-border="glow"] .dframe-pane[data-cdt-accent]::after {
    box-shadow:
      inset 0 0 0 calc(var(--cdt-border-w, 2) * 0.5px)
        color-mix(in srgb, var(${VAR}) 26%, transparent),
      inset 0 0 calc(var(--cdt-border-w, 2) * 11px) calc(var(--cdt-border-w, 2) * -3px)
        color-mix(in srgb, var(${VAR}) 45%, transparent),
      inset 0 0 calc(var(--cdt-border-w, 2) * 29px) calc(var(--cdt-border-w, 2) * 1px)
        color-mix(in srgb, var(${VAR}) 17%, transparent);
}

/* Session status on each pane's title pill, mirroring the sidebar's status
   light: waiting for input, unread reply, done, running. A tint rather than
   a dot, so it is much weaker than the sidebar's. The spread shadow extends
   the tint past the text without changing the pill's layout. --cdt-st is the
   colour read from the sidebar's own indicator; the alpha is registered so
   the running pulse can animate it. */
@property --cdt-st-a { syntax: "<percentage>"; inherits: true; initial-value: 14%; }
@keyframes cdt-st-pulse { 0%, 100% { --cdt-st-a: 5%; } 50% { --cdt-st-a: 20%; } }
[data-cdt-status] {
    --cdt-st-c: color-mix(in srgb, var(--cdt-st) var(--cdt-st-a), transparent);
    background-color: var(--cdt-st-c) !important;
    box-shadow: 0 0 0 3px var(--cdt-st-c);
    border-radius: 6px;
    transition: background-color .4s ease, box-shadow .4s ease;
}
[data-cdt-status="awaiting"] {
    --cdt-st-a: 18%;
    box-shadow: 0 0 0 3px var(--cdt-st-c), 0 0 0 4px color-mix(in srgb, var(--cdt-st) 32%, transparent);
}
[data-cdt-status="ready"] { --cdt-st-a: 17%; }
[data-cdt-status="done"] { --cdt-st-a: 9%; }
[data-cdt-status="running"] { animation: cdt-st-pulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
    [data-cdt-status="running"] { animation: none; --cdt-st-a: 12%; }
}

/* Sidebar session "lick": a tapered stroke on the row's left edge — thickest
   at the middle, narrowing to a point at each tail, with the centreline bowing
   right so the tails curve in toward the row's rounded corners.
   This is a shape, not a fade: opacity gradients and border-radius can both
   soften an edge but neither can vary a bar's WIDTH along its length, so the
   outline is an SVG mask filled with the session colour. */
[data-cdt-avatar] {
    position: relative;
    padding-inline-start: calc(var(--cdt-avatar-pad, 12px) + 24px) !important;
}
[data-cdt-avatar]::after {
    content: "";
    position: absolute;
    inset-inline-start: var(--cdt-avatar-pad, 12px);
    top: 50%;
    width: 18px;
    height: 18px;
    transform: translateY(-50%);
    background: var(--cdt-row-accent, currentColor);
    mask: var(--cdt-avatar-mask) center / contain no-repeat;
    -webkit-mask: var(--cdt-avatar-mask) center / contain no-repeat;
    pointer-events: none;
}
[data-cdt-row] { position: relative; }
[data-cdt-row]::before {
    content: "";
    position: absolute;
    left: 3px;
    top: 50%;
    width: 5px;
    height: 76%;
    transform: translateY(-50%);
    background: var(--cdt-row-accent);
    -webkit-mask-image: ${LICK_MASK};
    mask-image: ${LICK_MASK};
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    pointer-events: none;
    z-index: 2;
}
`;
  }
