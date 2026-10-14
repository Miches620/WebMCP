// harness/assignments.mjs — de las Atomic Tasks a los pasos del Specialist (punto 9, 14/10).
//
// Decisión de Miche: "el Specialist ejecuta ESAS MISMAS tareas". Hasta acá las tareas le llegaban a
// Gemma solo como notas (y solo en algunos pasos). Con la receta del Standard cada tarea trae su
// "pieza"; la receta dice de qué pasos sale cada pieza (recipe.pasos) y quién la construye
// (recipe.autor: "gemma" o "harness"). Con eso cada paso recibe SUS tareas.
//
// Core: no sabe de qué Standard es (no nombra piezas ni pasos). Funciones puras.

export const ASSIGNMENTS_VERSION = "assignments v0.1";

/**
 * Reparte las tareas entre los pasos del Standard según su pieza.
 * @param {Array<{id,task,description,pieza?}>} tasks
 * @param {{pasos:Object<string,string[]>, autor:Object<string,string>}|null} recipe
 * @param {string[]} stepIds  ids de los pasos del Standard, en orden
 * @returns {null | { byStep:Object<string,Task[]>, autorDe:Object<string,string>, sinPieza:Task[], piezaDesconocida:Task[], pasosSinTareas:string[] }}
 *   null = no hay receta o ninguna tarea trae pieza (corrida vieja): el motor sigue como antes (notas).
 */
export function assignByStep(tasks = [], recipe = null, stepIds = []) {
  if (!recipe?.pasos || !tasks.some((t) => t.pieza)) return null;
  const byStep = Object.fromEntries(stepIds.map((id) => [id, []]));
  const sinPieza = [], piezaDesconocida = [];
  for (const t of tasks) {
    if (!t.pieza) { sinPieza.push(t); continue; }
    const pasos = (recipe.pasos[t.pieza] || []).filter((id) => byStep[id]);
    if (!pasos.length) { piezaDesconocida.push(t); continue; }
    for (const id of pasos) byStep[id].push(t);
  }
  // quién construye cada paso: "harness" solo si TODAS las piezas que lo alimentan son del harness
  // (14/10: el contrato recibe también las tareas de controles para declararlas, y lo sigue escribiendo Gemma)
  const autorDe = {};
  for (const [pieza, pasos] of Object.entries(recipe.pasos))
    for (const id of pasos) if (byStep[id]) { const a = recipe.autor?.[pieza] || "gemma"; autorDe[id] = autorDe[id] === undefined ? a : (autorDe[id] === "harness" && a === "harness" ? "harness" : "gemma"); }
  return { byStep, autorDe, sinPieza, piezaDesconocida, pasosSinTareas: stepIds.filter((id) => !byStep[id].length) };
}

/** Bloque para el pedido de un paso: las tareas que le tocan. Vacío si no hay. */
export function assignmentText(list = []) {
  if (!list.length) return "";
  const lines = list.map((t) => `- ${t.id} ${String(t.task || "").trim()}${t.description ? ` — ${String(t.description).trim()}` : ""}`);
  return `TAREAS DE ESTE PASO (las armó el Atomizer para este proyecto; este paso las cumple):\n${lines.join("\n")}\nSi una tarea choca con el pedido del paso, manda el pedido del paso.`;
}

/** Resumen corto para el log: "contrato 4 · logica 7 · …". */
export function assignmentSummary(a) {
  if (!a) return "sin piezas (las tareas van como notas, como antes)";
  const parts = Object.entries(a.byStep).map(([id, l]) => `${id} ${l.length}${a.autorDe[id] === "harness" ? " (harness)" : ""}`);
  const extra = [a.sinPieza.length && `sin pieza ${a.sinPieza.length}`, a.piezaDesconocida.length && `pieza desconocida ${a.piezaDesconocida.length}`].filter(Boolean);
  return parts.join(" · ") + (extra.length ? ` · ⚠ ${extra.join(", ")}` : "");
}
