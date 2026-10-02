// check_catalog.mjs — catálogo CERRADO de chequeos ejecutables (Validation profile: SPA).
//
// Decisión 01/10: el juez de cobertura es Validation ejecutando el artefacto.
// Un requisito se traduce a chequeos de este catálogo (lo hace
// check_translator.mjs con Qwen, sin escribir código) y cada chequeo se
// ejecuta en Chromium real: PASS / FAIL / NOT_APPLICABLE lo decide el código.
//
// Alcance v0.1: solo lo que se ve y se usa en la SPA (backend simulado /
// datos mockeados). Los elementos se buscan por TEXTO visible (label, name,
// placeholder, aria-label, texto del botón), con una lista de sinónimos que
// da el traductor, porque el traductor no conoce el DOM.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "./form_runtime.mjs";

export const CATALOG_VERSION = "check_catalog v0.4";

// v0.4 (02/10): chequeos de requisitos TRANSVERSALES y de interacción, que en
// Project22 quedaron SIN_CHEQUEO o con FAIL falso: sin scroll horizontal en
// celular, hover que cambia el estilo, nav fija que lleva a la sección, aparición
// al hacer scroll, animación de entrada, números que cambian y sección con
// botón. "Visualmente atractivo" o "código limpio" siguen sin chequeo: no se
// pueden medir ejecutando la página.

// v0.3 (01/10): chequeos de CONTENIDO por sección. Evidencia: con el esqueleto
// v0.4 (título por feature), todo text_visible pasa también en el esqueleto
// vacío → no discrimina (R3/R4 quedaron SIN_EVIDENCIA). Y el traductor
// representaba "en carrusel" con click_reveals inventado (R1 FAIL falso).
// Los tres nuevos ubican la sección por id / título / aria-label y miden lo
// que hay ADENTRO, sin contar los títulos.

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const words = (arr) => (Array.isArray(arr) ? arr : [arr]).map(norm).filter((w) => w.length >= 2);
const matches = (text, syn) => { const n = norm(text); return words(syn).some((w) => n.includes(w)); };
const fieldText = (f) => `${f.name} ${f.id} ${f.placeholder} ${f.label}`;

// Definición del catálogo: tipo → { descripción para el traductor, params, run }.
// `params` es el esquema que valida el harness (string[] = lista de sinónimos).
export const CATALOG = {
  no_js_errors: {
    describe: "La página carga sin errores de JavaScript.",
    params: {},
  },
  text_visible: {
    describe: "Hay texto visible en la página que menciona algo concreto (una etiqueta, un mensaje, un dato). NO sirve para demostrar que una sección existe o tiene contenido (los títulos de sección ya vienen en la página).",
    params: { text: "string[]" },
  },
  control_visible: {
    describe: "Hay un botón, link, select o pestaña visible cuyo texto menciona algo. Usar para 'permitir hacer X' / 'botón para X'.",
    params: { text: "string[]" },
  },
  field_exists: {
    describe: "Hay un campo de formulario (input, select, textarea) cuyo label/nombre/placeholder menciona algo.",
    params: { field: "string[]" },
  },
  field_required: {
    describe: "Ese campo es obligatorio: si se deja vacío (y el resto está completo), el envío queda bloqueado.",
    params: { field: "string[]" },
  },
  field_optional: {
    describe: "Ese campo es opcional: si se deja vacío (y el resto está completo), el envío pasa.",
    params: { field: "string[]" },
  },
  submit_empty_blocked: {
    describe: "Enviar el formulario vacío queda bloqueado.",
    params: {},
  },
  valid_submit_passes: {
    describe: "Con todos los campos completos con datos válidos, el envío pasa.",
    params: {},
  },
  section_content: {
    describe: "La sección que se llama/titula X tiene contenido propio visible (al menos 8 palabras además de sus títulos). Usar para 'sección X con historia/descripción/información'.",
    params: { section: "string[]" },
  },
  section_items: {
    describe: "La sección X muestra una lista de varios elementos repetidos con texto (tarjetas, productos, ítems de menú; al menos 2). Usar para 'catálogo/lista/carta de productos', 'productos disponibles'.",
    params: { section: "string[]" },
  },
  carousel: {
    describe: "La sección X muestra sus elementos en un carrusel: hay controles (anterior/siguiente) o desplazamiento horizontal, y al usarlos los elementos se mueven. Usar para 'en carrusel/carrousel/slider'.",
    params: { section: "string[]" },
  },
  section_control: {
    describe: "La sección X tiene al menos un botón o link visible (ej. el botón de llamada a la acción de un hero). Usar para 'sección X con botón / CTA / llamada a la acción'.",
    params: { section: "string[]" },
  },
  no_horizontal_scroll: {
    describe: "La página no tiene scroll horizontal ni en celular (390 px) ni en escritorio (1280 px). Usar para 'responsive', 'escritorio y móvil', 'se adapta a celular'.",
    params: {},
  },
  hover_changes: {
    describe: "Al pasar el mouse por encima de botones y/o tarjetas cambia su estilo (color, sombra, tamaño, posición). En elementos van palabras como 'boton', 'tarjeta', 'enlace'. Usar para 'efectos hover'.",
    params: { elementos: "string[]" },
  },
  nav_scroll: {
    describe: "La barra de navegación queda fija arriba al bajar por la página y sus enlaces llevan a cada sección. Usar para 'navegación / menú fijo', 'scroll suave a cada sección'.",
    params: {},
  },
  reveal_on_scroll: {
    describe: "Hay contenido que aparece (estaba oculto o desplazado y se hace visible) al bajar con el scroll. Usar para 'animaciones al hacer scroll', 'elementos que aparecen'.",
    params: {},
  },
  entrance_animation: {
    describe: "La sección X tiene una animación o transición en los primeros segundos de carga. Usar para 'animación de entrada' de una sección (ej. el hero).",
    params: { section: "string[]" },
  },
  numbers_animate: {
    describe: "En la sección X hay números que cambian solos al verla (contadores animados). Usar para 'estadísticas / contadores animados'.",
    params: { section: "string[]" },
  },
  click_reveals: {
    describe: "Al hacer clic en un control cuyo texto menciona A, aparece visible texto que menciona B.",
    params: { click: "string[]", expect: "string[]" },
  },
};

