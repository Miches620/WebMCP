// step_bench.mjs — banco por paso (10/10).
//
// Por qué (control de Skills, 10/10): con temperature 0 cualquier texto agregado cambia la salida
// (un placebo movió Boxworld de 7/0 a 3/4). Un build entero por condición no mide nada: el cambio
// de un paso se agranda en los siguientes y es 1 sola muestra de 20–30 min.
// Qué hace: corre UN paso del Standard con las entradas fijas de builds anteriores (los pasos de
// antes se cargan de app/, no se le piden a Gemma) y lo repite k veces por condición. Cada muestra
// lleva una línea neutra distinta ("Referencia del pedido: …"): la diferencia entre
// muestras de la misma condición ES el ruido. v0.2 (11/10): la línea va al PRINCIPIO del pedido (al final
// tapaba la instrucción del paso: Invernadero escribió js/dibujo.js las 5 veces). Las referencias son las mismas en todas las
// condiciones (comparación pareada). Mide con las pruebas del harness (sin Validation).
//
//   node build/step_bench.mjs --step reglas --k 5 [--conds sin,con,placebo,con:<skill>+<skill>] [--repair] [--attempts 1] [--temp 0] <run_dir> [<run_dir> ...]
//
// Condiciones: sin · con (todas las Skills del Role) · placebo · con:<id>[+<id>] (solo esas Skills;
// sirve para medir UNA Skill candidata sin las demás). --repair: también corre la reparación por
// función (10 veces más lento; por defecto se mide solo la primera respuesta de Gemma).
//
// Cada <run_dir> es un build anterior (build/runs/…): de ahí salen el brief (input.json), el plan,
// los archivos de los pasos previos (app/) y las respuestas crudas del paso de datos.
// Retoma: si una muestra ya tiene result.json, no se vuelve a correr (--out <dir> para seguir una).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveProfiles } from "../profiles/registry.mjs";
import { getStandard } from "../standards/registry.mjs";
import { loadRole } from "../roles/registry.mjs";

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const STEP = flag("--step");
const K = Number(flag("--k", 5));
const CONDS = flag("--conds", "sin,con").split(",").map((x) => x.trim()).filter(Boolean);
const ATTEMPTS = Number(flag("--attempts", 1));
const TEMP = Number(flag("--temp", 0));
const valued = new Set(["--step", "--k", "--conds", "--attempts", "--temp", "--out"]);
const runDirs = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
if (!STEP || !runDirs.length) { console.log("uso: node build/step_bench.mjs --step reglas --k 5 [--conds sin,con,placebo] <run_dir> ..."); process.exit(1); }
for (const c of CONDS) if (!["sin", "con", "placebo"].includes(c) && !/^con:[\w-]+(\+[\w-]+)*$/.test(c)) throw new Error(`condición desconocida: ${c} (sin, con, placebo, con:<skill>+<skill>)`);
const REPAIR = args.includes("--repair");

// referencias neutras: la misma lista para todas las condiciones
const REFS = ["BX-1042", "QM-7731", "TR-2208", "LP-5160", "ZN-3397", "HD-8824", "WK-6015", "CF-4473", "JV-9286", "RS-1559", "MG-3640", "PY-7902", "DU-2481", "EL-6128", "OT-5714", "AN-8350", "IK-1967", "SV-4093", "GB-7245", "FC-3812"];
if (K > REFS.length) throw new Error(`--k como máximo ${REFS.length}`);
const prefixOf = (i) => `Referencia del pedido: ${REFS[i]}`;

/** Un build anterior → entradas fijas para el banco. */
function caseFrom(dir, S) {
  const input = JSON.parse(readFileSync(join(dir, "input.json"), "utf8"));
  const pagePlan = existsSync(join(dir, "page_plan.json")) ? JSON.parse(readFileSync(join(dir, "page_plan.json"), "utf8")).plan : null;
  const app = join(dir, "app");
  const files = {};
  for (const f of ["styles.css", ...S.scripts]) if (existsSync(join(app, f))) files[f] = readFileSync(join(app, f), "utf8");
  const html = existsSync(join(app, "index.html")) ? readFileSync(join(app, "index.html"), "utf8") : "";
  const fm = html.match(new RegExp(`<main id="${S.mainId}"[^>]*>\\n?([\\s\\S]*?)\\n?</main>`));
  const raws = {};
  for (const st of S.steps.filter((x) => x.kind === "data")) {
    const re = new RegExp(`^step_\\d+_${st.id}(\\.retry(\\d+))?\\.raw\\.txt$`);
    raws[st.id] = readdirSync(dir).filter((f) => re.test(f)).sort((a, b) => Number(a.match(re)[2] || 0) - Number(b.match(re)[2] || 0)).map((f) => readFileSync(join(dir, f), "utf8"));
  }
  return { name: input.refined?.project_name || basename(dir), dir, input, pagePlan, frozen: { files, fragment: fm ? fm[1] : "", raws } };
}

