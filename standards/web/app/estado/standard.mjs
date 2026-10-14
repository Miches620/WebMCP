// standard.mjs — Standard "app con estado" (web/app/estado) · DRAFT v0.2.0 (12/10; v0.1.0 el mismo día, ver docs/CAMBIOS.md).
//
// Paso 2 del borde (12/10, diseño aprobado por Miche: "construilo así"): web/app por archivos, con su
// propio Standard, y el Kanban como piloto. Lo que cambia respecto de grilla: en una app el contrato NO
// se conoce de antemano. El paso 1 lo propone Gemma como DATOS (estado inicial + acciones) y el harness
// lo valida; los pasos 2 a 5 reciben un contrato armado con esos datos (S.contract(ctx)) y la lógica
// se prueba con pruebas generales que salen del contrato (acceptance.mjs).
//
// Pasos:
//   1. contrato  (data)   contrato.json → js/datos.js (ESTADO_INICIAL), nombres arreglados, features cubiertas
//   2. logica    (logic)  js/logica.js: const App = { crear(), <acciones>(estado, …) } probada en Node
//   3. pantalla  (screen) app.html (SOLO título + #app) + styles.css (las clases que va a usar dibujar)
//   4. dibujo    (render) js/dibujo.js: dibujar(estado) en Chromium: textos del estado, un botón por acción con ids y campos, clases con estilo
//   5. controles (wiring) js/controles.js: cada acción se puede usar desde la pantalla y después se dibuja
//
// Nada de un dominio acá (ni Kanban ni contador): lo prueba test_estado.mjs con dos apps distintas.
// DRAFT: no tiene evidencia todavía. Primera corrida: el Kanban (Project23/24).

import { parseContract, contractProblems, bestContract, datosJs, signature, idsOf, MAX_STATE_CHARS } from "./contract.mjs";
import { logicTests, observeChanges } from "./acceptance.mjs";
import { controlsPlan, accionesJs, controlesFromPlan, whereOf } from "./controls.mjs";

export const IDS = ["app"];
export const SCRIPTS = ["js/datos.js", "js/logica.js", "js/acciones.js", "js/dibujo.js", "js/controles.js"];
const fence = (lang, s) => "```" + lang + "\n" + s + "\n```";
const contractOf = (c) => c?.data?.contrato?.items?.[0] || null;

// ---------- pistas del brief: features numeradas como en el brief (1..N) y cuáles son de estilo ----------
export function appHints(refined = {}) {
  const features = (refined.features || []).map(String);
  const estilo = (refined.estilo || []).map((s) => String(s).trim());
  const style = features.map((f, i) => (estilo.includes(f.trim()) ? i + 1 : 0)).filter(Boolean);
  return { features, style };
}

// ---------- contrato (texto) ----------
// v0.2 (Kanban real, 12/10): toda acción es un botón que dibuja dibujar(); sus ids van en b.dataset y sus
// campos (lo que escribe el usuario) al lado del botón. Así no hay formularios fijos que dependan del estado.
// v0.2.1 (Kanban real, 2ª corrida): el HTML pasa los data-* a minúsculas (data-cardId="x" → dataset.cardid),
// así que b.dataset.cardId daba undefined en dibujo y en controles. La clave del dataset es el param en minúsculas.
export const dk = (p) => p.toLowerCase();
const idType = (a, p) => (typeof a.ejemplo[a.params.indexOf(p)] === "number" ? " (número: Number(...))" : "");
const actionLine = (a) => `    - ${signature(a)}: ${a.hace || "(sin descripción)"}. Botón: b.dataset.accion = "${a.nombre}"${a.ids.map((p) => `, b.dataset.${dk(p)} = el id${idType(a, p)} (en HTML: data-${dk(p)})`).join("")}${a.campos.length ? `; campos: ${a.campos.map((p) => `data-campo="${p}"`).join(", ")}` : ""}`;
/** La llamada que hace controles: App.x(estado, Number(b.dataset.id), campo("texto")). */
const callOf = (a) => `App.${a.nombre}(${["estado", ...a.params.map((p) => a.ids.includes(p) ? (idType(a, p) ? `Number(b.dataset.${dk(p)})` : `b.dataset.${dk(p)}`) : `${typeof a.ejemplo[a.params.indexOf(p)] === "number" ? "Number(" : ""}b.parentElement.querySelector('[data-campo="${p}"]').value${typeof a.ejemplo[a.params.indexOf(p)] === "number" ? ")" : ""}`)].join(", ")})`;
/**
 * v0.3.0 (12/10, punto 8): js/controles.js lo escribe el harness. Sale entero del contrato: un botón por
 * acción con data-accion, sus ids en b.dataset (en minúsculas) y sus campos al lado (data-campo).
 * Evidencia: 4 corridas del Kanban, y en las 4 Gemma inventó otra forma de unir dibujo y controles
 * (formularios fijos → data-* en camelCase → grupos ocultos → formularios vacíos). Ahora la única
 * parte que puede no coincidir es dibujo.js, y su sonda ya dice qué le falta.
 * Si un campo falta, la acción se llama con undefined (la compuerta de Validation lo dice tal cual);
 * si el campo está pero vacío (la persona no escribió nada), no se hace nada.
 */