/** Valida un chequeo contra el esquema del catálogo. Devuelve el chequeo limpio o null. */
export function normalizeCheck(c) {
  const def = CATALOG[c?.type];
  if (!def) return null;
  const params = {};
  for (const [k, t] of Object.entries(def.params)) {
    const v = c.params?.[k];
    const list = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map(String).map((s) => s.trim()).filter(Boolean);
    if (t === "string[]" && !words(list).length) return null;
    params[k] = list;
  }
  // feature (opcional, lo agrega el harness con anchorSections): id de requisito "Rn"
  if (c.params?.section && Array.isArray(c.params.feature) && /^R\d+$/.test(c.params.feature[0] || "")) params.feature = [c.params.feature[0]];
  return { type: c.type, params };
}


// ---- helpers de sección (corren en la página) ----
// Marca con data-vc-section la sección que matchea y con data-vc-item los
// elementos del grupo repetido más grande dentro de ella. Devuelve un resumen.
const MARK_SECTION = ([ws, feature]) => {
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const vis = (e) => !!(e.offsetParent !== null || e.getClientRects().length) && getComputedStyle(e).visibility !== "hidden";
  document.querySelectorAll("[data-vc-section],[data-vc-item]").forEach((e) => { e.removeAttribute("data-vc-section"); e.removeAttribute("data-vc-item"); });
  const hit = (t) => ws.some((w) => norm(t).includes(w));
  const cands = [...document.querySelectorAll("section, article, [role=region], main > div, [id]")].filter((e) => !["HTML", "BODY", "MAIN", "HEADER", "NAV", "FOOTER", "FORM", "INPUT", "BUTTON", "A", "TEXTAREA", "SELECT", "LABEL"].includes(e.tagName) && vis(e));
  const score = (e) => {
    const h = e.querySelector("h1, h2, h3, h4");
    if (hit(e.id) || hit(e.getAttribute("aria-label"))) return 3;
    if (h && hit(h.innerText)) return 2;
    return 0;
  };
  const scored = cands.map((e) => ({ e, s: score(e), sec: e.tagName === "SECTION" || e.tagName === "ARTICLE" ? 1 : 0 })).filter((x) => x.s > 0);
  scored.sort((a, b) => (b.sec - a.sec) || (b.s - a.s));
  // Anclaje por feature: si la página trae data-feature="Rn" (esqueleto v0.4), manda esa.
  // v0.5: data-feature puede listar varios ("R3 R5") y una feature puede estar en
  // varias secciones (R3 = Características, Testimonios…): entre las ancladas
  // gana la que matchea las palabras; si ninguna, la primera anclada.
  const anchoredAll = feature ? [...document.querySelectorAll(`[data-feature~="${feature}"]`)] : [];
  const anchored = anchoredAll.length <= 1 ? anchoredAll[0] || null
    : (scored.find((x) => anchoredAll.includes(x.e))?.e || anchoredAll.find((e) => score(e) > 0) || anchoredAll[0]);
  const sec = anchored || scored[0]?.e;
  if (!sec) return null;
  sec.setAttribute("data-vc-section", "1");
  const heads = [...sec.querySelectorAll("h1, h2, h3, h4")].filter((h) => !h.closest("[data-vc-item]"));
  // texto propio = texto visible de la sección menos el de sus títulos de nivel sección
  let text = sec.innerText || "";
  const secHeads = heads.filter((h) => !h.parentElement.closest("li, article, .card, [class*=card], [class*=item]"));
  for (const h of secHeads) text = text.replace(h.innerText, " ");
  const wordsN = text.split(/\s+/).filter((w) => /[a-záéíóúñ0-9]{2,}/i.test(w)).length;
  // grupo repetido más grande: hijos de un mismo padre con igual tag+clase y texto
  let best = [];
  for (const parent of [sec, ...sec.querySelectorAll("*")]) {
    const groups = {};
    for (const ch of parent.children) {
      if (!vis(ch) || ["SCRIPT", "STYLE", "BUTTON", "INPUT", "LABEL", "H1", "H2", "H3", "H4", "BR"].includes(ch.tagName)) continue;
      if ((ch.innerText || "").trim().length < 3) continue;
      const k = ch.tagName + "." + [...ch.classList].sort().join(".");
      (groups[k] = groups[k] || []).push(ch);
    }
    for (const g of Object.values(groups)) if (g.length > best.length && !g[0].matches(".form-group, [class*=form-group]") && !g[0].querySelector("input, textarea, select")) best = g;
  }
  best.forEach((e) => e.setAttribute("data-vc-item", "1"));
  return { id: (sec.id || sec.tagName.toLowerCase()) + (anchored ? ` [${feature}]` : ""), words: wordsN, items: best.length, sample: best.slice(0, 3).map((e) => e.innerText.trim().split("\n")[0].slice(0, 40)) };
};
const ITEM_LEFTS = () => [...document.querySelectorAll("[data-vc-item]")].map((e) => Math.round(e.getBoundingClientRect().left));
// v0.4: estilo comparable para hover
const STYLE_SNAP = (el) => { const c = getComputedStyle(el); return [c.color, c.backgroundColor, c.boxShadow, c.transform, c.borderColor, c.opacity, c.textDecorationLine, c.outlineStyle].join("|"); };
const HOVER_KINDS = [
  { re: /(bot|button|btn|cta)/, sel: "button, .btn, [class*=button], [class*=cta], input[type=submit], a[class*=btn]", label: "botón" },
  { re: /(tarjet|card)/, sel: "[class*=card], article", label: "tarjeta" },
  { re: /(enlace|link|vinculo)/, sel: "a[href]", label: "enlace" },
];
const NUMBERS_IN = (sel) => [...document.querySelectorAll(sel + " *")].filter((e) => !e.children.length && /\d/.test(e.textContent || "")).map((e) => (e.textContent || "").trim()).join(" | ");
const NAV_RE = /(anterior|siguiente|previo|prev|next|‹|›|←|→|«|»|^\s*<\s*$|^\s*>\s*$)/i;

