// examples_bench.mjs — experimento "pruebas primero" (11/10, docs/DISENO_pruebas_primero.md).
//
// Pregunta: si Gemma escribe EJEMPLOS (datos) antes del código, ¿sirven como compuerta?
//   1. ¿Son correctos?  Se corren contra una lógica de referencia que pasa todas las pruebas del
//      harness. Un ejemplo que falla ahí tiene la expectativa equivocada.
//   2. ¿Atrapan errores? Se corren contra un BANCO de versiones de la lógica (las de los bancos por
//      paso) y se compara con el veredicto del harness: rota/rota, rota/pasa (se le escapó),
//      buena/rota (falsa alarma), buena/buena.
// Rojo: un ejemplo que pasa sobre el esqueleto que no hace nada no prueba nada y se descarta.
// El formato de los ejemplos y cómo se corren los declara el Standard (S.examples); este script es general.
// v0.2 (11/10): una muestra sin ejemplos válidos NO es una compuerta (antes contaba como "rechaza todo"
// y llenaba las falsas alarmas: 43/43 en 6 muestras). Se cuenta aparte.
//
//   node build/examples_bench.mjs --k 5 --bank build\bench\<carpeta> [--bank ...] <run_dir> [<run_dir> ...]
//   (--ref <archivo.js> para otra lógica de referencia; --out <dir> para retomar)

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProfiles } from "../profiles/registry.mjs";
import { getStandard } from "../standards/registry.mjs";
import { loadScripts, runAcceptance, extractFile } from "../harness/files_engine.mjs";
import { FILE_PROMPT } from "../profiles/web/specialist/files_kit.mjs";
import { briefText } from "../profiles/web/landing/specialist_spa.mjs";
import { rulesBrief } from "../profiles/web/app/specialist_rules.mjs";
import { parseJsonLoose } from "../json_loose.mjs";
import { chatStream } from "./lm_stream.mjs";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const flags = (n) => args.flatMap((a, i) => (a === n ? [args[i + 1]] : []));
const K = Number(flag("--k", 5));
const valued = new Set(["--k", "--bank", "--ref", "--out", "--temp"]);
const runDirs = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
const bankDirs = flags("--bank");
const TEMP = Number(flag("--temp", 0));
if (!runDirs.length || !bankDirs.length) { console.log("uso: node build/examples_bench.mjs --k 5 --bank build\\bench\\<carpeta> <run_dir> ..."); process.exit(1); }
const LM = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "google/gemma-4-e4b";
const REFS = ["BX-1042", "QM-7731", "TR-2208", "LP-5160", "ZN-3397", "HD-8824", "WK-6015", "CF-4473", "JV-9286", "RS-1559"];
if (K > REFS.length) throw new Error(`--k como máximo ${REFS.length}`);

const first = JSON.parse(readFileSync(join(runDirs[0], "input.json"), "utf8"));
const profile = resolveProfiles(first.refined.profiles);
const pmod = (await import(new URL(`../profiles/${profile.build}/profile.mjs`, import.meta.url))).default;
const S = getStandard(pmod.standard);
const X = S.examples;
if (!X) throw new Error(`el Standard ${S.id} no declara "examples"`);
const logic = S.steps.find((s) => s.id === X.step);
const refPath = flag("--ref") || fileURLToPath(new URL("../profiles/web/validation/fixtures/game_files_ok/js/reglas.js", import.meta.url));
const REF = loadScripts([readFileSync(refPath, "utf8")], [logic.global])[logic.global];
if (!REF || runAcceptance(REF, [], logic).failed.length) throw new Error(`la referencia ${refPath} no pasa las pruebas del harness: no sirve de referencia`);
const SKEL = loadScripts([X.skeleton], [logic.global])[logic.global];

