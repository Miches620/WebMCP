// test_app.mjs — partes deterministas de web/app y web/game (05/10).
//   node profiles/web/app/test_app.mjs
import { planPageSync } from "./page_plan.mjs";
import { rulesBrief, APP_SPECIALIST_RULES } from "./specialist_rules.mjs";
import { GAME_SPECIALIST_RULES } from "../game/specialist_rules.mjs";
import { GAME_EXTRA_CHECKS } from "../game/build.mjs";
import * as appBuild from "./build.mjs";
import * as gameBuild from "../game/build.mjs";
import { componentsFromPlan, assignTasks } from "../landing/components.mjs";
import { baselineHtml } from "../landing/specialist_components.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

// Boxworld (Project25): 8 features, la última es de estilo
const refined = {
  project_name: "Boxworld",
  features: ["El juego es el clásico Boxworld", "Botón reiniciar y próximo nivel", "Al menos 5 niveles", "Flechas del teclado", "De a un casillero", "Mapa fijo", "Contador de movimientos", "Estilo Family NES, 8bits"],
  estilo: ["Estilo Family NES, 8bits"],
  restricciones: ["El avatar no puede atravesar paredes ni cajas", "El nivel se considera superado cuando todas las cajas ocupan todos los objetivos del nivel."],
  contexto: ["Juego Boxworld en html autocontenido"],
};
const { plan } = planPageSync(refined.features, { refined, mainId: "juego" });
t("plan de una pantalla: un solo componente con todas las features menos estilo", plan.sections.length === 1 && plan.sections[0].id === "juego" && plan.sections[0].features.join() === "R1,R2,R3,R4,R5,R6,R7" && plan.transversales.join() === "R8", JSON.stringify(plan));
t("plan sin header ni footer", plan.header === null && plan.footer === null);
const comps = componentsFromPlan(plan, refined.features);
t("componentes: solo #juego (sin site-header / site-footer)", comps.map((c) => c.id).join() === "juego");
t("landing sigue igual: plan sin header explícito → header y footer", componentsFromPlan({ sections: [{ id: "a", titulo: "A", features: [] }] }).map((c) => c.id).join() === "site-header,a,site-footer");
const as = assignTasks(comps, [{ id: "F1", role: "Frontend", task: "Grid 10x10" }, { id: "F2", role: "Frontend", task: "Contador" }, { id: "Q1", role: "QA", task: "Probar" }]);
t("todas las tareas (menos QA) van al único componente", as.byComp.juego.map((x) => x.id).join() === "F1,F2");
const base = baselineHtml(refined, plan);
t("esqueleto de control: una sección, sin header/footer", (base.match(/<section/g) || []).length === 1 && !base.includes("site-header") && !base.includes("<footer"));

const rb = rulesBrief(refined);
t("brief: las restricciones del usuario llegan al Specialist como reglas", rb.includes("REGLAS DEL USUARIO") && rb.includes("todas las cajas ocupan todos los objetivos") && rb.includes("CONTEXTO DEL USUARIO"));
t("brief vacío sin restricciones ni contexto", rulesBrief({}) === "");
t("reglas de juego = reglas de app + G1–G6", GAME_SPECIALIST_RULES.startsWith(APP_SPECIALIST_RULES) && /G3\. Ganar = comparar la posición ACTUAL/.test(GAME_SPECIALIST_RULES) && /G6\./.test(GAME_SPECIALIST_RULES));
t("app no trae reglas de juego", !/G1\./.test(APP_SPECIALIST_RULES));
const nw = GAME_EXTRA_CHECKS.find((x) => x.check.type === "not_won_immediately"), bc = GAME_EXTRA_CHECKS.find((x) => x.check.type === "board_changes");
t("game: chequeo de base not_won_immediately con mensaje para Gemma", nw && /posición ACTUAL/.test(nw.problem({ detail: "con UN movimiento ya aparece la victoria" })) && /listener keydown/.test(nw.problem({ detail: "ninguna tecla cambia nada" })));
t("game: chequeo de base board_changes (b4: el contador subía y el tablero no se redibujaba)", bc && /llamá a dibujar\(\)/.test(bc.problem({ detail: "#mapa no cambia con ninguna tecla" })) && /grilla/.test(bc.problem({ detail: "no hay tablero" })));
t("regla G2: niveles en formato Sokoban de strings y al menos una caja fuera del objetivo", /formato clásico de Sokoban/.test(GAME_SPECIALIST_RULES) && /al menos una caja NO está sobre un objetivo/.test(GAME_SPECIALIST_RULES));
t("game: 'ganado al cargar' tiene su propio mensaje para Gemma", /FUERA de los objetivos/.test(nw.problem({ detail: "recién cargado ya aparece la victoria" })));
t("regla G5: después de mover, dibujar()", /DESPUÉS llama a dibujar\(\)/.test(GAME_SPECIALIST_RULES));
for (const [name, B] of [["web/app", appBuild], ["web/game", gameBuild]])
  t(`${name}: cumple el contrato de build`, ["planPage", "planText", "PAGE_PLAN_VERSION", "build", "writeBaseline", "translateRequirement", "postprocessChecks", "runChecks", "normalizeCheck", "CATALOG_VERSION", "specialistSees"].every((k) => k in B));
t("game: el principal se llama #juego; app: #principal", (await gameBuild.planPage(refined.features, { refined })).plan.sections[0].id === "juego" && (await appBuild.planPage(refined.features, { refined })).plan.sections[0].id === "principal");
t("--legacy no aplica a web/app", (() => { try { appBuild.build({}, "/tmp/x", { legacy: true }); return false; } catch (e) { return /legacy/.test(e.message); } })());
t("specialistSees = lo que el brief suma (guardia de holdout)", gameBuild.specialistSees(refined) === rb);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
