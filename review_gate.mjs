// review_gate.mjs — ¿el Completeness Reviewer corrió de verdad?
//
// Evidencia (Project23, 03/10): el reviewer devolvió
// findings: [{type: "SYSTEM_ERROR", reason: "fetch failed"}] y el gate de
// script.js lo aprobó, porque solo frenaba ante GAP/EXCESS. Un reviewer que
// no corrió no es un reviewer que no encontró nada.
//
// Módulo puro (lo usa script.js en el navegador; se testea con node).

export const REVIEW_GATE_VERSION = "review_gate v0.1";

/**
 * @param {object|null} result  lo que devuelve /api/completeness-review
 *                              (o {error} si la llamada misma falló)
 * @returns {{ran:boolean, reason?:string, gaps:number, excess:number, ambiguous:number, blocking:boolean}}
 */
export function reviewStatus(result) {
  const empty = { gaps: 0, excess: 0, ambiguous: 0, blocking: false };
  if (!result) return { ran: false, reason: "el reviewer no devolvió resultado", ...empty };
  if (result.error) return { ran: false, reason: String(result.error), ...empty };
  if (!Array.isArray(result.findings)) return { ran: false, reason: "la respuesta no trae findings", ...empty };
  const sys = result.findings.filter((f) => f?.type === "SYSTEM_ERROR");
  if (sys.length) return { ran: false, reason: sys.map((f) => f.reason || "error sin detalle").join("; "), ...empty };
  const count = (t) => result.findings.filter((f) => f?.type === t).length;
  const gaps = count("GAP"), excess = count("EXCESS"), ambiguous = count("AMBIGUOUS");
  return { ran: true, gaps, excess, ambiguous, blocking: gaps + excess > 0 };
}
