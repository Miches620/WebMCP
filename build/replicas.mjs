// build/replicas.mjs — corre el MISMO snapshot N veces con muestreo distinto y compara (p48, 15/10).
//
//   node build/replicas.mjs snapshot.json                 3 corridas, temperatura 0.7, seeds 1, 2, 3
//   node build/replicas.mjs snapshot.json --n 5 --temperature 0.5 --seed0 10
//   node build/replicas.mjs --from build/runs/A build/runs/B ...   solo compara corridas que ya existen
//
// Cada corrida es un run_build normal (queda en build/runs/ con su evidence.json). Al final deja
// build/replicas/<fecha>/replicas.json y resumen.md. Solo cambia el muestreo del Specialist: el traductor de
// Validation es el mismo en todas (se mide el build, no el juez).
//
// Decisión de método (p48): a temperatura 0 repetir no es una réplica. Por defecto: n=3, temperatura 0.7 y seeds
// 1..n, registrados en cada evidence.json. Si LM Studio ignorara el seed, se nota igual: las huellas lo dicen.

import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { summarizeReplicas, replicasText } from "./replicas_summary.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };

const readRun = (dir) => {
  const ev = join(dir, "evidence.json");
  if (!existsSync(ev)) throw new Error(`no está ${ev} (¿la corrida terminó?)`);
  const b = join(dir, "build.json");
  return { dir, evidence: JSON.parse(readFileSync(ev, "utf8")), build: existsSync(b) ? JSON.parse(readFileSync(b, "utf8")) : null };
};

function runOne(snapshot, temperature, seed) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(here, "run_build.mjs"), snapshot, "--temperature", String(temperature), "--seed", String(seed)], { stdio: ["ignore", "pipe", "inherit"] });
    let dir = null, buf = "";
    p.stdout.on("data", (d) => {
      process.stdout.write(d);
      buf += d;
      const m = buf.match(/\[BUILD\][^\n]*→ ([^\n]+)\n/);
      if (m && !dir) dir = m[1].trim();
    });
    p.on("close", (code) => (code === 0 && dir ? resolve(dir) : reject(new Error(`run_build terminó con código ${code}${dir ? ` (${dir})` : ""}`))));
  });
}

let dirs = [];
if (args[0] === "--from") {
  dirs = args.slice(1).filter((a) => !a.startsWith("--"));
  if (!dirs.length) throw new Error("uso: node build/replicas.mjs --from DIR1 DIR2 ...");
} else {
  const snapshot = args[0];
  if (!snapshot || !existsSync(snapshot)) throw new Error("uso: node build/replicas.mjs snapshot.json [--n 3] [--temperature 0.7] [--seed0 1]");
  const N = Number(flag("--n", 3)), T = Number(flag("--temperature", 0.7)), S0 = Number(flag("--seed0", 1));
  if (!(N >= 2)) throw new Error("--n tiene que ser 2 o más");
  if (T === 0) console.log("[RÉPLICAS] ⚠ temperatura 0: las corridas van a dar lo mismo (no son réplicas). Se corre igual.");
  console.log(`[RÉPLICAS] ${N} corridas · temperatura ${T} · seeds ${S0}..${S0 + N - 1}`);
  for (let k = 0; k < N; k++) {
    console.log(`\n[RÉPLICAS] ===== corrida ${k + 1}/${N} (seed ${S0 + k}) =====`);
    try { dirs.push(await runOne(snapshot, T, S0 + k)); }
    catch (e) { console.log(`[RÉPLICAS] ✗ ${e.message}: se sigue con las demás`); }
  }
  if (!dirs.length) throw new Error("ninguna corrida terminó");
}

const summary = summarizeReplicas(dirs.map(readRun));
const out = join(here, "replicas", new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19));
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "replicas.json"), JSON.stringify({ ...summary, dirs }, null, 2));
const text = replicasText(summary);
writeFileSync(join(out, "resumen.md"), text + "\n");
console.log("\n" + text + `\n\n[RÉPLICAS] → ${out}`);
