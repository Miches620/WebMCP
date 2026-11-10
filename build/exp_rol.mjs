// exp_rol.mjs — ¿Asignarle un Role a Gemma (Frontend Senior + Skills) mejora el borrador? (03/11)
//
// Pregunta de Miche (03/11): "¿le estamos asignando su role? ¿declaramos un profile? Si no, caemos en la torpeza de
// explicarle hasta cómo armar una cuadrícula". Hasta hoy, el ciclo le decía solo "Sos el programador de una app web".
//
// Experimento: el borrador desde cero (vuelta 0, sin ciclo), en 4 condiciones, k veces cada una, juzgado con la planilla
// del proyecto:
//   sin      → como siempre;
//   persona  → solo "Sos un desarrollador Frontend Senior…" (el "Eres X Senior" de los prompts de Cursor);
//   rol      → persona + Skills del Role (lo que un Senior SABE de este tipo de app);
//   placebo  → texto neutro del MISMO largo que "rol" (10/10: un texto neutro cambió Boxworld de 7/0 a 3/4).
// Con temperature 0 las k repeticiones saldrían iguales: se usa temperature 0.7 con la misma semilla por repetición en
// las 4 condiciones (pares), y se alternan las condiciones dentro de cada repetición.
//
//   node build/exp_rol.mjs <carpeta del proyecto> [--k 3] [--cond sin,persona,rol,placebo] [--role web-app]
//                          [--temp 0.7] [--out carpeta]   (con --out de una corrida cortada, sigue desde donde quedó)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chatStream } from "./lm_stream.mjs";
import { borrador, juezReal, puntaje } from "./run_ciclo.mjs";
import { loadRole, rolTexto } from "../roles/registry.mjs";
import { modeloDe } from "../modelos.mjs";

export const EXP_ROL_VERSION = "exp_rol v0.1";
const here = dirname(fileURLToPath(import.meta.url));
const LM_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = modeloDe("specialist"); // 10/11: el modelo sale de PUESTOS.md (puesto "specialist"), no se nombra en el código

/** El texto de Role de cada condición. */
export async function textosDeCondicion(roleId = "web-app") {
  const role = await loadRole(roleId), plac = await loadRole(roleId, { placebo: true });
  return {
    sin: "",
    persona: rolTexto(role, "borrador", { skills: false }),
    rol: rolTexto(role, "borrador"),
    placebo: rolTexto(plac, "borrador"),
  };
}

