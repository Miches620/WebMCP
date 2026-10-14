// build/test_recipe.mjs — receta del Standard para el Atomizer (punto 9, 14/10). Sin LLM.
//   node build/test_recipe.mjs
import fs from "node:fs";
import { recipe, PIEZAS, PIEZA_STEPS, PIEZA_AUTOR } from "../standards/web/app/estado/recipe.mjs";
import estado from "../standards/web/app/estado/standard.mjs";
import { resolveProfiles } from "../profiles/registry.mjs";
import { buildDecomposePrompt } from "../atomic_engine_v5.js";
import { taskSignals, summarize, compareTable, actionsIn } from "./recipe_metrics.mjs";

let ok = 0, fail = 0;
const t = (name, cond) => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name}`); } };

// --- la receta ---
t("cinco piezas: datos, logica, vista, estilo, controles (v0.3)", Object.keys(PIEZAS).join(",") === "datos,logica,vista,estilo,controles");
t("cada pieza sale de pasos reales del Standard", Object.values(PIEZA_STEPS).flat().every((id) => estado.steps.some((s) => s.id === id)));
t("es del Standard web/app/estado, DRAFT", recipe.standard === estado.id && recipe.status === "DRAFT");
t("el texto lista las cinco piezas", Object.keys(PIEZAS).every((p) => recipe.text.includes(`- "${p}":`)));
t("arrastrar está permitido (además del botón), no prohibido", /Arrastrar puede sumarse/.test(recipe.text) && !/sin arrastrar|no arrastr/i.test(recipe.text));
t("no inventa prohibiciones que el Standard no tiene (modales, guardar)", !/sin modales|localStorage|persist/i.test(recipe.text));
t("corta: menos de 1800 caracteres (≈450 tokens)", recipe.text.length < 1800);
t("v0.3: vista manda los controles a su pieza; controles dice QUÉ acción y en QUÉ elemento", /es controles/.test(PIEZAS.vista) && /QUÉ acción y en QUÉ elemento/.test(PIEZAS.controles));
t("v0.3: controles la construye el harness (pasos acciones y controles del Standard); el resto, Gemma", PIEZA_AUTOR.controles === "harness" && PIEZA_STEPS.controles.join() === "acciones,controles" && ["datos", "logica", "vista", "estilo"].every((p) => PIEZA_AUTOR[p] === "gemma"));
t("v0.3: a lo sumo una tarea controles por acción, que depende de su logica", /a lo sumo UNA tarea \"controles\"/.test(recipe.text) && /depende de su tarea \"logica\"/.test(recipe.text));
t("v0.2: mostrar en pantalla no es logica; datos nunca arranca vacía", /Mostrar en pantalla no es logica/.test(PIEZAS.logica) && /nunca arranca vacía/.test(PIEZAS.datos));
t("congelada", Object.isFrozen(recipe));

// --- viaja con el profile ---
const A = resolveProfiles(["web/app"]);
t("web/app trae su Standard y la receta", A.standard === "web/app/estado" && A.atomizerRecipe === recipe);
const G = resolveProfiles(["web/game"]);
t("web/game usa grilla y NO hereda la receta de estado", G.standard === "web/game/grilla" && G.atomizerRecipe === null);
const L = resolveProfiles(["web/landing"]);
t("web/landing sin Standard → sin receta", L.atomizerRecipe === null);

// --- llega al Atomizer ---
const phase = { id: "F2", name: "Acciones", responsable_sugerido: "Frontend", description: "Crear, editar y mover tarjetas", depends_on: [] };
const con = buildDecomposePrompt(phase, "Frontend", [], A);
const sin = buildDecomposePrompt(phase, "Frontend", [], { ...A, atomizerRecipe: null });
t("con receta: el prompt la incluye antes de SALIDA", con.includes(recipe.text) && con.indexOf("RECETA DEL STANDARD") < con.indexOf("SALIDA:"));
t("con receta: el formato pide \"pieza\" (en los dos ejemplos)", (con.match(/"pieza": "datos \| logica \| vista \| estilo \| controles",/g) || []).length === 2);
t("sin receta: el prompt es el de siempre (sin RECETA ni pieza)", !/RECETA|"pieza"/.test(sin));
t("sin receta: la diferencia es SOLO la receta y las 2 líneas de pieza",
  con.replace(recipe.text + "\n", "").replace(/\n      "pieza": "[^"]+",/g, "") === sin);
t("landing y game: prompt sin receta", !/RECETA/.test(buildDecomposePrompt(phase, "Frontend", [], L)) && !/RECETA/.test(buildDecomposePrompt(phase, "Frontend", [], G)));

// --- métricas ---
const s1 = taskSignals({ task: "Implementar el movimiento", description: "Mecanismo (ej. drag-and-drop o botón) para mover" });
t("alternativas: 'ej.' y 'drag-and-drop o botón'", s1.alternativas.includes("ej.") && s1.alternativas.some((a) => /o botón/.test(a)));
t("'uno o más' / 'sí o no' no son alternativas", !taskSignals({ task: "uno o más elementos, sí o no" }).alternativas.length);
t("modal y formulario = trabajo del harness", taskSignals({ task: "Crear un modal con formulario" }).harness.length === 2);
t("metadata / placeholders = campos vagos", taskSignals({ task: "Tarjeta con placeholders para metadata" }).vagos.length === 2);
t("crear + borrar en una tarea = mezcla", taskSignals({ task: "Crear y borrar tarjetas" }).mezcla);
t("'oscuro/industrial' es un par (barras), no una alternativa", (() => { const s = taskSignals({ task: "diseño oscuro/industrial" }); return !s.alternativas.length && s.barras.length === 1; })());
t("'e.g.' cuenta como alternativa", taskSignals({ task: "estado (e.g., Redux)" }).alternativas.includes("e.g."));
t("'información (autor, timestamp)' nombra los campos: no es vaga", !taskSignals({ task: "x", description: "con la información necesaria (autor, timestamp)" }).vagos.length);
t("'información revisada' sí es vaga", taskSignals({ task: "x", description: "actualiza el estado con la información revisada" }).vagos.length === 1);
t("mezcla: 'crear el componente' y 'actualizar el estado' son maquinaria", !taskSignals({ task: "Crear el componente de edición" }).mezcla && !taskSignals({ task: "Lógica de movimiento y actualización del estado" }).mezcla);
t("mezcla mira el título: 'eliminación … y actualización de la UI' = solo borrar", taskSignals({ task: "Lógica de eliminación del estado central y actualización de la UI" }).acciones.join() === "borrar");
t("pieza inválida o faltante = null", taskSignals({ task: "x", pieza: "html" }, ["datos"]).pieza === null && taskSignals({ task: "x" }, ["datos"]).pieza === null);
const sum = summarize([{ id: "a", task: "Definir estado con título y descripción", pieza: "datos" }, { id: "b", task: "Editar o borrar", pieza: "logica" }], Object.keys(PIEZAS));
t("resumen: 2 tareas, 1 con problema, piezas contadas", sum.resumen.tareas === 2 && sum.resumen.tareas_con_problema === 1 && sum.resumen.por_pieza.datos === 1);
t("tabla con las dos condiciones", /sin\s+con/.test(compareTable({ sin: { tareas: 3 }, con: { tareas: 4 } })));

// Línea base real: Project23 / Kanban del 12/10 (sin receta) — 5 de 16 tareas con señales.
const runFile = new URL("./runs/2026-10-12T21-30-27_Kanban_WebApp/input.json", import.meta.url);
if (fs.existsSync(runFile)) {
  const base = summarize(JSON.parse(fs.readFileSync(runFile, "utf8")).tasks).resumen;
  t(`línea base Kanban 12/10: 16 tareas, 5 con señales (alternativas en F2.5, F3.1, F3.4, F3.7)`, base.tareas === 16 && base.tareas_con_problema === 5 && base.con_alternativas === 4);
} else console.log("· (sin build/runs del Kanban 12/10: salteo la línea base)");

// 1ª corrida real con Gemma (14/10, receta v0.1): leída a mano, sin falsos positivos.
const fx = JSON.parse(fs.readFileSync(new URL("./fixtures/recipe_bench_2026-10-14.json", import.meta.url), "utf8"));
const fs1 = summarize(fx.sin).resumen, fc1 = summarize(fx.con, Object.keys(PIEZAS)).resumen;
t("1ª corrida sin receta: 18 tareas, 7 con problema, ninguna mezcla", fs1.tareas === 18 && fs1.tareas_con_problema === 7 && fs1.mezclan_acciones === 0);
t("1ª corrida con receta: 23 tareas, 7 con problema, 23 piezas válidas, 0 vagos", fc1.tareas === 23 && fc1.tareas_con_problema === 7 && fc1.pieza_valida === 23 && fc1.con_campos_vagos === 0);
const vistaCtl = summarize(fx.con, Object.keys(PIEZAS)).tareas.filter((s, i) => fx.con[i].pieza === "vista" && s.harness.length).map((s) => s.id);
t(`1ª corrida con receta: tareas vista que diseñan controles = ${vistaCtl.join(", ")} (lo que ataca la v0.2)`, vistaCtl.join() === "F2.4,F3.4,F3.5,F3.7,F4.5" && fc1.vista_con_controles === 5);

// --- pieza controles (métricas v0.3) ---
const P5 = Object.keys(PIEZAS);
t("'añadir el botón de eliminar' = la acción borrar (el botón es maquinaria)", actionsIn("Añadir el botón de eliminar en cada tarjeta").join() === "borrar");
const ctlRun = summarize([
  { id: "a", task: "Implementar la lógica de eliminación de una tarjeta", pieza: "logica" },
  { id: "b", task: "Borrar con un botón en cada tarjeta", description: "con confirmación antes de borrar", pieza: "controles" },
  { id: "c", task: "Mover arrastrando a otra columna", pieza: "controles" },
  { id: "d", task: "Mostrar el título con un botón", pieza: "vista" },
], P5).resumen;
t("controles: nombrar botón/confirmación NO es problema en su pieza; en vista sí cuenta", ctlRun.controles === 2 && ctlRun.tareas_con_problema === 0 && ctlRun.vista_con_controles === 1);
t("controles sin su logica (mover sin tarea de mover) se cuenta", ctlRun.controles_sin_logica === 1);

// 2ª corrida real (receta v0.2, 2 repeticiones): lo que la v0.3 quiere llevar a 0.
const fx2 = JSON.parse(fs.readFileSync(new URL("./fixtures/recipe_bench_2026-10-14_v02.json", import.meta.url), "utf8"));
const v02 = fx2.corridas.filter((c) => c.cond === "con").map((c) => summarize(c.tareas, ["datos", "logica", "vista", "estilo"]).resumen.vista_con_controles);
t(`2ª corrida (v0.2): vista_con_controles = ${v02.join(" y ")} (con v0.1 eran 5; desde métricas v0.3 'botón' también cuenta)`, v02.join() === "4,4");

console.log(`\n${ok}/${ok + fail} OK`);
process.exit(fail ? 1 : 0);
