// js_tools.mjs — herramientas de LENGUAJE (JavaScript) del harness (12/10, refactor del borde).
//
// No saben de web ni de ningún dominio: cargar scripts en un contexto aislado de Node, correr las
// pruebas de aceptación que declara un Standard, ubicar/reemplazar una función, lints de nombres.
// Antes vivían dentro de files_engine.mjs; se movieron sin cambios.

import vm from "node:vm";

// ---------- cargar scripts en Node ----------
/** Corre los scripts (en orden) en un contexto aislado y devuelve los globales pedidos. */
export function loadScripts(codes, globals = []) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  const grab = globals.map((g) => `globalThis.__g_${g} = typeof ${g} !== "undefined" ? ${g} : undefined;`).join(" ");
  try { vm.runInContext(codes.join("\n;\n") + "\n;" + grab, ctx, { timeout: 2000 }); } catch (e) { return { error: String(e.message || e) }; }
  return Object.fromEntries(globals.map((g) => [g, ctx[`__g_${g}`]]));
}
export const syntaxOf = (code) => { try { new vm.Script(code || ""); return null; } catch (e) { return e.message; } };

// ---------- pruebas de aceptación de un paso logic ----------
/**
 * Corre las pruebas que declara el Standard sobre el objeto global de la lógica.
 * step.tests: [{name, fn, after?, input, run(G, input) → true | "mensaje"}]
 * step.itemTests: [(G, item, i) → {name, fn, ok, detail}] — una por cada dato (p.ej. cada nivel)
 * @returns {{passed:string[], failed:{name,fn,after,detail}[]}}
 */
export function runAcceptance(G, items, step) {
  const passed = [], failed = [];
  const fns = step.functions || [];
  if (!G || fns.some((f) => typeof G[f] !== "function"))
    return { passed, failed: [{ name: "contrato", detail: `${step.file} tiene que definir const ${step.global} = { ${fns.join(", ")} } (${fns.length === 1 ? "la función" : `las ${fns.length} funciones`}).` }] };
  for (const t of step.tests || []) {
    let r;
    try { r = t.run(G, t.input); } catch (e) { r = `${t.name}: tiró un error: ${e.message}`; }
    if (r === true) passed.push(t.name); else failed.push({ name: t.name, fn: t.fn, after: t.after, detail: r });
  }
  (items || []).forEach((item, i) => {
    for (const it of step.itemTests || []) {
      let r;
      try { r = it(G, item, i); } catch (e) { r = { name: `dato ${i + 1}`, fn: null, ok: false, detail: `tiró: ${e.message}` }; }
      if (r.ok) passed.push(r.name); else failed.push({ name: r.name, fn: r.fn, detail: r.detail });
    }
  });
  // una prueba que depende de otra función se atribuye a esa función si ella también falla
  // (b9: se "reparó" ganado, que estaba bien, porque mover no empujaba)
  for (const f of failed) if (f.after && failed.some((g) => g.fn === f.after && !g.after)) f.fn = f.after;
  return { passed, failed };
}

// ---------- reparación por función ----------
function blockEndLines(lines, from) {
  let depth = 0, seen = false, q = null, block = false;
  for (let i = from; i < lines.length; i++) {
    const l = lines[i];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k], nx = l[k + 1];
      if (block) { if (ch === "*" && nx === "/") { block = false; k++; } continue; }
      if (q) { if (ch === "\\") { k++; continue; } if (ch === q) q = null; continue; }
      if (ch === "/" && nx === "/") break;
      if (ch === "/" && nx === "*") { block = true; k++; continue; }
      if (ch === "'" || ch === '"' || ch === "`") { q = ch; continue; }
      if (ch === "{") { depth++; seen = true; } else if (ch === "}") { depth--; if (seen && depth === 0) return i; }
    }
    if (q !== "`") q = null;
  }
  return -1;
}
/** Dónde está un método o función `name` (líneas 1-based): `name(…) {`, `name: function (…) {`, `function name(…) {`, `const name = …`. */
export function findMember(js, name) {
  const lines = String(js || "").split("\n");
  const re = new RegExp(`^\\s*(?:async\\s+)?(?:function\\s+${name}\\s*\\(|${name}\\s*\\(|${name}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\()|(?:const|let|var)\\s+${name}\\s*=)`);
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const end = blockEndLines(lines, i);
  return end < 0 ? null : { name, start: i + 1, end: end + 1, text: lines.slice(i, end + 1).join("\n") };
}
/** Reemplaza el método por la versión corregida; respeta la coma final de un literal de objeto. */
export function replaceMember(js, m, code) {
  let body = String(code || "").replace(/\s+$/, "");
  if (!new RegExp(`\\b${m.name}\\b`).test(body.split("\n")[0] || "")) return { ok: false, why: `no devolvió ${m.name}` };
  const lines = String(js).split("\n");
  const hadComma = /}\s*,\s*$/.test(lines[m.end - 1]);
  if (hadComma && !/,\s*$/.test(body)) body += ",";
  if (!hadComma) body = body.replace(/,\s*$/, "");
  const next = [...lines.slice(0, m.start - 1), body, ...lines.slice(m.end)].join("\n");
  try { new vm.Script(next); } catch (e) { return { ok: false, why: `no compila: ${e.message}` }; }
  return { ok: true, js: next };
}

// ---------- lints generales ----------
/** El código sin comentarios (para lints que buscan palabras: un comentario no es código). */
export function stripComments(code) {
  return String(code || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}
/** Nombres declarados al nivel superior (const/let/var/function/class al comienzo de la línea). */
export function topNames(code) {
  return [...String(code || "").matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}
/** Nombres que este archivo declara y otro ya declaró (en scripts comunes eso rompe la página). */
export function clashes(code, others) {
  const mine = new Set(topNames(code));
  const out = [];
  for (const [file, src] of Object.entries(others)) for (const n of topNames(src)) if (mine.has(n)) out.push(`"${n}" ya está declarado en ${file}: en este archivo no lo declares (usalo o elegí otro nombre).`);
  return out;
}
/** Parámetro de flecha que tapa a una variable de afuera y se compara consigo mismo (`c => c.col === c`). */
export function shadowProblems(code) {
  const out = [];
  for (const m of String(code || "").matchAll(/\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>[^;\n]*?\b\1\.[\w$]+\s*===?\s*\1\b(?![\w$.(\[])/g))
    out.push(`en \`${m[0].trim().replace(/^\(\s*/, "").slice(0, 80)}\` el parámetro "${m[1]}" tapa a la variable "${m[1]}" de afuera (se compara ${m[1]}.algo con el mismo ${m[1]}): renombrá el parámetro de la flecha (por ejemplo p => p.fila === r && p.col === ${m[1]}).`);
  return out;
}
