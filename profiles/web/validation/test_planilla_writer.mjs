// test_planilla_writer.mjs — el validador de filas y el ciclo de reintentos de Qwen, sin modelo.
//   node profiles/web/validation/test_planilla_writer.mjs
import { readFileSync } from "node:fs";
import { validateRow, normalizeRow, writeRequirement, writePlanilla, systemPrompt, userPrompt, proponerGlosario, WRITER_VERSION } from "./planilla_writer.mjs";
import { rowsFromChoices, relevanceProblems, camposDe, systemPromptPlantillas, PLANTILLAS, PLANTILLAS_VERSION } from "./planilla_plantillas.mjs";

let ok = 0, fail = 0;
const t = (name, cond, info = "") => { if (cond) { ok++; console.log(`✓ ${name}`); } else { fail++; console.log(`✗ ${name} ${info}`); } };
const P = JSON.parse(readFileSync(new URL("./fixtures/planilla_kanban_c22.json", import.meta.url), "utf8"));
const G = P.glosario; // el glosario del Kanban: { item: "tarjeta", grupo: "columna" } (dato del proyecto, no código)

t("versión", WRITER_VERSION === "planilla_writer v0.4");
// calibración: la planilla hecha a mano (la vara) cumple el validador entera
const hand = P.filas.map((f) => [f.id, validateRow(f, 17, { glosario: G })]);
t("las 23 filas de la planilla a mano pasan el validador", hand.every(([, v]) => v.ok), hand.filter(([, v]) => !v.ok).map(([id, v]) => `${id}: ${v.problems.join("; ")}`).join(" | "));

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
const handCtx = P.filas.filter((f) => !validateRow(f, 17, { features: FEATS, glosario: G }).ok).map((f) => f.id);
t("la vara pasa también los chequeos de SENTIDO (textos QA creados, contenedores que el usuario nombró)", !handCtx.length, handCtx.join());
const still = Q.filas.filter((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }).ok).map((f) => f.id);
t("de las 18 filas que v0.1 dejó pasar, v0.2.1 rechaza las 18 (las 3 de R16 esperaban el mismo orden en que se crean)", still.length === 0, still.join());
const why = (id) => validateRow(normalizeRow(Q.filas.find((f) => f.id === id), G).row, 17, { features: FEATS, glosario: G }).problems.join(" | ");
t("R8: 'QA Pendiente' como nombre de columna → no se creó en la fila", /"QA Pendiente" no se creó/.test(why("R8.1")));
t("R7.2: 'click' dentro de hago → no existe (una acción)", /no lleva: click/.test(why("R7.2")));
t("R2: \"Botón 'Agregar tarjeta'\" → sin comillas", /sin comillas/.test(why("R2.1")));
t("R15: contador que cambia 0 → no prueba nada", /no prueba nada/.test(why("R15.1")));
const rescued = Object.entries(Q.rechazadas).flatMap(([r, l]) => l.map((b) => ({ r, ok: validateRow(normalizeRow({ ...b.fila, r }, G).row, 17, { features: FEATS, glosario: G }).ok }))).filter((x) => x.ok).map((x) => x.r);
t("normalizar rescata filas que v0.1 tiraba por la forma ('de': \"tarjeta\" → { tarjeta: … }): R12 y una de R15", rescued.join() === "R12,R15", rescued.join());
const n12 = normalizeRow({ r: "R12", veo: [{ estilo: { de: "tarjeta", prop: "height", valor: "250px" } }] }, G);
t("normalizar: 'tarjeta' (el ítem, según el glosario) sin ninguna creada → agrega dado QA Alfa y lo dice", n12.row.dado?.[0]?.agregar === "QA Alfa" && n12.row.veo[0].estilo.de.item === "QA Alfa" && n12.cambios.length === 2);
const nb = normalizeRow({ r: "R11", veo: [{ estilo: { de: "columna Pendiente", prop: "border", valor: "1px dashed" } }, { estilo: { de: "pagina", prop: "border-radius", valor: "8px" } }, { estilo: { de: "pagina", prop: "box-shadow", valor: "0 2px 4px rgba(0,0,0,.3)" } }] }, G).row.veo;
t("normalizar: 'columna X', border → border-top-style, border-radius → border-top-left-radius, sombra concreta → distinta de none", nb[0].estilo.de.grupo === "Pendiente" && nb[0].estilo.prop === "border-top-style" && nb[0].estilo.valor === "dashed" && nb[1].estilo.prop === "border-top-left-radius" && nb[2].estilo.valor.distinto === "none");

