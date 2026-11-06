// test_ciclo.mjs — el ciclo con un modelo de mentira, sobre la app REAL que Gemma hizo sola (la rota) y la vara del Kanban.
//   node build/test_ciclo.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { ciclo, armarCodigo, lugaresDeError, puntaje, CICLO_VERSION } from "./run_ciclo.mjs";
import { leerApp, mapaTexto, llamadas, funcionEnLinea, MAPA_VERSION } from "../harness/mapa.mjs";
import { leerBloques, aplicar, CAMBIOS_VERSION } from "../harness/cambios.mjs";
import { describirFila } from "../profiles/web/validation/planilla_palabras.mjs";
import { conAzar } from "../profiles/web/validation/planilla.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "../profiles/web/validation/fixtures");
const ROTA = leerApp(join(FIX, "flow_gemma_sola_rota")), ARREGLADA = leerApp(join(FIX, "flow_gemma_sola_arreglada"));
const P = JSON.parse(readFileSync(join(FIX, "planilla_kanban_c22.json"), "utf8"));
const FEATS = JSON.parse(readFileSync(join(FIX, "real_kanban_c22/snapshot_min.json"), "utf8")).intentForge.refined_prompt.features;

t("versiones", CICLO_VERSION === "ciclo v0.7" && MAPA_VERSION === "mapa v0.2" && CAMBIOS_VERSION === "cambios v0.6");

// ---------- el mapa ----------
const mapa = mapaTexto(ROTA);
t("el mapa de la app de Gemma muestra el bug: openModal(cardId, currentStatus) la llama index.html:30", /openModal\(cardId, currentStatus\) script\.js:122 · index\.html:30/.test(mapa), mapa);
t("y muestra que updateAllCounters no la llama nadie (otro bug)", /updateAllCounters\(\) script\.js:\d+ · NADIE la llama/.test(mapa));
t("el mapa es chico: menos de 600 tokens para una app de ~5.900", mapa.length / 3.2 < 600, String(Math.round(mapa.length / 3.2)));
t("la función donde saltó el error (script.js:133) es openModal, y quién la llama", funcionEnLinea(ROTA, "script.js", 133)?.name === "openModal" && llamadas(ROTA, "openModal").some((x) => x.file === "index.html" && x.line === 30));

// ---------- aplicar cambios ----------
const nueva = `### FUNCION: closeModal\n\`\`\`js\nfunction closeModal() {\n  document.getElementById('card-modal').classList.add('hidden');\n}\n\`\`\`\n### FUNCION: ayuda en script.js\n\`\`\`js\nfunction ayuda() { return 1; }\n\`\`\``;
const ap = aplicar(ROTA, nueva);
t("una función se reemplaza entera; una nueva se agrega; lo demás queda igual", ap.aplicados.length === 2 && /classList\.add\('hidden'\);\n\}/.test(ap.app["script.js"]) && /function ayuda\(\)/.test(ap.app["script.js"]) && ap.app["index.html"] === ROTA["index.html"], ap.problemas.join());
t("lo que no compila no se aplica (y se dice por qué)", aplicar(ROTA, "### FUNCION: closeModal\n```js\nfunction closeModal() { if ( }\n```").problemas.some((x) => /no compila/.test(x)));
t("un archivo que vuelve recortado a menos de la mitad no se aplica (pidió el archivo ENTERO)", aplicar(ROTA, "### ARCHIVO: styles.css\n```css\n.card { padding: 8px; }\n```").problemas.some((x) => /ENTERO/.test(x)));
t("sin bloques → nada aplicado, dicho", aplicar(ROTA, "no sé").problemas.length === 1 && leerBloques("### FILE: index.html\n```html\n<p>\n```")[0].tipo === "archivo");

