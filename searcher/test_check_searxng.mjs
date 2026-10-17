// test_check_searxng.mjs — el diagnóstico de SearXNG dice qué falta, sin red.
//   node searcher/test_check_searxng.mjs
import { diagnose, CHECK_VERSION } from "./check_searxng.mjs";
let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
t("versión", CHECK_VERSION === "check_searxng v0.1");
t("no responde → ¿está corriendo el contenedor?", /docker start searxng/.test(diagnose({ error: "ECONNREFUSED" }).motivo) && !diagnose({ error: "x" }).ok);
t("403 → falta '- json' en formats", /formats/.test(diagnose({ status: 403 }).motivo));
t("429 → limiter: false", /limiter: false/.test(diagnose({ status: 429 }).motivo));
t("200 con HTML → no es JSON", !diagnose({ status: 200, body: "<html>" }).ok);
t("200 con resultados → OK y cuántos", diagnose({ status: 200, body: JSON.stringify({ results: [{ title: "Kanban" }, { title: "b" }] }) }).n === 2);
t("200 sin resultados → anda, pero lo dice", /no trajo resultados/.test(diagnose({ status: 200, body: JSON.stringify({ results: [], unresponsive_engines: [["google", "timeout"]] }) }).motivo));
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
