// test_plan_stage_check.mjs — determinista, sin LLM (fetch simulado).
//   node test_plan_stage_check.mjs
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateVerdicts, formatStageFeedback, runPlanStageCheck } from "./plan_stage_check.mjs";
import { loadStageBlock } from "./context/stage_loader.mjs";

let ok = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

// Project20, intento 2 (nombres reales del log; 30 min de atomizado → EXCESS=15)
const fasesP20i2 = [
  { id: "F1", name: "Configuración del Entorno y Estructura Base", responsable_sugerido: "DevOps" },
  { id: "F2", name: "Modelado e Ingesta de Datos Estáticos (Menú)", responsable_sugerido: "DBA" },
  { id: "F3", name: "Desarrollo del Frontend Estático y Componentes Reutilizables", responsable_sugerido: "Frontend" },
  { id: "F4", name: "Integración de Contenido Estático y Catálogo de Cafés", responsable_sugerido: "Frontend" },
  { id: "F5", name: "Implementación del Backend de Datos Dinámicos y Formulario", responsable_sugerido: "Backend" },
  { id: "F6", name: "Conexión Final de Datos e Interfaz de Usuario", responsable_sugerido: "Frontend" },
  { id: "F7", name: "Pruebas Funcionales, Optimización y Despliegue", responsable_sugerido: "QA" },
];
const inScope = (id) => ({ phase_id: id, verdict: "IN_SCOPE", deferred_part: "", reason: "necesaria" });

await check("stage_loader expone etapa y criterio sin las reglas de revisión", () => {
  const s = loadStageBlock(new URL("./context/ProjectStage.md", import.meta.url));
  assert(s.stage === "PROTOTYPE", `stage=${s.stage}`);
  assert(s.criterion.includes("Criterio de pertenencia"), "criterio sin 'Criterio de pertenencia'");
  assert(!s.criterion.includes("Cómo aplicarlo al revisar"), "criterio incluye reglas de revisor");
  assert(s.block.includes("Cómo aplicarlo al revisar"), "el bloque completo debe seguir entero");
});

await check("evaluateVerdicts: fase mixta DEFERRED queda marcada con su parte", () => {
  const r = evaluateVerdicts(fasesP20i2, {
    phase_verdicts: [
      ...["F1", "F2", "F3", "F4", "F5", "F6"].map(inScope),
      { phase_id: "F7", verdict: "deferred", deferred_part: "Optimización y Despliegue", reason: "uso real sostenido" },
    ],
  });
  assert(r.schema_complete, JSON.stringify(r.schema_gaps));
  assert(r.flagged.length === 1 && r.flagged[0].phase_id === "F7", JSON.stringify(r.flagged));
  assert(r.flagged[0].verdict === "DEFERRED", "verdict no normalizado a mayúsculas");
  assert(r.flagged[0].phase_name.startsWith("Pruebas"), "falta phase_name");
});

await check("evaluateVerdicts: faltantes, sobrantes e inválidos van a schema_gaps, no se adivinan", () => {
  const r = evaluateVerdicts(fasesP20i2, {
    phase_verdicts: [
      ...["F1", "F2", "F3", "F4"].map(inScope),
      { phase_id: "F5", verdict: "MAYBE", reason: "?" },
      inScope("F9"),
    ],
  });
  assert(!r.schema_complete, "debería ser incompleto");
  assert(JSON.stringify(r.schema_gaps.missing) === '["F5","F6","F7"]', JSON.stringify(r.schema_gaps));
  assert(JSON.stringify(r.schema_gaps.extra) === '["F9"]', JSON.stringify(r.schema_gaps));
  assert(JSON.stringify(r.schema_gaps.invalid) === '["F5"]', JSON.stringify(r.schema_gaps));
  assert(r.flagged.length === 0, "no debe marcar nada que no tenga veredicto válido");
});

await check("evaluateVerdicts: IN_SCOPE descarta deferred_part", () => {
  const r = evaluateVerdicts([{ id: "F1" }], {
    phase_verdicts: [{ phase_id: "F1", verdict: "IN_SCOPE", deferred_part: "algo", reason: "" }],
  });
  assert(r.verdicts[0].deferred_part === "", "deferred_part debería vaciarse");
});

await check("formatStageFeedback: protege Features y pide listar lo diferido", () => {
  const fb = formatStageFeedback("PROTOTYPE", [
    { phase_id: "F7", phase_name: "Pruebas, Optimización y Despliegue", verdict: "DEFERRED", deferred_part: "Despliegue", reason: "r" },
  ]);
  assert(fb.includes("F7") && fb.includes("Despliegue"), fb);
  assert(fb.includes("NO saques nada de lo que está en Features"), "falta protección de Features");
  assert(fb.includes('"diferido"'), "falta pedido de listar diferido");
  assert(formatStageFeedback("PROTOTYPE", []) === "", "sin marcas → feedback vacío");
});

await check("runPlanStageCheck: manda bloque + brief + fases y devuelve feedback (fetch simulado)", async () => {
  let sent = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    const content = "```json\n" + JSON.stringify({
      phase_verdicts: [
        ...["F1", "F2", "F3", "F4", "F5", "F6"].map(inScope),
        { phase_id: "F7", verdict: "DEFERRED", deferred_part: "Optimización y Despliegue", reason: "operar en uso real" },
      ],
    }) + "\n```";
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  };
  try {
    const r = await runPlanStageCheck("Proyecto: Café\n\nFeatures:\n1. Carta", fasesP20i2);
    const user = sent.messages[1].content;
    assert(user.includes("ETAPA DEL PROYECTO: PROTOTYPE"), "no mandó el bloque de etapa");
    assert(user.includes("Features:\n1. Carta"), "no mandó el brief");
    assert(user.includes("F7 [QA] Pruebas Funcionales"), "no mandó las fases");
    for (const id of ["F1", "F2", "F3", "F4", "F5", "F6", "F7"])
      assert(user.includes(`"phase_id": "${id}"`), `el esqueleto no trae ${id}`);
    assert(!sent.messages[0].content.includes('"phase_id": "F1"'), "el system prompt no debe traer un ejemplo de una sola fase");
    assert(r.stage === "PROTOTYPE" && r.flagged.length === 1, JSON.stringify(r.flagged));
    assert(r.feedback.includes("CHEQUEO DE ETAPA (PROTOTYPE)"), r.feedback);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await check('evaluateVerdicts: un "?" sin completar cuenta como inválido, no como en alcance', () => {
  const r = evaluateVerdicts([{ id: "F1" }, { id: "F2" }], {
    phase_verdicts: [inScope("F1"), { phase_id: "F2", verdict: "?", deferred_part: "?", reason: "?" }],
  });
  assert(!r.schema_complete && r.schema_gaps.invalid[0] === "F2", JSON.stringify(r.schema_gaps));
});

await check("runPlanStageCheck: falla fuerte si ProjectStage no tiene bloque", async () => {
  const dir = mkdtempSync(join(tmpdir(), "stage-"));
  const bad = join(dir, "ProjectStage.md");
  writeFileSync(bad, "# sin marcas\n");
  let threw = false;
  try { await runPlanStageCheck("b", fasesP20i2, { stageFile: bad }); }
  catch (e) { threw = /marcas BEGIN\/END/.test(e.message); }
  assert(threw, "debería tirar por falta de marcas");
});

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
