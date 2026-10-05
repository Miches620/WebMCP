// specialist_components.mjs — Specialist v0.7 "componentes" (decisión de Miche, 03/10).
//
// En vez de 31 tareas del graph sobre 4 archivos compartidos, el harness arma
// los pasos desde el PAGE PLAN (decisión de Miche: "Del page plan"):
//   1. tokens.css   — variables y estilos base compartidos (lo único global)
//   2. un paso por componente (header, cada sección, footer): Gemma devuelve
//      componente.html + componente.css + componente.js (+ APPEND api.js)
// Cada paso ve SOLO: el brief, su componente, los criterios transversales
// (responsive, hover, animaciones… — van a todos los pasos, idea de Miche del
// 02/10), las tareas del TechLeader asignadas a ese componente (como notas; v0.7.3:
// las que no nombran ningún componente van al principal),
// tokens.css y el contrato de window.api. ~2–4k tokens de prompt.
//
// Después de cada paso, el harness ensambla la página y la mira en Chromium
// (chequeos de BASE, no los del juez): ¿la pieza se ve al llegar con el scroll?,
// ¿errores de JS?, ¿desborda en celular/escritorio?, ¿el nav enlaza todas las
// secciones?, ¿su JS dibujó algo?, ¿repite ids de otro componente?. Si algo falla, UN reintento con el problema concreto.
// Los chequeos de requisitos (traductor) NO se usan acá: siguen siendo el juez final.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chatStream } from "../../../build/lm_stream.mjs";
import { estTokens } from "../../../build/tokens.mjs";
import { briefText, apiContract } from "./specialist_spa.mjs";
import {
  componentsFromPlan, transversalsFromPlan, initialState, assemble, assignTasks, notesText,
  applyComponentResponse, applyTokensResponse,
} from "./components.mjs";
import { runChecks } from "../validation/check_catalog.mjs";

const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
export const SPECIALIST_MODEL = "google/gemma-4-e4b";
export const SPECIALIST_VERSION = "spa_specialist v0.7.4-componentes";
// v0.7.4 (05/10, web/app y web/game): el profile puede pasar briefExtra (restricciones del
// usuario al brief), systemExtra (reglas del tipo), maxAnswer y extraChecks (chequeos de
// base propios con su mensaje de problema). Plan sin header/footer → sin esas piezas.
// v0.7.3 (05/10, Boxworld build 2): (1) TODA tarea del graph (menos QA) llega a un
// componente: por palabra clave o, si no nombra ninguno, al principal (antes 2 de 25);
// (2) componente.js que es una sola función anónima `(root) => {…}` → el harness la llama;
// (3) chequeos de base nuevos por componente: components_render (el JS no llenó ninguno
// de los contenedores que nombra) e ids repetidos con otro componente.
// v0.7.2 (03/10): Gemma corre con 16k de contexto en la PC de Miche (WEBMCP_CONTEXT para cambiarlo).
// En v0.7.1 el reintento de #contacto (prompt + 3 archivos actuales) se cortó por length a los 6000.
const COMPONENT_CONTEXT = Number(process.env.WEBMCP_CONTEXT) || 16000;
const MAX_ANSWER = 8000;

