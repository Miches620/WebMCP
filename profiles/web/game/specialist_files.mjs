// specialist_files.mjs — Specialist "por archivos" del profile web/game (v0.8, 06/10).
//
// Decisión de Miche (06/10, después de Boxworld b2–b7): "separar por componentes,
// como se programa prolijo: juego.html, styles.css y tantos .js como el juego
// precise… dejar de pedir html autocontenidos a modelos chicos".
// Evidencia: con TODO el juego en una respuesta de Gemma (~7k tokens) cada build trajo
// 1–2 bugs y los reintentos completos se cortaron por length (3 de 3 en b3–b6).
//
// Regla: UN archivo = UN paso de Gemma, con un CONTRATO fijo que pone el harness
// (nombres de funciones, forma del estado, ids del HTML). Cada paso ve el brief, el
// contrato y lo que ya existe (solo firmas/datos de ejemplo), y escribe un archivo chico.
//   1. js/niveles.js    datos (strings Sokoban)        → el harness valida cada nivel
//   2. js/reglas.js     lógica pura, sin DOM           → el harness la PRUEBA en Node con niveles propios
//   3. juego.html + styles.css  pantalla con ids fijos → el harness valida los ids
//   4. js/dibujo.js     dibujar(estado)                → el harness lo prueba en Chromium
//   5. js/controles.js  teclado, botones, arranque     → chequeos de juego en Chromium
// Si un paso falla: reparación de sintaxis por tramo y hasta 2 reintentos SOLO de ese archivo.
// Resultado: app/index.html (carga styles.css y los js con <link>/<script src>) + app/js/*.js.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { chatStream } from "../../../build/lm_stream.mjs";
import { estTokens } from "../../../build/tokens.mjs";
import { briefText } from "../landing/specialist_spa.mjs";
import { assignTasks, notesText, componentsFromPlan } from "../landing/components.mjs";
import { repairSyntax } from "../landing/specialist_components.mjs";
import { runChecks } from "../validation/check_catalog.mjs";
import { rulesBrief } from "../app/specialist_rules.mjs";

export const FILES_VERSION = "game_files v0.8";
const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "google/gemma-4-e4b";
const CONTEXT = Number(process.env.WEBMCP_CONTEXT) || 16000;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- contrato ----------
export const IDS = ["tablero", "nivel", "movimientos", "mensaje", "btn-reiniciar", "btn-siguiente"];
export const CONTRACT = `CONTRATO DEL JUEGO (lo define el harness; respetalo al pie de la letra):
- Archivos: juego.html (solo el contenido de la pantalla), styles.css, js/niveles.js, js/reglas.js, js/dibujo.js, js/controles.js. Se cargan en ese orden con <script src> comunes: NADA de import/export ni módulos. Cada archivo define SOLO lo suyo.
- js/niveles.js define: const NIVELES = [nivel1, nivel2, ...]; cada nivel es un array de strings (una fila por string, todas del mismo largo) en formato Sokoban: # pared, espacio piso, . objetivo, $ caja, * caja sobre objetivo, @ jugador, + jugador sobre objetivo.
- js/reglas.js define: const Reglas = { crearEstado(nivel), mover(estado, direccion), ganado(estado) }. Sin DOM (no usa document ni window).
    estado = { mapa: [strings con SOLO '#', ' ' y '.'], jugador: {fila, col}, cajas: [{fila, col}], objetivos: [{fila, col}], movimientos: 0 }
    direccion: "arriba" | "abajo" | "izquierda" | "derecha". mover DEVUELVE UN ESTADO NUEVO (no modifica el que recibe). Si el movimiento no se puede (pared, caja contra pared o contra otra caja), devuelve un estado igual con los mismos movimientos. Empujar: el jugador avanza un casillero y la caja otro en la misma dirección. ganado = TODOS los objetivos tienen una caja encima.
- juego.html tiene estos ids: #tablero (la grilla), #nivel (número de nivel), #movimientos (contador), #mensaje (vacío al empezar), #btn-reiniciar, #btn-siguiente. Sin <script> ni <style>.
- js/dibujo.js define: function dibujar(estado, numeroNivel). Vacía #tablero y crea UN div por casillero, hijos directos de #tablero, fila por fila, con clase "casillero" y además: "pared" o "piso"; "objetivo" si es objetivo; "caja" si hay caja; "jugador" si está el jugador. Pone #tablero.style.gridTemplateColumns con la cantidad de columnas. Escribe estado.movimientos en #movimientos y numeroNivel en #nivel.
- js/controles.js: let nivelActual = 0; let estado; function iniciarNivel(i) { crea el estado con Reglas.crearEstado(NIVELES[i]), vacía #mensaje y llama a dibujar }. Un solo listener keydown en document: flechas → preventDefault, estado = Reglas.mover(estado, dir), dibujar; si Reglas.ganado(estado) → #mensaje dice "¡Nivel completado!". #btn-reiniciar → iniciarNivel(nivelActual). #btn-siguiente → si hay otro nivel, iniciarNivel(nivelActual + 1). Al final del archivo: iniciarNivel(0).`;

