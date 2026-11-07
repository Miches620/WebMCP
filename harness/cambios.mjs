// cambios.mjs — aplicar lo que devuelve el Specialist en el ciclo: funciones enteras o archivos chicos (18/10).
//
// Como trabaja Claude: no reescribe la app para arreglar una línea. Cambia la función que tiene que cambiar (o el
// archivo chico entero, como un index.html de 1.000 tokens) y lo demás queda igual. Si algo no compila, no se aplica.
//
// Formato de la respuesta (lo dice el pedido):
//   ### FUNCION: nombre            (opcional: "en archivo.js" para una función nueva)
//   ```js
//   function nombre(...) { ... }
//   ```
//   ### BLOQUE: document.getElementById('form').addEventListener('submit', …   (código suelto, fuera de funciones:
//   ```js                                                                    la primera línea tal cual está)
//   ...el bloque entero...
//   ```
//   ### ARCHIVO: index.html
//   ```html
//   ...todo el archivo...
//   ```
// Universal: no sabe de ninguna app.

import { findMember, replaceMember, syntaxOf, blockEndLines } from "./js_tools.mjs";

export const CAMBIOS_VERSION = "cambios v0.7";
// v0.2 (19/10, 1ª corrida real): Gemma mandó "### FUNCION: document.getElementById('card-form').addEventListener('submit', …"
// para cambiar código suelto (fuera de funciones), y el nombre rompía la búsqueda. Ahora un nombre que no es un nombre
// de función se busca como BLOQUE suelto por su primera línea.
const isIdent = (x) => /^[A-Za-z_$][\w$]*$/.test(x);
const norm = (t) => String(t).replace(/\s+/g, "");
/** Un bloque suelto: la línea del nivel superior que empieza como "primera" (sin espacios), hasta que cierra. */
export function findSuelto(js, primera) {
  const lines = String(js || "").split("\n");
  const want = norm(primera).replace(/[{(,]+$/, "");
  if (want.length < 8) return null;
  // el nivel de arriba del archivo es la sangría más chica (no siempre la columna 0: un archivo que salió de index.html)
  const base = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length), 99);
  let i = lines.findIndex((l) => l.trim() && l.match(/^[ \t]*/)[0].length === base && norm(l).startsWith(want));
  // 04/11 (hoja): todo script.js estaba adentro de DOMContentLoaded; "### BLOQUE: document.getElementById('btn-delete-column')…"
  // no se encontraba porque esa línea tiene sangría. Si no está arriba de todo, vale una línea ÚNICA a cualquier sangría.
  if (i < 0) { const hits = lines.map((l, k) => (l.trim() && norm(l).startsWith(want) ? k : -1)).filter((k) => k >= 0); if (hits.length === 1) i = hits[0]; }
  if (i < 0) return null;
  const end = /\{/.test(lines[i]) ? blockEndLines(lines, i) : i;
  if (end < 0) return null;
  // incluye el cierre ")" / ");" de la llamada si quedó en la línea siguiente
  let e = end;
  if (lines[e + 1] && /^\s*\)?\s*;?\s*$/.test(lines[e + 1]) && lines[e + 1].trim()) e++;
  return { start: i + 1, end: e + 1, text: lines.slice(i, e + 1).join("\n") };
}

