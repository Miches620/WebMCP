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
//   node profiles/web/validation/planilla_writer.mjs <snapshot.json> [--out planilla.json]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonLoose } from "../../../json_loose.mjs";

export const WRITER_VERSION = "planilla_writer v0.1";
const MAX_ATTEMPTS = 3;
const LM_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1/chat/completions";
const MODEL = process.env.PLANILLA_MODEL || process.env.REVIEWER_MODEL || "qwen2.5-7b-instruct";

// ---------- el vocabulario (lo mismo que ejecuta planilla.mjs) ----------
const HAGO = ["agregar", "editar", "eliminar", "mover", "recargar", "pasar_mouse"];
const VEO = ["esta", "no_esta", "contiene", "orden", "contador", "control", "al_pasar", "estilo", "color_en_item"];
const FAMILIAS = ["rojo", "amarillo", "verde"];
const PROPS = ["background-color", "color", "width", "height", "padding", "border-top-style", "border-top-left-radius", "box-shadow", "overflow-y", "font-size", "font-weight"];
// pistas de CÓMO está programado: no van en una planilla (estricto en el QUÉ, flexible en el CÓMO)
const HOW = /(^|[\s"'(])[.#](?![0-9a-f]{6}\b)[a-z][\w-]*|\bclass(name)?\s*=|\bid\s*=|\bdata-[a-z-]+|<\/?[a-z]+[\s>]|\b(querySelector|getElementById|onclick|addEventListener|localStorage\.)/i;

const isText = (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 120;
const texts = (x) => Array.isArray(x) && x.length > 0 && x.every(isText);

/** Una fila contra el vocabulario. Devuelve { ok, problems[] }. Función pura. */
export function validateRow(row, nReq = Infinity) {
  const p = [];
  if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false, problems: ["la fila no es un objeto"] };
  const extra = Object.keys(row).filter((k) => !["id", "r", "dado", "hago", "veo"].includes(k));
  if (extra.length) p.push(`claves que no existen: ${extra.join(", ")} (solo id, r, dado, hago, veo)`);
  if (!/^R\d+$/.test(row.r || "") || Number(String(row.r).slice(1)) > nReq) p.push(`"r" tiene que ser el requisito (R1…R${nReq === Infinity ? "n" : nReq})`);
  // dado: tarjetas que se crean antes
  if (row.dado != null) {
    if (!Array.isArray(row.dado)) p.push(`"dado" es una lista de { "agregar": "texto" }`);
    else row.dado.forEach((d, i) => { if (!d || !isText(d.agregar) || Object.keys(d).some((k) => !["agregar", "campos"].includes(k))) p.push(`dado[${i}]: tiene que ser { "agregar": "texto", "campos"?: {…} }`); else if (d.campos && (typeof d.campos !== "object" || !Object.values(d.campos).every(isText))) p.push(`dado[${i}].campos: { "nombre del campo": "valor" }`); });
  }
  // hago: UNA acción
  if (row.hago != null) {
    const ks = Object.keys(row.hago || {}).filter((k) => HAGO.includes(k));
    if (ks.length !== 1) p.push(`"hago" tiene que tener UNA acción de: ${HAGO.join(", ")}`);
    const k = ks[0];
    if (k === "mover" && !isText(row.hago.a)) p.push(`"mover" necesita "a": el nombre del contenedor de destino`);
    if (k === "recargar" && row.hago.recargar !== true) p.push(`"recargar" va como "recargar": true`);
    if (k && k !== "recargar" && !isText(row.hago[k])) p.push(`"${k}" necesita el texto de la tarjeta`);
    if (row.hago.campos && (typeof row.hago.campos !== "object" || !Object.values(row.hago.campos).every(isText))) p.push(`"hago.campos": { "nombre del campo": "valor" }`);
  }
  // veo: lista, cada uno de un tipo
  if (!Array.isArray(row.veo) || !row.veo.length) p.push(`"veo" es una lista con al menos una cosa que tiene que pasar`);
  else row.veo.forEach((v, i) => {
    const t = VEO.find((k) => v && k in v);
    if (!t) { p.push(`veo[${i}]: tipo desconocido (usá: ${VEO.join(", ")})`); return; }
    if (t === "esta" && !isText(v.esta)) p.push(`veo[${i}].esta: el texto que tiene que verse`);
    if (t === "no_esta" && !isText(v.no_esta)) p.push(`veo[${i}].no_esta: el texto que no tiene que verse`);
    if (t === "contiene" && (!isText(v.en_item) || !texts(v.contiene))) p.push(`veo[${i}]: { "en_item": "texto de la tarjeta", "contiene": ["…"] }`);
    if (t === "orden" && (!texts(v.orden) || v.orden.length < 2 || !isText(v.en))) p.push(`veo[${i}]: { "orden": ["arriba", "abajo"…], "en": "contenedor" }`);
    if (t === "contador" && (!isText(v.contador) || (typeof v.cambia !== "number" && typeof v.vale !== "number"))) p.push(`veo[${i}]: { "contador": "contenedor", "cambia": ±n } o { …, "vale": n }`);
    if (t === "control" && !texts(v.control)) p.push(`veo[${i}]: { "control": ["palabras del botón"], "solo_en"?: "contenedor" }`);
    if (t === "al_pasar" && (!texts(v.al_pasar) || !isText(v.en_item))) p.push(`veo[${i}]: { "al_pasar": ["lo que aparece"], "en_item": "texto de la tarjeta" }`);
    if (t === "color_en_item" && (!isText(v.color_en_item) || !FAMILIAS.includes(v.familia))) p.push(`veo[${i}]: { "color_en_item": "texto de la tarjeta", "texto"?: "…", "familia": ${FAMILIAS.join(" | ")} }`);
    if (t === "estilo") {
      const e = v.estilo || {};
      const deOk = e.de === "pagina" || (e.de && typeof e.de === "object" && (isText(e.de.columna) || isText(e.de.tarjeta) || texts(e.de.control)));
      if (!deOk) p.push(`veo[${i}].estilo.de: "pagina" | { "columna": "nombre" } | { "tarjeta": "texto" } | { "control": ["palabras"] }`);
      if (!PROPS.includes(e.prop)) p.push(`veo[${i}].estilo.prop: una de ${PROPS.join(", ")}`);
      const val = e.valor;
      const okVal = (x) => isText(x) && (/^#[0-9a-f]{6}$/i.test(x) || /^-?\d+(\.\d+)?px$/.test(x) || /^[a-z-]+$/.test(x));
      if (!(okVal(val) || (Array.isArray(val) && val.length && val.every(okVal)) || (val && typeof val === "object" && isText(val.distinto)))) p.push(`veo[${i}].estilo.valor: "#rrggbb", "Npx", una palabra (dashed, scroll…), una lista de esas, o { "distinto": "none" }`);
    }
  });
  // el QUÉ, no el CÓMO
  const flat = JSON.stringify({ dado: row.dado, hago: row.hago, veo: row.veo });
  const how = flat.match(HOW);
  if (how) p.push(`nombra cómo está programado ("${how[0].trim()}"): la planilla dice lo que ve una persona, sin clases, ids ni código`);
  return { ok: !p.length, problems: p };
}

// ---------- el pedido ----------
export function systemPrompt() {
  return `Escribís la PLANILLA DE COMPORTAMIENTOS de UN requisito de una app web: lo que una persona haría y vería para comprobar que el requisito está cumplido. Validation la ejecuta en un navegador real, sin mirar el código.

Respondé SOLO con JSON: { "filas": [ … ] }  o, si el requisito NO se puede comprobar usando la app (dice cómo está programada por dentro), { "sin_fila": "motivo corto" }.

Una fila: { "r": "Rn", "dado": [ … ]?, "hago": { … }?, "veo": [ … ] }
- "dado": tarjetas/elementos que se crean ANTES, con la app: [{ "agregar": "QA Alfa", "campos": { "prioridad": "alta" } }]. Opcional.
- "hago": UNA acción, opcional:
  { "agregar": "QA Alfa", "campos": { "descripcion": "QA detalle", "prioridad": "media" } }
  { "editar": "QA Alfa", "a": "QA Beta", "campos": { … } }    { "eliminar": "QA Alfa" }
  { "mover": "QA Alfa", "a": "nombre del contenedor destino" }    { "recargar": true }    { "pasar_mouse": "QA Alfa" }
- "veo": lista; TODO tiene que cumplirse:
  { "esta": "QA Alfa", "en": "nombre del contenedor"? }    { "no_esta": "QA Alfa" }
  { "en_item": "QA Alfa", "contiene": ["alta"] }    { "orden": ["QA Primera", "QA Segunda"], "en": "contenedor" }  (de arriba abajo)
  { "contador": "contenedor", "cambia": 1 } o { "contador": "contenedor", "vale": 2 }
  { "control": ["palabras", "del", "botón"], "solo_en": "contenedor"? }
  { "al_pasar": ["🗑️"], "en_item": "QA Alfa" }   (oculto antes de pasar el mouse por la tarjeta, visible después)
  { "estilo": { "de": "pagina" | { "columna": "nombre" } | { "tarjeta": "QA Alfa" } | { "control": ["palabras"] }, "prop": "background-color", "valor": "#102C54" } }
     prop: ${PROPS.join(", ")}. valor: "#rrggbb" exacto, "Npx", una palabra (dashed, scroll…), una lista de esas, o { "distinto": "none" }.
  { "color_en_item": "QA Alfa", "texto": "alta", "familia": "rojo" | "amarillo" | "verde" }

Reglas:
1. SOLO lo que dice el requisito. No agregues comportamientos que no están escritos.
2. Textos de prueba que empiecen con "QA " (QA Alfa, QA Beta…). Nombres de contenedores, botones, valores y colores: tal cual los escribió el usuario.
3. Nada de cómo está programado: sin clases, ids, nombres de funciones, etiquetas HTML ni selectores. Si el requisito solo dice eso, es "sin_fila".
4. Si el requisito tiene varias partes (p. ej. tres prioridades, o colores de varias cosas), una fila por parte.
5. Medidas y colores, como números exactos que dijo el usuario. Si dice "color rojo" sin código, usá color_en_item.

Ejemplo (otra app: lista de recetas). Requisito R2: "Al borrar una receta, desaparece de la lista y baja el total."
{ "filas": [ { "r": "R2", "dado": [{ "agregar": "QA Tarta" }], "hago": { "eliminar": "QA Tarta" }, "veo": [{ "no_esta": "QA Tarta" }, { "contador": "Recetas", "cambia": -1 }] } ] }`;
}

export function userPrompt({ id, text, features, context }) {
  return `${context ? `Proyecto: ${context}\n\n` : ""}Todos los requisitos (contexto; NO los escribas, solo el pedido):\n${features.map((f, i) => `R${i + 1}. ${f}`).join("\n")}\n\nEscribí la planilla SOLO de ${id}: "${text}"`;
}

const callLM = async (messages) => {
  const r = await fetch(LM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, temperature: 0, max_tokens: 1800 }) });
  if (!r.ok) throw new Error(`LM Studio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return { content: j.choices?.[0]?.message?.content || "", finish_reason: j.choices?.[0]?.finish_reason, usage: j.usage };
};

/** Escribe la planilla de un requisito, con reintentos. call(messages) → {content}: inyectable (tests). */
export async function writeRequirement({ id, text, features, context = "", call = callLM }) {
  const n = features.length;
  const messages = [{ role: "system", content: systemPrompt() }, { role: "user", content: userPrompt({ id, text, features, context }) }];
  const calls = [];
  let last = null;
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    let res, parsed, problems = [];
    try { res = await call(messages); } catch (e) { calls.push({ attempt: a, error: e.message }); last = { error: e.message }; continue; }
    try { const j = parseJsonLoose(res.content); parsed = j.ok ? j.data : null; } catch { parsed = null; }
    if (!parsed || typeof parsed !== "object") problems.push("la respuesta no es JSON");
    else if (isText(parsed.sin_fila) && !(parsed.filas || []).length) { calls.push({ attempt: a, raw: res.content, usage: res.usage, sin_fila: parsed.sin_fila }); return { id, sin_fila: parsed.sin_fila, filas: [], rejected: [], calls }; }
    else if (!Array.isArray(parsed.filas) || !parsed.filas.length) problems.push(`falta "filas" (o "sin_fila" con el motivo)`);
    const good = [], bad = [];
    if (!problems.length) parsed.filas.forEach((f, k) => {
      const row = { ...f, r: f.r || id };
      if (row.r !== id) { bad.push({ fila: f, problems: [`es de ${row.r}, no de ${id}`] }); return; }
      const v = validateRow(row, n);
      if (v.ok) good.push({ ...row, id: `${id}.${good.length + 1}` }); else bad.push({ fila: f, problems: v.problems });
    });
    calls.push({ attempt: a, raw: res.content, usage: res.usage, finish_reason: res.finish_reason, accepted: good.length, rejected: bad.map((b) => b.problems), problems });
    last = { good, bad, problems };
    if (!problems.length && !bad.length) return { id, filas: good, rejected: [], calls };
    // reintento con los problemas escritos (las filas buenas se piden de nuevo junto con las corregidas)
    const why = [...problems, ...bad.flatMap((b, i) => b.problems.map((x) => `fila ${i + 1}: ${x}`))];
    messages.push({ role: "assistant", content: res.content }, { role: "user", content: `No cumple el formato:\n- ${why.join("\n- ")}\nRespondé de nuevo el JSON completo de ${id}, corregido.` });
  }
  return { id, filas: last?.good || [], rejected: last?.bad || [], error: last?.error || null, calls };
}

/** La planilla entera. features = refined_prompt.features. */
export async function writePlanilla({ features, context = "", call = callLM, onProgress = null }) {
  const out = { version: "planilla v0.1", autor: `${WRITER_VERSION} (${MODEL})`, filas: [], sin_fila: {}, rechazadas: {}, calls: {} };
  for (const [i, text] of features.entries()) {
    const id = `R${i + 1}`;
    const r = await writeRequirement({ id, text, features, context, call });
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
  const snapPath = args.find((a) => !a.startsWith("--"));
  if (!snapPath) { console.log("uso: node profiles/web/validation/planilla_writer.mjs <snapshot.json> [--out planilla.json]"); process.exit(2); }
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  const rp = snap.intentForge?.refined_prompt || snap.refined_prompt || snap;
  if (!rp.features?.length) throw new Error("el snapshot no trae refined_prompt.features");
  const context = [rp.project_name, rp.objetivo].filter(Boolean).join(": ");
  const t0 = Date.now();
  const p = await writePlanilla({ features: rp.features, context, onProgress: (id, r) => console.log(`[PLANILLA] ${id}: ${r.sin_fila ? `sin fila (${r.sin_fila})` : `${r.filas.length} fila(s)`}${r.rejected.length ? ` · ${r.rejected.length} rechazada(s)` : ""} · ${r.calls.length} llamada(s)`) });
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
