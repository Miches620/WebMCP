// build.mjs — contrato con build/run_build.mjs para el profile web/app (y, con
// otras reglas, web/game). Mismo contrato que web/landing/build.mjs.
//
// Usa el MOTOR del Specialist por componentes de web/landing (encapsulado,
// chequeos por paso, reintento) con un plan de UNA pantalla: un componente
// principal, sin header ni footer. Eso queda declarado en `borrowed` del profile.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildComponents, baselineHtml } from "../landing/specialist_components.mjs";
import { translateRequirement as translateWeb } from "../validation/check_translator.mjs";
import { planPage as planApp, planText } from "./page_plan.mjs";
import { APP_TRANSLATOR, APP_FILES_TRANSLATOR } from "./translator_rules.mjs";
import { APP_SPECIALIST_RULES, rulesBrief } from "./specialist_rules.mjs";
import { buildFiles } from "../../../harness/files_engine.mjs";
import { WEB_FILES, baselinePage } from "../specialist/files_kit.mjs";
import { getStandard } from "../../../standards/registry.mjs";
import profile from "./profile.mjs";

// paso 2 (06/10): Validation profile de este tipo = cadena web → web/app (no el catálogo entero)
import { validationFor, CATALOG_VERSION } from "../validation/check_catalog.mjs";
export { CATALOG_VERSION };
const V = validationFor(["web", "web/app"]);
export const { runChecks, normalizeCheck } = V;
export const validationProfile = V.ids;
// 12/10 (punto 7): compuerta de llamadas. Lee el Standard que se usó; solo corre si el Standard la declara.
export { validationGates } from "./calls_gate.mjs";
import { taskVerdicts as verdictsOf } from "./task_verdict.mjs";
export { taskVerdictLines, taskVerdictSummary } from "./task_verdict.mjs";
/**
 * 14/10 (punto 9 paso 3): veredicto de Validation por Atomic Task, con la evidencia que ya hay (pruebas de
 * lógica, compuerta de llamadas y el paso enlace: qué acción hace cada tarea). null si las tareas no
 * traen pieza (corrida sin receta).
 */
export function taskVerdicts({ input, specialist, gates, coverage = null }) {
  if (!(input?.tasks || []).some((t) => t.pieza)) return null;
  return verdictsOf({
    tasks: input.tasks,
    contract: gates?.tareas ? { acciones: Object.entries(gates.tareas).map(([nombre, tareas]) => ({ nombre, tareas })) } : null,
    // v0.2 (Standard v0.6): el paso enlace deja en su resumen qué acción hace cada tarea
    links: specialist?.data?.enlace?.report?.[0]?.porTarea ? (({ porTarea, ninguna, listaDe, requisitosDe }) => ({ porTarea, ninguna: ninguna || [], ...(listaDe ? { listaDe } : {}), ...(requisitosDe ? { requisitosDe } : {}) }))(specialist.data.enlace.report[0]) : null,
    // 15/10 (p49): vista → qué se ve de cada lista; datos → listas del contrato y su forma; estilo → veredicto por requisito
    lists: gates?.listas || null, data: gates?.datos || null, shape: gates?.forma || null,
    requirements: coverage ? Object.fromEntries(coverage.map((c) => [c.id, { verdict: c.verdict, detail: c.reason || (c.checks || []).find((k) => k.result !== "PASS")?.detail || "" }])) : null,
    acceptance: specialist?.rule_tests || null,
    gateRows: gates?.rows?.length ? gates.rows : null,
    // 15/10 (p48): lo que vio Validation en la pantalla al usar cada acción (action_changes por requisito)
    screen: coverage ? Object.fromEntries(coverage.map((c) => [c.id, (c.checks || []).find((k) => k.type === "action_changes")]).filter(([, k]) => k).map(([id, k]) => [id, { result: k.result, detail: k.detail }])) : null,
  });
}
export { planText, PAGE_PLAN_VERSION } from "./page_plan.mjs";

