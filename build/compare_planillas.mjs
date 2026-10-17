// build/compare_planillas.mjs — ¿la planilla de Qwen juzga igual que la planilla a mano? (16/10 noche)
//
//   node build/compare_planillas.mjs <planilla_vara.json> <planilla_otra.json> [--apps dir1,dir2…] [--out informe.json]
//
// Corre las DOS planillas sobre las mismas apps y compara el veredicto POR REQUISITO (todas sus filas PASS → PASS;
// alguna FAIL → FAIL; sin filas → SIN_CHEQUEO). Por defecto, las 4 apps reales del 16/10 (fixtures flow_*), donde
// ya se sabe qué anda y qué no. Coincidir con la vara en esas apps es lo que dice si Qwen sirve para escribir planillas.
// Sin control sobre el esqueleto (eso lo hace run_build): acá se compara un juez con otro, sobre lo mismo.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

export const COMPARE_VERSION = "compare_planillas v0.1";
const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "../profiles/web/validation/fixtures");
export const DEFAULT_APPS = ["flow_gemma_sola_rota", "flow_gemma_sola_arreglada", "flow_pipeline_estado", "flow_pipeline_plantillas"].map((n) => join(FIX, n));

/** Veredicto por requisito a partir de los resultados de las filas. rows: [{r, result}], nReq. */
export function verdictsByReq(rows, nReq) {
  const out = {};
  for (let i = 1; i <= nReq; i++) {
    const mine = rows.filter((x) => x.r === `R${i}`);
    out[`R${i}`] = !mine.length ? "SIN_CHEQUEO" : mine.every((x) => x.result === "PASS") ? "PASS" : "FAIL";
  }
  return out;
}

/** Compara dos tablas {app: {Rn: veredicto}}. Devuelve coincidencias y diferencias. Función pura. */
export function compareVerdicts(vara, otra) {
  const diffs = [];
  let same = 0, total = 0;
  const byReq = {};
  for (const app of Object.keys(vara)) for (const r of Object.keys(vara[app])) {
    total++;
    const a = vara[app][r], b = otra[app]?.[r] ?? "SIN_CHEQUEO";
    byReq[r] = byReq[r] || { same: 0, total: 0 };
    byReq[r].total++;
    if (a === b) { same++; byReq[r].same++; } else diffs.push({ app, r, vara: a, otra: b });
  }
  // tipos de desacuerdo: la otra es más blanda (PASS donde la vara dice FAIL) o más dura, o no prueba
  const kind = (d) => d.vara === "FAIL" && d.otra === "PASS" ? "mas_blanda" : d.vara === "PASS" && d.otra === "FAIL" ? "mas_dura" : d.otra === "SIN_CHEQUEO" ? "no_prueba" : d.vara === "SIN_CHEQUEO" ? "prueba_de_mas" : "otro";
  const kinds = {};
  diffs.forEach((d) => { d.tipo = kind(d); kinds[d.tipo] = (kinds[d.tipo] || 0) + 1; });
  return { same, total, pct: total ? Math.round((100 * same) / total) : 0, byReq, diffs, kinds };
}

async function judge(planilla, apps, nReq) {
  const { validationFor } = await import("../profiles/web/validation/check_catalog.mjs");
  const V = validationFor(["web", "web/app"]);
  const checks = planilla.filas.map((f) => V.normalizeCheck({ type: "planilla_fila", params: { fila: f, ...(planilla.controles ? { controles: planilla.controles } : {}) } }));
  const table = {}, details = {};
  for (const app of apps) {
    const res = checks.length ? await V.runChecks(join(app, "index.html"), checks) : [];
    const rows = res.map((x, i) => ({ r: planilla.filas[i].r, id: planilla.filas[i].id, result: x.result, detail: x.detail }));
    table[basename(app)] = verdictsByReq(rows, nReq);
    details[basename(app)] = rows;
  }
  return { table, details };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (pos.length < 2) { console.log("uso: node build/compare_planillas.mjs <planilla_vara.json> <planilla_otra.json> [--apps dir1,dir2] [--out informe.json]"); process.exit(2); }
  const [A, B] = pos.map((p) => JSON.parse(readFileSync(p, "utf8")));
  const apps = flag("--apps") ? flag("--apps").split(",").map((x) => resolve(x)) : DEFAULT_APPS;
  const nReq = Math.max(...[...A.filas, ...B.filas].map((f) => Number(String(f.r).slice(1))), ...Object.keys({ ...A.sin_fila, ...B.sin_fila }).map((r) => Number(r.slice(1))));
  console.log(`[COMPARAR] ${COMPARE_VERSION} · vara ${pos[0]} (${A.filas.length} filas) contra ${pos[1]} (${B.filas.length} filas) · ${apps.length} apps · ${nReq} requisitos`);
  const ja = await judge(A, apps, nReq), jb = await judge(B, apps, nReq);
  const cmp = compareVerdicts(ja.table, jb.table);
  for (const app of Object.keys(ja.table)) {
    const row = Object.keys(ja.table[app]).map((r) => ja.table[app][r] === jb.table[app][r] ? "·" : jb.table[app][r] === "PASS" ? "P" : jb.table[app][r] === "FAIL" ? "F" : "S").join("");
    console.log(`  ${app.padEnd(28)} ${row}   (· = igual a la vara; P/F/S = lo que dio la otra)`);
  }
  console.log(`\nCoinciden ${cmp.same}/${cmp.total} (${cmp.pct}%) · ${Object.entries(cmp.kinds).map(([k, n]) => `${k}: ${n}`).join(" · ") || "sin diferencias"}`);
  for (const d of cmp.diffs.slice(0, 30)) console.log(`  ${d.r} en ${d.app}: vara ${d.vara}, otra ${d.otra} (${d.tipo})`);
  const out = flag("--out") || join(dirname(resolve(pos[1])), `comparacion_${basename(pos[1], ".json")}.json`);
  writeFileSync(out, JSON.stringify({ type: "EVIDENCE", kind: "compare_planillas", version: COMPARE_VERSION, vara: resolve(pos[0]), otra: resolve(pos[1]), apps, ...cmp, tables: { vara: ja.table, otra: jb.table }, details: { vara: ja.details, otra: jb.details } }, null, 2));
  console.log(`→ ${out}`);
}
