// test_plantillas.mjs — Standard web/app/plantillas (DRAFT v0.1.0, 16/10).
//   node standards/web/app/plantillas/test_plantillas.mjs
// Contrato real: build 2026-10-16T13-54-56 (Kanban, fixture real_kanban_c21). La parte con Handlebars de verdad
// corre solo si está instalado (node build/requisitos.mjs --standard web/app/plantillas --instalar); si no, se
// saltea y lo dice. Lo demás (pasos, pedido, montarControles en Chromium) corre siempre.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import P, { SCRIPTS, VENDOR, MONTAR_JS, lugaresText, plantillasContractText, forTemplate } from "./standard.mjs";
import E, { probeFor, cssClasses } from "../estado/standard.mjs";
import { parseContract, datosJs } from "../estado/contract.mjs";
import { pageHtml, probePage } from "../../../../profiles/web/specialist/files_kit.mjs";
import { getStandard } from "../../../registry.mjs";
import { standardMeta } from "../../../catalog.mjs";

let ok = 0, fail = 0, skip = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const step = (id) => P.steps.find((x) => x.id === id);
const C21 = JSON.parse(readFileSync(fileURLToPath(new URL("../../../../profiles/web/validation/fixtures/real_kanban_c21/contrato.json", import.meta.url)), "utf8"));
const K = parseContract(C21, {}).items[0];
const ctx = { data: { contrato: { items: [K] } }, paso: "PASO 6 de 8", fragment: '<h1>Kanban</h1><div id="app"></div>', files: { "styles.css": ".columna{} .tarjeta{}" } };
const HB = fileURLToPath(new URL("../../../../node_modules/handlebars/dist/handlebars.min.js", import.meta.url));
const hasHB = existsSync(HB);

// ---------- 1. el Standard ----------
t("registrado, DRAFT, con su ficha (stack Handlebars, requiere handlebars)", getStandard("web/app/plantillas") === P && P.status === "DRAFT" && P.version === "0.1.0" && P.stack.tecnologias.join() === "Handlebars" && P.requiere.some((r) => r.id === "handlebars") && standardMeta(P.id).base === "web/app/estado");
t("mismos pasos que estado + 'handlebars' antes de pantalla", P.steps.map((s) => s.id).join() === "contrato,logica,acciones,handlebars,pantalla,dibujo,controles,enlace" && E.steps.map((s) => s.id).join() === "contrato,logica,acciones,pantalla,dibujo,controles,enlace");
t("los pasos que no cambian son los MISMOS objetos de estado (la comparación mide solo el dibujo)", ["contrato", "logica", "pantalla", "controles", "enlace"].every((id) => step(id) === E.steps.find((x) => x.id === id)));
t("scripts: Handlebars se carga antes de dibujo.js", SCRIPTS.join() === `js/datos.js,js/logica.js,js/acciones.js,${VENDOR},js/dibujo.js,js/controles.js`);
const ac = step("acciones").write(ctx)["js/acciones.js"];
t("acciones.js = el de estado + montarControles", ac.startsWith(E.steps.find((x) => x.id === "acciones").write(ctx)["js/acciones.js"]) && ac.endsWith(MONTAR_JS) && /function montarControles\(raiz, estado\)/.test(ac));
const hbStep = step("handlebars");
t("paso handlebars: lo escribe el harness desde node_modules (si no está, no escribe nada)", hbStep.kind === "written" && hbStep.file === VENDOR && (hasHB ? /Handlebars/.test(hbStep.write()[VENDOR]) : Object.keys(hbStep.write()).length === 0));
t("paso handlebars: un archivo que no es Handlebars → fatal, con cómo instalarlo", hbStep.check({ [VENDOR]: "x" }).fatal && /requisitos\.mjs --standard web\/app\/plantillas --instalar/.test(hbStep.check({ [VENDOR]: "x" })[0]));

