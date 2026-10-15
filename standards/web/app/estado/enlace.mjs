// standards/web/app/estado/enlace.mjs — paso ENLACE: qué acción del contrato hace cada Atomic Task (v0.1, 14/10).
//
// Punto 9, paso 3 (decisión de Miche, 14/10: "seguimos con el paso enlace"). Validation da veredicto por
// tarea, y para eso necesita saber qué acción hace cada tarea de lógica y de controles. Pedirlo DENTRO del
// contrato lo rompió (build 2026-10-14T22-19-17: 18 tareas más, respuesta cortada, contrato de 3 acciones).
// Por eso va en un pedido aparte, chico, al final: si falla, se pierde solo el veredicto por tarea, no el build.
//
// Entrada: los nombres de las acciones del contrato (con su "hace") y las tareas "logica" y "controles".
// Salida de Gemma: { "<accion>": ["<id>", …], "ninguna": ["<id>", …] }. Toda tarea va UNA vez.
// El harness lo valida: acciones que no existen, ids que no son tareas, tareas sin ubicar o repetidas.
//
// OJO (epistemología): el enlace es una AFIRMACIÓN de Gemma, no evidencia. La evidencia sigue siendo la de
// la acción (pruebas de lógica, compuerta de llamadas). Un enlace mal hecho se ve comparando el título de
// la tarea con la acción (queda escrito en enlace.json y en el veredicto).

export const ENLACE_VERSION = "enlace v0.1";
/** Piezas de la receta que se hacen con una acción del contrato (las demás no tienen acción). */
export const ENLACE_PIEZAS = Object.freeze(["logica", "controles"]);
export const NINGUNA = "ninguna";

/** Las tareas que van al enlace (las que tienen pieza logica o controles). */
export const linkTasksOf = (tasks = []) => tasks.filter((t) => ENLACE_PIEZAS.includes(t.pieza));

const FMT = `{
  "borrarNota": ["T2.3", "T2.4"],
  "moverNota": ["T3.1"],
  "${NINGUNA}": ["T3.2"]
}`;

/** Pedido a Gemma (chico: sin brief ni contrato completo). */
export function enlacePrompt(contract, tasks, paso = "") {
  const acc = contract.acciones.map((a) => `- ${a.nombre}: ${a.hace || ""}`.trimEnd()).join("\n");
  const ts = tasks.map((t) => `- ${t.id} [${t.pieza}] ${String(t.task || "").trim()}`).join("\n");
  return `${paso ? paso + ": " : ""}ENLACE. Decí qué acción de la app hace cada tarea. No escribas código.

ACCIONES DE LA APP:
${acc}

TAREAS:
${ts}

Cada tarea va en la lista de la acción que la hace. Si ninguna acción la hace, va en "${NINGUNA}".
Cada tarea aparece UNA sola vez. Usá los nombres de acción y los ids tal cual.
Formato (es un ejemplo de la forma, no de esta app):
### FILE: enlace.json
\`\`\`json
${FMT}
\`\`\``;
}

/**
 * Valida la respuesta. Nunca inventa: lo que no se reconoce queda informado.
 * @returns {{error?:string, items:Array<{enlace:Object<string,string[]>, ninguna:string[]}>, reports:Array, dropped:string[]}}
 */
