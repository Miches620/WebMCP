// file_diet.mjs — qué ve el Specialist en cada tarea y cómo puede responder.
//
// Decisión 02/10 (Miche): el proyecto tiene que correr en PCs modestas (8 GB
// VRAM, Gemma con ~12k de contexto). Evidencia Project22: prompt + respuesta
// sumaron 12032 tokens en todos los cortes; desde el paso 13 el prompt ya
// ocupaba ~7k (los 4 archivos enteros) y 10 de 31 pasos se cortaron.
//
// 1. Cada tarea recibe COMPLETOS solo los archivos que toca; el resto va como
//    RESUMEN (estructura: ids/clases, selectores, funciones).
// 2. Gemma puede responder sin reescribir archivos enteros:
//      ### APPEND: styles.css | app.js | api.js   → se agrega al final
//      ### SECTION: <id>                          → reemplaza en index.html el
//                                                   elemento con ese id
//    ### FILE: x solo vale para archivos que recibió completos.
// 3. Presupuesto: si el prompt no deja lugar para responder, los archivos
//    secundarios pasan a resumen; max_tokens = contexto − prompt.
//
// Todo determinista y sin LLM.

export const FILES = ["index.html", "styles.css", "api.js", "app.js"];
const LANG = { "index.html": "html", "styles.css": "css", "api.js": "javascript", "app.js": "javascript" };

export const CONTEXT_TOKENS = 12000;     // Gemma 4 E4B en la PC de Miche (LM Studio)
export const MIN_ANSWER_TOKENS = 3500;   // lo mínimo que se reserva para la respuesta
export const estTokens = (s) => Math.ceil(String(s || "").length / 3.2);

const nrm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const KIND_RE = {
  style: /(estil|css|color|paleta|tipograf|fuente|hover|responsiv|media quer|movil|tablet|diseno|visual|apariencia|layout|grid|flex|espaciad|sombra)/,
  structure: /(estructura|html|semantic|esqueleto|maquet|contenedor|marcado|contenido textual|placeholder|etiqueta)/,
  logic: /(javascript|\bjs\b|logica|validaci|envio|enviar|submit|evento|scroll|observer|interacc|contador|dinamic|carrusel|carrousel|clic|click|animaci|navegaci|render|consum)/,
  data: /(backend|endpoint|\bapi\b|datos|simulad|mock|servicio|base de datos|archivo de texto|parse|modelad|lectura)/,
};

/**
 * Tipo de trabajo de la tarea. El PRINCIPAL sale del título (la coincidencia que
 * aparece primero: "Implementar la estructura semántica de Navegación" →
 * structure, "efectos hover dinámicos" → style). La descripción solo suma tipos
 * secundarios: suele mencionar cosas en negativo ("No se deben incluir estilos").
 */
export function classifyTask(t) {
  const title = nrm(t.task || ""), desc = nrm(t.description || "");
  const hits = Object.entries(KIND_RE).map(([k, re]) => [k, title.search(re)]).filter(([, i]) => i >= 0).sort((x, y) => x[1] - y[1]);
  let primary = hits[0]?.[0] || null;
  if (/^(backend|dba)$/i.test(t.role || "")) primary = "data"; // su trabajo vive en api.js
  if (!primary) primary = Object.entries(KIND_RE).map(([k, re]) => [k, desc.search(re)]).filter(([, i]) => i >= 0).sort((x, y) => x[1] - y[1])[0]?.[0] || null;
  const secondary = new Set([...hits.map(([k]) => k), ...Object.entries(KIND_RE).filter(([, re]) => re.test(desc)).map(([k]) => k)]);
  if (primary) secondary.delete(primary);
  return { primary, secondary: [...secondary] };
}

const FILES_OF = { structure: ["index.html"], style: ["styles.css"], logic: ["app.js", "api.js"], data: ["api.js"] };

// ---------- resúmenes ----------
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** index.html → árbol de etiquetas con id/clase/data-feature (sin textos largos). */
export function htmlOutline(html) {
  const body = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, (m, t) => `<${t}></${t}>`);
  const out = [];
  let depth = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>([^<]*)/g;
  let m;
  while ((m = re.exec(body))) {
    const [, close, tagRaw, attrs, text] = m;
    const tag = tagRaw.toLowerCase();
    if (close) { depth = Math.max(0, depth - 1); continue; }
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    const cls = attrs.match(/\bclass="([^"]+)"/)?.[1];
    const df = attrs.match(/\bdata-feature="([^"]+)"/)?.[1];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const href = attrs.match(/\bhref="(#[^"]*)"/)?.[1];
    const txt = text.replace(/\s+/g, " ").trim().slice(0, 30);
    if (["html", "head", "meta", "title", "link", "script", "br"].includes(tag)) { if (!VOID.has(tag) && !attrs.endsWith("/")) depth++; continue; }
    out.push(`${"  ".repeat(Math.min(depth, 8))}<${tag}${id ? `#${id}` : ""}${cls ? `.${cls.trim().split(/\s+/).join(".")}` : ""}${df ? ` [${df}]` : ""}${name ? ` name=${name}` : ""}${href ? ` →${href}` : ""}>${txt ? ` ${txt}${text.trim().length > 30 ? "…" : ""}` : ""}`);
    if (!VOID.has(tag) && !attrs.trim().endsWith("/")) depth++;
  }
  return out.join("\n");
}

