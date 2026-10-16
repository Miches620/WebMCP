// completeness_reviewer3.mjs — v0.8-tandas (16/10; antes v0.6-bounded / v0.7-quotes)
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
import { norm, terms, synKey } from "./text_terms.mjs";
import { parseJsonLoose } from "./json_loose.mjs";

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

// ---------- v0.8 (16/10): la revisión se parte en tandas y cada tanda se reintenta según el error ----------
//
// Evidencia (pipeline real del Kanban, 16/10): 17 requisitos + 28 tareas (y después 22) en UNA llamada con
// max_tokens 2048 → la respuesta se cortó 3 veces ("Unterminated string ... position 6312", "Unexpected end
// of JSON input", "... position 6743"). No era LM Studio: era un tope fijo que no dependía del tamaño del
// trabajo (el mismo error que el paso enlace, D3 del diagnóstico 16/10). Repetir igual no sirve: se corta
// en el mismo lugar.
//
// v0.8:
//   1. Tandas: los requisitos en grupos de BATCH y las tareas en grupos de BATCH. Cada llamada ve el
//      contexto completo (prompt, todos los requisitos, todas las tareas) pero emite veredictos solo de
//      su tanda. AMBIGUOUS solo en la primera llamada.
//   2. Tope = lo que entra: contexto del modelo − lo que ocupa el pedido − margen (opts.contextTokens).
//   3. Parseo tolerante (json_loose) y, si la respuesta se cortó, se rescatan los veredictos completos.
//   4. Reintentos según el error, hasta 3 por tanda:
//        red / HTTP            → se repite igual (con una espera corta);
//        cortada / ilegible     → se pide de nuevo SOLO lo que falta;
//        faltan ids             → se pide de nuevo SOLO lo que falta.
//      Si después de 3 siguen faltando veredictos → SYSTEM_ERROR con el motivo en palabras (decide Miche).
//   5. Cada llamada queda en result.calls (respuesta cruda, finish_reason, uso): el server la guarda en
//      evidence/reviewer/.
// Los veredictos, el GAP/EXCESS derivado por el harness y la regla de cita no cambian.


export const REVIEWER_VERSION = "completeness_reviewer v0.8-tandas";
export const BATCH = 10;
export const MAX_ATTEMPTS = 3;
const CHARS_PER_TOKEN = 3; // conservador para español con JSON (sobreestima el pedido)
const MARGIN_TOKENS = 512;
const MIN_OUT_TOKENS = 1024;

function buildSystemPrompt({ requireQuotes = false, parts = { req: true, task: true, amb: true } } = {}) {
  const reqRules = `Para cada REQUISITO (Rn) que se te pide evaluar:
- "covered": true si alguna tarea del Graph lo implementa (no hace falta texto idéntico, pero sí que la tarea cubra sustancialmente lo pedido); false si ninguna tarea lo cubre.
- "covering_task_ids": ids de las tareas que lo cubren (array vacío si covered=false).
- "reason": por qué está cubierto o por qué no, en una frase corta.${requireQuotes ? `
- "evidence": si covered=true, lista de { "task_id": "...", "quote": "..." } donde "quote" es un fragmento COPIADO LITERAL del texto de esa tarea (tal como aparece en la lista de TAREAS) que muestra que cubre lo ESPECÍFICO de este requisito. No parafrasees. Si ninguna tarea tiene un fragmento así, el requisito NO está cubierto: covered=false.` : ""}`;
  const taskRules = `Para cada TAREA (Fn) que se te pide evaluar:
- "in_scope": true si está pedida explícitamente por el prompt, o si es una derivación técnica razonablemente necesaria para construir, ejecutar o probar algo que SÍ está pedido; false si no está respaldada por el prompt, no es necesaria, o contradice una restricción explícita del prompt.
- "reason": por qué está en alcance o por qué no, en una frase corta.`;
  const ambRules = `Además, generá una lista aparte de AMBIGUOUS: expresiones del prompt que admiten más de una lectura razonable con impacto material en el Graph (no adjetivos subjetivos sin consecuencia de diseño). Esta lista puede estar vacía.`;
  const shape = [];
  if (parts.req) shape.push(`  "requirement_verdicts": [
    { "requirement_id": "R1", "covered": boolean, "covering_task_ids": ["F1.1"], "reason": "..."${requireQuotes ? ', "evidence": [{ "task_id": "F1.1", "quote": "fragmento literal" }]' : ""} }
  ]`);
  if (parts.task) shape.push(`  "task_verdicts": [
    { "task_id": "F1.1", "in_scope": boolean, "reason": "..." }
  ]`);
  if (parts.amb) shape.push(`  "ambiguous_findings": [
    { "reference": "expresión ambigua citada del prompt", "reason": "..." }
  ]`);
  return `Eres un motor de decisiones estructuradas. Tu trabajo es evaluar si un Graph cumple un Prompt Original.

REGLAS INQUEBRANTABLES:
1. NO generes texto conversacional.
2. NO expliques tu razonamiento fuera del JSON.
3. Devuelve EXCLUSIVAMENTE un objeto JSON válido, sin markdown, sin comillas triples, solo el JSON puro.

Vas a recibir el contexto completo (requisitos y tareas) y, al final, la lista de ids que tenés que evaluar EN ESTA RESPUESTA. Emití UN veredicto por cada id de esa lista, ni uno más ni uno menos. No inventes ids. No fusiones el veredicto de dos ids distintos en una sola entrada.

${[parts.req && reqRules, parts.task && taskRules, parts.amb && ambRules].filter(Boolean).join("\n\n")}

Devuelve EXACTAMENTE esta estructura JSON:
{
${shape.join(",\n")}
}`;
}

