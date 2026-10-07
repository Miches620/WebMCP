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
      return { w: Math.round(r.width), h: Math.round(r.height), cell: Math.round(a.width), gap: Math.round(b.left - a.right) }; };
    var before = m(); msg.textContent = ${JSON.stringify(text)}; var after = m();
    return { ok: true, before: before, after: after };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
}
export function stableProblems(p, { container, changing }) {
  if (!p || !p.ok) return [];
  const { before: a, after: b } = p;
  const out = [];
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
      return { w: Math.round(r.width), h: Math.round(r.height), cell: Math.round(a.width), gap: Math.round(b.left - a.right) }; };
    var before = m(); msg.textContent = ${JSON.stringify(text)}; var after = m();
    return { ok: true, before: before, after: after };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
}
