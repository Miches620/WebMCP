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

const bad = [normalizeCheck({ type: "inventado" }), normalizeCheck({ type: "field_exists", params: {} }), normalizeCheck({ type: "click_reveals", params: { click: ["x"] } })];
if (bad.every((b) => b === null)) { ok++; console.log("✓ normalizeCheck rechaza tipos y params inválidos"); } else { fail++; console.log("✗ normalizeCheck", bad); }
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
