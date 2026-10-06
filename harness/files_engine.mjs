// files_engine.mjs — motor GENERAL del Specialist "por archivos" (v0.9, 06/10).
//
// Decisión de Miche (06/10): Harness → Standard → Validation profile. El harness es general
// para todas las ejecuciones; lo específico de un tipo de proyecto (qué archivos, qué contrato,
// qué pruebas, qué datos) lo declara un STANDARD (standards/…) que el Specialist recibe en su
// tarea. "Hoy Boxworld, mañana Boxworld + Snake, pasado Boxworld + Snake + Miner: inviable."
// Regla de este archivo: no nombra ningún juego ni ningún dominio (lo vigila una prueba).
//
// Qué hace el motor:
//   - corre los PASOS que declara el Standard, un archivo (o dos) por paso de Gemma;
//   - cada paso: hasta 3 intentos SOLO de ese archivo; reparación de sintaxis por tramo;
//     declaración repetida sin Gemma; reparación de una sola función; se queda con el mejor
//     intento (un archivo que no compila / no carga siempre pierde);
//   - si un paso del que dependo quedó roto, no me corre (no me culpa).
// Clases de paso (kind), cada una con su juez general:
//   data    Gemma propone datos (JSON); el Standard los valida y escribe el .js
//   logic   lógica pura sin DOM; se carga en Node y corre las pruebas de aceptación del Standard
//   screen  fragmento HTML + CSS; ids que pide el Standard
//   render  función que dibuja; se prueba en Chromium con la sonda del Standard
//   wiring  eventos y arranque; chequeos de interacción (Validation) que pide el Standard
//
// Historia (antes vivía en profiles/web/game/specialist_files.mjs, game_files v0.8–v0.8.2):
// v0.8 un archivo = un paso con contrato fijo · v0.8.1 intento sin archivo nunca gana, reparación
// por método, nombres repetidos entre archivos · v0.8.2 no-carga siempre pierde, fixRedeclare,
// sin cascada, presupuesto de reparación = el del archivo, lint de sombra.

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { chatStream } from "../build/lm_stream.mjs";
import { estTokens } from "../build/tokens.mjs";
import { briefText } from "../profiles/web/landing/specialist_spa.mjs";
import { assignTasks, notesText, componentsFromPlan } from "../profiles/web/landing/components.mjs";
import { repairSyntax } from "../profiles/web/landing/specialist_components.mjs";
import { fixRedeclare } from "../profiles/web/specialist/encapsulation.mjs";
import { runChecks } from "../profiles/web/validation/check_catalog.mjs";
import { rulesBrief } from "../profiles/web/app/specialist_rules.mjs";
import { parseJsonLoose } from "../json_loose.mjs";

export const ENGINE_VERSION = "files_engine v0.9";
const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
const MODEL = "google/gemma-4-e4b";
const CONTEXT = Number(process.env.WEBMCP_CONTEXT) || 16000;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const FILE_PROMPT = `Sos el Specialist de MicheLab. Programás un proyecto web en VARIOS archivos chicos, como un programador prolijo. En cada paso escribís UN archivo (o dos, si se te piden) y nada más.

Respondé SOLO con el bloque o los bloques pedidos:
### FILE: <nombre>
\`\`\`<lenguaje>
...
\`\`\`

Cómo trabajar:
1. Respetá el CONTRATO: mismos nombres, misma forma de los datos, mismos ids. Usá solo lo que el contrato dice que existe.
2. JavaScript clásico (sin import/export, sin módulos, sin fetch). Nada de recursos externos (CDN, fuentes web, imágenes por URL); para íconos, emoji.
3. Contenido en español. Código corto y claro: funciones chicas.
4. Si te devuelven PROBLEMAS, corregilos y devolvé el archivo completo.`;

export const memberFixPrompt = (file, label) => `Corregís UNA función de ${file} (${label}).
Recibís el CONTRATO, las PRUEBAS DEL HARNESS QUE FALLAN y la función. Devolvé SOLO la función corregida, completa, con el mismo nombre y los mismos parámetros, en UN bloque \`\`\`javascript (con la misma forma: si era "nombre(params) {", devolvé "nombre(params) {"). Sin explicaciones.`;

