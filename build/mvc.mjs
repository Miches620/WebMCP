// mvc.mjs — estructura MVC liviana para script.js (rama mvc-borrador, 11/11, decisión de Miche: "arranquemos así
// primero, luego vemos la versión pesada").
//
// Por qué: en la hoja de cálculo R4.1 nunca pasó. La fórmula se guardaba EN la celda de la pantalla y al mostrar el
// resultado se perdía: no había de dónde recalcular. Es un problema de diseño, no de un arreglo. Con DATOS → LÓGICA →
// DIBUJO → CONTROLES, la fórmula vive en `estado`, render() muestra el resultado y se puede volver a calcular.
//
// Liviana = los mismos 3 archivos (index.html, styles.css, script.js) y el mismo juez; solo cambia CÓMO se organiza
// script.js. La versión pesada (7 archivos y contrato.json) es el Standard web/app/estado; se prueba después.
//
//   ESQUELETO_MVC  lo que recibe Gemma en el borrador de script.js (completa las secciones)
//   REGLA_MVC      una línea para los pedidos de arreglo (dónde va cada cosa)
//   problemasMvc   qué le falta a un script.js para seguir la estructura (para reintentar el borrador)
//   ponerArranque  el arranque lo escribe el código, siempre al final (si un arreglo lo rompe, se repone)

export const MVC_VERSION = "mvc v0.3";
// v0.3 (13/11, réplicas v0.2: 5, 3, 3): las 3 apps escuchaban 'blur' (y 'change') en el <tbody> para "guardar al
// terminar". blur no burbujea y change no existe en contenteditable: la app NUNCA guardaba (estado.B4 = "" después de
// escribir =SUMA(A1:A3); con focusout sí). El juez decía "B4 muestra la fórmula" y Gemma agregaba cálculo a un dato que
// nunca llegaba. La regla ahora nombra el evento (focusout / Enter) y el borrador rechaza blur/focus.
// v0.2 (13/11, réplicas MVC: 8, 8, 3 contra 4, 11, 5 sin MVC; R4.1 FAIL en las 6): la fórmula se destruía MIENTRAS se
// escribía. Las apps guardaban y redibujaban con cada tecla (evento input): render() reescribía la celda que se estaba
// editando, el cursor saltaba al principio y "=B1+C1" quedaba "1C+1Bundefined" (probado en Chromium con la app final de
// rep_mvc_s1). Con 3 cambios a mano (guardar al salir, no redibujar lo que se edita, mostrar la fórmula al entrar) R4.1
// pasó: la fórmula queda en `estado` y se recalcula. La regla nueva: no redibujar lo que el usuario está editando.

export const MARCA_ARRANQUE = "// ===== ARRANQUE";
export const ARRANQUE = `${MARCA_ARRANQUE} (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
`;

export const ESQUELETO_MVC = `// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = { /* completá: los datos de la app (textos, números, listas, objetos). Nada de elementos de la página. */ };
const CLAVE = "app";
function cargar() { try { const s = localStorage.getItem(CLAVE); if (s) estado = JSON.parse(s); } catch (e) {} }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {} }

// ===== LÓGICA: funciones que cambian \`estado\` (o calculan con él). NO tocan la página: sin document. =====
// completá

// ===== DIBUJO: render() arma la pantalla entera desde \`estado\`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
  // completá
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
  // completá (si render() vuelve a crear elementos, escuchá en un contenedor que no cambia y mirá event.target).
  // Lo que el usuario escribe se guarda cuando TERMINA de editar (focusout en el contenedor (blur y focus NO burbujean: escuchados en un contenedor no llegan nunca) o la tecla Enter (keydown); en celdas contenteditable no existe change), no con cada tecla (input).
}
`;

/** Lo que se suma al pedido de sistema del borrador de script.js. */
export const SYS_MVC = `script.js sigue un esqueleto fijo (te lo paso en el pedido). Completá cada sección y respetá sus nombres: estado, cargar(), guardar(), render(), conectar().
- DATOS: todo lo que la app necesita recordar va en \`estado\` (por ejemplo, lo que escribió el usuario tal cual, no solo lo que se muestra).
- LÓGICA: funciones que cambian \`estado\` o calculan con él; no usan document.
- DIBUJO: render() pone en la pantalla lo que dice \`estado\` (y lo que se calcula de él).
- CONTROLES: conectar() engancha los eventos; cada evento llama a la lógica, después guardar() y render().
- EDITAR: no redibujes el elemento que el usuario está editando (render() se saltea document.activeElement). Lo que escribe se guarda cuando TERMINA de editar (focusout en el contenedor (blur y focus NO burbujean: escuchados en un contenedor no llegan nunca) o la tecla Enter (keydown); en celdas contenteditable no existe change), no con cada tecla (input). Si lo que se muestra no es lo que se escribió (un resultado, un formato), al entrar a editar mostrá lo que está guardado en \`estado\`.
NO escribas el arranque (ni DOMContentLoaded, ni window.onload, ni llamadas a conectar()/render() sueltas al final): lo agrega el harness.`;

