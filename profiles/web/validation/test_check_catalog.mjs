// test_check_catalog.mjs — el catálogo sobre los fixtures del piloto, con chequeos escritos a mano.
//   node validation/test_check_catalog.mjs
import { fileURLToPath } from "node:url";
import { runChecks, normalizeCheck, keysFrom, validationFor, VALIDATION_PROFILES } from "./check_catalog.mjs";
import GRILLA from "../../../standards/web/game/grilla/standard.mjs";
import { readFileSync } from "node:fs";

const F = (n) => fileURLToPath(new URL(`../../../pilot/fixtures/${n}.html`, import.meta.url));
const CHECKS = [
  { type: "no_js_errors", params: {} },
  { type: "field_exists", params: { field: ["preferencia"] } },
  { type: "field_optional", params: { field: ["preferencia"] } },
  { type: "submit_empty_blocked", params: {} },
  { type: "valid_submit_passes", params: {} },
].map(normalizeCheck);
// esperado por fixture, en el orden de CHECKS
const CASES = {
  ok_html5: "PPPPP", ok_js: "PPPPP", alert_js: "PPPPP",
  sin_preferencias: "PFFPP", pref_obligatorio: "PPFPP", todo_opcional: "PPPFP",
  error_js: "FPPPP", sin_form: "PFFFF",
};
let ok = 0, fail = 0;
for (const [name, exp] of Object.entries(CASES)) {
  const r = await runChecks(F(name), CHECKS);
  const got = r.map((x) => x.result[0]).join("");
  if (got === exp) { ok++; console.log(`✓ ${name} ${got}`); }
  else { fail++; console.log(`✗ ${name} esperado ${exp} dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`); }
}
// v0.3: chequeos de sección (validation/fixtures/sections_*.html)
const S = (n) => fileURLToPath(new URL(`./fixtures/${n}.html`, import.meta.url));
const SEC = [
  { type: "section_items", params: { section: ["catalogo"] } },
  { type: "carousel", params: { section: ["catalogo"] } },
  { type: "section_content", params: { section: ["nosotros"] } },
  { type: "section_items", params: { section: ["carta"] } },
].map(normalizeCheck);
const SEC_CASES = { sections_ok: "PPPP", sections_grid: "PFFF", sections_vacio: "FFFF", sections_carga_lenta: "FFFP" };
for (const [name, exp] of Object.entries(SEC_CASES)) {
  const r = await runChecks(S(name), SEC);
  const got = r.map((x) => x.result[0]).join("");
  if (got === exp) { ok++; console.log(`✓ ${name} ${got}`); }
  else { fail++; console.log(`✗ ${name} esperado ${exp} dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`); }
}

// v0.4: chequeos transversales / de interacción
const TV = [
  { type: "no_horizontal_scroll", params: {} },
  { type: "hover_changes", params: { elementos: ["boton", "tarjeta"] } },
  { type: "nav_scroll", params: {} },
  { type: "reveal_on_scroll", params: {} },
  { type: "entrance_animation", params: { section: ["inicio"] } },
  { type: "numbers_animate", params: { section: ["datos"] } },
  { type: "section_control", params: { section: ["inicio"] } },
].map(normalizeCheck);
for (const [name, exp] of Object.entries({ transversal_ok: "PPPPPPP", transversal_mal: "FFFFFFF" })) {
  const r = await runChecks(S(name), TV);
  const got = r.map((x) => x.result[0]).join("");
  if (got === exp) { ok++; console.log(`✓ ${name} ${got}`); }
  else { fail++; console.log(`✗ ${name} esperado ${exp} dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`); }
}

