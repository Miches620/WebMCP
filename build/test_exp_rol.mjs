// test_exp_rol.mjs — el experimento de Role (03/11) con un modelo de mentira y el juez de verdad.
//   node build/test_exp_rol.mjs
import { readFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { experimento, textosDeCondicion, EXP_ROL_VERSION } from "./exp_rol.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "../profiles/web/validation/fixtures");
const leer = (d) => Object.fromEntries(["index.html", "styles.css", "script.js"].map((f) => [f, readFileSync(join(FIX, d, f), "utf8")]));
const MANO = leer("flow_hoja_mano"), NO = leer("flow_hoja_no_edita");

t("versión", EXP_ROL_VERSION === "exp_rol v0.1");
const tx = await textosDeCondicion("web-app");
t("textos: sin = nada; persona dice Frontend Senior sin Skills; rol = persona + Skills del borrador; placebo sin persona ni saber hacer", tx.sin === "" && /Frontend Senior/.test(tx.persona) && !/HABILIDADES/.test(tx.persona) && tx.rol.startsWith(tx.persona) && /<table>/.test(tx.rol) && /contenteditable/.test(tx.rol) && !/Senior|<table>|contenteditable/.test(tx.placebo));
t("el placebo mide casi lo mismo que el rol (±15%)", Math.abs(tx.placebo.length - tx.rol.length) / tx.rol.length < 0.15, `${tx.placebo.length} vs ${tx.rol.length}`);

// modelo de mentira: con "Senior" en el system devuelve la hoja hecha a mano; si no, una que no deja escribir
const systems = [];
const call = async (messages) => {
  systems.push(messages[0].content);
  const archivo = (messages[0].content.match(/Ahora escribí SOLO ([\w.]+)/) || [])[1];
  const app = /Frontend Senior/.test(messages[0].content) ? MANO : NO;
  return { content: `### ARCHIVO: ${archivo}\n\`\`\`\n${app[archivo]}\n\`\`\``, ms: 1 };
};
const out = mkdtempSync(join(tmpdir(), "exprol-"));
const logs = [];
const r = await experimento({ dir: join(FIX, "proyecto_hoja"), k: 1, conds: ["sin", "rol"], out, call, log: (m) => logs.push(m) });
const sin = r.res.find((x) => x.cond === "sin"), rol = r.res.find((x) => x.cond === "rol");
t("el Role llega al principio del system de los 3 pedidos del borrador (y no en la condición sin)", systems.filter((s) => s.startsWith("Sos un desarrollador Frontend Senior")).length === 3 && systems.filter((s) => s.startsWith("Sos el programador")).length === 3);
t("se mide con el juez: la hoja a mano 17/17, grilla y se escribe; la que no deja escribir: grilla sí, escribir no", rol.requisitos === 17 && rol.grilla && rol.escribe && sin.grilla && !sin.escribe && sin.requisitos < 17, JSON.stringify([sin.requisitos, sin.grilla, sin.escribe, rol.requisitos, rol.grilla, rol.escribe]));
t("resumen en tabla, una fila por condición", /\| sin \| 1 \| 1\/1 \| 0\/1 \|/.test(r.tabla) && /\| rol \| 1 \| 1\/1 \| 1\/1 \| 17\.0 \|/.test(r.tabla), r.tabla);
const r2 = await experimento({ dir: join(FIX, "proyecto_hoja"), k: 1, conds: ["sin", "rol"], out, call: async () => { throw new Error("no tendría que llamar"); }, log: () => {} });
t("con la misma carpeta, sigue desde donde quedó (no vuelve a pedir lo que ya hizo)", r2.res.length === 2 && r2.res.every((x) => x.requisitos === (x.cond === "rol" ? 17 : sin.requisitos)));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