export function controlesJs(c) {
  return controlesFromPlan(controlsPlan(c), (n, p) => { const a = c.acciones.find((x) => x.nombre === n); return a.ejemplo[a.params.indexOf(p)]; });
}

/** v0.4.0: qué tipos de elemento tienen acciones y dónde están (para el pedido de dibujo). */
export function tiposText(c) {
  const plan = controlsPlan(c);
  const own = [...new Set(plan.acciones.map((a) => a.owner))];
  return own.map((t) => {
    const acts = plan.acciones.filter((a) => a.owner === t).map((a) => a.label).join(", ");
    return t === "app" ? `  - "app" (acciones generales, elemento null): una vez, al final de #app → ${acts}` : `  - "${t}": cada elemento de ${whereOf(plan.kinds[t])} → ${acts}`;
  }).join("\n");
}

/** El contrato que lee Gemma. Antes del paso 1 dice la forma; después, las acciones y el estado reales. */
export function contractText(ctx) {
  const c = contractOf(ctx);
  const app = c ? `const App = { crear(), ${c.acciones.map((a) => `${a.nombre}(${["estado", ...a.params].join(", ")})`).join(", ")} }` : "const App = { crear(), <una función por acción>(estado, ...params) }";
  return `CONTRATO DE LA APP (lo define el harness; respetalo al pie de la letra):
- Archivos: app.html (solo el contenido de la pantalla), styles.css, js/datos.js, js/logica.js, js/acciones.js, js/dibujo.js, js/controles.js. Se cargan en ese orden con <script src> comunes: NADA de import/export ni módulos. Cada archivo define SOLO lo suyo.
- js/datos.js (lo escribe el harness a partir de contrato.json) define: const ESTADO_INICIAL = ${c ? JSON.stringify(c.estado) : "{...}"};
- js/logica.js define: ${app}. Sin DOM (no usa document ni window). crear() devuelve una COPIA profunda de ESTADO_INICIAL (JSON.parse(JSON.stringify(ESTADO_INICIAL))). Cada acción DEVUELVE UN ESTADO NUEVO y completo (no modifica el que recibe; mismas claves); en el estado van solo datos (textos, números, true/false, listas y objetos), nunca elementos de la página.${c ? `\n  Acciones:\n${c.acciones.map((a) => `    - ${signature(a)}: ${a.hace || "(sin descripción)"}`).join("\n")}` : ""}
- app.html: SOLO el título (<h1>) y el contenedor <div id="app"></div>. Nada más: lo demás lo arma dibujar() desde el estado. Sin <script> ni <style>.
- js/acciones.js (lo escribe el harness) define: controlesDe(tipo, elemento, estado). Devuelve un <div class="ctl-controles"> con los campos y el botón de cada acción de ese elemento, ya armados y conectados.
- js/dibujo.js define: function dibujar(estado). Vacía #app y lo arma desde el estado: muestra cada elemento con sus textos (todo lo que el usuario ve sale del estado). Adentro de cada elemento que tiene acciones agrega controlesDe("<tipo>", elemento, estado) con appendChild. NO dibuja botones ni campos propios para las acciones: eso lo hace controlesDe. Usa las clases que tienen estilo en styles.css. No agrega listeners.${c ? `\n  Tipos con acciones:\n${tiposText(c)}` : ""}
- js/controles.js (lo escribe el harness): conecta los botones de controlesDe con App y vuelve a llamar a dibujar(estado).`;
}

