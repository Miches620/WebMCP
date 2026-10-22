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
//   node build/proyecto.mjs seguir <carpeta del proyecto> [--max-vueltas 40] [--visual]
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

// ---------- dos nombres para lo mismo ----------
// 20/10: el pedido de project26 dice "Completa" 4 veces y "Completado" 1 vez para la misma columna. Una persona se
// equivoca tecleando; el sistema no puede fallar por eso. Se usa el que más aparece (empate: el que está entre comillas)
// y se avisa en la consola y arriba de planilla.md, ANTES de construir. pedido.txt queda tal cual.
const sinTilde = (w) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const prefijo = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const esPlural = (a, b) => b === a + "s" || b === a + "es" || a === b + "s" || a === b + "es";
/** Texto del pedido → [{ usa, en_vez_de, veces: {usa, en_vez_de} }]. Solo nombres que el usuario citó entre comillas al menos una vez. Función pura. */
export function nombresParecidos(texto) {
  const t = String(texto);
  const citados = new Set();
  for (const m of t.matchAll(/['"‘’“”]([^'"‘’“”\n]{2,60})['"‘’“”]/g)) for (const w of m[1].match(/\p{Lu}\p{L}{4,}/gu) || []) citados.add(w);
  const veces = new Map();
  for (const w of t.match(/\p{Lu}\p{L}{4,}/gu) || []) veces.set(w, (veces.get(w) || 0) + 1);
  const out = [], visto = new Set();
  for (const q of citados) for (const w of veces.keys()) {
    if (w === q) continue;
    const A = sinTilde(q), B = sinTilde(w);
    if (esPlural(A, B)) continue;
    const cp = prefijo(A, B);
    if (!(A === B || (cp >= 5 && cp >= 0.7 * Math.min(A.length, B.length)))) continue;
    const par = [q, w].sort().join("|"); if (visto.has(par)) continue; visto.add(par);
    const vq = veces.get(q) || 0, vw = veces.get(w) || 0;
    const [usa, otro] = vw > vq ? [w, q] : [q, w];
    out.push({ usa, en_vez_de: otro, veces: { usa: veces.get(usa) || 0, en_vez_de: veces.get(otro) || 0 } });
  }
  return out;
}
/** Cambia en un texto cada nombre que sobra por el que se usa (palabra entera). */
export function unificar(texto, correcciones) {
  let s = String(texto);
  for (const c of correcciones) s = s.replace(new RegExp(`(?<!\\p{L})${c.en_vez_de}(?!\\p{L})`, "gu"), c.usa);
  return s;
}

