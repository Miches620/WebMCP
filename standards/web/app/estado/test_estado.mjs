// test_estado.mjs — Standard web/app/estado (12/10). Sin LM: contrato, pruebas de la lógica, sonda de
// dibujo y sonda de llamadas, con DOS apps distintas (una lista y un contador) para ver que el Standard
// no sabe de ninguna.
//   node standards/web/app/estado/test_estado.mjs
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S, { contractText, appHints, cssClasses } from "./standard.mjs";
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
      { nombre: "agregar item", params: ["texto"], ejemplo: ["Nuevo"], hace: "agrega", features: [1], cambia: ["items", "siguiente"] },
      { nombre: "borrarItem", params: ["estado", "id"], ejemplo: [1], hace: "saca", features: ["R2"], cambia: ["items"] },
      { nombre: "marcarHecho", params: ["id"], ejemplo: [1], hace: "invierte hecho", features: [3], cambia: ["siguiente"] },
    ], se_ve: [4] } };
const CONT = { h: { features: ["Sumar", "Reiniciar"], style: [] },
  json: { estado: { titulo: "Mi contador", valor: 0 }, acciones: [
    { nombre: "sumar", params: [], ejemplo: [], features: [1] },
    { nombre: "reiniciar", params: [], ejemplo: [], features: [2] }] } };

