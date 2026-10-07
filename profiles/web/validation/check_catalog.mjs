// check_catalog.mjs — catálogo COMPLETO de chequeos web (compatibilidad, 06/10 paso 2).
//
// Desde el paso 2 los chequeos viven en un Validation profile por tipo (ver framework.mjs) y cada
// build usa SOLO la cadena de su tipo (web → web/app → web/game, o web → web/landing). Este
// archivo junta todos para lo que todavía necesita la lista entera: el traductor (que igual
// filtra por el catálogo de su profile), los tests viejos y el Specialist de landing.

import web from "./validation_web.mjs";
import landing from "../landing/validation.mjs";
import app from "../app/validation.mjs";
import game from "../game/validation.mjs";
import { composeValidation, specsOf, normalizeCheck as normalizeWith, runChecks as runWith } from "./framework.mjs";
export { keysFrom } from "./lib.mjs";
export { composeValidation, specsOf } from "./framework.mjs";

export const CATALOG_VERSION = "check_catalog v0.9";
// v0.9 (06/10, paso 2): el catálogo se partió en framework + Validation profiles por tipo; los
// chequeos de juego leen el Standard. Sin cambios de conducta en los chequeos que ya existían.

export const VALIDATION_PROFILES = { web, "web/landing": landing, "web/app": app, "web/game": game };
const ORDER = ["no_js_errors", "text_visible", "control_visible", "field_exists", "field_required", "field_optional", "submit_empty_blocked", "valid_submit_passes", "section_content", "section_items", "carousel", "section_control", "no_horizontal_scroll", "hover_changes", "nav_scroll", "reveal_on_scroll", "entrance_animation", "numbers_animate", "sections_visible", "components_render", "key_changes", "board_changes", "game_levels", "moves_one_cell", "fixed_map_size", "click_changes", "counter_on_action", "not_won_immediately", "reset_restores", "click_reveals"];
const ALL = composeValidation([web, landing, app, game]);
// mismo orden que el catálogo de antes (el traductor lista los tipos en este orden)
export const REGISTRY = Object.fromEntries([...ORDER.filter((t) => ALL[t]), ...Object.keys(ALL).filter((t) => !ORDER.includes(t))].map((t) => [t, ALL[t]]));
export const CATALOG = specsOf(REGISTRY);
export const normalizeCheck = (c) => normalizeWith(c, CATALOG);
/** Corre chequeos con TODOS los Validation profiles (compatibilidad). opts.env.standard: el Standard que siguió el Specialist. */
export const runChecks = (htmlPath, checks, opts = {}) => runWith(htmlPath, checks, { registry: REGISTRY, ...opts });

/** Validation profile de un tipo: cadena de profiles (de la plataforma a la hoja) → { registry, catalog, runChecks, normalizeCheck }. */
export function validationFor(chainIds, env = {}) {
  const chain = chainIds.map((id) => VALIDATION_PROFILES[id]).filter(Boolean);
  const registry = composeValidation(chain);
  const catalog = specsOf(registry);
  return { ids: chain.map((p) => p.id), registry, catalog, env, always: chain.flatMap((p) => p.always || []),
    runChecks: (htmlPath, checks) => runWith(htmlPath, checks, { registry, env }),
    normalizeCheck: (c) => normalizeWith(c, catalog) };
}
