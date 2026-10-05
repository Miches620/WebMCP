// build.mjs — contrato con build/run_build.mjs para el profile web/game.
// Mismo armado que web/app (una pantalla) con reglas y chequeos de juego.

import { makeScreenBuild } from "../app/build.mjs";
import { GAME_TRANSLATOR } from "./translator_rules.mjs";
import { GAME_SPECIALIST_RULES } from "./specialist_rules.mjs";

export { runChecks, normalizeCheck, CATALOG_VERSION } from "../validation/check_catalog.mjs";
export { planText, PAGE_PLAN_VERSION } from "../app/page_plan.mjs";

// Chequeo de base del Specialist (con reintento): Boxworld build 3 "ganaba" con el
// primer movimiento y nadie lo vio hasta jugarlo a mano.
export const GAME_EXTRA_CHECKS = [{
  check: { type: "not_won_immediately", params: {} },
  problem: (r) => /ninguna tecla/.test(r.detail)
    ? `${r.detail}. El juego tiene que responder a las flechas (un listener keydown en document) y la grilla tiene que dibujarse desde el estado.`
    : `${r.detail}. La victoria tiene que comparar la posición ACTUAL de cada pieza con sus objetivos, guardados aparte; con el nivel recién cargado o después de un solo movimiento no se puede estar ganando.`,
}];

const GAME = makeScreenBuild({ translator: GAME_TRANSLATOR, systemExtra: GAME_SPECIALIST_RULES, extraChecks: GAME_EXTRA_CHECKS, mainId: "juego" });
export const { planPage, translateRequirement, postprocessChecks, build, writeBaseline, specialistSees } = GAME;
