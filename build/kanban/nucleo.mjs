// nucleo.mjs — el núcleo del tablero Kanban (plan B en otra app, paso 1, 18/11). Como build/grilla/nucleo.mjs: el harness
// escribe la plomería (index.html, base.css, nucleo.js; tablero.js sale de tablero.json) y Gemma escribe SOLO
// logica.js (las reglas), tablero.json (columnas, dónde se agrega, campos) y styles.css.
import { readFileSync } from "node:fs";
import { funcionesDeLogica } from "../grilla/nucleo.mjs";

export const KANBAN_VERSION = "kanban v0.2";
// v0.2 (19/11, réplicas v0.1: 24, 19, 19 de 26; "sin" 13, 4, 15): los formularios y el aviso se muestran con estilo forzado
// (styles.css no los puede esconder) y styles.css se cambia de a una regla (### CSS: selector).
export const NUCLEO_JS = readFileSync(new URL("./nucleo.js", import.meta.url), "utf8");
export const BASE_CSS = readFileSync(new URL("./base.css", import.meta.url), "utf8");
export const MAX_COLUMNAS = 8, MAX_CAMPOS = 8;
export const TIPOS = ["texto", "largo", "opciones"];
/** Las reglas que usa el núcleo (las 4 primeras hacen falta; ordenar y preguntaBorrar son opcionales). */
export const FUNCIONES = ["crear", "editar", "borrar", "mover", "ordenar", "preguntaBorrar"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function armarIndex(titulo = "Tablero") {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<h1>${esc(titulo)}</h1>
<div id="aviso" role="status" hidden></div>
<main id="tablero"></main>
<div id="formulario-modal" class="modal" hidden>
  <form id="formulario" class="caja">
    <strong id="formulario-nombre">Nueva tarjeta</strong>
    <div id="formulario-campos"></div>
    <div class="acciones-form"><button type="submit">Guardar</button> <button type="button" id="formulario-cancelar">Cancelar</button></div>
  </form>
</div>
<div id="confirmar-modal" class="modal" hidden>
  <div class="caja">
    <p id="confirmar-pregunta"></p>
    <div class="acciones-form"><button type="button" id="confirmar-si">Eliminar</button> <button type="button" id="confirmar-no">Cancelar</button></div>
  </div>
</div>
<script src="tablero.js"></script>
<script src="logica.js"></script>
<script src="nucleo.js"></script>
</body>
</html>
`;
}

/** tablero.json → { tablero, problemas }. Lo que está mal se dice (para Gemma) y se arregla lo mínimo para dibujar algo. */
export function leerTablero(texto) {
  const problemas = [], vacio = { columnas: [], agregar_en: null, campos: [] };
  let j;
  try { j = JSON.parse(String(texto ?? "").replace(/^\s*```\w*\s*|\s*```\s*$/g, "")); }
  catch (e) { return { tablero: vacio, problemas: [`tablero.json no es JSON válido (${e.message})`] }; }
  if (!j || typeof j !== "object" || Array.isArray(j)) return { tablero: vacio, problemas: ['tablero.json tiene que ser un objeto: { "columnas": [...], "agregar_en": "...", "campos": [...] }'] };
  const columnas = [];
  if (!Array.isArray(j.columnas)) problemas.push('tablero.json: "columnas" tiene que ser una lista de nombres, p. ej. ["A", "B"]');
  else for (const c of j.columnas) {
    if (typeof c !== "string" || !c.trim()) { problemas.push(`tablero.json: la columna ${JSON.stringify(c)} no es un nombre`); continue; }
    if (columnas.includes(c.trim())) { problemas.push(`tablero.json: la columna "${c.trim()}" está repetida`); continue; }
    if (columnas.length >= MAX_COLUMNAS) { problemas.push(`tablero.json: más de ${MAX_COLUMNAS} columnas; sobran desde "${c}"`); break; }
    columnas.push(c.trim());
  }
  let agregar_en = typeof j.agregar_en === "string" ? j.agregar_en.trim() : null;
  if (columnas.length && !columnas.includes(agregar_en)) {
    problemas.push(`tablero.json: "agregar_en" tiene que ser una de las columnas (${columnas.map((c) => `"${c}"`).join(", ")}); vino ${JSON.stringify(j.agregar_en ?? null)}, así que el botón de agregar va en "${columnas[0]}"`);
    agregar_en = columnas[0];
  }
  const campos = [];
  if (j.campos != null && !Array.isArray(j.campos)) problemas.push('tablero.json: "campos" tiene que ser una lista: [{ "nombre": "...", "tipo": "texto" | "largo" | "opciones", "opciones": [...] }]');
  else for (const c of j.campos || []) {
    const nombre = typeof c?.nombre === "string" ? c.nombre.trim() : "";
    if (!nombre) { problemas.push(`tablero.json: un campo sin "nombre": ${JSON.stringify(c)}`); continue; }
    if (/^(titulo|título|title)$/i.test(nombre)) { problemas.push(`tablero.json: el campo "${nombre}" sobra (el título lo pone el núcleo siempre)`); continue; }
    if (campos.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) { problemas.push(`tablero.json: el campo "${nombre}" está repetido`); continue; }
    if (campos.length >= MAX_CAMPOS) { problemas.push(`tablero.json: más de ${MAX_CAMPOS} campos; sobran desde "${nombre}"`); break; }
    const tipo = TIPOS.includes(c.tipo) ? c.tipo : "texto";
    if (c.tipo != null && !TIPOS.includes(c.tipo)) problemas.push(`tablero.json: el campo "${nombre}" tiene "tipo": ${JSON.stringify(c.tipo)}; vale ${TIPOS.map((x) => `"${x}"`).join(", ")} (quedó "texto")`);
    if (tipo === "opciones") {
      const op = Array.isArray(c.opciones) ? [...new Set(c.opciones.filter((o) => typeof o === "string" && o.trim()).map((o) => o.trim()))] : [];
      if (!op.length) { problemas.push(`tablero.json: el campo "${nombre}" es de "opciones" pero no tiene "opciones": [...] (quedó "texto")`); campos.push({ nombre, tipo: "texto" }); continue; }
      campos.push({ nombre, tipo, opciones: op });
    } else campos.push({ nombre, tipo });
  }
  return { tablero: { columnas, agregar_en: columnas.length ? agregar_en : null, campos }, problemas };
}

export const tableroJs = (tablero) => `// tablero.js — lo escribe el harness a partir de tablero.json: NO lo cambies (cambiá tablero.json).\nconst TABLERO = ${JSON.stringify(tablero, null, 2)};\n`;

export const EDITABLES = ["logica.js", "tablero.json", "styles.css"];
export const LOGICA_INICIAL = `// logica.js — las reglas del tablero. Funciones sueltas: el núcleo las encuentra por su nombre.\n`;
export const TABLERO_INICIAL = `{ "columnas": [], "agregar_en": null, "campos": [] }\n`;
export const ESTILOS_INICIAL = "/* styles.css — el estilo de la app (base.css, del harness, ya hace que se vea como un tablero) */\n";

export function armarApp({ titulo = "Tablero", logica = LOGICA_INICIAL, tablero = TABLERO_INICIAL, estilos = ESTILOS_INICIAL } = {}) {
  const t = leerTablero(tablero).tablero;
  return { "index.html": armarIndex(titulo), "base.css": BASE_CSS, "styles.css": estilos, "nucleo.js": NUCLEO_JS, "tablero.js": tableroJs(t), "tablero.json": tablero, "logica.js": logica };
}

export const vista = (app) => Object.fromEntries(EDITABLES.filter((f) => app[f] != null).map((f) => [f, app[f]]));

/** La app completa a partir de los editables, con el núcleo puesto de nuevo. → { app, problemas } (para Gemma). */
export function fijarKanban(editables, { titulo } = {}) {
  const tablero = editables["tablero.json"] ?? TABLERO_INICIAL, logica = editables["logica.js"] ?? LOGICA_INICIAL;
  const { problemas } = leerTablero(tablero);
  const hay = funcionesDeLogica(logica);
  const faltan = FUNCIONES.slice(0, 4).filter((f) => !hay.includes(f));
  if (faltan.length && faltan.length < 4) problemas.push(`logica.js no define ${faltan.join(", ")}: el núcleo las llama (${faltan.map((f) => ({ crear: "al guardar una tarjeta nueva", editar: "al guardar el formulario de ✏️", borrar: "al borrar con 🗑️", mover: "al arrastrar una tarjeta a otra columna" })[f]).join("; ")}) y sin ellas no pasa nada`);
  return { app: armarApp({ titulo, logica, tablero, estilos: editables["styles.css"] ?? ESTILOS_INICIAL }), problemas };
}
export const appInicial = (opts = {}) => fijarKanban({}, opts).app;

export const REGLA_KANBAN = `ESTA APP TIENE UN NÚCLEO que escribe el harness: index.html, base.css, nucleo.js y tablero.js. NO los ves y NO se cambian. El núcleo ya hace: dibujar las columnas (cada una con su título y su contador de tarjetas), las tarjetas (título, sus campos, los botones ✏️ Editar y 🗑️ Borrar, la manija ⠿), el botón "+ Agregar tarjeta" con su formulario (Título + los campos), editar con el mismo formulario, preguntar antes de borrar, arrastrar una tarjeta a otra columna, y guardar/cargar (localStorage).
Vos cambiás SOLO estos 3 archivos:
1. tablero.json — { "columnas": ["A", "B", …], "agregar_en": "A", "campos": [{ "nombre": "Prioridad", "tipo": "opciones", "opciones": ["alta", "baja"] }, { "nombre": "Notas", "tipo": "largo" }] } (tipo: "texto" | "largo" | "opciones"). El título de la tarjeta NO es un campo: lo pone el núcleo.
2. logica.js — las reglas, funciones sueltas (function nombre(...) { ... }), sin document ni nada de la página:
   - crear(estado, tarjeta): tarjeta = { id, titulo, columna, creada, campos: { "Prioridad": "alta", … } } ya armada; agregala a estado.tarjetas.
   - editar(estado, id, datos): datos = { titulo, campos } (lo que quedó en el formulario).
   - borrar(estado, id) · mover(estado, id, columna).
   - ordenar(tarjetas, columna) (opcional): devolvé las tarjetas de esa columna en el orden en que se ven. "creada" es un número que crece: más grande = más nueva.
   - preguntaBorrar(tarjeta) (opcional): el texto que se pregunta antes de borrar; sin esta función se borra sin preguntar.
   Cada regla cambia estado (o devuelve uno nuevo). Si una regla NO deja hacer algo, devolvé un texto (el aviso que se muestra) y no cambies nada.
3. styles.css — el estilo. Lo que hay: body, h1, #tablero, .columna (con .cabecera > h2 y .contador, .lista con las tarjetas, y button.agregar), .tarjeta (.manija, h3, .campo, .botones con button.editar y button.borrar), .modal .caja (los formularios), #aviso.
EL ESTADO (forma fija): { tarjetas: [{ id: "t1", titulo: "…", columna: "A", creada: 1, campos: { … } }], siguiente: 2 }.
CÓMO MANDAR LOS CAMBIOS: tablero.json con ### ARCHIVO: tablero.json (entero). logica.js con ### FUNCION: nombre (una función nueva: ### FUNCION: nombre en logica.js). styles.css DE A UNA REGLA: ### CSS: .columna y adentro solo esa regla (.columna { … }); si ya existe se reemplaza entera (poné todas sus propiedades) y si no, se agrega. NO mandes styles.css entero: se perdería lo que ya anda.`;
