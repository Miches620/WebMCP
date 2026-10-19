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

export const CAMBIOS_VERSION = "cambios v0.2";
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
  const i = lines.findIndex((l) => /^\S/.test(l) && norm(l).startsWith(want));
  if (i < 0) return null;
  const end = /\{/.test(lines[i]) ? blockEndLines(lines, i) : i;
  if (end < 0) return null;
  // incluye el cierre ")" / ");" de la llamada si quedó en la línea siguiente
  let e = end;
  if (lines[e + 1] && /^\s*\)?\s*;?\s*$/.test(lines[e + 1]) && lines[e + 1].trim()) e++;
  return { start: i + 1, end: e + 1, text: lines.slice(i, e + 1).join("\n") };
}

/** Los bloques de la respuesta: [{ tipo: "funcion" | "archivo", nombre, en?, codigo }]. */
export function leerBloques(raw) {
  const out = [];
  const re = /###\s*(FUNCI[OÓ]N|FUNCTION|BLOQUE|BLOCK|ARCHIVO|FILE)\s*:\s*(([^\s`]+)(?:\s+en\s+([^\s`]+))?[^\n]*)\n+```[\w-]*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(String(raw || "")))) out.push({ tipo: /^arch|^file/i.test(m[1]) ? "archivo" : /^bloq/i.test(m[1]) ? "bloque" : "funcion", nombre: m[3].replace(/\(.*$/, "").replace(/\(\)$/, ""), primera: m[2].trim(), en: m[4] || null, codigo: m[5] });
  return out;
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
  const aplicados = [], problemas = [];
  const jsFiles = Object.keys(app).filter((f) => f.endsWith(".js"));
  for (const b of bloques) {
    if (b.tipo === "archivo") {
      const f = Object.keys(app).find((k) => k === b.nombre || k.endsWith("/" + b.nombre));
      if (!f) { problemas.push(`${b.nombre}: no es un archivo de la app (${Object.keys(app).join(", ")}); los archivos nuevos no se agregan`); continue; }
      if (f.endsWith(".js")) { const e = syntaxOf(b.codigo); if (e) { problemas.push(`${f}: no compila (${e})`); continue; } }
      if (b.codigo.trim().length < app[f].trim().length * 0.5) { problemas.push(`${f}: el archivo nuevo tiene menos de la mitad que el actual; si querías cambiar una parte, devolvé el archivo ENTERO`); continue; }
      app[f] = b.codigo;
      aplicados.push(`archivo ${f}`);
      continue;
    }
    // bloque suelto (o una "función" cuyo nombre no es un nombre): se busca por su primera línea
    if (b.tipo === "bloque" || !isIdent(b.nombre)) {
      const hit = jsFiles.map((f) => [f, findSuelto(app[f], b.primera)]).find(([, x]) => x);
      if (!hit) { problemas.push(`no encontré el bloque que empieza con "${b.primera.slice(0, 60)}" (para código suelto, la primera línea tiene que estar tal cual; para una función, ### FUNCION: nombre)`); continue; }
      const [f, x] = hit, lines = app[f].split("\n");
      const next = [...lines.slice(0, x.start - 1), b.codigo.replace(/\s+$/, ""), ...lines.slice(x.end)].join("\n");
      const e = syntaxOf(next);
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
      const next = `${app[f].replace(/\s+$/, "")}\n\n${b.codigo.replace(/\s+$/, "")}\n`;
      const e = syntaxOf(next);
      if (e) { problemas.push(`${b.nombre} (nueva): no compila (${e})`); continue; }
      app[f] = next;
      aplicados.push(`función nueva ${b.nombre} (${f})`);
    }
  }
  return { app, aplicados, problemas };
}
