// rejuzgar_exp.mjs — vuelve a juzgar los borradores de un experimento de Role con el juez de HOY (04/11).
// Para que todos los borradores se midan con la misma vara aunque el juez haya cambiado entre corridas.
//   node build/rejuzgar_exp.mjs <carpeta del experimento> <carpeta del proyecto>
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leerApp } from "../harness/mapa.mjs";
import { juezReal } from "./run_ciclo.mjs";
import { medir, resumen } from "./exp_rol.mjs";

export async function rejuzgar(exp, proyecto, log = console.log) {
  const planilla = JSON.parse(readFileSync(join(proyecto, "planilla.json"), "utf8"));
  const jz = juezReal(planilla), res = [];
  const dirs = readdirSync(exp).filter((d) => /^(sin|persona|rol|placebo)_\d+$/.test(d) && existsSync(join(exp, d, "index.html"))).sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]) || a.localeCompare(b));
  for (const d of dirs) {
    const [cond, rep] = d.split("_");
    const est = await jz(leerApp(join(exp, d)), planilla.filas, `rj${rep}`, join(exp, "_rejuzgar"));
    const m = medir(planilla.filas, est);
    res.push({ cond, rep: Number(rep), ...m, detalle: Object.fromEntries(Object.entries(est).map(([id, x]) => [id, `${x.result} ${String(x.detail || "").slice(0, 300)}`])) });
    log(`${d}: ${m.requisitos}/${m.de} · ${m.pruebas}/${m.de_pruebas} · grilla ${m.grilla ? "✓" : "✗"} · escribe ${m.escribe ? "✓" : "✗"}`);
  }
  const conds = ["sin", "persona", "rol", "placebo"].filter((c) => res.some((r) => r.cond === c));
  const tabla = resumen(res, conds).replace("# Experimento de Role — borrador desde cero", "# Experimento de Role — borrador desde cero (re-juzgado con el juez del 04/11)");
  writeFileSync(join(exp, "rejuzgado.json"), JSON.stringify({ juez: "04/11", resultados: res }, null, 2));
  writeFileSync(join(exp, "resumen_rejuzgado.md"), tabla);
  log(`\n${tabla}`);
  return { res, tabla };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [exp, proyecto] = process.argv.slice(2);
  if (!exp || !proyecto) { console.log("uso: node build/rejuzgar_exp.mjs <carpeta del experimento> <carpeta del proyecto>"); process.exit(2); }
  await rejuzgar(resolve(exp), resolve(proyecto));
}
