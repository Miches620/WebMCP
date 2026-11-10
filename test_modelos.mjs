// test_modelos.mjs — PUESTOS.md → modelo de cada puesto (10/11).
import { leerPuestos, modeloDe, puestos } from "./modelos.mjs";
let ok = 0, n = 0;
const t = (name, cond, extra = "") => { n++; if (cond) ok++; console.log(`${cond ? "✓" : "✗"} ${name}${!cond && extra ? ` → ${extra}` : ""}`); };

const md = "# x\n\ntexto con | barra suelta\n\n| puesto | modelo | role que asume | qué hace |\n|---|---|---|---|\n| specialist | `gemma-x` | FrontEnd Senior | escribe |\n| revisor | qwen-y | — | revisa |\r\n";
const p = leerPuestos(md);
t("lee puesto, modelo (sin backticks), role y qué hace", p.specialist?.modelo === "gemma-x" && p.specialist.role === "FrontEnd Senior" && p.specialist.hace === "escribe", JSON.stringify(p));
t("'—' en role = sin role; la línea |---| no es un puesto", p.revisor?.role === "" && !p["---"] && Object.keys(p).length === 2, JSON.stringify(p));
t("sin tabla → vacío", Object.keys(leerPuestos("nada")).length === 0);
t("PUESTOS.md del repo: los 6 puestos tienen modelo", ["specialist", "techleader", "intent", "revisor", "planilla", "buscador"].every((k) => puestos()[k]?.modelo), JSON.stringify(puestos()));
t("modeloDe sale de la tabla", modeloDe("specialist", {}) === puestos().specialist.modelo);
t("MODELO_<PUESTO> pisa la tabla para una prueba suelta", modeloDe("specialist", { MODELO_SPECIALIST: "otro" }) === "otro");
t("las variables viejas siguen andando (SPECIALIST_MODEL, REVIEWER_MODEL)", modeloDe("specialist", { SPECIALIST_MODEL: "v" }) === "v" && modeloDe("revisor", { REVIEWER_MODEL: "r" }) === "r");
t("MODELO_ gana a la variable vieja", modeloDe("specialist", { SPECIALIST_MODEL: "v", MODELO_SPECIALIST: "n" }) === "n");
let e = "";
try { modeloDe("no-existe", {}); } catch (x) { e = x.message; }
t("puesto desconocido → falla fuerte y lista los puestos", /PUESTO_SIN_MODELO/.test(e) && /specialist/.test(e), e);
console.log(`\n${ok}/${n} OK`);
if (ok !== n) process.exit(1);
