// test_file_diet.mjs — selección de archivos, resúmenes y aplicación de APPEND/SECTION/FILE (sin LLM).
//   node build/test_file_diet.mjs
import { classifyTask, planPrompt, applyBlocks, htmlOutline, cssOutline, jsOutline, FILES } from "./file_diet.mjs";
import { skeleton } from "./specialist_spa.mjs";

let ok = 0, fail = 0;
const t = (name, cond, extra = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${extra}`); } };

// Clasificación por título (tareas reales de Project22)
const C = (task, description = "", role = "Frontend") => classifyTask({ task, description, role }).primary;
t("F1.1 esqueleto → structure (aunque la descripción diga 'estilos')", C("Crear el esqueleto base HTML5 autocontenido de la landing page.", "No se deben incluir estilos ni contenido") === "structure");
t("F1.2 estructura de Navegación → structure", C("Implementar la estructura semántica de Navegación (Navbar).") === "structure");
t("F2.3 Estilizar → style", C("Estilizar la sección Hero.") === "style");
t("F2.9 Responsividad → style", C("Implementar la Responsividad del Navbar y Header") === "style");
t("F3.2 hover dinámicos → style", C("Implementar efectos hover dinámicos para botones primarios y secundarios.") === "style");
t("F3.4 animación al scroll → logic", C("Programar la animación de aparición (reveal) de elementos al hacer scroll.") === "logic");
t("F3.5 validación → logic", C("Implementar validación client-side para el formulario de contacto.") === "logic");
t("Backend sin palabras clave → data", C("Crear el endpoint para el menú", "", "Backend") === "data" && C("Hacer lo del menú", "", "DBA") === "data");

// Resúmenes
const plan = { header: { features: ["R2"] }, sections: [{ id: "inicio", titulo: "Inicio", features: ["R1"] }, { id: "contacto", titulo: "Contacto", features: ["R3"] }], footer: { features: [] }, transversales: [] };
const base = skeleton("Demo", ["Hero", "Navegación", "Contacto"], plan);
base["styles.css"] = "body{margin:0}\n.hero h1{font-size:3rem}\n@media (max-width:600px){ .hero h1{font-size:2rem} }\n";
base["app.js"] = "// === Scroll ===\ndocument.addEventListener('DOMContentLoaded', () => {\n  const x = 1;\n});\nfunction animar(){ return 1 }\n";
const ho = htmlOutline(base["index.html"]);
t("htmlOutline: ids, data-feature y links", ho.includes("<section#inicio [R1]>") && ho.includes("→#contacto") && ho.includes("<header#site-header [R2]>"), ho);
const co = cssOutline(base["styles.css"]);
t("cssOutline: selectores y @media sin cuerpos", co.includes(".hero h1") && co.includes("@media (max-width:600px)") && !co.includes("font-size"), co);
const jo = jsOutline(base["app.js"]);
t("jsOutline: listeners, funciones y comentarios", jo.includes("addEventListener") && jo.includes("function animar") && !jo.includes("const x = 1"), jo);

// Aplicar respuestas
const full = new Set(["styles.css"]);
let r = applyBlocks(base, "### APPEND: styles.css\n```css\n.btn:hover{color:red}\n```", full);
t("APPEND styles.css agrega al final", r.changed.includes("styles.css") && r.next["styles.css"].endsWith(".btn:hover{color:red}\n") && r.next["styles.css"].startsWith("body{margin:0}"));
r = applyBlocks(base, "### SECTION: inicio\n```html\n<section id=\"inicio\"><h2>Inicio</h2><p>Hola mundo</p></section>\n```", full);
t("SECTION reemplaza el elemento y repone data-feature", r.next["index.html"].includes('<section data-feature="R1" id="inicio"><h2>Inicio</h2><p>Hola mundo</p></section>') && r.next["index.html"].includes('id="contacto"'), r.rejected.join(";"));
r = applyBlocks(base, "### SECTION: site-header\n```html\n<header id=\"site-header\" data-feature=\"R2\"><nav><a href=\"#inicio\">Inicio</a></nav></header>\n```", full);
t("SECTION también sirve para el header", r.changed.includes("index.html") && !r.next["index.html"].includes("<h1>Demo</h1>\n"), r.rejected.join(";"));
r = applyBlocks(base, "### FILE: index.html\n```html\n<html></html>\n```", full);
t("FILE de un archivo recibido como resumen → rechazado", !r.changed.length && r.rejected[0].includes("resumido"));
r = applyBlocks(base, "### FILE: styles.css\n```css\n" + base["styles.css"] + ".x{}\n```", full);
t("FILE de un archivo recibido completo → aceptado", r.changed.includes("styles.css"));
r = applyBlocks(base, "### SECTION: precios\n```html\n<section id=\"precios\"></section>\n```", full);
t("SECTION con id inexistente → rechazado", !r.changed.length && r.rejected[0].includes("no corresponde"));
r = applyBlocks(base, "### SECTION: inicio\n```html\n<div class=\"x\">otra cosa</div>\n```", full);
t("SECTION que no empieza con ese id → rechazado", !r.changed.length && r.rejected[0].includes("tiene que empezar"));
r = applyBlocks(base, "### APPEND: index.html\n```html\n<p>x</p>\n```", full);
t("APPEND a index.html → rechazado", !r.changed.length);
r = applyBlocks(base, "Nota.\n### APPEND: app.js\n```js\nconsole.log(1)\n```\n### APPEND: styles.css\n```css\na{}\n```\n### SECTION: #contacto\n```html\n<section id=\"contacto\"><form></form></section>\n```", full);
t("varios bloques en una respuesta", r.changed.length === 3 && r.ops.length === 3, JSON.stringify(r.ops));


