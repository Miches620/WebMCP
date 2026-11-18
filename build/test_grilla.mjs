// test_grilla.mjs — el núcleo del modo --grilla (build/grilla/nucleo.mjs), paso 1 del plan B (17/11).
//   node build/test_grilla.mjs            (todo: unidades + Chromium + el juez real, ~1-2 min)
//   node build/test_grilla.mjs --rapido   (sin el juez real)
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { GRILLA_VERSION, dimsDe, armarIndex, armarApp, leerAcciones, accionesJs, funcionesPedidas, NUCLEO_JS, BASE_CSS, MAX_ACCIONES, EDITABLES, vista, fijarGrilla, appInicial, LOGICA_INICIAL, REGLA_GRILLA } from "./grilla/nucleo.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = fileURLToPath(new URL(".", import.meta.url));
const PL = JSON.parse(readFileSync(join(here, "grilla", "referencia", "planilla_hoja.json"), "utf8"));
const LOGICA_REF = readFileSync(join(here, "grilla", "referencia", "logica.js"), "utf8");
const ACC_REF = leerAcciones(readFileSync(join(here, "grilla", "referencia", "acciones.json"), "utf8"));

t("versión", GRILLA_VERSION === "grilla v0.2");

// ---------- unidades ----------
const dims = dimsDe(PL);
t("dimsDe: las columnas y filas salen de la prueba de encabezados de la planilla (hoja: A–J × 1–20)", dims?.columnas.join("") === "ABCDEFGHIJ" && dims.filas.length === 20 && dims.filas[19] === "20");
t("dimsDe: una planilla sin prueba de encabezados → null (no se inventa una grilla)", dimsDe({ filas: [{ veo: [{ muestra: "1", en: "A1" }] }] }) === null && dimsDe(null) === null);
const idx = armarIndex(dims, "Hoja <de> prueba");
t("armarIndex: 200 celdas con data-cell y data-col, editables; letras arriba y números al costado", (idx.match(/<td data-cell="/g) || []).length === 200 && idx.includes('<td data-cell="J20" data-col="J" contenteditable="true">') && idx.includes('<th class="col" data-col="A">A</th>') && idx.includes('<tr data-fila="20"><th class="fila">20</th>'));
t("armarIndex: carga base.css antes de styles.css, y acciones.js → logica.js → nucleo.js en ese orden; el título escapado", idx.indexOf("base.css") < idx.indexOf("styles.css") && idx.indexOf("acciones.js") < idx.indexOf("logica.js") && idx.indexOf("logica.js") < idx.indexOf("nucleo.js") && idx.includes("Hoja &lt;de&gt; prueba") && idx.includes('lang="es"'));
t("NUCLEO_JS compila; base.css marca la selección con outline (no con fondo: el juez mira el fondo)", (() => { try { new Function(NUCLEO_JS); return true; } catch { return false; } })() && /\.seleccionada \{ outline/.test(BASE_CSS) && !/\.seleccionada[^}]*background/.test(BASE_CSS));
t("leerAcciones: la de referencia sin problemas; funcionesPedidas = valorDe + una por acción", ACC_REF.problemas.length === 0 && ACC_REF.acciones.length === 4 && funcionesPedidas(ACC_REF.acciones).join() === "valorDe,pintar,borrar,vaciar,ocultar");
{
  const p = (x) => leerAcciones(x).problemas.join(" | ");
  t("leerAcciones: no JSON / no lista → lo dice", /no es JSON/.test(p("{x")) && /tiene que ser una lista/.test(p('{"a":1}')));
  t("leerAcciones: acepta { acciones: [...] }", leerAcciones({ acciones: [{ nombre: "X", funcion: "x" }] }).acciones.length === 1);
  t("leerAcciones: funcion inválida, reservada, pide raro y repetidas → lo dice y las saca", /nombre de una función/.test(p([{ nombre: "A", funcion: "no vale" }])) && /la usa el núcleo/.test(p([{ nombre: "A", funcion: "valorDe" }])) && /"pide" es null o "color"/.test(p([{ nombre: "A", funcion: "a", pide: "texto" }])) && /repetida/.test(p([{ nombre: "A", funcion: "a" }, { nombre: "a", funcion: "b" }])) && leerAcciones([{ nombre: "A", funcion: "a" }, { nombre: "a", funcion: "b" }]).acciones.length === 1);
  const muchas = Array.from({ length: MAX_ACCIONES + 2 }, (_, i) => ({ nombre: `A${i}`, funcion: `f${i}` }));
  t(`leerAcciones: más de ${MAX_ACCIONES} → se cortan y lo dice`, leerAcciones(muchas).acciones.length === MAX_ACCIONES && /como mucho/.test(p(muchas)));
  t("accionesJs compila y define ACCIONES", (() => { try { return new Function(`${accionesJs(ACC_REF.acciones)}; return ACCIONES.length;`)() === 4; } catch { return false; } })());
}

// ---------- v0.2: lo que usa el ciclo con --grilla ----------
{
  const ini = appInicial({ dims, titulo: "Hoja" });
  t("appInicial: la app completa sin llamar al modelo (núcleo + logica.js inicial con valorDe + barra vacía)", ["index.html", "base.css", "styles.css", "nucleo.js", "acciones.js", "logica.js", "acciones.json"].every((f) => typeof ini[f] === "string") && ini["logica.js"] === LOGICA_INICIAL && /function valorDe\(estado, id\)/.test(LOGICA_INICIAL) && /ACCIONES = \[\]/.test(ini["acciones.js"]));
  t("vista: Gemma ve y cambia solo logica.js, acciones.json y styles.css", Object.keys(vista(ini)).sort().join() === [...EDITABLES].sort().join());
  const tocada = { ...vista(ini), "acciones.json": '[{"nombre":"Ocultar","funcion":"ocultar","pide":null},{"nombre":"X","funcion":"no vale"}]' };
  const f = fijarGrilla({ ...tocada, "index.html": "<p>roto</p>", "nucleo.js": "alert(1)" }, { dims, titulo: "Hoja" });
  t("fijarGrilla: index.html y nucleo.js vuelven a ser los del harness aunque vengan cambiados; acciones.js sale de acciones.json (lo válido) y los problemas se devuelven", f.app["index.html"] === ini["index.html"] && f.app["nucleo.js"] === NUCLEO_JS && /"funcion": "ocultar"/.test(f.app["acciones.js"]) && !/no vale/.test(f.app["acciones.js"]) && f.problemas.length === 1 && f.app["acciones.json"] === tocada["acciones.json"]);
  let tiro = ""; try { fijarGrilla(vista(ini), { dims: null }); } catch (e) { tiro = e.message; }
  t("fijarGrilla sin columnas/filas → falla fuerte (no se inventa una grilla)", /prueba de encabezados/.test(tiro));
  t("REGLA_GRILLA: dice qué archivos se cambian, la forma del estado, sel.celdas y cómo mandar cada cosa", /SOLO estos 3 archivos/.test(REGLA_GRILLA) && /sel = \{ tipo/.test(REGLA_GRILLA) && /ocultas: \{ columnas/.test(REGLA_GRILLA) && /### FUNCION: nombre en logica\.js/.test(REGLA_GRILLA));
}

// ---------- en Chromium (sin el juez): lo que hace el núcleo ----------
const { chromium } = await import("playwright");
const br = await chromium.launch();
const abrir = async (app) => {
  const dir = mkdtempSync(join(tmpdir(), "grilla-"));
  for (const [f, s] of Object.entries(app)) writeFileSync(join(dir, f), s);
  const pg = await br.newPage(); const errores = [];
  pg.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pg.on("pageerror", (e) => errores.push(e.message));
  await pg.goto(pathToFileURL(join(dir, "index.html")).href);
  return { pg, errores };
};
const td = (c) => `td[data-cell="${c}"]`;
{
  const { pg, errores } = await abrir(armarApp({ dims, logica: LOGICA_REF, acciones: ACC_REF.acciones }));
  const escribir = async (c, v) => { await pg.click(td(c)); await pg.keyboard.press("Control+A"); await pg.keyboard.type(v); await pg.keyboard.press("Enter"); };
  await escribir("A1", "=B1+C1"); await escribir("B1", "2"); await escribir("C1", "3");
  t("Chromium: escribir tecla por tecla + Enter guarda (Enter no agrega renglón) y la fórmula muestra el resultado", (await pg.textContent(td("A1"))) === "5" && (await pg.evaluate(() => Hoja.estado.celdas.A1.texto)) === "=B1+C1");
  await escribir("B1", "4");
  t("Chromium: cambiar B1 recalcula A1 (R4.1: la fórmula vive en el estado)", (await pg.textContent(td("A1"))) === "7");
  await pg.click(td("A1"));
  t("Chromium: al entrar a editar A1 se ve la fórmula, no el resultado", (await pg.textContent(td("A1"))) === "=B1+C1");
  await pg.keyboard.press("End"); await pg.keyboard.type("+1");
  t("Chromium: mientras se escribe, nada pisa la celda (render se saltea la que tiene el foco)", (await pg.textContent(td("A1"))) === "=B1+C1+1");
  await pg.keyboard.press("Escape"); await pg.click(td("D5"));
  t("Chromium: salir con un clic en otra celda también guarda (focusout)", (await pg.textContent(td("A1"))) === "8");
  await pg.click(td("A2"));
  await pg.evaluate(() => { const i = document.querySelector("#barra input[type=color]"); i.value = "#ff0000"; i.dispatchEvent(new Event("change", { bubbles: true })); });
  t("Chromium: el color se aplica a la celda seleccionada aunque tenga el foco", (await pg.evaluate(() => getComputedStyle(document.querySelector('td[data-cell="A2"]')).backgroundColor)) === "rgb(255, 0, 0)");
  await pg.click('thead th[data-col="B"]');
  t("Chromium: clic en la letra selecciona la columna entera (20 celdas) sin ocultarla", (await pg.evaluate(() => Hoja.sel.tipo + Hoja.sel.id + document.querySelectorAll("td.seleccionada").length)) === "columnaB20" && (await pg.isVisible('thead th[data-col="B"]')));
  await pg.click('#barra button:has-text("Ocultar")');
  t("Chromium: Ocultar con la columna B seleccionada la oculta (encabezado y celdas)", !(await pg.isVisible('thead th[data-col="B"]')) && !(await pg.isVisible(td("B7"))));
  await pg.click('tbody tr[data-fila="1"] th.fila');
  t("Chromium: clic en el número selecciona la fila", (await pg.evaluate(() => Hoja.sel.tipo + Hoja.sel.id)) === "fila1");
  await pg.reload();
  t("Chromium: al recargar sigue todo (texto, fórmula, color, oculta)", (await pg.textContent(td("A1"))) === "8" && (await pg.evaluate(() => getComputedStyle(document.querySelector('td[data-cell="A2"]')).backgroundColor)) === "rgb(255, 0, 0)" && !(await pg.isVisible(td("B7"))));
  t("Chromium: la app de referencia no tiró errores de JS", errores.length === 0, errores.join(" | "));
  // las acciones sin selección no hacen nada (y no rompen)
  await pg.click('#barra button:has-text("Borrar")');
  t("Chromium: una acción sin nada seleccionado no hace nada", (await pg.textContent(td("A1"))) === "8");
  await pg.close();
}
{
  // una acción de la barra que Logica no define → error en la consola, que el juez le pasa a Gemma
  const { pg, errores } = await abrir(armarApp({ dims, logica: "const Logica = { valorDe: (e, id) => e.celdas[id]?.texto ?? '' };", acciones: [{ nombre: "Ocultar", funcion: "ocultar", pide: null }] }));
  await pg.click('thead th[data-col="A"]'); await pg.click('#barra button:has-text("Ocultar")');
  t("Chromium: acción que logica.js no define → la consola lo dice con el nombre (sin romper la página)", errores.some((e) => /la función ocultar no existe en logica\.js/.test(e)) && (await pg.isVisible(td("A1"))), errores.join(" | "));
  await pg.close();
}
{
  // v0.2: funciones SUELTAS (como las escribe el ciclo); una que se llama como una del navegador no se usa
  const { pg, errores } = await abrir(armarApp({ dims, logica: "function valorDe(e, id) { const t = e.celdas[id]?.texto ?? ''; return t === '=dos' ? '2' : t; }\nfunction ocultar(e, sel) { if (sel.tipo === 'columna') e.ocultas.columnas.push(sel.id); }", acciones: [{ nombre: "Ocultar", funcion: "ocultar", pide: null }, { nombre: "Imprimir", funcion: "print", pide: null }] }));
  await pg.click(td("A1")); await pg.keyboard.type("=dos"); await pg.keyboard.press("Enter");
  await pg.click('thead th[data-col="C"]'); await pg.click('#barra button:has-text("Ocultar")'); await pg.click('#barra button:has-text("Imprimir")');
  t("Chromium: logica.js con funciones sueltas anda (valorDe y la acción); 'print' del navegador NO se toma por una de logica.js", (await pg.textContent(td("A1"))) === "2" && !(await pg.isVisible(td("C1"))) && errores.some((e) => /la función print no existe en logica\.js/.test(e)), errores.join(" | "));
  await pg.close();
}
{
  // logica.js que tira en valorDe → #ERROR en esa celda y el motivo en la consola, el resto anda
  const { pg, errores } = await abrir(armarApp({ dims, logica: "const Logica = { valorDe(e, id) { if (id === 'C3') throw new Error('se rompió'); return e.celdas[id]?.texto ?? ''; } };" }));
  await pg.click(td("A1")); await pg.keyboard.type("hola"); await pg.keyboard.press("Enter");
  t("Chromium: valorDe que tira → esa celda dice #ERROR, la consola el motivo, y las demás andan", (await pg.textContent(td("C3"))) === "#ERROR" && (await pg.textContent(td("A1"))) === "hola" && errores.some((e) => /valorDe\(estado, "C3"\) \(logica\.js\) tiró un error: se rompió/.test(e)));
  await pg.close();
}
await br.close();

// ---------- v0.2: el ciclo con --grilla (juez de mentira: solo la plomería) ----------
const { ciclo, CICLO_VERSION } = await import("./run_ciclo.mjs");
const ARREGLO_REF = `### ARCHIVO: logica.js\n\`\`\`js\n${LOGICA_REF}\n\`\`\`\n\n### ARCHIVO: acciones.json\n\`\`\`json\n${JSON.stringify([...ACC_REF.acciones, { nombre: "Mal", funcion: "no vale" }])}\n\`\`\`\n\n### ARCHIVO: nucleo.js\n\`\`\`js\nalert("me meto")\n\`\`\``;
{
  const pedidos = [], juzgadas = [];
  const call = async (m, max, tipo) => { pedidos.push({ tipo, sys: m[0].content, user: m[1].content }); return { content: tipo === "ver" ? '{"ver": ["logica.js", "nucleo.js"]}' : ARREGLO_REF, ms: 1 }; };
  const juez = async (app, filas) => { juzgadas.push(app); const bien = /pintar/.test(app["acciones.js"]); return Object.fromEntries(filas.map((f) => [f.id, bien || ["R1", "R2"].includes(f.r) ? { result: "PASS", detail: "ok" } : { result: "FAIL", detail: `${f.id} falla` }])); };
  const { ev, app } = await ciclo({ app: null, planilla: PL, features: ["hoja"], outDir: mkdtempSync(join(tmpdir(), "cg-")), call, juez, grilla: true, maxVueltas: 3, log: () => {} });
  const v1 = ev.vueltas[0];
  t("ciclo --grilla: versión ciclo v0.9, ev.grilla anotado y la vuelta 0 es el núcleo (Gemma no escribe borrador: el primer pedido es 'ver')", CICLO_VERSION === "ciclo v0.9" && ev.grilla === GRILLA_VERSION && /núcleo de la grilla/.test(ev.desde) && pedidos[0].tipo === "ver" && juzgadas[0]["nucleo.js"] === NUCLEO_JS);
  t("ciclo --grilla: Gemma recibe la regla y un mapa con SOLO logica.js, acciones.json y styles.css (ni index.html ni nucleo.js); pedir nucleo.js no trae nada", pedidos.every((p) => /ESTA APP TIENE UN NÚCLEO/.test(p.sys)) && /logica\.js/.test(pedidos[0].user) && !/nucleo\.js|index\.html|base\.css/.test(pedidos[1].user.split("Código:")[0]) && v1.codigo.length === 1 && /logica\.js/.test(v1.codigo[0]), JSON.stringify(v1.codigo));
  t("ciclo --grilla: lo que manda Gemma para nucleo.js no se aplica; logica.js y acciones.json sí; el núcleo sigue siendo el del harness y la barra sale de acciones.json", v1.aceptado && app["nucleo.js"] === NUCLEO_JS && app["logica.js"].trim() === LOGICA_REF.trim() && /"funcion": "pintar"/.test(app["acciones.js"]) && v1.problemas.some((x) => /nucleo\.js: no es un archivo/.test(x)), JSON.stringify(v1.problemas));
  t("ciclo --grilla: el problema de acciones.json (una entrada mal) le llega a Gemma en los problemas de la vuelta", v1.problemas.some((x) => /^acciones\.json: /.test(x)), JSON.stringify(v1.problemas));
  let tiro = ""; try { await ciclo({ app: null, planilla: PL, features: [], outDir: mkdtempSync(join(tmpdir(), "cg-")), call, juez, grilla: true, mvc: true, log: () => {} }); } catch (e) { tiro = e.message; }
  t("ciclo: --mvc y --grilla juntos → error claro", /no van juntos/.test(tiro));
}

// ---------- con el juez real (la planilla de la hoja) ----------
if (!process.argv.includes("--rapido")) {
  const { juezReal } = await import("./run_ciclo.mjs");
  const juzgar = (app, n) => juezReal(PL, { log: () => {} })(app, PL.filas, n, mkdtempSync(join(tmpdir(), `gj-${n}-`)));
  const pasan = (est) => Object.entries(est).filter(([, v]) => v.result === "PASS").map(([k]) => k);
  const ref = await juzgar(armarApp({ dims, logica: LOGICA_REF, acciones: ACC_REF.acciones }), "ref");
  t(`juez real: núcleo + lógica de referencia → ${PL.filas.length}/${PL.filas.length} (la vara: si falla, el problema es del núcleo)`, pasan(ref).length === PL.filas.length, Object.entries(ref).filter(([, v]) => v.result !== "PASS").map(([k, v]) => `${k}: ${v.detail.slice(0, 160)}`).join(" | "));
  const vacia = await juzgar(armarApp({ dims }), "vacia");
  // el ciclo entero con el juez real: arranca en el núcleo solo y, con la lógica de referencia como "respuesta de Gemma", llega a todo
  const { ev } = await ciclo({ app: null, planilla: PL, features: ["hoja"], outDir: mkdtempSync(join(tmpdir(), "cgr-")), call: async (m, max, tipo) => ({ content: tipo === "ver" ? '{"ver": ["logica.js"]}' : ARREGLO_REF, ms: 1 }), grilla: true, maxVueltas: 2, log: () => {} });
  t(`ciclo --grilla con el juez real: vuelta 1 = lo del núcleo solo (5/${PL.filas.length}); con la lógica de referencia, vuelta 2 = ${PL.filas.length}/${PL.filas.length}`, ev.curva[0].filas_pass === 5 && ev.curva.at(-1).filas_pass === PL.filas.length, JSON.stringify(ev.curva) + " " + ev.vueltas.map((v) => v.motivo?.slice(0, 200)).join(" | "));
  t("juez real: núcleo SIN lógica → solo pasa lo que hace el núcleo (escribir, encabezados, recargar: R1, R2, R9, R10, R17); fórmulas, color, borrar y ocultar NO (no regala nada)", pasan(vacia).join() === "R1.1,R2.1,R9.1,R10.1,R17.1", pasan(vacia).join());
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
