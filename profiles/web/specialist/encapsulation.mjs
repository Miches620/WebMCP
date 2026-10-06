// encapsulation.mjs — encapsulado DETERMINISTA de un componente web (plataforma web).
//
// Extraído de build/components.mjs (refactor de profiles, 05/10), sin cambios de
// conducta. Lo que acá impone el harness (no se le pide a Gemma):
//   - el CSS de un componente queda ENCAPSULADO: todo selector se reescribe para
//     que empiece con #id (scopeCss); las reglas globales (html, body, :root, *)
//     se descartan: lo global vive solo en tokens.css
//   - el JS de cada componente corre en su propia función con `root` y en su
//     propio <script>: sin colisiones de nombres, y un error de sintaxis no
//     rompe a los demás
//   - el HTML queda con un solo elemento raíz con su id y su data-feature
//   - api.js es la capa de datos simulada (window.api), sin fetch
// No sabe nada de header/secciones/footer: eso es de cada profile (landing, app…).

import { findElementById, topLevelElements } from "./html_dom.mjs";
import vm from "node:vm";

export const API_SKELETON = "// Capa de datos SIMULADA (backend mock). Los componentes usan solo window.api.\nwindow.api = window.api || {};\n";
export const TOKENS_SKELETON = ":root {\n  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;\n}\n*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; font-family: var(--font); }\nimg { max-width: 100%; }\n";

// ---------- CSS ----------
function stripCssComments(css) { return String(css || "").replace(/\/\*[\s\S]*?\*\//g, ""); }

/** Parte CSS en bloques de primer nivel: {prelude, body} (body sin llaves) o {at:"@import …;"}. */
export function cssBlocks(css) {
  const s = stripCssComments(css);
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const brace = s.indexOf("{", i), semi = s.indexOf(";", i);
    if (s[i] === "@" && semi >= 0 && (brace < 0 || semi < brace)) { out.push({ at: s.slice(i, semi + 1).trim() }); i = semi + 1; continue; }
    if (brace < 0) break; // basura al final
    let depth = 1, j = brace + 1;
    while (j < s.length && depth) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; j++; }
    out.push({ prelude: s.slice(i, brace).trim(), body: s.slice(brace + 1, j - 1) });
    i = j;
  }
  return out;
}

