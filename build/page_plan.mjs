// page_plan.mjs — Plan de página: qué secciones tiene la SPA y qué features cubre cada una.
//
// Decisión 02/10 (Miche: "plan de página validado"). Evidencia: el esqueleto
// v0.4 asumía "una feature = una sección". En la landing de café funcionó
// (4 features = 4 secciones), pero en Project22 armaba secciones llamadas
// "Código limpio", "Visualmente atractivo", "Efectos hover" y metía
// Características/Testimonios/Estadísticas/Contacto en una sola "Secciones".
//
// Qwen propone la estructura; el harness la valida (determinista) y con eso se
// arma el esqueleto. Una feature puede ir al header, al footer, a una o varias
// secciones, o ser TRANSVERSAL (estilo, responsive, hover, código): esas no
// generan sección ni ancla data-feature.
//
//   node build/page_plan.mjs snapshot.json [reps]     prueba el plan sin construir nada

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
export const PLAN_MODEL = "qwen2.5-7b-instruct";
export const PAGE_PLAN_VERSION = "page_plan v0.1";

export function slug(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const SYSTEM_PROMPT = `Sos el planificador de estructura de página de MicheLab.

Recibís las features de una SPA (prototipo de UNA sola página), numeradas R1, R2, ...
Tu trabajo: decidir qué partes visibles tiene la página y dónde va cada feature.

Partes posibles:
- "header": la barra superior (logo, navegación). Ahí va una feature de menú o navegación.
- "sections": las secciones de contenido del cuerpo, EN ORDEN de arriba hacia abajo. Cada una con un id corto (minúsculas, sin espacios ni acentos), un título visible en español y las features que muestra.
- "footer": el pie de página.
- "transversales": features que NO son una parte de la página sino una cualidad de toda la página (diseño, colores, tipografía, responsive, animaciones o efectos generales, hover, calidad del código). No generan sección.

Reglas:
1. Cada feature tiene que aparecer al menos una vez: en header, en alguna sección, en footer o en transversales.
2. Si una feature nombra varias secciones (ej. "Secciones: A, B y C"), hacé una sección para cada una y poné esa feature en todas.
3. No inventes secciones que ninguna feature pida.
4. Una sección se llama por lo que muestra ("Catálogo", "Contacto"), nunca por una cualidad ("Diseño moderno", "Código limpio").

Devolvé EXCLUSIVAMENTE este JSON:
{
  "header": { "features": ["R?"] },
  "sections": [ { "id": "...", "titulo": "...", "features": ["R?"] } ],
  "footer": { "features": ["R?"] },
  "transversales": ["R?"]
}`;

function userPrompt(features) {
  return "FEATURES:\n" + features.map((f, i) => `R${i + 1}. ${f}`).join("\n");
}

function parseJsonLoose(raw) {
  const s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (!m) throw new Error("sin JSON"); return JSON.parse(m[0]); }
}

/**
 * Valida y normaliza un plan (determinista). Devuelve {plan, errors}.
 * plan normalizado: {header:{features}, sections:[{id,titulo,features}], footer:{features}, transversales}
 */