// ---------- 1. contrato ----------
t("toIdentifier: frases, guiones y acentos → camelCase", toIdentifier("Agregar tarea") === "agregarTarea" && toIdentifier("borrar_ítem") === "borrarItem" && toIdentifier("moverTarea") === "moverTarea" && toIdentifier("añadir") === "anadir" && toIdentifier("!!") === null);
const PL = parseContract(LISTA.json, LISTA.h);
const KL = PL.items?.[0];
t("contrato: válido, nombres arreglados y 'estado' sacado de params", KL && KL.acciones.map((a) => a.nombre).join() === "agregarItem,borrarItem,marcarHecho" && PL.reports[0].renamed.join() === "agregar item → agregarItem" && KL.acciones[1].params.join() === "id", JSON.stringify(PL));
t("contrato v0.2: el harness separa ids (su ejemplo es un id del estado) y campos; features 'R2' → 2", KL.acciones[0].campos.join() === "texto" && KL.acciones[0].ids.length === 0 && KL.acciones[1].ids.join() === "id" && KL.acciones[1].campos.length === 0 && KL.acciones[1].features.join() === "2");
t("contrato v0.2: un campo con una lista de ejemplo se descarta (un elemento por vez)", /lo escribe el usuario en un campo/.test(parseContract({ estado: { items: [{ id: 1 }] }, acciones: [{ nombre: "a", params: ["id", "tags"], ejemplo: [1, ["x"]] }, { nombre: "b" }] }, {}).dropped[0] || ""));
t("contrato v0.2: un contador de arriba (siguiente: 3) no es un id", parseContract({ estado: { items: [{ id: 1 }], siguiente: 3 }, acciones: [{ nombre: "a", params: ["n"], ejemplo: [3] }] }, {}).items[0].acciones[0].campos.join() === "n");
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
t("texto del contrato: antes del paso 1 dice la forma, después las acciones reales", /<una función por acción>/.test(contractText({ data: {} })) && /borrarItem\(estado, id\)/.test(CT) && /agregarItem\(estado, texto\): agrega/.test(CT) && /"items": cada elemento de estado\.items\[\] → Borrar item, Marcar hecho/.test(CT) && /"app" \(acciones generales, elemento null\).*Agregar item/.test(CT) && CT.includes(JSON.stringify(KL.estado)));
// código y textos que lee Gemma (sin comentarios ni la historia de evidence/pending, que sí nombra el Kanban)
const srcs = ["standard.mjs", "contract.mjs", "acceptance.mjs", "controls.mjs"].map((f) => readFileSync(fileURLToPath(new URL("./" + f, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n  (evidence|pending): \[[\s\S]*?\n  \],/g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n")).join("\n");
const dom = [...new Set(srcs.match(/\b(kanban|tareas?|columnas?|contador|tablero|tarjetas?)\b/gi) || [])];
t("el Standard no nombra ninguna app (Kanban, tareas, columnas, contador…)", dom.length === 0, dom.join(", "));
t("registro: web/app/estado existe y es DRAFT", getStandard("web/app/estado").status === "DRAFT" && S.steps.map((s) => s.id).join() === "contrato,logica,acciones,pantalla,dibujo,controles,enlace");
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
t("pantalla v0.2: app.html sin formularios ni botones (forbidTags)", S.steps.find((s) => s.id === "pantalla").forbidTags.join() === "form,input,button,select,textarea");
t("cssClasses: clases con estilo (sin comentarios ni decimales)", cssClasses(".a{x} .card:hover, .b .c-d{} /* .z{} */ @media(x){.e{}} p { width:.5em }").join() === "a,card,b,c-d,e");
const draw0 = S.steps.find((s) => s.id === "dibujo");
const draw = { ...draw0, ...draw0.resolve({ ...ctxL, files: { "styles.css": ".item{color:red} .nueva{}" } }) };
t("dibujo: sonda → mensajes (vacío, textos, [object Object], undefined, botón, id, campo, clases)", (() => {
  const m = draw.expect({ children: 0, missing: ["Comprar pan"], objectText: "[object Object]", undef: ["undefined"], noButton: ["marcarHecho@items"], noId: ["borrarItem:id"], noField: ["agregarItem:texto"], unstyled: ["kanban-card"], unused: ["card"], pairs: ["kanban-card~card"] });
  return m.length === 8 && /no dibujó nada/.test(m.join()) && /faltan los controles de: marcarHecho \(agregá controlesDe\("items", elemento, estado\)/.test(m.join()) && /b\.dataset\.id/.test(m.join()) && /data-campo="texto"/.test(m.join()) && /\.kanban-card.*\.card/.test(m.join()) && /\[object Object\]/.test(m.join());
})());
t("dibujo: clases sin estilo solo si además hay clases del CSS que nadie usa", draw.expect({ children: 1, unstyled: ["fila"], unused: [] }).length === 0);
t("dibujo v0.2.1: clase sin estilo propio que no se parece a nada y la mayoría con estilo → no es problema (2ª corrida real: .tag, .tarjetas)", draw.expect({ children: 1, unstyled: ["tarjetas", "tag"], unused: ["crear-card-controls"], pairs: [], styledShare: 0.8 }).length === 0 && draw.expect({ children: 1, unstyled: ["x", "y"], unused: ["z"], pairs: [], styledShare: 0.3 }).length === 1);
const cs = S.steps.find((s) => s.id === "controles").resolve(ctxL).calls;
t("controles v0.2: todas las acciones son de botón; la pista dice la llamada exacta", cs.methods.join() === "agregarItem,borrarItem,marcarHecho" && cs.forms.length === 0 && /App\.borrarItem\(estado, Number\(b\.dataset\.id\)\)/.test(cs.hints.borrarItem) && /App\.agregarItem\(estado, b\.parentElement\.querySelector\('\[data-campo="texto"\]'\)\.value\)/.test(cs.hints.agregarItem), JSON.stringify(cs.hints));
t("contrato (texto) v0.4: dibujo usa controlesDe y no dibuja botones propios; app.html solo título y #app", /controlesDe\(tipo, elemento, estado\)/.test(CT) && /NO dibuja botones ni campos propios/.test(CT) && /js\/acciones\.js \(lo escribe el harness\)/.test(CT) && /SOLO el título/.test(CT) && !/b\.dataset\.accion = "borrarItem"/.test(CT));
const cp = callsProblems({ found: true, calls: { borrarItem: 2, agregarItem: 1 }, undrawn: { borrarItem: 2 }, reloads: [], errors: [], controls: 3, tracked: true }, cs);
t("callsProblems: acción sin control y acción sin dibujar", cp.length === 2 && /ningún control de la pantalla llama a App.marcarHecho/.test(cp[0]) && /después de App.borrarItem no se llama a dibujar/.test(cp[1]), cp.join(" | "));
t("callsProblems: sin App → fatal", callsProblems({ found: false }, cs).fatal === true);

// Chromium: la lista entera (datos + lógica + dibujo + controles) con la sonda de dibujo y la de llamadas
{
  const dir = mkdtempSync(join(tmpdir(), "estado-"));
  const DIBUJO = `function dibujar(estado) {
  const app = document.getElementById("app"); app.innerHTML = "";
  const n = document.createElement("div"); n.className = "nueva";
  const i = document.createElement("input"); i.dataset.campo = "texto"; n.appendChild(i);
  const a = document.createElement("button"); a.textContent = "Agregar"; a.dataset.accion = "agregarItem"; n.appendChild(a);
  app.appendChild(n);
  estado.items.forEach((it) => {
    const d = document.createElement("div"); d.className = "item"; d.textContent = it.texto + (it.hecho ? " ✓" : "");
    for (const [t, a] of [["Borrar", "borrarItem"], ["Hecho", "marcarHecho"]]) { const b = document.createElement("button"); b.textContent = t; b.dataset.accion = a; b.dataset.id = it.id; d.appendChild(b); }
    app.appendChild(d);
  });
}`;
  const CONTROLES = (borrar, drawAfterMark = false) => `let estado = App.crear();
document.getElementById("app").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-accion]"); if (!b) return;
  const id = Number(b.dataset.id);
  if (b.dataset.accion === "agregarItem") estado = App.agregarItem(estado, b.parentElement.querySelector('[data-campo="texto"]').value);
  ${borrar ? 'if (b.dataset.accion === "borrarItem") estado = App.borrarItem(estado, id);' : ""}
  if (b.dataset.accion === "marcarHecho") { estado = App.marcarHecho(estado, id); ${drawAfterMark ? "" : "return;"} }
  dibujar(estado);
});
dibujar(estado);`;
  const page = (name, files, inline = "") => {
    const d = join(dir, name); mkdirSync(join(d, "js"), { recursive: true });
    for (const [f, c] of Object.entries(files)) writeFileSync(join(d, f), c);
    writeFileSync(join(d, "index.html"), pageHtml({ title: "T", fragment: '<h1>Lista</h1><div id="app"></div>', scripts: Object.keys(files).filter((f) => f.endsWith(".js")), inline, mainId: "principal" }));
    return join(d, "index.html");
  };
  const base = { "styles.css": ".item{color:red} .nueva{display:flex}", "js/datos.js": datosJs(KL.estado), "js/logica.js": GOOD, "js/dibujo.js": DIBUJO };
  const pr = await probePage(page("dibujo", base, draw.probe));
  t("Chromium: sonda de dibujo de la lista sin problemas", pr.probe?.ok && draw.expect(pr.probe).length === 0 && pr.probe.total === 2, JSON.stringify(pr));
  const prBad = await probePage(page("dibujo_mal", { ...base, "js/dibujo.js": DIBUJO.replace("it.texto +", "it +").replace('d.className = "item"', 'd.className = "lista-item"').replace('i.dataset.campo = "texto"', 'i.name = "texto"').replace('["Hecho", "marcarHecho"]', '["Hecho", "otra"]') }, draw.probe));
  t("Chromium: dibujo mal → [object Object], textos, botón que falta, campo que falta y clases sin estilo", (() => { const m = draw.expect(prBad.probe).join(" | "); return /\[object Object\]/.test(m) && /faltan los controles de: marcarHecho/.test(m) && /data-campo="texto"/.test(m) && /\.lista-item.*\.item/.test(m); })(), JSON.stringify(prBad.probe));
  const rOk = await runCallsProbe(page("bien", { ...base, "js/controles.js": CONTROLES(true, true) }), cs);
  t("Chromium: controles bien → todas las acciones se llaman y se dibuja", callsProblems(rOk, cs).length === 0 && rOk.calls.agregarItem >= 1 && rOk.calls.borrarItem >= 1 && rOk.tracked, JSON.stringify(rOk));
  // Validation (12/10): action_changes completa los campos al lado del botón, lo aprieta y mira que cambie
  {
    const { validationFor } = await import("../../../../profiles/web/validation/check_catalog.mjs");
    const V = validationFor(["web", "web/app"]);
    const okP = page("val_bien", { ...base, "js/controles.js": CONTROLES(true, true) });
    const rv = await V.runChecks(okP, [{ type: "action_changes", params: { click: ["agregar", "item"] } }, { type: "action_changes", params: { click: ["borrar", "item"] } }]);
    const rm = await V.runChecks(page("val_mal", { ...base, "js/controles.js": CONTROLES(false) }), [{ type: "action_changes", params: { click: ["borrar", "item"] } }]);
    t("Validation action_changes: agregar (con campo) y borrar PASS; borrar sin conectar FAIL", rv.every((x) => x.result === "PASS") && /1 campo/.test(rv[0].detail) && rm[0].result === "FAIL", JSON.stringify([...rv, ...rm].map((x) => x.detail)));
  }
  const rBad = await runCallsProbe(page("mal", { ...base, "js/controles.js": CONTROLES(false) }), cs);
  const pb = callsProblems(rBad, cs);
  t("Chromium: falta borrar y marcar no dibuja → 2 problemas", pb.length === 2 && pb.some((x) => /llama a App.borrarItem/.test(x)) && pb.some((x) => /después de App.marcarHecho no se llama a dibujar/.test(x)), pb.join(" | "));
  const FORM = DIBUJO.replace('app.appendChild(n);', 'app.appendChild(n); const f = document.createElement("form"); f.innerHTML = "<input name=q><button>Enviar</button>"; app.appendChild(f);');
  const rRel = await runCallsProbe(page("recarga", { ...base, "js/dibujo.js": FORM, "js/controles.js": CONTROLES(true, true) }), cs);
  t("Chromium: un <form> que nadie escucha → recarga la página", callsProblems(rRel, cs).some((x) => /apretar "enviar" recarga la página/.test(x)), JSON.stringify(rRel));
  // v0.2.1 (Kanban real, 2ª corrida): data-itemId en innerHTML → dataset.itemid (el HTML pasa a minúsculas)
  {
    const KI = parseContract({ estado: { items: [{ id: "a1", texto: "Uno Dos" }] }, acciones: [{ nombre: "borrar", params: ["itemId"], ejemplo: ["a1"] }] }, {}).items[0];
    const st = { ...draw0, ...draw0.resolve({ data: { contrato: { items: [KI] } }, files: {} }) };
    const HTMLDRAW = 'function dibujar(e) { document.getElementById("app").innerHTML = e.items.map((it) => `<div>${it.texto}<button data-accion="borrar" data-itemId="${it.id}">x</button></div>`).join(""); }';
    const r = await probePage(page("minus", { "js/datos.js": datosJs(KI.estado), "js/logica.js": "const App = { crear() { return JSON.parse(JSON.stringify(ESTADO_INICIAL)); }, borrar(e, id) { return { ...e, items: e.items.filter((x) => x.id !== id) }; } };", "js/dibujo.js": HTMLDRAW }, st.probe));
    const call = S.steps.find((x) => x.id === "controles").resolve({ data: { contrato: { items: [KI] } } }).calls.hints.borrar;
    t("v0.2.1: data-itemId en HTML cuenta (dataset.itemid) y controles lee b.dataset.itemid", r.probe?.ok && r.probe.noId.length === 0 && /b\.dataset\.itemid\)/.test(call) && /b\.dataset\.itemid/.test(S.steps.find((x) => x.id === "controles").write({ data: { contrato: { items: [KI] } } })["js/controles.js"]), JSON.stringify(r.probe) + call);
  }
  // v0.2.2 (3ª corrida real): un ícono sin campo + un "Guardar" con el campo en un grupo display:none
  {
    const HID = DIBUJO.replace('n.appendChild(i);', 'const g = document.createElement("div"); g.style.display = "none"; g.appendChild(i); const s = document.createElement("button"); s.textContent = "Guardar"; s.dataset.accion = "agregarItem"; g.appendChild(s); n.appendChild(g);');
    const rh = await probePage(page("oculto", { ...base, "js/dibujo.js": HID }, draw.probe));
    const mh = draw.expect(rh.probe).join(" | ");
    t("v0.2.2: campo en un grupo oculto → 'ocultos (display:none)', no 'faltan'", /ocultos \(display:none\).*agregarItem → data-campo="texto"/.test(mh) && !/faltan campos/.test(mh), mh);
    const r2 = await probePage(page("dos_botones", { ...base, "js/dibujo.js": DIBUJO.replace('n.appendChild(i);', 'const ic = document.createElement("button"); ic.textContent = "+"; ic.dataset.accion = "agregarItem"; app.appendChild(ic); n.appendChild(i);') }, draw.probe));
    t("v0.2.2: vale cualquier botón de la acción (un ícono sin campo + otro con su campo visible)", draw.expect(r2.probe).length === 0, JSON.stringify(r2.probe));
    const { validationFor } = await import("../../../../profiles/web/validation/check_catalog.mjs");
    const rv = await validationFor(["web", "web/app"]).runChecks(page("val_oculto", { ...base, "js/dibujo.js": HID, "js/controles.js": CONTROLES(true, true) }), [{ type: "action_changes", params: { click: ["agregar", "item"] } }]);
    t("v0.2.2: Validation no completa campos ocultos (3ª corrida: PASS falso en Crear)", !/campo/.test(rv[0].detail), rv[0].detail);
  }
  // v0.3.0 (punto 8): controles.js lo escribe el harness desde el contrato
  {
    const ctl = S.steps.find((x) => x.id === "controles");
    const gen = ctl.write(ctxL)["js/controles.js"];
    t("v0.3.0: controles lo escribe el harness (write), con la llamada de cada acción desde el contrato", /case "borrarItem": estado = App\.borrarItem\(estado, num\(b\.dataset\.id\)\)/.test(gen) && /case "agregarItem": if \(campo\(b, "texto"\) === ""\) return; estado = App\.agregarItem\(estado, campo\(b, "texto"\)\)/.test(gen) && JSON.stringify(ctl.write({ data: {} })) === "{}", gen);
    const rg = await runCallsProbe(page("gen_bien", { ...base, "js/controles.js": gen }), cs);
    t("Chromium v0.3.0: con un dibujo que cumple el contrato, el controles generado llama a todas las acciones y dibuja", callsProblems(rg, cs).length === 0 && (rg.args.borrarItem || []).some((a) => typeof a[1] === "number") && rg.calls.agregarItem >= 1, JSON.stringify(rg));
    const rh = await runCallsProbe(page("gen_sin_campo", { ...base, "js/dibujo.js": DIBUJO.replace('i.dataset.campo = "texto"', 'i.name = "texto"'), "js/controles.js": gen }), cs);
    t("Chromium v0.3.0: si dibujo no pone el campo, la acción llega con undefined (la culpa queda en dibujo, no hay error de JS)", (rh.args.agregarItem || []).every((a) => a[1] === "__undefined__") && rh.errors.length === 0, JSON.stringify(rh));
    const KC0 = parseContract(CONT.json, CONT.h).items[0];
    const genC = ctl.write({ data: { contrato: { items: [KC0] } } })["js/controles.js"];
    t("v0.3.0: otra app (contador, acciones sin params) → sin campos ni ids", /case "sumar": estado = App\.sumar\(estado\); break;/.test(genC) && !/campo\(b, "/.test(genC.split("switch")[1]), genC);
  }
  // (un <button> dentro de un <form> dibujado no recarga si el listener vuelve a dibujar: el form se saca antes del submit;
  // la detección de recarga se sigue probando en la sonda, ver runCallsProbe)
}

// v0.5.1 (14/10, build 2026-10-14T22-19-17): contrato.json guarda el contrato ELEGIDO y se vuelve a leer igual
{
  const st = S.steps.find((x) => x.id === "contrato");
  const parsedL = { items: [KL] };
  const back = parseContract(JSON.parse(st.answerOf(parsedL)), {}).items?.[0];
  t("contrato.json = el contrato elegido (answerOf), y se vuelve a leer igual (mismo estado y acciones)", typeof st.answerOf === "function" && JSON.stringify(back.estado) === JSON.stringify(KL.estado) && back.acciones.map((a) => a.nombre).join() === KL.acciones.map((a) => a.nombre).join() && back.acciones.every((a, k) => JSON.stringify(a.ejemplo) === JSON.stringify(KL.acciones[k].ejemplo)));
}
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