// ---------- el pedido ----------
const err = lugaresDeError(['agregar "QA Zorzal 1": no aparece · error de JS: Cannot read properties of undefined (reading \'find\') (script.js:133)']);
const cod = armarCodigo(ROTA, ["index.html"], err, 4000);
t("el código del pedido: la función del error, quién la llama (index.html:30) y el archivo pedido", err[0].line === 133 && cod.piezas[0].startsWith("función openModal") && cod.piezas[1] === "quién llama a openModal" && cod.piezas.includes("archivo index.html (entero)") && /index\.html:30/.test(cod.texto));
const corto = armarCodigo(ROTA, ["styles.css", "index.html"], err, 900);
t("con poco presupuesto entra lo más importante (el error) y lo demás queda afuera, dicho", corto.piezas[0].startsWith("función openModal") && corto.fuera.length >= 1 && corto.tokens <= 900);
const az = conAzar(P.filas.find((f) => f.id === "R5.1"), "v1");
t("textos al azar: ningún 'QA Alfa' / 'QA Beta' / 'QA detalle' queda igual; lo que no es de prueba no cambia", !/QA Alfa|QA Beta|QA detalle/.test(JSON.stringify(az)) && /"baja"/.test(JSON.stringify(az)) && conAzar(P.filas[0], "v1").veo[0].en === "Pendiente");
t("Gemma ve QUÉ se prueba, en palabras y sin los textos de prueba", P.filas.every((f) => !/QA /.test(describirFila(f, P.glosario))) && /Creo una tarjeta con un título cualquiera y prioridad "alta"\. → la tarjeta muestra "alta" · la tarjeta se pinta de rojo/.test(describirFila(P.filas.find((f) => f.id === "R3.1"), P.glosario)));

