// test_mvc.mjs — la estructura MVC liviana del borrador (build/mvc.mjs) y cómo la usa el ciclo con --mvc.
//   node build/test_mvc.mjs
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ESQUELETO_MVC, ARRANQUE, MARCA_ARRANQUE, REGLA_MVC, SYS_MVC, MVC_VERSION, problemasMvc, ponerArranque, fijarArranque } from "./mvc.mjs";
import { borrador, ciclo } from "./run_ciclo.mjs";
import { syntaxOf } from "../harness/js_tools.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

t("versión", MVC_VERSION === "mvc v0.2");

// ---------- el esqueleto ----------
t("el esqueleto compila, tiene las 4 secciones y no tiene arranque", !syntaxOf(ESQUELETO_MVC) && ["DATOS", "LÓGICA", "DIBUJO", "CONTROLES"].every((x) => ESQUELETO_MVC.includes(`===== ${x}`)) && !ESQUELETO_MVC.includes(MARCA_ARRANQUE));
t("el esqueleto sigue la estructura (problemasMvc vacío)", problemasMvc(ESQUELETO_MVC).length === 0, problemasMvc(ESQUELETO_MVC).join(" | "));
const conA = ponerArranque(ESQUELETO_MVC);
t("ponerArranque: queda al final, compila y es siempre uno solo (repetirlo no cambia nada)", conA.endsWith(ARRANQUE) && !syntaxOf(conA) && ponerArranque(conA) === conA && conA.split(MARCA_ARRANQUE).length === 2);
t("ponerArranque: un arranque viejo o tocado se reemplaza por el del harness", ponerArranque(`${ESQUELETO_MVC}\n${MARCA_ARRANQUE} =====\narrancar(); arrancar();\n`) === conA);
t("ponerArranque: sin script no inventa nada", ponerArranque("") === "" && ponerArranque("  ") === "  ");

// ---------- qué le falta a un script.js ----------
const bueno = ESQUELETO_MVC.replace("/* completá", "celdas: {} /* completá").replace("// completá\n\n// ===== DIBUJO", "function poner(id, v) { estado.celdas[id] = v; }\n\n// ===== DIBUJO");
const p = (js) => problemasMvc(js).join(" | ");
t("problemasMvc: el esqueleto completado no tiene problemas", p(bueno) === "", p(bueno));
t("problemasMvc: sin estado → lo dice", /let estado/.test(p(bueno.replace("let estado =", "let datos ="))));
t("problemasMvc: sin render() → lo dice", /function render\(\)/.test(p(bueno.replace("function render()", "function dibujar()"))));
t("problemasMvc: con DOMContentLoaded propio → lo dice (el arranque es del harness)", /DOMContentLoaded/.test(p(`${bueno}\ndocument.addEventListener("DOMContentLoaded", () => { cargar(); render(); });`)));
t("problemasMvc: conectar() suelto → lo dice (dos veces duplica cada evento)", /no llames a conectar/.test(p(`${bueno}\nconectar();`)));
t("problemasMvc: la definición de conectar y el arranque del harness NO cuentan como llamadas", !/no llames/.test(p(ponerArranque(bueno))));
t("problemasMvc: LÓGICA que usa document → lo dice; en un comentario no cuenta", /LÓGICA usa document/.test(p(bueno.replace("estado.celdas[id] = v;", "document.getElementById(id).textContent = v;"))) && !/LÓGICA/.test(p(bueno.replace("estado.celdas[id] = v;", "estado.celdas[id] = v; // no usar document.x"))));

// v0.2: guardar y redibujar con cada tecla pisaba lo que se escribía ("=B1+C1" → "1C+1Bundefined", R4.1 en las 6 réplicas)
const conInput = bueno.replace("// completá (si render()", "document.getElementById(\"hoja\").addEventListener(\"input\", (e) => { poner(e.target.id, e.target.textContent); guardar(); render(); });\n  // completá (si render()");
const conFocusout = conInput.replace('addEventListener("input"', 'addEventListener("focusout"');
t("problemasMvc v0.2: escuchar 'input' y redibujar → lo dice; con focusout no", /cada tecla/.test(p(conInput)) && !/cada tecla/.test(p(conFocusout)), p(conInput));
t("v0.2: la consigna del borrador y la regla de los arreglos dicen que no se redibuja lo que se está editando", /document\.activeElement/.test(SYS_MVC) && /no con cada tecla/.test(REGLA_MVC) && /no con cada tecla/.test(ESQUELETO_MVC));

