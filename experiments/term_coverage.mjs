// term_coverage.mjs — chequeo determinista (sin LLM): ¿las palabras PROPIAS de
// cada requisito aparecen en alguna tarea (título + descripción)?
//
// Surgió de exp_quote_reviewer (30/09): la regla de cita con Qwen no discriminó,
// pero este conteo sí separó graph real y contrafactual de Project20.
// Acá se corre sobre todos los casos con verdad conocida que tenemos.
//
//   node experiments/term_coverage.mjs
//
// Para cada requisito muestra propias presentes/total y las que faltan. La
// columna "esperado" es la verdad conocida del caso (GAP = ninguna tarea lo cubre).

import { readFileSync } from "node:fs";
import { extractRequirements } from "../completeness_reviewer3.mjs";
import { termCoverage } from "../term_coverage_check.mjs";

const fromTestFile = (name) => {
  const src = readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
  const prompt = Function(`return ${src.match(/const prompt = (`[\s\S]*?`);/)[1]}`)();
  const tasks = Function(`return ${src.match(/const atomicTasks = (\[[\s\S]*?\]);/)[1]}`)();
  return { reqs: extractRequirements(prompt), tasks };
};

const g = JSON.parse(readFileSync(new URL("./p20_graph.json", import.meta.url), "utf8"));
const P20 = g.features.map((f, i) => ({ id: `R${i + 1}`, text: f }));
const P20_SPLIT = [
  { id: "R1", text: g.features[0] },
  { id: "R2a", text: "Formulario de contacto con campos obligatorios" },
  { id: "R2b", text: "Formulario de contacto con un campo opcional para preferencias del cliente" },
  { id: "R3", text: g.features[2] },
  { id: "R4", text: g.features[3] },
];
const CF = g.tasks.map((t) => t.id === "F4.1"
  ? { ...t, description: "Crear los campos de input (nombre, email, mensaje), un campo de preferencias del cliente que sea opcional, y el botón dentro del contenedor estructural existente para definir la forma del formulario." }
  : t);
const recetas = fromTestFile("test_completeness_bounded.mjs");
const instr = fromTestFile("test_completeness_bounded_2.mjs");

const CASES = [
  ["P20 real (sin partir)", P20, g.tasks, ["R2"]],
  ["P20 real (partido)", P20_SPLIT, g.tasks, ["R2b"]],
  ["P20 contrafactual (partido)", P20_SPLIT, CF, []],
  ["recetas", recetas.reqs, recetas.tasks, ["R5"]],
  ["instrumentos", instr.reqs, instr.tasks, ["R3", "R4", "R5", "R6", "R7", "R8"]],
];

for (const [name, reqs, tasks, gaps] of CASES) {
  console.log(`\n== ${name}`);
  for (const r of termCoverage(reqs, tasks)) {
    const exp = gaps.includes(r.id) ? "GAP" : "ok ";
    console.log(`${exp}  ${r.id.padEnd(4)} ${r.present}/${r.total}  ${r.missing.length ? "faltan: " + r.missing.join(", ") : ""}   | ${r.text.slice(0, 60)}`);
  }
}
