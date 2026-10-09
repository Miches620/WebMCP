// build.mjs — contrato con build/run_build.mjs para el profile web/game.
// Plan, traductor y Validation como web/app (una pantalla). v0.9 (06/10): el Specialist corre
// el motor general por archivos (harness/files_engine.mjs) con el Standard que declara el
// profile (standards/web/game/grilla, DRAFT). Antes el contrato de Boxworld vivía en el harness.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { makeScreenBuild } from "../app/build.mjs";
import { buildFiles, baselinePage } from "../../../harness/files_engine.mjs";
import { getStandard } from "../../../standards/registry.mjs";
import profile from "./profile.mjs";
import { loadRole } from "../../../roles/registry.mjs";
import { GAME_TRANSLATOR } from "./translator_rules.mjs";
import { GAME_SPECIALIST_RULES } from "./specialist_rules.mjs";

// paso 2 (06/10): Validation profile web → web/app → web/game, que LEE el Standard que declara el
// profile (el mismo que siguió el Specialist). No copia el contrato: lo lee.
import { validationFor, CATALOG_VERSION } from "../validation/check_catalog.mjs";
export { CATALOG_VERSION };
const V = validationFor(["web", "web/app", "web/game"], { standard: getStandard(profile.standard) });
export const { runChecks, normalizeCheck } = V;
export const validationProfile = V.ids;
export const validationAlways = V.always;
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
export const { planPage, translateRequirement, specialistSees } = GAME;

// v0.3.1 (Boxworld b10): click_changes sobre el botón de reiniciar es un chequeo mal elegido:
// recién cargado, reiniciar NO tiene que cambiar nada (b10 R1: FAIL falso "clic Reiniciar →
// no cambia nada", con reset_restores PASS en el mismo requisito). Se cambia por reset_restores.
const RESET = /reinici|reset|volver a empezar|empezar de nuevo/i;
const PIECE = /^(el |la |un |una )?(avatar|jugador|personaje|operario|caja|cajas|pieza|piezas|nivel|niveles|tablero|mapa)$/i;
const words = (c) => [].concat(c?.params?.click || []).map(String);
// paso 2 (b14): "próximo / siguiente nivel" en el texto del requisito → game_scenario aunque el
// traductor no lo haya elegido (b14: Qwen lo puso en R1 y no en R2, que es el que lo pide). Lo
// decide el código, no el modelo.
const NEXT_LEVEL = /(proximo|próximo|siguiente)\s+nivel|avanzar\s+de\s+nivel/i;
export function postprocessChecks(checks = [], _id, text = "") {
  if (NEXT_LEVEL.test(text) && !checks.some((x) => x?.type === "game_scenario")) checks = [...checks, { type: "game_scenario", params: {} }];
  const out = [];
  for (const c of checks) {
    // 08/10 (Boxworld sin y con Skills): click_changes con "avatar" → FAIL falso en R1 las dos veces. El
    // avatar, el jugador o una caja no son botones: ese chequeo no aplica y se saca (no se reemplaza).
    if (c?.type === "click_changes" && words(c).length && words(c).every((w) => PIECE.test(w))) continue;
    if (c?.type === "click_changes" && words(c).some((w) => RESET.test(w))) {
      if (!checks.some((x) => x?.type === "reset_restores") && !out.some((x) => x?.type === "reset_restores")) out.push({ type: "reset_restores", params: { click: words(c) } });
      continue;
    }
    out.push(c);
  }
  return out;
}

// v0.8 (06/10, decisión de Miche): el juego se escribe POR ARCHIVOS, un archivo por paso de
// Gemma. --legacy-components vuelve al componente único de v0.7.6 (todo el juego en una respuesta).
export function build(input, outDir, opts = {}) {
  if (opts.legacyComponents || process.argv.includes("--legacy-components")) return GAME.build(input, outDir, opts);
  return (async () => {
    // paso 3 (07/10): --skills suma las Skills del Role (DRAFT) a cada paso de su clase. Sin el
    // flag el pedido a Gemma es idéntico al de antes (así se mide con y sin).
    const withSkills = opts.skills ?? process.argv.includes("--skills");
    const role = withSkills ? await loadRole(profile.role) : null;
    const skills = role ? { role: role.id, status: role.status, list: role.skills } : null;
    return buildFiles(input, outDir, { ...opts, skills, standard: getStandard(profile.standard) });
  })();
}
export function writeBaseline(baselineDir, input, basePlan, specialist) {
  if (!specialist?.standard) return GAME.writeBaseline(baselineDir, input, basePlan, specialist);
  writeFileSync(join(baselineDir, "index.html"), baselinePage(input.refined, basePlan, getStandard(specialist.standard.id)), "utf8");
}
