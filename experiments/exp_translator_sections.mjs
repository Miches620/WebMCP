// exp_translator_sections.mjs — ¿el traductor v0.3 elige chequeos de CONTENIDO
// que discriminan? (requisitos de sección de Project20: R1 catálogo en
// carrusel, R3 Nosotros, R4 Carta).
//
// Cada traducción (5 reps por requisito) se ejecuta sobre:
//   - esqueleto vacío del harness (baseline/ de la corrida v0.4)   → esperado FAIL en los 3
//   - app v0.3 (2026-10-01T18-59-04): carta parseada en 1 solo ítem → R1 PASS, R3 PASS, R4 FAIL
//   - app v0.4 (2026-10-01T20-08-48)                                → PASS en los 3
//   - fixtures sections_ok (PASS) y sections_vacio (FAIL)
// Los esperados salen de chequeos escritos a mano sobre esos mismos artefactos
// (test_check_catalog.mjs + control del 01/10). "Discrimina" = acierta en todos.
//
// v0.2: los chequeos pasan por anchorSections (igual que en run_build): se
// suman las palabras de la etiqueta de la feature y el ancla data-feature.
// Corrida v0.1 (21-43-35): R1 0/5 — Qwen nunca puso "catalogo" en section.
//
//   node experiments/exp_translator_sections.mjs [reps]

import { readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { translateRequirement, anchorSections, TRANSLATOR_VERSION } from "../validation/check_translator.mjs";
import { featureLabel } from "../build/specialist_spa.mjs";
import { runChecks, normalizeCheck } from "../validation/check_catalog.mjs";

const REPS = Number(process.argv[2] || 5);
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const runsDir = here("../build/runs/");
const runs = readdirSync(runsDir);
const v03 = runs.find((d) => d.startsWith("2026-10-01T18-59-04"));
const v04 = runs.find((d) => d.startsWith("2026-10-01T20-08-48"));
if (!v03 || !v04) throw new Error(`faltan corridas en build/runs (v0.3=${v03}, v0.4=${v04})`);
const skel = join(runsDir, v04, "baseline", "index.html");
if (!existsSync(skel)) throw new Error(`falta ${skel}: corré antes node build/run_build.mjs --validate build/runs/${v04}`);

const CONTEXT = "Proyecto: Landing Page de Café Especialidad";
const REQS = [
  { id: "R1", text: "Catalogo de cafés en tarjetas con foto superior e información inferior (en carrousel)", exp: { esqueleto: "FAIL", "v0.3": "PASS", "v0.4": "PASS", sections_ok: "PASS", sections_vacio: "FAIL" } },
  { id: "R3", text: "Sección 'Nosotros' con historia de la empresa", exp: { esqueleto: "FAIL", "v0.3": "PASS", "v0.4": "PASS", sections_ok: "PASS", sections_vacio: "FAIL" } },
  { id: "R4", text: "Sección 'Carta' con productos disponibles actualmente, obtenidos desde archivo de texto", exp: { esqueleto: "FAIL", "v0.3": "FAIL", "v0.4": "PASS", sections_ok: "PASS", sections_vacio: "FAIL" } },
];
const PATHS = {
  esqueleto: skel,
  "v0.3": join(runsDir, v03, "app", "index.html"),
  "v0.4": join(runsDir, v04, "app", "index.html"),
  sections_ok: here("../validation/fixtures/sections_ok.html"),
  sections_vacio: here("../validation/fixtures/sections_vacio.html"),
};

const results = [];
const tally = {};
for (const req of REQS) {
  tally[req.id] = 0;
  for (let rep = 1; rep <= REPS; rep++) {
    const t = await translateRequirement(req.text, { context: CONTEXT });
    t.checks = anchorSections(t.checks, req.id, req.text, featureLabel(req.text)).map((c) => ({ ...normalizeCheck(c), covers: c.covers }));
    console.log(`\n${req.id} #${rep}: ${t.checks.map((c) => `${c.type}(${Object.values(c.params).map((v) => v.join("/")).join(" → ")})`).join(", ") || "NINGUNO"}${t.dropped.length ? `  | descartados: ${t.dropped.length}` : ""}`);
    const row = { req: req.id, rep, checks: t.checks, dropped: t.dropped, raw: t.raw, targets: [] };
    let ok = t.checks.length > 0;
    for (const [name, path] of Object.entries(PATHS)) {
      const r = t.checks.length ? await runChecks(path, t.checks) : [];
      const verdict = r.length && r.every((x) => x.result === "PASS") ? "PASS" : "FAIL";
      const good = verdict === req.exp[name];
      ok = ok && good;
      console.log(`   ${good ? "✓" : "✗"} ${name.padEnd(15)} ${verdict} (esperado ${req.exp[name]})  ${r.filter((x) => x.result !== "PASS").map((x) => `${x.type}: ${x.detail}`).join(" | ").slice(0, 150)}`);
      row.targets.push({ name, expect: req.exp[name], verdict, checks: r });
    }
    row.discriminates = ok;
    if (ok) tally[req.id]++;
    results.push(row);
  }
}
console.log(`\nDiscrimina: ${Object.entries(tally).map(([k, v]) => `${k} ${v}/${REPS}`).join(" · ")}`);
mkdirSync(here("../evidence/"), { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const out = here(`../evidence/translator_sections_${stamp}.json`);
writeFileSync(out, JSON.stringify({ experiment: "exp_translator_sections v0.2 (con anchorSections)", translator: TRANSLATOR_VERSION, reps: REPS, tally, results }, null, 2));
console.log(`→ ${out}`);
