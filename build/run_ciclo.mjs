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
import { aplicar, aplicarBloques, findSuelto, leerBloques as leerBloquesLocal } from "../harness/cambios.mjs";
import { syntaxOf as syntaxOfLocal } from "../harness/js_tools.mjs";
import { describirFila } from "../profiles/web/validation/planilla_palabras.mjs";
import { REGLAS_VISUALES, REGLAS_MODERNAS } from "../profiles/web/validation/visual.mjs";

export const CICLO_VERSION = "ciclo v0.4";
// v0.4 (19/10, después del 16/16): VUELTA 0, el borrador. Si no hay app de partida, Gemma la escribe desde los pedidos
// de Miche y la consigna de la planilla (en palabras), UN ARCHIVO POR PEDIDO: index.html → styles.css (viendo el HTML)
// → script.js (viendo el HTML). Así cada pedido entra holgado en 12k y los tres archivos usan los mismos ids y clases.
// v0.3 (19/10, 2ª corrida real: 2 → 12 de 16 requisitos en 30 vueltas, 151 min; quedaron R3, R4, R5 y R16, que
// necesitan un campo nuevo, prioridad, en el formulario, el guardado, la tarjeta y el orden):
//   - AVANCE PARCIAL: antes un cambio quedaba solo si una prueba entera pasaba. Agregar un campo en 4 lugares no se
//     puede de una: ahora cuenta cada cosa que se ve bien (cada ✓ del juez), y queda si suma sin romper nada.
//   - DE A UN BLOQUE: Gemma suele devolver 3 o 4 cambios juntos; si juntos no sirven, se prueba cada uno solo (sin
//     modelo, solo el juez). En la vuelta 2 el arreglo bueno de index.html se perdió por venir junto con un openModal roto.
// v0.2 (19/10, 1ª corrida real con Gemma: R1 arreglado en la vuelta 2, 2 → 10 requisitos; después se cortó):
//   - Gemma pidió ver "saveBoard() script.js": el nombre con paréntesis y archivo no se encontraba, y arregló a ciegas;
//   - la respuesta llegó al tope (3.600 de 3.600: Gemma piensa ~1.700 tokens antes de escribir): ahora el tope es lo que
//     sobra del contexto (hasta 6.000);
//   - un "### FUNCION:" con un pedazo de código como nombre cortaba todo el ciclo: ahora es un BLOQUE suelto, y si una
//     vuelta falla por un error del harness, queda anotada y el ciclo sigue.
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