/** Una línea para los pedidos de arreglo (ver y arreglo). */
export const REGLA_MVC = `La app sigue esta estructura en script.js: DATOS (el objeto \`estado\`, cargar(), guardar()) → LÓGICA (funciones que cambian \`estado\`, sin tocar la página) → DIBUJO (render() arma la pantalla desde \`estado\`) → CONTROLES (conectar(): cada evento llama a la lógica, después guardar() y render()). Un dato nuevo va en \`estado\`; lo que se ve sale de render(); la página no guarda datos. No redibujes lo que el usuario está editando: guardá cuando termina (focusout en el contenedor (blur y focus NO burbujean: escuchados en un contenedor no llegan nunca) o la tecla Enter (keydown); en celdas contenteditable no existe change), no con cada tecla (input). El ARRANQUE del final lo pone el harness: no lo toques.`;

const sinArranque = (js) => { const s = String(js || ""); const i = s.indexOf(MARCA_ARRANQUE); return i >= 0 ? s.slice(0, i) : s; };
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").split(/\r?\n/).map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");

/** Qué le falta a script.js para seguir la estructura. [] = la sigue. */
export function problemasMvc(js) {
  const s = sinComentarios(sinArranque(js)), out = [];
  if (!/\b(let|var|const)\s+estado\s*=/.test(s)) out.push("falta `let estado = {…}` (DATOS)");
  for (const f of ["cargar", "guardar", "render", "conectar"]) if (!new RegExp(`function\\s+${f}\\s*\\(`).test(s)) out.push(`falta function ${f}()`);
  if (/addEventListener\(\s*['"]DOMContentLoaded|window\.onload\s*=/.test(s)) out.push("escribiste el arranque (DOMContentLoaded / window.onload): sacalo, lo pone el harness");
  // llamadas sueltas a conectar()/arrancar() (fuera de su definición): conectar dos veces duplica cada evento
  if (/(^|[^\w.])(conectar|arrancar)\s*\(\s*\)\s*;?/m.test(s.replace(/function\s+(conectar|arrancar)\s*\(/g, ""))) out.push("no llames a conectar(): la llama una sola vez el arranque del harness");
  // v0.2: guardar y redibujar con cada tecla destruye lo que se está escribiendo (R4.1 en las 6 réplicas)
  if (/addEventListener\(\s*['"]input['"]/.test(s) && /\brender\s*\(\s*\)/.test(s.replace(/function\s+render\s*\(/, ""))) out.push("conectar() escucha 'input' (cada tecla) y la app redibuja: eso pisa lo que el usuario está escribiendo. Guardá al terminar de editar (focusout en el contenedor o Enter) y que render() no toque document.activeElement");
  // v0.3: blur/focus no burbujean (en un contenedor no llegan nunca) y change no existe en contenteditable: no guardaba nada
  const ev = [...new Set([...s.matchAll(/addEventListener\(\s*['"](blur|focus|change)['"]/g)].map((m) => m[1]))];
  if (ev.some((e) => e !== "change")) out.push(`escuchás ${ev.map((e) => `'${e}'`).join(" y ")}: blur y focus no burbujean (escuchados en un contenedor no llegan nunca) y en celdas contenteditable no existe change. Para guardar al terminar de editar usá 'focusout' (y keydown de Enter)`);
  // LÓGICA sin página (solo si las marcas siguen ahí)
  const raw = sinArranque(js), i = raw.indexOf("===== LÓGICA"), j = raw.indexOf("===== DIBUJO");
  if (i >= 0 && j > i && /\bdocument\./.test(sinComentarios(raw.slice(raw.indexOf("\n", i), raw.lastIndexOf("\n", j))))) out.push("la sección LÓGICA usa document: lo de la página va en render() o en conectar()");
  return out;
}

/** script.js con el arranque del harness al final (saca el que hubiera y lo vuelve a poner). Si no hay script, no inventa. */
export function ponerArranque(js) {
  const s = String(js || "");
  if (!s.trim()) return s;
  return `${sinArranque(s).trimEnd()}\n\n${ARRANQUE}`;
}

/** Para un pedido: el esqueleto como punto de partida. */
export const pedidoEsqueleto = () => `Completá este esqueleto de script.js (mismas secciones, mismos nombres; el arranque lo agrega el harness):\n\`\`\`js\n${ESQUELETO_MVC}\`\`\``;

/** En el ciclo: repone el arranque solo si script.js tiene la estructura (cargar, conectar y render); si no, no lo toca
 *  (una app vieja retomada con --mvc no tiene esas funciones y el arranque la rompería). */
export function fijarArranque(app) {
  const js = app?.["script.js"];
  if (!js || !["cargar", "conectar", "render"].every((f) => new RegExp(`function\\s+${f}\\s*\\(`).test(js))) return app;
  const nuevo = ponerArranque(js);
  return nuevo === js ? app : { ...app, "script.js": nuevo };
}