// v0.5: sections_visible (base) — controles sintéticos y las dos corridas reales de Project22
const VIS = [{ type: "sections_visible", params: {} }].map(normalizeCheck);
const VIS_CASES = {
  visible_ok: ["PASS", { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS" }],
  visible_mal: ["FAIL", { R1: "FAIL", R2: "PASS", R3: "FAIL", R4: "FAIL" }],
  "real_p22_v05/index": ["PASS", { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS" }],
  "real_p22_v061/index": ["FAIL", { R1: "FAIL", R2: "PASS", R3: "FAIL", R4: "PASS" }],
  // v0.5.1: v0.7 real — hero sin llamar a su init (opacity:0) y nav recortado (max-height:0 + overflow:hidden en escritorio)
  "real_p22_v07/index": ["FAIL", { R1: "FAIL", R2: "FAIL", R3: "PASS", R4: "PASS" }],
  // v0.5.2: v0.7.1 real — contacto más alto que la pantalla: la tarjeta de abajo aparece al seguir bajando (FAIL falso en v0.5.1)
  "real_p22_v071/index": ["PASS", { R1: "PASS", R2: "PASS", R3: "PASS", R4: "PASS" }],
  // v0.6.1: Boxworld build 3 real — el overlay de victoria (style="display:none") no es contenido roto (FAIL falso en v0.6)
  "real_boxworld_b3/index": ["PASS", { R1: "PASS", R2: "PASS", R7: "PASS", R3: "PASS" }],
};
for (const [name, [exp, feats]] of Object.entries(VIS_CASES)) {
  const [r] = await runChecks(S(name), VIS);
  const good = r.result === exp && Object.entries(feats).every(([f, v]) => r.features?.[f] === v);
  if (good) { ok++; console.log(`✓ sections_visible ${name} ${r.result}`); }
  else { fail++; console.log(`✗ sections_visible ${name} esperado ${exp} ${JSON.stringify(feats)} dio ${r.result} ${JSON.stringify(r.features)}\n    ${r.detail}`); }
}

// v0.6: components_render (base) — el JS de cada componente llena algo de lo que nombra
const RENDER = [{ type: "components_render", params: {} }].map(normalizeCheck);
const RENDER_CASES = {
  // tablero lleno + mensaje vacío = OK; canvas pintado = OK; sección sin JS no cuenta
  render_ok: ["PASS", { juego: true, dibujo: true }],
  // función anónima nunca llamada (tablero y mensaje vacíos); canvas sin pintar
  render_mal: ["FAIL", { juego: false, dibujo: false }],
  // Boxworld build 2 real: #juego era `(root) => {…}` sin llamar; #niveles esperaba un botón que nunca se insertó
  "real_boxworld_b2/index": ["FAIL", { juego: false, niveles: false }],
  // Boxworld build 3 real: con las 25 tareas, #juego dibuja el tablero de 10x10
  "real_boxworld_b3/index": ["PASS", { juego: true, niveles: true }],
  // landings reales de Project22 v0.7.1: nada que dibujar falla (hero, contadores, formulario)
  "real_p22_v071/index": [null, {}],
};
for (const [name, [exp, comps]] of Object.entries(RENDER_CASES)) {
  const [r] = await runChecks(S(name), RENDER);
  const byId = Object.fromEntries((r.components || []).map((x) => [x.id, x.ok]));
  const good = (exp ? r.result === exp : r.result !== "FAIL") && Object.entries(comps).every(([id, v]) => byId[id] === v);
  if (good) { ok++; console.log(`✓ components_render ${name} ${r.result}`); }
  else { fail++; console.log(`✗ components_render ${name} esperado ${exp ?? "no FAIL"} ${JSON.stringify(comps)} dio ${r.result} ${JSON.stringify(byId)}\n    ${r.detail}`); }
}

// v0.7: interacción (web/app, web/game) — juego correcto, juego con los bugs de Boxworld b3, b3 real y página sin JS
const PLAY = [
  { type: "key_changes", params: { keys: ["flechas"] } },
  { type: "counter_on_action", params: { label: ["movimientos"] } },
  { type: "not_won_immediately", params: {} },
  { type: "reset_restores", params: { click: ["reiniciar"] } },
  { type: "board_changes", params: { keys: ["flechas"] } },
].map(normalizeCheck);
const PLAY_CASES = {
  game_ok: "PPPPP",
  game_mal: "PPFFP", // gana con un movimiento; al ganar, reiniciar queda deshabilitado
  "real_boxworld_b3/index": "PPFFP",
  // v0.7.1: Boxworld b4 real — el contador sube pero dibujar() no se llama: key_changes PASS (lo engaña el texto), board_changes FAIL
  "real_boxworld_b4/index": "PPPFF",
  // v0.7.3: Boxworld b6 real — dibujar() nunca hace appendChild y mostrarMensaje() rompe al cargar
  // v0.7.4: key_changes ya no cuenta el cartel de mensaje (en b6 era lo único que cambiaba)
  "real_boxworld_b6/index": "FFFFF",
  sections_vacio: "FFFFF", // nada responde: ninguno pasa (el esqueleto de control da FAIL → los PASS no son triviales)
};
for (const [name, exp] of Object.entries(PLAY_CASES)) {
  const r = await runChecks(S(name), PLAY);
  const got = r.map((x) => x.result[0]).join("");
  if (got === exp) { ok++; console.log(`✓ interacción ${name} ${got}`); }
  else { fail++; console.log(`✗ interacción ${name} esperado ${exp} dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`); }
}
const [cc] = await runChecks(S("real_boxworld_b3/index"), [normalizeCheck({ type: "click_changes", params: { click: ["reiniciar"] } })]);
if (cc.result === "PASS") { ok++; console.log("✓ click_changes b3 PASS"); } else { fail++; console.log(`✗ click_changes b3 ${cc.result} ${cc.detail}`); }
const [nw] = await runChecks(S("game_ganado"), [normalizeCheck({ type: "not_won_immediately", params: {} })]);
if (nw.result === "FAIL" && /recién cargado/.test(nw.detail)) { ok++; console.log("✓ not_won_immediately game_ganado FAIL (ganado al cargar)"); } else { fail++; console.log(`✗ not_won_immediately game_ganado ${nw.result} ${nw.detail}`); }
const [je] = await runChecks(S("real_boxworld_b6/index"), [normalizeCheck({ type: "no_js_errors", params: {} })]);
if (je.result === "FAIL" && je.errors?.[0]?.line === 703) { ok++; console.log("✓ no_js_errors da la línea del error (b6: 703)"); } else { fail++; console.log(`✗ no_js_errors línea ${JSON.stringify(je.errors)}`); }
// v0.8: chequeos sobre el contrato del juego por archivos (referencia) y sobre páginas sin contrato
const GAMEC = [
  { type: "game_levels", params: { min: ["5"] } },
  { type: "moves_one_cell", params: {} },
  { type: "fixed_map_size", params: {} },
  { type: "not_won_immediately", params: {} },
  { type: "reset_restores", params: { click: ["reiniciar"] } },
  { type: "board_changes", params: {} },
].map(normalizeCheck);
for (const [name, exp] of Object.entries({ "game_files_ok/index": "PPPPPP", "real_boxworld_b7/index": "FFFPPP", sections_vacio: "FFFFFF" })) {
  // paso 2: los chequeos del contrato leen el Standard que siguió el Specialist
  const r = await runChecks(S(name), GAMEC, { env: { standard: GRILLA } });
  const got = r.map((x) => x.result[0]).join("");
  if (got === exp) { ok++; console.log(`✓ juego por archivos ${name} ${got}`); }
  else { fail++; console.log(`✗ juego por archivos ${name} esperado ${exp} dio ${got}\n    ${r.map((x) => `${x.type}: ${x.detail}`).join("\n    ")}`); }
}
// ---- paso 2 (06/10): Validation profiles por tipo, leyendo el Standard ----
const t2 = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
{
  const sinStd = await runChecks(S("game_files_ok/index"), GAMEC.slice(0, 3));
  t2("sin Standard, los chequeos del contrato dan NOT_APPLICABLE (no se inventa un contrato)", sinStd.every((x) => x.result === "NOT_APPLICABLE" && /sin Standard/.test(x.detail)), sinStd.map((x) => x.detail).join(" | "));
  const game = validationFor(["web", "web/app", "web/game"], { standard: GRILLA });
  const land = validationFor(["web", "web/landing"]);
  t2("validationFor: web/game tiene lo de web + web/app + web/game y no lo de landing", ["no_js_errors", "key_changes", "board_changes", "game_scenario"].every((x) => game.catalog[x]) && !game.catalog.carousel);
  t2("validationFor: web/landing no tiene chequeos de juego", land.catalog.carousel && !land.catalog.board_changes && !land.catalog.game_levels);
  // el profile de juego no nombra el contrato de Boxworld: lo lee del Standard
  const src = readFileSync(fileURLToPath(new URL("../game/validation.mjs", import.meta.url)), "utf8").replace(/\/\/.*$/gm, "");
  // identificadores del contrato (no las palabras "tablero" o "mensaje" en un texto para el traductor)
  const hits = [...new Set(src.match(/\b(NIVELES|Reglas|crearEstado|mover)\b|["'#](tablero|mensaje|btn-[a-z]+)["']/g) || [])];
  t2("el Validation profile web/game no nombra el contrato (NIVELES, Reglas, #tablero…): lo lee del Standard", hits.length === 0, hits.join(", "));
  const G = (n, checks) => game.runChecks(S(n), checks.map(game.normalizeCheck));
  const [s11] = await G("real_boxworld_b11/index", [{ type: "game_scenario", params: {} }]);
  t2("game_scenario b11 (al ganar quedaba bloqueado, lo encontró Miche) → FAIL", s11.result === "FAIL" && /queda bloqueado/.test(s11.detail), s11.detail);
  const [s12, l12, k12] = await G("real_boxworld_b12/index", [{ type: "game_scenario", params: {} }, { type: "layout_stable", params: {} }, { type: "looks_distinct", params: {} }]);
  t2("game_scenario b12 → PASS", s12.result === "PASS", s12.detail);
  t2("layout_stable b12 (con el mensaje largo el tablero se estiraba) → FAIL", l12.result === "FAIL" && /huecos/.test(l12.detail), l12.detail);
  t2("looks_distinct b12 → PASS", k12.result === "PASS", k12.detail);
  const [k11] = await G("real_boxworld_b11/index", [{ type: "looks_distinct", params: {} }]);
  t2("looks_distinct b11 (caja y jugador por borde y brillo; Miche lo jugó) → PASS", k11.result === "PASS", k11.detail);
  const [k15] = await G("real_boxworld_b15_skills/index", [{ type: "looks_distinct", params: {} }]);
  t2("looks_distinct b15 (tablero de 28 px, injugable según Miche) → FAIL (compuerta)", k15.result === "FAIL" && /no se ve/.test(k15.detail), k15.detail);
  const [okS, okL] = await G("game_files_ok/index", [{ type: "game_scenario", params: {} }, { type: "layout_stable", params: {} }]);
  t2("referencia game_files_ok: escenario y layout PASS", okS.result === "PASS" && okL.result === "PASS", okS.detail + " | " + okL.detail);
  const base = await G("sections_vacio", [{ type: "game_scenario", params: {} }, { type: "looks_distinct", params: {} }, { type: "layout_stable", params: {} }]);
  t2("esqueleto vacío: los 3 chequeos nuevos no pasan (discriminan)", base.every((x) => x.result !== "PASS"), base.map((x) => x.result + " " + x.detail).join(" | "));
}

if (normalizeCheck({ type: "game_levels", params: { min: ["5"] } })) { ok++; console.log("✓ normalizeCheck acepta un número como parámetro"); } else { fail++; console.log("✗ normalizeCheck rechazó min: ['5']"); }
const kf = [keysFrom(["flechas"]).length === 4, keysFrom(["espacio"]).join() === "Space", keysFrom([]).length === 4, keysFrom(["arriba", "w"]).join() === "ArrowUp,w"];
if (kf.every(Boolean)) { ok++; console.log("✓ keysFrom"); } else { fail++; console.log("✗ keysFrom", kf); }

const bad = [normalizeCheck({ type: "inventado" }), normalizeCheck({ type: "field_exists", params: {} }), normalizeCheck({ type: "click_reveals", params: { click: ["x"] } })];
if (bad.every((b) => b === null)) { ok++; console.log("✓ normalizeCheck rechaza tipos y params inválidos"); } else { fail++; console.log("✗ normalizeCheck", bad); }
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
