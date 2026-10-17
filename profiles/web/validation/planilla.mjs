// planilla.mjs — PLANILLA de comportamientos v0.1 (16/10 noche, paso 1 del orden acordado con Miche).
//
// Por qué: cada requisito llega como texto libre y el traductor adivina el chequeo (R3 "prioridad desde una lista" →
// counter_on_action; R16 "orden por prioridad" → contador + scroll + hover = PASS falso). La planilla dice, por
// requisito, QUÉ tiene que pasar, con palabras de una persona y un vocabulario CERRADO que Validation ejecuta sin
// interpretar. No nombra clases, ids ni funciones (estricto en el QUÉ, flexible en el CÓMO).
//
// Una fila:
//   { id: "R7.1", r: "R7", dado: [{ agregar: "QA Alfa", campos: { prioridad: "alta" } }],
//     hago: { eliminar: "QA Alfa" }, veo: [{ no_esta: "QA Alfa" }, { contador: "Pendiente", cambia: -1 }] }
// dado   tarjetas que se crean ANTES, con la app misma (como una persona). Si no se pueden crear → FAIL (tampoco podría ella).
// hago   UNA acción: agregar {agregar, campos?} · editar {editar: texto, a?: texto nuevo, campos?} · eliminar ·
//        mover {mover, a: contenedor} · recargar: true · pasar_mouse: texto.
// veo    lista; todas tienen que cumplirse:
//        esta: texto [en: contenedor] · no_esta: texto · en_item: texto, contiene: [textos] ·
//        orden: [textos], en: contenedor (de arriba abajo) · contador: contenedor, cambia: ±n | vale: n ·
//        control: [palabras], solo_en: contenedor · al_pasar: [textos], en_item: texto (ocultos antes, visibles después) ·
//        estilo: { de: "pagina" | {columna} | {tarjeta} | {control: [palabras]}, prop, valor } ·
//        color_en_item: texto, familia: rojo | amarillo | verde.
// Estilo (decisión 16/10): colores exactos; medidas en px con ±2; palabras (dashed, scroll) de una lista; {distinto: "none"}.
// La planilla se escribe por proyecto; las palabras de los controles ("agregar tarjeta", "editar", …) van en planilla.controles.

import { ITEM_CLASS, MARK_FIELDS, SEEN, settle, errsSince, freshStart, verbControl, bestControlIn, useControl } from "./flows.mjs";

export const PLANILLA_VERSION = "planilla v0.1";
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
  if (prop === "width" || prop === "height") els = els.slice(0, 1);
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

