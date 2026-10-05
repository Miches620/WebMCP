// components.mjs — piezas DETERMINISTAS del Specialist por componentes (v0.7),
// parte de ESTRUCTURA de página (profile web/landing).
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
// Refactor de profiles (05/10): acá queda lo que da por hecho una PÁGINA de
// header + secciones + footer (lista de componentes, esqueleto, ensamblado,
// notas del TechLeader por sinónimos de landing). El encapsulado de CSS/HTML/JS,
// que sirve para cualquier componente web, vive en
// profiles/web/specialist/encapsulation.mjs y se re-exporta acá.

import {
  API_SKELETON, TOKENS_SKELETON, wrapJs,
} from "../specialist/encapsulation.mjs";
export * from "../specialist/encapsulation.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// ---------- lista de componentes ----------
/**
 * Componentes en orden de página, desde el page plan. plan null/undefined → solo header y footer.
 * v0.7.4 (web/app, web/game): `header: null` / `footer: null` EXPLÍCITO en el plan → sin esa pieza
 * (una app o un juego es una pantalla, no una landing con menú y pie).
 */
export function componentsFromPlan(plan, features = []) {
  const feat = (ids) => (ids || []).map((r) => ({ id: r, text: features[Number(r.slice(1)) - 1] || "" }));
  const out = [];
  if (plan?.header !== null) out.push({ id: "site-header", tag: "header", kind: "header", titulo: "Encabezado y navegación", features: feat(plan?.header?.features) });
  for (const s of plan?.sections || []) out.push({ id: s.id, tag: "section", kind: "section", titulo: s.titulo, features: feat(s.features) });
  if (plan?.footer !== null) out.push({ id: "site-footer", tag: "footer", kind: "footer", titulo: "Pie de página", features: feat(plan?.footer?.features) });
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


export function initialState(comps, title) {
  const sections = comps.filter((c) => c.kind === "section");
  return {
    title,
    tokens: TOKENS_SKELETON,
    api: API_SKELETON,
    components: Object.fromEntries(comps.map((c) => [c.id, skeletonComponent(c, { title, sections })])),
  };
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

/**
 * Componente PRINCIPAL: la sección con más requisitos propios (empate → la primera).
 * Sin secciones → el primer componente.
 */
export function mainComponent(comps = []) {
  const secs = comps.filter((c) => c.kind === "section");
  if (!secs.length) return comps[0] || null;
  return secs.reduce((best, c) => (c.features.length > best.features.length ? c : best), secs[0]);
}

/**
 * v0.7.3 (05/10, Boxworld build 2): con tasksFor solo, 2 de 25 tareas del graph
 * llegaron a un componente (F1.1 y F4.2, por la palabra "juego"/"nivel"); las 23
 * restantes (grilla, avatar, flechas, colisiones, empuje, contador, reiniciar,
 * próximo nivel) no las vio nadie. Ahora TODA tarea que no es de QA llega a algún
 * componente: a los que nombra por palabras clave y, si no nombra a ninguno, al
 * componente principal. Orden del graph (respeta dependencias).
 * @returns {{byComp: Object<string, object[]>, unmatched: string[], main: string|null}}
 */
export function assignTasks(comps = [], tasks = []) {
  const work = tasks.filter((t) => !/qa/i.test(t.role || ""));
  const main = mainComponent(comps);
  const byComp = Object.fromEntries(comps.map((c) => [c.id, []]));
  const hit = new Set();
  for (const c of comps) for (const t of tasksFor(c, work, comps)) { byComp[c.id].push(t); hit.add(t); }
  const unmatched = work.filter((t) => !hit.has(t));
  if (main) byComp[main.id] = work.filter((t) => hit.has(t) ? byComp[main.id].includes(t) : true);
  return { byComp, unmatched: unmatched.map((t) => t.id), main: main?.id ?? null };
}

/**
 * Texto de NOTAS DEL TECHLEADER para el prompt: todas las tareas con su título y,
 * mientras alcance el presupuesto, su descripción (recortada). Las que no entran
 * con descripción van igual con el título: ninguna se pierde en silencio.
 */
export function notesText(notes = [], { maxDescribed = 8, descChars = 220 } = {}) {
  return notes.map((t, i) => `- [${t.id}] ${t.task}${i < maxDescribed && t.description ? ": " + String(t.description).slice(0, descChars) : ""}`).join("\n");
}
