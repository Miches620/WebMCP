// build/validate_external.mjs — pasar una app hecha FUERA de webmcp por la MISMA Validation (16/10).
//
//   node build/validate_external.mjs <carpeta de la app> <snapshot.json> [--checks <checks.json> | --planilla <planilla.json>] [--name gemma_sola]
//
// Por qué (experimento de Miche, 16/10): Gemma 4 E4B sola en LM Studio, sin webmcp ni harness, hizo un Kanban con
// drag & drop y localStorage andando (y un bug que no deja crear, XSS, sin prioridad). Para saber si el harness
// suma o resta hace falta medir esa "línea base" con la misma vara que los builds del pipeline:
//   - mismos requisitos (los del snapshot) y, con --checks, los MISMOS chequeos ya traducidos de un build
//     (así no cambia el juez entre las dos apps: no se llama al traductor);
//   - mismo esqueleto de control y mismas compuertas de base (errores de JS, piezas visibles).
// Lo que no aplica a una app externa queda afuera, dicho: la compuerta de acciones del Standard (no hay contrato) y
// el veredicto por tarea (no hubo Atomic Tasks construyendo nada).
// Arma build/runs/<fecha>_externo_<nombre>/ (app/ = copia de la carpeta, la original no se toca) y corre
// run_build --validate sobre esa carpeta.

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, statSync } from "node:fs";
import { join, dirname, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

export const EXTERNAL_VERSION = "validate_external v0.1";
const here = dirname(fileURLToPath(import.meta.url));

/** Arma la carpeta de corrida para una app externa. Devuelve su ruta. Función pura salvo por el disco. */
export function prepareExternal({ appDir, snapshot, checks = null, planilla = null, name = null, runsDir = join(here, "runs"), date = new Date() }) {
  if (!existsSync(join(appDir, "index.html"))) throw new Error(`no hay index.html en ${appDir}`);
  const snap = JSON.parse(readFileSync(snapshot, "utf8"));
  const refined = { ...(snap.intentForge?.refined_prompt || {}), exclusiones: snap.intentForge?.exclusiones || [] };
  if (!refined.features?.length) throw new Error("el snapshot no trae intentForge.refined_prompt.features");
  const slug = String(name || basename(resolve(appDir))).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "app";
  const out = join(runsDir, `${date.toISOString().replace(/[:.]/g, "-").slice(0, 19)}_externo_${slug}`);
  mkdirSync(out, { recursive: true });
  cpSync(appDir, join(out, "app"), { recursive: true });
  // sin "pieza" en las tareas: el veredicto por tarea no aplica (nadie construyó tarea por tarea)
  const tasks = (snap.atomicTasks || []).map(({ id, task, description }) => ({ id, task, description }));
  const input = { source: basename(snapshot), refined, tasks, external: { app: resolve(appDir), version: EXTERNAL_VERSION } };
  writeFileSync(join(out, "input.json"), JSON.stringify(input, null, 2));
  writeFileSync(join(out, "build.json"), JSON.stringify({ input, specialist: null, external: { app: resolve(appDir), version: EXTERNAL_VERSION, nota: "app hecha fuera de webmcp: sin Standard, sin contrato, sin pasos" } }, null, 2));
  if (planilla) {
    // 16/10 noche: la PLANILLA de comportamientos en vez de chequeos traducidos (mismo juez para todas las apps)
    const pl = JSON.parse(readFileSync(planilla, "utf8"));
    input.refined.planilla = pl;
    const bad = (pl.filas || []).filter((f) => !/^R\d+$/.test(f.r || "") || Number(f.r.slice(1)) > refined.features.length);
    if (bad.length) throw new Error(`la planilla nombra requisitos que el snapshot no tiene (${bad.map((f) => f.id).join(", ")}): no se mezclan jueces`);
    writeFileSync(join(out, "input.json"), JSON.stringify(input, null, 2));
    writeFileSync(join(out, "build.json"), JSON.stringify({ input, specialist: null, external: { app: resolve(appDir), version: EXTERNAL_VERSION, nota: "app hecha fuera de webmcp: sin Standard, sin contrato, sin pasos" } }, null, 2));
    writeFileSync(join(out, "planilla.json"), JSON.stringify(pl, null, 2));
  } else if (checks) {
    const c = JSON.parse(readFileSync(checks, "utf8"));
    if (c.length !== refined.features.length || c.some((r, i) => r.text !== refined.features[i]))
      throw new Error(`los chequeos de ${checks} no son de estos requisitos (otro snapshot): no se mezclan jueces`);
    writeFileSync(join(out, "checks.json"), JSON.stringify(c, null, 2));
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const [appDir, snapshot] = pos;
  if (!appDir || !snapshot || !statSync(appDir).isDirectory()) {
    console.log("uso: node build/validate_external.mjs <carpeta de la app> <snapshot.json> [--checks build/runs/<build>/checks.json | --planilla <planilla.json>] [--name gemma_sola]");
    process.exit(2);
  }
  const out = prepareExternal({ appDir, snapshot, checks: flag("--checks"), planilla: flag("--planilla"), name: flag("--name") });
  console.log(`[EXTERNO] ${EXTERNAL_VERSION} · app ${resolve(appDir)} → ${out}${flag("--planilla") ? ` · planilla ${flag("--planilla")} (sin traductor)` : flag("--checks") ? ` · chequeos de ${flag("--checks")} (mismo juez)` : " · se traducen los requisitos (traductor)"}`);
  const p = spawn(process.execPath, [join(here, "run_build.mjs"), "--validate", out], { stdio: "inherit" });
  p.on("close", (code) => process.exit(code ?? 1));
}