export const FILE_PROMPT = `Sos el Specialist de MicheLab. Programás un juego web en VARIOS archivos chicos, como un programador prolijo. En cada paso escribís UN archivo (o dos, si se te piden) y nada más.

Respondé SOLO con el bloque o los bloques pedidos:
### FILE: <nombre>
\`\`\`<lenguaje>
...
\`\`\`

Reglas:
1. Respetá el CONTRATO: mismos nombres, misma forma del estado, mismos ids. Usá solo lo que el contrato dice que existe.
2. JavaScript clásico (sin import/export, sin módulos, sin fetch). Nada de recursos externos (CDN, fuentes web, imágenes por URL); para íconos, emoji.
3. Contenido en español. Código corto y claro: funciones chicas.
4. Si te devuelven PROBLEMAS, corregilos y devolvé el archivo completo.`;

// ---------- lectura de pistas del brief (números que el usuario escribió) ----------
export function gameHints(refined = {}) {
  const txt = [...(refined.features || []), ...(refined.restricciones || []), ...(refined.contexto || [])].join("\n");
  const lv = txt.match(/al menos\s+(\d+)\s+niveles|(\d+)\s+niveles/i);
  const sz = txt.match(/(\d+)\s*casilleros?\s*de\s*largo\s*x\s*(\d+)/i) || txt.match(/\b(\d+)\s*x\s*(\d+)\b/);
  return { minLevels: lv ? Number(lv[1] || lv[2]) : 1, cols: sz ? Number(sz[1]) : null, rows: sz ? Number(sz[2]) : null };
}

