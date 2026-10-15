// files_engine.mjs — motor UNIVERSAL del Specialist "por archivos" (v0.10, 12/10).
//
// Decisión de Miche (06/10): Harness → Standard → Validation profile. Y (12/10): el harness tiene
// que ser universal; lo de una plataforma (web, firmware…) vive en su profile.
// Este archivo NO sabe de web ni de ningún dominio (lo vigila una prueba: no importa nada de
// profiles/ ni nombra juegos). Recibe:
//   - opts.standard  QUÉ se construye: pasos, contrato, pruebas, datos (standards/…);
//   - opts.platform  CON QUÉ: pedido de sistema, clases de paso (screen/render/wiring en web; logic
//                    para JavaScript), contexto del pedido y cómo se arma el resultado
//                    (profiles/web/specialist/files_kit.mjs).
// Qué hace el motor:
//   - corre los PASOS del Standard, un archivo (o dos) por paso de Gemma;
//   - cada paso: hasta 3 intentos SOLO de ese archivo; arreglo previo de la plataforma (p.ej.
//     sintaxis), arreglos deterministas y reparación de la clase de paso; se queda con el mejor
//     intento (un archivo que no compila / no carga siempre pierde);
//   - si un paso del que dependo quedó roto, no me corre (no me culpa);
//   - la clase de paso "data" (Gemma propone datos JSON, el Standard los valida) es universal y vive acá;
//   - banco por paso (opts.bench): carga los pasos anteriores de un build viejo y corre uno solo.
//
// Historia: v0.8–v0.9.9 todo junto en este archivo (ver docs/CAMBIOS.md). v0.10 (12/10): se separa
// el borde, sin cambios de conducta (pedidos a Gemma idénticos byte a byte, verificado con un LM falso):
// harness/js_tools.mjs (lenguaje JS), harness/kinds_js.mjs (clase logic), y el kit web en profiles/web.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chatStream } from "../build/lm_stream.mjs";
import { estTokens } from "../build/tokens.mjs";
import { parseJsonLoose } from "../json_loose.mjs";
import { assignByStep, assignmentText, assignmentSummary } from "./assignments.mjs";
// compatibilidad: las herramientas de JS se siguen pudiendo importar desde acá (viven en js_tools.mjs)
export { loadScripts, syntaxOf, runAcceptance, findMember, replaceMember, stripComments, topNames, clashes, shadowProblems } from "./js_tools.mjs";

export const ENGINE_VERSION = "files_engine v0.12.1";
const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "google/gemma-4-e4b";
const CONTEXT = Number(process.env.WEBMCP_CONTEXT) || 16000;

// ---------- problemas que rompen el archivo ----------
/** Marca una lista de problemas como "el archivo no compila / no carga / no cumple el contrato". */
export const fatal = (list) => Object.assign([...list], { fatal: true });
const scoreOf = (has, problems) => (!has ? Infinity : problems.fatal ? 1000 + problems.length : problems.length);

// ---------- respuesta ----------
/** others (v0.9.8): archivos del proyecto que NO son este. Un bloque con nombre de otro archivo no se
 *  toma "por extensión" (banco 11/10: Gemma escribió js/dibujo.js en el paso de reglas y el harness lo
 *  juzgó como reglas.js: "no puede usar document"). */