/** styles.css → lista de selectores (con @media), sin cuerpos. */
export function cssOutline(css) {
  const src = String(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0, buf = "";
  for (const ch of src) {
    if (ch === "{") { const sel = buf.trim().replace(/\s+/g, " "); if (sel) out.push(`${"  ".repeat(depth)}${sel}`); buf = ""; depth++; }
    else if (ch === "}") { depth = Math.max(0, depth - 1); buf = ""; }
    else if (ch === ";") buf = "";
    else buf += ch;
  }
  return out.join("\n");
}

/** app.js / api.js → funciones, listeners y comentarios de sección. */
export function jsOutline(js) {
  const lines = String(js).split("\n");
  const keep = lines.filter((l) => /^\s*(\/\/\s*(=|TAREA|[A-ZÁÉÍÓÚ]{3,})|(async\s+)?function\s|const\s+\w+\s*=\s*(async\s*)?(\(|function)|window\.api\.\w+\s*=|[\w.]+\.addEventListener\()/.test(l));
  return keep.map((l) => l.replace(/\s+$/, "").slice(0, 140)).join("\n");
}

const OUTLINE = { "index.html": htmlOutline, "styles.css": cssOutline, "app.js": jsOutline, "api.js": jsOutline };

/** Bloque de archivos para el prompt: completos los de `full`, el resto resumidos. */
export function filesBlockDiet(files, full) {
  return FILES.map((f) => full.has(f)
    ? `### FILE: ${f} (COMPLETO)\n\`\`\`${LANG[f]}\n${files[f]}\`\`\``
    : `### RESUMEN: ${f} (solo estructura; NO lo devuelvas con FILE, usá APPEND${f === "index.html" ? " o SECTION" : ""})\n\`\`\`\n${OUTLINE[f](files[f]) || "(vacío)"}\n\`\`\``).join("\n\n");
}

/**
 * Elige qué va completo respetando el presupuesto: los archivos del tipo
 * principal siempre; los secundarios mientras quede lugar para responder (se
 * sacan primero los más grandes). Sin tipo reconocido: todos, con el mismo recorte.
 * @returns {{full:Set<string>, primary:string|null, secondary:string[], block:string, promptTokens:number, maxTokens:number, downgraded:string[]}}
 */
export function planPrompt({ task, files, head, system, context = CONTEXT_TOKENS }) {
  const { primary, secondary } = classifyTask(task);
  const must = new Set(primary ? FILES_OF[primary] : []);
  const full = new Set(primary ? [...must, ...secondary.flatMap((k) => FILES_OF[k])] : FILES);
  const downgraded = [];
  const measure = () => estTokens(system) + estTokens(head) + estTokens(filesBlockDiet(files, full));
  const optional = [...full].filter((f) => !must.has(f)).sort((a, b) => files[b].length - files[a].length);
  for (const f of optional) {
    if (context - measure() >= MIN_ANSWER_TOKENS) break;
    full.delete(f); downgraded.push(f);
  }
  const promptTokens = measure();
  return { full, primary, secondary, block: filesBlockDiet(files, full), promptTokens, maxTokens: Math.max(1500, context - promptTokens - 200), downgraded };
}

// ---------- aplicar la respuesta ----------
function findElementById(html, id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const open = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid="${esc}"[^>]*>`).exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase();
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = open.index + open[0].length;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (!depth) return { start: open.index, end: m.index + m[0].length, tag };
  }
  return null;
}

// Elementos de primer nivel de un bloque HTML (saltea comentarios y espacios).
function topLevelElements(block) {
  const out = [];
  let rest = block;
  for (;;) {
    rest = rest.replace(/^(\s|<!--[\s\S]*?-->)+/, "");
    const m = /^<([a-zA-Z][\w-]*)\b[^>]*>/.exec(rest);
    if (!m) break;
    const id = m[0].match(/\bid=["']([^"']+)["']/)?.[1] || null;
    const tag = m[1].toLowerCase();
    let end = m[0].length;
    if (!VOID.has(tag)) {
      const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
      re.lastIndex = m[0].length;
      let depth = 1, mm;
      while ((mm = re.exec(rest))) { depth += mm[1] ? -1 : 1; if (!depth) { end = mm.index + mm[0].length; break; } }
      if (depth) break; // sin cierre
    }
    out.push({ tag, id, html: rest.slice(0, end) });
    rest = rest.slice(end);
  }
  return out;
}

function replaceElement(html, id, newHtml) {
  const el = findElementById(html, id);
  if (!el) return null;
  const oldDf = html.slice(el.start, el.end).match(/^<[^>]*\bdata-feature="([^"]+)"/)?.[1];
  let piece = newHtml.trim();
  // El ancla data-feature la puso el harness: si Gemma la perdió, se repone.
  if (oldDf && !/^<[^>]*\bdata-feature=/.test(piece)) piece = piece.replace(/^<([a-zA-Z][\w-]*)/, `<$1 data-feature="${oldDf}"`);
  return html.slice(0, el.start) + piece + html.slice(el.end);
}

/**
 * Aplica FILE / APPEND / SECTION sobre una copia.
 * v0.6.1 (Project22, corrida 22-54-04): Gemma escribió bien el contenido pero el
 * harness rechazó 9 bloques por forma. Ahora se interpreta lo que quiso hacer:
 *   - SECTION con comentario adelante ("<!-- R1: Hero -->") → se ignora el comentario
 *   - SECTION: index.html con una o varias <section id=…> → se reemplaza cada una por su id
 *   - SECTION con el documento entero (<!DOCTYPE/<html>) → FILE index.html (si lo vio completo)
 *   - SECTION con CSS adentro → APPEND styles.css
 * @returns {{next:object, changed:string[], rejected:string[], ops:string[]}}
 */
export function applyBlocks(base, raw, full = new Set(FILES)) {
  const next = { ...base }, changed = new Set(), rejected = [], ops = [];
  const re = /###\s*(FILE|APPEND|SECTION):\s*([#\w.\-]+)[^\n]*\n+```([\w-]*)\n([\s\S]*?)```/g;
  let m;
  const doFile = (target, body) => {
    if (!FILES.includes(target)) { rejected.push(`FILE ${target}: no es un archivo del proyecto`); return; }
    if (!full.has(target)) { rejected.push(`FILE ${target}: lo recibió resumido, no puede reescribirlo entero`); return; }
    if (base[target].length > 200 && body.length < base[target].length * 0.6) { rejected.push(`FILE ${target}: ${body.length} chars vs ${base[target].length} anterior`); return; }
    next[target] = body; changed.add(target); ops.push(`FILE ${target}`);
  };
  const doAppend = (target, body, note = "") => {
    if (!["styles.css", "app.js", "api.js"].includes(target)) { rejected.push(`APPEND ${target}: solo styles.css, app.js o api.js`); return; }
    next[target] = next[target].replace(/\s*$/, "\n\n") + body; changed.add(target); ops.push(`APPEND ${target}${note}`);
  };
  while ((m = re.exec(String(raw || "")))) {
    const kind = m[1].toUpperCase();
    const target = m[2].trim().replace(/^#/, "");
    const lang = (m[3] || "").toLowerCase();
    const body = m[4].replace(/\s+$/, "") + "\n";
    if (kind === "FILE") { doFile(target, body); continue; }
    if (kind === "APPEND") { doAppend(target, body); continue; }
    // SECTION
    const trimmed = body.replace(/^(\s|<!--[\s\S]*?-->)+/, "");
    if (lang === "css" || (!trimmed.startsWith("<") && /[{}]/.test(trimmed))) { doAppend("styles.css", body, ` (pedido como SECTION ${target})`); continue; }
    if (/^<(!doctype|html)\b/i.test(trimmed)) {
      const before = rejected.length;
      doFile("index.html", body);
      if (rejected.length === before) ops[ops.length - 1] += ` (pedido como SECTION ${target})`;
      continue;
    }
    const els = topLevelElements(body);
    if (!els.length) { rejected.push(`SECTION ${target}: no trae un elemento HTML`); continue; }
    let done = 0;
    for (const el of els) {
      const id = el.id || (els.length === 1 ? target : null);
      if (!id || !findElementById(next["index.html"], id)) { rejected.push(`SECTION ${target}: <${el.tag}${el.id ? ` id="${el.id}"` : ""}> no corresponde a ningún elemento con id de index.html`); continue; }
      if (!el.id) { rejected.push(`SECTION ${target}: el bloque tiene que empezar con el elemento id="${target}"`); continue; }
      next["index.html"] = replaceElement(next["index.html"], id, el.html);
      changed.add("index.html"); ops.push(`SECTION #${id}`); done++;
    }
  }
  return { next, changed: [...changed], rejected, ops };
}
