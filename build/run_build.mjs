// run_build.mjs — Pipeline de construcción y validación sobre un proyecto ya planificado.
//
//   graph aprobado (snapshot de webmcp)
//     → Specialist (Gemma) construye la SPA completa con back simulado (tarea por tarea)
//     → por cada requisito: traductor (Qwen) → chequeos del catálogo
//     → Validation ejecuta los chequeos en Chromium → cobertura por requisito
//
//   node build/run_build.mjs ruta/al/snapshot.json            construye + valida
//   node build/run_build.mjs --validate build/runs/<dir>       solo valida (usa build.json de esa carpeta)
//   node build/run_build.mjs snapshot.json --resume build/runs/<dir>   retoma una construcción cortada (v0.3)
//   node build/run_build.mjs snapshot.json --legacy    Specialist v0.6.1 (tareas del graph); por defecto v0.7 por componentes
//   ... --validate build/runs/<dir> --retranslate   vuelve a traducir (el checks.json anterior queda archivado)
//   ... --profile web/landing   tipo de proyecto si el snapshot no lo trae (corridas anteriores al 05/10)
//
// Refactor de profiles (05/10): este archivo es CORE. No sabe de secciones,
// páginas ni componentes: el plan, el Specialist, el esqueleto de control, las
// reglas del traductor y el runner de chequeos los pone el profile del proyecto
// (refined_prompt.profiles → profiles/<tipo>/build.mjs). Lo universal que queda
// acá: el orden plan → build → traducción → Validation con control → Evidence,
// y el veredicto PASS / FAIL / SIN_EVIDENCIA / SIN_CHEQUEO.
//
// El snapshot es el estado de webmcp (localStorage "webmcp_state") exportado a JSON:
// usa intentForge.refined_prompt (features = requisitos) y atomicTasks (graph).
// Resultado en build/runs/<fecha>_<proyecto>/: HTML por paso, respuestas crudas,
// checks.json y evidence.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProfiles, profileLabel } from "../profiles/registry.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const log = (m) => console.log(m);

// Tipo de proyecto: lo declara el snapshot (refined_prompt.profiles, elegido por
// Miche en la UI) o --profile para snapshots viejos. Falla fuerte si no hay ninguno.
const pi = args.indexOf("--profile");
const flagProfile = pi >= 0 ? args[pi + 1] : null;
function declareProfiles(refined) {
  const declared = Array.isArray(refined.profiles) && refined.profiles.length ? refined.profiles : null;
  if (declared && flagProfile && !(declared.length === 1 && declared[0] === flagProfile))
    throw new Error(`el snapshot declara ${declared.join(" + ")} y --profile dice ${flagProfile}: no se pisa`);
  if (!declared && flagProfile) { refined.profiles = [flagProfile]; log(`[PROFILE] el snapshot no declara tipo: se usa --profile ${flagProfile}`); }
  return resolveProfiles(refined.profiles);
}
async function loadBuild(profile) {
  if (!profile.build) throw new Error(`el profile ${profile.ids.join(" + ")} no tiene build`);
  return import(new URL(`../profiles/${profile.build}/build.mjs`, import.meta.url));
}

