// mapa.mjs — el MAPA de una app, sin modelo (18/10, propuesta del ciclo: claude/propuesta_ciclo_2026-10-17.md).
//
// Por qué: Claude no trabaja con la app entera en la cabeza. Tiene un mapa (qué funciones hay, dónde están y quién
// las llama), busca, y abre solo lo que necesita. Con 12k de contexto, Gemma tiene que poder hacer lo mismo.
// Medido sobre la app de Gemma sola (Kanban, 5.890 tokens): el mapa ocupa ~400. Y muestra el bug que tenía:
// "openModal(cardId, currentStatus) · lo llama index.html:30" (el botón le pasaba un solo dato).
//
// Universal: archivos de texto de una carpeta (HTML, CSS, JS). No sabe de ninguna app.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findMember } from "./js_tools.mjs";
import { estTokens } from "../build/tokens.mjs";

export const MAPA_VERSION = "mapa v0.1";
const TEXT = /\.(html|js|css)$/i;

/** Los archivos de la app: { nombre: contenido }. */
export function leerApp(dir) {
  return Object.fromEntries(readdirSync(dir).filter((f) => TEXT.test(f)).sort().map((f) => [f, readFileSync(join(dir, f), "utf8")]));
}

/** Funciones de nivel superior de un JS: function f(…) / const f = (…) => / const f = function. */
export function funcionesDe(js) {
  const out = [];
  String(js).split("\n").forEach((l, i) => {
    const m = l.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/) || l.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*)?\(([^)]*)\)/);
    if (m) out.push({ name: m[1], args: m[2].trim(), line: i + 1 });
  });
  return out;
}

/** Dónde se llama a name (archivo:línea), sin contar su propia declaración. */
export function llamadas(app, name) {
  const call = new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`), decl = new RegExp(`function\\s+${name}\\b|(const|let|var)\\s+${name}\\s*=`);
  const out = [];
  for (const [f, s] of Object.entries(app)) s.split("\n").forEach((l, i) => { if (call.test(l) && !decl.test(l)) out.push({ file: f, line: i + 1, text: l.trim().slice(0, 160) }); });
  return out;
}

/** La función que contiene esa línea de ese archivo (para "error de JS … (script.js:133)"). */
export function funcionEnLinea(app, file, line) {
  const js = app[file];
  if (!js) return null;
  const fs = funcionesDe(js).filter((f) => f.line <= line).sort((a, b) => b.line - a.line);
  for (const f of fs) { const m = findMember(js, f.name); if (m && m.start <= line && line <= m.end) return { ...m, file }; }
  return null;
}

/** El código completo de una función (busca en todos los JS). */
export function codigoDe(app, name) {
  for (const [f, s] of Object.entries(app)) if (f.endsWith(".js")) { const m = findMember(s, name); if (m) return { ...m, file: f }; }
  return null;
}

/** El mapa en texto, para el pedido. */
export function mapaTexto(app) {
  const out = [`Archivos: ${Object.entries(app).map(([f, s]) => `${f} (${s.split("\n").length} líneas, ~${estTokens(s)} tokens)`).join(", ")}`];
  for (const [f, s] of Object.entries(app)) if (f.endsWith(".js")) {
    const fns = funcionesDe(s);
    if (!fns.length) continue;
    out.push(`Funciones de ${f} (línea · quién la llama):`);
    for (const fn of fns) { const c = llamadas(app, fn.name); out.push(`- ${fn.name}(${fn.args}) ${f}:${fn.line} · ${c.length ? c.slice(0, 6).map((x) => `${x.file}:${x.line}`).join(", ") + (c.length > 6 ? ` y ${c.length - 6} más` : "") : "NADIE la llama"}`); }
  }
  const html = Object.entries(app).filter(([f]) => f.endsWith(".html")).map(([, s]) => s).join("\n");
  const ids = [...new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))];
  if (ids.length) out.push(`ids del HTML: ${ids.join(", ")}`);
  const css = Object.entries(app).filter(([f]) => f.endsWith(".css")).map(([, s]) => s.replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
  const cls = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)(?=[^{}]*\{)/g)].map((m) => m[1]))];
  if (cls.length) out.push(`clases del CSS: ${cls.join(", ")}`);
  return out.join("\n");
}
