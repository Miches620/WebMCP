// specialist_spa.mjs — Specialist (Gemma) que construye la SPA COMPLETA del graph,
// tarea por tarea. Etapa PROTOTYPE con back simulado.
//
// v0.3 (01/10, decisión de Miche): el artefacto son VARIOS archivos y Gemma
// devuelve solo los que cambió. Evidencia: con un único index.html reescrito
// entero en cada tarea (v0.2), Project20 llegó a ~22 KB y desde la tarea 12
// 7 de 8 respuestas se cortaron por max_tokens (finish_reason=length); cada
// tarea tardaba 6-10 min. Ahora la salida es solo lo que la tarea toca.
//
//   index.html  estructura (ya enlaza styles.css, api.js, app.js)
//   styles.css  estilos
//   api.js      capa de datos SIMULADA: window.api con datos en memoria y
//               funciones async que imitan los endpoints (tareas Backend/DBA)
//   app.js      lógica de la UI; usa solo window.api para datos
//
// v0.4 (01/10, decisión de Miche: "esqueleto rico + contrato API"). Evidencia de
// la corrida 2026-10-01T18-59-04 (v0.3):
//   - header/footer vacíos, sin nav, secciones en cualquier orden: ninguna tarea
//     del graph pide "armá el header"; Gemma sigue las tareas al pie de la letra.
//     → el harness arma el esqueleto desde las features: header con nav, una
//       <section data-feature="Rn"> por feature en orden, footer.
//   - app.js llamaba window.api.crearContacto() y api.js no la definía → el
//     envío del form caía en el catch (alert de error) → R2 FAIL.
//     → chequeo de contrato determinista después de cada paso (se ejecuta
//       api.js en un sandbox y se comparan sus funciones con las llamadas de
//       app.js); si falta alguna, UN reintento con el faltante como feedback.
//       El contrato vigente va en cada prompt.
//   - F5.1 respondió "no se requiere modificación" y se contó como error.
//     → sin bloques FILE con finish_reason=stop = "sin cambios", no error.
//
// Basado en pilot/specialist_runner.mjs (v0.1), que se deja intacto.

