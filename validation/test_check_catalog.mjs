// test_check_catalog.mjs — el catálogo sobre los fixtures del piloto, con chequeos escritos a mano.
//   node validation/test_check_catalog.mjs
import { fileURLToPath } from "node:url";
import { runChecks, normalizeCheck } from "./check_catalog.mjs";

const F = (n) => fileURLToPath(new URL(`../pilot/fixtures/${n}.html`, import.meta.url));
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
};
for (const [name, [exp, feats]] of Object.entries(VIS_CASES)) {
  const [r] = await runChecks(S(name), VIS);
  const good = r.result === exp && Object.entries(feats).every(([f, v]) => r.features?.[f] === v);
  if (good) { ok++; console.log(`✓ sections_visible ${name} ${r.result}`); }
  else { fail++; console.log(`✗ sections_visible ${name} esperado ${exp} ${JSON.stringify(feats)} dio ${r.result} ${JSON.stringify(r.features)}\n    ${r.detail}`); }
}

const bad = [normalizeCheck({ type: "inventado" }), normalizeCheck({ type: "field_exists", params: {} }), normalizeCheck({ type: "click_reveals", params: { click: ["x"] } })];
if (bad.every((b) => b === null)) { ok++; console.log("✓ normalizeCheck rechaza tipos y params inválidos"); } else { fail++; console.log("✗ normalizeCheck", bad); }
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
