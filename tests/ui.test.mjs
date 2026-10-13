import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const source = readFileSync(new URL('../claude-theme.js', import.meta.url), 'utf8');
const ids = ['local_aaaaaaaa', 'local_bbbbbbbb', 'local_cccccccc', 'local_dddddddd'];
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); });

const fixture = (mode, panes) => `<!doctype html><html class="cds-root" data-mode="${mode}"><head><style>
:root { --cds-surface-0:${mode === 'light' ? '#ededed' : '#1f1f1d'}; --cds-surface-1:${mode === 'light' ? '#ffffff' : '#2a2a28'};
--cds-surface-2:${mode === 'light' ? '#f5f5f5' : '#333331'}; --cds-surface-3:${mode === 'light' ? '#e8e8e8' : '#41413e'};
--cds-text-primary:${mode === 'light' ? '#222222' : '#f5f5f3'}; --cds-text-secondary:${mode === 'light' ? '#555555' : '#c8c6c0'};
--cds-text-muted:${mode === 'light' ? '#777777' : '#8d8b85'}; --cds-border:${mode === 'light' ? '#dddddd' : '#3a3a37'};
--cds-surface-sidebar:var(--cds-surface-0); --cds-surface-input:var(--cds-surface-3); --cds-surface-titlebar:var(--cds-surface-0); }
* { box-sizing:border-box; } body { margin:0; background:var(--cds-surface-1); color:var(--cds-text-primary); font:14px system-ui; }
button { color:inherit; cursor:pointer; } aside { position:absolute; top:0; left:0; bottom:0; width:240px; background:var(--cds-surface-sidebar); }
nav { height:60px; display:flex; align-items:center; gap:5px; padding:12px; } nav button { width:28px; height:28px; }
.rows a { display:flex; padding:10px 12px; width:230px; height:44px; color:inherit; text-decoration:none; }
.dframe-pane-host { position:absolute; top:60px; bottom:10px; left:250px; right:10px; display:grid; grid-template-columns:${panes === 1 ? '1fr' : '1fr 1fr'}; grid-template-rows:${panes === 4 ? '1fr 1fr' : '1fr'}; gap:8px; }
.dframe-pane { position:relative; min-width:0; border-radius:10px; background:transparent; }
.epitaxy-titlebar { height:44px; display:flex; align-items:center; justify-content:space-between; background:var(--cds-surface-titlebar); border-bottom:1px solid var(--cds-border); }
.epitaxy-titlebar-end { display:flex; align-items:center; gap:6px; }
.epitaxy-titlebar-end button { width:30px; height:28px; }
.transcript { padding:16px; height:calc(100% - 44px); }
input { background:var(--cds-surface-input); color:var(--cds-text-primary); border:1px solid var(--cds-border); }
.sidebar-closed aside { display:none; } .sidebar-closed .dframe-pane-host { left:10px; }
#sidebarToggle { display:none; position:absolute; top:16px; left:12px; width:28px; height:28px; }
.sidebar-closed #sidebarToggle { display:block; }
</style></head><body><aside><nav><button aria-label="Back">←</button><button aria-label="Forward">→</button></nav><div class="rows">${ids.map((id, i) => `<a href="/epitaxy/${id}">Session ${i + 1}</a>`).join('')}</div></aside>
<button id="sidebarToggle" aria-label="Open sidebar">☰</button><div class="dframe-pane-host">${ids.slice(0, panes).map((id, i) => `<section class="dframe-pane ${i ? '' : 'dframe-pane-primary'}" data-fixture-id="${id}"><header class="epitaxy-titlebar"><span>Session ${i + 1}</span><div class="epitaxy-titlebar-end"><button aria-label="RC ${i}">RC</button><button aria-label="Menu ${i}">⋯</button></div></header><div class="transcript"><p>Session transcript ${i + 1}</p><input placeholder="Message Claude"></div></section>`).join('')}</div></body></html>`;

async function setup({ mode = 'dark', panes = 2, storage = {}, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 820 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://claudrobe.test/**', route => route.fulfill({ contentType: 'text/html', body: fixture(mode, panes) }));
  await page.addInitScript(values => { for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); }, storage);
  await page.goto('https://claudrobe.test/epitaxy/' + ids[0]);
  await page.evaluate(() => {
    document.querySelectorAll('.dframe-pane').forEach(p => {
      p.__reactFiber$fixture = { memoizedProps: { sessionId: p.dataset.fixtureId } };
    });
  });
  await page.addScriptTag({ content: source });
  await page.locator('#cdt-host .pick').first().waitFor({ state: 'visible' });
  return { page, context, errors, close: async () => { assert.deepEqual(errors, []); await context.close(); } };
}

