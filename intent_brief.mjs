// intent_brief.mjs — Intent Forge v0.3: plantilla fija + clasificación acotada.
//
// Reemplaza al chequeo "mencionaste y no incluí" (intent_mention_check.mjs).
// Evidencia del cambio (Project23, 03/10): de 13 avisos por palabras sueltas,
// 3 eran pérdidas reales y 10 ruido; "Excluir" convirtió palabras sueltas en
// órdenes negativas para TechLeader ("NO planificar: frontend") y el drag &
// drop pedido terminó diferido.
//
// Idea (decisión de Miche): el usuario arranca con una plantilla de 4 campos;
// Qwen NO resume: clasifica cada línea que escribió el usuario en ítems
// (contexto / feature / estilo / restriccion). El harness numera las líneas
// (L1, L2...) y exige que cada una termine en al menos un ítem — misma
// lección que el reviewer v0.6-bounded: lista abierta pierde cosas, veredicto
// por elemento enumerado no. Si después de los reintentos queda una línea
// sin destino, el harness la agrega él mismo (marcada auto) y la UI la
// resalta: nada de lo que escribió el usuario se pierde en silencio.
//
// Módulo puro (sin fs ni fetch): lo usan server.mjs y script.js (navegador).

export const BRIEF_VERSION = "intent_brief v0.1";

// Campos de la plantilla. `tipo` = pista del tipo de ítem que suele salir de
// ese campo (Qwen puede moverlo si la línea claramente es de otro tipo).
export const FIELDS = {
  construir: { label: "Qué querés construir", tipo: "contexto" },
  hacer: { label: "Qué tiene que hacer", tipo: "feature" },
  ver: { label: "Cómo se tiene que ver", tipo: "estilo" },
  no: { label: "Qué no debe hacer", tipo: "restriccion" },
};
const OTHER_FIELDS = {
  libre: "sin campo",
  respuesta: "respuesta",
  ajuste: "ajuste",
};
export const fieldLabel = (f) => FIELDS[f]?.label.toLowerCase() || OTHER_FIELDS[f] || f;

export const TIPOS = ["contexto", "feature", "estilo", "restriccion", "descartado"];
const TIPO_ALIAS = {
  contexto: "contexto", context: "contexto",
  feature: "feature", features: "feature", funcionalidad: "feature",
  estilo: "estilo", style: "estilo", diseno: "estilo",
  restriccion: "restriccion", restricciones: "restriccion", restriction: "restriccion", limite: "restriccion",
  descartado: "descartado", descartar: "descartado",
};

// Texto que aparece precargado en el input al empezar un proyecto.
export const TEMPLATE_TEXT = `Qué querés construir:
-

Qué tiene que hacer:
-

Cómo se tiene que ver:
-

Qué no debe hacer:
- `;

// Ejemplo que se muestra en el chat (otro dominio, para no sesgar).
export const TEMPLATE_EXAMPLE = `Qué querés construir:
- Una app para guardar mis recetas, simple

Qué tiene que hacer:
- Cargar recetas con ingredientes y pasos
- Buscar recetas por ingrediente
- Marcar recetas como favoritas

Cómo se tiene que ver:
- Colores cálidos, fotos grandes

Qué no debe hacer:
- Sin usuarios ni login`;

