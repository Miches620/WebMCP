// test_planilla_writer.mjs — el validador de filas y el ciclo de reintentos de Qwen, sin modelo.
//   node profiles/web/validation/test_planilla_writer.mjs
import { readFileSync } from "node:fs";
import { validateRow, normalizeRow, writeRequirement, writePlanilla, systemPrompt, userPrompt, WRITER_VERSION } from "./planilla_writer.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const P = JSON.parse(readFileSync(new URL("./fixtures/planilla_kanban_c22.json", import.meta.url), "utf8"));

t("versión", WRITER_VERSION === "planilla_writer v0.2");
// calibración: la planilla hecha a mano (la vara) cumple el validador entera
const hand = P.filas.map((f) => [f.id, validateRow(f, 17)]);
t("las 22 filas de la planilla a mano pasan el validador", hand.every(([, v]) => v.ok), hand.filter(([, v]) => !v.ok).map(([id, v]) => `${id}: ${v.problems.join("; ")}`).join(" | "));

const bad = (row, re) => { const v = validateRow(row, 17); return !v.ok && v.problems.some((p) => re.test(p)); };
t("clases / ids / selectores → rechazada (es el CÓMO)", bad({ r: "R1", veo: [{ esta: ".card-title" }] }, /cómo está programado/) && bad({ r: "R1", veo: [{ control: ["#add-btn"] }] }, /cómo está programado/) && bad({ r: "R1", hago: { agregar: "QA" }, veo: [{ esta: "onclick" }] }, /cómo está programado/));
t("un color en hex NO es un selector", validateRow({ r: "R9", veo: [{ estilo: { de: "pagina", prop: "background-color", valor: "#102C54" } }] }, 17).ok);
t("dos acciones en 'hago' → rechazada", bad({ r: "R1", hago: { agregar: "QA A", eliminar: "QA A" }, veo: [{ no_esta: "QA A" }] }, /UNA acción/));
t("'mover' sin destino → rechazada", bad({ r: "R6", hago: { mover: "QA A" }, veo: [{ esta: "QA A" }] }, /necesita "a"/));
t("'veo' vacío o de un tipo que no existe → rechazada", bad({ r: "R1", veo: [] }, /al menos una/) && bad({ r: "R1", veo: [{ parpadea: "QA" }] }, /tipo desconocido/));
t("requisito que no existe (R40 de 17) → rechazada", bad({ r: "R40", veo: [{ esta: "x" }] }, /requisito/));
t("estilo con prop o valor inventado → rechazada", bad({ r: "R9", veo: [{ estilo: { de: "pagina", prop: "fondo", valor: "#102C54" } }] }, /prop/) && bad({ r: "R9", veo: [{ estilo: { de: "pagina", prop: "color", valor: "azul marino oscuro" } }] }, /valor/));
t("claves de más → rechazada", bad({ r: "R1", veo: [{ esta: "x" }], porque: "sí" }, /claves que no existen/));
t("familia de color fuera de rojo/amarillo/verde → rechazada", bad({ r: "R3", veo: [{ color_en_item: "QA A", familia: "violeta" }] }, /familia/));

// ---------- v0.2: la 1ª corrida REAL de Qwen sobre c22 (17/10): 18 filas aceptadas, 30/68 contra la vara ----------
const FEATS = JSON.parse(readFileSync(new URL("./fixtures/real_kanban_c22/snapshot_min.json", import.meta.url), "utf8")).intentForge.refined_prompt.features;
const Q = JSON.parse(readFileSync(new URL("./fixtures/real_qwen_c22/planilla_qwen_c22.json", import.meta.url), "utf8"));
const handCtx = P.filas.filter((f) => !validateRow(f, 17, { features: FEATS }).ok).map((f) => f.id);
t("la vara pasa también los chequeos de SENTIDO (textos QA creados, contenedores que el usuario nombró)", !handCtx.length, handCtx.join());
const still = Q.filas.filter((f) => validateRow(normalizeRow(f).row, 17, { features: FEATS }).ok).map((f) => f.id);
t("de las 18 filas que v0.1 dejó pasar, v0.2 rechaza 15 (quedan las 3 de orden de R16)", still.join() === "R16.1,R16.2,R16.3", still.join());
const why = (id) => validateRow(normalizeRow(Q.filas.find((f) => f.id === id)).row, 17, { features: FEATS }).problems.join(" | ");
t("R8: 'QA Pendiente' como nombre de columna → no se creó en la fila", /"QA Pendiente" no se creó/.test(why("R8.1")));
t("R7.2: 'click' dentro de hago → no existe (una acción)", /no lleva: click/.test(why("R7.2")));
t("R2: \"Botón 'Agregar tarjeta'\" → sin comillas", /sin comillas/.test(why("R2.1")));
t("R15: contador que cambia 0 → no prueba nada", /no prueba nada/.test(why("R15.1")));
const rescued = Object.entries(Q.rechazadas).flatMap(([r, l]) => l.map((b) => ({ r, ok: validateRow(normalizeRow({ ...b.fila, r }).row, 17, { features: FEATS }).ok }))).filter((x) => x.ok).map((x) => x.r);
t("normalizar rescata filas que v0.1 tiraba por la forma ('de': \"tarjeta\" → { tarjeta: … }): R12 y una de R15", rescued.join() === "R12,R15", rescued.join());
const n12 = normalizeRow({ r: "R12", veo: [{ estilo: { de: "tarjeta", prop: "height", valor: "250px" } }] });
t("normalizar: 'tarjeta' sin tarjeta creada → agrega dado QA Alfa y lo dice", n12.row.dado?.[0]?.agregar === "QA Alfa" && n12.row.veo[0].estilo.de.tarjeta === "QA Alfa" && n12.cambios.length === 2);
const nb = normalizeRow({ r: "R11", veo: [{ estilo: { de: "columna Pendiente", prop: "border", valor: "1px dashed" } }, { estilo: { de: "pagina", prop: "border-radius", valor: "8px" } }, { estilo: { de: "pagina", prop: "box-shadow", valor: "0 2px 4px rgba(0,0,0,.3)" } }] }).row.veo;
t("normalizar: 'columna X', border → border-top-style, border-radius → border-top-left-radius, sombra concreta → distinta de none", nb[0].estilo.de.columna === "Pendiente" && nb[0].estilo.prop === "border-top-style" && nb[0].estilo.valor === "dashed" && nb[1].estilo.prop === "border-top-left-radius" && nb[2].estilo.valor.distinto === "none");

