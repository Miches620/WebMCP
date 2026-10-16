// build/requisitos.mjs — ¿está instalado lo que necesita un Standard? Y, si Miche dice que sí, instalarlo (16/10).
//
//   node build/requisitos.mjs --standard web/app/plantillas            qué hay y qué falta
//   node build/requisitos.mjs --profile web/app                        lo mismo, con el Standard por defecto del tipo
//   node build/requisitos.mjs --standard web/app/plantillas --instalar  pregunta (s/N) por cada faltante y lo instala
//
// Decisión de Miche (16/10): "si quiero usar un stack que no tengo instalado, webmcp debería instalármelo". Cada
// Standard declara en su ficha (meta.mjs → requiere) qué necesita, cómo verificarlo y cómo instalarlo. Esto:
//   - verifica sin instalar nada (lo usan run_build, que falla antes de gastar el modelo, y la UI);
//   - instala SOLO con el sí de Miche y SOLO comandos declarados en la ficha del Standard (nunca uno armado por un
//     modelo); vuelve a verificar y deja evidencia en evidence/requisitos/.
// Instalar toca la máquina de Miche: nunca pasa en silencio ni a mitad de un build.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { standardMeta } from "../standards/catalog.mjs";

export const REQUISITOS_VERSION = "requisitos v0.1";
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Verifica un requisito. Devuelve { id, ok, detalle }. No instala nada. */
export async function checkRequirement(r, { root = ROOT, versions = process.versions } = {}) {
  const v = r.verificar || {};
  try {
    if (v.tipo === "node") {
      const major = Number(String(versions.node || "0").split(".")[0]);
      return { id: r.id, ok: major >= v.minimo, detalle: `Node ${versions.node}${major >= v.minimo ? "" : ` (hace falta ${v.minimo} o más)`}` };
    }
    if (v.tipo === "modulo" || v.tipo === "archivo") {
      const dir = join(root, "node_modules", v.modulo);
      if (!existsSync(join(dir, "package.json"))) return { id: r.id, ok: false, detalle: `no está ${v.modulo} en node_modules` };
      if (v.tipo === "archivo" && !existsSync(join(dir, v.ruta))) return { id: r.id, ok: false, detalle: `está ${v.modulo} pero no ${v.ruta}` };
      const req = createRequire(join(root, "package.json"));
      const pkg = req(join(dir, "package.json"));
      return { id: r.id, ok: true, detalle: `${v.modulo} ${pkg.version}` };
    }
    if (v.tipo === "chromium") {
      const pw = join(root, "node_modules", "playwright", "index.mjs");
      if (!existsSync(pw)) return { id: r.id, ok: false, detalle: "falta playwright (Chromium se instala con playwright)" };
      const { chromium } = await import(pathToFileURL(pw).href);
      const exe = chromium.executablePath();
      return { id: r.id, ok: !!exe && existsSync(exe), detalle: exe && existsSync(exe) ? "Chromium de Playwright instalado" : "falta el Chromium de Playwright" };
    }
    return { id: r.id, ok: false, detalle: `no sé verificar "${v.tipo}"` };
  } catch (e) {
    return { id: r.id, ok: false, detalle: `error al verificar: ${e.message}` };
  }
}

/** Verifica todos los requisitos de un Standard. */
export async function checkStandard(standardId, opts = {}) {
  const meta = standardMeta(standardId);
  const items = [];
  for (const r of meta.requiere || []) items.push({ ...(await checkRequirement(r, opts)), para: r.para, instalar: r.instalar || null, manual: r.manual || null });
  const faltan = items.filter((x) => !x.ok);
  return { version: REQUISITOS_VERSION, standard: meta.id, status: meta.status, ok: !faltan.length, items, faltan };
}

/** Texto para la consola, el error de run_build y la UI. */
export function requisitosText(res) {
  const L = [`Requisitos de ${res.standard} (${res.status}): ${res.ok ? "todo instalado" : `faltan ${res.faltan.length}`}`];
  for (const x of res.items) L.push(`  ${x.ok ? "✓" : "✗"} ${x.id} — ${x.detalle} (${x.para})${x.ok ? "" : x.instalar ? `\n      instalar: ${x.instalar}` : x.manual ? `\n      a mano: ${x.manual}` : ""}`);
  if (!res.ok && res.faltan.some((x) => x.instalar)) L.push(`Para instalar (te pregunta antes de cada uno): node build/requisitos.mjs --standard ${res.standard} --instalar`);
  return L.join("\n");
}

/** El comando a correr para un requisito: SOLO el declarado en la ficha del Standard. */
export function installCommand(standardId, reqId) {
  const r = (standardMeta(standardId).requiere || []).find((x) => x.id === reqId);
  if (!r) throw new Error(`REQUISITO_UNKNOWN: ${standardId} no declara "${reqId}"`);
  if (!r.instalar) throw new Error(`REQUISITO_MANUAL: "${reqId}" no se instala solo: ${r.manual || "instalalo a mano"}`);
  return r.instalar;
}

/** Corre un comando de instalación (con shell, en la carpeta del proyecto). Devuelve { code, out }. */
export function runInstall(cmd, { root = ROOT, onData = () => {} } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, { cwd: root, shell: true });
    let out = "";
    const take = (d) => { out += d; onData(String(d)); };
    p.stdout.on("data", take);
    p.stderr.on("data", take);
    p.on("close", (code) => resolve({ code, out: out.slice(-4000) }));
    p.on("error", (e) => resolve({ code: -1, out: e.message }));
  });
}

/** Deja evidencia de una instalación. */
export function writeInstallEvidence(entry, { root = ROOT } = {}) {
  const dir = join(root, "evidence", "requisitos");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}_${entry.standard.replace(/\//g, "_")}_${entry.requisito}.json`);
  writeFileSync(f, JSON.stringify({ version: REQUISITOS_VERSION, ...entry }, null, 2));
  return f;
}

// ---------- uso por consola ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  let std = flag("--standard");
  if (!std && flag("--profile")) {
    const { resolveProfiles } = await import("../profiles/registry.mjs");
    std = resolveProfiles([flag("--profile")]).standard;
  }
  if (!std) { console.log("uso: node build/requisitos.mjs --standard <id> [--instalar]  (o --profile <tipo>)"); process.exit(2); }
  let res = await checkStandard(std);
  console.log(requisitosText(res));
  if (args.includes("--instalar") && !res.ok) {
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    for (const x of res.faltan) {
      if (!x.instalar) { console.log(`\n${x.id}: no se instala solo — ${x.manual || "instalalo a mano"}`); continue; }
      const a = (await rl.question(`\n¿Instalo ${x.id} (${x.para})?\n  comando: ${x.instalar}\n  [s/N] `)).trim().toLowerCase();
      if (a !== "s" && a !== "si" && a !== "sí") { console.log("  no se instaló"); continue; }
      const r = await runInstall(x.instalar, { onData: (d) => process.stdout.write(d) });
      const after = await checkRequirement(standardMeta(std).requiere.find((q) => q.id === x.id));
      const f = writeInstallEvidence({ standard: std, requisito: x.id, comando: x.instalar, aprobado_por: "Miche (consola)", code: r.code, ok_despues: after.ok, detalle: after.detalle, salida: r.out });
      console.log(`\n  ${after.ok ? "✓ instalado" : "✗ sigue faltando"}: ${after.detalle} · evidencia: ${f}`);
    }
    rl.close();
    res = await checkStandard(std);
    console.log("\n" + requisitosText(res));
  }
  process.exit(res.ok ? 0 : 1);
}
