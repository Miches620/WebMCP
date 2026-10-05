// build.mjs — lo que el build (core: build/run_build.mjs) le pide a un profile.
// Profile web/landing. Solo lo importa Node.
//
// Contrato (lo mismo tendrá que exportar cualquier otro tipo: web/app, firmware/…):
//   planPage(features) / planText(plan) / PAGE_PLAN_VERSION   plan de la pieza
//   build(input, outDir, opts)                                 Specialist
//   writeBaseline(dir, input, plan, specialist)                esqueleto vacío (control de Validation)
//   translateRequirement(text, {context})                      requisito → chequeos (con las reglas del profile)
//   postprocessChecks(checks, rid, text)                       ajustes deterministas del profile
//   runChecks / normalizeCheck / CATALOG_VERSION               runner de la plataforma

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildSpa, skeleton, FILES, featureLabel } from "./specialist_spa.mjs";
import { buildComponents, baselineHtml } from "./specialist_components.mjs";
import { anchorSections } from "./check_postprocess.mjs";
import { LANDING_TRANSLATOR } from "./translator_rules.mjs";
import { translateRequirement as translateWeb } from "../validation/check_translator.mjs";

export { planPage, planText, PAGE_PLAN_VERSION } from "./page_plan.mjs";
export { runChecks, normalizeCheck, CATALOG_VERSION } from "../validation/check_catalog.mjs";

export const translateRequirement = (text, opts = {}) => translateWeb(text, { ...opts, translator: LANDING_TRANSLATOR });

export const postprocessChecks = (checks, rid, text) => anchorSections(checks, rid, text, featureLabel(text));

/**
 * v0.7 (03/10, decisión de Miche): Specialist por COMPONENTES desde el page plan.
 * opts.legacy (--legacy) usa el Specialist v0.6.1 (tareas del graph sobre 4 archivos compartidos).
 */
export function build(input, outDir, opts = {}) {
  const { legacy, pagePlan, ...rest } = opts;
  return legacy || !pagePlan
    ? buildSpa(input, outDir, { ...rest, pagePlan })
    : buildComponents(input, outDir, { ...rest, pagePlan });
}

// Mismo esqueleto que recibió el Specialist: con plan de página si la corrida lo tiene
// (v0.5; null = plan inválido → mínimo), una sección por feature si es una corrida vieja.
export function writeBaseline(baselineDir, input, basePlan, specialist) {
  if (String(specialist?.specialist_version || "").includes("componentes")) {
    writeFileSync(join(baselineDir, "index.html"), baselineHtml(input.refined, basePlan), "utf8");
  } else {
    const base = skeleton(input.refined.project_name, input.refined.features || [], basePlan);
    for (const f of FILES) writeFileSync(join(baselineDir, f), base[f], "utf8");
  }
}