const CONTRACT_FMT = `{ "estado": { "items": [ { "id": 1, "texto": "Primer ejemplo", "hecho": false }, { "id": 2, "texto": "Segundo ejemplo", "hecho": true } ] },
  "acciones": [
    { "nombre": "agregarItem", "params": ["texto"], "ejemplo": ["Comprar pan"], "hace": "agrega un item al final", "features": [1], "cambia": ["items"] },
    { "nombre": "borrarItem", "params": ["id"], "ejemplo": [1], "hace": "saca el item con ese id", "features": [2], "cambia": ["items"] }
  ],
  "se_ve": [3] }`;

// ---------- sonda de dibujar() (la corre el kit web en Chromium) ----------
// Textos para personas = strings del estado con un espacio o una mayúscula ("Por hacer", "Diseñar logo");
// los ids y estados internos ("col-1", "hecho") pueden no mostrarse.
// v0.2 (Kanban real): además, por cada acción, que haya un botón con sus ids y sus campos al lado; y que
// las clases que dibuja dibujar() tengan estilo (styles.css decía .card y dibujar ponía .kanban-card).
const acts = (c) => (c ? controlsPlan(c).acciones : []).map((a) => ({ n: a.nombre, t: a.owner, ids: [a.ownerParam, ...a.ctx.map((x) => x.p)].filter(Boolean).map(dk), campos: [...a.campos.map((f) => f.p), ...a.choice.map((x) => x.p)] }));
// las clases del CSS las pasa el harness (en file:// Chromium no deja leer cssRules)
export const probeFor = (c, css = []) => `window.__probe = (function () {
  try {
    var ACTS = ${JSON.stringify(acts(c))}, CSS = ${JSON.stringify(css)};
    var e = App.crear(); dibujar(e);
    var box = document.getElementById("app");
    if (!box) return { ok: false, error: "no existe #app" };
    var norm = function (s) { return String(s).replace(/\\s+/g, " ").trim().toLowerCase(); };
    var txt = norm(box.textContent || "");
    var texts = [];
    (function walk(v) {
      if (typeof v === "string") { var t = v.trim(); if (t.length > 1 && /\\s|[A-ZÁÉÍÓÚÑ]/.test(t) && texts.indexOf(t) < 0) texts.push(t); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(ESTADO_INICIAL);
    var inState = norm(JSON.stringify(ESTADO_INICIAL));
    var noButton = [], noId = [], noField = [];
    ACTS.forEach(function (a) {
      var bs = Array.prototype.filter.call(box.querySelectorAll("[data-accion]"), function (b) { return b.dataset.accion === a.n; });
      if (!bs.length) { noButton.push(a.n + "@" + a.t); return; }
      // v0.2.2 (3ª corrida real): vale CUALQUIER botón de la acción (Gemma dibujó un ícono ✏️ y un "Guardar"
      // al lado de los campos); se queda con el que menos le falta. Un campo oculto (display:none) no cuenta.
      var vis = function (el) { return el.getClientRects().length > 0; };
      var best = null;
      bs.forEach(function (b) {
        var ids = a.ids.filter(function (p) { return b.dataset[p] === undefined || b.dataset[p] === ""; });
        var fs = a.campos.filter(function (p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return !f || !vis(f) || !vis(b); }).map(function (p) {
          var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return p + (f && !vis(f) ? "!" : "") + (!vis(b) ? "?" : ""); });
        // un campo que existe pero está oculto pesa un poco menos que uno que falta: así el mensaje dice "oculto"
        var miss = ids.length + fs.reduce(function (n, f) { return n + (/[!?]/.test(f) ? 0.9 : 1); }, 0);
        if (!best || miss < best.miss) best = { miss: miss, ids: ids, fs: fs };
      });
      best.ids.forEach(function (p) { noId.push(a.n + ":" + p); });
      best.fs.forEach(function (p) { noField.push(a.n + ":" + p); });
    });
    var cssCls = {};
    CSS.forEach(function (k) { cssCls[k] = 1; });
    var used = {};
    Array.prototype.forEach.call(document.querySelectorAll("[class]"), function (el) { Array.prototype.forEach.call(el.classList, function (k) { used[k] = used[k] || (box.contains(el) ? 2 : 1); }); });
    var unstyled = Object.keys(used).filter(function (k) { return used[k] === 2 && !cssCls[k] && k.indexOf("ctl-") !== 0; });
    var unused = Object.keys(cssCls).filter(function (k) { return !used[k]; });
    // v0.2.1 (2ª corrida real): una clase sin estilo propio no es un error (.tag se pinta con ".etiquetas span").
    // Es error si se PARECE a una del CSS que nadie usa (kanban-card ~ card) o si la mayoría no tiene estilo.
    var near = function (a, b) { return a.length >= 3 && b.length >= 3 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0); };
    var pairs = [];
    unstyled.forEach(function (u) { unused.forEach(function (v) { if (near(u, v)) pairs.push(u + "~" + v); }); });
    var els = Array.prototype.filter.call(box.querySelectorAll("[class]"), function (el) { return el.classList.length; });
    var styledEls = els.filter(function (el) { return Array.prototype.some.call(el.classList, function (k) { return cssCls[k]; }); }).length;
    // v0.4.3 (14/10, builds 2026-10-14T19-22-44 y T20-08-35): styles.css arma la distribución en #app (flex/grid)
    // y dibujar mete todo dentro de UN solo contenedor que no la tiene → las piezas quedan apiladas.
    var wrapper = null;
    var appDisp = getComputedStyle(box).display;
    if (/flex|grid/.test(appDisp)) {
      var kids = Array.prototype.filter.call(box.children, function (el) { return !Array.prototype.some.call(el.classList, function (k) { return k.indexOf("ctl-") === 0; }); });
      var w = kids.length === 1 ? kids[0] : null;
      if (w && w.children.length >= 2 && !/flex|grid/.test(getComputedStyle(w).display)) wrapper = { app: appDisp, tag: w.tagName.toLowerCase(), cls: w.className || "" };
    }
    var res = { ok: true, wrapper: wrapper, children: box.children.length, total: texts.length, noButton: noButton, noId: noId, noField: noField, unstyled: unstyled, unused: unused, pairs: pairs, styledShare: els.length ? styledEls / els.length : 1,
      missing: texts.filter(function (t) { return txt.indexOf(norm(t)) < 0; }),
      objectText: ((box.textContent || "").match(/\\[object \\w+\\]/) || [])[0] || "",
      undef: ["undefined", "nan", "null"].filter(function (w) { return new RegExp("\\\\b" + w + "\\\\b").test(txt) && inState.indexOf(w) < 0; }) };
    // v0.4.2 (seguridad, SEG-1): los textos del estado son lo que escribe una persona. Se dibuja otra vez con
    // cada texto convertido en HTML con una trampa (onerror): si se ejecuta o aparece como elemento, dibujar
    // escribe datos con innerHTML (XSS). Los ids no se tocan (no son textos para personas).
    try {
      window.__xssd = 0;
      var trap = '<img src=x data-xssd="1" onerror="window.__xssd=(window.__xssd||0)+1">';
      var hit = [];
      var tr = (function walk(v) {
        if (typeof v === "string") { var t = v.trim(); return t.length > 1 && /\\s|[A-ZÁÉÍÓÚÑ]/.test(t) ? trap + v : v; }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === "object") { var o = {}; Object.keys(v).forEach(function (k) { o[k] = walk(v[k]); }); return o; }
        return v;
      })(App.crear());
      dibujar(tr);
      var els2 = box.querySelectorAll("[data-xssd]");
      Array.prototype.forEach.call(els2, function (el) { var p = el.parentElement; var s = p ? (p.textContent || "").trim().slice(0, 40) : ""; if (s && hit.indexOf(s) < 0 && hit.length < 3) hit.push(s); });
      res.htmlInText = els2.length ? (hit.length ? hit : ["(sin texto)"]) : [];
      dibujar(e);
    } catch (err) { res.htmlInText = []; }
    return res;
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;
const PROBE = probeFor(null);
/** Clases que tienen estilo en un CSS (para decírselas a dibujo). */
export const cssClasses = (css) => [...new Set([...String(css || "").replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.([A-Za-z_-][\w-]*)(?=[^{}]*\{)/g)].map((m) => m[1]))];
const FORBIDDEN_TAGS = ["form", "input", "button", "select", "textarea"];

// v0.2.3 (12/10, punto 7: "Validation corre las pruebas del Standard"): lo que Validation puede LEER del
// Standard para comprobar, usando la pantalla como una persona, que cada acción del contrato se dispara
// con datos de verdad. Validation no copia estas reglas: las pide acá. Los pedidos a Gemma no cambian.
const validation = {
  /** El contrato validado a partir de contrato.json (el mismo parse del paso 1). null si no sirve. */
  contract: (json, refined) => parseContract(json, appHints(refined)).items?.[0] || null,
  /** Qué envolver en la página: el objeto global, sus métodos y la función que dibuja. */
  calls: (c) => ({ global: "App", draw: "dibujar", methods: c.acciones.map((a) => a.nombre) }),
  /** Cada acción con sus params (después de estado), cuáles son ids, y qué features cumple. */
  actions: (c) => c.acciones.map(({ nombre, params, ids, campos, features }) => ({ nombre, params, ids, campos, features })),
  /** Ids que existen en el estado inicial (para saber si un id que llega es de verdad). */
  idValues: (c) => [...idsOf(c.estado)].map((x) => JSON.parse(x)),
};

const STANDARD = {
  id: "web/app/estado",
  version: "0.4.3",
  status: "DRAFT",
  validation,
  label: "app de una pantalla con estado y acciones",
  describe: "App de una pantalla por archivos: el contrato (estado inicial + acciones) lo propone Gemma como datos y el harness lo valida; js/logica.js (lógica pura probada en Node con pruebas que salen del contrato), app.html + styles.css, js/dibujo.js (probado en Chromium), js/controles.js (cada acción se puede usar desde la pantalla).",
  evidence: [
    "Kanban real, 3ª corrida (v0.2.1, 12/10): ids en minúsculas bien; Validation 5 PASS. Dibujo: mover con un solo botón sin la columna destino y campos en grupos display:none que nada mostraba → v0.2.2.",
    "Kanban real, 2ª corrida (v0.2.0, 12/10): contrato y lógica bien; dibujo y controles fallaron por data-cardId en innerHTML (el HTML lo pasa a data-cardid) → v0.2.1: claves del dataset en minúsculas.",
    "Kanban real (Project23, Gemma, 12/10, v0.1): contrato 1er intento, lógica 32/32 (arreglo state→estado + 4 reparaciones), controles falló 3 intentos: formularios fijos con datos del estado que nadie llenaba (select vacío, input hidden), clases del CSS distintas de las de dibujo. → v0.2.",
    "Diseño (12/10): Kanban v1 (Project23, componente único): editar borraba etiquetas, \"[object HTMLDivElement]\" en pantalla, + Añadir Columna sin efecto, doble confirm. Ningún chequeo lo vio.",
    "Herencia: grilla (Boxworld, Depósito, Invernadero): un archivo por paso, datos de Gemma validados por código, pruebas de la lógica en Node, sondas en Chromium.",
  ],
  pending: [
    "Correr el Kanban otra vez con v0.2.",
    "Arrastrar y teclado no se prueban (toda acción tiene botón; arrastrar va además).",
    "Un problema de un paso puede venir de otro archivo: hoy el motor solo reintenta el paso que falla.",
    "Las expectativas de Gemma (\"cambia\") se observan; ver si sirven antes de que bloqueen.",
  ],
  aliases: { estado: ["state", "appState"], nuevo: ["newState", "next"], texto: ["text"], titulo: ["title"], nombre: ["name"] },
  mainId: "principal",
  defaultTitle: "App",
  ids: IDS,
  scripts: SCRIPTS,
  contract: contractText,
  hints: appHints,
  hintsText: (h) => `pistas del brief: ${h.features.length} features${h.style.length ? ` (de estilo: ${h.style.join(", ")})` : ""}`,
  steps: [
    {
      id: "contrato", kind: "data", answer: "contrato.json", file: "js/datos.js", cap: 3000,
      answerHint: 'Respondé SOLO con ### FILE: contrato.json, un JSON como el del formato (no escribas código).',
      prompt: (c) => `${c.paso}: antes de programar, definí el CONTRATO de la app como JSON (no escribas código). El harness lo valida y con él arma js/datos.js y las pruebas.
