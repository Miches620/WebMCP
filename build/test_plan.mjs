// test_plan.mjs — la planilla entra al plan (08/11), sin modelo: TechLeader y el Atomizer de mentira, el resto real.
//   node build/test_plan.mjs
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { buildDecomposePrompt, runAtomicGraph } from "../atomic_engine_v5.js";
import { buildTechLeaderPrompt } from "../techleader_prompt.mjs";
import { resolveProfiles } from "../profiles/registry.mjs";
import { perfilPlan, requisitosConPruebas, entradaTechLeader, coberturaFases, pruebasDeFase, filasSinTarea, armarPlan, planEnPalabras, planDeProyecto, PLAN_VERSION } from "./plan.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "../profiles/web/validation/fixtures/proyecto_hoja");
const REQ = JSON.parse(readFileSync(join(FIX, "requisitos.json"), "utf8"));
const PH = JSON.parse(readFileSync(join(FIX, "planilla.json"), "utf8"));

// ---------- prompts: sin pruebas quedan como siempre (la UI no cambia) ----------
const prof = resolveProfiles(["web/app"]), pp = perfilPlan();
const fase = { id: "F2", name: "Fórmulas", responsable_sugerido: "Frontend", description: "x", depends_on: [] };
const sin = buildDecomposePrompt(fase, "Frontend", [], prof);
const con = buildDecomposePrompt({ ...fase, pruebas: [{ id: "R4.1", texto: "Antes: escribo \"=B1+C1\" en A1. Escribo \"4\" en B1. → A1 muestra \"7\"" }] }, "Frontend", [], pp);
t("Atomizer sin pruebas: el prompt no habla de pruebas (igual que antes)", !/PRUEBAS QUE ESTA FASE|"prueba"/.test(sin));
t("Atomizer con pruebas: bloque con cada fila, regla de no contradecirlas, sin tareas de verificar, y el campo \"prueba\" en el formato", /PRUEBAS QUE ESTA FASE TIENE QUE HACER PASAR/.test(con) && /- R4\.1: Antes: escribo/.test(con) && /no puede contradecir una prueba/.test(con) && /No agregues tareas de "verificar"/.test(con) && (con.match(/"prueba": \["R4\.1"\]/g) || []).length === 2 && !/"pruebas":/.test(con), con.slice(-1500));
t("perfil del plan: sin QA y sin receta", !pp.roles.includes("QA") && pp.atomizerRecipe === null && pp.roles.includes(pp.exampleRole) && !/"pieza"/.test(con));
const tl0 = buildTechLeaderPrompt(prof), tl1 = buildTechLeaderPrompt(pp, { cubre: true });
t("TechLeader: sin la opción, igual que antes; con la opción pide \"cubre\" y no deja fases de QA", !/cubre|QA:/.test(tl0.replace(/"QA"/g, "")) && /"cubre": \["R1", "R2"\]/.test(tl1) && /NO planifiques fases de pruebas/.test(tl1) && !/"QA"/.test(tl1));

// ---------- datos y coberturas ----------
const reqs = requisitosConPruebas(REQ, PH);
t("requisitos a cubrir: 17 (las 3 restricciones no), con sus filas en palabras", reqs.length === 17 && reqs.find((r) => r.id === "R4").filas[0].id === "R4.1" && /A1 muestra "7"/.test(reqs.find((r) => r.id === "R4").filas[0].texto), JSON.stringify(reqs.find((r) => r.id === "R4")));
const ent = entradaTechLeader(REQ, reqs, "ETAPA: PROTOTYPE");
t("entrada de TechLeader: requisitos con sus pruebas y las restricciones aparte", /R5\. Cambiar el color de fondo de una celda\n   - prueba R5\.1: /.test(ent) && /Restricciones[^]*- Sin login/.test(ent) && /ETAPA: PROTOTYPE$/.test(ent), ent.slice(0, 600));
t("cobertura de fases: dice qué requisito no está en ninguna fase", JSON.stringify(coberturaFases([{ cubre: ["R1", "R2", "R99"] }], reqs.slice(0, 3)).faltan) === '["R3"]');
t("pruebas de una fase = las filas de lo que cubre", JSON.stringify(pruebasDeFase({ cubre: ["R4", "R5"] }, reqs).map((f) => f.id)) === '["R4.1","R5.1"]');
t("filas sin tarea", JSON.stringify(filasSinTarea([{ prueba: ["R4.1"] }], reqs.slice(3, 5))) === '["R5.1"]');