// el pedido
const sys = systemPrompt();
t("el pedido: solo ESE requisito, QA solo para lo creado, sin clases ni ids, ejemplos de otra app (con sin_fila)", /SOLO lo que dice ESE requisito/.test(sys) && /"QA " es SOLO para lo que la fila crea/.test(sys) && /sin clases, ids/.test(sys) && /sin_fila/.test(sys) && !/Pendiente|En Curso/.test(sys));
const up = userPrompt({ id: "R2", text: "b", features: ["a", "b"], context: "Kanban" });
t("el pedido de un requisito trae todos como contexto y dice cuál escribir", /R1\. a/.test(up) && /SOLO de R2: "b"/.test(up));

// ciclo con un modelo de mentira
const feats = ["Crear tarjetas en la columna Pendiente", "Div 'top' con title y actions"];
const replies = (list) => { let i = 0; return async () => ({ content: list[Math.min(i++, list.length - 1)] }); };
const r1 = await writeRequirement({ id: "R1", text: feats[0], features: feats, call: replies([
  `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":".card"}]}]}`,
  `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa","en":"Pendiente"}]}]}`,
]) });
t("fila mala → reintento con el problema escrito → buena (2 llamadas, id R1.1)", r1.filas.length === 1 && r1.filas[0].id === "R1.1" && r1.calls.length === 2 && r1.calls[0].rejected[0].some((x) => /cómo está programado/.test(x)), JSON.stringify(r1.calls.map((c) => c.rejected)));
const r13 = await writeRequirement({ id: "R2", text: feats[1], features: feats, call: replies([`{"sin_fila":"dice cómo está armada la tarjeta por dentro"}`]) });
t("sin_fila con motivo → SIN_CHEQUEO, una sola llamada", r13.sin_fila && !r13.filas.length && r13.calls.length === 1);
const rx = await writeRequirement({ id: "R1", text: feats[0], features: feats, call: replies(["no sé"]) });
t("nunca da JSON → 3 intentos y sin filas (no inventa nada)", rx.filas.length === 0 && rx.calls.length === 3);
const rr = await writeRequirement({ id: "R1", text: feats[0], features: feats, call: replies([`{"filas":[{"r":"R2","veo":[{"esta":"x"}]}]}`, `{"filas":[{"hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa"}]}]}`]) });
t("fila de otro requisito → rechazada; sin 'r' → toma el del pedido", rr.filas.length === 1 && rr.filas[0].r === "R1" && /no de R1/.test(rr.calls[0].rejected[0][0]));
const pl = await writePlanilla({ features: feats, call: async (m) => ({ content: /SOLO de R1/.test(m[1].content) ? `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa"}]}]}` : `{"sin_fila":"es el cómo"}` }) });
t("planilla entera: filas de R1, R2 sin fila con su motivo, y quién la escribió", pl.filas.length === 1 && pl.sin_fila.R2 === "es el cómo" && /planilla_writer v0\.2/.test(pl.autor));
const caida = await writePlanilla({ features: ["x"], call: async () => { throw new Error("fetch failed"); } });
t("LM Studio caído → el requisito queda sin fila, con el error (no se inventa)", /fetch failed/.test(caida.sin_fila.R1));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
