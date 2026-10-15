// test_enlace.mjs — paso ENLACE del Standard web/app/estado v0.6 (qué acción hace cada tarea).
//   node standards/web/app/estado/test_enlace.mjs
// Datos reales: contrato y tareas del build 2026-10-15T00-25-22 (fixture real_kanban_c14 + snapshot de la receta v0.3).
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S from "./standard.mjs";
import { linkTasksOf, enlacePrompt, parseLinks, linkProblems, bestLinks, linksSummary, actionsByTask, NINGUNA } from "./enlace.mjs";
import { dataKind } from "../../../../harness/files_engine.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const J = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

const contract = J("../../../../profiles/web/validation/fixtures/real_kanban_c14/contrato.json");
const tasks = J("../../../../build/snapshots/kanban_receta_v03_snapshot.json").atomicTasks;
const mine = linkTasksOf(tasks);
const step = S.steps.find((s) => s.id === "enlace");

// ---------- 1. el paso ----------
t("enlace es el último paso, de datos, opcional y con pedido chico (bare)", S.steps.at(-1).id === "enlace" && step.kind === "data" && step.optional === true && step.bare === true && step.needs.join() === "contrato" && !step.file);
t("tareas del enlace: solo logica y controles (13 de 28)", mine.length === 13 && mine.every((x) => ["logica", "controles"].includes(x.pieza)) && tasks.length === 28);
t("sin tareas con pieza (corrida sin receta) → no aplica", /sin receta/.test(step.skip({ tasks: [{ id: "a", task: "x" }] }) || "") && step.skip({ tasks }) === null);

// ---------- 2. el pedido ----------
const ctx = { data: { contrato: { items: [contract] } }, tasks, paso: "PASO 7 de 7" };
const pr = step.prompt(ctx);
t("pedido: las 6 acciones y las 13 tareas, nada más", contract.acciones.every((a) => pr.includes(`- ${a.nombre}:`)) && mine.every((x) => pr.includes(`- ${x.id} [`)) && !/F1\.1|F4\.9|F2\.2/.test(pr));
t(`pedido chico (${pr.length} caracteres, < 2500)`, pr.length < 2500, String(pr.length));
const toy = enlacePrompt({ acciones: [{ nombre: "x", hace: "y" }] }, [{ id: "Z1", pieza: "logica", task: "w" }]);
const dom = [...new Set(toy.match(/\b(kanban|columnas?|tarjetas?|tablero|contador|juego)\b/gi) || [])];
t("el texto fijo del pedido no nombra ninguna app", dom.length === 0, dom.join(", "));

// ---------- 3. validar la respuesta ----------
const good = { crearTarjeta: ["F2.4", "F2.5"], moverTarjeta: ["F2.6", "F3.1"], editarTarjeta: ["F3.4", "F3.5"], borrarTarjeta: ["F3.7", "F3.6"], agregarEtiqueta: ["F4.3", "F4.4"], agregarComentario: ["F4.7", "F4.8"], [NINGUNA]: ["F3.2"] };
const pg = parseLinks(good, contract, mine);
t("respuesta completa → sin problemas", !pg.error && linkProblems(pg.reports[0]).length === 0, JSON.stringify(pg.reports[0]));
t("porTarea y ninguna (lo que lee el veredicto)", pg.reports[0].porTarea["F3.7"].join() === "borrarTarjeta" && pg.reports[0].ninguna.join() === "F3.2" && actionsByTask(pg.items[0])["F2.5"].join() === "crearTarjeta");
t("resumen", linksSummary(pg.items[0], pg.reports[0]) === "enlace: 13/13 tareas ubicadas · 6/6 acciones con tareas · ninguna: F3.2", linksSummary(pg.items[0], pg.reports[0]));
const messy = { CrearTarjeta: ["F2.4", "F2.5 (crear)"], crearCard: ["F2.6"], moverTarjeta: ["F2.6", "F9.9"], borrarTarjeta: ["F2.4"] };
const pm = parseLinks(messy, contract, mine), rm = pm.reports[0], probs = linkProblems(rm);
t("nombre con otra mayúscula se acepta; 'F2.5 (crear)' se lee como F2.5", pm.items[0].enlace.crearTarjeta.join() === "F2.4,F2.5");
t("acción que no existe, id que no es tarea, repetida y faltantes → problemas (no rompen)", rm.accionesDesconocidas.join() === "crearCard" && rm.idsDesconocidos.join() === "F9.9" && rm.repetidas.join() === "F2.4" && rm.faltan.length === 10 && probs.length === 4 && !probs.fatal, JSON.stringify(rm));
t("acciones sin tareas se informan pero no son problema", rm.accionesSinTareas.includes("editarTarjeta") && !probs.some((p) => /editarTarjeta/.test(p)));
t("no es un objeto → error", !!parseLinks([1], contract, mine).error && !!parseLinks("x", contract, mine).error);
t("no ubica nada → error", /no ubica ninguna/.test(parseLinks({ otra: ["F2.4"] }, contract, mine).error || ""));
t("de varios intentos se queda el mejor", bestLinks([pm.items[0], pg.items[0]], [rm, pg.reports[0]]) === 1);

