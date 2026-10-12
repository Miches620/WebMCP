// standard.mjs — Standard "app con estado" (web/app/estado) · DRAFT v0.1.0 (12/10).
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
//   3. pantalla  (screen) app.html + styles.css: #app, ningún botón con disabled
//   4. dibujo    (render) js/dibujo.js: dibujar(estado) en Chromium: dibuja algo, los textos del estado se ven
//   5. controles (wiring) js/controles.js: cada acción de botón/formulario se puede usar y después se dibuja
//
// Nada de un dominio acá (ni Kanban ni contador): lo prueba test_estado.mjs con dos apps distintas.
// DRAFT: no tiene evidencia todavía. Primera corrida: el Kanban (Project23/24).

import { parseContract, contractProblems, bestContract, datosJs, signature, MAX_STATE_CHARS } from "./contract.mjs";
import { logicTests, observeChanges } from "./acceptance.mjs";

export const IDS = ["app"];
export const SCRIPTS = ["js/datos.js", "js/logica.js", "js/dibujo.js", "js/controles.js"];
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
const actionLine = (a) => `    - ${signature(a)}: ${a.hace || "(sin descripción)"}${a.control !== "boton" ? ` [${a.control}]` : ""}`;
/** El contrato que lee Gemma. Antes del paso 1 dice la forma; después, las acciones y el estado reales. */
export function contractText(ctx) {
  const c = contractOf(ctx);
  const app = c ? `const App = { crear(), ${c.acciones.map((a) => `${a.nombre}(${["estado", ...a.params].join(", ")})`).join(", ")} }` : "const App = { crear(), <una función por acción>(estado, ...params) }";
  return `CONTRATO DE LA APP (lo define el harness; respetalo al pie de la letra):
- Archivos: app.html (solo el contenido de la pantalla), styles.css, js/datos.js, js/logica.js, js/dibujo.js, js/controles.js. Se cargan en ese orden con <script src> comunes: NADA de import/export ni módulos. Cada archivo define SOLO lo suyo.
- js/datos.js (lo escribe el harness a partir de contrato.json) define: const ESTADO_INICIAL = ${c ? JSON.stringify(c.estado) : "{...}"};
- js/logica.js define: ${app}. Sin DOM (no usa document ni window). crear() devuelve una COPIA profunda de ESTADO_INICIAL (JSON.parse(JSON.stringify(ESTADO_INICIAL))). Cada acción DEVUELVE UN ESTADO NUEVO y completo (no modifica el que recibe; mismas claves); en el estado van solo datos (textos, números, true/false, listas y objetos), nunca elementos de la página.${c ? `\n  Acciones:\n${c.acciones.map(actionLine).join("\n")}` : ""}
- app.html: la pantalla, con un contenedor #app vacío (ahí dibuja dibujar()) y, si hacen falta, formularios y botones fijos (con id). Sin <script> ni <style>. Ningún botón con disabled.
- js/dibujo.js define: function dibujar(estado). Vacía #app y lo arma desde el estado (todo lo que el usuario ve sale del estado). Cada botón que dibuja lleva data-accion="<nombre de la acción>" y data-id (u otro data-*) con lo que esa acción necesita. No agrega listeners.
- js/controles.js: let estado = App.crear(); UN listener click en #app que lee data-accion (delegación) y los listeners de los formularios y botones fijos de app.html (submit con event.preventDefault()). Cada uno hace estado = App.<acción>(estado, ...) y después dibujar(estado). Al final del archivo: dibujar(estado).`;
}

const CONTRACT_FMT = `{ "estado": { "items": [ { "id": 1, "texto": "Primer ejemplo", "hecho": false }, { "id": 2, "texto": "Segundo ejemplo", "hecho": true } ] },
  "acciones": [
    { "nombre": "agregarItem", "params": ["texto"], "ejemplo": ["Comprar pan"], "hace": "agrega un item al final", "control": "formulario", "features": [1], "cambia": ["items"] },
    { "nombre": "borrarItem", "params": ["id"], "ejemplo": [1], "hace": "saca el item con ese id", "control": "boton", "features": [2], "cambia": ["items"] }
  ],
  "se_ve": [3] }`;

// ---------- sonda de dibujar() (la corre el kit web en Chromium) ----------
// Textos para personas = strings del estado con un espacio o una mayúscula ("Por hacer", "Diseñar logo");
// los ids y estados internos ("col-1", "hecho") pueden no mostrarse.
const PROBE = `window.__probe = (function () {
  try {
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
    return { ok: true, children: box.children.length, total: texts.length,
      missing: texts.filter(function (t) { return txt.indexOf(norm(t)) < 0; }),
      objectText: ((box.textContent || "").match(/\\[object \\w+\\]/) || [])[0] || "",
      undef: ["undefined", "nan", "null"].filter(function (w) { return new RegExp("\\\\b" + w + "\\\\b").test(txt) && inState.indexOf(w) < 0; }) };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
})();`;

