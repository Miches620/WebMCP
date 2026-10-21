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

t("versiones", CICLO_VERSION === "ciclo v0.4" && MAPA_VERSION === "mapa v0.2" && CAMBIOS_VERSION === "cambios v0.2");

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

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
