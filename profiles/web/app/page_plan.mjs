// page_plan.mjs — plan de UNA pantalla (profile web/app; lo usa también web/game).
//
// Determinista, sin modelo (05/10, Boxworld build 3): el page plan de landing
// (Qwen) partió el juego en #juego + #niveles; #niveles terminó siendo un segundo
// juego de 5x5 que también se movía con las flechas. Una app o un juego es UNA
// pantalla: un componente principal con todas las features; las de estilo
// (refined.estilo) van como transversales. Sin header ni footer.

export const PAGE_PLAN_VERSION = "app_plan v0.1-una-pantalla";
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/**
 * @param {string[]} features
 * @param {{refined?:object, mainId?:string}} opts
 * @returns {Promise<{plan, errors:string[], attempts:[], version:string, model:null}>}
 */
export async function planPage(features = [], opts = {}) {
  return planPageSync(features, opts);
}

export function planPageSync(features = [], { refined = {}, mainId = "principal" } = {}) {
  const estilo = new Set((refined.estilo || []).map(norm));
  const main = [], trans = [];
  features.forEach((f, i) => (estilo.has(norm(f)) ? trans : main).push(`R${i + 1}`));
  const plan = {
    header: null,
    footer: null,
    sections: [{ id: mainId, titulo: refined.project_name || "Aplicación", features: main }],
    transversales: trans,
  };
  return { plan, errors: [], attempts: [], version: PAGE_PLAN_VERSION, model: null };
}

export function planText(plan) {
  if (!plan) return "(sin plan)";
  return [
    "  (sin header ni footer: una sola pantalla)",
    ...plan.sections.map((s) => `  #${s.id} "${s.titulo}": ${s.features.join(", ") || "—"}`),
    `  transversales: ${plan.transversales.join(", ") || "—"}`,
  ].join("\n");
}
