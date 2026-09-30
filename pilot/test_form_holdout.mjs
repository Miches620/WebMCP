// test_form_holdout.mjs — calibración del validador con artefactos de resultado conocido.
//   node pilot/test_form_holdout.mjs
// Si esto falla, la Evidence del piloto no vale: se arregla el validador primero.
import { fileURLToPath } from "node:url";
import { validateForm } from "./holdout/form_holdout.mjs";

const F = (n) => fileURLToPath(new URL(`./fixtures/${n}.html`, import.meta.url));
const CASES = [
  // [fixture, veredicto, {check: resultado esperado}]
  ["ok_html5", "PASS", { C3: "PASS", C4: "PASS", C5: "PASS", C6: "PASS", C7: "PASS" }],
  ["ok_js", "PASS", { C5: "PASS", C6: "PASS", C7: "PASS" }], // validación en JS, sin `required`
  ["alert_js", "PASS", { C5: "PASS", C6: "N/A" }], // errores por alert(), sin email
  ["sin_preferencias", "FAIL", { C3: "PASS", C4: "FAIL" }], // el caso F4.1 de Project20
  ["pref_obligatorio", "FAIL", { C4: "FAIL" }],
  ["todo_opcional", "FAIL", { C3: "FAIL", C5: "FAIL" }],
  ["error_js", "FAIL", { C1: "FAIL" }],
  ["sin_form", "FAIL", { C2: "FAIL", C7: "NOT_RUN" }],
];

let ok = 0, fail = 0;
for (const [name, verdict, exp] of CASES) {
  const ev = await validateForm(F(name));
  const got = Object.fromEntries(ev.checks.map((c) => [c.id, c.result]));
  const bad = Object.entries(exp).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: esperado ${v}, dio ${got[k]}`);
  if (ev.validation_result !== verdict) bad.unshift(`veredicto: esperado ${verdict}, dio ${ev.validation_result}`);
  if (bad.length) { fail++; console.log(`✗ ${name}\n    ${bad.join("\n    ")}`); }
  else { ok++; console.log(`✓ ${name} → ${ev.validation_result}`); }
}
console.log(`\n${ok}/${ok + fail} fixtures OK`);
if (fail) process.exit(1);
