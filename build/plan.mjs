// build/plan.mjs — la planilla entra al plan (fusión con WebMCP, decisión de Miche 08/11).
//
// Usa lo que ya existe: TechLeader (techleader_prompt.mjs) arma las fases, el Atomizer + Checker + Re-Atomizer
// (atomic_engine_v5.js, runAtomicGraph) las parte, y resolveDependencies las ordena. Lo nuevo es un dato y dos chequeos:
//   - cada fase dice qué requisitos cubre ("cubre") y cada tarea qué filas de la planilla la verifican ("prueba");
//   - cobertura POR CÓDIGO: todo requisito con prueba tiene una fase, y toda fila tiene una tarea. Lo que falta se le
//     vuelve a pedir UNA vez (a TechLeader, o al Atomizer solo para esas filas). Lo que siga faltando queda escrito en
//     plan.md para que Miche lo vea antes de construir.
// Decisiones de Miche (08/11): primero consola (la UI después); sin fase de QA (la planilla es la QA); sin la receta del
// Standard estado; Miche aprueba el plan antes de que Gemma construya.
//
//   npm run proyecto -- plan <carpeta del proyecto>     → plan.json + plan.md en la carpeta

import { readFileSync, writeFileSync, existsSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveProfiles } from "../profiles/registry.mjs";
import { buildTechLeaderPrompt } from "../techleader_prompt.mjs";
import { runAtomicGraph, resolveDependencies, usarModelo } from "../atomic_engine_v5.js";
import { parseJsonLoose } from "../json_loose.mjs";
import { describirFila } from "../profiles/web/validation/planilla_palabras.mjs";
import { modeloDe } from "../modelos.mjs";

export const PLAN_VERSION = "plan v0.1";
const LM = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = modeloDe("techleader"); // 10/11: el modelo sale de PUESTOS.md (puesto "techleader"), no se nombra en el código
usarModelo(MODEL); // el atomizador (atomic_engine_v5.js, que también corre en el navegador) usa el mismo

/** El profile del camino de la planilla: web/app sin receta y sin el rol QA. */
export function perfilPlan(ids = ["web/app"]) {
  const p = resolveProfiles(ids);
  const roles = p.roles.filter((r) => r !== "QA");
  return { ...p, roles, atomizerRecipe: null, exampleRole: roles.includes(p.exampleRole) ? p.exampleRole : p.defaultRole };
}

/** Requisitos que hay que cubrir (los que no son restricción), con sus filas en palabras. */
export function requisitosConPruebas(req, planilla) {
  return req.requisitos.map((r, i) => ({ id: `R${i + 1}`, texto: r.texto, de: r.de }))
    .filter((r) => r.de !== "restriccion")
    .map((r) => ({ ...r, filas: (planilla.filas || []).filter((f) => f.r === r.id).map((f) => ({ id: f.id, texto: describirFila(f, planilla.glosario) })) }));
}

export function entradaTechLeader(req, reqs, criterio = "") {
  const restr = req.requisitos.filter((r) => r.de === "restriccion").map((r) => r.texto.replace(/^Restricción:\s*/i, ""));
  return [`Proyecto: ${req.titulo}`, "", "Requisitos (cada uno con las pruebas que se le van a hacer a la app terminada):", "",
    ...reqs.flatMap((r) => [`${r.id}. ${r.texto}`, ...r.filas.map((f) => `   - prueba ${f.id}: ${f.texto}`)]),
    ...(restr.length ? ["", "Restricciones (límites que puso el usuario; no planificar trabajo que las contradiga):", ...restr.map((x) => `- ${x}`)] : []),
    ...(criterio ? ["", criterio] : [])].join("\n");
}

/** ¿Todo requisito está en "cubre" de alguna fase? */
export function coberturaFases(fases, reqs) {
  const ids = new Set(reqs.map((r) => r.id));
  const cubiertos = new Set(fases.flatMap((f) => (Array.isArray(f.cubre) ? f.cubre : []).map((x) => String(x).trim()).filter((x) => ids.has(x))));
  return { faltan: reqs.filter((r) => !cubiertos.has(r.id)).map((r) => r.id) };
}

/** Las filas que verifican cada fase (las de los requisitos que cubre). */
export function pruebasDeFase(fase, reqs) {
  const cubre = new Set(fase.cubre || []);
  return reqs.filter((r) => cubre.has(r.id)).flatMap((r) => r.filas);
}

/** Filas sin ninguna tarea aceptada que las nombre en "prueba". */
export function filasSinTarea(tareas, reqs) {
  const nombradas = new Set(tareas.flatMap((t) => t.prueba || []));
  return reqs.flatMap((r) => r.filas).filter((f) => !nombradas.has(f.id)).map((f) => f.id);
}

async function llamarTechLeader(system, user) {
  const res = await fetch(LM, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, temperature: 0, messages: [{ role: "system", content: system }, { role: "user", content: user }] }) });
  if (!res.ok) throw new Error(`TechLeader HTTP ${res.status}`);
  return (await res.json())?.choices?.[0]?.message?.content || "";
}