// ---------- fijarArranque (en el ciclo) ----------
const appMvc = { "index.html": "<div id=a></div>", "script.js": bueno };
t("fijarArranque: con la estructura pone el arranque; si un arreglo lo borró, lo repone", fijarArranque(appMvc)["script.js"].endsWith(ARRANQUE) && fijarArranque({ ...appMvc, "script.js": ponerArranque(bueno).split(MARCA_ARRANQUE)[0] })["script.js"].endsWith(ARRANQUE));
const vieja = { "index.html": "<div></div>", "script.js": "function iniciar() {}\niniciar();" };
t("fijarArranque: una app sin la estructura (retomada con --mvc) no se toca", fijarArranque(vieja) === vieja && fijarArranque({}) !== null);

// ---------- en Chromium: el arranque corre una vez y la página sale de `estado` ----------
{
  const js = ponerArranque(ESQUELETO_MVC
    .replace("/* completá: los datos de la app (textos, números, listas, objetos). Nada de elementos de la página. */", "n: 0")
    .replace("// completá\n\n// ===== DIBUJO", "function sumar() { estado.n = estado.n + 1; }\n\n// ===== DIBUJO")
    .replace("function render() {\n  // completá\n}", "function render() { document.getElementById(\"n\").textContent = String(estado.n); }")
    .replace(/function conectar\(\) \{\n[\s\S]*?\n\}/, "function conectar() { document.getElementById(\"mas\").addEventListener(\"click\", () => { sumar(); guardar(); render(); }); }"));
  const dir = mkdtempSync(join(tmpdir(), "mvc-"));
  // el script en el <head> (sin defer): el arranque espera a DOMContentLoaded; al final del body arranca enseguida
  writeFileSync(join(dir, "index.html"), `<!DOCTYPE html><html><head><script src="script.js"></script></head><body><span id="n"></span><button id="mas">+</button></body></html>`);
  writeFileSync(join(dir, "script.js"), js);
  const { chromium } = await import("playwright");
  const br = await chromium.launch();
  try {
    const pg = await br.newPage();
    const errores = [];
    pg.on("pageerror", (e) => errores.push(e.message));
    await pg.goto(pathToFileURL(join(dir, "index.html")).href);
    const v0 = await pg.textContent("#n");
    await pg.click("#mas");
    const v1 = await pg.textContent("#n");
    await pg.reload();
    const v2 = await pg.textContent("#n");
    t("Chromium: arranca solo (cargar → conectar → render), un clic suma UNO (conectar no se duplicó) y al recargar sigue (guardar/cargar)", v0 === "0" && v1 === "1" && v2 === "1" && !errores.length, `${v0} → ${v1} → ${v2} ${errores.join(" | ")}`);
  } finally { await br.close(); }
}

