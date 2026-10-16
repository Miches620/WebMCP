// test_completeness_reviewer.mjs — reviewer v0.8 (tandas, tope por contexto, reintentos por tipo de error).
//   node test_completeness_reviewer.mjs
// Datos reales: requisitos y tareas del pipeline del Kanban del 16/10 (fixtures/reviewer/, sacados de
// evidence/term_coverage/), el input con el que el reviewer v0.6 se cortó 3 veces. LM Studio se simula.
import { readFileSync } from "node:fs";
import { runCompletenessReview, chunk, outputBudget, salvageObjects, readVerdicts, REVIEWER_VERSION, BATCH, MAX_ATTEMPTS } from "./completeness_reviewer3.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/reviewer/${n}`, import.meta.url), "utf8"));
const K22 = fx("kanban_2026-10-16_22tareas.json"), K28 = fx("kanban_2026-10-16_28tareas.json");
const PROMPT = "Kanban\nFeatures:\n" + K22.requirements.map((r, i) => `${i + 1}. ${r.text}`).join("\n");
const stageBlock = { block: "ETAPA DEL PROYECTO: PROTOTIPO", sha256: "test" };

// ---- LM Studio simulado: lee los ids pedidos y contesta con un veredicto por id ----
const askedIds = (body) => {
  const user = body.messages[1].content;
  const m = user.match(/A EVALUAR EN ESTA RESPUESTA[^\n]*:\n([^\n]+)$/);
  return m ? m[1].split(", ") : [];
};
const verdict = (id) => (id.startsWith("R")
  ? { requirement_id: id, covered: true, covering_task_ids: ["F1.1"], reason: `cubierto ${id}` }
  : { task_id: id, in_scope: true, reason: `en alcance ${id}` });
const answer = (ids, wantAmb) => {
  const o = {};
  const req = ids.filter((x) => x.startsWith("R")), task = ids.filter((x) => !x.startsWith("R"));
  if (req.length) o.requirement_verdicts = req.map(verdict);
  if (task.length) o.task_verdicts = task.map(verdict);
  if (wantAmb) o.ambiguous_findings = [{ reference: "Completado / Completa", reason: "dos nombres para la misma columna" }];
  return JSON.stringify(o, null, 2);
};
const reply = (content, finish = "stop") => ({ ok: true, json: async () => ({ choices: [{ message: { content }, finish_reason: finish }], usage: { completion_tokens: 100 } }) });
function fakeLM(script = () => null) {
  const log = [];
  const f = async (url, init) => {
    const body = JSON.parse(init.body);
    const ids = askedIds(body);
    const wantAmb = /"ambiguous_findings"/.test(body.messages[0].content);
    log.push({ ids, max_tokens: body.max_tokens, wantAmb, system: body.messages[0].content, user: body.messages[1].content });
    const s = script(log.length, ids, wantAmb);
    if (s) return s;
    return reply(answer(ids, wantAmb));
  };
  f.log = log;
  return f;
}
const run = (lm, extra = {}, data = K22) => runCompletenessReview(PROMPT, data.tasks, { requirements: data.requirements, fetchImpl: lm, stageBlock, retryWaitMs: 0, ...extra });

// ---------- 1. piezas ----------
t("versión y constantes", REVIEWER_VERSION === "completeness_reviewer v0.8-tandas" && BATCH === 10 && MAX_ATTEMPTS === 3);
t("chunk parte en grupos", chunk([1, 2, 3, 4, 5], 2).map((c) => c.length).join() === "2,2,1");
t("tope = contexto − pedido − margen (16000, pedido de 9000 caracteres → 12488)", outputBudget(9000, 16000) === 16000 - 3000 - 512, String(outputBudget(9000, 16000)));
t("tope nunca baja de 1024 aunque el pedido sea enorme", outputBudget(100000, 16000) === 1024);
{
  // la respuesta cortada real: termina a mitad de un "reason"
  const full = answer(["R1", "R2", "R3"], false);
  const cut = full.slice(0, full.indexOf("cubierto R3") + 4);
  const v = readVerdicts(cut);
  t("respuesta cortada a mitad de string: no es JSON entero, pero se rescatan los 2 veredictos completos", !v.whole && v.req.map((x) => x.requirement_id).join() === "R1,R2", JSON.stringify(v));
  t("rescate ignora objetos sin la clave pedida", salvageObjects('{"a":1} {"task_id":"F1.1","in_scope":true}', "task_id").length === 1);
  t("respuesta entera con fence se lee entera", readVerdicts("```json\n" + full + "\n```").whole);
}

