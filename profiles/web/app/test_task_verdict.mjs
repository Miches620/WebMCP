// test_task_verdict.mjs — veredicto de Validation por tarea (punto 9 paso 3, 14/10). Sin LLM ni navegador.
//   node profiles/web/app/test_task_verdict.mjs
import { readFileSync } from "node:fs";
import { taskVerdicts, taskVerdictLines, taskVerdictSummary } from "./task_verdict.mjs";
import { taskVerdicts as fromBuild } from "./build.mjs";
import { parseContract } from "../../../standards/web/app/estado/contract.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const J = (u) => JSON.parse(readFileSync(new URL(u, import.meta.url), "utf8"));

// --- el contrato guarda "tareas" ---
const pc = parseContract({ estado: { items: [{ id: 1, texto: "Uno dos" }] }, acciones: [
  { nombre: "borrarItem", params: ["id"], ejemplo: [1], hace: "borra", features: [1], cambia: ["items"], cumple: ["F3.7", "F3.6", "F3.7", "<b>", 12, ""] },
  { nombre: "otraCosa", params: [], ejemplo: [], hace: "x", features: [1], cambia: [] },
] }, { features: ["a"] }).items[0];
t("contrato: 'cumple' se guarda sin repetidos ni basura; sin 'cumple' → []", pc.acciones[0].cumple.join() === "F3.7,F3.6" && pc.acciones[1].cumple.length === 0, JSON.stringify(pc.acciones.map((a) => a.cumple)));

// --- reglas ---
const T = [
  { id: "L1", task: "lógica de borrar", pieza: "logica" },
  { id: "C1", task: "control de borrar", pieza: "controles" },
  { id: "L2", task: "lógica de mover", pieza: "logica" },
  { id: "V1", task: "mostrar tarjetas", pieza: "vista" },
  { id: "L3", task: "lógica sin acción", pieza: "logica" },
  { id: "X1", task: "sin pieza" },
];
const contract = { acciones: [{ nombre: "borrarItem", tareas: ["L1", "C1"] }, { nombre: "moverItem", tareas: ["L2", "Z9"] }] };
const acceptance = { passed: ["borrarItem devuelve un estado", "borrarItem hace algo", "moverItem devuelve un estado"], failed: ["moverItem hace algo"] };
const rows = [{ nombre: "borrarItem", called: 1, problem: null }, { nombre: "moverItem", called: 1, problem: null }];
const v = taskVerdicts({ tasks: T, contract, acceptance, gateRows: rows });
const by = Object.fromEntries(v.rows.map((r) => [r.id, r]));
t("lógica con pruebas OK y compuerta OK → CUMPLIDA", by.L1.verdict === "CUMPLIDA" && /2 pruebas de lógica/.test(by.L1.reason) && /se usa desde la pantalla/.test(by.L1.reason), JSON.stringify(by.L1));
t("controles (harness) con su acción en la compuerta → CUMPLIDA", by.C1.verdict === "CUMPLIDA" && by.C1.accion === "borrarItem");
t("lógica con una prueba que falla → NO_CUMPLIDA con el motivo", by.L2.verdict === "NO_CUMPLIDA" && /moverItem hace algo/.test(by.L2.reason));
t("vista → SIN_EVIDENCIA (no hay prueba propia)", by.V1.verdict === "SIN_EVIDENCIA" && /no hay prueba propia/.test(by.V1.reason));
t("lógica que ninguna acción declara → SIN_EVIDENCIA", by.L3.verdict === "SIN_EVIDENCIA" && /ninguna acción/.test(by.L3.reason));
t("tarea sin pieza → SIN_EVIDENCIA", by.X1.verdict === "SIN_EVIDENCIA");
t("ids que no existen en el contrato se informan", v.desconocidas.join() === "Z9" && taskVerdictLines(v).some((l) => /no existen: Z9/.test(l)));
const v2 = taskVerdicts({ tasks: T, contract, acceptance: { passed: acceptance.passed, failed: [] }, gateRows: [{ nombre: "borrarItem", called: 0, problem: "no se llamó" }, rows[1]] });
t("compuerta con problema → NO_CUMPLIDA (lógica y controles de esa acción)", v2.rows.find((r) => r.id === "L1").verdict === "NO_CUMPLIDA" && v2.rows.find((r) => r.id === "C1").verdict === "NO_CUMPLIDA" && v2.rows.find((r) => r.id === "L2").verdict === "CUMPLIDA");
const v3 = taskVerdicts({ tasks: T, contract: { acciones: [{ nombre: "borrarItem", tareas: ["L1"] }, { nombre: "moverItem", tareas: ["L1"] }] }, acceptance, gateRows: rows });
t("una tarea en dos acciones se informa", v3.enVariasAcciones.join() === "L1");
t("sin compuerta (no corrió) → no se da por cumplida", taskVerdicts({ tasks: T, contract, acceptance, gateRows: null }).rows.find((r) => r.id === "C1").verdict === "NO_CUMPLIDA");
t("resumen", taskVerdictSummary(v) === "CUMPLIDA 2 · NO_CUMPLIDA 1 · SIN_EVIDENCIA 3", taskVerdictSummary(v));

// --- con el build real 20-50-53 (contrato SIN "tareas": Standard v0.4.3) ---
const snap = J("../../../build/snapshots/kanban_receta_v03_snapshot.json");
const fx = J("../validation/fixtures/verdict_build_2026-10-14T20-50-53.json");
const input = { tasks: snap.atomicTasks };
const realNo = fromBuild({ input, specialist: { rule_tests: fx.rule_tests }, gates: { rows: fx.gate_rows, tareas: Object.fromEntries(fx.gate_rows.map((r) => [r.nombre, []])) } });
t("build real sin 'tareas' en el contrato: 28 tareas, ninguna CUMPLIDA (no se inventa la relación)", realNo.rows.length === 28 && !realNo.counts.CUMPLIDA && realNo.counts.SIN_EVIDENCIA === 28, JSON.stringify(realNo.counts));
// el mismo build si el contrato hubiera declarado sus tareas (lo que pide v0.5)
const decl = { crearTarjeta: ["F2.4", "F2.5"], moverTarjeta: ["F2.6", "F3.1", "F3.2"], editarTarjeta: ["F3.4", "F3.5"], borrarTarjeta: ["F3.7", "F3.6"], agregarEtiqueta: ["F4.3", "F4.4"], agregarComentario: ["F4.7", "F4.8"] };
const real = fromBuild({ input, specialist: { rule_tests: fx.rule_tests }, gates: { rows: fx.gate_rows, tareas: decl } });
t("build real + 'tareas' declaradas: 13 CUMPLIDAS (7 lógica + 6 controles) y 15 SIN_EVIDENCIA", real.counts.CUMPLIDA === 13 && real.counts.SIN_EVIDENCIA === 15 && !real.counts.NO_CUMPLIDA, JSON.stringify(real.counts));
t("cada tarea de lógica cita sus 5 pruebas y la compuerta", real.rows.filter((r) => r.pieza === "logica").every((r) => /5 pruebas de lógica/.test(r.reason) && /se usa desde la pantalla/.test(r.reason)));
t("sin piezas (corrida vieja) → null", fromBuild({ input: { tasks: [{ id: "a", task: "x" }] }, specialist: {}, gates: null }) === null);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
