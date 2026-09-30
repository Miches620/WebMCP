// test_phase_dependency_check.mjs — regresión del falso MISSING_DEPENDENCY
// de Project20 (intento 1). Determinístico, sin LLM.
//   node test_phase_dependency_check.mjs
import {
  validatePhaseDependencyExistence,
  reconcileDependencies,
} from "./atomic_engine_v5.js";

let ok = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; }
}
function expectThrow(fn, fragment) {
  try { fn(); } catch (e) {
    if (!e.message.includes(fragment)) throw new Error(`tiró otro error: ${e.message}`);
    return;
  }
  throw new Error(`debía fallar con "${fragment}" y no falló`);
}
const t = (id, deps = []) => ({ id, phase: id.split(".")[0], depends_on: deps });

// Caso real de Project20: F5.3 se re-atomizó en 3 y F5.5 siguió apuntando a F5.3.
const phaseF5 = [
  t("F5.1", ["F4.3"]), t("F5.2", ["F5.1"]),
  t("F5.3.R2.1", ["F5.2"]), t("F5.3.R2.2", ["F5.2"]), t("F5.3.R2.3", ["F5.2"]),
  t("F5.4", ["F5.2"]), t("F5.5", ["F5.3"]),
];
const previous = [t("F4.3")];
const known = new Set([...previous, ...phaseF5].map((x) => x.id));
const repl = { "F5.3": ["F5.3.R2.1", "F5.3.R2.2", "F5.3.R2.3"] };

check("Project20: dependencia a una AT re-atomizada ya NO da falso MISSING_DEPENDENCY", () => {
  validatePhaseDependencyExistence(phaseF5, known, repl);
});

check("Project20: la reconciliación final expande F5.5 → F5.3.R2.1..3", () => {
  const out = reconcileDependencies([...previous, ...phaseF5], repl);
  const f55 = out.find((x) => x.id === "F5.5");
  const want = ["F5.3.R2.1", "F5.3.R2.2", "F5.3.R2.3"];
  if (JSON.stringify(f55.depends_on) !== JSON.stringify(want))
    throw new Error(`quedó ${JSON.stringify(f55.depends_on)}`);
});

check("Sigue detectando un id inventado (el caso para el que existe el chequeo)", () => {
  expectThrow(() => validatePhaseDependencyExistence([t("F5.6", ["F5.9"])], known, repl), "MISSING_DEPENDENCY");
});

check("Detecta un reemplazo que apunta a una AT inexistente", () => {
  expectThrow(() => validatePhaseDependencyExistence([t("F5.6", ["F5.3"])], known, { "F5.3": ["F5.3.R2.1", "F5.3.R2.9"] }), "F5.3.R2.9");
});

check("Reemplazos encadenados (R2 re-atomizada otra vez en R3)", () => {
  const chain = { "F5.3": ["F5.3.R2.1"], "F5.3.R2.1": ["F5.3.R2.1.R3.1", "F5.3.R2.1.R3.2"] };
  const k = new Set(["F5.3.R2.1.R3.1", "F5.3.R2.1.R3.2"]);
  validatePhaseDependencyExistence([t("F5.5", ["F5.3"])], k, chain);
});

check("Sigue detectando autodependencia", () => {
  expectThrow(() => validatePhaseDependencyExistence([t("F5.5", ["F5.5"])], known, repl), "SELF_DEPENDENCY");
});

check("Sin replacementMap (llamada vieja) se comporta como antes", () => {
  validatePhaseDependencyExistence([t("F5.2", ["F5.1"])], known);
  expectThrow(() => validatePhaseDependencyExistence([t("F5.5", ["F5.3"])], known), "MISSING_DEPENDENCY");
});

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