/** Parte una lista en grupos de n. */
export function chunk(list, n = BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Tope de salida = lo que entra en el contexto del modelo después del pedido. */
export function outputBudget(promptChars, contextTokens) {
  const used = Math.ceil(promptChars / CHARS_PER_TOKEN);
  return Math.max(MIN_OUT_TOKENS, contextTokens - used - MARGIN_TOKENS);
}

/**
 * Rescata los objetos JSON completos que traen `key`, aunque la respuesta esté cortada.
 * Recorre el texto contando llaves fuera de los strings; cada {...} balanceado que parsea y tiene `key` vale.
 */
export function salvageObjects(raw, key) {
  const out = [];
  const s = String(raw || "");
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end < 0) continue;
    try {
      const o = JSON.parse(s.slice(i, end + 1));
      if (o && typeof o === "object" && !Array.isArray(o) && key in o) { out.push(o); i = end; }
    } catch { /* no es un objeto entero: se sigue buscando adentro */ }
  }
  return out;
}

/** Lee una respuesta: entera si se puede; si no, lo que se pueda rescatar. */
export function readVerdicts(raw) {
  const p = parseJsonLoose(String(raw || ""));
  if (p.ok && p.data && typeof p.data === "object") {
    return {
      whole: true,
      req: Array.isArray(p.data.requirement_verdicts) ? p.data.requirement_verdicts : [],
      task: Array.isArray(p.data.task_verdicts) ? p.data.task_verdicts : [],
      amb: Array.isArray(p.data.ambiguous_findings) ? p.data.ambiguous_findings : null,
      error: null,
    };
  }
  return {
    whole: false,
    req: salvageObjects(raw, "requirement_id"),
    task: salvageObjects(raw, "task_id"),
    amb: null,
    error: p.error || "JSON ilegible",
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta la revisión de completitud (un veredicto forzado por requisito y por tarea), en tandas.
 * @param {string} originalPrompt
 * @param {Array<{id: string, task?: string, description?: string}>} generatedGraph
 * @param {{requirements?: Array<{id:string, text:string}>, sectionLabels?: string[], model?: string,
 *   logCallback?: (msg:string)=>void, requireQuotes?: boolean, withDescriptions?: boolean,
 *   contextTokens?: number, batch?: number, fetchImpl?: Function, retryWaitMs?: number}} [opts]
 */
export async function runCompletenessReview(originalPrompt, generatedGraph, opts = {}) {
  const log = typeof opts.logCallback === "function" ? opts.logCallback : () => {};
  const modelId = opts.model || MODEL_ID_DEFAULT;
  const fetchImpl = opts.fetchImpl || fetch;
  const contextTokens = opts.contextTokens || 16000;
  const batchSize = opts.batch || BATCH;
  const waitMs = opts.retryWaitMs ?? 2000;

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
      : opts.stageBlock !== undefined
        ? opts.stageBlock
        : loadStageBlock(new URL("./context/ProjectStage.md", import.meta.url));
  const stageMeta = { stage_sha256: stage ? stage.sha256 : "off" };
  log(stage ? `stage: ON (${String(stageMeta.stage_sha256).slice(0, 8)})` : "stage: OFF");

  const reqList = requirements.map((r) => `${r.id}: ${r.text}`).join("\n");
  const taskList = tasks.map((t) => `${t.id}: ${t.text}`).join("\n");
  const context =
    (stage ? `CONTEXTO DEL LABORATORIO:\n${stage.block}\n\n` : "") +
    `PROMPT ORIGINAL (texto completo, usalo para AMBIGUOUS y como contexto):\n${originalPrompt}\n\n` +
    `REQUISITOS DEL PROYECTO:\n${reqList}\n\n` +
    `TAREAS DEL GRAPH:\n${taskList}`;

  // Tandas: requisitos y tareas por separado. AMBIGUOUS va en la primera.
  const batches = [
    ...chunk(requirements.map((r) => r.id), batchSize).map((ids) => ({ kind: "req", ids })),
    ...chunk(tasks.map((t) => t.id), batchSize).map((ids) => ({ kind: "task", ids })),
  ];
  if (batches.length) batches[0].amb = true;
  log(`${REVIEWER_VERSION}: ${batches.length} tanda(s) de hasta ${batchSize} · contexto ${contextTokens} tokens`);

  const runMetaBase = {
    model: modelId,
    temperature: 0.1,
    stage: stageMeta.stage_sha256,
    reviewer_version: requireQuotes ? `${REVIEWER_VERSION} +citas` : REVIEWER_VERSION,
    with_descriptions: requireQuotes || !!opts.withDescriptions,
    requirement_count: requirements.length,
    task_count: tasks.length,
    context_tokens: contextTokens,
    batches: batches.length,
  };

  const gotReq = new Map(), gotTask = new Map();
  let ambiguous = null;
  const calls = [];
  const failures = []; // tandas que quedaron incompletas tras MAX_ATTEMPTS

  for (let b = 0; b < batches.length; b++) {
    const B = batches[b];
    const got = B.kind === "req" ? gotReq : gotTask;
    const idKey = B.kind === "req" ? "requirement_id" : "task_id";
    let lastKind = null, lastDetail = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const pending = B.ids.filter((id) => !got.has(id));
      if (!pending.length) break;
      const wantAmb = !!B.amb && ambiguous === null;
      const parts = { req: B.kind === "req", task: B.kind === "task", amb: wantAmb };
      const system = buildSystemPrompt({ requireQuotes, parts });
      const what = B.kind === "req" ? "REQUISITOS" : "TAREAS";
      const user = `${context}\n\n${what} A EVALUAR EN ESTA RESPUESTA (exactamente uno por cada id, solo estos):\n${pending.join(", ")}`;
      const max_tokens = outputBudget(system.length + user.length, contextTokens);
      const call = { batch: b + 1, kind: B.kind, attempt, ids: pending, max_tokens, finish_reason: null, usage: null, raw: null, error: null, got: 0 };
      calls.push(call);
      log(`tanda ${b + 1}/${batches.length} (${what.toLowerCase()} ${pending[0]}…${pending.at(-1)}, ${pending.length}) intento ${attempt}/${MAX_ATTEMPTS} · tope ${max_tokens}`);
      let data;
      try {
        const response = await fetchImpl(LM_STUDIO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            temperature: 0.1,
            max_tokens,
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LM Studio respondió ${response.status} ${response.statusText}: ${String(errorText).slice(0, 300)}`);
        }
        data = await response.json();
      } catch (e) {
        call.error = `red: ${e.message}`;
        lastKind = "red"; lastDetail = e.message;
        log(`  ✗ no hubo respuesta (${e.message}) → se repite igual`);
        if (attempt < MAX_ATTEMPTS) await sleep(waitMs * attempt);
        continue;
      }
      const choice = data?.choices?.[0] || {};
      const raw = String(choice.message?.content ?? "");
      call.raw = raw;
      call.finish_reason = choice.finish_reason ?? null;
      call.usage = data?.usage ?? null;
      const v = readVerdicts(raw);
      const list = B.kind === "req" ? v.req : v.task;
      for (const x of list) {
        const id = x?.[idKey];
        if (pending.includes(id) && !got.has(id)) { got.set(id, x); call.got++; }
      }
      if (wantAmb && v.amb) ambiguous = v.amb;
      const still = B.ids.filter((id) => !got.has(id));
      if (call.finish_reason === "length") { lastKind = "corte"; lastDetail = `la respuesta se cortó por largo (finish_reason=length, tope ${max_tokens})`; }
      else if (!v.whole) { lastKind = "json"; lastDetail = `JSON ilegible (${v.error})`; }
      else if (still.length) { lastKind = "faltan"; lastDetail = `no trajo veredicto de ${still.join(", ")}`; }
      else { lastKind = null; lastDetail = ""; }
      call.error = lastKind ? `${lastKind}: ${lastDetail}` : null;
      log(still.length
        ? `  ~ ${call.got} veredicto(s); faltan ${still.length}${lastKind ? ` (${lastDetail})` : ""} → se piden solo esos`
        : `  ✓ ${call.got} veredicto(s)${v.whole ? "" : " (rescatados de una respuesta cortada)"}`);
    }
    const still = B.ids.filter((id) => !got.has(id));
    if (still.length) failures.push({ batch: b + 1, kind: B.kind, missing: still, kind_error: lastKind, detail: lastDetail });
  }

  if (failures.length) {
    const why = failures
      .map((f) => `tanda ${f.batch}: faltan ${f.missing.join(", ")} tras ${MAX_ATTEMPTS} intentos (${f.kind_error === "red" ? `LM Studio no respondió: ${f.detail}` : f.detail})`)
      .join(" · ");
    log(`ERROR: ${why}`);
    return {
      findings: [{ type: "SYSTEM_ERROR", reference: "Reviewer", reason: why, error_kind: failures.map((f) => f.kind_error) }],
      coverage_score: null,
      schema_complete: false,
      schema_gaps: { missingReq: failures.filter((f) => f.kind === "req").flatMap((f) => f.missing), extraReq: [], missingTask: failures.filter((f) => f.kind === "task").flatMap((f) => f.missing), extraTask: [] },
      raw_verdicts: { requirement_verdicts: [...gotReq.values()], task_verdicts: [...gotTask.values()], ambiguous_findings: ambiguous || [] },
      run_meta: runMetaBase,
      calls,
    };
  }

  const decision = {
    requirement_verdicts: requirements.map((r) => gotReq.get(r.id)),
    task_verdicts: tasks.map((t) => gotTask.get(t.id)),
    ambiguous_findings: ambiguous || [],
  };
  log("schema_complete: true");

  const gap_findings = decision.requirement_verdicts
    .filter((v) => v.covered !== true || (v.covering_task_ids ?? []).length === 0)
    .map((v) => {
      // Contradicción interna: covered=true sin ninguna tarea que lo respalde → GAP (20/20 en el set de
      // referencia, 0 falsos positivos). covered que no es true ni false también es GAP: no dijo que esté.
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
    for (const v of decision.requirement_verdicts) {
      if (v.covered !== true || !(v.covering_task_ids ?? []).length) continue; // ya es GAP
      const req = requirements.find((r) => r.id === v.requirement_id);
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

  const excess_findings = decision.task_verdicts
    .filter((v) => v.in_scope === false)
    .map((v) => ({
      type: "EXCESS",
      task_id: v.task_id,
      reference: tasks.find((t) => t.id === v.task_id)?.text ?? "(id desconocido)",
      reason: v.reason,
    }));

  const ambiguous_findings = decision.ambiguous_findings.map((f) => ({ type: "AMBIGUOUS", ...f }));

  // Score calculado por el harness contra los requisitos reales, no inventado por el modelo.
  const coverage_score = requirements.length ? (requirements.length - gap_findings.length) / requirements.length : null;
  log(`GAP=${gap_findings.length} EXCESS=${excess_findings.length} AMBIGUOUS=${ambiguous_findings.length} coverage=${coverage_score} · ${calls.length} llamada(s)`);

  return {
    findings: [...gap_findings, ...excess_findings, ...ambiguous_findings],
    coverage_score,
    schema_complete: true,
    schema_gaps: { missingReq: [], extraReq: [], missingTask: [], extraTask: [] },
    raw_verdicts: decision,
    run_meta: runMetaBase,
    calls,
  };
}
