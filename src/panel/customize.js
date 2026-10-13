/* ───────────────────────────────────────────────────────────────────────────
 * panel/customize.js — Editing a palette down to a theme of your own.
 *
 * A draft starts from the palette in use and can be changed field by field,
 * named and saved, or deleted. "Auto" clears an override back to whatever the
 * remap would have chosen.
 * ─────────────────────────────────────────────────────────────────────────── */


  // ── Customize ──

  /** Claude's own status hues, shown in the editor for a palette that does
   *  not override them. */
  const STATUS_DEFAULTS = { red: '#e5534b', yellow: '#d4a72c', green: '#57ab5a', blue: '#539bf5',
                            orange: '#d97757', teal: '#39c5cf', purple: '#b083f0' };

  /** Grouped by what the user sees, named for where it shows up. */
  const EDIT_GROUPS = [
    ['Backgrounds', [
      ['base', 'Main background', 'The transcript and the page behind it'],
      ['deep', 'Sidebar & app background', 'Both sidebars and the frame around panes'],
      ['raised', 'Cards & popovers', 'Menus, cards, the message box, pickers'],
    ]],
    ['Text', [
      ['text', 'Text', 'Body text everywhere'],
      ['text2', 'Secondary text', 'Descriptions and details'],
      ['muted', 'Labels & hints', 'Timestamps, captions, placeholders'],
    ]],
    ['Accent & lines', [
      ['accent', 'Accent', 'Primary buttons, links, selection'],
      ['border', 'Borders & dividers', 'Outlines of cards, panes and inputs'],
    ]],
    ['Status colours', [
      ['s.red', 'Errors & deletions', 'Failed commands, removed lines'],
      ['s.yellow', 'Warnings', 'Usage limits, cautions'],
      ['s.green', 'Success & additions', 'Passed checks, added lines'],
      ['s.blue', 'Info', 'Informational notices'],
      ['s.orange', 'Highlights', 'Brand colour and emphasis'],
      ['s.teal', 'Teal tones', ''],
      ['s.purple', 'Purple & pink tones', ''],
    ]],
  ];

  /** A theme as the editor sees it. The app-default "theme" has no palette of
   *  its own, so its values are read from the live tokens. */
  function editable(t) {
    if (!t.isDefault) return t;
    const pick = (n, fb) => firstHex(baseline.get(n) || '') || fb;
    return { slug: DEFAULT_THEME.slug, label: DEFAULT_THEME.label, mode: appMode(), code: '',
             base: pick('--cds-surface-1', '#2a2a28'), deep: pick('--cds-surface-0', '#1f1f1d'),
             text: pick('--cds-text-primary', '#f5f5f3'), text2: pick('--cds-text-secondary', '#c8c6c0'),
             muted: pick('--cds-text-muted', '#8d8b85'), accent: DEFAULT_THEME.accent,
             border: pick('--cds-border', '#3a3a37') };
  }
  const hex6 = h => rgb2hex(hex2rgb(h));
  const mixHex = (a, b, t) => { const x = hex2rgb(hex6(a)), y = hex2rgb(hex6(b));
    return rgb2hex(x.map((v, i) => v * t + y[i] * (1 - t))); };
  const propValue = (t, k) => k.startsWith('s.') ? (t.semantic || {})[k.slice(2)] || null
                            : k === 'raised' ? effRaised(t) : k === 'deep' ? effDeep(t) : t[k];

  /** The first edit turns the selection into the draft. */
  function ensureDraft() {
    if (current.slug === DRAFT) return current;
    const src = editable(current);
    const d = JSON.parse(JSON.stringify(src));
    d.deep = effDeep(src);
    delete d.isDefault;
    Object.assign(d, { slug: DRAFT, label: 'Custom', basedOn: src.label, mode: src.mode || appMode(), brightness: textOpts.brightness });
    current = d;
    localStorage.setItem(themeKey(), DRAFT);
    writeJSON(draftKey(), d);
    return d;
  }
  let styleRaf = 0;
  const applySoon = () => {
    if (!styleRaf) styleRaf = requestAnimationFrame(() => { styleRaf = 0; applyStyle(); });
  };
  function editProp(k, v) {
    const d = ensureDraft();
    if (k.startsWith('s.')) d.semantic = { ...(d.semantic || {}), [k.slice(2)]: v };
    else if (v === undefined) delete d[k];
    else d[k] = v;
    d.brightness = textOpts.brightness;
    writeJSON(draftKey(), d);
    applySoon();
  }
  function saveDraft(name) {
    name = (name || '').trim() || `My theme ${customThemes.length + 1}`;
    const same = customThemes.find(t => t.label === name && t.mode === current.mode);
    const t = { ...current, brightness: textOpts.brightness, slug: same ? same.slug : 'user:' + Date.now().toString(36), label: name };
    delete t.basedOn;
    customThemes = same ? customThemes.map(x => x.slug === t.slug ? t : x) : [...customThemes, t];
    writeJSON(LS_CUSTOM, customThemes);
    localStorage.removeItem(draftKey());
    tab = 'theme';
    applyTheme(t);
  }
  function deleteCustom(slug) {
    customThemes = customThemes.filter(t => t.slug !== slug);
    writeJSON(LS_CUSTOM, customThemes);
    if (current.slug === slug) applyTheme(DEFAULT_THEME); else renderUI();
  }

  /** Scroll offset per tab, restored after a rebuild. */
  const scrollTop = { theme: 0, custom: 0, text: 0, panes: 0 };
  let renderedTab = tab;

  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
