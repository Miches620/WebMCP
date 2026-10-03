// components.mjs — piezas DETERMINISTAS del Specialist por componentes (v0.7).
//
// Decisión de Miche (03/10): "que programe como lo haría yo" — como en Angular,
// cada parte de la página es un COMPONENTE con su html, su css y su js. Gemma
// construye uno por vez y solo ve ese. Evidencia que lo motiva (Project22 v0.6.1,
// corrida 00-31-33): con 4 archivos compartidos, una regla global
// `section{opacity:0}` escrita en una tarea de estilo dejó invisibles el hero,
// testimonios, estadísticas y contacto, porque el JS de otra tarea solo
// observaba algunas secciones; el CSS creció a ~1230 líneas duplicadas y los
// prompts volvieron a 11–12k tokens.
//
// Lo que acá impone el harness (no se le pide a Gemma):
//   - la lista de componentes sale del page plan (header, secciones, footer)
//   - el CSS de un componente queda ENCAPSULADO: todo selector se reescribe para
//     que empiece con #id (scopeCss); las reglas globales (html, body, :root, *)
//     se descartan: lo global vive solo en tokens.css
//   - el JS de cada componente corre en su propia función con `root` y en su
//     propio <script>: sin colisiones de nombres, y un error de sintaxis no
//     rompe a los demás
//   - el HTML queda con un solo elemento raíz con su id y su data-feature
//   - el ensamblado es UN solo index.html autocontenido (restricción del usuario
//     "un solo archivo HTML" que se había perdido en v0.5/v0.6)

import { findElementById, topLevelElements } from "./file_diet.mjs";
import vm from "node:vm";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ---------- lista de componentes ----------
/** Componentes en orden de página, desde el page plan. plan null/undefined → solo header y footer. */
export function componentsFromPlan(plan, features = []) {
  const feat = (ids) => (ids || []).map((r) => ({ id: r, text: features[Number(r.slice(1)) - 1] || "" }));
  const out = [{ id: "site-header", tag: "header", kind: "header", titulo: "Encabezado y navegación", features: feat(plan?.header?.features) }];
  for (const s of plan?.sections || []) out.push({ id: s.id, tag: "section", kind: "section", titulo: s.titulo, features: feat(s.features) });
  out.push({ id: "site-footer", tag: "footer", kind: "footer", titulo: "Pie de página", features: feat(plan?.footer?.features) });
  return out;
}

/** Features transversales (aplican a todos los componentes): las del plan, o las que no tienen pieza. */
export function transversalsFromPlan(plan, features = []) {
  const ids = plan?.transversales || [];
  return ids.map((r) => ({ id: r, text: features[Number(r.slice(1)) - 1] || "" })).filter((x) => x.text);
}

// ---------- esqueleto ----------
export function skeletonComponent(c, { title = "Prototipo", sections = [] } = {}) {
  const df = c.features.length ? ` data-feature="${c.features.map((f) => f.id).join(" ")}"` : "";
  if (c.kind === "header") {
    const nav = sections.map((s) => `      <li><a href="#${s.id}">${esc(s.titulo)}</a></li>`).join("\n");
    return { html: `<header id="${c.id}"${df}>\n  <div class="brand">${esc(title)}</div>\n  <nav>\n    <ul>\n${nav}\n    </ul>\n  </nav>\n</header>\n`, css: "", js: "" };
  }
  if (c.kind === "footer") return { html: `<footer id="${c.id}"${df}>\n  <p>${esc(title)}</p>\n</footer>\n`, css: "", js: "" };
  return { html: `<section id="${c.id}"${df}>\n  <h2>${esc(c.titulo)}</h2>\n</section>\n`, css: "", js: "" };
}

export const API_SKELETON = "// Capa de datos SIMULADA (backend mock). Los componentes usan solo window.api.\nwindow.api = window.api || {};\n";
export const TOKENS_SKELETON = ":root {\n  --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;\n}\n*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; font-family: var(--font); }\nimg { max-width: 100%; }\n";

