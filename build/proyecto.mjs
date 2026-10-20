// proyecto.mjs — LA CADENA ENTERA, por consola (19/10, decisión de Miche: "ingeniería inversa").
//
// Lo que necesita el ciclo para llevar una app a cumplir lo pedido (lo demostró el 16/16): requisitos, una planilla
// aprobada y una app de partida. Esta cadena los produce sin Intent Forge:
//   1. NUEVO (con Qwen cargado en LM Studio):
//      - el pedido de Miche TAL CUAL: cada feature, cada restricción, y los criterios de éxito que no repiten una
//        feature, son un requisito (nadie los reescribe ni los clasifica);
//      - Qwen propone el glosario (cómo se llaman las cosas de la app) y arma la planilla con plantillas;
//      - se escribe planilla.md: la planilla EN PALABRAS, para que Miche la lea y la apruebe (o pida cambios).
//   2. SEGUIR (con Gemma cargada): si el proyecto no tiene app, la vuelta 0 escribe el borrador; después el ciclo.
//      La app que queda se guarda en <proyecto>/app. Volver a correr SEGUIR es RETOMAR el proyecto desde esa app.
//   3. JUZGAR: una app contra una planilla (p. ej. la vara a mano), sin modelo.
//
//   node build/proyecto.mjs nuevo <pedido.txt> [--nombre kanban]
//   node build/proyecto.mjs seguir <carpeta del proyecto> [--max-vueltas 40]
//   node build/proyecto.mjs juzgar <carpeta de la app> <planilla.json>

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const PROYECTO_VERSION = "proyecto v0.1";
const here = dirname(fileURLToPath(import.meta.url));

