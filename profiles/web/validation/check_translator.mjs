// check_translator.mjs — traduce un requisito a chequeos del catálogo cerrado
// (plataforma web: los chequeos los ejecuta Chromium).
//
// Qwen NO escribe código ni selectores: elige tipos de check_catalog.mjs y
// llena sus parámetros (listas de sinónimos en español). El harness descarta
// todo lo que no esté en el catálogo o no cumpla el esquema; si no queda
// ningún chequeo válido, el requisito queda SIN_CHEQUEO (se reporta, nunca
// cuenta como PASS).
//
// Antes de usarlo en el pipeline se valida contra el piloto
// (experiments/exp_translator.mjs): los chequeos que genere para la Feature
// del formulario tienen que dar FAIL en el artefacto real y PASS en el
// contrafactual, igual que el holdout escrito a mano.
//
// Refactor de profiles (05/10): este módulo tiene solo lo de la PLATAFORMA web
// (reglas 1-4 y la última, y el catálogo). Cada profile (landing, app…) le pasa
// `translator = { catalog: [tipos permitidos], rules: [reglas propias] }`; las
// reglas del profile van numeradas entre las de la plataforma. Sin profile,
// falla fuerte: nunca "todas las reglas de todos los tipos" en silencio.
// El anclaje de sección (anchorSections) es de landing: profiles/web/landing/check_postprocess.mjs.

import { CATALOG, CATALOG_VERSION, normalizeCheck } from "./check_catalog.mjs";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const MODEL_DEFAULT = "qwen2.5-7b-instruct";
export const TRANSLATOR_VERSION = "check_translator v0.4";

// Reglas de la plataforma web. Las del profile se insertan entre RULES_BEFORE y RULES_AFTER.
export const RULES_BEFORE = [
  `Usá SOLO tipos del catálogo. Si el requisito no se puede verificar con el catálogo, devolvé "checks": [] y explicá en "sin_chequeo".`,
  `Cubrí CADA parte del requisito. Si dice "A y opcionalmente B", tiene que haber chequeos para A y para B.`,
  `Los parámetros son listas cortas de palabras o raíces en español (2 a 4) que aparecerían ESCRITAS en la página (títulos, etiquetas, botones): incluí sinónimos y raíces ("preferencia", "gusto"). No uses adverbios ni palabras de la redacción del requisito que nadie escribiría en la UI ("actualmente", "disponibles", "opcionalmente").`,
  `"Obligatorio" → field_required o submit_empty_blocked. "Opcional" → field_optional. "Permitir hacer X" → control_visible.`,
];
// La última regla menciona carousel solo si el profile lo tiene en su catálogo
// (si no, le hablaría al modelo de un tipo que no puede usar).
const CAROUSEL_NOTE = " Un carrusel se verifica con carousel, nunca con click_reveals.";
export const RULES_AFTER = [
  `No agregues chequeos de cosas que el requisito no pide. NO inventes interacciones: usá click_reveals solo si el requisito dice explícitamente que algo aparece al hacer clic, abrir o navegar.`,
];
const rulesAfter = (t) => RULES_AFTER.map((r, i) => (i === 0 && t.catalog.includes("carousel") ? r + CAROUSEL_NOTE : r));

/** Valida la configuración de traductor que trae un profile. Falla fuerte. */
function profileTranslator(translator) {
  if (!translator || !Array.isArray(translator.catalog) || !Array.isArray(translator.rules))
    throw new Error("check_translator: falta la configuración del profile ({catalog, rules}); ¿qué profile está activo?");
  const bad = translator.catalog.filter((t) => !CATALOG[t] || CATALOG[t].base);
  if (bad.length) throw new Error(`check_translator: tipos que no están en el catálogo (o son de base): ${bad.join(", ")}`);
  return translator;
}

function catalogText(allowed) {
  return Object.entries(CATALOG)
    .filter(([type, d]) => !d.base && allowed.includes(type)) // los chequeos de base los corre el harness
    .map(([type, d]) => {
      const p = Object.keys(d.params).length ? ` params: { ${Object.keys(d.params).map((k) => `"${k}": ["sinónimo", ...]`).join(", ")} }` : " params: {}";
      return `- ${type}: ${d.describe}${p}`;
    })
    .join("\n");
}

export function buildSystemPrompt(translator) {
  const t = profileTranslator(translator);
  const rules = [...RULES_BEFORE, ...t.rules, ...rulesAfter(t)].map((r, i) => `${i + 1}. ${r}`).join("\n");
  return `Sos el traductor de requisitos a chequeos de Validation de MicheLab.

Recibís UN requisito de una SPA (prototipo, backend simulado). Tu trabajo es elegir chequeos del CATÁLOGO que, si pasan, demuestran que el requisito está cumplido en la página. No escribís código ni selectores.

CATÁLOGO (los únicos tipos permitidos):
${catalogText(t.catalog)}

Reglas:
${rules}

Devolvé EXCLUSIVAMENTE este JSON:
{ "checks": [ { "type": "...", "params": { ... }, "covers": "qué parte del requisito verifica" } ], "sin_chequeo": "" }`;
}

function parseJsonLoose(raw) {
  const s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (!m) throw new Error("sin JSON"); return JSON.parse(m[0]); }
}

/**
 * @param {string} requirement
 * @param {{model?:string, context?:string, translator:{catalog:string[], rules:string[]}}} opts  context: brief del proyecto (opcional); translator: del profile (obligatorio)
 * @returns {Promise<{checks:object[], dropped:object[], sin_chequeo:string, raw:string}>}
 */
export async function translateRequirement(requirement, opts = {}) {
  const system = buildSystemPrompt(opts.translator); // falla antes de llamar al modelo
  const user = `${opts.context ? `CONTEXTO DEL PROYECTO:\n${opts.context}\n\n` : ""}REQUISITO:\n${requirement}`;
  const res = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model || MODEL_DEFAULT,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonLoose(raw);
  const checks = [], dropped = [];
  for (const c of parsed.checks || []) {
    const n = CATALOG[c?.type]?.base || !opts.translator.catalog.includes(c?.type) ? null : normalizeCheck(c);
    if (n) checks.push({ ...n, covers: String(c.covers || "") });
    else dropped.push(c);
  }
  return { checks, dropped, sin_chequeo: String(parsed.sin_chequeo || ""), raw, versions: { translator: TRANSLATOR_VERSION, catalog: CATALOG_VERSION } };
}