function splitSelectors(prelude) {
  const out = []; let depth = 0, cur = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const GLOBAL_SEL = /^(html|body|:root|\*)(?![\w-])/i;

/**
 * Reescribe un selector para que solo alcance al componente.
 *   ya menciona #id            → igual
 *   html / body / :root / *    → null (global: va en tokens.css)
 *   su primer tramo es la raíz → #id + el resto ("section.visible" → "#inicio.visible")
 *   cualquier otro             → "#id " + selector
 */
export function scopeSelector(sel, root) {
  const s = sel.trim();
  const idRe = new RegExp(`#${root.id.replace(/[-]/g, "\\-")}(?![\\w-])`);
  if (idRe.test(s)) return s;
  if (GLOBAL_SEL.test(s)) return null;
  const first = s.match(/^[^\s>+~]+/)?.[0] || "";
  const tag = first.match(/^[a-zA-Z][\w-]*/)?.[0]?.toLowerCase() || "";
  const classes = [...first.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const otherId = /#[\w-]/.test(first);
  const isRoot = !otherId && ((tag && tag === root.tag) || (!tag && classes.length && classes.every((c) => root.classes.includes(c))));
  if (isRoot) return `#${root.id}${first.slice(tag.length)}${s.slice(first.length)}`;
  return `#${root.id} ${s}`;
}

/** Encapsula el CSS de un componente. @returns {{css:string, dropped:string[], rewritten:number}} */
export function scopeCss(css, root) {
  const dropped = []; let rewritten = 0;
  const walk = (blocks) => blocks.map((b) => {
    if (b.at) { dropped.push(b.at); return ""; } // @import, @charset…: fuera
    if (/^@(media|supports|container)\b/i.test(b.prelude)) {
      const inner = walk(cssBlocks(b.body)).filter(Boolean).join("\n");
      return inner ? `${b.prelude} {\n${inner}\n}` : "";
    }
    if (/^@(-\w+-)?keyframes\b/i.test(b.prelude) || /^@font-face\b/i.test(b.prelude)) {
      if (/^@font-face/i.test(b.prelude)) { dropped.push("@font-face"); return ""; }
      return `${b.prelude} {${b.body}}`;
    }
    if (b.prelude.startsWith("@")) { dropped.push(b.prelude); return ""; }
    const sels = splitSelectors(b.prelude).map((x) => {
      const y = scopeSelector(x, root);
      if (y === null) dropped.push(x); else if (y !== x) rewritten++;
      return y;
    }).filter(Boolean);
    return sels.length ? `${sels.join(", ")} {${b.body}}` : "";
  });
  return { css: walk(cssBlocks(css)).filter(Boolean).join("\n") + "\n", dropped, rewritten };
}

/** tokens.css es lo único global; no puede ocultar piezas de la página. */
export function cleanTokens(css) {
  const dropped = [];
  const HIDE = /(opacity\s*:\s*0(\.0+)?\s*(;|$|!)|visibility\s*:\s*hidden|display\s*:\s*none)/i;
  const PIECE = /(^|[\s,>+~])(section|header|footer|main|nav|article)(?![\w-])/i;
  const walk = (blocks) => blocks.map((b) => {
    if (b.at) { dropped.push(b.at); return ""; }
    if (/^@(media|supports)\b/i.test(b.prelude)) { const inner = walk(cssBlocks(b.body)).filter(Boolean).join("\n"); return inner ? `${b.prelude} {\n${inner}\n}` : ""; }
    if (/^@font-face/i.test(b.prelude)) { dropped.push("@font-face"); return ""; }
    if (!b.prelude.startsWith("@") && PIECE.test(b.prelude) && HIDE.test(b.body)) { dropped.push(`${b.prelude} (oculta piezas de la página)`); return ""; }
    return `${b.prelude} {${b.body}}`;
  });
  return { css: walk(cssBlocks(css)).filter(Boolean).join("\n") + "\n", dropped };
}

// ---------- HTML ----------
const EXTERNAL = /<(link|script)\b[^>]*(href|src)=["']?(https?:)?\/\/[^>]*>(\s*<\/script>)?/gi;

/**
 * Deja el HTML del componente con UN elemento raíz <tag id data-feature>.
 * Tolera: documento entero, comentarios, contenido sin raíz (se envuelve).
 * Saca <script>/<style>/<link> de adentro (su lugar es componente.js/.css).
 */
export function normalizeComponentHtml(html, c) {
  const notes = [];
  let h = String(html || "");
  const body = h.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body) { h = body[1]; notes.push("venía un documento entero: se usó el <body>"); }
  h = h.replace(/<!DOCTYPE[^>]*>/gi, "");
  if (new RegExp(EXTERNAL.source, "i").test(h)) notes.push("se sacaron recursos externos");
  h = h.replace(EXTERNAL, "");
  let styles = "";
  h = h.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => { styles += css + "\n"; notes.push("<style> movido a componente.css"); return ""; });
  let scripts = "";
  h = h.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, js) => { scripts += js + "\n"; notes.push("<script> movido a componente.js"); return ""; });
  h = h.replace(/<link\b[^>]*>/gi, "");
  const el = findElementById(h, c.id);
  let piece;
  if (el) piece = h.slice(el.start, el.end);
  else {
    const tops = topLevelElements(h.trim());
    if (tops.length === 1 && tops[0].tag === c.tag) piece = tops[0].html.replace(/^(<[^>]*?)\sid="[^"]*"/, "$1").replace(/^<([a-zA-Z][\w-]*)/, `<$1 id="${c.id}"`);
    else { piece = `<${c.tag} id="${c.id}">\n${h.trim()}\n</${c.tag}>`; notes.push(`sin raíz #${c.id}: se envolvió en <${c.tag}>`); }
  }
  // la raíz es del tag del componente y lleva el data-feature que puso el harness
  const df = c.features.map((f) => f.id).join(" ");
  piece = piece.replace(/^<[a-zA-Z][\w-]*/, `<${c.tag}`).replace(/<\/[a-zA-Z][\w-]*>\s*$/, `</${c.tag}>`);
  piece = piece.replace(/^(<[^>]*?)\sdata-feature="[^"]*"/, "$1");
  if (df) piece = piece.replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-feature="${df}"`);
  const classes = (piece.match(/^<[^>]*\bclass="([^"]*)"/)?.[1] || "").split(/\s+/).filter(Boolean);
  return { html: piece.trim() + "\n", styles, scripts, classes, notes };
}

// ---------- JS ----------
/**
 * Funciones de arranque declaradas y nunca llamadas (Project22 v0.7, 03/10: Gemma
 * escribió `function initializeInicio(root) {…}` en header, hero y contacto y no
 * la llamó nunca → hero invisible, nav sin scroll suave, formulario sin manejar;
 * el reintento repitió el mismo patrón). Determinista: se agrega la llamada si la
 * función es de primer nivel, su nombre aparece una sola vez y recibe `root`
 * (o no recibe nada y se llama init/initialize/setup/start/main).
 */
export function autoInvoke(js) {
  const src = String(js || "");
  const invoked = [];
  const decl = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)/gm;
  let m;
  while ((m = decl.exec(src))) {
    const name = m[1] || m[3];
    const params = (m[2] ?? m[4] ?? m[5] ?? "").trim();
    const uses = src.match(new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?![\\w$])`, "g")).length;
    if (uses !== 1) continue;
    if (params === "root" || (params === "" && /^(init|initialize|setup|start|main|bootstrap)/i.test(name))) invoked.push(name);
  }
  const calls = invoked.map((n) => `${n}(root); // llamada agregada por el harness (estaba declarada y nunca se llamaba)`).join("\n");
  if (!calls) {
    // v0.7.3 (Boxworld build 2, #juego): TODO el componente.js era UNA función anónima
    // `(root) => { … }` que nadie llamaba → 330 líneas de juego muertas, mapa vacío y
    // Validation sin enterarse. Si el archivo entero es una sola expresión función
    // (flecha o `function (x) {…}`, con 0 o 1 parámetro), el harness la llama con root.
    const body = src.trim().replace(/;\s*$/, "");
    if (ANON_FN.test(body) && isOneExpression(body)) {
      return { js: `(${body})(root); // llamada agregada por el harness (función anónima nunca llamada)\n`, invoked: [ANON] };
    }
  }
  return { js: calls ? `${src.replace(/\s+$/, "")}\n${calls}\n` : src, invoked };
}
export const ANON = "(función anónima)";
const ANON_FN = /^(?:async\s*)?(?:\(\s*(?:[A-Za-z_$][\w$]*)?\s*\)\s*=>\s*\{|function\s*\(\s*(?:[A-Za-z_$][\w$]*)?\s*\)\s*\{)/;
function isOneExpression(body) {
  try { new vm.Script(`(\n${body}\n)`); return true; } catch { return false; }
}

/**
 * v0.7.3 (Boxworld build 2, #juego, 1er intento): `const root = document.getElementById("juego")`
 * adentro del envoltorio que ya recibe `root` → SyntaxError "Identifier 'root' has already
 * been declared" y se rechazó TODO el JS (el reintento costó 6½ minutos). Si la línea
 * busca justo la raíz del componente, sobra: se saca. Si busca otra cosa, no se toca.
 */
export function dropRootRedeclare(js, id) {
  const src = String(js || "");
  const err = jsError(wrapJs(id, src));
  if (!err || !/'root' has already been declared/.test(err)) return { js: src, dropped: 0 };
  const q = "['\"`]";
  const idRe = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = new RegExp(`^[ \\t]*(?:const|let|var)\\s+root\\s*=\\s*document\\.(?:getElementById\\(\\s*${q}${idRe}${q}\\s*\\)|querySelector\\(\\s*${q}#${idRe}${q}\\s*\\))\\s*;?[ \\t]*(?://[^\\n]*)?$`, "gm");
  let dropped = 0;
  const out = src.replace(line, () => { dropped++; return "// (harness) `root` ya es este componente"; });
  return dropped && !jsError(wrapJs(id, out)) ? { js: out, dropped } : { js: src, dropped: 0 };
}

export const wrapJs = (id, js) => `(function (root) {\n  if (!root) return;\n${autoInvoke(js).js}\n})(document.getElementById(${JSON.stringify(id)}));`;
/**
 * v0.7.5 (Boxworld builds 4 y 5): dónde está el error de sintaxis de un componente.js,
 * en líneas DEL ARCHIVO (sin el envoltorio del harness). null si no hay error.
 * @returns {{message:string, line:number}|null}
 */
export function locateJsError(js, id = "x") {
  const src = String(js || "");
  const pre = dropRootRedeclare(src, id).js; // reemplaza línea por línea: los números no cambian
  const wrapped = `(function (root) {\n  if (!root) return;\n${pre}\n})(null);`;
  try { new vm.Script(wrapped, { filename: "c.js" }); return null; } catch (e) {
    const m = String(e.stack || "").match(/c\.js:(\d+)/);
    const line = m ? Math.max(1, Math.min(src.split("\n").length, Number(m[1]) - 2)) : 1;
    return { message: e.message, line };
  }
}

/** Ventana de líneas numeradas alrededor de `line` (1-based): {from, to, text}. */
export function jsWindow(js, line, before = 8, after = 4) {
  const lines = String(js || "").split("\n");
  const from = Math.max(1, line - before), to = Math.min(lines.length, line + after);
  return { from, to, text: lines.slice(from - 1, to).map((l, i) => `${String(from + i).padStart(4)}| ${l}`).join("\n") };
}

/** Reemplaza las líneas from..to (1-based, inclusive) por `replacement`. */
export function spliceLines(js, from, to, replacement) {
  const lines = String(js || "").split("\n");
  const rep = String(replacement || "").replace(/\n+$/, "").split("\n").map((l) => l.replace(/^\s{0,4}\d+\|\s?/, ""));
  return [...lines.slice(0, from - 1), ...rep, ...lines.slice(to)].join("\n");
}

/**
 * v0.7.6: funciones de PRIMER NIVEL de un componente.js con sus líneas (1-based, inclusive).
 * Reconoce `function f(…) {`, `async function f(…) {` y `const f = (…) => {` / `= function (…) {`
 * al comienzo de la línea. El final se busca contando llaves y saltando strings y comentarios.
 */
export function topLevelFunctions(js) {
  const lines = String(js || "").split("\n");
  const head = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(head);
    if (!m) continue;
    const end = blockEnd(lines, i);
    if (end < 0) continue;
    out.push({ name: m[1] || m[2], start: i + 1, end: end + 1 });
    i = end;
  }
  return out;
}
function blockEnd(lines, from) {
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
      if (ch === "{") { depth++; seen = true; }
      else if (ch === "}") { depth--; if (seen && depth === 0) return i; }
    }
    if (q !== "`") q = null; // strings comunes no cruzan líneas
  }
  return -1;
}
/** La función de primer nivel que contiene la línea `line`, o null. */
export const functionAt = (js, line) => topLevelFunctions(js).find((f) => f.start <= line && line <= f.end) || null;
/** Funciones de primer nivel que nombran un id (`'grid'`, `"#grid"`). */
export function functionsUsingId(js, id) {
  const lines = String(js || "").split("\n");
  const re = new RegExp(`['"\`]#?${String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\`\\s.:\\[]`);
  return topLevelFunctions(js).filter((f) => lines.slice(f.start - 1, f.end).some((l) => re.test(l)));
}