// ---------- 3b. la respuesta REAL de Gemma (build 2026-10-15T02-27-10, 1er intento, 63 s) ----------
{
  const fx = "../../../../profiles/web/validation/fixtures/real_kanban_c15/";
  const c15 = J(fx + "contrato.json"), e15 = J(fx + "enlace.json");
  const raw = { ...e15.enlace, [NINGUNA]: e15.ninguna };
  const pr15 = parseLinks(raw, c15, mine);
  t("respuesta real de Gemma: 13/13 ubicadas, sin problemas; F3.2 (arrastrar) va a moverTarjeta", !pr15.error && linkProblems(pr15.reports[0]).length === 0 && pr15.reports[0].porTarea["F3.2"].join() === "moverTarjeta" && linksSummary(pr15.items[0], pr15.reports[0]) === "enlace: 13/13 tareas ubicadas · 6/6 acciones con tareas", JSON.stringify(pr15.reports[0]));
}

// ---------- 4. con la clase de paso data del motor (como en un build) ----------
{
  const env = { ctx, wrongNote: () => "" };
  const K = dataKind.make(step, env);
  const fence = (o) => "### FILE: enlace.json\n```json\n" + JSON.stringify(o) + "\n```";
  const take = (raw) => ({ "enlace.json": (raw.match(/```json\n([\s\S]*?)```/) || [])[1] || null });
  const p1 = await K.judge(take(fence(messy))), p2 = await K.judge(take(fence(good)));
  t("1er intento con problemas (se reintenta), 2º sin problemas", p1.length === 4 && !p1.fatal && p2.length === 0, JSON.stringify(p1));
  const out = mkdtempSync(join(tmpdir(), "enlace-")), files = {}, logs = [];
  const s = { rec: {}, content: {} };
  dataKind.store(step, K, s, { ctx, files, opts: {}, outDir: out, log: (l) => logs.push(l) });
  const saved = JSON.parse(readFileSync(join(out, "enlace.json"), "utf8"));
  t("enlace.json = el enlace elegido (el bueno), con versión e informe", saved.version === "enlace v0.1" && saved.enlace.borrarTarjeta.join() === "F3.7,F3.6" && saved.informe.faltan.length === 0);
  t("no arma ningún archivo de la app", Object.keys(files).length === 0);
  t("queda en el resumen del paso (lo lee Validation)", s.rec.data.report[0].porTarea["F4.8"].join() === "agregarComentario" && /13\/13 tareas ubicadas/.test(logs.join()));
  // opcional: sin nada válido no corta el build
  const K2 = dataKind.make(step, env);
  const bad = await K2.judge({ "enlace.json": '{"otra": []}' });
  const s2 = { rec: {}, content: {} }, logs2 = [];
  let threw = null;
  try { dataKind.store(step, K2, s2, { ctx: { ...ctx, data: { ...ctx.data } }, files: {}, opts: {}, outDir: mkdtempSync(join(tmpdir(), "enlace-")), log: (l) => logs2.push(l) }); } catch (e) { threw = e.message; }
  t("opcional: sin enlace válido no corta el build (queda roto y avisado)", bad.fatal && !threw && s2.rec.broken === true && s2.rec.optional === true && /opcional/.test(logs2.join()), threw || "");
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
