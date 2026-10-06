// build.mjs — contrato con build/run_build.mjs para el profile web/game.
// Plan, traductor y Validation como web/app (una pantalla); el Specialist escribe el juego
// por archivos (specialist_files.mjs, v0.8).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeScreenBuild } from "../app/build.mjs";
import { buildGameFiles, baselinePage } from "./specialist_files.mjs";
import { GAME_TRANSLATOR } from "./translator_rules.mjs";
import { GAME_SPECIALIST_RULES } from "./specialist_rules.mjs";

export { runChecks, normalizeCheck, CATALOG_VERSION } from "../validation/check_catalog.mjs";
export { planText, PAGE_PLAN_VERSION } from "../app/page_plan.mjs";

// Chequeo de base del Specialist (con reintento): Boxworld build 3 "ganaba" con el
// primer movimiento y nadie lo vio hasta jugarlo a mano.
// v0.7.1 (Boxworld build 4): board_changes también es de base — el contador subía pero el
// avatar nunca se movía en pantalla (dibujar() no se llamaba después de mover).
export const GAME_EXTRA_CHECKS = [{
  check: { type: "board_changes", params: {} },
  problem: (r) => /no hay tablero/.test(r.detail)
    ? `${r.detail}. El juego tiene que dibujar la grilla (un elemento por casillero) dentro del componente.`
    : `${r.detail}. Después de CADA movimiento (y de reiniciar o cambiar de nivel) llamá a dibujar() para redibujar la grilla desde el estado.`,
}, {
  check: { type: "not_won_immediately", params: {} },
  problem: (r) => /recién cargado/.test(r.detail)
    ? `${r.detail}. En cada nivel, al menos una caja tiene que empezar FUERA de los objetivos (en el formato de strings: $ y . en casilleros distintos).`
    : /ninguna tecla/.test(r.detail)
    ? `${r.detail}. El juego tiene que responder a las flechas (un listener keydown en document) y la grilla tiene que dibujarse desde el estado.`
    : `${r.detail}. La victoria tiene que comparar la posición ACTUAL de cada pieza con sus objetivos, guardados aparte; con el nivel recién cargado o después de un solo movimiento no se puede estar ganando.`,
}];

const GAME = makeScreenBuild({ translator: GAME_TRANSLATOR, systemExtra: GAME_SPECIALIST_RULES, extraChecks: GAME_EXTRA_CHECKS, mainId: "juego" });
export const { planPage, translateRequirement, postprocessChecks, specialistSees } = GAME;

// v0.8 (06/10, decisión de Miche): el juego se escribe POR ARCHIVOS, un archivo por paso de
// Gemma con contrato fijo (specialist_files.mjs). --legacy-components vuelve al componente
// único de v0.7.6 (todo el juego en una respuesta).
export function build(input, outDir, opts = {}) {
  if (opts.legacyComponents || process.argv.includes("--legacy-components")) return GAME.build(input, outDir, opts);
  return buildGameFiles(input, outDir, opts);
}
export function writeBaseline(baselineDir, input, basePlan, specialist) {
  if (!String(specialist?.specialist_version || "").startsWith("game_files")) return GAME.writeBaseline(baselineDir, input, basePlan, specialist);
  writeFileSync(join(baselineDir, "index.html"), baselinePage(input.refined, basePlan), "utf8");
}
