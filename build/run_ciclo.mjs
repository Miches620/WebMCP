// run_ciclo.mjs — EL CICLO: la app mejora vuelta a vuelta hasta cumplir la planilla (18/10, decisión de Miche).
//
// Por qué (claude/propuesta_ciclo_2026-10-17.md): run_build construye todo de una vez y valida al final; los FAIL
// nunca vuelven al Specialist. Gemma sola hizo un Kanban entero con UN error de una línea (index.html:30); con esa
// línea arreglada pasó de 2 a 10 requisitos. Le faltó la vuelta, no inteligencia.
//
// Cómo trabaja Claude, y así trabaja el ciclo:
//   1. el juez corre la planilla (con textos de prueba al azar en cada vuelta);
//   2. toma el primer requisito que falla (en el orden en que Miche los escribió);
//   3. pedido A (corto): Gemma ve el requisito, qué se prueba, qué falló y el MAPA de la app, y dice qué quiere ver;
//   4. pedido B: recibe solo ese código (más la función donde saltó el error y las líneas que la llaman) y devuelve
//      funciones enteras o archivos chicos cambiados;
//   5. el juez vuelve a probar ese requisito y TODO lo que ya pasaba: si mejora sin romper nada, queda (foto nueva);
//      si rompe algo, se vuelve atrás y el próximo intento sabe qué rompió;
//   6. después de N intentos sin avance el requisito queda pendiente y se sigue; al final, otra pasada por los pendientes.
// Nada es imposible: lleva más vueltas. Cada vuelta queda en ciclo.json (Evidence).
//
//   node build/run_ciclo.mjs <carpeta de la app> --planilla <planilla.json> --snapshot <snapshot.json> [--out dir] [--max-vueltas 40]

import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { chatStream } from "./lm_stream.mjs";
import { estTokens } from "./tokens.mjs";
import { parseJsonLoose } from "../json_loose.mjs";
import { leerApp, mapaTexto, codigoDe, funcionEnLinea, llamadas } from "../harness/mapa.mjs";
import { aplicar } from "../harness/cambios.mjs";
import { describirFila } from "../profiles/web/validation/planilla_palabras.mjs";

export const CICLO_VERSION = "ciclo v0.1";
const here = dirname(fileURLToPath(import.meta.url));
const LM_URL = process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = process.env.SPECIALIST_MODEL || "google/gemma-4-e4b";
const CONTEXTO = Number(process.env.WEBMCP_CONTEXT) || 12000;

// ---------- el juez ----------
/** Juez real: escribe la app en dir y corre las filas en Chromium. Devuelve { [id]: {result, detail} }. */
export function juezReal(planilla) {
  let V = null;
  return async (app, filas, azar, dir) => {
    if (!V) V = (await import("../profiles/web/validation/check_catalog.mjs")).validationFor(["web", "web/app"]);
    mkdirSync(dir, { recursive: true });
    for (const [f, s] of Object.entries(app)) writeFileSync(join(dir, f), s);
    const checks = filas.map((f) => V.normalizeCheck({ type: "planilla_fila", params: { fila: f, ...(planilla.controles ? { controles: planilla.controles } : {}), ...(planilla.glosario ? { glosario: planilla.glosario } : {}), azar: [azar] } }));
    const res = await V.runChecks(join(dir, "index.html"), checks);
    return Object.fromEntries(res.map((x, i) => [filas[i].id, { result: x.result, detail: x.detail }]));
  };
}

// ---------- los pedidos ----------
const SYS_VER = `Sos el programador de una app web (HTML + CSS + JavaScript, sin frameworks). Hay que arreglar UNA cosa que falla.
Mirá el requisito, lo que falló y el mapa de la app, y decí qué partes del código necesitás ver para arreglarlo.
Respondé SOLO con JSON: { "ver": ["nombreDeFuncion", "archivo.html", …] } (como mucho 4: funciones por su nombre, o archivos .html / .css enteros).`;
const SYS_ARREGLO = `Sos el programador de una app web (HTML + CSS + JavaScript, sin frameworks). Hay que arreglar UNA cosa que falla, sin romper lo que ya anda.
Devolvé SOLO los cambios, en este formato (uno o más bloques):

### FUNCION: nombreDeLaFuncion
\`\`\`js
function nombreDeLaFuncion(...) { ...la función ENTERA, corregida... }
\`\`\`

### ARCHIVO: index.html
\`\`\`html
...el archivo ENTERO, corregido...
\`\`\`

Reglas:
1. Cambiá lo mínimo para que pase lo que falla.
2. Una función va ENTERA (desde "function" hasta su última llave). Una función nueva: ### FUNCION: nombre en archivo.js
3. HTML y CSS: el archivo ENTERO.
4. No inventes archivos nuevos.
5. Los textos de prueba cambian en cada prueba: no escribas textos fijos para que pase.
6. Sin explicaciones: solo los bloques.`;