const norm = (p) => String(p).replace(/\d+/g, "#").replace(/`[^`]*`/g, "`…`").slice(0, 90);

const first = JSON.parse(readFileSync(join(runDirs[0], "input.json"), "utf8"));
const profile = resolveProfiles(first.refined.profiles);
const B = await import(new URL(`../profiles/${profile.build}/build.mjs`, import.meta.url));
const pmod = (await import(new URL(`../profiles/${profile.build}/profile.mjs`, import.meta.url))).default;
if (!pmod.standard) throw new Error(`el profile ${profile.ids.join(" + ")} no tiene Standard: el banco necesita el motor por archivos`);
const S = getStandard(pmod.standard);
if (!S.steps.some((x) => x.id === STEP)) throw new Error(`el paso "${STEP}" no existe en ${S.id}: ${S.steps.map((x) => x.id).join(", ")}`);
const role = pmod.role ? await loadRole(pmod.role) : null;
// con:<ids>: solo esas Skills (tienen que existir en el Role)
const subsetOf = (cond) => {
  if (!cond.startsWith("con:")) return null;
  const ids = cond.slice(4).split("+");
  const miss = ids.filter((id) => !role?.skills.some((s) => s.id === id));
  if (miss.length) throw new Error(`Skill desconocida en ${cond}: ${miss.join(", ")} (hay: ${(role?.skills || []).map((s) => s.id).join(", ")})`);
  return { role: role.id, status: role.status, list: role.skills.filter((s) => ids.includes(s.id)) };
};
CONDS.forEach(subsetOf);

const cases = runDirs.map((d) => caseFrom(d, S));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outRoot = flag("--out") || join("build", "bench", `${stamp}_${STEP}`);
mkdirSync(outRoot, { recursive: true });
writeFileSync(join(outRoot, "bench.json"), JSON.stringify({ version: "step_bench v0.2", step: STEP, k: K, conds: CONDS, attempts: ATTEMPTS, repair: REPAIR, temperature: TEMP, standard: { id: S.id, version: S.version }, cases: cases.map((c) => ({ name: c.name, dir: c.dir })), refs: REFS.slice(0, K) }, null, 2));
const total = cases.length * CONDS.length * K;
console.log(`[BANCO] paso ${STEP} · ${S.id} v${S.version} · ${cases.length} caso(s) × ${CONDS.join("/")} × k=${K} = ${total} muestras · ${ATTEMPTS} intento(s) · ${REPAIR ? "con" : "sin"} reparación por función · temperature ${TEMP}\n[BANCO] salida: ${outRoot}`);

const results = [];
let done = 0;
const quiet = () => {};
for (let i = 0; i < K; i++) {                    // muestra afuera, condición adentro: si LM Studio
  for (const c of cases) {                        // se pone más lento con el tiempo, le toca a todas
    for (const cond of CONDS) {
      const dir = join(outRoot, `${c.name}_${cond.replace(/[:+]/g, "-")}_${String(i + 1).padStart(2, "0")}`);
      const rf = join(dir, "result.json");
      done++;
      if (existsSync(rf)) { results.push(JSON.parse(readFileSync(rf, "utf8"))); console.log(`[BANCO] ${done}/${total} ${basename(dir)} (ya estaba)`); continue; }
      mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      let r;
      try {
        const sp = await B.build({ refined: c.input.refined, tasks: c.input.atomicTasks || c.input.tasks || [] }, dir, {
          log: quiet, forbidden: c.input.holdout?.forbidden || [], pagePlan: c.pagePlan,
          skills: subsetOf(cond) || cond === "con", placebo: cond === "placebo", temperature: TEMP,
          bench: { step: STEP, frozen: c.frozen, maxAttempts: ATTEMPTS, prefix: prefixOf(i), noRepair: !REPAIR },
        });
        const rec = sp.steps.find((s) => s.task_id === STEP);
        const a0 = rec.attempts[0] || {};
        const firstP = a0.first_problems || [];
        r = {
          case: c.name, cond, i: i + 1, ref: REFS[i], ms: Date.now() - t0,
          ok_first: firstP.length === 0, fatal_first: !!a0.first_fatal, ok_final: rec.problems_final.length === 0, broken: !!rec.broken,
          problems_first: firstP, problems_final: rec.problems_final, wrong_files: a0.wrong_files || [],
          member_repair: (rec.attempts || []).flatMap((a) => a.member_repair || []).map((m) => ({ fn: m.fn, ok: m.ok })),
          tests: rec.tests ? { passed: rec.tests.passed.length, failed: rec.tests.failed.map((f) => f.name) } : null,
          skill_hits: role ? Object.fromEntries(role.skills.map((s) => [s.id, s.detects ? firstP.filter((p) => s.detects.test(p)).length : 0])) : {},
        };
      } catch (e) {
        r = { case: c.name, cond, i: i + 1, ref: REFS[i], ms: Date.now() - t0, error: String(e.message || e) };
      }
      writeFileSync(rf, JSON.stringify(r, null, 2));
      results.push(r);
      console.log(`[BANCO] ${done}/${total} ${c.name} ${cond} #${i + 1}: ${r.error ? `ERROR ${r.error.slice(0, 120)}` : `${r.ok_first ? "✓ 1er intento" : r.ok_final ? "✓ tras reparar" : r.fatal_first ? "✗ roto" : `✗ ${r.problems_final.length} problema(s)`}`} · ${Math.round(r.ms / 1000)}s`);
    }
  }
}

