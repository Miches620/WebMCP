// resumen_replicas.mjs — 11/11 (rama mvc-borrador): la tabla de unas réplicas, con la app FINAL de cada una juzgada otra vez.
//   node build/resumen_replicas.mjs build\replicas_mvc_<fecha>.txt [--fila R4.1 --fila R5.1]
// Lee la lista que escribe replicas_*.ps1 ("EMPIEZA rep_mvc_s1 (semilla 1) -> carpeta"), toma el último ciclo_* de cada
// carpeta, juzga final/ con la planilla del proyecto (todas las pruebas, en Chromium) y promedia por versión
// (el nombre sin _sN). Las --fila se informan una por una (por defecto R4.1: la fórmula que se recalcula).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Las corridas de la lista: [{ nombre, version, semilla, carpeta }]. */
export function leerLista(texto) {
  return [...String(texto).matchAll(/EMPIEZA (\S+) \(semilla (\d+)\) -> (.+)$/gm)].map((m) => ({ nombre: m[1], version: m[1].replace(/_s\d+$/, ""), semilla: Number(m[2]), carpeta: m[3].trim() }));
}

/** Resultado de una corrida (función pura): est = { [filaId]: {result} } del juez sobre final/. */
export function resultado(planilla, est, filasVer = []) {
  const filas = planilla.filas || [];
  const reqs = [...new Set(filas.map((f) => f.r))];
  const ok = reqs.filter((r) => filas.filter((f) => f.r === r).every((f) => est[f.id]?.result === "PASS"));
  return { cumplidos: ok.length, de: reqs.length, pruebas: filas.filter((f) => est[f.id]?.result === "PASS").length, de_pruebas: filas.length, fallan: reqs.filter((r) => !ok.includes(r)), filas: Object.fromEntries(filasVer.map((id) => [id, est[id]?.result || "—"])) };
}

/** Promedio por versión, en el orden en que aparecen. */
export function porVersion(filas) {
  const vs = [...new Set(filas.map((f) => f.version))];
  return vs.map((v) => { const xs = filas.filter((f) => f.version === v && f.cumplidos != null); const prom = (k) => xs.length ? Math.round((xs.reduce((a, x) => a + x[k], 0) / xs.length) * 10) / 10 : null; return { version: v, n: xs.length, cumplidos: prom("cumplidos"), pruebas: prom("pruebas"), minutos: prom("minutos"), cada_una: xs.map((x) => x.cumplidos) }; });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const lista = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1] === "--fila"));
  if (!lista) { console.log("uso: node build/resumen_replicas.mjs <lista.txt> [--fila R4.1]"); process.exit(2); }
  const filasVer = args.flatMap((a, i) => (args[i - 1] === "--fila" ? [a] : []));
  if (!filasVer.length) filasVer.push("R4.1");
  const { juezReal } = await import("./run_ciclo.mjs");
  const { leerApp } = await import("../harness/mapa.mjs");
  const here = fileURLToPath(new URL(".", import.meta.url));
  const filas = [];
  for (const c of leerLista(readFileSync(lista, "utf8"))) {
    const ciclos = existsSync(c.carpeta) ? readdirSync(c.carpeta).filter((d) => d.startsWith("ciclo_")).sort() : [];
    const dir = ciclos.length ? join(c.carpeta, ciclos.at(-1)) : null;
    if (!dir || !existsSync(join(dir, "final"))) { console.log(`${c.nombre}: sin app final (¿se cortó?) en ${c.carpeta}`); filas.push({ ...c }); continue; }
    const ev = JSON.parse(readFileSync(join(dir, "ciclo.json"), "utf8"));
    const planilla = JSON.parse(readFileSync(join(c.carpeta, "planilla.json"), "utf8"));
    const est = await juezReal(planilla, { log: () => {} })(leerApp(join(dir, "final")), planilla.filas, "resumen", join(here, "runs", "_juzgar"));
    const r = resultado(planilla, est, filasVer);
    const minutos = Math.round((statSync(join(dir, "ciclo.json")).mtimeMs - Date.parse(ev.inicio)) / 60000);
    const fila = { ...c, ...r, minutos, vueltas: ev.vueltas.length, aceptadas: ev.vueltas.filter((v) => v.aceptado).length, mvc: ev.mvc || false };
    filas.push(fila);
    console.log(`${c.nombre}: ${r.cumplidos}/${r.de} requisitos · ${r.pruebas}/${r.de_pruebas} pruebas · ${filasVer.map((id) => `${id} ${r.filas[id]}`).join(" · ")} · ${fila.aceptadas}/${fila.vueltas} vueltas aceptadas · ${minutos} min${fila.mvc ? ` · ${fila.mvc}` : ""}`);
  }
  console.log("\nPromedio por versión:");
  for (const v of porVersion(filas)) console.log(`  ${v.version}: ${v.cumplidos} requisitos (${v.cada_una.join(", ")}) · ${v.pruebas} pruebas · ${v.minutos} min · ${v.n} corridas`);
}
