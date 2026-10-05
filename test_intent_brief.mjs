// test_intent_brief.mjs — determinista, sin LLM (el modelo se simula).
//   node test_intent_brief.mjs
import {
  parseBrief, numberLines, validateItems, fillUncovered, buildRefined,
  buildTechLeaderInput, parseModelOutput, runIntentForge, formatLinesForModel,
  TEMPLATE_TEXT, TEMPLATE_EXAMPLE, HARNESS_QUESTIONS, QUESTION_SYSTEM, QUESTION_HINT,
  isControlReply, splitSentences, actionVerbs, parseInterviewer, sameTopicAsked, questionFromGap, grounded, repairFeedback, touchesRestriction, isGenericGap, detailDuplicates, isDelegated, sharesTopicWithAsked, isImplementationQuestion,
} from "./intent_brief.mjs";

let ok = 0, fail = 0;
async function check(name, fn) {
  try { await fn(); console.log(`✓ ${name}`); ok++; }
  catch (e) { console.log(`✗ ${name}\n    ${e.message}`); fail++; }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m = "") => assert(JSON.stringify(a) === JSON.stringify(b), `${m} esperado ${JSON.stringify(b)}, vino ${JSON.stringify(a)}`);

// Project23 reescrito con la plantilla, con las mismas frases que usó Miche.
const P23 = `Qué querés construir:
- Una webapp estilo Kanban o Trello, sencilla
Qué tiene que hacer:
- Crear cards y moverlas en columnas de estados (pendientes, en curso, finalizadas, pospuestas)
- Drag & Drop funcional
- Agregar comentarios a las tarjetas, etiquetas
- Editar o borrar tarjetas creadas (CRUD completo)
Cómo se tiene que ver:
- Paleta de colores oscura, estilo industrial
- Sombras en tarjetas, hover con iluminación
- Efectos al colocar una card sobre alguna columna
Qué no debe hacer:
- Sin persistencia de datos: si actualizamos la web, el contenido se borra
- Solo frontend`;

const p23 = parseBrief(P23);
// Respuesta "buena" del modelo para P23 (lo que esperamos de Qwen).
const P23_ITEMS = [
  { de: ["L1"], tipo: "contexto", texto: "Webapp estilo Kanban o Trello, sencilla" },
  { de: ["L2"], tipo: "feature", texto: "Crear tarjetas" },
  { de: ["L2"], tipo: "feature", texto: "Mover tarjetas entre columnas de estados (pendientes, en curso, finalizadas, pospuestas)" },
  { de: ["L3"], tipo: "feature", texto: "Drag & Drop funcional" },
  { de: ["L4"], tipo: "feature", texto: "Agregar comentarios a las tarjetas" },
  { de: ["L4"], tipo: "feature", texto: "Etiquetar tarjetas" },
  { de: ["L5"], tipo: "feature", texto: "Editar tarjetas" },
  { de: ["L5"], tipo: "feature", texto: "Borrar tarjetas" },
  { de: ["L6"], tipo: "estilo", texto: "Paleta de colores oscura, estilo industrial" },
  { de: ["L7"], tipo: "estilo", texto: "Sombras en tarjetas" },
  { de: ["L7"], tipo: "estilo", texto: "Hover con iluminación en tarjetas" },
  { de: ["L8"], tipo: "estilo", texto: "Efecto visual al soltar una tarjeta sobre una columna" },
  { de: ["L9"], tipo: "restriccion", texto: "Sin persistencia: al recargar la web el contenido se borra" },
  { de: ["L10"], tipo: "restriccion", texto: "Solo frontend" },
];
const complete = (items, extra = {}) =>
  "```json\n" + JSON.stringify({ status: "COMPLETE", project_name: "Kanban WebApp", items, criterios_holdout: ["Se puede crear una tarjeta"], ...extra }) + "\n```";
// Modelo simulado con dos colas: preguntas (QUESTION_SYSTEM) y clasificación.
const fakeModel = (classify, questions = ['{"faltantes":[],"pregunta":null}']) => {
  const calls = [], qcalls = [];
  const fn = async (messages) => {
    if (messages[0].content === QUESTION_SYSTEM) {
      qcalls.push(messages.map((m) => ({ ...m })));
      return questions[Math.min(qcalls.length - 1, questions.length - 1)];
    }
    calls.push(messages.map((m) => ({ ...m })));
    return classify[Math.min(calls.length - 1, classify.length - 1)];
  };
  fn.calls = calls;
  fn.qcalls = qcalls;
  return fn;
};

