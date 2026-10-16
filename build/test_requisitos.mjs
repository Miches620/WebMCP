// build/test_requisitos.mjs — requisitos de instalación declarados en el Standard (16/10).
//   node build/test_requisitos.mjs
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRequirement, checkStandard, requisitosText, installCommand, runInstall, writeInstallEvidence, REQUISITOS_VERSION } from "./requisitos.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };

// una carpeta de proyecto falsa: con handlebars pero sin su archivo dist, sin playwright
const root = mkdtempSync(join(tmpdir(), "req-"));
writeFileSync(join(root, "package.json"), "{}");
mkdirSync(join(root, "node_modules", "handlebars"), { recursive: true });
writeFileSync(join(root, "node_modules", "handlebars", "package.json"), JSON.stringify({ name: "handlebars", version: "4.7.8" }));

t("versión", REQUISITOS_VERSION === "requisitos v0.1");
t("node: versión mínima", (await checkRequirement({ id: "node", verificar: { tipo: "node", minimo: 20 } }, { versions: { node: "24.21.0" } })).ok && !(await checkRequirement({ id: "node", verificar: { tipo: "node", minimo: 20 } }, { versions: { node: "18.2.0" } })).ok);
const hb = { id: "handlebars", verificar: { tipo: "archivo", modulo: "handlebars", ruta: "dist/handlebars.min.js" } };
const r1 = await checkRequirement(hb, { root });
t("archivo: está el paquete pero no el archivo → falta, y dice cuál", !r1.ok && /no dist\/handlebars\.min\.js/.test(r1.detalle), r1.detalle);
mkdirSync(join(root, "node_modules", "handlebars", "dist"));
writeFileSync(join(root, "node_modules", "handlebars", "dist", "handlebars.min.js"), "/* hb */");
const r2 = await checkRequirement(hb, { root });
t("archivo: con el archivo → ok, con la versión", r2.ok && r2.detalle === "handlebars 4.7.8", r2.detalle);
t("modulo que no está → falta", !(await checkRequirement({ id: "pw", verificar: { tipo: "modulo", modulo: "playwright" } }, { root })).ok);
t("chromium sin playwright → falta, y dice por qué", /falta playwright/.test((await checkRequirement({ id: "c", verificar: { tipo: "chromium" } }, { root })).detalle));

const res = await checkStandard("web/app/plantillas", { root, versions: { node: "24.21.0" } });
t("Standard plantillas en la carpeta falsa: node y handlebars ok, playwright y chromium faltan", res.items.map((x) => `${x.id}:${x.ok}`).join() === "node:true,playwright:false,chromium:false,handlebars:true" && !res.ok, JSON.stringify(res.items.map((x) => [x.id, x.ok])));
const txt = requisitosText(res);
t("texto: qué falta, el comando y cómo instalar con confirmación", /✗ playwright/.test(txt) && /instalar: npm install --save-dev playwright/.test(txt) && /--standard web\/app\/plantillas --instalar/.test(txt));

t("solo se instala lo declarado en la ficha del Standard", installCommand("web/app/plantillas", "handlebars") === "npm install --save-dev handlebars@4.7.8" && throws(() => installCommand("web/app/plantillas", "rm -rf"), /REQUISITO_UNKNOWN/) && throws(() => installCommand("web/app/plantillas", "node"), /REQUISITO_MANUAL/));
const run = await runInstall("node -e \"console.log('instalado')\"", { root });
t("runInstall corre el comando en la carpeta del proyecto y devuelve salida y código", run.code === 0 && /instalado/.test(run.out));
const ev = writeInstallEvidence({ standard: "web/app/plantillas", requisito: "handlebars", comando: "x", aprobado_por: "test", code: 0, ok_despues: true }, { root });
t("deja evidencia en evidence/requisitos/", existsSync(ev) && JSON.parse(readFileSync(ev, "utf8")).aprobado_por === "test");

// el proyecto real (esta carpeta): estado necesita playwright y chromium, que el harness ya usa
const real = await checkStandard("web/app/estado");
t("en este proyecto, web/app/estado tiene node y playwright", real.items.find((x) => x.id === "node").ok && real.items.find((x) => x.id === "playwright").ok, requisitosText(real));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