let outDir, input, specialist = null, profile, B;
if (args[0] === "--validate") {
  outDir = args[1];
  const meta = JSON.parse(readFileSync(join(outDir, "build.json"), "utf8"));
  input = meta.input;
  specialist = meta.specialist;
  profile = declareProfiles(input.refined);
  B = await loadBuild(profile);
  log(`[PROFILE] ${profileLabel(profile)}${profile.borrowed.length ? ` · usa prestado: ${profile.borrowed.map((b) => `${b.id} ← ${b.from}`).join("; ")}` : ""}`);
} else {
  if (!args[0]) throw new Error("uso: node build/run_build.mjs snapshot.json [--resume DIR]");
  const ri = args.indexOf("--resume");
  const resumeDir = ri >= 0 ? args[ri + 1] : null;
  const snap = JSON.parse(readFileSync(args[0], "utf8"));
  const refined = { ...(snap.intentForge?.refined_prompt || {}), exclusiones: snap.intentForge?.exclusiones || [] };
  if (!refined.features?.length) throw new Error("el snapshot no trae intentForge.refined_prompt.features");
  profile = declareProfiles(refined);
  B = await loadBuild(profile);
  const tasks = (snap.atomicTasks || []).map(({ id, role, responsable_sugerido, task, description, depends_on }) => ({
    id, role: role || responsable_sugerido, task, description, depends_on,
  }));
  if (!tasks.length) throw new Error("el snapshot no trae atomicTasks");
  input = { source: basename(args[0]), refined, tasks };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = String(refined.project_name || "proyecto").normalize("NFD").replace(/[^\w]+/g, "_").slice(0, 40);
  outDir = resumeDir || join(here, "runs", `${stamp}_${slug}`);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "input.json"), JSON.stringify(input, null, 2));
  log(`[BUILD] ${refined.project_name} — ${refined.features.length} requisitos, ${tasks.length} tareas → ${outDir}`);
  log(`[PROFILE] ${profileLabel(profile)}${profile.borrowed.length ? ` · usa prestado: ${profile.borrowed.map((b) => `${b.id} ← ${b.from}`).join("; ")}` : ""}`);
  // Guardia de holdout: el Specialist no puede ver criterios_holdout. Pero si un
  // criterio repite una feature (que el Specialist SÍ ve en el brief), no es
  // holdout y la guardia no puede dispararse por eso. Evidencia 02/10, Project22:
  // criterio "Código limpio, ordenado y comentado" ⊂ feature 9 → corte falso en F1.1.
  const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  // 05/10 (web/app, web/game): si el profile le pasa al Specialist más texto del usuario
  // (restricciones: las reglas del juego), eso también es visible. Boxworld: el criterio
  // "El tamaño del mapa es 10 x 10" era copia literal de una restricción.
  const extraVisible = typeof B.specialistSees === "function" ? B.specialistSees(refined) : "";
  const visible = nrm([refined.objetivo, ...(refined.features || []), extraVisible].join("\n"));
  const criteria = (refined.criterios_holdout || []).filter(Boolean);
  const overlap = criteria.filter((c) => visible.includes(nrm(c)));
  const forbidden = criteria.filter((c) => !overlap.includes(c));
  input.holdout = { forbidden, repeated_in_features: overlap };
  writeFileSync(join(outDir, "input.json"), JSON.stringify(input, null, 2));
  for (const c of overlap) log(`[BUILD] criterio holdout que repite lo que escribió el usuario (el Specialist ya lo ve; no se vigila): "${c}"`);
  // Plan de página (v0.5): qué secciones tiene la SPA y qué features cubre cada una.
  const planPath = join(outDir, "page_plan.json");
  let pagePlan;
  if (existsSync(planPath)) {
    pagePlan = JSON.parse(readFileSync(planPath, "utf8")).plan;
    log(`[PLAN] usando ${planPath}`);
  } else {
    const pp = await B.planPage(refined.features, { refined }); // refined: web/app y web/game separan las de estilo
    writeFileSync(planPath, JSON.stringify(pp, null, 2));
    pagePlan = pp.plan;
    if (pagePlan) log(`[PLAN] ${B.PAGE_PLAN_VERSION}${pp.attempts.length > 1 ? " (con reintento)" : ""}\n${B.planText(pagePlan)}`);
    else log(`[PLAN] ✗ plan inválido (${pp.errors.join("; ")}) → esqueleto mínimo sin secciones`);
  }
  // El Specialist lo pone el profile (web/landing: por componentes; --legacy = v0.6.1).
  specialist = await B.build(input, outDir, { log, forbidden, resume: !!resumeDir, pagePlan, legacy: args.includes("--legacy") });
  writeFileSync(join(outDir, "build.json"), JSON.stringify({ input, specialist }, null, 2));
}

// v0.3: la app vive en outDir/app/ (index.html + styles.css + api.js + app.js).
// Corridas v0.2 (un solo archivo) tienen outDir/index.html.
const artifact = existsSync(join(outDir, "app", "index.html")) ? join(outDir, "app", "index.html") : join(outDir, "index.html");
if (!existsSync(artifact)) throw new Error(`no existe ${artifact}`);

