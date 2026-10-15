// page_tools.mjs — herramientas GENERALES para mirar una página en Chromium (06/10, paso 2).
//
// Las usan el Specialist (harness/files_engine.mjs, mientras construye) y Validation (los
// Validation profiles, al final). Mismo código en los dos lados: "las pruebas que corre el motor
// tienen que ser el mismo código del Validation profile, sin duplicar". No nombran ningún
// dominio: qué mirar (contenedor, clases, textos, escenarios) lo declara el Standard.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

// ---------- render: sonda en Chromium ----------
/** Abre la página y devuelve window.__probe (lo arma la sonda que declara el Standard). */
export async function probePage(htmlPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const p = await page.evaluate(() => window.__probe || null);
    const looks = await page.evaluate(() => window.__looks || null);
    return { probe: p, looks, errors: errs };
  } finally { await browser.close(); }
}
// ---------- screen: variantes que se tienen que ver distintas ----------
// Se compara lo que una persona distingue: fondo, borde, sombra, contorno, símbolo, texto.
// (Corrección de Miche sobre b11: la caja y el jugador se veían por su borde y su brillo, y el
// juego se podía jugar; contar solo el relleno marcaba como problema algo que no lo era.)
/** Sonda: agrega al contenedor un elemento por variante (class="base variante") y mide cómo se ve. */
export function swatchProbe({ container, base, variants }) {
  return `window.__probe = (function () {
  try {
    var box = document.getElementById(${JSON.stringify(container)});
    if (!box) return { ok: false, error: "no existe #${container}" };
    var V = ${JSON.stringify(variants)}, out = {};
    var look = function (el) {
      var s = getComputedStyle(el), a = getComputedStyle(el, "::after"), b = getComputedStyle(el, "::before");
      return [s.backgroundColor, s.backgroundImage, s.borderTopColor, s.borderTopStyle, s.boxShadow, s.outlineStyle === "none" ? "" : s.outlineColor, a.content, a.backgroundColor, b.content, b.backgroundColor, (el.textContent || "").trim()].join("|");
    };
    var plain = document.createElement("div"); plain.className = ${JSON.stringify(base)}; box.appendChild(plain);
    out[""] = look(plain);
    V.forEach(function (v) { var d = document.createElement("div"); d.className = ${JSON.stringify(base)} + " " + v; box.appendChild(d); out[v] = look(d); });
    return { ok: true, looks: out };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
}
/**
 * v0.9.4 (Miche jugando b12): al ganar, el texto largo de #mensaje ensanchaba la pantalla, la
 * grilla (columnas 1fr) se estiraba al nuevo ancho y quedaban huecos entre celdas de ancho fijo;
 * volvía a la normalidad al borrar el mensaje. Sonda: arma una grilla de prueba como la armaría
 * el código de dibujo, mide, escribe un texto largo en el elemento que cambia y mide otra vez.
 */
export function stableProbe({ container, base, cell, cols, rows = 2, columns, changing, text }) {
  return `window.__probe = (function () {
  try {
    var box = document.getElementById(${JSON.stringify(container)}), msg = document.getElementById(${JSON.stringify(changing)});
    if (!box || !msg) return { ok: false, error: "falta #${container} o #${changing}" };
    box.style.gridTemplateColumns = ${JSON.stringify(columns)};
    for (var i = 0; i < ${cols * rows}; i++) { var d = document.createElement("div"); d.className = ${JSON.stringify(base + " " + cell)}; box.appendChild(d); }
    var m = function () { var c = box.children, a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect(), r = box.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), cell: Math.round(Math.min(a.width, a.height)), gap: Math.round(b.left - a.right) }; };
    var before = m(); msg.textContent = ${JSON.stringify(text)}; var after = m();
    return { ok: true, before: before, after: after };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
}
export function stableProblems(p, { container, changing }) {
  if (!p || !p.ok) return [];
  const { before: a, after: b } = p;
  const out = [];
  // v0.9.6 (Boxworld --skills): con width: max-content y celdas SIN tamaño, la grilla se encogió a 28 px
  // y el juego quedó minúsculo (injugable, lo vio Miche). Una celda de menos de 12 px no se ve.
  if (a.cell < 12) out.push(`en styles.css las celdas de #${container} miden ${a.cell}px de ancho: no se ven. Dales ancho y alto fijos (por ejemplo 40px) en la clase de la celda; #${container} con width: max-content toma el tamaño de sus celdas.`);
  if (Math.abs(a.w - b.w) > 2 || Math.abs(a.h - b.h) > 2 || b.gap > a.gap + 1)
    out.push(`en styles.css #${container} cambia de tamaño cuando #${changing} tiene un texto largo (ancho ${a.w}px → ${b.w}px${b.gap > a.gap + 1 ? `, aparecen huecos de ${b.gap}px entre celdas` : ""}): la grilla se estira al ancho de la pantalla. Dale a #${container} el tamaño de sus celdas (width: max-content, o columnas del mismo ancho fijo que las celdas) y que el texto largo baje de línea sin ensanchar la pantalla (max-width en #${changing}).`);
  return out;
}
/** Variantes que se ven iguales entre sí (o iguales a la base, salvo `sameAsBase`). Con pista si el CSS usa descendiente. */
export function swatchProblems({ probe: p, errors }, { base, variants, sameAsBase = [] }, css = "") {
  if (!p) return [`no se pudo probar cómo se ven las clases${errors.length ? `: ${errors[0]}` : ""}.`];
  if (!p.ok) return [`no se pudo probar cómo se ven las clases: ${p.error}.`];
  const L = p.looks, out = [];
  const flat = variants.filter((v) => !sameAsBase.includes(v) && L[v] === L[""]);
  if (flat.length) out.push(`en styles.css un elemento class="${base} ${flat[0]}" se ve igual que uno class="${base}" (sin variante): ${flat.map((v) => "." + v).join(", ")} no ${flat.length === 1 ? "cambia" : "cambian"} nada.`);
  const groups = {};
  for (const v of variants) (groups[L[v]] ||= []).push(v);
  const same = Object.values(groups).filter((g) => g.length > 1);
  if (same.length) out.push(`en styles.css se ven iguales: ${same.map((g) => g.map((v) => "." + v).join(" = ")).join("; ")}. Cada una necesita su propio color o símbolo.`);
  const desc = [...String(css).matchAll(new RegExp(`\\.${base}\\s+\\.(${variants.join("|")})\\b`, "g"))].map((m) => m[0]);
  if (out.length && desc.length) out.push(`las clases van en el MISMO elemento (class="${base} ${variants[0]}"), así que el selector es .${base}.${variants[0]} (sin espacio). Con espacio (${[...new Set(desc)].slice(0, 3).join(", ")}) busca un elemento ADENTRO de .${base} y no se aplica.`);
  return out;
}

// ---------- render: cómo se ve lo que quedó en pantalla (v0.9.2, Boxworld b11) ----------
// b11: styles.css estaba bien (pasó swatches) pero el código de dibujo pintaba cada celda con
// style.backgroundColor y tapaba los colores de caja y jugador: otra vez 5 PASS con el juego
// invisible. Ahora se mira lo dibujado, no solo el CSS.
export function drawnLooksProbe({ container, base, variants }) {
  return `window.__looks = (function () {
  try {
    var box = document.getElementById(${JSON.stringify(container)}); if (!box) return null;
    var V = ${JSON.stringify(variants)}, out = {};
    var look = function (el) { var s = getComputedStyle(el), a = getComputedStyle(el, "::after"), b = getComputedStyle(el, "::before");
      return [s.backgroundColor, s.backgroundImage, s.borderTopColor, s.borderTopStyle, s.boxShadow, s.outlineStyle === "none" ? "" : s.outlineColor, a.content, a.backgroundColor, b.content, b.backgroundColor, (el.textContent || "").trim()].join("|"); };
    var cells = Array.prototype.slice.call(box.querySelectorAll(${JSON.stringify("." + base)}));
    if (cells[0]) { var rc = cells[0].getBoundingClientRect(); out.__size = Math.round(Math.min(rc.width, rc.height)); }
    V.forEach(function (v) {
      var withV = cells.filter(function (c) { return c.classList.contains(v); });
      withV.sort(function (x, y) { return x.classList.length - y.classList.length; });
      if (withV[0]) out[v] = look(withV[0]);
    });
    return out;
  } catch (err) { return null; }
})();`;
}
export function drawnLooksProblems(looks, { base, variants }, code = "", who = "el código") {
  if (!looks) return [];
  // v0.9.6: celdas de menos de 12 px no se ven (Boxworld --skills: tablero de 28 px)
  if (looks.__size != null && looks.__size < 12) return [`las celdas .${base} miden ${looks.__size}px: el tablero es tan chico que no se ve. Dales ancho y alto fijos (por ejemplo 40px).`];
  const present = variants.filter((v) => looks[v] != null);
  const groups = {};
  for (const v of present) (groups[looks[v]] ||= []).push(v);
  const same = Object.values(groups).filter((g) => g.length > 1);
  if (!same.length) return [];
  const out = [`en lo que quedó dibujado en pantalla se ven iguales: ${same.map((g) => g.map((v) => "." + v).join(" = ")).join("; ")} (mismo color de fondo y sin símbolo).`];
  const inline = [...new Set([...String(code).matchAll(/\.style\.(background(?:Color)?|color|border(?:Color)?)\s*=/g)].map((m) => m[1]))];
  if (inline.length) out.push(`${who} pone colores con style.${inline.join(", style.")}: eso le gana a styles.css y tapa las clases. Sacalo: solo poné las clases (class="${base} ${variants[0]}", etc.) y que styles.css pinte.`);
  return out;
}

// ---------- wiring: escenarios (v0.9.3) ----------
// Lo prueba Miche jugando b11: al ganar un nivel el avatar quedaba bloqueado para siempre
// (controles.js sacaba el listener de teclado y nadie lo volvía a poner). Ningún chequeo jugaba
// más allá del primer nivel. Un escenario es una partida corta con datos de prueba que declara
// el Standard (p.ej. niveles chicos que se ganan con una tecla): teclas, clics y qué tiene que cambiar.
const normTxt = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export async function runScenario(htmlPath, sc) {
  const browser = await chromium.launch();
  const out = [];
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const snaps = {};
    const look = (id) => page.evaluate((x) => { const e = document.getElementById(x); return e ? e.innerHTML + "|" + e.className : null; }, id);
    for (const stp of sc.steps) {
      if (stp.key) { await page.keyboard.press(stp.key); await page.waitForTimeout(80); }
      else if (stp.click) {
        const btns = page.locator("button, a, [role=button], input[type=button]").filter({ visible: true });
        const n = await btns.count(); let hit = null;
        for (let i = 0; i < n && !hit; i++) { const t = normTxt(await btns.nth(i).innerText().catch(() => "")); if (stp.click.some((w) => t.includes(normTxt(w)))) hit = btns.nth(i); }
        if (!hit) { out.push(`${sc.name}: no hay un botón visible que diga ${stp.click.join(" / ")}.`); break; }
        if (await hit.isDisabled().catch(() => false)) { out.push(`${sc.name}: el botón ${stp.click[0]} está deshabilitado en ese momento.`); break; }
        await hit.click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(100);
      } else if (stp.snap) snaps[stp.snap] = await look(stp.snap);
      else if (stp.changed) { if ((await look(stp.changed)) === snaps[stp.changed]) { out.push(`${sc.name}: ${stp.problem}`); break; } }
      else if (stp.text) { const t = normTxt(await page.evaluate((x) => (document.getElementById(x) || {}).textContent || "", stp.text)); if (!stp.any.some((w) => t.includes(normTxt(w)))) { out.push(`${sc.name}: ${stp.problem}`); break; } }
    }
    if (errs.length) out.push(`${sc.name}: error de JS durante la partida: ${errs[0]}`);
  } finally { await browser.close(); }
  return out;
}


