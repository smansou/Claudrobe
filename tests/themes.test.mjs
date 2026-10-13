import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const files = ['src/palettes/dark.js', 'src/palettes/light.js', 'src/palettes/index.js', 'src/color.js',
  'src/remap/rules.js', 'src/remap/curve.js', 'src/remap/value.js', 'src/css/helpers.js', 'src/css/build.js', 'src/css/inject.js'];
function environment(mode = 'light') {
  const baseline = new Map(Object.entries(mode === 'light' ? {
    '--cds-surface-0': '#ededed', '--cds-surface-1': '#ffffff', '--cds-surface-2': '#f5f5f5', '--cds-surface-3': '#e8e8e8',
    '--cds-text-primary': '#222222', '--cds-text-secondary': '#555555', '--cds-text-muted': '#777777', '--cds-border': '#dddddd',
  } : {
    '--cds-surface-0': '#1f1f1d', '--cds-surface-1': '#2a2a28', '--cds-surface-2': '#333331', '--cds-surface-3': '#41413e',
    '--cds-text-primary': '#f5f5f3', '--cds-text-secondary': '#c8c6c0', '--cds-text-muted': '#8d8b85', '--cds-border': '#3a3a37',
  }));
  const context = createContext({ baseline, document: { documentElement: { dataset: { mode } } }, matchMedia: () => ({ matches: mode === 'dark' }) });
  runInContext(`const baseCSS = () => 'BASE';\n${files.map(read).join('\n')}`, context);
  return code => runInContext(code, context);
}

test('palette IDs are unique and every curated colour and brightness value is valid', () => {
  const run = environment();
  const themes = JSON.parse(run('JSON.stringify(THEMES.filter(t => !t.isDefault))'));
  assert.equal(new Set(themes.map(t => t.slug)).size, themes.length);
  assert.equal(themes.filter(t => t.mode === 'light').length, 15);
  assert.equal(themes.filter(t => t.mode === 'dark').length, 32);
  for (const theme of themes) {
    for (const name of ['deep', 'base', 'text', 'text2', 'muted', 'accent', 'border']) assert.match(theme[name], /^#[0-9a-f]{6}$/i);
    assert.equal(run(`paletteBrightness(THEMES.find(t => t.slug === ${JSON.stringify(theme.slug)}))`), 50);
  }
});

test('every light palette clears its border and section contrast floors', () => {
  const run = environment();
  for (const slug of JSON.parse(run('JSON.stringify(THEMES.filter(t => t.mode === "light").map(t => t.slug))'))) {
    run(`globalThis.t = THEMES.find(t => t.slug === ${JSON.stringify(slug)});`);
    assert.ok(run('contrast(effBorder(t), t.base)') >= 1.65, slug + ' border');
    assert.ok(run('contrast(effDeep(t), t.base)') >= 1.18, slug + ' sidebar');
    assert.ok(run('contrast(effRaised(t), t.base)') >= 1.10, slug + ' raised');
  }
});

test('explicit custom raised, titlebar, sidebar, input and border-strength overrides survive', () => {
  const run = environment();
  run('globalThis.t = { ...THEMES.find(t => t.slug === "github-light"), raised:"#dceeff", raised2:"#b4c8dd", titlebar:"#bbccdd", sidebar:"#aabbcc", input:"#ddeeff", borderMin:1.1 }; baseline.set("--cds-surface-sidebar", "#eeeeee");');
  assert.equal(run('effRaised(t)'), '#dceeff');
  assert.equal(run('effRaised2(t)'), '#b4c8dd');
  const css = run('buildCSS(t, { brightness:50 })');
  assert.match(css, /--cdt-surface-titlebar: #bbccdd/);
  assert.match(css, /--cdt-surface-input: #ddeeff/);
  assert.match(css, /--cds-surface-sidebar: #aabbcc/);
});

test('the app-default palette emits no palette overrides at neutral brightness', () => {
  for (const mode of ['light', 'dark']) assert.equal(environment(mode)('buildCSS(DEFAULT_THEME, { brightness:50 })'), 'BASE');
});

test('light and dark token remaps preserve semantic alpha and contain no invalid numbers', () => {
  for (const mode of ['light', 'dark']) {
    const run = environment(mode);
    run('baseline.set("--cds-bg-error", "#e5534b26");');
    for (const brightness of [0, 50, 100]) {
      const all = JSON.parse(run(`JSON.stringify(THEMES.filter(t => t.mode === "${mode}").map(t => buildCSS(t, {brightness:${brightness}})))`));
      for (const css of all) {
        assert.doesNotMatch(css, /NaN|undefined|Infinity/);
        const error = css.match(/--cds-bg-error: (#[0-9a-f]{8})/i);
        if (error) assert.equal(error[1].slice(-2).toLowerCase(), '26');
      }
      const remapped = JSON.parse(run(`JSON.stringify(THEMES.filter(t => t.mode === "${mode}")
        .map(t => remapValue("#e5534b26", makeRemapper(t, {brightness:${brightness}}), "--cds-bg-error")))`));
      for (const value of remapped) assert.equal(value.slice(-2).toLowerCase(), '26');
    }
  }
});
