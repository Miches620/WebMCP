// test_planilla.mjs — PLANILLA de comportamientos v0.1 (16/10 noche): la planilla del Kanban hecha a mano contra
// las 4 apps reales del 16/10 (las mismas de test_flows).
//   node profiles/web/validation/test_planilla.mjs
// Lo esperado de cada fila sale de revisar cada app a mano (código, CSS y Playwright, Claude 16/10), no del juez:
//   - Gemma sola arreglada: no tiene prioridad (R3, R4, R5, R16); el botón tiene padding 8px 15px (R11); la tarjeta
//     no tiene alto ni ancho fijos (R12). El resto anda: drag & drop, borrar con aviso, contadores, hover, colores.
//   - Gemma sola rota: crear tira error (script.js:133), así que todo lo que necesita una tarjeta falla.
//   - Pipeline estado: el botón "➕ Agregar" no abre nada y las tarjetas no tienen controles ni se arrastran; el CSS
//     del Standard sí cumple las medidas y colores.
//   - Pipeline plantillas: no hay botón de agregar (falta el helper "eq"), pero arranca con tarjetas que se mueven y
//     se borran; los botones dicen "Editar tarjeta" / "Borrar tarjeta" (sin 🗑️ ✏️).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validationFor } from "./check_catalog.mjs";
import { PLANILLA_VERSION, checksFromPlanilla, styleMatches, colorFamily } from "./planilla.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const F = (n) => fileURLToPath(new URL(`./fixtures/${n}/index.html`, import.meta.url));
const P = JSON.parse(readFileSync(new URL("./fixtures/planilla_kanban_c22.json", import.meta.url), "utf8"));
const FEATURES = JSON.parse(readFileSync(new URL("./fixtures/real_kanban_c22/checks.json", import.meta.url), "utf8")).map((r) => r.text);
const V = validationFor(["web", "web/app"]);

// ---------- sin navegador ----------
t("versión", PLANILLA_VERSION === "planilla v0.1");
t("colores exactos (±1 por redondeo): #102C54 = rgb(16, 44, 84); rgb(16, 44, 80) no", styleMatches("rgb(16, 44, 84)", "#102C54") && !styleMatches("rgb(16, 44, 80)", "#102C54"));
t("medidas ±2px: 248 ≈ 249.5; 8px ≠ '8px 15px'; listas de palabras; distinto de none", styleMatches("249.5px", "248px") && !styleMatches("8px 15px", "8px") && styleMatches("auto", ["scroll", "auto"]) && styleMatches("rgba(0,0,0,.2) 0px 2px 4px", { distinto: "none" }) && !styleMatches("none", { distinto: "none" }));
t("familias de color: rojo, amarillo, verde; un gris no es ninguna", colorFamily("#e53935") === "rojo" && colorFamily("rgb(251, 192, 45)") === "amarillo" && colorFamily("#43a047") === "verde" && colorFamily("#888888") === null);
const rq = checksFromPlanilla(P, FEATURES);
t("17 requisitos → 16 con filas; R13 SIN_CHEQUEO con el motivo escrito en la planilla (es el CÓMO)", rq.length === 17 && rq.filter((r) => r.checks.length).length === 16 && /es el cómo/.test(rq[12].sin_chequeo) && rq.every((r) => r.fromPlanilla));
t("R3 tiene sus 3 filas (alta, media, baja) y cada chequeo lleva las palabras de los controles", rq[2].checks.length === 3 && rq[2].checks.every((c) => c.type === "planilla_fila" && c.params.controles.agregar[0] === "agregar"));
t("una fila pasa normalizeCheck como objeto (no como lista de palabras)", !!V.normalizeCheck(rq[0].checks[0])?.params?.fila?.hago && V.normalizeCheck({ type: "planilla_fila", params: { fila: "R1" } }) === null);