/** Lo que se mira de un borrador juzgado. */
export function medir(filas, est) {
  const reqs = [...new Set(filas.map((f) => f.r))];
  const cumplidos = reqs.filter((r) => filas.filter((f) => f.r === r).every((f) => est[f.id]?.result === "PASS"));
  const pasa = (r) => cumplidos.includes(r);
  const parcial = filas.filter((f) => est[f.id]?.result !== "PASS").reduce((a, f) => a + puntaje(est[f.id]), 0);
  const escribe = filas.some((f) => /✓ escribió "/.test(est[f.id]?.detail || ""));
  return { requisitos: cumplidos.length, de: reqs.length, pruebas: filas.filter((f) => est[f.id]?.result === "PASS").length, de_pruebas: filas.length, parcial, grilla: pasa("R2"), escribe, cumplidos };
}

export async function experimento({ dir, k = 3, conds = ["sin", "persona", "rol", "placebo"], roleId = "web-app", temp = 0.7, out, call, juez, log = console.log }) {
  const planilla = JSON.parse(readFileSync(join(dir, "planilla.json"), "utf8"));
  const req = JSON.parse(readFileSync(join(dir, "requisitos.json"), "utf8"));
  const features = req.intentForge?.refined_prompt?.features || req.requisitos.map((r) => r.texto);
  const textos = await textosDeCondicion(roleId);
  mkdirSync(out, { recursive: true });
  const jz = juez || juezReal(planilla);
  const res = [];
  for (let rep = 1; rep <= k; rep++) {
    for (const cond of conds) {
      const d = join(out, `${cond}_${rep}`);
      if (existsSync(join(d, "resultado.json"))) { const r = JSON.parse(readFileSync(join(d, "resultado.json"), "utf8")); res.push(r); log(`[EXP] ${cond} #${rep}: ya estaba (${r.requisitos}/${r.de})`); continue; }
      const seed = 1000 + rep;
      const llamar = call || (async (messages, max) => { const t0 = Date.now(); const r = await chatStream(LM_URL, { model: MODEL, messages, temperature: temp, seed, max_tokens: max }); return { content: r.content, usage: r.usage, ms: Date.now() - t0 }; });
      const t0 = Date.now();
      log(`[EXP] ${cond} #${rep}: borrador (${textos[cond].length} caracteres de Role)…`);
      const { app, pedidos } = await borrador({ features, planilla, call: llamar, rol: textos[cond], log: (m) => log(`  ${m}`) });
      mkdirSync(d, { recursive: true });
      for (const [f, s] of Object.entries(app)) writeFileSync(join(d, f), s);
      const est = await jz(app, planilla.filas, `exp${rep}`, join(out, "_juzgar"));
      const m = medir(planilla.filas, est);
      const r = { cond, rep, seed, temp, ...m, ms: Date.now() - t0, pedidos, detalle: Object.fromEntries(Object.entries(est).map(([id, x]) => [id, `${x.result} ${String(x.detail || "").slice(0, 300)}`])) };
      writeFileSync(join(d, "resultado.json"), JSON.stringify(r, null, 2));
      res.push(r);
      log(`[EXP] ${cond} #${rep}: ${m.requisitos}/${m.de} requisitos · ${m.pruebas}/${m.de_pruebas} pruebas · ✓ a medias ${m.parcial} · grilla ${m.grilla ? "✓" : "✗"} · se escribe ${m.escribe ? "✓" : "✗"} · ${Math.round(r.ms / 60000)} min`);
    }
  }
  const tabla = resumen(res, conds);
  writeFileSync(join(out, "resultados.json"), JSON.stringify({ version: EXP_ROL_VERSION, modelo: MODEL, temp, k, conds, role: roleId, textos, resultados: res }, null, 2));
  writeFileSync(join(out, "resumen.md"), tabla);
  log(`\n${tabla}`);
  return { res, tabla };
}

export function resumen(res, conds) {
  const fila = (c) => {
    const rs = res.filter((r) => r.cond === c);
    const prom = (f) => (rs.reduce((a, r) => a + f(r), 0) / (rs.length || 1)).toFixed(1);
    return `| ${c} | ${rs.length} | ${rs.filter((r) => r.grilla).length}/${rs.length} | ${rs.filter((r) => r.escribe).length}/${rs.length} | ${prom((r) => r.requisitos)} | ${prom((r) => r.pruebas)} | ${prom((r) => r.parcial)} | ${rs.map((r) => r.requisitos).join(" · ")} |`;
  };
  return `# Experimento de Role — borrador desde cero\n\n| condición | n | grilla bien (R2) | se puede escribir | requisitos (prom.) | pruebas (prom.) | ✓ a medias (prom.) | requisitos de cada uno |\n|---|---|---|---|---|---|---|---|\n${conds.map(fila).join("\n")}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const dir = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!dir) { console.log("uso: node build/exp_rol.mjs <carpeta del proyecto> [--k 3] [--cond sin,persona,rol,placebo] [--role web-app] [--temp 0.7] [--out carpeta]"); process.exit(2); }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = flag("--out") || join(here, "runs", `${stamp}_exp_rol`);
  console.log(`[EXP] ${EXP_ROL_VERSION} · ${MODEL} → ${out}`);
  await experimento({ dir: resolve(dir), k: Number(flag("--k")) || 3, conds: (flag("--cond") || "sin,persona,rol,placebo").split(","), roleId: flag("--role") || "web-app", temp: Number(flag("--temp") ?? 0.7), out });
}