import { writeFileSync, mkdirSync, readFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { topoOrder } from "../pilot/specialist_runner.mjs";
import { chatStream } from "./lm_stream.mjs";
import { planPrompt, applyBlocks, filesBlockDiet, CONTEXT_TOKENS } from "./file_diet.mjs";

const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/chat/completions";
export const SPECIALIST_MODEL = "google/gemma-4-e4b";
export const SPECIALIST_VERSION = "spa_specialist v0.6.1-file-diet";

export const FILES = ["index.html", "styles.css", "api.js", "app.js"];
const LANG = { "index.html": "html", "styles.css": "css", "api.js": "javascript", "app.js": "javascript" };

// Etiqueta corta de una feature para el nav: lo que está entre comillas
// ("Sección 'Carta' con ..." → Carta) o el comienzo hasta " con/en/para/(".
export function featureLabel(text) {
  const t = String(text || "").trim();
  const q = t.match(/['"“‘«]([^'"”’»]{2,40})['"”’»]/);
  if (q) return q[1].trim();
  const head = t.split(/\s+(?:con|en|para|que|donde|desde)\s+|[(,:;.]/i)[0].trim();
  const words = head.split(/\s+/).slice(0, 4).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function slug(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seccion";
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Secciones del esqueleto: una por feature, en el orden del brief. */
export function sectionsFor(features = []) {
  const used = new Set();
  return features.map((text, i) => {
    const label = featureLabel(text);
    let id = slug(label);
    while (used.has(id)) id += `-${i + 1}`;
    used.add(id);
    return { rid: `R${i + 1}`, id, label, text };
  });
}

// Esqueleto determinista. Gemma rellena dentro; no inventa la estructura.
//   plan (page_plan.mjs, v0.5): header + una <section> por parte del plan, con
//        data-feature = lista de requisitos que cubre ("R3 R5"); las features
//        transversales no generan sección.
//   plan === null (el plan falló): header + nav vacío + main + footer.
//   plan === undefined (v0.4, corridas viejas): una sección por feature.
export function skeleton(title = "Prototipo", features = [], plan) {
  const df = (ids) => (ids?.length ? ` data-feature="${ids.join(" ")}"` : "");
  const comment = (ids) => ids.map((r) => `      <!-- ${r}: ${esc(features[Number(r.slice(1)) - 1] || "")} -->`).join("\n");
  let secs, headerF = [], footerF = [];
  if (plan === undefined) {
    secs = sectionsFor(features).map((x) => ({ id: x.id, titulo: x.label, features: [x.rid] }));
  } else if (plan === null) {
    secs = [];
  } else {
    secs = plan.sections;
    headerF = plan.header.features;
    footerF = plan.footer.features;
  }
  const nav = secs.map((x) => `        <li><a href="#${x.id}">${esc(x.titulo)}</a></li>`).join("\n");
  const body = secs.map((x) => `    <section id="${x.id}"${df(x.features)}>
      <h2>${esc(x.titulo)}</h2>
${comment(x.features)}
    </section>`).join("\n\n");
  return {
    "index.html": `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header id="site-header"${df(headerF)}>
    <h1>${esc(title)}</h1>
${headerF.length ? comment(headerF) + "\n" : ""}    <nav>
      <ul>
${nav}
      </ul>
    </nav>
  </header>
  <main id="app">
${body}
  </main>
  <footer id="site-footer"${df(footerF)}>
${footerF.length ? comment(footerF) + "\n" : ""}    <p>${esc(title)}</p>
  </footer>
  <script src="api.js"></script>
  <script src="app.js"></script>
</body>
</html>
`,
    "styles.css": `/* estilos */\n`,
    "api.js": `// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.\nwindow.api = window.api || {};\n`,
    "app.js": `// Lógica de la UI.\n`,
  };
}

/**
 * Contrato api.js ↔ app.js, determinista.
 * Ejecuta api.js en un sandbox (sin red ni DOM) y lista las funciones de
 * window.api; busca en app.js las llamadas api.X( / window.api.X(.
 */
export function apiContract(files) {
  const sandbox = { console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, Promise };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  let loadError = null;
  try {
    vm.runInNewContext(files["api.js"] || "", sandbox, { timeout: 1000 });
  } catch (e) { loadError = e.message; }
  const api = sandbox.api || {};
  const defined = Object.keys(api).filter((k) => typeof api[k] === "function").sort();
  const called = [...new Set([...String(files["app.js"] || "").matchAll(/\bapi\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))].sort();
  const missing = called.filter((c) => !defined.includes(c));
  return { defined, called, missing, loadError };
}

/** Error de sintaxis de un JS sin ejecutarlo (v0.6.1: APPEND repetía `const` ya declarados). */
export function jsSyntaxError(src) {
  try { new vm.Script(String(src || ""), { filename: "app.js" }); return null; } catch (e) { return e.message; }
}

function contractText(c) {
  return c.defined.length ? c.defined.map((f) => `window.api.${f}()`).join(", ") : "(todavía ninguna)";
}

export const SYSTEM_PROMPT = `Sos el Specialist de MicheLab que construye un PROTOTIPO de SPA.

El proyecto tiene 4 archivos:
- index.html: estructura. Ya enlaza styles.css, api.js y app.js (no cambies esos enlaces).
- styles.css: estilos.
- api.js: capa de datos SIMULADA. Objeto global window.api con datos en memoria y funciones async que imitan endpoints (ej. api.listarProductos(), api.crearContacto(datos)). No hay servidor, base de datos ni dispositivos reales.
- app.js: lógica de la UI. Obtiene y guarda datos SOLO a través de window.api.

La página ya tiene su estructura: un <header> con el nombre y un <nav>, las <section> del cuerpo en orden (cada una con id y data-feature con los requisitos que muestra, ej. data-feature="R3") y un <footer>. Las features que no tienen sección (diseño, responsive, hover, calidad del código) aplican a toda la página.

Ejecutás UNA tarea atómica por vez. Recibís el BRIEF (contexto), la TAREA, el CONTRATO de window.api y los ARCHIVOS que la tarea necesita.

Reglas:
1. Hacé lo que pide la TAREA. No adelantes trabajo de otras tareas.
2. Poné el contenido dentro de la <section> que corresponde. No crees otra sección para algo que ya tiene la suya ni cambies los id o data-feature. No borres ni vacíes el header, el nav ni el footer; podés mejorarlos.
3. Tareas de Backend o DBA (endpoints, esquemas, tablas, servicios): implementalas en api.js como datos y funciones simuladas. Valores que vendrían de sensores, archivos o dispositivos: también simulados en api.js (por ejemplo, el contenido de un archivo como texto dentro de api.js). No uses fetch ni XMLHttpRequest.
4. Las funciones simuladas de window.api SIEMPRE resuelven con éxito (no lanzan errores) y simulan una latencia corta (300 ms como máximo).
5. app.js solo puede llamar funciones que existan en window.api. Si necesitás una nueva, agregala en api.js en la MISMA respuesta.
6. Textos visibles en español, con contenido concreto (nombres, descripciones), no marcadores como "[Nombre]" o "Producto 1". Cada campo de formulario con su <label>.
7. Algunos archivos los recibís COMPLETOS y otros como RESUMEN (solo su estructura). Respondé SOLO con los cambios, en estos formatos:

### APPEND: styles.css
\`\`\`css
reglas nuevas (se agregan al final del archivo; sirve igual para app.js y api.js)
\`\`\`

### SECTION: id
\`\`\`html
el elemento completo con ese id (una <section>, el <header> o el <footer>), que reemplaza al actual en index.html
\`\`\`

### FILE: nombre.ext
\`\`\`lenguaje
el archivo entero (SOLO si lo recibiste COMPLETO y tenés que cambiar mucho)
\`\`\`

Preferí APPEND y SECTION: son más cortos. APPEND es solo para código NUEVO: no copies reglas ni funciones que ya están (en JS, repetir un const o una función rompe la página). Para cambiar código que ya existe en un archivo que recibiste COMPLETO, usá FILE. Nunca devuelvas con FILE un archivo que recibiste como RESUMEN. Si la tarea ya está hecha, respondé solo: SIN CAMBIOS: <motivo en una línea>. Fuera de los bloques, como máximo una línea de nota.`;

export function briefText(refined) {
  const parts = [`Proyecto: ${refined.project_name || ""}`, refined.objetivo || "", "", "Features:"];
  (refined.features || []).forEach((f, i) => parts.push(`${i + 1}. ${f}`));
  // Las exclusiones NO van al Specialist (02/10, decisión de Miche): sirven para
  // que TechLeader no planifique algo, y eso ya pasó. En Project22 eran
  // restricciones mal marcadas ("crea, archivo, html…") y le decían a Gemma
  // "NO implementar html". El Specialist solo ejecuta su tarea (regla 1).
  return parts.join("\n");
}

/** Extrae los bloques "### FILE: x" de la respuesta. Ignora nombres fuera de FILES. */
export function extractFiles(raw) {
  const out = {};
  const re = /###\s*FILE:\s*([\w.\-]+)\s*\n+```[\w-]*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(String(raw || "")))) {
    const name = m[1].trim();
    if (FILES.includes(name)) out[name] = m[2].replace(/\s+$/, "") + "\n";
  }
  return out;
}

function filesBlock(files) {
  return FILES.map((f) => `### FILE: ${f}\n\`\`\`${LANG[f]}\n${files[f]}\`\`\``).join("\n\n");
}

const sha = (s) => createHash("sha256").update(s).digest("hex");
const writeApp = (dir, files) => { mkdirSync(dir, { recursive: true }); for (const f of FILES) writeFileSync(join(dir, f), files[f], "utf8"); };

/**
 * @param {{refined:object, tasks:object[]}} input
 * @param {string} outDir  la app final queda en outDir/app/ (abrir outDir/app/index.html)
 * @param {{log?:(m:string)=>void, model?:string, forbidden?:string[], resume?:boolean, pagePlan?:object|null, contextTokens?:number}} [opts]
 */
export async function buildSpa({ refined, tasks }, outDir, opts = {}) {
  const log = opts.log || console.log;
  mkdirSync(outDir, { recursive: true });
  const brief = briefText(refined);
  const order = topoOrder(tasks.map((t) => ({ ...t, depends_on: (t.depends_on || []).filter((d) => tasks.some((x) => x.id === d)) })));
  let files = skeleton(refined.project_name, refined.features || [], opts.pagePlan);
  let steps = [];
  const sj = join(outDir, "steps.json");
  if (opts.resume && existsSync(sj)) {
    steps = JSON.parse(readFileSync(sj, "utf8"));
    const last = [...steps].reverse().find((s) => s.dir);
    if (last) files = Object.fromEntries(FILES.map((f) => [f, readFileSync(join(outDir, last.dir, f), "utf8")]));
    log(`[SPECIALIST] retomando: ${steps.length}/${order.length} pasos ya hechos${last ? ` (desde ${last.dir})` : ""}`);
  }
  const model = opts.model || SPECIALIST_MODEL;
  const context = opts.contextTokens || CONTEXT_TOKENS;
  const ask = async (user, maxTokens = 8192) => {
    const t0 = Date.now();
    const data = await chatStream(LM_STUDIO_URL, {
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: user }],
      temperature: 0,
      max_tokens: maxTokens,
    });
    return { raw: data.content || "", ms: Date.now() - t0, finish_reason: data.finish_reason ?? null, usage: data.usage ?? null };
  };
  for (const [i, t] of order.entries()) {
    if (i < steps.length) continue;
    const contract = apiContract(files);
    const head =
      `BRIEF:\n${brief}\n\n` +
      `TAREA ${t.id} (${t.role || "?"}): ${t.task}\n${t.description || ""}\n\n` +
      `CONTRATO window.api (funciones que existen hoy): ${contractText(contract)}\n\n`;
    const pp = planPrompt({ task: t, files, head, system: SYSTEM_PROMPT, context });
    const user = head + `ARCHIVOS:\n\n${pp.block}`;
    const leak = (opts.forbidden || []).find((f) => f && user.toLowerCase().includes(f.toLowerCase()));
    if (leak) throw new Error(`criterio holdout filtrado al Specialist en ${t.id}: "${leak}"`);
    log(`[SPECIALIST] ${i + 1}/${order.length} ${t.id} (${t.role || "?"}) — ${t.task}`);
    const tag = `step_${String(i + 1).padStart(2, "0")}_${t.id}`;
    log(`[SPECIALIST]   ve completos: ${[...pp.full].join(", ")}${pp.downgraded.length ? ` (resumidos por presupuesto: ${pp.downgraded.join(", ")})` : ""} · prompt ~${pp.promptTokens} tok · respuesta hasta ${pp.maxTokens}`);
    const r1 = await ask(user, pp.maxTokens);
    writeFileSync(join(outDir, `${tag}.raw.txt`), r1.raw, "utf8");
    let { next, changed, rejected, ops } = applyBlocks(files, r1.raw, pp.full);
    const step = {
      n: i + 1, task_id: t.id, role: t.role || null, ms: r1.ms,
      finish_reason: r1.finish_reason, usage: r1.usage,
      kinds: { primary: pp.primary, secondary: pp.secondary }, full: [...pp.full], downgraded: pp.downgraded, prompt_tokens_est: pp.promptTokens, max_tokens: pp.maxTokens,
      changed, rejected, ops,
    };

    // Contrato: si después del paso app.js llama funciones que api.js no tiene
    // (o api.js no carga), un reintento con el faltante como feedback.
    let after = apiContract(next);
    let appErr = jsSyntaxError(next["app.js"]);
    if (changed.length && (after.missing.length || after.loadError || appErr)) {
      const problem = appErr
        ? `app.js quedó con un error de sintaxis: ${appErr}. Si APPEND repitió código que ya estaba, devolvé app.js COMPLETO con FILE, sin duplicados`
        : after.loadError
        ? `api.js no se puede ejecutar: ${after.loadError}`
        : `app.js llama ${after.missing.map((m) => `window.api.${m}()`).join(", ")}, que no existe en api.js (funciones definidas: ${contractText(after)})`;
      log(`[SPECIALIST]   ${appErr ? "JS roto" : "contrato roto"}: ${problem} → reintento`);
      step.contract_retry = { problem };
      const fixUser =
        `BRIEF:\n${brief}\n\n` +
        `TAREA ${t.id} (${t.role || "?"}): ${t.task}\n${t.description || ""}\n\n` +
        `PROBLEMA EN TU RESPUESTA ANTERIOR: ${problem}.\n` +
        `Corregilo: agregá en api.js lo que falta (simulado, que resuelva con éxito; usá APPEND: api.js) o hacé que app.js use una función existente.\n\n` +
        `ARCHIVOS (ya incluyen tu respuesta anterior):\n\n${filesBlockDiet(next, new Set(["api.js", "app.js"]))}`;
      const r2 = await ask(fixUser, 4000);
      writeFileSync(join(outDir, `${tag}.retry.raw.txt`), r2.raw, "utf8");
      const fix = applyBlocks(next, r2.raw, new Set(["api.js", "app.js"]));
      const fixedContract = apiContract(fix.next);
      step.contract_retry.ms = r2.ms;
      step.contract_retry.finish_reason = r2.finish_reason;
      step.contract_retry.changed = fix.changed;
      const fixedAppErr = jsSyntaxError(fix.next["app.js"]);
      step.contract_retry.resolved = !fixedContract.missing.length && !fixedContract.loadError && !fixedAppErr;
      if (fix.changed.length && !fixedAppErr) {
        next = fix.next;
        step.changed = [...new Set([...step.changed, ...fix.changed])];
        step.ops = [...(step.ops || []), ...fix.ops.map((o) => `${o} (reintento)`)];
        after = fixedContract;
      }
      log(`[SPECIALIST]   reintento: ${step.contract_retry.resolved ? "contrato OK" : "sigue roto"}`);
    }
    if (jsSyntaxError(next["app.js"])) {
      // Ni el reintento lo arregló: se descarta el cambio a app.js (mejor sin la tarea que con la página rota).
      step.rejected.push(`app.js: error de sintaxis (${jsSyntaxError(next["app.js"])}); se conserva la versión anterior`);
      next = { ...next, "app.js": files["app.js"] };
      step.changed = step.changed.filter((f) => f !== "app.js" || next["app.js"] !== files["app.js"]);
      after = apiContract(next);
    }
    step.contract = { defined: after.defined, called: after.called, missing: after.missing, loadError: after.loadError };

    if (!step.changed.length) {
      if (!rejected.length && r1.finish_reason === "stop") {
        // Gemma dice que no hace falta cambiar nada: no es un error.
        step.no_change = (r1.raw.match(/SIN CAMBIOS:\s*(.*)/i)?.[1] || r1.raw.trim().split("\n")[0] || "").slice(0, 240);
        log(`[SPECIALIST]   sin cambios: ${step.no_change}`);
      } else {
        step.error = rejected.length ? `cambios descartados: ${rejected.join("; ")}` : "la respuesta no trae bloques FILE/APPEND/SECTION";
        log(`[SPECIALIST] ✗ ${t.id}: ${step.error} (finish_reason=${step.finish_reason})`);
      }
    } else {
      files = next;
      step.dir = tag;
      writeApp(join(outDir, tag), files);
      step.sha256 = Object.fromEntries(FILES.map((f) => [f, sha(files[f])]));
      log(`[SPECIALIST]   ${(step.ops || []).join(", ") || "cambió: " + step.changed.join(", ")}${rejected.length ? ` | descartado: ${rejected.join("; ")}` : ""}${after.missing.length ? ` | ⚠ contrato: faltan ${after.missing.join(", ")}` : ""}`);
    }
    steps.push(step);
    writeFileSync(sj, JSON.stringify(steps, null, 2));
  }
  writeApp(join(outDir, "app"), files);
  return { model, specialist_version: SPECIALIST_VERSION, order: order.map((t) => t.id), steps };
}