await check("plantilla P23: 10 líneas, cada una en su campo", () => {
  assert(p23.hasTemplate, "no reconoció la plantilla");
  eq(p23.lines.map((l) => l.field), ["construir", "hacer", "hacer", "hacer", "hacer", "ver", "ver", "ver", "no", "no"]);
  eq(p23.empty, []);
});
await check("plantilla: encabezados sin 'qué', con ¿?, acentos y contenido en la misma línea", () => {
  const r = parseBrief("¿QUE QUERES CONSTRUIR? : un recetario\nTiene que hacer:\n* buscar\n1) cargar\ncomo se tiene que ver: cálido\nNo debe hacer:");
  eq(r.lines, [
    { field: "construir", text: "un recetario" }, { field: "hacer", text: "buscar" },
    { field: "hacer", text: "cargar" }, { field: "ver", text: "cálido" },
  ]);
  eq(r.empty, ["no"]);
});
await check("plantilla vacía (tal cual se precarga) → 0 líneas", () => {
  const r = parseBrief(TEMPLATE_TEXT);
  assert(r.hasTemplate && r.lines.length === 0, JSON.stringify(r));
});
await check("el ejemplo del chat se parsea completo (6 líneas en 4 campos)", () => {
  const r = parseBrief(TEMPLATE_EXAMPLE);
  eq(r.empty, []);
  eq(r.lines.length, 6);
});
await check("texto libre sin plantilla → líneas 'libre'", () => {
  const r = parseBrief("Quiero un kanban\ncon drag and drop");
  assert(!r.hasTemplate && r.lines.every((l) => l.field === "libre") && r.lines.length === 2, JSON.stringify(r));
});
await check("numberLines: respuesta lleva la pregunta; después de COMPLETE es ajuste", () => {
  const conv = [
    { role: "user", content: "Qué tiene que hacer:\n- crear tarjetas" },
    { role: "assistant", content: "¿Las columnas tienen nombres fijos?" },
    { role: "user", content: "sí: pendientes, en curso" },
    { role: "assistant", content: complete([]) },
    { role: "user", content: "sacá las etiquetas" },
  ];
  const n = numberLines(conv);
  eq(n.lines.map((l) => `${l.id}:${l.field}`), ["L1:hacer", "L2:respuesta", "L3:ajuste"]);
  eq(n.lines[1].pregunta, "¿Las columnas tienen nombres fijos?");
  eq(n.preguntas, ["¿Las columnas tienen nombres fijos?"]);
  assert(formatLinesForModel(n).includes('L2 [respuesta a "¿Las columnas tienen nombres fijos?"] sí: pendientes, en curso'), formatLinesForModel(n));
});
await check("validateItems: detecta líneas sin destino, ids inexistentes y tipos inválidos", () => {
  const lines = numberLines([{ role: "user", content: P23 }]).lines;
  const v = validateItems([
    ...P23_ITEMS.filter((i) => !i.de.includes("L3") && !i.de.includes("L8")),
    { de: ["L99"], tipo: "feature", texto: "inventada" },
    { de: ["L1"], tipo: "requisito", texto: "x" },
  ], lines);
  eq(v.uncovered, ["L3", "L8"]);
  eq(v.invalid.length, 2);
});
await check("validateItems: alias de tipo, 'de' como string o número", () => {
  const lines = [{ id: "L1", field: "hacer", text: "a" }, { id: "L2", field: "ver", text: "b" }];
  const v = validateItems([{ de: "L1", tipo: "Restricción", texto: "a" }, { de: [2], tipo: "style", texto: "b" }], lines);
  eq(v.items.map((i) => i.tipo), ["restriccion", "estilo"]);
  eq(v.uncovered, []);
});
await check("descartado sin [ajuste] → inválido; con [ajuste] → válido", () => {
  const lines = [{ id: "L1", field: "hacer", text: "etiquetas" }, { id: "L2", field: "ajuste", text: "sacá etiquetas" }];
  eq(validateItems([{ de: ["L1"], tipo: "descartado", texto: "x" }], lines).invalid.length, 1);
  eq(validateItems([{ de: ["L1", "L2"], tipo: "descartado", texto: "Etiquetas" }], lines).invalid.length, 0);
});
await check("fillUncovered: usa la pista del campo y marca auto", () => {
  const lines = [{ id: "L1", field: "hacer", text: "drag & drop" }, { id: "L2", field: "respuesta", text: "sí" }];
  const r = fillUncovered([], lines, ["L1", "L2"]);
  eq(r.map((i) => `${i.tipo}:${i.auto}`), ["feature:true", "contexto:true"]);
});
await check("red del harness: respuesta suelta lleva su pregunta y no entra al objetivo", () => {
  const lines = [
    { id: "L1", field: "construir", text: "Un kanban" },
    { id: "L2", field: "hacer", text: "crear tarjetas" },
    { id: "L3", field: "respuesta", text: "no", pregunta: "¿Buscar tarjetas?" },
  ];
  const items = fillUncovered([{ de: ["L1"], tipo: "contexto", texto: "Un kanban" }, { de: ["L2"], tipo: "feature", texto: "Crear tarjetas" }], lines, ["L3"]);
  eq(items.at(-1).texto, "¿Buscar tarjetas? → no");
  const r = buildRefined({ items, lines });
  eq(r.objetivo, "Un kanban");
  assert(r.contexto.includes("¿Buscar tarjetas? → no"));
});
await check("buildRefined P23: features = feature + estilo; restricciones y contexto aparte", () => {
  const lines = numberLines([{ role: "user", content: P23 }]).lines;
  const r = buildRefined({ project_name: "Kanban WebApp", items: validateItems(P23_ITEMS, lines).items, lines });
  eq(r.features.length, 11);
  assert(r.features.includes("Drag & Drop funcional"), "perdió drag & drop");
  assert(r.features.some((f) => f.includes("pendientes, en curso, finalizadas, pospuestas")), "perdió los nombres de columnas");
  eq(r.restricciones, ["Sin persistencia: al recargar la web el contenido se borra", "Solo frontend"]);
  eq(r.objetivo, "Webapp estilo Kanban o Trello, sencilla");
  eq(r.brief.items.length, 14);
});
await check("buildTechLeaderInput: restricciones después de criterios, sin 'Fuera de alcance'", () => {
  const t = buildTechLeaderInput({ project_name: "K", objetivo: "o", features: ["a", "b"], criterios_holdout: ["c"], restricciones: ["Solo frontend"] });
  assert(t.includes("Features:\n\n1. a\n2. b"), t);
  assert(t.indexOf("Restricciones") > t.indexOf("Criterios de éxito"), t);
  assert(!/Fuera de alcance|NO planificar lo que nombran/.test(t), t);
});
await check("parseModelOutput: JSON con comentarios y coma colgante; pregunta en texto; JSON roto", () => {
  assert(parseModelOutput('ok\n```json\n{"status":"COMPLETE",\n// x\n"items":[],}\n```').complete);
  eq(parseModelOutput("¿Las columnas tienen nombre?\n").question, "¿Las columnas tienen nombre?");
  assert(parseModelOutput('```json\n{"status":"COMPLETE", "items": [\n```').parseError);
});
await check("runIntentForge P23: LISTO de entrada → clasifica; pierde L3 → reintento → completo", async () => {
  const model = fakeModel([complete(P23_ITEMS.filter((i) => !i.de.includes("L3"))), complete(P23_ITEMS)]);
  const r = await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  eq(r.status, "COMPLETE");
  eq([model.qcalls.length, model.calls.length], [1, 2]);
  assert(model.calls[1].at(-1).content.includes("L3"), "el feedback no nombra L3");
  assert(r.refined.features.includes("Drag & Drop funcional"), "falta drag & drop");
  eq(r.auto_added, []);
  eq(r.refined.brief.repairs, 1);
});
await check("runIntentForge: si el modelo nunca la ubica, la agrega el harness (auto)", async () => {
  const model = fakeModel([complete(P23_ITEMS.filter((i) => !i.de.includes("L3")))]);
  const r = await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  eq(model.calls.length, 3);
  eq(r.auto_added, ["L3"]);
  const auto = r.refined.brief.items.find((i) => i.auto);
  eq([auto.tipo, auto.texto], ["feature", "Drag & Drop funcional"]);
});
await check("runIntentForge: el prompt de clasificación trae las líneas numeradas con su campo", async () => {
  const model = fakeModel([complete(P23_ITEMS)]);
  await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  const u = model.calls[0][1].content;
  assert(u.includes("L3 [qué tiene que hacer] Drag & Drop funcional") && u.includes("L10 [qué no debe hacer] Solo frontend"), u);
});
await check("entrevista: pregunta del modelo → ASKING con la ayuda de 'listo', sin clasificar", async () => {
  const model = fakeModel([complete(P23_ITEMS)], ["¿Se pueden crear columnas nuevas?"]);
  const r = await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  eq([r.status, r.by, model.calls.length], ["ASKING", "model", 0]);
  eq(r.question, `¿Se pueden crear columnas nuevas? ${QUESTION_HINT}`);
});
await check("entrevista: la respuesta entra como línea con su pregunta (sin la ayuda) y se vuelve a preguntar", async () => {
  const conv = [
    { role: "user", content: P23 },
    { role: "assistant", content: `¿Se pueden crear columnas nuevas? ${QUESTION_HINT}` },
    { role: "user", content: "no" },
  ];
  const model = fakeModel([complete(P23_ITEMS)], ["¿Se pueden buscar tarjetas?"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq(r.status, "ASKING");
  const q = model.qcalls[0][1].content;
  assert(q.includes('[respuesta a "¿Se pueden crear columnas nuevas?"] no'), q);
  assert(q.includes("PREGUNTAS QUE YA HICISTE (1/10") && !q.includes("listo\\\""), q);
});
await check("entrevista: LISTO → clasifica con las respuestas; un 'no' llega como línea", async () => {
  const conv = [
    { role: "user", content: P23 },
    { role: "assistant", content: `¿Se pueden crear columnas nuevas? ${QUESTION_HINT}` },
    { role: "user", content: "no" },
  ];
  const items = [...P23_ITEMS, { de: ["L11"], tipo: "restriccion", texto: "Sin crear columnas nuevas" }];
  const model = fakeModel([complete(items)], ["LISTO"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq(r.status, "COMPLETE");
  assert(model.calls[0][1].content.includes('L11 [respuesta a "¿Se pueden crear columnas nuevas?"] no'));
  assert(r.refined.restricciones.includes("Sin crear columnas nuevas"));
  eq(r.refined.brief.preguntas, ["¿Se pueden crear columnas nuevas?"]);
});
await check("entrevista: 'listo' del usuario corta sin llamar al entrevistador y no es una línea", async () => {
  const conv = [
    { role: "user", content: P23 },
    { role: "assistant", content: `¿Buscar tarjetas? ${QUESTION_HINT}` },
    { role: "user", content: "Listo!" },
  ];
  const model = fakeModel([complete(P23_ITEMS)], ["¿Otra?"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq([r.status, model.qcalls.length, r.lines.length], ["COMPLETE", 0, 10]);
  assert(isControlReply("nada más") && !isControlReply("no") && !isControlReply("no, sin búsqueda"));
});
await check("entrevista: tope de 10 preguntas → clasifica sin preguntar", async () => {
  const conv = [{ role: "user", content: P23 }];
  for (let i = 1; i <= 10; i++) conv.push({ role: "assistant", content: `¿P${i}?` }, { role: "user", content: "sí" });
  const items = [...P23_ITEMS, ...Array.from({ length: 10 }, (_, i) => ({ de: [`L${11 + i}`], tipo: "contexto", texto: `r${i}` }))];
  const model = fakeModel([complete(items)], ["¿P11?"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq([r.status, model.qcalls.length], ["COMPLETE", 0]);
});
await check("entrevista: pregunta repetida → no se repite, se clasifica", async () => {
  const conv = [
    { role: "user", content: P23 },
    { role: "assistant", content: `¿Columnas fijas? ${QUESTION_HINT}` },
    { role: "user", content: "sí" },
  ];
  const model = fakeModel([complete([...P23_ITEMS, { de: ["L11"], tipo: "contexto", texto: "Columnas fijas" }])], ["¿Columnas fijas?"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq(r.status, "COMPLETE");
});
await check("ajuste después de COMPLETE → no vuelve a entrevistar, reclasifica", async () => {
  const conv = [
    { role: "user", content: P23 },
    { role: "assistant", content: JSON.stringify({ status: "COMPLETE" }) },
    { role: "user", content: "sacá las etiquetas" },
  ];
  const model = fakeModel([complete([...P23_ITEMS.filter((i) => i.texto !== "Etiquetar tarjetas"), { de: ["L4", "L11"], tipo: "descartado", texto: "Etiquetar tarjetas" }])], ["¿Otra?"]);
  const r = await runIntentForge(conv, { callModel: model });
  eq([r.status, model.qcalls.length], ["COMPLETE", 0]);
  assert(!r.refined.features.includes("Etiquetar tarjetas"));
});
await check("sin ninguna feature → pregunta el harness", async () => {
  const r = await runIntentForge([{ role: "user", content: "Qué querés construir:\n- un kanban" }],
    { callModel: fakeModel([complete([{ de: ["L1"], tipo: "contexto", texto: "Kanban" }])]) });
  eq([r.status, r.question], ["ASKING", HARNESS_QUESTIONS.sin_feature]);
});
await check("plantilla vacía → pregunta el harness sin llamar al modelo", async () => {
  const model = fakeModel(["x"]);
  const r = await runIntentForge([{ role: "user", content: TEMPLATE_TEXT }], { callModel: model });
  eq([r.status, model.calls.length + model.qcalls.length], ["ASKING", 0]);
});
await check("clasificación: JSON ilegible o pregunta en vez de JSON → reintento", async () => {
  const model = fakeModel(['```json\n{"status":"COMPLETE","items":[\n```', "¿Querés algo más?", complete(P23_ITEMS)]);
  const r = await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  eq([r.status, model.calls.length], ["COMPLETE", 3]);
});

// ---- v0.3 (evidencia Project24) ----
const P24 = `Qué querés construir:
Webapp estilo Kanban/Trello

Qué tiene que hacer:
Crear, editar y borrar tarjetas de tareas y poder arrastrarlas entre columnas que definan el estado actual de la tarea

Cómo se tiene que ver:
Paleta de colores de estilo industrial, opaco. Con hovers en el movimiento drag & drop. Sistema de semaforo para el orden prioritario de las tareas. Etiquetas en tono grisaceo para diferenciarse del contenido de la tarjeta y su titulo.

Qué no debe hacer:
no debe persistirse en ninguna base de datos. El contenido cargado se perdera al actualizar la pestaña del navegador donde se encuentre la webapp.`;

await check("splitSentences: corta por oración, no adentro de paréntesis ni en números", () => {
  eq(splitSentences("Paleta opaca. Hovers en drag & drop. Semáforo (alta. media) de 1.5 niveles; etiquetas grises."),
    ["Paleta opaca", "Hovers en drag & drop", "Semáforo (alta. media) de 1.5 niveles", "etiquetas grises"]);
});
await check("P24 real: 8 líneas (la de estilo se parte en 4, la restricción en 2)", () => {
  const n = numberLines([{ role: "user", content: P24 }]);
  eq(n.lines.map((l) => l.field), ["construir", "hacer", "ver", "ver", "ver", "ver", "no", "no"]);
  eq(n.lines[4].text, "Sistema de semaforo para el orden prioritario de las tareas");
});
await check("actionVerbs: compuesta vs. simple (subordinada y auxiliares no cuentan)", () => {
  eq(actionVerbs("Crear, editar y borrar tarjetas de tareas y poder arrastrarlas entre columnas que definan el estado"), ["crear", "editar", "borrar", "arrastrar"]);
  eq(actionVerbs("Arrastrar tarjetas entre columnas para cambiar su estado"), ["arrastrar"]);
  eq(actionVerbs("Permitir crear tarjetas"), ["crear"]);
  eq(actionVerbs("Ver y editar el detalle"), ["ver", "editar"]);
  eq(actionVerbs("Mover tarjetas entre columnas (pendientes, en curso)"), ["mover"]);
});
await check("P24: la feature compuesta vuelve al modelo y se separa", async () => {
  const lines = numberLines([{ role: "user", content: P24 }]).lines;
  const base = [
    { de: ["L1"], tipo: "contexto", texto: "Webapp estilo Kanban/Trello" },
    { de: ["L3"], tipo: "estilo", texto: "Paleta industrial, opaca" },
    { de: ["L4"], tipo: "estilo", texto: "Hovers durante el drag & drop" },
    { de: ["L5"], tipo: "feature", texto: "Asignar prioridad a una tarjeta (semáforo)" },
    { de: ["L6"], tipo: "estilo", texto: "Etiquetas en tono grisáceo" },
    { de: ["L7", "L8"], tipo: "restriccion", texto: "Sin persistencia: se pierde al recargar" },
  ];
  const junta = [...base, { de: ["L2"], tipo: "feature", texto: lines[1].text }];
  const separada = [...base, ...["Crear tarjetas", "Editar tarjetas", "Borrar tarjetas", "Arrastrar tarjetas entre columnas de estado"].map((texto) => ({ de: ["L2"], tipo: "feature", texto }))];
  const model = fakeModel([complete(junta), complete(separada)]);
  const r = await runIntentForge([{ role: "user", content: P24 }], { callModel: model });
  eq(model.calls.length, 2);
  assert(model.calls[1].at(-1).content.includes("junta varias acciones (crear, editar, borrar, arrastrar)"), model.calls[1].at(-1).content);
  eq(r.refined.features.slice(0, 5), ["Crear tarjetas", "Editar tarjetas", "Borrar tarjetas", "Arrastrar tarjetas entre columnas de estado", "Asignar prioridad a una tarjeta (semáforo)"]);
  eq(r.compound, []);
});
await check("si sigue compuesta después de los reintentos, queda marcada", async () => {
  const lines = numberLines([{ role: "user", content: P24 }]).lines;
  const junta = lines.map((l) => ({ de: [l.id], tipo: l.field === "hacer" ? "feature" : "contexto", texto: l.text }));
  const r = await runIntentForge([{ role: "user", content: P24 }], { callModel: fakeModel([complete(junta)]) });
  eq(r.compound.length, 1);
  assert(r.refined.brief.items.find((i) => i.compuesta), "no marcó compuesta");
});
await check("entrevistador JSON: con faltantes pregunta; vacío = LISTO; texto plano tolerado", () => {
  eq(parseInterviewer('```json\n{"faltantes":["nombres de columnas"],"pregunta":"¿Qué columnas querés?"}\n```'), { done: false, pregunta: "¿Qué columnas querés?", faltantes: ["nombres de columnas"] });
  eq(parseInterviewer('{"faltantes":[],"pregunta":null}').done, true);
  eq(parseInterviewer('{"faltantes":["campos de una tarjeta"],"pregunta":""}').pregunta, "¿Me contás sobre esto: campos de una tarjeta?");
  eq(parseInterviewer("LISTO").done, true);
  eq(parseInterviewer("¿Hay comentarios?").pregunta, "¿Hay comentarios?");
});
await check("entrevistador: los faltantes quedan en la evidencia del turno", async () => {
  const r = await runIntentForge([{ role: "user", content: P24 }],
    { callModel: fakeModel([complete([])], ['{"faltantes":["nombres de columnas","campos de la tarjeta"],"pregunta":"¿Qué columnas querés?"}']) });
  eq([r.status, r.faltantes], ["ASKING", ["nombres de columnas", "campos de la tarjeta"]]);
  eq(r.attempts[0].faltantes, ["nombres de columnas", "campos de la tarjeta"]);
});

// ---- v0.4 (segunda corrida Project24) ----
await check("parser: JSON válido con '\"' suelto después de la última } (caso real P24)", () => {
  const raw = '```json\n{"status":"COMPLETE","project_name":"K","items":[\n{"de":["L1"],"tipo":"contexto","texto":"Kanban"}],\n"criterios_holdout":["a"]}"\n```';
  const p = parseModelOutput(raw);
  assert(p.complete && p.data.items.length === 1, JSON.stringify(p));
});
await check("JSON ilegible: el reintento le dice el error real", async () => {
  const model = fakeModel(['```json\n{"status":"COMPLETE","items":[{"de":["L1"]\n```', complete(P23_ITEMS)]);
  await runIntentForge([{ role: "user", content: P23 }], { callModel: model });
  assert(/no se pudo leer \(.+\)/.test(model.calls[1].at(-1).content), model.calls[1].at(-1).content);
});
await check("mismo tema con otras palabras → se detecta (preguntas reales P24)", () => {
  const lines = numberLines([{ role: "user", content: P24 }]).lines;
  const q1 = "¿Cómo se manejará la prioridad de las tareas en el sistema de semáforo?";
  assert(sameTopicAsked("¿Cómo se manejará la interacción con el sistema de semáforo?", [q1], lines), "no detectó el repetido");
  assert(!sameTopicAsked("¿Cómo se verán los estados en las columnas?", [q1], lines), "falso repetido");
  assert(!sameTopicAsked("¿Las tarjetas tienen comentarios?", [q1], lines), "falso repetido");
});
await check("tema repetido → el harness pregunta el siguiente faltante", async () => {
  const conv = [
    { role: "user", content: P24 },
    { role: "assistant", content: `¿Cómo se manejará la prioridad de las tareas en el sistema de semáforo? ${QUESTION_HINT}` },
    { role: "user", content: "verde baja, amarillo media, rojo alta" },
  ];
  const model = fakeModel([complete([])], ['{"faltantes":["la interacción con el semáforo","si las tarjetas tendrán comentarios"],"pregunta":"¿Cómo se manejará la interacción con el sistema de semáforo?"}']);
  const r = await runIntentForge(conv, { callModel: model });
  eq([r.status, r.by, r.question], ["ASKING", "harness_faltante", `¿Las tarjetas tendrán comentarios? ${QUESTION_HINT}`]);
  eq(r.attempts[0].kind, "faltante_siguiente");
});
await check("tema repetido y sin otro faltante → clasifica", async () => {
  const conv = [
    { role: "user", content: P24 },
    { role: "assistant", content: `¿Cómo se manejará la prioridad de las tareas en el sistema de semáforo? ${QUESTION_HINT}` },
    { role: "user", content: "verde baja" },
  ];
  const lines = numberLines(conv).lines;
  const items = lines.map((l) => ({ de: [l.id], tipo: l.field === "hacer" ? "feature" : "contexto", texto: `x ${l.id}` }));
  const model = fakeModel([complete(items)], ['{"faltantes":["la interacción con el semáforo"],"pregunta":"¿Cómo se manejará la interacción con el sistema de semáforo?"}']);
  const r = await runIntentForge(conv, { callModel: model });
  eq(r.status, "COMPLETE");
});
await check("questionFromGap y 'arrastrar y soltar' como una sola acción", () => {
  eq(questionFromGap("si las tarjetas tendrán comentarios"), "¿Las tarjetas tendrán comentarios?");
  eq(questionFromGap("qué campos tiene cada tarjeta"), "¿Qué campos tiene cada tarjeta?");
  eq(actionVerbs("Arrastrar y soltar tarjetas entre columnas"), ["arrastrar"]);
});

// ---- v0.5 del módulo (tercera corrida Project24) ----
const L10 = { id: "L10", field: "respuesta", text: "dentro del formulario de creacion/edicion, mediante una lista desplegable", pregunta: "¿Cómo se elegirá la prioridad al crear o editar una tarjeta?" };
await check("ítem inventado ('Sin login' citando L10) → inválido; con palabras de la pregunta → válido", () => {
  assert(!grounded("Sin login", [L10]), "aceptó Sin login");
  assert(grounded("Elegir la prioridad desde una lista desplegable", [L10]));
  assert(grounded("Sin búsqueda de tarjetas", [{ id: "L1", field: "respuesta", text: "no", pregunta: "¿Se pueden buscar tarjetas?" }]));
  assert(grounded("Lo que sea", [{ id: "L1", field: "respuesta", text: "sí" }]), "línea sin palabras de contenido no exige");
  eq(validateItems([{ de: ["L10"], tipo: "restriccion", texto: "Sin login" }], [L10]).invalid.length, 1);
});
await check("el reintento muestra el texto (y la pregunta) de cada línea sin ubicar", () => {
  const fb = repairFeedback({ uncovered: ["L10"] }, [L10]);
  assert(fb.includes('L10 (respuesta a "¿Cómo se elegirá la prioridad al crear o editar una tarjeta?"): "dentro del formulario'), fb);
  assert(fb.includes("agregalas a ese ítem"), fb);
});
await check("faltantes no preguntados viajan en el historial y se le recuerdan al entrevistador", async () => {
  const conv = [
    { role: "user", content: P24 },
    { role: "assistant", content: `¿Cómo se manejará la prioridad de las tareas? ${QUESTION_HINT}`, faltantes: ["cómo se manejará la prioridad", "cuántas columnas hay y qué estados representan"] },
    { role: "user", content: "verde baja, amarillo media, rojo alta" },
  ];
  const model = fakeModel([complete([])], ['{"faltantes":["cómo se usará el semáforo de prioridad"],"pregunta":"¿Cómo se manejará la prioridad de las tareas en el semáforo?"}']);
  const r = await runIntentForge(conv, { callModel: model });
  const prompt = model.qcalls[0][1].content;
  assert(prompt.includes("TODAVÍA NO PREGUNTASTE") && prompt.includes("cuántas columnas hay y qué estados representan"), prompt);
  assert(!prompt.split("TODAVÍA NO PREGUNTASTE")[1].includes("cómo se manejará la prioridad"), "recordó un tema ya preguntado");
  eq([r.by, r.question], ["harness_faltante", `¿Cuántas columnas hay y qué estados representan? ${QUESTION_HINT}`]);
});

// ---- v0.6 del módulo (cuarta corrida Project24, preguntas y textos reales) ----
const P24ans = (answers) => {
  const conv = [{ role: "user", content: P24 }];
  for (const [q, a] of answers) conv.push({ role: "assistant", content: q }, { role: "user", content: a });
  return numberLines(conv).lines;
};
await check("no se pregunta sobre lo que el usuario ya decidió en 'qué no debe hacer'", () => {
  const lines = P24ans([]);
  assert(touchesRestriction("¿Cómo se manejará la persistencia de los datos si no se utilizará ninguna base de datos?", lines));
  assert(!touchesRestriction("¿Las columnas tendrán un nombre específico y cuántas serán?", lines));
  assert(!touchesRestriction("¿Cómo se cargan y editan los datos de las tarjetas?", lines));
});
await check("pregunta repetida aunque las respuestas repitan la palabra (prioridad)", () => {
  const q1 = "¿Cómo se manejará la prioridad de las tareas en el sistema de semáforo?";
  const lines = P24ans([[q1, "mediante etiquetas -> baja:verde, media:amarilla, alta:roja"], ["¿Existirán comentarios en las tarjetas?", "Cada tarjeta tendra un titulo, una descripcion y una etiqueta de prioridad"]]);
  assert(sameTopicAsked("¿Cómo se manejará la prioridad de las tareas?", [q1, "¿Existirán comentarios en las tarjetas?"], lines));
});
await check("faltantes genéricos (el checklist copiado) se descartan", () => {
  assert(isGenericGap("nombres o cantidades que faltan") && isGenericGap("cómo se usa una feature pedida"));
  assert(!isGenericGap("cuántas columnas hay y qué estados representan"));
  eq(parseInterviewer('{"faltantes":["nombres o cantidades que faltan","nombres para las columnas"],"pregunta":"¿Qué nombres tienen las columnas?"}').faltantes, ["nombres para las columnas"]);
});
await check("pregunta contra una restricción → el harness pasa a otro faltante", async () => {
  const model = fakeModel([complete([])], ['{"faltantes":["cómo se manejará la persistencia sin base de datos","si existirán subtareas en las tarjetas"],"pregunta":"¿Cómo se manejará la persistencia de los datos si no se utilizará ninguna base de datos?"}']);
  const r = await runIntentForge([{ role: "user", content: P24 }], { callModel: model });
  eq([r.by, r.question, r.attempts[0].kind], ["harness_faltante", `¿Existirán subtareas en las tarjetas? ${QUESTION_HINT}`, "faltante_siguiente"]);
});
await check("feature-respuesta que repite otra → vuelve como detalle (textos reales)", () => {
  const lines = P24ans([["¿Cómo se cargan y editan los datos de las tarjetas?", "mediante un formulario de crear/editar tarjetas"], ["¿Cómo se manejará la interacción al borrar una tarjeta?", "mediante un boton de borrado inline en la tarjeta"]]);
  const items = [
    { de: ["L2"], tipo: "feature", texto: "Crear tarjetas de tareas" },
    { de: ["L2"], tipo: "feature", texto: "Editar tarjetas de tareas" },
    { de: ["L2"], tipo: "feature", texto: "Borrar tarjetas de tareas" },
    { de: ["L9"], tipo: "feature", texto: "Editar los datos de las tarjetas mediante un formulario (campos: título, descripción y prioridad)" },
    { de: ["L10"], tipo: "feature", texto: "Manejo de interacción al borrar una tarjeta mediante un botón inline en la tarjeta" },
  ];
  const d = detailDuplicates(items, lines).map((x) => `${x.item.de[0]}→${x.of.texto}`);
  eq(d, ["L9→Editar tarjetas de tareas", "L10→Borrar tarjetas de tareas"]);
  eq(detailDuplicates(items.slice(0, 3), lines), [], "crear/editar/borrar de la plantilla no son duplicados entre sí");
  assert(repairFeedback({ details: detailDuplicates(items, lines) }, lines).includes('sumá L9 a su "de"'));
});

// ---- v0.7 del módulo (hold-out Project25 "Boxworld", textos reales) ----
const P25 = `Qué querés construir:
Juego Boxworld en html autocontenido

Qué tiene que hacer:
el clasico boxworld, donde el jugador utiliza un avatar para acomodar cajas en posiciones fijadas en cada nivel. El juego necesita un boton 'reiniciar' en caso de que el jugador haga un mal movimiento, ademas otro boton 'proximo nivel' para generar mapas aleatoreamente.

Cómo se tiene que ver:
estilo family nes, 8bits.

Qué no debe hacer:
las cajas no pueden salir del diseño del mapa del nivel, las cajas no pueden superponerse entre ellas, las cajas no pueden superponerse con el avatar del jugador`;
await check("respuestas delegadas: 'no lo sé' y 'a criterio' sí; 'no' y respuestas normales no", () => {
  assert(isDelegated("no lo se") && isDelegated("lo dejo a criterio del specialist") && isDelegated("da igual"));
  assert(!isDelegated("no") && !isDelegated("si no se puede, prefiero que se diseñen al menos 3 niveles") && !isDelegated("no hay limite para la creacion de tarjetas"));
});
await check("P25: 'no lo sé' no puede terminar en una restricción (era 'No se genera aleatoriamente')", () => {
  const conv = [{ role: "user", content: P25 }, { role: "assistant", content: "¿Cómo se genera aleatoriamente el mapa y las cajas?" }, { role: "user", content: "no lo se. si no se puede, prefiero que se diseñen al menos 3 niveles" }];
  const lines = numberLines(conv).lines;
  const L = lines.filter((l) => l.field === "respuesta").map((l) => [l.id, !!l.delegada]);
  eq(L, [["L6", true], ["L7", false]]);
  const bad = validateItems([{ de: ["L6", "L7"], tipo: "restriccion", texto: "No se genera aleatoriamente el mapa y las cajas, sino que se diseñarán al menos 3 niveles" }], lines);
  eq(bad.invalid.length, 1);
  const ok2 = validateItems([{ de: ["L6"], tipo: "contexto", texto: "A criterio del equipo: cómo se genera el mapa aleatorio" }], lines);
  eq(ok2.invalid.length, 0);
  assert(formatLinesForModel({ lines }).includes('L6 [respuesta delegada a "¿Cómo se genera aleatoriamente el mapa y las cajas?"] no lo se'));
});
await check("dos respuestas delegadas seguidas cortan la entrevista (sin llamar al entrevistador)", async () => {
  const conv = [{ role: "user", content: P25 },
    { role: "assistant", content: "¿Qué tan grande será cada nivel?" }, { role: "user", content: "el tamaño del mapa lo dejo a criterio del specialist" },
    { role: "assistant", content: "¿Qué tan grandes serán los botones?" }, { role: "user", content: "lo dejo a criterio del specialist" }];
  const lines = numberLines(conv).lines;
  const items = lines.map((l) => ({ de: [l.id], tipo: l.field === "hacer" ? "feature" : "contexto", texto: l.text }));
  const model = fakeModel([complete(items)], ['{"faltantes":["algo"],"pregunta":"¿Otra?"}']);
  const r = await runIntentForge(conv, { callModel: model });
  eq([r.status, model.qcalls.length], ["COMPLETE", 0]);
});

// ---- v0.8 del módulo (2ª corrida del hold-out P25: repetidas que puso el harness) ----
await check("el harness no repite: 'nivel o dificultad' y 'habilidades del avatar' (casos reales)", () => {
  const lines = numberLines([{ role: "user", content: P25 }]).lines;
  const asked = ["¿El juego incluirá diferentes niveles o dificultades con mapas generados aleatoriamente?", "¿Cuáles son las habilidades del avatar en cada nivel?"];
  assert(sharesTopicWithAsked("¿Hay algún tipo de nivel o dificultad?", asked, lines));
  assert(sharesTopicWithAsked("¿Qué habilidades tendrá el avatar?", asked, lines));
  assert(!sharesTopicWithAsked("¿El juego incluirá algún tipo de tutorial o instrucciones?", asked, lines));
});
await check("pendientes solo del turno anterior", () => {
  const n = numberLines([
    { role: "user", content: P25 },
    { role: "assistant", content: "¿P1?", faltantes: ["viejo faltante"] },
    { role: "user", content: "x" },
    { role: "assistant", content: "¿P2?", faltantes: ["faltante nuevo"] },
    { role: "user", content: "y" },
  ]);
  eq(n.faltantesPrevios, ["faltante nuevo"]);
});
await check("preguntas de implementación se descartan ('¿Cómo se generan los mapas…?')", async () => {
  assert(isImplementationQuestion("¿Cómo se generan los mapas aleatorios en cada nivel?"));
  assert(!isImplementationQuestion("¿Cómo se elige una prioridad al crear la tarjeta?"));
  const model = fakeModel([complete([])], ['{"faltantes":["cómo se generan los mapas","si hay contador de movimientos"],"pregunta":"¿Cómo se generan los mapas aleatoriamente?"}']);
  const r = await runIntentForge([{ role: "user", content: P25 }], { callModel: model });
  eq([r.by, r.question, r.attempts[0].kind], ["harness_faltante", `¿Hay contador de movimientos? ${QUESTION_HINT}`, "faltante_siguiente"]);
});

// ---- v0.9 del módulo (Project25 por la UI) ----
await check("una feature no puede juntar dos líneas de 'qué tiene que hacer' (caso real P25)", () => {
  const lines = numberLines([{ role: "user", content: P25 }]).lines;
  const v = validateItems([{ de: ["L2", "L3"], tipo: "feature", texto: "El jugador utiliza un avatar para acomodar cajas en posiciones fijadas en cada nivel, incluyendo botones 'reiniciar' y 'proximo nivel'" }], lines);
  eq(v.invalid.length, 1);
  assert(v.invalid[0].reason.includes("L2 y L3"), v.invalid[0].reason);
  eq(validateItems([{ de: ["L3"], tipo: "feature", texto: "Botón 'reiniciar' para volver a empezar el nivel" }], lines).invalid.length, 0);
});

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
