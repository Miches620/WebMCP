// build/recipe_metrics.mjs — cómo medimos si la receta del Standard mejora las tareas
// del Atomizer (punto 9, 14/10). Funciones puras: las usa build/recipe_bench.mjs y
// las prueba build/test_recipe_metrics.mjs. No juzga si la tarea está "bien": cuenta
// señales que ya vimos fallar en corridas reales (Project23, Kanban 12/10).

export const RECIPE_METRICS_VERSION = "recipe_metrics v0.3";
// v0.2 (14/10, leyendo a mano la 1ª corrida con Gemma, fixtures/recipe_bench_2026-10-14.json):
// - "A/B" ya no cuenta como alternativa: "oscuro/industrial" o "Hover/Sombras" son pares, no dos caminos.
//   Se informa aparte ("barras") para mirarlo a mano; "e.g." sí cuenta.
// - "mezcla" mira solo el TÍTULO, cuenta sustantivos (creación, edición…) y no cuenta la maquinaria:
//   "crear el componente", "actualizar el estado / la estructura" no son acciones del usuario.
// - "información (autor, timestamp)" nombra los campos: no es vaga.
// v0.3 (receta v0.3, pieza "controles"): en una tarea "controles" nombrar botón/formulario/modal ES su trabajo
// (lo resuelve el harness): no cuenta como problema. Nuevo: controles_sin_logica = tareas "controles" cuya
// acción no tiene tarea "logica" (el harness no tendría qué disparar).

// "X o Y", "etc.", "por ejemplo", "e.g.", "y/o": decisiones que quedan abiertas para el Specialist.
// "uno o más" / "o no" son frases, no dos caminos: no cuentan.
// (\p{L} y no \w: "botón" tiene tilde.)
const ALT = /(?<![\p{L}\d])(?!(?:uno|una|dos|más|no)(?![\p{L}\d]))[\p{L}\d]{3,}\s+o\s+(?!(?:más|no)(?![\p{L}\d]))[\p{L}\d]{3,}|(?<![\p{L}])y\/o(?![\p{L}])|(?<![\p{L}])etc(?![\p{L}])\.?|por ejemplo|(?<![\p{L}])ej\.\s|(?<![\p{L}])e\.g\./giu;
// "A/B": a veces dos caminos (grid/flex), a veces un par (oscuro/industrial). Se cuenta aparte, no es problema.
const SLASH = /(?<![\p{L}])(?!y\/o)\p{L}{3,}\/\p{L}{3,}/giu;
// Trabajo que en el Standard web/app/estado hace el harness solo (controles.js, acciones.js).
const HARNESS = /\bmodal(es)?\b|\bformulario(s)?\b|event ?listener|addEventListener|manejador(es)? de eventos?|\bcablear\b|conectar (los )?botones|eventos? (de )?click|confirmaci(?:ón|on)/giu;
// Campos sin nombre: el Specialist tiene que adivinar cuáles son.
const VAGUE = /\bmetadat(a|os)\b|\bplaceholders?\b|información adicional|\bdetalles\b|(?<![\p{L}])información(?![\p{L}])(?![^.()]{0,30}\()/giu;
// Acciones del usuario (verbo o sustantivo) en el TÍTULO: dos o más distintas = mezcla acciones.
const W = (alts) => new RegExp(`(?<![\\p{L}])(?:${alts})(?![\\p{L}])`, "iu");
const ACTIONS = {
  crear: W("crear|añadir|agregar|alta|creación|adición"),
  editar: W("editar|modificar|actualizar|edición|modificación|actualización|guardar cambios"),
  borrar: W("borrar|eliminar|quitar|borrado|eliminación"),
  mover: W("mover|mueve|movimiento|arrastrar|arrastre|reordenar|soltado"),
};
// Maquinaria, no acciones del usuario: se saca antes de buscar acciones.
const MACHINERY = /(?<![\p{L}])(?:crear|creación de|añadir|agregar|implementar|desarrollar)\s+(?:el|la|los|las|un|una)?\s*(?:componente|contenedor|wrapper|estilo|elemento visual|vista|estructura|interfaz|bot[oó]n|control|icono|campo)[\p{L}]*|(?<![\p{L}])actualiz[\p{L}]*\s+(?:del?\s+)?(?:el|la|los|las)?\s*(?:estado|vista|ui|interfaz|renderizado|tablero|estructura|pantalla)[\p{L}]*/giu;

/** Acciones del usuario en un texto, sin la maquinaria ("crear el componente", "añadir el botón"). */
export function actionsIn(text) {
  const clean = String(text).replace(MACHINERY, " ");
  return Object.entries(ACTIONS).filter(([, re]) => re.test(clean)).map(([k]) => k);
}

const hits = (re, text) => [...String(text).matchAll(re)].map((m) => m[0].trim());

/** Señales de UNA tarea. piezas = claves válidas de la receta (o null si no hay receta). */
export function taskSignals(t, piezas = null) {
  const text = `${t.task || ""}. ${t.description || ""}`;
  const actions = actionsIn(t.task || "");
  const s = {
    id: t.id,
    alternativas: hits(ALT, text),
    barras: hits(SLASH, text),
    harness: hits(HARNESS, text),
    boton: /(?<![\p{L}])(?:bot[oó]n|botones|icono)(?![\p{L}])/iu.test(text), // solo para vista_con_controles (v0.3)
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
    con_barras: count((s) => s.barras.length),
    con_trabajo_del_harness: count((s) => s.harness.length),
    con_campos_vagos: count((s) => s.vagos.length),
    mezclan_acciones: count((s) => s.mezcla),
  };
  if (piezas) {
    out.pieza_valida = count((s) => s.pieza);
    // Lo que ataca la receta v0.2: tareas "vista" que diseñan controles (los pone el harness).
    out.vista_con_controles = count((s) => s.pieza === "vista" && (s.harness.length || s.boton));
    if (piezas.includes("controles")) {
      // acciones de cada tarea "logica" (por título) vs. las de cada tarea "controles" (título + descripción)
      const logicActs = new Set(sig.filter((s) => s.pieza === "logica").flatMap((s) => s.acciones));
      const ctl = tasks.map((t, i) => [t, sig[i]]).filter(([, s]) => s.pieza === "controles");
      out.controles = ctl.length;
      out.controles_sin_logica = ctl.filter(([t]) => {
        const acts = actionsIn(`${t.task || ""}. ${t.description || ""}`);
        return !acts.some((a) => logicActs.has(a));
      }).length;
    }
    out.por_pieza = Object.fromEntries(piezas.map((p) => [p, count((s) => s.pieza === p)]));
  }
  // problemas = tareas con al menos una señal (una tarea cuenta una vez)
  // en una tarea "controles", nombrar botón/formulario/modal es su trabajo (lo resuelve el harness)
  out.tareas_con_problema = count((s) => s.alternativas.length || (s.harness.length && s.pieza !== "controles") || s.vagos.length || s.mezcla || (piezas && !s.pieza));
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