const reqTexto = (ctx, r) => `Requisito ${r} (lo pidió el usuario): "${ctx.features[Number(r.slice(1)) - 1] || "?"}"`;
const consigna = (ctx, filas) => `Qué se prueba (cada línea es una prueba que tiene que pasar):\n${filas.map((f) => `- ${describirFila(f, ctx.planilla.glosario)}`).join("\n")}`;
const fallas = (filas, est) => `Lo que falló en la última prueba:\n${filas.filter((f) => est[f.id]?.result !== "PASS").map((f) => `- ${est[f.id]?.detail || "sin detalle"}`).join("\n")}`;

/** Dónde saltó un error de JS: [{file, line}] sacado de los detalles ("… (script.js:133)"). */
export function lugaresDeError(textos) {
  const out = [];
  for (const t of textos) for (const m of String(t || "").matchAll(/\(([\w./-]+\.js):(\d+)\)/g)) out.push({ file: m[1].split("/").pop(), line: Number(m[2]) });
  return out;
}

/** El código que va al pedido B: lo que pidió Gemma + la función del error + las líneas que la llaman, hasta el presupuesto. */
export function armarCodigo(app, ver, errores, presupuesto) {
  const piezas = [], vistos = new Set();
  const add = (titulo, texto, prioridad) => { if (vistos.has(titulo)) return; vistos.add(titulo); piezas.push({ titulo, texto, prioridad }); };
  for (const e of errores) {
    const fn = funcionEnLinea(app, e.file, e.line);
    if (!fn) continue;
    add(`función ${fn.name} (${fn.file}:${fn.start}-${fn.end}) — acá saltó el error (línea ${e.line})`, fn.text, 0);
    const ll = llamadas(app, fn.name);
    if (ll.length) add(`quién llama a ${fn.name}`, ll.map((x) => `${x.file}:${x.line}: ${x.text}`).join("\n"), 0);
  }
  for (const v of ver || []) {
    const name = String(v).trim().replace(/\(\)$/, "");
    const f = Object.keys(app).find((k) => k === name || k.endsWith("/" + name));
    if (f) { add(`archivo ${f} (entero)`, app[f], 2); continue; }
    const fn = codigoDe(app, name);
    if (fn) add(`función ${fn.name} (${fn.file}:${fn.start}-${fn.end})`, fn.text, 1);
  }
  piezas.sort((a, b) => a.prioridad - b.prioridad);
  const out = [], fuera = [];
  let usados = 0;
  for (const p of piezas) { const t = estTokens(p.texto) + 20; if (usados + t > presupuesto) { fuera.push(p.titulo); continue; } usados += t; out.push(p); }
  return { texto: out.map((p) => `--- ${p.titulo}\n${p.texto}`).join("\n\n"), piezas: out.map((p) => p.titulo), fuera, tokens: usados };
}

async function llamarLM(messages, maxTokens) {
  const t0 = Date.now();
  const r = await chatStream(LM_URL, { model: MODEL, messages, temperature: 0, max_tokens: maxTokens });
  return { content: r.content, usage: r.usage, finish_reason: r.finish_reason, ms: Date.now() - t0 };
}

// ---------- el ciclo ----------
/**
 * @param {{ app: object, planilla: object, features: string[], outDir: string, call?: Function, juez?: Function,
 *           log?: Function, maxIntentos?: number, maxVueltas?: number, contexto?: number }} o
 */
