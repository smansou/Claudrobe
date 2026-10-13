/* ───────────────────────────────────────────────────────────────────────────
 * panel/render.js — Build the panel's markup for the current tab.
 * ─────────────────────────────────────────────────────────────────────────── */


  function renderUI() {
    if (!shadow) return;
    const prev = shadow.querySelector('.body');
    if (prev) scrollTop[renderedTab] = prev.scrollTop;
    lastSig = overlaySig();
    const T = uiPalette();
    const panelBg = shade(T.base, 0.05);
    // The panel's own secondary text is neutral, not the palette's muted
    // colour: palettes like Tiki use a saturated label colour, which turns
    // every hint in the panel orange.
    const muted = ensureContrast(mixHex(T.text, panelBg, 0.58), panelBg, 3.2);
    const line = T.border;

    /** Curated list, then every scanned family, then Custom. The mono picker
     *  filters a scan down to fixed-advance families so it stays usable. */
    const fontSelect = (key, curated, monoOnly) => {
      const cur = textOpts[key] || '';
      const opt = (v, label, stack) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}` +
        ` style="font-family:${stack || 'inherit'}">${esc(label)}</option>`;
      let html = curated.map(([k, label, stack]) => opt(k, label, stack)).join('');
      if (scanned?.length) {
        const fams = monoOnly ? scanned.filter(isMono) : scanned;
        const seen = new Set(curated.map(c => c[1]));
        const extra = fams.filter(f => !seen.has(f) && !f.startsWith('.'));
        if (extra.length) {
          html += `<optgroup label="Installed (${extra.length})">` +
            extra.map(f => opt('sys:' + f, f, quoteFamily(f))).join('') + '</optgroup>';
        }
      }
      const isCustom = cur.startsWith('custom:');
      html += `<option value="custom:"${isCustom ? ' selected' : ''}>Custom…</option>`;
      return `<select id="${key}">${html}</select>`;
    };

    const customField = key => {
      const cur = textOpts[key] || '';
      if (!cur.startsWith('custom:')) return '';
      const fam = cur.slice(7);
      const ok = !fam || fontInstalled(quoteFamily(fam));
      return `<input class="custom" id="${key}-custom" type="text" spellcheck="false"
        placeholder="Exact family name, e.g. JetBrains Mono" value="${esc(fam)}">
        <div class="hint${ok ? '' : ' warn'}">${fam
          ? (ok ? 'Detected on this system.'
                : 'Not detected — it will fall back unless the family is installed system-wide.')
          : 'Type the family name exactly as Font Book shows it.'}</div>`;
    };

    const appStack = proseStackOf(textOpts) || 'inherit';
    const trStack = transcriptStackOf(textOpts) || appStack;
    const monoStack = monoStackOf(textOpts) || 'ui-monospace, SFMono-Regular, monospace';
    const WHEEL = 'conic-gradient(#e86496, #feb503, #51b148, #07ddf2, #9284fb, #e86496)';

    const draft = readDraft();
    const themeRow = t => `
        <li data-slug="${esc(t.slug)}" aria-selected="${t.slug === current.slug}">
          <span class="sw" style="background:${t.base}"></span>
          <span class="sw" style="background:${t.accent}"></span>
          <span class="nm">${esc(t.label)}</span>
          ${t.code ? `<em>${esc(t.code)}</em>` : ''}
          ${t.slug.startsWith('user:') ? `<span class="del" data-del="${esc(t.slug)}" title="Delete">×</span>` : ''}</li>`;
    const mine = themesForMode().filter(t => t.slug.startsWith('user:'));
    const builtIn = themesForMode().filter(t => !t.slug.startsWith('user:'));
    const themeTab = `<ul>
        ${draft ? themeRow({ ...draft, label: 'Custom (unsaved)' }) : ''}
        ${mine.length ? `<li class="hd">Your themes</li>${mine.map(themeRow).join('')}<li class="hd">Built in</li>` : ''}
        ${builtIn.map(themeRow).join('')}</ul>`;

    const ed = editable(current);
    const isDraft = current.slug === DRAFT;
    const prop = ([k, label, hint]) => {
      const v = propValue(ed, k);
      const shown = hex6(v || STATUS_DEFAULTS[k.slice(2)] || '#888888');
      return `<label class="prop"><input type="color" data-k="${k}" value="${shown}">
        <span class="pl">${label}${hint ? `<small>${hint}</small>` : ''}</span>
        <code>${v ? shown.toUpperCase() : 'app'}</code></label>`;
    };
    const tintVal = ed.tint;
    const customTab = `
      <div class="row edhead">${isDraft
        ? `<div class="hint">Custom, based on <b>${esc(current.basedOn || '')}</b>. Name it to keep it.</div>
           <div class="saveRow"><input id="cname" type="text" spellcheck="false" placeholder="Theme name">
             <button id="csave">Save</button></div>`
        : `<div class="hint">Change anything below and <b>${esc(ed.label)}</b> becomes a custom copy you can name and save.</div>`}
      </div>
      ${EDIT_GROUPS.map(([g, rows]) => `<div class="row"><b>${g}</b>${rows.map(prop).join('')}</div>`).join('')}
      <div class="row"><b>Fine-tuning</b>
        <div class="sl"><span>Background colour</span>
          <input type="range" id="tint" min="0" max="50" value="${Math.round((tintVal ?? 0.12) * 100)}">
          <button class="mini" id="tintAuto" aria-selected="${tintVal == null}">Auto</button></div>
        <div class="hint">How much of the palette's hue the backgrounds carry. Auto fades it out on surfaces.</div>
        <div class="sl"><span>Border strength</span>
          <input type="range" id="bmin" min="110" max="300" value="${Math.round((ed.borderMin || (ed.mode === 'light' ? 1.65 : 1.45)) * 100)}"></div>
      </div>`;

    const textIsDefault = Object.keys(TEXT_DEFAULTS).every(k => (textOpts[k] ?? '') === TEXT_DEFAULTS[k]);
    const textTab = `
      <div class="row"><button class="wide" id="textReset"${textIsDefault ? ' disabled' : ''}>${textIsDefault
        ? 'Text is at the app defaults' : 'Reset text to app defaults'}</button>
        <div class="hint">Weight, brightness and all three fonts. Colours are not affected.</div></div>
      <div class="row"><b>Weight</b><div class="seg">
        ${Object.keys(WEIGHTS).map(w => `<button data-weight="${w}"
          aria-selected="${textOpts.weight === w}">${WEIGHT_LABELS[w]}</button>`).join('')}
      </div></div>
      <div class="row"><b>Brightness</b>
        <input type="range" id="bright" min="0" max="100" value="${textOpts.brightness}">
        <div class="hint">Each theme supplies its text colours and brightness. Switching themes resets brightness, not fonts or weight.</div>
      </div>
      <div class="row"><b>App font</b>
        ${fontSelect('font', FONTS, false)}${customField('font')}
        <div class="hint">Sidebars, menus, buttons, settings.</div>
      </div>
      <div class="row"><b>Transcript font</b>
        ${fontSelect('tfont', FONTS, false)}${customField('tfont')}
        <div class="hint">Claude's replies and your messages.</div>
      </div>
      <div class="row"><b>Code font</b>
        ${fontSelect('mono', MONOS, true)}${customField('mono')}
      </div>
      <div class="row">
        <div class="sample">
          <div class="a">App · New session · Settings</div>
          <div class="p">The quick brown fox jumps over the lazy dog.</div>
          <div class="c">const answer = 42; // 0O1lI</div>
        </div>
      </div>
      <div class="row"><b>Font source</b>
        <button class="wide" id="scan">${scanned
          ? `Rescan installed fonts (${scanned.length} found)` : 'Scan installed fonts'}</button>
        <div class="hint" id="scanmsg">${scanned
          ? 'Every family macOS exposes is listed above.'
          : 'Lists every font installed on this Mac. Fonts bundled inside another app are not visible to any other app, including this one.'}</div>
      </div>`;

    const panesTab = `
      <div class="row"><b>Expand on hover</b><div class="seg">
        ${[['off', 'Off'], ['most', 'On']].map(([m, l]) => `<button data-expand="${m}"
          aria-selected="${expandMode === m}">${l}</button>`).join('')}
      </div>
        <div class="hint">Hover over a pane briefly to expand it smoothly, leaving a strip of its neighbours showing.
          Passing across panes or clicking before expansion does not enlarge them instantly.
          <b>Click the expanded pane</b> to keep it large; click outside it to let go.</div></div>
      <div class="row"><b>Status on titles</b><div class="seg">
        <button data-tstatus="on" aria-selected="${titleStatus}">On</button>
        <button data-tstatus="off" aria-selected="${!titleStatus}">Off</button>
      </div>
        <div class="hint">Tints each pane's title with its session's status light from the sidebar:
          waiting for input, running, unread reply, done.</div></div>`;

    const openPane = paneInfo[accentOpen];
    const active = openPane ? colorForSession(openPane.id) : null;
    const isFill = borderStyle === 'fill';
    const activeCustom = !!active && !SESSION_COLORS.some(([c]) => c === active);

    shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; font: 12px/1.45 ui-sans-serif, -apple-system, system-ui, sans-serif; }
  button { font: inherit; }

  /* Theme trigger. Docked after the sidebar's back/forward buttons and sized
     like them; a small colour wheel, because it chooses a palette. */
  /* The app's title bars are window-drag regions: Electron hands clicks there
     to macOS to move the window, whatever is drawn on top. Every control of
     ours opts out, as the app's own title-bar buttons do. */
  .trigger, .panel, .pick, .dots { -webkit-app-region: no-drag; app-region: no-drag; }
  .trigger { position: fixed; width: ${TRIG}px; height: ${TRIG}px; border-radius: 7px; border: 0;
             padding: 0; background: ${panelBg}; cursor: pointer; pointer-events: auto;
             box-shadow: 0 0 0 1px ${line};
             display: grid; place-items: center; }
  .trigger[data-floating] { background: ${T.base}; border: 1px solid ${line}; box-shadow: 0 2px 8px #0003; }
  .trigger:hover, .trigger[aria-expanded="true"] { background: color-mix(in srgb, ${T.text} 10%, transparent); }
  .trigger i { width: 15px; height: 15px; border-radius: 50%; background: ${WHEEL};
               box-shadow: inset 0 0 0 3.5px ${panelBg}, 0 0 0 1px color-mix(in srgb, ${T.text} 30%, transparent);
               opacity: .85; }
  .trigger:hover i { opacity: 1; }

  .panel { position: fixed; width: ${PANEL_W}px; display: flex; flex-direction: column;
           pointer-events: auto; background: ${panelBg}; color: ${T.text};
           border: 1px solid ${line}; border-radius: 12px; overflow: hidden;
           box-shadow: 0 10px 34px #0009; }
  .tabs { display: flex; align-items: center; border-bottom: 1px solid ${line}; flex: none;
          position: relative; }
  .tabs button { flex: 1; padding: 9px 4px; background: none; border: 0; cursor: pointer;
                 color: ${muted}; font-size: 11px; font-weight: 600; letter-spacing: .03em; }
  .tabs button[aria-selected="true"] { color: ${T.text}; box-shadow: inset 0 -2px 0 ${T.accent}; }
  .help { flex: none; width: 15px; height: 15px; margin: 0 8px; border-radius: 50%;
          border: 1px solid ${muted}; color: ${muted}; font-size: 9.5px; line-height: 13px;
          text-align: center; cursor: help; user-select: none; }
  .help:hover, .help:focus { color: ${T.text}; border-color: ${T.text}; outline: none; }
  .tip { display: none; position: absolute; right: 7px; top: 25px; width: 218px; z-index: 5;
         padding: 9px 11px; border-radius: 9px; font-size: 11px; line-height: 1.45;
         color: ${muted}; background: ${shade(T.base, 0.09)};
         border: 1px solid ${line}; box-shadow: 0 8px 22px #0009; cursor: default; }
  .tip b { color: ${T.text}; font-weight: 600; }
  .help:hover + .tip, .help:focus + .tip, .tip:hover { display: block; }
  /* Fixed height so the panel does not resize under the cursor between tabs. */
  .body { height: min(460px, 64vh); overflow-y: auto; overflow-x: hidden; }
  ul { list-style: none; margin: 0; padding: 5px; }
  li { display: flex; align-items: center; gap: 8px; padding: 6px 7px; border-radius: 7px; cursor: pointer; }
  li:hover { background: color-mix(in srgb, ${T.text} 9%, transparent); }
  li[aria-selected="true"] { background: color-mix(in srgb, ${T.accent} 22%, transparent); }
  li.hd { cursor: default; padding: 8px 7px 3px; font-size: 10px; font-weight: 600; letter-spacing: .06em;
          text-transform: uppercase; color: ${muted}; }
  li.hd:hover { background: none; }
  .sw { width: 13px; height: 13px; border-radius: 3px; flex: none; border: 1px solid #0005; }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  li em { margin-left: auto; font-style: normal; font-size: 10px; color: ${muted};
          font-family: ui-monospace, SFMono-Regular, monospace; }
  .del { margin-left: auto; width: 18px; height: 18px; border-radius: 5px; text-align: center;
         line-height: 17px; color: ${muted}; font-size: 14px; }
  li em + .del { margin-left: 4px; }
  .del:hover { color: ${T.text}; background: color-mix(in srgb, ${T.text} 12%, transparent); }
  .row { padding: 11px 13px; border-bottom: 1px solid ${line}; }
  .row:last-child { border-bottom: 0; }
  .row > b { display: block; font-weight: 600; font-size: 11px; margin-bottom: 8px; color: ${muted};
             letter-spacing: .05em; text-transform: uppercase; }
  .seg { display: flex; gap: 4px; }
  .seg button { flex: 1; min-width: 0; padding: 6px 1px; border-radius: 6px; cursor: pointer;
                font-size: 10px; letter-spacing: -.01em;
                border: 1px solid ${line}; background: transparent; color: ${T.text}; }
  .seg button[aria-selected="true"] { background: color-mix(in srgb, ${T.accent} 26%, transparent);
                border-color: ${T.accent}; }
  input[type=range] { width: 100%; accent-color: ${T.accent}; }
  select { width: 100%; padding: 6px 7px; border-radius: 6px; font-size: 11px; cursor: pointer;
           background: ${T.base}; color: ${T.text}; border: 1px solid ${line}; }
  input[type=text] { width: 100%; padding: 6px 7px; border-radius: 6px; font-size: 11px;
           background: ${T.base}; color: ${T.text}; border: 1px solid ${line}; }
  input.custom { margin-top: 6px; }
  button.wide { width: 100%; padding: 7px 0; border-radius: 6px; cursor: pointer; font-size: 11px;
           border: 1px solid ${line}; background: transparent; color: ${T.text}; }
  button.wide:hover { background: color-mix(in srgb, ${T.text} 10%, transparent); }
  button.wide:disabled { cursor: default; color: ${muted}; background: transparent; }
  .hint { margin-top: 6px; font-size: 10px; line-height: 1.4; color: ${muted}; }
  .hint b { color: ${T.text}; font-weight: 600; }
  .hint.warn { color: ${ensureContrast('#e0a030', panelBg, 3)}; }
  .sample { padding: 9px 10px; border-radius: 7px; background: ${T.base}; border: 1px solid ${line}; }
  /* Rendered in the chosen faces so the pickers can be judged in place. */
  .sample .a { color: ${muted}; font-size: 11px; font-family: ${appStack}; }
  .sample .p { color: ${T.text}; margin-top: 4px; font-family: ${trStack}; }
  .sample .c { color: ${T.accent}; font-size: 11px; margin-top: 5px; font-family: ${monoStack}; }

  /* Customize */
  .edhead .hint { margin-top: 0; }
  .saveRow { display: flex; gap: 6px; margin-top: 8px; }
  .saveRow button, .mini { flex: none; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 11px;
                           border: 1px solid ${line}; background: transparent; color: ${T.text}; }
  .saveRow button { background: ${T.accent}; border-color: ${T.accent};
                    color: ${contrast(T.accent, '#000') > contrast(T.accent, '#fff') ? '#000' : '#fff'}; }
  .mini[aria-selected="true"] { background: color-mix(in srgb, ${T.accent} 26%, transparent); border-color: ${T.accent}; }
  .prop { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 9px;
          padding: 5px 0; cursor: pointer; }
  .prop input[type=color] { width: 26px; height: 22px; padding: 0;
                            border: 1px solid color-mix(in srgb, ${T.text} 35%, transparent);
                            border-radius: 5px; background: none; cursor: pointer; }
  .prop input[type=color]::-webkit-color-swatch-wrapper { padding: 2px; }
  .prop input[type=color]::-webkit-color-swatch { border: 0; border-radius: 3px; }
  .pl { display: flex; flex-direction: column; line-height: 1.3; }
  .pl small { font-size: 10px; color: ${muted}; }
  .prop code { font: 10px ui-monospace, SFMono-Regular, monospace; color: ${muted}; }
  .sl { display: grid; grid-template-columns: 104px 1fr auto; align-items: center; gap: 8px; margin-top: 6px; }
  .sl span { font-size: 11px; }

  /* Session colour: a dot in each pane's title bar. Hollow until a colour is
     chosen, so it is visible — and recognisably a colour slot — either way. */
  .pick { position: fixed; transform: translate(-50%, -50%); width: 24px; height: 24px;
          border-radius: 6px; border: 1px solid ${line}; padding: 0; background: ${panelBg};
          color: ${T.text}; cursor: pointer; pointer-events: auto; display: grid; place-items: center; }
  .pick:hover, .pick[aria-expanded="true"] { background: ${T.base}; border-color: ${T.accent}; }
  .pick.on { border-color: var(--c); box-shadow: inset 0 -2px var(--c); }
  .pick svg, .avatar svg { width: 17px; height: 17px; }
  .avatarRow { flex: 100%; display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px;
               border-top: 1px solid ${line}; padding-top: 8px; }
  .avatarRow > span { grid-column: 1 / -1; color: ${muted}; font-size: 10.5px; }
  .avatar { display: grid; place-items: center; height: 30px; border: 1px solid ${line};
            border-radius: 6px; cursor: pointer; color: ${T.text}; background: ${T.base}; }
  .avatar[aria-pressed="true"] { border-color: ${T.accent}; background: ${panelBg}; }
  button:focus-visible { outline: 2px solid ${T.accent}; outline-offset: 2px; }
  .dots { position: fixed; width: ${DOTS_W}px; display: flex; flex-wrap: wrap; gap: 6px; padding: 9px;
          border-radius: 12px; background: ${panelBg}; border: 1px solid ${line};
          box-shadow: 0 8px 24px #0009; pointer-events: auto; }
  .cs { width: 18px; height: 18px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; }
  .cs:hover { transform: scale(1.12); }
  .cs[aria-selected="true"], .cs[aria-pressed="true"] { border-color: ${T.text}; }
  .cs.wheel { position: relative; background: ${WHEEL}; overflow: hidden; }
  .cs.wheel.mine { background: var(--c); box-shadow: inset 0 0 0 2px ${panelBg}; }
  .cs.wheel input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;
                    border: 0; padding: 0; }
  .cs.none { background: transparent; border-color: ${muted}; position: relative; }
  .cs.none::after { content: ""; position: absolute; inset: 6px 1px; border-top: 1.5px solid ${muted};
                    transform: rotate(-45deg); }
  .styleRow { flex: 100%; display: flex; gap: 4px; margin-top: 3px; padding-top: 8px; border-top: 1px solid ${line}; }
  .styleRow button { flex: 1; padding: 4px 0; font-size: 10.5px; border-radius: 6px; cursor: pointer;
                     border: 1px solid ${line}; background: transparent; color: ${T.text}; }
  .styleRow button[aria-selected="true"] { background: color-mix(in srgb, ${T.accent} 26%, transparent);
                     border-color: ${T.accent}; }
  .widthRow { flex: 100%; display: flex; align-items: center; gap: 8px; margin-top: 4px; }
  .widthRow span { font-size: 10.5px; color: ${muted}; white-space: nowrap; width: 54px; }
  .widthRow input { flex: 1; min-width: 0; }
</style>

${paneInfo.map((p, i) => { const c = colorForSession(p.id), icon = iconForSession(p.id); return `
<button class="pick${c ? ' on' : ''}" data-i="${i}" title="Personalize session: colour, border and avatar" aria-label="Personalize session${icon ? ': ' + SESSION_ICONS.find(x => x[0] === icon)[1] : ''}"
  aria-expanded="${accentOpen === i}" style="display:none;${c ? `--c:${c}` : ''}">${iconSVG(icon || 'personalize')}</button>`; }).join('')}

${openPane ? `<div class="dots" style="display:none">
  <button class="cs none" data-color="" aria-pressed="${!active}" title="No colour" aria-label="No colour"></button>
  ${SESSION_COLORS.map(([c, name]) => `<button class="cs" data-color="${c}" style="background:${c}"
    title="${name}" aria-label="${name}" aria-pressed="${c === active}"></button>`).join('')}
  <label class="cs wheel${activeCustom ? ' mine' : ''}" title="Any colour" aria-selected="${activeCustom}"
    style="${activeCustom ? `--c:${active}` : ''}"><input type="color" id="anyColor"
    value="${hex6(active || '#ff453a')}"></label>
  <div class="avatarRow">
    <span>Session avatar</span>
    <button class="avatar" data-icon="" title="No avatar" aria-label="No avatar" aria-pressed="${!iconForSession(openPane.id)}">${iconSVG('personalize')}</button>
    ${SESSION_ICONS.map(([id, name]) => `<button class="avatar" data-icon="${id}" title="${name}" aria-label="${name}" aria-pressed="${iconForSession(openPane.id) === id}">${iconSVG(id)}</button>`).join('')}
  </div>
  <div class="styleRow">
    <button data-border="line" aria-selected="${borderStyle === 'line'}">Line</button>
    <button data-border="glow" aria-selected="${borderStyle === 'glow'}">Glow</button>
    <button data-border="fill" aria-selected="${isFill}">Fill</button>
  </div>
  <div class="widthRow">
    <span>${isFill ? 'Intensity' : 'Thickness'}</span>
    ${isFill
      ? `<input type="range" id="fill" min="0" max="100" step="1" value="${fillLevel}">`
      : `<input type="range" id="bwidth" min="${WIDTH_MIN}" max="${WIDTH_MAX}" step="0.5" value="${borderWidth}">`}
  </div>
</div>` : ''}

<button class="trigger" title="Theme (⌥⇧T)" aria-label="Theme" aria-expanded="${open}" style="display:none"><i></i></button>

${open ? `<div class="panel" style="display:none">
  <div class="tabs">
    <button data-tab="theme" aria-selected="${tab === 'theme'}">Theme</button>
    <button data-tab="custom" aria-selected="${tab === 'custom'}">Customize</button>
    <button data-tab="text" aria-selected="${tab === 'text'}">Text</button>
    <button data-tab="panes" aria-selected="${tab === 'panes'}">Panes</button>
    <span class="help" tabindex="0">?</span>
    <div class="tip">Code-block colours come from Claude's own picker in
      <b>Settings &rsaquo; Claude Code &rsaquo; Appearance</b>. Each theme is labelled
      with the built-in code theme that matches it.</div>
  </div>
  <div class="body">${tab === 'theme' ? themeTab : tab === 'custom' ? customTab : tab === 'panes' ? panesTab : textTab}</div>
</div>` : ''}`;

    renderedTab = tab;
    positionOverlay();
    const want = scrollTop[tab] || 0;
    const restore = () => { const b = shadow.querySelector('.body'); if (b) b.scrollTop = want; };
    restore();
    if (want && shadow.querySelector('.body')?.scrollTop !== want) requestAnimationFrame(restore);
    wireUI();
  }
