// completeness_reviewer3.mjs — v0.6-bounded
//
// Prueba la hipótesis: la mezcla de lentes y la omisión silenciosa de
// requisitos (bug reproducido 0/18 en v0.2/v0.3/v0.4 sobre "rating") es un
// problema de FORMATO (lista abierta), no solo de LECTURA del modelo.
//
// Cambio respecto de v0.4 (completeness_reviewer2.mjs), UNA sola variable:
// en vez de pedir "generá una lista de findings", el harness enumera
// explícitamente cada requisito del brief y cada tarea del graph, y exige
// EXACTAMENTE un veredicto por cada uno. GAP y EXCESS dejan de ser algo que
// el modelo puede omitir o fusionar: se DERIVAN acá, en código, de esos
// veredictos. AMBIGUOUS se mantiene como lista abierta (no tiene la misma
// patología de omisión/fusión que documentamos en GAP/EXCESS).
//
// El harness valida que el modelo haya devuelto un veredicto por cada id
// que se le pidió — ni de más ni de menos — y lo reporta aparte
// (schema_complete / schema_gaps). Eso es nuevo: en v0.2-v0.4 no había
// forma de distinguir "el modelo no encontró nada" de "el modelo se olvidó
// de mirar ese ítem".
//
// v0.6: agrega la regla del harness que trata covered=true con
// covering_task_ids vacío como GAP (contradicción interna del modelo;
// verificado 20/20 sin falsos positivos sobre 59 casos de referencia), y
// extractRequirements ahora es consciente de secciones (ver más abajo).
//
// Requiere que generatedGraph sea un array de tareas con campo `id`
// (como ya lo pasan los tests). No acepta graph como string libre: sin
// ids no se puede armar la lista de tareas a evaluar ni validar la
// respuesta.

import { loadStageBlock } from "./context/stage_loader.mjs";
import { norm, terms, synKey } from "./intent_mention_check.mjs";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
// Default; se puede pisar por corrida con opts.model.
const MODEL_ID_DEFAULT = "qwen2.5-7b-instruct";

/**
 * Etiquetas de sección reconocidas como "acá viven los requisitos", no
 * atadas a un caso puntual — pensado para que sirva en cualquier brief de
 * MicheLab, no solo en recetas/instrumentos/todo_trello. Se puede
 * extender pasando opts.sectionLabels a extractRequirements sin tocar
 * este archivo.
 */
export const REQUIREMENT_SECTION_LABELS = [
  "features",
  "funcionalidades",
  "requisitos",
  "requirements",
  "el prototipo debe permitir",
];