// ---------- acciones ----------
async function addCard(page, ctls, spec) {
  const text = typeof spec === "string" ? spec : spec.agregar;
  const ctl = await verbControl(page, ctls.agregar);
  if (!ctl) return { ok: false, why: `ningún control visible dice "${ctls.agregar[0]}"` };
  const steps = await useControl(page, ctl.loc, text, { campos: { titulo: text, ...(spec.campos || {}) } });
  const s = await page.evaluate(SEEN, [text, null]);
  return { ok: s.seen, why: s.seen ? `agregó "${text}"` : `agregar "${text}" (${steps.join(" · ")}): no aparece` };
}
async function itemControl(page, ctls, verb, text) {
  if (!(await page.evaluate(ITEM_OF, [text, ITEM_CLASS.source]))) return { why: `"${text}" no está en ninguna tarjeta` };
  const item = page.locator("[data-plan-item]").first();
  await item.hover({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(80);
  const ctl = await bestControlIn(page, item, ctls[verb]);
  return ctl ? { item, ctl } : { item, why: `la tarjeta "${text}" no tiene un control que diga "${ctls[verb][0]}"` };
}
async function act(page, ctls, h, ctx) {
  if (h.agregar) { const r = await addCard(page, ctls, h); return r.ok ? r.why : { fail: r.why }; }
  if (h.editar) {
    const x = await itemControl(page, ctls, "editar", h.editar);
    if (!x.ctl) return { fail: x.why };
    const steps = await useControl(page, x.ctl.loc, h.a || h.editar, { replace: true, keep: true, campos: { ...(h.a ? { titulo: h.a } : {}), ...(h.campos || {}) } });
    return `editó "${h.editar}" (${steps.join(" · ")})`;
  }
  if (h.eliminar) {
    const x = await itemControl(page, ctls, "eliminar", h.eliminar);
    if (!x.ctl) return { fail: x.why };
    // la confirmación tiene que ser un botón que APARECE después del clic (antes agarraba el "Borrar" de otra tarjeta)
    await page.evaluate(() => document.querySelectorAll("button, [role=button]").forEach((b) => { if (b.getClientRects().length) b.setAttribute("data-plan-pre", "1"); else b.removeAttribute("data-plan-pre"); }));
    await x.ctl.loc.click({ timeout: 2000 }).catch(() => {});
    await settle(page);
    const gone = !(await page.evaluate(SEEN, [h.eliminar, null])).seen;
    const yes = gone ? null : await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (x.tagName === "LI" || [...x.classList].some((k) => re.test(k))) return true; return false; };
      const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const b = [...document.querySelectorAll("button, [role=button]")].filter((x) => x.getClientRects().length && !x.hasAttribute("data-plan-pre") && !inItem(x)).find((x) => /^(si|confirmar|eliminar|borrar|aceptar|ok)\b/.test(nrm(x.innerText).replace(/^[^a-z]+/, "")));
      if (!b) return null; b.setAttribute("data-plan-yes", "1"); return b.innerText.trim().slice(0, 20);
    }, ITEM_CLASS.source);
    if (yes) { await page.locator("[data-plan-yes]").first().click({ timeout: 2000 }).catch(() => {}); await settle(page); }
    return `eliminó "${h.eliminar}"${yes ? ` (confirmó "${yes}")` : ctx.dialogs.length ? " (aceptó el aviso)" : ""}`;
  }
  if (h.mover) {
    if (!(await page.evaluate(ITEM_OF, [h.mover, ITEM_CLASS.source]))) return { fail: `"${h.mover}" no está en ninguna tarjeta` };
    if (!(await page.evaluate(COL_NAMED, [h.a, ITEM_CLASS.source, "data-plan-dest"]))) return { fail: `no hay un contenedor que se llame "${h.a}"` };
    await page.locator("[data-plan-item]").first().dragTo(page.locator("[data-plan-dest]").first(), { timeout: 3000 }).catch(() => {});
    await settle(page);
    const ok = await page.evaluate(([t, src]) => { const c = document.querySelector("[data-plan-dest]"); return !!c && (c.innerText || "").includes(t); }, [h.mover, ITEM_CLASS.source]);
    if (ok) return `arrastró "${h.mover}" a "${h.a}"`;
    // si no, su control de mover (eligiendo el destino en un select al lado, si hay)
    const x = await itemControl(page, ctls, "mover", h.mover);
    if (!x.ctl) return `arrastró "${h.mover}" a "${h.a}" (no se movió; tampoco hay control de mover)`;
    await x.ctl.loc.evaluate((b, dest) => { const nrm = (t) => String(t || "").toLowerCase(); const s = (b.parentElement || b).querySelector("select"); if (!s) return; const i = [...s.options].findIndex((o) => nrm(o.text).includes(nrm(dest))); if (i >= 0) { s.selectedIndex = i; s.dispatchEvent(new Event("change", { bubbles: true })); } }, h.a).catch(() => {});
    await x.ctl.loc.click({ timeout: 2000 }).catch(() => {});
    await settle(page);
    return `movió "${h.mover}" con "${x.ctl.text.slice(0, 20)}" hacia "${h.a}"`;
  }
  if (h.recargar) { await page.reload({ waitUntil: "load" }); await settle(page); return "recargó"; }
  if (h.pasar_mouse) {
    if (!(await page.evaluate(ITEM_OF, [h.pasar_mouse, ITEM_CLASS.source]))) return { fail: `"${h.pasar_mouse}" no está en ninguna tarjeta` };
    await page.locator("[data-plan-item]").first().hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(250);
    return `pasó el mouse por "${h.pasar_mouse}"`;
  }
  return { fail: `acción desconocida: ${JSON.stringify(h)}` };
}