// ---- banco: versiones de la lógica con el veredicto del harness (recalculado con el Standard actual) ----
const bank = [];
for (const b of bankDirs) for (const d of readdirSync(b)) {
  const f = join(b, d, "app", logic.file);
  if (!existsSync(f) || !statSync(f).size) continue;
  const G = loadScripts([readFileSync(f, "utf8")], [logic.global]);
  if (G.error || !G[logic.global]) { bank.push({ id: `${basename(b)}/${d}`, G: null, harnessOk: false }); continue; }
  const a = runAcceptance(G[logic.global], [], logic);
  bank.push({ id: `${basename(b)}/${d}`, G: G[logic.global], harnessOk: a.failed.length === 0 });
}
const okN = bank.filter((v) => v.harnessOk).length;
console.log(`[EJEMPLOS] Standard ${S.id} v${S.version} · banco: ${bank.length} versiones de ${logic.file} (${okN} buenas y ${bank.length - okN} rotas según el harness) · k=${K}`);
if (!okN || okN === bank.length) console.log("[EJEMPLOS] ojo: el banco tiene solo buenas o solo rotas; la comparación queda a medias");

const outRoot = flag("--out") || join("build", "bench", `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_ejemplos`);
mkdirSync(outRoot, { recursive: true });
writeFileSync(join(outRoot, "bench.json"), JSON.stringify({ version: "examples_bench v0.2", standard: { id: S.id, version: S.version }, k: K, temperature: TEMP, ref: refPath, bank: bank.map((v) => ({ id: v.id, harnessOk: v.harnessOk })), cases: runDirs }, null, 2));

const runOn = (G, items) => items.map((ex) => (G ? X.run(G, ex) : "no carga"));
const results = [];
const cases = runDirs.map((d) => ({ dir: d, input: JSON.parse(readFileSync(join(d, "input.json"), "utf8")) }));
for (let i = 0; i < K; i++) for (const c of cases) {
  const name = c.input.refined?.project_name || basename(c.dir);
  const dir = join(outRoot, `${name}_${String(i + 1).padStart(2, "0")}`);
  const rf = join(dir, "result.json");
  if (existsSync(rf)) { results.push(JSON.parse(readFileSync(rf, "utf8"))); console.log(`[EJEMPLOS] ${name} #${i + 1} (ya estaba)`); continue; }
  mkdirSync(dir, { recursive: true });
  const user = `Referencia del pedido: ${REFS[i]}\n\nBRIEF:\n${briefText(c.input.refined)}\n\n${rulesBrief(c.input.refined)}\n\n${S.contract}\n\n${X.prompt({})}\n\n`;
  const t0 = Date.now();
  let r;
  try {
    const data = await chatStream(LM, { model: MODEL, messages: [{ role: "system", content: FILE_PROMPT }, { role: "user", content: user }], temperature: TEMP, max_tokens: 4000 });
    const raw = data.content || "";
    writeFileSync(join(dir, "ejemplos.raw.txt"), raw, "utf8");
    const txt = extractFile(raw, X.answer) || (raw.match(/\{[\s\S]*"ejemplos"[\s\S]*\}/) || [])[0];
    const pj = txt ? parseJsonLoose(txt) : { ok: false, error: "no trajo ejemplos.json" };
    const parsed = pj.ok ? X.parse(pj.data) : { error: pj.error };
    if (parsed.error) throw new Error(parsed.error);
    // rojo: lo que pasa sobre el esqueleto no prueba nada
    const red = runOn(SKEL, parsed.items);
    const items = parsed.items.filter((_, j) => red[j] !== true);
    const weak = parsed.items.filter((_, j) => red[j] === true).map((x) => x.nombre);
    // 1. ¿correctos? contra la referencia
    const onRef = runOn(REF, items);
    const wrong = items.map((x, j) => ({ x, r: onRef[j] })).filter((o) => o.r !== true).map((o) => o.r);
    const correct = items.filter((_, j) => onRef[j] === true);
    // 2. ¿atrapan errores? contra el banco (compuerta = TODOS los ejemplos que pasaron el rojo)
    const gate = (list) => {
      if (!list.length) return null; // sin ejemplos no hay compuerta
      const m = { rota_rota: 0, rota_pasa: 0, buena_rota: 0, buena_buena: 0 };
      for (const v of bank) { const ok = runOn(v.G, list).every((x) => x === true); m[`${v.harnessOk ? "buena" : "rota"}_${ok ? (v.harnessOk ? "buena" : "pasa") : "rota"}`]++; }
      return m;
    };
    r = { case: name, i: i + 1, ref: REFS[i], ms: Date.now() - t0, propuestos: parsed.items.length + parsed.dropped.length, descartados: parsed.dropped, flojos: weak, validos: items.length, incorrectos: wrong, correctos: correct.length, compuerta: gate(items), compuerta_solo_correctos: gate(correct) };
  } catch (e) {
    r = { case: name, i: i + 1, ref: REFS[i], ms: Date.now() - t0, error: String(e.message || e) };
  }
  writeFileSync(rf, JSON.stringify(r, null, 2));
  results.push(r);
  console.log(`[EJEMPLOS] ${name} #${i + 1}: ${r.error ? `ERROR ${r.error.slice(0, 100)}` : `${r.validos} válidos (${r.correctos} correctos, ${r.incorrectos.length} con la expectativa mal) · ${r.compuerta ? `escapan ${r.compuerta.rota_pasa}/${bank.length - okN} rotas · falsas alarmas ${r.compuerta.buena_rota}/${okN}` : "sin compuerta"}`} · ${Math.round(r.ms / 1000)}s`);
}