// ---------- 1. niveles ----------
/** Problemas de los niveles (texto para Gemma). [] = válidos. */
export function validateLevels(niveles, { minLevels = 1, rows = null, cols = null } = {}) {
  const out = [];
  if (!Array.isArray(niveles)) return ["NIVELES no es un array (tiene que ser const NIVELES = [ [...], [...] ])."];
  if (niveles.length < minLevels) out.push(`hay ${niveles.length} niveles y se piden al menos ${minLevels}.`);
  niveles.forEach((nv, i) => {
    const n = `nivel ${i + 1}`;
    if (!Array.isArray(nv) || !nv.every((f) => typeof f === "string")) { out.push(`${n}: no es un array de strings.`); return; }
    const lens = [...new Set(nv.map((f) => f.length))];
    if (lens.length > 1) out.push(`${n}: las filas tienen largos distintos (${nv.map((f) => f.length).join(", ")}); todas iguales.`);
    if (rows && nv.length !== rows) out.push(`${n}: tiene ${nv.length} filas y el mapa es de ${rows}.`);
    if (cols && lens.some((l) => l !== cols)) out.push(`${n}: las filas tienen que tener ${cols} caracteres.`);
    const all = nv.join("");
    const bad = [...new Set(all.replace(/[#.$*@+ ]/g, ""))];
    if (bad.length) out.push(`${n}: caracteres que no son del formato: ${bad.map((c) => JSON.stringify(c)).join(" ")} (piso = espacio).`);
    const players = (all.match(/[@+]/g) || []).length;
    if (players !== 1) out.push(`${n}: tiene ${players} jugadores (@ o +); tiene que haber exactamente 1.`);
    const boxes = (all.match(/[$*]/g) || []).length, goals = (all.match(/[.*+]/g) || []).length;
    if (boxes === 0) out.push(`${n}: no tiene cajas.`);
    if (boxes !== goals) out.push(`${n}: tiene ${boxes} cajas y ${goals} objetivos; tienen que ser la misma cantidad.`);
    if (boxes && !all.includes("$")) out.push(`${n}: todas las cajas empiezan sobre un objetivo (el nivel ya está ganado).`);
  });
  return out;
}

/** Corre los scripts (en orden) en un contexto aislado y devuelve NIVELES / Reglas. */
export function loadScripts(codes) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  const src = codes.join("\n;\n") + `\n;globalThis.__N = typeof NIVELES !== "undefined" ? NIVELES : undefined; globalThis.__R = typeof Reglas !== "undefined" ? Reglas : undefined;`;
  try { vm.runInContext(src, ctx, { timeout: 2000 }); } catch (e) { return { error: String(e.message || e) }; }
  return { NIVELES: ctx.__N, Reglas: ctx.__R };
}

// ---------- 2. reglas: pruebas con niveles del harness ----------
const P = (o) => (o && typeof o === "object" ? `{fila:${o.fila},col:${o.col}}` : String(o));
const same = (a, b) => !!a && !!b && a.fila === b.fila && a.col === b.col;
const sortP = (l) => [...(l || [])].map((x) => ({ fila: x?.fila, col: x?.col })).sort((a, b) => a.fila - b.fila || a.col - b.col);
const sameList = (a, b) => JSON.stringify(sortP(a)) === JSON.stringify(sortP(b));
const L = (rows) => JSON.stringify(rows);

export const RULE_TESTS = [
  { name: "crearEstado lee jugador, cajas y objetivos", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.crearEstado(lv);
    const ok = same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }]) && sameList(e?.objetivos, [{ fila: 1, col: 3 }]) && e?.movimientos === 0;
    return ok || `crearEstado(${L(lv)}) tendría que dar jugador {fila:1,col:1}, cajas [{fila:1,col:2}], objetivos [{fila:1,col:3}], movimientos 0; dio jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], objetivos [${(e?.objetivos || []).map(P)}], movimientos ${e?.movimientos}.`;
  } },
  { name: "recién creado no está ganado", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    return R.ganado(R.crearEstado(lv)) === false || `ganado(crearEstado(${L(lv)})) tendría que ser false (la caja no está en el objetivo).`;
  } },
  { name: "la pared bloquea", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "izquierda");
    return (same(e?.jugador, { fila: 1, col: 1 }) && e?.movimientos === 0) || `con ${L(lv)}, mover(estado, "izquierda") choca con la pared: el jugador sigue en {fila:1,col:1} y movimientos 0; quedó ${P(e?.jugador)} y movimientos ${e?.movimientos}.`;
  } },
  { name: "empujar una caja", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 2 }) && sameList(e?.cajas, [{ fila: 1, col: 3 }]) && e?.movimientos === 1) || `con ${L(lv)}, mover(estado, "derecha") empuja la caja: jugador {fila:1,col:2}, caja {fila:1,col:3}, movimientos 1; quedó jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], movimientos ${e?.movimientos}.`;
  } },
  { name: "caja en el objetivo = ganado", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    return R.ganado(R.mover(R.crearEstado(lv), "derecha")) === true || `con ${L(lv)}, después de mover "derecha" la única caja está en el único objetivo: ganado tiene que ser true.`;
  } },
  { name: "mover no modifica el estado que recibe", level: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.crearEstado(lv); R.mover(e, "derecha");
    return (same(e.jugador, { fila: 1, col: 1 }) && sameList(e.cajas, [{ fila: 1, col: 2 }])) || `mover tiene que devolver un estado NUEVO: después de mover(e, "derecha"), e.jugador sigue en {fila:1,col:1} y su caja en {fila:1,col:2}; quedó ${P(e.jugador)}.`;
  } },
  { name: "de a un casillero", level: ["######", "#@   #", "#    #", "######"], run(R, lv) {
    const d = R.mover(R.crearEstado(lv), "derecha"), b = R.mover(R.crearEstado(lv), "abajo");
    return (same(d?.jugador, { fila: 1, col: 2 }) && same(b?.jugador, { fila: 2, col: 1 })) || `con ${L(lv)}, "derecha" deja al jugador en {fila:1,col:2} y "abajo" en {fila:2,col:1} (un casillero por vez); quedó ${P(d?.jugador)} y ${P(b?.jugador)}.`;
  } },
  { name: "caja contra pared no se mueve", level: ["####", "#@$#", "####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }]) && e?.movimientos === 0) || `con ${L(lv)}, la caja tiene una pared detrás: "derecha" no mueve nada (jugador {fila:1,col:1}, caja {fila:1,col:2}, movimientos 0); quedó jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], movimientos ${e?.movimientos}.`;
  } },
  { name: "caja contra caja no se mueve", level: ["######", "#@$$.#", "######"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 1 }) && e?.movimientos === 0) || `con ${L(lv)}, la caja tiene otra caja detrás: "derecha" no mueve nada (jugador {fila:1,col:1}, movimientos 0); quedó ${P(e?.jugador)}, movimientos ${e?.movimientos}.`;
  } },
  { name: "lee '*' y '+'", level: ["######", "#+$ *#", "######"], run(R, lv) {
    const e = R.crearEstado(lv);
    return (same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }, { fila: 1, col: 4 }]) && sameList(e?.objetivos, [{ fila: 1, col: 1 }, { fila: 1, col: 4 }]) && (e?.mapa || [])[1] === "#.  .#")
      || `crearEstado(${L(lv)}): '+' es jugador sobre objetivo y '*' caja sobre objetivo → jugador {fila:1,col:1}, cajas [{fila:1,col:2},{fila:1,col:4}], objetivos [{fila:1,col:1},{fila:1,col:4}], mapa fila 1 "#.  .#"; dio jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], objetivos [${(e?.objetivos || []).map(P)}], mapa fila 1 ${JSON.stringify((e?.mapa || [])[1])}.`;
  } },
];

