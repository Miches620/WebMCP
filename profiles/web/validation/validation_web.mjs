// validation_web.mjs — Validation profile "web" (plataforma): lo que vale para cualquier página.
// Sale de check_catalog.mjs (paso 2, 06/10) sin cambios de conducta.

import { ARROWS, BOARD_SNAP, HOVER_KINDS, ITEM_LEFTS, LABELED_NUMBERS, MARK_SECTION, NAV_RE, NUMBERS_IN, RENDER_AFTER, RENDER_STATIC, SEEN_SRC, SEEN_WORDS, SNAP, STYLE_SNAP, WIN_AT_LOAD, WIN_WORDS, diffCount, diffSample, fieldText, findControl, keysFrom, matches, norm, visibleTexts, words, INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "./lib.mjs";

export default {
  id: "web",
  extends: null,
  checks: {
    no_js_errors: {
      describe: "La página carga sin errores de JavaScript.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        r.result = ctx.pageErrors.length ? "FAIL" : "PASS";
        r.detail = ctx.pageErrors.join(" | ").slice(0, 200) || "sin excepciones";
        // v0.7.3: dónde (línea del index.html) para que el harness ubique la función que falla
        r.errors = ctx.pageStacks.map((x) => ({ message: x.message, line: Number((x.stack.match(/\.html:(\d+):\d+/) || [])[1]) || null }));
        break;
      } while (false); },
    },
    text_visible: {
      describe: "Hay texto visible en la página que menciona algo concreto (una etiqueta, un mensaje, un dato). NO sirve para demostrar que una sección existe o tiene contenido (los títulos de sección ya vienen en la página).",
      params: { text: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const body = await page.evaluate(() => document.body.innerText);
        const hit = words(c.params.text).find((w) => norm(body).includes(w));
        r.result = hit ? "PASS" : "FAIL";
        r.detail = hit ? `visible: "${hit}"` : `no aparece: ${c.params.text.join(" / ")}`;
        break;
      } while (false); },
    },
    control_visible: {
      describe: "Hay un botón, link, select o pestaña visible cuyo texto menciona algo. Usar para 'permitir hacer X' / 'botón para X'.",
      params: { text: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const texts = await visibleTexts(page, "button, a, select, [role=tab], [role=button], input[type=submit], input[type=button]");
        const hit = texts.find((t) => matches(t, c.params.text));
        r.result = hit ? "PASS" : "FAIL";
        r.detail = hit ? `control: "${hit.slice(0, 60)}"` : `ningún control menciona: ${c.params.text.join(" / ")}`;
        break;
      } while (false); },
    },
    field_exists: {
      describe: "Hay un campo de formulario (input, select, textarea) cuyo label/nombre/placeholder menciona algo.",
      params: { field: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const f = findField();
        r.result = f.length ? "PASS" : "FAIL";
        r.detail = f.length ? `campo: ${f.map((x) => x.name || x.id || x.label).join(", ")}` : `no hay campo: ${c.params.field.join(" / ")}`;
        break;
      } while (false); },
    },
    field_required: {
      describe: "Ese campo es obligatorio: si se deja vacío (y el resto está completo), el envío queda bloqueado.",
      params: { field: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        // Se miden TODOS los campos que matchean: el traductor a veces usa la
        // lista como varios campos ("nombre", "email") y no como sinónimos
        // de uno (exp_translator 01/10). Cada uno tiene que cumplir.
        const f = findField();
        if (!f.length) { r.detail = `no hay campo: ${c.params.field.join(" / ")}`; break; }
        // Línea base: con todo completo, ¿el envío pasa? Si no, no se puede medir.
        await fillForm(page, fields);
        const base = await submitAndJudge(page, ctx);
        if (!base.accepted) { r.result = "FAIL"; r.detail = `un envío completo no pasa (${base.why}); no se puede medir`; break; }
        const parts = [];
        let allOk = true;
        for (const field of f) {
          await reload();
          await fillForm(page, fields, { empty: [field.index] });
          const s = await submitAndJudge(page, ctx);
          const blocked = !s.accepted;
          const ok = (c.type === "field_required") === blocked;
          allOk = allOk && ok;
          parts.push(`${field.name || field.id}: vacío → ${blocked ? "bloqueado" : "pasa"}${ok ? "" : " ✗"}`);
        }
        r.result = allOk ? "PASS" : "FAIL";
        r.detail = parts.join("; ");
        break;
      } while (false); },
    },
    field_optional: {
      describe: "Ese campo es opcional: si se deja vacío (y el resto está completo), el envío pasa.",
      params: { field: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        // Se miden TODOS los campos que matchean: el traductor a veces usa la
        // lista como varios campos ("nombre", "email") y no como sinónimos
        // de uno (exp_translator 01/10). Cada uno tiene que cumplir.
        const f = findField();
        if (!f.length) { r.detail = `no hay campo: ${c.params.field.join(" / ")}`; break; }
        // Línea base: con todo completo, ¿el envío pasa? Si no, no se puede medir.
        await fillForm(page, fields);
        const base = await submitAndJudge(page, ctx);
        if (!base.accepted) { r.result = "FAIL"; r.detail = `un envío completo no pasa (${base.why}); no se puede medir`; break; }
        const parts = [];
        let allOk = true;
        for (const field of f) {
          await reload();
          await fillForm(page, fields, { empty: [field.index] });
          const s = await submitAndJudge(page, ctx);
          const blocked = !s.accepted;
          const ok = (c.type === "field_required") === blocked;
          allOk = allOk && ok;
          parts.push(`${field.name || field.id}: vacío → ${blocked ? "bloqueado" : "pasa"}${ok ? "" : " ✗"}`);
        }
        r.result = allOk ? "PASS" : "FAIL";
        r.detail = parts.join("; ");
        break;
      } while (false); },
    },
    submit_empty_blocked: {
      describe: "Enviar el formulario vacío queda bloqueado.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        if (!fields.length) { r.detail = "no hay formulario"; break; }
        await fillForm(page, fields, { empty: fields.map((f) => f.index) });
        const s = await submitAndJudge(page, ctx);
        r.result = s.accepted ? "FAIL" : "PASS";
        r.detail = s.why;
        break;
      } while (false); },
    },
    valid_submit_passes: {
      describe: "Con todos los campos completos con datos válidos, el envío pasa.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        if (!fields.length) { r.detail = "no hay formulario"; break; }
        await fillForm(page, fields);
        const s = await submitAndJudge(page, ctx);
        r.result = s.accepted ? "PASS" : "FAIL";
        r.detail = s.why;
        break;
      } while (false); },
    },
    no_horizontal_scroll: {
      describe: "La página no tiene scroll horizontal ni en celular (390 px) ni en escritorio (1280 px). Usar para 'responsive', 'escritorio y móvil', 'se adapta a celular'.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const vp = page.viewportSize();
        const parts = [];
        let ok = true;
        for (const w of [390, 1280]) {
          await page.setViewportSize({ width: w, height: 800 });
          await reload();
          const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
          const over = m.sw - m.iw;
          if (over > 1) ok = false;
          parts.push(`${w}px: ${over > 1 ? `desborda ${over}px` : "ok"}`);
        }
        if (vp) await page.setViewportSize(vp);
        r.result = ok ? "PASS" : "FAIL";
        r.detail = parts.join("; ");
        break;
      } while (false); },
    },
    hover_changes: {
      describe: "Al pasar el mouse por encima de botones y/o tarjetas cambia su estilo (color, sombra, tamaño, posición). En elementos van palabras como 'boton', 'tarjeta', 'enlace'. Usar para 'efectos hover'.",
      params: { elementos: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const ws = words(c.params.elementos);
        const kinds = HOVER_KINDS.filter((k) => ws.some((w) => k.re.test(w)));
        if (!kinds.length) { r.detail = `no sé qué elemento es: ${c.params.elementos.join(" / ")}`; break; }
        const parts = [];
        let ok = true;
        for (const k of kinds) {
          const loc = page.locator(k.sel).filter({ visible: true });
          const n = Math.min(await loc.count(), 5);
          let changed = false, tried = 0;
          for (let i = 0; i < n && !changed; i++) {
            const el = loc.nth(i);
            await el.scrollIntoViewIfNeeded().catch(() => {});
            await page.mouse.move(0, 0);
            await page.waitForTimeout(150); await waitForSettle(page);
            const before = await el.evaluate(STYLE_SNAP).catch(() => null);
            if (before === null) continue;
            tried++;
            await el.hover({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(500);
            const after = await el.evaluate(STYLE_SNAP).catch(() => before);
            changed = before !== after;
          }
          if (!changed) ok = false;
          parts.push(`${k.label}: ${!tried ? "no hay" : changed ? "cambia al pasar el mouse" : `sin cambio (${tried} probados)`}`);
        }
        r.result = ok ? "PASS" : "FAIL";
        r.detail = parts.join("; ");
        break;
      } while (false); },
    },
    sections_visible: {
      describe: "BASE (no lo usa el traductor): cada pieza con data-feature (header, secciones, footer) muestra su texto cuando el usuario llega a ella con el scroll.",
      params: {},
      base: true,
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        // Cada pieza anclada: llevarla a pantalla con la rueda (dispara observers reales),
        // esperar las transiciones y contar las palabras que se ven. Visible = ≥ 50 %.
        await page.setViewportSize({ width: 1280, height: 800 });
        await reload();
        const anchors = await page.evaluate(() => [...document.querySelectorAll("[data-feature]")].map((e, i) => {
          e.setAttribute("data-vc-anchor", String(i));
          return { i, id: e.id || e.tagName.toLowerCase(), features: (e.getAttribute("data-feature") || "").split(/\s+/).filter(Boolean) };
        }));
        if (!anchors.length) { r.result = "NOT_APPLICABLE"; r.detail = "la página no tiene piezas con data-feature"; break; }
        const parts = [], byFeature = {}, per = [];
        for (const a of anchors) {
          const target = await page.evaluate((i) => {
            const e = document.querySelector(`[data-vc-anchor="${i}"]`);
            const top = e.getBoundingClientRect().top + scrollY;
            return Math.max(0, Math.min(top - 80, document.documentElement.scrollHeight - innerHeight));
          }, a.i);
          for (let k = 0; k < 60; k++) {
            const y = await page.evaluate(() => scrollY);
            if (Math.abs(y - target) < 30) break;
            await page.mouse.wheel(0, Math.max(-300, Math.min(300, target - y)));
            await page.waitForTimeout(60);
          }
          await page.waitForTimeout(900);
          const measure = () => page.evaluate(([src, i]) => (0, eval)(`(${src})`)(document.querySelector(`[data-vc-anchor="${i}"]`)), [SEEN_SRC, a.i]);
          let w = await measure();
          // v0.5.2 (Project22 v0.7.1, contacto): la pieza puede ser más alta que la pantalla y
          // su contenido de abajo aparece recién al llegar ahí. Se recorre de a tramos, como un
          // usuario, y cuenta lo que se vio en algún momento.
          for (let k = 0; k < 12 && w.seen < w.total; k++) {
            const more = await page.evaluate((i) => {
              const r = document.querySelector(`[data-vc-anchor="${i}"]`).getBoundingClientRect();
              return r.bottom > innerHeight + 5 && scrollY + innerHeight < document.documentElement.scrollHeight - 2;
            }, a.i);
            if (!more) break;
            for (let s = 0; s < 2; s++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(60); }
            await page.waitForTimeout(700);
            w = await measure();
          }
          const ok = w.total === 0 ? false : w.seen / w.total >= 0.5;
          parts.push(`#${a.id}: ${w.seen}/${w.total} palabras visibles${w.ondemand ? ` (+${w.ondemand} a demanda)` : ""}${ok ? "" : " ✗"}`);
          per.push({ id: a.id, features: a.features, seen: w.seen, total: w.total, ondemand: w.ondemand || 0, ok });
          for (const f of a.features) byFeature[f] = (byFeature[f] ?? true) && ok;
        }
        r.anchors = per;
        r.features = Object.fromEntries(Object.entries(byFeature).map(([f, ok]) => [f, ok ? "PASS" : "FAIL"]));
        r.result = Object.values(byFeature).every(Boolean) ? "PASS" : "FAIL";
        r.detail = parts.join("; ");
        await page.setViewportSize({ width: 1280, height: 720 });
        break;
      } while (false); },
    },
    components_render: {
      describe: "BASE (no lo usa el traductor): cada componente con JS llena al menos uno de los contenedores que su JS nombra (un tablero vacío es FAIL).",
      params: {},
      base: true,
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const ctxNoJs = await browser.newContext({ javaScriptEnabled: false });
        let found = [];
        try {
          const p0 = await ctxNoJs.newPage();
          await p0.route(/^https?:/, (x) => x.abort());
          await p0.goto(url, { waitUntil: "load" });
          found = await p0.evaluate(RENDER_STATIC);
        } finally { await ctxNoJs.close(); }
        const comps = await page.evaluate(RENDER_AFTER, found);
        if (!comps.length) { r.result = "NOT_APPLICABLE"; r.detail = "ningún componente con JS nombra contenedores"; break; }
        r.components = comps;
        const bad = comps.filter((x) => !x.ok);
        r.result = bad.length ? "FAIL" : "PASS";
        r.detail = comps.map((x) => `#${x.id}: ${x.ok ? `${x.refs - x.empty.length}/${x.refs} contenedores con contenido` : `nada dibujado (${x.empty.slice(0, 4).join(", ")} vacíos)`}`).join("; ");
        break;
      } while (false); },
    },
    click_reveals: {
      describe: "Al hacer clic en un control cuyo texto menciona A, aparece visible texto que menciona B.",
      params: { click: "string[]", expect: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const loc = page.locator("button, a, [role=tab], [role=button], input[type=button], summary").filter({ visible: true });
        const n = await loc.count();
        let clicked = null;
        for (let i = 0; i < n && !clicked; i++) {
          const t = (await loc.nth(i).innerText().catch(() => "")) || (await loc.nth(i).getAttribute("value")) || "";
          if (matches(t, c.params.click)) { await loc.nth(i).click({ timeout: 2000 }).catch(() => {}); clicked = t.trim(); }
        }
        if (!clicked) { r.detail = `ningún control menciona: ${c.params.click.join(" / ")}`; break; }
        await page.waitForTimeout(100); await waitForSettle(page);
        const body = await page.evaluate(() => document.body.innerText);
        const hit = words(c.params.expect).find((w) => norm(body).includes(w));
        r.result = hit ? "PASS" : "FAIL";
        r.detail = hit ? `clic "${clicked.slice(0, 40)}" → visible "${hit}"` : `clic "${clicked.slice(0, 40)}" → no aparece: ${c.params.expect.join(" / ")}`;
        break;
      } while (false); },
    },
  },
};