// ---------- el borrador con --mvc ----------
const PL = { filas: [{ id: "R1.1", r: "R1", hago: { escribir: "hola", en: "A1" }, veo: [{ celda: "A1", muestra: "hola" }] }] };
const HTML = `<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><div id="hoja"></div><script src="script.js"></script></body></html>`;
const CSS = "body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }";
const fakeBorrador = (scripts) => { const vistos = []; let k = 0; return { vistos, call: async (m, max, tipo) => { vistos.push({ tipo, sys: m[0].content, user: m[1].content }); const f = tipo.split(" ")[1]; const txt = f === "index.html" ? HTML : f === "styles.css" ? CSS : scripts[Math.min(k++, scripts.length - 1)]; return { content: `### ARCHIVO: ${f}\n\`\`\`\n${txt}\n\`\`\``, ms: 1 }; } }; };
{
  const f = fakeBorrador([bueno]);
  const b = await borrador({ features: ["Escribir en una celda"], planilla: PL, call: f.call, mvc: true });
  const js = f.vistos.find((x) => x.tipo === "borrador script.js");
  t("borrador --mvc: el pedido de script.js trae el esqueleto y la consigna; index.html y styles.css no", js.user.includes("===== DATOS") && js.sys.includes(SYS_MVC) && f.vistos.filter((x) => x.tipo !== "borrador script.js").every((x) => !x.user.includes("===== DATOS") && !x.sys.includes(SYS_MVC)));
  t("borrador --mvc: script.js queda con el arranque del harness al final", b.app["script.js"].endsWith(ARRANQUE) && !syntaxOf(b.app["script.js"]));
}
{
  const f = fakeBorrador([bueno]);
  const b = await borrador({ features: ["Escribir en una celda"], planilla: PL, call: f.call });
  const js = f.vistos.find((x) => x.tipo === "borrador script.js");
  t("borrador sin --mvc: igual que siempre (sin esqueleto, sin arranque agregado)", !js.user.includes("===== DATOS") && !js.sys.includes(SYS_MVC) && /una sola llamada que arranca la app/.test(js.sys) && !b.app["script.js"].includes(MARCA_ARRANQUE));
}
{
  const malo = "let x = 1;\nfunction pintar() {}\ndocument.addEventListener('DOMContentLoaded', pintar);";
  const f = fakeBorrador([malo, bueno]);
  const b = await borrador({ features: ["x"], planilla: PL, call: f.call, mvc: true });
  const js = f.vistos.filter((x) => x.tipo === "borrador script.js");
  t("borrador --mvc: si no sigue el esqueleto se pide otra vez diciendo qué falta, y queda el bueno", js.length === 2 && /no sigue el esqueleto: .*let estado.*DOMContentLoaded/.test(js[1].user) && b.app["script.js"].startsWith(bueno.trimEnd().slice(0, 40)) && b.pedidos.find((x) => x.archivo === "script.js").mvc_problemas.length > 0, js.map((x) => x.user.slice(-200)).join(" || "));
  const f2 = fakeBorrador([malo, malo]);
  const b2 = await borrador({ features: ["x"], planilla: PL, call: f2.call, mvc: true });
  t("borrador --mvc: si los 2 intentos compilan pero no siguen el esqueleto, queda el último (mejor que vacío) y sin arranque (no tiene las funciones)", b2.app["script.js"].startsWith("let x = 1;") && fijarArranque(b2.app)["script.js"] === b2.app["script.js"]);
}

// ---------- el ciclo con --mvc ----------
{
  const sistemas = [], juzgadas = [];
  const juez = async (app, filas) => { juzgadas.push(app["script.js"]); return Object.fromEntries(filas.map((f) => [f.id, { result: "FAIL", detail: "✗ A1 no muestra hola" }])); };
  // el arreglo manda script.js ENTERO sin el arranque: el ciclo lo repone antes de juzgar
  const call = async (m, max, tipo) => { sistemas.push({ tipo, sys: m[0].content }); return tipo === "ver" ? { content: '{ "ver": ["render"] }', ms: 1 } : { content: `### ARCHIVO: script.js\n\`\`\`js\n${bueno}\n\`\`\``, ms: 1 }; };
  const app = { "index.html": HTML, "styles.css": CSS, "script.js": ponerArranque(bueno) };
  const r = await ciclo({ app, planilla: PL, features: ["x"], outDir: mkdtempSync(join(tmpdir(), "cmvc-")), maxVueltas: 1, maxIntentos: 1, log: () => {}, call, juez, mvc: true });
  t("ciclo --mvc: los pedidos de ver y de arreglo traen la regla de la estructura", sistemas.length === 2 && sistemas.every((x) => x.sys.includes(REGLA_MVC)));
  t("ciclo --mvc: un arreglo que borró el arranque se juzga con el arranque repuesto", juzgadas.length >= 2 && juzgadas.every((js) => js.endsWith(ARRANQUE)));
  t("ciclo --mvc: queda anotado en ciclo.json", r.ev.mvc === MVC_VERSION);
  const s2 = [];
  await ciclo({ app, planilla: PL, features: ["x"], outDir: mkdtempSync(join(tmpdir(), "csin-")), maxVueltas: 1, maxIntentos: 1, log: () => {}, call: async (m, max, tipo) => { s2.push(m[0].content); return call(m, max, tipo); }, juez });
  t("ciclo sin --mvc: sin la regla", s2.length === 2 && s2.every((x) => !x.includes(REGLA_MVC)));
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
