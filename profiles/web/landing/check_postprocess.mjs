// check_postprocess.mjs — ajustes deterministas de los chequeos que propone el
// traductor, propios de una página de SECCIONES (profile web/landing).
//
// Extraído tal cual de check_translator.mjs (refactor de profiles, 05/10).

// Anclaje de sección (determinista, lo hace el harness, no Qwen).
// Evidencia 01/10 (exp_translator_sections): para R1 "Catalogo de cafés en
// tarjetas…" Qwen dio section = ["cafés","tarjetas"] en 5/5 y nunca
// "catalogo": una sección titulada "Catálogo" no se encontraba (0/5).
//   1) se agregan las palabras de la etiqueta de la feature (la misma que usa
//      el esqueleto para el título y el id de su sección);
//   2) se agrega feature = "Rn": si la página tiene <section data-feature="Rn">
//      (esqueleto v0.4) el chequeo usa ESA sección, sin adivinar por palabras.
const STOP = new Set(["de", "del", "la", "las", "el", "los", "y", "en", "con", "para", "seccion"]);
// Palabras que DESCRIBEN la pieza y nadie escribe en la página (02/10, Project22
// --retranslate: aun con la regla en el prompt, Qwen pidió control_visible con
// "llamada a la acción" / "botón" para el CTA del hero → FAIL falso). El harness
// las saca de text_visible/control_visible; si no queda nada, un control_visible
// pasa a section_control de la sección que el mismo requisito ya chequea, y un
// text_visible se descarta (la sección ya la cubre su chequeo de contenido).
const DESCRIPTOR = /^(titulo|subtitulo|boton|botones|llamada a la accion|llamada|accion|cta|call to action|pie|pie de pagina|footer|seccion|secciones|enlace|enlaces|link|links|encabezado|header|formulario)$/;
const nrmw = (w) => String(w || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export function dropDescriptorWords(checks) {
  const sectionOf = checks.find((c) => Array.isArray(c.params?.section) && c.params.section.length)?.params.section;
  const out = [];
  for (const c of checks) {
    if (c.type !== "text_visible" && c.type !== "control_visible") { out.push(c); continue; }
    const text = (c.params?.text || []).filter((w) => !DESCRIPTOR.test(nrmw(w)));
    if (text.length) { out.push(text.length === c.params.text.length ? c : { ...c, params: { ...c.params, text } }); continue; }
    if (c.type === "control_visible" && sectionOf) out.push({ type: "section_control", params: { section: sectionOf }, covers: c.covers });
    // text_visible solo con palabras descriptivas: se descarta
  }
  return out;
}

export function anchorSections(checks, rid, requirementText, label) {
  const lbl = label || String(requirementText || "").match(/['"“‘«]([^'"”’»]{2,40})['"”’»]/)?.[1]
    || String(requirementText || "").split(/\s+(?:con|en|para|que|donde|desde)\s+|[(,:;.]/i)[0];
  const extra = String(lbl || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return dropDescriptorWords(checks).map((c) => {
    if (!c.params?.section) return c;
    const section = [...new Set([...c.params.section, ...extra])];
    return { ...c, params: { ...c.params, section, ...(rid ? { feature: [rid] } : {}) } };
  });
}
