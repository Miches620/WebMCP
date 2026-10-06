// standards/registry.mjs — qué Standards existen (DRAFT u oficiales).
//
// Esquema acordado con Miche (06/10): Harness (general) → Standard (lo que recibe el
// Specialist para ESE tipo de proyecto) → Validation profile (lee el Standard y verifica si
// se cumplió; no lo copia). Un profile de tipo elige su Standard por id.

import grilla from "./web/game/grilla/standard.mjs";

const ALL = [grilla];
export const STANDARDS = Object.freeze(Object.fromEntries(ALL.map((s) => [s.id, s])));

/** Devuelve el Standard o falla fuerte (nunca "uno por defecto" en silencio). */
export function getStandard(id) {
  const s = STANDARDS[id];
  if (!s) throw new Error(`STANDARD_UNKNOWN: "${id}". Standards: ${Object.keys(STANDARDS).join(", ")}`);
  return s;
}
