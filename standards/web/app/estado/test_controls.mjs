// test_controls.mjs — Standard web/app/estado v0.4.0: los controles de cada elemento los arma el código.
//   node standards/web/app/estado/test_controls.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import S, { probeFor, cssClasses } from "./standard.mjs";
import { parseContract, datosJs } from "./contract.mjs";
import { kindsOf, controlsPlan, accionesJs, humanize } from "./controls.mjs";
import { pageHtml, probePage, runCallsProbe, callsProblems } from "../../../../profiles/web/specialist/files_kit.mjs";
import { validationGates } from "../../../../profiles/web/app/calls_gate.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const P = (json) => parseContract(json, {}).items[0];
const row = (plan, n) => plan.acciones.find((a) => a.nombre === n);
const step = (id) => S.steps.find((x) => x.id === id);

// ---------- 1. tipos y plan (sin navegador), con formas de estado distintas ----------
const LISTA = P({ estado: { items: [{ id: 1, texto: "Comprar pan", hecho: false }, { id: 2, texto: "Llamar a Ana", hecho: true }], siguiente: 3 },
  acciones: [{ nombre: "agregarItem", params: ["texto"], ejemplo: ["x"] }, { nombre: "borrarItem", params: ["id"], ejemplo: [1] }, { nombre: "marcarHecho", params: ["id"], ejemplo: [1] }] });
