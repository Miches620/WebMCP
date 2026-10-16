// build/test_snapshot_auto.mjs — snapshot automático al aprobar el graph.
//   node build/test_snapshot_auto.mjs
import { readFileSync } from "node:fs";
import { snapshotProblems, snapshotFileName, snapshotContent, SNAPSHOT_AUTO_VERSION, MOTIVOS } from "./snapshot_auto.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const snap = JSON.parse(readFileSync(new URL("./snapshots/kanban_receta_v03_snapshot.json", import.meta.url), "utf8"));
const d = new Date("2026-10-16T13:54:56.123Z");

t("versión", SNAPSHOT_AUTO_VERSION === "snapshot_auto v0.1" && MOTIVOS.length === 4);
t("un estado con refined_prompt y tareas sirve", snapshotProblems(snap).length === 0);
t("sin graph o sin Intent Forge no sirve (y dice por qué)", /atomicTasks/.test(snapshotProblems({ ...snap, atomicTasks: [] }).join()) && /refined_prompt/.test(snapshotProblems({ atomicTasks: [{}] }).join()) && snapshotProblems(null).length === 1);
t("nombre = fecha + proyecto, como build/runs", snapshotFileName(snap, d) === `2026-10-16T13-54-56_${snap.intentForge.refined_prompt.project_name.replace(/[^\w]+/g, "_")}.json`, snapshotFileName(snap, d));
t("nombre sin tildes ni símbolos; sin nombre → 'proyecto'", snapshotFileName({ intentForge: { refined_prompt: { project_name: "Depósito ¡Ñandú!" } } }, d) === "2026-10-16T13-54-56_Deposito_Nandu.json" && snapshotFileName({}, d) === "2026-10-16T13-54-56_proyecto.json");
const c = snapshotContent(snap, "aprobado_sin_revision", d);
t("contenido = el estado tal cual (lo que lee run_build) + _snapshot", c.atomicTasks === snap.atomicTasks && c.intentForge === snap.intentForge && c._snapshot.motivo === "aprobado_sin_revision" && c._snapshot.revisado === false && c._snapshot.tareas === snap.atomicTasks.length);
t("aprobado con revisión queda revisado=true", snapshotContent(snap, "aprobado", d)._snapshot.revisado === true);
let threw = false; try { snapshotContent(snap, "cualquiera", d); } catch { threw = true; }
t("motivo desconocido → falla fuerte", threw);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
