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
t("lógica que ninguna acción declara → SIN_EVIDENCIA", by.L3.verdict === "SIN_EVIDENCIA" && /enlace/.test(by.L3.reason));
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
// v0.2: F3.2 pide arrastrar y soltar; el harness arma botones → el botón de moverTarjeta no la prueba
t("build real + 'tareas' declaradas: 12 CUMPLIDAS (7 lógica + 5 controles) y 16 SIN_EVIDENCIA (F3.2 arrastrar no se prueba)", real.counts.CUMPLIDA === 12 && real.counts.SIN_EVIDENCIA === 16 && !real.counts.NO_CUMPLIDA && /arrastrar/.test(real.rows.find((r) => r.id === "F3.2").reason) && real.rows.find((r) => r.id === "F3.2").accion === "moverTarjeta", JSON.stringify(real.counts));
// v0.2: la relación viene del paso enlace (Standard v0.6), sin "tareas" en el contrato
const porTarea = {}; for (const [a, l] of Object.entries(decl)) for (const id of l) (porTarea[id] ||= []).push(a);
const viaEnlace = fromBuild({ input, specialist: { rule_tests: fx.rule_tests, data: { enlace: { report: [{ porTarea, ninguna: [] }] } } }, gates: { rows: fx.gate_rows, tareas: Object.fromEntries(fx.gate_rows.map((r) => [r.nombre, []])) } });
t("enlace: mismo veredicto que con 'tareas' en el contrato", JSON.stringify(viaEnlace.rows) === JSON.stringify(real.rows), JSON.stringify(viaEnlace.counts));
const conNinguna = fromBuild({ input, specialist: { rule_tests: fx.rule_tests, data: { enlace: { report: [{ porTarea: { "F2.4": ["crearTarjeta"] }, ninguna: ["F3.7"] }] } } }, gates: { rows: fx.gate_rows, tareas: {} } });
const rN = (id) => conNinguna.rows.find((r) => r.id === id);
t("enlace: 'ninguna' y sin ubicar se distinguen en el motivo (las dos SIN_EVIDENCIA)", rN("F2.4").verdict === "CUMPLIDA" && /ninguna acción de la app/.test(rN("F3.7").reason) && /no la ubicó/.test(rN("F3.4").reason), JSON.stringify([rN("F3.7"), rN("F3.4")]));
t("controles con teclado también quedan SIN_EVIDENCIA aunque estén enlazados", taskVerdicts({ tasks: [{ id: "K1", pieza: "controles", task: "Atajo de teclado para borrar" }], links: { porTarea: { K1: ["borrar"] }, ninguna: [] }, acceptance: { passed: [], failed: [] }, gateRows: [{ nombre: "borrar", called: true }] }).rows[0].verdict === "SIN_EVIDENCIA");
t("cada tarea de lógica cita sus 5 pruebas y la compuerta", real.rows.filter((r) => r.pieza === "logica").every((r) => /5 pruebas de lógica/.test(r.reason) && /se usa desde la pantalla/.test(r.reason)));
t("sin piezas (corrida vieja) → null", fromBuild({ input: { tasks: [{ id: "a", task: "x" }] }, specialist: {}, gates: null }) === null);

// v0.3 (15/10, p48): lo que vio Validation en la pantalla. Réplica 13-02-02 (seed 3): las pruebas de lógica pasaban y
// la compuerta vieja decía 6/6, pero en la pantalla ninguna acción cambiaba nada (R1–R6 action_changes FAIL).
{
  const F = "../validation/fixtures/real_kanban_c18/";
  const cov = J(F + "coverage.json"), con = J(F + "contrato.json"), enl = J(F + "enlace.json");
  const rows = con.acciones.map((a) => ({ nombre: a.nombre, features: a.features, called: 1, problem: null })); // la compuerta VIEJA: todo "bien"
  const accept = { passed: con.acciones.flatMap((a) => [1, 2, 3, 4, 5].map((k) => `${a.nombre} prueba ${k}`)), failed: [] };
  const screen = Object.fromEntries(cov.coverage.map((c) => [c.id, c.checks.find((k) => k.type === "action_changes")]).filter(([, k]) => k));
  const sin = taskVerdicts({ tasks: snap.atomicTasks, links: { porTarea: enl.informe.porTarea, ninguna: [] }, acceptance: accept, gateRows: rows });
  const con3 = taskVerdicts({ tasks: snap.atomicTasks, links: { porTarea: enl.informe.porTarea, ninguna: [] }, acceptance: accept, gateRows: rows, screen });
  t("réplica 13-02-02 sin mirar la pantalla: 12 CUMPLIDAS (lo que salió en el build)", sin.counts.CUMPLIDA === 12, JSON.stringify(sin.counts));
  t("réplica 13-02-02 mirando la pantalla: 0 CUMPLIDAS, 12 NO_CUMPLIDAS con el motivo de Validation", !con3.counts.CUMPLIDA && con3.counts.NO_CUMPLIDA === 12 && /en pantalla \(R1\) .*no cambia nada/.test(con3.rows.find((r) => r.id === "F2.4").reason), JSON.stringify(con3.counts) + " " + con3.rows.find((r) => r.id === "F2.4").reason);
  const okScreen = Object.fromEntries(Object.keys(screen).map((k) => [k, { result: "PASS", detail: "" }]));
  const bien = taskVerdicts({ tasks: snap.atomicTasks, links: { porTarea: enl.informe.porTarea, ninguna: [] }, acceptance: accept, gateRows: rows, screen: okScreen });
  t("con la pantalla en PASS: CUMPLIDA y el motivo lo dice", bien.counts.CUMPLIDA === 12 && /la pantalla cambia \(R1\)/.test(bien.rows.find((r) => r.id === "F2.4").reason));
}
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
