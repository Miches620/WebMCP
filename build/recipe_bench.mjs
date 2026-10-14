// build/recipe_bench.mjs — ¿la receta del Standard mejora lo que produce el Atomizer?
// (punto 9, 14/10). Mismas fases, dos condiciones:
//   sin = el Atomizer de siempre (profile sin receta)
//   con = el Atomizer con la receta de su Standard y el campo "pieza"
// Mide la salida CRUDA del Atomizer (sin Checker ni re-atomización): es lo que la receta toca.
//
// Uso (con LM Studio prendido):
//   node build/recipe_bench.mjs                      → toma el input del último Kanban en build/runs
//   node build/recipe_bench.mjs --input <input.json> → otro proyecto (refined con profiles)
//   node build/recipe_bench.mjs --phases <fases.json> → reusar las mismas fases (si no, TechLeader las arma 1 vez y las guarda)
//   node build/recipe_bench.mjs --reps 2              → repetir cada condición
// Deja todo en build/bench/recipe_<fecha>/ (fases.json, resultado.json).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { atomizePhase, buildDecomposePrompt } from "../atomic_engine_v5.js";
import { resolveProfiles } from "../profiles/registry.mjs";
import { buildTechLeaderPrompt } from "../techleader_prompt.mjs";
import { buildTechLeaderInput } from "../intent_brief.mjs";
import { parseJsonLoose } from "../json_loose.mjs";
import { summarize, compareTable, RECIPE_METRICS_VERSION } from "./recipe_metrics.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LM = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "google/gemma-4-e4b";

const args = process.argv.slice(2);
const arg = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function latestKanbanInput() {
  const runs = path.join(ROOT, "build", "runs");
  const dirs = fs.existsSync(runs) ? fs.readdirSync(runs).filter((d) => /kanban/i.test(d)).sort() : [];
  for (const d of dirs.reverse()) {
    const f = path.join(runs, d, "input.json");
    if (fs.existsSync(f)) return f;
  }
  throw new Error("No encontré un input.json de Kanban en build/runs: pasá --input <archivo>");
}