const STANDARD = {
  id: "web/app/estado",
  version: "0.1.0",
  status: "DRAFT",
  label: "app de una pantalla con estado y acciones",
  describe: "App de una pantalla por archivos: el contrato (estado inicial + acciones) lo propone Gemma como datos y el harness lo valida; js/logica.js (lógica pura probada en Node con pruebas que salen del contrato), app.html + styles.css, js/dibujo.js (probado en Chromium), js/controles.js (cada acción se puede usar desde la pantalla).",
  evidence: [
    "Diseño (12/10): Kanban v1 (Project23, componente único): editar borraba etiquetas, \"[object HTMLDivElement]\" en pantalla, + Añadir Columna sin efecto, doble confirm. Ningún chequeo lo vio.",
    "Herencia: grilla (Boxworld, Depósito, Invernadero): un archivo por paso, datos de Gemma validados por código, pruebas de la lógica en Node, sondas en Chromium.",
  ],
  pending: [
    "Primera corrida: Kanban (Project23/24). Todo lo de este Standard es diseño, sin evidencia.",
    "Arrastrar y teclado no se prueban en controles (solo botón y formulario).",
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
- "acciones": lo que el usuario puede hacer. Cada una: "nombre" (verbo en camelCase), "params" (lo que recibe ADEMÁS del estado), "ejemplo" (un valor por param, que funcione con el estado inicial: ids que existan), "hace" (una frase), "control" (cómo la dispara el usuario: "boton", "formulario", "arrastrar" o "teclado"), "features" (números de las features del brief que cumple) y "cambia" (qué claves de "estado" cambia).
- "se_ve": números de las features que solo se VEN en la pantalla (no son acciones).
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
      prompt: (c) => `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\nYA EXISTE js/datos.js (lo armó el harness) con ESTADO_INICIAL.\n\n${c.paso}: escribí js/logica.js (const App = { crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")} }). Sin DOM. El harness lo va a probar con ESTADO_INICIAL y el "ejemplo" de cada acción:\n${contractOf(c).acciones.map((a) => `- App.${a.nombre}(App.crear()${a.ejemplo.map((v) => ", " + JSON.stringify(v)).join("")})`).join("\n")}`,
    },
    {
      id: "pantalla", kind: "screen", files: ["app.html", "styles.css"], cap: 4500,
      noDisabled: true,
      prompt: (c) => { const fixed = contractOf(c).acciones.filter((a) => a.control === "formulario");
        return `${c.paso}: escribí app.html (SOLO el contenido de la pantalla: título, el contenedor #app vacío${fixed.length ? ` y un formulario (con id) para ${fixed.map((a) => `${a.nombre} (${a.params.join(", ") || "sin datos"})`).join(", ")}` : ""}; sin <html>, <head>, <script> ni <style>; ningún botón con disabled) y styles.css (todo el estilo de la página, también de lo que dibujar() arma adentro de #app). Respetá los CRITERIOS DE ESTILO del brief.`; },
    },
    {
      id: "dibujo", kind: "render", file: "js/dibujo.js", cap: 4500, needs: ["contrato", "logica"],
      defines: "dibujar(estado)", notOwn: { names: ["estado"], owner: "js/controles.js (paso 5)" }, noListeners: true,
      call: "dibujar(App.crear())", probe: PROBE,
      expect: (p) => {
        const out = [];
        if (!p.children) out.push("dibujar(App.crear()) no dibujó nada dentro de #app.");
        if (p.missing?.length) out.push(`estos textos del estado no se ven en #app: ${p.missing.slice(0, 5).map((t) => JSON.stringify(t)).join(", ")}${p.missing.length > 5 ? ` y ${p.missing.length - 5} más` : ""}. Todo lo que está en el estado se muestra.`);
        if (p.objectText) out.push(`en #app aparece "${p.objectText}": se escribió un objeto o un elemento como texto. Escribí sus propiedades (p.ej. item.texto) con textContent.`);
        if (p.undef?.length) out.push(`en #app aparece ${p.undef.map((w) => `"${w}"`).join(", ")}: se lee una propiedad que no existe en el estado (mirá los nombres de ESTADO_INICIAL).`);
        return out;
      },
      prompt: (c) => `YA EXISTEN: ESTADO_INICIAL, App (crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")}) y app.html:\n${fence("html", c.fragment.slice(0, 2500))}\n\n${c.paso}: escribí js/dibujo.js (function dibujar(estado)). Los botones de cada elemento llevan data-accion y data-id: ${contractOf(c).acciones.filter((a) => a.control === "boton").map((a) => `data-accion="${a.nombre}"`).join(", ") || "(ninguna acción es de botón)"}.`,
    },
    {
      id: "controles", kind: "wiring", file: "js/controles.js", cap: 4500, needs: ["logica", "dibujo"],
      play: [{ type: "no_js_errors", params: {} }],
      // cada acción que el usuario dispara con un botón o un formulario se tiene que poder usar desde la pantalla
      resolve: (ctx) => { const c = contractOf(ctx); if (!c) return {};
        const reach = c.acciones.filter((a) => a.control === "boton" || a.control === "formulario");
        return { calls: { global: "App", draw: "dibujar", methods: reach.map((a) => a.nombre), forms: reach.filter((a) => a.control === "formulario").map((a) => a.nombre),
          hints: Object.fromEntries(reach.map((a) => [a.nombre, a.control === "formulario" ? "el formulario de app.html, al enviarse, hace estado = App." + a.nombre + "(estado, ...) y dibujar(estado)" : `un botón con data-accion="${a.nombre}": el listener click de #app lo lee y hace estado = App.${a.nombre}(estado, ...)`])) } }; },
      prompt: (c) => `NOTAS DEL TECHLEADER (contexto):\n${c.notes}\n\nYA EXISTEN: ESTADO_INICIAL, App (crear, ${contractOf(c).acciones.map((a) => a.nombre).join(", ")}), dibujar(estado) y app.html:\n${fence("html", c.fragment.slice(0, 2500))}\n\n${c.paso}: escribí js/controles.js (let estado = App.crear(); los listeners que llaman a cada acción y después a dibujar(estado); al final dibujar(estado)).`,
    },
  ],
};
export default STANDARD;