export function norm(t) {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s*/;
const stripBullet = (s) => String(s).replace(BULLET, "").trim();

// Reconoce el encabezado de un campo. Tolera "¿", acentos, mayúsculas, el
// "qué" omitido y contenido en la misma línea después de los dos puntos.
function headerOf(rawLine) {
  const line = norm(rawLine).replace(/^[#*¿\s]+/, "");
  const colon = line.indexOf(":");
  const head = (colon >= 0 && colon <= 45 ? line.slice(0, colon) : line).replace(/[?¿*]/g, "").trim();
  let field = null;
  if (/^(que )?no (debe|tiene que|tendria que|deberia) (hacer|tener)\b/.test(head) || /^(restricciones?|fuera de alcance)$/.test(head)) field = "no";
  else if (/^(que )?(tiene|debe) (que )?(poder )?hacer\b/.test(head) || /^(features?|funcionalidades?)$/.test(head)) field = "hacer";
  else if (/^(como )?se (tiene que|debe|deberia) ver\b/.test(head) || /^(diseno|estilo|aspecto)$/.test(head)) field = "ver";
  else if (/^(que )?(queres|quieres|quiero|vas a|vamos a)? ?construir\b/.test(head) || /^(proyecto|objetivo|idea)$/.test(head)) field = "construir";
  if (!field) return null;
  const rest = colon >= 0 ? stripBullet(String(rawLine).slice(String(rawLine).indexOf(":") + 1)) : "";
  return { field, rest };
}

/**
 * Parte el primer mensaje del usuario según la plantilla.
 * @returns {{hasTemplate:boolean, lines:{field:string,text:string}[], empty:string[]}}
 */
export function parseBrief(text) {
  let field = "libre";
  let hasTemplate = false;
  const lines = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const h = headerOf(raw);
    if (h) {
      hasTemplate = true;
      field = h.field;
      if (h.rest) lines.push({ field, text: h.rest });
      continue;
    }
    const t = stripBullet(raw);
    if (t) lines.push({ field, text: t });
  }
  const empty = hasTemplate ? Object.keys(FIELDS).filter((f) => !lines.some((l) => l.field === f)) : [];
  return { hasTemplate, lines, empty };
}

export const isCompleteMessage = (content) => /"status"\s*:\s*"COMPLETE"/.test(String(content || ""));

/**
 * Numera TODAS las líneas que escribió el usuario en la conversación.
 * El primer mensaje se parte con la plantilla; los siguientes son
 * "respuesta" (si lo anterior fue una pregunta) o "ajuste" (si lo anterior
 * fue un COMPLETE y el usuario tocó Ajustar).
 */
export function numberLines(conversation = []) {
  const lines = [];
  const preguntas = [];
  let last = null;
  let first = true;
  let parsedFirst = null;
  for (const m of conversation) {
    if (m.role !== "user") {
      last = m.content;
      if (!isCompleteMessage(m.content) && String(m.content || "").trim()) preguntas.push(String(m.content).trim());
      continue;
    }
    if (m.auto) continue;
    if (first) {
      first = false;
      parsedFirst = parseBrief(m.content);
      for (const l of parsedFirst.lines) lines.push({ id: `L${lines.length + 1}`, ...l });
      continue;
    }
    const field = last && isCompleteMessage(last) ? "ajuste" : "respuesta";
    const pregunta = field === "respuesta" && last ? String(last).trim().slice(0, 200) : undefined;
    for (const raw of String(m.content || "").split(/\r?\n/)) {
      const t = stripBullet(raw);
      if (t) lines.push({ id: `L${lines.length + 1}`, field, text: t, ...(pregunta ? { pregunta } : {}) });
    }
  }
  return { lines, preguntas, hasTemplate: !!parsedFirst?.hasTemplate, empty: parsedFirst?.empty || [] };
}

export const INTENT_SYSTEM = `Sos Intent Forge v0.3 del equipo MicheLab.

Recibís las LÍNEAS que escribió el usuario, numeradas (L1, L2...). Entre corchetes va el campo de la plantilla donde la escribió.
Tu trabajo es CLASIFICAR cada línea, NO resumir.

TIPOS:
- contexto: qué es el proyecto, para quién, referencias ("estilo Trello"), adjetivos generales ("sencilla").
- feature: algo que el usuario tiene que poder HACER en la app.
- estilo: cómo se tiene que VER o sentir (colores, sombras, animaciones, efectos al pasar el mouse).
- restriccion: un límite o algo que NO debe hacer ("sin login", "sin base de datos", "solo frontend", "los datos se borran al recargar").
- descartado: SOLO si una línea [ajuste] pide sacar algo; en "de" van la línea que se saca y la línea [ajuste].

REGLAS:
1. Cada línea L tiene que aparecer en "de" de al menos un ítem. Ninguna se pierde.
2. Si una línea nombra varias cosas, separalas: un ítem por cosa.
3. Usá las palabras del usuario. No resumas ni generalices. Nombres, cantidades y listas (por ejemplo entre paréntesis) van dentro del texto del ítem.
4. No agregues ítems que no salgan de una línea.
5. El campo entre corchetes es una pista. Cambiá el tipo solo si la línea claramente es de otro tipo (por ejemplo "drag & drop" escrito en [cómo se tiene que ver] es una feature).
6. Las líneas [respuesta] y [ajuste] valen igual que las demás. Un [ajuste] corrige lo anterior.
7. Preguntá SOLO si no hay ninguna feature, o si una línea es tan vaga que no se puede convertir en ítem. Una sola pregunta, corta. Nunca repitas una pregunta ya hecha.

SALIDA:
- Si preguntás: respondé solo con la pregunta, en una línea.
- Si no: respondé EXCLUSIVAMENTE con este JSON:
\`\`\`json
{"status":"COMPLETE","project_name":"...","items":[{"de":["L1"],"tipo":"contexto","texto":"..."}],"criterios_holdout":["cómo se verifica cada feature"]}
\`\`\`

EJEMPLO (otro proyecto):
L1 [qué querés construir] Una app para guardar mis recetas, simple
L2 [qué tiene que hacer] cargar recetas con ingredientes y pasos
L3 [cómo se tiene que ver] colores cálidos, fotos grandes, que se puedan marcar favoritas
L4 [qué no debe hacer] sin usuarios ni login
\`\`\`json
{"status":"COMPLETE","project_name":"Recetario","items":[
{"de":["L1"],"tipo":"contexto","texto":"App simple para guardar mis recetas"},
{"de":["L2"],"tipo":"feature","texto":"Cargar recetas con ingredientes y pasos"},
{"de":["L3"],"tipo":"estilo","texto":"Colores cálidos"},
{"de":["L3"],"tipo":"estilo","texto":"Fotos grandes"},
{"de":["L3"],"tipo":"feature","texto":"Marcar recetas como favoritas"},
{"de":["L4"],"tipo":"restriccion","texto":"Sin usuarios ni login"}],
"criterios_holdout":["Se puede cargar una receta con ingredientes y pasos","Se puede marcar una receta como favorita"]}
\`\`\``;

export function formatLinesForModel({ lines, preguntas = [] }, { forceComplete = false } = {}) {
  const out = ["LÍNEAS DEL USUARIO:"];
  for (const l of lines) {
    const tag = l.field === "respuesta" && l.pregunta ? `respuesta a "${l.pregunta}"` : fieldLabel(l.field);
    out.push(`${l.id} [${tag}] ${l.text}`);
  }
  if (preguntas.length) {
    out.push("", "PREGUNTAS QUE YA HICISTE (no las repitas):");
    preguntas.forEach((p) => out.push(`- ${p}`));
  }
  if (forceComplete) out.push("", "Ya no podés preguntar más: devolvé el JSON COMPLETE con lo que hay.");
  return out.join("\n");
}

// JSON tolerante: bloque ```json, o el primer {...} del texto; saca
// comentarios // y comas colgantes.
export function parseModelOutput(content) {
  const text = String(content || "");
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let src = fence ? fence[1] : null;
  if (!src) {
    const a = text.indexOf("{"), b = text.lastIndexOf("}");
    if (a >= 0 && b > a) src = text.slice(a, b + 1);
  }
  if (src) {
    const clean = src.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    try {
      const data = JSON.parse(clean);
      if (data && (data.status === "COMPLETE" || Array.isArray(data.items))) return { complete: true, data };
    } catch {
      if (/COMPLETE|"items"/.test(text)) return { complete: false, parseError: true };
    }
  }
  if (/COMPLETE/.test(text)) return { complete: false, parseError: true };
  const question = text.trim().split(/\r?\n/).find((l) => l.trim())?.trim() || "";
  return { complete: false, question };
}

const asIds = (de) =>
  (Array.isArray(de) ? de : String(de ?? "").split(/[\s,;]+/))
    .map((x) => String(x).trim().toUpperCase())
    .filter(Boolean)
    .map((x) => (/^\d+$/.test(x) ? `L${x}` : x));

/**
 * Valida los ítems del modelo contra las líneas numeradas.
 * @returns {{items:object[], invalid:{item:object,reason:string}[], uncovered:string[]}}
 */
export function validateItems(rawItems, lines) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const items = [];
  const invalid = [];
  for (const it of Array.isArray(rawItems) ? rawItems : []) {
    const tipo = TIPO_ALIAS[norm(it?.tipo).replace(/\s/g, "")];
    const texto = String(it?.texto ?? it?.text ?? "").trim();
    const ids = asIds(it?.de ?? it?.from);
    const de = ids.filter((id) => byId.has(id));
    if (!tipo) { invalid.push({ item: it, reason: `tipo inválido "${it?.tipo}"` }); continue; }
    if (!texto) { invalid.push({ item: it, reason: "texto vacío" }); continue; }
    if (!de.length) { invalid.push({ item: it, reason: `"de" no cita ninguna línea existente (${ids.join(", ") || "vacío"})` }); continue; }
    if (tipo === "descartado" && !de.some((id) => byId.get(id).field === "ajuste")) {
      invalid.push({ item: it, reason: "descartado sin una línea [ajuste] que lo pida" });
      continue;
    }
    items.push({ de, tipo, texto });
  }
  const covered = new Set(items.flatMap((i) => i.de));
  const uncovered = lines.map((l) => l.id).filter((id) => !covered.has(id));
  return { items, invalid, uncovered };
}

export function repairFeedback({ uncovered = [], invalid = [] }) {
  const out = ["Revisá tu JSON:"];
  if (uncovered.length)
    out.push(`- Estas líneas no quedaron en ningún ítem: ${uncovered.join(", ")}. Asignalas (si no hay nada para construir, van como contexto).`);
  for (const x of invalid) out.push(`- Ítem inválido (${x.reason}): ${JSON.stringify(x.item)}`);
  out.push("Devolvé el JSON COMPLETE entero de nuevo.");
  return out.join("\n");
}

// Red final: lo que el modelo no ubicó lo agrega el harness con el tipo que
// sugiere su campo (o contexto), marcado auto para que la UI lo resalte.
export function fillUncovered(items, lines, uncovered) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return [
    ...items,
    ...uncovered.map((id) => {
      const l = byId.get(id);
      return { de: [id], tipo: FIELDS[l.field]?.tipo || "contexto", texto: l.text, auto: true };
    }),
  ];
}