// ---------- resumen ----------
const rows = [];
const group = (pred) => results.filter((r) => !r.error && pred(r));
const line = (label, rs) => {
  const n = rs.length;
  const pct = (x) => `${x}/${n}`;
  return `| ${label} | ${pct(rs.filter((r) => r.ok_first).length)} | ${pct(rs.filter((r) => r.ok_final).length)} | ${pct(rs.filter((r) => r.fatal_first).length)} | ${n ? (rs.reduce((a, r) => a + r.problems_first.length, 0) / n).toFixed(1) : "-"} | ${n ? (rs.reduce((a, r) => a + r.ms, 0) / n / 60000).toFixed(1) : "-"} |`;
};
rows.push(`\n| ${STEP} | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |\n|---|---|---|---|---|---|`);
for (const c of cases) for (const cond of CONDS) rows.push(line(`${c.name} ${cond}`, group((r) => r.case === c.name && r.cond === cond)));
if (cases.length > 1) for (const cond of CONDS) rows.push(line(`**todos ${cond}**`, group((r) => r.cond === cond)));
const errs = results.filter((r) => r.error);
if (errs.length) rows.push(`\n${errs.length} muestra(s) con ERROR del banco (no cuentan): ${[...new Set(errs.map((e) => e.error.slice(0, 100)))].join(" | ")}`);
// problemas más repetidos al 1er intento, por condición
for (const cond of CONDS) {
  const freq = {};
  for (const r of group((x) => x.cond === cond)) for (const p of new Set(r.problems_first.map(norm))) freq[p] = (freq[p] || 0) + 1;
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) rows.push(`\nProblemas más repetidos al 1er intento (${cond}, en cuántas muestras):\n${top.map(([p, n]) => `- ${n}× ${p}`).join("\n")}`);
}
const summary = rows.join("\n");
console.log(summary);
writeFileSync(join(outRoot, "results.json"), JSON.stringify(results, null, 2));
writeFileSync(join(outRoot, "resumen.md"), `# Banco por paso: ${STEP}\n\n${cases.map((c) => `- ${c.name}: ${c.dir}`).join("\n")}\n- k=${K}, ${ATTEMPTS} intento(s), ${REPAIR ? "con" : "sin"} reparación por función, temperature ${TEMP}\n${summary}\n`);