export const SYSTEM_PROMPT = `Sos el Specialist de MicheLab. Construís un PROTOTIPO de página web COMPONENTE POR COMPONENTE, como en Angular: cada componente tiene su propio HTML, CSS y JS y no toca a los demás.

En cada paso recibís UN componente: su id, qué requisitos muestra, los CRITERIOS TRANSVERSALES (aplican a todos los componentes), tokens.css (variables y estilos base compartidos: usalos, no los repitas) y el CONTRATO de window.api (datos simulados).

Respondé SOLO con estos bloques:

### FILE: componente.html
\`\`\`html
UN solo elemento raíz con el id indicado (el tag indicado), con todo su contenido
\`\`\`

### FILE: componente.css
\`\`\`css
estilos SOLO de este componente; cada selector empieza con #id (ej. #inicio .boton)
\`\`\`

### FILE: componente.js
\`\`\`javascript
código que corre dentro de una función que ya recibe root (el elemento del componente). Buscá con root.querySelector(...). Escribí el código directo (no hace falta envolverlo en otra función; si lo envolvés, llamala al final). Si no hace falta JS, dejalo vacío.
\`\`\`

### APPEND: api.js
\`\`\`javascript
SOLO si necesitás datos o envíos simulados nuevos: window.api.nombre = async (datos) => { ... };
\`\`\`

Reglas:
1. Contenido concreto y en español: inventá nombres, textos y datos creíbles. Nada de marcadores como "[Icono]", "Nombre de la Marca" o "Lorem ipsum".
2. Sin recursos externos: nada de CDN, fuentes web, librerías de íconos (Font Awesome) ni imágenes por URL. Para íconos usá emoji o <svg> inline.
3. El contenido se tiene que ver. Si ocultás algo para animarlo (opacity:0, transform), tu componente.js lo tiene que mostrar (por ejemplo con IntersectionObserver sobre elementos de root). Nunca ocultes el elemento raíz.
4. JS: no declares variables globales ni toques elementos de otros componentes (para ir a una sección podés usar document.getElementById(id).scrollIntoView). Datos y envíos SOLO por window.api.
5. window.api: funciones async que SIEMPRE resuelven con éxito, con una latencia simulada de 300 ms como máximo. Sin fetch ni XMLHttpRequest.
6. Responsive: el componente no puede desbordar a lo ancho en celular (390 px) ni en escritorio. Usá max-width:100%, flex-wrap, grid con auto-fit, y una @media para celular.
7. Formularios: cada campo con su <label>; required donde corresponda; al enviar, mostrá un mensaje de éxito dentro del componente.
8. Si te devuelven un PROBLEMA, corregí ese problema y devolvé los tres FILE completos.`;

const TOKENS_PROMPT = `Sos el Specialist de MicheLab. Escribí tokens.css: los estilos COMPARTIDOS de toda la página.

Respondé SOLO con:

### FILE: tokens.css
\`\`\`css
...
\`\`\`

Debe tener: variables en :root (paleta de colores coherente, tipografía con fuentes del sistema, espaciados, radios, sombras, transiciones), reset (box-sizing), body, títulos (h1-h3), párrafos, enlaces, una clase .btn con su :hover y transición, y .container (ancho máximo centrado).
Prohibido: estilos de secciones o componentes específicos, ocultar elementos (opacity:0, display:none), @import, fuentes externas.`;

function compSpec(c, comps) {
  const lines = [`COMPONENTE: #${c.id} (<${c.tag}>) — ${c.titulo}`];
  if (c.features.length) lines.push("Requisitos que muestra:", ...c.features.map((f) => `- ${f.id}: ${f.text}`));
  else lines.push("Requisitos que muestra: (ninguno propio; completalo de forma coherente con la página)");
  if (c.kind === "header") {
    lines.push("", "Secciones de la página (el <nav> tiene que enlazar TODAS con href=\"#id\"):",
      ...comps.filter((x) => x.kind === "section").map((x) => `- #${x.id}: ${x.titulo}`));
  } else {
    const others = comps.filter((x) => x.id !== c.id);
    lines.push("", others.length ? `Otras partes de la página (no las construyas): ${others.map((x) => "#" + x.id).join(", ")}` : "Es la ÚNICA pieza de la página: todo lo pedido va en este componente.");
  }
  return lines.join("\n");
}

const fence = (lang, s) => "```" + lang + "\n" + (String(s || "").trim() || "(vacío)") + "\n```";