// ---------- v0.2: lo que pasó en la 1ª corrida real con Gemma (19/10) ----------
const SUB = ARREGLADA["script.js"].split("\n").find((l) => /addEventListener\('submit'/.test(l)).trim();
t("el mapa muestra el código suelto (fuera de funciones) con su primera línea", new RegExp(`Código suelto de script\\.js[\\s\\S]*script\\.js:\\d+ ${SUB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(mapaTexto(ARREGLADA)));
let crash = null, r4;
try { r4 = aplicar(ARREGLADA, `### FUNCION: ${SUB}\n\`\`\`js\n${SUB}\n  e.preventDefault(); /*nuevo*/\n});\n\`\`\``); } catch (e) { crash = e.message; }
t("vuelta 4 real: un '### FUNCION:' con un pedazo de código como nombre ya no corta el ciclo: se cambia como bloque suelto", !crash && r4.aplicados[0]?.startsWith("bloque suelto script.js") && /\/\*nuevo\*\//.test(r4.app["script.js"]) && !/handleSubmit|guardarCard/.test(""), crash || JSON.stringify(r4?.problemas));
t("y si el bloque no existe, se dice cómo pedirlo (no se rompe)", aplicar(ARREGLADA, "### BLOQUE: window.onload = function () {\n```js\nx\n```").problemas.some((x) => /primera línea tiene que estar tal cual/.test(x)));
const pide = armarCodigo(ARREGLADA, ["saveBoard() script.js", "createCardElement(card) script.js", SUB], [], 6000);
t("vuelta 3 real: 'saveBoard() script.js' y 'createCardElement(card) script.js' se encuentran (antes no, y Gemma arregló a ciegas); y un bloque suelto por su primera línea", pide.piezas.some((p) => p.startsWith("función saveBoard")) && pide.piezas.some((p) => p.startsWith("función createCardElement")) && pide.piezas.some((p) => p.startsWith("bloque suelto script.js")), JSON.stringify(pide.piezas));

// ---------- el ciclo, con el juez de verdad (Chromium) y un modelo de mentira ----------
const pedidos = [];
let k = 0;
const guion = [
  // vuelta 1 (R1: crear falla por el error de index.html:30): pide ver openModal e index.html; devuelve el index.html arreglado
  { ver: '{"ver": ["openModal", "index.html"]}', arreglo: `### ARCHIVO: index.html\n\`\`\`html\n${ARREGLADA["index.html"]}\n\`\`\`` },
  // vuelta 2 (R3): un "arreglo" que saca el botón de agregar → rompe R1/R2, que ya andaban → se vuelve atrás
  { ver: '{"ver": ["index.html"]}', arreglo: `### ARCHIVO: index.html\n\`\`\`html\n${ARREGLADA["index.html"].replace(/<button class="add-card-btn"[^\n]*<\/button>/, "")}\n\`\`\`` },
  // vuelta 3 (R3 otra vez): no devuelve nada aplicable
  { ver: "no sé", arreglo: "No puedo." },
];
const call = async (messages, max, tipo) => { pedidos.push({ tipo, user: messages[1].content, max }); const g = guion[Math.min(Math.floor(k / 2), guion.length - 1)]; k++; return { content: g[tipo], ms: 1 }; };
const out = mkdtempSync(join(tmpdir(), "ciclo-"));
const { ev, app } = await ciclo({ app: ROTA, planilla: P, features: FEATS, outDir: out, call, maxVueltas: 3, log: () => {} });
const [v1, v2, v3] = ev.vueltas;
t("vuelta 1: va a R1 (el primero que falla) y el pedido trae el mapa, qué se prueba y el error con archivo:línea", v1.requisito === "R1" && /Mapa de la app/.test(pedidos[0].user) && /Qué se prueba/.test(pedidos[0].user) && /script\.js:133/.test(pedidos[0].user), pedidos[0].user.slice(0, 300));
t("el pedido B trae la función del error y quién la llama, y entra en 12k", v1.codigo[0].startsWith("función openModal") && v1.codigo.includes("quién llama a openModal") && v1.tokens_pedido.arreglo + pedidos[1].max <= 12000, JSON.stringify(v1.codigo) + " " + v1.tokens_pedido.arreglo);
t("los pedidos no traen los textos de prueba de la planilla (QA Alfa…)", pedidos.every((p) => !/QA Alfa|QA Beta/.test(p.user)));
t("vuelta 1: el arreglo de index.html queda (R1 pasa y no rompe nada)", v1.aceptado && v1.despues["R1.1"] === "PASS", v1.motivo);
t("vuelta 2: el arreglo que saca el botón ROMPE lo que andaba → se vuelve atrás, y se dice qué rompió", v2.requisito === "R3" && !v2.aceptado && /rompió lo que ya andaba/.test(v2.motivo), v2.motivo?.slice(0, 200));
t("vuelta 3: el intento siguiente sabe qué falló antes", /El intento anterior NO sirvió: rompió/.test(pedidos[4].user));
t("vuelta 3: sin bloques → no se aplica nada", !v3.aceptado && /no se pudo aplicar/.test(v3.motivo));
t("la curva: 1 requisito al empezar → 9 después de la vuelta 1 (lo mismo que la arreglada a mano; 19/10: R10 también pide que scrollee la columna y no la página)", ev.curva.map((c) => c.cumplidos).join() === "1,9,9", ev.curva.map((c) => c.cumplidos).join());
t("la app final es la de la vuelta 1 (el index.html arreglado), no la que rompía", app["index.html"].trimEnd() === ARREGLADA["index.html"].trimEnd() && readFileSync(join(out, "final", "index.html"), "utf8").trimEnd() === ARREGLADA["index.html"].trimEnd());

// ---------- v0.3: avance parcial y de a un bloque (2ª corrida real, 19/10) ----------
t("puntaje: PASS vale todo; si no, cuántas cosas se vieron bien", puntaje({ result: "PASS" }) === 1000 && puntaje({ result: "FAIL", detail: "→ ✓ la tarjeta muestra alta · ✗ colores" }) === 1 && puntaje({ result: "FAIL", detail: "no se pudo preparar" }) === 0);
const malo = "### FUNCION: openModal\n```js\nfunction openModal(cardId, currentStatus) { throw new Error('roto'); }\n```";
const dos = [{ ver: '{"ver": ["index.html"]}', arreglo: `### ARCHIVO: index.html\n\`\`\`html\n${ARREGLADA["index.html"]}\n\`\`\`\n${malo}` }];
let k2 = 0;
const call2 = async (messages, max, tipo) => { k2++; return { content: dos[0][tipo], ms: 1 }; };
const r2 = await ciclo({ app: ROTA, planilla: P, features: FEATS, outDir: mkdtempSync(join(tmpdir(), "ciclo-")), call: call2, maxVueltas: 1, log: () => {} });
const w1 = r2.ev.vueltas[0];
t("2ª corrida, vuelta 2: el index.html bueno venía junto con un openModal roto; juntos no sirven, pero se prueba cada uno solo y queda el bueno", w1.aceptado && /quedó solo: archivo index\.html/.test(w1.motivo) && w1.pruebas.length === 3 && !w1.pruebas[0].ok && r2.app["script.js"] === ROTA["script.js"], JSON.stringify(w1.pruebas) + " " + w1.motivo);

// ---------- 21/10: el borrador vino en un solo archivo (project26) ----------
{
  const { separarArchivos } = await import("./run_ciclo.mjs");
  const { syntaxOf } = await import("../harness/js_tools.mjs");
  const { readFileSync: rf } = await import("node:fs");
  const D = new URL("../profiles/web/validation/fixtures/flow_p26_borrador/", import.meta.url);
  const app = { "index.html": rf(new URL("index.html", D), "utf8"), "styles.css": rf(new URL("styles.css", D), "utf8"), "script.js": rf(new URL("script.js", D), "utf8") };
  const r = separarArchivos(app);
  t("separar: el <style> y el <script> de index.html pasan a sus archivos y se enlazan (project26: index.html no cargaba ninguno)", !/<style/i.test(r.app["index.html"]) && !/<script>(?!<)/i.test(r.app["index.html"].replace(/<script src="script.js"><\/script>/, "")) && /href="styles.css"/.test(r.app["index.html"]) && /src="script.js"/.test(r.app["index.html"]) && /function saveCard/.test(r.app["script.js"]) && !syntaxOf(r.app["script.js"]) && /#102C54/.test(r.app["styles.css"]) && r.cambios.length === 5, r.cambios.join(" | "));
  const ya = separarArchivos(r.app);
  t("separar: una app ya separada no se toca", ya.cambios.length === 0 && ya.app["index.html"] === r.app["index.html"]);
}

// ---------- 21/10: la función vuelve con su comentario /** … */ arriba (project26, R28 ×5) ----------
{
  const { aplicar } = await import("../harness/cambios.mjs");
  const app = { "index.html": "<script src=\"script.js\"></script>", "script.js": "/** borra */\nfunction deleteCard(id) {\n  return 1;\n}\nfunction otra() { return 2; }\n" };
  const r = aplicar(app, "### FUNCION: deleteCard\n```js\n        /**\n         * Elimina una tarjeta.\n         */\n        function deleteCard(id) {\n  if (id === 'x') return 0;\n  return 1;\n}\n```");
  t("cambios: una función que viene con su comentario arriba se aplica (antes: 'no devolvió deleteCard') y no duplica el comentario", r.aplicados.length === 1 && /return 0/.test(r.app["script.js"]) && (r.app["script.js"].match(/\/\*\*/g) || []).length === 1, JSON.stringify(r.problemas));
}

// ---------- 22/10: una LLAMADA no es la función (project26, R28: confirmDelete perdía su "deleteCard(cardId);") ----------
{
  const { aplicar } = await import("../harness/cambios.mjs");
  const { findMember } = await import("../harness/js_tools.mjs");
  const js = "function confirmDelete(id) {\n  if (!confirm('¿Seguro?')) return;\n  deleteCard(id);\n}\n\n/** borra */\nfunction deleteCard(id) {\n  delete data[id];\n}\n";
  t("findMember: 'deleteCard(id);' adentro de otra función no es la declaración", findMember(js, "deleteCard").start === 7);
  const r = aplicar({ "index.html": "<script src=\"script.js\"></script>", "script.js": js }, "### FUNCION: deleteCard\n```js\nfunction deleteCard(id) {\n  if (!data[id]) return;\n  delete data[id];\n}\n```");
  t("aplicar: al reemplazar deleteCard, confirmDelete sigue llamándola", /confirm\('¿Seguro\?'\)\) return;\n  deleteCard\(id\);\n\}/.test(r.app["script.js"]) && /if \(!data\[id\]\) return;/.test(r.app["script.js"]), r.app["script.js"]);
}
// ---------- 22/10: la sangría que quedó de index.html (project26, R10: ningún BLOQUE se encontraba) ----------
{
  const { separarArchivos, desindentar } = await import("./run_ciclo.mjs");
  const { aplicar } = await import("../harness/cambios.mjs");
  const css = "/* R9 */\n        body {\n            margin: 0;\n        }\n\n        .card-container {\n            overflow-y: auto;\n        }\n";
  const sep = separarArchivos({ "index.html": "<link rel=\"stylesheet\" href=\"styles.css\">", "styles.css": css });
  t("desindentar: el CSS que salió de index.html queda sin la sangría de 8 espacios (y se avisa)", sep.app["styles.css"].includes("\n.card-container {\n    overflow-y: auto;") && sep.cambios.length === 1 && desindentar("a {\n  b\n}") === "a {\n  b\n}");
  const r = aplicar(sep.app, "### BLOQUE: .card-container {\n```css\n.card-container {\n    overflow-y: auto;\n    min-height: 0;\n}\n```");
  const css2 = "/* Contenido principal de la tarjeta (el body) */\n.card-body {\n    padding-left: 24px;\n}\n\n.otra { color: red; }\n";
  const r2 = aplicar({ "styles.css": css2 }, "### BLOQUE: /* Contenido principal de la tarjeta (el body) */\n```css\n/* Contenido principal de la tarjeta (el body) */\n.card-body {\n    padding-left: 24px;\n    overflow-y: auto;\n}\n```");
  t("bloque CSS que empieza con un comentario: se reemplaza el comentario Y su regla (no queda duplicada); una llave de más no entra", r2.aplicados.length === 1 && (r2.app["styles.css"].match(/\.card-body/g) || []).length === 1 && /overflow-y: auto/.test(r2.app["styles.css"]) && /\.otra/.test(r2.app["styles.css"]) && aplicar({ "styles.css": css2 }, "### BLOQUE: .otra { color: red; }\n```css\n.otra { color: blue; }}\n```").aplicados.length === 0, r2.app["styles.css"]);
  t("bloque suelto: '.card-container {' se encuentra y se reemplaza", r.aplicados.length === 1 && /min-height: 0/.test(r.app["styles.css"]), JSON.stringify(r.problemas));
}

// ---------- 22/10: la prueba borra a propósito y espera que siga (project26, R28 ×6) ----------
{
  const { fallas } = await import("./run_ciclo.mjs");
  const f = { id: "R28.1", r: "R28", dado: [{ agregar: "QA Alfa" }, { mover: "QA Alfa", a: "Completa" }], hago: { eliminar: "QA Alfa" }, veo: [{ esta: "QA Alfa", en: "Completa" }] };
  const g = { id: "R7.1", r: "R7", dado: [{ agregar: "QA Alfa" }], hago: { eliminar: "QA Alfa" }, veo: [{ no_esta: "QA Alfa" }] };
  const txt = fallas([f, g], { "R28.1": { result: "FAIL", detail: "→ ✗ \"QA Alfa\" NO se ve (y tenía que verse en \"Completa\")" }, "R7.1": { result: "FAIL", detail: "x" } });
  t("fallas: si la prueba borra y espera que siga, se avisa que borrarse ES el error (y solo en esa)", /espera que NO se borre: en "Completa" borrar no tiene que funcionar/.test(txt) && (txt.match(/OJO/g) || []).length === 1, txt);
}

// ---------- 02/11: 2º borrador de la hoja (40 vueltas en 0) ----------
{
  const bs = leerBloques("### BLOQUE: styles.css\n```css\nbody { margin: 0; }\n```\n### index.html\n```html\n<p>hola</p>\n```\n### FUNCION: init\n```js\nfunction init() {}\n```");
  t("encabezados que Gemma inventa: \"### BLOQUE: styles.css\" y \"### index.html\" son archivos enteros (y el orden se respeta)", bs.map((b) => `${b.tipo}:${b.nombre}`).join() === "archivo:styles.css,archivo:index.html,funcion:init", JSON.stringify(bs.map((b) => [b.tipo, b.nombre])));
  const base = { "index.html": "<script src=\"script.js\"></script>", "script.js": "function init() {\n  return 1;\n}\ninit();\n" };
  const sola = aplicar(base, "### FUNCION: ponerNumeros en script.js\n```js\nfunction ponerNumeros() { return 2; }\n```");
  const llamada = aplicar(base, "### FUNCION: ponerNumeros en script.js\n```js\nfunction ponerNumeros() { return 2; }\n```\n### FUNCION: init\n```js\nfunction init() {\n  ponerNumeros();\n}\n```");
  t("una función nueva que nadie llama se avisa con su nombre (vuelta 6: populateRowLabels nunca corría); si alguien la llama, no", sola.avisos.length === 1 && /ponerNumeros\(\) pero nadie la llama/.test(sola.avisos[0]) && llamada.avisos.length === 0, JSON.stringify(sola.avisos));
  t("puntaje: lo que se pudo hacer antes de fallar cuenta (✓ se ve la columna · ✓ se ve la fila > solo la columna)", puntaje({ result: "FAIL", detail: "no se pudo preparar: ✓ se ve la columna \"A\" · ✓ se ve la fila \"1\" · no hay celda A1" }) > puntaje({ result: "FAIL", detail: "✓ se ve la columna \"A\" · no se ve la fila \"1\"" }));
  // la respuesta que se corta pensando: se dice, con el número
  const callC = async (messages, max, tipo) => (tipo === "ver" ? { content: '{"ver": ["index.html"]}', ms: 1 } : { content: "Voy a pensar...", ms: 1, usage: { completion_tokens: max, completion_tokens_details: { reasoning_tokens: max - 10 } } });
  const rc = await ciclo({ app: ROTA, planilla: P, features: FEATS, outDir: mkdtempSync(join(tmpdir(), "ciclo-")), call: callC, maxVueltas: 1, log: () => {} });
  const vc = rc.ev.vueltas[0];
  t("respuesta cortada en el tope pensando: el motivo lo dice (y el próximo intento lo lee), y el tope es más alto si entra", vc.cortada && /se cortó: llegó al tope de \d+ tokens pensando \(\d+ de pensar\)/.test(vc.motivo) && vc.tokens_pedido.arreglo < 6000, vc.motivo);
}

// ---------- 04/11: todo script.js adentro de DOMContentLoaded (27 de 40 respuestas lo pisaban con un pedazo) ----------
{
  const js = `document.addEventListener('DOMContentLoaded', () => {\n${Array.from({ length: 30 }, (_, i) => `  const v${i} = ${i};`).join("\n")}\n  function render() { return v1; }\n});\n`;
  const r = aplicar({ "script.js": js }, "### BLOQUE: document.addEventListener('DOMContentLoaded', () => {\n```js\ndocument.addEventListener('DOMContentLoaded', () => {\n  function render() { return 2; }\n});\n```");
  const r2 = aplicar({ "script.js": js }, "### FUNCION: render\n```js\nfunction render() { return 2; }\n```");
  t("un BLOQUE que es casi todo el archivo, con un pedazo adentro, no se aplica (y dice que mande funciones); la función de adentro sí se cambia", !r.aplicados.length && /es casi todo script\.js .*Mandá solo las funciones que cambian/.test(r.problemas.join()) && r2.aplicados.length === 1 && /return 2/.test(r2.app["script.js"]) && /const v29/.test(r2.app["script.js"]), JSON.stringify(r.problemas) + JSON.stringify(r2.problemas));
}

// ---------- 04/11 noche: código adentro de DOMContentLoaded se puede arreglar por partes ----------
{
  const { envoltorio } = await import("../harness/cambios.mjs");
  const js = `document.addEventListener("DOMContentLoaded", () => {\n  let estado = 1;\n${Array.from({ length: 12 }, (_, i) => `  const v${i} = ${i};`).join("\n")}\n  document.getElementById("b").addEventListener("click", () => {\n    estado = 2;\n  });\n  function init() { return estado; }\n  init();\n});\n`;
  const r = aplicar({ "script.js": js }, '### BLOQUE: document.getElementById("b").addEventListener("click", () => {\n```js\ndocument.getElementById("b").addEventListener("click", () => {\n  estado = 3;\n});\n```\n### FUNCION: otra en script.js\n```js\nfunction otra() { return estado; }\n```');
  const fin = r.app["script.js"];
  t("adentro de un envoltorio: un BLOQUE con sangría se encuentra por su primera línea, y una función nueva va ADENTRO (ve las variables)", !!envoltorio(js) && r.aplicados.length === 2 && /estado = 3/.test(fin) && !/estado = 2/.test(fin) && fin.indexOf("function otra") < fin.lastIndexOf("});") && /adentro de/.test(r.aplicados[1]), JSON.stringify(r.aplicados) + JSON.stringify(r.problemas));
  t("un archivo con funciones sueltas no es un envoltorio (la función nueva va al final, como siempre)", envoltorio("function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}\na();\n") === null);
}

// ---------- 04/11: de a poco (borrador mínimo + de a una prueba) ----------
{
  const users = [];
  const callB = async (messages) => { users.push(messages[1].content); const a = (messages[0].content.match(/Ahora escribí SOLO ([\w.]+)/) || [])[1]; return { content: `### ARCHIVO: ${a}\n\`\`\`\n${ARREGLADA[a]}\n\`\`\``, ms: 1 }; };
  const { borrador: bor } = await import("./run_ciclo.mjs");
  await bor({ features: FEATS, planilla: P, call: callB, base: ["R1", "R2"], rol: "Sos un desarrollador Frontend Senior." });
  const u = users[0];
  t("borrador mínimo: pide SOLO R1 y R2 (y sus pruebas), avisa que la app va a crecer de a uno", /PARA EMPEZAR/.test(u) && /^R1\. /m.test(u) && /^R2\. /m.test(u) && !/^R3\. /m.test(u) && !/^R16\. /m.test(u), u.slice(0, 400));
  const r = await ciclo({ app: ROTA, planilla: P, features: FEATS, outDir: mkdtempSync(join(tmpdir(), "ciclo-")), call: async (m, max, tipo) => ({ content: tipo === "ver" ? '{"ver": ["index.html"]}' : "nada", ms: 1 }), maxVueltas: 2, maxIntentos: 1, deAPoco: { base: 2 }, log: () => {} });
  const [a1, a2] = r.ev.vueltas;
  t("de a poco: la unidad es UNA prueba (R1.1, después la siguiente), y el pedido habla de su requisito", /^R\d+\.\d+$/.test(a1.requisito) && /^R\d+\.\d+$/.test(a2.requisito) && a1.requisito !== a2.requisito, JSON.stringify([a1.requisito, a2.requisito]));
}

// ---------- 06/11: hoja de a poco — index.html de 20 filas escritas a mano (~5.000 tokens) ----------
{
  const { resumirRepetido, MARCA_RESUMIDO } = await import("../harness/cambios.mjs");
  const filas = Array.from({ length: 20 }, (_, i) => `      <tr id="f${i + 1}">\n        <th>${i + 1}</th>\n        <td data-c="A${i + 1}" contenteditable="true"></td>\n      </tr>`).join("\n");
  const html = `<!DOCTYPE html>\n<html>\n<body>\n  <div class="controles">\n    <button id="ocultar">Ocultar Fila</button>\n    <button id="aplicar" class="b">Aplicar</button>\n  </div>\n  <table>\n    <tbody>\n${filas}\n    </tbody>\n  </table>\n  <script src="script.js"></script>\n</body>\n</html>\n`;
  const r = resumirRepetido(html);
  t("HTML grande: lo repetido se muestra abreviado (primera y última fila + una línea RESUMIDO)", r.length < html.length * 0.4 && /id="f1"/.test(r) && /id="f20"/.test(r) && !/id="f10"/.test(r) && r.includes(MARCA_RESUMIDO), r.slice(0, 300));
  const a = aplicar({ "index.html": html }, '### BLOQUE: <div class="controles">\n```html\n<div class="controles">\n  <button id="ocultar">Ocultar Fila</button>\n  <button id="borrar">Borrar Fila</button>\n</div>\n```');
  t("un elemento de HTML se cambia por BLOQUE (hasta su etiqueta de cierre), sin tocar el resto", a.aplicados.length === 1 && /Borrar Fila/.test(a.app["index.html"]) && !/id="aplicar"/.test(a.app["index.html"]) && /id="f20"/.test(a.app["index.html"]), JSON.stringify(a.problemas));
  const b = aplicar({ "index.html": html }, '### BLOQUE: <button id="aplicar">Aplicar Fondo</button>\n```html\n<button id="aplicar">X</button>\n```');
  t("si un BLOQUE no se encuentra, el aviso muestra las líneas que más se le parecen", /Lo que más se le parece: index\.html:6: <button id="aplicar" class="b">Aplicar<\/button>/.test(b.problemas.join()), b.problemas.join());
  const c = aplicar({ "index.html": html }, "### ARCHIVO: index.html\n```html\n" + r + "\n```");
  t("devolver el archivo con la parte RESUMIDA no se aplica (borraría las filas)", !c.aplicados.length && /RESUMIDA/.test(c.problemas.join()));
  const cod = armarCodigo({ "index.html": html.replace(/<\/tbody>/, `${["g", "h", "k", "m"].map((p) => filas.replace(/f(\d+)/g, `${p}$1`)).join("\n")}\n    </tbody>`), "script.js": "function a() {}\n" }, ["index.html"], [], 6000);
  t("armarCodigo muestra el HTML grande como RESUMIDO", /archivo index\.html \(RESUMIDO/.test(cod.piezas.join()), JSON.stringify(cod.piezas));
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