export function jsError(src, filename = "componente.js") {
  try { new vm.Script(String(src || ""), { filename }); return null; } catch (e) { return e.message; }
}
const NO_FETCH = /\b(fetch|XMLHttpRequest)\s*\(/;

// ---------- respuesta de Gemma ----------
/**
 * Bloques de una respuesta. Nombres aceptados: componente.(html|css|js) o
 * cualquier <algo>.(html|css|js) → por extensión; tokens.css; api.js (FILE o APPEND).
 * Sin encabezados ### pero con fences ```html/```css/```js → por lenguaje.
 */
export function parseComponentResponse(raw) {
  const r = String(raw || "");
  const out = { html: null, css: null, js: null, tokens: null, apiAppend: "", apiFile: null, nochange: null };
  const re = /###\s*(FILE|APPEND):\s*([\w.\-]+)[^\n]*\n+```([\w-]*)\n([\s\S]*?)```/g;
  let m, any = false;
  while ((m = re.exec(r))) {
    any = true;
    const [, op, name, , body] = m;
    const n = name.toLowerCase();
    if (n === "tokens.css") out.tokens = body;
    else if (n === "api.js") { if (op === "APPEND") out.apiAppend += body + "\n"; else out.apiFile = body; }
    else if (n.endsWith(".html")) out.html = body;
    else if (n.endsWith(".css")) out.css = body;
    else if (n.endsWith(".js")) out.js = body;
  }
  if (!any) {
    for (const f of r.matchAll(/```(html|css|javascript|js)\n([\s\S]*?)```/g)) {
      const k = f[1] === "html" ? "html" : f[1] === "css" ? "css" : "js";
      if (out[k] === null) out[k] = f[2];
    }
  }
  const nc = r.match(/SIN CAMBIOS:\s*(.*)/i);
  if (nc) out.nochange = nc[1].slice(0, 240);
  return out;
}

/**
 * Aplica la respuesta de un paso de componente sobre una COPIA del estado.
 * @returns {{next, changed:string[], notes:string[], rejected:string[]}}
 */
export function applyComponentResponse(state, c, raw) {
  const p = parseComponentResponse(raw);
  const cur = state.components[c.id];
  const next = { ...state, components: { ...state.components } };
  const comp = { ...cur };
  const changed = [], notes = [], rejected = [];
  let extraCss = "", extraJs = "";
  if (p.html !== null) {
    const n = normalizeComponentHtml(p.html, c);
    comp.html = n.html; comp.classes = n.classes; notes.push(...n.notes); extraCss = n.styles; extraJs = n.scripts;
    changed.push("html");
  }
  const root = { id: c.id, tag: c.tag, classes: comp.classes || [] };
  if (p.css !== null || extraCss) {
    const s = scopeCss((p.css ?? cur.css ?? "") + "\n" + extraCss, root);
    comp.css = s.css;
    if (s.dropped.length) notes.push(`css: descartado (global) ${s.dropped.slice(0, 5).join(", ")}${s.dropped.length > 5 ? "…" : ""}`);
    if (s.rewritten) notes.push(`css: ${s.rewritten} selectores encapsulados en #${c.id}`);
    changed.push("css");
  }
  if (p.js !== null || extraJs) {
    const rd = dropRootRedeclare(((p.js ?? cur.js ?? "") + "\n" + extraJs).trim(), c.id);
    const js = rd.js;
    if (rd.dropped) notes.push(`js: se sacó \`const root = …#${c.id}\` (root ya es el componente)`);
    const err = jsError(wrapJs(c.id, js));
    if (err) rejected.push(`js: error de sintaxis (${err})`);
    else if (NO_FETCH.test(js)) rejected.push("js: usa fetch/XMLHttpRequest (los datos van por window.api)");
    else {
      comp.js = js ? js + "\n" : ""; changed.push("js");
      const inv = autoInvoke(comp.js).invoked;
      if (inv.length) notes.push(`js: el harness agrega la llamada a ${inv.map((n) => n === ANON ? "la función anónima (root) => {…}" : n + "(root)").join(", ")}`);
    }
  }
  if (p.apiFile !== null || p.apiAppend) {
    const api = p.apiFile !== null && p.apiFile.length >= state.api.length * 0.6 ? p.apiFile : state.api + "\n" + p.apiAppend;
    const err = jsError(api, "api.js");
    if (err) rejected.push(`api.js: error de sintaxis (${err})`);
    else if (NO_FETCH.test(api)) rejected.push("api.js: usa fetch/XMLHttpRequest");
    else { next.api = api.replace(/\n{3,}/g, "\n\n"); changed.push("api.js"); }
  }
  next.components[c.id] = comp;
  return { next, changed, notes, rejected, nochange: p.nochange };
}

export function applyTokensResponse(state, raw) {
  const p = parseComponentResponse(raw);
  const css = p.tokens ?? p.css;
  if (css === null) return { next: state, changed: [], notes: [], rejected: ["no trae tokens.css"] };
  const t = cleanTokens(css);
  return { next: { ...state, tokens: t.css }, changed: ["tokens.css"], notes: t.dropped.length ? [`tokens: descartado ${t.dropped.join(", ")}`] : [], rejected: [] };
}

/**
 * v0.8.2 (06/10, Boxworld b9): arreglo DETERMINISTA de "Identifier 'x' has already been declared".
 * Gemma declaró `const altura = estado.mapa.length;` dos veces dentro de mover(); la reparación por
 * tramo (ventana alrededor de la 2ª declaración) no veía la 1ª y Gemma solo cambió const→let.
 * Regla: si la declaración repetida tiene el MISMO valor que la anterior, se borra; si no, pasa a
 * asignación (`x = …`) y la anterior pasa de const a let. Se acepta solo si el resultado compila
 * o al menos cambia de error. @returns {{js, fixes:[{name,line,action}]}}
 */
export function fixRedeclare(js, maxFixes = 8) {
  let src = String(js || "");
  const fixes = [];
  for (let k = 0; k < maxFixes; k++) {
    let err = null;
    try { new vm.Script(src, { filename: "r.js" }); } catch (e) { err = e; }
    const m = err && String(err.message).match(/Identifier '([\w$]+)' has already been declared/);
    if (!m) break;
    const name = m[1];
    const lines = src.split("\n");
    const decl = new RegExp(`^(\\s*)(const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\s*=\\s*(.*?);?\\s*$`);
    const at = Number((String(err.stack || "").match(/r\.js:(\d+)/) || [])[1]) - 1;
    let i = at >= 0 && decl.test(lines[at] || "") ? at : -1;
    if (i < 0) break; // no es una declaración simple de una línea: que la arregle otro mecanismo
    let j = -1;
    for (let p = i - 1; p >= 0; p--) if (decl.test(lines[p])) { j = p; break; }
    if (j < 0) break;
    const [, ind, , rhs] = lines[i].match(decl);
    const prevRhs = lines[j].match(decl)[3];
    let action;
    if (rhs.trim() === prevRhs.trim()) { lines.splice(i, 1); action = "borrada (mismo valor)"; }
    else { lines[i] = `${ind}${name} = ${rhs};`; lines[j] = lines[j].replace(/^(\s*)const\b/, "$1let"); action = "pasa a asignación"; }
    const next = lines.join("\n");
    fixes.push({ name, line: i + 1, action });
    src = next;
  }
  return { js: src, fixes };
}