// ---------- v0.2.1: la 2ª corrida REAL (17/10, con v0.2): 8 filas, 9 requisitos sin fila ----------
const E2 = JSON.parse(readFileSync(new URL("./fixtures/real_qwen_c22/evidencia_v02.json", import.meta.url), "utf8"));
const ok2 = E2.planilla.filas.filter((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }).ok).map((f) => f.id);
t("2ª corrida: siguen R9, R11, R12; caen R4 (espera ver 'Titulo', un nombre de campo), R6 (crea dos veces), R8 ('title'), R14 ('Tarjeta'), R16 (orden = creación)", ok2.join() === "R9.1,R11.1,R12.1", ok2.join());
const w16 = validateRow(normalizeRow(E2.planilla.filas.find((f) => f.r === "R16"), G).row, 17, { features: FEATS, glosario: G }).problems.join();
t("R16: crear Alta, Media, Baja y esperar ese orden no prueba que ordene", /no prueba que la app ordene/.test(w16), w16);
const resc = [];
for (const [r, calls] of Object.entries(E2.calls)) for (const c of calls) { if (!c.raw || c.accepted) continue; let j; try { j = JSON.parse(c.raw.replace(/^```json|```$/g, "")); } catch { continue; } for (const f of j.filas || []) if (validateRow(normalizeRow({ ...f, r: f.r || r }, G).row, 17, { features: FEATS, glosario: G }).ok) resc.push(r); }
t("normalizar (esta+en_item → contiene, 'columna X' → X, botón → palabras) rescata respuestas que v0.2 tiraba: R7, R11, R17", ["R7", "R11", "R17"].every((r) => resc.includes(r)), [...new Set(resc)].join());

// el pedido
const sys = systemPrompt(G);
t("el pedido: solo ESE requisito, QA solo para lo creado, sin clases ni ids, ejemplos de otra app (con sin_fila)", /SOLO lo que dice ESE requisito/.test(sys) && /"QA " es SOLO para lo que la fila crea/.test(sys) && /sin clases, ids/.test(sys) && /sin_fila/.test(sys) && !/Pendiente|En Curso/.test(sys));
const up = userPrompt({ id: "R2", text: "b", features: ["a", "b"], context: "Kanban" });
t("el pedido de un requisito trae todos como contexto y dice cuál escribir", /R1\. a/.test(up) && /SOLO de R2: "b"/.test(up));

