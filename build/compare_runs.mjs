// compare_runs.mjs — compara builds del Specialist por archivos (07/10, paso 3: medir Skills).
//
//   node build/compare_runs.mjs build/runs/<dir1> build/runs/<dir2> ...
//
// Por corrida: proyecto, con/sin Skills, minutos del Specialist, intentos por paso, cuántas veces
// apareció el error que cada Skill quiere evitar (su `detecta`, buscado en los problemas que
// encontró el harness en TODOS los intentos) y el resultado de Validation. Es la medida del
// Utility Score de cada Skill: si con la Skill su error baja, sirve; si no, se descarta.

import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { loadRole } from "../roles/registry.mjs";

const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!dirs.length) { console.log("uso: node build/compare_runs.mjs build/runs/<dir> [más dirs]"); process.exit(1); }
const role = await loadRole("web-game");
const rows = [];
for (const d of dirs) {
  const bj = join(d, "build.json"), ej = join(d, "evidence.json");
  if (!existsSync(bj)) { console.log(`(sin build.json) ${d}`); continue; }
  const b = JSON.parse(readFileSync(bj, "utf8"));
  const e = existsSync(ej) ? JSON.parse(readFileSync(ej, "utf8")) : null;
  const sp = b.specialist || {};
  const steps = sp.steps || [];
  const problems = steps.flatMap((s) => (s.attempts || []).flatMap((a) => a.problems || []));
  const hits = Object.fromEntries(role.skills.map((s) => [s.id, s.detects ? problems.filter((p) => s.detects.test(p)).length : null]));
  rows.push({
    run: basename(d), project: b.input?.refined?.project_name || "?", skills: sp.skills ? "con" : "sin",
    min: Math.round(steps.reduce((a, s) => a + (s.ms || 0), 0) / 600) / 100,
    attempts: steps.map((s) => `${s.task_id}:${(s.attempts || []).length}`).join(" "),
    problems: problems.length, hits,
    validation: e ? `${e.summary.PASS} PASS / ${e.summary.FAIL} FAIL / ${e.summary.SIN_CHEQUEO} SC` : "?",
    always: e?.validation?.always?.map((x) => `${x.type}:${x.result}`).join(" ") || "",
  });
}
console.log(`\n| corrida | proyecto | skills | min | intentos por paso | problemas | Validation |\n|---|---|---|---|---|---|---|`);
for (const r of rows) console.log(`| ${r.run} | ${r.project} | ${r.skills} | ${r.min} | ${r.attempts} | ${r.problems} | ${r.validation} |`);
console.log(`\nVeces que apareció el error que cada Skill quiere evitar (menos es mejor):\n\n| skill | ${rows.map((r) => `${r.project} ${r.skills}`).join(" | ")} |\n|---|${rows.map(() => "---").join("|")}|`);
for (const s of role.skills) console.log(`| ${s.id} | ${rows.map((r) => r.hits[s.id] ?? "-").join(" | ")} |`);
console.log("");
