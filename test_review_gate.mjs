// test_review_gate.mjs — determinista.  node test_review_gate.mjs
import { reviewStatus } from "./review_gate.mjs";
let ok = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log(`✓ ${name}`); ok++; } catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; } };
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`esperado ${JSON.stringify(b)}, vino ${JSON.stringify(a)}`); };

check("caso real Project23: SYSTEM_ERROR 'fetch failed' → no corrió", () => {
  const r = reviewStatus({ findings: [{ type: "SYSTEM_ERROR", reference: "Reviewer", reason: "fetch failed" }], coverage_score: null });
  eq([r.ran, r.reason, r.blocking], [false, "fetch failed", false]);
});
check("sin resultado, con error de la llamada o sin findings → no corrió", () => {
  eq(reviewStatus(null).ran, false);
  eq(reviewStatus({ error: "Backend 500: Cannot find module" }).reason, "Backend 500: Cannot find module");
  eq(reviewStatus({ coverage_score: 1 }).ran, false);
});
check("corrió limpio → ran y no bloquea", () => {
  eq(reviewStatus({ findings: [] }), { ran: true, gaps: 0, excess: 0, ambiguous: 0, blocking: false });
});
check("GAP/EXCESS bloquean; AMBIGUOUS no", () => {
  eq(reviewStatus({ findings: [{ type: "GAP" }, { type: "AMBIGUOUS" }] }).blocking, true);
  eq(reviewStatus({ findings: [{ type: "EXCESS" }] }).blocking, true);
  eq(reviewStatus({ findings: [{ type: "AMBIGUOUS" }] }).blocking, false);
});
console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
