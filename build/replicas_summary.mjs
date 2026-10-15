// build/replicas_summary.mjs — compara N corridas del mismo snapshot (p48, 15/10). Funciones puras.
//
// Por qué: a temperatura 0, repetir un build da lo mismo byte a byte (builds 2026-10-15T02-27-10, 03-49-43 y
// 11-31-58: contrato, lógica, CSS y enlace idénticos). Eso no es n=3, es n=1 repetido. Una réplica tiene que
// poder salir distinta (temperatura > 0, seed distinto) y el resumen tiene que decir si de verdad salió distinta.
//
// Entrada por corrida: { dir, evidence, build } (evidence.json y build.json de la corrida).
// Salida: por requisito, por tarea y por paso, cuántas corridas dieron qué; y cuántas versiones distintas hubo
// de cada archivo (huella). Si todas las huellas son iguales, lo dice: no son réplicas.

export const REPLICAS_VERSION = "replicas v0.1";

const tally = (list) => list.reduce((m, x) => ({ ...m, [x]: (m[x] || 0) + 1 }), {});
const fmt = (t, n) => Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}/${n}`).join(" · ");

export function summarizeReplicas(runs = []) {
  const n = runs.length;
  const sampling = runs.map((r) => r.evidence?.muestreo || { temperature: 0, seed: null });
  // por requisito
  const reqIds = [...new Set(runs.flatMap((r) => (r.evidence?.coverage || []).map((c) => c.id)))];
  const requisitos = reqIds.map((id) => {
    const vs = runs.map((r) => (r.evidence?.coverage || []).find((c) => c.id === id)?.verdict || "—");
    const text = runs.map((r) => (r.evidence?.coverage || []).find((c) => c.id === id)?.text).find(Boolean) || "";
    return { id, text, veredictos: vs, cuenta: tally(vs) };
  });
  // por tarea
  const taskIds = [...new Set(runs.flatMap((r) => (r.evidence?.task_verdicts?.rows || []).map((x) => x.id)))];
  const tareas = taskIds.map((id) => {
    const rows = runs.map((r) => (r.evidence?.task_verdicts?.rows || []).find((x) => x.id === id));
    const vs = rows.map((x) => x?.verdict || "—");
    return { id, pieza: rows.find(Boolean)?.pieza || null, veredictos: vs, cuenta: tally(vs) };
  });
  // por paso (intentos y si quedó roto)
  const stepIds = [...new Set(runs.flatMap((r) => (r.build?.specialist?.steps || []).map((s) => s.task_id)))];
  const pasos = stepIds.map((id) => {
    const ss = runs.map((r) => (r.build?.specialist?.steps || []).find((s) => s.task_id === id));
    return { id, intentos: ss.map((s) => (s ? s.attempts?.length ?? null : null)), rotos: ss.filter((s) => s?.broken).length, por: ss.find(Boolean)?.by || "modelo" };
  });
  // huellas: cuántas versiones distintas de cada archivo
  const files = [...new Set(runs.flatMap((r) => Object.keys(r.evidence?.huella || {})))];
  const archivos = files.map((f) => {
    const hs = runs.map((r) => r.evidence?.huella?.[f] || null);
    return { archivo: f, versiones: new Set(hs.filter(Boolean)).size, sinHuella: hs.filter((h) => !h).length };
  });
  const conHuella = runs.filter((r) => r.evidence?.huella && Object.keys(r.evidence.huella).length).length;
  const identicas = n > 1 && conHuella === n && archivos.every((a) => a.versiones === 1);
  const totales = runs.map((r) => ({ dir: r.dir, ...(r.evidence?.summary || {}), tareas: r.evidence?.task_verdicts?.counts || null }));
  return { version: REPLICAS_VERSION, n, sampling, identicas, conHuella, requisitos, tareas, pasos, archivos, totales };
}

/** Texto para la consola y resumen.md. */
export function replicasText(s) {
  const L = [];
  L.push(`# Réplicas (${s.version}): ${s.n} corrida(s)`);
  L.push(`muestreo: ${s.sampling.map((m) => `t=${m.temperature}${m.seed != null ? ` seed ${m.seed}` : ""}`).join(" | ")}`);
  if (s.identicas) L.push(`⚠ las ${s.n} corridas dieron los MISMOS archivos (huella igual): no son réplicas, es una muestra repetida.`);
  else if (s.conHuella < s.n) L.push(`~ ${s.n - s.conHuella} corrida(s) sin huella (anteriores a p48): no se puede saber si salieron distintas.`);
  L.push("", "## Archivos (versiones distintas entre corridas)");
  for (const a of s.archivos) L.push(`- ${a.archivo}: ${a.versiones} de ${s.n}${a.sinHuella ? ` (${a.sinHuella} sin huella)` : ""}`);
  L.push("", "## Requisitos");
  for (const r of s.requisitos) L.push(`- ${r.id} ${r.text.slice(0, 50)}: ${fmt(r.cuenta, s.n)}`);
  L.push("", "## Pasos (intentos por corrida)");
  for (const p of s.pasos) L.push(`- ${p.id}${p.por === "harness" ? " (harness)" : ""}: ${p.intentos.map((x) => x ?? "—").join(", ")}${p.rotos ? ` · roto en ${p.rotos}/${s.n}` : ""}`);
  if (s.tareas.length) {
    L.push("", "## Tareas (solo las que no dieron lo mismo en todas)");
    const varia = s.tareas.filter((t) => Object.keys(t.cuenta).length > 1);
    if (!varia.length) L.push("- todas dieron el mismo veredicto en todas las corridas");
    for (const t of varia) L.push(`- ${t.id} [${t.pieza}]: ${fmt(t.cuenta, s.n)}`);
  }
  L.push("", "## Totales por corrida");
  for (const x of s.totales) L.push(`- ${x.dir}: PASS ${x.PASS ?? "?"} · FAIL ${x.FAIL ?? "?"} · SIN_EVIDENCIA ${x.SIN_EVIDENCIA ?? "?"}${x.tareas ? ` · tareas CUMPLIDA ${x.tareas.CUMPLIDA || 0} / NO_CUMPLIDA ${x.tareas.NO_CUMPLIDA || 0} / SIN_EVIDENCIA ${x.tareas.SIN_EVIDENCIA || 0}` : ""}`);
  return L.join("\n");
}
