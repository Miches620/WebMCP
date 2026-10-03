// test_intent_brief.mjs — determinista, sin LLM (el modelo se simula).
//   node test_intent_brief.mjs
import {
  parseBrief, numberLines, validateItems, fillUncovered, buildRefined,
  buildTechLeaderInput, parseModelOutput, runIntentForge, formatLinesForModel,
  TEMPLATE_TEXT, TEMPLATE_EXAMPLE, HARNESS_QUESTIONS, QUESTION_SYSTEM, QUESTION_HINT,
  isControlReply,
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
- Una webapp estilo Kanban o Trello. Sencilla
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
const fakeModel = (classify, questions = ["LISTO"]) => {
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

console.log(`\n${ok}/${ok + fail} tests OK`);
if (fail) process.exit(1);