// ---------- problemas que rompen el archivo ----------
/** Marca una lista de problemas como "el archivo no compila / no carga / no cumple el contrato". */
export const fatal = (list) => Object.assign([...list], { fatal: true });
const scoreOf = (has, problems) => (!has ? Infinity : problems.fatal ? 1000 + problems.length : problems.length);

// ---------- cargar scripts en Node ----------
/** Corre los scripts (en orden) en un contexto aislado y devuelve los globales pedidos. */
export function loadScripts(codes, globals = []) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  const grab = globals.map((g) => `globalThis.__g_${g} = typeof ${g} !== "undefined" ? ${g} : undefined;`).join(" ");
  try { vm.runInContext(codes.join("\n;\n") + "\n;" + grab, ctx, { timeout: 2000 }); } catch (e) { return { error: String(e.message || e) }; }
  return Object.fromEntries(globals.map((g) => [g, ctx[`__g_${g}`]]));
}
export const syntaxOf = (code) => { try { new vm.Script(code || ""); return null; } catch (e) { return e.message; } };

// ---------- pruebas de aceptación de un paso logic ----------
/**
 * Corre las pruebas que declara el Standard sobre el objeto global de la lógica.
 * step.tests: [{name, fn, after?, input, run(G, input) → true | "mensaje"}]
 * step.itemTests: [(G, item, i) → {name, fn, ok, detail}] — una por cada dato (p.ej. cada nivel)
 * @returns {{passed:string[], failed:{name,fn,after,detail}[]}}
 */
export function runAcceptance(G, items, step) {
  const passed = [], failed = [];
  const fns = step.functions || [];
  if (!G || fns.some((f) => typeof G[f] !== "function"))
    return { passed, failed: [{ name: "contrato", detail: `${step.file} tiene que definir const ${step.global} = { ${fns.join(", ")} } (${fns.length === 1 ? "la función" : `las ${fns.length} funciones`}).` }] };
  for (const t of step.tests || []) {
    let r;
    try { r = t.run(G, t.input); } catch (e) { r = `${t.name}: tiró un error: ${e.message}`; }
    if (r === true) passed.push(t.name); else failed.push({ name: t.name, fn: t.fn, after: t.after, detail: r });
  }
  (items || []).forEach((item, i) => {
    for (const it of step.itemTests || []) {
      let r;
      try { r = it(G, item, i); } catch (e) { r = { name: `dato ${i + 1}`, fn: null, ok: false, detail: `tiró: ${e.message}` }; }
      if (r.ok) passed.push(r.name); else failed.push({ name: r.name, fn: r.fn, detail: r.detail });
    }
  });
  // una prueba que depende de otra función se atribuye a esa función si ella también falla
  // (b9: se "reparó" ganado, que estaba bien, porque mover no empujaba)
  for (const f of failed) if (f.after && failed.some((g) => g.fn === f.after && !g.after)) f.fn = f.after;
  return { passed, failed };
}

