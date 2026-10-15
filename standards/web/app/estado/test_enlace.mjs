// test_enlace.mjs — paso ENLACE del Standard web/app/estado (v0.1: acción por tarea; v0.2: lista/requisito también).
//   node standards/web/app/estado/test_enlace.mjs
// Datos reales: contrato del build 2026-10-15T00-25-22 (fixture real_kanban_c14), tareas y features del snapshot de
// la receta v0.3, y la respuesta REAL de Gemma con el pedido v0.1 (build 2026-10-15T02-27-10, fixture c15).
import { readFileSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import S from "./standard.mjs";
import { linkTasksOf, enlacePrompt, parseLinks, linkProblems, bestLinks, linksSummary, actionsByTask, aspectReqs, NINGUNA, ENLACE_VERSION } from "./enlace.mjs";
import { dataKind } from "../../../../harness/files_engine.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const J = (rel) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8"));

const contract = J("../../../../profiles/web/validation/fixtures/real_kanban_c14/contrato.json");
const snap = J("../../../../build/snapshots/kanban_receta_v03_snapshot.json");
const tasks = snap.atomicTasks, features = snap.intentForge.refined_prompt.features;
const mine = linkTasksOf(tasks);
const step = S.steps.find((s) => s.id === "enlace");

// ---------- 1. el paso ----------
t("enlace es el último paso, de datos, opcional y con pedido chico (bare)", S.steps.at(-1).id === "enlace" && step.kind === "data" && step.optional === true && step.bare === true && step.needs.join() === "contrato" && !step.file);
t("v0.2: van TODAS las tareas con pieza (28 de 28)", mine.length === 28 && ENLACE_VERSION === "enlace v0.2");
t("sin tareas con pieza (corrida sin receta) → no aplica", /sin receta/.test(step.skip({ tasks: [{ id: "a", task: "x" }] }) || "") && step.skip({ tasks }) === null);

// ---------- 2. el pedido ----------
const ctx = { data: { contrato: { items: [contract] } }, tasks, hints: { features }, paso: "PASO 7 de 7" };
const pr = step.prompt(ctx);
t("pedido: acciones, listas del estado (con cuántos elementos), requisitos de aspecto y las 28 tareas", contract.acciones.every((a) => pr.includes(`- ${a.nombre}:`)) && /- columnas\[\]\.tarjetas\[\]\.etiquetas \(\d+ elementos? con: nombre, color\)/.test(pr) && /- R8: Sombras en tarjetas/.test(pr) && !/- R1:/.test(pr) && mine.every((x) => pr.includes(`- ${x.id} [${x.pieza}]`)), pr.slice(0, 1500));
t(`pedido chico (${pr.length} caracteres, < 5000)`, pr.length < 5000, String(pr.length));
t("requisitos de aspecto = los 'se_ve' del contrato (R7, R8, R9); sin se_ve, todos", aspectReqs(contract, features).map((r) => r.id).join() === "R7,R8,R9" && aspectReqs({ se_ve: [] }, ["a", "b"]).map((r) => r.id).join() === "R1,R2");
const toy = enlacePrompt({ acciones: [{ nombre: "x", hace: "y" }], estado: { cosas: [{ id: 1, n: "a" }] } }, [{ id: "Z1", pieza: "logica", task: "w" }], ["f"]);
const dom = [...new Set(toy.match(/\b(kanban|columnas?|tarjetas?|tablero|contador|juego)\b/gi) || [])];
t("el texto fijo del pedido no nombra ninguna app", dom.length === 0, dom.join(", "));