function normalizeLabel(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/[:#*-]/g, "")
    .trim();
}

/**
 * Corta el texto en secciones por encabezado. Un encabezado es una línea
 * markdown ("## Features") o una línea "Etiqueta:" sola, sin nada más
 * después de los dos puntos en esa misma línea — así una viñeta que
 * termina en ":" por casualidad (ej. "Crear tarjeta con título
 * (obligatorio):") no se confunde con un encabezado, porque tiene
 * paréntesis y esta regex solo acepta letras/espacios antes de los
 * dos puntos.
 */
function splitIntoSections(promptText) {
  const lines = promptText.split(/\r?\n/);
  const sections = [];
  let current = { label: null, lines: [] };
  for (const line of lines) {
    const mdHeading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/);
    const labelLine = line.match(/^\s{0,3}([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ \t]{0,60}):\s*$/);
    if (mdHeading || labelLine) {
      sections.push(current);
      current = { label: mdHeading ? mdHeading[1] : labelLine[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function scanList(text) {
  let m = [...text.matchAll(/^[ \t]*(\d+)\.[ \t]+(.+)$/gm)];
  if (m.length > 0) return m.map((mm) => ({ id: `R${mm[1]}`, text: mm[2].trim() }));
  m = [...text.matchAll(/^[ \t]*[-*][ \t]+(.+)$/gm)];
  if (m.length > 0) return m.map((mm, i) => ({ id: `R${i + 1}`, text: mm[1].trim() }));
  return null;
}

/**
 * Extrae requisitos del brief, consciente de secciones: si el texto tiene
 * un encabezado que coincide con REQUIREMENT_SECTION_LABELS (o con
 * opts.sectionLabels), busca la lista SOLO dentro de esa sección — no en
 * Restricciones ni en Criterios de éxito, aunque también usen viñetas. Si
 * no hay ningún encabezado reconocido (caso de recetas e instrumentos, que
 * no usan encabezados en absoluto), cae al comportamiento anterior:
 * numerada o con viñetas en todo el texto. Si hay un encabezado reconocido
 * pero esa sección no tiene una lista reconocible, devuelve null en vez de
 * caer en silencio al texto completo — ahí podría estar leyendo
 * Restricciones sin darse cuenta.
 * Exportada para poder chequear el parseo (cuántos requisitos encontró y
 * cuáles) antes de gastar una llamada a LM Studio.
 */
export function extractRequirements(promptText, opts = {}) {
  const labels = (opts.sectionLabels ?? REQUIREMENT_SECTION_LABELS).map(normalizeLabel);
  const sections = splitIntoSections(promptText);
  const match = sections.find((s) => s.label && labels.includes(normalizeLabel(s.label)));

  if (match) {
    return scanList(match.lines.join("\n"));
  }
  return scanList(promptText);
}

export function extractTasks(generatedGraph, { withDescriptions = false } = {}) {
  if (!Array.isArray(generatedGraph)) {
    throw new Error(
      "completeness_reviewer3: generatedGraph debe ser un array de tareas " +
        "con campo 'id'. El schema acotado necesita ids reales para armar " +
        "la lista de tareas a evaluar y para validar la respuesta; un " +
        "graph como string no alcanza.",
    );
  }
  return generatedGraph.map((t) => {
    if (!t.id) {
      throw new Error(`completeness_reviewer3: tarea sin 'id': ${JSON.stringify(t)}`);
    }
    // v0.7: con withDescriptions el reviewer ve también la descripción. En
    // Project20 el título de F4.1 no decía qué campos llevaba el formulario;
    // la descripción sí ("nombre, email, mensaje").
    const title = t.task ?? t.description ?? JSON.stringify(t);
    const text = withDescriptions && t.task && t.description ? `${t.task} — ${t.description}` : title;
    return { id: t.id, text };
  });
}

// v0.7 — Regla de cita. Evidencia (exp_split_reviewer, 30/09): con el
// requisito ya partido, Qwen igual marcaba "cubierto" copiando el texto del
// requisito en el reason ("F4.1... implementan un campo opcional para
// preferencias") sin que ninguna tarea lo mencionara. La cobertura pasa a
// exigir una cita que el harness verifica:
//  1. la cita existe LITERAL (normalizada) en el texto de la tarea citada;
//  2. la cita contiene al menos un término PROPIO del requisito, es decir,
//     uno que no aparece en los demás requisitos. Sin esto, "formulario de
//     contacto" validaría tanto "campos obligatorios" como "preferencias".
export function distinctiveTerms(req, requirements) {
  const others = new Set(
    requirements.filter((r) => r.id !== req.id).flatMap((r) => terms(r.text).map(synKey)),
  );
  const own = terms(req.text).map(synKey).filter((k) => !others.has(k));
  return own.length ? own : terms(req.text).map(synKey);
}

export function checkQuotes(verdict, req, requirements, tasks) {
  const ev = Array.isArray(verdict.evidence) ? verdict.evidence : [];
  if (!ev.length) return { ok: false, why: "no trae evidence" };
  const distinct = new Set(distinctiveTerms(req, requirements));
  const reasons = [];
  for (const e of ev) {
    const task = tasks.find((t) => t.id === e?.task_id);
    const quote = norm(e?.quote || "").replace(/\s+/g, " ").trim();
    if (!task) { reasons.push(`${e?.task_id}: tarea inexistente`); continue; }
    if (quote.length < 4) { reasons.push(`${task.id}: cita vacía`); continue; }
    if (!norm(task.text).replace(/\s+/g, " ").includes(quote)) { reasons.push(`${task.id}: la cita no está en la tarea`); continue; }
    if (!terms(quote).some((w) => distinct.has(synKey(w)))) { reasons.push(`${task.id}: la cita no nombra nada propio del requisito`); continue; }
    return { ok: true, why: `${task.id}: "${e.quote}"` };
  }
  return { ok: false, why: reasons.join("; ") };
}

function buildSystemPrompt({ requireQuotes = false } = {}) {
  return `Eres un motor de decisiones estructuradas. Tu trabajo es evaluar, requisito por requisito y tarea por tarea, si un Graph cumple un Prompt Original.

REGLAS INQUEBRANTABLES:
1. NO generes texto conversacional.
2. NO expliques tu razonamiento fuera del JSON.
3. Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown, sin comillas triples, solo el JSON puro.

Vas a recibir dos listas ya numeradas: REQUISITOS y TAREAS. Tu única tarea es emitir UN veredicto por cada elemento de cada lista. No inventes ids que no te dieron. No omitas ningún id que te dieron. No fusiones el veredicto de dos ids distintos en una sola entrada.

Para cada REQUISITO (Rn):
- "covered": true si alguna tarea del Graph lo implementa (no hace falta texto idéntico, pero sí que la tarea cubra sustancialmente lo pedido); false si ninguna tarea lo cubre.
- "covering_task_ids": ids de las tareas que lo cubren (array vacío si covered=false).
- "reason": por qué está cubierto o por qué no, en una frase.${requireQuotes ? `
- "evidence": si covered=true, lista de { "task_id": "...", "quote": "..." } donde "quote" es un fragmento COPIADO LITERAL del texto de esa tarea (tal como aparece en la lista de TAREAS) que muestra que cubre lo ESPECÍFICO de este requisito. No parafrasees. Si ninguna tarea tiene un fragmento así, el requisito NO está cubierto: covered=false.` : ""}

Para cada TAREA (Fn):
- "in_scope": true si está pedida explícitamente por el prompt, o si es una derivación técnica razonablemente necesaria para construir, ejecutar o probar algo que SÍ está pedido; false si no está respaldada por el prompt, no es necesaria, o contradice una restricción explícita del prompt.
- "reason": por qué está en alcance o por qué no, en una frase.

Además, generá una lista aparte de AMBIGUOUS: expresiones del prompt que admiten más de una lectura razonable con impacto material en el Graph (no adjetivos subjetivos sin consecuencia de diseño). Esta lista puede estar vacía.

Devuelve EXACTAMENTE esta estructura JSON:
{
  "requirement_verdicts": [
    { "requirement_id": "R1", "covered": boolean, "covering_task_ids": ["F1.1"], "reason": "..."${requireQuotes ? ', "evidence": [{ "task_id": "F1.1", "quote": "fragmento literal" }]' : ""} }
  ],
  "task_verdicts": [
    { "task_id": "F1.1", "in_scope": boolean, "reason": "..." }
  ],
  "ambiguous_findings": [
    { "reference": "expresión ambigua citada del prompt", "reason": "..." }
  ]
}`;
}

/**
 * Ejecuta la revisión de completitud con schema acotado (un veredicto
 * forzado por requisito y por tarea, en vez de una lista abierta de
 * findings).
 * @param {string} originalPrompt
 * @param {Array<{id: string, task?: string, description?: string}>} generatedGraph
 * @param {{requirements?: Array<{id:string, text:string}>, sectionLabels?: string[], model?: string, logCallback?: (msg:string)=>void, requireQuotes?: boolean, withDescriptions?: boolean}} [opts]
 */
export async function runCompletenessReview(originalPrompt, generatedGraph, opts = {}) {
  const log = typeof opts.logCallback === "function" ? opts.logCallback : () => {};
  const modelId = opts.model || MODEL_ID_DEFAULT;

  const requirements = opts.requirements ?? extractRequirements(originalPrompt, opts);
  if (!requirements) {
    throw new Error(
      "completeness_reviewer3: no se pudieron extraer requisitos numerados " +
        "ni con viñetas del prompt. Pasá opts.requirements = [{id, text}, ...] explícito.",
    );
  }
  const requireQuotes = !!opts.requireQuotes;
  const tasks = extractTasks(generatedGraph, { withDescriptions: requireQuotes || !!opts.withDescriptions });
  log(`requisitos: ${requirements.length} | tareas: ${tasks.length}`);

  const stage =
    process.env.STAGE === "off"
      ? null
      : loadStageBlock(new URL("./context/ProjectStage.md", import.meta.url));
  const stageMeta = { stage_sha256: stage ? stage.sha256 : "off" };
  log(stage ? `stage: ON (${stageMeta.stage_sha256.slice(0, 8)})` : "stage: OFF");

  const reqList = requirements.map((r) => `${r.id}: ${r.text}`).join("\n");
  const taskList = tasks.map((t) => `${t.id}: ${t.text}`).join("\n");

  const userMessage =
    (stage ? `CONTEXTO DEL LABORATORIO:\n${stage.block}\n\n` : "") +
    `PROMPT ORIGINAL (texto completo, usalo para AMBIGUOUS y como contexto):\n${originalPrompt}\n\n` +
    `REQUISITOS A EVALUAR (emití EXACTAMENTE un veredicto por cada uno):\n${reqList}\n\n` +
    `TAREAS DEL GRAPH A EVALUAR (emití EXACTAMENTE un veredicto por cada una):\n${taskList}`;

  const SYSTEM_PROMPT = buildSystemPrompt({ requireQuotes });

  const runMetaBase = {
    model: modelId,
    temperature: 0.1,
    stage: stageMeta.stage_sha256,
    reviewer_version: requireQuotes ? "v0.7-quotes" : "v0.6-bounded",
    with_descriptions: requireQuotes || !!opts.withDescriptions,
    requirement_count: requirements.length,
    task_count: tasks.length,
  };

  try {
    log("llamando a LM Studio...");
    const response = await fetch(LM_STUDIO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        // Más alto que v0.4: acá el JSON tiene un objeto por requisito Y por
        // tarea, no una lista corta de findings. Con graphs grandes
        // (todo_trello, Project16) esto va a necesitar subir de nuevo o
        // partir la llamada — queda anotado como límite conocido, no
        // resuelto por esta versión.
        // v0.7: las citas agregan texto por requisito; 2048 quedaba justo.
        max_tokens: requireQuotes ? 3072 : 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("🚨 DETALLE DEL ERROR LM STUDIO:", errorText);
      throw new Error(`Error en LM Studio: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let rawContent = data.choices[0].message.content.trim();
    if (rawContent.startsWith("```json")) {
      rawContent = rawContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const decision = JSON.parse(rawContent);
    log("respuesta parseada OK");

    // Validación ESTRUCTURAL: el harness decide si la respuesta está
    // completa, no el modelo. Esto es lo que reemplaza a confiar en que
    // "findings: []" signifique "no encontré nada" en vez de "me olvidé
    // de mirar esto".
    const reqIds = new Set(requirements.map((r) => r.id));
    const gotReqIds = new Set((decision.requirement_verdicts ?? []).map((v) => v.requirement_id));
    const missingReq = [...reqIds].filter((id) => !gotReqIds.has(id));
    const extraReq = [...gotReqIds].filter((id) => !reqIds.has(id));

    const taskIds = new Set(tasks.map((t) => t.id));
    const gotTaskIds = new Set((decision.task_verdicts ?? []).map((v) => v.task_id));
    const missingTask = [...taskIds].filter((id) => !gotTaskIds.has(id));
    const extraTask = [...gotTaskIds].filter((id) => !taskIds.has(id));

    const schema_complete =
      missingReq.length === 0 &&
      extraReq.length === 0 &&
      missingTask.length === 0 &&
      extraTask.length === 0;
    log(
      schema_complete
        ? "schema_complete: true"
        : `schema_complete: false | missingReq=${missingReq} extraReq=${extraReq} missingTask=${missingTask} extraTask=${extraTask}`,
    );

    const gap_findings = (decision.requirement_verdicts ?? [])
      .filter((v) => v.covered === false || (v.covered === true && (v.covering_task_ids ?? []).length === 0))
      .map((v) => {
        // Contradicción interna: el modelo dijo covered=true pero no citó
        // ninguna tarea que lo respalde. En el set de referencia (12 corridas,
        // 59 covered=true), esto pasó 20 veces y las 20 correspondían a un
        // gap real (a veces el propio "reason" ya lo admitía en prosa, p.ej.
        // "No hay tareas que cubran..." con covered=true igual). 0 falsos
        // positivos observados. Se corrige acá; el veredicto crudo del
        // modelo queda intacto en raw_verdicts para auditar.
        const corrected = v.covered === true && (v.covering_task_ids ?? []).length === 0;
        return {
          type: "GAP",
          requirement_id: v.requirement_id,
          reference: requirements.find((r) => r.id === v.requirement_id)?.text ?? "(id desconocido)",
          reason: v.reason,
          ...(corrected ? { corrected_by_harness: "covered=true sin covering_task_ids" } : {}),
        };
      });
    if (requireQuotes) {
      for (const v of decision.requirement_verdicts ?? []) {
        if (v.covered !== true || !(v.covering_task_ids ?? []).length) continue; // ya es GAP
        const req = requirements.find((r) => r.id === v.requirement_id);
        if (!req) continue;
        const check = checkQuotes(v, req, requirements, tasks);
        if (!check.ok) {
          gap_findings.push({
            type: "GAP",
            requirement_id: v.requirement_id,
            reference: req.text,
            reason: v.reason,
            corrected_by_harness: `covered=true sin cita válida: ${check.why}`,
          });
        }
      }
    }
    const correctedCount = gap_findings.filter((f) => f.corrected_by_harness).length;
    if (correctedCount > 0) log(`correcciones del harness: ${correctedCount}`);

    const excess_findings = (decision.task_verdicts ?? [])
      .filter((v) => v.in_scope === false)
      .map((v) => ({
        type: "EXCESS",
        task_id: v.task_id,
        reference: tasks.find((t) => t.id === v.task_id)?.text ?? "(id desconocido)",
        reason: v.reason,
      }));

    const ambiguous_findings = (decision.ambiguous_findings ?? []).map((f) => ({
      type: "AMBIGUOUS",
      ...f,
    }));

    // Score calculado por el harness contra los requisitos reales, no
    // inventado por el modelo (completeness_score/confidence_score de
    // v0.1-v0.4 ya demostraron no significar nada).
    const coverage_score = requirements.length
      ? (requirements.length - gap_findings.length) / requirements.length
      : null;
    log(`GAP=${gap_findings.length} EXCESS=${excess_findings.length} AMBIGUOUS=${ambiguous_findings.length} coverage=${coverage_score}`);

    return {
      findings: [...gap_findings, ...excess_findings, ...ambiguous_findings],
      coverage_score,
      schema_complete,
      schema_gaps: { missingReq, extraReq, missingTask, extraTask },
      raw_verdicts: decision,
      run_meta: runMetaBase,
    };
  } catch (error) {
    console.error("[CompletenessReviewer v0.6] Error crítico evaluando el Graph:", error);
    log(`ERROR: ${error.message}`);
    return {
      findings: [{ type: "SYSTEM_ERROR", reference: "Reviewer", reason: error.message }],
      coverage_score: null,
      schema_complete: false,
      schema_gaps: null,
      raw_verdicts: null,
      run_meta: runMetaBase,
    };
  }
}
