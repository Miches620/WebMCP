// files_kit.mjs — KIT de la plataforma web para el motor por archivos (12/10, refactor del borde).
//
// Decisión de Miche (12/10): el harness tiene que ser universal; lo propio de una plataforma vive en
// su profile. Antes todo esto estaba dentro de harness/files_engine.mjs (v0.9.9) y el motor importaba
// 7 módulos de profiles/web. Ahora el motor no sabe de web: este kit le da
//   - el pedido de sistema del Specialist web (FILE_PROMPT),
//   - el contexto del pedido (brief + reglas del usuario, notas del TechLeader, features del plan),
//   - las clases de paso de web: screen (HTML+CSS), render (dibujo en Chromium), wiring (eventos +
//     chequeos de Validation); y registra la de JavaScript (logic, harness/kinds_js.mjs),
//   - el arreglo previo de un .js (declaración repetida sin Gemma; reparación de sintaxis por tramo),
//   - cómo se arma y se escribe la app (index.html + styles.css + scripts).
// Movido sin cambios de conducta: los pedidos a Gemma son idénticos (verificado byte a byte con un LM falso).

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fatal, extractFile } from "../../../harness/files_engine.mjs";
import { syntaxOf, topNames, clashes, shadowProblems } from "../../../harness/js_tools.mjs";
import { logicKind, jsBasics, storeFile, frozenFile } from "../../../harness/kinds_js.mjs";
import { briefText } from "../landing/specialist_spa.mjs";
import { assignTasks, notesText, componentsFromPlan } from "../landing/components.mjs";
import { repairSyntax } from "../landing/specialist_components.mjs";
import { fixRedeclare } from "./encapsulation.mjs";
import { runChecks } from "../validation/check_catalog.mjs";
import { rulesBrief } from "../app/specialist_rules.mjs";
import { probePage, swatchProbe, swatchProblems, stableProbe, stableProblems, drawnLooksProbe, drawnLooksProblems, runScenario, runCallsProbe } from "../validation/page_tools.mjs";

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

