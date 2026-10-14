// build/recipe_metrics.mjs — cómo medimos si la receta del Standard mejora las tareas
// del Atomizer (punto 9, 14/10). Funciones puras: las usa build/recipe_bench.mjs y
// las prueba build/test_recipe_metrics.mjs. No juzga si la tarea está "bien": cuenta
// señales que ya vimos fallar en corridas reales (Project23, Kanban 12/10).

export const RECIPE_METRICS_VERSION = "recipe_metrics v0.1";

// "X o Y", "etc.", "por ejemplo", "y/o", "A/B": decisiones que quedan abiertas para el Specialist.
// "uno o más" / "o no" son frases, no dos caminos: no cuentan.
// (\p{L} y no \w: "botón" tiene tilde.)
const ALT = /(?<![\p{L}\d])(?!(?:uno|una|dos|más|no)(?![\p{L}\d]))[\p{L}\d]{3,}\s+o\s+(?!(?:más|no)(?![\p{L}\d]))[\p{L}\d]{3,}|(?<![\p{L}])y\/o(?![\p{L}])|(?<![\p{L}])etc(?![\p{L}])\.?|por ejemplo|(?<![\p{L}])ej\.\s|(?<![\p{L}])\p{L}{3,}\/\p{L}{3,}/giu;
// Trabajo que en el Standard web/app/estado hace el harness solo (controles.js, acciones.js).
const HARNESS = /\bmodal(es)?\b|\bformulario(s)?\b|event ?listener|addEventListener|manejador(es)? de eventos?|\bcablear\b|conectar (los )?botones|eventos? (de )?click/gi;
// Campos sin nombre: el Specialist tiene que adivinar cuáles son.
const VAGUE = /\bmetadat(a|os)\b|\bplaceholders?\b|información adicional|\bdetalles\b|\binformación\b/gi;
// Verbos de acciones distintas: dos o más en una tarea = mezcla acciones.
const ACTIONS = {
  crear: /\b(crear|añadir|agregar|alta)\b/i,
  editar: /\b(editar|modificar|actualizar)\b/i,
  borrar: /\b(borrar|eliminar|quitar)\b/i,
  mover: /\b(mover|mueve|movimiento|arrastrar|reordenar)\b/i,
};

const hits = (re, text) => [...String(text).matchAll(re)].map((m) => m[0].trim());

/** Señales de UNA tarea. piezas = claves válidas de la receta (o null si no hay receta). */
export function taskSignals(t, piezas = null) {
  const text = `${t.task || ""}. ${t.description || ""}`;
  const actions = Object.entries(ACTIONS).filter(([, re]) => re.test(text)).map(([k]) => k);
  const s = {
    id: t.id,
    alternativas: hits(ALT, text),
    harness: hits(HARNESS, text),
    vagos: hits(VAGUE, text),
    acciones: actions,
    mezcla: actions.length >= 2,
  };
  if (piezas) s.pieza = piezas.includes(t.pieza) ? t.pieza : null;
  return s;
}

/** Resumen de una corrida (todas las fases de una condición). */
export function summarize(tasks, piezas = null) {
  const sig = tasks.map((t) => taskSignals(t, piezas));
  const n = sig.length;
  const count = (f) => sig.filter(f).length;
  const out = {
    tareas: n,
    con_alternativas: count((s) => s.alternativas.length),
    con_trabajo_del_harness: count((s) => s.harness.length),
    con_campos_vagos: count((s) => s.vagos.length),
    mezclan_acciones: count((s) => s.mezcla),
  };
  if (piezas) {
    out.pieza_valida = count((s) => s.pieza);
    out.por_pieza = Object.fromEntries(piezas.map((p) => [p, count((s) => s.pieza === p)]));
  }
  // problemas = tareas con al menos una señal (una tarea cuenta una vez)
  out.tareas_con_problema = count((s) => s.alternativas.length || s.harness.length || s.vagos.length || s.mezcla || (piezas && !s.pieza));
  return { resumen: out, tareas: sig };
}

/** Tabla corta para la consola: una fila por métrica, una columna por condición. */
export function compareTable(byCond) {
  const conds = Object.keys(byCond);
  const keys = [...new Set(conds.flatMap((c) => Object.keys(byCond[c]).filter((k) => typeof byCond[c][k] === "number")))];
  const w = Math.max(...keys.map((k) => k.length));
  const head = `${"".padEnd(w)}  ${conds.map((c) => c.padStart(6)).join("  ")}`;
  const rows = keys.map((k) => `${k.padEnd(w)}  ${conds.map((c) => String(byCond[c][k] ?? "-").padStart(6)).join("  ")}`);
  return [head, ...rows].join("\n");
}