// ---------- armarPlan entero: TechLeader de mentira, runAtomicGraph REAL con LM Studio de mentira ----------
const FASES1 = [
  { id: "F1", name: "Grilla y edición", responsable_sugerido: "Frontend", description: "grilla", cubre: ["R1", "R2", "R10"], depends_on: [] },
  { id: "F2", name: "Fórmulas", responsable_sugerido: "Backend", description: "fórmulas", cubre: ["R3", "R4", "R11", "R12"], depends_on: ["F1"] },
  { id: "F3", name: "Filas y columnas", responsable_sugerido: "Frontend", description: "selección", cubre: ["R6", "R7", "R8", "R13", "R14", "R15", "R16"], depends_on: ["F1"] },
  { id: "F4", name: "Guardar", responsable_sugerido: "QA", description: "localStorage", cubre: ["R9", "R17"], depends_on: ["F1"] },
];
const FASES2 = [...FASES1.slice(0, 2), { ...FASES1[2], cubre: ["R5", ...FASES1[2].cubre], description: "selección y color de UNA celda" }, FASES1[3]];
const tlUsers = [];
const callTL = async (system, user) => { tlUsers.push(user); return JSON.stringify({ fases: tlUsers.length === 1 ? FASES1 : FASES2, diferido: ["exportar"] }); };
const prompts = [];
let saltear = new Set(["R4.1"]);
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const content = JSON.parse(init.body).messages.map((m) => m.content).join("\n");
  prompts.push(content);
  let out;
  if (/Eres un Checker independiente/.test(content)) out = { is_valid: true, reason: "ok" };
  else {
    const phaseId = content.match(/"phase_id": "([^"]+)"/)[1];
    const todas = [...content.matchAll(/^- (R\d+\.\d+): /gm)].map((m) => m[1]);
    const filas = todas.filter((id) => !saltear.has(id));
    for (const id of todas) saltear.delete(id);
    out = { phase_id: phaseId, atomic: false, subtasks: [{ id: `${phaseId}.1`, task: `preparar ${phaseId}`, role: "Frontend", description: "estado", depends_on: [] },
      ...filas.map((id, k) => ({ id: `${phaseId}.${k + 2}`, task: `hacer ${id}`, role: "Frontend", description: "x", prueba: [id], depends_on: [`${phaseId}.1`] }))] };
  }
  return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(out) } }] }) };
};
const logs = [];
const plan = await armarPlan({ req: REQ, planilla: PH, criterio: "ETAPA", call: callTL, log: (m) => logs.push(m) });
t("TechLeader dejó R5 afuera → se le repite UNA vez con lo que falta (y el texto del requisito)", tlUsers.length === 2 && /dejó afuera estos requisitos[^]*- R5\. Cambiar el color de fondo de una celda/.test(tlUsers[1]) && plan.cobertura.requisitos_sin_fase.length === 0, tlUsers[1]?.slice(-400));
t("una fase con el rol QA queda con el rol por defecto (QA no está en el plan)", plan.fases.find((f) => f.id === "F4").responsable_sugerido === pp.defaultRole);
const pF2 = prompts.find((p) => /"phase_id": "F2"/.test(p) && !/Checker/.test(p));
t("al Atomizer de cada fase le llegan SOLO las filas de lo que cubre", /- R4\.1: /.test(pF2) && /- R3\.1: /.test(pF2) && !/- R5\.1: /.test(pF2) && !/- R1\.1: /.test(pF2));
t("la tarea guarda su \"prueba\" (pasó por el Checker real)", plan.tareas.find((x) => x.task === "hacer R3.1")?.prueba?.[0] === "R3.1", JSON.stringify(plan.tareas.slice(0, 3)));
const ext = prompts.find((p) => /"phase_id": "F2b"/.test(p));
t("fila sin tarea (R4.1) → se atomiza otra vez SOLO esa fila, con las tareas de antes como contexto, y queda cubierta", ext && /- R4\.1: /.test(ext) && !/- R3\.1: /.test(ext) && /F1\.1 \| Fase F1/.test(ext) && plan.cobertura.filas_sin_tarea.length === 0 && plan.tareas.some((x) => x.phase === "F2b" && x.prueba?.includes("R4.1")), JSON.stringify(plan.cobertura));
const pos = (id) => plan.tareas.findIndex((x) => x.id === id);
t("orden por dependencias: cada preparación antes de sus tareas", plan.tareas.length > 20 && pos("F2.1") < pos("F2.2") && pos("F3.1") < pos("F3.2"), plan.tareas.map((x) => x.id).join(" "));
const md = planEnPalabras(plan, REQ, PH);
t("plan.md: cobertura completa, cada tarea con las pruebas que la verifican en palabras, lo diferido y cómo aprobar", /\*\*Cobertura completa:\*\*/.test(md) && /hacer R4\.1[^]*verifican: R4\.1 \(Antes: escribo "=B1\+C1"/.test(md) && /sin prueba \(preparación\)/.test(md) && /- exportar/.test(md) && /--aprobar/.test(md), md.slice(0, 800));
const mdFalta = planEnPalabras({ ...plan, cobertura: { requisitos_sin_fase: ["R5"], filas_sin_tarea: ["R5.1"] } }, REQ, PH);
t("plan.md: si falta cubrir algo, lo dice arriba", /\*\*OJO, falta cubrir:\*\* requisitos sin fase: R5 · pruebas sin tarea: R5\.1/.test(mdFalta));

// ---------- planDeProyecto: escribe plan.json y plan.md en la carpeta ----------
const d = mkdtempSync(join(tmpdir(), "plan-"));
writeFileSync(join(d, "requisitos.json"), JSON.stringify(REQ)); writeFileSync(join(d, "planilla.json"), JSON.stringify(PH));
saltear = new Set(); tlUsers.length = 0;
const pl2 = await planDeProyecto(d, { call: async () => JSON.stringify({ fases: FASES2 }), log: () => {} });
const pj = JSON.parse(readFileSync(join(d, "plan.json"), "utf8"));
t("planDeProyecto: plan.json (PROPUESTO, con versión) y plan.md en la carpeta", pj.estado === "PROPUESTO" && pj.version === PLAN_VERSION && pj.tareas.length === pl2.tareas.length && /# Plan: cómo se va a construir/.test(readFileSync(join(d, "plan.md"), "utf8")));
const { readdirSync } = await import("node:fs");
await planDeProyecto(d, { call: async () => JSON.stringify({ fases: FASES2 }), log: () => {} });
t("un plan anterior no se pisa: queda como plan_<fecha>.json y .md", readdirSync(d).filter((f) => /^plan_.*\.(json|md)$/.test(f)).length === 2 && JSON.parse(readFileSync(join(d, "plan.json"), "utf8")).creado, readdirSync(d).join());
globalThis.fetch = realFetch;

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