// ---------- reparación por función ----------
function blockEndLines(lines, from) {
  let depth = 0, seen = false, q = null, block = false;
  for (let i = from; i < lines.length; i++) {
    const l = lines[i];
    for (let k = 0; k < l.length; k++) {
      const ch = l[k], nx = l[k + 1];
      if (block) { if (ch === "*" && nx === "/") { block = false; k++; } continue; }
      if (q) { if (ch === "\\") { k++; continue; } if (ch === q) q = null; continue; }
      if (ch === "/" && nx === "/") break;
      if (ch === "/" && nx === "*") { block = true; k++; continue; }
      if (ch === "'" || ch === '"' || ch === "`") { q = ch; continue; }
      if (ch === "{") { depth++; seen = true; } else if (ch === "}") { depth--; if (seen && depth === 0) return i; }
    }
    if (q !== "`") q = null;
  }
  return -1;
}
/** Dónde está un método o función `name` (líneas 1-based): `name(…) {`, `name: function (…) {`, `function name(…) {`, `const name = …`. */
export function findMember(js, name) {
  const lines = String(js || "").split("\n");
  const re = new RegExp(`^\\s*(?:async\\s+)?(?:function\\s+${name}\\s*\\(|${name}\\s*\\(|${name}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\()|(?:const|let|var)\\s+${name}\\s*=)`);
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  const end = blockEndLines(lines, i);
  return end < 0 ? null : { name, start: i + 1, end: end + 1, text: lines.slice(i, end + 1).join("\n") };
}
/** Reemplaza el método por la versión corregida; respeta la coma final de un literal de objeto. */
export function replaceMember(js, m, code) {
  let body = String(code || "").replace(/\s+$/, "");
  if (!new RegExp(`\\b${m.name}\\b`).test(body.split("\n")[0] || "")) return { ok: false, why: `no devolvió ${m.name}` };
  const lines = String(js).split("\n");
  const hadComma = /}\s*,\s*$/.test(lines[m.end - 1]);
  if (hadComma && !/,\s*$/.test(body)) body += ",";
  if (!hadComma) body = body.replace(/,\s*$/, "");
  const next = [...lines.slice(0, m.start - 1), body, ...lines.slice(m.end)].join("\n");
  try { new vm.Script(next); } catch (e) { return { ok: false, why: `no compila: ${e.message}` }; }
  return { ok: true, js: next };
}