/** En CSS: la regla que empieza con esa línea; si la línea es un comentario, el comentario y la regla que sigue. */
export function findSueltoCss(css, primera) {
  const x = findSuelto(css, primera);
  if (!x || x.end > x.start || !/^\s*\/\*.*\*\/\s*$/.test(x.text)) return x;
  const lines = String(css).split("\n");
  let j = x.start; while (j < lines.length && !lines[j].trim()) j++;
  if (j >= lines.length || !/\{/.test(lines[j])) return x;
  const end = blockEndLines(lines, j);
  return end < 0 ? x : { start: x.start, end: end + 1, text: lines.slice(x.start - 1, end + 1).join("\n") };
}
const cssRoto = (css) => { const t = String(css).replace(/\/\*[\s\S]*?\*\//g, ""); let d = 0; for (const ch of t) { if (ch === "{") d++; else if (ch === "}" && --d < 0) return "una llave } de más"; } return d ? "falta cerrar una llave }" : null; };

/** 04/11: si el archivo es UN bloque que envuelve casi todo (DOMContentLoaded, una IIFE…): { start, end, primera }; si no, null. */
export function envoltorio(js) {
  const lines = String(js || "").split("\n"), total = lines.filter((l) => l.trim()).length;
  const k = lines.findIndex((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l));
  if (k < 0 || !/\{\s*$/.test(lines[k])) return null;
  const x = findSuelto(js, lines[k].trim());
  if (!x || x.start !== k + 1) return null;
  const dentro = lines.slice(x.start - 1, x.end).filter((l) => l.trim()).length;
  return dentro >= total * 0.8 && x.end - x.start > 10 ? { ...x, primera: lines[k].trim() } : null;
}
/** 06/11 (hoja de a poco): en HTML, el elemento que empieza en esa línea (línea ÚNICA), hasta su etiqueta de cierre.
 *  Antes un "### BLOQUE: <button id=…>" o "<div class=…>" nunca se encontraba: el HTML solo se podía cambiar ENTERO, y con
 *  la grilla escrita a mano (20 filas, ~5.000 tokens) reescribirlo cortaba la respuesta o dejaba a script.js afuera. */
export function findSueltoHtml(html, primera) {
  const lines = String(html || "").split("\n");
  const want = norm(primera);
  if (want.length < 6 || !want.startsWith("<")) return null;
  const hits = lines.map((l, k) => (norm(l).startsWith(want) ? k : -1)).filter((k) => k >= 0);
  if (hits.length !== 1) return null;
  const i = hits[0], tag = (lines[i].trim().match(/^<([a-zA-Z][\w-]*)/) || [])[1];
  if (!tag) return null;
  if (/^(input|img|br|hr|meta|link|source|col|wbr|area|base|track|embed|param)$/i.test(tag) || /\/>\s*$/.test(lines[i])) return { start: i + 1, end: i + 1, text: lines[i] };
  const ab = new RegExp(`<${tag}(\\s|>)`, "gi"), ci = new RegExp(`</${tag}\\s*>`, "gi");
  let d = 0;
  for (let k = i; k < lines.length; k++) {
    d += (lines[k].match(ab) || []).length - (lines[k].match(ci) || []).length;
    if (d <= 0) return { start: i + 1, end: k + 1, text: lines.slice(i, k + 1).join("\n") };
  }
  return null;
}
/** 06/11: si un BLOQUE no se encuentra, las líneas que más se le parecen (comparten un id, una clase o un texto) */
export function parecidas(app, primera, max = 3) {
  const palabras = (String(primera).match(/[\w-]{4,}/g) || []).filter((w) => !/^(class|button|function|document|const|return|style|span|div)$/i.test(w));
  if (!palabras.length) return [];
  const out = [];
  for (const [f, src] of Object.entries(app)) String(src).split("\n").forEach((l, k) => { const n = palabras.filter((w) => l.includes(w)).length; if (n && l.trim()) out.push({ n, t: `${f}:${k + 1}: ${l.trim().slice(0, 120)}` }); });
  return out.sort((a, b) => b.n - a.n).slice(0, max).map((x) => x.t);
}
/** 06/11: para MOSTRAR un HTML grande: lo que se repite (20 filas iguales que solo cambian el número) se abrevia.
 *  Deja la primera y la última repetición y en el medio una línea con RESUMIDO. Si no hay repeticiones, devuelve el mismo. */
export const MARCA_RESUMIDO = "RESUMIDO por el harness";
export function resumirRepetido(html, minVeces = 3) {
  const L = String(html || "").split("\n"), N = L.map((l) => l.replace(/\d+/g, "#").trim());
  const out = [];
  for (let i = 0; i < L.length; ) {
    let mejor = null;
    for (let k = 1; k <= 40 && i + k * minVeces <= L.length; k++) {
      let veces = 1;
      while (i + (veces + 1) * k <= L.length && N.slice(i, i + k).every((x, j) => x === N[i + veces * k + j])) veces++;
      if (veces >= minVeces && (!mejor || veces * k > mejor.veces * mejor.k)) mejor = { k, veces };
    }
    if (mejor && mejor.k * mejor.veces >= 6) {
      const { k, veces } = mejor, ind = L[i].match(/^\s*/)[0];
      out.push(...L.slice(i, i + k), `${ind}<!-- ${MARCA_RESUMIDO}: acá van ${veces - 2} repeticiones más, iguales a la de arriba y la de abajo (solo cambian los números) -->`, ...L.slice(i + (veces - 1) * k, i + veces * k));
      i += veces * k;
    } else { out.push(L[i]); i++; }
  }
  return out.join("\n");
}
const ARCHIVO_RE = /^[\w./-]+\.(html|css|js)$/i;
/** Los bloques de la respuesta: [{ tipo: "funcion" | "archivo", nombre, en?, codigo }]. */
export function leerBloques(raw) {
  const out = [];
  const re = /###\s*(FUNCI[OÓ]N|FUNCTION|BLOQUE|BLOCK|ARCHIVO|FILE)\s*:\s*(([^\s`]+)(?:\s+en\s+([^\s`]+))?[^\n]*)\n+```[\w-]*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(String(raw || "")))) {
    const b = { at: m.index, tipo: /^arch|^file/i.test(m[1]) ? "archivo" : /^bloq/i.test(m[1]) ? "bloque" : "funcion", nombre: m[3].replace(/\(.*$/, "").replace(/\(\)$/, ""), primera: m[2].trim(), en: m[4] || null, codigo: m[5] };
    // 02/11 (hoja, vuelta 1): "### BLOQUE: styles.css" con el archivo entero adentro → es un ARCHIVO, no código suelto
    if (b.tipo !== "archivo" && ARCHIVO_RE.test(b.primera)) Object.assign(b, { tipo: "archivo", nombre: b.primera, en: null });
    out.push(b);
  }
  // 02/11 (hoja, vueltas 10 y 26): "### index.html" a secas, sin "ARCHIVO:" → también es el archivo entero
  const solo = /###\s*([\w./-]+\.(?:html|css|js))\s*\n+```[\w-]*\n([\s\S]*?)```/gi;
  while ((m = solo.exec(String(raw || "")))) out.push({ at: m.index, tipo: "archivo", nombre: m[1], primera: m[1], en: null, codigo: m[2] });
  return out.sort((x, y) => x.at - y.at).map(({ at, ...b }) => b);
}

/** Aplica los bloques a una copia de la app. Devuelve { app, aplicados[], problemas[] }. Función pura. */
export function aplicar(app0, raw) {
  const bloques = leerBloques(raw);
  if (!bloques.length) return { app: { ...app0 }, aplicados: [], problemas: ["la respuesta no trae ningún bloque ### FUNCION: o ### ARCHIVO:"], bloques };
  return { ...aplicarBloques(app0, bloques), bloques };
}

/** Lo mismo, con los bloques ya leídos (el ciclo prueba también cada bloque por separado). */
export function aplicarBloques(app0, bloques) {
  const app = { ...app0 };
  const aplicados = [], problemas = [], nuevas = [];
  const jsFiles = Object.keys(app).filter((f) => f.endsWith(".js"));
  for (const b of bloques) {
    if (b.tipo === "archivo") {
      const f = Object.keys(app).find((k) => k === b.nombre || k.endsWith("/" + b.nombre));
      if (!f) { problemas.push(`${b.nombre}: no es un archivo de la app (${Object.keys(app).join(", ")}); los archivos nuevos no se agregan`); continue; }
      if (f.endsWith(".js")) { const e = syntaxOf(b.codigo); if (e) { problemas.push(`${f}: no compila (${e})`); continue; } }
      if (b.codigo.includes(MARCA_RESUMIDO)) { problemas.push(`${f}: lo devolviste con la parte RESUMIDA (la que dice "${MARCA_RESUMIDO}"): eso borraría lo abreviado. Para cambiar una parte de ${f}, mandá ### BLOQUE: <la primera línea del elemento, tal cual> con el elemento entero (por ejemplo un <div> o un <button>)`); continue; }
      if (b.codigo.trim().length < app[f].trim().length * 0.5) { problemas.push(`${f}: el archivo nuevo tiene menos de la mitad que el actual; si querías cambiar una parte, devolvé el archivo ENTERO`); continue; }
      app[f] = b.codigo;
      aplicados.push(`archivo ${f}`);
      continue;
    }
    // bloque suelto (o una "función" cuyo nombre no es un nombre): se busca por su primera línea
    if (b.tipo === "bloque" || !isIdent(b.nombre)) {
      // 22/10: también en los .css (antes solo .js: un "### BLOQUE:" de CSS nunca se encontraba)
      const cssFiles = Object.keys(app).filter((f) => f.endsWith(".css"));
      const esCss = /^\s*(\/\*|[.#@:a-z*\[][^({;]*\{)/i.test(b.codigo) && !/\b(function|const|let|var|=>)\b/.test(b.codigo);
      const htmlFiles = Object.keys(app).filter((f) => f.endsWith(".html"));
      const esHtml = /^\s*</.test(b.primera);
      const orden = esHtml ? htmlFiles : esCss ? [...cssFiles, ...jsFiles] : [...jsFiles, ...cssFiles];
      const hit = orden.map((f) => [f, f.endsWith(".html") ? findSueltoHtml(app[f], b.primera) : f.endsWith(".css") ? findSueltoCss(app[f], b.primera) : findSuelto(app[f], b.primera)]).find(([, x]) => x);
      // 07/11 (hoja de a poco, 2ª corrida): un cambio aceptado dejó DOS <button id="hideColButton"…> y dos <div class="controls-group">;
      // desde ahí "no encontré el bloque" en cada intento, sin decir por qué. Si la línea está repetida, se dice dónde.
      const rep = Object.entries(app).flatMap(([f, src]) => String(src).split("\n").map((l, k) => (l.trim() && norm(l).startsWith(norm(b.primera)) && norm(b.primera).length >= 6 ? `${f}:${k + 1}` : null)).filter(Boolean));
      if (!hit && rep.length > 1) { problemas.push(`la línea "${b.primera.slice(0, 60)}" aparece ${rep.length} veces (${rep.join(", ")}): así no sé cuál cambiar. Usá la primera línea del elemento que las contiene (si también se repite, uno más afuera, p. ej. el que tiene un id), y devolvelo entero sin las repetidas`); continue; }
      if (!hit) { const pr = parecidas(app, b.primera); problemas.push(`no encontré el bloque que empieza con "${b.primera.slice(0, 60)}" (para código suelto, la primera línea tiene que estar tal cual y aparecer UNA vez; para una función, ### FUNCION: nombre)${pr.length ? `. Lo que más se le parece: ${pr.join(" | ")}` : ""}`); continue; }
      const [f, x] = hit, lines = app[f].split("\n");
      // 04/11 (hoja, retomando desde persona #3): todo script.js estaba adentro de document.addEventListener('DOMContentLoaded', …).
      // 27 de 40 respuestas traían "### BLOQUE: document.addEventListener('DOMContentLoaded'…" con un PEDAZO adentro, y eso
      // reemplazaba la app entera (se perdían las filas 2–20, el guardado…). Si el bloque es casi todo el archivo y lo que
      // llega es mucho más corto, no se aplica, y se dice qué mandar.
      const largo = x.end - x.start + 1, nuevas = b.codigo.trim().split("\n").length;
      if (largo > lines.length * 0.5 && nuevas < largo * 0.5) { problemas.push(`el bloque que empieza con "${b.primera.slice(0, 60)}" es casi todo ${f} (líneas ${x.start}–${x.end}, ${largo} líneas) y mandaste ${nuevas}: se perdería el resto de la app. ${f.endsWith(".html") ? "Mandá solo el elemento que cambia, con ### BLOQUE: <su primera línea>" : "Mandá solo las funciones que cambian, cada una con ### FUNCION: nombre (aunque estén adentro de ese bloque)"}`); continue; }
      const next = [...lines.slice(0, x.start - 1), b.codigo.replace(/\s+$/, ""), ...lines.slice(x.end)].join("\n");
      const e = f.endsWith(".html") ? null : f.endsWith(".css") ? cssRoto(next) : syntaxOf(next);
      if (e) { problemas.push(`bloque "${b.primera.slice(0, 40)}": no compila (${e})`); continue; }
      app[f] = next;
      aplicados.push(`bloque suelto ${f}:${x.start}`);
      continue;
    }
    // función: donde esté; si no existe, se agrega al archivo que dice "en" (o al primer .js)
    const where = jsFiles.find((f) => findMember(app[f], b.nombre));
    if (where) {
      const r = replaceMember(app[where], findMember(app[where], b.nombre), b.codigo);
      if (!r.ok) { problemas.push(`${b.nombre}: ${r.why}`); continue; }
      app[where] = r.js;
      aplicados.push(`función ${b.nombre} (${where})`);
    } else {
      const f = (b.en && jsFiles.find((k) => k === b.en || k.endsWith("/" + b.en))) || jsFiles[0];
      if (!f) { problemas.push(`${b.nombre}: la app no tiene un archivo .js`); continue; }
      // 04/11 (hoja): con todo adentro de document.addEventListener('DOMContentLoaded', () => { … }), una función nueva pegada
      // al final quedaba AFUERA y no veía las variables de adentro (sheetState…). Si el archivo es un envoltorio así, va adentro.
      const env = envoltorio(app[f]);
      const next = env ? (() => { const ls = app[f].split("\n"); return [...ls.slice(0, env.end - 1), "", b.codigo.replace(/\s+$/, "").split("\n").map((l) => (l ? `    ${l}` : l)).join("\n"), ...ls.slice(env.end - 1)].join("\n"); })() : `${app[f].replace(/\s+$/, "")}\n\n${b.codigo.replace(/\s+$/, "")}\n`;
      const e = syntaxOf(next);
      if (e) { problemas.push(`${b.nombre} (nueva): no compila (${e})`); continue; }
      app[f] = next;
      aplicados.push(`función nueva ${b.nombre} (${f}${env ? `, adentro de "${env.primera.slice(0, 50)}"` : ""})`);
      nuevas.push(b.nombre);
    }
  }
  // 02/11 (hoja, vuelta 6): Gemma escribió populateRowLabels() y nadie la llamaba: los números nunca aparecían y el aviso
  // solo decía "faltan encabezados". Una función nueva que nadie nombra no corre: se avisa con el nombre.
  const avisos = [];
  for (const n of nuevas) {
    const usos = Object.values(app).reduce((a, src) => a + (String(src).match(new RegExp(`(^|[^\\w$.])${n.replace(/\$/g, "\\$")}\\b`, "g")) || []).length, 0);
    if (usos <= 1) avisos.push(`escribiste la función nueva ${n}() pero nadie la llama (ni al arrancar ni en un evento): así no corre nunca. Llamala desde donde corresponda (por ejemplo, donde arranca la app)`);
  }
  return { app, aplicados, problemas, avisos };
}
