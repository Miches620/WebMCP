// test_kanban.mjs — el núcleo del tablero Kanban (build/kanban/nucleo.mjs), plan B en otra app, paso 1 (18/11).
//   node build/test_kanban.mjs            (todo: unidades + Chromium + el juez real, ~3-4 min)
// La planilla: la del proyecto Kanban del 21/10 (38 pruebas), la misma de las réplicas.
//   node build/test_kanban.mjs --rapido   (sin el juez real)
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { KANBAN_VERSION, armarIndex, armarApp, leerTablero, tableroJs, NUCLEO_JS, BASE_CSS, EDITABLES, vista, fijarKanban, appInicial, LOGICA_INICIAL, TABLERO_INICIAL, REGLA_KANBAN, FUNCIONES, MAX_COLUMNAS } from "./kanban/nucleo.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = fileURLToPath(new URL(".", import.meta.url));
const R = (f) => readFileSync(join(here, "kanban", "referencia", f), "utf8");
const PL = JSON.parse(R("planilla_kanban.json"));
const REF = { logica: R("logica.js"), tablero: R("tablero.json"), estilos: R("styles.css") };

t("versión", KANBAN_VERSION === "kanban v0.1");

// ---------- unidades ----------
{
  const r = leerTablero(REF.tablero);
  t("leerTablero: el de referencia sin problemas (3 columnas, se agrega en Pendiente, Descripción y Prioridad)", r.problemas.length === 0 && r.tablero.columnas.join() === "Pendiente,En Curso,Completa" && r.tablero.agregar_en === "Pendiente" && r.tablero.campos[1].opciones.join() === "alta,media,baja", JSON.stringify(r));
  const p = (x) => leerTablero(x).problemas.join(" | ");
  t("leerTablero: no JSON / no objeto / columnas que no son lista → lo dice (y queda un tablero vacío)", /no es JSON/.test(p("{x")) && /tiene que ser un objeto/.test(p("[1]")) && /"columnas" tiene que ser una lista/.test(p('{"columnas":"A"}')) && leerTablero("{x").tablero.columnas.length === 0);
  const a = leerTablero('{"columnas":["A","B","A",""],"agregar_en":"Z"}');
  t("leerTablero: columna repetida o vacía → aviso y se saca; agregar_en que no es columna → aviso y va en la primera", a.tablero.columnas.join() === "A,B" && a.tablero.agregar_en === "A" && /"A" está repetida/.test(a.problemas.join()) && /"agregar_en" tiene que ser una de las columnas/.test(a.problemas.join()), JSON.stringify(a));
  const c = leerTablero('{"columnas":["A"],"agregar_en":"A","campos":[{"nombre":"Título"},{"nombre":"P","tipo":"opciones"},{"nombre":"N","tipo":"numero"},{"nombre":"n"},{"x":1}]}');
  t("leerTablero: campos — 'Título' sobra, opciones sin opciones → texto, tipo desconocido → texto, repetido (sin importar mayúsculas) y sin nombre → avisos", c.tablero.campos.map((x) => `${x.nombre}:${x.tipo}`).join() === "P:texto,N:texto" && c.problemas.length === 5, JSON.stringify(c));
  t("leerTablero: más de 8 columnas → se cortan con aviso; el bloque ```json alrededor se tolera", leerTablero(JSON.stringify({ columnas: "ABCDEFGHIJ".split(""), agregar_en: "A" })).tablero.columnas.length === MAX_COLUMNAS && leerTablero('```json\n{"columnas":["A"],"agregar_en":"A"}\n```').problemas.length === 0);
}
{
  const idx = armarIndex("Mi <tablero>");
  t("armarIndex: base.css antes de styles.css; tablero.js → logica.js → nucleo.js; título escapado; los modales ocultos", idx.indexOf("base.css") < idx.indexOf("styles.css") && idx.indexOf("tablero.js") < idx.indexOf("logica.js") && idx.indexOf("logica.js") < idx.indexOf("nucleo.js") && idx.includes("Mi &lt;tablero&gt;") && (idx.match(/class="modal" hidden/g) || []).length === 2);
  t("NUCLEO_JS compila; tableroJs arma const TABLERO", (() => { try { new Function(NUCLEO_JS); new Function(tableroJs({ columnas: ["A"], agregar_en: "A", campos: [] }) + "return TABLERO;"); return true; } catch { return false; } })());
  const ini = appInicial({ titulo: "Kanban" });
  t("appInicial: la app entera sin llamar al modelo (tablero vacío, logica.js sin reglas)", ["index.html", "base.css", "styles.css", "nucleo.js", "tablero.js", "tablero.json", "logica.js"].every((f) => typeof ini[f] === "string") && ini["tablero.json"] === TABLERO_INICIAL && ini["logica.js"] === LOGICA_INICIAL);
  t("vista: Gemma ve y cambia solo logica.js, tablero.json y styles.css", Object.keys(vista(ini)).sort().join() === [...EDITABLES].sort().join());
  const f = fijarKanban({ ...vista(ini), "logica.js": "function crear(e, t) { e.tarjetas.push(t); }", "tablero.json": '{"columnas":["Hacer","Hecho"],"agregar_en":"Hacer"}', "index.html": "<p>roto</p>", "nucleo.js": "alert(1)" });
  t("fijarKanban: index.html y nucleo.js vuelven a ser los del harness; tablero.js sale de tablero.json; avisa las reglas que faltan (si ya hay alguna)", f.app["index.html"] === armarIndex() && f.app["nucleo.js"] === NUCLEO_JS && /"Hacer"/.test(f.app["tablero.js"]) && /no define editar, borrar, mover/.test(f.problemas.join()), JSON.stringify(f.problemas));
  t("fijarKanban: sin ninguna regla todavía no se avisa (al principio faltan todas: no es un error, es lo que hay que hacer)", fijarKanban(vista(ini)).problemas.length === 0 && fijarKanban(REF).problemas.length === 0);
  t("REGLA_KANBAN: los 3 archivos, la forma del estado, las 6 reglas, el aviso con un texto, y los nombres para el CSS", /SOLO estos 3 archivos/.test(REGLA_KANBAN) && FUNCIONES.every((f) => REGLA_KANBAN.includes(`${f}(`)) && /devolvé un texto/.test(REGLA_KANBAN) && /\.tarjeta \(\.manija/.test(REGLA_KANBAN) && /tarjetas: \[\{ id: "t1"/.test(REGLA_KANBAN));
}

// ---------- en Chromium (sin el juez): lo que hace el núcleo ----------
const { chromium } = await import("playwright");
const br = await chromium.launch();
const abrir = async (app) => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-"));
  for (const [f, s] of Object.entries(app)) writeFileSync(join(dir, f), s);
  const pg = await br.newPage(); const errores = [];
  pg.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pg.on("pageerror", (e) => errores.push(e.message));
  await pg.goto(pathToFileURL(join(dir, "index.html")).href);
  return { pg, errores };
};
const col = (n) => `section.columna[data-columna="${n}"]`;
const agregar = async (pg, titulo, campos = {}) => {
  await pg.click("button.agregar");
  await pg.fill('#formulario [name="titulo"]', titulo);
  for (const [k, v] of Object.entries(campos)) { const x = pg.locator(`#formulario [name="${k}"]`); if ((await x.evaluate((e) => e.tagName)) === "SELECT") await x.selectOption(v); else await x.fill(v); }
  await pg.click('#formulario button[type="submit"]');
};
const tarjeta = (titulo) => `.tarjeta:has(h3:text-is("${titulo}"))`;
const titulos = (pg, c) => pg.$$eval(`${col(c)} .tarjeta h3`, (hs) => hs.map((h) => h.textContent));
const contador = (pg, c) => pg.textContent(`${col(c)} .contador`);
{
  const { pg, errores } = await abrir(armarApp(REF));
  await agregar(pg, "Uno", { Descripción: "hay que hacerlo", Prioridad: "baja" });
  await agregar(pg, "Dos", { Prioridad: "alta" });
  await agregar(pg, "Tres", { Prioridad: "baja" });
  t("Chromium: agregar con el formulario → la tarjeta en Pendiente con sus campos; el contador cuenta; ordenar manda (alta primero, después la más nueva)", (await titulos(pg, "Pendiente")).join() === "Dos,Tres,Uno" && (await contador(pg, "Pendiente")) === "3" && /hay que hacerlo/.test(await pg.textContent(tarjeta("Uno"))), (await titulos(pg, "Pendiente")).join() + " " + errores.join(" | "));
  await pg.hover(tarjeta("Uno")); await pg.click(`${tarjeta("Uno")} button.editar`);
  t("Chromium: ✏️ abre el formulario con lo que tiene la tarjeta", (await pg.inputValue('#formulario [name="titulo"]')) === "Uno" && (await pg.inputValue('#formulario [name="Prioridad"]')) === "baja");
  await pg.fill('#formulario [name="titulo"]', "Uno bis"); await pg.selectOption('#formulario [name="Prioridad"]', "media"); await pg.click('#formulario button[type="submit"]');
  t("Chromium: editar cambia el título y el campo (y el orden: media antes que baja)", (await titulos(pg, "Pendiente")).join() === "Dos,Uno bis,Tres" && /media/.test(await pg.textContent(tarjeta("Uno bis"))));
  await pg.locator(tarjeta("Dos")).dragTo(pg.locator(col("En Curso")));
  t("Chromium: arrastrar a otra columna → mover; los dos contadores cambian", (await titulos(pg, "En Curso")).join() === "Dos" && (await contador(pg, "Pendiente")) === "2" && (await contador(pg, "En Curso")) === "1");
  await pg.hover(tarjeta("Tres")); await pg.click(`${tarjeta("Tres")} button.borrar`);
  const preg = await pg.textContent("#confirmar-modal");
  await pg.click("#confirmar-si");
  t("Chromium: 🗑️ pregunta (el texto de preguntaBorrar) y con Eliminar se borra", /seguro de borrar la tarjeta/.test(preg) && !(await titulos(pg, "Pendiente")).includes("Tres"));
  await pg.locator(tarjeta("Dos")).dragTo(pg.locator(col("Completa")));
  await pg.hover(tarjeta("Dos")); await pg.click(`${tarjeta("Dos")} button.borrar`);
  t("Chromium: preguntaBorrar sin texto → no pregunta; una regla que devuelve un texto NO cambia nada y el texto se muestra (no se borra en Completa)", !(await pg.isVisible("#confirmar-modal")) && (await titulos(pg, "Completa")).join() === "Dos" && /No se puede eliminar una tarjeta completada/.test(await pg.textContent("#aviso")) && (await pg.isVisible("#aviso")));
  await pg.reload();
  t("Chromium: recargar → sigue todo (localStorage)", (await titulos(pg, "Completa")).join() === "Dos" && (await titulos(pg, "Pendiente")).join() === "Uno bis");
  t("Chromium: con la lógica de referencia, sin errores en la consola", errores.length === 0, errores.join(" | "));
  await pg.close();
}
{
  // sin preguntaBorrar se borra sin preguntar; una regla que tira no rompe nada; ordenar que no devuelve lista
  const logica = "function crear(e, t) { e.tarjetas.push(t); }\nfunction borrar(e, id) { e.tarjetas = e.tarjetas.filter((x) => x.id !== id); }\nfunction mover(e, id, c) { e.tarjetas.find((x) => x.id === id).columna = c; throw new Error('se rompió'); }\nfunction ordenar(ts) { return 'no'; }";
  const { pg, errores } = await abrir(armarApp({ logica, tablero: REF.tablero }));
  await agregar(pg, "A"); await agregar(pg, "B");
  await pg.hover(tarjeta("A")); await pg.click(`${tarjeta("A")} button.borrar`);
  t("Chromium: sin preguntaBorrar se borra sin preguntar", (await titulos(pg, "Pendiente")).join() === "B" && !(await pg.isVisible("#confirmar-modal")));
  await pg.locator(tarjeta("B")).dragTo(pg.locator(col("En Curso")));
  t("Chromium: una regla que tira → el estado queda como estaba y el error se ve en la consola, con el nombre", (await titulos(pg, "Pendiente")).join() === "B" && errores.some((e) => /mover \(logica\.js\) tiró un error: se rompió/.test(e)) && errores.some((e) => /ordenar \(logica\.js\) no devolvió una lista/.test(e)), errores.join(" | "));
  await pg.close();
}
{
  // sin reglas: el formulario abre pero no pasa nada; el error dice qué falta y para qué
  const { pg, errores } = await abrir(armarApp({ tablero: REF.tablero }));
  await agregar(pg, "A");
  t("Chromium: sin crear → no aparece la tarjeta y la consola dice 'la función crear no existe en logica.js: … el botón de agregar'", (await titulos(pg, "Pendiente")).length === 0 && errores.some((e) => /la función crear no existe en logica\.js: el núcleo la usa para crear una tarjeta \(el botón de agregar\)/.test(e)), errores.join(" | "));
  await pg.close();
}
{
  const { pg, errores } = await abrir(appInicial());
  t("Chromium: tablero vacío → no hay columnas y la consola lo dice", (await pg.$$("section.columna")).length === 0 && errores.some((e) => /tablero\.json no tiene columnas/.test(e)));
  await pg.close();
}
await br.close();

// ---------- paso 2: el ciclo con --nucleo (juez de mentira: solo la plomería) ----------
const { ciclo, elegirNucleo, CICLO_VERSION } = await import("./run_ciclo.mjs");
const PL_HOJA = JSON.parse(readFileSync(join(here, "grilla", "referencia", "planilla_hoja.json"), "utf8"));
t("elegirNucleo: hoja → grilla; Kanban → kanban; algo que no es ninguno → null; con nombre, ese", elegirNucleo(PL_HOJA) === "grilla" && elegirNucleo(PL) === "kanban" && elegirNucleo({ glosario: { item: "tarea" }, filas: [] }) === null && elegirNucleo(PL, "kanban") === "kanban");
const bloque = (f, lang, txt) => `### ARCHIVO: ${f}\n\`\`\`${lang}\n${txt}\n\`\`\``;
const ARREGLO_REF = [bloque("logica.js", "js", REF.logica), bloque("tablero.json", "json", REF.tablero), bloque("styles.css", "css", REF.estilos), bloque("nucleo.js", "js", 'alert("me meto")')].join("\n\n");
{
  const pedidos = [], juzgadas = [];
  const call = async (m, max, tipo) => { pedidos.push({ tipo, sys: m[0].content, user: m[1].content }); return { content: tipo === "ver" ? '{"ver": ["logica.js", "tablero.json", "nucleo.js"]}' : ARREGLO_REF, ms: 1 }; };
  const juez = async (app, filas) => { juzgadas.push(app); const bien = /function crear/.test(app["logica.js"]); return Object.fromEntries(filas.map((f) => [f.id, bien ? { result: "PASS", detail: "ok" } : { result: "FAIL", detail: `${f.id} falla` }])); };
  const { ev, app } = await ciclo({ app: null, planilla: PL, features: ["kanban"], outDir: mkdtempSync(join(tmpdir(), "ck-")), call, juez, nucleo: "auto", maxVueltas: 3, log: () => {} });
  const v1 = ev.vueltas[0];
  t("ciclo --nucleo (auto → kanban): versión v1.0, ev.nucleo = kanban, vuelta 0 = el núcleo del tablero sin borrador (el primer pedido es 'ver')", CICLO_VERSION === "ciclo v1.0" && ev.nucleo === KANBAN_VERSION && ev.grilla === false && /núcleo del tablero/.test(ev.desde) && pedidos[0].tipo === "ver" && juzgadas[0]["nucleo.js"] === NUCLEO_JS);
  t("ciclo --nucleo kanban: Gemma recibe la regla del tablero y un mapa sin index.html, nucleo.js, base.css ni tablero.js", pedidos.every((p) => /tablero\.json — \{ "columnas"/.test(p.sys)) && !/nucleo\.js|index\.html|base\.css|tablero\.js\b/.test(pedidos[1].user.split("Código:")[0]) && v1.codigo.every((c) => !/nucleo\.js/.test(c)), JSON.stringify(v1.codigo));
  t("ciclo --nucleo kanban: se aplican logica.js, tablero.json y styles.css; lo de nucleo.js no; tablero.js sale de tablero.json", v1.aceptado && app["nucleo.js"] === NUCLEO_JS && app["logica.js"].trim() === REF.logica.trim() && /"En Curso"/.test(app["tablero.js"]) && v1.problemas.some((x) => /nucleo\.js: no es un archivo/.test(x)), JSON.stringify(v1.problemas));
  let tiro = ""; try { await ciclo({ app: null, planilla: { glosario: { item: "tarea" }, filas: PL.filas.slice(0, 1) }, features: [], outDir: mkdtempSync(join(tmpdir(), "ck-")), call, juez, nucleo: "auto", log: () => {} }); } catch (e) { tiro = e.message; }
  t("ciclo --nucleo con una planilla que no es grilla ni tablero → error claro", /ni de un tablero/.test(tiro), tiro);
}

// ---------- con el juez real (la planilla del proyecto Kanban, 21/10) ----------
if (!process.argv.includes("--rapido")) {
  const { juezReal } = await import("./run_ciclo.mjs");
  const juzgar = (app, n) => juezReal(PL, { log: () => {} })(app, PL.filas, n, mkdtempSync(join(tmpdir(), `kj-${n}-`)));
  const pasan = (est) => Object.entries(est).filter(([, v]) => v.result === "PASS").map(([k]) => k);
  const ref = await juzgar(armarApp(REF), "ref");
  t(`juez real: núcleo + referencia → ${PL.filas.length}/${PL.filas.length} (la vara: si falla, el problema es del núcleo)`, pasan(ref).length === PL.filas.length, Object.entries(ref).filter(([, v]) => v.result !== "PASS").map(([k, v]) => `${k}: ${v.detail.slice(0, 160)}`).join(" | "));
  const vacia = await juzgar(appInicial(), "vacia");
  t("juez real: núcleo solo (sin tablero.json ni reglas) → 0 (no regala nada)", pasan(vacia).length === 0, pasan(vacia).join());
  // el ciclo entero con el juez real: arranca en el núcleo solo (0) y con la referencia como "respuesta de Gemma" llega a todo
  const { ev } = await ciclo({ app: null, planilla: PL, features: ["kanban"], outDir: mkdtempSync(join(tmpdir(), "ckr-")), call: async (m, max, tipo) => ({ content: tipo === "ver" ? '{"ver": ["logica.js"]}' : ARREGLO_REF, ms: 1 }), nucleo: "kanban", maxVueltas: 2, log: () => {} });
  t(`ciclo --nucleo kanban con el juez real: vuelta 1 = 0/${PL.filas.length}; con la referencia, vuelta 2 = ${PL.filas.length}/${PL.filas.length}`, ev.curva[0].filas_pass === 0 && ev.curva.at(-1).filas_pass === PL.filas.length, JSON.stringify(ev.curva));
  const solo = await juzgar(armarApp({ tablero: REF.tablero }), "solo");
  t("juez real: solo tablero.json (sin reglas ni estilo) → solo que estén las columnas y el botón de agregar en Pendiente (R2.1, R8.1, R8.2, R25.1)", pasan(solo).join() === "R2.1,R8.1,R8.2,R25.1", pasan(solo).join());
}

console.log(`\n${ok}/${ok + fail} ${fail ? "FALLAN " + fail : "OK"}`);
process.exit(fail ? 1 : 0);