// ---------- la planilla en palabras, para Miche ----------
export async function planillaEnPalabras(p, requisitos, correcciones = []) {
  const { describirFila } = await import("../profiles/web/validation/planilla_palabras.mjs");
  const g = p.glosario || {};
  const out = [`# Planilla: qué se va a probar`, "",
    `**Primero, el glosario** (de esto dependen muchas pruebas): lo que el usuario crea se llama **${g.item || "elemento"}**; ${g.grupo ? `los lugares con nombre donde están se llaman **${g.grupo}**, y lo que se crea aparece en ${g.inicio ? `**${g.inicio}**` : "**(no se dijo: conviene fijarlo con \"inicio\")**"}` : `**no hay lugares con nombre donde se agrupen** (sin esto no se prueban mover, contadores ni orden)`}. Si no es así, avisá: se corrige con \`--glosario '{"item":"…","grupo":"…","inicio":"…"}'\` y se vuelve a armar.`, "",
    ...(correcciones.length ? [`**Corregí ${correcciones.length === 1 ? "un nombre" : "unos nombres"}** (pusiste dos nombres para lo mismo): ${correcciones.map((c) => `usé **"${c.usa}"** (aparece ${c.veces.usa} ${c.veces.usa === 1 ? "vez" : "veces"}) en vez de "${c.en_vez_de}" (${c.veces.en_vez_de})`).join("; ")}. Si era al revés, o eran cosas distintas, avisá y se corrige el pedido.`, ""] : []),
    "Después, leé cada requisito y lo que se va a probar. Si una prueba está mal, decí su número (p. ej. R10.3) y se saca con `npm run proyecto -- quitar <carpeta> R10.3`.", ""];
  requisitos.forEach((r, i) => {
    const id = `R${i + 1}`, filas = (p.filas || []).filter((f) => f.r === id);
    out.push(`## ${id}. ${r.texto}`);
    if (filas.length) filas.forEach((f) => out.push(`- **${f.id}** · ${describirFila(f, p.glosario)}`));
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
    const correcciones = nombresParecidos(readFileSync(a1, "utf8"));
    for (const r of ped.requisitos) { const u = unificar(r.texto, correcciones); if (u !== r.texto) { r.texto_original = r.texto; r.texto = u; } }
    for (const c of correcciones) console.log(`[PROYECTO] ojo: pusiste "${c.usa}" (${c.veces.usa}) y "${c.en_vez_de}" (${c.veces.en_vez_de}) para lo mismo → uso "${c.usa}". Si era al revés, corregí el pedido.`);
    const slug = (flag("--nombre") || ped.titulo || "proyecto").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").slice(0, 30);
    const dir = join(here, "proyectos", `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_${slug}`);
    mkdirSync(dir, { recursive: true });
    const features = ped.requisitos.map((r) => r.texto);
    writeFileSync(join(dir, "pedido.txt"), readFileSync(a1, "utf8"));
    writeFileSync(join(dir, "requisitos.json"), JSON.stringify({ version: PROYECTO_VERSION, titulo: ped.titulo, requisitos: ped.requisitos, correcciones, criterios_que_repiten_una_feature: ped.repetidos, intentForge: { refined_prompt: { project_name: ped.titulo, features } } }, null, 2));
    console.log(`[PROYECTO] ${ped.titulo}: ${features.length} requisitos (${ped.requisitos.filter((r) => r.de === "feature").length} features, ${ped.requisitos.filter((r) => r.de === "criterio").length} criterios nuevos, ${ped.requisitos.filter((r) => r.de === "restriccion").length} restricciones; ${ped.repetidos.length} criterios repetían una feature) → ${dir}`);
    // --glosario '{"item":"tarjeta","grupo":"columna"}' (o un archivo .json): lo decide Miche y Qwen no lo propone
    const gArg = flag("--glosario");
    const g = gArg ? { glosario: JSON.parse(existsSync(gArg) ? readFileSync(gArg, "utf8") : gArg), de: "Miche" } : await proponerGlosario({ features, context: ped.titulo });
    console.log(`[PROYECTO] glosario (${g.de || "Qwen"}): ${g.glosario ? JSON.stringify(g.glosario) : `no salió (${g.problema}); queda el genérico`}${g.aviso ? ` · ojo: ${g.aviso}` : ""}`);
    const t0 = Date.now();
    const p = await writePlanilla({ features, context: ped.titulo, glosario: g.glosario, onProgress: (id, r) => console.log(`[PLANILLA] ${id}: ${r.sin_fila ? `sin fila (${r.sin_fila})` : `${r.filas.length} fila(s)`}${r.rejected.length ? ` · ${r.rejected.length} rechazada(s)` : ""}`) });
    const { calls, ...planilla } = p;
    writeFileSync(join(dir, "planilla.json"), JSON.stringify(planilla, null, 2));
    writeFileSync(join(dir, "planilla_evidencia.json"), JSON.stringify({ type: "EVIDENCE", kind: "planilla_writer", version: WRITER_VERSION, ms: Date.now() - t0, glosario: g, calls }, null, 2));
    writeFileSync(join(dir, "planilla.md"), await planillaEnPalabras(planilla, ped.requisitos, correcciones));
    console.log(`\n[PROYECTO] listo. Leé ${join(dir, "planilla.md")} (qué se va a probar, en palabras).\nCuando esté bien, cargá Gemma en LM Studio y corré:\n  npm run proyecto -- seguir "${dir}"`);
  } else if (modo === "seguir" && a1) {
    const { ciclo } = await import("./run_ciclo.mjs");
    const { leerApp } = await import("../harness/mapa.mjs");
    const dir = resolve(a1);
    const req = JSON.parse(readFileSync(join(dir, "requisitos.json"), "utf8"));
    const planilla = JSON.parse(readFileSync(join(dir, "planilla.json"), "utf8"));
    // --visual (22/10): suma las reglas visuales medibles (visual.mjs) como V1, V2…; van después de lo pedido y no lo pisan
    if (args.includes("--visual")) { const { filasVisuales, VISUAL_VERSION } = await import("../profiles/web/validation/visual.mjs"); planilla.filas = [...(planilla.filas || []), ...filasVisuales()]; console.log(`[PROYECTO] + reglas visuales (${VISUAL_VERSION}): ${filasVisuales().map((f) => f.r).join(", ")}`); }
    const appDir = join(dir, "app");
    const hay = existsSync(appDir) && readdirSync(appDir).some((f) => f.endsWith(".html"));
    const outDir = join(dir, `ciclo_${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`);
    console.log(`[PROYECTO] ${req.titulo}: ${hay ? "RETOMA desde la app que ya tiene" : "desde cero (vuelta 0: borrador)"} → ${outDir}`);
    const { app } = await ciclo({ app: hay ? leerApp(appDir) : null, planilla, features: req.intentForge.refined_prompt.features, outDir, maxVueltas: Number(flag("--max-vueltas")) || 40, log: console.log });
    mkdirSync(appDir, { recursive: true });
    for (const [f, s] of Object.entries(app)) writeFileSync(join(appDir, f), s);
    console.log(`[PROYECTO] la app quedó en ${appDir} (abrí index.html). Volver a correr "seguir" la retoma desde ahí.`);
  } else if (modo === "quitar" && a1 && a2) {
    // Miche saca pruebas que están mal (las que dice planilla.md); quedan anotadas en "quitadas", no se pierden
    const dir = resolve(a1), ids = args.slice(2).filter((x) => !x.startsWith("--"));
    const req = JSON.parse(readFileSync(join(dir, "requisitos.json"), "utf8"));
    const p = JSON.parse(readFileSync(join(dir, "planilla.json"), "utf8"));
    const sale = (f) => ids.some((x) => x === f.id || (x.endsWith(".*") && f.r === x.slice(0, -2)) || x === f.r);
    const fuera = p.filas.filter(sale);
    p.quitadas = { ...(p.quitadas || {}), ...Object.fromEntries(fuera.map((f) => [f.id, f])) };
    p.filas = p.filas.filter((f) => !sale(f));
    for (const r of new Set(fuera.map((f) => f.r))) if (!p.filas.some((f) => f.r === r)) p.sin_fila = { ...(p.sin_fila || {}), [r]: "Miche sacó sus pruebas (estaban mal)" };
    writeFileSync(join(dir, "planilla.json"), JSON.stringify(p, null, 2));
    writeFileSync(join(dir, "planilla.md"), await planillaEnPalabras(p, req.requisitos, req.correcciones || []));
    console.log(`[PROYECTO] saqué ${fuera.length} prueba(s): ${fuera.map((f) => f.id).join(", ") || "ninguna (¿los números están bien?)"} · quedan ${p.filas.length}. planilla.md actualizado.`);
  } else if (modo === "juzgar" && a1 && a2) {
    const pj = JSON.parse(readFileSync(a2, "utf8"));
    if (args.includes("--visual")) { const { filasVisuales } = await import("../profiles/web/validation/visual.mjs"); pj.filas = [...(pj.filas || []), ...filasVisuales()]; }
    const r = await juzgar(resolve(a1), pj, flag("--azar") || "");
    console.log(`[JUZGAR] ${r.cumplidos}/${r.de} requisitos cumplidos`);
    for (const f of r.fallan) console.log(`  ✗ ${f.r}: ${f.detalle.join(" | ").slice(0, 300)}`);
  } else {
    console.log("uso:\n  node build/proyecto.mjs quitar <carpeta del proyecto> R10.3 R21.*   (saca pruebas que están mal)\n  node build/proyecto.mjs nuevo <pedido.txt> [--nombre x]      (Qwen: requisitos tal cual, glosario, planilla y planilla.md)\n  node build/proyecto.mjs seguir <carpeta del proyecto> [--visual]  (Gemma: borrador si no hay app, y el ciclo; retoma si ya hay; --visual suma las reglas visuales)\n  node build/proyecto.mjs juzgar <carpeta de la app> <planilla.json> [--visual]");
    process.exit(2);
  }
}