/** Corre las pruebas de reglas. @returns {{passed:string[], failed:{name,detail}[]}} */
export function runRuleTests(Reglas, niveles = []) {
  const passed = [], failed = [];
  if (!Reglas || ["crearEstado", "mover", "ganado"].some((f) => typeof Reglas[f] !== "function"))
    return { passed, failed: [{ name: "contrato", detail: "js/reglas.js tiene que definir const Reglas = { crearEstado, mover, ganado } (las tres funciones)." }] };
  for (const t of RULE_TESTS) {
    let r;
    try { r = t.run(Reglas, t.level); } catch (e) { r = `${t.name}: tiró un error: ${e.message}`; }
    if (r === true) passed.push(t.name); else failed.push({ name: t.name, detail: r });
  }
  (niveles || []).forEach((nv, i) => {
    try {
      const e = Reglas.crearEstado(nv);
      if (Reglas.ganado(e)) failed.push({ name: `nivel ${i + 1} no empieza ganado`, detail: `ganado(crearEstado(NIVELES[${i}])) da true recién creado.` });
      else passed.push(`nivel ${i + 1} no empieza ganado`);
    } catch (e) { failed.push({ name: `nivel ${i + 1} se puede crear`, detail: `crearEstado(NIVELES[${i}]) tiró: ${e.message}` }); }
  });
  return { passed, failed };
}

