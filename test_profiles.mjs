// test_profiles.mjs — tests deterministas del registro de profiles (refactor 05/10).
//   node test_profiles.mjs
import { resolveProfiles, SELECTABLE, PROFILES, profileLabel } from "./profiles/registry.mjs";
import { buildTechLeaderPrompt } from "./techleader_prompt.mjs";
import { validateRoleDependencies } from "./validation_profile_role_dependencies.mjs";
import { atomizePhase, runAtomicGraph } from "./atomic_engine_v5.js";
import { buildSystemPrompt } from "./profiles/web/validation/check_translator.mjs";
import { LANDING_TRANSLATOR } from "./profiles/web/landing/translator_rules.mjs";
import { APP_TRANSLATOR } from "./profiles/web/app/translator_rules.mjs";
import { GAME_TRANSLATOR } from "./profiles/web/game/translator_rules.mjs";
import { CATALOG } from "./profiles/web/validation/check_catalog.mjs";

let ok = 0, fail = 0;
const t = (name, cond) => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name}`); } };
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
const rejects = async (p, re) => { try { await p; return false; } catch (e) { return re.test(e.message); } };

// --- registro ---
t("tipos elegibles: web/landing, web/app y web/game", SELECTABLE.map((p) => p.id).join(",") === "web/landing,web/app,web/game");
t("todos los profiles nacen DRAFT", Object.values(PROFILES).every((p) => p.status === "DRAFT"));
t("sin tipo → PROFILE_REQUIRED", throws(() => resolveProfiles(undefined), /PROFILE_REQUIRED/) && throws(() => resolveProfiles([]), /PROFILE_REQUIRED/));
t("id desconocido → falla", throws(() => resolveProfiles(["web/kanban"]), /PROFILE_NOT_SELECTABLE/));
t("una plataforma sola no es un tipo", throws(() => resolveProfiles(["web"]), /PROFILE_NOT_SELECTABLE/));
const L = resolveProfiles(["web/landing"]);
t("landing hereda roles de web", L.roles.join(",") === "Backend,Frontend,DBA,DevOps,QA" && L.defaultRole === "Backend");
t("landing: cadena web → web/landing", L.chain.join(",") === "web,web/landing" && profileLabel(L) === "web/landing (DRAFT) ← web (DRAFT)");
t("landing no usa nada prestado", L.borrowed.length === 0 && L.build === "web/landing");
const A = resolveProfiles(["web/app"]);
t("app tiene build propio y declara el motor que usa de landing", A.borrowed.length === 1 && A.borrowed[0].from === "web/landing" && A.build === "web/app");
const G = resolveProfiles(["web/game"]);
t("game: cadena de 3 niveles web → web/app → web/game", G.chain.join(",") === "web,web/app,web/game" && profileLabel(G) === "web/game (DRAFT) ← web/app (DRAFT) ← web (DRAFT)");
t("game hereda los roles de web y tiene su build", G.roles.join(",") === "Backend,Frontend,DBA,DevOps,QA" && G.build === "web/game");
t("resultado congelado", Object.isFrozen(L));

// --- TechLeader ---
const tl = buildTechLeaderPrompt(L);
t("TechLeader lista los roles del profile", tl.includes('"Backend"\n"Frontend"\n"DBA"\n"DevOps"\n"QA"\n\n5. El responsable'));
t("TechLeader sin profile → falla", throws(() => buildTechLeaderPrompt(undefined), /profile/));
const fake = { roles: ["Firmware", "QA"], exampleRole: "Firmware", atomizerRoleRules: ["Si tu fase es QA, depende de Firmware."], roleDependencyRules: [] };
t("TechLeader con otros roles no menciona Backend como opción", !buildTechLeaderPrompt(fake).includes('"Backend"\n'));

// --- role_dependencies ---
t("role_dependencies sin profile → falla", throws(() => validateRoleDependencies([]), /PROFILE_REQUIRED/));
t("profile sin reglas por rol: solo la universal (fase)", validateRoleDependencies([{ id: "F2.1", role: "Firmware", depends_on: ["F1"] }], fake).failures[0]?.rule === "NO_PHASE_LEVEL_DEPENDENCY");
t("regla de tipo desconocido → falla", throws(() => validateRoleDependencies([], { roleDependencyRules: [{ type: "x", rule: "X" }] }), /PROFILE_BAD_RULE/));

// --- Atomizer (falla antes de llamar al modelo) ---
t("atomizePhase sin profile → falla", await rejects(atomizePhase({ id: "F1" }, "Backend", [], () => {}), /PROFILE_REQUIRED/));
t("runAtomicGraph sin profile → falla", await rejects(runAtomicGraph([], () => {}, () => {}), /PROFILE_REQUIRED/));

// --- traductor ---
t("traductor sin profile → falla", throws(() => buildSystemPrompt(), /profile/));
t("traductor rechaza tipos fuera del catálogo", throws(() => buildSystemPrompt({ catalog: ["volar"], rules: [] }), /catálogo/));
t("traductor rechaza chequeos de base", throws(() => buildSystemPrompt({ catalog: ["sections_visible"], rules: [] }), /base/));
const lp = buildSystemPrompt(LANDING_TRANSLATOR);
t("landing: reglas 1–7 numeradas", /\n5\. La página ya trae/.test(lp) && /\n6\. Requisitos de cualidad/.test(lp) && /\n7\. No agregues/.test(lp));
t("landing lista todos los tipos de su catálogo", LANDING_TRANSLATOR.catalog.every((k) => lp.includes(`- ${k}:`)));
t("landing no ve los chequeos de juego", !lp.includes("- not_won_immediately:") && !lp.includes("- reset_restores:") && !lp.includes("- key_changes:"));
t("todo tipo no-base del catálogo lo usa algún profile", Object.entries(CATALOG).filter(([, d]) => !d.base).every(([k]) => [LANDING_TRANSLATOR, APP_TRANSLATOR, GAME_TRANSLATOR].some((x) => x.catalog.includes(k))));
const ap = buildSystemPrompt(APP_TRANSLATOR), gp = buildSystemPrompt(GAME_TRANSLATOR);
t("app: interacción sí, landing no (sin hero/carrusel/secciones)", ap.includes("- counter_on_action:") && !ap.includes("carousel") && !ap.includes("Hero") && !ap.includes("- section_items:") && !ap.includes("not_won_immediately"));
t("game: app + chequeos de juego, reglas 5 y 6 propias", gp.includes("- reset_restores:") && gp.includes("- not_won_immediately:") && gp.includes("- board_changes:") && !ap.includes("- board_changes:") && /\n5\. Es una APP/.test(gp) && /\n6\. Es un JUEGO/.test(gp) && /\n7\. No agregues/.test(gp));
const mini = buildSystemPrompt({ catalog: ["no_js_errors", "control_visible"], rules: [] });
t("catálogo acotado: solo sus tipos y sin reglas de landing", !mini.includes("carousel") && !mini.includes("Hero") && /\n5\. No agregues/.test(mini));

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
