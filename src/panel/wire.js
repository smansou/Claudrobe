/* ───────────────────────────────────────────────────────────────────────────
 * panel/wire.js — Wire the panel's controls to the state.
 *
 * One delegated listener per event type over the shadow root, so the markup
 * can be rebuilt freely without leaking handlers.
 * ─────────────────────────────────────────────────────────────────────────── */


  function wireUI() {
    const q = s => shadow.querySelector(s);
    const qa = s => shadow.querySelectorAll(s);
    const stop = el => { if (el) { el.onclick = e => e.stopPropagation(); el.onkeydown = e => e.stopPropagation(); } };

    q('.trigger').onclick = e => { e.stopPropagation(); open = !open; accentOpen = -1; renderUI(); };

    qa('.tabs button').forEach(b => b.onclick = e => {
      e.stopPropagation(); tab = b.dataset.tab; renderUI();
    });
    qa('li[data-slug]').forEach(li => li.onclick = e => {
      e.stopPropagation();
      if (e.composedPath().some(n => n.dataset?.del)) return;
      const slug = li.dataset.slug;
      applyTheme(slug === DRAFT ? readDraft() : allThemes().find(t => t.slug === slug));
    });
    qa('[data-del]').forEach(x => x.onclick = e => { e.stopPropagation(); deleteCustom(x.dataset.del); });

    // Text
    const textReset = q('#textReset');
    if (textReset) textReset.onclick = e => {
      e.stopPropagation();
      textOpts = { ...TEXT_DEFAULTS, v: 3, brightnessTheme: `${appMode()}:${current.slug}` };
      writeJSON(LS_TEXT, textOpts); applyStyle(); renderUI();
    };
    qa('[data-weight]').forEach(b => b.onclick = e => {
      e.stopPropagation(); textOpts.weight = b.dataset.weight;
      writeJSON(LS_TEXT, textOpts); applyStyle(); renderUI();
    });
    const bright = q('#bright');
    if (bright) {
      bright.oninput = () => { textOpts.brightness = +bright.value;
        textOpts.brightnessTheme = `${appMode()}:${current.slug}`; applyStyle(); };
      bright.onchange = () => {
        if (current.slug === DRAFT) {
          current.brightness = textOpts.brightness;
          writeJSON(draftKey(), current);
        }
        writeJSON(LS_TEXT, textOpts); renderUI();
      };
      bright.onclick = e => e.stopPropagation();
    }
    for (const key of ['font', 'tfont', 'mono']) {
      const el = q('#' + key);
      if (el) {
        el.onchange = e => { e.stopPropagation(); textOpts[key] = el.value;
          writeJSON(LS_TEXT, textOpts); applyStyle(); renderUI(); };
        el.onclick = e => e.stopPropagation();
      }
      const ci = q(`#${key}-custom`);
      if (ci) {
        stop(ci);
        // Live as you type, but only persist and re-render on commit, so the
        // field is not torn out from under the caret on every keystroke.
        ci.oninput = () => { textOpts[key] = 'custom:' + ci.value.trim(); applyStyle(); };
        ci.onchange = () => { writeJSON(LS_TEXT, textOpts); renderUI(); };
      }
    }
    const scan = q('#scan');
    if (scan) scan.onclick = async e => {
      e.stopPropagation();
      const msg = q('#scanmsg');
      scan.disabled = true; scan.textContent = 'Scanning…';
      try {
        const n = await scanSystemFonts();
        renderUI();
        const m = shadow.querySelector('#scanmsg');
        if (m) m.textContent = `${n} families found and added to all three lists.`;
      } catch (err) {
        scan.disabled = false;
        scan.textContent = 'Scan installed fonts';
        if (msg) {
          msg.className = 'hint warn';
          msg.textContent = /denied|NotAllowed/i.test(String(err))
            ? 'Permission denied — allow font access for this view, then try again.'
            : `Not available here (${String(err.message || err).slice(0, 80)}). Use Custom… instead.`;
        }
      }
    };

    // Customize. Colour inputs apply live while dragging and only rebuild the
    // panel on commit, so the system colour picker is not torn down mid-drag.
    qa('.prop input[type=color]').forEach(inp => {
      inp.onclick = e => e.stopPropagation();
      inp.oninput = e => {
        e.stopPropagation();
        editProp(inp.dataset.k, inp.value.toUpperCase());
        const code = inp.closest('.prop')?.querySelector('code');
        if (code) code.textContent = inp.value.toUpperCase();
      };
      inp.onchange = () => renderUI();
    });
    const tint = q('#tint');
    if (tint) {
      tint.onclick = e => e.stopPropagation();
      tint.oninput = () => editProp('tint', +tint.value / 100);
      tint.onchange = () => renderUI();
    }
    const tintAuto = q('#tintAuto');
    if (tintAuto) tintAuto.onclick = e => { e.stopPropagation(); editProp('tint', undefined); applyStyle(); renderUI(); };
    const bmin = q('#bmin');
    if (bmin) {
      bmin.onclick = e => e.stopPropagation();
      bmin.oninput = () => editProp('borderMin', +bmin.value / 100);
      bmin.onchange = () => renderUI();
    }
    const cname = q('#cname'), csave = q('#csave');
    if (cname) {
      stop(cname);
      cname.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') saveDraft(cname.value); };
    }
    if (csave) csave.onclick = e => { e.stopPropagation(); saveDraft(cname?.value); };

    // Session colour
    qa('.pick').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const clickedPane = paneInfo[+b.dataset.i]?.el;
      forgetPaneIds(); syncPanes();
      const i = paneInfo.findIndex(p => p.el === clickedPane);
      if (i < 0 || !paneInfo[i].visible) return;
      accentOpen = accentOpen === i ? -1 : i;
      open = false;
      renderUI();
    });
    qa('[data-icon]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const id = freshSessionTarget();
      if (id) setSessionIcon(id, b.dataset.icon);
      renderUI();
    });
    const bw = q('#bwidth');
    if (bw) {
      bw.oninput = e => { e.stopPropagation();
        borderWidth = clamp(parseFloat(bw.value), WIDTH_MIN, WIDTH_MAX);
        document.documentElement.style.setProperty('--cdt-border-w', String(borderWidth)); };
      bw.onchange = e => { e.stopPropagation(); localStorage.setItem(LS_WIDTH, String(borderWidth)); };
      bw.onclick = e => e.stopPropagation();
    }
    const fl = q('#fill');
    if (fl) {
      fl.oninput = e => { e.stopPropagation();
        fillLevel = clamp(parseFloat(fl.value), 0, 100);
        document.documentElement.style.setProperty('--cdt-fill', String(fillPct())); };
      fl.onchange = e => { e.stopPropagation(); localStorage.setItem(LS_FILL, String(fillLevel)); };
      fl.onclick = e => e.stopPropagation();
    }
    qa('[data-border]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      borderStyle = b.dataset.border;
      localStorage.setItem(LS_BORDER, borderStyle);
      paintAccent(); renderUI();
    });
    qa('.cs[data-color]').forEach(sw => sw.onclick = e => {
      e.stopPropagation();
      const id = freshSessionTarget();
      if (id) setSessionColor(id, sw.dataset.color || null);
      renderUI();
    });
    // The full picker applies live while dragging and only rebuilds the
    // popover on commit, so the system picker is not torn down mid-drag.
    const any = q('#anyColor');
    if (any) {
      any.onclick = e => e.stopPropagation();
      any.oninput = e => { e.stopPropagation();
        const id = freshSessionTarget();
        if (id) setSessionColor(id, any.value.toLowerCase());
        const w = any.parentElement; w.classList.add('mine'); w.style.setProperty('--c', any.value); };
      any.onchange = () => renderUI();
    }

    // Panes
    qa('[data-expand]').forEach(b => b.onclick = e => {
      e.stopPropagation(); setExpandMode(b.dataset.expand); renderUI();
    });
    qa('[data-tstatus]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      titleStatus = b.dataset.tstatus === 'on';
      localStorage.setItem(LS_TSTATUS, titleStatus ? 'on' : 'off');
      paintAccent(); renderUI();
    });
  }
