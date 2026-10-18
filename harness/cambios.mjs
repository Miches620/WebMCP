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
//   ### ARCHIVO: index.html
//   ```html
//   ...todo el archivo...
//   ```
// Universal: no sabe de ninguna app.

import { findMember, replaceMember, syntaxOf } from "./js_tools.mjs";

export const CAMBIOS_VERSION = "cambios v0.1";

/** Los bloques de la respuesta: [{ tipo: "funcion" | "archivo", nombre, en?, codigo }]. */
export function leerBloques(raw) {
  const out = [];
  const re = /###\s*(FUNCI[OÓ]N|FUNCTION|ARCHIVO|FILE)\s*:\s*([^\s`]+)(?:\s+en\s+([^\s`]+))?[^\n]*\n+```[\w-]*\n([\s\S]*?)```/gi;
  let m;
  while ((m = re.exec(String(raw || "")))) out.push({ tipo: /^arch|^file/i.test(m[1]) ? "archivo" : "funcion", nombre: m[2].replace(/\(\)$/, ""), en: m[3] || null, codigo: m[4] });
  return out;
}

/** Aplica los bloques a una copia de la app. Devuelve { app, aplicados[], problemas[] }. Función pura. */
export function aplicar(app0, raw) {
  const app = { ...app0 };
  const aplicados = [], problemas = [];
  const bloques = leerBloques(raw);
  if (!bloques.length) return { app, aplicados, problemas: ["la respuesta no trae ningún bloque ### FUNCION: o ### ARCHIVO:"] };
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