// ciclo con un modelo de mentira
const feats = ["Crear tarjetas en la columna Pendiente", "Div 'top' con title y actions"];
const replies = (list) => { let i = 0; return async () => ({ content: list[Math.min(i++, list.length - 1)] }); };
const r1 = await writeRequirement({ id: "R1", text: feats[0], features: feats, modo: "libre", call: replies([
  `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":".card"}]}]}`,
  `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa","en":"Pendiente"}]}]}`,
]) });
t("fila mala → reintento con el problema escrito → buena (2 llamadas, id R1.1)", r1.filas.length === 1 && r1.filas[0].id === "R1.1" && r1.calls.length === 2 && r1.calls[0].rejected[0].some((x) => /cómo está programado/.test(x)), JSON.stringify(r1.calls.map((c) => c.rejected)));
const r13 = await writeRequirement({ id: "R2", text: feats[1], features: feats, modo: "libre", call: replies([`{"sin_fila":"dice cómo está armada la tarjeta por dentro"}`]) });
t("sin_fila con motivo → SIN_CHEQUEO, una sola llamada", r13.sin_fila && !r13.filas.length && r13.calls.length === 1);
const rx = await writeRequirement({ id: "R1", text: feats[0], features: feats, modo: "libre", call: replies(["no sé"]) });
t("nunca da JSON → 3 intentos y sin filas (no inventa nada)", rx.filas.length === 0 && rx.calls.length === 3);
const rr = await writeRequirement({ id: "R1", text: feats[0], features: feats, modo: "libre", call: replies([`{"filas":[{"r":"R2","veo":[{"esta":"x"}]}]}`, `{"filas":[{"hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa"}]}]}`]) });
t("fila de otro requisito → rechazada; sin 'r' → toma el del pedido", rr.filas.length === 1 && rr.filas[0].r === "R1" && /no de R1/.test(rr.calls[0].rejected[0][0]));
const pl = await writePlanilla({ features: feats, modo: "libre", call: async (m) => ({ content: /SOLO de R1/.test(m[1].content) ? `{"filas":[{"r":"R1","hago":{"agregar":"QA Alfa"},"veo":[{"esta":"QA Alfa"}]}]}` : `{"sin_fila":"es el cómo"}` }) });
t("planilla entera: filas de R1, R2 sin fila con su motivo, y quién la escribió", pl.filas.length === 1 && pl.sin_fila.R2 === "es el cómo" && /planilla_writer v0\.\d+(\.\d+)? .*modo libre/.test(pl.autor));
const caida = await writePlanilla({ features: ["x"], call: async () => { throw new Error("fetch failed"); } });
t("LM Studio caído → el requisito queda sin fila, con el error (no se inventa)", /fetch failed/.test(caida.sin_fila.R1));

