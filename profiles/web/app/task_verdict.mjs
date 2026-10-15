// profiles/web/app/task_verdict.mjs — veredicto de Validation POR TAREA (punto 9, paso 3, 14/10).
//
// Decisión de Miche: "Validation da veredicto por tarea". Solo con evidencia que ya existe, sin LLM:
//   - el contrato declara en cada acción qué tareas hace ("cumple", Standard web/app/estado v0.5);
//   - tarea de lógica: CUMPLIDA si las pruebas de lógica de su acción pasan y la compuerta muestra que
//     la acción se usa desde la pantalla; NO_CUMPLIDA si algo de eso falla (con el motivo);
//   - tarea de controles (la arma el harness): CUMPLIDA si la compuerta dispara su acción desde la pantalla;
//   - datos, vista, estilo: SIN_EVIDENCIA ("no hay prueba propia"). Que Gemma cite el id en un comentario
//     es trazabilidad, no evidencia.
// v0.2 (14/10): la relación tarea→acción sale del paso ENLACE (Standard web/app/estado v0.6: links =
//   { porTarea: {id: [accion]}, ninguna: [id] }); el "cumple" del contrato se sigue leyendo si viene.
//   El enlace es lo que dice Gemma (trazabilidad); la evidencia sigue siendo la de la acción.
// Funciones puras: la página y los pasos ya corrieron; esto solo cruza resultados.

export const TASK_VERDICT_VERSION = "task_verdict v0.2";
const PROBADAS = new Set(["logica", "controles"]);
// v0.2: los controles que arma el harness son BOTONES (Standard web/app/estado). Una tarea de controles que pide
// arrastrar o teclado no queda probada porque el botón de su acción ande (el Standard: "arrastrar y teclado no se prueban").
const NO_PROBADO = /arrastr|drag|solt(ar|ando)|drop|teclad|tecla|atajo/i;

/** Las pruebas de lógica de una acción (las de acceptance se llaman "<accion> …" o "<accion>: …"). */
function testsOf(acceptance, nombre) {
  const mine = (list) => (list || []).filter((n) => String(n).startsWith(nombre + " ") || String(n).startsWith(nombre + ":"));
  return { passed: mine(acceptance?.passed), failed: mine(acceptance?.failed) };
}

/**
 * @param {{ tasks: Array<{id,task,pieza?}>, contract: {acciones:Array<{nombre,tareas?}>}|null,
 *           acceptance: {passed:string[], failed:string[]}|null, gateRows: Array<{nombre,called,problem}>|null }} x
 * @returns {{ version, rows: Array<{id, pieza, task, verdict, accion?, reason}>, counts, desconocidas:string[], enVariasAcciones:string[] }}
 */
export function taskVerdicts({ tasks = [], contract = null, links = null, acceptance = null, gateRows = null }) {
  const acciones = contract?.acciones || [];
  const ids = new Set(tasks.map((t) => t.id));
  const deTarea = {};
  for (const a of acciones) for (const id of a.cumple || a.tareas || []) (deTarea[id] ||= []).push(a.nombre);
  for (const [id, as] of Object.entries(links?.porTarea || {})) for (const n of as) if (!(deTarea[id] ||= []).includes(n)) deTarea[id].push(n);
  const ninguna = new Set(links?.ninguna || []);
  const desconocidas = Object.keys(deTarea).filter((id) => !ids.has(id));
  const enVariasAcciones = Object.keys(deTarea).filter((id) => ids.has(id) && deTarea[id].length > 1);
  const gate = Object.fromEntries((gateRows || []).map((r) => [r.nombre, r]));

  const rows = tasks.map((t) => {
    const base = { id: t.id, pieza: t.pieza || null, task: t.task };
    if (!t.pieza) return { ...base, verdict: "SIN_EVIDENCIA", reason: "la tarea no trae pieza" };
    if (!PROBADAS.has(t.pieza)) return { ...base, verdict: "SIN_EVIDENCIA", reason: `no hay prueba propia para una tarea de ${t.pieza}` };
    const names = deTarea[t.id] || [];
    if (t.pieza === "controles" && NO_PROBADO.test(`${t.task || ""} ${t.description || ""}`))
      return { ...base, verdict: "SIN_EVIDENCIA", ...(names.length ? { accion: names.join(", ") } : {}), reason: "pide arrastrar o teclado: el harness arma botones y eso no se prueba" };
    if (!names.length) return { ...base, verdict: "SIN_EVIDENCIA", reason: ninguna.has(t.id) ? "el enlace dice que ninguna acción de la app la hace" : links ? "el enlace no la ubicó en ninguna acción" : "no hay enlace tarea→acción (el paso enlace no corrió o falló)" };
    const why = [], ok = [];
    for (const nombre of names) {
      const g = gate[nombre];
      if (t.pieza === "logica") {
        const tt = testsOf(acceptance, nombre);
        if (!acceptance) why.push(`${nombre}: no hubo pruebas de lógica`);
        else if (tt.failed.length) why.push(`${nombre}: fallan ${tt.failed.length} prueba(s) de lógica (${tt.failed[0]})`);
        else if (!tt.passed.length) why.push(`${nombre}: no tiene pruebas de lógica`);
        else ok.push(`${nombre}: ${tt.passed.length} pruebas de lógica`);
      }
      if (!gateRows) why.push(`${nombre}: no corrió la compuerta de llamadas`);
      else if (!g) why.push(`${nombre}: no está en la compuerta`);
      else if (g.problem || !g.called) why.push(`${nombre}: ${g.problem || "no se llama desde la pantalla"}`);
      else ok.push(`${nombre}: se usa desde la pantalla`);
    }
    return why.length
      ? { ...base, verdict: "NO_CUMPLIDA", accion: names.join(", "), reason: why.join("; ") }
      : { ...base, verdict: "CUMPLIDA", accion: names.join(", "), reason: ok.join("; ") };
  });
  const counts = rows.reduce((c, r) => ({ ...c, [r.verdict]: (c[r.verdict] || 0) + 1 }), {});
  return { version: TASK_VERDICT_VERSION, rows, counts, desconocidas, enVariasAcciones };
}

/** Líneas para la consola. */
export function taskVerdictLines(v) {
  const pad = (s, n) => String(s).padEnd(n);
  const lines = v.rows.map((r) => `${pad(r.verdict, 14)}${pad(r.id, 7)}[${r.pieza || "?"}] ${String(r.task || "").slice(0, 70)}${r.reason ? `\n${" ".repeat(21)}${r.verdict === "CUMPLIDA" ? "✓" : r.verdict === "NO_CUMPLIDA" ? "✗" : "~"} ${r.reason}` : ""}`);
  if (v.desconocidas.length) lines.push(`⚠ el contrato nombra tareas que no existen: ${v.desconocidas.join(", ")}`);
  if (v.enVariasAcciones.length) lines.push(`⚠ tareas declaradas en más de una acción: ${v.enVariasAcciones.join(", ")}`);
  return lines;
}

export const taskVerdictSummary = (v) => ["CUMPLIDA", "NO_CUMPLIDA", "SIN_EVIDENCIA"].map((k) => `${k} ${v.counts[k] || 0}`).join(" · ");