// ---------- el pedido, tal cual ----------
// Ante la duda, un criterio queda como requisito: uno de más cuesta una prueba repetida; uno de menos, algo sin probar
// (1ª prueba: "Se pueden eliminar las tarjetas" se daba por repetido de "Se pueden leer las tarjetas").
const STOP = new Set(["las", "los", "una", "uno", "unos", "unas", "del", "con", "que", "por", "para", "sin", "puede", "pueden", "tiene", "tienen", "cada", "dentro", "esta", "este", "sera", "seran", "muestra", "muestran", "son", "hay"]);
const words = (t) => new Set((String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9#]{3,}/g) || []).filter((w) => !STOP.has(w)));
/** ¿b repite a? Sin las palabras que están en casi todos los requisitos (tarjeta, columna…): ≥ 2 palabras de b y el 70% en a. */
const repite = (a, b, comunes) => { const A = words(a), B = [...words(b)].filter((w) => !comunes.has(w)); return B.length >= 2 && B.filter((w) => A.has(w)).length / B.length >= 0.7; };

/** El texto de Miche → { titulo, requisitos: [{ texto, de: "feature" | "restriccion" | "criterio" }], repetidos: [] }. Función pura. */
export function leerPedido(texto0) {
  const texto = String(texto0).replace(/\\n/g, "\n").replace(/\r/g, "");
  const lineas = texto.split("\n").map((l) => l.trim());
  let seccion = null, titulo = "";
  const feats = [], crit = [], restr = [], libres = [];
  for (const l of lineas) {
    if (!l) continue;
    if (/^features?\s*:?$/i.test(l) || /^qu[eé] tiene que hacer/i.test(l)) { seccion = "feature"; continue; }
    if (/^criterios?( de [eé]xito)?\s*:?$/i.test(l)) { seccion = "criterio"; continue; }
    if (/^restricciones?\b.*:?$/i.test(l) && l.length < 120) { seccion = "restriccion"; continue; }
    const item = l.replace(/^(\d+[.)]|[-*•])\s*/, "");
    if (!seccion) { if (!titulo) titulo = item; else libres.push(item); continue; }
    if (seccion === "feature") feats.push(item); else if (seccion === "criterio") crit.push(item); else restr.push(item);
  }
  const requisitos = [];
  if (!feats.length && !crit.length && !restr.length) libres.forEach((t) => requisitos.push({ texto: t, de: "feature" }));
  feats.forEach((t) => requisitos.push({ texto: t, de: "feature" }));
  libres.forEach((t) => feats.length && requisitos.push({ texto: t, de: "feature" }));
  // los criterios que no repiten una feature también son requisitos (p. ej. "Se guardan los datos en localstorage")
  const repetidos = [];
  const cuenta = new Map();
  for (const r of [...feats, ...crit]) for (const w of words(r)) cuenta.set(w, (cuenta.get(w) || 0) + 1);
  const comunes = new Set([...cuenta].filter(([, n]) => n >= Math.max(3, 0.25 * (feats.length + crit.length))).map(([w]) => w));
  for (const c of crit) { const igual = requisitos.find((r) => repite(r.texto, c, comunes)); if (igual) repetidos.push({ criterio: c, ya_esta_en: igual.texto }); else requisitos.push({ texto: c, de: "criterio" }); }
  restr.forEach((t) => requisitos.push({ texto: `Restricción: ${t}`, de: "restriccion" }));
  return { titulo, requisitos, repetidos };
}

// ---------- la planilla en palabras, para Miche ----------
export async function planillaEnPalabras(p, requisitos) {
  const { describirFila } = await import("../profiles/web/validation/planilla_palabras.mjs");
  const out = [`# Planilla: qué se va a probar`, "", `Glosario: ${p.glosario ? Object.entries(p.glosario).map(([t, w]) => `${t} = ${w ?? "(no tiene)"}`).join(", ") : "genérico"}`, "", "Leé cada requisito y lo que se va a probar. Si algo está mal o falta, decímelo (o corregí planilla.json).", ""];
  requisitos.forEach((r, i) => {
    const id = `R${i + 1}`, filas = (p.filas || []).filter((f) => f.r === id);
    out.push(`## ${id}. ${r.texto}`);
    if (filas.length) filas.forEach((f) => out.push(`- ${describirFila(f, p.glosario)}`));
    else out.push(`- (sin prueba: ${p.sin_fila?.[id] || "no se pudo armar"})`);
    out.push("");
  });
  return out.join("\n");
}

// ---------- juzgar una app con una planilla ----------
export async function juzgar(appDir, planilla, azar = "") {
  const { juezReal } = await import("./run_ciclo.mjs");
  const { leerApp } = await import("../harness/mapa.mjs");
  const r = await juezReal(planilla)(leerApp(appDir), planilla.filas, azar, join(here, "runs", "_juzgar"));
  const reqs = [...new Set(planilla.filas.map((f) => f.r))];
  const ok = reqs.filter((q) => planilla.filas.filter((f) => f.r === q).every((f) => r[f.id]?.result === "PASS"));
  return { cumplidos: ok.length, de: reqs.length, fallan: reqs.filter((q) => !ok.includes(q)).map((q) => ({ r: q, detalle: planilla.filas.filter((f) => f.r === q && r[f.id]?.result !== "PASS").map((f) => r[f.id]?.detail) })) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [modo, a1, a2] = process.argv.slice(2);
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  if (modo === "nuevo" && a1) {
    const { writePlanilla, proponerGlosario, WRITER_VERSION } = await import("../profiles/web/validation/planilla_writer.mjs");
    const ped = leerPedido(readFileSync(a1, "utf8"));
    const slug = (flag("--nombre") || ped.titulo || "proyecto").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 30);
    const dir = join(here, "proyectos", `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_${slug}`);
    mkdirSync(dir, { recursive: true });
    const features = ped.requisitos.map((r) => r.texto);
    writeFileSync(join(dir, "pedido.txt"), readFileSync(a1, "utf8"));
    writeFileSync(join(dir, "requisitos.json"), JSON.stringify({ version: PROYECTO_VERSION, titulo: ped.titulo, requisitos: ped.requisitos, criterios_que_repiten_una_feature: ped.repetidos, intentForge: { refined_prompt: { project_name: ped.titulo, features } } }, null, 2));
    console.log(`[PROYECTO] ${ped.titulo}: ${features.length} requisitos (${ped.requisitos.filter((r) => r.de === "feature").length} features, ${ped.requisitos.filter((r) => r.de === "criterio").length} criterios nuevos, ${ped.requisitos.filter((r) => r.de === "restriccion").length} restricciones; ${ped.repetidos.length} criterios repetían una feature) → ${dir}`);
    const g = await proponerGlosario({ features, context: ped.titulo });
    console.log(`[PROYECTO] glosario (Qwen): ${g.glosario ? JSON.stringify(g.glosario) : `no salió (${g.problema}); queda el genérico`}`);
    const t0 = Date.now();
    const p = await writePlanilla({ features, context: ped.titulo, glosario: g.glosario, onProgress: (id, r) => console.log(`[PLANILLA] ${id}: ${r.sin_fila ? `sin fila (${r.sin_fila})` : `${r.filas.length} fila(s)`}${r.rejected.length ? ` · ${r.rejected.length} rechazada(s)` : ""}`) });
    const { calls, ...planilla } = p;
    writeFileSync(join(dir, "planilla.json"), JSON.stringify(planilla, null, 2));
    writeFileSync(join(dir, "planilla_evidencia.json"), JSON.stringify({ type: "EVIDENCE", kind: "planilla_writer", version: WRITER_VERSION, ms: Date.now() - t0, glosario: g, calls }, null, 2));
    writeFileSync(join(dir, "planilla.md"), await planillaEnPalabras(planilla, ped.requisitos));
    console.log(`\n[PROYECTO] listo. Leé ${join(dir, "planilla.md")} (qué se va a probar, en palabras).\nCuando esté bien, cargá Gemma en LM Studio y corré:\n  npm run proyecto -- seguir "${dir}"`);
  } else if (modo === "seguir" && a1) {
    const { ciclo } = await import("./run_ciclo.mjs");
    const { leerApp } = await import("../harness/mapa.mjs");
    const dir = resolve(a1);
    const req = JSON.parse(readFileSync(join(dir, "requisitos.json"), "utf8"));
    const planilla = JSON.parse(readFileSync(join(dir, "planilla.json"), "utf8"));
    const appDir = join(dir, "app");
    const hay = existsSync(appDir) && readdirSync(appDir).some((f) => f.endsWith(".html"));
    const outDir = join(dir, `ciclo_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
    console.log(`[PROYECTO] ${req.titulo}: ${hay ? "RETOMA desde la app que ya tiene" : "desde cero (vuelta 0: borrador)"} → ${outDir}`);
    const { app } = await ciclo({ app: hay ? leerApp(appDir) : null, planilla, features: req.intentForge.refined_prompt.features, outDir, maxVueltas: Number(flag("--max-vueltas")) || 40, log: console.log });
    mkdirSync(appDir, { recursive: true });
    for (const [f, s] of Object.entries(app)) writeFileSync(join(appDir, f), s);
    console.log(`[PROYECTO] la app quedó en ${appDir} (abrí index.html). Volver a correr "seguir" la retoma desde ahí.`);
  } else if (modo === "juzgar" && a1 && a2) {
    const r = await juzgar(resolve(a1), JSON.parse(readFileSync(a2, "utf8")), flag("--azar") || "");
    console.log(`[JUZGAR] ${r.cumplidos}/${r.de} requisitos cumplidos`);
    for (const f of r.fallan) console.log(`  ✗ ${f.r}: ${f.detalle.join(" | ").slice(0, 300)}`);
  } else {
    console.log("uso:\n  node build/proyecto.mjs nuevo <pedido.txt> [--nombre x]      (Qwen: requisitos tal cual, glosario, planilla y planilla.md)\n  node build/proyecto.mjs seguir <carpeta del proyecto>      (Gemma: borrador si no hay app, y el ciclo; retoma si ya hay)\n  node build/proyecto.mjs juzgar <carpeta de la app> <planilla.json>");
    process.exit(2);
  }
}