export function parseLinks(json, contract, tasks) {
  if (!json || typeof json !== "object" || Array.isArray(json)) return { error: 'enlace.json tiene que ser un objeto {"<accion>": ["<id>", …]}.', items: [], reports: [], dropped: [] };
  const names = new Set(contract.acciones.map((a) => a.nombre));
  const ids = new Set(tasks.map((t) => t.id));
  const lower = Object.fromEntries([...names].map((n) => [n.toLowerCase(), n]));
  const enlace = Object.fromEntries([...names].map((n) => [n, []]));
  const ninguna = [], accionesDesconocidas = [], idsDesconocidos = [], visto = {};
  for (const [k0, v] of Object.entries(json)) {
    const k = String(k0).trim();
    const dest = k.toLowerCase() === NINGUNA ? NINGUNA : names.has(k) ? k : lower[k.toLowerCase()] || null;
    if (!dest) { accionesDesconocidas.push(k); continue; }
    for (const x of [].concat(v ?? [])) {
      const id = String(x).trim().split(/\s/)[0];
      if (!ids.has(id)) { idsDesconocidos.push(id); continue; }
      (visto[id] ||= []).push(dest);
      const list = dest === NINGUNA ? ninguna : enlace[dest];
      if (!list.includes(id)) list.push(id);
    }
  }
  const ubicadas = Object.keys(visto);
  if (!ubicadas.length) return { error: `enlace.json no ubica ninguna tarea${accionesDesconocidas.length ? ` (acciones que no existen: ${accionesDesconocidas.slice(0, 4).join(", ")})` : ""}.`, items: [], reports: [], dropped: [] };
  const report = {
    total: tasks.length,
    faltan: tasks.map((t) => t.id).filter((id) => !visto[id]),
    repetidas: ubicadas.filter((id) => new Set(visto[id]).size > 1),
    accionesSinTareas: [...names].filter((n) => !enlace[n].length),
    accionesDesconocidas, idsDesconocidos: [...new Set(idsDesconocidos)],
  };
  // para el veredicto por tarea (Validation lo lee del resumen del paso, sin abrir archivos)
  report.porTarea = actionsByTask({ enlace });
  report.ninguna = [...ninguna];
  return { items: [{ enlace, ninguna }], reports: [report], dropped: [] };
}

/** Problemas que se le devuelven a Gemma (no rompen: se reintenta y se queda el mejor). */
export function linkProblems(report) {
  const out = [];
  if (report.faltan.length) out.push(`faltan estas tareas: ${report.faltan.join(", ")}. Poné cada una en la acción que la hace, o en "${NINGUNA}".`);
  if (report.repetidas.length) out.push(`estas tareas están en más de una lista: ${report.repetidas.join(", ")}. Cada tarea va en UNA sola.`);
  if (report.accionesDesconocidas.length) out.push(`estas acciones no existen: ${report.accionesDesconocidas.join(", ")}. Usá solo: los nombres de ACCIONES DE LA APP, o "${NINGUNA}".`);
  if (report.idsDesconocidos.length) out.push(`estos ids no son tareas: ${report.idsDesconocidos.join(", ")}.`);
  // acciones sin tareas NO es problema: puede pasar de verdad (el Atomizer no armó tarea para esa acción)
  return out;
}
const scoreOf = (r) => r.faltan.length * 2 + r.repetidas.length * 2 + r.idsDesconocidos.length + r.accionesDesconocidas.length;

/** De todos los intentos, el enlace con menos problemas. */
export function bestLinks(items, reports) {
  let b = 0;
  reports.forEach((r, i) => { if (scoreOf(r) < scoreOf(reports[b])) b = i; });
  return b;
}

/** "enlace: 13/13 tareas ubicadas · 6/6 acciones con tareas · ninguna: F3.2" */
export function linksSummary(item, report) {
  const total = report.total, ub = total - report.faltan.length;
  const nAcc = Object.keys(item.enlace).length;
  return `enlace: ${ub}/${total} tareas ubicadas · ${nAcc - report.accionesSinTareas.length}/${nAcc} acciones con tareas${item.ninguna.length ? ` · ${NINGUNA}: ${item.ninguna.join(", ")}` : ""}${report.repetidas.length ? ` · en varias: ${report.repetidas.join(", ")}` : ""}${report.faltan.length ? ` · sin ubicar: ${report.faltan.join(", ")}` : ""}`;
}

/** { tareaId: [accion…] } para el veredicto por tarea. */
export function actionsByTask(item) {
  const out = {};
  for (const [a, l] of Object.entries(item?.enlace || {})) for (const id of l) (out[id] ||= []).push(a);
  return out;
}
