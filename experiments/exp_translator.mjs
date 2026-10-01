// exp_translator.mjs — ¿el traductor requisito → chequeos discrimina como el holdout?
//
// Requisito: Feature 2 de Project20, tal cual (sin partir):
//   "Formulario de contacto con campos obligatorios y opcionalmente un campo para preferencias"
// Para cada traducción (5 reps) se ejecutan sus chequeos sobre:
//   - artefacto REAL del piloto (sin campo de preferencias)      → esperado FAIL
//   - artefacto CONTRAFACTUAL del piloto (con preferencias)       → esperado PASS  (control)
//   - fixtures ok_html5 (PASS) y sin_preferencias (FAIL)
// "Discrimina" = PASS en ambos controles y FAIL en ambos casos con hueco.
//
//   node experiments/exp_translator.mjs        (5 reps, LM Studio con qwen2.5-7b-instruct)

import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { translateRequirement } from "../validation/check_translator.mjs";
import { runChecks } from "../validation/check_catalog.mjs";

const REPS = Number(process.argv[2] || 5);
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const runsDir = here("../pilot/runs/");
const runs = readdirSync(runsDir);
const realDir = runs.find((d) => d.startsWith("2026-09-30T15-57-28"));
const cfDir = runs.find((d) => d.endsWith("_form_pilot_f41_pref"));
if (!realDir || !cfDir) throw new Error(`faltan corridas del piloto en pilot/runs (real=${realDir}, contrafactual=${cfDir})`);

const REQ = "Formulario de contacto con campos obligatorios y opcionalmente un campo para preferencias";
const TARGETS = [
  { name: "real", path: join(runsDir, realDir, "index.html"), expect: "FAIL" },
  { name: "contrafactual", path: join(runsDir, cfDir, "index.html"), expect: "PASS" },
  { name: "fixture ok_html5", path: here("../pilot/fixtures/ok_html5.html"), expect: "PASS" },
  { name: "fixture sin_preferencias", path: here("../pilot/fixtures/sin_preferencias.html"), expect: "FAIL" },
];

const results = [];
let discriminates = 0;
for (let rep = 1; rep <= REPS; rep++) {
  const t = await translateRequirement(REQ);
  console.log(`\n#${rep} chequeos: ${t.checks.map((c) => `${c.type}(${Object.values(c.params).map((v) => v.join("/")).join(" → ")})`).join(", ") || "NINGUNO"}${t.dropped.length ? `  | descartados: ${t.dropped.length}` : ""}`);
  const row = { rep, checks: t.checks, dropped: t.dropped, sin_chequeo: t.sin_chequeo, raw: t.raw, targets: [] };
  let ok = t.checks.length > 0;
  for (const tg of TARGETS) {
    const r = t.checks.length ? await runChecks(tg.path, t.checks) : [];
    const verdict = r.length && r.every((x) => x.result === "PASS") ? "PASS" : "FAIL";
    const good = verdict === tg.expect;
    ok = ok && good;
    console.log(`   ${good ? "✓" : "✗"} ${tg.name.padEnd(26)} ${verdict} (esperado ${tg.expect})  ${r.filter((x) => x.result !== "PASS").map((x) => `${x.type}: ${x.detail}`).join(" | ").slice(0, 160)}`);
    row.targets.push({ ...tg, verdict, checks: r });
  }
  if (ok) discriminates++;
  row.discriminates = ok;
  results.push(row);
}
console.log(`\nDiscrimina en ${discriminates}/${REPS} traducciones.`);

mkdirSync(here("../evidence/"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = here(`../evidence/translator_${stamp}.json`);
writeFileSync(out, JSON.stringify({ experiment: "exp_translator v0.1", requirement: REQ, reps: REPS, discriminates, results }, null, 2));
console.log(`→ ${out}`);