/**
 * La misma medida que stableProbe, pero sobre la página REAL (la grilla ya la dibujó el código):
 * mide el contenedor y el hueco entre sus dos primeras celdas, escribe un texto largo en el
 * elemento que cambia y mide otra vez. La usa Validation (paso 2).
 */
export function stableRealProbe({ container, changing, text }) {
  return `window.__probe = (function () {
  try {
    var box = document.getElementById(${JSON.stringify(container)}), msg = document.getElementById(${JSON.stringify(changing)});
    if (!box || !msg || box.children.length < 2) return { ok: false, error: "falta #${container} con celdas o #${changing}" };
    var m = function () { var c = box.children, a = c[0].getBoundingClientRect(), b = c[1].getBoundingClientRect(), r = box.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), cell: Math.round(Math.min(a.width, a.height)), gap: Math.round(b.left - a.right) }; };
    var before = m(); msg.textContent = ${JSON.stringify(text)}; var after = m();
    return { ok: true, before: before, after: after };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
}

// ---------- wiring: llamadas (12/10, Standard web/app/estado) ----------
// Kanban v1 (03/10): "+ Añadir Columna" no hacía nada y nadie lo vio hasta usarlo. Sonda general: envuelve
// los métodos de un objeto global (los que declara el Standard) y la función que dibuja, y usa la
// pantalla como una persona: completa los campos de texto vacíos y aprieta cada control (uno por
// recarga, y los que aparecen después de ese clic, p.ej. "Guardar"). Devuelve qué métodos se llamaron,
// cuáles no fueron seguidos por un dibujo y si algún clic recargó la página (formulario sin preventDefault).
const CTRL_SEL = "button, [role=button], input[type=button], input[type=submit], [data-accion]";
const IN_PAGE = `(function () {
  var vis = function (el) { var r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  var sig = function (el) { var a = el.getAttribute("data-accion"); return a ? "accion:" + a : (el.tagName + ":" + String(el.value && el.tagName === "INPUT" ? el.value : el.textContent || el.getAttribute("aria-label") || el.title || "").replace(/\\s+/g, " ").trim().toLowerCase().slice(0, 40)); };
  var list = function () { return Array.prototype.filter.call(document.querySelectorAll(${JSON.stringify(CTRL_SEL)}), vis); };
  return { vis: vis, sig: sig, list: list };
})()`;
// v0.2.3 (12/10, Validation lee la sonda): además de QUÉ métodos se llaman, guarda CON QUÉ argumentos
// (args[m]: hasta 8 llamadas, cada una la lista de argumentos resumidos: textos, números, "__undefined__",
// "__NaN__", "__object__"…) y desde qué control (via[m]). Kanban 4ª corrida: agregarEtiqueta se llamaba
// con labelId undefined, la pantalla "cambiaba" (dibujaba una etiqueta vacía) y Validation daba PASS.
export async function runCallsProbe(htmlPath, { global, methods, draw, fill = "Prueba", max = 25 }) {
  const browser = await chromium.launch();
  const out = { calls: {}, undrawn: {}, args: {}, effects: {}, via: {}, clicked: [], errors: [], reloads: [], tracked: false, found: false, controls: 0 };
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => out.errors.push(e.message));
    page.on("dialog", (d) => (d.type() === "prompt" ? d.accept(fill) : d.accept()).catch(() => {}));
    await page.route(/^https?:/, (r) => r.abort());
    const url = pathToFileURL(htmlPath).href;
    let navs = 0;
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) navs++; });
    const load = async () => {
      await page.goto(url, { waitUntil: "load" }); navs = 0;
      return page.evaluate(({ global, methods, draw }) => {
        window.__seq = []; window.__args = [];
        var G; try { G = (0, eval)(global); } catch (e) { G = undefined; }
        if (!G) return { found: false, tracked: false };
        var brief = function (v) {
          if (v === undefined) return "__undefined__";
          if (typeof v === "number") return isNaN(v) ? "__NaN__" : v;
          if (typeof v === "string") return v.slice(0, 60);
          if (v === null || typeof v === "boolean") return v;
          return Array.isArray(v) ? "__array__" : "__" + typeof v + "__";
        };
        // v0.2.4 (15/10, p48): además, si la llamada devolvió un estado DISTINTO del que recibió (entry[2]: true/false;
        // null si no se pudo comparar). Réplica 12-31-25: el botón mandaba un id de otra clase, la acción devolvía el
        // mismo estado y la compuerta decía "datos de verdad".
        methods.forEach(function (m) { var f = G[m]; if (typeof f !== "function") return; G[m] = function () {
          window.__seq.push(m);
          var entry = null, before = null;
          try { entry = [m, Array.prototype.map.call(arguments, brief)]; window.__args.push(entry); } catch (e) {}
          try { before = JSON.stringify(arguments[0]); } catch (e) {}
          var r = f.apply(this, arguments);
          if (entry) { var ch = null; try { ch = before !== null && typeof r === "object" && r !== null ? JSON.stringify(r) !== before : null; } catch (e) {} entry.push(ch); }
          return r; }; });
        var tracked = false;
        try { var d = (0, eval)(draw); if (typeof d === "function") { var w = function () { window.__seq.push("#draw"); return d.apply(this, arguments); }; window[draw] = w; tracked = (0, eval)(draw) === w; } } catch (e) {}
        return { found: true, tracked: tracked };
      }, { global, methods, draw });
    };
    const sigs = () => page.evaluate((src) => { var T = (0, eval)(src); var s = []; T.list().forEach(function (el) { var k = T.sig(el); if (s.indexOf(k) < 0) s.push(k); }); return s; }, IN_PAGE);
    const fillAll = (v) => page.evaluate((v) => {
      Array.prototype.forEach.call(document.querySelectorAll("input, textarea"), function (el) {
        var t = (el.getAttribute("type") || "text").toLowerCase();
        // v0.2.4 (15/10, p48): un campo de texto ya completo (editar arranca con el valor actual) también se cambia,
        // como haría una persona que edita; si no, "editar" guarda lo mismo y parece que no hace nada.
        // Números, fechas y mails con valor se dejan (pueden ser lo que la acción necesita).
        if (["button", "submit", "checkbox", "radio", "hidden", "color", "range", "file"].indexOf(t) >= 0 || !el.getClientRects().length) return;
        if (el.value && (t === "number" || t === "date" || t === "email" || el.value === v)) return;
        el.value = t === "number" ? "1" : t === "date" ? "2026-01-01" : t === "email" ? "prueba@ejemplo.com" : (el.value ? el.value + " " + v : v);
        el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }, v);
    const click = async (k) => {
      const hit = await page.evaluate(({ src, k }) => { var T = (0, eval)(src); Array.prototype.forEach.call(document.querySelectorAll("[data-probe-hit]"), function (e) { e.removeAttribute("data-probe-hit"); });
        var el = T.list().find(function (e) { return T.sig(e) === k; }); if (!el) return false; el.setAttribute("data-probe-hit", "1"); return true; }, { src: IN_PAGE, k });
      if (!hit) return false;
      const before = navs;
      await page.click("[data-probe-hit]", { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(120);
      if (navs > before) out.reloads.push(k);
      return true;
    };
    const takeArgs = async (k) => {
      const list = await page.evaluate(() => (window.__args || []).splice(0)).catch(() => []);
      for (const [m, a, ch] of list) {
        (out.args[m] ||= []).length < 8 && out.args[m].push(a);
        (out.effects[m] ||= []).push(ch === undefined ? null : ch);
        if (!out.via[m]) out.via[m] = k;
      }
    };
    const account = (seq) => {
      seq.forEach((m, i) => {
        if (m === "#draw") return;
        out.calls[m] = (out.calls[m] || 0) + 1;
        if (!seq.slice(i + 1).includes("#draw")) out.undrawn[m] = (out.undrawn[m] || 0) + 1;
      });
    };
    const st = await load();
    out.found = st.found; out.tracked = st.tracked;
    if (!st.found) return out;
    const first = await sigs();
    out.controls = first.length;
    const done = new Set();
    for (const k of first) {
      if (done.has(k) || done.size >= max) continue;
      done.add(k);
      await load(); await fillAll(fill);
      // el clic y lo que aparece después (un solo nivel: "Guardar", "Confirmar")
      const seq = [];
      if (await click(k)) {
        out.clicked.push(k);
        if (!out.reloads.includes(k)) {
          seq.push(...await page.evaluate(() => window.__seq.splice(0)));
          await takeArgs(k);
          for (const n of await sigs()) {
            if (first.includes(n) || done.has(n) || done.size >= max) continue;
            done.add(n); await fillAll(fill + " 2");
            if (await click(n)) { out.clicked.push(n); if (out.reloads.includes(n)) break; seq.push(...await page.evaluate(() => window.__seq.splice(0))); await takeArgs(n); }
          }
        }
      }
      account(seq);
    }
  } finally { await browser.close(); }
  return out;
}
