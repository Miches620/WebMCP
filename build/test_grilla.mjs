// test_grilla.mjs — el núcleo del modo --grilla (build/grilla/nucleo.mjs), paso 1 del plan B (17/11).
//   node build/test_grilla.mjs            (todo: unidades + Chromium + el juez real, ~1-2 min)
//   node build/test_grilla.mjs --rapido   (sin el juez real)
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { GRILLA_VERSION, dimsDe, armarIndex, armarApp, leerAcciones, accionesJs, funcionesPedidas, NUCLEO_JS, BASE_CSS, MAX_ACCIONES } from "./grilla/nucleo.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = fileURLToPath(new URL(".", import.meta.url));
const PL = JSON.parse(readFileSync(join(here, "grilla", "referencia", "planilla_hoja.json"), "utf8"));
const LOGICA_REF = readFileSync(join(here, "grilla", "referencia", "logica.js"), "utf8");
const ACC_REF = leerAcciones(readFileSync(join(here, "grilla", "referencia", "acciones.json"), "utf8"));

t("versión", GRILLA_VERSION === "grilla v0.1");

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
  t("Chromium: acción que logica.js no define → la consola lo dice con el nombre (sin romper la página)", errores.some((e) => /Logica\.ocultar no existe/.test(e)) && (await pg.isVisible(td("A1"))), errores.join(" | "));
  await pg.close();
}
{
  // logica.js que tira en valorDe → #ERROR en esa celda y el motivo en la consola, el resto anda
  const { pg, errores } = await abrir(armarApp({ dims, logica: "const Logica = { valorDe(e, id) { if (id === 'C3') throw new Error('se rompió'); return e.celdas[id]?.texto ?? ''; } };" }));
  await pg.click(td("A1")); await pg.keyboard.type("hola"); await pg.keyboard.press("Enter");
  t("Chromium: valorDe que tira → esa celda dice #ERROR, la consola el motivo, y las demás andan", (await pg.textContent(td("C3"))) === "#ERROR" && (await pg.textContent(td("A1"))) === "hola" && errores.some((e) => /valorDe\(estado, "C3"\) tiró un error: se rompió/.test(e)));
  await pg.close();
}
await br.close();

// ---------- con el juez real (la planilla de la hoja) ----------
if (!process.argv.includes("--rapido")) {
  const { juezReal } = await import("./run_ciclo.mjs");
  const juzgar = (app, n) => juezReal(PL, { log: () => {} })(app, PL.filas, n, mkdtempSync(join(tmpdir(), `gj-${n}-`)));
  const pasan = (est) => Object.entries(est).filter(([, v]) => v.result === "PASS").map(([k]) => k);
  const ref = await juzgar(armarApp({ dims, logica: LOGICA_REF, acciones: ACC_REF.acciones }), "ref");
  t(`juez real: núcleo + lógica de referencia → ${PL.filas.length}/${PL.filas.length} (la vara: si falla, el problema es del núcleo)`, pasan(ref).length === PL.filas.length, Object.entries(ref).filter(([, v]) => v.result !== "PASS").map(([k, v]) => `${k}: ${v.detail.slice(0, 160)}`).join(" | "));
  const vacia = await juzgar(armarApp({ dims }), "vacia");
  t("juez real: núcleo SIN lógica → solo pasa lo que hace el núcleo (escribir, encabezados, recargar: R1, R2, R9, R10, R17); fórmulas, color, borrar y ocultar NO (no regala nada)", pasan(vacia).join() === "R1.1,R2.1,R9.1,R10.1,R17.1", pasan(vacia).join());
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