/** Chequeos de base de UN componente sobre la página ensamblada. Devuelve la lista de problemas. */
export async function componentProblems(htmlPath, c, comps, state, prev = {}, extra = []) {
  const problems = [];
  // `extra` (v0.7.4): chequeos de base que pone el profile, solo para el componente principal
  // ({ check, problem(r) → texto para Gemma }). Ej. web/game: not_won_immediately.
  const mine = extra.filter((x) => !x.only || x.only === c.id);
  const [vis, js, scroll, render, ...ext] = await runChecks(htmlPath, [
    { type: "sections_visible", params: {} },
    { type: "no_js_errors", params: {} },
    { type: "no_horizontal_scroll", params: {} },
    { type: "components_render", params: {} },
    ...mine.map((x) => x.check),
  ]);
  mine.forEach((x, i) => { if (ext[i]?.result === "FAIL") problems.push(x.problem(ext[i])); });
  const a = (vis.anchors || []).find((x) => x.id === c.id);
  if (a && !a.ok) problems.push(`al llegar con el scroll a #${c.id} se ven solo ${a.seen} de ${a.total} palabras: hay contenido oculto (opacity, visibility o display) que tu JS nunca muestra`);
  if (js.result === "FAIL" && prev.js !== "FAIL") problems.push(`la página tiene un error de JavaScript: ${js.detail}`);
  if (scroll.result === "FAIL" && prev.scroll !== "FAIL") problems.push(`la página desborda a lo ancho (${scroll.detail}); ajustá anchos de #${c.id}`);
  // v0.7.3: el JS de este componente no llenó NINGUNO de los contenedores que nombra
  // (Boxworld build 2: #mapa-grid vacío, función nunca llamada → Validation dio PASS igual).
  const rc = (render.components || []).find((x) => x.id === c.id);
  if (rc && !rc.ok) problems.push(`tu JS no dibuja nada: ${rc.empty.slice(0, 4).join(", ")} ${rc.empty.length > 1 ? "quedan vacíos" : "queda vacío"} después de cargar la página (¿tu función principal se llama? ¿hay un error antes de llenarlo?)`);
  // ids repetidos con otro componente (Boxworld build 2: #mensaje-juego y #nivel-actual en #juego y #niveles)
  const dup = duplicateIds(state, c, comps);
  if (dup.length) problems.push(`ids que ya usa otro componente: ${dup.slice(0, 6).map((d) => `#${d.id} (en #${d.in})`).join(", ")}; usá ids propios, con prefijo ${c.id}-`);
  if (c.kind === "header") {
    const html = state.components[c.id].html;
    const miss = comps.filter((x) => x.kind === "section" && !html.includes(`href="#${x.id}"`)).map((x) => "#" + x.id);
    if (miss.length) problems.push(`el <nav> no enlaza: ${miss.join(", ")} (cada sección necesita un <a href="#id">)`);
  }
  return { problems, status: { js: js.result, scroll: scroll.result }, render: rc || null };
}

/** ids (sin contar la raíz) de este componente que ya aparecen en el HTML de otro. */
export function duplicateIds(state, c, comps) {
  const ids = (html) => [...String(html || "").matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const mine = new Set(ids(state.components[c.id]?.html).filter((x) => x !== c.id));
  const out = [];
  for (const o of comps) {
    if (o.id === c.id) continue;
    for (const x of new Set(ids(state.components[o.id]?.html))) if (mine.has(x)) out.push({ id: x, in: o.id });
  }
  return out;
}

function writeSrc(dir, state, comps) {
  mkdirSync(join(dir, "src", "components"), { recursive: true });
  writeFileSync(join(dir, "src", "tokens.css"), state.tokens, "utf8");
  writeFileSync(join(dir, "src", "api.js"), state.api, "utf8");
  for (const c of comps) {
    const d = join(dir, "src", "components", c.id);
    mkdirSync(d, { recursive: true });
    const x = state.components[c.id];
    writeFileSync(join(d, `${c.id}.html`), x.html, "utf8");
    writeFileSync(join(d, `${c.id}.css`), x.css || "", "utf8");
    writeFileSync(join(d, `${c.id}.js`), x.js || "", "utf8");
  }
  writeFileSync(join(dir, "index.html"), assemble(state, comps), "utf8");
}

/**
 * @param {{refined:object, tasks:object[]}} input
 * @param {string} outDir  la app queda en outDir/app/index.html (un solo archivo) y outDir/app/src/
 * @param {{log?, model?, forbidden?:string[], resume?:boolean, pagePlan?:object|null, contextTokens?:number, check?:boolean}} opts
 */
export async function buildComponents({ refined, tasks }, outDir, opts = {}) {
  const log = opts.log || console.log;
  const model = opts.model || SPECIALIST_MODEL;
  const context = opts.contextTokens || COMPONENT_CONTEXT;
  const features = refined.features || [];
  const comps = componentsFromPlan(opts.pagePlan, features);
  const transversals = transversalsFromPlan(opts.pagePlan, features);
  // v0.7.4: el profile puede sumar al brief (web/app, web/game: las RESTRICCIONES del usuario,
  // que para un juego son sus reglas) y al prompt de sistema (reglas propias del tipo).
  const brief = briefText(refined) + (opts.briefExtra ? "\n\n" + opts.briefExtra(refined) : "");
  const SYSTEM = SYSTEM_PROMPT + (opts.systemExtra ? "\n\n" + opts.systemExtra : "");
  const maxAnswer = opts.maxAnswer || MAX_ANSWER;
  mkdirSync(outDir, { recursive: true });

  const statePath = join(outDir, "state.json"), sj = join(outDir, "steps.json");
  let state = initialState(comps, refined.project_name || "Prototipo");
  let steps = [];
  if (opts.resume && existsSync(statePath) && existsSync(sj)) {
    state = JSON.parse(readFileSync(statePath, "utf8"));
    steps = JSON.parse(readFileSync(sj, "utf8"));
    log(`[SPECIALIST] retomando: ${steps.length} pasos ya hechos`);
  }
  const save = () => { writeFileSync(statePath, JSON.stringify(state, null, 2)); writeFileSync(sj, JSON.stringify(steps, null, 2)); };
  const appDir = join(outDir, "app");
  const crit = transversals.length ? transversals.map((t) => `- ${t.id}: ${t.text}`).join("\n") : "(ninguno)";

  const ask = async (system, user) => {
    const promptTokens = estTokens(system) + estTokens(user);
    const maxTokens = Math.max(1500, Math.min(maxAnswer, context - promptTokens - 200));
    const t0 = Date.now();
    const data = await chatStream(LM_STUDIO_URL, { model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: 0, max_tokens: maxTokens });
    return { raw: data.content || "", ms: Date.now() - t0, finish_reason: data.finish_reason ?? null, usage: data.usage ?? null, promptTokens, maxTokens };
  };
  const guard = (user, where) => {
    const leak = (opts.forbidden || []).find((f) => f && user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`criterio holdout filtrado al Specialist en ${where}: "${leak}"`);
  };

  // v0.7.3: cada tarea del graph llega a algún componente (las sin palabra clave → principal).
  const assigned = assignTasks(comps, tasks);
  if (assigned.unmatched.length) log(`[SPECIALIST] ${assigned.unmatched.length} tareas del graph sin componente por palabra clave → #${assigned.main}: ${assigned.unmatched.join(", ")}`);
  const plan = [{ kind: "tokens", id: "tokens" }, ...comps.map((c) => ({ kind: "component", id: c.id, c }))];
  log(`[SPECIALIST] ${SPECIALIST_VERSION}: ${plan.length} pasos (tokens + ${comps.length} componentes) · transversales: ${transversals.map((t) => t.id).join(", ") || "ninguno"}`);
  let status = {};

  for (const [i, p] of plan.entries()) {
    if (i < steps.length) continue;
    const tag = `step_${String(i + 1).padStart(2, "0")}_${p.id}`;
    if (p.kind === "tokens") {
      const user = `BRIEF:\n${brief}\n\nCRITERIOS TRANSVERSALES (toda la página):\n${crit}\n\nTOKENS ACTUALES:\n${fence("css", state.tokens)}`;
      guard(user, "tokens");
      log(`[SPECIALIST] ${i + 1}/${plan.length} tokens.css · prompt ~${estTokens(TOKENS_PROMPT) + estTokens(user)} tok`);
      const r = await ask(TOKENS_PROMPT, user);
      writeFileSync(join(outDir, `${tag}.raw.txt`), r.raw, "utf8");
      const a = applyTokensResponse(state, r.raw);
      const step = { n: i + 1, task_id: "tokens", ms: r.ms, finish_reason: r.finish_reason, usage: r.usage, prompt_tokens_est: r.promptTokens, max_tokens: r.maxTokens, changed: a.changed, rejected: a.rejected, notes: a.notes };
      if (a.changed.length) state = a.next; else { step.error = a.rejected.join("; "); }
      log(`[SPECIALIST]   ${a.changed.length ? "tokens.css" : "✗ " + step.error}${a.notes.length ? " | " + a.notes.join("; ") : ""}`);
      steps.push(step); save();
      continue;
    }

    const c = p.c;
    const notes = assigned.byComp[c.id] || [];
    const cur = state.components[c.id];
    const contract = apiContract({ "api.js": state.api, "app.js": "" });
    const head =
      `BRIEF:\n${brief}\n\n${compSpec(c, comps)}\n\n` +
      `CRITERIOS TRANSVERSALES (este componente también los cumple):\n${crit}\n\n` +
      (notes.length ? `NOTAS DEL TECHLEADER para este componente (${notes.length}; todas se implementan en ESTE componente):\n${notesText(notes, { maxDescribed: 12, descChars: 180 })}\n\n` : "") +
      `CONTRATO window.api (funciones que existen hoy): ${contract.defined.length ? contract.defined.map((f) => `window.api.${f}()`).join(", ") : "(ninguna)"}\n\n` +
      `tokens.css (compartido; usá sus variables y clases):\n${fence("css", state.tokens)}\n\n`;
    const user = head + `COMPONENTE ACTUAL (esqueleto del harness):\n### FILE: componente.html\n${fence("html", cur.html)}`;
    guard(user, c.id);
    log(`[SPECIALIST] ${i + 1}/${plan.length} #${c.id} (${c.features.map((f) => f.id).join(" ") || "sin requisitos propios"}) · ${notes.length} notas del TechLeader · prompt ~${estTokens(SYSTEM) + estTokens(user)} tok`);
    const r1 = await ask(SYSTEM, user);
    writeFileSync(join(outDir, `${tag}.raw.txt`), r1.raw, "utf8");
    let a = applyComponentResponse(state, c, r1.raw);
    const step = {
      n: i + 1, task_id: c.id, role: c.kind, features: c.features.map((f) => f.id), techleader_tasks: notes.map((t) => t.id),
      ms: r1.ms, finish_reason: r1.finish_reason, usage: r1.usage, prompt_tokens_est: r1.promptTokens, max_tokens: r1.maxTokens,
      changed: a.changed, rejected: a.rejected, notes: a.notes,
    };
    let candidate = a.changed.length ? a.next : state;

    // Chequeos de base sobre la página ensamblada; si fallan, UN reintento.
    let check = { problems: [], status };
    if (opts.check !== false) {
      writeSrc(join(outDir, tag), candidate, comps);
      check = await componentProblems(join(outDir, tag, "index.html"), c, comps, candidate, status, opts.extraChecks || []);
    }
    const problems = [...a.rejected, ...(a.changed.includes("html") ? [] : ["la respuesta no trajo componente.html"]), ...check.problems];
    if (problems.length) {
      log(`[SPECIALIST]   problemas: ${problems.join(" | ")} → reintento`);
      const x = candidate.components[c.id];
      const fixUser = head +
        `PROBLEMA EN TU RESPUESTA ANTERIOR:\n${problems.map((q) => "- " + q).join("\n")}\n\n` +
        `TU COMPONENTE ACTUAL (ya encapsulado por el harness):\n### FILE: componente.html\n${fence("html", x.html)}\n\n### FILE: componente.css\n${fence("css", x.css)}\n\n### FILE: componente.js\n${fence("javascript", x.js)}\n\n` +
        `Devolvé los tres FILE corregidos.`;
      guard(fixUser, c.id);
      const r2 = await ask(SYSTEM, fixUser);
      writeFileSync(join(outDir, `${tag}.retry.raw.txt`), r2.raw, "utf8");
      const b = applyComponentResponse(candidate, c, r2.raw);
      step.retry = { problems, ms: r2.ms, finish_reason: r2.finish_reason, changed: b.changed, rejected: b.rejected, notes: b.notes };
      if (b.changed.length) {
        const cand2 = b.next;
        let check2 = { problems: [], status };
        if (opts.check !== false) {
          writeSrc(join(outDir, tag), cand2, comps);
          check2 = await componentProblems(join(outDir, tag, "index.html"), c, comps, cand2, status, opts.extraChecks || []);
        }
        step.retry.problems_after = check2.problems;
        // Se queda la versión con menos problemas (empate → la del reintento).
        if (check2.problems.length + b.rejected.length <= problems.length) { candidate = cand2; check = check2; }
      }
      log(`[SPECIALIST]   reintento: ${step.retry.problems_after?.length === 0 ? "OK" : `quedan ${(step.retry.problems_after || problems).length} problemas`}`);
    }
    step.problems_final = check.problems;
    if (candidate !== state) { state = candidate; step.dir = tag; status = check.status; }
    else step.error = problems.join("; ") || "sin cambios";
    log(`[SPECIALIST]   ${step.dir ? `#${c.id}: ${[...new Set([...(step.changed || []), ...(step.retry?.changed || [])])].join(", ")}` : `✗ #${c.id}: ${step.error}`}${step.notes.length ? " | " + step.notes.join("; ") : ""}`);
    steps.push(step); save();
  }

  writeSrc(appDir, state, comps);
  return { model, specialist_version: SPECIALIST_VERSION, tasks_assigned: { main: assigned.main, unmatched: assigned.unmatched, by_component: Object.fromEntries(Object.entries(assigned.byComp).map(([k, v]) => [k, v.map((t) => t.id)])) }, order: plan.map((p) => p.id), components: comps.map((c) => ({ id: c.id, kind: c.kind, features: c.features.map((f) => f.id) })), steps };
}

/** Página ensamblada con los esqueletos (control de Validation: lo que aprueba esto no discrimina). */
export function baselineHtml(refined, pagePlan) {
  const comps = componentsFromPlan(pagePlan, refined.features || []);
  return assemble(initialState(comps, refined.project_name || "Prototipo"), comps);
}