async function selectTheme(page, slug) {
  await page.locator('#cdt-host .trigger').click();
  await page.locator(`#cdt-host li[data-slug="${slug}"]`).click();
}

async function openSession(page, index = 0) {
  await page.locator(`#cdt-host .pick[data-i="${index}"]`).click();
}

const colors = { 'cdt:sessions': JSON.stringify({ [ids[0]]: '#ff453a', [ids[1]]: '#30d158' }) };

test('session avatars work without colours, persist and remove cleanly', async () => {
  const f = await setup();
  await openSession(f.page);
  await f.page.locator('#cdt-host [data-icon="fox"]').click();
  assert.equal(await f.page.locator(`[href="/epitaxy/${ids[0]}"]`).getAttribute('data-cdt-avatar'), 'fox');
  assert.equal(await f.page.locator('.dframe-pane').first().getAttribute('data-cdt-accent'), null);
  assert.match(await f.page.locator('#cdt-host .pick').first().getAttribute('aria-label'), /Fox/);
  assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:sessionIcons')).local_aaaaaaaa), 'fox');
  await f.page.evaluate(() => { window.__cdtUninstall(); });
  assert.equal(await f.page.locator('[data-cdt-avatar]').count(), 0);
  await f.page.addScriptTag({ content: source });
  assert.match(await f.page.locator('#cdt-host .pick').first().getAttribute('aria-label'), /Fox/);
  await openSession(f.page);
  await f.page.locator('#cdt-host [data-icon=""]').click();
  assert.equal(await f.page.locator('[data-cdt-avatar]').count(), 0);
  await f.close();
});

test('each split session has independent colour and avatar', async () => {
  const f = await setup({ storage: colors });
  await openSession(f.page, 1);
  await f.page.locator('#cdt-host [data-icon="robot"]').click();
  assert.match(await f.page.locator('#cdt-host .pick[data-i="1"]').getAttribute('aria-label'), /Robot/);
  assert.doesNotMatch(await f.page.locator('#cdt-host .pick[data-i="0"]').getAttribute('aria-label'), /Robot/);
  assert.equal(await f.page.locator(`[href="/epitaxy/${ids[1]}"]`).getAttribute('data-cdt-avatar'), 'robot');
  assert.equal(await f.page.locator('.dframe-pane').first().evaluate(p => p.style.getPropertyValue('--cdt-session-accent')), '#ff453a');
  assert.equal(await f.page.locator('.dframe-pane').last().evaluate(p => p.style.getPropertyValue('--cdt-session-accent')), '#30d158');
  await f.close();
});

test('invalid stored avatars are ignored rather than interpolated into markup', async () => {
  const f = await setup({ storage: { 'cdt:sessionIcons': JSON.stringify({ [ids[0]]: '<img src=x onerror=alert(1)>' }) } });
  assert.equal(await f.page.locator('#cdt-host img').count(), 0);
  assert.equal(await f.page.locator('[data-cdt-avatar]').count(), 0);
  await f.close();
});