function uniq(texts) {
  const seen = new Set();
  return texts.filter((t) => {
    const k = norm(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Arma el refined_prompt. features = feature + estilo (en ese orden), para que
 * reviewer, page plan, traductor y Specialist sigan leyendo lo mismo que antes;
 * estilo/restricciones/contexto viajan además por separado.
 */
export function buildRefined({ project_name, items, criterios_holdout = [], lines = [], attempts = [] }) {
  const firstLine = (i) => Math.min(...i.de.map((id) => Number(id.slice(1))));
  const sorted = [...items].sort((a, b) => firstLine(a) - firstLine(b));
  const of = (t) => uniq(sorted.filter((i) => i.tipo === t).map((i) => i.texto));
  const contexto = of("contexto");
  const feature = of("feature");
  const estilo = of("estilo");
  const restricciones = of("restriccion");
  const name = String(project_name || "").trim() || contexto[0] || "Proyecto";
  return {
    project_name: name,
    objetivo: contexto.join(". ") || name,
    features: uniq([...feature, ...estilo]),
    criterios_holdout: (Array.isArray(criterios_holdout) ? criterios_holdout : []).map(String).filter((c) => c.trim()),
    restricciones,
    estilo,
    contexto,
    brief: { version: BRIEF_VERSION, lines, items: sorted, repairs: Math.max(0, attempts.length - 1) },
  };
}

/** Texto que recibe TechLeader. Restricciones van después de los criterios
 * (el reviewer toma solo la lista numerada de Features). */
export function buildTechLeaderInput(refined) {
  const parts = [];
  if (refined.project_name) parts.push(`Proyecto: ${refined.project_name}`);
  if (refined.objetivo) parts.push(refined.objetivo);
  if (refined.features?.length) {
    parts.push("", "Features:", "");
    refined.features.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
  }
  if (refined.criterios_holdout?.length) {
    parts.push("", "Criterios de éxito:");
    refined.criterios_holdout.forEach((c) => parts.push(`- ${c}`));
  }
  if (refined.restricciones?.length) {
    parts.push("", "Restricciones (límites que puso el usuario; no planificar trabajo que las contradiga):");
    refined.restricciones.forEach((r) => parts.push(`- ${r}`));
  }
  return parts.join("\n");
}

/** Para la tarjeta de confirmación: cada línea con los ítems que salieron de ella. */
export function linesWithItems(brief) {
  return (brief?.lines || []).map((line) => ({
    line,
    items: (brief.items || []).filter((i) => i.de.includes(line.id)),
  }));
}

export const HARNESS_QUESTIONS = {
  vacio: "Completá la plantilla: qué querés construir, qué tiene que hacer, cómo se tiene que ver y qué no debe hacer.",
  sin_feature: "¿Qué tiene que poder hacer el usuario con la app? Escribí una acción por línea.",
};

/**
 * Un turno de Intent Forge.
 * @param {object[]} conversation  historial {role, content}
 * @param {object} opts
 * @param {(messages:object[]) => Promise<string>} opts.callModel
 * @param {number} [opts.maxQuestions=3]  preguntas del modelo antes de forzar COMPLETE
 * @param {number} [opts.maxRepairs=2]    reintentos de cobertura/JSON
 */
export async function runIntentForge(conversation, { callModel, maxQuestions = 3, maxRepairs = 2 } = {}) {
  const numbered = numberLines(conversation);
  const { lines, preguntas } = numbered;
  if (!lines.length) return { status: "ASKING", question: HARNESS_QUESTIONS.vacio, by: "harness", lines };

  const forceComplete = preguntas.length >= maxQuestions;
  const messages = [
    { role: "system", content: INTENT_SYSTEM },
    { role: "user", content: formatLinesForModel(numbered, { forceComplete }) },
  ];
  const attempts = [];
  let last = null;
  for (let i = 0; i <= maxRepairs; i++) {
    const raw = await callModel(messages);
    const parsed = parseModelOutput(raw);
    if (!parsed.complete && !parsed.parseError) {
      const repeated = preguntas.some((p) => norm(p) === norm(parsed.question));
      attempts.push({ raw, kind: repeated ? "pregunta_repetida" : "pregunta" });
      if (!forceComplete && !repeated && parsed.question) {
        return { status: "ASKING", question: parsed.question, by: "model", lines, attempts };
      }
      messages.push({ role: "assistant", content: raw }, {
        role: "user",
        content: repeated ? "Esa pregunta ya la hiciste. Devolvé el JSON COMPLETE con lo que hay." : "Ya no podés preguntar más: devolvé el JSON COMPLETE con lo que hay.",
      });
      continue;
    }
    if (parsed.parseError) {
      attempts.push({ raw, kind: "json_ilegible" });
      messages.push({ role: "assistant", content: raw }, { role: "user", content: "Tu JSON no se pudo leer. Devolvé solo el JSON COMPLETE, válido, dentro de ```json." });
      continue;
    }
    const v = validateItems(parsed.data.items, lines);
    last = { raw, data: parsed.data, ...v };
    attempts.push({ raw, kind: "complete", uncovered: v.uncovered, invalid: v.invalid.map((x) => x.reason) });
    if (!v.uncovered.length && !v.invalid.length) break;
    if (i < maxRepairs) messages.push({ role: "assistant", content: raw }, { role: "user", content: repairFeedback(v) });
  }

  if (!last) {
    // El modelo nunca devolvió un JSON usable: todas las líneas por la red del harness.
    last = { raw: attempts.at(-1)?.raw || "", data: {}, items: [], invalid: [], uncovered: lines.map((l) => l.id) };
  }
  const items = fillUncovered(last.items, lines, last.uncovered);
  if (!items.some((i) => i.tipo === "feature") && !forceComplete) {
    return { status: "ASKING", question: HARNESS_QUESTIONS.sin_feature, by: "harness", lines, attempts };
  }
  const refined = buildRefined({
    project_name: last.data.project_name,
    items,
    criterios_holdout: last.data.criterios_holdout,
    lines,
    attempts,
  });
  return { status: "COMPLETE", refined, raw: last.raw, lines, attempts, auto_added: last.uncovered };
}
