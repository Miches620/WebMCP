// test_components.mjs — partes deterministas del Specialist por componentes (v0.7).
//   node build/test_components.mjs
import { autoInvoke, scopeCss, scopeSelector, cleanTokens, normalizeComponentHtml, parseComponentResponse, applyComponentResponse,
  componentsFromPlan, initialState, assemble, tasksFor, jsError, wrapJs,
  assignTasks, mainComponent, notesText, dropRootRedeclare } from "./components.mjs";
import { duplicateIds } from "./specialist_components.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

const plan = { header: { features: ["R2"] }, sections: [{ id: "inicio", titulo: "Inicio", features: ["R1"] }, { id: "contacto", titulo: "Contacto", features: ["R3"] }], footer: { features: ["R4"] }, transversales: ["R5"] };
const feats = ["Hero con título y botón", "Barra de navegación fija", "Formulario de contacto", "Pie de página", "Animaciones al hacer scroll"];
const comps = componentsFromPlan(plan, feats);
const inicio = comps.find((c) => c.id === "inicio");
const root = { id: "inicio", tag: "section", classes: ["hero"] };

t("componentes desde el plan: header, secciones en orden, footer", comps.map((c) => c.id).join(",") === "site-header,inicio,contacto,site-footer");
t("selector interno → #id adelante", scopeSelector(".boton", root) === "#inicio .boton");
t("selector de la raíz por tag → #id", scopeSelector("section.visible", root) === "#inicio.visible");
t("selector de la raíz por su clase → #id", scopeSelector(".hero h1", root) === "#inicio.hero h1");
t("ya empieza con #id → igual", scopeSelector("#inicio .x:hover", root) === "#inicio .x:hover");
t("global (body, :root, *) → descartado", scopeSelector("body", root) === null && scopeSelector(":root", root) === null && scopeSelector("*", root) === null);
t("selector de otro tag no se confunde con la raíz", scopeSelector("article", root) === "#inicio article");