const pl = controlsPlan(LISTA);
t("lista: un tipo (items); 'siguiente' (número suelto) no es un tipo", Object.keys(pl.kinds).join() === "items" && pl.kinds.items.label === "texto");
t("lista: agregar es general (sin ids) y sus campos van en 'app'; borrar y marcar van en cada item", row(pl, "agregarItem").owner === "app" && row(pl, "agregarItem").campos[0].p === "texto" && row(pl, "borrarItem").owner === "items" && row(pl, "borrarItem").ownerParam === "id");
const CONT = P({ estado: { titulo: "Mi contador", valor: 0 }, acciones: [{ nombre: "sumar" }, { nombre: "reiniciar" }] });
t("contador: sin listas → sin tipos; todo es general", Object.keys(controlsPlan(CONT).kinds).length === 0 && controlsPlan(CONT).acciones.every((a) => a.owner === "app"));
const KAN = P(JSON.parse(readFileSync(fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/real_kanban_c4/contrato.json", import.meta.url)), "utf8")));
const pk = controlsPlan(KAN);
t("contrato real (4ª corrida): tipos anidados con su padre", pk.kinds.cards.parent === "columns" && pk.kinds.columns.parent === null && pk.kinds.labels.parent === null && pk.kinds.cards.path.join(".") === "columns.cards");
t("contrato real: el primer id dice el dueño (crear en la columna, el resto en la tarjeta)", row(pk, "crearTarjeta").owner === "columns" && ["moverTarjeta", "agregarComentario", "agregarEtiqueta", "editarTarjeta", "borrarTarjeta"].every((n) => row(pk, n).owner === "cards"));
t("contrato real: un id del tipo padre sale de dónde está (contexto); otro del mismo tipo es elección", row(pk, "moverTarjeta").ctx.map((x) => x.p).join() === "sourceColumnId" && row(pk, "moverTarjeta").choice.map((x) => x.p).join() === "targetColumnId" && row(pk, "borrarTarjeta").ctx.map((x) => x.p).join() === "columnId");
t("contrato real: un id de otra lista (etiquetas) es elección", row(pk, "agregarEtiqueta").choice[0]?.kind === "labels" && row(pk, "agregarEtiqueta").ctx.length === 0);
const BIB = P({ estado: { estantes: [{ id: "e1", nombre: "Ficción", libros: [{ id: "l1", titulo: "Rayuela", prestamos: [{ id: "p1", socio: "s1" }] }] }], socios: [{ id: "s1", nombre: "Ana" }] },
  acciones: [{ nombre: "prestarLibro", params: ["libroId", "socioId"], ejemplo: ["l1", "s1"] }, { nombre: "devolver", params: ["prestamoId", "libroId"], ejemplo: ["p1", "l1"] }, { nombre: "agregarLibro", params: ["estanteId", "titulo"], ejemplo: ["e1", "Nuevo"] }, { nombre: "moverLibro", params: ["libroId", "desde", "hacia"], ejemplo: ["l1", "e1", "e1"] }] });
const pb = controlsPlan(BIB);
t("otra forma (3 niveles + lista aparte): prestamos → libros → estantes", pb.kinds.prestamos.parent === "libros" && pb.kinds.libros.parent === "estantes" && pb.kinds.socios.parent === null);
t("otra forma: devolver toma el libro de dónde está; prestar elige socio; mover elige estante destino", row(pb, "devolver").ctx[0]?.p === "libroId" && row(pb, "prestarLibro").choice[0]?.kind === "socios" && row(pb, "moverLibro").ctx[0]?.p === "desde" && row(pb, "moverLibro").choice[0]?.p === "hacia");
const DUP = kindsOf({ a: [{ id: 1, items: [{ id: 2 }] }], b: [{ id: 3, items: [{ id: 4 }] }] });
t("dos listas con el mismo nombre → se llaman por el camino completo", Object.keys(DUP.kinds).sort().join() === "a,a.items,b,b.items");
t("nombres legibles para los botones", humanize("moverTarjeta") === "Mover tarjeta" && humanize("agregar_item") === "Agregar item");
t("acciones.js compila y no nombra ninguna app", (() => { const src = accionesJs(pk); new Function(src); return !/kanban|tarjeta|columna/i.test(src.replace(/var (TIPOS|ACCIONES) = .*;/g, "")); })());
t("paso 'acciones' (written): lo escribe el código desde el contrato", step("acciones").kind === "written" && /function controlesDe\(tipo, elemento, estado\)/.test(step("acciones").write({ data: { contrato: { items: [LISTA] } } })["js/acciones.js"]) && JSON.stringify(step("acciones").write({ data: {} })) === "{}");
t("paso 'acciones': un archivo que no compila → fatal", step("acciones").check({ "js/acciones.js": "function (" }).fatal === true && step("acciones").check({ "js/acciones.js": "var x = 1;" }).length === 0);

// ---------- 2. Chromium: un dibujo que solo muestra textos y agrega controlesDe ----------
const root = mkdtempSync(join(tmpdir(), "controls-"));
const app = (name, c, dibujo, css, logica) => {
  const d = join(root, name); mkdirSync(join(d, "js"), { recursive: true });
  const ctx = { data: { contrato: { items: [c] } } };
  const files = { "styles.css": css, "js/datos.js": datosJs(c.estado), "js/logica.js": logica, "js/acciones.js": step("acciones").write(ctx)["js/acciones.js"], "js/dibujo.js": dibujo, "js/controles.js": step("controles").write(ctx)["js/controles.js"] };
  for (const [f, x] of Object.entries(files)) writeFileSync(join(d, f), x);
  const page = (scripts, inline = "") => pageHtml({ title: "T", fragment: '<h1>T</h1><div id="app"></div>', scripts, inline, mainId: "principal" });
  writeFileSync(join(d, "probe.html"), page(["js/datos.js", "js/logica.js", "js/acciones.js", "js/dibujo.js"], probeFor(c, cssClasses(css))));
  writeFileSync(join(d, "index.html"), page(["js/datos.js", "js/logica.js", "js/acciones.js", "js/dibujo.js", "js/controles.js"]));
  return d;
};
const LOGICA_LISTA = `const App = {
  crear() { return JSON.parse(JSON.stringify(ESTADO_INICIAL)); },
  agregarItem(e, texto) { const n = JSON.parse(JSON.stringify(e)); n.items.push({ id: n.siguiente, texto, hecho: false }); n.siguiente++; return n; },
  borrarItem(e, id) { return { ...e, items: e.items.filter((x) => x.id !== id) }; },
  marcarHecho(e, id) { return { ...e, items: e.items.map((x) => x.id === id ? { ...x, hecho: !x.hecho } : x) }; }
};`;
const DIB_LISTA = `function dibujar(estado) {
  const app = document.getElementById("app"); app.innerHTML = "";
  estado.items.forEach((it) => { const d = document.createElement("div"); d.className = "item"; d.textContent = it.texto + (it.hecho ? " ✓" : ""); d.appendChild(controlesDe("items", it, estado)); app.appendChild(d); });
  app.appendChild(controlesDe("app", null, estado));
}`;
const dl = app("lista", LISTA, DIB_LISTA, ".item{color:red}", LOGICA_LISTA);
const pr = await probePage(join(dl, "probe.html"));
t("Chromium lista: la sonda de dibujo no encuentra problemas (los controles los arma controlesDe)", pr.probe?.ok && step("dibujo").expect(pr.probe).length === 0, JSON.stringify(pr.probe));
const cs = step("controles").resolve({ data: { contrato: { items: [LISTA] } } }).calls;
const rc = await runCallsProbe(join(dl, "index.html"), cs);
t("Chromium lista: todas las acciones se llaman, con ids numéricos, y se dibuja", callsProblems(rc, cs).length === 0 && (rc.args.borrarItem || []).every((a) => typeof a[1] === "number"), JSON.stringify(rc));
const dlSin = app("lista_sin_app", LISTA, DIB_LISTA.replace('app.appendChild(controlesDe("app", null, estado));', ""), ".item{color:red}", LOGICA_LISTA);
const ps = await probePage(join(dlSin, "probe.html"));
t("Chromium lista: si dibujo no agrega controlesDe(\"app\") el mensaje dice exactamente eso", /faltan los controles de: agregarItem \(agregá controlesDe\("app", null, estado\) una vez al final de #app\)/.test(step("dibujo").expect(ps.probe).join(" | ")), step("dibujo").expect(ps.probe).join(" | "));

// ---------- 3. el Kanban real (contrato y lógica de la 4ª corrida) con un dibujo simple ----------
const FX = fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/real_kanban_c4/", import.meta.url));
const DIB_KAN = `function dibujar(estado) {
  const app = document.getElementById("app"); app.innerHTML = "";
  estado.columns.forEach((col) => {
    const cd = document.createElement("div"); cd.className = "column";
    const h = document.createElement("h2"); h.textContent = col.title; cd.appendChild(h);
    col.cards.forEach((card) => {
      const k = document.createElement("div"); k.className = "card";
      const tt = document.createElement("h3"); tt.textContent = card.titulo; k.appendChild(tt);
      const p = document.createElement("p"); p.textContent = card.contenido; k.appendChild(p);
      card.labels.forEach((l) => { const s = document.createElement("span"); s.textContent = (estado.labels.find((x) => x.id === l) || {}).name || l; k.appendChild(s); });
      card.comments.forEach((m) => { const q = document.createElement("p"); q.textContent = m.usuario + ": " + m.texto; k.appendChild(q); });
      k.appendChild(controlesDe("cards", card, estado)); cd.appendChild(k);
    });
    cd.appendChild(controlesDe("columns", col, estado)); app.appendChild(cd);
  });
  estado.labels.forEach((l) => { const s = document.createElement("span"); s.textContent = l.name; app.appendChild(s); });
}`;
const dk = app("kanban", KAN, DIB_KAN, ".column{} .card{}", readFileSync(join(FX, "js/logica.js"), "utf8"));
writeFileSync(join(dk, "contrato.json"), readFileSync(join(FX, "contrato.json")));
const pk2 = await probePage(join(dk, "probe.html"));
t("Kanban real: la sonda de dibujo no encuentra problemas", pk2.probe?.ok && step("dibujo").expect(pk2.probe).length === 0, JSON.stringify(pk2.probe));
const g = await validationGates({ artifact: join(dk, "index.html"), outDir: dk, input: { refined: JSON.parse(readFileSync(join(FX, "refined.json"), "utf8")) }, specialist: { standard: { id: "web/app/estado" } } });
t("Kanban real: la compuerta de Validation da 6/6 acciones con datos de verdad (antes 1/6)", g.result === "PASS" && g.rows.length === 6 && g.rows.every((r) => !r.problem), JSON.stringify(g.rows));
const html = await (async () => { const { chromium } = await import("playwright"); const b = await chromium.launch(); const pg = await b.newPage(); await pg.goto("file://" + join(dk, "index.html")); const o = await pg.evaluate(() => ({ mover: [...document.querySelectorAll('.ctl-accion select[data-campo="targetColumnId"]')][0]?.options.length, cols: document.querySelectorAll(".column").length, editar: document.querySelector('.ctl-accion input[data-campo="titulo"]')?.value })); await b.close(); return o; })();
t("Kanban real: mover ofrece las otras columnas (no la propia) y editar arranca con el texto actual", html.mover === html.cols - 1 && html.editar === "Diseñar estructura base", JSON.stringify(html));

// ---------- 4. v0.4.1 (6ª corrida real): un destino sin "origen" no es contexto ----------
const FX6 = fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/real_kanban_c6/", import.meta.url));
const C6 = P(JSON.parse(readFileSync(join(FX6, "contrato.json"), "utf8")));
const p6 = controlsPlan(C6);
t("6ª corrida: moverTarjeta(tarjetaId, nuevaColumnaId) → el destino es elección (el ejemplo no es la columna donde está)", row(p6, "moverTarjeta").ctx.length === 0 && row(p6, "moverTarjeta").choice[0]?.p === "nuevaColumnaId" && row(p6, "moverTarjeta").choice[0]?.notHere === true, JSON.stringify(row(p6, "moverTarjeta")));
t("6ª corrida: borrarTarjeta(tarjetaId, columnaId) → la columna es contexto (el ejemplo es donde está)", row(p6, "borrarTarjeta").ctx[0]?.p === "columnaId" && row(p6, "borrarTarjeta").choice.length === 0);
t("4ª corrida sigue igual: origen = contexto, destino = elección", row(pk, "moverTarjeta").ctx.map((x) => x.p).join() === "sourceColumnId" && row(pk, "moverTarjeta").choice.map((x) => x.p).join() === "targetColumnId");
// mover de verdad: con el acciones.js de la corrida (v0.4.0) la tarjeta queda en la misma columna; con el nuevo cambia
const moveTest = async (dir) => {
  const { chromium } = await import("playwright"); const b = await chromium.launch(); const pg = await b.newPage();
  await pg.goto("file://" + join(dir, "index.html"));
  const where = () => pg.evaluate(() => { const c = estado.columns.find((x) => x.cards.some((k) => k.id === "card-1")); return c && c.id; });
  const before = await where();
  const opts = await pg.evaluate(() => { const card = document.getElementById("card-1"); const s = card.querySelector('select[data-campo="nuevaColumnaId"]'); return s ? [...s.options].map((o) => o.value) : null; });
  await pg.evaluate(() => document.getElementById("card-1").querySelector('[data-accion="moverTarjeta"]').click());
  const after = await where(); await b.close();
  return { before, after, opts };
};
const old6 = await moveTest(FX6);
t("6ª corrida tal cual (v0.4.0): 'Mover tarjeta' deja la tarjeta en la misma columna (el PASS falso de R2)", old6.before === old6.after && old6.opts === null, JSON.stringify(old6));
const d6 = app("kanban6", C6, readFileSync(join(FX6, "js/dibujo.js"), "utf8"), readFileSync(join(FX6, "styles.css"), "utf8"), readFileSync(join(FX6, "js/logica.js"), "utf8"));
const new6 = await moveTest(d6);
t("v0.4.1, con el dibujo y la lógica reales de la 6ª corrida: mover ofrece las otras columnas y la tarjeta cambia de columna", new6.before === "col-pendiente" && new6.after !== new6.before && new6.opts?.length === 2 && !new6.opts.includes("col-pendiente"), JSON.stringify(new6));
writeFileSync(join(d6, "contrato.json"), readFileSync(join(FX6, "contrato.json")));
const g6 = await validationGates({ artifact: join(d6, "index.html"), outDir: d6, input: { refined: JSON.parse(readFileSync(join(FX6, "refined.json"), "utf8")) }, specialist: { standard: { id: "web/app/estado" } } });
t("v0.4.1, 6ª corrida: la compuerta sigue 6/6", g6.result === "PASS" && g6.rows.length === 6, JSON.stringify(g6.rows));

// ---------- 5. v0.4.2 (seguridad): la sonda de dibujo le avisa al autor si escribe textos con innerHTML ----------
{
  const d = app("kanban6_xss", C6, readFileSync(join(FX6, "js/dibujo.js"), "utf8"), readFileSync(join(FX6, "styles.css"), "utf8"), readFileSync(join(FX6, "js/logica.js"), "utf8"));
  const pr6 = await probePage(join(d, "probe.html"));
  const m6 = step("dibujo").expect(pr6.probe).join(" | ");
  t("dibujo real (6ª/7ª corrida, innerHTML con los textos) → aviso con textContent y los textos donde pasó", /escribe los textos del estado como HTML/.test(m6) && /textContent/.test(m6) && pr6.probe.htmlInText.length >= 1, m6);
  t("dibujo con textContent (Kanban 4ª) → sin aviso de HTML", (pk2.probe.htmlInText || []).length === 0 && !/como HTML/.test(step("dibujo").expect(pk2.probe).join(" ")), JSON.stringify(pk2.probe.htmlInText));
  t("la trampa no deja la pantalla rota: después se vuelve a dibujar el estado de verdad", pr6.probe.ok && pr6.probe.missing.length === 0, JSON.stringify(pr6.probe.missing));
}

// ---------- 6. v0.4.3: un contenedor de más entre #app y las piezas (builds del 14/10, columnas apiladas) ----------
{
  const FX = (n) => fileURLToPath(new URL(`../../../../profiles/web/validation/fixtures/real_kanban_c${n}/`, import.meta.url));
  const real = (n, dib) => { const fx = FX(n); return app(`kanban${n}_wrap${dib ? "_fix" : ""}`, P(JSON.parse(readFileSync(join(fx, "contrato.json"), "utf8"))), dib || readFileSync(join(fx, "js/dibujo.js"), "utf8"), readFileSync(join(fx, "styles.css"), "utf8"), readFileSync(join(fx, "js/logica.js"), "utf8")); };
  const msg = (pr) => step("dibujo").expect(pr.probe).join(" | ");
  const p10 = await probePage(join(real(10), "probe.html"));
  t("build 19-22-44: #app es flex y dibujar mete todo en .kanban-board → aviso", p10.probe.wrapper?.cls === "kanban-board" && /quedan apiladas/.test(msg(p10)) && /directo dentro de #app/.test(msg(p10)), JSON.stringify(p10.probe.wrapper));
  const p11 = await probePage(join(real(11), "probe.html"));
  t("build 20-08-35 (con el panel de crear adentro del contenedor) → aviso", p11.probe.wrapper?.cls === "kanban-board" && /display: flex/.test(msg(p11)), JSON.stringify(p11.probe.wrapper));
  // el mismo dibujo, sin el contenedor: las columnas van directo a #app
  const fixed = readFileSync(join(FX(11), "js/dibujo.js"), "utf8").replace(/const boardWrapper = document\.createElement\('div'\);[\s\S]*?appContainer\.appendChild\(boardWrapper\);/, "const boardWrapper = appContainer;");
  const d11f = real(11, fixed);
  const p11f = await probePage(join(d11f, "probe.html"));
  t("el mismo dibujo sin el contenedor → sin aviso", fixed.includes("const boardWrapper = appContainer;") && p11f.probe.wrapper === null && !/quedan apiladas/.test(msg(p11f)), JSON.stringify(p11f.probe.wrapper));
  const xs = async (dir, sel = ".columna") => { const { chromium } = await import("playwright"); const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); await pg.goto("file://" + join(dir, "index.html")); const r = await pg.evaluate((s) => [...document.querySelectorAll(s)].map((e) => Math.round(e.getBoundingClientRect().x)), sel); await b.close(); return r; };
  const [xa, xb] = [await xs(real(11)), await xs(d11f)];
  t("en pantalla: con el contenedor las 3 columnas apiladas (misma x); sin él, lado a lado", new Set(xa).size === 1 && new Set(xb).size === 3, JSON.stringify({ con: xa, sin: xb }));
  t("lista sin flex en #app → sin aviso (el chequeo solo mira cuando el CSS arma la distribución en #app)", pr.probe.wrapper === null);
  // build 20-50-53 (v0.4.3): el reintento de Gemma, después del aviso, sacó el contenedor
  const d12 = real(12);
  const p12 = await probePage(join(d12, "probe.html"));
  const x12 = await xs(d12);
  t("build 20-50-53: Gemma sacó el contenedor en el reintento → sin aviso, sin XSS, y las 3 columnas lado a lado", p12.probe.wrapper === null && step("dibujo").expect(p12.probe).length === 0 && new Set(x12).size === 3, JSON.stringify({ w: p12.probe.wrapper, m: step("dibujo").expect(p12.probe), x12 }));
  // build 22-19-17 (v0.5.1): el reintento cambió .kanban-board por .column-list (mismo problema) y metió los
  // controles de "app" en otra caja: con 2 hijos el chequeo no saltaba. Y "2023-10-26T10:00:00Z" se mostraba
  // formateado: la sonda lo daba como texto que no se ve.
  const d13 = real(13);
  const p13 = await probePage(join(d13, "probe.html"));
  const x13 = await xs(d13, ".column");
  t("build 22-19-17: .column-list + una caja que solo envuelve controles → aviso (antes se escapaba)", p13.probe.wrapper?.cls === "column-list" && x13.length === 3 && new Set(x13).size === 1, JSON.stringify({ w: p13.probe.wrapper, x13 }));
  t("build 22-19-17: una fecha ISO mostrada formateada no cuenta como texto que falta", !p13.probe.missing.some((m) => /2023-10-26T/.test(m)), JSON.stringify(p13.probe.missing));
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
