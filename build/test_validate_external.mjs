// build/test_validate_external.mjs — validar una app hecha fuera de webmcp (16/10).
//   node build/test_validate_external.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareExternal, EXTERNAL_VERSION } from "./validate_external.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
const root = mkdtempSync(join(tmpdir(), "ext-"));
const app = join(root, "Gemma solo"); mkdirSync(app);
writeFileSync(join(app, "index.html"), "<h1>x</h1>"); writeFileSync(join(app, "script.js"), "1");
const checks = JSON.parse(readFileSync(new URL("../profiles/web/validation/fixtures/real_kanban_c22/checks.json", import.meta.url), "utf8"));
const snap = join(root, "snap.json");
writeFileSync(snap, JSON.stringify({ intentForge: { refined_prompt: { project_name: "K", profiles: ["web/app"], features: checks.map((c) => c.text) } }, atomicTasks: [{ id: "F1.1", task: "x", pieza: "datos" }] }));
writeFileSync(join(root, "checks.json"), JSON.stringify(checks));
const out = prepareExternal({ appDir: app, snapshot: snap, checks: join(root, "checks.json"), runsDir: join(root, "runs"), date: new Date("2026-10-16T21:00:00Z") });
const b = JSON.parse(readFileSync(join(out, "build.json"), "utf8"));
t("versión", EXTERNAL_VERSION === "validate_external v0.1");
t("carpeta de corrida: fecha + externo + nombre de la carpeta", /2026-10-16T21-00-00_externo_Gemma_solo$/.test(out), out);
t("la app se COPIA (app/index.html, app/script.js); la original no se toca", existsSync(join(out, "app", "index.html")) && existsSync(join(out, "app", "script.js")));
t("build.json sin Specialist (sin Standard ni contrato) y marcado externo", b.specialist === null && b.external.version === EXTERNAL_VERSION);
t("tareas sin 'pieza' (el veredicto por tarea no aplica)", b.input.tasks.length === 1 && !("pieza" in b.input.tasks[0]));
t("mismos chequeos copiados (mismo juez)", JSON.parse(readFileSync(join(out, "checks.json"), "utf8")).length === checks.length);
writeFileSync(join(root, "otros.json"), JSON.stringify(checks.slice(1)));
t("chequeos de otro snapshot → no se mezclan jueces", throws(() => prepareExternal({ appDir: app, snapshot: snap, checks: join(root, "otros.json"), runsDir: join(root, "runs") }), /no se mezclan jueces/));
t("sin index.html → falla", throws(() => prepareExternal({ appDir: root + "/nada", snapshot: snap }), /no hay index.html/));
console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