// ---------- 2. lo que lee Gemma ----------
const ct = plantillasContractText(ctx);
t("contrato: dibujo.js con PLANTILLA + Handlebars.compile + montarControles; ya no 'con appendChild'", /const PLANTILLA \(una plantilla Handlebars\)/.test(ct) && /montarControles\(#app, estado\)/.test(ct) && !/controlesDe\("<tipo>", elemento, estado\) con appendChild/.test(ct) && ct.includes(`js/acciones.js, ${VENDOR}, js/dibujo.js`));
const pr = step("dibujo").prompt(ctx);
t("pedido de dibujo: lugar de controles con el id real de cada tipo (Kanban 16/10)", pr.includes('<div data-controles="tarjetas" data-id="{{id}}"></div>') && pr.includes('<div data-controles="columnas" data-id="{{id}}"></div>') && /DOS llaves/.test(pr) && !/createElement/.test(pr), pr);
t("lugaresText nombra las acciones de cada lugar", /"columnas".*Crear tarjeta/.test(lugaresText(K)) && /"tarjetas".*Editar tarjeta, Borrar tarjeta, Mover tarjeta/.test(lugaresText(K)));
t("dibujo no puede definir Handlebars ni montarControles", ["Handlebars", "montarControles", "controlesDe", "estado"].every((n) => step("dibujo").notOwn.names.includes(n)));
const m = forTemplate([
  'faltan los controles de: crearTarjeta (agregá controlesDe("columnas", elemento, estado) adentro de cada elemento de ese tipo).',
  'dibujar escribe los textos del estado como HTML (innerHTML o += con `...`): si una persona escribe "<img src=x onerror=...>" se ejecuta código. Pasó con: "x". Mostrá cada texto con textContent (o document.createTextNode), nunca metido dentro de innerHTML.',
]);
t("los avisos de la sonda se dicen para una plantilla", /poné <div data-controles="columnas" data-id="\{\{id\}\}"><\/div>/.test(m[0]) && /DOS llaves \(\{\{texto\}\}\)/.test(m[1]) && !/textContent/.test(m[1]), JSON.stringify(m));

// ---------- 3. montarControles en Chromium (dibujo de referencia SIN Handlebars) ----------
const root = mkdtempSync(join(tmpdir(), "plantillas-"));
const LOGICA = "const App = { crear() { return JSON.parse(JSON.stringify(ESTADO_INICIAL)); } };";
const CSS = ".columna{display:block} .tarjeta{display:block}";
function appDir(name, dibujo, extra = {}) {
  const d = join(root, name);
  mkdirSync(join(d, "js", "vendor"), { recursive: true });
  const files = { "styles.css": CSS, "js/datos.js": datosJs(K.estado), "js/logica.js": LOGICA, "js/acciones.js": ac, [VENDOR]: extra.vendor || "/* sin Handlebars */", "js/dibujo.js": dibujo };
  for (const [f, x] of Object.entries(files)) writeFileSync(join(d, f), x);
  const page = (scripts, inline = "") => pageHtml({ title: "T", fragment: '<h1>T</h1><div id="app"></div>', scripts, inline, mainId: "principal" });
  writeFileSync(join(d, "probe.html"), page(SCRIPTS.slice(0, SCRIPTS.indexOf("js/dibujo.js") + 1), probeFor(K, cssClasses(CSS))));
  return d;
}
const esc = 'function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" }[c]; }); }';
const REF = `${esc}
function dibujar(estado) {
  var app = document.getElementById("app");
  app.innerHTML = estado.columnas.map(function (c) {
    return '<div class="columna"><h3>' + esc(c.titulo) + '</h3><div data-controles="columnas" data-id="' + esc(c.id) + '"></div>' +
      c.tarjetas.map(function (t) { return '<div class="tarjeta"><h4>' + esc(t.titulo) + '</h4><p>' + esc(t.descripcion) + '</p><span>' + esc(t.prioridad) + '</span><div data-controles="tarjetas" data-id="' + esc(t.id) + '"></div></div>'; }).join("") + '</div>';
  }).join("");
  montarControles(app, estado);
}`;
const p1 = (await probePage(join(appDir("ref", REF), "probe.html"))).probe;
const probs1 = forTemplate(step("dibujo").expect(p1));
t("montarControles pone los controles de cada tipo en su lugar: la sonda de estado queda sin problemas", p1.ok && probs1.length === 0, JSON.stringify({ probs1, noButton: p1.noButton, noId: p1.noId, noField: p1.noField, missing: p1.missing }));
const SIN = REF.replace(/<div data-controles="tarjetas"[^>]*><\/div>/, "");
const p2 = (await probePage(join(appDir("sin_lugar", SIN.replace(`'<div data-controles="tarjetas" data-id="' + esc(t.id) + '"></div>'`, "''")), "probe.html"))).probe;
const probs2 = forTemplate(step("dibujo").expect(p2));
t("sin el lugar de las tarjetas → el aviso dice que ponga <div data-controles=\"tarjetas\"…> en la plantilla", probs2.some((x) => /faltan los controles de: .*editarTarjeta/.test(x) && /data-controles="tarjetas"/.test(x)), JSON.stringify(probs2));

// ---------- 4. con Handlebars de verdad (solo si está instalado) ----------
if (!hasHB) {
  skip++;
  console.log(`~ SALTEADO (${skip}): Handlebars no está instalado → node build/requisitos.mjs --standard web/app/plantillas --instalar`);
} else {
  const vendor = readFileSync(HB, "utf8");
  const PL = (llaves) => `var PLANTILLA = '{{#each columnas}}<div class="columna"><h3>${llaves("titulo")}</h3><div data-controles="columnas" data-id="{{id}}"></div>{{#each tarjetas}}<div class="tarjeta"><h4>${llaves("titulo")}</h4><p>${llaves("descripcion")}</p><span>${llaves("prioridad")}</span><div data-controles="tarjetas" data-id="{{id}}"></div></div>{{/each}}</div>{{/each}}';
function dibujar(estado) { var app = document.getElementById("app"); app.innerHTML = Handlebars.compile(PLANTILLA)(estado); montarControles(app, estado); }`;
  const p3 = (await probePage(join(appDir("hb", PL((k) => `{{${k}}}`), { vendor }), "probe.html"))).probe;
  t("Handlebars con DOS llaves: la sonda de estado sin problemas (y sin XSS)", p3.ok && forTemplate(step("dibujo").expect(p3)).length === 0 && !p3.htmlInText?.length, JSON.stringify(forTemplate(step("dibujo").expect(p3))));
  const p4 = (await probePage(join(appDir("hb3", PL((k) => `{{{${k}}}}`), { vendor }), "probe.html"))).probe;
  const probs4 = forTemplate(step("dibujo").expect(p4));
  t("Handlebars con TRES llaves: la sonda lo agarra (XSS) y el aviso pide dos llaves", p4.htmlInText?.length > 0 && probs4.some((x) => /DOS llaves/.test(x)), JSON.stringify(probs4));
}

console.log(`\n${ok}/${ok + fail} OK${skip ? ` (${skip} parte salteada: falta Handlebars)` : ""}`);
if (fail) process.exit(1);