// ---------- 2. el caso de hoy: 17 requisitos + 22 tareas ----------
{
  const lm = fakeLM();
  const r = await run(lm);
  t("sin cortes: 5 tandas (R1-R10, R11-R17, F 1-10, F 11-20, F 21-22) y todos los veredictos", lm.log.length === 5 && r.schema_complete && r.raw_verdicts.requirement_verdicts.length === 17 && r.raw_verdicts.task_verdicts.length === 22, String(lm.log.length));
  t("cada tanda pide solo sus ids, con el contexto completo (las 22 tareas en todas)", lm.log[0].ids.join() === K22.requirements.slice(0, 10).map((x) => x.id).join() && lm.log.every((c) => K22.tasks.every((x) => c.user.includes(`${x.id}: `))));
  t("AMBIGUOUS solo en la primera tanda", lm.log[0].wantAmb && lm.log.slice(1).every((c) => !c.wantAmb) && r.findings.filter((f) => f.type === "AMBIGUOUS").length === 1);
  t("tope de cada llamada sale del contexto (16000), no 2048", lm.log.every((c) => c.max_tokens > 2048 && c.max_tokens < 16000), lm.log.map((c) => c.max_tokens).join());
  t("cada llamada queda en calls (crudo + finish_reason)", r.calls.length === 5 && r.calls.every((c) => c.raw && c.finish_reason === "stop"));
  t("GAP/EXCESS siguen derivados por el harness (todo cubierto → 0)", r.coverage_score === 1 && !r.findings.some((f) => f.type === "GAP" || f.type === "EXCESS"));
}

// ---------- 3. corte por largo → se piden solo los que faltan ----------
{
  const lm = fakeLM((n, ids, amb) => {
    if (n !== 1) return null;
    const full = answer(ids, amb);
    return reply(full.slice(0, full.indexOf(`cubierto ${ids[4]}`) + 3), "length"); // se corta en el 5º
  });
  const r = await run(lm);
  t("corte en la tanda 1: el 2º intento pide solo R5..R10 (los 4 primeros se rescataron)", lm.log[1].ids.join() === K22.requirements.slice(4, 10).map((x) => x.id).join() && r.schema_complete, JSON.stringify(lm.log[1].ids));
  t("el corte queda registrado como 'corte' con finish_reason=length", r.calls[0].finish_reason === "length" && /^corte: la respuesta se cortó por largo/.test(r.calls[0].error));
  t("el reintento vuelve a pedir AMBIGUOUS (no llegó en la cortada)", lm.log[1].wantAmb);
}

// ---------- 4. red: se repite igual ----------
{
  let n = 0;
  const lm = fakeLM((k) => { if (k <= 2) { n++; throw new Error("fetch failed"); } return null; });
  const r = await run(lm);
  t("LM Studio no responde 2 veces → al 3º sale, mismo pedido", n === 2 && lm.log[2].ids.join() === lm.log[0].ids.join() && r.schema_complete && r.calls[0].error === "red: fetch failed");
}

// ---------- 5. faltan ids sin corte (el modelo se olvida) ----------
{
  const lm = fakeLM((n, ids, amb) => (n === 1 ? reply(answer(ids.filter((x) => x !== "R3"), amb)) : null));
  const r = await run(lm);
  t("se olvidó R3 → 2º intento pide solo R3", lm.log[1].ids.join() === "R3" && r.schema_complete && /^faltan: no trajo veredicto de R3/.test(r.calls[0].error));
  t("un veredicto con id que no se pidió no se cuenta", (await run(fakeLM((n, ids, amb) => (n === 1 ? reply(answer([...ids, "R99"], amb)) : null)))).raw_verdicts.requirement_verdicts.every((v) => v.requirement_id !== "R99"));
}

// ---------- 6. después de 3 intentos → decide Miche, con el motivo en palabras ----------
{
  const lm = fakeLM((n, ids, amb) => (ids.includes("R1") ? reply(answer(ids, amb).slice(0, 40), "length") : null));
  const r = await run(lm);
  const sys = r.findings.find((f) => f.type === "SYSTEM_ERROR");
  t("siempre se corta → 3 intentos de esa tanda y SYSTEM_ERROR", r.calls.filter((c) => c.batch === 1).length === 3 && !!sys && r.coverage_score === null);
  t("el motivo dice qué falta y que se cortó por largo (no 'revisá LM Studio')", /tanda 1: faltan R1, .* tras 3 intentos \(la respuesta se cortó por largo/.test(sys.reason) && !/LM Studio no respondió/.test(sys.reason), sys.reason);
  t("las demás tandas igual corren y quedan en raw_verdicts", r.raw_verdicts.task_verdicts.length === 22);
  const lmDown = fakeLM(() => { throw new Error("fetch failed"); });
  const rd = await run(lmDown, {}, { requirements: K22.requirements.slice(0, 2), tasks: K22.tasks.slice(0, 2) });
  t("LM Studio caído → el motivo sí dice que LM Studio no respondió", /LM Studio no respondió: fetch failed/.test(rd.findings[0].reason) && lmDown.log.length === 6, rd.findings[0].reason);
}

// ---------- 7. el input más grande de hoy (28 tareas) y la regla covered sin ids ----------
{
  const lm = fakeLM((n, ids, amb) => {
    if (!ids.includes("R2")) return null;
    const o = JSON.parse(answer(ids, amb));
    o.requirement_verdicts.find((v) => v.requirement_id === "R2").covering_task_ids = [];
    return reply(JSON.stringify(o));
  });
  const r = await run(lm, {}, K28);
  t("28 tareas → 2 + 3 tandas, completo", lm.log.length === 5 && r.raw_verdicts.task_verdicts.length === 28);
  t("covered=true sin tareas → GAP corregido por el harness (regla de v0.6)", r.findings.some((f) => f.type === "GAP" && f.requirement_id === "R2" && f.corrected_by_harness));
}

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