// Requisito → chequeos (se guardan para poder re-ejecutarlos sin LLM).
const checksPath = join(outDir, "checks.json");
if (args.includes("--retranslate") && existsSync(checksPath)) {
  const archived = join(outDir, `checks.prev-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`);
  renameSync(checksPath, archived);
  log(`[VALIDATION] checks.json anterior archivado en ${archived}`);
}
let reqChecks;
if (existsSync(checksPath)) {
  reqChecks = JSON.parse(readFileSync(checksPath, "utf8"));
  log(`[VALIDATION] usando chequeos ya traducidos (${checksPath})`);
} else {
  const context = `Proyecto: ${input.refined.project_name}\n${input.refined.objetivo || ""}`;
  reqChecks = [];
  for (const [i, text] of input.refined.features.entries()) {
    const id = `R${i + 1}`;
    try {
      const t = await B.translateRequirement(text, { context });
      reqChecks.push({ id, text, checks: t.checks, dropped: t.dropped, sin_chequeo: t.sin_chequeo, versions: t.versions });
      log(`[TRANSLATOR] ${id}: ${t.checks.map((c) => c.type).join(", ") || "SIN CHEQUEO"}`);
    } catch (e) {
      reqChecks.push({ id, text, checks: [], error: e.message });
      log(`[TRANSLATOR] ${id}: ERROR ${e.message}`);
    }
  }
  writeFileSync(checksPath, JSON.stringify(reqChecks, null, 2));
}

// Control (v0.4): los mismos chequeos sobre el ESQUELETO vacío que arma el
// harness (header + nav + una sección por feature con su título). Un chequeo
// que pasa ahí no discrimina: lo aprobaría cualquier artefacto, aunque no haga
// nada. Ese PASS se marca TRIVIAL y no cuenta como evidencia.
const baselineDir = join(outDir, "baseline");
mkdirSync(baselineDir, { recursive: true });
// Mismo esqueleto que recibió el Specialist (lo arma el profile).
const planFile = join(outDir, "page_plan.json");
const basePlan = existsSync(planFile) ? JSON.parse(readFileSync(planFile, "utf8")).plan : undefined;
B.writeBaseline(baselineDir, input, basePlan, specialist);
const baseline = join(baselineDir, "index.html");

// Validation: un veredicto por requisito.
//   PASS          todos los chequeos pasan y al menos uno no es trivial
//   FAIL          algún chequeo falla
//   SIN_EVIDENCIA todos pasan, pero todos pasan también en el esqueleto
const coverage = [];
const smoke = await B.runChecks(artifact, [{ type: "no_js_errors", params: {} }]);
// Base v0.5 (03/10): sections_visible lo corre el harness siempre, no el traductor.
// Es una COMPUERTA: si la pieza de un requisito no se ve cuando el usuario llega,
// el requisito es FAIL aunque sus chequeos pasen. Nunca suma un PASS (en el
// esqueleto también se ve todo; no discrimina como evidencia a favor).
const [visibility] = await B.runChecks(artifact, [{ type: "sections_visible", params: {} }]);
const visGate = (id) => visibility.features?.[id] === "FAIL"
  ? { type: "sections_visible", gate: true, result: "FAIL", detail: visibility.anchors.filter((a) => !a.ok && a.features.includes(id)).map((a) => `#${a.id}: se ven ${a.seen}/${a.total} palabras`).join("; ") + " al llegar con el scroll" }
  : null;
// Base v0.6 (05/10, Boxworld build 2): components_render — si el JS de un componente
// no llenó NINGUNO de los contenedores que nombra (tablero vacío), los requisitos
// anclados en ese componente son FAIL. También COMPUERTA: nunca suma un PASS.
const [render] = await B.runChecks(artifact, [{ type: "components_render", params: {} }]);
const featuresOf = (id) => (visibility.anchors || []).find((a) => a.id === id)?.features || [];
const renderGate = (id) => {
  const bad = (render.components || []).filter((x) => !x.ok && featuresOf(x.id).includes(id));
  return bad.length ? { type: "components_render", gate: true, result: "FAIL", detail: bad.map((x) => `#${x.id}: su JS no dibujó nada (${x.empty.slice(0, 4).join(", ")} vacíos)`).join("; ") } : null;
};
for (const r of reqChecks) {
  const gates = [visGate(r.id), renderGate(r.id)].filter(Boolean);
  const gate = gates[0] || null;
  if (!r.checks.length) {
    coverage.push(gate ? { id: r.id, text: r.text, verdict: "FAIL", reason: gates.some((g) => g.type === "components_render") ? "sin chequeos del traductor, pero su componente no dibujó nada" : "sin chequeos del traductor, pero su pieza no se ve", checks: gates }
      : { id: r.id, text: r.text, verdict: "SIN_CHEQUEO", reason: r.error || r.sin_chequeo || "el traductor no produjo chequeos válidos", checks: [] });
    continue;
  }
  const checks = B.postprocessChecks(r.checks, r.id, r.text).map(B.normalizeCheck);
  const before = r.checks.map((c) => c.type).join(","), after = checks.map((c) => c.type).join(",");
  if (before !== after) log(`[VALIDATION] ${r.id}: el harness ajustó chequeos ${before} → ${after} (palabras que describen la pieza)`);
  const res = await B.runChecks(artifact, checks);
  const ctl = await B.runChecks(baseline, checks);
  res.forEach((x, k) => { x.baseline = ctl[k].result; if (x.result === "PASS" && ctl[k].result === "PASS") x.trivial = true; });
  res.push(...gates);
  const verdict = res.some((x) => x.result !== "PASS") ? "FAIL"
    : res.some((x) => !x.trivial) ? "PASS" : "SIN_EVIDENCIA";
  coverage.push({ id: r.id, text: r.text, verdict, checks: res });
}