// Una sola pantalla con todo el juego/app adentro: Boxworld build 3 usó 7117 de 8000
// tokens de respuesta en #juego y el reintento se cortó por length. Con 16k de contexto
// y ~3.5k de prompt entran ~11k de respuesta.
export const MAX_ANSWER = 11000;

/**
 * Arma el contrato de build para un tipo de UNA pantalla.
 * @param {{translator, systemExtra:string, extraChecks?:object[], mainId?:string}} cfg
 */
export function makeScreenBuild(cfg) {
  const mainId = cfg.mainId || "principal";
  return {
    planPage: (features, opts = {}) => planApp(features, { ...opts, mainId }),
    translateRequirement: (text, opts = {}) => translateWeb(text, { ...opts, translator: cfg.translator }),
    // sin anclaje de sección (eso es de landing): hay una sola pieza
    postprocessChecks: (checks) => checks,
    build: (input, outDir, opts = {}) => {
      const { legacy, ...rest } = opts;
      if (legacy) throw new Error("--legacy es del Specialist v0.6.1 de landing; no aplica a web/app ni web/game");
      return buildComponents(input, outDir, {
        ...rest,
        systemExtra: cfg.systemExtra,
        briefExtra: rulesBrief,
        maxAnswer: MAX_ANSWER,
        extraChecks: (cfg.extraChecks || []).map((x) => ({ only: mainId, ...x })),
      });
    },
    // lo que el Specialist ve además de objetivo + features (para la guardia de holdout del core)
    specialistSees: rulesBrief,
    writeBaseline: (baselineDir, input, basePlan) => writeFileSync(join(baselineDir, "index.html"), baselineHtml(input.refined, basePlan), "utf8"),
  };
}

const APP = makeScreenBuild({ translator: APP_TRANSLATOR, systemExtra: APP_SPECIALIST_RULES });
// 12/10: por archivos (por defecto) el traductor no ofrece chequeos de formulario (la app no tiene <form>)
const FILES = makeScreenBuild({ translator: APP_FILES_TRANSLATOR, systemExtra: APP_SPECIALIST_RULES });
const legacyFlag = (opts = {}) => !!opts.legacyComponents || process.argv.includes("--legacy-components");
export const { planPage, specialistSees } = APP;
export const translateRequirement = (text, opts = {}) => (legacyFlag(opts) ? APP : FILES).translateRequirement(text, opts);

