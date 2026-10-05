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
import { APP_TRANSLATOR } from "./translator_rules.mjs";
import { APP_SPECIALIST_RULES, rulesBrief } from "./specialist_rules.mjs";

export { runChecks, normalizeCheck, CATALOG_VERSION } from "../validation/check_catalog.mjs";
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
export const { planPage, translateRequirement, postprocessChecks, build, writeBaseline, specialistSees } = APP;