// ---------- las 4 apps ----------
const ROWS = P.filas.map((f) => f.id);
// orden de las filas: R1.1 R2.1 R3.1 R3.2 R3.3 R4.1 R5.1 R6.1 R7.1 R8.1 R8.2 R9.1 R9.2 R9.3 R10.1 R11.1 R12.1 R14.1 R15.1 R15.2 R16.1 R17.1
const EXPECT = {
  flow_gemma_sola_rota:      "FPFFFFFFFPFPPFPFFFFFFF",
  flow_gemma_sola_arreglada: "PPFFFFFPPPPPPPPFFPPPFP",
  flow_pipeline_estado:      "FPFFFFFFFPFPPPPPPFPFFF",
  flow_pipeline_plantillas:  "FFFFFFFPPPFPPPPFPFPPFF",
};
// por requisito (todas sus filas PASS → PASS; R13 sin filas): lo que da run_build --validate con la planilla
const BY_REQ = { flow_gemma_sola_rota: [2, 14], flow_gemma_sola_arreglada: [10, 6], flow_pipeline_estado: [5, 11], flow_pipeline_plantillas: [6, 10] };
const checks = P.filas.map((f) => V.normalizeCheck({ type: "planilla_fila", params: { fila: f, controles: P.controles } }));
const res = {};
for (const [app, exp] of Object.entries(EXPECT)) {
  const r = await V.runChecks(F(app), checks);
  res[app] = Object.fromEntries(r.map((x, i) => [ROWS[i], x]));
  const got = r.map((x) => x.result[0]).join("");
  t(`${app}: ${exp}`, got === exp, `dio ${got}\n    ${r.map((x, i) => got[i] !== exp[i] ? `${ROWS[i]}: ${x.detail}` : "").filter(Boolean).join("\n    ")}`);
  const req = rq.filter((q) => q.checks.length).map((q) => P.filas.filter((f) => f.r === q.id).every((f) => res[app][f.id].result === "PASS"));
  const [p, f] = BY_REQ[app];
  t(`${app}: por requisito PASS ${p} · FAIL ${f} · SIN_CHEQUEO 1`, req.filter(Boolean).length === p && req.filter((x) => !x).length === f, `dio ${req.filter(Boolean).length}/${req.filter((x) => !x).length}`);
}
const A = res.flow_gemma_sola_arreglada, R = res.flow_gemma_sola_rota, E = res.flow_pipeline_estado, L = res.flow_pipeline_plantillas;
t("la rota: el FAIL de crear trae el error de JS con archivo y línea", /error de JS: .*\(script\.js:13\d\)/.test(R["R1.1"].detail), R["R1.1"].detail);
t("la arreglada no ordena por prioridad, y el detalle dice el orden que vio y el esperado", /orden en "Pendiente": QA Baja · QA Alta Vieja · QA Media · QA Alta Nueva \(se esperaba QA Alta Nueva/.test(A["R16.1"].detail), A["R16.1"].detail);
t("medidas = el valor CSS del elemento (width: 248px), no lo que ocupa con padding (278) ni un hijo", /width de la columna "Pendiente": 248px ·/.test(A["R10.1"].detail), A["R10.1"].detail);
t("padding '8px 15px' no es '8px' (Miche pidió 8px)", /padding de el control "➕ Agregar Tarjeta": 8px 15px \(se esperaba 8px\)/.test(A["R11.1"].detail));
t("hover: 🗑️ ✏️ ocultos antes y visibles al pasar el mouse (R17 ya no es un PASS vacío)", /ocultos → aparecen al pasar el mouse/.test(A["R17.1"].detail));
t("drag & drop de verdad y contadores: Pendiente −1, En Curso +1", /contador de "Pendiente": 1 → 0 · ✓ contador de "En Curso": 0 → 1/.test(A["R15.2"].detail), A["R15.2"].detail);
t("plantillas no puede crear → usa una tarjeta que ya estaba para mover / borrar (y lo dice)", /no pudo crear "QA Alfa" .*usa la que ya estaba: "Diseñar wireframes iniciales"/.test(L["R6.1"].detail) && L["R6.1"].result === "PASS");
t("borrar UNA tarjeta: el contador baja 1 (antes el juez apretaba el 'Borrar' de otra tarjeta como si fuera confirmar)", /contador de "Pendiente": 2 → 1/.test(L["R7.1"].detail), L["R7.1"].detail);
t("con campos pedidos (prioridad) no se reemplaza: R16 de plantillas falla por no poder crear", /no se pudo preparar/.test(L["R16.1"].detail));
t("estado: las tarjetas no tienen control de borrar (dicho), aunque su CSS cumple las medidas", /no tiene un control que diga "eliminar"/.test(E["R7.1"].detail) && E["R12.1"].result === "PASS");

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