// Formas reales de Gemma (Project22, corrida 2026-10-02T22-54-04): el contenido era bueno, la forma no.
const R = "/mnt/user-data/uploads/Proyectos 2026/webmcp/build/runs/2026-10-02T22-54-04_Landing_Page_Ficticia/";
const fullHtml = new Set(["index.html", "styles.css"]);
r = applyBlocks(base, '### SECTION: inicio\n```html\n    <!-- R1: Hero Section -->\n    <section id="inicio" data-feature="R1" class="hero-section"><h1>Hola</h1></section>\n```', fullHtml);
t("real F1.3: comentario antes de la sección → se aplica", r.ops[0] === "SECTION #inicio" && r.next["index.html"].includes('class="hero-section"'), r.rejected.join(";"));
r = applyBlocks(base, '### SECTION: index.html\n```html\n    <!-- R3 -->\n    <section id="contacto" data-feature="R3"><form></form></section>\n```', fullHtml);
t("real F1.4: SECTION: index.html con una <section id> → reemplaza esa", r.ops[0] === "SECTION #contacto", r.rejected.join(";"));
r = applyBlocks(base, '### SECTION: index.html\n```html\n<section id="inicio"><p>a b</p></section>\n<section id="contacto"><p>c d</p></section>\n```', fullHtml);
t("varias secciones en un bloque → reemplaza cada una", r.ops.length === 2 && r.next["index.html"].includes("<p>c d</p>"), JSON.stringify(r));
r = applyBlocks(base, '### SECTION: index.html\n```html\n<!DOCTYPE html>\n<html lang="es"><head></head><body>' + "x".repeat(base["index.html"].length) + '</body></html>\n```', fullHtml);
t("real F1.2: documento entero en SECTION → FILE index.html", r.ops[0]?.startsWith("FILE index.html"), r.rejected.join(";"));
r = applyBlocks(base, '### SECTION: site-header\n```css\n@media (max-width: 768px) { nav ul { flex-direction: column; } }\n```', fullHtml);
t("real F2.9: CSS en SECTION → APPEND styles.css", r.ops[0]?.startsWith("APPEND styles.css") && r.next["styles.css"].includes("flex-direction: column"), r.rejected.join(";"));

// Presupuesto
const big = { ...base, "styles.css": "a{}\n".repeat(4000), "index.html": base["index.html"] + "<!-- " + "x".repeat(12000) + " -->" };
const pp = planPrompt({ task: { task: "Estilizar la sección Hero.", description: "con la estructura html", role: "Frontend" }, files: big, head: "BRIEF", system: "S", context: 12000 });
t("presupuesto: el archivo principal se queda completo", pp.full.has("styles.css"));
t("presupuesto: el secundario grande pasa a resumen y queda lugar para responder", pp.downgraded.includes("index.html") && 12000 - pp.promptTokens >= 3500, JSON.stringify({ d: pp.downgraded, p: pp.promptTokens }));
const pp2 = planPrompt({ task: { task: "Hacer algo", description: "", role: "Frontend" }, files: base, head: "B", system: "S" });
t("sin tipo reconocido: van todos completos", FILES.every((f) => pp2.full.has(f)));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