export function validatePlan(raw, nFeatures) {
  const errors = [];
  const valid = new Set(Array.from({ length: nFeatures }, (_, i) => `R${i + 1}`));
  const refs = (arr, where) => {
    const out = [];
    for (const r of Array.isArray(arr) ? arr : []) {
      const id = String(r).trim().toUpperCase().replace(/^(\d+)$/, "R$1");
      if (valid.has(id)) { if (!out.includes(id)) out.push(id); }
      else errors.push(`${where}: "${r}" no es una feature (R1..R${nFeatures})`);
    }
    return out;
  };
  if (!raw || typeof raw !== "object") return { plan: null, errors: ["no es un objeto JSON"] };
  const plan = {
    header: { features: refs(raw.header?.features, "header") },
    sections: [],
    footer: { features: refs(raw.footer?.features, "footer") },
    transversales: refs(raw.transversales, "transversales"),
  };
  const ids = new Set(["site-header", "site-footer", "app"]);
  for (const [k, s] of (Array.isArray(raw.sections) ? raw.sections : []).entries()) {
    const titulo = String(s?.titulo || s?.title || "").trim();
    let id = slug(s?.id || titulo);
    if (!titulo) { errors.push(`sección ${k + 1}: sin título`); continue; }
    if (!id) id = `seccion-${k + 1}`;
    if (ids.has(id)) { errors.push(`sección "${titulo}": id repetido "${id}"`); continue; }
    ids.add(id);
    const features = refs(s?.features, `sección "${titulo}"`);
    if (!features.length) errors.push(`sección "${titulo}": no cubre ninguna feature`);
    plan.sections.push({ id, titulo, features });
  }
  if (!plan.sections.length) errors.push("no hay ninguna sección");
  const used = new Set([...plan.header.features, ...plan.footer.features, ...plan.transversales, ...plan.sections.flatMap((s) => s.features)]);
  const missing = [...valid].filter((r) => !used.has(r));
  if (missing.length) errors.push(`features sin lugar en la página: ${missing.join(", ")}`);
  const both = plan.transversales.filter((r) => plan.sections.some((s) => s.features.includes(r)));
  if (both.length) errors.push(`${both.join(", ")}: está como transversal y también en una sección`);
  return { plan, errors };
}

async function askQwen(messages, model) {
  const res = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Pide el plan a Qwen y lo valida; un reintento con los errores como feedback.
 * @returns {Promise<{plan:object|null, errors:string[], attempts:object[], version:string, model:string}>}
 */
export async function planPage(features, opts = {}) {
  const model = opts.model || PLAN_MODEL;
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt(features) }];
  const attempts = [];
  for (let i = 0; i < 2; i++) {
    const raw = await askQwen(messages, model);
    let plan = null, errors;
    try { ({ plan, errors } = validatePlan(parseJsonLoose(raw), features.length)); }
    catch (e) { errors = [`JSON inválido: ${e.message}`]; }
    attempts.push({ raw, errors });
    if (!errors.length) return { plan, errors: [], attempts, version: PAGE_PLAN_VERSION, model };
    messages.push({ role: "assistant", content: raw }, { role: "user", content: `El plan tiene estos problemas:\n- ${errors.join("\n- ")}\nCorregilo y devolvé el JSON completo.` });
  }
  return { plan: null, errors: attempts.at(-1).errors, attempts, version: PAGE_PLAN_VERSION, model };
}

/** Resumen legible del plan. */
export function planText(plan, features = []) {
  if (!plan) return "(sin plan)";
  const f = (ids) => ids.map((r) => r).join(", ") || "—";
  return [
    `header: ${f(plan.header.features)}`,
    ...plan.sections.map((s, i) => `${i + 1}. #${s.id} "${s.titulo}": ${f(s.features)}`),
    `footer: ${f(plan.footer.features)}`,
    `transversales: ${f(plan.transversales)}`,
  ].join("\n");
}

// ---- CLI: probar el plan sobre un snapshot sin construir nada ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [snapPath, repsArg] = process.argv.slice(2);
  if (!snapPath) { console.log("uso: node build/page_plan.mjs snapshot.json [reps]"); process.exit(1); }
  const snap = JSON.parse(readFileSync(snapPath, "utf8"));
  const features = snap.intentForge?.refined_prompt?.features || snap.refined?.features || [];
  const reps = Number(repsArg || 3);
  console.log(features.map((x, i) => `R${i + 1}. ${x}`).join("\n"));
  const results = [];
  for (let r = 1; r <= reps; r++) {
    const out = await planPage(features);
    console.log(`\n#${r} ${out.plan ? "VÁLIDO" : "INVÁLIDO"}${out.attempts.length > 1 ? " (con reintento)" : ""}`);
    console.log(out.plan ? planText(out.plan) : out.errors.join("\n"));
    results.push(out);
  }
  const dir = fileURLToPath(new URL("../evidence/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = `${dir}page_plan_${stamp}.json`;
  writeFileSync(file, JSON.stringify({ experiment: PAGE_PLAN_VERSION, source: snapPath, features, reps, results }, null, 2));
  console.log(`\n→ ${file}`);
}
