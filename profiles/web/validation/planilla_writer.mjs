// planilla_writer.mjs — QWEN escribe la PLANILLA de comportamientos a partir de los requisitos de Miche (16/10 noche).
//
// Decisión de Miche (16/10): las filas las propone Qwen, NO Gemma, para que Gemma no vea ni escriba su propio examen.
// Miche las edita y las aprueba. La planilla del Kanban hecha a mano (fixtures/planilla_kanban_c22.json) es la vara
// para medir a Qwen (build/compare_planillas.mjs).
//
// Cómo:
//   - UN pedido por requisito (con los demás como contexto): la respuesta es chica y entra holgada en 16k.
//   - El harness valida cada fila SIN modelo (validateRow): solo el vocabulario cerrado de planilla.mjs, textos
//     concretos, y nada de clases / ids / selectores (es el QUÉ, no el CÓMO). Si algo no cumple, se vuelve a pedir
//     con el problema escrito (hasta MAX_ATTEMPTS). Lo que igual no cumple queda afuera, dicho.
//   - Qwen puede decir que un requisito no se prueba como comportamiento (sin_fila + motivo): queda SIN_CHEQUEO.
//   - Regla de Intent Forge: no agregar comportamientos que el requisito no dice.
//
//   node profiles/web/validation/planilla_writer.mjs <snapshot.json> [--glosario glosario.json] [--out planilla.json] [--modo plantillas|libre]
//   v0.3: por defecto "plantillas" (Qwen elige plantillas de planilla_plantillas.mjs); "libre" = Qwen escribe la fila (v0.2.1)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonLoose } from "../../../json_loose.mjs";
// v0.3 (17/10, decisión de Miche): modo "plantillas" — Qwen elige plantillas y completa casilleros; el harness arma la fila
import { rowsFromChoices, relevanceProblems, systemPromptPlantillas, PLANTILLAS_VERSION } from "./planilla_plantillas.mjs";
// v0.4 (17/10, diseño de 3 capas): el writer no sabe de tarjetas ni columnas. Los nombres de la app vienen del glosario
// (--glosario o el campo "glosario" del snapshot) y las filas salen con tipos (item, grupo).
import { leerGlosario, palabra, prefijoDe, tipoDe, filaATipos } from "./glosario.mjs";

export const WRITER_VERSION = "planilla_writer v0.4";
const MAX_ATTEMPTS = 3;
const LM_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
const MODEL = process.env.PLANILLA_MODEL || process.env.REVIEWER_MODEL || "qwen2.5-7b-instruct";

