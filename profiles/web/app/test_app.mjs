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
t("reglas de juego = reglas de app + G1–G6", GAME_SPECIALIST_RULES.startsWith(APP_SPECIALIST_RULES) && /G3\. Ganar = TODOS los objetivos ocupados/.test(GAME_SPECIALIST_RULES) && /G6\./.test(GAME_SPECIALIST_RULES));
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

// 12/10 (Kanban real, 2ª corrida): sin <form>, los chequeos de formulario se cambian por action_changes
{
  const { controlScore } = await import("../validation/lib.mjs");
  const btns = ["+ Crear Tarjeta", "Mover a En Progreso", "💬 Añadir Comentario", "🏷️ Añadir Etiqueta", "✏️ Editar", "🗑️ Eliminar Tarjeta"];
  // 16/10 noche: los verbos ya van a flujos; las palabras del control (actionWords) siguen eligiendo el del verbo
  const pick = (t, ch) => { const w = appBuild.actionWords(t, ch); return btns.map((b) => [b, controlScore(b, w)]).reduce((x, y) => (y[1] > x[1] ? y : x))[0]; };
  t("app: submit/field/click_changes → un action_changes si el requisito no nombra un verbo de flujo (control_visible se queda)", appBuild.postprocessChecks([{ type: "control_visible", params: { text: ["x"] } }, { type: "submit_empty_blocked", params: {} }, { type: "field_exists", params: { field: ["x"] } }], "R1", "Tablero con tarjetas").map((c) => c.type).join() === "control_visible,action_changes");
  t("16/10 noche: con un verbo de flujo, los chequeos de formulario se cambian por el FLUJO (control_visible se queda)", appBuild.postprocessChecks([{ type: "control_visible", params: { text: ["crear"] } }, { type: "submit_empty_blocked", params: {} }, { type: "field_exists", params: { field: ["x"] } }], "R1", "Crear tarjetas").map((c) => c.type).join() === "control_visible,flow_create");
  // 15/10 (p47): el contador que el requisito no pide se saca; si lo nombra, se queda
  {
    const R3 = [{ type: "action_changes", params: { click: ["agregar", "comentario"] } }, { type: "counter_on_action", params: { label: ["comentarios"] } }];
    const o3 = appBuild.postprocessChecks(R3, "R3", "Agregar comentarios a las tarjetas");
    t("app (p47): 'Agregar comentarios' → sin counter_on_action, con el motivo", o3.map((c) => c.type).join() === "flow_create" && /no nombra ningún número/.test(o3.why), JSON.stringify(o3));
    t("app (p47): 'Contador de tarjetas por columna' → el counter_on_action se queda", appBuild.postprocessChecks(R3, "R", "Contador de tarjetas por columna").map((c) => c.type).join() === "action_changes,counter_on_action");
    t("app (p47): 'Mostrar la cantidad de comentarios' y 'cuántos movimientos' también nombran un número", appBuild.namesANumber("Mostrar la cantidad de comentarios") && appBuild.namesANumber("Ver cuántos movimientos hice") && !appBuild.namesANumber("Etiquetar tarjetas") && !appBuild.namesANumber("Comentarios en las tarjetas"));
    const both = appBuild.postprocessChecks([...R3, { type: "submit_empty_blocked", params: {} }], "R3", "Agregar comentarios a las tarjetas");
    t("app (p47): con chequeos de formulario además, los dos ajustes y los dos motivos", both.map((c) => c.type).join() === "flow_create" && /número/.test(both.why) && /flujo como una persona: flow_create/.test(both.why), JSON.stringify(both));
    t("app (p47): sin nada que ajustar devuelve lo mismo (sin motivo)", !appBuild.postprocessChecks(R3.slice(0, 1), "R1", "Tablero con tarjetas").why);
  }
  t("app: sin chequeos de formulario no cambia nada", appBuild.postprocessChecks([{ type: "hover_changes", params: { elementos: ["tarjeta"] } }], "R8", "Sombras").length === 1);
  t("app: el control elegido es el del verbo (Kanban real)", pick("Crear tarjetas", [{ type: "submit_empty_blocked" }]) === "+ Crear Tarjeta" && pick("Agregar comentarios a las tarjetas", [{ type: "field_exists", params: { field: ["comentario"] } }]) === "💬 Añadir Comentario" && pick("Mover tarjetas entre columnas", [{ type: "click_changes", params: { click: ["columna", "tarjeta"] } }]) === "Mover a En Progreso" && pick("Etiquetar tarjetas", [{ type: "field_exists" }]) === "🏷️ Añadir Etiqueta" && pick("Borrar tarjetas", [{ type: "click_changes" }]) === "🗑️ Eliminar Tarjeta");
  t("app: el traductor por archivos no ofrece chequeos de formulario", !(await import("./translator_rules.mjs")).APP_FILES_CATALOG.some((x) => /^(field_|submit_|valid_submit)/.test(x)));
}