### BLOQUE: primera línea del código suelto, tal cual está (p. ej. document.getElementById('x').addEventListener('submit', function (e) {)
\`\`\`js
...el bloque ENTERO, corregido...
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

// 22/10: V1, V2… son reglas visuales (visual.mjs), no pedidos del usuario: van después de los R y lo pedido manda
const reglaVisual = (ctx, r) => { const v = (ctx.planilla.filas || []).find((f) => f.r === r)?.veo?.find((x) => x.visual || x.moderno); return v ? (v.visual ? { k: v.visual, ...REGLAS_VISUALES[v.visual] } : { k: v.moderno, ...REGLAS_MODERNAS[v.moderno], moderno: true }) : null; };
const reqTexto = (ctx, r) => { const v = /^[VM]/.test(r) && reglaVisual(ctx, r); return v ? `${v.moderno ? `Regla de diseño moderno ${r} (la pidió el usuario: "llevarlo a un diseño moderno, respetando mi paleta y mis elecciones")` : `Regla visual ${r} (NO la pidió el usuario: es para que la app se lea y se use bien`}; lo que pidió el usuario —colores, medidas, textos— manda y no se cambia${v.moderno ? "" : ")"}: "${v.dice}". Cómo: ${v.como}.` : `Requisito ${r} (lo pidió el usuario): "${ctx.features[Number(r.slice(1)) - 1] || "?"}"`; };
export const ordenReq = (r) => (r.startsWith("V") ? 10000 : r.startsWith("M") ? 20000 : 0) + Number(r.slice(1));
const consigna = (ctx, filas) => `Qué se prueba (cada línea es una prueba que tiene que pasar):\n${filas.map((f) => `- ${describirFila(f, ctx.planilla.glosario)}`).join("\n")}`;
// 22/10 (project26, R28 ×6): "borro en Completa → ✗ NO se ve" Gemma lo leía como "no se borra bien" y arreglaba
// deleteCard para que borre MEJOR. Cuando la prueba borra y espera que siga, se dice con todas las letras.
const aviso = (f) => { const h = f.hago || {}, v = (f.veo || []).find((x) => x.esta && x.esta === h.eliminar); return v ? `\n  (OJO: esta prueba aprieta borrar a propósito y espera que NO se borre${v.en ? `: en "${v.en}" borrar no tiene que funcionar` : ""}. Que se borre es el error.)` : ""; };
export const fallas = (filas, est) => `Lo que falló en la última prueba:\n${filas.filter((f) => est[f.id]?.result !== "PASS").map((f) => `- ${est[f.id]?.detail || "sin detalle"}${aviso(f)}`).join("\n")}`;

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
    // "saveBoard() script.js", "script.js:120", "openModal": el primer nombre
    const name = (String(v).trim().match(/^[\w$./-]+/) || [""])[0];
    if (!name) continue;
    const f = Object.keys(app).find((k) => k === name || k.endsWith("/" + name));
    if (f) { add(`archivo ${f} (entero)`, app[f], 2); continue; }
    const fn = /^[A-Za-z_$][\w$]*$/.test(name) ? codigoDe(app, name) : null; // solo nombres de función (no "document.getElementById")
    if (fn) { add(`función ${fn.name} (${fn.file}:${fn.start}-${fn.end})`, fn.text, 1); continue; }
    // código suelto pedido por su primera línea (como lo muestra el mapa)
    for (const [jf, js] of Object.entries(app)) if (jf.endsWith(".js")) { const x = findSuelto(js, String(v).replace(/^[\w./-]+\.js:\d+\s*/, "")); if (x) { add(`bloque suelto ${jf}:${x.start}-${x.end}`, x.text, 1); break; } }
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

/** Cuánto anda una prueba: PASS vale todo; si no, cuántas cosas se vieron bien (✓ en el detalle del juez). */
export function puntaje(r) {
  if (!r) return 0;
  return r.result === "PASS" ? 1000 : (String(r.detail || "").match(/✓/g) || []).length;
}

// ---------- vuelta 0: el borrador ----------
const SYS_BORRADOR = (archivo, otros) => `Sos el programador de una app web: HTML + CSS + JavaScript, sin frameworks ni librerías, que se abre con doble clic (sin servidor). La app tiene tres archivos: index.html, styles.css y script.js${otros ? " (index.html ya está escrito: usá exactamente sus ids y clases)" : ""}.
Ahora escribí SOLO ${archivo}, completo, cumpliendo TODO lo que pide el usuario y lo que se va a probar.${archivo === "index.html" ? '\nindex.html lleva solo la estructura: enlazá styles.css (<link rel="stylesheet" href="styles.css">) y script.js (<script src="script.js"></script> al final del body), sin <style> ni <script> adentro.' : ""}
Respondé con un único bloque:

### ARCHIVO: ${archivo}
\`\`\`${archivo.split(".").pop() === "js" ? "js" : archivo.split(".").pop()}
...el archivo entero...
\`\`\`
Sin explicaciones.`;
// ---------- un solo archivo → tres ----------
// 21/10 (project26): el borrador de index.html trajo TODO adentro (<style> y <script>) y no enlazaba styles.css ni
// script.js. Gemma escribió esos dos aparte (script.js se cortó y quedó vacío), el ciclo le mostraba el script.js vacío
// (index.html no entraba en el pedido) y en 40 vueltas cada arreglo iba a un archivo que la app no carga: 13/23 → 13/23.
// Ahora lo que está adentro de index.html se pasa a su archivo y se enlaza, sin modelo. Lo que la app ya hacía no cambia.
/** Saca la sangría que quedó de cuando el código estaba adentro de index.html (la 1ª línea sin sangría y el resto con 8
 * espacios). Con sangría, ningún "### BLOQUE:" de Gemma se encontraba (22/10, R10: ".card-container {" no estaba "tal cual"). */
