// run_pilot.mjs — Paso 4: Specialist → Artifact → Validation (1 feature, punta a punta).
//
//   node pilot/run_pilot.mjs                 corre Specialist (LM Studio) + Validation
//   node pilot/run_pilot.mjs --validate DIR  solo valida una corrida ya hecha
//   node pilot/run_pilot.mjs --config form_pilot_f41_pref.json   otra variante del piloto
//
// Deja todo en pilot/runs/<fecha>/: el HTML de cada paso, la respuesta cruda
// de Gemma por tarea, y evidence.json con Validation sobre cada paso y el final.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runSpecialist } from "./specialist_runner.mjs";
import { validateForm, SPEC_VERSION, HOLDOUT_TEXTS } from "./holdout/form_holdout.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const ci = args.indexOf("--config");
const configName = ci >= 0 ? args.splice(ci, 2)[1] : "form_pilot.json";
const pilot = JSON.parse(readFileSync(join(here, configName), "utf8"));
let outDir, specialist;
if (args[0] === "--validate") {
  outDir = args[1];
  specialist = existsSync(join(outDir, "specialist.json")) ? JSON.parse(readFileSync(join(outDir, "specialist.json"), "utf8")) : null;
} else {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  outDir = join(here, "runs", `${stamp}_${configName.replace(/\.json$/, "")}`);
  specialist = await runSpecialist(pilot, outDir, { forbidden: HOLDOUT_TEXTS });
  writeFileSync(join(outDir, "specialist.json"), JSON.stringify(specialist, null, 2));
}

// Validation sobre cada paso: muestra en qué tarea aparece o se rompe cada criterio.
const perStep = [];
for (const s of specialist?.steps || []) {
  if (!s.file) { perStep.push({ task_id: s.task_id, result: "SIN_ARTEFACTO" }); continue; }
  const ev = await validateForm(join(outDir, s.file));
  perStep.push({ task_id: s.task_id, result: ev.validation_result, checks: Object.fromEntries(ev.checks.map((c) => [c.id, c.result])) });
}
const final = await validateForm(join(outDir, "index.html"));

const evidence = {
  type: "EVIDENCE",
  pilot: "paso 4 — Formulario de contacto (Project20)",
  feature: pilot.feature,
  config: configName,
  variant: pilot.variant || null,
  spec_version: SPEC_VERSION,
  specialist: specialist && { model: specialist.model, version: specialist.specialist_version, order: specialist.order, steps: specialist.steps },
  validation_final: final,
  validation_per_step: perStep,
};
writeFileSync(join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));

console.log("\n=== Validation por paso ===");
const ids = Object.keys(final.checks.reduce((a, c) => ((a[c.id] = 1), a), {}));
console.log("tarea   " + ids.map((i) => i.padEnd(8)).join("") + "resultado");
for (const p of perStep) console.log(p.task_id.padEnd(8) + ids.map((i) => (p.checks?.[i] || "-").padEnd(8)).join("") + p.result);
console.log("\n=== Final ===");
for (const c of final.checks) console.log(`${c.result.padEnd(7)} ${c.id} ${c.criterion} — ${c.detail}`);
final.info.forEach((i) => console.log(`INFO    ${i}`));
console.log(`\n${final.validation_result}  →  ${join(outDir, "evidence.json")}`);
