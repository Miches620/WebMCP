// check_translator.mjs — traduce un requisito a chequeos del catálogo cerrado.
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

import { CATALOG, CATALOG_VERSION, normalizeCheck } from "./check_catalog.mjs";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const MODEL_DEFAULT = "qwen2.5-7b-instruct";
export const TRANSLATOR_VERSION = "check_translator v0.4";

// Anclaje de sección (determinista, lo hace el harness, no Qwen).
// Evidencia 01/10 (exp_translator_sections): para R1 "Catalogo de cafés en
// tarjetas…" Qwen dio section = ["cafés","tarjetas"] en 5/5 y nunca
// "catalogo": una sección titulada "Catálogo" no se encontraba (0/5).
//   1) se agregan las palabras de la etiqueta de la feature (la misma que usa
//      el esqueleto para el título y el id de su sección);
//   2) se agrega feature = "Rn": si la página tiene <section data-feature="Rn">
//      (esqueleto v0.4) el chequeo usa ESA sección, sin adivinar por palabras.
const STOP = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "con", "para", "seccion"]);
// Palabras que DESCRIBEN la pieza y nadie escribe en la página (02/10, Project22
// --retranslate: aun con la regla en el prompt, Qwen pidió control_visible con
// "llamada a la acción" / "botón" para el CTA del hero → FAIL falso). El harness
// las saca de text_visible/control_visible; si no queda nada, un control_visible
// pasa a section_control de la sección que el mismo requisito ya chequea, y un
// text_visible se descarta (la sección ya la cubre su chequeo de contenido).
const DESCRIPTOR = /^(titulo|subtitulo|boton|botones|llamada a la accion|llamada|accion|cta|call to action|pie|pie de pagina|footer|seccion|secciones|enlace|enlaces|link|links|encabezado|header|formulario)$/;
const nrmw = (w) => String(w || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function dropDescriptorWords(checks) {
  const sectionOf = checks.find((c) => Array.isArray(c.params?.section) && c.params.section.length)?.params.section;
  const out = [];
  for (const c of checks) {
    if (c.type !== "text_visible" && c.type !== "control_visible") { out.push(c); continue; }
    const text = (c.params?.text || []).filter((w) => !DESCRIPTOR.test(nrmw(w)));
    if (text.length) { out.push(text.length === c.params.text.length ? c : { ...c, params: { ...c.params, text } }); continue; }
    if (c.type === "control_visible" && sectionOf) out.push({ type: "section_control", params: { section: sectionOf }, covers: c.covers });
    // text_visible solo con palabras descriptivas: se descarta
  }
  return out;
}

export function anchorSections(checks, rid, requirementText, label) {
  const lbl = label || String(requirementText || "").match(/['"“‘«]([^'"”’»]{2,40})['"”’»]/)?.[1]
    || String(requirementText || "").split(/\s+(?:con|en|para|que|donde|desde)\s+|[(,:;.]/i)[0];
  const extra = String(lbl || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return dropDescriptorWords(checks).map((c) => {
    if (!c.params?.section) return c;
    const section = [...new Set([...c.params.section, ...extra])];
    return { ...c, params: { ...c.params, section, ...(rid ? { feature: [rid] } : {}) } };
  });
}

function catalogText() {
  return Object.entries(CATALOG)
    .filter(([, d]) => !d.base) // los chequeos de base los corre el harness
    .map(([type, d]) => {
      const p = Object.keys(d.params).length ? ` params: { ${Object.keys(d.params).map((k) => `"${k}": ["sinónimo", ...]`).join(", ")} }` : " params: {}";
      return `- ${type}: ${d.describe}${p}`;
    })
    .join("\n");
}

export function buildSystemPrompt() {
  return `Sos el traductor de requisitos a chequeos de Validation de MicheLab.

Recibís UN requisito de una SPA (prototipo, backend simulado). Tu trabajo es elegir chequeos del CATÁLOGO que, si pasan, demuestran que el requisito está cumplido en la página. No escribís código ni selectores.

CATÁLOGO (los únicos tipos permitidos):
${catalogText()}

Reglas:
1. Usá SOLO tipos del catálogo. Si el requisito no se puede verificar con el catálogo, devolvé "checks": [] y explicá en "sin_chequeo".
2. Cubrí CADA parte del requisito. Si dice "A y opcionalmente B", tiene que haber chequeos para A y para B.
3. Los parámetros son listas cortas de palabras o raíces en español (2 a 4) que aparecerían ESCRITAS en la página (títulos, etiquetas, botones): incluí sinónimos y raíces ("preferencia", "gusto"). No uses adverbios ni palabras de la redacción del requisito que nadie escribiría en la UI ("actualmente", "disponibles", "opcionalmente").
4. "Obligatorio" → field_required o submit_empty_blocked. "Opcional" → field_optional. "Permitir hacer X" → control_visible.
5. La página ya trae un título y un link del menú por cada sección, así que text_visible con el nombre de la sección NO demuestra nada. Verificá el CONTENIDO:
   - "Sección X con historia / descripción / información" → section_content con section = nombre de X.
   - "Catálogo / lista / carta / menú de productos", "productos disponibles", "en tarjetas" → section_items con section = nombre de la sección.
   - "en carrusel / carrousel / slider" → carousel con section = nombre de la sección.
   En section ponés 2 a 4 palabras con las que se llamaría la sección (ej. ["carta", "menu"], ["catalogo", "cafes"]).
6. Requisitos de cualidad o interacción (catálogo v0.4):
   - "Hero / portada con título, subtítulo y botón" → section_content y section_control de esa sección. "animación de entrada" → entrance_animation de esa sección.
   - "Pie de página / footer completo" → section_content con section = ["pie", "footer"].
   - "Barra de navegación / menú fijo", "scroll suave a cada sección" → nav_scroll.
   - "Responsive", "escritorio y móvil" → no_horizontal_scroll.
   - "Efectos hover en botones y tarjetas" → hover_changes con elementos = ["boton", "tarjeta"] (solo los que nombre).
   - "Animaciones al hacer scroll", "elementos que aparecen" → reveal_on_scroll.
   - "Estadísticas / contadores animados" → numbers_animate de esa sección (además de section_items si pide varias).
   - "Visualmente atractivo", "diseño moderno", "código limpio/comentado" no se pueden medir ejecutando la página: devolvé "checks": [] y explicalo en "sin_chequeo".
   Nunca uses como texto a buscar las palabras que describen la pieza ("título", "subtítulo", "botón", "llamada a la acción", "pie", "footer", "sección"): nadie las escribe en la página.
7. No agregues chequeos de cosas que el requisito no pide. NO inventes interacciones: usá click_reveals solo si el requisito dice explícitamente que algo aparece al hacer clic, abrir o navegar. Un carrusel se verifica con carousel, nunca con click_reveals.

Devolvé EXCLUSIVAMENTE este JSON:
{ "checks": [ { "type": "...", "params": { ... }, "covers": "qué parte del requisito verifica" } ], "sin_chequeo": "" }`;
}

function parseJsonLoose(raw) {
  const s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(s); } catch { const m = s.match(/\{[\s\S]*\}/); if (!m) throw new Error("sin JSON"); return JSON.parse(m[0]); }
}

/**
 * @param {string} requirement
 * @param {{model?:string, context?:string}} [opts]  context: brief del proyecto (opcional)
 * @returns {Promise<{checks:object[], dropped:object[], sin_chequeo:string, raw:string}>}
 */
export async function translateRequirement(requirement, opts = {}) {
  const user = `${opts.context ? `CONTEXTO DEL PROYECTO:\n${opts.context}\n\n` : ""}REQUISITO:\n${requirement}`;
  const res = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model || MODEL_DEFAULT,
      messages: [{ role: "system", content: buildSystemPrompt() }, { role: "user", content: user }],
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
    const n = CATALOG[c?.type]?.base ? null : normalizeCheck(c);
    if (n) checks.push({ ...n, covers: String(c.covers || "") });
    else dropped.push(c);
  }
  return { checks, dropped, sin_chequeo: String(parsed.sin_chequeo || ""), raw, versions: { translator: TRANSLATOR_VERSION, catalog: CATALOG_VERSION } };
}
