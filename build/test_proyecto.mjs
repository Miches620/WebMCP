// test_proyecto.mjs — la cadena entera sin modelo: el pedido tal cual, el borrador (vuelta 0) y juzgar.
//   node build/test_proyecto.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leerPedido, planillaEnPalabras, juzgar, nombresParecidos, unificar, agregar, rehacer, PROYECTO_VERSION } from "./proyecto.mjs";
import { borrador, ciclo } from "./run_ciclo.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { leerApp } from "../harness/mapa.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, "../profiles/web/validation/fixtures");
const VARA = JSON.parse(readFileSync(join(FIX, "planilla_kanban_c22.json"), "utf8"));

t("versión", PROYECTO_VERSION === "proyecto v0.1");
// ---------- el pedido de Miche, tal cual (project26) ----------
const ped = leerPedido(readFileSync(join(here, "pedidos/kanban_project26.txt"), "utf8"));
const txt = ped.requisitos.map((r) => r.texto);
t("el pedido de project26: título, las 17 features en orden y sin tocar", ped.titulo === "Webapp estilo Kanban" && ped.requisitos.filter((r) => r.de === "feature").length === 17 && txt[0] === "Crear tarjetas" && txt[16].startsWith("Botones 'Eliminar' y 'Editar'"));
t("los criterios que dicen algo nuevo quedan como requisito (localstorage solo está en los criterios; eliminar no se pierde)", txt.includes("Se guardan los datos en localstorage") && txt.includes("Se pueden eliminar las tarjetas") && txt.includes("Se muestra un mensaje de confirmación antes de eliminar una tarjeta"));
t("los criterios que repiten una feature casi palabra por palabra no se duplican (6), y queda dicho cuál", ped.repetidos.length === 6 && ped.repetidos.some((x) => /div 'top'/.test(x.criterio) && /^Div 'top'/.test(x.ya_esta_en)));
t("las restricciones también son requisitos (se prueban: 'no se borra en Completa')", ped.requisitos.filter((r) => r.de === "restriccion").length === 4 && txt.some((x) => /^Restricción: .*eliminar tarjetas en columna 'Completa'/.test(x)));
t("pedido con \\n escapados (como sale del snapshot) y sin secciones: una línea, un requisito", leerPedido("Mi app\\nhace A\\nhace B").requisitos.map((r) => r.texto).join() === "hace A,hace B");
const md = await planillaEnPalabras(VARA, JSON.parse(readFileSync(join(FIX, "real_kanban_c22/snapshot_min.json"), "utf8")).intentForge.refined_prompt.features.map((texto) => ({ texto })));
t("planilla.md: cada requisito con lo que se va a probar, en palabras y sin textos de prueba; los sin prueba, con el motivo", /## R3\. /.test(md) && /se pinta de rojo/.test(md) && !/QA /.test(md) && /## R13\.[^\n]*\n- \(sin prueba: /.test(md));

// ---------- vuelta 0: el borrador, un archivo por pedido ----------
const ARR = leerApp(join(FIX, "flow_gemma_sola_arreglada"));
const pedidos = [];
const call = async (messages, max, tipo) => { pedidos.push({ tipo, sys: messages[0].content, user: messages[1].content, max }); const f = tipo.split(" ")[1]; return { content: `### ARCHIVO: ${f}\n\`\`\`\n${ARR[f]}\n\`\`\``, ms: 1 }; };
const b = await borrador({ features: ped.requisitos.map((r) => r.texto), planilla: VARA, call });
t("borrador: 3 pedidos (index.html → styles.css → script.js), cada uno con un solo archivo", pedidos.map((p) => p.tipo).join() === "borrador index.html,borrador styles.css,borrador script.js" && Object.keys(b.app).join() === "index.html,styles.css,script.js");
t("styles.css y script.js se escriben VIENDO el index.html (mismos ids y clases); el primero no", !/index\.html \(ya escrito\)/.test(pedidos[0].user) && /index\.html \(ya escrito\)/.test(pedidos[1].user) && /index\.html \(ya escrito\)/.test(pedidos[2].user) && pedidos[2].user.includes('id="card-form"'));
t("cada pedido trae lo que pide el usuario y qué se va a probar, sin textos de prueba, y entra en 12k", pedidos.every((p) => /Lo que pide el usuario/.test(p.user) && /Qué se prueba/.test(p.user) && !/QA Alfa/.test(p.user) && p.user.length / 3.2 + p.sys.length / 3.2 + p.max <= 12000), pedidos.map((p) => Math.round((p.user.length + p.sys.length) / 3.2) + "+" + p.max).join(" "));
let n2 = 0;
const malo = async (messages, max, tipo) => { n2++; const f = tipo.split(" ")[1]; return { content: f === "script.js" && n2 === 3 ? "### ARCHIVO: script.js\n```js\nfunction ( {\n```" : `### ARCHIVO: ${f}\n\`\`\`\n${ARR[f]}\n\`\`\``, ms: 1 }; };
const b2 = await borrador({ features: ["x"], planilla: VARA, call: malo });
t("un script.js que no compila se vuelve a pedir, diciendo el error", b2.pedidos.filter((p) => p.archivo === "script.js").length === 2 && b2.app["script.js"].trimEnd() === ARR["script.js"].trimEnd());

const c0 = await ciclo({ app: null, planilla: VARA, features: ["x"], outDir: mkdtempSync(join(tmpdir(), "c0-")), maxVueltas: 1, log: () => {}, call: async (m, max, tipo) => (tipo.startsWith("borrador") ? call(m, max, tipo) : { content: "no sé", ms: 1 }) });
t("el ciclo sin app de partida arranca por la vuelta 0 (borrador) y lo juzga: con el borrador de Gemma sola arreglada, 9 requisitos", c0.ev.borrador?.length === 3 && c0.ev.curva[0].cumplidos === 9, JSON.stringify(c0.ev.curva));

// ---------- juzgar: una app contra la vara ----------
const j1 = await juzgar(join(FIX, "flow_ciclo_v03_final"), VARA), j2 = await juzgar(join(FIX, "flow_ciclo_v03_scroll"), VARA);
t("juzgar: la app del ciclo v0.3 da 15/16 con la vara nueva (falta que scrollee la columna); arreglada, 16/16", j1.cumplidos === 15 && j1.fallan[0].r === "R10" && j2.cumplidos === 16, `${j1.cumplidos} ${j2.cumplidos}`);

// ---------- dos nombres para lo mismo (20/10: "Completa" ×4 y "Completado" ×1 en project26) ----------
{
  const P26 = readFileSync(join(here, "pedidos", "kanban_project26.txt"), "utf8");
  const c26 = nombresParecidos(P26);
  t("nombres: el pedido real de project26 tiene 'Completa' y 'Completado' → usa 'Completa' (la que más aparece); nada más", c26.length === 1 && c26[0].usa === "Completa" && c26[0].en_vez_de === "Completado", JSON.stringify(c26));
  t("nombres: se cambia la palabra entera ('Completamente' no se toca) y se ve arriba de planilla.md", unificar("columnas: Pendiente, Completado. Completamente", c26) === "columnas: Pendiente, Completa. Completamente" && /usé \*\*"Completa"\*\*/.test(await planillaEnPalabras(VARA, [], c26)));
  t("nombres: plurales, nombres distintos y nombres sin comillas no se tocan", nombresParecidos("Columnas 'Pendiente', 'Pendientes'. 'Prioridad' y Prioridades. 'En Curso', 'Completa'. Comprar y Compartir.").length === 0 && nombresParecidos("columnas Completa y Completado").length === 0);
  t("nombres: con tilde y sin tilde es el mismo nombre", nombresParecidos("'Descripción' ... Descripcion ... 'Descripción'")[0]?.usa === "Descripción");
}

// ---------- 20/10: el scroll de las columnas se prueba scrolleando ----------
{
  const { rowsFromChoices } = await import("../profiles/web/validation/planilla_plantillas.mjs");
  const G3 = { item: "tarjeta", grupo: "columna", inicio: "Pendiente" };
  const r = rowsFromChoices(["Pendiente", "En Curso", "Completa"].map((n) => ({ plantilla: "estilo", de: "columna", nombre: n, prop: "overflow-y", valor: "scroll" })), "R10", G3);
  const p = { version: "planilla v0.1", glosario: G3, filas: r.filas.map((f, i) => ({ ...f, id: `R10.${i + 1}` })) };
  const m = await juzgar(join(FIX, "flow_ciclo_v03_final"), p), b = await juzgar(join(FIX, "flow_ciclo_v03_scroll"), p);
  const { describirFila } = await import("../profiles/web/validation/planilla_palabras.mjs");
  t("overflow en palabras: las 10 movidas van en una sola frase (Miche: 'medio confuso de leer')", /Antes: muevo esas 10 tarjetas a "En Curso", de a una\. →/.test(describirFila(p.filas[1], G3)) && (describirFila(p.filas[1], G3).match(/muevo/g) || []).length === 1, describirFila(p.filas[1], G3));
  t("overflow de columnas (Qwen, project26): la app del 19/10 (scrollea la página) falla; la arreglada pasa en las 3 columnas", m.cumplidos === 0 && b.cumplidos === 1 && !b.fallan.length, `${m.cumplidos} ${b.cumplidos}`);
}

// ---------- 21/10: el borrador de project26 contra su planilla ----------
{
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const { separarArchivos } = await import("./run_ciclo.mjs");
  const { mkdtempSync: mk } = await import("node:fs");
  const d = mk(join(tmpdir(), "p26-")), app = leerApp(join(FIX, "flow_p26_borrador"));
  for (const [f, s] of Object.entries(separarArchivos(app).app)) writeFileSync(join(d, f), s);
  const j = await juzgar(d, P26), fallan = j.fallan.map((f) => f.r).join(",");
  t("p26: la tarjeta en Pendiente se encuentra aunque la columna tenga header + h2 (R1, R18) y se arrastra de la manija (R22); quedan los 7 errores de verdad", j.cumplidos === 16 && fallan === "R2,R8,R10,R11,R12,R25,R28", `${j.cumplidos} ${fallan}`);
  const fin = await juzgar(join(FIX, "flow_p26_final"), P26);
  t("p26: la app final de Gemma (22/10, 4 corridas retomando) da 23/23 con otros textos al azar", fin.cumplidos === 23 && !fin.fallan.length, `${fin.cumplidos} ${fin.fallan.map((f) => f.r).join(",")}`);
}

// ---------- 22/10: reglas visuales medibles (visual.mjs) ----------
{
  const { filasVisuales } = await import("../profiles/web/validation/visual.mjs");
  const { describirFila } = await import("../profiles/web/validation/planilla_palabras.mjs");
  const { ordenReq } = await import("./run_ciclo.mjs");
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const PV = { ...P26, filas: [...P26.filas, ...filasVisuales()] };
  const a = await juzgar(join(FIX, "flow_p26_final"), PV), b = await juzgar(join(FIX, "flow_p26_visual_mano"), PV);
  t("visual: la app 23/23 falla contraste (blanco sobre amarillo, 1.95 a 1) y se corta (tarjeta de 253px en 248px); arreglada a mano pasa todo SIN romper las 23 pruebas de Miche", a.cumplidos === 27 && a.fallan.map((f) => f.r).join(",") === "V1,V2" && /1\.95 a 1|3\.02 a 1/.test(a.fallan[0].detalle.join(" ")) && b.cumplidos === 29, `${a.cumplidos} ${a.fallan.map((f) => f.r)} · ${b.cumplidos} ${b.fallan.map((f) => f.r)}`);
  t("visual: en palabras dice la regla; los V van después de todos los R", /contraste de al menos 4\.5/.test(describirFila(filasVisuales()[0], P26.glosario)) && ["V1", "R28", "R2", "V2"].sort((x, y) => ordenReq(x) - ordenReq(y)).join(",") === "R2,R28,V1,V2");
}

// ---------- 22/10: agregar pedidos a un proyecto que ya existe + centrado + manija ----------
{
  const d = mkdtempSync(join(tmpdir(), "pag-"));
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const reqs = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8")).filas.length ? Array.from({ length: 30 }, (_, i) => ({ texto: i === 7 ? "Campos de cada columna: title ('Pendiente', 'En Curso', 'Completa')" : `requisito ${i + 1}`, de: "feature" })) : [];
  writeFileSync(join(d, "pedido.txt"), "columnas: Pendiente, En Curso, Completa\n");
  writeFileSync(join(d, "requisitos.json"), JSON.stringify({ titulo: "Kanban", requisitos: reqs, intentForge: { refined_prompt: { features: reqs.map((r) => r.texto) } } }));
  writeFileSync(join(d, "planilla.json"), JSON.stringify(P26));
  const vistos = [];
  const call = async (m) => { vistos.push(m[1].content); return { content: JSON.stringify({ usa: [{ plantilla: "centrado", de: "columnas" }] }) }; };
  const r = await agregar(d, ["Las columnas centradas horizontalmente en la página"], { call });
  const p2 = JSON.parse(readFileSync(join(d, "planilla.json"), "utf8")), q2 = JSON.parse(readFileSync(join(d, "requisitos.json"), "utf8")), md = readFileSync(join(d, "planilla.md"), "utf8");
  t("agregar: Qwen escribe SOLO lo nuevo (1 pedido, no 31), queda como R31 y se suma a planilla.json, requisitos.json y planilla.md", vistos.length === 1 && r.ids[0] === "R31" && p2.filas.length === P26.filas.length + 1 && p2.filas.at(-1).r === "R31" && q2.requisitos.length === 31 && q2.intentForge.refined_prompt.features.length === 31 && /R31\.1\*\* · → las columnas quedan centradas/.test(md), JSON.stringify(r));
  const vistos2 = [];
  const r2 = await rehacer(d, ["R31", "R8"], { call: async (m) => { vistos2.push(m[1].content); return { content: JSON.stringify({ usa: [{ plantilla: "centrado", de: "columnas" }] }) }; } });
  const p3 = JSON.parse(readFileSync(join(d, "planilla.json"), "utf8"));
  t("rehacer: solo R8 y R31 (Qwen solo ve esos dos), sus filas viejas se guardan aparte y el resto queda igual", vistos2.length >= 2 && vistos2.some((x) => /centradas/.test(x)) && vistos2.some((x) => /Campos de cada columna/.test(x)) && r2.ids.join() === "R8,R31" && p3.filas.some((f) => f.r === "R31") && p3.filas.filter((f) => !["R8", "R31"].includes(f.r)).length === P26.filas.filter((f) => f.r !== "R8").length && Object.keys(p3.reemplazadas || {}).some((k) => k.startsWith("R8.")), JSON.stringify(r2));
  const PN = { ...P26, filas: [
    { id: "R6.1", r: "R6", dado: [{ agregar: "QA Alfa" }], veo: [{ en_item: "QA Alfa", contiene: ["⠿"] }] },
    { id: "R6.2", r: "R6", dado: [{ agregar: "QA Alfa" }], hago: { mover: "QA Alfa", a: "En Curso", manija: "⠿" }, veo: [{ esta: "QA Alfa", en: "En Curso" }] },
    { id: "R31.1", r: "R31", veo: [{ centrado: "grupos" }] }] };
  const a = await juzgar(join(FIX, "flow_p26_final"), PN), b = await juzgar(join(FIX, "flow_p26_centrado_mano"), PN);
  t("centrado y manija: la app 23/23 no muestra ⠿ (no se puede arrastrar desde ahí) y está corrida (51px a la izq., 445 a la der.); arreglada a mano pasa las dos", a.cumplidos === 0 && /445px a la derecha/.test(a.fallan.find((f) => f.r === "R31").detalle.join(" ")) && b.cumplidos === 2, `${a.cumplidos} · ${b.cumplidos} ${JSON.stringify(b.fallan)}`);
}

// ---------- quitar: Miche saca pruebas que están mal ----------
const dq = mkdtempSync(join(tmpdir(), "pq-"));
const reqK = JSON.parse(readFileSync(join(FIX, "real_kanban_c22/snapshot_min.json"), "utf8")).intentForge.refined_prompt.features.map((texto) => ({ texto }));
writeFileSync(join(dq, "requisitos.json"), JSON.stringify({ requisitos: reqK }));
writeFileSync(join(dq, "planilla.json"), JSON.stringify(VARA));
const outQ = execFileSync(process.execPath, [join(here, "proyecto.mjs"), "quitar", dq, "R3.2", "R7.*"], { encoding: "utf8" });
const pq = JSON.parse(readFileSync(join(dq, "planilla.json"), "utf8")), mdq = readFileSync(join(dq, "planilla.md"), "utf8");
t("quitar: saca las pruebas que dice Miche (R3.2 y todas las de R7), las guarda aparte y rehace planilla.md con los números", /saqué 2 prueba/.test(outQ) && !pq.filas.some((f) => f.id === "R3.2" || f.r === "R7") && pq.quitadas["R3.2"] && /Miche sacó/.test(pq.sin_fila.R7) && /\*\*R3\.1\*\* · /.test(mdq), outQ);

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
