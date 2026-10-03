// term_coverage_check.mjs — aviso determinista (sin LLM) de cobertura por palabras.
//
// Para cada requisito toma sus palabras PROPIAS (las que no aparecen en los
// demás requisitos, ver distinctiveTerms) y se fija si aparecen en alguna
// tarea del graph (título + descripción). Las que faltan se muestran como
// WARN informativo: no bloquea ni decide nada.
//
// Evidencia (experiments/term_coverage.mjs, 30/09, 3 casos con verdad conocida):
// los 9 requisitos no cubiertos tienen al menos una palabra propia faltante,
// pero 8 de 13 cubiertos también (sinónimos de verbo, ejemplos enumerados).
// Por eso es un aviso para que lo lea Miche, sin umbral, y cada aviso se
// etiqueta (hueco real / falso aviso) para juntar casos de calibración.

import { terms, synKey } from "./text_terms.mjs";
import { distinctiveTerms, extractTasks } from "./completeness_reviewer3.mjs";

export const TERM_COVERAGE_VERSION = "term_coverage v0.1";

export function termCoverage(requirements, tasks) {
  const tt = extractTasks(tasks, { withDescriptions: true });
  const have = new Set(tt.flatMap((t) => terms(t.text).map(synKey)));
  return requirements.map((r) => {
    const own = [...new Set(distinctiveTerms(r, requirements))];
    const missing = own.filter((k) => !have.has(k));
    // Palabra original (no la raíz) para mostrar: la primera del requisito con esa raíz.
    const shown = missing.map((k) => terms(r.text).find((w) => synKey(w) === k) || k);
    return { id: r.id, text: r.text, present: own.length - missing.length, total: own.length, missing: shown };
  });
}