// ---------- screen ----------
/** ¿El elemento con ese id trae el atributo disabled en el HTML? */
export function disabledInHtml(html, id) {
  const m = String(html || "").match(new RegExp(`<[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, "i"));
  return !!m && /\sdisabled(\s|=|>|\/)/i.test(m[0].replace(/\bid\s*=\s*["'][^"']*["']/i, ""));
}
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
export function writeApp(dir, files, page) {
  for (const [name, content] of Object.entries(files)) {
    if (content == null) continue;
    const p = join(dir, name);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, content, "utf8");
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page, "utf8");
}

// ---------- herramientas de página: viven en Validation (paso 2); el kit las usa ----------
export { probePage, swatchProbe, swatchProblems, stableProbe, stableProblems, drawnLooksProbe, drawnLooksProblems, runScenario, runCallsProbe } from "../validation/page_tools.mjs";

/** Botones con disabled en el HTML (cualquiera, no solo los de un id). 12/10, web/app. */
export function disabledButtons(html) {
  return [...String(html || "").matchAll(/<button\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /\sdisabled(\s|=|>|\/)/i.test(t));
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
/**
 * Problemas de la sonda de llamadas (runCallsProbe). spec = { global, methods, draw, forms?: [métodos de formulario], hints?: {método: pista} }.
 * 12/10 (web/app): cada acción que el usuario dispara con un botón o un formulario tiene que poder
 * dispararse desde la pantalla, y después se tiene que dibujar otra vez.
 */
export function callsProblems(r, spec) {
  if (!r.found) return fatal([`${spec.global} no existe en la página.`]);
  const out = [];
  if (r.errors.length) out.push(`al usar la pantalla (completar campos y apretar botones) hubo un error de JS: ${r.errors[0]}`);
  for (const k of r.reloads) out.push(`apretar "${k.replace(/^\w+:/, "")}" recarga la página (un formulario sin event.preventDefault() en su listener submit): se pierde el estado.`);
  if (!r.controls) out.push(`la pantalla no tiene ningún botón: no se puede hacer nada.`);
  // si un formulario recargó la página, su acción no llegó a contarse: el problema ya está dicho arriba
  const missing = spec.methods.filter((m) => !r.calls[m] && !(r.reloads.length && (spec.forms || []).includes(m)));
  for (const m of missing) out.push(`ningún control de la pantalla llama a ${spec.global}.${m}${spec.hints?.[m] ? ` (${spec.hints[m]})` : ""}.`);
  if (r.tracked) for (const m of Object.keys(r.undrawn)) if (r.undrawn[m] === r.calls[m]) out.push(`después de ${spec.global}.${m} no se llama a ${spec.draw}(estado): la pantalla no cambia.`);
  return out;
}

// ---------- clases de paso de web ----------
const screenKind = {
  make: (st, env) => ({
    judge: async (c) => {
      const { S, opts, outDir, page } = env;
      const out = [];
      const [html, css] = st.files;
      if (!c[html]) out.push(`la respuesta no trajo ### FILE: ${html}.${env.wrongNote(st)}`);
      else { const miss = missingIds(c[html], S.ids || []); if (miss.length) out.push(`faltan estos ids en ${html}: ${miss.map((x) => "#" + x).join(", ")}.`); }
      if (!c[css]) out.push(`la respuesta no trajo ### FILE: ${css}.`);
      for (const id of st.enabled || []) if (disabledInHtml(c[html], id)) out.push(`en ${html}, #${id} tiene el atributo disabled: así nunca se puede usar. Sacá disabled.`);
      // 12/10 (web/app): ningún botón nace deshabilitado (los botones no se conocen de antemano)
      // 12/10 (web/app v0.2): etiquetas que la pantalla fija NO lleva (las dibuja el código desde el estado)
      if (st.forbidTags && c[html]) { const tags = st.forbidTags.filter((t) => new RegExp(`<${t}\\b`, "i").test(cleanFragment(c[html]))); if (tags.length) out.push(`${html} no lleva ${tags.map((t) => `<${t}>`).join(", ")}: lo que depende del estado (botones y campos) lo dibuja el código de dibujo. Dejá solo el título y los contenedores.`); }
      if (st.noDisabled && c[html]) { const d = disabledButtons(c[html]); if (d.length) out.push(`en ${html} hay botones con el atributo disabled (${d.slice(0, 2).join(" ")}): así nunca se pueden usar. Sacá disabled.`); }
      if (out.length || !st.swatches || opts.check === false) return out;
      // v0.9.1 (Boxworld b10): que las variantes SE VEAN distintas. b10 pasó 5 chequeos con un
      // tablero de 100 casilleros iguales: styles.css decía ".casillero .pared" (descendiente)
      // y dibujar() pone las clases en el mismo div → ningún color se aplicaba.
      const dir = join(outDir, `probe_${st.id}`);
      writeApp(dir, { [css]: cleanCss(c[css]) }, page([], swatchProbe(st.swatches), cleanFragment(c[html])));
      const swp = swatchProblems(await probePage(join(dir, "index.html")), st.swatches, c[css]);
      if (swp.length || !st.stable) return swp;
      // v0.9.4 (Boxworld b12): la grilla no se puede deformar cuando otro elemento cambia su texto
      const sdir = join(outDir, `probe_${st.id}_estable`);
      writeApp(sdir, { [css]: cleanCss(c[css]) }, page([], stableProbe(st.stable), cleanFragment(c[html])));
      return stableProblems((await probePage(join(sdir, "index.html"))).probe, st.stable);
    },
  }),
  store: (st, _K, s, env) => {
    env.ctx.fragment = cleanFragment(s.content[st.files[0]]);
    env.files[st.files[1]] = cleanCss(s.content[st.files[1]]);
  },
  frozen: async (st, fz, env) => {
    if (!fz.fragment) throw new Error("BENCH_FROZEN: falta el fragmento HTML (index.html del build congelado)");
    env.ctx.fragment = fz.fragment; env.files[st.files[1]] = fz.files?.[st.files[1]] || "";
  },
};

const renderKind = {
  make: (st, env) => ({
    judge: async (c) => {
      const { S, opts, outDir, files, page } = env;
      const code = c[st.file];
      const b = jsBasics(st, code, env); if (b) return b;
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
      writeApp(dir, { ...files, [st.file]: code }, page(S.scripts.slice(0, S.scripts.indexOf(st.file) + 1), st.probe + (st.looks ? "\n" + drawnLooksProbe(st.looks) : "")));
      const pr = await probePage(join(dir, "index.html"));
      const base = probeProblems(pr, st);
      if (base.fatal || !st.looks) return base;
      return [...base, ...drawnLooksProblems(pr.looks, st.looks, code, st.file)];
    },
  }),
  store: storeFile,
  frozen: frozenFile,
};

