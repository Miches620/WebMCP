// test_estado.mjs — Standard web/app/estado (12/10). Sin LM: contrato, pruebas de la lógica, sonda de
// dibujo y sonda de llamadas, con DOS apps distintas (una lista y un contador) para ver que el Standard
// no sabe de ninguna.
//   node standards/web/app/estado/test_estado.mjs
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S, { contractText, appHints } from "./standard.mjs";
import { parseContract, toIdentifier, contractProblems, gapsOf, datosJs } from "./contract.mjs";
import { logicTests, nonData, observeChanges } from "./acceptance.mjs";
import { loadScripts, runAcceptance } from "../../../../harness/js_tools.mjs";
import { callsProblems, disabledButtons, pageHtml, runCallsProbe, probePage } from "../../../../profiles/web/specialist/files_kit.mjs";
import { getStandard } from "../../../registry.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

// ---------- dos apps ----------
const LISTA = { h: { features: ["Agregar", "Borrar", "Marcar hecho", "Ver la lista", "Estilo claro"], style: [5] },
  json: { estado: { items: [{ id: 1, texto: "Comprar pan", hecho: false }, { id: 2, texto: "Llamar a Ana", hecho: true }], siguiente: 3 },
    acciones: [
      { nombre: "agregar item", params: ["texto"], ejemplo: ["Nuevo"], hace: "agrega", control: "formulario", features: [1], cambia: ["items", "siguiente"] },
      { nombre: "borrarItem", params: ["estado", "id"], ejemplo: [1], hace: "saca", control: "botón", features: ["R2"], cambia: ["items"] },
      { nombre: "marcarHecho", params: ["id"], ejemplo: [1], hace: "invierte hecho", features: [3], cambia: ["siguiente"] },
    ], se_ve: [4] } };
const CONT = { h: { features: ["Sumar", "Reiniciar"], style: [] },
  json: { estado: { titulo: "Mi contador", valor: 0 }, acciones: [
    { nombre: "sumar", params: [], ejemplo: [], control: "boton", features: [1] },
    { nombre: "reiniciar", params: [], ejemplo: [], control: "boton", features: [2] }] } };

// ---------- 1. contrato ----------
t("toIdentifier: frases, guiones y acentos → camelCase", toIdentifier("Agregar tarea") === "agregarTarea" && toIdentifier("borrar_ítem") === "borrarItem" && toIdentifier("moverTarea") === "moverTarea" && toIdentifier("añadir") === "anadir" && toIdentifier("!!") === null);
const PL = parseContract(LISTA.json, LISTA.h);
const KL = PL.items?.[0];
t("contrato: válido, nombres arreglados y 'estado' sacado de params", KL && KL.acciones.map((a) => a.nombre).join() === "agregarItem,borrarItem,marcarHecho" && PL.reports[0].renamed.join() === "agregar item → agregarItem" && KL.acciones[1].params.join() === "id", JSON.stringify(PL));
t("contrato: control con acento y por defecto 'boton'; features 'R2' → 2", KL.acciones[1].control === "boton" && KL.acciones[2].control === "boton" && KL.acciones[1].features.join() === "2");
t("contrato: 'cambia' solo con claves del estado", KL.acciones[0].cambia.join() === "items,siguiente");
t("contrato: todas las features cubiertas (la de estilo no cuenta)", gapsOf(KL, LISTA.h).length === 0 && contractProblems(PL, LISTA.h).length === 0);
const gap = parseContract({ ...LISTA.json, se_ve: [] }, LISTA.h);
t("contrato: feature sin cubrir → problema que no rompe (se reintenta)", contractProblems(gap, LISTA.h).length === 1 && /la feature 4 \("Ver la lista"\)/.test(contractProblems(gap, LISTA.h)[0]) && !contractProblems(gap, LISTA.h).fatal);
const bad = parseContract({ estado: { a: 1 }, acciones: [{ nombre: "crear" }, { nombre: "x", params: ["n"], ejemplo: [] }, { nombre: "x2" }, { nombre: "x2" }] }, {});
t("contrato: descarta nombres reservados, ejemplo que no coincide y repetidas", bad.items[0].acciones.map((a) => a.nombre).join() === "x2" && bad.dropped.length === 3 && bad.dropped.some((d) => /"crear" no se puede/.test(d)) && bad.dropped.some((d) => /un valor por cada param/.test(d)) && bad.dropped.some((d) => /repetida/.test(d)), JSON.stringify(bad.dropped));
t("contrato: sin estado / sin acciones / estado muy largo → error", !!parseContract({ acciones: [] }).error && !!parseContract({ estado: { a: 1 }, acciones: [] }).error && /muy largo/.test(parseContract({ estado: { a: "x".repeat(3000) }, acciones: [{ nombre: "a" }] }).error || ""));
t("datos.js: ESTADO_INICIAL con el estado", loadScripts([datosJs(KL.estado)], ["ESTADO_INICIAL"]).ESTADO_INICIAL.items.length === 2);