// 16/10 (build 2026-10-16T13-54-56, fixture real_kanban_c21): 6 de los 9 FAIL eran chequeos que el requisito no pide
{
  const { readFileSync } = await import("node:fs");
  const real = JSON.parse(readFileSync(new URL("../validation/fixtures/real_kanban_c21/checks.json", import.meta.url), "utf8"));
  const after = Object.fromEntries(real.map((r) => [r.id, appBuild.postprocessChecks(r.checks, r.id, r.text)]));
  const types = (id) => after[id].map((c) => c.type).join();
  t("16/10: R9 (colores) pierde no_horizontal_scroll → sin chequeos (SIN_CHEQUEO, no FAIL)", types("R9") === "" && /no habla de pantallas chicas/.test(after.R9.why), JSON.stringify(after.R9));
  t("16/10: R12 y R16 (tamaños, orden) pierden no_horizontal_scroll", !/no_horizontal_scroll/.test(types("R12")) && !/no_horizontal_scroll/.test(types("R16")), types("R12") + " | " + types("R16"));
  t("16/10: R15 (sombras al arrastrar) pierde key_changes; nadie pidió teclado", !/key_changes/.test(types("R15")) && /no nombra el teclado/.test(after.R15.why), types("R15"));
  t("16/10: lo que el requisito sí pide se queda (R1 → flujo crear, R2 control_visible, R14 hover)", types("R1") === "flow_create" && /control_visible/.test(types("R2")) && /hover_changes/.test(types("R14")));
  t("16/10: 'responsive' / 'celular' / 'flechas' sí los dejan", appBuild.namesResponsive("Que sea responsive") && appBuild.namesResponsive("Se tiene que ver bien en el celular") && appBuild.namesKeys("Mover con las flechas") && !appBuild.namesResponsive("Fondo: #102C54") && !appBuild.namesKeys("Sombras en tarjetas"));
}
// 16/10 (BUG): con --standard web/app/plantillas el build igual usó web/app/estado (corridas 15-48-47 y 16-24-56
// idénticas). El build tiene que construir con el Standard que le pasa run_build. Sin modelo: fetch falla al toque
// y se mira qué Standard anunció el motor antes del primer pedido.
{
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const real = globalThis.fetch;
  const announced = async (opts) => {
    const logs = [];
    globalThis.fetch = async () => { throw new Error("sin modelo (test)"); };
    try { await appBuild.build({ refined: { project_name: "T", features: ["Crear items"] }, tasks: [] }, mkdtempSync(join(tmpdir(), "std-")), { ...opts, log: (m) => logs.push(m), bench: { maxAttempts: 1 } }); } catch { /* sin modelo */ }
    finally { globalThis.fetch = real; }
    return (logs.find((l) => /files_engine .* · Standard /.test(l)) || "").match(/Standard (\S+)/)?.[1] || null;
  };
  t("16/10: el build construye con el Standard que le pasa run_build (plantillas), no con el del profile", (await announced({ standardId: "web/app/plantillas" })) === "web/app/plantillas");
  t("16/10: sin standardId, el del profile (estado)", (await announced({})) === "web/app/estado" && appBuild.standardOf({}) === "web/app/estado");
  const { readFileSync } = await import("node:fs");
  t("16/10: run_build le pasa al build el Standard y la receta del profile RESUELTO", /B\.build\(input, outDir, \{ standardId: profile\.standard, recipe: profile\.atomizerRecipe/.test(readFileSync(new URL("../../../build/run_build.mjs", import.meta.url), "utf8")));
}
// 16/10 noche: el VERBO del requisito decide el flujo (requisitos reales del Kanban, fixture c22)
{
  const f = (t, o) => appBuild.flowsFor(t, o).map((x) => `${x.type}:${x.params.abrir.join("+")}`).join(" ");
  t("flujos: 'Crear tarjetas' → crear con 'agregar tarjetas'", f("Crear tarjetas") === "flow_create:agregar+tarjetas");
  t("flujos: drag&drop → mover (antes SIN_CHEQUEO)", /^flow_move:mover/.test(f("Usar funcionalidad de drag&drop: la tarjeta estara compuesta")));
  t("flujos: 'al borrar una tarjeta: Eliminar…' → borrar con el objeto del verbo (tarjeta)", f("Comportamiento al borrar una tarjeta: Eliminar(🗑️) abre un modal") === "flow_delete:eliminar+tarjeta");
  t("flujos: 'Guardar datos en localstorage' → guardar (recargar y sigue)", /^flow_persist/.test(f("Guardar datos en localstorage")));
  t("flujos: sustantivos NO son verbos ('modal de creación o edición' no pide probar editar)", f("Asignar prioridad desde una lista en el modal de creación o edición") === "");
  t("flujos: un requisito de ESTILO no suma flujos", f("Sombras en tarjetas, efecto de movimiento durante drag&drop", { style: true }) === "");
  t("flujos: editar/borrar/mover traen 'crear' para tener con qué si la app arranca vacía", appBuild.flowsFor("Editar tarjetas")[0].params.crear.join() === "agregar,tarjetas");
}
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