const wiringKind = {
  make: (st, env) => ({
    judge: async (c) => {
      const { S, opts, outDir, files, page } = env;
      const code = c[st.file];
      const b = jsBasics(st, code, env); if (b) return b;
      const others = Object.fromEntries(S.scripts.filter((f) => f !== st.file).map((f) => [f, files[f]]));
      const cl = clashes(code, others);
      if (cl.length) return cl;
      if (opts.check === false) return [];
      const dir = join(outDir, `probe_${st.id}`);
      writeApp(dir, { ...files, [st.file]: code }, page(S.scripts));
      const pp = playProblems(await runChecks(join(dir, "index.html"), st.play || []));
      if (pp.fatal) return pp;
      // 12/10 (web/app): cada acción se puede disparar desde la pantalla y después se dibuja
      if (st.calls) { const cp = callsProblems(await runCallsProbe(join(dir, "index.html"), st.calls), st.calls); if (cp.fatal) return cp; pp.push(...cp); }
      if (!st.scenarios) return pp;
      const sp = [];
      for (const sc of st.scenarios) {
        const sdir = join(outDir, `probe_${st.id}_${sc.id}`);
        writeApp(sdir, { ...files, [st.file]: code, ...sc.files }, page(S.scripts));
        sp.push(...await runScenario(join(sdir, "index.html"), sc));
      }
      return [...pp, ...sp];
    },
  }),
  store: storeFile,
  frozen: frozenFile,
};

// ---------- arreglo previo de un .js (antes de extraer y juzgar) ----------
async function preFix({ raw, names, known, att, st, n, env }) {
  const { S, outDir, log, ask } = env;
  const jsName = names.find((x) => x.endsWith(".js"));
  if (!jsName) return raw;
  let js = extractFile(raw, jsName, known);
  if (!js) return raw;
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
  return raw;
}

// ---------- la plataforma ----------
export const WEB_FILES = {
  id: "web",
  systemPrompt: FILE_PROMPT,
  kinds: { logic: logicKind, screen: screenKind, render: renderKind, wiring: wiringKind },
  /** Archivos del proyecto además de los scripts del Standard. */
  extraFiles: ["styles.css"],
  /** Globales que la lógica pura (st.pure) no puede usar. */
  pureForbidden: ["document", "window"],
  /** Contexto del pedido: brief + reglas del usuario, notas del TechLeader del componente principal, features. */
  prepare({ refined, tasks }, opts, S) {
    const comps = componentsFromPlan(opts.pagePlan, refined.features || []);
    const main = comps[0];
    const features = main ? main.features.map((f) => f.id) : [];
    const notes = notesText((assignTasks(comps, tasks).byComp[main?.id] || []), { maxDescribed: 0 });
    const brief = briefText(refined) + "\n\n" + rulesBrief(refined);
    const title = refined.project_name || S.defaultTitle || "Proyecto";
    return { brief, notes, features, title, initial: { fragment: "" } };
  },
  /** page(scripts, inline, fragment) para las sondas y la app. */
  pageFor: (env) => (scripts, inline = "", fr = env.ctx.fragment) => pageHtml({ title: env.title, fragment: fr, features: env.features, scripts, inline, mainId: env.S.mainId }),
  preFix,
  /** La app final: index.html + styles.css + scripts, en outDir/app. */
  finish(env) {
    writeApp(join(env.outDir, "app"), env.files, env.page(env.S.scripts));
    return ["index.html", "styles.css", ...env.S.scripts];
  },
};

/** Esqueleto de control para Validation: la misma página sin JS ni contenido. */
export function baselinePage(refined, plan, standard) {
  const comps = componentsFromPlan(plan, refined.features || []);
  return pageHtml({ title: refined.project_name || standard.defaultTitle || "Proyecto", fragment: "", features: comps[0] ? comps[0].features.map((f) => f.id) : [], scripts: [], mainId: standard.mainId });
}