export function initialState(comps, title) {
  const sections = comps.filter((c) => c.kind === "section");
  return {
    title,
    tokens: TOKENS_SKELETON,
    api: API_SKELETON,
    components: Object.fromEntries(comps.map((c) => [c.id, skeletonComponent(c, { title, sections })])),
  };
}

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
  return { js: calls ? `${src.replace(/\s+$/, "")}\n${calls}\n` : src, invoked };
}

export const wrapJs = (id, js) => `(function (root) {\n  if (!root) return;\n${autoInvoke(js).js}\n})(document.getElementById(${JSON.stringify(id)}));`;
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
    const js = ((p.js ?? cur.js ?? "") + "\n" + extraJs).trim();
    const err = jsError(wrapJs(c.id, js));
    if (err) rejected.push(`js: error de sintaxis (${err})`);
    else if (NO_FETCH.test(js)) rejected.push("js: usa fetch/XMLHttpRequest (los datos van por window.api)");
    else {
      comp.js = js ? js + "\n" : ""; changed.push("js");
      const inv = autoInvoke(comp.js).invoked;
      if (inv.length) notes.push(`js: el harness agrega la llamada a ${inv.map((n) => n + "(root)").join(", ")}`);
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

// ---------- ensamblado ----------
/** Un solo index.html autocontenido: tokens + css de cada componente, api.js y un <script> por componente. */
export function assemble(state, comps) {
  const css = comps.map((c) => state.components[c.id].css ? `/* ===== componente #${c.id} ===== */\n${state.components[c.id].css}` : "").filter(Boolean).join("\n");
  const html = (c) => state.components[c.id].html.trim().split("\n").map((l) => "  " + l).join("\n");
  const header = comps.filter((c) => c.kind === "header").map(html).join("\n");
  const main = comps.filter((c) => c.kind === "section").map(html).join("\n\n");
  const footer = comps.filter((c) => c.kind === "footer").map(html).join("\n");
  const scripts = comps.filter((c) => (state.components[c.id].js || "").trim())
    .map((c) => `<script data-component="${c.id}">\n${wrapJs(c.id, state.components[c.id].js)}\n</script>`).join("\n");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(state.title)}</title>
  <style>
/* ===== tokens.css (global) ===== */
${state.tokens}
${css}
  </style>
</head>
<body>
${header}
  <main id="app">
${main}
  </main>
${footer}
<script data-file="api.js">
${state.api}
</script>
${scripts}
</body>
</html>
`;
}

// ---------- notas del TechLeader por componente ----------
const SYN = {
  header: ["navegacion", "navbar", "header", "encabezado", "menu"],
  footer: ["footer", "pie de pagina"],
  inicio: ["hero", "portada", "banner"], hero: ["hero", "portada", "banner"],
  contacto: ["contacto", "formulario"], caracteristicas: ["caracteristicas", "features"],
  estadisticas: ["estadisticas", "contadores", "stats"], testimonios: ["testimonios", "opiniones"],
};
const STOP = new Set(["seccion", "secciones", "animadas", "animado", "pagina", "sitio", "principal"]);

/** Tareas del graph que hablan de este componente (por palabras clave). Las de QA no van: eso es Validation. */
export function tasksFor(c, tasks = [], comps = []) {
  const words = new Set();
  if (c.kind === "header" || c.kind === "footer") SYN[c.kind].forEach((w) => words.add(w));
  for (const part of [...norm(c.titulo).split(/[^a-z0-9]+/), ...c.id.split("-")]) {
    if (part.length >= 4 && !STOP.has(part)) words.add(part);
    (SYN[part] || []).forEach((w) => words.add(w));
  }
  // la etiqueta de una feature que es SOLO de este componente (R1 "Hero…" → hero)
  for (const f of c.features) {
    const shared = comps.filter((x) => x.features.some((g) => g.id === f.id)).length > 1;
    const w = norm(f.text).split(/[^a-z0-9]+/).find((x) => x.length >= 4 && !STOP.has(x));
    if (!shared && w) words.add(w);
  }
  return tasks.filter((t) => !/qa/i.test(t.role || "")).filter((t) => {
    const n = norm(t.task);
    return [...words].some((w) => n.includes(w));
  });
}