export function desindentar(t) {
  const lines = String(t).split("\n");
  const ind = lines.slice(1).filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length);
  const k = ind.length ? Math.min(...ind) : 0;
  return k > 0 ? [lines[0], ...lines.slice(1).map((l) => l.slice(Math.min(k, l.match(/^[ \t]*/)[0].length)))].join("\n") : String(t);
}
/** app → { app, cambios[] }. Función pura. */
export function separarArchivos(app0) {
  const app = { ...app0 }, cambios = [];
  for (const f of ["styles.css", "script.js"]) if (app[f] && desindentar(app[f]) !== app[f]) { app[f] = desindentar(app[f]); cambios.push(`${f}: saqué la sangría que le quedó de index.html`); }
  let html = String(app["index.html"] || "");
  if (!html) return { app, cambios };
  const enlaza = (f) => new RegExp(`(href|src)\\s*=\\s*["']\\.?/?${f.replace(".", "\\.")}["']`, "i").test(html);
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
  const css = styles.map((m) => desindentar(m[1].trim())).filter(Boolean).join("\n\n");
  const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => !/type\s*=\s*["'](?!text\/javascript|module)[^"']+["']/i.test(m[0]));
  const js = scripts.map((m) => desindentar(m[1].trim())).filter(Boolean).join("\n\n");
  if (css) {
    for (const m of styles) html = html.replace(m[0], "");
    if (enlaza("styles.css")) { app["styles.css"] = `${String(app["styles.css"] || "").trimEnd()}\n\n/* (estaba adentro de index.html) */\n${css}\n`; cambios.push("el <style> de index.html pasó al final de styles.css"); }
    else { if (String(app["styles.css"] || "").trim()) cambios.push("styles.css no estaba enlazado (no se usaba): lo reemplaza el <style> de index.html"); app["styles.css"] = `${css}\n`; cambios.push("el <style> de index.html pasó a styles.css"); }
  }
  if (!enlaza("styles.css") && String(app["styles.css"] || "").trim()) { html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `    <link rel="stylesheet" href="styles.css">\n</head>`) : `<link rel="stylesheet" href="styles.css">\n${html}`; cambios.push("index.html ahora enlaza styles.css"); }
  if (js) {
    if (syntaxOfLocal(js)) return { app: app0, cambios: [] }; // si no compila suelto, mejor no tocar nada
    for (const m of scripts) html = html.replace(m[0], "");
    if (enlaza("script.js")) { app["script.js"] = `${String(app["script.js"] || "").trimEnd()}\n\n// (estaba adentro de index.html)\n${js}\n`; cambios.push("el <script> de index.html pasó al final de script.js"); }
    else { if (String(app["script.js"] || "").trim()) cambios.push("script.js no estaba enlazado (no se usaba): lo reemplaza el <script> de index.html"); app["script.js"] = `${js}\n`; cambios.push("el <script> de index.html pasó a script.js"); }
  }
  if (!enlaza("script.js") && String(app["script.js"] || "").trim()) { html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `    <script src="script.js"></script>\n</body>`) : `${html}\n<script src="script.js"></script>\n`; cambios.push("index.html ahora carga script.js"); }
  app["index.html"] = html.replace(/\n\s*\n\s*\n+/g, "\n\n");
  return { app, cambios };
}

