// validation.mjs — Validation profile "web/landing": secciones, carruseles, scroll y animaciones.
// Sale de check_catalog.mjs (paso 2, 06/10) sin cambios de conducta.

import { ARROWS, BOARD_SNAP, HOVER_KINDS, ITEM_LEFTS, LABELED_NUMBERS, MARK_SECTION, NAV_RE, NUMBERS_IN, RENDER_AFTER, RENDER_STATIC, SEEN_SRC, SEEN_WORDS, SNAP, STYLE_SNAP, WIN_AT_LOAD, WIN_WORDS, diffCount, diffSample, fieldText, findControl, keysFrom, matches, norm, visibleTexts, words, INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "../validation/lib.mjs";

export default {
  id: "web/landing",
  extends: "web",
  checks: {
    section_content: {
      describe: "La sección que se llama/titula X tiene contenido propio visible (al menos 8 palabras además de sus títulos). Usar para 'sección X con historia/descripción/información'.",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
        if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
        // 20 → 8 (02/10): 20 era arbitrario y un hero real (título + subtítulo + botón) tiene
        // ~14 palabras fuera del título (Project22). Los controles siguen en 0 (esqueleto, sections_vacio).
        r.result = info.words >= 8 ? "PASS" : "FAIL";
        r.detail = `#${info.id}: ${info.words} palabras propias (mín. 8)`;
        break;
      } while (false); },
    },
    section_items: {
      describe: "La sección X muestra una lista de varios elementos repetidos con texto (tarjetas, productos, ítems de menú; al menos 2). Usar para 'catálogo/lista/carta de productos', 'productos disponibles'.",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
        if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
        r.result = info.items >= 2 ? "PASS" : "FAIL";
        r.detail = `#${info.id}: ${info.items} ítems${info.items ? ` (${info.sample.join(" · ")})` : ""}`;
        break;
      } while (false); },
    },
    carousel: {
      describe: "La sección X muestra sus elementos en un carrusel: hay controles (anterior/siguiente) o desplazamiento horizontal, y al usarlos los elementos se mueven. Usar para 'en carrusel/carrousel/slider'.",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const vp = page.viewportSize();
        const tryOnce = async () => {
          const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
          if (!info) return { detail: `no hay sección: ${c.params.section.join(" / ")}` };
          if (info.items < 2) return { detail: `#${info.id}: ${info.items} ítems, no hay carrusel` };
          const before = await page.evaluate(ITEM_LEFTS);
          // 1) controles anterior/siguiente dentro de la sección
          const ctl = page.locator("[data-vc-section] :is(button, a, [role=button])").filter({ visible: true });
          const n = await ctl.count();
          let sawControl = false;
          for (let i = 0; i < n; i++) {
            const el = ctl.nth(i);
            const t = [(await el.innerText().catch(() => "")), (await el.getAttribute("aria-label")) || "", (await el.getAttribute("class")) || ""].join(" ");
            if (!NAV_RE.test(t) && !/(next|prev|siguiente|anterior)/i.test(t)) continue;
            sawControl = true;
            if (await el.isDisabled().catch(() => false)) continue;
            await el.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(100); await waitForSettle(page);
            const after = await page.evaluate(ITEM_LEFTS);
            if (after.some((x, k) => Math.abs(x - before[k]) > 5)) return { pass: true, detail: `#${info.id}: ${info.items} ítems; clic en "${t.trim().split(/\s+/).slice(0, 3).join(" ")}" los desplaza` };
          }
          // 2) contenedor con scroll horizontal
          const scrolled = await page.evaluate(() => {
            const items = [...document.querySelectorAll("[data-vc-item]")];
            let p = items[0]?.parentElement;
            while (p && !p.hasAttribute("data-vc-section")) {
              const ox = getComputedStyle(p).overflowX;
              if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 10) { p.scrollLeft += 200; return true; }
              p = p.parentElement;
            }
            return false;
          });
          if (scrolled) {
            await page.waitForTimeout(400);
            const after = await page.evaluate(ITEM_LEFTS);
            if (after.some((x, k) => Math.abs(x - before[k]) > 5)) return { pass: true, detail: `#${info.id}: ${info.items} ítems en contenedor con scroll horizontal` };
          }
          return { detail: `#${info.id}: ${info.items} ítems; ${sawControl ? "controles sin efecto o deshabilitados" : "sin controles anterior/siguiente ni scroll horizontal"}` };
        };
        let res = await tryOnce();
        if (!res.pass) {
          // Puede que a este ancho entren todos y los controles estén deshabilitados: probar angosto.
          await page.setViewportSize({ width: 480, height: 800 });
          await reload();
          const narrow = await tryOnce();
          if (vp) await page.setViewportSize(vp);
          if (narrow.pass) res = { pass: true, detail: narrow.detail + " (a 480 px)" };
          else res.detail += ` | a 480 px: ${narrow.detail.replace(/^#[^:]+: /, "")}`;
        }
        r.result = res.pass ? "PASS" : "FAIL";
        r.detail = res.detail;
        break;
      } while (false); },
    },
    section_control: {
      describe: "La sección X tiene al menos un botón o link visible (ej. el botón de llamada a la acción de un hero). Usar para 'sección X con botón / CTA / llamada a la acción'.",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
        if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
        const ctl = await page.$$eval("[data-vc-section] :is(button, a[href], [role=button], input[type=submit], input[type=button])", (els) =>
          els.filter((e) => e.offsetParent !== null || e.getClientRects().length).map((e) => (e.innerText || e.value || e.getAttribute("aria-label") || "").trim()).filter(Boolean));
        r.result = ctl.length ? "PASS" : "FAIL";
        r.detail = ctl.length ? `#${info.id}: control "${ctl[0].slice(0, 40)}"` : `#${info.id}: sin botones ni links`;
        break;
      } while (false); },
    },
    nav_scroll: {
      describe: "La barra de navegación queda fija arriba al bajar por la página y sus enlaces llevan a cada sección. Usar para 'navegación / menú fijo', 'scroll suave a cada sección'.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const res = await page.evaluate(() => {
          const links = [...document.querySelectorAll("header a[href^='#'], nav a[href^='#']")].filter((a) => a.getAttribute("href").length > 1 && document.querySelector(a.getAttribute("href")) && (a.offsetParent !== null || a.getClientRects().length));
          if (!links.length) return null;
          // el link cuyo destino está más abajo
          links.sort((a, b) => document.querySelector(b.getAttribute("href")).getBoundingClientRect().top - document.querySelector(a.getAttribute("href")).getBoundingClientRect().top);
          const a = links[0];
          a.setAttribute("data-vc-link", "1");
          const nav = a.closest("header, nav");
          nav.setAttribute("data-vc-nav", "1");
          return { href: a.getAttribute("href"), n: links.length };
        });
        if (!res) { r.detail = "no hay enlaces de navegación a secciones (#id)"; break; }
        await page.click("[data-vc-link]", { timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1500); await waitForSettle(page);
        const st = await page.evaluate((href) => {
          const t = document.querySelector(href).getBoundingClientRect();
          const n = document.querySelector("[data-vc-nav]").getBoundingClientRect();
          return { y: Math.round(scrollY), targetTop: Math.round(t.top), navTop: Math.round(n.top), navBottom: Math.round(n.bottom) };
        }, res.href);
        const arrived = st.y > 50 && st.targetTop > -60 && st.targetTop < 250;
        const fixed = st.navTop > -2 && st.navBottom > 0;
        r.result = arrived && fixed ? "PASS" : "FAIL";
        r.detail = `clic en ${res.href}: ${arrived ? "llegó a la sección" : `no llegó (scrollY ${st.y}, sección a ${st.targetTop}px)`}; nav ${fixed ? "sigue visible arriba" : "se fue con el scroll"}`;
        break;
      } while (false); },
    },
    reveal_on_scroll: {
      describe: "Hay contenido que aparece (estaba oculto o desplazado y se hace visible) al bajar con el scroll. Usar para 'animaciones al hacer scroll', 'elementos que aparecen'.",
      params: {},
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        await page.setViewportSize({ width: 1280, height: 800 });
        await reload();
        const marked = await page.evaluate(() => {
          const hidden = (e) => { const c = getComputedStyle(e); return Number(c.opacity) < 0.5 || c.visibility === "hidden"; };
          const below = [...document.querySelectorAll("main *, section, article")].filter((e) => e.getBoundingClientRect().top > innerHeight + 10 && (e.innerText || "").trim().length > 3);
          const h = below.filter(hidden).slice(0, 10);
          h.forEach((e) => e.setAttribute("data-vc-rev", "1"));
          return h.length;
        });
        if (!marked) { r.detail = "nada oculto debajo del primer pantallazo: no hay aparición al hacer scroll"; break; }
        for (let i = 0; i < 40; i++) {
          await page.mouse.wheel(0, 250); await page.waitForTimeout(120);
          if (await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2)) break;
        }
        await page.waitForTimeout(1000);
        const shown = await page.evaluate(() => [...document.querySelectorAll("[data-vc-rev]")].filter((e) => { const c = getComputedStyle(e); return Number(c.opacity) > 0.9 && c.visibility !== "hidden"; }).length);
        r.result = shown > 0 ? "PASS" : "FAIL";
        r.detail = `${marked} elementos ocultos abajo; ${shown} aparecieron al bajar`;
        await page.setViewportSize({ width: 1280, height: 720 });
        break;
      } while (false); },
    },
    entrance_animation: {
      describe: "La sección X tiene una animación o transición en los primeros segundos de carga. Usar para 'animación de entrada' de una sección (ej. el hero).",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
        if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
        const n = await page.evaluate(() => (window.__entrance || []).filter((e) => e.closest("[data-vc-section]")).length);
        r.result = n ? "PASS" : "FAIL";
        r.detail = `#${info.id}: ${n ? `${n} elementos animados al cargar` : "nada se animó al cargar"}`;
        break;
      } while (false); },
    },
    numbers_animate: {
      describe: "En la sección X hay números que cambian solos al verla (contadores animados). Usar para 'estadísticas / contadores animados'.",
      params: { section: "string[]" },
      // do { … } while (false): los "break" de cada chequeo cortan acá, como en el switch de antes
      run: async ({ page, c, r, ctx, fields, findField, reload, browser, url, env }) => { do {
        const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
        if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
        const before = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
        if (!before) { r.detail = `#${info.id}: no hay números`; break; }
        await page.locator("[data-vc-section]").scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        const early = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
        await page.waitForTimeout(2500);
        const after = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
        const changed = early !== after || before !== after;
        r.result = changed ? "PASS" : "FAIL";
        r.detail = `#${info.id}: ${changed ? `"${before.slice(0, 40)}" → "${after.slice(0, 40)}"` : `los números no cambian ("${after.slice(0, 50)}")`}`;
        break;
      } while (false); },
    },
  },
};