async function techLeaderPhases(refined, profile) {
  const { loadStageBlock } = await import(pathToFileURL(path.join(ROOT, "context", "stage_loader.mjs")).href);
  const stage = loadStageBlock(new URL("../context/ProjectStage.md", import.meta.url));
  if (!stage.criterion) throw new Error("ProjectStage.md no trae el criterio de la etapa: TechLeader no arranca sin etapa");
  const res = await fetch(LM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: buildTechLeaderPrompt(profile) },
        { role: "user", content: `${buildTechLeaderInput(refined)}\n\n${stage.criterion}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`TechLeader HTTP ${res.status}`);
  const raw = (await res.json())?.choices?.[0]?.message?.content;
  const parsed = parseJsonLoose(raw || "");
  if (!parsed.ok || !Array.isArray(parsed.data?.fases)) throw new Error(`TechLeader no devolvió fases: ${parsed.error || "sin 'fases'"}`);
  return parsed.data.fases.map((f, i) => ({
    ...f,
    id: f.id || `F${i + 1}`,
    responsable_sugerido: profile.roles.includes(f.responsable_sugerido) ? f.responsable_sugerido : profile.defaultRole,
    depends_on: Array.isArray(f.depends_on) ? f.depends_on : [],
  }));
}

async function runCondition(name, phases, profile, log) {
  const tasks = [];
  const t0 = Date.now();
  for (const phase of phases) {
    const prev = tasks.map((t) => ({ id: t.id, phase: t.phase, task: t.task }));
    const r = await atomizePhase(phase, phase.responsable_sugerido, prev, log, { profile });
    for (const [k, st] of r.subtasks.entries())
      tasks.push({ id: st.id || `${phase.id}.${k + 1}`, phase: phase.id, task: st.task, description: st.description, pieza: st.pieza, depends_on: st.depends_on });
    log(`   ${name} ${phase.id}: ${r.subtasks.length} tareas`);
  }
  return { tasks, ms: Date.now() - t0 };
}

async function main() {
  const inputFile = arg("--input") || latestKanbanInput();
  const input = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const refined = input.refined || input.intentForge?.refined_prompt || input;
  const profile = resolveProfiles(refined.profiles);
  if (!profile.atomizerRecipe) throw new Error(`${profile.chain.join(" ← ")} no tiene receta de Standard: no hay nada que comparar`);
  const sinReceta = { ...profile, atomizerRecipe: null };
  const piezas = Object.keys(profile.atomizerRecipe.piezas);
  const reps = Number(arg("--reps", 1)) || 1;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = path.join(ROOT, "build", "bench", `recipe_${stamp}`);
  fs.mkdirSync(out, { recursive: true });
  const log = (m) => console.log(m);

  console.log(`=== recipe_bench (${RECIPE_METRICS_VERSION}) ===`);
  console.log(`input: ${path.relative(ROOT, inputFile)} | tipo: ${profile.chain.join(" ← ")} | receta: ${profile.atomizerRecipe.standard} v${profile.atomizerRecipe.version}`);

  let phases;
  if (arg("--phases")) {
    const j = JSON.parse(fs.readFileSync(arg("--phases"), "utf8"));
    phases = Array.isArray(j) ? j : j.fases; // fases.json de un bench o un fixture { fases, sin, con }
    if (!Array.isArray(phases) || !phases.length) throw new Error(`${arg("--phases")} no trae fases`);
  }
  else {
    console.log("TechLeader → armando las fases (una sola vez, las dos condiciones usan las mismas)...");
    phases = await techLeaderPhases(refined, profile);
  }
  fs.writeFileSync(path.join(out, "fases.json"), JSON.stringify(phases, null, 2));
  console.log(`fases: ${phases.map((f) => `${f.id} ${f.name}`).join(" | ")}`);
  const p0 = phases[0];
  console.log(`prompt del Atomizer (fase ${p0.id}): sin ${buildDecomposePrompt(p0, p0.responsable_sugerido, [], sinReceta).length} chars | con ${buildDecomposePrompt(p0, p0.responsable_sugerido, [], profile).length} chars`);

  const result = { version: RECIPE_METRICS_VERSION, input: path.relative(ROOT, inputFile), receta: { standard: profile.atomizerRecipe.standard, version: profile.atomizerRecipe.version }, fases: phases.length, corridas: [] };
  for (let rep = 1; rep <= reps; rep++) {
    for (const [name, prof] of [["sin", sinReceta], ["con", profile]]) {
      console.log(`\n--- ${name} receta (rep ${rep}/${reps}) ---`);
      const r = await runCondition(name, phases, prof, log);
      const m = summarize(r.tasks, name === "con" ? piezas : null);
      result.corridas.push({ cond: name, rep, ms: r.ms, ...m, crudas: r.tasks });
    }
  }

  fs.writeFileSync(path.join(out, "resultado.json"), JSON.stringify(result, null, 2));

  // Tabla: promedio por condición si hay varias repeticiones
  const avg = (cond) => {
    const rs = result.corridas.filter((c) => c.cond === cond).map((c) => c.resumen);
    const keys = Object.keys(rs[0]).filter((k) => typeof rs[0][k] === "number");
    return Object.fromEntries(keys.map((k) => [k, +(rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(1)]));
  };
  console.log(`\n=== Resumen (${reps > 1 ? `promedio de ${reps}` : "1 corrida"}) ===`);
  console.log(compareTable({ sin: avg("sin"), con: avg("con") }));
  const last = result.corridas.filter((c) => c.cond === "con").at(-1);
  console.log(`\npiezas (con): ${Object.entries(last.resumen.por_pieza).map(([k, v]) => `${k} ${v}`).join(" | ")}`);
  console.log("\n=== Tareas con señales (última corrida de cada una) ===");
  for (const cond of ["sin", "con"]) {
    const c = result.corridas.filter((x) => x.cond === cond).at(-1);
    console.log(`[${cond}]`);
    for (const [i, s] of c.tareas.entries()) {
      const why = [
        s.alternativas.length && `alternativas: ${s.alternativas.join(", ")}`,
        s.harness.length && `harness: ${s.harness.join(", ")}`,
        s.vagos.length && `vagos: ${s.vagos.join(", ")}`,
        s.mezcla && `mezcla: ${s.acciones.join("+")}`,
        cond === "con" && !s.pieza && `pieza inválida (${c.crudas[i].pieza ?? "falta"})`,
      ].filter(Boolean);
      if (s.barras.length) why.push(`(barras, mirar a mano: ${s.barras.join(", ")})`);
      console.log(`  ${s.id}${s.pieza ? ` [${s.pieza}]` : ""} ${c.crudas[i].task}${why.length ? `\n      ⚠ ${why.join(" | ")}` : ""}`);
    }
  }
  console.log(`\nGuardado en ${path.relative(ROOT, out)}`);
  console.log(`Para repetir con las mismas fases: node build/recipe_bench.mjs --phases ${path.relative(ROOT, path.join(out, "fases.json"))}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
