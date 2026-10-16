// build/snapshot_auto.mjs — snapshot automático del estado de webmcp al aprobar el graph (16/10).
//
// Antes: Miche abría la consola, copy(localStorage.getItem("webmcp_state")), pegaba en un .json del escritorio
// y se lo pasaba a run_build. Ahora, cuando el graph queda aprobado (sin errores, aprobado sin revisión, o
// seguido con hallazgos), la UI le manda el estado al server y el server lo guarda acá:
//   build/snapshots/auto/<fecha>_<proyecto>.json      (lo mismo que run_build ya lee, + "_snapshot" con el motivo)
// Funciones puras (las usa server.mjs; se prueban con node).

export const SNAPSHOT_AUTO_VERSION = "snapshot_auto v0.1";
export const MOTIVOS = ["aprobado", "aprobado_revision_reintentada", "aprobado_sin_revision", "aprobado_con_hallazgos"];

/** ¿Este estado sirve como snapshot de run_build? Devuelve los problemas (vacío = sirve). */
export function snapshotProblems(state) {
  const p = [];
  if (!state || typeof state !== "object") return ["no llegó el estado"];
  const refined = state.intentForge?.refined_prompt;
  if (!refined || typeof refined !== "object") p.push("falta intentForge.refined_prompt (Intent Forge no terminó)");
  else if (!Array.isArray(refined.features) || !refined.features.length) p.push("el refined_prompt no tiene features");
  if (!Array.isArray(state.atomicTasks) || !state.atomicTasks.length) p.push("no hay atomicTasks (el graph no se generó)");
  return p;
}

/** Nombre del archivo: misma forma que las carpetas de build/runs (fecha + project_name). */
export function snapshotFileName(state, date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = state?.intentForge?.refined_prompt?.project_name || "proyecto";
  const slug = String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "proyecto";
  return `${stamp}_${slug}.json`;
}

/** El contenido que se guarda: el estado tal cual + de dónde salió. */
export function snapshotContent(state, motivo, date = new Date()) {
  if (!MOTIVOS.includes(motivo)) throw new Error(`motivo de snapshot desconocido: "${motivo}" (${MOTIVOS.join(", ")})`);
  return {
    ...state,
    _snapshot: {
      version: SNAPSHOT_AUTO_VERSION,
      motivo,
      fecha: date.toISOString(),
      revisado: motivo === "aprobado" || motivo === "aprobado_revision_reintentada",
      tareas: state.atomicTasks.length,
      features: state.intentForge.refined_prompt.features.length,
    },
  };
}