// 12/10 (Kanban real, 2ª corrida): aunque el traductor elija chequeos de formulario o click_changes, en la app
// por archivos se cambian por UN action_changes. Las palabras salen del requisito (el verbo primero) y de los
// params que eligió el traductor. Lo decide el código, no el modelo (como "próximo nivel" en web/game).
const FORM_CHECKS = new Set(["submit_empty_blocked", "valid_submit_passes", "field_exists", "field_required", "field_optional", "click_changes", "click_reveals"]);
const STOP = new Set(["a", "al", "el", "la", "las", "los", "lo", "de", "del", "en", "entre", "con", "y", "o", "u", "para", "por", "un", "una", "unos", "unas", "que", "se", "sus", "su", "le", "les", "mas", "muy", "cada", "todo", "todos", "todas"]);
const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function actionWords(text, checks = []) {
  const fromText = nrm(text).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  const fromParams = checks.flatMap((c) => [].concat(c?.params?.click || [], c?.params?.text || [], c?.params?.field || [])).map(nrm);
  // una raíz cuenta una vez (tarjetas y tarjeta pesaban doble y "mover" perdía contra "+ Crear Tarjeta")
  const seen = new Set();
  return [...fromText, ...fromParams].filter((w) => { const k = w.slice(0, 6); if (!w || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
}
// 15/10 (p47, builds 00-25-22, 02-27-10 y 03-49-43: R3 "Agregar comentarios a las tarjetas" → counter_on_action → FAIL
// "no hay ningún número junto a: comentarios"): el traductor sumaba un contador que el requisito no pide. Un
// counter_on_action solo queda si el TEXTO del requisito nombra un número (lo decide el código, no el modelo).
const NUMBER_WORDS = /\b(contador(es)?|cantidad(es)?|n[uú]mero(s)?|puntaje(s)?|puntos?|total(es)?|cu[aá]nt[oa]s|conteo|cuenta|score|movimientos|pasos|intentos|vidas)\b/i;
export const namesANumber = (text) => NUMBER_WORDS.test(String(text || ""));
// 16/10 (build 2026-10-16T13-54-56, la misma clase de error que p47): el traductor puso no_horizontal_scroll a
// R9 (colores), R12 y R16 (orden de tarjetas), y key_changes con flechas a R15 (sombras al arrastrar). 6 de los 9
// FAIL eran del juez, no de la app. Esos chequeos quedan solo si el TEXTO del requisito los nombra.
const RESPONSIVE_WORDS = /\b(responsive|responsiv[oa]s?|m[oó]vil(es)?|celular(es)?|tel[eé]fonos?|tablets?|pantallas? (chica|peque[nñ]a)s?|scroll horizontal|desplazamiento horizontal|ancho de (la )?pantalla|adaptables?|se adapta)\b/i;
const KEY_WORDS = /\b(teclado|teclas?|flechas?|atajos?|enter|escape|esc|barra espaciadora|keyboard)\b/i;
export const namesResponsive = (text) => RESPONSIVE_WORDS.test(String(text || ""));
export const namesKeys = (text) => KEY_WORDS.test(String(text || ""));
// 16/10 noche (visión unificada, "la vara"): el VERBO del requisito decide qué FLUJO se prueba, como una persona
// (profiles/web/validation/flows.mjs). action_changes ("algo cambió") daba PASS a una app que no creaba nada.
// crear/agregar → flow_create · editar → flow_edit · borrar/eliminar → flow_delete · mover/arrastrar → flow_move ·
// guardar/localStorage/recargar → flow_persist. Las palabras del control salen del requisito (el verbo primero).
// Un requisito de ESTILO no suma flujos (sombras "durante el drag&drop" es cómo se ve, no si se puede mover).
const FLOW_VERBS = [
  // solo VERBOS: "en el modal de creación o edición" (R3, prioridad) no pide probar editar; daba PASS falso
  { re: /\b(crear|crearl[ao]s?|creo|agregar|agrega|añadir|anadir|sumar)\b/i, type: "flow_create", verb: "agregar" },
  { re: /\b(editar|editarl[ao]s?|edita|modificar|renombrar)\b/i, type: "flow_edit", verb: "editar" },
  { re: /\b(borrar|borra|eliminar|elimina|quitar)\b/i, type: "flow_delete", verb: "eliminar" },
  { re: /\b(mover|mueve|arrastr\w*|drag\s*(&|and)?\s*drop|drag)\b/i, type: "flow_move", verb: "mover" },
  { re: /\b(guardar|guarda|persist\w*|local\s*storage|recarg\w*)\b/i, type: "flow_persist", verb: "agregar" },
];
const ACTION_TYPES = new Set(["action_changes", ...FORM_CHECKS]);
/** Los flujos que pide el texto de un requisito (en el orden en que aparecen los verbos). */
export function flowsFor(text, { style = false } = {}) {
  if (style) return [];
  const t = String(text || "");
  // el objeto del verbo = la primera palabra con contenido que viene DESPUÉS ("borrar una tarjeta" → tarjeta)
  const objectAfter = (at) => (actionWords(t.slice(at).replace(/^\S+/, "")).find((w) => !FLOW_VERBS.some((f) => f.re.test(w))) || null);
  return FLOW_VERBS.map((f) => ({ f, at: t.search(f.re) })).filter((x) => x.at >= 0).sort((a, b) => a.at - b.at)
    .map(({ f, at }) => {
      const obj = objectAfter(at), nouns = obj ? [obj] : [];
      return { type: f.type, params: f.type === "flow_create" || f.type === "flow_persist" ? { abrir: [f.verb, ...nouns] } : { abrir: [f.verb, ...nouns], crear: ["agregar", ...nouns] } };
    });
}
export function postprocessChecks(checks = [], id, text = "", opts = {}) {
  if (legacyFlag()) return checks;
  const why = [];
  let out = checks;
  // flujos primero: reemplazan a los chequeos de "algo cambió" (y se suman aunque el traductor no haya dado nada)
  const flows = flowsFor(text, opts);
  if (flows.length) {
    out = [...out.filter((c) => !ACTION_TYPES.has(c?.type)), ...flows.filter((f) => !out.some((c) => c?.type === f.type))];
    why.push(`flujo como una persona: ${flows.map((f) => f.type).join(", ")}`);
  }
  if (!namesANumber(text) && out.some((c) => c?.type === "counter_on_action")) {
    out = out.filter((c) => c?.type !== "counter_on_action");
    why.push("counter_on_action fuera: el requisito no nombra ningún número");
  }
  if (!namesResponsive(text) && out.some((c) => c?.type === "no_horizontal_scroll")) {
    out = out.filter((c) => c?.type !== "no_horizontal_scroll");
    why.push("no_horizontal_scroll fuera: el requisito no habla de pantallas chicas ni de responsive");
  }
  if (!namesKeys(text) && out.some((c) => c?.type === "key_changes")) {
    out = out.filter((c) => c?.type !== "key_changes");
    why.push("key_changes fuera: el requisito no nombra el teclado ni teclas");
  }
  if (!flows.length && out.some((c) => FORM_CHECKS.has(c?.type))) {
    const rest = out.filter((c) => !FORM_CHECKS.has(c?.type));
    if (!rest.some((c) => c?.type === "action_changes")) rest.push({ type: "action_changes", params: { click: actionWords(text, checks) } });
    out = rest;
    why.push("palabras que describen la pieza");
  }
  return why.length ? Object.assign(out, { why: why.join("; ") }) : checks;
}

/** El Standard con el que se construye: el que resolvió run_build (opts.standardId) o, si no viene, el del profile. */
export const standardOf = (opts = {}) => opts.standardId || profile.standard;

// 12/10 (paso 2 del borde, decisión de Miche): la app se escribe POR ARCHIVOS con el Standard que
// declara el profile (standards/web/app/estado, DRAFT), con el mismo motor universal que web/game.
// --legacy-components vuelve al componente único (motor de landing), para comparar.
export function build(input, outDir, opts = {}) {
  if (opts.legacy) return APP.build(input, outDir, opts); // tira el error de siempre (--legacy es de landing)
  if (legacyFlag(opts)) return APP.build(input, outDir, opts);
  // 14/10 (punto 9): la receta del Standard le dice al motor a qué paso va cada tarea (por su pieza)
  // 16/10 (BUG: las corridas 15-48-47 y 16-24-56 dieron byte a byte lo mismo): el Standard y la receta salían del
  // profile fijo de este archivo, no del RESUELTO (refined_prompt.standard o --standard). Ahora los pasa run_build.
  const std = standardOf(opts);
  return buildFiles(input, outDir, { ...opts, standard: getStandard(std), platform: WEB_FILES, recipe: "recipe" in opts ? opts.recipe : profile.atomizerRecipe || null });
}
export function writeBaseline(baselineDir, input, basePlan, specialist) {
  if (!specialist?.standard) return APP.writeBaseline(baselineDir, input, basePlan, specialist);
  writeFileSync(join(baselineDir, "index.html"), baselinePage(input.refined, basePlan, getStandard(specialist.standard.id)), "utf8");
}