// ---------- v0.3: modo PLANTILLAS (Qwen elige, el harness arma) ----------
t("plantillas: versión y 17 plantillas (v0.4: no_borrar_en; v0.5: confirmar_al_borrar; v0.6: se_ve_en_item, centrado)", PLANTILLAS_VERSION === "planilla_plantillas v0.6" && Object.keys(PLANTILLAS).length === 17);
const IDEAL = JSON.parse(readFileSync(new URL("./fixtures/real_qwen_c22/elecciones_ideales_c22.json", import.meta.url), "utf8"));
const built = Object.entries(IDEAL).filter(([r]) => /^R\d+$/.test(r) && IDEAL[r].usa).flatMap(([r, a]) => { const x = rowsFromChoices(a.usa, r, G); return [...x.filas.map((f) => [r, validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G })]), ...x.problems.map((p) => [r, { ok: false, problems: [p] }])]; });
t("techo: las elecciones IDEALES para c22 arman 28 filas y TODAS pasan el validador (con los chequeos de sentido)", built.length === 28 && built.every(([, v]) => v.ok), built.filter(([, v]) => !v.ok).map(([r, v]) => `${r}: ${v.problems.join("; ")}`).join(" | "));
// (el techo contra la vara, en las 4 apps: 67 de 68 — evidencia del 17/10; la única diferencia es R5 en plantillas, donde la plantilla tiene razón)
const ord = rowsFromChoices([{ plantilla: "orden_por_campo", campo: "prioridad", valores: ["alta", "media", "baja"], columna: "Pendiente", reciente_primero: true }], "R16", G).filas[0];
t("orden_por_campo: crea en un orden DISTINTO al esperado (si no, no prueba que ordene) y prueba el desempate por reciente", ord.dado.map((d) => d.agregar).join() === "QA Alta Vieja,QA Baja,QA Media,QA Alta Nueva" && ord.veo[0].orden.join() === "QA Alta Nueva,QA Alta Vieja,QA Media,QA Baja", JSON.stringify(ord));
const est = rowsFromChoices([{ plantilla: "estilo", de: "tarjeta", prop: "box-shadow", valor: "con sombra" }, { plantilla: "estilo", de: "boton", nombre: "Agregar tarjeta", prop: "padding", valor: "8px" }], "R9", G).filas;
t("estilo: 'con sombra' → distinta de none, crea la tarjeta; botón → sus palabras", est[0].veo[0].estilo.valor.distinto === "none" && est[0].veo[0].estilo.de.item === "QA Alfa" && est[0].dado[0].agregar === "QA Alfa" && est[1].veo[0].estilo.de.control.join() === "Agregar,tarjeta");
const malas = rowsFromChoices([{ plantilla: "volar" }, { plantilla: "mover" }, { plantilla: "estilo", de: "columna", prop: "width", valor: "248px" }], "R6", G).problems;
t("elecciones mal completadas → afuera, cada una con qué falta", malas.length === 3 && /no existe/.test(malas[0]) && /"a": la columna de destino/.test(malas[1]) && /"nombre": el nombre de la columna/.test(malas[2]), malas.join(" | "));
const sp = systemPromptPlantillas(G);
t("pedido de plantillas: lista las 15, ejemplos de otra app (recetas), sin_fila", Object.keys(PLANTILLAS).every((k) => sp.includes(`- ${k}:`)) && /recetas/.test(sp) && /sin_fila/.test(sp) && !/Pendiente|En Curso/.test(sp));
const tp = await writeRequirement({ id: "R1", text: feats[0], features: feats, glosario: G, call: replies([
  `{"usa":[{"plantilla":"crear","columna":"Columna Pendiente"},{"plantilla":"volar"}]}`,
  `{"usa":[{"plantilla":"crear","columna":"Pendiente"}]}`,
]) });
t("modo plantillas (por defecto): elección inventada → reintento con el motivo → bien; la fila sale armada por el harness", tp.filas.length === 1 && tp.filas[0].hago.agregar === "QA Alfa" && tp.filas[0]._plantilla === "crear" && tp.calls.length === 2 && tp.calls[0].rejected.some((x) => /no existe/.test(x.join())), JSON.stringify(tp.calls.map((c) => c.rejected)));
const tps = await writeRequirement({ id: "R2", text: feats[1], features: feats, call: replies([`{"sin_fila":"es el cómo"}`]) });
t("modo plantillas: sin_fila con motivo, una llamada", tps.sin_fila === "es el cómo" && tps.calls.length === 1);

// ---------- v0.3.1: la 1ª corrida REAL con plantillas (17/10): 54 de 68 contra la vara, 16 de 17 requisitos con filas ----------
const E3 = JSON.parse(readFileSync(new URL("./fixtures/real_qwen_c22/evidencia_v03.json", import.meta.url), "utf8"));
const ans = (r) => JSON.parse(E3.calls[r][E3.calls[r].length - 1].raw.replace(/^```json|```$/g, "").trim());
const idealRel = Object.entries(IDEAL).filter(([r, a]) => /^R\d+$/.test(r) && a.usa).flatMap(([r, a]) => relevanceProblems(a.usa, FEATS[Number(r.slice(1)) - 1]).map((x) => `${r}: ${x}`));
t("las elecciones ideales pasan la pertinencia (solo un AVISO en R6: '24px' es el ancho del handle, el CÓMO)", idealRel.length === 1 && /^R6: AVISO/.test(idealRel[0]), idealRel.join(" | "));
const rel15 = relevanceProblems(ans("R15").usa, FEATS[14]);
t("R15: 'al_pasar_mouse' y 'orden_por_campo' no tienen que ver con el requisito → afuera", rel15.filter((x) => /no habla de eso/.test(x)).length === 2, rel15.join(" | "));
const v13 = rowsFromChoices(ans("R13").usa, "R13", G).filas.map((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }));
t("R13: 'title' y 'actions' no son textos que se vean (piezas del código) → rechazada", v13.every((v) => !v.ok && v.problems.some((x) => /pieza del código/.test(x))));
const r16 = rowsFromChoices(ans("R16").usa, "R16", G).filas.map((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }).problems.join());
t("R16: un contenedor 'Pendiente, En Curso, Completa' es una lista → rechazada", /es una lista/.test(r16[0]), r16[0]);
const c4 = camposDe({ Titulo: "", "Descripción": "", Prioridad: "" });
t("campos sin valor: el título se saca, la descripción la completa el harness, la prioridad se pide", !("Titulo" in c4.campos) && c4.campos["Descripción"] === "QA Descripción" && c4.faltan.join() === "Prioridad");
const w4 = rowsFromChoices(ans("R4").usa, "R4", G).problems.join();
t("R4 real: el reintento pide un valor de ejemplo para la prioridad", /un valor de ejemplo para "Prioridad"/.test(w4), w4);
t("lista de campos (['Titulo', 'descripción', 'prioridad']) también vale", camposDe(["Titulo", "descripción", "prioridad"]).faltan.join() === "prioridad");