// ---------- lints generales ----------
/** Nombres declarados al nivel superior (const/let/var/function/class al comienzo de la línea). */
export function topNames(code) {
  return [...String(code || "").matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
}
/** Nombres que este archivo declara y otro ya declaró (en scripts comunes eso rompe la página). */
export function clashes(code, others) {
  const mine = new Set(topNames(code));
  const out = [];
  for (const [file, src] of Object.entries(others)) for (const n of topNames(src)) if (mine.has(n)) out.push(`"${n}" ya está declarado en ${file}: en este archivo no lo declares (usalo o elegí otro nombre).`);
  return out;
}
/** Parámetro de flecha que tapa a una variable de afuera y se compara consigo mismo (`c => c.col === c`). */
export function shadowProblems(code) {
  const out = [];
  for (const m of String(code || "").matchAll(/\(?\s*([A-Za-z_$][\w$]*)\s*\)?\s*=>[^;\n]*?\b\1\.[\w$]+\s*===?\s*\1\b(?![\w$.(\[])/g))
    out.push(`en \`${m[0].trim().replace(/^\(\s*/, "").slice(0, 80)}\` el parámetro "${m[1]}" tapa a la variable "${m[1]}" de afuera (se compara ${m[1]}.algo con el mismo ${m[1]}): renombrá el parámetro de la flecha (por ejemplo p => p.fila === r && p.col === ${m[1]}).`);
  return out;
}

// ---------- screen ----------
export function missingIds(html, ids) {
  return ids.filter((id) => !new RegExp(`id\\s*=\\s*["']${id}["']`).test(html || ""));
}
export function cleanFragment(html) {
  let h = String(html || "");
  const body = h.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (body) h = body[1];
  return h.replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<link\b[^>]*>/gi, "").trim();
}
export const cleanCss = (css) => String(css || "").replace(/@import[^;]*;/gi, "").replace(/url\(\s*['"]?https?:[^)]*\)/gi, "none");

// ---------- página ----------
export function pageHtml({ title, fragment, features = [], scripts = [], inline = "", mainId = "app" }) {
  const df = features.length ? ` data-feature="${features.join(" ")}"` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
<main id="${mainId}"${df}>
${fragment || `<h1>${esc(title)}</h1>`}
</main>
${scripts.map((s) => `<script src="${s}"></script>`).join("\n")}${inline ? `\n<script>\n${inline}\n</script>` : ""}
</body>
</html>
`;
}
function writeApp(dir, files, page) {
  for (const [name, content] of Object.entries(files)) {
    if (content == null) continue;
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content, "utf8");
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page, "utf8");
}

// ---------- render: sonda en Chromium ----------
/** Abre la página y devuelve window.__probe (lo arma la sonda que declara el Standard). */
export async function probePage(htmlPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const p = await page.evaluate(() => window.__probe || null);
    return { probe: p, errors: errs };
  } finally { await browser.close(); }
}
/** Problemas generales de una sonda; los específicos los agrega step.expect(probe). */
export function probeProblems({ probe: p, errors }, step) {
  if (!p) return fatal([`la página no llegó a probar ${step.call}${errors.length ? `: ${errors[0]}` : ""}.`]);
  if (!p.ok) return fatal([`${step.call} tiró un error: ${p.error}.`]);
  return step.expect(p);
}

// ---------- wiring ----------
export function playProblems(results) {
  const out = results.filter((r) => r.result === "FAIL").map((r) => `${r.type}: ${r.detail}`);
  return results.some((r) => r.type === "no_js_errors" && r.result === "FAIL") ? fatal(out) : out;
}

// ---------- respuesta ----------
export function extractFile(raw, name) {
  const r = String(raw || "");
  const re = new RegExp("###\\s*(?:FILE|APPEND):\\s*([\\w./\\-]+)[^\\n]*\\n+```[\\w-]*\\n([\\s\\S]*?)```", "g");
  const ext = name.split(".").pop();
  let m, byExt = null;
  while ((m = re.exec(r))) {
    if (m[1] === name || m[1].endsWith("/" + name.split("/").pop())) return m[2];
    if (!byExt && m[1].endsWith("." + ext)) byExt = m[2];
  }
  if (byExt) return byExt;
  const lang = ext === "js" ? "(?:javascript|js)" : ext;
  const f = r.match(new RegExp("```" + lang + "\\n([\\s\\S]*?)```"));
  return f ? f[1] : null;
}
const langOf = (n) => (n.endsWith(".css") ? "css" : n.endsWith(".html") ? "html" : n.endsWith(".json") ? "json" : "javascript");

// ---------- build ----------
/**
 * Corre los pasos del Standard.
 * @param {{refined, tasks}} input
 * @param {string} outDir   la app queda en outDir/app/
 * @param {{standard, log?, model?, pagePlan?, check?:boolean, forbidden?:string[]}} opts
 */
export async function buildFiles({ refined, tasks }, outDir, opts = {}) {
  const S = opts.standard;
  if (!S?.steps?.length) throw new Error("STANDARD_REQUIRED: el motor por archivos necesita un Standard con pasos");
  const log = opts.log || console.log;
  const model = opts.model || MODEL;
  const hints = S.hints ? S.hints(refined) : {};
  const comps = componentsFromPlan(opts.pagePlan, refined.features || []);
  const main = comps[0];
  const features = main ? main.features.map((f) => f.id) : [];
  const notes = notesText((assignTasks(comps, tasks).byComp[main?.id] || []), { maxDescribed: 0 });
  const brief = briefText(refined) + "\n\n" + rulesBrief(refined);
  const title = refined.project_name || S.defaultTitle || "Proyecto";
  const appDir = join(outDir, "app");
  mkdirSync(appDir, { recursive: true });
  const files = Object.fromEntries(["styles.css", ...S.scripts].map((f) => [f, ""]));
  const ctx = { hints, notes, fragment: "", data: {}, files, total: S.steps.length, paso: "" };
  const steps = [];
  const byId = {};
  const page = (scripts, inline = "", fr = ctx.fragment) => pageHtml({ title, fragment: fr, features, scripts, inline, mainId: S.mainId });

  const ask = async (system, user, cap) => {
    const leak = (opts.forbidden || []).find((f) => f && user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`criterio holdout filtrado al Specialist: "${leak}"`);
    const promptTokens = estTokens(system) + estTokens(user);
    const maxTokens = Math.max(1500, Math.min(cap, CONTEXT - promptTokens - 200));
    const t0 = Date.now();
    const data = await chatStream(LM_STUDIO_URL, { model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: maxTokens });
    return { raw: data.content || "", ms: Date.now() - t0, finish_reason: data.finish_reason ?? null, reasoning_chars: data.reasoning_chars ?? 0, usage: data.usage ?? null, promptTokens, maxTokens };
  };
  const fence = (lang, s) => "```" + lang + "\n" + (String(s || "").trim() || "(vacío)") + "\n```";
  const retryBlock = (prev, problems, names) => problems.length
    ? `PROBLEMAS DE TU VERSIÓN ANTERIOR (los encontró el harness):\n${problems.map((p) => "- " + p).join("\n")}\n\nTU VERSIÓN ANTERIOR:\n${names.map((n) => `### FILE: ${n}\n${fence(langOf(n), prev?.[n])}`).join("\n\n")}\n\nDevolvé ${names.join(" y ")} corregido(s), completo(s).`
    : "";
  const answerOf = (st) => st.answer ? [st.answer] : st.files || [st.file];
  const loadedBefore = (st) => S.scripts.slice(0, S.scripts.indexOf(st.file)).map((f) => files[f]);
  const dataItems = () => Object.values(ctx.data).find((d) => Array.isArray(d?.items))?.items || [];

  // ---- un paso: hasta 3 intentos del MISMO archivo ----
  const runStep = async (st, n, { judge, repair }) => {
    const names = answerOf(st);
    const rec = { n, task_id: st.id, kind: st.kind, files: names, attempts: [] };
    log(`[SPECIALIST] ${n}/${S.steps.length} ${names.join(" + ")}`);
    ctx.paso = `PASO ${n} de ${S.steps.length}`;
    let best = null, prev = null, problems = [];
    for (let k = 0; k < 3; k++) {
      const user = `BRIEF:\n${brief}\n\n${S.contract}\n\n${st.prompt(ctx)}\n\n` + retryBlock(prev, problems, names);
      const r = await ask(FILE_PROMPT, user, st.cap || 4000);
      writeFileSync(join(outDir, `step_${String(n).padStart(2, "0")}_${st.id}${k ? ".retry" + k : ""}.raw.txt`), r.raw, "utf8");
      let raw = r.raw;
      const att = { k, ms: r.ms, finish_reason: r.finish_reason, reasoning_chars: r.reasoning_chars, prompt_tokens_est: r.promptTokens, max_tokens: r.maxTokens };
      const jsName = names.find((x) => x.endsWith(".js"));
      if (jsName) {
        let js = extractFile(raw, jsName);
        if (js) {
          let err = syntaxOf(js);
          // declaración repetida → arreglo determinista, sin Gemma (b9: const altura dos veces)
          if (err && /has already been declared/.test(err)) {
            const fr = fixRedeclare(js);
            if (fr.fixes.length) {
              const e2 = syntaxOf(fr.js);
              att.redeclare_fix = fr.fixes;
              log(`[SPECIALIST]   declaración repetida: ${fr.fixes.map((f) => `${f.name} L${f.line} ${f.action}`).join(", ")}${e2 ? ` → sigue: ${e2}` : " → compila"}`);
              raw = raw.includes(js) ? raw.replace(js, () => fr.js) : `### FILE: ${jsName}\n\`\`\`javascript\n${fr.js}\n\`\`\``;
              js = fr.js; err = e2;
            }
          }
          // otro error de sintaxis → reparación por tramo
          if (err) {
            const wrapped = `### FILE: componente.js\n\`\`\`javascript\n${js}\n\`\`\``;
            const fx = await repairSyntax(wrapped, { id: S.mainId }, ask, { write: (m, txt) => writeFileSync(join(outDir, `step_${String(n).padStart(2, "0")}_${st.id}.fix${m}.raw.txt`), txt, "utf8") });
            att.syntax_repair = fx.rounds;
            if (fx.raw) { const fixed = extractFile(fx.raw, "componente.js"); raw = raw.replace(js, () => fixed); log(`[SPECIALIST]   reparación de sintaxis: ${fx.rounds.map((x) => `L${x.line} ${x.ok ? "✓" : "✗"}`).join(", ")} → compila`); }
          }
        }
      }
      let content = Object.fromEntries(names.map((x) => [x, extractFile(raw, x)]));
      if (st.take) content = st.take(raw, content);
      problems = await judge(content);
      if (problems.length && repair) {
        const fixed = await repair(content, problems, att);
        if (fixed) { const p2 = await judge(fixed); if (scoreOf(true, p2) < scoreOf(true, problems)) { content = fixed; problems = p2; } }
      }
      att.problems = [...problems];
      rec.attempts.push(att);
      const has = names.some((x) => content?.[x]);
      const score = scoreOf(has, problems);
      if (!best || score < best.score) best = { content, problems, score };
      prev = content;
      log(`[SPECIALIST]   ${problems.length ? `✗ ${problems.length} problema(s): ${problems.slice(0, 3).join(" | ").slice(0, 300)}` : "✓"}${k ? ` (reintento ${k})` : ""} · ${Math.round(r.ms / 1000)}s`);
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

  // ---- jueces generales por clase de paso ----
  const jsBasics = (st, code) => {
    if (!code) return fatal([`la respuesta no trajo ### FILE: ${st.file}.`]);
    const se = syntaxOf(code); if (se) return fatal([`error de sintaxis: ${se}`]);
    return null;
  };
  const KINDS = {
    data: (st) => ({
      judge: async (c) => {
        const txt = c[st.answer];
        if (!txt) return fatal([`la respuesta no trajo ### FILE: ${st.answer}.`]);
        const pj = parseJsonLoose(txt);
        if (!pj.ok) return fatal([`el JSON no se puede leer: ${pj.error}`]);
        const out = st.parse(pj.data, ctx);
        c.parsed = out;
        return out.problems.length ? fatal(out.problems) : [];
      },
    }),
    logic: (st) => {
      const acceptance = (code) => {
        const L = loadScripts([...loadedBefore(st), code], [st.global, ...(st.itemsGlobal ? [st.itemsGlobal] : [])]);
        if (L.error) return { error: L.error };
        return { result: runAcceptance(L[st.global], st.itemsGlobal ? L[st.itemsGlobal] : [], st) };
      };
      return {
        judge: async (c) => {
          const code = c[st.file];
          const b = jsBasics(st, code); if (b) return b;
          if (st.pure && /\b(document|window)\./.test(code)) return [`${st.file} no puede usar document ni window (es lógica pura).`];
          const sh = shadowProblems(code); if (sh.length) return sh;
          const a = acceptance(code);
          if (a.error) return fatal([`al ejecutarlo: ${a.error}`]);
          const failed = a.result.failed;
          return failed.some((f) => f.name === "contrato") ? fatal(failed.map((f) => f.detail)) : failed.map((f) => f.detail);
        },
        repair: async (c, _pr, att) => {
          let code = c[st.file];
          if (!code || syntaxOf(code)) return null;
          const rounds = [];
          for (let k = 0; k < 4; k++) {
            const a = acceptance(code);
            if (a.error) break;
            const failed = a.result.failed;
            if (!failed.length || failed.some((f) => f.name === "contrato")) break;
            const fn = failed.find((f) => f.fn && !rounds.some((r) => r.fn === f.fn && !r.ok))?.fn;
            const m = fn && findMember(code, fn);
            if (!m) break;
            const user = `${S.contract}\n\nPRUEBAS DEL HARNESS QUE FALLAN (${fn}):\n${failed.filter((f) => f.fn === fn).map((f) => "- " + f.detail).join("\n")}\n\nFUNCIÓN A CORREGIR (${fn}):\n${fence("javascript", m.text)}`;
            const r = await ask(memberFixPrompt(st.file, st.label || "lógica pura, sin DOM"), user, st.cap || 5000);
            writeFileSync(join(outDir, `step_${String(steps.length + 1).padStart(2, "0")}_${st.id}.a${att.k ?? 0}.${fn}${k + 1}.raw.txt`), r.raw, "utf8");
            const got = (String(r.raw || "").match(/```(?:javascript|js)?\n([\s\S]*?)```/) || [])[1];
            const rp = replaceMember(code, m, got);
            const before = failed.length;
            let after = before;
            if (rp.ok) { const a2 = acceptance(rp.js); after = a2.error ? Infinity : a2.result.failed.length; }
            const note = rp.ok ? null : rp.why + (r.finish_reason === "length" ? " (cortada por largo)" : !String(r.raw || "").trim() ? " (respuesta vacía)" : "");
            const round = { fn, ms: r.ms, finish_reason: r.finish_reason, chars: String(r.raw || "").length, reasoning_chars: r.reasoning_chars ?? 0, ok: rp.ok && after < before, before, after: after === Infinity ? "error" : after, ...(note ? { note } : {}) };
            rounds.push(round);
            if (round.ok) code = rp.js;
          }
          if (rounds.length) {
            att.member_repair = rounds;
            log(`[SPECIALIST]   reparación por función: ${rounds.map((r) => `${r.fn} ${r.ok ? "✓" : `✗${r.note ? ` (${r.note})` : ""}`}`).join(", ")}`);
          }
          return code !== c[st.file] ? { [st.file]: code } : null;
        },
        acceptance,
      };
    },
    screen: (st) => ({
      judge: async (c) => {
        const out = [];
        const [html, css] = st.files;
        if (!c[html]) out.push(`la respuesta no trajo ### FILE: ${html}.`);
        else { const miss = missingIds(c[html], S.ids || []); if (miss.length) out.push(`faltan estos ids en ${html}: ${miss.map((x) => "#" + x).join(", ")}.`); }
        if (!c[css]) out.push(`la respuesta no trajo ### FILE: ${css}.`);
        return out;
      },
    }),
    render: (st) => ({
      judge: async (c) => {
        const code = c[st.file];
        const b = jsBasics(st, code); if (b) return b;
        const others = Object.fromEntries(S.scripts.slice(0, S.scripts.indexOf(st.file)).map((f) => [f, files[f]]));
        const own = topNames(code).filter((x) => (st.notOwn?.names || []).includes(x));
        const extra = [
          ...shadowProblems(code),
          ...clashes(code, others),
          ...(own.length ? [`${st.file} solo define ${st.defines}: ${own.join(", ")} van en ${st.notOwn.owner}, no acá.`] : []),
          ...(st.noListeners && /addEventListener\s*\(/.test(code) ? [`${st.file} no agrega listeners (van en ${st.notOwn?.owner || "otro archivo"}).`] : []),
        ];
        if (extra.length) return extra;
        if (opts.check === false) return [];
        const dir = join(outDir, `probe_${st.id}`);
        writeApp(dir, { ...files, [st.file]: code }, page(S.scripts.slice(0, S.scripts.indexOf(st.file) + 1), st.probe));
        return probeProblems(await probePage(join(dir, "index.html")), st);
      },
    }),
    wiring: (st) => ({
      judge: async (c) => {
        const code = c[st.file];
        const b = jsBasics(st, code); if (b) return b;
        const others = Object.fromEntries(S.scripts.filter((f) => f !== st.file).map((f) => [f, files[f]]));
        const cl = clashes(code, others);
        if (cl.length) return cl;
        if (opts.check === false) return [];
        const dir = join(outDir, `probe_${st.id}`);
        writeApp(dir, { ...files, [st.file]: code }, page(S.scripts));
        return playProblems(await runChecks(join(dir, "index.html"), st.play || []));
      },
    }),
  };

  log(`[SPECIALIST] ${ENGINE_VERSION} · Standard ${S.id} v${S.version} (${S.status}): ${S.steps.length} pasos chicos (un archivo por paso)${S.hintsText ? ` · ${S.hintsText(hints)}` : ""}`);
  const out = {};
  for (const [i, st] of S.steps.entries()) {
    const n = i + 1;
    const broken = (st.needs || []).map((id) => byId[id]).find((r) => r?.broken);
    if (broken) { byId[st.id] = skipStep(st, n, `${broken.files.join(" + ")} no funciona (${String(broken.problems_final[0] || "").slice(0, 120)})`).rec; continue; }
    const kind = KINDS[st.kind];
    if (!kind) throw new Error(`STANDARD_STEP_KIND: "${st.kind}" (paso ${st.id}) no existe en el motor`);
    const K = kind(st);
    const s = await runStep(st, n, K);
    byId[st.id] = s.rec;
    if (st.kind === "data") {
      const parsed = s.content?.parsed;
      if (!parsed?.items?.length) throw new Error(`${st.id}: ningún dato válido después de 3 intentos (${(s.rec.problems_final || []).slice(0, 3).join(" | ")})`);
      ctx.data[st.id] = parsed;
      files[st.file] = parsed.js;
      writeFileSync(join(outDir, st.answer), String(s.content[st.answer] || ""), "utf8");
      s.rec.data = parsed.summary;
      s.rec.broken = false; // lo que quedó alcanza (los datos inválidos se descartan)
      log(`[SPECIALIST]   ${st.summaryText ? st.summaryText(parsed) : `${parsed.items.length} datos válidos`}`);
    } else if (st.kind === "screen") {
      ctx.fragment = cleanFragment(s.content[st.files[0]]);
      files[st.files[1]] = cleanCss(s.content[st.files[1]]);
    } else {
      files[st.file] = s.content[st.file] || "";
    }
    if (st.kind === "logic") {
      const a = K.acceptance(files[st.file]);
      s.rec.tests = a.error ? { passed: [], failed: [{ name: "carga", detail: `al ejecutarlo: ${a.error}` }] } : a.result;
      out.acceptance = { ...(out.acceptance || {}), [st.id]: s.rec.tests };
      log(`[SPECIALIST]   pruebas de ${st.id} (harness, sin navegador): ${s.rec.tests.passed.length}/${s.rec.tests.passed.length + s.rec.tests.failed.length}${s.rec.tests.failed.length ? ` · fallan: ${s.rec.tests.failed.map((f) => f.name).join(", ")}` : ""}`);
    }
  }

  writeApp(appDir, files, page(S.scripts));
  const skipped = steps.filter((s) => s.skipped).map((s) => s.task_id);
  log(`[SPECIALIST] app/: index.html, styles.css, ${S.scripts.join(", ")}${steps.some((s) => s.problems_final.length) ? ` · quedan problemas en: ${steps.filter((s) => s.problems_final.length).map((s) => s.task_id).join(", ")}` : " · todos los pasos OK"}`);
  const firstLogic = S.steps.find((s) => s.kind === "logic");
  return {
    model, specialist_version: ENGINE_VERSION, standard: { id: S.id, version: S.version, status: S.status },
    files: ["index.html", "styles.css", ...S.scripts],
    hints, data: Object.fromEntries(Object.entries(ctx.data).map(([k, v]) => [k, v.summary])),
    rule_tests: firstLogic ? out.acceptance?.[firstLogic.id] : undefined, acceptance: out.acceptance,
    ...(skipped.length ? { skipped } : {}), order: steps.map((s) => s.task_id),
    steps: steps.map((s) => ({ ...s, ms: s.attempts.reduce((a, b) => a + b.ms, 0), finish_reason: s.attempts.at(-1)?.finish_reason, changed: s.files, rejected: s.problems_final })),
  };
}

/** Esqueleto de control para Validation: la misma página sin JS ni contenido. */
export function baselinePage(refined, plan, standard) {
  const comps = componentsFromPlan(plan, refined.features || []);
  return pageHtml({ title: refined.project_name || standard.defaultTitle || "Proyecto", fragment: "", features: comps[0] ? comps[0].features.map((f) => f.id) : [], scripts: [], mainId: standard.mainId });
}
