// html_dom.mjs — utilidades deterministas sobre HTML como texto (plataforma web).
// Extraídas tal cual de file_diet.mjs (refactor de profiles, 05/10): las usan el
// Specialist legacy (landing/file_diet.mjs) y el encapsulado de componentes.

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export function findElementById(html, id) {
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
export function topLevelElements(block) {
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
