// test_compare_planillas.mjs — comparar dos jueces (planillas) por requisito, sin navegador.
//   node build/test_compare_planillas.mjs
import { verdictsByReq, compareVerdicts, COMPARE_VERSION } from "./compare_planillas.mjs";
let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
t("versión", COMPARE_VERSION === "compare_planillas v0.1");
const v = verdictsByReq([{ r: "R1", result: "PASS" }, { r: "R1", result: "FAIL" }, { r: "R2", result: "PASS" }], 3);
t("por requisito: una fila FAIL → FAIL; todas PASS → PASS; sin filas → SIN_CHEQUEO", v.R1 === "FAIL" && v.R2 === "PASS" && v.R3 === "SIN_CHEQUEO");
const vara = { a: { R1: "FAIL", R2: "PASS", R3: "SIN_CHEQUEO" }, b: { R1: "PASS", R2: "PASS", R3: "FAIL" } };
const otra = { a: { R1: "PASS", R2: "FAIL", R3: "SIN_CHEQUEO" }, b: { R1: "PASS", R2: "SIN_CHEQUEO", R3: "FAIL" } };
const c = compareVerdicts(vara, otra);
t("cuenta coincidencias (3 de 6) y el porcentaje", c.same === 3 && c.total === 6 && c.pct === 50, JSON.stringify(c));
t("clasifica los desacuerdos: más blanda (PASS donde la vara dice FAIL), más dura, no prueba", c.kinds.mas_blanda === 1 && c.kinds.mas_dura === 1 && c.kinds.no_prueba === 1);
t("una planilla igual a sí misma coincide 100%", compareVerdicts(vara, vara).pct === 100);
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