export function extractFile(raw, name, others = []) {
  const r = String(raw || "");
  const re = new RegExp("###\\s*(?:FILE|APPEND):\\s*([\\w./\\-]+)[^\\n]*\\n+```[\\w-]*\\n([\\s\\S]*?)```", "g");
  const ext = name.split(".").pop();
  let m, byExt = null;
  while ((m = re.exec(r))) {
    if (m[1] === name || m[1].endsWith("/" + name.split("/").pop())) return m[2];
    const isOther = others.some((o) => o !== name && (m[1] === o || m[1].endsWith("/" + o.split("/").pop())));
    if (!byExt && !isOther && m[1].endsWith("." + ext)) byExt = m[2];
  }
  if (byExt) return byExt;
  if (others.length && /###\s*(?:FILE|APPEND):/.test(r)) return null; // trajo otros archivos con nombre: no se adivina
  const lang = ext === "js" ? "(?:javascript|js)" : ext;
  const f = r.match(new RegExp("```" + lang + "\\n([\\s\\S]*?)```"));
  return f ? f[1] : null;
}
const langOf = (n) => (n.endsWith(".css") ? "css" : n.endsWith(".html") ? "html" : n.endsWith(".json") ? "json" : "javascript");

// ---------- clase de paso universal: data ----------
// v0.9.1 (Boxworld b10): los datos válidos de TODOS los intentos se juntan (antes cada intento
// empezaba de cero: b10 tuvo 4, 3 y 2 niveles válidos y se quedó con 4 de los 5 pedidos).
export const dataKind = {
  make: (st, env) => {
    const { ctx } = env;
    const pool = [], seen = new Set();
    let last = { dropped: [] };
    const final = () => {
      const items = pool.map((p) => p.item), reports = pool.map((p) => p.report);
      const em = st.emit(items, reports, ctx);
      return { items: em.items, reports: em.reports, js: em.js, dropped: last.dropped, need: st.need(ctx), summary: { valid: em.items.length, need: st.need(ctx), report: em.reports, dropped: last.dropped } };
    };
    return {
      judge: async (c) => {
        const txt = c[st.answer];
        // v0.9.6 (Depósito): sin el archivo pedido, Gemma escribió otro (js/niveles.js con strings): se le recuerda el formato
        if (!txt) return fatal([`la respuesta no trajo ### FILE: ${st.answer}.${env.wrongNote(st)}${st.answerHint ? ` ${st.answerHint}` : ""}`]);
        const pj = parseJsonLoose(txt);
        if (!pj.ok) return fatal([`el JSON no se puede leer: ${pj.error}`]);
        const out = st.parse(pj.data, ctx);
        if (out.error) return fatal([out.error]);
        last = out;
        out.items.forEach((item, i) => { const k = JSON.stringify(item); if (!seen.has(k)) { seen.add(k); pool.push({ item, report: out.reports[i] }); } });
        c.parsed = final();
        const need = st.need(ctx);
        // v0.10.1 (web/app): st.check(parsed, ctx) → problemas que NO rompen (se reintenta y se queda el mejor)
        return pool.length >= need ? (st.check ? st.check(c.parsed, ctx) : []) : fatal([...out.dropped, st.missing(pool.length, need, ctx)]);
      },
      final,
      count: () => pool.length,
    };
  },
  store: (st, K, s, env) => {
    const { ctx, files, opts, outDir, log } = env;
    const parsed = K.final();
    if (!parsed?.items?.length && opts.bench) { s.rec.data = { valid: 0 }; return "stop"; } // banco: sin datos = muestra rota, no error
    if (!parsed?.items?.length) throw new Error(`${st.id}: ningún dato válido después de 3 intentos (${(s.rec.problems_final || []).slice(0, 3).join(" | ")})`);
    ctx.data[st.id] = parsed;
    files[st.file] = parsed.js;
    // v0.12.1 (14/10, build 2026-10-14T22-19-17): el archivo de respuesta era el del intento con menos problemas,
    // pero st.emit puede elegir datos de OTRO intento (el pool junta todos): contrato.json no coincidía con
    // js/datos.js y la compuerta probó ids de otro estado. Si el Standard sabe escribir lo elegido, se guarda eso.
    writeFileSync(join(outDir, st.answer), st.answerOf ? st.answerOf(parsed, ctx) : String(s.content[st.answer] || ""), "utf8");
    s.rec.data = parsed.summary;
    s.rec.broken = false; // lo que quedó alcanza (los datos inválidos se descartan)
    log(`[SPECIALIST]   ${st.summaryText ? st.summaryText(parsed) : `${parsed.items.length} datos válidos`}`);
  },
  // banco: los datos se rearman con TODAS las respuestas crudas de ese paso (el pool junta intentos);
  // el archivo que se usa es el del build congelado, tal cual
  frozen: async (st, fz, env) => {
    const K = dataKind.make(st, env);
    let pr = [];
    for (const raw of fz.raws?.[st.id] || []) pr = await K.judge({ [st.answer]: extractFile(raw, st.answer) });
    const parsed = K.final();
    if (!parsed?.items?.length) throw new Error(`BENCH_FROZEN: las respuestas de ${st.id} del build congelado no dan datos válidos (${[...pr].slice(0, 2).join(" | ")})`);
    env.ctx.data[st.id] = parsed; env.files[st.file] = fz.files?.[st.file] || parsed.js;
  },
};

// ---------- clase de paso universal: written (v0.11.1) ----------
// Un archivo que escribe SOLO el código (st.write), sin modelo: p.ej. una ayuda que sale entera del contrato.
// Se juzga con st.check(contenido, env) si el Standard lo da (p.ej. que compile); si no, alcanza con que exista.
export const writtenKind = {
  make: (st, env) => ({
    judge: async (c) => {
      const names = st.files || [st.file];
      const miss = names.filter((x) => !c[x]);
      if (miss.length) return fatal([`el harness no pudo escribir ${miss.join(", ")} (falta lo que necesita de un paso anterior)`]);
      return st.check ? await st.check(c, env) : [];
    },
  }),
  store: (st, _K, s, env) => { for (const x of st.files || [st.file]) env.files[x] = s.content[x]; },
  frozen: async (st, fz, env) => { const c = st.write(env.ctx) || {}; for (const x of st.files || [st.file]) env.files[x] = fz.files?.[x] || c[x] || ""; },
};

// ---------- build ----------
/**
 * Corre los pasos del Standard con las herramientas de una plataforma.
 * @param {{refined, tasks}} input
 * @param {string} outDir
 * @param {{standard, platform, log?, model?, pagePlan?, check?:boolean, forbidden?:string[], skills?, bench?, temperature?}} opts
 */
export async function buildFiles({ refined, tasks }, outDir, opts = {}) {
  const S = opts.standard;
  if (!S?.steps?.length) throw new Error("STANDARD_REQUIRED: el motor por archivos necesita un Standard con pasos");
  const P = opts.platform;
  if (!P?.kinds || !P.systemPrompt || !P.prepare || !P.finish) throw new Error("PLATFORM_REQUIRED: el motor por archivos necesita una plataforma (kit) con systemPrompt, kinds, prepare y finish");
  const log = opts.log || console.log;
  const model = opts.model || MODEL;
  const hints = S.hints ? S.hints(refined) : {};
  const prep = P.prepare({ refined, tasks }, opts, S);
  const { brief, notes } = prep;
  mkdirSync(join(outDir, "app"), { recursive: true });
  const files = Object.fromEntries([...(P.extraFiles || []), ...S.scripts].map((f) => [f, ""]));
  // v0.12 (14/10, punto 9): con la receta del Standard (opts.recipe) cada tarea trae su pieza y cada paso
  // recibe SUS tareas ("TAREAS DE ESTE PASO"). Sin receta o sin piezas (corrida vieja): notas, como antes.
  const assignment = assignByStep(tasks || [], opts.recipe || null, S.steps.map((x) => x.id));
  const ctx = { hints, notes: assignment ? "" : notes, ...(prep.initial || {}), data: {}, files, total: S.steps.length, paso: "" };
  const steps = [];
  const byId = {};
  const out = {};
  const KINDS = { data: dataKind, written: writtenKind, ...P.kinds };
  // opts.skills = { role, status, list: [{ id, kinds, text }] } (lo arma el profile con el Role)
  const skillsFor = (kind) => {
    const mine = (opts.skills?.list || []).filter((x) => x.kinds.includes(kind));
    return mine.length ? `HABILIDADES (lo que sabe hacer un programador con experiencia en este tipo de proyecto):\n${mine.map((x) => `- ${x.text}`).join("\n")}` : "";
  };

  const ask = async (system, user, cap) => {
    const leak = (opts.forbidden || []).find((f) => f && user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`criterio holdout filtrado al Specialist: "${leak}"`);
    const promptTokens = estTokens(system) + estTokens(user);
    const maxTokens = Math.max(1500, Math.min(cap, CONTEXT - promptTokens - 200));
    const t0 = Date.now();
    const data = await chatStream(LM_STUDIO_URL, { model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: opts.temperature ?? 0, max_tokens: maxTokens });
    return { raw: data.content || "", ms: Date.now() - t0, finish_reason: data.finish_reason ?? null, reasoning_chars: data.reasoning_chars ?? 0, usage: data.usage ?? null, ttft_ms: data.ttft_ms ?? null, promptTokens, maxTokens };
  };
  const fence = (lang, s) => "```" + lang + "\n" + (String(s || "").trim() || "(vacío)") + "\n```";
  const retryBlock = (prev, problems, names) => problems.length
    ? `PROBLEMAS DE TU VERSIÓN ANTERIOR (los encontró el harness):\n${problems.map((p) => "- " + p).join("\n")}\n\nTU VERSIÓN ANTERIOR:\n${names.map((n) => `### FILE: ${n}\n${fence(langOf(n), prev?.[n])}`).join("\n\n")}\n\nDevolvé ${names.join(" y ")} corregido(s), completo(s).`
    : "";
  const answerOf = (st) => st.answer ? [st.answer] : st.files || [st.file];
  const known = [...new Set([...(P.extraFiles || []), ...S.scripts, ...S.steps.flatMap((x) => answerOf(x))])];
  let lastWrong = [];
  const wrongNote = (st) => lastWrong.length ? ` Trajiste ${lastWrong.join(" y ")}: ese archivo es de otro paso. En este paso escribí SOLO ${answerOf(st).join(" y ")}.` : "";
  const loadedBefore = (st) => S.scripts.slice(0, S.scripts.indexOf(st.file)).map((f) => files[f]);
  // lo que reciben las clases de paso y la plataforma
  // v0.10.1 (web/app): el contrato puede depender de lo que dio un paso anterior (S.contract(ctx))
  const contract = () => (typeof S.contract === "function" ? S.contract(ctx) : S.contract);
  const env = { S, P, opts, ctx, files, outDir, log, ask, fence, skillsFor, steps, out, wrongNote, loadedBefore, contract, title: prep.title, features: prep.features };
  env.page = P.pageFor ? P.pageFor(env) : null;

  // ---- un paso: hasta 3 intentos del MISMO archivo ----
  const runStep = async (st, n, K) => {
    const { judge, repair } = K;
    const names = answerOf(st);
    const rec = { n, task_id: st.id, kind: st.kind, files: names, attempts: [] };
    const mine = assignment?.byStep[st.id] || [];
    if (assignment) rec.tareas = mine.map((t) => t.id);
    log(`[SPECIALIST] ${n}/${S.steps.length} ${names.join(" + ")}`);
    ctx.paso = `PASO ${n} de ${S.steps.length}`;
    // v0.11 (12/10, punto 8): un paso que escribe el CÓDIGO, no el modelo. El Standard decide cuál
    // (st.write(ctx) → { archivo: contenido }) cuando ese archivo sale entero de datos ya validados;
    // el motor no sabe de qué dominio es. Se juzga con el mismo juez de la clase de paso y no se
    // reintenta (el mismo código daría lo mismo): si quedan problemas, vienen de un paso anterior.
    // opts.noWrite = todo lo escribe el modelo (para comparar con y sin), salvo los pasos que no tienen
    // pedido para el modelo (st.prompt): esos los escribe siempre el código.
    if (typeof st.write === "function" && (!opts.noWrite || typeof st.prompt !== "function")) {
      const t0 = Date.now();
      const content = st.write(ctx) || {};
      const problems = await judge(content);
      rec.by = "harness";
      rec.attempts.push({ k: 0, by: "harness", ms: Date.now() - t0, first_problems: [...problems], first_fatal: !!problems.fatal, problems: [...problems] });
      rec.problems_final = [...problems];
      rec.broken = !!problems.fatal || !names.some((x) => content[x]);
      steps.push(rec);
      log(`[SPECIALIST]   ${problems.length ? `✗ ${problems.length} problema(s): ${problems.slice(0, 3).join(" | ").slice(0, 300)}` : "✓"} · lo escribió el harness (sin modelo)${mine.length ? ` · cubre ${mine.map((t) => t.id).join(", ")}` : ""}`);
      return { content, rec };
    }
    let best = null, prev = null, problems = [];
    for (let k = 0; k < (opts.bench?.maxAttempts || 3); k++) {
      ctx.have = K.count ? K.count() : 0;
      // datos: lo válido ya quedó guardado; el reintento pide solo lo que falta (b11: los reintentos
      // re-mandaban los 5 niveles y repetían el mismo error)
      const retry = st.kind === "data" ? (problems.length ? `PROBLEMAS DE TU RESPUESTA ANTERIOR (los encontró el harness):\n${problems.map((p) => "- " + p).join("\n")}` : "") : retryBlock(prev, problems, names);
      // v0.9.5 (paso 3): Skills del Role para ESTA clase de paso (opts.skills; sin --skills el pedido no cambia)
      const sk = skillsFor(st.kind);
      // banco (v0.9.8): la línea neutra va ADELANTE; el pedido del paso sigue siendo lo último que lee Gemma
      // (11/10: con la línea al final, en Invernadero escribió js/dibujo.js las 5 veces)
      // v0.12: las tareas del paso van ANTES del pedido del paso (el pedido sigue siendo lo último que lee Gemma)
      const tareas = assignmentText(mine);
      const user = (opts.bench?.prefix ? `${opts.bench.prefix}\n\n` : "") + `BRIEF:\n${brief}\n\n${contract()}\n\n${sk ? sk + "\n\n" : ""}${tareas ? tareas + "\n\n" : ""}${st.prompt(ctx)}\n\n` + retry;
      const r = await ask(P.systemPrompt, user, st.cap || 4000);
      writeFileSync(join(outDir, `step_${String(n).padStart(2, "0")}_${st.id}${k ? ".retry" + k : ""}.raw.txt`), r.raw, "utf8");
      const att = { k, ms: r.ms, finish_reason: r.finish_reason, reasoning_chars: r.reasoning_chars, prompt_tokens_est: r.promptTokens, max_tokens: r.maxTokens };
      // 12/10: tokens REALES que informa LM Studio (prompt_tokens_est es solo largo/3.2). Solo se registran.
      att.prompt_tokens = r.usage?.prompt_tokens ?? null;
      att.completion_tokens = r.usage?.completion_tokens ?? null;
      att.reasoning_tokens = r.usage?.completion_tokens_details?.reasoning_tokens ?? null;
      att.context_used = att.prompt_tokens != null && att.completion_tokens != null ? att.prompt_tokens + att.completion_tokens : null;
      att.context_limit = CONTEXT;
      att.prefill_ms = r.ttft_ms;
      // arreglo previo de la plataforma (en web: declaración repetida y sintaxis de un .js)
      const raw = P.preFix ? await P.preFix({ raw: r.raw, names, known, att, st, n, env }) : r.raw;
      let content = Object.fromEntries(names.map((x) => [x, extractFile(raw, x, known)]));
      // v0.9.8: si trajo OTRO archivo del proyecto en vez del pedido, el problema lo dice
      lastWrong = names.some((x) => !content[x]) ? [...String(raw).matchAll(/###\s*(?:FILE|APPEND):\s*([\w./\-]+)/g)].map((m) => m[1]).filter((f) => !names.some((x) => x === f || f.endsWith("/" + x.split("/").pop()))) : [];
      if (lastWrong.length) att.wrong_files = lastWrong;
      if (st.take) content = st.take(raw, content);
      // v0.9.9: arreglos deterministas de la clase de paso (sin Gemma), antes de juzgar
      if (K.fix) content = (await K.fix(content, att)) || content;
      problems = await judge(content);
      att.first_problems = [...problems]; // v0.9.7 (banco por paso): lo que dio la respuesta de Gemma, antes de reparar
      att.first_fatal = !!problems.fatal;
      if (problems.length && repair && !opts.bench?.noRepair) {
        const fixed = await repair(content, problems, att);
        if (fixed) { const p2 = await judge(fixed); if (scoreOf(true, p2) < scoreOf(true, problems)) { content = fixed; problems = p2; } }
      }
      att.problems = [...problems];
      rec.attempts.push(att);
      const has = names.some((x) => content?.[x]);
      const score = scoreOf(has, problems);
      if (!best || score < best.score) best = { content, problems, score };
      prev = content;
      log(`[SPECIALIST]   ${problems.length ? `✗ ${problems.length} problema(s): ${problems.slice(0, 3).join(" | ").slice(0, 300)}` : "✓"}${k ? ` (reintento ${k})` : ""} · ${Math.round(r.ms / 1000)}s${att.context_used != null ? ` · ${att.prompt_tokens}+${att.completion_tokens}=${att.context_used} tok` : ""}`);
      if (!problems.length) break;
    }
    rec.problems_final = [...best.problems];
    rec.broken = !!best.problems.fatal || best.score === Infinity;
    steps.push(rec);
    return { content: best.content, rec };
  };
  const skipStep = (st, n, reason) => {
    const rec = { n, task_id: st.id, kind: st.kind, files: answerOf(st), attempts: [], skipped: reason, broken: true, problems_final: [`no se corrió: ${reason}`] };
    log(`[SPECIALIST] ${n}/${S.steps.length} ${rec.files.join(" + ")} — NO se corre: ${reason}`);
    steps.push(rec);
    return { content: {}, rec };
  };

  log(`[SPECIALIST] tareas por paso: ${assignmentSummary(assignment)}`);
  if (opts.skills) log(`[SPECIALIST] Skills del Role ${opts.skills.role} (${opts.skills.status}): ${opts.skills.list.map((x) => x.id).join(", ")}`);
  log(`[SPECIALIST] ${ENGINE_VERSION} · Standard ${S.id} v${S.version} (${S.status}) · plataforma ${P.id || "?"}: ${S.steps.length} pasos chicos (un archivo por paso)${S.hintsText ? ` · ${S.hintsText(hints)}` : ""}`);
  // v0.9.7 (10/10, banco por paso): opts.bench = { step, frozen: { files, fragment, raws }, maxAttempts, prefix, noRepair }.
  // Los pasos de antes NO se piden a Gemma: se cargan de un build anterior (entradas fijas); se corre
  // solo `step` y se corta. Así la diferencia entre muestras viene solo del pedido de ese paso.
  const benchAt = opts.bench ? S.steps.findIndex((x) => x.id === opts.bench.step) : -1;
  if (opts.bench && benchAt < 0) throw new Error(`BENCH_STEP: "${opts.bench.step}" no es un paso del Standard ${S.id} (${S.steps.map((x) => x.id).join(", ")})`);
  for (const [i, st0] of S.steps.entries()) {
    const n = i + 1;
    // v0.10.1 (web/app): st.resolve(ctx) completa el paso con lo que dieron los anteriores (funciones y
    // pruebas que salen del contrato). Sin resolve el paso es el mismo objeto de siempre.
    if (opts.bench && i > benchAt) break;
    const st = st0.resolve ? { ...st0, ...st0.resolve(ctx) } : st0;
    const kind = KINDS[st.kind];
    if (!kind) throw new Error(`STANDARD_STEP_KIND: "${st.kind}" (paso ${st.id}) no existe en el motor ni en la plataforma ${P.id || "?"} (${Object.keys(KINDS).join(", ")})`);
    if (opts.bench && i < benchAt) {
      await kind.frozen(st, opts.bench.frozen || {}, env);
      byId[st.id] = { broken: false, files: answerOf(st), problems_final: [] };
      continue;
    }
    const broken = (st.needs || []).map((id) => byId[id]).find((r) => r?.broken);
    if (broken) { byId[st.id] = skipStep(st, n, `${broken.files.join(" + ")} no funciona (${String(broken.problems_final[0] || "").slice(0, 120)})`).rec; continue; }
    const K = kind.make(st, env);
    const s = await runStep(st, n, K);
    byId[st.id] = s.rec;
    if (kind.store(st, K, s, env) === "stop") break;
  }

  const outFiles = P.finish(env);
  const skipped = steps.filter((s) => s.skipped).map((s) => s.task_id);
  log(`[SPECIALIST] app/: ${outFiles.join(", ")}${steps.some((s) => s.problems_final.length) ? ` · quedan problemas en: ${steps.filter((s) => s.problems_final.length).map((s) => s.task_id).join(", ")}` : " · todos los pasos OK"}`);
  const firstLogic = S.steps.find((s) => s.kind === "logic");
  return {
    model, specialist_version: ENGINE_VERSION, platform: P.id || null, standard: { id: S.id, version: S.version, status: S.status },
    skills: opts.skills ? { role: opts.skills.role, status: opts.skills.status, ids: opts.skills.list.map((x) => x.id) } : null,
    files: outFiles,
    hints, data: Object.fromEntries(Object.entries(ctx.data).map(([k, v]) => [k, v.summary])),
    rule_tests: firstLogic ? out.acceptance?.[firstLogic.id] : undefined, acceptance: out.acceptance,
    ...(skipped.length ? { skipped } : {}), order: steps.map((s) => s.task_id),
    // v0.12: qué tareas recibió cada paso (null = sin piezas, tareas como notas)
    assignment: assignment && {
      byStep: Object.fromEntries(Object.entries(assignment.byStep).map(([k, l]) => [k, l.map((t) => t.id)])),
      autorDe: assignment.autorDe, sinPieza: assignment.sinPieza.map((t) => t.id), piezaDesconocida: assignment.piezaDesconocida.map((t) => t.id), pasosSinTareas: assignment.pasosSinTareas,
    },
    steps: steps.map((s) => ({ ...s, ms: s.attempts.reduce((a, b) => a + b.ms, 0), finish_reason: s.attempts.at(-1)?.finish_reason, changed: s.files, rejected: s.problems_final })),
  };
}
