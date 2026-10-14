// test_assignments.mjs — de las Atomic Tasks a los pasos del Specialist (punto 9, 14/10). Sin LLM.
//   node harness/test_assignments.mjs
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignByStep, assignmentText, assignmentSummary } from "./assignments.mjs";
import { buildFiles } from "./files_engine.mjs";
import { recipe } from "../standards/web/app/estado/recipe.mjs";
import { getStandard } from "../standards/registry.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

const estado = getStandard("web/app/estado");
const stepIds = estado.steps.map((s) => s.id);

// --- sin receta o sin piezas: como antes ---
t("sin receta → null (las tareas siguen como notas)", assignByStep([{ id: "a", pieza: "logica" }], null, stepIds) === null);
t("tareas sin pieza (corrida vieja) → null", assignByStep([{ id: "a" }, { id: "b" }], recipe, stepIds) === null);
t("resumen sin piezas lo dice", /como antes/.test(assignmentSummary(null)));

// --- con la 3ª corrida real (receta v0.3, rep 1) ---
const fx = JSON.parse(readFileSync(new URL("../build/fixtures/recipe_bench_2026-10-14_v03.json", import.meta.url), "utf8"));
const tasks = fx.corridas.find((c) => c.cond === "con" && c.rep === 1).tareas;
const a = assignByStep(tasks, recipe, stepIds);
const ids = (step) => a.byStep[step].map((x) => x.id);
const of = (p) => tasks.filter((x) => x.pieza === p).map((x) => x.id);
t("datos → contrato", ids("contrato").join() === of("datos").join(), ids("contrato").join());
t("logica → logica", ids("logica").join() === of("logica").join());
t("vista + estilo → pantalla (html y css)", ids("pantalla").length === of("vista").length + of("estilo").length);
t("vista → dibujo", ids("dibujo").join() === of("vista").join());
t("controles → acciones y controles (los pasos del harness)", ids("acciones").join() === of("controles").join() && ids("controles").join() === of("controles").join());
t("autor: acciones y controles = harness; contrato, logica, pantalla, dibujo = gemma",
  a.autorDe.acciones === "harness" && a.autorDe.controles === "harness" && ["contrato", "logica", "pantalla", "dibujo"].every((s) => a.autorDe[s] === "gemma"), JSON.stringify(a.autorDe));
t("todas las tareas caen en algún paso", !a.sinPieza.length && !a.piezaDesconocida.length && !a.pasosSinTareas.length);
t("resumen: un número por paso y marca los del harness", /logica 7/.test(assignmentSummary(a)) && /controles 6 \(harness\)/.test(assignmentSummary(a)), assignmentSummary(a));

// --- casos borde ---
const b = assignByStep([{ id: "x", pieza: "logica" }, { id: "y" }, { id: "z", pieza: "magia" }], recipe, stepIds);
t("una tarea sin pieza o con pieza desconocida queda a la vista (no se pierde)", b.sinPieza[0].id === "y" && b.piezaDesconocida[0].id === "z" && /sin pieza 1, pieza desconocida 1/.test(assignmentSummary(b)));
t("los pasos sin tareas se informan", b.pasosSinTareas.includes("contrato") && !b.pasosSinTareas.includes("logica"));

// --- el texto para el pedido ---
const txt = assignmentText([{ id: "F3.4", task: "Implementar la lógica para guardar cambios", description: "Recibe id, título y descripción." }]);
t("texto: id, tarea y descripción; manda el pedido del paso", /^TAREAS DE ESTE PASO/.test(txt) && /- F3\.4 Implementar la lógica para guardar cambios — Recibe id, título y descripción\./.test(txt) && /manda el pedido del paso/.test(txt));
t("sin tareas → texto vacío (el pedido no cambia)", assignmentText([]) === "");

// --- el motor registra qué tareas recibió cada paso ---
{
  const toyP = { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "NOTAS" }), finish: () => ["x.js"],
    kinds: { toy: { make: () => ({ judge: async () => [] }), store(st, _K, s, env) { env.files[st.file] = s.content[st.file]; } } } };
  let seenNotes = null;
  const S = { id: "toy", version: "0", status: "DRAFT", scripts: ["x.js", "y.js"], contract: "C", steps: [
    { id: "a", kind: "toy", file: "x.js", prompt: () => "p", write: (ctx) => { seenNotes = ctx.notes; return { "x.js": "1" }; } },
    { id: "b", kind: "toy", file: "y.js", prompt: () => "p", write: () => ({ "y.js": "2" }) },
  ] };
  const R = { pasos: { uno: ["a"], dos: ["b"] }, autor: { uno: "gemma", dos: "harness" } };
  const tk = [{ id: "T1", task: "t1", pieza: "uno" }, { id: "T2", task: "t2", pieza: "dos" }, { id: "T3", task: "t3", pieza: "uno" }];
  const run = (opts) => buildFiles({ refined: { project_name: "T", features: [] }, tasks: tk }, mkdtempSync(join(tmpdir(), "as-")), { standard: S, platform: toyP, log: () => {}, ...opts });
  const r = await run({ recipe: R });
  t("motor: cada paso guarda sus tareas (rec.tareas)", r.steps[0].tareas.join() === "T1,T3" && r.steps[1].tareas.join() === "T2", JSON.stringify(r.steps.map((s) => s.tareas)));
  t("motor: el resultado trae el reparto (evidencia)", r.assignment.byStep.a.join() === "T1,T3" && r.assignment.autorDe.b === "harness");
  t("motor: con reparto, las notas viejas no se repiten", seenNotes === "");
  const r0 = await run({});
  t("motor: sin receta, igual que antes (notas, sin reparto)", r0.assignment === null && r0.steps[0].tareas === undefined && seenNotes === "NOTAS");
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