test('theme changes reset brightness but preserve fonts and weight', async () => {
  const f = await setup({ storage: { 'cdt:text': JSON.stringify({ v: 3, weight: 'medium', brightness: 90, font: 'custom:Georgia', tfont: 'custom:Georgia', mono: 'custom:Menlo' }) } });
  await selectTheme(f.page, 'dracula');
  const opts = await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')));
  assert.equal(opts.brightness, 50);
  assert.equal(opts.font, 'custom:Georgia');
  assert.equal(opts.tfont, 'custom:Georgia');
  assert.equal(opts.mono, 'custom:Menlo');
  assert.equal(opts.weight, 'medium');
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  await f.page.locator('#cdt-host #bright').evaluate(el => { el.value = 82; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await f.page.locator('#cdt-host [data-tab="theme"]').click();
  await f.page.locator('#cdt-host li[data-slug="nord"]').click();
  assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')).brightness), 50);
  await f.close();
});

test('custom themes save brightness and restore it when reselected', async () => {
  const f = await setup();
  await selectTheme(f.page, 'dracula');
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  await f.page.locator('#cdt-host #bright').evaluate(el => { el.value = 68; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await f.page.locator('#cdt-host [data-tab="custom"]').click();
  await f.page.locator('#cdt-host input[data-k="accent"]').evaluate(el => { el.value = '#aabbcc'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await f.page.locator('#cdt-host #cname').fill('Custom brightness');
  await f.page.locator('#cdt-host #csave').click();
  const saved = await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:customThemes'))[0]);
  assert.equal(saved.brightness, 68);
  await f.page.locator('#cdt-host li[data-slug="nord"]').click();
  await f.page.locator(`#cdt-host li[data-slug="${saved.slug}"]`).click();
  assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')).brightness), 68);
  await f.close();
});

test('light palettes are diverse, have visible divisions, and do not change fonts', async () => {
  const f = await setup({ mode: 'light' });
  await f.page.locator('#cdt-host .trigger').click();
  assert.equal(await f.page.locator('#cdt-host li[data-slug]').count(), 16);
  for (const slug of ['github-light', 'solarized-light', 'tokyo-night-day', 'nord-snow', 'papercolor-light', 'xcode-light']) {
    await f.page.locator(`#cdt-host li[data-slug="${slug}"]`).click();
    const styles = await f.page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return { base: cs.getPropertyValue('--cds-surface-1'), border: cs.getPropertyValue('--cds-border'),
        sidebar: getComputedStyle(document.querySelector('aside')).backgroundColor,
        titlebar: getComputedStyle(document.querySelector('.epitaxy-titlebar')).backgroundColor,
        input: getComputedStyle(document.querySelector('input')).backgroundColor,
        font: getComputedStyle(document.body).fontFamily };
    });
    assert.notEqual(styles.border.trim(), styles.base.trim());
    assert.notEqual(styles.sidebar, styles.input);
    assert.notEqual(styles.titlebar, 'rgba(0, 0, 0, 0)');
    assert.match(styles.font, /system-ui/);
  }
  await f.close();
});

test('navigation recolours a reused React pane within a frame, not the measurement debounce', async () => {
  const f = await setup({ panes: 1, storage: colors });
  const elapsed = await f.page.evaluate(async next => {
    const pane = document.querySelector('.dframe-pane');
    const before = pane.style.cssText;
    const start = performance.now();
    history.pushState({}, '', '/epitaxy/' + next);
    pane.__reactFiber$fixture.memoizedProps = { sessionId: next };
    pane.querySelector('.transcript').appendChild(document.createElement('p'));
    while (pane.style.cssText === before && performance.now() - start < 400) await new Promise(requestAnimationFrame);
    return { ms: performance.now() - start, css: pane.style.cssText };
  }, ids[1]);
  assert.ok(elapsed.ms < 150, `Accent took ${elapsed.ms}ms`);
  assert.match(elapsed.css, /#30d158/);
  await f.close();
});

test('theme trigger stays in free chrome when sidebar is closed', async () => {
  const f = await setup();
  await f.page.evaluate(() => { document.body.classList.add('sidebar-closed'); window.dispatchEvent(new Event('resize')); });
  const box = await f.page.locator('#cdt-host .trigger').boundingBox();
  assert.ok(box.y < 60, `Trigger moved to ${box.y}`);
  assert.ok(box.x >= 42 && box.x < 100);
  await f.page.locator('#cdt-host .trigger').click();
  assert.equal(await f.page.locator('#cdt-host .panel').isVisible(), true);
  await f.close();
});

test('blocked theme dock uses an opaque floating fallback instead of covering native controls', async () => {
  const f = await setup();
  await f.page.evaluate(() => {
    const b = document.createElement('button'); b.style.cssText = 'position:absolute;left:77px;top:17px;width:28px;height:28px';
    b.textContent = 'Native'; document.querySelector('nav').appendChild(b); window.dispatchEvent(new Event('resize'));
  });
  assert.equal(await f.page.locator('#cdt-host .trigger').getAttribute('data-floating'), '');
  const bg = await f.page.locator('#cdt-host .trigger').evaluate(el => getComputedStyle(el).backgroundColor);
  assert.notEqual(bg, 'rgba(0, 0, 0, 0)');
  await f.close();
});

test('hover dwell prevents fly-by expansion and early clicks cannot bypass it', async () => {
  const f = await setup({ storage: { 'cdt:expand': 'most' } });
  const first = f.page.locator('.dframe-pane').first();
  const original = await first.boundingBox();
  await f.page.mouse.move(original.x + 80, original.y + 90);
  await f.page.mouse.down(); await f.page.mouse.up();
  await f.page.waitForTimeout(200);
  assert.equal((await first.boundingBox()).width, original.width);
  await f.page.mouse.move(1150, 30);
  await f.page.waitForTimeout(600);
  assert.equal((await first.boundingBox()).width, original.width);
  await f.page.mouse.move(original.x + 80, original.y + 90);
  await f.page.waitForTimeout(1050);
  assert.ok((await first.boundingBox()).width > original.width + 200);
  const styles = await first.evaluate(el => ({ transition: el.style.transition, opacity: getComputedStyle(el).opacity, filter: getComputedStyle(el).filter, isolation: getComputedStyle(el).isolation, bg: getComputedStyle(el).backgroundColor }));
  assert.match(styles.transition, /420ms|0\.42s/);
  assert.equal(styles.opacity, '1');
  assert.equal(styles.filter, 'none');
  assert.equal(styles.isolation, 'isolate');
  assert.doesNotMatch(styles.bg, /rgba\(/);
  assert.equal(await f.page.locator('#cdt-host .pick').last().isVisible(), false);
  await f.close();
});

test('hover expansion restores original inline priorities on teardown', async () => {
  const f = await setup({ panes: 4, storage: { 'cdt:expand': 'most' } });
  await f.page.locator('.dframe-pane').first().evaluate(el => { el.style.setProperty('opacity', '.7', 'important'); el.style.setProperty('isolation', 'auto'); });
  const original = await f.page.locator('.dframe-pane').first().getAttribute('style');
  await f.page.locator('.transcript').first().hover();
  await f.page.waitForTimeout(1050);
  await f.page.evaluate(() => window.__cdtUninstall());
  assert.equal(await f.page.locator('.dframe-pane').first().getAttribute('style'), original);
  assert.equal(await f.page.locator('#cdt-host').count(), 0);
  await f.page.waitForTimeout(700);
  assert.equal(await f.page.locator('.dframe-pane').first().getAttribute('style'), original);
  await f.close();
});

test('reduced motion retains hover dwell but skips geometry animation', async () => {
  const f = await setup({ storage: { 'cdt:expand': 'most' }, reducedMotion: 'reduce' });
  await f.page.locator('.transcript').first().hover();
  await f.page.waitForTimeout(650);
  const durations = await f.page.locator('.dframe-pane').first().evaluate(el => getComputedStyle(el).transitionDuration);
  assert.ok(durations.split(',').every(d => parseFloat(d) === 0));
  await f.close();
});

test('covered pane controls disappear behind modals and return after dismissal', async () => {
  const f = await setup();
  await f.page.evaluate(() => {
    const modal = document.createElement('div'); modal.id = 'fixtureModal'; modal.setAttribute('role', 'dialog');
    modal.style.cssText = 'position:fixed;inset:0;z-index:1000;background:white'; document.body.appendChild(modal);
  });
  await f.page.waitForTimeout(350);
  assert.equal(await f.page.locator('#cdt-host .pick').first().isVisible(), false);
  await f.page.evaluate(() => document.getElementById('fixtureModal').remove());
  await f.page.waitForTimeout(350);
  assert.equal(await f.page.locator('#cdt-host .pick').first().isVisible(), true);
  await f.close();
});

test('locking an expanded pane does not trigger instant expansion in its neighbour', async () => {
  const f = await setup({ storage: { 'cdt:expand': 'most' } });
  await f.page.locator('.transcript').first().hover();
  await f.page.waitForTimeout(1050);
  const first = f.page.locator('.dframe-pane').first();
  const width = (await first.boundingBox()).width;
  await f.page.mouse.click(350, 180);
  await f.page.mouse.move(1160, 180);
  await f.page.waitForTimeout(650);
  assert.equal((await first.boundingBox()).width, width);
  await f.page.mouse.click(1160, 180);
  await f.page.waitForTimeout(200);
  assert.equal((await first.boundingBox()).width, width);
  await f.page.waitForTimeout(900);
  assert.ok((await first.boundingBox()).width < width - 200);
  await f.close();
});

test('a portal opened during hover cancels pending expansion', async () => {
  const f = await setup({ storage: { 'cdt:expand': 'most' } });
  const first = f.page.locator('.dframe-pane').first();
  const original = await first.boundingBox();
  await f.page.mouse.move(350, 180);
  await f.page.evaluate(() => {
    const menu = document.createElement('div'); menu.setAttribute('role', 'menu');
    menu.style.cssText = 'position:fixed;left:300px;top:120px;width:200px;height:200px;z-index:1000;background:white';
    document.body.appendChild(menu);
  });
  await f.page.waitForTimeout(800);
  assert.equal((await first.boundingBox()).width, original.width);
  await f.close();
});

test('a resize releases expanded panes and four-pane geometry remains inside its host', async () => {
  const f = await setup({ panes: 4, storage: { 'cdt:expand': 'most' } });
  await f.page.locator('.transcript').last().hover();
  await f.page.waitForTimeout(1050);
  const host = await f.page.locator('.dframe-pane-host').boundingBox();
  const expanded = await f.page.locator('.dframe-pane').last().boundingBox();
  assert.ok(expanded.x >= host.x && expanded.y >= host.y);
  assert.ok(expanded.x + expanded.width <= host.x + host.width + 1);
  assert.ok(expanded.y + expanded.height <= host.y + host.height + 1);
  await f.page.setViewportSize({ width: 1000, height: 740 });
  await f.page.waitForTimeout(100);
  assert.equal(await f.page.locator('.dframe-pane').last().evaluate(el => el.style.position), '');
  await f.close();
});

test('avatars coexist with colours and removing a colour preserves the avatar', async () => {
  const f = await setup({ storage: colors });
  await openSession(f.page);
  await f.page.locator('#cdt-host [data-icon="owl"]').click();
  await f.page.locator('#cdt-host [data-color=""]').click();
  const row = f.page.locator(`[href="/epitaxy/${ids[0]}"]`);
  assert.equal(await row.getAttribute('data-cdt-avatar'), 'owl');
  assert.equal(await row.getAttribute('data-cdt-row'), null);
  assert.equal(await row.evaluate(el => el.style.getPropertyValue('--cdt-row-accent')), '');
  assert.notEqual(await row.evaluate(el => getComputedStyle(el, '::after').maskImage), 'none');
  await f.close();
});

test('teardown cancels a pending accent frame without redecorating panes', async () => {
  const f = await setup({ storage: colors });
  await f.page.evaluate(() => {
    document.querySelector('.dframe-pane').appendChild(document.createElement('div'));
    history.replaceState({}, '', '/epitaxy/local_bbbbbbbb');
    window.__cdtUninstall();
  });
  await f.page.waitForTimeout(350);
  assert.equal(await f.page.locator('[data-cdt-accent], [data-cdt-row], [data-cdt-avatar]').count(), 0);
  await f.close();
});

test('a draft retains manual brightness after reload and theme reselection', async () => {
  const f = await setup();
  await selectTheme(f.page, 'dracula');
  await f.page.locator('#cdt-host [data-tab="custom"]').click();
  await f.page.locator('#cdt-host [data-k="accent"]').evaluate(el => { el.value = '#123456'; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  await f.page.locator('#cdt-host #bright').fill('74');
  await f.page.locator('#cdt-host #bright').dispatchEvent('change');
  await f.page.evaluate(() => window.__cdtUninstall());
  await f.page.addScriptTag({ content: source });
  await f.page.locator('#cdt-host .trigger').click();
  await f.page.locator('#cdt-host li[data-slug="__custom"]').click();
  assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')).brightness), 74);
  await f.close();
});

test('hovering a control then leaving the panes still collapses an unlocked expansion', async () => {
  const f = await setup({ storage: { 'cdt:expand': 'most' } });
  const first = f.page.locator('.dframe-pane').first();
  const original = await first.boundingBox();
  await f.page.locator('.transcript').first().hover();
  await f.page.waitForTimeout(1050);
  await f.page.locator('#cdt-host .pick').first().hover();
  await f.page.mouse.move(1150, 30);
  await f.page.waitForTimeout(850);
  assert.equal((await first.boundingBox()).width, original.width);
  assert.equal(await first.evaluate(el => el.style.position), '');
  await f.close();
});

test('streaming navigation refreshes the picker identity without waiting for an idle DOM', async () => {
  const f = await setup({ storage: { ...colors, 'cdt:sessionIcons': JSON.stringify({ [ids[1]]: 'robot' }) } });
  await openSession(f.page);
  await f.page.evaluate(() => {
    history.pushState({}, '', '/epitaxy/local_bbbbbbbb');
    const pane = document.querySelector('.dframe-pane');
    pane.__reactFiber$fixture.memoizedProps = { sessionId: 'local_bbbbbbbb' };
    window.fixtureStream = setInterval(() => {
      const node = document.createElement('span'); node.textContent = '.';
      pane.querySelector('.transcript').appendChild(node);
    }, 20);
    pane.appendChild(document.createElement('span'));
  });
  await f.page.waitForTimeout(100);
  assert.match(await f.page.locator('#cdt-host .pick').first().getAttribute('aria-label'), /Robot/);
  await f.page.locator('#cdt-host [data-color=""]').click();
  const map = await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:sessions')));
  assert.equal(map[ids[0]], '#ff453a');
  assert.equal(map[ids[1]], undefined);
  await f.page.evaluate(() => clearInterval(window.fixtureStream));
  await f.close();
});

test('legacy manual brightness survives upgrade until the next theme selection', async () => {
  const f = await setup({ storage: { 'cdt:text': JSON.stringify({ v: 3, brightness: 81, font: 'custom:Georgia' }) } });
  await f.page.locator('#cdt-host .trigger').click();
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  assert.equal(await f.page.locator('#cdt-host #bright').inputValue(), '81');
  await f.page.locator('#cdt-host [data-tab="theme"]').click();
  await f.page.locator('#cdt-host li[data-slug="dracula"]').click();
  const opts = await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')));
  assert.equal(opts.brightness, 50);
  assert.equal(opts.font, 'custom:Georgia');
  await f.close();
});

test('resetting text overrides persists after reload on a custom-brightness theme', async () => {
  const theme = { slug: 'user:bright', label: 'Bright custom', mode: 'dark', brightness: 78,
    deep: '#111111', base: '#222222', text: '#eeeeee', text2: '#cccccc', muted: '#888888', accent: '#ffcc66', border: '#555555' };
  const f = await setup({ storage: {
    'cdt:customThemes': JSON.stringify([theme]), 'cdt:theme:dark': theme.slug,
    'cdt:text': JSON.stringify({ v: 3, brightness: 78, weight: 'medium', brightnessTheme: 'dark:user:bright' }),
  } });
  await f.page.locator('#cdt-host .trigger').click();
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  await f.page.locator('#cdt-host #textReset').click();
  await f.page.evaluate(() => window.__cdtUninstall());
  await f.page.addScriptTag({ content: source });
  await f.page.locator('#cdt-host .trigger').click();
  await f.page.locator('#cdt-host [data-tab="text"]').click();
  assert.equal(await f.page.locator('#cdt-host #bright').inputValue(), '50');
  await f.page.locator('#cdt-host [data-tab="theme"]').click();
  await f.page.locator('#cdt-host li[data-slug="user:bright"]').click();
  assert.equal(await f.page.evaluate(() => JSON.parse(localStorage.getItem('cdt:text')).brightness), 78);
  await f.close();
});

test('explicit custom light sidebar colours are not forced to a contrast floor', async () => {
  const theme = { slug: 'user:gentle', label: 'Gentle', mode: 'light', brightness: 50,
    deep: '#fafafa', base: '#ffffff', text: '#222222', text2: '#555555', muted: '#777777', accent: '#0969da', border: '#dddddd' };
  const f = await setup({ mode: 'light', storage: { 'cdt:customThemes': JSON.stringify([theme]), 'cdt:theme:light': theme.slug } });
  assert.equal(await f.page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--cds-surface-0').trim()), '#fafafa');
  await f.close();
});

test('sidebar decorations never attach to matching transcript links', async () => {
  const f = await setup({ storage: { ...colors, 'cdt:sessionIcons': JSON.stringify({ [ids[0]]: 'fox' }) } });
  await f.page.evaluate(() => {
    const link = document.createElement('a'); link.id = 'transcriptLink'; link.href = '/epitaxy/local_aaaaaaaa';
    link.textContent = 'Session link'; link.style.cssText = 'display:block;width:180px;height:44px';
    document.querySelector('.transcript').appendChild(link);
  });
  await f.page.waitForTimeout(350);
  assert.equal(await f.page.locator('#transcriptLink').getAttribute('data-cdt-avatar'), null);
  assert.equal(await f.page.locator('#transcriptLink').getAttribute('data-cdt-row'), null);
  assert.equal(await f.page.locator('aside [data-cdt-avatar]').count(), 1);
  await f.close();
});