async function visibleTexts(page, selector) {
  return page.$$eval(selector, (els) =>
    els.filter((e) => e.offsetParent !== null || e.getClientRects().length)
      .map((e) => [e.innerText, e.value, e.getAttribute("aria-label"), e.getAttribute("title")].filter(Boolean).join(" ")),
  );
}

/**
 * Ejecuta una lista de chequeos sobre un artefacto HTML.
 * @returns {Promise<Array<{type, params, result:"PASS"|"FAIL"|"NOT_APPLICABLE", detail:string}>>}
 */
export async function runChecks(htmlPath, checks) {
  const url = pathToFileURL(resolve(htmlPath)).href;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ctx = { dialogs: [], pageErrors: [] };
  page.on("pageerror", (e) => ctx.pageErrors.push(e.message));
  page.on("dialog", (d) => { ctx.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(INIT);
  await page.route(/^https?:/, (r) => r.abort());
  const reload = async () => { ctx.pageErrors.length = 0; await page.goto(url, { waitUntil: "load" }); await waitForSettle(page); };

  const out = [];
  try {
    for (const c of checks) {
      const r = { ...c, result: "FAIL", detail: "" };
      try {
        await reload();
        const fields = (await fieldsInfo(page)) || [];
        const findField = () => fields.filter((f) => matches(fieldText(f), c.params.field));
        switch (c.type) {
          case "no_js_errors":
            r.result = ctx.pageErrors.length ? "FAIL" : "PASS";
            r.detail = ctx.pageErrors.join(" | ").slice(0, 200) || "sin excepciones";
            break;
          case "text_visible": {
            const body = await page.evaluate(() => document.body.innerText);
            const hit = words(c.params.text).find((w) => norm(body).includes(w));
            r.result = hit ? "PASS" : "FAIL";
            r.detail = hit ? `visible: "${hit}"` : `no aparece: ${c.params.text.join(" / ")}`;
            break;
          }
          case "control_visible": {
            const texts = await visibleTexts(page, "button, a, select, [role=tab], [role=button], input[type=submit], input[type=button]");
            const hit = texts.find((t) => matches(t, c.params.text));
            r.result = hit ? "PASS" : "FAIL";
            r.detail = hit ? `control: "${hit.slice(0, 60)}"` : `ningún control menciona: ${c.params.text.join(" / ")}`;
            break;
          }
          case "field_exists": {
            const f = findField();
            r.result = f.length ? "PASS" : "FAIL";
            r.detail = f.length ? `campo: ${f.map((x) => x.name || x.id || x.label).join(", ")}` : `no hay campo: ${c.params.field.join(" / ")}`;
            break;
          }
          case "field_required":
          case "field_optional": {
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
          }
          case "submit_empty_blocked": {
            if (!fields.length) { r.detail = "no hay formulario"; break; }
            await fillForm(page, fields, { empty: fields.map((f) => f.index) });
            const s = await submitAndJudge(page, ctx);
            r.result = s.accepted ? "FAIL" : "PASS";
            r.detail = s.why;
            break;
          }
          case "valid_submit_passes": {
            if (!fields.length) { r.detail = "no hay formulario"; break; }
            await fillForm(page, fields);
            const s = await submitAndJudge(page, ctx);
            r.result = s.accepted ? "PASS" : "FAIL";
            r.detail = s.why;
            break;
          }
          case "section_content": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            // 20 → 8 (02/10): 20 era arbitrario y un hero real (título + subtítulo + botón) tiene
            // ~14 palabras fuera del título (Project22). Los controles siguen en 0 (esqueleto, sections_vacio).
            r.result = info.words >= 8 ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${info.words} palabras propias (mín. 8)`;
            break;
          }
          case "section_items": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            r.result = info.items >= 2 ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${info.items} ítems${info.items ? ` (${info.sample.join(" · ")})` : ""}`;
            break;
          }
          case "carousel": {
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
          }
          case "section_control": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            const ctl = await page.$$eval("[data-vc-section] :is(button, a[href], [role=button], input[type=submit], input[type=button])", (els) =>
              els.filter((e) => e.offsetParent !== null || e.getClientRects().length).map((e) => (e.innerText || e.value || e.getAttribute("aria-label") || "").trim()).filter(Boolean));
            r.result = ctl.length ? "PASS" : "FAIL";
            r.detail = ctl.length ? `#${info.id}: control "${ctl[0].slice(0, 40)}"` : `#${info.id}: sin botones ni links`;
            break;
          }
          case "no_horizontal_scroll": {
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
          }
          case "hover_changes": {
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
          }
          case "nav_scroll": {
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
          }
          case "reveal_on_scroll": {
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
          }
          case "entrance_animation": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            const n = await page.evaluate(() => (window.__entrance || []).filter((e) => e.closest("[data-vc-section]")).length);
            r.result = n ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${n ? `${n} elementos animados al cargar` : "nada se animó al cargar"}`;
            break;
          }
          case "numbers_animate": {
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
          }
          case "click_reveals": {
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
          }
          default:
            r.result = "NOT_APPLICABLE";
            r.detail = "tipo fuera del catálogo";
        }
      } catch (e) {
        r.result = "FAIL";
        r.detail = `error del chequeo: ${e.message.slice(0, 150)}`;
      }
      out.push(r);
    }
  } finally {
    await browser.close();
  }
  return out;
}
