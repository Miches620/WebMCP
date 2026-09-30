// exp_quote_reviewer.mjs — Reviewer v0.7 (regla de cita) sobre Project20.
//
// Antecedente (evidence/split_reviewer_2026-09-30T21-44-13.json, v0.6):
//   sin partir R2 → 0/10 GAP; partido → 3/5 (títulos) y 1/5 (título+desc).
//   Cuando dice "cubierto", el reason copia el requisito sin respaldo en las tareas.
//
// Celdas (5 reps c/u, título+descripción, reviewer v0.7 con requireQuotes):
//   A  SPLIT  + graph real          → esperado: R2b GAP, sin otros GAP
//   B  SPLIT  + graph contrafactual → esperado: sin ningún GAP (control de falsos GAP:
//                                     F4.1 sí pide el campo de preferencias)
//   C  ORIG   + graph real          → esperado: R2 cubierto (sin partir, la cita
//                                     "formulario de contacto" alcanza)
//
//   node experiments/exp_quote_reviewer.mjs      (5 reps)

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
const promptFor = (reqs) =>
  g.prompt.replace(/(El prototipo debe permitir:\n\n)[\s\S]*?(\n\nCriterios de éxito:)/, `$1${reqs.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}$2`);

const REAL = g.tasks;
const CF = g.tasks.map((t) => t.id === "F4.1"
  ? { ...t, description: "Crear los campos de input (nombre, email, mensaje), un campo de preferencias del cliente que sea opcional, y el botón dentro del contenedor estructural existente para definir la forma del formulario." }
  : t);

const CELLS = [
  { key: "A SPLIT+real", reqs: SPLIT, tasks: REAL, expectGap: ["R2b"] },
  { key: "B SPLIT+contrafactual", reqs: SPLIT, tasks: CF, expectGap: [] },
  { key: "C ORIG+real", reqs: ORIG, tasks: REAL, expectGap: [] },
];

const runs = [];
const summary = {};
for (const c of CELLS) {
  const s = (summary[c.key] = { reps: REPS, exact: 0, expected_gap_hit: 0, false_gaps: 0, harness_corrections: 0, model_said_uncovered: 0, errors: 0, schema_incomplete: 0 });
  for (let rep = 1; rep <= REPS; rep++) {
    const r = await runCompletenessReview(promptFor(c.reqs), c.tasks, { requirements: c.reqs, requireQuotes: true });
    if (r.findings?.some((f) => f.type === "SYSTEM_ERROR")) {
      s.errors++;
      runs.push({ cell: c.key, rep, error: r.findings[0].reason });
      console.log(`${c.key} #${rep} ERROR ${r.findings[0].reason}`);
      continue;
    }
    const gapF = r.findings.filter((f) => f.type === "GAP");
    const gaps = gapF.map((f) => f.requirement_id);
    const falseGaps = gaps.filter((id) => !c.expectGap.includes(id));
    const hit = c.expectGap.every((id) => gaps.includes(id));
    if (hit) s.expected_gap_hit++;
    if (hit && !falseGaps.length) s.exact++;
    s.false_gaps += falseGaps.length;
    s.harness_corrections += gapF.filter((f) => f.corrected_by_harness).length;
    s.model_said_uncovered += (r.raw_verdicts?.requirement_verdicts || []).filter((v) => v.covered === false).length;
    if (!r.schema_complete) s.schema_incomplete++;
    const tag = hit && !falseGaps.length ? "✓" : "✗";
    console.log(`${c.key.padEnd(24)} #${rep} ${tag} GAP=[${gaps.join(",")}]${falseGaps.length ? ` falsos=[${falseGaps.join(",")}]` : ""}`);
    for (const f of gapF) console.log(`    ${f.requirement_id}: ${f.corrected_by_harness ? `harness → ${f.corrected_by_harness}` : `modelo: ${String(f.reason).slice(0, 100)}`}`);
    runs.push({ cell: c.key, rep, gaps, false_gaps: falseGaps, findings: r.findings, requirement_verdicts: r.raw_verdicts?.requirement_verdicts, schema_complete: r.schema_complete, run_meta: r.run_meta });
  }
}

console.log("\n=== Resumen ===");
for (const [k, s] of Object.entries(summary))
  console.log(`${k.padEnd(24)} exactas ${s.exact}/${s.reps - s.errors}  | GAP esperado ${s.expected_gap_hit}/${s.reps - s.errors}  | falsos GAP ${s.false_gaps}  | correcciones del harness ${s.harness_corrections}  | errores ${s.errors}  | schema incompleto ${s.schema_incomplete}`);

mkdirSync(new URL("../evidence/", import.meta.url), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = new URL(`../evidence/quote_reviewer_${stamp}.json`, import.meta.url);
writeFileSync(out, JSON.stringify({ experiment: "exp_quote_reviewer v0.1", reviewer: "completeness_reviewer3 v0.7-quotes", reps: REPS, summary, runs }, null, 2));
console.log(`→ ${out.pathname}`);
