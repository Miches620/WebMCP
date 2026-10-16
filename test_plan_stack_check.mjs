// test_plan_stack_check.mjs — el stack lo fija el Standard: catálogo, TechLeader, Atomizer y chequeo sin modelo.
//   node test_plan_stack_check.mjs
// Datos reales: las 28 tareas de la 1ª tanda del pipeline del Kanban del 16/10 (fixtures/reviewer/) y la
// sugerencia del TechLeader de ese día ("React, Tailwind CSS").
import { readFileSync } from "node:fs";
import { CATALOG, standardMeta, standardsFor, stackText, mentions, stackRequest, STATUSES } from "./standards/catalog.mjs";
import { STANDARDS } from "./standards/registry.mjs";
import { resolveProfiles } from "./profiles/registry.mjs";
import { buildTechLeaderPrompt } from "./techleader_prompt.mjs";
import { buildDecomposePrompt } from "./atomic_engine_v5.js";
import { checkPlanStack, checkTasksStack, STACK_CHECK_VERSION } from "./plan_stack_check.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
const K28 = JSON.parse(readFileSync(new URL("./fixtures/reviewer/kanban_2026-10-16_28tareas.json", import.meta.url), "utf8"));

// ---------- 1. catálogo ----------
t("cada Standard del registro tiene ficha, y coinciden id/versión/estado/stack", Object.values(STANDARDS).every((s) => CATALOG[s.id] && CATALOG[s.id].version === s.version && CATALOG[s.id].status === s.status && s.stack === CATALOG[s.id].stack), Object.keys(STANDARDS).join());
t("cada ficha: estado válido, stack con nombre/usa/no_usa y requisitos con cómo verificarlos", Object.values(CATALOG).every((m) => STATUSES.includes(m.status) && m.stack?.nombre && m.stack.usa.length && m.stack.no_usa.length && m.requiere.every((r) => r.id && r.verificar?.tipo && (r.instalar || r.manual))));
t("web/app ofrece estado y plantillas (DRAFT); web/game, grilla", standardsFor("web/app").map((m) => m.id).join() === "web/app/estado,web/app/plantillas" && standardsFor("web/game").map((m) => m.id).join() === "web/game/grilla");
t("Standard desconocido → falla fuerte", throws(() => standardMeta("web/app/react"), /STANDARD_UNKNOWN/));

// ---------- 2. palabras enteras, sin las negadas ----------
const S = standardMeta("web/app/estado").stack;
t("lo que sugirió el TechLeader el 16/10 ('React, Tailwind CSS') se reconoce", mentions("Stack: React, Tailwind CSS", S.no_usa).join() === "React,Tailwind");
t("'sin servidor', 'no usar React', 'sin base de datos' no cuentan", mentions("App sin servidor, no usar React y sin base de datos", S.no_usa).length === 0);
t("'la API de localStorage' no cuenta; 'recibido de la API' sí", mentions("guardar con la API de localStorage", S.no_usa).length === 0 && mentions("el estado recibido de la API", S.no_usa).join() === "API");
t("palabra entera: 'reactivo' no es React, 'servidores' no es servidor", mentions("un diseño reactivo, sin servidores", S.no_usa).length === 0);

// ---------- 3. el profile lleva el Standard y su stack; se puede elegir otro ----------
const A = resolveProfiles(["web/app"]);
t("web/app sin elegir → web/app/estado, con su stack y su receta", A.standard === "web/app/estado" && A.stack === S && !!A.atomizerRecipe);
const B = resolveProfiles(["web/app"], { standard: "web/app/plantillas" });
t("elegido web/app/plantillas → ese Standard y su stack; la receta es la misma (deriva de estado)", B.standard === "web/app/plantillas" && B.stack.nombre.includes("Handlebars") && B.atomizerRecipe === A.atomizerRecipe);
t("un Standard de otro tipo no se puede elegir", throws(() => resolveProfiles(["web/app"], { standard: "web/game/grilla" }), /STANDARD_NOT_FOR_PROFILE/) && throws(() => resolveProfiles(["web/app"], { standard: "x" }), /STANDARD_UNKNOWN/));
t("web/landing no tiene Standard → sin stack (y no falla)", resolveProfiles(["web/landing"]).stack === null);

// ---------- 4. TechLeader y Atomizer reciben el stack como dato ----------
const tl = buildTechLeaderPrompt(A);
t("TechLeader: STACK del Standard, sin servidor, y ya no pide stack_sugerido", tl.includes(`STACK (lo fija el Standard web/app/estado v${standardMeta("web/app/estado").version}`) && /NO hay servidor/.test(tl) && !/stack_sugerido/.test(tl));
t("TechLeader con plantillas: dice Handlebars", buildTechLeaderPrompt(B).includes("plantillas Handlebars"));
t("TechLeader sin Standard (landing): sin bloque STACK", !/STACK \(/.test(buildTechLeaderPrompt(resolveProfiles(["web/landing"]))));
t("Atomizer: también recibe el STACK", buildDecomposePrompt({ id: "F1", name: "x" }, "Frontend", [], A).includes("STACK (lo fija el Standard web/app/estado"));
t("stackText dice que los roles no son el stack", /Los ROLES de trabajo/.test(stackText(standardMeta("web/app/estado"))));

// ---------- 5. chequeo del plan y de las tareas ----------
const plan = [
  { id: "F1", name: "Estructura del tablero", description: "Columnas y tarjetas en el navegador, sin servidor." },
  { id: "F2", name: "Componentes React", description: "Componentes con Tailwind." },
  { id: "F3", name: "Sincronización", description: "Enviar el estado al backend por una API REST." },
];
const cp = checkPlanStack(plan, S, "web/app/estado");
t("plan: marca F2 (React, Tailwind) y F3 (backend, API, API REST); F1 ('sin servidor') no", cp.flagged.map((f) => `${f.id}:${f.terms.join("+")}`).join(" ") === "F2:React+Tailwind F3:backend+API+API REST" && STACK_CHECK_VERSION === "stack_check v0.1", JSON.stringify(cp.flagged));
t("plan: feedback para rehacer, con el stack y lo que nombró cada fase", /El stack lo fija el Standard web\/app\/estado/.test(cp.feedback) && /F2 "Componentes React": React, Tailwind/.test(cp.feedback));
t("plan limpio → sin feedback", checkPlanStack(plan.slice(0, 1), S).feedback === "");
const ct = checkTasksStack(K28.tasks, S);
t("tareas reales del 16/10 (28): marca las que hablan de la API y del backend", ct.flagged.length >= 2 && ct.flagged.every((f) => f.terms.some((x) => ["API", "backend"].includes(x))), JSON.stringify(ct.flagged));

// ---------- 6. stack pedido en el brief ----------
t("brief que pide Handlebars con estado → fuera del Standard, y plantillas lo usa", JSON.stringify(stackRequest("Quiero usar Handlebars para las vistas", "web/app/estado")) === JSON.stringify({ pedidas: ["Handlebars"], fuera: ["Handlebars"], otros: [{ tech: "Handlebars", standards: ["web/app/plantillas"] }] }));
t("brief que pide Angular → fuera, y ningún Standard lo usa (habría que crear uno DRAFT)", stackRequest("Hacelo en Angular", "web/app/estado").otros[0].standards.length === 0);
t("brief sin stack → nada", stackRequest("Guardar datos en localstorage. Sin base de datos.", "web/app/estado").pedidas.length === 0);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
