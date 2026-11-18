// nucleo.mjs — modo --grilla del ciclo, paso 1 del plan B (17/11, rama grilla, decisión de Miche: "sigamos").
//
// Por qué: en todas las réplicas de la hoja (sin MVC 5,6,5 · mvc v0.5 9,8,3, con la misma config) Gemma fallaba
// siempre en lo MISMO, que no es lo que el usuario pidió sino la "cañería" de una grilla:
//   - la grilla en <div> (s3: el juez no encuentra "la celda A1" y la corrida queda en 0 con cualquier versión),
//   - guardar al terminar de editar (blur no burbujea → nunca guardaba; render pisaba lo que se escribía),
//   - "no hay un control para color/borrar/ocultar", o el control existe y no hace nada,
//   - arreglos que rompen guardar/cargar (R9).
// Igual que el Standard de grilla para juegos: lo que es siempre igual lo escribe el código (probado); Gemma escribe
// solo lo que es de ESTA app y se puede probar: logica.js (valorDe y una función por acción) y acciones.json.
//
// Lo que arma este archivo (todo texto, para escribir en la carpeta de la app):
//   index.html  la tabla #hoja (letras arriba, números al costado, td[data-cell] editables) + #barra + los <script>
//   base.css    lo mínimo para que la grilla se vea como grilla (Gemma suma styles.css encima)
//   nucleo.js   editar (focusout / Enter, sin redibujar la celda que se edita), selección (celda / columna / fila),
//               la barra (un control por acción de acciones.json), dibujar desde el estado, guardar y cargar
//   acciones.js const ACCIONES = [...] (de acciones.json, validado)
// El estado tiene forma FIJA: { celdas: { A1: { texto, color } }, ocultas: { columnas: ["A"], filas: ["3"] } }.
// Logica (de Gemma): valorDe(estado, id) → lo que muestra la celda (resultado de la fórmula); escribir(estado, id, texto)
// opcional; y una función por acción: f(estado, sel, valor) con sel = { tipo: "celda"|"columna"|"fila", id, celdas: [...] }.
// Puede cambiar el estado o devolver uno nuevo.

export const GRILLA_VERSION = "grilla v0.1";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Columnas y filas de la grilla, de la fila de la planilla que prueba los encabezados (plantilla "grilla"). */
export function dimsDe(planilla) {
  for (const f of planilla?.filas || []) for (const v of f.veo || []) {
    const e = v?.encabezados;
    if (e && Array.isArray(e.columnas) && Array.isArray(e.filas) && e.columnas.length && e.filas.length) return { columnas: e.columnas.map(String), filas: e.filas.map(String) };
  }
  return null;
}

