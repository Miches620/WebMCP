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
 * lógica, compuerta de llamadas y las "tareas" que declara cada acción del contrato). null si las tareas no
 * traen pieza (corrida sin receta).
 */
export function taskVerdicts({ input, specialist, gates }) {
  if (!(input?.tasks || []).some((t) => t.pieza)) return null;
  return verdictsOf({
    tasks: input.tasks,
    contract: gates?.tareas ? { acciones: Object.entries(gates.tareas).map(([nombre, tareas]) => ({ nombre, tareas })) } : null,
    acceptance: specialist?.rule_tests || null,
    gateRows: gates?.rows?.length ? gates.rows : null,
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
export function postprocessChecks(checks = [], id, text = "") {
  if (legacyFlag()) return checks;
  const form = checks.filter((c) => FORM_CHECKS.has(c?.type));
  if (!form.length) return checks;
  const out = checks.filter((c) => !FORM_CHECKS.has(c?.type));
  if (!out.some((c) => c?.type === "action_changes")) out.push({ type: "action_changes", params: { click: actionWords(text, checks) } });
  return out;
}

// 12/10 (paso 2 del borde, decisión de Miche): la app se escribe POR ARCHIVOS con el Standard que
// declara el profile (standards/web/app/estado, DRAFT), con el mismo motor universal que web/game.
// --legacy-components vuelve al componente único (motor de landing), para comparar.
export function build(input, outDir, opts = {}) {
  if (opts.legacy) return APP.build(input, outDir, opts); // tira el error de siempre (--legacy es de landing)
  if (legacyFlag(opts)) return APP.build(input, outDir, opts);
  // 14/10 (punto 9): la receta del Standard le dice al motor a qué paso va cada tarea (por su pieza)
  return buildFiles(input, outDir, { ...opts, standard: getStandard(profile.standard), platform: WEB_FILES, recipe: profile.atomizerRecipe || null });
}
export function writeBaseline(baselineDir, input, basePlan, specialist) {
  if (!specialist?.standard) return APP.writeBaseline(baselineDir, input, basePlan, specialist);
  writeFileSync(join(baselineDir, "index.html"), baselinePage(input.refined, basePlan, getStandard(specialist.standard.id)), "utf8");
}
