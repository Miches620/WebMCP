// plan_stage_check.mjs — chequeo de etapa a nivel PLAN (antes de atomizar)
//
// Origen: Project20, intento 2. TechLeader armó "F7 Pruebas Funcionales,
// Optimización y Despliegue" (y un F1 de entorno); el Atomic Engine tardó
// 30 min en atomizar 28 tareas y recién ahí el Completeness Reviewer marcó
// EXCESS=15. Este chequeo mira las FASES (5-7 ítems, segundos) con el mismo
// bloque de context/ProjectStage.md, y si alguna trae trabajo de una etapa
// posterior, script.js le devuelve el feedback a TechLeader antes de gastar
// el atomizado.
//
// Mismo diseño que completeness_reviewer3 (v0.6-bounded): el harness enumera
// cada fase y exige EXACTAMENTE un veredicto por fase; lo que falte o sobre
// se reporta aparte (schema_complete / schema_gaps), no se adivina.
//
// No decide requisitos: la etapa nunca quita una Feature pedida ni agrega
// una (reglas 1, 2 y 5 del bloque). Eso se le dice al modelo y además el
// feedback a TechLeader lo repite.

import { loadStageBlock } from "./context/stage_loader.mjs";

const LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions";
const MODEL_ID_DEFAULT = "qwen2.5-7b-instruct";
export const VERDICTS = ["IN_SCOPE", "DEFERRED", "EXCESS"];

function buildSystemPrompt() {
  return `Sos el revisor de ETAPA de un plan de fases de MicheLab.

Recibís:
- el CONTEXTO DEL LABORATORIO (la etapa vigente y su criterio de pertenencia),
- el BRIEF del proyecto (lo que el usuario pidió),
- las FASES del plan que armó TechLeader.

Para CADA fase emití exactamente un veredicto:
- "IN_SCOPE": todo su trabajo pertenece a la etapa vigente (es necesario para que la primera versión exista, se ejecute, o se pueda observar y probar).
- "DEFERRED": la fase incluye trabajo profesional válido que pertenece a una etapa posterior (operar, sostener, escalar, endurecer o automatizar para uso real sostenido). Si la fase MEZCLA trabajo de la etapa con trabajo posterior, igual es DEFERRED, y en "deferred_part" nombrás SOLO la parte diferida.
- "EXCESS": la fase amplía el alcance sin estar pedida ni ser necesaria, o contradice algo que el brief excluye.

Reglas:
1. Lo que el brief pide expresamente nunca es DEFERRED ni EXCESS: prevalece el brief.
2. Que algo no aparezca literal en el brief no lo hace DEFERRED ni EXCESS: si hace falta para construir, ejecutar o probar lo pedido, es IN_SCOPE.
3. Probar la primera versión es parte de la etapa. Automatizar, endurecer u optimizar para uso real sostenido, no.
4. "deferred_part" va vacío ("") si el veredicto es IN_SCOPE.

Devolvé EXCLUSIVAMENTE este JSON:
{
  "phase_verdicts": [
    { "phase_id": "F1", "verdict": "IN_SCOPE", "deferred_part": "", "reason": "una frase" }
  ]
}`;
}

function phaseLine(f) {
  return `${f.id} [${f.responsable_sugerido || "?"}] ${f.name || ""}: ${f.description || ""}`.trim();
}

function parseJsonLoose(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("plan_stage_check: la respuesta no contiene JSON");
    return JSON.parse(m[0]);
  }
}

/**
 * Valida y normaliza la respuesta del modelo contra las fases pedidas.
 * Exportada aparte para testearla sin LLM.
 */