// ---------- v0.2.1 de las plantillas: la 2ª corrida real con plantillas (17/10, 55 de 68) ----------
const P31 = JSON.parse(readFileSync(new URL("./fixtures/real_qwen_c22/planilla_v031.json", import.meta.url), "utf8"));
const ch10 = P31.filas.filter((f) => f.r === "R10" && f._plantilla === "estilo" && f.veo[0].estilo.prop === "background-color").map((f) => ({ plantilla: "estilo", de: "columna", nombre: f.veo[0].estilo.de.columna, prop: "background-color", valor: f.veo[0].estilo.valor }));
t("R10: un color que el requisito no dice (#102C54 era el fondo de R9) → afuera", ch10.length === 3 && relevanceProblems(ch10, FEATS[9]).filter((x) => /no está en este requisito/.test(x)).length === 3);
t("R2: 'crear' no corresponde aunque el texto diga botón 'Agregar tarjeta' (lo citado es un nombre)", relevanceProblems([{ plantilla: "crear", columna: "Pendiente" }], FEATS[1]).some((x) => /no habla de eso/.test(x)) && !relevanceProblems([{ plantilla: "crear", columna: "Pendiente" }], FEATS[0]).length);
t("R5: un texto libre que no dijo el usuario ('Nueva descripción') pasa a texto de prueba 'QA …'", camposDe({ "Descripción": "Nueva descripción", Prioridad: "alta" }).campos["Descripción"] === "QA Nueva descripción" && rowsFromChoices([{ plantilla: "editar", campos: { "Descripción": "Nueva descripción", Prioridad: "alta" } }], "R5", G).filas.every((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }).ok));
t("R5 (20/10): campos en lista + valor_nuevo aparte se juntan (antes se rechazaba 3 veces)", (() => { const ch = { plantilla: "editar", campos: ["Titulo", "descripción", "prioridad"], valor_nuevo: { prioridad: "alta" } }; const r = rowsFromChoices([ch], "R5", G); return r.filas.length === 1 && r.filas.every((f) => validateRow(normalizeRow(f, G).row, 17, { features: FEATS, glosario: G }).ok) && JSON.stringify(r.filas[0].hago.campos) === JSON.stringify({ "descripción": "QA descripción", prioridad: "alta" }); })());
t("R5 (20/10): sin valor para prioridad se sigue rechazando", rowsFromChoices([{ plantilla: "editar", campos: ["Titulo", "prioridad"] }], "R5", G).filas.length === 0);
t("R10 (20/10): 'columna con overflow:scroll' se prueba haciéndola scrollear (10 tarjetas; si no es la de inicio, se llevan) y no solo el estilo", (() => { const G3 = { ...G, inicio: "Pendiente" }; const r = rowsFromChoices(["Pendiente", "En Curso"].map((n) => ({ plantilla: "estilo", de: "columna", nombre: n, prop: "overflow-y", valor: "scroll" })), "R10", G3); const [a, b] = r.filas; return a.veo[0].desborde === "Pendiente" && a.dado.length === 10 && b.veo[0].desborde === "En Curso" && b.dado.filter((d) => d.mover).length === 10 && rowsFromChoices([{ plantilla: "estilo", de: "columna", nombre: "Pendiente", prop: "overflow-y", valor: "scroll" }], "R10", G).filas[0].veo[0].estilo; })());
t("R32 (23/10): mover con 'a' en lista (el pedido no nombra destino) toma una columna que no es la de inicio; la manija tiene que estar escrita", (() => { const G3 = { ...G, inicio: "Pendiente" }; const r = rowsFromChoices([{ plantilla: "mover", manija: "⠿", desde: "Pendiente, En Curso, Completa", a: "Pendiente, En Curso, Completa" }], "R32", G3); return r.filas.length === 1 && r.filas[0].hago.a === "En Curso" && r.filas[0].hago.manija === "⠿" && !r.filas[0].veo.some((v) => v.contador) && relevanceProblems([{ plantilla: "mover", a: "En Curso", manija: "☰" }], "Cada tarjeta muestra su manija ⠿ y se arrastra desde ella").some((x) => /☰/.test(x)); })());
t("R33 (23/10): 'al intentar eliminar en Completa, mostrar el mensaje …' → no_borrar_en con el mensaje (aparece al apretar borrar y la tarjeta sigue)", (() => { const G3 = { ...G, inicio: "Pendiente" }; const R33 = "Al intentar eliminar una tarjeta en 'Completa', mostrar el mensaje 'No se puede eliminar una tarjeta completada'"; const ch = [{ plantilla: "no_borrar_en", columna: "Completa", mensaje: "No se puede eliminar una tarjeta completada" }]; const r = rowsFromChoices(ch, "R33", G3); return !relevanceProblems(ch, R33).length && r.filas[0].veo[0].pregunta === "No se puede eliminar una tarjeta completada" && r.filas[0].veo[1].esta === "QA Alfa"; })());