export async function ciclo(o) {
  const { planilla, features, outDir } = o;
  const call = o.call || llamarLM, juez = o.juez || juezReal(planilla), log = o.log || (() => {});
  const maxIntentos = o.maxIntentos ?? 3, maxVueltas = o.maxVueltas ?? 40, contexto = o.contexto ?? CONTEXTO;
  const ctx = { planilla, features };
  const filas = planilla.filas || [];
  const reqs = [...new Set(filas.map((f) => f.r))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const filasDe = (r) => filas.filter((f) => f.r === r);
  let app = { ...o.app };
  mkdirSync(outDir, { recursive: true });
  const foto = (n) => { const d = join(outDir, `v${String(n).padStart(3, "0")}`); mkdirSync(d, { recursive: true }); for (const [f, s] of Object.entries(app)) writeFileSync(join(d, f), s); return d; };
  foto(0);
  const ev = { type: "EVIDENCE", kind: "ciclo", version: CICLO_VERSION, modelo: MODEL, contexto, inicio: new Date().toISOString(), vueltas: [], curva: [] };
  const guardar = () => writeFileSync(join(outDir, "ciclo.json"), JSON.stringify(ev, null, 2));
  const intentos = {}, ultimo = {};
  let pendientes = new Set(), segunda = false, version = 0;
  const cumplidos = (est) => reqs.filter((r) => filasDe(r).every((f) => est[f.id]?.result === "PASS"));

  for (let n = 1; n <= maxVueltas; n++) {
    const est = await juez(app, filas, `v${n}`, join(outDir, "trabajo"));
    const ok = cumplidos(est);
    ev.curva.push({ vuelta: n, cumplidos: ok.length, de: reqs.length, filas_pass: filas.filter((f) => est[f.id]?.result === "PASS").length, de_filas: filas.length });
    log(`[CICLO] vuelta ${n}: ${ok.length}/${reqs.length} requisitos · ${ev.curva.at(-1).filas_pass}/${filas.length} pruebas${pendientes.size ? ` · pendientes: ${[...pendientes].join(", ")}` : ""}`);
    let target = reqs.find((r) => !ok.includes(r) && !pendientes.has(r));
    if (!target && pendientes.size && !segunda) { segunda = true; log(`[CICLO] segunda pasada por los pendientes: ${[...pendientes].join(", ")}`); pendientes = new Set(); for (const k of Object.keys(intentos)) intentos[k] = 0; target = reqs.find((r) => !ok.includes(r)); }
    if (!target) { ev.fin = ok.length === reqs.length ? "todo cumplido" : `quedan pendientes: ${reqs.filter((r) => !ok.includes(r)).join(", ")}`; break; }
    const mias = filasDe(target);
    const pasaban = filas.filter((f) => est[f.id]?.result === "PASS" && f.r !== target);
    const vuelta = { vuelta: n, requisito: target, antes: Object.fromEntries(mias.map((f) => [f.id, est[f.id]?.result])) };
    // ---- pedido A: qué quiere ver ----
    const mapa = mapaTexto(app);
    const previo = ultimo[target] ? `\n\nEl intento anterior NO sirvió: ${ultimo[target]}` : "";
    const userA = `${reqTexto(ctx, target)}\n\n${consigna(ctx, mias)}\n\n${fallas(mias, est)}${previo}\n\nMapa de la app:\n${mapa}`;
    const a = await call([{ role: "system", content: SYS_VER }, { role: "user", content: userA }], 1500, "ver"); // 1500: Gemma 4 puede pensar antes de responder, y eso cuenta
    const pa = parseJsonLoose(a.content || "");
    const ver = pa.ok && Array.isArray(pa.data?.ver) ? pa.data.ver.slice(0, 4) : [];
    // ---- pedido B: el arreglo, con solo el código necesario ----
    const fijo = `${reqTexto(ctx, target)}\n\n${consigna(ctx, mias)}\n\n${fallas(mias, est)}${previo}\n\nMapa de la app:\n${mapa}\n\nCódigo:\n`;
    const maxResp = Math.min(4000, Math.floor(contexto * 0.3));
    const presupuesto = contexto - maxResp - estTokens(SYS_ARREGLO) - estTokens(fijo) - 200;
    const codigo = armarCodigo(app, ver, lugaresDeError(mias.map((f) => est[f.id]?.detail)), Math.max(500, presupuesto));
    const userB = fijo + (codigo.texto || "(no hay código para mostrar: pedí funciones o archivos que existan)");
    const b = await call([{ role: "system", content: SYS_ARREGLO }, { role: "user", content: userB }], maxResp, "arreglo");
    Object.assign(vuelta, { ver, codigo: codigo.piezas, codigo_fuera: codigo.fuera, tokens_pedido: { ver: estTokens(SYS_VER + userA), arreglo: estTokens(SYS_ARREGLO + userB) }, ms: { ver: a.ms, arreglo: b.ms }, usage: { ver: a.usage, arreglo: b.usage }, respuesta: b.content });
    const ap = aplicar(app, b.content);
    vuelta.aplicados = ap.aplicados; vuelta.problemas = ap.problemas;
    let veredicto;
    if (!ap.aplicados.length) veredicto = { ok: false, por: `no se pudo aplicar nada: ${ap.problemas.join("; ")}` };
    else {
      const despues = await juez(ap.app, [...mias, ...pasaban], `v${n}b`, join(outDir, "trabajo"));
      const rotas = pasaban.filter((f) => despues[f.id]?.result !== "PASS");
      const antesOk = mias.filter((f) => est[f.id]?.result === "PASS").length, ahoraOk = mias.filter((f) => despues[f.id]?.result === "PASS").length;
      vuelta.despues = Object.fromEntries(mias.map((f) => [f.id, despues[f.id]?.result]));
      if (rotas.length) veredicto = { ok: false, por: `rompió lo que ya andaba: ${rotas.map((f) => `${f.r} (${describirFila(f, planilla.glosario)}) → ${despues[f.id]?.detail}`).join(" | ")}` };
      else if (ahoraOk <= antesOk) veredicto = { ok: false, por: `aplicó ${ap.aplicados.join(", ")} pero sigue fallando: ${mias.filter((f) => despues[f.id]?.result !== "PASS").map((f) => despues[f.id]?.detail).join(" | ")}` };
      else veredicto = { ok: true, por: `${ahoraOk}/${mias.length} pruebas de ${target} pasan (antes ${antesOk}), sin romper nada` };
    }
    vuelta.aceptado = veredicto.ok; vuelta.motivo = veredicto.por;
    if (veredicto.ok) { app = ap.app; version++; vuelta.foto = basename(foto(version)); delete ultimo[target]; }
    else { intentos[target] = (intentos[target] || 0) + 1; ultimo[target] = veredicto.por.slice(0, 1200); if (intentos[target] >= maxIntentos) { pendientes.add(target); vuelta.queda_pendiente = true; } }
    log(`[CICLO]   ${target}: ${veredicto.ok ? "✓ quedó" : "✗ no quedó"} · ${veredicto.por.slice(0, 200)}${vuelta.queda_pendiente ? ` → ${target} pendiente` : ""}`);
    ev.vueltas.push(vuelta);
    guardar();
  }
  if (!ev.fin) ev.fin = `se cortó en ${maxVueltas} vueltas`;
  const fin = join(outDir, "final");
  mkdirSync(fin, { recursive: true });
  for (const [f, s] of Object.entries(app)) writeFileSync(join(fin, f), s);
  ev.final = "final/";
  guardar();
  log(`[CICLO] ${ev.fin} · curva de requisitos cumplidos: ${ev.curva.map((c) => c.cumplidos).join(" → ")}`);
  return { app, ev };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const appDir = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!appDir || !flag("--planilla") || !flag("--snapshot")) { console.log("uso: node build/run_ciclo.mjs <carpeta de la app> --planilla <planilla.json> --snapshot <snapshot.json> [--out dir] [--max-vueltas 40]"); process.exit(2); }
  const planilla = JSON.parse(readFileSync(flag("--planilla"), "utf8"));
  const snap = JSON.parse(readFileSync(flag("--snapshot"), "utf8"));
  const features = (snap.intentForge?.refined_prompt || snap.refined_prompt || snap).features;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = flag("--out") || join(here, "runs", `${stamp}_ciclo_${basename(resolve(appDir))}`);
  console.log(`[CICLO] ${CICLO_VERSION} · ${MODEL} · contexto ${CONTEXTO} · app ${resolve(appDir)} · ${planilla.filas.length} pruebas de ${new Set(planilla.filas.map((f) => f.r)).size} requisitos → ${outDir}`);
  await ciclo({ app: leerApp(appDir), planilla, features, outDir, maxVueltas: Number(flag("--max-vueltas")) || 40, log: console.log });
  console.log(`→ ${join(outDir, "ciclo.json")} · la app final en ${join(outDir, "final")}`);
}
