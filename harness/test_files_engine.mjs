// test_files_engine.mjs — el motor por archivos es GENERAL.
//   node harness/test_files_engine.mjs
// Regla (Miche, 06/10): "Boxworld no puede existir dentro del Harness". Lo de un tipo de
// proyecto vive en un Standard (standards/…); acá se prueba con un Standard de juguete.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadScripts, runAcceptance, fatal, playProblems, probeProblems, pageHtml, missingIds, stripComments } from "./files_engine.mjs";
import { STANDARDS, getStandard } from "../standards/registry.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };

// 1. el motor no nombra ningún dominio (se miran el código y los textos, sin los comentarios)
const src = readFileSync(fileURLToPath(new URL("./files_engine.mjs", import.meta.url)), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, "")).join("\n");
const DOMAIN = /\b(niveles?|NIVELES|Reglas|cajas?|jugador|sokoban|boxworld|tablero|dibujar|dibujo|mover|ganado|juego|snake|controles)\b/gi;
const hits = [...new Set(src.match(DOMAIN) || [])];
t("files_engine.mjs no nombra ningún juego ni dominio", hits.length === 0, hits.join(", "));

// 2. un Standard de juguete (contador) corre con los mismos jueces
const toy = { file: "js/logica.js", global: "Logica", functions: ["sumar", "doble"], tests: [
  { name: "sumar 2+3", fn: "sumar", input: [2, 3], run: (G, [a, b]) => G.sumar(a, b) === 5 || `sumar(2,3) dio ${G.sumar(a, b)}` },
  { name: "doble de sumar", fn: "doble", after: "sumar", input: 3, run: (G, x) => G.doble(G.sumar(x, 1)) === 8 || "doble(sumar(3,1)) no da 8" },
], itemTests: [(G, item, i) => ({ name: `dato ${i + 1}`, fn: "sumar", ok: G.sumar(item, 0) === item, detail: `sumar(${item},0) ≠ ${item}` })] };
const L = loadScripts(["const DATOS = [1, 2];", "const Logica = { sumar(a, b) { return a + b; }, doble(x) { return 2 * x; } };"], ["DATOS", "Logica"]);
const r = runAcceptance(L.Logica, L.DATOS, toy);
t("runAcceptance: Standard de juguete pasa todo (2 pruebas + 2 datos)", r.failed.length === 0 && r.passed.length === 4, JSON.stringify(r));
const bad = runAcceptance(loadScripts(["const Logica = { sumar(a, b) { return a - b; }, doble(x) { return 2 * x; } };"], ["Logica"]).Logica, [], toy);
t("runAcceptance: la prueba dependiente se atribuye a la función rota (after)", bad.failed.every((f) => f.fn === "sumar") && bad.failed.length === 2, JSON.stringify(bad.failed));
t("runAcceptance: sin el global → contrato con los nombres del Standard", /js\/logica\.js tiene que definir const Logica = \{ sumar, doble \}/.test(runAcceptance(undefined, [], toy).failed[0].detail));
t("loadScripts: devuelve solo los globales pedidos", Object.keys(L).join() === "DATOS,Logica");

// 3. problemas que rompen el archivo
t("fatal: marca la lista sin cambiarla", fatal(["a"]).fatal === true && fatal(["a"])[0] === "a");
t("playProblems: no_js_errors en FAIL → fatal", playProblems([{ type: "no_js_errors", result: "FAIL", detail: "x" }]).fatal === true && !playProblems([{ type: "board_changes", result: "FAIL", detail: "x" }]).fatal);
t("probeProblems: sonda que no corrió o tiró → fatal con la llamada del Standard", probeProblems({ probe: null, errors: [] }, { call: "pintar(x)" }).fatal && /pintar\(x\) tiró un error/.test(probeProblems({ probe: { ok: false, error: "e" }, errors: [] }, { call: "pintar(x)" })[0]));
t("pageHtml: main con el id que declara el Standard", pageHtml({ title: "T", scripts: ["a.js"], mainId: "app" }).includes('<main id="app">'));
t("missingIds: genérico", missingIds("<div id='a'></div>", ["a", "b"]).join() === "b");

// 4. registro de Standards
t("registro: web/game/grilla existe y es DRAFT", STANDARDS["web/game/grilla"]?.status === "DRAFT");
t("registro: id desconocido → falla fuerte", (() => { try { getStandard("web/game/snake"); return false; } catch (e) { return /STANDARD_UNKNOWN/.test(e.message); } })());
const KINDS = ["data", "logic", "screen", "render", "wiring"];
t("cada paso de cada Standard usa una clase que el motor conoce", Object.values(STANDARDS).every((s) => s.steps.every((st) => KINDS.includes(st.kind))));
t("cada 'needs' apunta a un paso anterior", Object.values(STANDARDS).every((s) => s.steps.every((st, i) => (st.needs || []).every((n) => s.steps.slice(0, i).some((p) => p.id === n)))));

// v0.9.6: un comentario no es código (b15: "No utiliza DOM ni window." bloqueó 3 intentos)
t("stripComments: saca comentarios de bloque y de línea, deja strings con //", !/window/.test(stripComments("/**\n * No utiliza DOM ni window.\n */\nconst a = 1; // ni window.x")) && /"http:\/\/x"/.test(stripComments('const u = "http://x";')));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