// ---------- lo que se ve ----------
async function pre(page, veo) {
  // lo que hay que medir ANTES de la acción: contadores que cambian, y lo que tiene que estar oculto antes del hover
  const out = {};
  for (const [i, v] of veo.entries()) {
    if (v.contador != null && v.cambia != null) out[i] = (await page.evaluate(COL_NAMED, [v.contador, ITEM_CLASS.source, "data-plan-col"]))?.count ?? null;
    if (v.al_pasar) {
      await page.mouse.move(1, 1); await page.waitForTimeout(250);
      out[i] = (await page.evaluate(ITEM_OF, [v.en_item, ITEM_CLASS.source])) ? await page.evaluate(VISIBLE_IN_ITEM, v.al_pasar) : null;
    }
  }
  return out;
}
async function see(page, v, before) {
  if (v.esta) {
    const s = await page.evaluate(SEEN, [v.esta, v.en || null]);
    return [s.seen && s.donde !== false, s.seen ? (s.donde === false ? `"${v.esta}" se ve pero NO en "${v.en}"` : `"${v.esta}" se ve${v.en ? ` en "${v.en}"` : ""}`) : `"${v.esta}" NO se ve`];
  }
  if (v.no_esta) { const s = await page.evaluate(SEEN, [v.no_esta, null]); return [!s.seen, s.seen ? `"${v.no_esta}" SIGUE` : `"${v.no_esta}" ya no está`]; }
  if (v.contiene) {
    if (!(await page.evaluate(ITEM_OF, [v.en_item, ITEM_CLASS.source]))) return [false, `"${v.en_item}" no está en ninguna tarjeta`];
    const txt = (await page.locator("[data-plan-item]").first().innerText().catch(() => "")).toLowerCase();
    const miss = v.contiene.filter((t) => !txt.includes(String(t).toLowerCase()));
    return [!miss.length, miss.length ? `la tarjeta "${v.en_item}" no muestra: ${miss.join(", ")}` : `la tarjeta "${v.en_item}" muestra ${v.contiene.join(", ")}`];
  }
  if (v.orden) {
    if (!(await page.evaluate(COL_NAMED, [v.en, ITEM_CLASS.source, "data-plan-col"]))) return [false, `no hay un contenedor "${v.en}"`];
    const tops = await page.evaluate(TOPS, v.orden);
    if (tops.some((t) => t == null)) return [false, `en "${v.en}" no están todas: ${v.orden.filter((_, i) => tops[i] == null).join(", ")}`];
    const got = v.orden.map((t, i) => [t, tops[i]]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const ok = got.every((t, i) => t === v.orden[i]);
    return [ok, ok ? `orden en "${v.en}": ${got.join(" · ")}` : `orden en "${v.en}": ${got.join(" · ")} (se esperaba ${v.orden.join(" · ")})`];
  }
  if (v.contador != null) {
    const c = await page.evaluate(COL_NAMED, [v.contador, ITEM_CLASS.source, "data-plan-col"]);
    if (!c) return [false, `no hay un contenedor "${v.contador}"`];
    if (c.count == null) return [false, `"${v.contador}" no muestra ningún número`];
    if (v.vale != null) return [c.count === v.vale, `contador de "${v.contador}": ${c.count}${c.count === v.vale ? "" : ` (se esperaba ${v.vale})`}`];
    const b = before;
    if (b == null) return [false, `contador de "${v.contador}": no había número antes`];
    return [c.count - b === v.cambia, `contador de "${v.contador}": ${b} → ${c.count}${c.count - b === v.cambia ? "" : ` (se esperaba ${v.cambia > 0 ? "+" : ""}${v.cambia})`}`];
  }
  if (v.control) {
    if (v.solo_en && !(await page.evaluate(COL_NAMED, [v.solo_en, ITEM_CLASS.source, "data-plan-col"]))) return [false, `no hay un contenedor "${v.solo_en}"`];
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
    if (!(await page.evaluate(ITEM_OF, [v.en_item, ITEM_CLASS.source]))) return [false, `"${v.en_item}" no está en ninguna tarjeta`];
    await page.locator("[data-plan-item]").first().hover({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(250);
    const after = await page.evaluate(VISIBLE_IN_ITEM, v.al_pasar);
    const b = before || [];
    const bad = v.al_pasar.filter((t, i) => !after[i] || b[i]);
    return [!bad.length, bad.length ? v.al_pasar.map((t, i) => `${t}: ${b[i] ? "ya se veía antes" : "oculto antes"} → ${after[i] ? "se ve" : "NO se ve"}`).join(" · ") : `${v.al_pasar.join(" ")}: ocultos → aparecen al pasar el mouse`];
  }
  if (v.estilo) {
    const e = v.estilo;
    let sel = null, label = "la página";
    if (e.de?.columna) { if (!(await page.evaluate(COL_NAMED, [e.de.columna, ITEM_CLASS.source, "data-plan-col"]))) return [false, `no hay un contenedor "${e.de.columna}"`]; sel = "[data-plan-col]"; label = `la columna "${e.de.columna}"`; }
    else if (e.de?.tarjeta) { if (!(await page.evaluate(ITEM_OF, [e.de.tarjeta, ITEM_CLASS.source]))) return [false, `"${e.de.tarjeta}" no está en ninguna tarjeta`]; sel = "[data-plan-item]"; label = `la tarjeta "${e.de.tarjeta}"`; }
    else if (e.de?.control) {
      const ctl = await verbControl(page, e.de.control);
      if (!ctl) return [false, `ningún control dice "${e.de.control.join(" ")}"`];
      await ctl.loc.evaluate((b) => { document.querySelectorAll("[data-plan-ctl]").forEach((x) => x.removeAttribute("data-plan-ctl")); b.setAttribute("data-plan-ctl", "1"); });
      sel = "[data-plan-ctl]"; label = `el control "${ctl.text.slice(0, 25)}"`;
    }
    const got = await page.evaluate(STYLES_OF, [sel, e.prop, e.de === "pagina"]);
    const ok = got.some((g) => styleMatches(g, e.valor));
    const want = typeof e.valor === "object" && !Array.isArray(e.valor) ? `distinto de ${e.valor.distinto}` : [].concat(e.valor).join(" o ");
    return [ok, `${e.prop} de ${label}: ${[...new Set(got)].slice(0, 3).join(" | ") || "—"}${ok ? "" : ` (se esperaba ${want})`}`];
  }
  if (v.color_en_item) {
    if (!(await page.evaluate(ITEM_OF, [v.color_en_item, ITEM_CLASS.source]))) return [false, `"${v.color_en_item}" no está en ninguna tarjeta`];
    const cs = await page.evaluate(COLORS_IN_ITEM, v.texto || null);
    const fams = [...new Set(cs.map(colorFamily).filter(Boolean))];
    return [fams.includes(v.familia), `colores en "${v.color_en_item}"${v.texto ? ` (lo que dice "${v.texto}")` : ""}: ${fams.join(", ") || "ninguno de rojo/amarillo/verde"}${fams.includes(v.familia) ? "" : ` (se esperaba ${v.familia})`}`];
  }
  return [false, `"veo" desconocido: ${JSON.stringify(v)}`];
}

/** Corre UNA fila. Devuelve { result, detail, errors? }. */
export async function runRow({ page, row: row0, controls, ctx, reload }) {
  let row = row0;
  const ctls = { ...DEFAULT_CONTROLS, ...(controls || {}) };
  await freshStart(page, reload);
  const e0 = ctx.pageErrors.length;
  const steps = [];
  const out = (result, last) => { const errs = errsSince(ctx, e0); return { result, detail: [...steps, last].filter(Boolean).join(" · ") + (errs.length ? ` · error de JS: ${errs[0].slice(0, 160)}` : ""), ...(errs.length ? { errors: errs } : {}) }; };
  const dado = row.dado || [];
  for (const d of dado) {
    const r = await addCard(page, ctls, d);
    if (r.ok) { steps.push(r.why); continue; }
    // si crear no anda pero la app YA trae tarjetas, una tarjeta cualquiera (sin campos pedidos) se reemplaza por
    // una de las que están: mover / editar / borrar se pueden probar igual (plantillas 20-44-02: arranca con 3).
    const plain = dado.length === 1 && typeof d === "object" && !d.campos;
    const have = plain ? await page.evaluate(([src]) => {
      const re = new RegExp(src, "i");
      const its = [...document.querySelectorAll("body *")].filter((e) => !e.closest("button, select, input, textarea, label, script, style") && (e.tagName === "LI" || [...e.classList].some((k) => re.test(k))) && e.getClientRects().length && ((e.innerText || "").match(/[a-záéíóúñ]/gi) || []).length >= 3);
      const roots = its.filter((e) => !its.some((o) => o !== e && o.contains(e)));
      const t = roots[0] && (roots[0].querySelector("h1,h2,h3,h4,h5,h6,strong,b,[class*=title],[class*=titulo]")?.textContent || roots[0].innerText || "").trim().split("\n")[0].slice(0, 60);
      return t || null;
    }, [ITEM_CLASS.source]) : null;
    if (!have) return out("FAIL", `no se pudo preparar: ${r.why}`);
    steps.push(`no pudo crear "${d.agregar}" (${r.why.replace(/^agregar "[^"]+" /, "")}) → usa la que ya estaba: "${have}"`);
    row = JSON.parse(JSON.stringify({ ...row, dado: [] }).split(JSON.stringify(d.agregar)).join(JSON.stringify(have)));
  }
  const veo = row.veo || [];
  const before = await pre(page, veo);
  if (row.hago) {
    const a = await act(page, ctls, row.hago, ctx);
    if (a?.fail) return out("FAIL", a.fail);
    steps.push(a);
  }
  const seen = [];
  for (const [i, v] of veo.entries()) seen.push(await see(page, v, before[i]));
  const ok = seen.every(([x]) => x);
  return out(ok ? "PASS" : "FAIL", "→ " + seen.map(([x, d]) => `${x ? "✓" : "✗"} ${d}`).join(" · "));
}

/** Chequeo para el catálogo de web/app: params.fila (la fila) y params.controles (palabras de los controles). */
export const PLANILLA_CHECKS = {
  planilla_fila: {
    describe: "Fila de la PLANILLA de comportamientos: dado (tarjetas que se crean antes) → hago (una acción) → veo (lo que tiene que pasar). La escribe el refinado, no el traductor.",
    params: { fila: "object", controles: "object?" },
    run: async ({ page, c, r, ctx, reload }) => {
      const x = await runRow({ page, row: c.params.fila, controls: c.params.controles, ctx, reload });
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
    return { id, text, fromPlanilla: true, checks: mine.map((f) => ({ type: "planilla_fila", params: { fila: f, ...(planilla.controles ? { controles: planilla.controles } : {}) } })), ...(mine.length ? {} : { sin_chequeo: why || "la planilla no tiene filas para este requisito" }) };
  });
}
