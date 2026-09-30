// test_reviewer_quotes.mjs — regla de cita del reviewer v0.7 (determinista, sin LLM).
//   node test_reviewer_quotes.mjs
import { readFileSync } from "node:fs";
import { checkQuotes, distinctiveTerms, extractTasks } from "./completeness_reviewer3.mjs";

let ok = 0, fail = 0;
const check = (name, fn) => {
  try { fn(); console.log(`✓ ${name}`); ok++; } catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

const g = JSON.parse(readFileSync(new URL("./experiments/p20_graph.json", import.meta.url), "utf8"));
const tasks = extractTasks(g.tasks, { withDescriptions: true });
const f41cf = g.tasks.map((t) => t.id === "F4.1"
  ? { ...t, description: "Crear los campos de input (nombre, email, mensaje), un campo de preferencias del cliente que sea opcional, y el botón dentro del contenedor estructural existente para definir la forma del formulario." }
  : t);
const tasksCF = extractTasks(f41cf, { withDescriptions: true });

const SPLIT = [
  { id: "R1", text: g.features[0] },
  { id: "R2a", text: "Formulario de contacto con campos obligatorios" },
  { id: "R2b", text: "Formulario de contacto con un campo opcional para preferencias del cliente" },
  { id: "R3", text: g.features[2] },
  { id: "R4", text: g.features[3] },
];
const ORIG = g.features.map((f, i) => ({ id: `R${i + 1}`, text: f }));
const v = (id, evidence) => ({ requirement_id: id, covered: true, covering_task_ids: evidence.map((e) => e.task_id), evidence });
const R = (list, id) => list.find((r) => r.id === id);

check("withDescriptions: F4.1 incluye 'nombre, email, mensaje'", () => {
  assert(tasks.find((t) => t.id === "F4.1").text.includes("nombre, email, mensaje"), "falta la descripción");
  assert(!extractTasks(g.tasks).find((t) => t.id === "F4.1").text.includes("nombre"), "sin la opción no debería incluirla");
});

check("términos propios de R2b = opcional / preferencias / cliente (no 'formulario', 'contacto')", () => {
  const d = distinctiveTerms(R(SPLIT, "R2b"), SPLIT);
  assert(!d.includes("formu") && !d.includes("conta"), JSON.stringify(d));
  assert(d.some((k) => k.startsWith("prefe")), JSON.stringify(d));
});

check("Project20 real: R2b citando 'formulario de contacto' → rechazado (no nombra nada propio)", () => {
  const r = checkQuotes(v("R2b", [{ task_id: "F4.1", quote: "Implementar la estructura HTML del formulario de contacto" }]), R(SPLIT, "R2b"), SPLIT, tasks);
  assert(!r.ok && /propio/.test(r.why), r.why);
});

check("Project20 real: R2b con cita inventada (parafraseo) → rechazado (no está en la tarea)", () => {
  const r = checkQuotes(v("R2b", [{ task_id: "F4.1", quote: "un campo opcional para preferencias del cliente" }]), R(SPLIT, "R2b"), SPLIT, tasks);
  assert(!r.ok && /no está en la tarea/.test(r.why), r.why);
});

check("contrafactual: R2b citando 'campo de preferencias del cliente que sea opcional' → aceptado", () => {
  const r = checkQuotes(v("R2b", [{ task_id: "F4.1", quote: "un campo de preferencias del cliente que sea opcional" }]), R(SPLIT, "R2b"), SPLIT, tasksCF);
  assert(r.ok, r.why);
});

check("R2a citando 'campos obligatorios' de F4.3 → aceptado (mayúsculas/tildes no importan)", () => {
  const r = checkQuotes(v("R2a", [{ task_id: "F4.3", quote: "verificar que los CAMPOS OBLIGATORIOS estén llenos" }]), R(SPLIT, "R2a"), SPLIT, tasks);
  assert(r.ok, r.why);
});

check("R1 citando 'foto' de F2.3 → aceptado", () => {
  const t = tasks.find((x) => x.id === "F2.3").text;
  const quote = t.match(/muestre la foto[^,.]*/)?.[0];
  assert(quote, `F2.3 no tiene 'muestre la foto': ${t}`);
  const r = checkQuotes(v("R1", [{ task_id: "F2.3", quote }]), R(SPLIT, "R1"), SPLIT, tasks);
  assert(r.ok, r.why);
});

check("sin evidence o tarea inexistente → rechazado", () => {
  assert(!checkQuotes({ covered: true, covering_task_ids: ["F4.1"] }, R(SPLIT, "R2a"), SPLIT, tasks).ok, "sin evidence debería fallar");
  assert(!checkQuotes(v("R2a", [{ task_id: "F9.9", quote: "campos obligatorios" }]), R(SPLIT, "R2a"), SPLIT, tasks).ok, "tarea inexistente debería fallar");
});

check("sin partir: R2 original citando 'formulario de contacto' → aceptado (por eso partir es necesario)", () => {
  const r = checkQuotes(v("R2", [{ task_id: "F4.1", quote: "formulario de contacto" }]), R(ORIG, "R2"), ORIG, tasks);
  assert(r.ok, r.why);
});

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
