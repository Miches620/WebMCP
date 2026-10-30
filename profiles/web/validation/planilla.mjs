// planilla.mjs — PLANILLA de comportamientos v0.1 (16/10 noche, paso 1 del orden acordado con Miche).
//
// Por qué: cada requisito llega como texto libre y el traductor adivina el chequeo (R3 "prioridad desde una lista" →
// counter_on_action; R16 "orden por prioridad" → contador + scroll + hover = PASS falso). La planilla dice, por
// requisito, QUÉ tiene que pasar, con palabras de una persona y un vocabulario CERRADO que Validation ejecuta sin
// interpretar. No nombra clases, ids ni funciones (estricto en el QUÉ, flexible en el CÓMO).
//
// Una fila (los nombres "tarjeta" / "columna" de abajo son los del Kanban: en el código son item / grupo, ver glosario.mjs):
//   { id: "R7.1", r: "R7", dado: [{ agregar: "QA Alfa", campos: { prioridad: "alta" } }],
//     hago: { eliminar: "QA Alfa" }, veo: [{ no_esta: "QA Alfa" }, { contador: "Pendiente", cambia: -1 }] }
// dado   tarjetas que se crean ANTES, con la app misma (como una persona). Si no se pueden crear → FAIL (tampoco podría ella).
// hago   UNA acción: agregar {agregar, campos?} · editar {editar: texto, a?: texto nuevo, campos?} · eliminar ·
//        mover {mover, a: contenedor} · recargar: true · pasar_mouse: texto.
// veo    lista; todas tienen que cumplirse:
//        esta: texto [en: contenedor] · no_esta: texto · en_item: texto, contiene: [textos] ·
//        orden: [textos], en: contenedor (de arriba abajo) · contador: contenedor, cambia: ±n | vale: n ·
//        control: [palabras], solo_en: contenedor · al_pasar: [textos], en_item: texto (ocultos antes, visibles después) ·
//        estilo: { de: "pagina" | {grupo} | {item} | {control: [palabras]}, prop, valor } (o con los nombres del glosario) ·
//        color_en_item: texto, familia: rojo | amarillo | verde.
// Estilo (decisión 16/10): colores exactos; medidas en px con ±2; palabras (dashed, scroll) de una lista; {distinto: "none"}.
// La planilla se escribe por proyecto; las palabras de los controles ("agregar tarjeta", "editar", …) van en planilla.controles.

import { SEEN, settle, errsSince, freshStart, verbControl, bestControlIn, useControl } from "./flows.mjs";
// 17/10 (diseño de 3 capas): el juez conoce TIPOS (item, grupo, control, pagina); los nombres de la app vienen del glosario
import { itemClassRe, palabra, filaATipos } from "./glosario.mjs";
import { MEDIR_VISUAL, REGLAS_VISUALES, MEDIR_MODERNO, REGLAS_MODERNAS } from "./visual.mjs";

export const PLANILLA_VERSION = "planilla v0.2"; // v0.2 (29/10): acciones de persona en una grilla (escribir, clic, usar; muestra, fondo, oculta, encabezados)
const DEFAULT_CONTROLS = { agregar: ["agregar", "añadir", "nueva", "nuevo", "crear"], editar: ["editar", "modificar"], eliminar: ["eliminar", "borrar"], mover: ["mover"] };

// ---------- en la página ----------
/** El elemento (tarjeta) que contiene el texto: la raíz de los que parecen ítems. Lo marca con data-plan-item. */
const ITEM_OF = ([text, src]) => {
  const re = new RegExp(src, "i");
  const vis = (e) => !!e.getClientRects().length;
  const letters = (e) => ((e.innerText || "").match(/[a-záéíóúñ]/gi) || []).length;
  document.querySelectorAll("[data-plan-item]").forEach((e) => e.removeAttribute("data-plan-item"));
  const isItem = (e) => e.tagName === "LI" || [...e.classList].some((k) => re.test(k)) || (e.getAttribute("draggable") === "true" && letters(e) >= 3);
  const all = [...document.querySelectorAll("body *")].filter((e) => !e.closest("button, select, input, textarea, label, script, style") && isItem(e) && vis(e) && (e.innerText || "").includes(text));
  const roots = all.filter((e) => !all.some((o) => o !== e && o.contains(e)));
  if (!roots.length) return false;
  roots[0].setAttribute("data-plan-item", "1");
  return true;
};
/** El contenedor (columna) cuyo título dice name: el ancestro del título cuyo padre tiene ≥2 hijos con título. Marca data-plan-col. */
const COL_NAMED = ([name, src, mark]) => {
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
  const re = new RegExp(src, "i");
  const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (x.tagName === "LI" || [...x.classList].some((k) => re.test(k))) return true; return false; };
  const HS = "h1, h2, h3, h4, h5, h6, [class*=title], [class*=titulo], [class*=header]";
  const titled = (a) => [...a.querySelectorAll(HS)].find((h) => !inItem(h) && (h.textContent || "").trim());
  document.querySelectorAll(`[${mark}]`).forEach((e) => e.removeAttribute(mark));
  const heads = [...document.querySelectorAll(HS)].filter((h) => !inItem(h) && h.getClientRects().length && nrm(h.textContent.split("\n")[0]).replace(/[^a-z ]/g, "").trim().startsWith(nrm(name)));
  for (const h of heads) for (let a = h.parentElement; a && a !== document.body; a = a.parentElement) {
    const p = a.parentElement;
    if (!p) break;
    const sibs = [...p.children].filter((x) => x !== a && x.tagName === a.tagName && titled(x));
    if (sibs.length && titled(a)) {
      a.setAttribute(mark, "1");
      // contador: el primer número de lo que NO es tarjeta ni botón (p.ej. "Pendiente (2)" o un <span>2</span>)
      let count = null;
      const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const el = n.parentElement;
        if (!el || inItem(el) || el.closest("button, select, option, input, textarea") || !el.getClientRects().length) continue;
        const m = n.nodeValue.match(/\d+/);
        if (m) { count = Number(m[0]); break; }
      }
      return { name: (titled(a).textContent || "").trim().split("\n")[0].trim().slice(0, 40), count };
    }
  }
  return null;
};
/** Posición vertical de cada texto dentro del contenedor marcado (null si no está adentro). */
const TOPS = (texts) => {
  const col = document.querySelector("[data-plan-col]");
  return texts.map((t) => {
    if (!col) return null;
    const w = document.createTreeWalker(col, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.includes(t) && n.parentElement?.getClientRects().length) return n.parentElement.getBoundingClientRect().top;
    return null;
  });
};
/** ¿Se ve cada texto adentro de la tarjeta marcada? (visible = con tamaño, no hidden, opacidad > 0.05 en la cadena) */
const VISIBLE_IN_ITEM = (texts) => {
  const it = document.querySelector("[data-plan-item]");
  const shown = (e) => { if (!e.getClientRects().length) return false; for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.visibility === "hidden" || Number(s.opacity) < 0.05) return false; } return true; };
  return texts.map((t) => {
    if (!it) return false;
    const nodes = [...it.querySelectorAll("*")].filter((e) => (e.innerText || e.textContent || "").includes(t) || (e.getAttribute("title") || "").includes(t) || (e.getAttribute("aria-label") || "").includes(t));
    return nodes.some(shown);
  });
};
/** Estilos de los candidatos: el elemento y sus hijos directos (sin botones ni campos). */
const STYLES_OF = ([sel, prop, pagina]) => {
  let els = [];
  if (pagina) {
    // el fondo que ve una persona: lo primero no transparente en una esquina de la ventana
    const stack = document.elementsFromPoint(4, Math.max(4, innerHeight - 4));
    const bg = stack.find((e) => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(e).backgroundColor));
    els = bg ? [bg] : [document.body];
  } else {
    const root = document.querySelector(sel);
    if (!root) return [];
    els = [root, ...[...root.children].filter((c) => !c.matches("button, input, select, textarea"))];
  }
  // medidas: el valor CSS calculado (como lo escribe Miche: "width: 248px"), no lo que ocupa con padding y borde;
  // y solo del elemento mismo (no de un hijo que justo mida eso)
  // 19/10: overflow también solo del elemento mismo. Antes un hijo con overflow:auto lo aprobaba, y en la app del ciclo
  // (16/16) la columna crecía sin límite y scrolleaba la PÁGINA (Miche lo vio). Lo que Miche quiere de verdad lo prueba
  // "desborde" (veo): con muchos ítems, scrollea el grupo y no la página.
  if (prop === "width" || prop === "height" || /^overflow/.test(prop)) els = els.slice(0, 1);
  return els.map((e) => getComputedStyle(e).getPropertyValue(prop));
};
/** Colores (fondo, letra, borde) de los elementos de la tarjeta marcada que contienen el texto (o de la tarjeta). */
const COLORS_IN_ITEM = (text) => {
  const it = document.querySelector("[data-plan-item]");
  if (!it) return [];
  const els = [it, ...it.querySelectorAll("*")].filter((e) => !text || (e.textContent || "").toLowerCase().includes(text.toLowerCase()));
  return els.flatMap((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.color, s.borderLeftColor, s.borderTopColor]; });
};