function fasesDe(raw, profile) {
  const parsed = parseJsonLoose(raw || "");
  if (!parsed.ok || !Array.isArray(parsed.data?.fases)) return { error: parsed.error || "sin 'fases'" };
  const fases = parsed.data.fases.map((f, i) => ({
    ...f,
    id: f.id || `F${i + 1}`,
    responsable_sugerido: profile.roles.includes(f.responsable_sugerido) ? f.responsable_sugerido : profile.defaultRole,
    depends_on: Array.isArray(f.depends_on) ? f.depends_on : [],
    cubre: Array.isArray(f.cubre) ? f.cubre.map((x) => String(x).trim()) : [],
  }));
  return { fases, diferido: parsed.data.diferido || [] };
}

/**
 * Arma el plan. call(system, user) → texto (TechLeader); graph(fases, log, opts) → resultado de runAtomicGraph.
 * Los dos se pueden reemplazar en los tests.
 */
export async function armarPlan({ req, planilla, criterio = "", call = llamarTechLeader, graph = runAtomicGraph, log = console.log, profile = perfilPlan() }) {
  const reqs = requisitosConPruebas(req, planilla);
  const system = buildTechLeaderPrompt(profile, { cubre: true });
  const user = entradaTechLeader(req, reqs, criterio);
  const llamadas = [];
  // 1. TechLeader, con un reintento si deja requisitos afuera (o no devuelve fases)
  let tl = null, faltanFases = [];
  for (let intento = 1; intento <= 2; intento++) {
    const nota = intento === 1 ? "" : tl?.error ? `\n\nTu respuesta anterior no se pudo leer (${tl.error}). Devolvé SOLO el JSON.` :
      `\n\nTu plan anterior dejó afuera estos requisitos (ninguna fase los tiene en "cubre"):\n${faltanFases.map((id) => `- ${id}. ${reqs.find((r) => r.id === id).texto}`).join("\n")}\nDevolvé el plan COMPLETO otra vez, con cada uno de estos requisitos en "cubre" de alguna fase y dicho con sus palabras en la descripción.`;
    const t0 = Date.now();
    const raw = await call(system, user + nota);
    tl = fasesDe(raw, profile);
    llamadas.push({ paso: "techleader", intento, ms: Date.now() - t0, raw });
    if (tl.error) { log(`[PLAN] TechLeader intento ${intento}: no se pudo leer (${tl.error})`); continue; }
    faltanFases = coberturaFases(tl.fases, reqs).faltan;
    log(`[PLAN] TechLeader intento ${intento}: ${tl.fases.length} fases${faltanFases.length ? ` · sin fase: ${faltanFases.join(", ")}` : " · todos los requisitos cubiertos"}`);
    if (!faltanFases.length) break;
  }
  if (tl.error) throw new Error(`TechLeader no devolvió fases: ${tl.error}`);
  const fases = tl.fases.map((f) => ({ ...f, pruebas: pruebasDeFase(f, reqs) }));
  // 2. Atomizer + Checker + Re-Atomizer (lo de siempre), con las pruebas de cada fase
  const g1 = await graph(fases, (m) => log(m), () => {}, { profile });
  let tareas = [...g1.acceptedTasks], sinResolver = [...g1.unresolvedTasks];
  // 3. Filas sin tarea → una pasada más, solo con esas filas, en la fase que las cubre
  let faltanFilas = filasSinTarea(tareas, reqs);
  const extra = [];
  if (faltanFilas.length) {
    log(`[PLAN] filas sin tarea: ${faltanFilas.join(", ")} → se atomiza otra vez solo eso`);
    for (const f of fases) {
      const mias = f.pruebas.filter((p) => faltanFilas.includes(p.id));
      if (!mias.length) continue;
      extra.push({ ...f, id: `${f.id}b`, name: `${f.name} (lo que faltó cubrir)`, description: `${f.description} Faltan tareas para estas pruebas; las demás ya tienen.`, pruebas: mias, depends_on: [f.id] });
      faltanFilas = faltanFilas.filter((id) => !mias.some((p) => p.id === id));
    }
    if (extra.length) {
      const g2 = await graph(extra, (m) => log(m), () => {}, { profile, previousTasks: tareas });
      tareas = [...tareas, ...g2.acceptedTasks]; sinResolver = [...sinResolver, ...g2.unresolvedTasks];
    }
  }
  const todas = [...fases, ...extra];
  const dep = resolveDependencies([...tareas, ...sinResolver], todas.map(({ pruebas, ...f }) => f));
  const orden = dep.topologicalOrder.map((id) => tareas.find((t) => t.id === id)).filter(Boolean);
  const cobertura = { requisitos_sin_fase: coberturaFases(fases, reqs).faltan, filas_sin_tarea: filasSinTarea(tareas, reqs) };
  log(`[PLAN] ${orden.length} tareas aceptadas${sinResolver.length ? ` · ${sinResolver.length} sin resolver (Checker)` : ""} · requisitos sin fase: ${cobertura.requisitos_sin_fase.join(", ") || "ninguno"} · filas sin tarea: ${cobertura.filas_sin_tarea.join(", ") || "ninguna"}`);
  return { type: "PLAN", version: PLAN_VERSION, modelo: MODEL, estado: "PROPUESTO", fases: todas.map(({ pruebas, ...f }) => ({ ...f, pruebas: pruebas.map((p) => p.id) })), diferido: tl.diferido, tareas: orden, sin_resolver: sinResolver, cobertura, llamadas };
}