export function evaluateVerdicts(fases, decision) {
  const ids = fases.map((f) => f.id);
  const byId = new Map();
  const invalid = [];
  for (const v of decision?.phase_verdicts ?? []) {
    const verdict = String(v?.verdict || "").toUpperCase().trim();
    if (!VERDICTS.includes(verdict)) {
      invalid.push(v?.phase_id ?? "(sin id)");
      continue;
    }
    if (!byId.has(v.phase_id)) {
      byId.set(v.phase_id, {
        phase_id: v.phase_id,
        verdict,
        deferred_part: verdict === "IN_SCOPE" ? "" : String(v.deferred_part || "").trim(),
        reason: String(v.reason || "").trim(),
      });
    }
  }
  const missing = ids.filter((id) => !byId.has(id));
  const extra = [...byId.keys()].filter((id) => !ids.includes(id));
  const verdicts = ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
  const flagged = verdicts
    .filter((v) => v.verdict !== "IN_SCOPE")
    .map((v) => {
      const f = fases.find((x) => x.id === v.phase_id);
      return { ...v, phase_name: f?.name || "" };
    });
  return {
    verdicts,
    flagged,
    schema_complete: missing.length === 0 && extra.length === 0 && invalid.length === 0,
    schema_gaps: { missing, extra, invalid },
  };
}

/**
 * Arma el feedback para TechLeader a partir de las fases marcadas.
 */
export function formatStageFeedback(stage, flagged) {
  if (!flagged?.length) return "";
  const lines = flagged.map((f) => {
    const part = f.deferred_part ? ` — parte: ${f.deferred_part}` : "";
    return `- ${f.phase_id} "${f.phase_name}" → ${f.verdict}${part}. ${f.reason}`;
  });
  return (
    `\n\n=== CHEQUEO DE ETAPA (${stage}) ===\n` +
    `Estas fases traen trabajo que no pertenece a la etapa ${stage}:\n` +
    lines.join("\n") +
    `\n\nRehacé el plan de fases:\n` +
    `- DEFERRED: sacá SOLO la parte diferida; si la fase queda vacía, sacá la fase y ajustá "depends_on". Lo que saques listalo en "diferido" (no se descarta).\n` +
    `- EXCESS: sacalo.\n` +
    `- NO saques nada de lo que está en Features, aunque este chequeo lo haya marcado. NO agregues trabajo nuevo.\n`
  );
}

/**
 * @param {string} brief  prompt del proyecto (sin la sección de etapa)
 * @param {Array<{id:string,name?:string,description?:string,responsable_sugerido?:string}>} fases
 * @param {{model?:string, logCallback?:(m:string)=>void, stageFile?:string|URL}} [opts]
 */
export async function runPlanStageCheck(brief, fases, opts = {}) {
  const log = typeof opts.logCallback === "function" ? opts.logCallback : () => {};
  const modelId = opts.model || MODEL_ID_DEFAULT;
  if (!Array.isArray(fases) || !fases.length) throw new Error("plan_stage_check: plan sin fases");

  // Falla fuerte si falta el bloque: nunca "sin etapa" en silencio.
  const stage = loadStageBlock(opts.stageFile || new URL("./context/ProjectStage.md", import.meta.url));
  log(`stage: ${stage.stage} (${stage.sha256.slice(0, 8)}) | fases: ${fases.length}`);

  const userMessage =
    `CONTEXTO DEL LABORATORIO:\n${stage.block}\n\n` +
    `BRIEF:\n${brief}\n\n` +
    `FASES A EVALUAR (emití EXACTAMENTE un veredicto por cada una):\n` +
    fases.map(phaseLine).join("\n");

  const response = await fetch(LM_STUDIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });
  if (!response.ok) {
    throw new Error(`LM Studio ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || "";
  const decision = parseJsonLoose(raw);
  const result = evaluateVerdicts(fases, decision);

  log(
    result.schema_complete
      ? "schema_complete: true"
      : `schema_complete: false | ${JSON.stringify(result.schema_gaps)}`,
  );
  log(
    `IN_SCOPE=${result.verdicts.filter((v) => v.verdict === "IN_SCOPE").length} ` +
      `DEFERRED=${result.flagged.filter((v) => v.verdict === "DEFERRED").length} ` +
      `EXCESS=${result.flagged.filter((v) => v.verdict === "EXCESS").length}`,
  );

  return {
    ...result,
    stage: stage.stage,
    stage_sha256: stage.sha256,
    feedback: formatStageFeedback(stage.stage, result.flagged),
    run_meta: { model: modelId, temperature: 0.1, checker_version: "v0.1-bounded" },
    raw_decision: decision,
  };
}
