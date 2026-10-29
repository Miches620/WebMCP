// test_proyecto.mjs — la cadena entera sin modelo: el pedido tal cual, el borrador (vuelta 0) y juzgar.
//   node build/test_proyecto.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leerPedido, planillaEnPalabras, juzgar, nombresParecidos, unificar, agregar, rehacer, fichaDe, PROYECTO_VERSION } from "./proyecto.mjs";
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
  t("p26: la tarjeta en Pendiente se encuentra aunque la columna tenga header + h2 (R1, R18) y se arrastra de la manija (R22); quedan los errores de verdad (desde el 26/10 también R9: el gris de adentro tapa el color pedido para la columna)", j.cumplidos === 15 && fallan === "R2,R8,R9,R10,R11,R12,R25,R28", `${j.cumplidos} ${fallan}`);
  const fin = await juzgar(join(FIX, "flow_p26_final"), P26);
  t("p26: la app final de Gemma (22/10, 4 corridas retomando) da 23/23 con otros textos al azar (con el juez del 26/10, 22: R9, el color de la columna casi no se ve)", fin.cumplidos === 22 && fin.fallan.map((f) => f.r).join() === "R9", `${fin.cumplidos} ${fin.fallan.map((f) => f.r).join(",")}`);
}

// ---------- 22/10: reglas visuales medibles (visual.mjs) ----------
{
  const { filasVisuales } = await import("../profiles/web/validation/visual.mjs");
  const { describirFila } = await import("../profiles/web/validation/planilla_palabras.mjs");
  const { ordenReq } = await import("./run_ciclo.mjs");
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const PV = { ...P26, filas: [...P26.filas, ...filasVisuales()] };
  const a = await juzgar(join(FIX, "flow_p26_final"), PV), b = await juzgar(join(FIX, "flow_p26_visual_mano"), PV);
  t("visual: la app 23/23 falla contraste (blanco sobre amarillo, 1.95 a 1) y se corta (tarjeta de 253px en 248px); arreglada a mano pasa contraste y cortes SIN romper las 23 pruebas de Miche (V6, botones encima del título al pasar el mouse, sigue en las dos)", a.cumplidos === 26 && a.fallan.map((f) => f.r).join(",") === "R9,V1,V2,V6" && /1\.95 a 1|3\.02 a 1/.test(a.fallan.find((f) => f.r === "V1").detalle.join(" ")) && b.cumplidos === 28 && b.fallan.map((f) => f.r).join(",") === "R9,V6", `${a.cumplidos} ${a.fallan.map((f) => f.r)} · ${b.cumplidos} ${b.fallan.map((f) => f.r)}`);
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

// ---------- 25/10: el MVP congelado (33/33 + 6 reglas visuales de v0.1) y la superposición al pasar el mouse ----------
{
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const { filasVisuales } = await import("../profiles/web/validation/visual.mjs");
  const m = await juzgar(join(FIX, "flow_p26_mvp"), { ...P26, filas: [...P26.filas, ...filasVisuales()] });
  t("MVP: la app congelada pasa las 23 de c22 y todas las reglas visuales menos no_se_superpone (🗑️ y ✏️ encima del título, lo que vio Miche); con el juez del 26/10 tampoco R9 (el #8FB3C7 pedido casi no se ve)", m.cumplidos === m.de - 2 && m.fallan.map((f) => f.r).join() === "R9,V6" && /casi no se ve/.test(m.fallan[0].detalle.join(" ")) && /no_se_superpone: .*action-btn.*card-title/.test(m.fallan[1].detalle.join(" ")), `${m.cumplidos}/${m.de} ${JSON.stringify(m.fallan).slice(0, 300)}`);
}

// ---------- 25/10: diseño moderno medible (REGLAS_MODERNAS) ----------
{
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const { filasModernas, REGLAS_MODERNAS } = await import("../profiles/web/validation/visual.mjs");
  const PM = { ...P26, filas: filasModernas(Object.keys(REGLAS_MODERNAS).slice(0, 10)) }; // las 10 de moderno v0.1
  const a = await juzgar(join(FIX, "flow_p26_mvp"), PM), b = await juzgar(join(FIX, "flow_p26_moderno_mano"), PM);
  t("moderno: el MVP pasa sombra, jerarquía y aire, y falla redondeo, letra, alto fijo, hover, barra, contador y acento; la versión hecha a mano (paleta de Miche) pasa las 10", a.fallan.map((f) => f.r).join(",") === "M1,M3,M6,M7,M8,M9,M10" && b.cumplidos === 10, `${a.fallan.map((f) => f.r)} · ${b.cumplidos} ${JSON.stringify(b.fallan).slice(0, 300)}`);
}

// ---------- 27/10: M9 (contador en pastilla) contra V5 (parejo): la pastilla no cuenta como un redondeo más ----------
{
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const { filasVisuales, filasModernas, REGLAS_MODERNAS } = await import("../profiles/web/validation/visual.mjs");
  const PVM = { ...P26, filas: [...filasVisuales(), ...filasModernas(Object.keys(REGLAS_MODERNAS).slice(0, 10))] }; // las 10 de moderno v0.1
  const a = await juzgar(join(FIX, "flow_p26_m9"), PVM), b = await juzgar(join(FIX, "flow_p26_m9_pastilla"), PVM);
  t("M9 vs V5: la app de Miche del 27/10 falla solo M9; con el contador en pastilla (999px) pasa todo, V5 incluida (la pastilla no suma al máximo de 4 redondeos)", a.fallan.map((f) => f.r).join() === "M9" && b.fallan.length === 0, `${JSON.stringify(a.fallan).slice(0, 200)} · ${JSON.stringify(b.fallan).slice(0, 300)}`);
}

// ---------- 27/10 noche: moderno v0.2 (M11 fondo a la vista, M12 texto cerca del borde, M13 esquinas): lo que se vio a ojo en la 43/43 ----------
{
  const P26 = JSON.parse(readFileSync(join(FIX, "planilla_kanban_p26.json"), "utf8"));
  const { filasVisuales, filasModernas } = await import("../profiles/web/validation/visual.mjs");
  const PVM = { ...P26, filas: [...filasVisuales(), ...filasModernas()] };
  const a = await juzgar(join(FIX, "flow_p26_m43"), PVM), b = await juzgar(join(FIX, "flow_p26_m43_mano"), PVM);
  const d = (r) => a.fallan.find((f) => f.r === r)?.detalle.join(" ") || "";
  t("moderno v0.2: la app 43/43 de Miche falla solo las 3 nuevas (gris que tapa el 78-89% de la columna, texto a 45/39px del borde, con las cuentas 30 + 15, el encabezado se sale de la esquina); arreglada a mano (6 líneas de CSS) pasa todas las V y M",
    a.fallan.map((f) => f.r).join() === "M11,M12,M13" && /tapa el 78%/.test(d("M11")) && /45px del borde de arriba y a 39px/.test(d("M12")) && /arriba 45px = relleno de <div class="card-body"> 30px \+ relleno de <div class="card"> 15px/.test(d("M12")) && /column-header.*se sale de la esquina/.test(d("M13")) && b.fallan.length === 0,
    `${a.fallan.map((f) => f.r)} · ${JSON.stringify(b.fallan).slice(0, 300)}`);
}

// ---------- 29/10: 2º proyecto (hoja de cálculo): el juez con acciones de persona, contra una hoja hecha a mano ----------
{
  const { rowsFromChoices } = await import("../profiles/web/validation/planilla_plantillas.mjs");
  const { normalizeRow, validateRow } = await import("../profiles/web/validation/planilla_writer.mjs");
  const GH = { item: null, grupo: null, lugar: "celda" };
  const elige = {
    R1: [{ plantilla: "escribir_y_ver", en: "B2", escribo: "hola", muestra: "hola" }], R2: [{ plantilla: "grilla", columnas: "A-J", filas: "1-20" }],
    R3: [{ plantilla: "escribir_y_ver", antes: { A1: "2", A2: "3", A3: "4" }, en: "A4", escribo: "=SUMA(A1:A3)", muestra: "9" }, { plantilla: "escribir_y_ver", antes: { A1: "2", B2: "5" }, en: "C3", escribo: "=SUMA(A1;B2)", muestra: "7" }, { plantilla: "escribir_y_ver", antes: { A1: "10", B1: "4" }, en: "C1", escribo: "=A1/B1", muestra: "2.5" }],
    R4: [{ plantilla: "escribir_y_ver", antes: { A1: "2", A2: "3", A3: "=SUMA(A1:A2)" }, en: "A1", escribo: "10", muestra: "13", muestra_en: "A3" }],
    R5: [{ plantilla: "seleccionar_y_usar", seleccion: "B2", accion: "color" }],
    R6: ["borrar", "vaciar", "color"].map((a) => ({ plantilla: "seleccionar_y_usar", seleccion: "C", accion: a })),
    R7: ["borrar", "vaciar", "color"].map((a) => ({ plantilla: "seleccionar_y_usar", seleccion: "3", accion: a })),
    R8: [{ plantilla: "seleccionar_y_usar", seleccion: "C", accion: "ocultar" }, { plantilla: "seleccionar_y_usar", seleccion: "4", accion: "ocultar" }],
    R9: [{ plantilla: "recargar_sigue" }],
  };
  const filas = Object.entries(elige).flatMap(([id, ch]) => rowsFromChoices(ch, id, GH).filas.map((f, k) => ({ ...normalizeRow(f, GH).row, id: `${id}.${k + 1}` })));
  const PH = { version: "planilla v0.2", glosario: GH, filas };
  const mano = await juzgar(join(FIX, "flow_hoja_mano"), PH), rota = await juzgar(join(FIX, "flow_hoja_rota"), PH);
  const d = (r) => rota.fallan.find((f) => f.r === r)?.detalle.join(" ") || "";
  t("hoja: las filas que arman las plantillas de lugares pasan el validador", filas.every((f) => validateRow(f, 9, { glosario: GH }).ok));
  t("hoja hecha a mano (la vara): el juez con acciones de persona la aprueba entera (escribir, fórmulas, se actualiza, color, borrar/vaciar/pintar columna y fila, ocultar, recargar)", mano.cumplidos === 9 && mano.de === 9, JSON.stringify(mano.fallan).slice(0, 600));
  t("hoja rota a propósito: falla justo lo roto (fórmulas R3/R4, color R5/R6/R7, ocultar columna R8) y dice qué vio", rota.fallan.map((f) => f.r).join() === "R3,R4,R5,R6,R7,R8" && /A4 muestra "=SUMA\(A1:A3\)" \(se esperaba "9"/.test(d("R3")) && /fondo de B2: rgb\(255, 255, 255\) \(se esperaba #ffcc00/.test(d("R5")) && /la columna "C" se sigue viendo/.test(d("R8")), rota.fallan.map((f) => `${f.r}: ${f.detalle.join(" ").slice(-160)}`).join(" | "));
  // el buscador: la ficha (rasgos con cita) y lo que no pediste como preguntas en planilla.md
  const ev = { grupos: [{ rasgo: "escribir fórmulas", de: ["T2"], fuentes: ["S1", "S2"], ya_pedido: true }, { rasgo: "compartir con el equipo", de: ["T3"], fuentes: ["S1", "S2", "S3"], fuera_del_stack: "necesita servidor" }, { rasgo: "combinar celdas", de: ["T1"], fuentes: ["S3"] }], rasgos: [{ id: "T1", fuente: "S3", cita: "Merge cells across rows" }, { id: "T2", fuente: "S1", cita: "Formulas  begin with an equal sign" }, { id: "T3", fuente: "S1", cita: "Share with your team" }] };
  const fi = fichaDe(ev);
  t("ficha del buscador: primero lo que ya pediste, con su cita; lo que necesita servidor no entra", fi.split("\n")[0] === '- escribir fórmulas (S1: "Formulas begin with an equal sign")' && !/compartir/.test(fi) && /combinar celdas/.test(fi), fi);
  const mdh = await planillaEnPalabras(PH, Object.keys(elige).map((k) => ({ texto: k })), [], { fuentes: [{ url: "https://ejemplo.org/hoja" }], ficha: fi, preguntas: [{ pregunta: "¿Querés que tu app tenga esto?: combinar celdas", porque: "lo tienen 1 de 3 fuentes (S3)" }] });
  const mdn = await planillaEnPalabras(PH, Object.keys(elige).map((k) => ({ texto: k })), [], { fuentes: [], motivo: "fetch failed" });
  const mdg = await planillaEnPalabras({ filas: [], glosario_problema: '"A1" es el NOMBRE de uno de esos lugares' }, [{ texto: "x" }]);
  t("planilla.md: si el glosario no salió, lo dice arriba de todo (la 2ª corrida de la hoja decía \"elemento\" como si nada)", /^# Planilla: qué se va a probar\n\n\*\*OJO: Qwen no pudo armar el glosario\*\* \("A1" es el NOMBRE/.test(mdg), mdg.slice(0, 200));
  t("planilla.md: glosario de grilla, filas en palabras de persona, y lo que encontró el buscador (ficha + lo que no pediste, que solo entra con agregar)", /grilla de \*\*celdas\*\* fijas/.test(mdh) && /Escribo "=SUMA\(A1:A3\)" en A4\. → A4 muestra "9"/.test(mdh) && /Antes: hago clic en la columna C \(en su letra\)\. Uso el control de ocultar\. → lo que se escribió ya no se ve · la columna C ya no se ve/.test(mdh) && /## Lo que encontró el buscador/.test(mdh) && /- combinar celdas \(lo tienen 1 de 3/.test(mdh) && /agregar/.test(mdh) && /No encontró fuentes \(fetch failed\)/.test(mdn), mdh.slice(0, 900));
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