const nbe = rowsFromChoices([{ plantilla: "no_borrar_en", columna: "Completa" }], "R19", G);
t("restricción 'no se puede borrar en Completa': crea, mueve a Completa, intenta borrar, sigue ahí; pasa el validador", nbe.filas.length === 1 && nbe.filas[0].dado[1].mover === "QA Alfa" && nbe.filas[0].veo[0].en === "Completa" && validateRow(normalizeRow(nbe.filas[0], G).row, 20, { features: [...FEATS, "x", "Sin eliminar tarjetas en columna 'Completa'"], glosario: G }).ok && !relevanceProblems([{ plantilla: "no_borrar_en", columna: "Completa" }], "Sin crear nuevas columnas, permitir tarjetas vacías, eliminar tarjetas en columna 'Completa'").length, JSON.stringify(nbe) + validateRow(normalizeRow(nbe.filas[0], G).row, 20, { features: [...FEATS, "x", "Sin eliminar tarjetas en columna 'Completa'"], glosario: G }).problems.join());

// ---------- v0.5: la 1ª corrida de npm run proyecto con project26 (19/10) ----------
const R28 = "Restricción: Sin crear nuevas columnas, permitir tarjetas vacías, eliminar tarjetas en columna 'Completa'";
t("R28 real: una restricción no se prueba HACIENDO lo prohibido (salió 'borro y desaparece', lo contrario)", relevanceProblems([{ plantilla: "borrar" }], R28).some((x) => /RESTRICCIÓN/.test(x)) && !relevanceProblems([{ plantilla: "no_borrar_en", columna: "Completa" }], R28).some((x) => /RESTRICCIÓN/.test(x)));
const R8 = "Campos que tendrá cada columna: title ('Pendiente', 'En Curso', 'Completa'), y counter (contador de tarjetas dentro de la columna)";
const rel8 = relevanceProblems([{ plantilla: "se_ven_textos", textos: ["contador de tarjetas dentro de la columna", "Pendiente"] }], R8).join();
t("R8 real: 'se ven' solo con textos entre comillas ('contador de tarjetas dentro de la columna' es una descripción; 'Pendiente' sí)", /contador de tarjetas dentro de la columna" no está entre comillas/.test(rel8) && !/"Pendiente" no está/.test(rel8), rel8);
const R7 = "Comportamiento al borrar una tarjeta: Eliminar(🗑️) abre un modal para consultarle al usuario 'Esta seguro de borrar la tarjeta?' y si el usuario confirma, la tarjeta sera eliminada";
const cb = rowsFromChoices([{ plantilla: "confirmar_al_borrar", texto: "Esta seguro de borrar la tarjeta?" }], "R7", G);
t("R7 real: la pregunta de confirmación se prueba al borrar (antes de confirmar), no como texto fijo en la pantalla", !relevanceProblems([{ plantilla: "confirmar_al_borrar", texto: "x" }], R7).length && cb.filas[0].hago.eliminar === "QA Alfa" && cb.filas[0].veo[0].pregunta === "Esta seguro de borrar la tarjeta?" && validateRow(normalizeRow(cb.filas[0], G).row, 17, { features: [...FEATS.slice(0, 6), R7], glosario: G }).ok, validateRow(normalizeRow(cb.filas[0], G).row, 17, { features: [...FEATS.slice(0, 6), R7], glosario: G }).problems.join());

// el glosario: la 1ª corrida real dijo que el Kanban no tiene grupos
const pedidosG = [];
const fakeG = (resps) => { let i = 0; return async (m) => { pedidosG.push(m.at(-1).content); return { content: resps[Math.min(i++, resps.length - 1)] }; }; };
const g1 = await proponerGlosario({ features: FEATS, call: fakeG(['{"item": "tarjeta", "grupo": null}', '{"item": "tarjeta", "grupo": "columna"}']) });
t("glosario: si Qwen dice 'no hay grupos' pero hay nombres entre comillas, se le vuelve a preguntar señalándolos; la 2ª dice columna", g1.glosario?.grupo === "columna" && /nombran entre comillas: .*"Pendiente"/.test(pedidosG[1]), JSON.stringify(g1) + pedidosG[1]?.slice(0, 200));
const g2 = await proponerGlosario({ features: FEATS, call: fakeG(['{"item": "task", "grupo": "board"}', '{"item": "tarjeta", "grupo": "columna"}']) });
t("glosario: una palabra que no está en los requisitos no vale (se copia tal cual)", g2.glosario?.item === "tarjeta" && /"task" no aparece en los requisitos/.test(pedidosG.at(-1)));

const g3 = await proponerGlosario({ features: FEATS, call: fakeG(['{"item": "tarjeta", "grupo": "pendiente"}', '{"item": "tarjeta", "grupo": "columna"}']) });
t("glosario (2ª corrida real): 'pendiente' es el NOMBRE de una columna, no la palabra que las engloba → se re-pregunta", g3.glosario?.grupo === "columna" && /es el NOMBRE de uno de esos lugares/.test(pedidosG.at(-1)), JSON.stringify(g3));
const dup = await writeRequirement({ id: "R1", text: "Se guardan los datos: recargar y que sigan", features: ["Se guardan los datos: recargar y que sigan"], glosario: G, call: async () => ({ content: '{"usa":[{"plantilla":"recargar_sigue"},{"plantilla":"recargar_sigue"},{"plantilla":"recargar_sigue"}]}' }) });
t("la misma prueba 3 veces (R23 real) queda una sola", dup.filas.length === 1, JSON.stringify(dup.filas.map((f) => f.id)));

console.log(`\n${ok}/${ok + fail} OK`);
if (fail) process.exit(1);