/** La app desde cero: 3 pedidos, uno por archivo. Devuelve { app, pedidos[] }. */
export async function borrador({ features, planilla, call = llamarLM, contexto = CONTEXTO, log = () => {} }) {
  const ctx = { planilla, features };
  const pedido = `Lo que pide el usuario:\n${features.map((f, i) => `R${i + 1}. ${f}`).join("\n")}\n\n${consigna(ctx, planilla.filas || [])}`;
  const app = {}, pedidos = [];
  for (const archivo of ["index.html", "styles.css", "script.js"]) {
    if (archivo !== "index.html") { const sep = separarArchivos(app); if (sep.cambios.length) { Object.assign(app, sep.app); sep.cambios.forEach((c) => log(`[CICLO] borrador: ${c}`)); } }
    if (archivo !== "index.html" && String(app[archivo] || "").trim().length >= 50) { log(`[CICLO] borrador: ${archivo} ya salió de index.html (no se le pide a Gemma)`); continue; }
    const sys = SYS_BORRADOR(archivo, archivo !== "index.html");
    const user = `${pedido}${app["index.html"] ? `\n\nindex.html (ya escrito):\n${app["index.html"]}` : ""}`;
    let codigo = null, por = "";
    for (let intento = 1; intento <= 2 && codigo == null; intento++) {
      const max = Math.max(2500, Math.min(8000, contexto - estTokens(sys + user) - 300));
      const r = await call([{ role: "system", content: sys }, { role: "user", content: user + (por ? `\n\nEl intento anterior no sirvió: ${por}` : "") }], max, `borrador ${archivo}`);
      const b = leerBloquesLocal(r.content).find((x) => x.nombre === archivo) || leerBloquesLocal(r.content)[0];
      pedidos.push({ archivo, intento, ms: r.ms, usage: r.usage, tokens_pedido: estTokens(sys + user), max });
      if (!b || b.codigo.trim().length < 50) { por = "no vino el archivo en un bloque ### ARCHIVO:"; continue; }
      if (archivo.endsWith(".js")) { const e = syntaxOfLocal(b.codigo); if (e) { por = `script.js no compila: ${e}`; continue; } }
      codigo = b.codigo;
    }
    app[archivo] = codigo ?? (archivo === "index.html" ? "<!DOCTYPE html><html><head><link rel=\"stylesheet\" href=\"styles.css\"></head><body><script src=\"script.js\"></script></body></html>" : "");
    log(`[CICLO] borrador: ${archivo} ${codigo != null ? `(${estTokens(codigo)} tokens)` : "NO salió: queda vacío y lo arregla el ciclo"}`);
  }
  return { app, pedidos };
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
  const reqs = [...new Set(filas.map((f) => f.r))].sort((a, b) => ordenReq(a) - ordenReq(b));
  const filasDe = (r) => filas.filter((f) => f.r === r);
  let app = o.app ? { ...o.app } : null;
  let hechoBorrador = null;
  if (!app) { log(`[CICLO] vuelta 0: no hay app de partida → Gemma escribe el borrador (index.html, styles.css, script.js)`); hechoBorrador = await borrador({ features, planilla, call, contexto, log }); app = hechoBorrador.app; }
  { const sep = separarArchivos(app); if (sep.cambios.length) { app = sep.app; sep.cambios.forEach((c) => log(`[CICLO] ${c}`)); } }
  mkdirSync(outDir, { recursive: true });
  const foto = (n) => { const d = join(outDir, `v${String(n).padStart(3, "0")}`); mkdirSync(d, { recursive: true }); for (const [f, s] of Object.entries(app)) writeFileSync(join(d, f), s); return d; };
  foto(0);
  const ev = { type: "EVIDENCE", kind: "ciclo", version: CICLO_VERSION, modelo: MODEL, contexto, inicio: new Date().toISOString(), ...(hechoBorrador ? { borrador: hechoBorrador.pedidos } : { desde: "una app que ya existía" }), vueltas: [], curva: [] };
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
    // el código entra dejando lugar para pensar y responder (~4.500); la respuesta usa lo que sobre, hasta 6.000
    const presupuesto = contexto - 4500 - estTokens(SYS_ARREGLO) - estTokens(fijo) - 200;
    const codigo = armarCodigo(app, ver, lugaresDeError(mias.map((f) => est[f.id]?.detail)), Math.max(500, presupuesto));
    const userB = fijo + (codigo.texto || "(no hay código para mostrar: pedí funciones o archivos que existan)");
    const maxResp = Math.max(2500, Math.min(6000, contexto - estTokens(SYS_ARREGLO + userB) - 300));
    const b = await call([{ role: "system", content: SYS_ARREGLO }, { role: "user", content: userB }], maxResp, "arreglo");
    Object.assign(vuelta, { ver, codigo: codigo.piezas, codigo_fuera: codigo.fuera, tokens_pedido: { ver: estTokens(SYS_VER + userA), arreglo: estTokens(SYS_ARREGLO + userB) }, ms: { ver: a.ms, arreglo: b.ms }, usage: { ver: a.usage, arreglo: b.usage }, respuesta: b.content });
    let ap = { app, aplicados: [], problemas: [], bloques: [] }, veredicto;
    try { ap = aplicar(app, b.content); } catch (e) { ap.problemas = [`error del harness al aplicar: ${e.message}`]; vuelta.error_harness = e.stack?.slice(0, 600); }
    vuelta.aplicados = ap.aplicados; vuelta.problemas = ap.problemas;
    const antesPts = mias.reduce((a, f) => a + puntaje(est[f.id]), 0);
    const antesOk = mias.filter((f) => est[f.id]?.result === "PASS");
    // juzga un candidato: ¿rompe algo que andaba? ¿suma puntos en este requisito?
    const evaluar = async (cand, etiqueta, k) => {
      const despues = await juez(cand.app, [...mias, ...pasaban], `v${n}${k}`, join(outDir, "trabajo"));
      const rotas = [...pasaban, ...antesOk].filter((f) => despues[f.id]?.result !== "PASS");
      const pts = mias.reduce((a, f) => a + puntaje(despues[f.id]), 0);
      const ok = !rotas.length && pts > antesPts;
      const por = rotas.length ? `rompió lo que ya andaba: ${rotas.map((f) => `${f.r} (${describirFila(f, planilla.glosario)}) → ${despues[f.id]?.detail}`).join(" | ")}`
        : pts <= antesPts ? `aplicó ${etiqueta} pero no avanzó: ${mias.filter((f) => despues[f.id]?.result !== "PASS").map((f) => despues[f.id]?.detail).join(" | ")}`
        : `${mias.filter((f) => despues[f.id]?.result === "PASS").length}/${mias.length} pruebas de ${target} pasan y suma lo que se ve bien (${antesPts} → ${pts}), sin romper nada${etiqueta !== "todo" ? ` (quedó solo: ${etiqueta})` : ""}`;
      return { ok, por, pts, despues, cand, etiqueta };
    };
    if (!ap.aplicados.length) veredicto = { ok: false, por: `no se pudo aplicar nada: ${ap.problemas.join("; ")}` };
    else {
      let mejor = await evaluar(ap, "todo", "b");
      vuelta.pruebas = [{ que: "todo", ok: mejor.ok, pts: mejor.pts }];
      // si juntos no sirven, cada bloque solo (hasta 4): sin modelo, solo el juez
      if (!mejor.ok && ap.bloques.length > 1) {
        const primero = mejor;
        for (const [i, bl] of ap.bloques.slice(0, 4).entries()) {
          const uno = aplicarBloques(app, [bl]);
          if (!uno.aplicados.length) continue;
          const r = await evaluar(uno, uno.aplicados.join(", "), `c${i}`);
          vuelta.pruebas.push({ que: uno.aplicados.join(", "), ok: r.ok, pts: r.pts });
          if (r.ok && (!mejor.ok || r.pts > mejor.pts)) mejor = r;
        }
        if (!mejor.ok) mejor = primero;
      }
      vuelta.despues = Object.fromEntries(mias.map((f) => [f.id, mejor.despues[f.id]?.result]));
      veredicto = mejor;
      if (mejor.ok) ap = mejor.cand;
    }
    vuelta.aceptado = veredicto.ok; vuelta.motivo = veredicto.por;
    if (veredicto.ok) { app = ap.app; version++; vuelta.foto = basename(foto(version)); delete ultimo[target]; intentos[target] = 0; }
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
  if ((!appDir && !args.includes("--desde-cero")) || !flag("--planilla") || !flag("--snapshot")) { console.log("uso: node build/run_ciclo.mjs <carpeta de la app> --planilla <planilla.json> --snapshot <snapshot.json> [--out dir] [--max-vueltas 40]"); process.exit(2); }
  const planilla = JSON.parse(readFileSync(flag("--planilla"), "utf8"));
  const snap = JSON.parse(readFileSync(flag("--snapshot"), "utf8"));
  const features = (snap.intentForge?.refined_prompt || snap.refined_prompt || snap).features;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = flag("--out") || join(here, "runs", `${stamp}_ciclo_${appDir ? basename(resolve(appDir)) : "desde_cero"}`);
  console.log(`[CICLO] ${CICLO_VERSION} · ${MODEL} · contexto ${CONTEXTO} · app ${appDir ? resolve(appDir) : "desde cero (vuelta 0)"} · ${planilla.filas.length} pruebas de ${new Set(planilla.filas.map((f) => f.r)).size} requisitos → ${outDir}`);
  await ciclo({ app: appDir ? leerApp(appDir) : null, planilla, features, outDir, maxVueltas: Number(flag("--max-vueltas")) || 40, log: console.log });
  console.log(`→ ${join(outDir, "ciclo.json")} · la app final en ${join(outDir, "final")}`);
}