// ---------- el vocabulario (lo mismo que ejecuta planilla.mjs) ----------
const HAGO = ["agregar", "editar", "eliminar", "mover", "recargar", "pasar_mouse"];
const VEO = ["esta", "no_esta", "contiene", "orden", "contador", "control", "al_pasar", "estilo", "color_en_item", "desborde", "pregunta", "centrado"];
const FAMILIAS = ["rojo", "amarillo", "verde"];
const PROPS = ["background-color", "color", "width", "height", "padding", "border-top-style", "border-top-left-radius", "box-shadow", "overflow-y", "font-size", "font-weight"];
// pistas de CÓMO está programado: no van en una planilla (estricto en el QUÉ, flexible en el CÓMO)
const HOW = /(^|[\s"'(])[.#](?![0-9a-f]{6}\b)[a-z][\w-]*|\bclass(name)?\s*=|\bid\s*=|\bdata-[a-z-]+|<\/?[a-z]+[\s>]|\b(querySelector|getElementById|onclick|addEventListener|localStorage\.)/i;

const isText = (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 120;
const texts = (x) => Array.isArray(x) && x.length > 0 && x.every(isText);

/** Una fila contra el vocabulario. Devuelve { ok, problems[] }. Función pura. */
export function validateRow(row0, nReq = Infinity, ctx = {}) {
  const p = [];
  if (!row0 || typeof row0 !== "object" || Array.isArray(row0)) return { ok: false, problems: ["la fila no es un objeto"] };
  const g = ctx.glosario, I = palabra(g, "item"), G = palabra(g, "grupo");
  const row = filaATipos(row0, g);
  const extra = Object.keys(row).filter((k) => !["id", "r", "dado", "hago", "veo"].includes(k) && !k.startsWith("_")); // _normalizado: lo anota el harness
  if (extra.length) p.push(`claves que no existen: ${extra.join(", ")} (solo id, r, dado, hago, veo)`);
  if (!/^R\d+$/.test(row.r || "") || Number(String(row.r).slice(1)) > nReq) p.push(`"r" tiene que ser el requisito (R1…R${nReq === Infinity ? "n" : nReq})`);
  // dado: ítems que se crean antes
  if (row.dado != null) {
    if (!Array.isArray(row.dado)) p.push(`"dado" es una lista de { "agregar": "texto" }`);
    else row.dado.forEach((d, i) => { if (d && isText(d.mover)) { if (!isText(d.a) || Object.keys(d).some((k) => !["mover", "a"].includes(k))) p.push(`dado[${i}]: { "mover": "texto", "a": "${G}" }`); return; } if (!d || !isText(d.agregar) || Object.keys(d).some((k) => !["agregar", "campos"].includes(k))) p.push(`dado[${i}]: tiene que ser { "agregar": "texto", "campos"?: {…} } (o { "mover": "texto", "a": "${G}" })`); else if (d.campos && (typeof d.campos !== "object" || !Object.values(d.campos).every(isText))) p.push(`dado[${i}].campos: { "nombre del campo": "valor" }`); });
  }
  // hago: UNA acción
  if (row.hago != null) {
    const ks = Object.keys(row.hago || {}).filter((k) => HAGO.includes(k));
    if (ks.length !== 1) p.push(`"hago" tiene que tener UNA acción de: ${HAGO.join(", ")}`);
    const k = ks[0];
    if (k === "mover" && !isText(row.hago.a)) p.push(`"mover" necesita "a": el nombre del contenedor de destino`);
    if (k === "recargar" && row.hago.recargar !== true) p.push(`"recargar" va como "recargar": true`);
    if (k && k !== "recargar" && !isText(row.hago[k])) p.push(`"${k}" necesita el texto de ${I}`);
    if (row.hago.campos && (typeof row.hago.campos !== "object" || !Object.values(row.hago.campos).every(isText))) p.push(`"hago.campos": { "nombre del campo": "valor" }`);
  }
  // veo: lista, cada uno de un tipo
  if (!Array.isArray(row.veo) || !row.veo.length) p.push(`"veo" es una lista con al menos una cosa que tiene que pasar`);
  else row.veo.forEach((v, i) => {
    const t = VEO.find((k) => v && k in v);
    if (!t) { p.push(`veo[${i}]: tipo desconocido (usá: ${VEO.join(", ")})`); return; }
    if (t === "esta" && !isText(v.esta)) p.push(`veo[${i}].esta: el texto que tiene que verse`);
    if (t === "no_esta" && !isText(v.no_esta)) p.push(`veo[${i}].no_esta: el texto que no tiene que verse`);
    if (t === "contiene" && (!isText(v.en_item) || !texts(v.contiene))) p.push(`veo[${i}]: { "en_item": "texto de ${I}", "contiene": ["…"] }`);
    if (t === "orden" && (!texts(v.orden) || v.orden.length < 2 || !isText(v.en))) p.push(`veo[${i}]: { "orden": ["arriba", "abajo"…], "en": "contenedor" }`);
    if (t === "contador" && (!isText(v.contador) || (typeof v.cambia !== "number" && typeof v.vale !== "number"))) p.push(`veo[${i}]: { "contador": "contenedor", "cambia": ±n } o { …, "vale": n }`);
    if (t === "control" && !texts(v.control)) p.push(`veo[${i}]: { "control": ["palabras del botón"], "solo_en"?: "contenedor" }`);
    if (t === "al_pasar" && (!texts(v.al_pasar) || !isText(v.en_item))) p.push(`veo[${i}]: { "al_pasar": ["lo que aparece"], "en_item": "texto de ${I}" }`);
    if (t === "pregunta" && (!isText(v.pregunta) || !row.hago?.eliminar)) p.push(`veo[${i}]: { "pregunta": "texto" } va con "hago": { "eliminar": … } (lo que pregunta al borrar, antes de confirmar)`);
    if (t === "centrado" && v.centrado !== "grupos" && !(v.centrado && texts(v.centrado.control))) p.push(`veo[${i}]: { "centrado": "grupos" } o { "centrado": { "control": ["palabras", "del", "botón"] } }`);
    if (t === "desborde" && !isText(v.desborde)) p.push(`veo[${i}]: { "desborde": "${G}" } (con muchos ítems creados en "dado")`);
    if (t === "color_en_item" && (!isText(v.color_en_item) || !FAMILIAS.includes(v.familia))) p.push(`veo[${i}]: { "color_en_item": "texto de ${I}", "texto"?: "…", "familia": ${FAMILIAS.join(" | ")} }`);
    if (t === "estilo") {
      const e = v.estilo || {};
      const deOk = e.de === "pagina" || (e.de && typeof e.de === "object" && Object.keys(e.de).length === 1 && (isText(e.de.grupo) || isText(e.de.item) || texts(e.de.control)));
      if (!deOk) p.push(`veo[${i}].estilo.de: "pagina" | { "${G}": "nombre" } | { "${I}": "texto" } | { "control": ["palabras"] }`);
      if (!PROPS.includes(e.prop)) p.push(`veo[${i}].estilo.prop: una de ${PROPS.join(", ")}`);
      const val = e.valor;
      const okVal = (x) => isText(x) && (/^#[0-9a-f]{6}$/i.test(x) || /^-?\d+(\.\d+)?px$/.test(x) || /^[a-z-]+$/.test(x));
      if (!(okVal(val) || (Array.isArray(val) && val.length && val.every(okVal)) || (val && typeof val === "object" && isText(val.distinto)))) p.push(`veo[${i}].estilo.valor: "#rrggbb", "Npx", una palabra (dashed, scroll…), una lista de esas, o { "distinto": "none" }`);
    }
  });
  // v0.2 (1ª corrida real de Qwen, 17/10): claves de más adentro de hago / veo / dado, y los textos tienen que tener sentido
  p.push(...shapeExtras(row, I), ...(ctx.features ? meaningProblems(row, ctx.features, g) : []));
  // el QUÉ, no el CÓMO
  const flat = JSON.stringify({ dado: row.dado, hago: row.hago, veo: row.veo });
  const how = flat.match(HOW);
  if (how) p.push(`nombra cómo está programado ("${how[0].trim().replace(/^["'(]/, "")}"): la planilla dice lo que ve una persona, sin clases, ids ni código`);
  return { ok: !p.length, problems: p };
}

// ---------- v0.2: forma exacta y sentido (1ª corrida real de Qwen sobre c22, 17/10: 30/68 contra la vara) ----------
const VEO_KEYS = { centrado: ["centrado"], pregunta: ["pregunta"], desborde: ["desborde"], esta: ["esta", "en"], no_esta: ["no_esta", "en"], contiene: ["en_item", "contiene"], orden: ["orden", "en"], contador: ["contador", "cambia", "vale"], control: ["control", "solo_en"], al_pasar: ["al_pasar", "en_item"], estilo: ["estilo"], color_en_item: ["color_en_item", "texto", "familia"] };
const HAGO_KEYS = { agregar: ["agregar", "campos"], editar: ["editar", "a", "campos"], eliminar: ["eliminar"], mover: ["mover", "a", "manija"], recargar: ["recargar"], pasar_mouse: ["pasar_mouse"] };
const CSS_WORD = /^(padding|margin|border|border-radius|width|height|color|background|background-color|font|font-size|box-shadow|overflow|display)$/i;
function shapeExtras(row, I) {
  const p = [];
  const k = Object.keys(row.hago || {}).find((x) => HAGO_KEYS[x]);
  if (k) { const extra = Object.keys(row.hago).filter((x) => !HAGO_KEYS[k].includes(x)); if (extra.length) p.push(`"hago" con ${k} no lleva: ${extra.join(", ")} (UNA acción; lo demás no se ejecuta)`); }
  (Array.isArray(row.veo) ? row.veo : []).forEach((v, i) => {
    const t = VEO.find((x) => v && x in v);
    if (!t) return;
    const extra = Object.keys(v).filter((x) => !VEO_KEYS[t].includes(x));
    if (extra.length) p.push(`veo[${i}] (${t}) no lleva: ${extra.join(", ")}${t === "esta" && extra.includes("en_item") ? ` — para "dentro de ${I}" usá { "en_item": …, "contiene": [ … ] }` : ""}`);
    if (t === "contador" && v.cambia === 0) p.push(`veo[${i}]: "cambia": 0 no prueba nada`);
  });
  for (const c of [row.hago?.campos, ...(row.dado || []).map((d) => d?.campos)].filter(Boolean)) {
    const css = Object.keys(c).filter((x) => CSS_WORD.test(x));
    if (css.length) p.push(`"campos" son los campos del formulario de la app (titulo, descripcion, prioridad…), no estilos: ${css.join(", ")}`);
    if ("titulo" in c) p.push(`"campos" no lleva "titulo": el título es el texto de "agregar"`);
  }
  return p;
}
/** Textos que la fila CREA (dado, agregar, editar → a, valores de campos). */
function createdTexts(row) {
  const out = new Set();
  for (const d of row.dado || []) { if (d?.agregar) out.add(d.agregar); Object.values(d?.campos || {}).forEach((x) => out.add(String(x))); }
  if (row.hago?.agregar) out.add(row.hago.agregar);
  if (row.hago?.editar && row.hago?.a) out.add(row.hago.a);
  Object.values(row.hago?.campos || {}).forEach((x) => out.add(String(x)));
  return out;
}
/** Problemas de SENTIDO: textos "QA" que nadie creó, contenedores que el usuario no nombró, textos que no se ven tal cual. */
export function meaningProblems(row0, features, g) {
  const p = [];
  const row = filaATipos(row0, g), G = palabra(g, "grupo");
  const NOT_BOX = notBox(g);
  const all = nrm(features.join(" \n "));
  const said = (x) => all.includes(nrm(x));
  const made = createdTexts(row);
  const isQA = (x) => /^qa\b/i.test(String(x).trim());
  const card = (x, where) => { if (!isText(x)) return; if (!made.has(x)) p.push(`${where}: "${x}" no se creó en esta fila (ponelo en "dado")`); };
  const box = (x, where) => { if (!isText(x)) return; if (isQA(x)) p.push(`${where}: "${x}" es un contenedor: va con el nombre que escribió el usuario, sin "QA"`); else if (/,/.test(x)) p.push(`${where}: "${x}" es una lista: va UN contenedor`); else if (NOT_BOX.test(nrm(x))) p.push(`${where}: "${x}" no es un contenedor que vea una persona (es un campo o una pieza del código); usá el nombre de ${G}`); else if (!said(x)) p.push(`${where}: el usuario no nombra ningún contenedor "${x}" (usá los nombres de los requisitos, p. ej. ${palabra(g, "grupo", true)})`); };
  const seen = (x, where) => { if (!isText(x)) return; if (NOT_BOX.test(nrm(x))) p.push(`${where}: "${x}" es el nombre de un campo o de una pieza del código, no un texto que se vea en la pantalla`); else if (/['"“”«»]/.test(x)) p.push(`${where}: "${x}" va sin comillas, tal como se ve en la pantalla`); else if (/^bot[oó]n\b/i.test(x)) p.push(`${where}: "${x}": para un botón usá { "control": ["palabras del botón"] }`); else if (isQA(x)) { if (!made.has(x)) p.push(`${where}: "${x}" no se creó en esta fila`); } else if (!said(x)) p.push(`${where}: "${x}" no lo escribió el usuario (los textos de prueba empiezan con "QA" y se crean en la fila)`); };
  const h = row.hago || {};
  if (h.agregar && (row.dado || []).some((d) => d?.agregar === h.agregar)) p.push(`"hago.agregar": "${h.agregar}" ya se creó en "dado" (si la acción es crear, no va en dado)`);
  for (const k of ["editar", "eliminar", "mover", "pasar_mouse"]) if (h[k]) card(h[k], `hago.${k}`);
  if (h.mover) box(h.a, "hago.mover → a");
  (row.dado || []).forEach((d, i) => { if (d?.mover) { card(d.mover, `dado[${i}].mover`); box(d.a, `dado[${i}].a`); } });
  (Array.isArray(row.veo) ? row.veo : []).forEach((v, i) => {
    const w = `veo[${i}]`;
    if (!v || typeof v !== "object") return;
    if ("esta" in v) { seen(v.esta, w); if (v.en) box(v.en, `${w}.en`); }
    if ("no_esta" in v) { seen(v.no_esta, w); if (v.en) box(v.en, `${w}.en`); }
    if ("contiene" in v) { card(v.en_item, `${w}.en_item`); (v.contiene || []).forEach((x) => seen(x, `${w}.contiene`)); }
    if ("orden" in v) {
      (v.orden || []).forEach((x) => card(x, `${w}.orden`)); box(v.en, `${w}.en`);
      // 2ª corrida (R16): crear Alta, Media, Baja y esperar Alta, Media, Baja no prueba que ordene
      const created = (row.dado || []).map((d) => d?.agregar).filter((x) => (v.orden || []).includes(x));
      if (created.length >= 2 && created.join("\u0001") === (v.orden || []).filter((x) => created.includes(x)).join("\u0001")) p.push(`${w}.orden: es el mismo orden en que se crean en "dado": no prueba que la app ordene (creálos en otro orden)`);
    }
    if ("contador" in v) box(v.contador, `${w}.contador`);
    if ("control" in v) { (v.control || []).forEach((x) => { if (/['"“”«»]/.test(x)) p.push(`${w}.control: "${x}" va sin comillas: las palabras del botón`); else if (/^bot[oó]n\b/i.test(x)) p.push(`${w}.control: "${x}": solo las palabras del botón, sin "botón"`); else if (!said(x)) p.push(`${w}.control: "${x}" no está en lo que escribió el usuario`); }); if (v.solo_en) box(v.solo_en, `${w}.solo_en`); }
    if ("al_pasar" in v) { card(v.en_item, `${w}.en_item`); (v.al_pasar || []).forEach((x) => seen(x, `${w}.al_pasar`)); }
    if ("color_en_item" in v) { card(v.color_en_item, `${w}.color_en_item`); }
    if ("desborde" in v) box(v.desborde, `${w}.desborde`);
    if ("pregunta" in v && isText(v.pregunta) && !said(v.pregunta)) p.push(`${w}.pregunta: "${v.pregunta}" no lo escribió el usuario`);
    if ("estilo" in v) { const de = v.estilo?.de; if (de?.grupo) box(de.grupo, `${w}.estilo.de.${G}`); if (de?.item) card(de.item, `${w}.estilo.de.${palabra(g, "item")}`); if (de?.control) de.control.forEach((x) => { if (!said(x)) p.push(`${w}.estilo.de.control: "${x}" no está en lo que escribió el usuario`); }); }
  });
  return p;
}
const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['"“”«»]/g, "").replace(/\s+/g, " ").trim();
// nombres de CAMPOS o de piezas del código, no contenedores que ve una persona (2ª corrida: "en": "title", "counter"),
// más los nombres de los tipos en esta app (en el Kanban, "tarjeta" no es el nombre de una columna)
const NOT_BOX_WORDS = ["title", "titulo", "counter", "contador", "header", "body", "div", "top", "actions?", "card", "item", "modal", "lista", "list", "contenedor", "container", "boton", "button"];
const notBox = (g) => { const gl = leerGlosario(g).glosario; const own = [gl.item, gl.grupo].filter(Boolean).map((x) => nrm(x).replace(/[^a-z ]/g, "")); return new RegExp(`^(${[...NOT_BOX_WORDS, ...own].join("|")})(s|es)?$`, "i"); };

/** Lleva a la forma exacta lo que Qwen escribe "casi bien" (sin modelo). Devuelve { row, cambios[] }. */
export function normalizeRow(row0, g) {
  const row = JSON.parse(JSON.stringify(filaATipos(row0 || {}, g) || {}));
  const I = palabra(g, "item"), PRE = prefijoDe(g, "grupo");
  const cambios = [];
  if (!row || typeof row !== "object") return { row, cambios };
  // dado / hago vacíos → afuera; campos vacíos → afuera
  if (Array.isArray(row.dado) && !row.dado.length) delete row.dado;
  if (row.hago && typeof row.hago === "object") { if (row.hago.campos && !Object.keys(row.hago.campos).length) delete row.hago.campos; if (!Object.keys(row.hago).length) delete row.hago; }
  for (const d of row.dado || []) if (d?.campos && !Object.keys(d.campos).length) delete d.campos;
  const made = () => [...(row.dado || []).map((d) => d?.agregar).filter(Boolean), row.hago?.agregar].filter(Boolean);
  const ensureCard = () => { const m = made(); if (m.length) return m[0]; row.dado = [...(row.dado || []), { agregar: "QA Alfa" }]; cambios.push(`agregó "dado": QA Alfa (el estilo es de ${I} y la fila no creaba ningún ítem)`); return "QA Alfa"; };
  const PROP_ALIAS = { "border-radius": "border-top-left-radius", "border-style": "border-top-style", overflow: "overflow-y", background: "background-color" };
  if (row.hago?.pasar_mouse && isText(row.hago.en_item)) { cambios.push(`hago: pasar_mouse "${row.hago.pasar_mouse}" en "${row.hago.en_item}" → pasar_mouse "${row.hago.en_item}"`); row.hago = { pasar_mouse: row.hago.en_item }; }
  // "columna Pendiente" → "Pendiente" (con el nombre de los grupos de esta app)
  const unCol = (x) => (typeof x === "string" && PRE.test(nrm(x)) && nrm(x).replace(PRE, "") ? x.trim().replace(new RegExp(`^\\S+\\s+`), "").replace(/['"“”]/g, "") : x);
  if (row.hago?.mover && row.hago.a !== unCol(row.hago.a)) { cambios.push(`hago.a: "${row.hago.a}" → "${unCol(row.hago.a)}"`); row.hago.a = unCol(row.hago.a); }
  (Array.isArray(row.veo) ? row.veo : []).forEach((v, i) => {
    if (!v || typeof v !== "object") return;
    // control: las PALABRAS del botón (2ª corrida: ["Botón 'Agregar tarjeta'"])
    const words = (arr) => arr.flatMap((x) => String(x).replace(/['"“”«»]/g, " ").replace(/\bbot[oó]n\b/gi, " ").split(/\s+/)).filter(Boolean);
    for (const holder of [v, v.estilo?.de]) if (holder && Array.isArray(holder.control) && holder.control.some((x) => /['"“”«»]|\bbot[oó]n\b|\s/i.test(String(x)))) { const w = words(holder.control); cambios.push(`veo[${i}] control: ${JSON.stringify(holder.control)} → ${JSON.stringify(w)}`); holder.control = w; }
    if ("esta" in v && isText(v.en_item) && !("contiene" in v)) { cambios.push(`veo[${i}]: esta "${v.esta}" con en_item → { en_item, contiene }`); row.veo[i] = v = { en_item: v.en_item, contiene: [v.esta] }; }
    for (const k of ["en", "solo_en", "contador"]) if (typeof v[k] === "string" && v[k] !== unCol(v[k])) { cambios.push(`veo[${i}].${k}: "${v[k]}" → "${unCol(v[k])}"`); v[k] = unCol(v[k]); }
    if (v && Array.isArray(v.al_pasar) && v.al_pasar.some(Array.isArray)) { v.al_pasar = v.al_pasar.flat(); cambios.push(`veo[${i}].al_pasar: lista aplanada`); }
    const e = v?.estilo;
    if (!e) return;
    if (typeof e.de === "string") {
      const d = e.de.trim(), dn = nrm(d);
      let to = null;
      if (/^(pagina|fondo|body|la pagina)$/.test(dn)) to = "pagina";
      else if (PRE.test(dn) && dn.replace(PRE, "")) to = { grupo: d.replace(/^\S+\s+/, "").replace(/['"“”]/g, "") };
      else if (tipoDe(g, dn) === "item") to = { item: ensureCard() };
      else if (made().includes(d)) to = { item: d };
      else if (/^bot[oó]n\s+\S/.test(dn)) to = { control: d.replace(/^bot[oó]n\s+/i, "").replace(/['"“”]/g, "").split(/\s+/).filter(Boolean) };
      if (to) { cambios.push(`veo[${i}].estilo.de: "${d}" → ${JSON.stringify(to)}`); e.de = to; }
    }
    if (PROP_ALIAS[e.prop]) { cambios.push(`veo[${i}].estilo.prop: ${e.prop} → ${PROP_ALIAS[e.prop]}`); e.prop = PROP_ALIAS[e.prop]; }
    if (e.prop === "border" && typeof e.valor === "string") { const st = e.valor.match(/\b(dashed|solid|dotted|double|none)\b/); if (st) { cambios.push(`veo[${i}].estilo: border "${e.valor}" → border-top-style ${st[1]}`); e.prop = "border-top-style"; e.valor = st[1]; } }
    if (e.prop === "box-shadow" && typeof e.valor === "string" && e.valor !== "none") { cambios.push(`veo[${i}].estilo.valor: sombra "${e.valor}" → distinta de none (el usuario pidió sombra, no esa exacta)`); e.valor = { distinto: "none" }; }
  });
  return { row, cambios };
}

// ---------- el pedido ----------
export function systemPrompt(g) {
  const I = palabra(g, "item"), G = palabra(g, "grupo");
  return `Escribís la PLANILLA DE COMPORTAMIENTOS de UN requisito de una app web: lo que una persona haría y vería para comprobar que el requisito está cumplido. Validation la ejecuta en un navegador real, sin mirar el código.

Respondé SOLO con JSON: { "filas": [ … ] }  o, si el requisito NO se puede comprobar usando la app (dice cómo está programada por dentro), { "sin_fila": "motivo corto" }.

Una fila: { "r": "Rn", "dado": [ … ]?, "hago": { … }?, "veo": [ … ] }
- "dado": ${palabra(g, "item", true)} que se crean ANTES, con la app: [{ "agregar": "QA Alfa", "campos": { "prioridad": "alta" } }]. Opcional.
- "hago": UNA acción, opcional:
  { "agregar": "QA Alfa", "campos": { "descripcion": "QA detalle", "prioridad": "media" } }
  { "editar": "QA Alfa", "a": "QA Beta", "campos": { … } }    { "eliminar": "QA Alfa" }
  { "mover": "QA Alfa", "a": "nombre del contenedor destino" }    { "recargar": true }    { "pasar_mouse": "QA Alfa" }
- "veo": lista; TODO tiene que cumplirse:
  { "esta": "QA Alfa", "en": "nombre del contenedor"? }    { "no_esta": "QA Alfa" }
  { "en_item": "QA Alfa", "contiene": ["alta"] }    { "orden": ["QA Primera", "QA Segunda"], "en": "contenedor" }  (de arriba abajo)
  { "contador": "contenedor", "cambia": 1 } o { "contador": "contenedor", "vale": 2 }
  { "control": ["palabras", "del", "botón"], "solo_en": "contenedor"? }
  { "al_pasar": ["🗑️"], "en_item": "QA Alfa" }   (oculto antes de pasar el mouse por ${I}, visible después)
  { "estilo": { "de": "pagina" | { "${G}": "nombre" } | { "${I}": "QA Alfa" } | { "control": ["palabras"] }, "prop": "background-color", "valor": "#102C54" } }
     prop: ${PROPS.join(", ")}. valor: "#rrggbb" exacto, "Npx", una palabra (dashed, scroll…), una lista de esas, o { "distinto": "none" }.
  { "color_en_item": "QA Alfa", "texto": "alta", "familia": "rojo" | "amarillo" | "verde" }

Reglas:
1. SOLO lo que dice ESE requisito. No agregues comportamientos ni copies lo de otros requisitos.
2. "QA " es SOLO para lo que la fila crea (en "dado" o en "hago": "QA Alfa", "QA Beta"). Todo texto "QA" que aparece en "veo" tiene que haberse creado en la MISMA fila.
3. Nombres de ${palabra(g, "grupo", true)}/contenedores, palabras de botones, valores y colores: tal cual los escribió el usuario, SIN "QA" y sin comillas.
4. Nada de cómo está programado: sin clases, ids, nombres de funciones, etiquetas HTML ni selectores. Si el requisito solo dice eso, es "sin_fila".
5. Si el requisito tiene varias partes (p. ej. tres prioridades, o colores de varias cosas), una fila por parte.
6. Medidas y colores, como números exactos que dijo el usuario. Si dice "color rojo" sin código, usá color_en_item. Si dice "con sombra" sin valor, { "distinto": "none" }.
7. "campos" son los campos del formulario de la app (descripcion, prioridad…), nunca estilos. El título es el texto de "agregar".

Ejemplos (otra app: lista de recetas, cada receta es ${I}, con ${G} "Favoritas").
R2: "Al borrar una receta, desaparece de la lista y baja el total."
{ "filas": [ { "r": "R2", "dado": [{ "agregar": "QA Tarta" }], "hago": { "eliminar": "QA Tarta" }, "veo": [{ "no_esta": "QA Tarta" }, { "contador": "Recetas", "cambia": -1 }] } ] }
R5: "Las recetas tienen fondo #FFF8E7, sombra y miden 300px de ancho."
{ "filas": [ { "r": "R5", "dado": [{ "agregar": "QA Sopa" }], "veo": [{ "estilo": { "de": { "${I}": "QA Sopa" }, "prop": "background-color", "valor": "#FFF8E7" } }, { "estilo": { "de": { "${I}": "QA Sopa" }, "prop": "box-shadow", "valor": { "distinto": "none" } } }, { "estilo": { "de": { "${I}": "QA Sopa" }, "prop": "width", "valor": "300px" } }] } ] }
R7: "Cada receta es un div 'card' con un header y un body."
{ "sin_fila": "dice cómo está armada por dentro; no es algo que una persona haga o vea" }`;
}

export function userPrompt({ id, text, features, context }) {
  return `${context ? `Proyecto: ${context}\n\n` : ""}Todos los requisitos (contexto; NO los escribas, solo el pedido):\n${features.map((f, i) => `R${i + 1}. ${f}`).join("\n")}\n\nEscribí la planilla SOLO de ${id}: "${text}"`;
}

export const callLM = async (messages) => {
  const r = await fetch(LM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, temperature: 0, max_tokens: 1800 }) });
  if (!r.ok) throw new Error(`LM Studio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { content: j.choices?.[0]?.message?.content || "", finish_reason: j.choices?.[0]?.finish_reason, usage: j.usage };
};

/** 19/10: Qwen propone el GLOSARIO de la app (cómo se llaman lo que el usuario crea y los grupos donde está). Miche lo
 *  revisa junto con la planilla. Si la respuesta no sirve, queda el genérico (elemento, grupo) y se dice. */
export async function proponerGlosario({ features, context = "", call = callLM }) {
  // v0.2 (19/10, 1ª corrida con project26): Qwen dijo que el Kanban NO tiene grupos, y sin grupos se quedaron sin
  // pruebas mover, contadores, orden y la restricción de Completa. Ahora: las palabras se copian de los requisitos (el
  // harness lo verifica) y un "no tiene grupos" se vuelve a preguntar una vez, señalando los nombres entre comillas.
  const sys = `Leés los requisitos de una app web y decís cómo se llaman, EN ESA APP, dos cosas:
- "item": lo que el usuario crea, edita y borra. Copiá la palabra tal cual aparece en los requisitos, en singular.
- "grupo": el lugar con nombre propio donde están esos ítems (los requisitos suelen nombrar cada uno entre comillas, y a veces se pasan ítems de uno a otro). Copiá la palabra tal cual aparece, en singular. null SOLO si los ítems no están repartidos en lugares con nombre.
Respondé SOLO JSON: { "item": "…", "grupo": "…" | null, "por_que": "el número de requisito donde lo dice" }`;
  const user = `${context ? `Proyecto: ${context}\n\n` : ""}Requisitos:\n${features.map((f, i) => `R${i + 1}. ${f}`).join("\n")}`;
  const todo = nrm(features.join(" \n "));
  const esta = (w) => { const x = nrm(w); return !!x && (todo.includes(x) || todo.includes(x.replace(/s$/, ""))); };
  const citados = [...features.join(" ").matchAll(/['"“‘«]([^'"”’»]{2,30})['"”’»]/g)].map((m) => m[1]);
  const messages = [{ role: "system", content: sys }, { role: "user", content: user }];
  const crudos = [];
  try {
    for (let intento = 1; intento <= 3; intento++) {
      const r = await call(messages);
      crudos.push(r.content);
      const j = parseJsonLoose(r.content || "");
      const g = j.ok ? { item: j.data?.item ? String(j.data.item).toLowerCase().trim() : null, grupo: j.data?.grupo ? String(j.data.grupo).toLowerCase().trim() : null } : null;
      const problemas = [];
      if (!g || !g.item) problemas.push(`falta "item"`);
      else if (!esta(g.item)) problemas.push(`"${g.item}" no aparece en los requisitos: copiá la palabra tal cual`);
      if (g?.grupo && !esta(g.grupo)) problemas.push(`"${g.grupo}" no aparece en los requisitos: copiá la palabra tal cual`);
      // 2ª corrida (19/10): respondió "pendiente", que es el NOMBRE de uno de los lugares, no la palabra que los engloba
      if (g?.grupo && citados.some((c) => nrm(c) === nrm(g.grupo))) problemas.push(`"${g.grupo}" es el NOMBRE de uno de esos lugares; el grupo es la palabra que dice QUÉ SON (${[...new Set(citados)].slice(0, 3).map((x) => `"${x}"`).join(", ")} son… ¿qué?)`);
      if (g && !g.grupo && citados.length >= 2 && intento === 1) problemas.push(`dijiste que no hay grupos, pero los requisitos nombran entre comillas: ${[...new Set(citados)].slice(0, 6).map((x) => `"${x}"`).join(", ")}. Si los ítems están repartidos en esos lugares, el grupo es la palabra que dice QUÉ SON esos lugares (no uno de los nombres). Si de verdad no hay, repetí null`);
      if (!problemas.length && leerGlosario(g).ok) return { glosario: g, raw: crudos };
      if (intento === 3) return g && g.item && esta(g.item) && leerGlosario(g).ok ? { glosario: g, raw: crudos, aviso: problemas.join("; ") } : { glosario: null, raw: crudos, problema: problemas.join("; ") || "la respuesta no es un glosario válido" };
      messages.push({ role: "assistant", content: r.content }, { role: "user", content: `Revisá: ${problemas.join("; ")}. Respondé de nuevo el JSON.` });
    }
  } catch (e) { return { glosario: null, problema: e.message }; }
}

/** Escribe la planilla de un requisito, con reintentos. call(messages) → {content}: inyectable (tests). */
export async function writeRequirement({ id, text, features, context = "", call = callLM, modo = "plantillas", glosario = null }) {
  const n = features.length;
  const tpl = modo === "plantillas";
  const messages = [{ role: "system", content: tpl ? systemPromptPlantillas(glosario) : systemPrompt(glosario) }, { role: "user", content: userPrompt({ id, text, features, context }) }];
  const calls = [];
  let last = null;
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    let res, parsed, problems = [];
    try { res = await call(messages); } catch (e) { calls.push({ attempt: a, error: e.message }); last = { error: e.message }; continue; }
    try { const j = parseJsonLoose(res.content); parsed = j.ok ? j.data : null; } catch { parsed = null; }
    if (!parsed || typeof parsed !== "object") problems.push("la respuesta no es JSON");
    else if (isText(parsed.sin_fila) && !(parsed.filas || []).length && !(parsed.usa || []).length) { calls.push({ attempt: a, raw: res.content, usage: res.usage, sin_fila: parsed.sin_fila }); return { id, sin_fila: parsed.sin_fila, filas: [], rejected: [], calls }; }
    else if (tpl && (!Array.isArray(parsed.usa) || !parsed.usa.length)) problems.push(`falta "usa": la lista de plantillas que aplican (o "sin_fila" con el motivo)`);
    else if (!tpl && (!Array.isArray(parsed.filas) || !parsed.filas.length)) problems.push(`falta "filas" (o "sin_fila" con el motivo)`);
    const good = [], bad = [];
    // modo plantillas: las elecciones de Qwen → filas que arma el harness (las elecciones mal completadas, afuera con su motivo)
    let entrada = tpl ? [] : parsed?.filas || [];
    if (tpl && !problems.length) {
      // v0.3.1: las elecciones que no tienen que ver con el requisito quedan afuera; si falta una parte, el reintento lo dice
      const rel = relevanceProblems(parsed.usa, text);
      const offIdx = new Set(rel.map((x) => Number((x.match(/^elección (\d+)/) || [])[1]) - 1).filter((n) => n >= 0));
      const r = rowsFromChoices(parsed.usa.filter((_, i) => !offIdx.has(i)), id, glosario);
      entrada = r.filas;
      // un AVISO (faltan estilos) pide un reintento solo la 1ª vez: si Qwen insiste, puede ser el CÓMO (p. ej. el ancho del handle)
      [...rel.filter((x) => !/^AVISO/.test(x) || a === 1), ...r.problems].forEach((x) => bad.push({ fila: null, problems: [x] }));
    }
    if (!problems.length) entrada.forEach((f, k) => {
      const { row, cambios } = normalizeRow({ ...f, r: f.r || id }, glosario);
      if (row.r !== id) { bad.push({ fila: f, problems: [`es de ${row.r}, no de ${id}`] }); return; }
      const v = validateRow(row, n, { features, glosario });
      // 2ª corrida (19/10): la misma prueba repetida 3 veces (R23); una basta
      const firma = JSON.stringify({ d: row.dado, h: row.hago, v: row.veo });
      if (v.ok && good.some((g0) => JSON.stringify({ d: g0.dado, h: g0.hago, v: g0.veo }) === firma)) return;
      if (v.ok) good.push({ ...row, id: `${id}.${good.length + 1}`, ...(cambios.length ? { _normalizado: cambios } : {}) }); else bad.push({ fila: f, problems: v.problems });
    });
    calls.push({ attempt: a, raw: res.content, usage: res.usage, finish_reason: res.finish_reason, accepted: good.length, rejected: bad.map((b) => b.problems), problems });
    last = { good, bad, problems };
    if (!problems.length && !bad.length) return { id, filas: good, rejected: [], calls };
    // reintento con los problemas escritos (las filas buenas se piden de nuevo junto con las corregidas)
    const why = [...problems, ...bad.flatMap((b, i) => b.problems.map((x) => (b.fila?._plantilla ? `${b.fila._plantilla}: ${x}` : b.fila === null ? x : `fila ${i + 1}: ${x}`)))];
    messages.push({ role: "assistant", content: res.content }, { role: "user", content: `No cumple el formato:\n- ${why.join("\n- ")}\nRespondé de nuevo el JSON completo de ${id}, corregido.` });
  }
  return { id, filas: last?.good || [], rejected: last?.bad || [], error: last?.error || null, calls };
}

/** La planilla entera. features = refined_prompt.features. */
export async function writePlanilla({ features, context = "", call = callLM, onProgress = null, modo = "plantillas", glosario = null, desde = 0, solo = null }) {
  const out = { version: "planilla v0.1", autor: `${WRITER_VERSION} (${MODEL}, modo ${modo}${modo === "plantillas" ? `, ${PLANTILLAS_VERSION}` : ""})`, modo, ...(glosario ? { glosario } : {}), filas: [], sin_fila: {}, rechazadas: {}, calls: {} };
  // desde (22/10, "agregar"): solo los requisitos nuevos; los anteriores quedan de contexto y los números siguen
  for (const [i, text] of features.entries()) {
    if (i < desde || (solo && !solo.includes(i + 1))) continue; // solo: números de requisito a rehacer (1 = R1)
    const id = `R${i + 1}`;
    const r = await writeRequirement({ id, text, features, context, call, modo, glosario });
    out.filas.push(...r.filas);
    if (r.sin_fila) out.sin_fila[id] = r.sin_fila;
    else if (!r.filas.length) out.sin_fila[id] = `Qwen no dio filas válidas${r.error ? ` (${r.error})` : ""}`;
    if (r.rejected.length) out.rechazadas[id] = r.rejected;
    out.calls[id] = r.calls;
    onProgress?.(id, r);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const snapPath = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!snapPath) { console.log("uso: node profiles/web/validation/planilla_writer.mjs <snapshot.json> [--glosario glosario.json] [--out planilla.json] [--modo plantillas|libre]"); process.exit(2); }
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  const rp = snap.intentForge?.refined_prompt || snap.refined_prompt || snap;
  if (!rp.features?.length) throw new Error("el snapshot no trae refined_prompt.features");
  const context = [rp.project_name, rp.objetivo].filter(Boolean).join(": ");
  const t0 = Date.now();
  const mi = args.indexOf("--modo");
  const modo = mi >= 0 ? args[mi + 1] : "plantillas";
  if (!["plantillas", "libre"].includes(modo)) { console.log('--modo plantillas (por defecto) | libre'); process.exit(2); }
  const gi = args.indexOf("--glosario");
  const glosario = gi >= 0 ? JSON.parse(readFileSync(args[gi + 1], "utf8")) : snap.glosario || null;
  const gl = leerGlosario(glosario);
  if (!gl.ok) { console.log(`[PLANILLA] el glosario no sirve: ${gl.problems.join("; ")}`); process.exit(2); }
  console.log(`[PLANILLA] ${WRITER_VERSION} · modo ${modo} · glosario: ${glosario ? Object.entries(gl.glosario).map(([t, w]) => `${t} = ${w ?? "(no tiene)"}`).join(", ") : "ninguno (se usan palabras genéricas: elemento, grupo)"}`);
  const p = await writePlanilla({ features: rp.features, context, modo, glosario, onProgress: (id, r) => console.log(`[PLANILLA] ${id}: ${r.sin_fila ? `sin fila (${r.sin_fila})` : `${r.filas.length} fila(s)`}${r.rejected.length ? ` · ${r.rejected.length} rechazada(s)` : ""} · ${r.calls.length} llamada(s)`) });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const i = args.indexOf("--out");
  const outPath = i >= 0 ? args[i + 1] : join(dirname(resolve(snapPath)), `planilla_qwen_${stamp}.json`);
  const { calls, ...planilla } = p;
  writeFileSync(outPath, JSON.stringify(planilla, null, 2));
  const evDir = join(dirname(fileURLToPath(import.meta.url)), "../../../evidence/planilla");
  mkdirSync(evDir, { recursive: true });
  writeFileSync(join(evDir, `planilla_${stamp}.json`), JSON.stringify({ type: "EVIDENCE", kind: "planilla_writer", version: WRITER_VERSION, model: MODEL, snapshot: resolve(snapPath), ms: Date.now() - t0, planilla, calls }, null, 2));
  console.log(`[PLANILLA] ${WRITER_VERSION} · ${planilla.filas.length} filas · sin fila: ${Object.keys(planilla.sin_fila).join(", ") || "ninguno"} → ${outPath}  (evidencia en evidence/planilla/)`);
}