// ---------- comparar ----------
const rgb = (v) => {
  const h = String(v).trim().match(/^#?([0-9a-f]{6})$/i);
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  const m = String(v).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => Number(x.trim()));
  return p.length === 4 && p[3] === 0 ? null : p.slice(0, 3);
};
export function styleMatches(got, want) {
  if (want && typeof want === "object" && !Array.isArray(want) && "distinto" in want) return !!got && got.trim() !== "" && !String(got).trim().startsWith(want.distinto);
  const ws = Array.isArray(want) ? want : [want];
  return ws.some((w) => {
    const wc = rgb(w), gc = rgb(got);
    if (/^#/.test(String(w))) return !!(wc && gc && wc.every((x, i) => Math.abs(x - gc[i]) <= 1)); // color exacto (±1 por redondeo)
    const px = String(w).match(/^(-?\d+(?:\.\d+)?)px$/);
    if (px) return String(got).split(/\s+/).every((g) => Math.abs(parseFloat(g) - Number(px[1])) <= 2); // ±2px (padding "8px 8px")
    return String(got).trim().toLowerCase() === String(w).toLowerCase();
  });
}
export function colorFamily(v) {
  const c = rgb(v);
  if (!c) return null;
  const [r, g, b] = c;
  if (r >= 150 && g < 120 && b < 120) return "rojo";
  if (r >= 170 && g >= 140 && b < 130 && Math.abs(r - g) < 90) return "amarillo";
  if (g >= 110 && r < 150 && b < 150 && g > r + 20 && g > b + 10) return "verde";
  return null;
}

// ---------- lugares (29/10): acciones de PERSONA en una grilla ----------
// 2º proyecto (hoja de cálculo): el vocabulario de arriba es el de las apps de "crear cosas" (agregar, editar, borrar,
// mover un ítem). Una tabla necesita lo que hace una persona frente a cualquier pantalla: escribir en un lugar, hacer
// clic en algo, usar un control por lo que hace (borrar, ocultar, vaciar, color) y mirar qué muestra un lugar.
// Un lugar se nombra como lo lee una persona: por el encabezado de su columna y el de su fila ("A1"), o solo "C" / "3".
// Se encuentra por los encabezados que se VEN (no por clases ni ids): la columna "C" es lo de más arriba que dice "C";
// la fila "3", lo de más a la izquierda que dice "3"; la celda está donde se cruzan.
export function nombreLugar(x) {
  const t = String(x ?? "").trim();
  let m;
  if ((m = /^([A-Za-z]{1,3})(\d{1,4})$/.exec(t))) return { col: m[1].toUpperCase(), fila: m[2] };
  if (/^[A-Za-z]{1,3}$/.test(t)) return { col: t.toUpperCase() };
  if (/^\d{1,4}$/.test(t)) return { fila: t };
  return null;
}
const LUGAR = ([L]) => {
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
  const propio = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
  const cands = (t) => [...document.querySelectorAll("body *")].filter((e) => !e.closest("script, style, option, textarea, select") && e.tagName !== "INPUT" && vis(e) && propio(e).toLowerCase() === String(t).toLowerCase());
  const quien = (el) => `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}${el.classList.length ? ` class="${[...el.classList].slice(0, 2).join(" ")}"` : ""}>`;
  let col = null, fila = null;
  if (L.fila) {
    const cs = cands(L.fila).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (!cs.length) return { falta: `no se ve la fila "${L.fila}" (nada a la izquierda dice "${L.fila}")` };
    fila = cs[0]; fila.scrollIntoView({ block: "center", inline: "nearest" });
  }
  if (L.col) {
    const cs = cands(L.col).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (!cs.length) return { falta: `no se ve la columna "${L.col}" (nada arriba dice "${L.col}")` };
    col = cs[0]; col.scrollIntoView({ block: "nearest", inline: "center" });
  }
  const rc = col?.getBoundingClientRect(), rf = fila?.getBoundingClientRect();
  if (col && fila) {
    // 30/10 (1ª corrida de Gemma con la hoja, 3/17 en 40 vueltas): las letras estaban apiladas a la izquierda y el cruce
    // caía en la esquina; el aviso solo decía "A1 muestra '' (es <div class="corner-cell">)" y Gemma no veía por qué.
    // Ahora se dice dónde está cada encabezado y dónde tendría que estar (como lo ve una persona: letras arriba, números a la izquierda).
    const px = (r) => `x ${Math.round(r.left)}–${Math.round(r.right)}, y ${Math.round(r.top)}–${Math.round(r.bottom)}`;
    const arriba = rc.bottom <= rf.top + 2, izquierda = rf.right <= rc.left + 2;
    const mal = [...(arriba ? [] : [`la letra "${L.col}" (${quien(col)}, ${px(rc)}) no está ARRIBA de la fila "${L.fila}"`]), ...(izquierda ? [] : [`el número "${L.fila}" (${quien(fila)}, ${px(rf)}) no está a la IZQUIERDA de la columna "${L.col}"`])];
    if (mal.length) return { falta: `no hay celda ${L.col}${L.fila}: ${mal.join(" y ")}. Las letras van en una fila arriba de la grilla, una al lado de la otra y cada una encima de su columna de celdas; los números, a la izquierda, cada uno al lado de su fila` };
    const x = rc.left + rc.width / 2, y = rf.top + rf.height / 2;
    const el = document.elementFromPoint(x, y);
    if (!el) return { falta: `no hay nada donde se cruzan la columna "${L.col}" y la fila "${L.fila}" (x ${Math.round(x)}, y ${Math.round(y)}: ¿fuera de la ventana?)` };
    if (el === col || el === fila || el.contains(col) || el.contains(fila) || col.contains(el) || fila.contains(el)) return { falta: `donde se cruzan la letra "${L.col}" y el número "${L.fila}" no hay una celda sino ${quien(el)}: cada letra tiene que quedar justo encima de su columna de celdas y cada número al lado de su fila` };
    return { x, y, quien: quien(el) };
  }
  const h = col || fila, r = h.getBoundingClientRect();
  // dx/dy: en la PÁGINA (no en la ventana): LUGAR scrollea, y comparar posiciones de ventana entre llamadas engaña
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, dx: r.left + r.width / 2 + scrollX, dy: r.top + r.height / 2 + scrollY, quien: quien(h), encabezado: true };
};
/** Lo que muestra un lugar, como lo lee una persona: sin campo en edición (se suelta el foco antes). */
const LEER_LUGAR = ([x, y]) => {
  const el = document.elementFromPoint(x, y);
  if (!el) return { texto: null };
  const t = el.matches("input, textarea") ? el.value : (el.innerText || el.textContent || "");
  let fondo = null;
  for (let z = el; z && z !== document.documentElement; z = z.parentElement) { const c = getComputedStyle(z).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { fondo = c; break; } }
  return { texto: String(t).trim(), fondo };
};
const mismoValor = (a, b) => {
  const n = (x) => { const t = String(x ?? "").trim().replace(/\s/g, ""); if (!/^-?[\d.,]+$/.test(t)) return null; const v = Number(t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t.replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
  const x = n(a), y = n(b);
  if (x != null && y != null) return Math.abs(x - y) < 1e-6;
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
};
// usar un control por lo que HACE (las palabras y los íconos de siempre, en castellano e inglés): ninguno es de una app
const VERBOS = {
  borrar: { si: /\b(borrar|eliminar|quitar|suprimir|delete|remove)\b|🗑|✕|✖/i, no: /contenido|limpiar|vaciar|clear|todo|mostrar/i },
  vaciar: { si: /\b(vaciar|limpiar|clear)\b|borrar (el )?contenido|🧹/i, no: /mostrar/i },
  ocultar: { si: /\b(ocultar|esconder|hide)\b|👁/i, no: /mostrar|show/i },
  color: { si: /\b(color|colorear|pintar|fondo)\b|🎨/i, no: /mostrar/i },
};
const BUSCAR_VERBO = ([si, no]) => {
  const reSi = new RegExp(si, "i"), reNo = no ? new RegExp(no, "i") : null;
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && Number(s.opacity) > 0.05; };
  document.querySelectorAll("[data-plan-usar]").forEach((e) => e.removeAttribute("data-plan-usar"));
  const els = [...document.querySelectorAll("button, [role=button], [role=menuitem], a, input[type=button], input[type=submit], label")].filter(vis);
  const t = (e) => nrm([e.innerText || "", e.value || "", e.getAttribute("title") || "", e.getAttribute("aria-label") || ""].join(" "));
  const b = els.find((e) => reSi.test(t(e)) && !(reNo && reNo.test(t(e))));
  if (!b) return null;
  b.setAttribute("data-plan-usar", "1");
  return { texto: (b.innerText || b.value || b.getAttribute("title") || b.getAttribute("aria-label") || "").trim().slice(0, 30), tag: b.tagName };
};
const PONER_COLOR = ([valor]) => {
  const ins = [...document.querySelectorAll("input[type=color]")];
  if (!ins.length) return false;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const inp = ins.find(vis) || ins[0];
  inp.value = valor;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  inp.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
};
const COLOR_DE_PRUEBA = "#ffcc00";
async function escribirEn(page, nombre, texto) {
  const L = nombreLugar(nombre);
  if (!L?.col || !L?.fila) return { fail: `"${nombre}" no es un lugar con columna y fila (p. ej. A1)` };
  const p = await page.evaluate(LUGAR, [L]);
  if (p.falta) return { fail: p.falta };
  const campo = () => page.evaluate(() => {
    document.querySelectorAll("[data-plan-campo]").forEach((e) => e.removeAttribute("data-plan-campo"));
    const a = document.activeElement;
    if (!a || !(a.matches("input:not([type=button]):not([type=submit]):not([type=color]):not([type=checkbox]), textarea") || a.isContentEditable)) return false;
    a.setAttribute("data-plan-campo", "1"); return true;
  });
  await page.mouse.click(p.x, p.y); await settle(page);
  let modo = "clic";
  if (!(await campo())) { await page.mouse.dblclick(p.x, p.y); await settle(page); modo = "doble clic"; }
  if (await campo()) await page.locator("[data-plan-campo]").first().fill(String(texto)).catch(() => {});
  else { modo += " y teclado"; await page.keyboard.type(String(texto)); }
  await page.keyboard.press("Enter"); await settle(page);
  await page.evaluate(() => document.activeElement?.blur?.()); await settle(page);
  return { why: `escribió "${texto}" en ${String(nombre).toUpperCase()} (${modo})` };
}
async function clicEn(page, nombre, ctx) {
  const L = nombreLugar(nombre);
  let p = L ? await page.evaluate(LUGAR, [L]) : null;
  if (!L) {
    // un texto cualquiera que se ve (no un lugar): lo más chico que lo dice
    p = await page.evaluate(([t]) => {
      const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && Number(s.opacity) > 0.05; };
      const e = [...document.querySelectorAll("body *")].filter((x) => vis(x) && (x.innerText || "").trim().toLowerCase() === String(t).trim().toLowerCase()).sort((a, b) => a.innerText.length - b.innerText.length)[0];
      if (!e) return { falta: `nada visible dice "${t}"` };
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, [nombre]);
  }
  if (p.falta) return { fail: p.falta };
  await page.mouse.click(p.x, p.y); await settle(page);
  ctx.seleccion = { x: p.x, y: p.y, nombre };
  return { why: `hizo clic en ${L ? (L.col && L.fila ? String(nombre).toUpperCase() : L.col ? `la columna "${L.col}"` : `la fila "${L.fila}"`) : `"${nombre}"`}` };
}
async function usarVerbo(page, verbo, valor, ctx) {
  const v = VERBOS[verbo];
  if (!v) return { fail: `no sé usar "${verbo}" (sé: ${Object.keys(VERBOS).join(", ")})` };
  const buscar = () => page.evaluate(BUSCAR_VERBO, [v.si.source, v.no?.source || null]);
  let b = await buscar(), donde = "";
  if (!b && verbo === "color" && (await page.evaluate(() => [...document.querySelectorAll("input[type=color]")].some((e) => e.getBoundingClientRect().width > 0)))) b = { texto: "selector de color", directo: true };
  if (!b && ctx.seleccion) { await page.mouse.click(ctx.seleccion.x, ctx.seleccion.y, { button: "right" }); await settle(page); b = await buscar(); donde = " (en el menú del botón derecho)"; }
  if (!b) {
    if (verbo === "vaciar" && ctx.seleccion) { await page.keyboard.press("Delete"); await settle(page); return { why: `vació con la tecla Supr (no hay un control que diga vaciar o limpiar)` }; }
    return { fail: `no hay un control para ${verbo} (ninguno dice ${v.si.source.replace(/\\b|\(|\)/g, "").split("|").slice(0, 4).join(", ")}…)${ctx.seleccion ? `, ni en el menú del botón derecho sobre ${ctx.seleccion.nombre}` : ""}` };
  }
  if (verbo === "color") {
    const color = valor || COLOR_DE_PRUEBA;
    if (!b.directo && b.tag !== "LABEL") { await page.locator("[data-plan-usar]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); }
    if (!(await page.evaluate(PONER_COLOR, [color]))) return { fail: `apretó "${b.texto}" pero no apareció dónde elegir el color` };
    await settle(page);
    return { why: `eligió el color ${color} con "${b.texto}"${donde}` };
  }
  await page.evaluate(() => document.querySelectorAll("button, [role=button]").forEach((x) => { if (x.getClientRects().length) x.setAttribute("data-plan-pre", "1"); else x.removeAttribute("data-plan-pre"); }));
  await page.locator("[data-plan-usar]").first().click({ timeout: 2000 }).catch(() => {});
  await settle(page);
  // si aparece un botón de confirmar (que no estaba antes), se confirma, como una persona
  const yes = await page.evaluate(() => {
    const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const b = [...document.querySelectorAll("button, [role=button]")].filter((x) => x.getClientRects().length && !x.hasAttribute("data-plan-pre")).find((x) => /^(si|confirmar|eliminar|borrar|aceptar|ok|ocultar|vaciar)\b/.test(nrm(x.innerText).trim()));
    if (!b) return null; b.setAttribute("data-plan-yes", "1"); return b.innerText.trim().slice(0, 20);
  });
  if (yes) { await page.locator("[data-plan-yes]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); }
  return { why: `usó "${b.texto}" (${verbo})${donde}${yes ? ` y confirmó "${yes}"` : ""}` };
}

// ---------- acciones ----------
async function addCard(page, ctls, spec, w) {
  const text = typeof spec === "string" ? spec : spec.agregar;
  const ctl = await verbControl(page, ctls.agregar);
  if (!ctl) return { ok: false, why: `ningún control visible dice "${ctls.agregar[0]}"` };
  const steps = await useControl(page, ctl.loc, text, { campos: { titulo: text, ...(spec.campos || {}) } });
  const s = await page.evaluate(SEEN, [text, null]);
  return { ok: s.seen, why: s.seen ? `agregó "${text}"` : `agregar "${text}" (${steps.join(" · ")}): no aparece` };
}
async function itemControl(page, ctls, verb, text, w) {
  if (!(await page.evaluate(ITEM_OF, [text, w.src]))) return { why: `"${text}" no aparece como ${w.it}` };
  const item = page.locator("[data-plan-item]").first();
  await item.hover({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(80);
  const ctl = await bestControlIn(page, item, ctls[verb]);
  return ctl ? { item, ctl } : { item, why: `${w.it} "${text}" no tiene un control que diga "${ctls[verb][0]}"` };
}
async function act(page, ctls, h, ctx, w) {
  if (h.agregar) { const r = await addCard(page, ctls, h, w); return r.ok ? r.why : { fail: r.why }; }
  if (h.editar) {
    const x = await itemControl(page, ctls, "editar", h.editar, w);
    if (!x.ctl) return { fail: x.why };
    const steps = await useControl(page, x.ctl.loc, h.a || h.editar, { replace: true, keep: true, campos: { ...(h.a ? { titulo: h.a } : {}), ...(h.campos || {}) } });
    return `editó "${h.editar}" (${steps.join(" · ")})`;
  }
  if (h.eliminar) {
    const x = await itemControl(page, ctls, "eliminar", h.eliminar, w);
    if (!x.ctl) return { fail: x.why };
    // la confirmación tiene que ser un botón que APARECE después del clic (antes agarraba el "Borrar" de otra tarjeta)
    await page.evaluate(() => document.querySelectorAll("button, [role=button]").forEach((b) => { if (b.getClientRects().length) b.setAttribute("data-plan-pre", "1"); else b.removeAttribute("data-plan-pre"); }));
    const d0 = ctx.dialogs.length;
    await x.ctl.loc.click({ timeout: 2000 }).catch(() => {});
    await settle(page);
    // 19/10: lo que se ve justo después del clic, ANTES de confirmar (la pregunta de un modal o del navegador): "pregunta"
    ctx.trasClic = `${await page.evaluate(() => document.body.innerText).catch(() => "")}\n${ctx.dialogs.slice(d0).join("\n")}`;
    ctx.dialogoClic = ctx.dialogs[d0] || null;
    const gone = !(await page.evaluate(SEEN, [h.eliminar, null])).seen;
    const yes = gone ? null : await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (x.tagName === "LI" || [...x.classList].some((k) => re.test(k))) return true; return false; };
      const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const b = [...document.querySelectorAll("button, [role=button]")].filter((x) => x.getClientRects().length && !x.hasAttribute("data-plan-pre") && !inItem(x)).find((x) => /^(si|confirmar|eliminar|borrar|aceptar|ok)\b/.test(nrm(x.innerText).replace(/^[^a-z]+/, "")));
      if (!b) return null; b.setAttribute("data-plan-yes", "1"); return b.innerText.trim().slice(0, 20);
    }, w.src);
    if (yes) { await page.locator("[data-plan-yes]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); }
    return `eliminó "${h.eliminar}"${yes ? ` (confirmó "${yes}")` : ctx.dialogs.length ? " (aceptó el aviso)" : ""}`;
  }
  if (h.mover) {
    if (!(await page.evaluate(ITEM_OF, [h.mover, w.src]))) return { fail: `"${h.mover}" no aparece como ${w.it}` };
    if (!(await page.evaluate(COL_NAMED, [h.a, w.src, "data-plan-dest"]))) return { fail: `no hay un contenedor que se llame "${h.a}"` };
    const llego = () => page.evaluate(([t]) => { const c = document.querySelector("[data-plan-dest]"); return !!c && (c.innerText || "").includes(t); }, [h.mover]);
    // 22/10: si el usuario nombró la manija (⠿), se arrastra DESDE la manija, que tiene que verse
    if (h.manija) {
      const hay = await page.evaluate((m) => {
        document.querySelectorAll("[data-plan-manija]").forEach((e) => e.removeAttribute("data-plan-manija"));
        const it = document.querySelector("[data-plan-item]"); if (!it) return false;
        const vis = (e) => { const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && Number(st.opacity) > 0.05; };
        const c = [...it.querySelectorAll("*")].filter((e) => vis(e) && (e.textContent || "").includes(m)).sort((x, y) => x.textContent.length - y.textContent.length)[0];
        if (!c) return false; c.setAttribute("data-plan-manija", "1"); return true;
      }, h.manija);
      if (!hay) return { fail: `no se ve la manija "${h.manija}" en "${h.mover}"` };
      await page.locator("[data-plan-manija]").first().dragTo(page.locator("[data-plan-dest]").first(), { timeout: 3000 }).catch(() => {});
      await settle(page);
      return (await llego()) ? `arrastró "${h.mover}" desde su manija "${h.manija}" a "${h.a}"` : `arrastró "${h.mover}" desde su manija "${h.manija}" a "${h.a}" (no se movió)`;
    }
    await page.locator("[data-plan-item]").first().dragTo(page.locator("[data-plan-dest]").first(), { timeout: 3000 }).catch(() => {});
    await settle(page);
    // 21/10: como una persona, si la tarjeta no se arrastra entera, se agarra de su manija (algo draggable adentro, p. ej. ⠿)
    if (!(await llego())) {
      const manija = page.locator("[data-plan-item] [draggable=true]").first();
      if (await manija.count()) { await manija.dragTo(page.locator("[data-plan-dest]").first(), { timeout: 3000 }).catch(() => {}); await settle(page); }
    }
    const ok = await llego();
    if (ok) return `arrastró "${h.mover}" a "${h.a}"`;
    // si no, su control de mover (eligiendo el destino en un select al lado, si hay)
    const x = await itemControl(page, ctls, "mover", h.mover, w);
    if (!x.ctl) return `arrastró "${h.mover}" a "${h.a}" (no se movió; tampoco hay control de mover)`;
    await x.ctl.loc.evaluate((b, dest) => { const nrm = (t) => String(t || "").toLowerCase(); const s = (b.parentElement || b).querySelector("select"); if (!s) return; const i = [...s.options].findIndex((o) => nrm(o.text).includes(nrm(dest))); if (i >= 0) { s.selectedIndex = i; s.dispatchEvent(new Event("change", { bubbles: true })); } }, h.a).catch(() => {});
    await x.ctl.loc.click({ timeout: 2000 }).catch(() => {});
    await settle(page);
    return `movió "${h.mover}" con "${x.ctl.text.slice(0, 20)}" hacia "${h.a}"`;
  }
  if (h.recargar) { await page.reload({ waitUntil: "load" }); await settle(page); return "recargó"; }
  if (h.pasar_mouse) {
    if (!(await page.evaluate(ITEM_OF, [h.pasar_mouse, w.src]))) return { fail: `"${h.pasar_mouse}" no aparece como ${w.it}` };
    await page.locator("[data-plan-item]").first().hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(250);
    return `pasó el mouse por "${h.pasar_mouse}"`;
  }
  if (h.escribir != null) { const r = await escribirEn(page, h.en, h.escribir); return r.fail ? r : r.why; }
  if (h.clic != null) { const r = await clicEn(page, h.clic, ctx); return r.fail ? r : r.why; }
  if (h.usar) { const r = await usarVerbo(page, h.usar, h.valor, ctx); return r.fail ? r : r.why; }
  return { fail: `acción desconocida: ${JSON.stringify(h)}` };
}

// ---------- lo que se ve ----------
async function pre(page, veo, w) {
  // lo que hay que medir ANTES de la acción: contadores que cambian, y lo que tiene que estar oculto antes del hover
  const out = {};
  for (const [i, v] of veo.entries()) {
    if (v.contador != null && v.cambia != null) out[i] = (await page.evaluate(COL_NAMED, [v.contador, w.src, "data-plan-col"]))?.count ?? null;
    if (v.al_pasar) {
      await page.mouse.move(1, 1); await page.waitForTimeout(250);
      out[i] = (await page.evaluate(ITEM_OF, [v.en_item, w.src])) ? await page.evaluate(VISIBLE_IN_ITEM, v.al_pasar) : null;
    }
  }
  return out;
}
async function see(page, v, before, w) {
  if (v.esta) {
    const s = await page.evaluate(SEEN, [v.esta, v.en || null]);
    return [s.seen && s.donde !== false, s.seen ? (s.donde === false ? `"${v.esta}" se ve pero NO en "${v.en}"` : `"${v.esta}" se ve${v.en ? ` en "${v.en}"` : ""}`) : `"${v.esta}" NO se ve (y tenía que verse${v.en ? ` en "${v.en}"` : ""})`];
  }
  if (v.no_esta) { const s = await page.evaluate(SEEN, [v.no_esta, null]); return [!s.seen, s.seen ? `"${v.no_esta}" SIGUE` : `"${v.no_esta}" ya no está`]; }
  if (v.contiene) {
    if (!(await page.evaluate(ITEM_OF, [v.en_item, w.src]))) return [false, `"${v.en_item}" no aparece como ${w.it}`];
    const txt = (await page.locator("[data-plan-item]").first().innerText().catch(() => "")).toLowerCase();
    const miss = v.contiene.filter((t) => !txt.includes(String(t).toLowerCase()));
    return [!miss.length, miss.length ? `${w.it} "${v.en_item}" no muestra: ${miss.join(", ")}` : `${w.it} "${v.en_item}" muestra ${v.contiene.join(", ")}`];
  }
  if (v.orden) {
    if (!(await page.evaluate(COL_NAMED, [v.en, w.src, "data-plan-col"]))) return [false, `no hay un contenedor "${v.en}"`];
    const tops = await page.evaluate(TOPS, v.orden);
    if (tops.some((t) => t == null)) return [false, `en "${v.en}" no están todas: ${v.orden.filter((_, i) => tops[i] == null).join(", ")}`];
    const got = v.orden.map((t, i) => [t, tops[i]]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const ok = got.every((t, i) => t === v.orden[i]);
    return [ok, ok ? `orden en "${v.en}": ${got.join(" · ")}` : `orden en "${v.en}": ${got.join(" · ")} (se esperaba ${v.orden.join(" · ")})`];
  }
  if (v.contador != null) {
    const c = await page.evaluate(COL_NAMED, [v.contador, w.src, "data-plan-col"]);
    if (!c) return [false, `no hay un contenedor "${v.contador}"`];
    if (c.count == null) return [false, `"${v.contador}" no muestra ningún número`];
    if (v.vale != null) return [c.count === v.vale, `contador de "${v.contador}": ${c.count}${c.count === v.vale ? "" : ` (se esperaba ${v.vale})`}`];
    const b = before;
    if (b == null) return [false, `contador de "${v.contador}": no había número antes`];
    return [c.count - b === v.cambia, `contador de "${v.contador}": ${b} → ${c.count}${c.count - b === v.cambia ? "" : ` (se esperaba ${v.cambia > 0 ? "+" : ""}${v.cambia})`}`];
  }
  if (v.control) {
    if (v.solo_en && !(await page.evaluate(COL_NAMED, [v.solo_en, w.src, "data-plan-col"]))) return [false, `no hay un contenedor "${v.solo_en}"`];
    const again = await page.evaluate(([ws]) => {
      const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const c = document.querySelector("[data-plan-col]");
      const all = [...document.querySelectorAll("button, a, [role=button], input[type=button]")].filter((b) => b.getClientRects().length && ws.every((w) => nrm(b.innerText || b.value || b.getAttribute("aria-label") || "").includes(nrm(w))));
      return { n: all.length, inside: all.filter((b) => c && c.contains(b)).length };
    }, [v.control]);
    const ok = again.n >= 1 && (!v.solo_en || again.inside === again.n);
    return [ok, `control "${v.control.join(" ")}": ${again.n} visible(s)${v.solo_en ? `, ${again.inside} en "${v.solo_en}"` : ""}`];
  }
  if (v.al_pasar) {
    if (!(await page.evaluate(ITEM_OF, [v.en_item, w.src]))) return [false, `"${v.en_item}" no aparece como ${w.it}`];
    await page.locator("[data-plan-item]").first().hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(250);
    const after = await page.evaluate(VISIBLE_IN_ITEM, v.al_pasar);
    const b = before || [];
    const bad = v.al_pasar.filter((t, i) => !after[i] || b[i]);
    return [!bad.length, bad.length ? v.al_pasar.map((t, i) => `${t}: ${b[i] ? "ya se veía antes" : "oculto antes"} → ${after[i] ? "se ve" : "NO se ve"}`).join(" · ") : `${v.al_pasar.join(" ")}: ocultos → aparecen al pasar el mouse`];
  }
  // 21/10 (project26, R11 ×6): "padding de control 'Agregar tarjeta': 8px 15px" no decía CUÁL elemento; Gemma arreglaba
  // #addCardBtn (una regla de un botón que ya no existía) y el medido era #addCardBtnBottom. Ahora el FAIL dice cuál es.
  const cual = (s0) => page.evaluate((q) => { const el = document.querySelector(q); if (!el) return ""; const c = [...el.classList].filter((k) => !k.startsWith("data-")).slice(0, 2); return `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}${c.length ? ` class="${c.join(" ")}"` : ""}>`; }, s0).catch(() => "");
  if (v.estilo) {
    const e = v.estilo;
    let sel = null, label = "la página";
    if (e.de?.grupo) { if (!(await page.evaluate(COL_NAMED, [e.de.grupo, w.src, "data-plan-col"]))) return [false, `no hay ${w.gr} "${e.de.grupo}"`]; sel = "[data-plan-col]"; label = `${w.gr} "${e.de.grupo}"`; }
    else if (e.de?.item) { if (!(await page.evaluate(ITEM_OF, [e.de.item, w.src]))) return [false, `"${e.de.item}" no aparece como ${w.it}`]; sel = "[data-plan-item]"; label = `${w.it} "${e.de.item}"`; }
    else if (e.de?.control) {
      const ctl = await verbControl(page, e.de.control);
      if (!ctl) return [false, `ningún control dice "${e.de.control.join(" ")}"`];
      await ctl.loc.evaluate((b) => { document.querySelectorAll("[data-plan-ctl]").forEach((x) => x.removeAttribute("data-plan-ctl")); b.setAttribute("data-plan-ctl", "1"); });
      sel = "[data-plan-ctl]"; label = `control "${ctl.text.slice(0, 25)}"`;
    }
    const got = await page.evaluate(STYLES_OF, [sel, e.prop, e.de === "pagina"]);
    const ok = got.some((g) => styleMatches(g, e.valor));
    const want = typeof e.valor === "object" && !Array.isArray(e.valor) ? `distinto de ${e.valor.distinto}` : [].concat(e.valor).join(" o ");
    const es = !ok && sel ? await cual(sel) : "";
    // 26/10: un fondo pedido tiene que VERSE. La columna tenía #8FB3C7 pero un contenedor gris de adentro la tapaba casi
    // entera, y la prueba pasaba. Se mira en una grilla de puntos qué fondo se ve (los ítems no cuentan: son contenido).
    if (ok && sel && /^background(-color)?$/.test(e.prop) && e.de !== "pagina") {
      const vis = await page.evaluate(([q, src]) => {
        const el = document.querySelector(q); if (!el) return null;
        const re = new RegExp(src, "i"), esItem = (x) => [...x.classList].some((k) => re.test(k));
        const r = el.getBoundingClientRect(); let suyo = 0, total = 0; const tapa = new Map();
        for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
          const x = r.left + (r.width * i) / 12, y = r.top + (r.height * j) / 12;
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
          let t = document.elementFromPoint(x, y); if (!t || !el.contains(t)) continue;
          let item = false; for (let z = t; z && z !== el; z = z.parentElement) if (esItem(z)) item = true;
          if (item || t.closest("button, input, select, textarea, a[href]")) continue; // ítems y controles son contenido
          total++;
          for (let z = t; z; z = z.parentElement) { const c = getComputedStyle(z).backgroundColor, a = (c.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(/[ ,/]+/).filter(Boolean).map(Number); if (z === el) { suyo++; break; } if (a && (a.length < 4 || a[3] > 0.6)) { const k = `<${z.tagName.toLowerCase()}${z.className ? ` class="${String(z.className).split(" ").slice(0, 2).join(" ")}"` : ""}> (${c})`; tapa.set(k, (tapa.get(k) || 0) + 1); break; } }
        }
        const peores = [...tapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([quien, n]) => `${quien} en el ${Math.round((100 * n) / total)}%`);
        return { pct: total ? Math.round((100 * suyo) / total) : 100, peores };
      }, [sel, w.src]);
      if (vis && vis.pct < 40) return [false, `${e.prop} de ${label}: ${[...new Set(got)][0]}, pero casi no se ve: solo en el ${vis.pct}% de ${label} (sin contar ${w.it}s ni botones)${vis.peores.length ? `; lo tapa ${vis.peores.join(" y ")}` : ""}. El color pedido tiene que verse: sacale el fondo a lo que lo tapa (o hacelo transparente)`];
    }
    return [ok, `${e.prop} de ${label}${es ? ` (es ${es})` : ""}: ${[...new Set(got)].slice(0, 3).join(" | ") || "—"}${ok ? "" : ` (se esperaba ${want})`}`];
  }
  if (v.pregunta) {
    // al borrar, antes de confirmar, aparece la pregunta (en la página o en un aviso del navegador)
    const n = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (w.ctx.trasClic == null) return [false, `no se llegó a apretar borrar, así que no hay pregunta para ver`];
    const ok = n(w.ctx.trasClic).includes(n(v.pregunta));
    return [ok, ok ? `al apretar borrar pregunta "${v.pregunta}"` : `al apretar borrar no aparece "${v.pregunta}"${w.ctx.dialogoClic ? ` (el navegador preguntó: "${w.ctx.dialogoClic.slice(0, 80)}")` : ""}`];
  }
  if (v.centrado) {
    // 22/10: mismo espacio libre a la izquierda y a la derecha (tolerancia: 16px o el 2% del ancho)
    let caja = null, que = "";
    if (v.centrado === "grupos") {
      caja = await page.evaluate((src) => {
        const re = new RegExp(src, "i");
        const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (x.tagName === "LI" || [...x.classList].some((k) => re.test(k))) return true; return false; };
        const HS = "h1, h2, h3, h4, h5, h6, [class*=title], [class*=titulo], [class*=header]";
        const titled = (a) => [...a.querySelectorAll(HS)].some((h) => !inItem(h) && (h.textContent || "").trim() && h.getClientRects().length);
        // el padre con más hijos con título (del mismo tipo): esos hijos son los grupos
        let mejor = null;
        for (const p of document.querySelectorAll("body *")) { const hs = [...p.children].filter((c) => titled(c) && c.getClientRects().length); if (hs.length >= 2 && (!mejor || hs.length > mejor.length)) mejor = hs; }
        if (!mejor) return null;
        const rs = mejor.map((e) => e.getBoundingClientRect());
        // 23/10 (R31 ×6: Gemma centraba el contenedor, que YA estaba centrado, y no lo de adentro): se dice quién contiene
        const pad = mejor[0].parentElement, pr = pad.getBoundingClientRect();
        const quien = `<${pad.tagName.toLowerCase()}${pad.id ? ` id="${pad.id}"` : ""}${pad.classList.length ? ` class="${[...pad.classList].slice(0, 2).join(" ")}"` : ""}>`;
        return { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), n: mejor.length, cont: { quien, left: pr.left, right: pr.right } };
      }, w.src);
      const fem = /a$/.test(w.gr);
      que = caja ? `${fem ? "las" : "los"} ${caja.n} ${w.gr}s ${fem ? "juntas" : "juntos"}` : "";
    } else if (v.centrado?.control) {
      const ctl = await verbControl(page, v.centrado.control);
      if (ctl) { const r = await ctl.loc.boundingBox(); caja = r && { left: r.x, right: r.x + r.width }; que = `el botón "${ctl.text.slice(0, 25)}"`; }
    }
    if (!caja) return [false, v.centrado === "grupos" ? `no encontré ${w.gr}s para medir` : `ningún control dice "${[].concat(v.centrado?.control || []).join(" ")}"`];
    const ancho = await page.evaluate(() => document.documentElement.clientWidth);
    const izq = Math.round(caja.left), der = Math.round(ancho - caja.right), tol = Math.max(16, Math.round(ancho * 0.02));
    const ok = Math.abs(izq - der) <= tol;
    let extra = "";
    if (!ok && caja.cont) {
      const ci = Math.round(caja.cont.left), cd = Math.round(ancho - caja.cont.right);
      extra = Math.abs(ci - cd) <= tol
        ? ` · el que las contiene, ${caja.cont.quien}, YA está centrado (va de ${ci}px a ${Math.round(caja.cont.right)}px), pero adentro de él ${que} ocupan solo de ${izq}px a ${Math.round(caja.right)}px: lo que está corrido es lo de ADENTRO de ${caja.cont.quien}`
        : ` · el que las contiene es ${caja.cont.quien} (va de ${ci}px a ${Math.round(caja.cont.right)}px)`;
    }
    return [ok, `${que}: ${izq}px libres a la izquierda y ${der}px a la derecha${ok ? " (centrado)" : ` (no está centrado; tolerancia ${tol}px)${extra}`}`];
  }
  if (v.moderno) {
    // 25/10: reglas de diseño moderno (visual.mjs, REGLAS_MODERNAS)
    if (!REGLAS_MODERNAS[v.moderno]) return [false, `regla moderna desconocida: ${v.moderno}`];
    if (v.moderno === "hover_vivo") {
      const estado = () => page.evaluate((src) => { const re = new RegExp(src, "i"); const it = [...document.querySelectorAll("body *")].find((x) => [...x.classList].some((k) => re.test(k)) && x.getBoundingClientRect().height > 0); if (!it) return null; it.setAttribute("data-plan-hv", "1"); const s = getComputedStyle(it); return { t: s.transform, sh: s.boxShadow, q: `<${it.tagName.toLowerCase()} class="${[...it.classList].slice(0, 2).join(" ")}">` }; }, w.src);
      await page.mouse.move(1, 1); await page.waitForTimeout(300);
      const a = await estado(); if (!a) return [false, `hover_vivo: no encontré ${w.it}s`];
      await page.locator("[data-plan-hv]").first().hover({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(450);
      const b = await estado();
      const ok = !!b && (a.t !== b.t || a.sh !== b.sh);
      return [ok, `hover_vivo: ${a.q} ${ok ? "reacciona al pasar el mouse" : "no cambia al pasar el mouse (ni sombra ni posición)"}`];
    }
    const m = (await page.evaluate(MEDIR_MODERNO, w.src))[v.moderno];
    return [!!m?.ok, `${v.moderno}: ${m?.detalle || "no se pudo medir"}`];
  }
  if (v.visual) {
    // 22/10: reglas visuales medibles (visual.mjs) — se miden con la ventana de la prueba (1280px de ancho)
    if (!REGLAS_VISUALES[v.visual]) return [false, `regla visual desconocida: ${v.visual}`];
    const m = (await page.evaluate(MEDIR_VISUAL))[v.visual];
    return [!!m?.ok, `${v.visual}: ${m?.detalle || "no se pudo medir"}`];
  }
  if (v.desborde) {
    // con muchos ítems (los crea "dado"): la página NO se desplaza en vertical y el grupo (o algo adentro) sí
    if (!(await page.evaluate(COL_NAMED, [v.desborde, w.src, "data-plan-col"]))) return [false, `no hay ${w.gr} "${v.desborde}"`];
    const d = await page.evaluate(() => {
      // la página "se desplaza por los ítems" si el grupo no entra en la ventana (hay que bajar la página para verlo entero)
      const col = document.querySelector("[data-plan-col]");
      const pagina = col.getBoundingClientRect().bottom + (document.scrollingElement || document.documentElement).scrollTop > innerHeight + 4;
      const scrollers = [col, ...col.querySelectorAll("*")].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4);
      return { pagina, grupo: scrollers.length > 0, alto: Math.round(col.getBoundingClientRect().height), vista: innerHeight };
    });
    const ok = !d.pagina && d.grupo;
    const es = ok ? "" : await cual("[data-plan-col]");
    return [ok, `con muchos ítems: ${d.grupo ? `scrollea adentro de ${w.gr} "${v.desborde}"` : `${w.gr} "${v.desborde}"${es ? ` (es ${es})` : ""} no scrollea (mide ${d.alto}px y la ventana ${d.vista}px: crece con lo que tiene adentro, nada le pone un alto máximo)`} · ${d.pagina ? `no entra en la ventana: hay que desplazar la PÁGINA para verla (no tendría que)` : "entra en la ventana"}`];
  }
  if (v.color_en_item) {
    if (!(await page.evaluate(ITEM_OF, [v.color_en_item, w.src]))) return [false, `"${v.color_en_item}" no aparece como ${w.it}`];
    const cs = await page.evaluate(COLORS_IN_ITEM, v.texto || null);
    const fams = [...new Set(cs.map(colorFamily).filter(Boolean))];
    return [fams.includes(v.familia), `colores en "${v.color_en_item}"${v.texto ? ` (lo que dice "${v.texto}")` : ""}: ${fams.join(", ") || "ninguno de rojo/amarillo/verde"}${fams.includes(v.familia) ? "" : ` (se esperaba ${v.familia})`}`];
  }
  if (v.muestra != null || v.fondo != null) {
    const L = nombreLugar(v.en);
    if (!L?.col || !L?.fila) return [false, `"${v.en}" no es un lugar con columna y fila`];
    await page.evaluate(() => document.activeElement?.blur?.());
    const p = await page.evaluate(LUGAR, [L]);
    if (p.falta) return [false, p.falta];
    const r = await page.evaluate(LEER_LUGAR, [p.x, p.y]);
    const nom = String(v.en).toUpperCase();
    if (v.muestra != null) {
      const ok = mismoValor(r.texto, v.muestra);
      return [ok, v.muestra === "" ? (ok ? `${nom} está vacía` : `${nom} muestra "${r.texto}" (tenía que estar vacía)`) : `${nom} muestra "${r.texto ?? ""}"${ok ? "" : ` (se esperaba "${v.muestra}"; es ${p.quien})`}`];
    }
    const ok = !!r.fondo && styleMatches(r.fondo, v.fondo);
    return [ok, `fondo de ${nom}: ${r.fondo || "sin fondo propio"}${ok ? "" : ` (se esperaba ${v.fondo}; es ${p.quien})`}`];
  }
  if (v.oculta != null) {
    const L = nombreLugar(v.oculta);
    const p = L ? await page.evaluate(LUGAR, [L]) : { falta: true };
    return [!!p.falta, p.falta ? `${L?.col ? `la columna "${L.col}"` : `la fila "${L?.fila}"`} ya no se ve` : `${L.col ? `la columna "${L.col}"` : `la fila "${L.fila}"`} se sigue viendo (${p.quien})`];
  }
  if (v.encabezados) {
    const faltan = [];
    const cols = v.encabezados.columnas || [], filas = v.encabezados.filas || [];
    const rc = [], rf = [];
    for (const c of cols) { const p = await page.evaluate(LUGAR, [{ col: c }]); if (p.falta) faltan.push(c); else rc.push([c, p]); }
    for (const f of filas) { const p = await page.evaluate(LUGAR, [{ fila: f }]); if (p.falta) faltan.push(f); else rf.push([f, p]); }
    const n = cols.length, m = filas.length;
    // 30/10 (1ª corrida de Gemma con la hoja): las letras A–J estaban apiladas una ABAJO de la otra y esto pasaba igual.
    // Una grilla, como la ve una persona: las letras en una fila (de izquierda a derecha), los números en una columna (de arriba abajo)
    if (!faltan.length) {
      const enFila = rc.every(([, p], i) => i === 0 || (p.dx > rc[i - 1][1].dx + 4 && Math.abs(p.dy - rc[0][1].dy) < 8));
      const numerosApilados = rf.every(([, p], i) => i === 0 || (p.dy > rf[i - 1][1].dy + 4 && Math.abs(p.dx - rf[0][1].dx) < 8));
      if (!enFila || !numerosApilados) return [false, `${!enFila ? `las letras ${cols[0]}–${cols.at(-1)} no están en UNA fila de izquierda a derecha (${rc.slice(0, 3).map(([c, p]) => `"${c}" en x ${Math.round(p.dx)}, y ${Math.round(p.dy)}`).join(" · ")}…: tienen que estar a la misma altura, una al lado de la otra)` : ""}${!enFila && !numerosApilados ? " y " : ""}${!numerosApilados ? `los números ${filas[0]}–${filas.at(-1)} no están en UNA columna de arriba abajo (${rf.slice(0, 3).map(([f, p]) => `"${f}" en x ${Math.round(p.dx)}, y ${Math.round(p.dy)}`).join(" · ")}…)` : ""}`];
    }
    return [!faltan.length, faltan.length ? `faltan encabezados: ${faltan.slice(0, 8).join(", ")}${faltan.length > 8 ? "…" : ""}` : `se ven ${n} encabezados de columna y ${m} de fila`];
  }
  return [false, `"veo" desconocido: ${JSON.stringify(v)}`];
}

// 18/10 (ciclo): con "azar", los textos de prueba ("QA Alfa", "QA detalle uno"…) se cambian por otros al correr. Gemma
// ve QUÉ se va a probar, pero no con qué textos: una app que tenga "QA Alfa" escrito a mano no pasa.
const PALABRAS = ["Zorzal", "Tero", "Hornero", "Calandria", "Benteveo", "Chingolo", "Carancho", "Biguá", "Cardenal", "Junco", "Aromo", "Ceibo", "Tala", "Espinillo", "Jacarandá", "Lapacho"];
export function conAzar(row, seed) {
  if (!seed) return row;
  let h = [...String(seed)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const map = new Map();
  const swap = (v) => {
    if (typeof v !== "string" || !/^QA\b/.test(v)) return v;
    if (!map.has(v)) { h = (h * 1103515245 + 12345) >>> 0; map.set(v, `QA ${PALABRAS[h % PALABRAS.length]} ${map.size + 1}`); }
    return map.get(v);
  };
  const walk = (x) => (Array.isArray(x) ? x.map(walk) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, walk(v)])) : swap(x));
  return walk(row);
}

/** Corre UNA fila. Devuelve { result, detail, errors? }. */
export async function runRow({ page, row: row0, controls, glosario, azar, ctx, reload }) {
  let row = conAzar(filaATipos(row0, glosario), azar);
  const w = { src: itemClassRe(glosario).source, it: palabra(glosario, "item"), gr: palabra(glosario, "grupo"), ctx };
  ctx.trasClic = null; ctx.seleccion = null;
  const ctls = { ...DEFAULT_CONTROLS, ...(controls || {}) };
  await freshStart(page, reload);
  const e0 = ctx.pageErrors.length;
  const steps = [];
  const out = (result, last) => { const errs = errsSince(ctx, e0); return { result, detail: [...steps, last].filter(Boolean).join(" · ") + (errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""), ...(errs.length ? { errors: errs } : {}) }; };
  const dado = row.dado || [];
  for (const d of dado) {
    // 19/10: "dado" también puede mover un ítem que ya se creó (para restricciones como "no se borra en Completa")
    // 29/10: "dado" también escribe en un lugar o hace clic (seleccionar una columna antes de usar un control)
    if (d && (d.escribir != null || d.clic != null)) {
      const m = await act(page, ctls, d, ctx, w);
      if (m?.fail) return out("FAIL", `no se pudo preparar: ${m.fail}`);
      steps.push(m);
      continue;
    }
    if (d && d.mover) {
      const m = await act(page, ctls, { mover: d.mover, a: d.a }, ctx, w);
      if (m?.fail) return out("FAIL", `no se pudo preparar: ${m.fail}`);
      steps.push(m);
      continue;
    }
    const r = await addCard(page, ctls, d, w);
    if (r.ok) { steps.push(r.why); continue; }
    // si crear no anda pero la app YA trae ítems, uno cualquiera (sin campos pedidos) se reemplaza por
    // una de las que están: mover / editar / borrar se pueden probar igual (plantillas 20-44-02: arranca con 3).
    const plain = dado.length === 1 && typeof d === "object" && !d.campos;
    const have = plain ? await page.evaluate(([src]) => {
      const re = new RegExp(src, "i");
      const its = [...document.querySelectorAll("body *")].filter((e) => !e.closest("button, select, input, textarea, label, script, style") && (e.tagName === "LI" || [...e.classList].some((k) => re.test(k))) && e.getClientRects().length && ((e.innerText || "").match(/[a-záéíóúñ]/gi) || []).length >= 3);
      const roots = its.filter((e) => !its.some((o) => o !== e && o.contains(e)));
      const t = roots[0] && (roots[0].querySelector("h1,h2,h3,h4,h5,h6,strong,b,[class*=title],[class*=titulo]")?.textContent || roots[0].innerText || "").trim().split("\n")[0].slice(0, 60);
      return t || null;
    }, [w.src]) : null;
    if (!have) return out("FAIL", `no se pudo preparar: ${r.why}`);
    steps.push(`no pudo crear "${d.agregar}" (${r.why.replace(/^agregar "[^"]+" /, "")}) → usa la que ya estaba: "${have}"`);
    row = JSON.parse(JSON.stringify({ ...row, dado: [] }).split(JSON.stringify(d.agregar)).join(JSON.stringify(have)));
  }
  const veo = row.veo || [];
  const before = await pre(page, veo, w);
  if (row.hago) {
    const a = await act(page, ctls, row.hago, ctx, w);
    if (a?.fail) return out("FAIL", a.fail);
    steps.push(a);
  }
  const seen = [];
  for (const [i, v] of veo.entries()) seen.push(await see(page, v, before[i], w));
  const ok = seen.every(([x]) => x);
  return out(ok ? "PASS" : "FAIL", "→ " + seen.map(([x, d]) => `${x ? "✓" : "✗"} ${d}`).join(" · "));
}

/** Chequeo para el catálogo de web/app: params.fila (la fila), params.controles (palabras de los controles) y params.glosario. */
export const PLANILLA_CHECKS = {
  planilla_fila: {
    describe: "Fila de la PLANILLA de comportamientos: dado (ítems que se crean antes) → hago (una acción) → veo (lo que tiene que pasar). La escribe el refinado, no el traductor.",
    params: { fila: "object", controles: "object?", glosario: "object?", azar: "string[]?" },
    run: async ({ page, c, r, ctx, reload }) => {
      const x = await runRow({ page, row: c.params.fila, controls: c.params.controles, glosario: c.params.glosario, azar: [].concat(c.params.azar || []).join("") || null, ctx, reload });
      r.result = x.result; r.detail = x.detail; if (x.errors) r.errors = x.errors;
    },
  },
};

/** La planilla de un proyecto → chequeos por requisito (texto Rn). Requisitos sin filas → SIN_CHEQUEO, dicho. */
export function checksFromPlanilla(planilla, features) {
  const rows = planilla.filas || [];
  return features.map((text, i) => {
    const id = `R${i + 1}`;
    const mine = rows.filter((f) => f.r === id);
    const why = (planilla.sin_fila || {})[id];
    return { id, text, fromPlanilla: true, checks: mine.map((f) => ({ type: "planilla_fila", params: { fila: f, ...(planilla.controles ? { controles: planilla.controles } : {}), ...(planilla.glosario ? { glosario: planilla.glosario } : {}) } })), ...(mine.length ? {} : { sin_chequeo: why || "la planilla no tiene filas para este requisito" }) };
  });
}