// ---------- 3. pantalla ----------
export function screenProblems(html) {
  const out = [];
  const miss = IDS.filter((id) => !new RegExp(`id\\s*=\\s*["']${id}["']`).test(html || ""));
  if (miss.length) out.push(`faltan estos ids en juego.html: ${miss.map((x) => "#" + x).join(", ")}.`);
  return out;
}
export function cleanFragment(html) {
  let h = String(html || "");
  const body = h.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body) h = body[1];
  return h.replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<link\b[^>]*>/gi, "").trim();
}
export const cleanCss = (css) => String(css || "").replace(/@import[^;]*;/gi, "").replace(/url\(\s*['"]?https?:[^)]*\)/gi, "none");

// ---------- ensamblado ----------
export const JS_FILES = ["js/niveles.js", "js/reglas.js", "js/dibujo.js", "js/controles.js"];
export function pageHtml({ title, fragment, features = [], scripts = JS_FILES, inline = "" }) {
  const df = features.length ? ` data-feature="${features.join(" ")}"` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
<main id="juego"${df}>
${fragment || `<h1>${esc(title)}</h1>`}
</main>
${scripts.map((s) => `<script src="${s}"></script>`).join("\n")}${inline ? `\n<script>\n${inline}\n</script>` : ""}
</body>
</html>
`;
}
function writeApp(dir, files, page) {
  mkdirSync(join(dir, "js"), { recursive: true });
  for (const [name, content] of Object.entries(files)) if (content != null) writeFileSync(join(dir, name), content, "utf8");
  writeFileSync(join(dir, "index.html"), page, "utf8");
}

// ---------- 4. dibujo: prueba en Chromium ----------
const PROBE = `window.__probe = (function () {
  try {
    var e = Reglas.crearEstado(NIVELES[0]); dibujar(e, 1);
    var t = document.getElementById("tablero");
    return { ok: true, cells: t.children.length, rows: e.mapa.length, cols: e.mapa[0].length,
      jugador: t.querySelectorAll(".jugador").length, cajas: t.querySelectorAll(".caja").length, nCajas: e.cajas.length,
      pared: t.querySelectorAll(".pared").length, movs: (document.getElementById("movimientos") || {}).textContent || "" };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
export async function probeDibujo(htmlPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const p = await page.evaluate(() => window.__probe || null);
    return { probe: p, errors: errs };
  } finally { await browser.close(); }
}
export function dibujoProblems({ probe: p, errors }) {
  if (!p) return [`la página no llegó a probar dibujar()${errors.length ? `: ${errors[0]}` : ""}.`];
  if (!p.ok) return [`dibujar(Reglas.crearEstado(NIVELES[0]), 1) tiró un error: ${p.error}.`];
  const out = [];
  if (p.cells !== p.rows * p.cols) out.push(`#tablero tiene ${p.cells} hijos y el nivel tiene ${p.rows}x${p.cols} = ${p.rows * p.cols} casilleros: un div por casillero, hijos directos de #tablero.`);
  if (p.jugador !== 1) out.push(`hay ${p.jugador} casilleros con clase "jugador"; tiene que haber 1.`);
  if (p.cajas !== p.nCajas) out.push(`hay ${p.cajas} casilleros con clase "caja" y el estado tiene ${p.nCajas} cajas.`);
  if (!p.pared) out.push(`ningún casillero tiene clase "pared".`);
  if (!/\d/.test(p.movs)) out.push(`#movimientos no muestra el número de movimientos.`);
  return out;
}

// ---------- 5. controles: chequeos de juego ----------
const PLAY = [
  { type: "no_js_errors", params: {} },
  { type: "board_changes", params: {} },
  { type: "not_won_immediately", params: {} },
  { type: "reset_restores", params: { click: ["reiniciar"] } },
  { type: "counter_on_action", params: { label: ["movimientos"] } },
];
export function playProblems(results) {
  return results.filter((r) => r.result === "FAIL").map((r) => `${r.type}: ${r.detail}`);
}

// ---------- respuesta ----------
export function extractFile(raw, name) {
  const r = String(raw || "");
  const re = new RegExp("###\\s*(?:FILE|APPEND):\\s*([\\w./\\-]+)[^\\n]*\\n+```[\\w-]*\\n([\\s\\S]*?)```", "g");
  const ext = name.split(".").pop();
  let m, byExt = null;
  while ((m = re.exec(r))) {
    if (m[1] === name || m[1].endsWith("/" + name.split("/").pop())) return m[2];
    if (!byExt && m[1].endsWith("." + ext)) byExt = m[2];
  }
  if (byExt) return byExt;
  const lang = ext === "js" ? "(?:javascript|js)" : ext;
  const f = r.match(new RegExp("```" + lang + "\\n([\\s\\S]*?)```"));
  return f ? f[1] : null;
}

// ---------- build ----------
/**
 * @param {{refined, tasks}} input
 * @param {string} outDir   la app queda en outDir/app/
 * @param {{log?, model?, pagePlan?, check?:boolean, forbidden?:string[]}} opts
 */
export async function buildGameFiles({ refined, tasks }, outDir, opts = {}) {
  const log = opts.log || console.log;
  const model = opts.model || MODEL;
  const hints = gameHints(refined);
  const comps = componentsFromPlan(opts.pagePlan, refined.features || []);
  const main = comps[0];
  const features = main ? main.features.map((f) => f.id) : [];
  const notes = notesText((assignTasks(comps, tasks).byComp[main?.id] || []), { maxDescribed: 0 });
  const brief = briefText(refined) + "\n\n" + rulesBrief(refined);
  const title = refined.project_name || "Juego";
  const appDir = join(outDir, "app");
  mkdirSync(appDir, { recursive: true });
  const files = { "styles.css": "", "js/niveles.js": "", "js/reglas.js": "", "js/dibujo.js": "", "js/controles.js": "" };
  let fragment = "";
  const steps = [];

  const ask = async (system, user, cap) => {
    const leak = (opts.forbidden || []).find((f) => f && user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`criterio holdout filtrado al Specialist: "${leak}"`);
    const promptTokens = estTokens(system) + estTokens(user);
    const maxTokens = Math.max(1500, Math.min(cap, CONTEXT - promptTokens - 200));
    const t0 = Date.now();
    const data = await chatStream(LM_STUDIO_URL, { model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: maxTokens });
    return { raw: data.content || "", ms: Date.now() - t0, finish_reason: data.finish_reason ?? null, usage: data.usage ?? null, promptTokens, maxTokens };
  };
  const fence = (lang, s) => "```" + lang + "\n" + (String(s || "").trim() || "(vacío)") + "\n```";
  const head = (extra = "") => `BRIEF:\n${brief}\n\n${CONTRACT}\n\n${extra}`;

  /**
   * Un paso: hasta 3 intentos del MISMO archivo. `make(prev, problems)` arma el pedido;
   * `take(raw)` extrae el contenido; `judge(content)` devuelve problemas ([] = listo).
   */
  const step = async ({ id, files: names, cap, make, take, judge }) => {
    const rec = { n: steps.length + 1, task_id: id, files: names, attempts: [] };
    log(`[SPECIALIST] ${rec.n}/5 ${names.join(" + ")}`);
    let best = null, prev = null, problems = [];
    for (let k = 0; k < 3; k++) {
      const user = make(prev, problems);
      const r = await ask(FILE_PROMPT, user, cap);
      writeFileSync(join(outDir, `step_${String(rec.n).padStart(2, "0")}_${id}${k ? ".retry" + k : ""}.raw.txt`), r.raw, "utf8");
      let raw = r.raw;
      const att = { ms: r.ms, finish_reason: r.finish_reason, prompt_tokens_est: r.promptTokens, max_tokens: r.maxTokens };
      // archivo js con error de sintaxis → reparación por tramo (mismo mecanismo que v0.7.5)
      const jsName = names.find((n) => n.endsWith(".js"));
      if (jsName) {
        const js = take(raw)[jsName];
        if (js) {
          const wrapped = `### FILE: componente.js\n\`\`\`javascript\n${js}\n\`\`\``;
          let err = null; try { new vm.Script(js); } catch (e) { err = e.message; }
          if (err) {
            const fx = await repairSyntax(wrapped, { id: "juego" }, ask, { write: (n, txt) => writeFileSync(join(outDir, `step_${String(rec.n).padStart(2, "0")}_${id}.fix${n}.raw.txt`), txt, "utf8") });
            att.syntax_repair = fx.rounds;
            if (fx.raw) { const fixed = extractFile(fx.raw, "componente.js"); raw = raw.replace(js, () => fixed); log(`[SPECIALIST]   reparación de sintaxis: ${fx.rounds.map((x) => `L${x.line} ${x.ok ? "✓" : "✗"}`).join(", ")} → compila`); }
          }
        }
      }
      const content = take(raw);
      problems = await judge(content);
      att.problems = problems;
      rec.attempts.push(att);
      if (!best || problems.length < best.problems.length) best = { content, problems };
      prev = content;
      log(`[SPECIALIST]   ${problems.length ? `✗ ${problems.length} problema(s): ${problems.slice(0, 3).join(" | ").slice(0, 300)}` : "✓"}${k ? ` (reintento ${k})` : ""} · ${Math.round(r.ms / 1000)}s`);
      if (!problems.length) break;
    }
    rec.problems_final = best.problems;
    steps.push(rec);
    return { content: best.content, rec };
  };
  const retryBlock = (prev, problems, names) => problems.length
    ? `PROBLEMAS DE TU VERSIÓN ANTERIOR (los encontró el harness):\n${problems.map((p) => "- " + p).join("\n")}\n\nTU VERSIÓN ANTERIOR:\n${names.map((n) => `### FILE: ${n}\n${fence(n.endsWith(".css") ? "css" : n.endsWith(".html") ? "html" : "javascript", prev?.[n])}`).join("\n\n")}\n\nDevolvé ${names.join(" y ")} corregido(s), completo(s).`
    : "";
  const takeJs = (name) => (raw) => ({ [name]: extractFile(raw, name) });
  const syntaxOf = (code) => { try { new vm.Script(code || ""); return null; } catch (e) { return e.message; } };

  log(`[SPECIALIST] ${FILES_VERSION}: 5 pasos chicos (un archivo por paso) · pistas del brief: ${hints.minLevels} niveles${hints.rows ? `, mapa ${hints.cols}x${hints.rows}` : ""}`);

  // 1. niveles
  const s1 = await step({
    id: "niveles", files: ["js/niveles.js"], cap: 4000,
    make: (prev, pr) => head(`PASO 1 de 5: escribí js/niveles.js con ${Math.max(hints.minLevels, 1)} niveles o más${hints.rows ? ` de ${hints.rows} filas x ${hints.cols} columnas` : ""}. Que sean resolubles y de dificultad creciente; en cada uno, tantas cajas como objetivos y al menos una caja fuera de los objetivos.\n\n`) + retryBlock(prev, pr, ["js/niveles.js"]),
    take: takeJs("js/niveles.js"),
    judge: async (c) => {
      const code = c["js/niveles.js"];
      if (!code) return ["la respuesta no trajo ### FILE: js/niveles.js."];
      const se = syntaxOf(code); if (se) return [`error de sintaxis: ${se}`];
      const L2 = loadScripts([code]);
      if (L2.error) return [`al ejecutarlo: ${L2.error}`];
      return validateLevels(L2.NIVELES, hints);
    },
  });
  files["js/niveles.js"] = s1.content["js/niveles.js"] || "";
  const N = loadScripts([files["js/niveles.js"]]).NIVELES || [];

  // 2. reglas
  const s2 = await step({
    id: "reglas", files: ["js/reglas.js"], cap: 5000,
    make: (prev, pr) => head(`NOTAS DEL TECHLEADER (contexto):\n${notes}\n\nYA EXISTE js/niveles.js con ${N.length} niveles. Ejemplo, NIVELES[0]:\n${JSON.stringify(N[0] || [], null, 1)}\n\nPASO 2 de 5: escribí js/reglas.js (const Reglas = { crearEstado, mover, ganado }). Sin DOM. El harness lo va a probar con niveles chicos propios.\n\n`) + retryBlock(prev, pr, ["js/reglas.js"]),
    take: takeJs("js/reglas.js"),
    judge: async (c) => {
      const code = c["js/reglas.js"];
      if (!code) return ["la respuesta no trajo ### FILE: js/reglas.js."];
      const se = syntaxOf(code); if (se) return [`error de sintaxis: ${se}`];
      if (/\b(document|window)\./.test(code)) return ["js/reglas.js no puede usar document ni window (es lógica pura)."];
      const L2 = loadScripts([files["js/niveles.js"], code]);
      if (L2.error) return [`al ejecutarlo: ${L2.error}`];
      return runRuleTests(L2.Reglas, L2.NIVELES).failed.map((f) => f.detail);
    },
  });
  files["js/reglas.js"] = s2.content["js/reglas.js"] || "";
  {
    const L2 = loadScripts([files["js/niveles.js"], files["js/reglas.js"]]);
    s2.rec.tests = runRuleTests(L2.Reglas, L2.NIVELES);
    log(`[SPECIALIST]   pruebas de reglas (harness, sin navegador): ${s2.rec.tests.passed.length}/${s2.rec.tests.passed.length + s2.rec.tests.failed.length}${s2.rec.tests.failed.length ? ` · fallan: ${s2.rec.tests.failed.map((f) => f.name).join(", ")}` : ""}`);
  }

  // 3. pantalla
  const s3 = await step({
    id: "pantalla", files: ["juego.html", "styles.css"], cap: 4500,
    make: (prev, pr) => head(`PASO 3 de 5: escribí juego.html (SOLO el contenido de la pantalla: título, HUD con #nivel y #movimientos, #tablero, #mensaje y los botones #btn-reiniciar y #btn-siguiente; sin <html>, <head>, <script> ni <style>) y styles.css (todo el estilo de la página; #tablero es una grilla CSS de casilleros cuadrados; clases .casillero .pared .piso .objetivo .caja .jugador). Respetá los CRITERIOS DE ESTILO del brief.\n\n`) + retryBlock(prev, pr, ["juego.html", "styles.css"]),
    take: (raw) => ({ "juego.html": extractFile(raw, "juego.html"), "styles.css": extractFile(raw, "styles.css") }),
    judge: async (c) => {
      const out = [];
      if (!c["juego.html"]) out.push("la respuesta no trajo ### FILE: juego.html.");
      else out.push(...screenProblems(c["juego.html"]));
      if (!c["styles.css"]) out.push("la respuesta no trajo ### FILE: styles.css.");
      return out;
    },
  });
  fragment = cleanFragment(s3.content["juego.html"]);
  files["styles.css"] = cleanCss(s3.content["styles.css"]);

  // 4. dibujo
  const probeDir = join(outDir, "probe_dibujo");
  const s4 = await step({
    id: "dibujo", files: ["js/dibujo.js"], cap: 4000,
    make: (prev, pr) => head(`YA EXISTEN: NIVELES, Reglas (crearEstado/mover/ganado) y juego.html:\n${fence("html", fragment.slice(0, 2500))}\n\nPASO 4 de 5: escribí js/dibujo.js (function dibujar(estado, numeroNivel)).\n\n`) + retryBlock(prev, pr, ["js/dibujo.js"]),
    take: takeJs("js/dibujo.js"),
    judge: async (c) => {
      const code = c["js/dibujo.js"];
      if (!code) return ["la respuesta no trajo ### FILE: js/dibujo.js."];
      const se = syntaxOf(code); if (se) return [`error de sintaxis: ${se}`];
      if (opts.check === false) return [];
      writeApp(probeDir, { ...files, "js/dibujo.js": code }, pageHtml({ title, fragment, features, scripts: JS_FILES.slice(0, 3), inline: PROBE }));
      return dibujoProblems(await probeDibujo(join(probeDir, "index.html")));
    },
  });
  files["js/dibujo.js"] = s4.content["js/dibujo.js"] || "";

  // 5. controles
  const playDir = join(outDir, "probe_juego");
  const s5 = await step({
    id: "controles", files: ["js/controles.js"], cap: 4000,
    make: (prev, pr) => head(`NOTAS DEL TECHLEADER (contexto):\n${notes}\n\nYA EXISTEN: NIVELES (${N.length} niveles), Reglas, dibujar(estado, numeroNivel) y juego.html:\n${fence("html", fragment.slice(0, 2500))}\n\nPASO 5 de 5: escribí js/controles.js (estado del juego, teclado, botones y arranque).\n\n`) + retryBlock(prev, pr, ["js/controles.js"]),
    take: takeJs("js/controles.js"),
    judge: async (c) => {
      const code = c["js/controles.js"];
      if (!code) return ["la respuesta no trajo ### FILE: js/controles.js."];
      const se = syntaxOf(code); if (se) return [`error de sintaxis: ${se}`];
      if (opts.check === false) return [];
      writeApp(playDir, { ...files, "js/controles.js": code }, pageHtml({ title, fragment, features }));
      return playProblems(await runChecks(join(playDir, "index.html"), PLAY));
    },
  });
  files["js/controles.js"] = s5.content["js/controles.js"] || "";

  writeApp(appDir, files, pageHtml({ title, fragment, features }));
  log(`[SPECIALIST] app/: index.html, styles.css, ${JS_FILES.join(", ")}${steps.some((s) => s.problems_final.length) ? ` · quedan problemas en: ${steps.filter((s) => s.problems_final.length).map((s) => s.task_id).join(", ")}` : " · todos los pasos OK"}`);
  return {
    model, specialist_version: FILES_VERSION, files: ["index.html", "styles.css", ...JS_FILES],
    hints, rule_tests: s2.rec.tests, order: steps.map((s) => s.task_id),
    steps: steps.map((s) => ({ ...s, ms: s.attempts.reduce((a, b) => a + b.ms, 0), finish_reason: s.attempts.at(-1)?.finish_reason, changed: s.files, rejected: s.problems_final })),
  };
}

/** Esqueleto de control para Validation: la misma página sin JS ni contenido. */
export function baselinePage(refined, plan) {
  const comps = componentsFromPlan(plan, refined.features || []);
  return pageHtml({ title: refined.project_name || "Juego", fragment: "", features: comps[0] ? comps[0].features.map((f) => f.id) : [], scripts: [] });
}