// ---------- 3. validar la respuesta ----------
const good = {
  crearTarjeta: ["F2.4", "F2.5"], moverTarjeta: ["F2.6", "F3.1"], editarTarjeta: ["F3.4", "F3.5"], borrarTarjeta: ["F3.7", "F3.6"], agregarEtiqueta: ["F4.3", "F4.4"], agregarComentario: ["F4.7", "F4.8"],
  columnas: ["F1.2", "F1.3", "F1.4"], "columnas[].tarjetas": ["F2.1", "F2.2", "F3.3"], "columnas[].tarjetas[].etiquetas": ["F4.1", "F4.2"], comentarios: ["F4.5", "F4.6"],
  R7: ["F1.1", "F4.10"], R8: ["F2.7", "F4.9"], R9: ["F2.7", "F4.9"], [NINGUNA]: ["F3.2", "F2.3"],
};
const P = (j) => parseLinks(j, contract, mine, features);
const pg = P(good), rg = pg.reports[0];
t("respuesta completa → sin problemas", !pg.error && linkProblems(rg).length === 0, JSON.stringify(rg));
t("lista por su último tramo ('comentarios') si no es ambiguo", rg.listaDe["F4.6"] === "columnas[].tarjetas[].comentarios");
t("estilo en dos requisitos vale (no es 'repetida')", rg.requisitosDe["F2.7"].join() === "R8,R9" && !rg.repetidas.length);
t("lo que lee el veredicto: porTarea, listaDe, requisitosDe, ninguna", rg.porTarea["F3.7"].join() === "borrarTarjeta" && rg.listaDe["F2.2"] === "columnas[].tarjetas" && rg.requisitosDe["F1.1"].join() === "R7" && rg.ninguna.join() === "F3.2,F2.3" && actionsByTask(pg.items[0])["F2.5"].join() === "crearTarjeta");
t("resumen", linksSummary(pg.items[0], rg) === "enlace: 28/28 tareas ubicadas · 6/6 acciones con tareas · 4 listas · 3 requisitos · ninguna: F3.2, F2.3", linksSummary(pg.items[0], rg));
const wrong = { ...good, crearTarjeta: ["F2.4", "F2.5", "F2.2"], "columnas[].tarjetas": ["F2.1", "F3.3", "F2.4"], R7: ["F1.1", "F4.10", "F4.2"] };
const rw = P(wrong).reports[0];
t("tarea en un destino que no es de su pieza → 'mal ubicada' con lo que corresponde", rw.malUbicadas.map((m) => `${m.id}>${m.quiere}`).sort().join() === "F2.2>lista,F2.4>accion,F4.2>lista" && /F2\.2 \[vista\] va en una LISTA DEL ESTADO, no en "crearTarjeta"/.test(linkProblems(rw).join(" ")), JSON.stringify(rw.malUbicadas));
const rep = P({ ...good, columnas: ["F1.2", "F1.3", "F1.4", "F2.2"] }).reports[0];
t("vista en dos listas → repetida", rep.repetidas.join() === "F2.2", JSON.stringify(rep.repetidas));
const messy = { CrearTarjeta: ["F2.4", "F2.5 (crear)"], crearCard: ["F2.6"], moverTarjeta: ["F2.6", "F9.9"], R1: ["F1.1"] };
const rm = P(messy).reports[0], probs = linkProblems(rm);
t("nombre con otra mayúscula; 'F2.5 (crear)' = F2.5; destino que no existe (crearCard, R1 no es de aspecto); id que no es tarea", P(messy).items[0].enlace.crearTarjeta.join() === "F2.4,F2.5" && rm.accionesDesconocidas.sort().join() === "R1,crearCard" && rm.idsDesconocidos.join() === "F9.9" && !probs.fatal, JSON.stringify(rm));
t("no es un objeto → error; no ubica nada → error", !!P([1]).error && /no ubica ninguna/.test(P({ otra: ["F2.4"] }).error || ""));
t("de varios intentos se queda el mejor", bestLinks([P(messy).items[0], pg.items[0]], [rm, rg]) === 1);

// ---------- 3b. la respuesta REAL de Gemma con el pedido v0.1 (build 2026-10-15T02-27-10) ----------
{
  const fx = "../../../../profiles/web/validation/fixtures/real_kanban_c15/";
  const e15 = J(fx + "enlace.json");
  const raw = { ...e15.enlace, [NINGUNA]: e15.ninguna };
  const r15 = parseLinks(raw, J(fx + "contrato.json"), mine, features).reports[0];
  t("respuesta v0.1 real: sus 13 siguen bien ubicadas; con v0.2 faltan las 15 de vista/datos/estilo (se le piden)", r15.ubicadas === 13 && r15.faltan.length === 15 && !r15.malUbicadas.length && r15.porTarea["F3.2"].join() === "moverTarjeta", JSON.stringify({ u: r15.ubicadas, f: r15.faltan.length }));
}

// ---------- 4. con la clase de paso data del motor (como en un build) ----------
{
  const env = { ctx, wrongNote: () => "" };
  const K = dataKind.make(step, env);
  const fence = (o) => "### FILE: enlace.json\n```json\n" + JSON.stringify(o) + "\n```";
  const take = (raw) => ({ "enlace.json": (raw.match(/```json\n([\s\S]*?)```/) || [])[1] || null });
  const p1 = await K.judge(take(fence(messy))), p2 = await K.judge(take(fence(good)));
  t("1er intento con problemas (se reintenta), 2º sin problemas", p1.length >= 3 && !p1.fatal && p2.length === 0, JSON.stringify(p1));
  const out = mkdtempSync(join(tmpdir(), "enlace-")), files = {}, logs = [];
  const s = { rec: {}, content: {} };
  dataKind.store(step, K, s, { ctx, files, opts: {}, outDir: out, log: (l) => logs.push(l) });
  const saved = JSON.parse(readFileSync(join(out, "enlace.json"), "utf8"));
  t("enlace.json = el enlace elegido (el bueno), con versión, listas, requisitos e informe", saved.version === "enlace v0.2" && saved.enlace.borrarTarjeta.join() === "F3.7,F3.6" && saved.listas["columnas[].tarjetas"].includes("F2.2") && saved.requisitos.R8.includes("F4.9") && saved.informe.faltan.length === 0);
  t("no arma ningún archivo de la app", Object.keys(files).length === 0);
  t("queda en el resumen del paso (lo lee Validation)", s.rec.data.report[0].porTarea["F4.8"].join() === "agregarComentario" && s.rec.data.report[0].listaDe["F4.2"] === "columnas[].tarjetas[].etiquetas" && /28\/28 tareas ubicadas/.test(logs.join()));
  const K2 = dataKind.make(step, env);
  const bad = await K2.judge({ "enlace.json": '{"otra": []}' });
  const s2 = { rec: {}, content: {} }, logs2 = [];
  let threw = null;
  try { dataKind.store(step, K2, s2, { ctx: { ...ctx, data: { ...ctx.data } }, files: {}, opts: {}, outDir: mkdtempSync(join(tmpdir(), "enlace-")), log: (l) => logs2.push(l) }); } catch (e) { threw = e.message; }
  t("opcional: sin enlace válido no corta el build (queda roto y avisado)", bad.fatal && !threw && s2.rec.broken === true && s2.rec.optional === true && /opcional/.test(logs2.join()), threw || "");
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