// ---------- 2. contrato (texto) ----------
const ctxL = { data: { contrato: { items: [KL] } } };
const CT = contractText(ctxL);
t("texto del contrato: antes del paso 1 dice la forma, después las acciones reales", /<una función por acción>/.test(contractText({ data: {} })) && /borrarItem\(estado, id\)/.test(CT) && /agregarItem\(estado, texto\): agrega \[formulario\]/.test(CT) && CT.includes(JSON.stringify(KL.estado)));
// código y textos que lee Gemma (sin comentarios ni la historia de evidence/pending, que sí nombra el Kanban)
const srcs = ["standard.mjs", "contract.mjs", "acceptance.mjs"].map((f) => readFileSync(fileURLToPath(new URL("./" + f, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n  (evidence|pending): \[[\s\S]*?\n  \],/g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")).join("\n");
const dom = [...new Set(srcs.match(/\b(kanban|tareas?|columnas?|contador|tablero|tarjetas?)\b/gi) || [])];
t("el Standard no nombra ninguna app (Kanban, tareas, columnas, contador…)", dom.length === 0, dom.join(", "));
t("registro: web/app/estado existe y es DRAFT", getStandard("web/app/estado").status === "DRAFT" && S.steps.map((s) => s.id).join() === "contrato,logica,pantalla,dibujo,controles");
t("pistas: features numeradas y las de estilo aparte", JSON.stringify(appHints({ features: ["a", "Estilo X"], estilo: ["Estilo X"] })) === JSON.stringify({ features: ["a", "Estilo X"], style: [2] }));
const logicStep = S.steps.find((s) => s.id === "logica");
const R = logicStep.resolve(ctxL);
t("logica: resolve arma funciones y pruebas desde el contrato", R.functions.join() === "crear,agregarItem,borrarItem,marcarHecho" && R.tests.length === 2 + 3 * 5);
t("logica: sin contrato, resolve no rompe", JSON.stringify(logicStep.resolve({ data: {} })) === "{}");

// ---------- 3. pruebas de la lógica ----------
const step = { file: "js/logica.js", global: "App", ...R };
const run = (code, c = KL, st = step) => runAcceptance(loadScripts([datosJs(c.estado), code], ["App"]).App, [], st);
const GOOD = `const App = {
  crear() { return JSON.parse(JSON.stringify(ESTADO_INICIAL)); },
  agregarItem(estado, texto) { const n = JSON.parse(JSON.stringify(estado)); n.items.push({ id: n.siguiente, texto, hecho: false }); n.siguiente++; return n; },
  borrarItem(estado, id) { return { ...estado, items: estado.items.filter((x) => x.id !== id) }; },
  marcarHecho(estado, id) { return { ...estado, items: estado.items.map((x) => x.id === id ? { ...x, hecho: !x.hecho } : x) }; }
};`;
const rg = run(GOOD);
t("lista bien hecha: pasa todas", rg.failed.length === 0 && rg.passed.length === 17, JSON.stringify(rg.failed));
const fails = (code) => run(code).failed.map((f) => `${f.fn}:${f.name}`);
t("crear que devuelve ESTADO_INICIAL mismo → falla solo crear (no ensucia las acciones)", (() => { const f = fails(GOOD.replace("return JSON.parse(JSON.stringify(ESTADO_INICIAL));", "return ESTADO_INICIAL;")); return f.length === 1 && f[0] === "crear:crear devuelve una copia nueva"; })(), fails(GOOD.replace("return JSON.parse(JSON.stringify(ESTADO_INICIAL));", "return ESTADO_INICIAL;")).join(" | "));
t("acción que modifica lo que recibe → 'no modifica'", fails(GOOD.replace("const n = JSON.parse(JSON.stringify(estado)); n.items.push", "const n = estado; n.items.push")).includes("agregarItem:agregarItem no modifica el estado que recibe"));
t("acción sin return → 'devuelve un estado' (con pista)", /falta return/.test(run(GOOD.replace("return { ...estado, items: estado.items.filter((x) => x.id !== id) };", "estado.items.filter((x) => x.id !== id);")).failed.find((f) => f.name === "borrarItem devuelve un estado")?.detail || ""));
t("acción que devuelve solo una parte → 'conserva las claves'", fails(GOOD.replace("return { ...estado, items: estado.items.filter((x) => x.id !== id) };", "return { items: estado.items.filter((x) => x.id !== id) };")).includes("borrarItem:borrarItem conserva las claves del estado"));
t("acción que no hace nada → 'hace algo'", fails(GOOD.replace("x.id === id ? { ...x, hecho: !x.hecho } : x", "x")).includes("marcarHecho:marcarHecho hace algo"));
t("estado con un elemento o una función → 'solo datos'", fails(GOOD.replace("texto, hecho: false }", "texto, hecho: false, quitar() {} }")).includes("agregarItem:agregarItem: el estado son solo datos") && nonData({ a: [1, { b: NaN }] }) === "estado.a[1].b es NaN" && nonData({ a: new Map() })?.includes("Map") && nonData({ a: [1, "x", null, { b: true }] }) === null);
t("falta una acción → contrato (fatal)", run(GOOD.replace(/,\n  marcarHecho[\s\S]*?\n};/, "\n};")).failed[0]?.name === "contrato");
const obs = observeChanges(KL)(loadScripts([datosJs(KL.estado), GOOD], ["App"]).App);
t("observación (no bloquea): 'cambia' que dijo Gemma vs lo que cambió", obs.find((o) => o.accion === "marcarHecho").ok === false && obs.find((o) => o.accion === "agregarItem").ok === true);

const KC = parseContract(CONT.json, CONT.h).items[0];
const stepC = { file: "js/logica.js", global: "App", ...logicStep.resolve({ data: { contrato: { items: [KC] } } }) };
const CGOOD = `const App = { crear() { return { ...ESTADO_INICIAL }; }, sumar(e) { return { ...e, valor: e.valor + 1 }; }, reiniciar(e) { return { ...e, valor: 0 }; } };`;
const rc = run(CGOOD, KC, stepC);
t("contador: reiniciar no cambia el estado inicial pero sí después de sumar → 'hace algo' pasa", rc.failed.length === 0, JSON.stringify(rc.failed));
t("contador: reiniciar que no hace nada → falla", run(CGOOD.replace("reiniciar(e) { return { ...e, valor: 0 }; }", "reiniciar(e) { return { ...e }; }"), KC, stepC).failed.some((f) => f.name === "reiniciar hace algo"));

// ---------- 4. pantalla y sondas ----------
t("disabledButtons: cualquier botón con disabled", disabledButtons('<button id="a">x</button><button class="b" disabled>y</button>').length === 1 && disabledButtons('<button data-disabled="no">x</button>').length === 0);
const draw = S.steps.find((s) => s.id === "dibujo");
t("dibujo: sonda → mensajes (vacío, textos que faltan, [object Object], undefined)", (() => {
  const m = draw.expect({ children: 0, missing: ["Comprar pan"], objectText: "[object Object]", undef: ["undefined"] });
  return m.length === 4 && /no dibujó nada/.test(m[0]) && /"Comprar pan"/.test(m[1]) && /\[object Object\]/.test(m[2]) && /"undefined"/.test(m[3]);
})());
const cs = S.steps.find((s) => s.id === "controles").resolve(ctxL).calls;
t("controles: llamadas = acciones de botón y formulario", cs.methods.join() === "agregarItem,borrarItem,marcarHecho" && cs.forms.join() === "agregarItem");
const cp = callsProblems({ found: true, calls: { borrarItem: 2, agregarItem: 1 }, undrawn: { borrarItem: 2 }, reloads: [], errors: [], controls: 3, tracked: true }, cs);
t("callsProblems: acción sin control y acción sin dibujar", cp.length === 2 && /ningún control de la pantalla llama a App.marcarHecho \(un botón con data-accion="marcarHecho"/.test(cp[0]) && /después de App.borrarItem no se llama a dibujar/.test(cp[1]), cp.join(" | "));
const cr = callsProblems({ found: true, calls: {}, undrawn: {}, reloads: ["BUTTON:agregar"], errors: [], controls: 1, tracked: true }, cs);
t("callsProblems: formulario que recarga → lo dice una vez (no 'ningún control llama')", /recarga la página/.test(cr[0]) && !cr.some((x) => /llama a App.agregarItem/.test(x)));
t("callsProblems: sin App → fatal", callsProblems({ found: false }, cs).fatal === true);

// Chromium: la lista entera (datos + lógica + dibujo + controles) con la sonda de dibujo y la de llamadas
{
  const dir = mkdtempSync(join(tmpdir(), "estado-"));
  const DIBUJO = `function dibujar(estado) {
  const app = document.getElementById("app"); app.innerHTML = "";
  estado.items.forEach((it) => {
    const d = document.createElement("div"); d.textContent = it.texto + (it.hecho ? " ✓" : "");
    for (const [t, a] of [["Borrar", "borrarItem"], ["Hecho", "marcarHecho"]]) { const b = document.createElement("button"); b.textContent = t; b.dataset.accion = a; b.dataset.id = it.id; d.appendChild(b); }
    app.appendChild(d);
  });
}`;
  const CONTROLES = (prevent, borrar) => `let estado = App.crear();
document.getElementById("app").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-accion]"); if (!b) return;
  const id = Number(b.dataset.id);
  ${borrar ? 'if (b.dataset.accion === "borrarItem") estado = App.borrarItem(estado, id);' : ""}
  if (b.dataset.accion === "marcarHecho") { estado = App.marcarHecho(estado, id); return; }
  dibujar(estado);
});
document.getElementById("f").addEventListener("submit", (ev) => { ${prevent ? "ev.preventDefault();" : ""} estado = App.agregarItem(estado, document.getElementById("txt").value); dibujar(estado); });
dibujar(estado);`;
  const page = (name, files, inline = "") => {
    const d = join(dir, name); mkdirSync(join(d, "js"), { recursive: true });
    for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c);
    writeFileSync(join(d, "index.html"), pageHtml({ title: "T", fragment: '<form id="f"><input id="txt" type="text"><button type="submit">Agregar</button></form><div id="app"></div>', scripts: Object.keys(files), inline, mainId: "principal" }));
    return join(d, "index.html");
  };
  const base = { "js/datos.js": datosJs(KL.estado), "js/logica.js": GOOD, "js/dibujo.js": DIBUJO };
  const pr = await probePage(page("dibujo", base, draw.probe));
  t("Chromium: sonda de dibujo de la lista sin problemas", pr.probe?.ok && draw.expect(pr.probe).length === 0 && pr.probe.total === 2, JSON.stringify(pr));
  const prBad = await probePage(page("dibujo_mal", { ...base, "js/dibujo.js": DIBUJO.replace("it.texto +", "it +") }, draw.probe));
  t("Chromium: dibujo que escribe el objeto → [object Object] y textos que faltan", (() => { const m = draw.expect(prBad.probe); return m.length === 2 && /\[object Object\]/.test(m[1]); })(), JSON.stringify(prBad.probe));
  const rOk = await runCallsProbe(page("bien", { ...base, "js/controles.js": CONTROLES(true, true).replace("estado = App.marcarHecho(estado, id); return;", "estado = App.marcarHecho(estado, id);") }), cs);
  t("Chromium: controles bien → todas las acciones se llaman y se dibuja", callsProblems(rOk, cs).length === 0 && rOk.calls.agregarItem >= 1 && rOk.calls.borrarItem >= 1 && rOk.tracked, JSON.stringify(rOk));
  const rBad = await runCallsProbe(page("mal", { ...base, "js/controles.js": CONTROLES(true, false) }), cs);
  const pb = callsProblems(rBad, cs);
  t("Chromium: falta borrar y marcar no dibuja → 2 problemas", pb.length === 2 && pb.some((x) => /llama a App.borrarItem/.test(x)) && pb.some((x) => /después de App.marcarHecho no se llama a dibujar/.test(x)), pb.join(" | "));
  const rRel = await runCallsProbe(page("recarga", { ...base, "js/controles.js": CONTROLES(false, true) }), cs);
  t("Chromium: formulario sin preventDefault → recarga la página", callsProblems(rRel, cs).some((x) => /recarga la página/.test(x)), JSON.stringify(rRel));
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