/** plan.md: lo que Miche lee antes de aprobar. */
export function planEnPalabras(plan, req, planilla) {
  const reqs = requisitosConPruebas(req, planilla);
  const texto = Object.fromEntries(reqs.flatMap((r) => r.filas.map((f) => [f.id, f.texto])));
  const c = plan.cobertura;
  const out = [`# Plan: cómo se va a construir`, "",
    `${plan.tareas.length} tareas en ${plan.fases.length} fases, en el orden en que se van a hacer. Cada tarea dice qué pruebas de la planilla la verifican ("sin prueba" = preparación).`, "",
    c.requisitos_sin_fase.length || c.filas_sin_tarea.length
      ? `**OJO, falta cubrir:** ${[c.requisitos_sin_fase.length ? `requisitos sin fase: ${c.requisitos_sin_fase.join(", ")}` : "", c.filas_sin_tarea.length ? `pruebas sin tarea: ${c.filas_sin_tarea.join(", ")}` : ""].filter(Boolean).join(" · ")}.`
      : "**Cobertura completa:** todo requisito tiene su fase y toda prueba tiene al menos una tarea.", ""];
  if (plan.sin_resolver?.length) out.push(`**El Checker no aceptó ${plan.sin_resolver.length} tarea(s)** después de 3 intentos: ${plan.sin_resolver.map((t) => `${t.id} (${t.checker?.reason || "sin motivo"})`).join("; ")}.`, "");
  for (const f of plan.fases) {
    const mias = plan.tareas.filter((t) => t.phase === f.id);
    if (!mias.length) continue;
    out.push(`## ${f.id}. ${f.name}`, `_${f.description}_ · cubre: ${(f.cubre || []).join(", ") || "—"}`, "");
    for (const t of mias) {
      out.push(`- **${t.id}** ${t.task}${t.depends_on?.length ? ` _(después de ${t.depends_on.join(", ")})_` : ""}`);
      if (t.description) out.push(`  ${t.description}`);
      out.push(`  ${t.prueba?.length ? `verifican: ${t.prueba.map((id) => `${id}${texto[id] ? ` (${texto[id]})` : ""}`).join(" · ")}` : "sin prueba (preparación)"}`);
    }
    out.push("");
  }
  if (plan.diferido?.length) out.push("## Lo que TechLeader dejó para después", ...plan.diferido.map((d) => `- ${d}`), "");
  out.push("Si está bien, aprobalo con `npm run proyecto -- plan <carpeta> --aprobar`. Si no, decí qué tarea o prueba está mal.");
  return out.join("\n");
}

/** CLI: arma el plan de un proyecto y lo deja en la carpeta (plan.json + plan.md). */
export async function planDeProyecto(dir, { log = console.log, ...o } = {}) {
  const req = JSON.parse(readFileSync(join(dir, "requisitos.json"), "utf8"));
  const planilla = JSON.parse(readFileSync(join(dir, "planilla.json"), "utf8"));
  let criterio = "";
  try { const { loadStageBlock } = await import("../context/stage_loader.mjs"); criterio = loadStageBlock(new URL("../context/ProjectStage.md", import.meta.url)).criterion || ""; } catch { /* sin etapa: TechLeader igual arma */ }
  const t0 = Date.now();
  let plan;
  try { plan = await armarPlan({ req, planilla, criterio, log, ...o }); }
  catch (e) {
    // una dependencia inventada corta runAtomicGraph (MISSING_DEPENDENCY): se intenta una vez más entera
    if (!/MISSING_DEPENDENCY|SELF_DEPENDENCY|CYCLE/i.test(e.message)) throw e;
    log(`[PLAN] el grafo se cortó (${e.message.slice(0, 160)}): lo armo otra vez`);
    plan = await armarPlan({ req, planilla, criterio, log, ...o });
  }
  plan.ms = Date.now() - t0;
  // un plan anterior no se pisa: queda como plan_<fecha>.json / .md (para comparar)
  if (existsSync(join(dir, "plan.json"))) {
    const viejo = JSON.parse(readFileSync(join(dir, "plan.json"), "utf8")), sello = String(viejo.creado || statSync(join(dir, "plan.json")).mtime.toISOString()).replace(/[:.]/g, "-").slice(0, 19);
    renameSync(join(dir, "plan.json"), join(dir, `plan_${sello}.json`));
    if (existsSync(join(dir, "plan.md"))) renameSync(join(dir, "plan.md"), join(dir, `plan_${sello}.md`));
  }
  plan.creado = new Date().toISOString();
  writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(join(dir, "plan.md"), planEnPalabras(plan, req, planilla));
  return plan;
}