const s = scopeCss("/* c */ section { opacity: 0 }\n.card:hover, .btn { color: red }\n@media (max-width: 600px) { .grid { display: block } body { x: 1 } }\n@keyframes fade { from { opacity: 0 } to { opacity: 1 } }\n@import url(x.css);", root);
t("v0.6.1: `section{opacity:0}` queda solo en la raíz del componente", s.css.includes("#inicio { opacity: 0 }") && !/^section/m.test(s.css), s.css);
t("lista de selectores: cada uno encapsulado", s.css.includes("#inicio .card:hover, #inicio .btn"));
t("@media: reglas adentro encapsuladas y body descartado", /@media \(max-width: 600px\) \{\n#inicio \.grid/.test(s.css) && !s.css.includes("body"), s.css);
t("@keyframes se conserva", s.css.includes("@keyframes fade"));
t("@import descartado", !s.css.includes("@import") && s.dropped.some((d) => d.includes("@import")));

const tk = cleanTokens(":root{--c:#000}\nsection{opacity:0}\n.btn{color:red}\nheader, .x{display:none}\n@import url(f.css);");
t("tokens: no puede ocultar section/header", !tk.css.includes("opacity:0") && !tk.css.includes("display:none") && tk.css.includes(".btn") && tk.css.includes(":root"), tk.css);

const n1 = normalizeComponentHtml(`<!DOCTYPE html><html><head><link rel="stylesheet" href="https://cdn.x/fa.css"></head><body><!-- hero --><section id="inicio" class="hero"><h1>Hola</h1><style>.a{color:red}</style></section></body></html>`, inicio);
t("documento entero → se usa el elemento con el id", n1.html.startsWith('<section data-feature="R1" id="inicio" class="hero">') && n1.styles.includes(".a{color:red}") && !n1.html.includes("<style"), n1.html);
t("clases de la raíz detectadas", n1.classes.includes("hero"));
const n2 = normalizeComponentHtml(`<h1>Hola</h1><p>Texto</p>`, inicio);
t("contenido sin raíz → envuelto en <section id>", n2.html.startsWith('<section data-feature="R1" id="inicio">') && n2.html.includes("<p>Texto</p>"), n2.html);
const n3 = normalizeComponentHtml(`<section id="hero"><h1>Hola</h1></section>`, inicio);
t("raíz con otro id → id del harness", /^<section data-feature="R1" id="inicio">/.test(n3.html) && !n3.html.includes('id="hero"'), n3.html);
const n4 = normalizeComponentHtml(`<div id="inicio" data-feature="R9"><p>x</p></div>`, inicio);
t("raíz con otro tag → tag del componente y data-feature del harness", /^<section data-feature="R1" id="inicio">[\s\S]*<\/section>\s*$/.test(n4.html), n4.html);

const p = parseComponentResponse("### FILE: hero.html\n```html\n<section id=\"inicio\"></section>\n```\n### FILE: hero.css\n```css\n.a{}\n```\n### FILE: inicio.js\n```javascript\nlet a=1;\n```\n### APPEND: api.js\n```javascript\nwindow.api.enviar = async () => ({ ok: true });\n```");
t("nombres libres → por extensión; APPEND api.js", p.html && p.css && p.js && p.apiAppend.includes("enviar"));
const p2 = parseComponentResponse("Acá va:\n```html\n<section id=\"inicio\"></section>\n```\n```css\n.a{}\n```\n```js\nlet x=1;\n```");
t("sin encabezados ### → por lenguaje del fence", p2.html && p2.css && p2.js);

const st = initialState(comps, "Demo");
const a = applyComponentResponse(st, inicio, "### FILE: componente.html\n```html\n<section id=\"inicio\"><h1>Hola</h1></section>\n```\n### FILE: componente.js\n```javascript\nconst x = ;\n```");
t("JS con error de sintaxis → rechazado, el resto se aplica", a.rejected.some((r) => r.startsWith("js:")) && a.changed.includes("html") && !a.changed.includes("js"));
const b = applyComponentResponse(st, inicio, "### FILE: componente.js\n```javascript\nfetch('/x');\n```");
t("fetch → rechazado", b.rejected.some((r) => r.includes("fetch")));
const c2 = applyComponentResponse(st, inicio, "### FILE: componente.js\n```javascript\nconst handle = 1;\n```");
const c3 = applyComponentResponse(c2.next, comps[2], "### FILE: componente.js\n```javascript\nconst handle = 2;\n```");
const page = assemble(c3.next, comps);
const scripts = [...page.matchAll(/<script data-component="[^"]+">\n([\s\S]*?)\n<\/script>/g)].map((m) => m[1]);
t("mismo nombre en dos componentes: cada uno en su función y su <script>", scripts.length === 2 && scripts.every((x) => !jsError(x)));
t("página ensamblada: un solo archivo, sin <link> ni src externos", !/<link\b|src=/.test(page) && page.includes('<main id="app">'));
t("wrapJs da root", wrapJs("inicio", "root.x=1").includes('document.getElementById("inicio")'));

// v0.7.1: init declarada y nunca llamada (caso real Project22: header, hero, contacto)
const ai1 = autoInvoke("function initializeInicio(root) {\n  root.classList.add('x');\n}\n");
t("autoInvoke: función(root) nunca llamada → se agrega la llamada", ai1.invoked.join() === "initializeInicio" && ai1.js.includes("initializeInicio(root);"));
const ai2 = autoInvoke("function initFeatures() {}\ninitFeatures();\n");
t("autoInvoke: si ya se llama, no se duplica", ai2.invoked.length === 0);
const ai3 = autoInvoke("function validateForm(form) { return true; }\nconst setup = () => {};\n");
t("autoInvoke: helpers con otros parámetros no se llaman; init sin params sí", ai3.invoked.join() === "setup");
const ai4 = autoInvoke("function initializeContacto(root) {\n  function inner(root) {}\n}\n");
t("autoInvoke: solo funciones de primer nivel", ai4.invoked.join() === "initializeContacto");

const tasks = [
  { id: "F1.3", role: "Frontend", task: "Implementar la estructura semántica de la sección Hero." },
  { id: "F1.2", role: "Frontend", task: "Implementar la estructura semántica de Navegación (Navbar)." },
  { id: "F1.7", role: "Frontend", task: "Implementar la estructura semántica de Contacto." },
  { id: "F4.4", role: "QA", task: "Pruebas Funcionales End-to-End del Formulario de Contacto" },
];
t("notas TechLeader: hero → #inicio", tasksFor(inicio, tasks, comps).map((x) => x.id).join() === "F1.3");
t("notas TechLeader: navbar → header", tasksFor(comps[0], tasks, comps).map((x) => x.id).join() === "F1.2");
t("notas TechLeader: QA no va al Specialist", tasksFor(comps[2], tasks, comps).map((x) => x.id).join() === "F1.7");

// v0.7.3 (Boxworld build 2): toda tarea del graph llega a un componente
const bwPlan = { header: { features: [] }, sections: [{ id: "juego", titulo: "Juego", features: ["R1", "R2", "R7"] }, { id: "niveles", titulo: "Niveles", features: ["R3"] }], footer: { features: [] }, transversales: ["R4", "R5", "R6", "R8"] };
const bwFeats = ["El juego es el clásico Boxworld", "Botón reiniciar y próximo nivel", "Al menos 5 niveles", "Flechas del teclado", "De a un casillero", "Mapa fijo", "Contador de movimientos", "Estilo NES"];
const bw = componentsFromPlan(bwPlan, bwFeats);
const bwTasks = [
  { id: "F1.1", role: "Frontend", task: "Establecer la estructura base del entorno de juego (HTML/CSS)" },
  { id: "F1.2", role: "Frontend", task: "Implementar la estructura del grid 10x10", description: "Generar y aplicar el layout CSS para una cuadrícula fija" },
  { id: "F2.1", role: "Frontend", task: "Implementar el manejo de eventos del teclado para mover al Avatar" },
  { id: "F2.4", role: "Frontend", task: "Implementar la lógica de empuje de cajas (Pushing)" },
  { id: "F3.2", role: "Frontend", task: "Renderizar y actualizar el contador de movimientos en la interfaz de usuario." },
  { id: "F4.2", role: "Frontend", task: "Definir la estructura de datos para gestionar múltiples niveles del juego." },
  { id: "F4.6", role: "Frontend", task: "Implementar la funcionalidad y UI del botón 'Próximo Nivel'." },
  { id: "F5.1", role: "QA", task: "Probar que el avatar se mueve" },
];
t("principal = la sección con más requisitos", mainComponent(bw).id === "juego");
t("sin secciones → el primer componente", mainComponent(componentsFromPlan(null)).id === "site-header");
const as = assignTasks(bw, bwTasks);
const reached = new Set(Object.values(as.byComp).flat().map((x) => x.id));
t("assignTasks: ninguna tarea (no QA) se pierde", bwTasks.filter((x) => x.role !== "QA").every((x) => reached.has(x.id)) && !reached.has("F5.1"), JSON.stringify(as));
t("assignTasks: sin palabra clave → componente principal", ["F1.2", "F2.1", "F2.4"].every((id) => as.byComp.juego.some((x) => x.id === id)) && as.unmatched.join() === "F1.2,F2.1,F2.4", JSON.stringify(as.unmatched));
t("assignTasks: las que nombran un componente siguen yendo ahí", as.byComp.niveles.map((x) => x.id).join() === "F4.2", as.byComp.niveles.map((x) => x.id).join());
t("assignTasks: orden del graph en el principal", as.byComp.juego.map((x) => x.id).join() === "F1.1,F1.2,F2.1,F2.4,F3.2,F4.2,F4.6", as.byComp.juego.map((x) => x.id).join());
t("assignTasks: landing de siempre no cambia (hero/nav/contacto por palabra clave)", assignTasks(comps, tasks).unmatched.length === 0 && assignTasks(comps, tasks).byComp.inicio.map((x) => x.id).join() === "F1.3");
const nt = notesText(as.byComp.juego, { maxDescribed: 1, descChars: 20 });
t("notesText: todas las tareas con título; descripción solo hasta el tope", nt.split("\n").length === 7 && nt.includes("[F4.6]") && !nt.includes("cuadrícula"), nt);
t("notesText: descripción recortada", notesText([bwTasks[1]], { descChars: 20 }).endsWith(": Generar y aplicar el"));

// v0.7.3: función anónima que es TODO el componente.js (Boxworld build 2, #juego)
const an1 = autoInvoke("(root) => {\n  root.querySelector('#mapa').textContent = 'x';\n}\n");
t("autoInvoke: `(root) => {…}` suelta → se llama con root", an1.invoked.length === 1 && /\)\(root\);/.test(an1.js) && !jsError(wrapJs("juego", "(root) => {\n  root.x = 1;\n}")));
t("autoInvoke: `function (root) {…};` suelta → se llama (antes era error de sintaxis)", autoInvoke("function (root) { root.x = 1; };").invoked.length === 1 && !jsError(wrapJs("juego", "function (root) { root.x = 1; };")));
t("autoInvoke: async () => {…} sin parámetros también", autoInvoke("async () => {\n  await 1;\n}").invoked.length === 1);
t("autoInvoke: flecha seguida de más código → no se toca", autoInvoke("(root) => { root.x = 1; }\nconsole.log(1);").invoked.length === 0);
t("autoInvoke: IIFE que ya se llama → no se toca", autoInvoke("((root) => { root.x = 1; })(root);").invoked.length === 0);
t("autoInvoke: la flecha corre de verdad", (() => { const r = {}; new Function("root", autoInvoke("(root) => { root.ran = true; }").js)(r); return r.ran === true; })());
const rr = dropRootRedeclare("const root = document.getElementById('juego');\nroot.x = 1;", "juego");
t("const root = #mismo-componente → se saca (era SyntaxError)", rr.dropped === 1 && !jsError(wrapJs("juego", rr.js)));
t("const root = otro elemento → no se toca", dropRootRedeclare("const root = document.querySelector('.tablero');", "juego").dropped === 0);
const ap = applyComponentResponse(initialState(bw, "B"), bw[1], "### FILE: componente.html\n```html\n<section id=\"juego\"><div id=\"mapa\"></div></section>\n```\n### FILE: componente.js\n```javascript\n(root) => {\n  const root = document.getElementById(\"juego\");\n  root.querySelector('#mapa').textContent = 'x';\n}\n```");
t("applyComponentResponse: redeclaración sacada + anónima llamada, sin rechazo", ap.changed.includes("js") && !ap.rejected.length && ap.notes.some((n) => n.includes("anónima")) && ap.notes.some((n) => n.includes("const root")), JSON.stringify(ap.rejected.concat(ap.notes)));

// v0.7.3: ids repetidos entre componentes (Boxworld build 2: #mensaje-juego, #nivel-actual)
const st2 = initialState(bw, "B");
st2.components.juego = { html: '<section id="juego"><p id="mensaje-juego"></p><span id="nivel-actual"></span><div id="mapa"></div></section>' };
st2.components.niveles = { html: '<section id="niveles"><p id="mensaje-juego"></p><span id="nivel-actual"></span><ul id="lista"></ul></section>' };
t("duplicateIds: detecta los ids que ya usa otro componente", duplicateIds(st2, bw[2], bw).map((d) => d.id + "@" + d.in).join() === "mensaje-juego@juego,nivel-actual@juego");
t("duplicateIds: la raíz no cuenta", duplicateIds(initialState(bw, "B"), bw[1], bw).length === 0);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
