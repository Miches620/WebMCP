// exp_split_reviewer.mjs — ¿Partir la Feature compuesta hace que el reviewer vea el GAP?
//
// Caso: Project20, Feature 2 "Formulario de contacto con campos obligatorios y
// opcionalmente un campo para preferencias". El graph real no tiene el campo de
// preferencias (F4.1: "nombre, email, mensaje") y el reviewer v3 dio R2 cubierto.
// El piloto (pilot/) confirmó que el campo falta en el artefacto.
//
// Antes de construir el "partidor" de Features, se verifica la premisa: si el
// reviewer recibe el requisito ya partido (a mano), ¿lo marca GAP?
//
// Diseño 2x2, mismo graph, mismo modelo, 5 repeticiones por celda:
//   requisitos:  ORIG (4, como en Project20)  |  SPLIT (R2 partido en dos, a mano)
//   tareas:      TITULO (lo que el reviewer ve hoy: extractTasks usa solo `task`)
//                | TITULO+DESC (título + descripción, donde dice "nombre, email, mensaje")
//
// Qué se mide: si el requisito de preferencias sale GAP, y GAPs en los demás
// requisitos (falsos positivos: todos los demás están cubiertos).
//
//   node experiments/exp_split_reviewer.mjs      (5 reps)
//   node experiments/exp_split_reviewer.mjs 3

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runCompletenessReview } from "../completeness_reviewer3.mjs";

const REPS = Number(process.argv[2] || 5);
const g = JSON.parse(readFileSync(new URL("./p20_graph.json", import.meta.url), "utf8"));

const ORIG = g.features.map((f, i) => ({ id: `R${i + 1}`, text: f }));
const SPLIT = [
  { id: "R1", text: g.features[0] },
  { id: "R2a", text: "Formulario de contacto con campos obligatorios" },
  { id: "R2b", text: "Formulario de contacto con un campo opcional para preferencias del cliente" },
  { id: "R3", text: g.features[2] },
  { id: "R4", text: g.features[3] },
];
// Requisito que el graph real NO cubre (esperado: GAP).
const TARGET = { ORIG: "R2", SPLIT: "R2b" };

// Mismo prompt en todas las celdas salvo la lista de features.
function promptFor(reqs) {
  const list = reqs.map((r, i) => `${i + 1}. ${r.text}`).join("\n");
  return g.prompt.replace(/(El prototipo debe permitir:\n\n)[\s\S]*?(\n\nCriterios de éxito:)/, `$1${list}$2`);
}

const TASKS = {
  TITULO: g.tasks.map((t) => ({ id: t.id, task: t.task })),
  TITULO_DESC: g.tasks.map((t) => ({ id: t.id, task: `${t.task} — ${t.description}` })),
};

const cells = [];
for (const reqName of ["ORIG", "SPLIT"]) for (const taskName of ["TITULO", "TITULO_DESC"]) cells.push([reqName, taskName]);

const runs = [];
const summary = {};
for (const [reqName, taskName] of cells) {
  const reqs = reqName === "ORIG" ? ORIG : SPLIT;
  const key = `${reqName}+${taskName}`;
  summary[key] = { target_gap: 0, other_gaps: 0, schema_incomplete: 0, errors: 0, reps: REPS };
  for (let rep = 1; rep <= REPS; rep++) {
    const r = await runCompletenessReview(promptFor(reqs), TASKS[taskName], { requirements: reqs });
    if (r.findings?.some((f) => f.type === "SYSTEM_ERROR")) {
      summary[key].errors++;
      runs.push({ cell: key, rep, error: r.findings[0].reason });
      console.log(`${key} #${rep} ERROR ${r.findings[0].reason}`);
      continue;
    }
    const gaps = r.findings.filter((f) => f.type === "GAP").map((f) => f.requirement_id);
    const hit = gaps.includes(TARGET[reqName]);
    if (hit) summary[key].target_gap++;
    summary[key].other_gaps += gaps.filter((id) => id !== TARGET[reqName]).length;
    if (!r.schema_complete) summary[key].schema_incomplete++;
    const tv = r.raw_verdicts?.requirement_verdicts?.find((v) => v.requirement_id === TARGET[reqName]);
    console.log(`${key.padEnd(18)} #${rep}  ${TARGET[reqName]}: ${hit ? "GAP ✓" : "cubierto ✗"}  otros GAP: [${gaps.filter((id) => id !== TARGET[reqName]).join(",")}]${r.schema_complete ? "" : "  [schema incompleto]"}`);
    if (tv) console.log(`   ${TARGET[reqName]} → ${JSON.stringify(tv.covering_task_ids)} "${String(tv.reason).slice(0, 140)}"`);
    runs.push({ cell: key, rep, gaps, target_hit: hit, target_verdict: tv, schema_complete: r.schema_complete, findings: r.findings, run_meta: r.run_meta });
  }
}

console.log("\n=== Resumen (GAP detectado en el requisito no cubierto / reps) ===");
for (const [k, s] of Object.entries(summary))
  console.log(`${k.padEnd(18)} ${s.target_gap}/${s.reps - s.errors}   falsos GAP: ${s.other_gaps}   schema incompleto: ${s.schema_incomplete}   errores: ${s.errors}`);

mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = new URL(`../evidence/split_reviewer_${stamp}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ experiment: "exp_split_reviewer v0.1", reviewer: "completeness_reviewer3 v0.6-bounded", reps: REPS, summary, requirements: { ORIG, SPLIT }, target: TARGET, runs }, null, 2));
console.log(`→ ${out.pathname}`);