export function armarIndex({ columnas, filas }, titulo = "Hoja de cálculo") {
  const cab = `<tr><th class="esquina"></th>${columnas.map((c) => `<th class="col" data-col="${esc(c)}">${esc(c)}</th>`).join("")}</tr>`;
  const cuerpo = filas.map((f) => `<tr data-fila="${esc(f)}"><th class="fila">${esc(f)}</th>${columnas.map((c) => `<td data-cell="${esc(c + f)}" data-col="${esc(c)}" contenteditable="true"></td>`).join("")}</tr>`).join("\n");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<h1>${esc(titulo)}</h1>
<div id="barra"></div>
<table id="hoja">
<thead>${cab}</thead>
<tbody>
${cuerpo}
</tbody>
</table>
<script src="acciones.js"></script>
<script src="logica.js"></script>
<script src="nucleo.js"></script>
</body>
</html>
`;
}

export const BASE_CSS = `/* base.css — lo pone el harness (modo --grilla): que la grilla se vea como grilla. El estilo de la app va en styles.css. */
body { font-family: Arial, sans-serif; margin: 16px; }
#barra { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
#barra .accion { display: inline-flex; gap: 6px; align-items: center; padding: 4px 10px; border: 1px solid #bbb; border-radius: 6px; background: #f7f7f7; cursor: pointer; font: inherit; }
#hoja { border-collapse: collapse; table-layout: fixed; }
#hoja th, #hoja td { border: 1px solid #ccc; min-width: 64px; height: 24px; padding: 2px 6px; text-align: left; }
#hoja thead th, #hoja th.fila { background: #f1f3f4; text-align: center; cursor: pointer; user-select: none; }
#hoja th.esquina { cursor: default; }
#hoja .seleccionada { outline: 2px solid #1a73e8; outline-offset: -2px; }
#hoja td:focus { outline: 2px solid #1a73e8; outline-offset: -2px; }
`;

// lo que corre en el navegador: solo DOM y localStorage, sin nada de la app (los nombres de las acciones vienen de ACCIONES)
export const NUCLEO_JS = `// nucleo.js — lo escribe el harness (modo --grilla): NO lo cambies. Editar, seleccionar, la barra, dibujar, guardar y cargar.
(function () {
  var CLAVE = "hoja";
  var H = window.Hoja = { estado: null, sel: null };
  var tabla = document.getElementById("hoja");
  var COLS = Array.prototype.map.call(tabla.querySelectorAll("thead th[data-col]"), function (th) { return th.dataset.col; });
  var FILAS = Array.prototype.map.call(tabla.querySelectorAll("tbody tr[data-fila]"), function (tr) { return tr.dataset.fila; });
  var L = function () { return typeof Logica === "object" && Logica ? Logica : {}; };
  function vacio() { return { celdas: {}, ocultas: { columnas: [], filas: [] } }; }
  function sano(e) {
    e = e && typeof e === "object" && !Array.isArray(e) ? e : vacio();
    if (!e.celdas || typeof e.celdas !== "object" || Array.isArray(e.celdas)) e.celdas = {};
    if (!e.ocultas || typeof e.ocultas !== "object") e.ocultas = {};
    e.ocultas.columnas = Array.isArray(e.ocultas.columnas) ? e.ocultas.columnas.map(String) : [];
    e.ocultas.filas = Array.isArray(e.ocultas.filas) ? e.ocultas.filas.map(String) : [];
    return e;
  }
  function cargar() { try { H.estado = sano(JSON.parse(localStorage.getItem(CLAVE))); } catch (e) { H.estado = vacio(); } }
  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(H.estado)); } catch (e) {} }
  function celdasDe(sel) {
    if (!sel) return [];
    if (sel.tipo === "celda") return [sel.id];
    if (sel.tipo === "columna") return FILAS.map(function (f) { return sel.id + f; });
    return COLS.map(function (c) { return c + sel.id; });
  }
  function texto(id) { var c = H.estado.celdas[id]; return c && c.texto != null ? String(c.texto) : ""; }
  function valor(id) {
    if (typeof L().valorDe !== "function") return texto(id);
    try { var v = L().valorDe(H.estado, id); return v == null ? "" : String(v); }
    catch (e) { console.error("Logica.valorDe(estado, \\"" + id + "\\") tiró un error: " + e.message); return "#ERROR"; }
  }
  function dibujar() {
    var oc = H.estado.ocultas, sel = celdasDe(H.sel);
    tabla.querySelectorAll("[data-col]").forEach(function (el) { el.style.display = oc.columnas.indexOf(el.dataset.col) >= 0 ? "none" : ""; });
    tabla.querySelectorAll("tbody tr[data-fila]").forEach(function (tr) { tr.style.display = oc.filas.indexOf(tr.dataset.fila) >= 0 ? "none" : ""; });
    tabla.querySelectorAll("td[data-cell]").forEach(function (td) {
      var id = td.dataset.cell, c = H.estado.celdas[id] || {};
      td.style.backgroundColor = c.color || "";
      // la celda que se está escribiendo no se toca (si no, se pierde lo que se escribe); el color sí
      if (td !== document.activeElement) td.textContent = valor(id);
      td.classList.toggle("seleccionada", sel.indexOf(id) >= 0);
    });
    tabla.querySelectorAll("thead th[data-col]").forEach(function (th) { th.classList.toggle("seleccionada", !!H.sel && H.sel.tipo === "columna" && H.sel.id === th.dataset.col); });
    tabla.querySelectorAll("tbody th.fila").forEach(function (th) { th.classList.toggle("seleccionada", !!H.sel && H.sel.tipo === "fila" && H.sel.id === th.parentElement.dataset.fila); });
  }
  function hacer(nombre, args) {
    var f = L()[nombre];
    if (typeof f !== "function") { console.error("Logica." + nombre + " no existe: la usa la barra (acciones.json) pero logica.js no la define"); return; }
    try { var r = f.apply(null, [H.estado].concat(args)); if (r && typeof r === "object") H.estado = r; }
    catch (e) { console.error("Logica." + nombre + " tiró un error: " + e.message); }
    H.estado = sano(H.estado); guardar(); dibujar();
  }
  function escribir(id, t) {
    if (typeof L().escribir === "function") return hacer("escribir", [id, t]);
    H.estado.celdas[id] = Object.assign({}, H.estado.celdas[id] || {}, { texto: t });
    guardar(); dibujar();
  }
  function seleccion() { return H.sel ? { tipo: H.sel.tipo, id: H.sel.id, celdas: celdasDe(H.sel) } : null; }
  // ---- editar: al entrar se ve lo que se escribió (la fórmula); se guarda al salir o con Enter (focusout burbujea, blur no)
  tabla.addEventListener("focusin", function (ev) { var td = ev.target.closest && ev.target.closest("td[data-cell]"); if (td) td.textContent = texto(td.dataset.cell); });
  tabla.addEventListener("focusout", function (ev) { var td = ev.target.closest && ev.target.closest("td[data-cell]"); if (td) { escribir(td.dataset.cell, td.textContent.replace(/\\n+$/, "")); td.textContent = valor(td.dataset.cell); } });
  tabla.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && ev.target.matches && ev.target.matches("td[data-cell]")) { ev.preventDefault(); ev.target.blur(); } });
  // ---- seleccionar: un clic en la celda, en la letra de la columna o en el número de la fila
  tabla.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("td[data-cell], thead th[data-col], tbody th.fila");
    if (!t) return;
    if (t.matches("td")) H.sel = { tipo: "celda", id: t.dataset.cell };
    else if (t.matches("thead th")) H.sel = { tipo: "columna", id: t.dataset.col };
    else H.sel = { tipo: "fila", id: t.parentElement.dataset.fila };
    dibujar();
  });
  // ---- la barra: un control por acción (nombre visible); actúa sobre lo seleccionado
  var barra = document.getElementById("barra");
  (typeof ACCIONES !== "undefined" && Array.isArray(ACCIONES) ? ACCIONES : []).forEach(function (a) {
    if (a.pide === "color") {
      var lab = document.createElement("label"); lab.className = "accion"; lab.dataset.accion = a.funcion;
      lab.appendChild(document.createTextNode(a.nombre + " "));
      var inp = document.createElement("input"); inp.type = "color"; inp.value = "#ffff00";
      inp.addEventListener("change", function () { if (H.sel) hacer(a.funcion, [seleccion(), inp.value]); });
      lab.appendChild(inp); barra.appendChild(lab);
    } else {
      var b = document.createElement("button"); b.type = "button"; b.className = "accion"; b.dataset.accion = a.funcion; b.textContent = a.nombre;
      b.addEventListener("click", function () { if (H.sel) hacer(a.funcion, [seleccion()]); });
      barra.appendChild(b);
    }
  });
  cargar(); dibujar();
})();
`;

const RESERVADAS = new Set(["valorDe", "escribir", "constructor", "prototype", "__proto__"]);
export const MAX_ACCIONES = 12;

/** acciones.json → { acciones, problemas }. Cada una: { nombre (lo que se lee en la barra), funcion (de Logica), pide: null | "color" }. */
export function leerAcciones(texto) {
  let a;
  try { a = typeof texto === "string" ? JSON.parse(texto) : texto; } catch (e) { return { acciones: [], problemas: [`acciones.json no es JSON: ${e.message}`] }; }
  if (a && !Array.isArray(a) && Array.isArray(a.acciones)) a = a.acciones;
  if (!Array.isArray(a)) return { acciones: [], problemas: ["acciones.json tiene que ser una lista: [{ \"nombre\": \"…\", \"funcion\": \"…\", \"pide\": null }]"] };
  const out = [], problemas = [], vistas = new Set();
  a.forEach((x, i) => {
    const nombre = String(x?.nombre ?? "").trim(), funcion = String(x?.funcion ?? "").trim(), pide = x?.pide ?? null;
    if (!nombre) return problemas.push(`acción ${i + 1}: falta "nombre" (el texto del control)`);
    if (!/^[A-Za-z_$][\w$]*$/.test(funcion)) return problemas.push(`"${nombre}": "funcion" tiene que ser el nombre de una función de Logica (p. ej. "pintar"), no ${JSON.stringify(x?.funcion ?? null)}`);
    if (RESERVADAS.has(funcion)) return problemas.push(`"${nombre}": "${funcion}" no puede ser una acción de la barra (la usa el núcleo)`);
    if (pide !== null && pide !== "color") return problemas.push(`"${nombre}": "pide" es null o "color", no ${JSON.stringify(pide)}`);
    if (vistas.has(nombre.toLowerCase())) return problemas.push(`"${nombre}" está repetida`);
    vistas.add(nombre.toLowerCase());
    out.push({ nombre: nombre.slice(0, 40), funcion, pide });
  });
  if (out.length > MAX_ACCIONES) { problemas.push(`hay ${out.length} acciones: como mucho ${MAX_ACCIONES}`); out.length = MAX_ACCIONES; }
  return { acciones: out, problemas };
}

export const accionesJs = (acciones) => `// acciones.js — lo arma el harness desde acciones.json (modo --grilla): un control por acción en la barra\nconst ACCIONES = ${JSON.stringify(acciones, null, 2)};\n`;

/** Las funciones que Logica tiene que tener: valorDe + una por acción. */
export const funcionesPedidas = (acciones) => ["valorDe", ...new Set(acciones.map((a) => a.funcion))];

/** La app entera (archivos de texto) a partir de lo de Gemma. */
export function armarApp({ dims, titulo, logica = "const Logica = {};\n", acciones = [], estilos = "" }) {
  return {
    "index.html": armarIndex(dims, titulo),
    "base.css": BASE_CSS,
    "styles.css": estilos,
    "nucleo.js": NUCLEO_JS,
    "acciones.js": accionesJs(acciones),
    "logica.js": logica,
  };
}