// ---- resumen ----
const ok = results.filter((r) => !r.error);
const sum = (f) => ok.reduce((a, r) => a + f(r), 0);
const rows = [`\n| ejemplos de Gemma | total |\n|---|---|`,
  `| muestras (sin error) | ${ok.length}/${results.length} |`,
  `| ejemplos propuestos | ${sum((r) => r.propuestos)} |`,
  `| descartados por forma | ${sum((r) => r.descartados.length)} |`,
  `| flojos (pasan sobre el esqueleto) | ${sum((r) => r.flojos.length)} |`,
  `| válidos | ${sum((r) => r.validos)} |`,
  `| **con la expectativa equivocada** (fallan en la referencia) | ${sum((r) => r.incorrectos.length)} de ${sum((r) => r.validos)} |`,
  `| muestras con TODOS los ejemplos correctos | ${ok.filter((r) => !r.incorrectos.length).length}/${ok.length} |`];
const g = (k, key) => sum((r) => r[k]?.[key] || 0);
const nG = (k) => ok.filter((r) => r[k]).length;
rows.push(`\n| como compuerta (${bank.length} versiones; muestras con al menos un ejemplo: ${nG("compuerta")} y ${nG("compuerta_solo_correctos")}) | todos los válidos | solo los correctos |\n|---|---|---|`);
for (const [key, label] of [["rota_rota", "rota y la atrapa"], ["rota_pasa", "**rota y se le escapa**"], ["buena_rota", "**buena y la rechaza** (falsa alarma)"], ["buena_buena", "buena y la deja pasar"]])
  rows.push(`| ${label} | ${g("compuerta", key)} | ${g("compuerta_solo_correctos", key)} |`);
const freq = {};
for (const r of ok) for (const w of r.incorrectos) { const k = w.replace(/^[^:]*: /, "").replace(/\d+/g, "#").slice(0, 80); freq[k] = (freq[k] || 0) + 1; }
const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);
if (top.length) rows.push(`\nExpectativas equivocadas más repetidas:\n${top.map(([k, n]) => `- ${n}× ${k}`).join("\n")}`);
const errs = results.filter((r) => r.error);
if (errs.length) rows.push(`\n${errs.length} muestra(s) con ERROR: ${[...new Set(errs.map((e) => e.error.slice(0, 100)))].join(" | ")}`);
const summary = rows.join("\n");
console.log(summary);
writeFileSync(join(outRoot, "results.json"), JSON.stringify(results, null, 2));
writeFileSync(join(outRoot, "resumen.md"), `# Ejemplos de Gemma como compuerta (${S.id} v${S.version})\n\n- banco: ${bankDirs.join(", ")}\n- casos: ${runDirs.join(", ")}\n- k=${K}, temperature ${TEMP}\n${summary}\n`);
