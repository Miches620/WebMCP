// test_files_engine.mjs — el motor por archivos es GENERAL.
//   node harness/test_files_engine.mjs
// Regla (Miche, 06/10): "Boxworld no puede existir dentro del Harness". Lo de un tipo de
// proyecto vive en un Standard (standards/…); acá se prueba con un Standard de juguete.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadScripts, runAcceptance, fatal, stripComments, buildFiles, extractFile } from "./files_engine.mjs";
import { playProblems, probeProblems, pageHtml, missingIds, WEB_FILES } from "../profiles/web/specialist/files_kit.mjs";
import { mkdtempSync } from "node:fs";
import { fixUndeclared, undefinedNames, isDeclared } from "./undeclared.mjs";
import { findMember as fm } from "./files_engine.mjs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";
import { STANDARDS, getStandard } from "../standards/registry.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

// 1. el motor no nombra ningún dominio (se miran el código y los textos, sin los comentarios)
const src = readFileSync(fileURLToPath(new URL("./files_engine.mjs", import.meta.url)), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");
const DOMAIN = /\b(niveles?|NIVELES|Reglas|cajas?|jugador|sokoban|boxworld|tablero|dibujar|dibujo|mover|ganado|juego|snake|controles)\b/gi;
const hits = [...new Set(src.match(DOMAIN) || [])];
t("files_engine.mjs no nombra ningún juego ni dominio", hits.length === 0, hits.join(", "));

// 1b. (12/10, Miche: "¿el harness es universal?") ningún archivo del harness importa de profiles/ ni
// nombra una plataforma: lo de web vive en profiles/web/specialist/files_kit.mjs
{
  const { readdirSync } = await import("node:fs");
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const own = readdirSync(dir).filter((f) => f.endsWith(".mjs") && !f.startsWith("test_"));
  const bad = own.flatMap((f) => [...readFileSync(dir + f, "utf8").matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]).filter((x) => /profiles\/|standards\/|roles\//.test(x)).map((x) => `${f} → ${x}`));
  t("el harness no importa nada de profiles/, standards/ ni roles/ (universal)", bad.length === 0, bad.join(", "));
  const webWords = own.flatMap((f) => { const code = readFileSync(dir + f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"); return (code.match(/\b(document|window|styles\.css|index\.html|Chromium|playwright|innerHTML|addEventListener)\b/g) || []).map((w) => `${f}: ${w}`); });
  t("el harness no nombra cosas de web (document, styles.css, index.html, playwright…)", webWords.length === 0, [...new Set(webWords)].join(", "));
}

// 2. un Standard de juguete (contador) corre con los mismos jueces
const toy = { file: "js/logica.js", global: "Logica", functions: ["sumar", "doble"], tests: [
  { name: "sumar 2+3", fn: "sumar", input: [2, 3], run: (G, [a, b]) => G.sumar(a, b) === 5 || `sumar(2,3) dio ${G.sumar(a, b)}` },
  { name: "doble de sumar", fn: "doble", after: "sumar", input: 3, run: (G, x) => G.doble(G.sumar(x, 1)) === 8 || "doble(sumar(3,1)) no da 8" },
], itemTests: [(G, item, i) => ({ name: `dato ${i + 1}`, fn: "sumar", ok: G.sumar(item, 0) === item, detail: `sumar(${item},0) ≠ ${item}` })] };
const L = loadScripts(["const DATOS = [1, 2];", "const Logica = { sumar(a, b) { return a + b; }, doble(x) { return 2 * x; } };"], ["DATOS", "Logica"]);
const r = runAcceptance(L.Logica, L.DATOS, toy);
t("runAcceptance: Standard de juguete pasa todo (2 pruebas + 2 datos)", r.failed.length === 0 && r.passed.length === 4, JSON.stringify(r));
const bad = runAcceptance(loadScripts(["const Logica = { sumar(a, b) { return a - b; }, doble(x) { return 2 * x; } };"], ["Logica"]).Logica, [], toy);
t("runAcceptance: la prueba dependiente se atribuye a la función rota (after)", bad.failed.every((f) => f.fn === "sumar") && bad.failed.length === 2, JSON.stringify(bad.failed));
t("runAcceptance: sin el global → contrato con los nombres del Standard", /js\/logica\.js tiene que definir const Logica = \{ sumar, doble \}/.test(runAcceptance(undefined, [], toy).failed[0].detail));
t("loadScripts: devuelve solo los globales pedidos", Object.keys(L).join() === "DATOS,Logica");

// 3. problemas que rompen el archivo
t("fatal: marca la lista sin cambiarla", fatal(["a"]).fatal === true && fatal(["a"])[0] === "a");
t("playProblems: no_js_errors en FAIL → fatal", playProblems([{ type: "no_js_errors", result: "FAIL", detail: "x" }]).fatal === true && !playProblems([{ type: "board_changes", result: "FAIL", detail: "x" }]).fatal);
t("probeProblems: sonda que no corrió o tiró → fatal con la llamada del Standard", probeProblems({ probe: null, errors: [] }, { call: "pintar(x)" }).fatal && /pintar\(x\) tiró un error/.test(probeProblems({ probe: { ok: false, error: "e" }, errors: [] }, { call: "pintar(x)" })[0]));
t("pageHtml: main con el id que declara el Standard", pageHtml({ title: "T", scripts: ["a.js"], mainId: "app" }).includes('<main id="app">'));
t("missingIds: genérico", missingIds("<div id='a'></div>", ["a", "b"]).join() === "b");

// 4. registro de Standards
t("registro: web/game/grilla existe y es DRAFT", STANDARDS["web/game/grilla"]?.status === "DRAFT");
t("registro: id desconocido → falla fuerte", (() => { try { getStandard("web/game/snake"); return false; } catch (e) { return /STANDARD_UNKNOWN/.test(e.message); } })());
const KINDS = ["data", "written", "logic", "screen", "render", "wiring"];
t("cada paso de cada Standard usa una clase que el motor conoce", Object.values(STANDARDS).every((s) => s.steps.every((st) => KINDS.includes(st.kind))));
t("cada 'needs' apunta a un paso anterior", Object.values(STANDARDS).every((s) => s.steps.every((st, i) => (st.needs || []).every((n) => s.steps.slice(0, i).some((p) => p.id === n)))));

// v0.9.6: un comentario no es código (b15: "No utiliza DOM ni window." bloqueó 3 intentos)
t("stripComments: saca comentarios de bloque y de línea, deja strings con //", !/window/.test(stripComments("/**\n * No utiliza DOM ni window.\n */\nconst a = 1; // ni window.x")) && /"http:\/\/x"/.test(stripComments('const u = "http://x";')));

// v0.9.7 (banco por paso): las entradas fijas fallan fuerte ANTES de llamar a Gemma
const benchErr = async (bench) => { try { await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "bench-")), { standard: getStandard("web/game/grilla"), platform: WEB_FILES, log: () => {}, bench }); return ""; } catch (e) { return e.message; } };
t("banco: paso que no existe en el Standard → BENCH_STEP", /BENCH_STEP/.test(await benchErr({ step: "snake", frozen: {} })));
t("banco: faltan las respuestas del paso de datos → BENCH_FROZEN (sin llamar a Gemma)", /BENCH_FROZEN/.test(await benchErr({ step: "reglas", frozen: { files: {}, raws: {} } })));

// v0.9.8 (banco 11/10): un bloque con nombre de OTRO archivo del proyecto no se toma por extensión
t("extractFile: js/dibujo.js no pasa por js/reglas.js; un nombre desconocido .js sí", extractFile("### FILE: js/dibujo.js\n```javascript\nD\n```", "js/reglas.js", ["js/reglas.js", "js/dibujo.js"]) === null && extractFile("### FILE: js/logica.js\n```javascript\nL\n```", "js/reglas.js", ["js/reglas.js", "js/dibujo.js"]) === "L\n" && extractFile("### FILE: js/dibujo.js\n```javascript\nD\n```", "js/reglas.js") === "D\n");

// v0.9.9 (banco --repair 11/10): variable sin declarar que es la traducción de un parámetro
{
  const AL = { estado: ["state"], objetivos: ["objectives"] };
  const code = `const Reglas = {
  crearEstado(nivel) { return { mapa: nivel }; },
  mover: function(estado, direccion) {
    const msg = "state is not defined"; // state en un comentario
    const x = estado.state;
    return { ...estado, mapa: state.mapa, t: \`\${state.mapa.length}\` };
  },
  ganado(estado) { const objetivos = estado.objetivos; return objectivos.every(Boolean); },
};`;
  const mem = ["crearEstado", "mover", "ganado"].map((n) => fm(code, n)).filter(Boolean);
  const r = fixUndeclared(code, undefinedNames(["la pared bloquea: tiró un error: state is not defined", "x: objectivos is not defined"]), mem, AL);
  t("undeclared: state → estado solo en mover (código y template), no en textos, comentarios ni e.state", r.fixes.some((f) => f.name === "state" && f.to === "estado" && f.fn === "mover" && f.count === 2) && /mapa: estado\.mapa/.test(r.code) && /\$\{estado\.mapa\.length\}/.test(r.code) && /"state is not defined"/.test(r.code) && /\/\/ state en un comentario/.test(r.code) && /estado\.state/.test(r.code), JSON.stringify(r.fixes));
  t("undeclared: objectivos → objetivos por casi igual (local de ganado)", r.fixes.some((f) => f.name === "objectivos" && f.to === "objetivos" && f.why === "casi igual") && /return objetivos\.every/.test(r.code));
  t("undeclared: si está declarado en algún lado, no se toca", fixUndeclared("const state = 1;\n" + code, ["state"], mem, AL).fixes.every((f) => f.name !== "state") && isDeclared("function f(a, state) {}", "state"));
  const two = `const R = {\n  mover(estado, state2) { return state.x; },\n};`;
  t("undeclared: con dos candidatos no adivina", fixUndeclared(two, ["state"], [fm(two, "mover")], { estado: ["state"], state2: ["state"] }).fixes.length === 0);
}

// v0.10: sin plataforma, el motor no adivina
t("motor sin plataforma → PLATFORM_REQUIRED", await (async () => { try { await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "p-")), { standard: getStandard("web/game/grilla"), log: () => {} }); return false; } catch (e) { return /PLATFORM_REQUIRED/.test(e.message); } })());
// v0.10.1 (web/app, 12/10): contrato que depende de un paso anterior, resolve(ctx) por paso y check en datos
{
  const seen = [];
  const toyP = { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "" }), finish: () => [],
    kinds: { toy: { make: () => { throw new Error("STOP"); }, store() {}, frozen: async (st, _fz, env) => { seen.push({ id: st.id, x: st.x, contract: env.contract() }); env.ctx.data[st.id] = st.id.toUpperCase(); } } } };
  const toyS = { id: "toy", version: "0", status: "DRAFT", scripts: [], contract: (ctx) => `C:${ctx.data.a || "-"}`,
    steps: [{ id: "a", kind: "toy" }, { id: "b", kind: "toy", resolve: (ctx) => ({ x: ctx.data.a }) }, { id: "c", kind: "toy" }] };
  const err = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "dyn-")), { standard: toyS, platform: toyP, log: () => {}, bench: { step: "c", frozen: {} } }).then(() => "", (e) => e.message);
  t("contrato dinámico: S.contract(ctx) ve lo que dejó el paso anterior", err === "STOP" && seen[0].contract === "C:-" && seen[1].contract === "C:A", JSON.stringify(seen));
  t("resolve(ctx): el paso se completa con datos de los anteriores (sin tocar el Standard)", seen[0].x === undefined && seen[1].x === "A" && toyS.steps[1].x === undefined);
  const { dataKind } = await import("./files_engine.mjs");
  const st = { id: "d", answer: "d.json", parse: (j) => ({ items: [j], reports: [{}], dropped: [] }), need: () => 1, missing: () => "falta", emit: (items, reports) => ({ items: [items.at(-1)], reports: [reports.at(-1)], js: "" }), check: (p) => (p.items[0].n < 2 ? ["n tiene que ser 2"] : []) };
  const K = dataKind.make(st, { ctx: {}, wrongNote: () => "" });
  const p1 = await K.judge({ "d.json": '{"n":1}' }), p2 = await K.judge({ "d.json": '{"n":2}' });
  t("datos: check da problemas que NO rompen (se reintenta y se queda el mejor)", p1.length === 1 && !p1.fatal && p2.length === 0);
}
// v0.11 (12/10, punto 8): un paso que escribe el código (st.write), no el modelo
{
  const judged = [];
  const toyP = { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "" }), finish: () => ["x.js"],
    kinds: { toy: { make: () => ({ judge: async (c) => { judged.push(c["x.js"]); return c["x.js"] === "hola" ? [] : ["el archivo no dice hola"]; } }), store(st, _K, s, env) { env.files[st.file] = s.content[st.file]; } } } };
  const toyS = (write) => ({ id: "toy", version: "0", status: "DRAFT", scripts: ["x.js"], contract: "C", steps: [{ id: "a", kind: "toy", file: "x.js", prompt: () => "p", write }] });
  const run = (S, opts = {}) => buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "write-")), { standard: S, platform: toyP, log: () => {}, ...opts });
  const r1 = await run(toyS((ctx) => ({ "x.js": "hola" })));
  t("write: el harness escribe el archivo, lo juzga una vez y no llama al modelo", r1.steps[0].by === "harness" && r1.steps[0].attempts.length === 1 && judged.join() === "hola" && r1.steps[0].problems_final.length === 0, JSON.stringify(r1.steps[0]));
  const r2 = await run(toyS(() => ({ "x.js": "chau" })));
  t("write: si el juez encuentra problemas no se reintenta (vienen de otro paso)", r2.steps[0].attempts.length === 1 && r2.steps[0].problems_final[0] === "el archivo no dice hola" && !r2.steps[0].broken);
  const e3 = await run(toyS(() => ({ "x.js": "hola" })), { noWrite: true }).then(() => "", (e) => e.message);
  t("write: con noWrite (--gemma-writes-all) se le pide al modelo", /fetch failed|ECONNREFUSED|LM Studio/i.test(e3), e3);
  // v0.11.1: clase de paso universal "written" (un archivo que escribe solo el código; no tiene pedido)
  const wS = (write, check) => ({ id: "w", version: "0", status: "DRAFT", scripts: ["h.js"], contract: "C", steps: [{ id: "h", kind: "written", file: "h.js", write, check }] });
  const wP = { ...toyP, finish: (env) => Object.keys(env.files) };
  const w1 = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "wr-")), { standard: wS(() => ({ "h.js": "var a = 1;" })), platform: wP, log: () => {}, noWrite: true });
  t("written: sin pedido para el modelo, lo escribe el código aunque se pida --gemma-writes-all", w1.steps[0].by === "harness" && w1.steps[0].problems_final.length === 0);
  const w2 = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "wr-")), { standard: wS(() => ({})), platform: wP, log: () => {} });
  t("written: si no pudo escribirlo (falta lo de un paso anterior) queda roto", w2.steps[0].broken === true && /no pudo escribir h\.js/.test(w2.steps[0].problems_final[0]));
  const w3 = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "wr-")), { standard: wS(() => ({ "h.js": "x" }), () => ["no sirve"]), platform: wP, log: () => {} });
  t("written: st.check del Standard decide si sirve", w3.steps[0].problems_final.join() === "no sirve");
}
// v0.13 (14/10, paso enlace): pasos opcionales, pedidos chicos (bare), pasos que no aplican y datos sin archivo.
// LM falso: se reemplaza fetch SOLO en esta prueba (no abre puertos ni llama a LM Studio).
{
  const seen = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const user = JSON.parse(init.body).messages[1].content; seen.push(user);
    const content = user.includes("PEDIDO A") ? '### FILE: a.json\n```json\n{"n":1}\n```' : "no sé";
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n`);
  };
  const D = (id, extra = {}) => ({ id, kind: "data", answer: `${id}.json`, prompt: () => `PEDIDO ${id.toUpperCase()}`, parse: (j) => ({ items: [j], reports: [{}], dropped: [] }), need: () => 1, missing: () => "falta", emit: (items, reports) => ({ items, reports, js: "JS" }), ...extra });
  const toyS = { id: "toy", version: "0", status: "DRAFT", scripts: [], contract: "CONTRATO-DEL-STANDARD",
    steps: [D("a", { file: "a.js" }), D("b", { optional: true, bare: true }), D("c", { skip: (ctx) => (ctx.tasks.length ? null : "no hay tareas") }), D("d", { file: "d.js", needs: ["b"], skip: () => "tampoco" })] };
  const toyP = { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "BRIEF-X", notes: "" }), finish: (env) => Object.keys(env.files), kinds: {} };
  let res = null, err = "";
  try { res = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "opt-")), { standard: toyS, platform: toyP, log: () => {} }); } catch (e) { err = e.message; }
  globalThis.fetch = realFetch;
  const rec = (id) => res?.steps.find((x) => x.task_id === id);
  t("opcional: un paso de datos opcional que falla 3 veces no corta el build", !err && rec("b").broken === true && rec("b").optional === true && rec("b").attempts.length === 3, err);
  t("bare: el pedido chico no lleva el brief ni el contrato del Standard; los demás sí", seen.filter((u) => u.includes("PEDIDO B")).every((u) => !u.includes("BRIEF-X") && !u.includes("CONTRATO-DEL-STANDARD")) && seen.find((u) => u.includes("PEDIDO A")).includes("BRIEF-X"));
  t("skip: un paso que no aplica no llama al modelo, no rompe y no cuenta como salteado", rec("c").not_applicable === true && rec("c").broken === false && !seen.some((u) => u.includes("PEDIDO C")) && !(res.skipped || []).includes("c"));
  t("skip va antes que needs: d (necesita b, roto) dice 'no aplica', no 'no funciona'", rec("d").not_applicable === true && rec("d").skipped === "tampoco");
  t("datos sin archivo: no aparece un archivo 'undefined' en la app", res.files.join() === "a.js", res?.files.join());
}
// v0.13.1 (p48): temperatura y seed llegan al pedido y quedan en el resultado; por defecto temperatura 0 y sin seed
{
  const bodies = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => { const b = JSON.parse(init.body); bodies.push(b);
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: '### FILE: a.json\n```json\n{"n":1}\n```' }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n`); };
  const D1 = { id: "a", kind: "data", answer: "a.json", prompt: () => "P", parse: (j) => ({ items: [j], reports: [{}], dropped: [] }), need: () => 1, missing: () => "falta", emit: (i, r) => ({ items: i, reports: r, js: "" }) };
  const S1 = { id: "toy", version: "0", status: "DRAFT", scripts: [], contract: "C", steps: [D1] };
  const P1 = { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "" }), finish: () => [], kinds: {} };
  const run = (o) => buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "smp-")), { standard: S1, platform: P1, log: () => {}, ...o });
  const r0 = await run({}), r1 = await run({ temperature: 0.7, seed: 3 });
  globalThis.fetch = realFetch;
  t("muestreo por defecto: temperatura 0, sin seed en el pedido", bodies[0].temperature === 0 && !("seed" in bodies[0]) && r0.sampling.temperature === 0 && r0.sampling.seed === null);
  t("muestreo de réplica: temperatura 0.7 y seed 3 en el pedido y en el resultado", bodies[1].temperature === 0.7 && bodies[1].seed === 3 && r1.sampling.seed === 3);
}
// v0.13.2: respuesta vacía cortada por límite (todo en razonamiento) → el reintento duplica el tope
{
  const bodies = [], realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = async (_url, init) => { bodies.push(JSON.parse(init.body)); n++;
    const ev = n === 1 ? { choices: [{ delta: { reasoning_content: "pienso…" }, finish_reason: "length" }], usage: { prompt_tokens: 100, completion_tokens: 1500, completion_tokens_details: { reasoning_tokens: 1497 } } }
      : { choices: [{ delta: { content: '### FILE: a.json\n```json\n{"n":1}\n```' }, finish_reason: "stop" }] };
    return new Response(`data: ${JSON.stringify(ev)}\n\ndata: [DONE]\n`); };
  const D1 = { id: "a", kind: "data", answer: "a.json", cap: 1500, prompt: () => "P", parse: (j) => ({ items: [j], reports: [{}], dropped: [] }), need: () => 1, missing: () => "falta", emit: (i, r) => ({ items: i, reports: r, js: "" }) };
  const r = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "cap-")), { standard: { id: "toy", version: "0", status: "DRAFT", scripts: [], contract: "C", steps: [D1] }, platform: { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "" }), finish: () => [], kinds: {} }, log: () => {} });
  globalThis.fetch = realFetch;
  const a0 = r.steps[0].attempts[0];
  // v0.13.3: cortada a la mitad (no vacía) también
  {
    const bodies2 = []; let m = 0;
    globalThis.fetch = async (_url, init) => { bodies2.push(JSON.parse(init.body)); m++;
      const ev = m === 1 ? { choices: [{ delta: { content: '### FILE: a.json\n```json\n{"n":' }, finish_reason: "length" }], usage: { prompt_tokens: 100, completion_tokens: 1500, completion_tokens_details: { reasoning_tokens: 1400 } } }
        : { choices: [{ delta: { content: '### FILE: a.json\n```json\n{"n":1}\n```' }, finish_reason: "stop" }] };
      return new Response(`data: ${JSON.stringify(ev)}\n\ndata: [DONE]\n`); };
    const r2 = await buildFiles({ refined: { project_name: "T", features: [] }, tasks: [] }, mkdtempSync(pjoin(tmpdir(), "cap2-")), { standard: { id: "toy", version: "0", status: "DRAFT", scripts: [], contract: "C", steps: [D1] }, platform: { id: "toy", systemPrompt: "s", prepare: () => ({ brief: "", notes: "" }), finish: () => [], kinds: {} }, log: () => {} });
    globalThis.fetch = realFetch;
    t("respuesta cortada a la mitad por el tope → también se duplica y el problema dice 'se cortó a la mitad (1400 pensando)'", bodies2[1].max_tokens === 3000 && /se cortó a la mitad: llegó al límite de 1500 tokens \(1400 pensando\)/.test(r2.steps[0].attempts[0].first_problems[0]), JSON.stringify(r2.steps[0].attempts[0].first_problems));
  }
  t("sin espacio para responder (vacía + length) → el reintento pide el doble de tokens y el problema lo dice", bodies[0].max_tokens === 1500 && bodies[1].max_tokens === 3000 && a0.out_of_budget === true && /se usó todo el espacio \(1500 tokens\) en pensar/.test(a0.first_problems[0]) && r.steps[0].attempts.length === 2 && !r.steps[0].broken, JSON.stringify({ m: bodies.map((b) => b.max_tokens), a0 }));
}
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