const count = (v) => coverage.filter((c) => c.verdict === v).length;
const evidence = {
  type: "EVIDENCE",
  kind: "build_validation",
  project: input.refined.project_name,
  source: input.source,
  catalog: B.CATALOG_VERSION,
  profiles: { ids: profile.ids, chain: profile.chain, status: profile.status, borrowed: profile.borrowed },
  artifact_loads_without_js_errors: smoke[0].result === "PASS",
  sections_visible: { result: visibility.result, features: visibility.features || {}, anchors: visibility.anchors || [], detail: visibility.detail },
  components_render: { result: render.result, components: render.components || [], detail: render.detail },
  summary: { requisitos: coverage.length, PASS: count("PASS"), FAIL: count("FAIL"), SIN_EVIDENCIA: count("SIN_EVIDENCIA"), SIN_CHEQUEO: count("SIN_CHEQUEO") },
  control: "mismos chequeos sobre baseline/ (esqueleto vacío del harness); PASS en ambos = trivial",
  coverage,
  specialist: specialist && { model: specialist.model, version: specialist.specialist_version, tasks_assigned: specialist.tasks_assigned, files: specialist.files, rule_tests: specialist.rule_tests, steps: specialist.steps.map(({ n, task_id, role, ms, finish_reason, chars, changed, rejected, error, no_change, contract_retry, contract }) => ({ n, task_id, role, ms, finish_reason, chars, changed, rejected, error, no_change, contract_retry, contract_missing: contract?.missing })) },
};
writeFileSync(join(outDir, "evidence.json"), JSON.stringify(evidence, null, 2));

log("\n=== Cobertura por requisito (Validation) ===");
log(`carga sin errores de JS: ${evidence.artifact_loads_without_js_errors ? "sí" : "NO — " + smoke[0].detail}`);
log(`componentes que dibujan algo: ${render.result === "PASS" ? "todos" : render.result === "FAIL" ? "NO — " + (render.components || []).filter((x) => !x.ok).map((x) => `#${x.id} (${x.empty.slice(0, 3).join(", ")} vacíos)`).join("; ") : render.detail}`);
log(`piezas visibles al llegar con el scroll: ${visibility.result === "PASS" ? "todas" : visibility.result === "FAIL" ? "NO — " + visibility.detail.split("; ").filter((p) => p.endsWith("✗")).join("; ") : visibility.detail}`);
for (const c of coverage) {
  log(`${c.verdict.padEnd(11)} ${c.id} ${c.text.slice(0, 70)}`);
  for (const x of c.checks.filter((x) => x.result !== "PASS")) log(`             ✗ ${x.type}: ${x.detail}`);
  for (const x of c.checks.filter((x) => x.trivial)) log(`             ~ ${x.type}: también pasa en el esqueleto (no discrimina)`);
  if (c.verdict === "SIN_CHEQUEO") log(`             (${c.reason})`);
}
log(`\nPASS ${evidence.summary.PASS} · FAIL ${evidence.summary.FAIL} · SIN_EVIDENCIA ${evidence.summary.SIN_EVIDENCIA} · SIN_CHEQUEO ${evidence.summary.SIN_CHEQUEO}  →  ${join(outDir, "evidence.json")}`);