- "estado": el estado INICIAL de la app, solo datos (objetos, listas, textos, números, true/false), con ejemplos reales para que la pantalla no arranque vacía (2 o 3 por lista). Cada cosa que se pueda editar, mover o borrar lleva un "id" único. Corto: hasta ${MAX_STATE_CHARS} caracteres.
- "acciones": lo que el usuario puede hacer. Cada una: "nombre" (verbo en camelCase), "params" (lo que recibe ADEMÁS del estado), "ejemplo" (un valor por param, que funcione con el estado inicial: ids que existan), "hace" (una frase), "features" (números de las features del brief que cumple) y "cambia" (qué claves de "estado" cambia).
- "se_ve": números de las features que solo se VEN en la pantalla (no son acciones), también las de aspecto: colores, estilo, sombras, efectos al pasar el mouse.
Toda acción la dispara un botón (arrastrar puede ir además, nunca en vez del botón). Lo que el usuario escribe es un texto o un número por param (una lista no: que la acción reciba un elemento por vez).
Cada feature del brief va en "features" de alguna acción o en "se_ve"${c.hints.style.length ? ` (salvo las de estilo: ${c.hints.style.join(", ")})` : ""}.
Formato (es un ejemplo de la forma, no de esta app):
### FILE: contrato.json
${fence("json", CONTRACT_FMT)}`,
      take: (raw, c) => ({ ...c, "contrato.json": c["contrato.json"] || (String(raw).match(/\{[\s\S]*"acciones"[\s\S]*\}/) || [])[0] || null }),
      parse: (json, c) => parseContract(json, c.hints),
      need: () => 1,
      missing: () => "el contrato no tiene ninguna acción válida.",
      // juntando intentos: se queda el contrato que menos features deja afuera
      emit: (items, reports, c) => {
        const i = bestContract(items, reports, c.hints);
        return { items: [items[i]], reports: [reports[i]], js: datosJs(items[i].estado) };
      },
      check: (parsed, c) => contractProblems(parsed, c.hints),
      summaryText: (p) => { const k = p.items[0], r = p.reports[0] || {};
        return `contrato: ${k.acciones.length} acciones (${k.acciones.map((a) => a.nombre).join(", ")}) · estado: ${Object.keys(k.estado).join(", ")}${r.renamed?.length ? ` · nombres arreglados: ${r.renamed.join(", ")}` : ""}${r.gaps?.length ? ` · features sin cubrir: ${r.gaps.join(", ")}` : ""}${r.dropped?.length ? ` · descartadas: ${r.dropped.slice(0, 2).join(" | ")}` : ""}`; },
    },
    {
      id: "logica", kind: "logic", file: "js/logica.js", cap: 5000, needs: ["contrato"],
      global: "App", pure: true, label: "lógica de una app, sin DOM",
      // las funciones y las pruebas salen del contrato (paso 1)
      resolve: (ctx) => { const c = contractOf(ctx); return c ? { functions: ["crear", ...c.acciones.map((a) => a.nombre)], tests: logicTests(c), observe: observeChanges(c) } : {}; },
      prompt: (c) => `${c.notes ? `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\n` : ""}YA EXISTE js/datos.js (lo armó el harness) con ESTADO_INICIAL.\n\n${c.paso}: escribí js/logica.js (const App = { crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")} }). Sin DOM. El harness lo va a probar con ESTADO_INICIAL y el "ejemplo" de cada acción:\n${contractOf(c).acciones.map((a) => `- App.${a.nombre}(App.crear()${a.ejemplo.map((v) => ", " + JSON.stringify(v)).join("")})`).join("\n")}`,
    },
    {
      // v0.4.0 (punto 8): los controles de cada elemento los arma el código (controls.mjs), no el modelo
      id: "acciones", kind: "written", file: "js/acciones.js", needs: ["contrato"],
      write: (ctx) => { const c = contractOf(ctx); return c ? { "js/acciones.js": accionesJs(controlsPlan(c)) } : {}; },
      check: (c) => { try { new Function(c["js/acciones.js"]); return []; } catch (e) { return Object.assign([`js/acciones.js no compila: ${e.message}`], { fatal: true }); } },
    },
    {
      id: "pantalla", kind: "screen", files: ["app.html", "styles.css"], cap: 4500,
      noDisabled: true,
      // v0.2 (Kanban real): los formularios fijos necesitaban datos del estado (columna, tarjeta) que nadie llenaba
      forbidTags: FORBIDDEN_TAGS,
      prompt: (c) => `${c.paso}: escribí app.html (SOLO <h1> con el título y <div id="app"></div>: nada más; lo demás lo arma dibujar(); sin <html>, <head>, <script> ni <style>) y styles.css: todo el estilo, sobre todo de lo que dibujar() va a armar adentro de #app. Elegí una clase para cada cosa (cada lista del estado y cada elemento) y escribí su estilo: dibujar() va a usar esas clases. Los campos y botones de las acciones los arma el harness con estas clases: .ctl-controles (todos los de un elemento), .ctl-accion (una acción: sus campos y su botón), .ctl-boton (el botón), y adentro input y select: escribí su estilo también. Respetá los CRITERIOS DE ESTILO del brief.`,
    },
    {
      id: "dibujo", kind: "render", file: "js/dibujo.js", cap: 4500, needs: ["contrato", "logica", "acciones"],
      defines: "dibujar(estado)", notOwn: { names: ["estado", "controlesDe"], owner: "js/controles.js y js/acciones.js (los escribe el harness)" }, noListeners: true,
      call: "dibujar(App.crear())", probe: PROBE,
      resolve: (ctx) => (contractOf(ctx) ? { probe: probeFor(contractOf(ctx), cssClasses(ctx.files?.["styles.css"])) } : {}),
      expect: (p) => {
        const out = [];
        // v0.4.0: los botones los arma controlesDe; si falta uno, es que no se agregó controlesDe en ese tipo de elemento
        if (p.noButton?.length) { const by = {}; p.noButton.forEach((x) => { const [a, t] = x.split("@"); (by[t || "?"] ||= []).push(a); });
          out.push(`faltan los controles de: ${Object.entries(by).map(([t, as]) => `${as.join(", ")} (agregá ${t === "app" ? 'controlesDe("app", null, estado) una vez al final de #app' : `controlesDe("${t}", elemento, estado) adentro de cada elemento de ese tipo`})`).join("; ")}.`); }
        if (p.noId?.length) out.push(`a estos botones les falta el id en b.dataset: ${p.noId.map((x) => { const [a, k] = x.split(":"); return `${a} (b.dataset.${k}, en HTML data-${k})`; }).join(", ")}. La clave va en minúsculas: el HTML pasa data-cardId a data-cardid. Si ese id no es del elemento donde está el botón (un destino), dibujá un botón por cada valor posible.`);
        if (p.noField?.length) {
          const fl = p.noField.map((x) => { const [a, k] = x.split(":"); return { a, k: k.replace(/[!?]/g, ""), hidden: k.includes("!"), btnHidden: k.includes("?") }; });
          const miss = fl.filter((f) => !f.hidden && !f.btnHidden), hid = fl.filter((f) => f.hidden || f.btnHidden);
          if (miss.length) out.push(`faltan campos al lado del botón (en su mismo elemento padre): ${miss.map((f) => `${f.a} → <input data-campo="${f.k}">`).join(", ")}.`);
          if (hid.length) out.push(`estos campos (o su botón) están ocultos (display:none) y nada los muestra: ${hid.map((f) => `${f.a} → data-campo="${f.k}"`).join(", ")}. Dibujá el campo VISIBLE, al lado de su botón, sin ocultarlo ni abrirlo con otro botón.`);
        }
        if (p.unstyled?.length && p.unused?.length && (p.pairs?.length || (p.styledShare ?? 1) < 0.5)) out.push(`dibujar usa clases que no tienen estilo en styles.css (${p.unstyled.slice(0, 6).map((k) => "." + k).join(", ")}) y styles.css tiene estilo para clases que nadie usa (${p.unused.slice(0, 8).map((k) => "." + k).join(", ")})${p.pairs?.length ? `; parecen las mismas: ${p.pairs.slice(0, 4).map((x) => x.split("~").map((k) => "." + k).join(" ↔ ")).join(", ")}` : ""}: usá las clases de styles.css.`);
        if (!p.children) out.push("dibujar(App.crear()) no dibujó nada dentro de #app.");
        // v0.4.3: un contenedor de más entre #app y las piezas deshace la distribución del CSS
        if (p.wrapper) out.push(`styles.css arma la distribución en #app (display: ${p.wrapper.app}), pero dibujar mete todo dentro de un solo <${p.wrapper.tag}${p.wrapper.cls ? ` class="${p.wrapper.cls}"` : ""}> que no la tiene: las piezas quedan apiladas una debajo de la otra. Poné los elementos directo dentro de #app, sin ese contenedor.`);
        if (p.missing?.length) out.push(`estos textos del estado no se ven en #app: ${p.missing.slice(0, 5).map((t) => JSON.stringify(t)).join(", ")}${p.missing.length > 5 ? ` y ${p.missing.length - 5} más` : ""}. Todo lo que está en el estado se muestra.`);
        if (p.objectText) out.push(`en #app aparece "${p.objectText}": se escribió un objeto o un elemento como texto. Escribí sus propiedades (p.ej. item.texto) con textContent.`);
        // v0.4.2 (seguridad): el aviso vuelve al autor; Validation lo revisa aparte con el profile web/seguridad (SEG-1)
        if (p.htmlInText?.length) out.push(`dibujar escribe los textos del estado como HTML (innerHTML o += con \`...\`): si una persona escribe "<img src=x onerror=...>" se ejecuta código. Pasó con: ${p.htmlInText.map((t) => JSON.stringify(t)).join(", ")}. Mostrá cada texto con textContent (o document.createTextNode), nunca metido dentro de innerHTML.`);
        if (p.undef?.length) out.push(`en #app aparece ${p.undef.map((w) => `"${w}"`).join(", ")}: se lee una propiedad que no existe en el estado (mirá los nombres de ESTADO_INICIAL).`);
        return out;
      },
      prompt: (c) => { const k = cssClasses(c.files?.["styles.css"]);
        return `YA EXISTEN: ESTADO_INICIAL, App (crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")}) y app.html:\n${fence("html", c.fragment.slice(0, 2500))}\n${k.length ? `styles.css tiene estilo para estas clases (usalas): ${k.slice(0, 40).map((x) => "." + x).join(" ")}\n` : ""}YA EXISTE controlesDe(tipo, elemento, estado) (js/acciones.js, lo armó el harness): devuelve los campos y botones de las acciones de ese elemento, ya conectados.\n\n${c.paso}: escribí js/dibujo.js (function dibujar(estado)): mostrá cada elemento del estado con sus textos y agregale adentro sus controles:\n${tiposText(contractOf(c))}\nPor ejemplo: const el = document.createElement("div"); el.className = "<clase de styles.css>"; (sus textos con textContent); el.appendChild(controlesDe("<tipo>", elemento, estado)); No dibujes botones ni campos propios para las acciones.`; },
    },
    {
      id: "controles", kind: "wiring", file: "js/controles.js", cap: 4500, needs: ["logica", "acciones", "dibujo"],
      play: [{ type: "no_js_errors", params: {} }],
      // v0.3.0 (punto 8): lo escribe el harness desde el contrato (con --gemma-writes-all lo escribe Gemma, para comparar)
      write: (ctx) => { const c = contractOf(ctx); return c ? { "js/controles.js": controlesJs(c) } : {}; },
      // cada acción se tiene que poder usar desde la pantalla (todas son botones desde v0.2)
      resolve: (ctx) => { const c = contractOf(ctx); if (!c) return {};
        return { calls: { global: "App", draw: "dibujar", methods: c.acciones.map((a) => a.nombre), forms: [],
          hints: Object.fromEntries(c.acciones.map((a) => [a.nombre, `el listener click de #app, con b.dataset.accion === "${a.nombre}", hace estado = ${callOf(a)} y dibujar(estado)`])) } }; },
      prompt: (c) => `${c.notes ? `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\n` : ""}YA EXISTEN: ESTADO_INICIAL, App (crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")}) y dibujar(estado), que dibuja un botón por acción con sus ids en b.dataset y sus campos al lado.\n\n${c.paso}: escribí js/controles.js: let estado = App.crear(); UN listener click en #app con const b = ev.target.closest("[data-accion]"), y por cada acción:\n${contractOf(c).acciones.map((a) => `- "${a.nombre}": estado = ${callOf(a)};`).join("\n")}\ndespués dibujar(estado). Al final del archivo: dibujar(estado).`,
    },
  ],
};
export default STANDARD;
