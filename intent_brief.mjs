// intent_brief.mjs — Intent Forge v0.3: plantilla fija + clasificación acotada.
//
// Reemplaza al chequeo "mencionaste y no incluí" (intent_mention_check.mjs).
// Evidencia del cambio (Project23, 03/10): de 13 avisos por palabras sueltas,
// 3 eran pérdidas reales y 10 ruido; "Excluir" convirtió palabras sueltas en
// órdenes negativas para TechLeader ("NO planificar: frontend") y el drag &
// drop pedido terminó diferido.
//
// Idea (decisión de Miche): el usuario arranca con una plantilla de 4 campos;
// Qwen NO resume: clasifica cada línea que escribió el usuario en ítems
// (contexto / feature / estilo / restriccion). El harness numera las líneas
// (L1, L2...) y exige que cada una termine en al menos un ítem — misma
// lección que el reviewer v0.6-bounded: lista abierta pierde cosas, veredicto
// por elemento enumerado no. Si después de los reintentos queda una línea
// sin destino, el harness la agrega él mismo (marcada auto) y la UI la
// resalta: nada de lo que escribió el usuario se pierde en silencio.
//
// Módulo puro (sin fs ni fetch): lo usan server.mjs y script.js (navegador).

export const BRIEF_VERSION = "intent_brief v0.7";

// v0.7 (05/10, hold-out Project25 "Boxworld"): el usuario contestó "no lo
// sé" a "¿cómo se genera aleatoriamente el mapa?" y el clasificador lo leyó
// como un NO → restricción "No se genera aleatoriamente", que contradice la
// feature "generación aleatoria si es posible". Además el entrevistador
// preguntó cómo implementar algo y gastó las últimas preguntas en detalles
// que el usuario dejó "a criterio". Cambios: una respuesta delegada ("no lo
// sé", "a criterio", "da igual") se marca y va como contexto, nunca como
// restricción; dos respuestas delegadas seguidas cortan la entrevista; el
// entrevistador no pregunta cómo se implementa algo.

// v0.6 (04/10, cuarta corrida de Project24): el entrevistador preguntó cómo
// persistir datos cuando el usuario ya había dicho "sin base de datos" (y la
// respuesta "localStorage" contradijo "se pierde al recargar"); repitió la
// prioridad porque las respuestas volvían "común" la palabra; convirtió un
// ítem del checklist ("nombres o cantidades que faltan") en pregunta; y las
// respuestas que detallaban crear/editar/borrar quedaron como features
// duplicadas. Cambios: no se pregunta sobre lo que tocan las líneas de "qué no
// debe hacer"; las palabras comunes salen solo de la plantilla; se descartan
// faltantes genéricos; una feature-respuesta que repite otra vuelve al modelo
// como detalle de esa.

// v0.5 (04/10, tercera corrida de Project24): el modelo no supo dónde poner
// L10 ("lista desplegable") y, tras 2 reintentos, la "cubrió" con un ítem
// inventado ("Sin login"). Además nunca preguntó por las columnas aunque lo
// había detectado como faltante. Cambios: (a) un ítem tiene que compartir al
// menos una palabra con las líneas que cita (o con la pregunta, si es una
// respuesta): si no, es inválido; (b) el reintento muestra el texto de cada
// línea sin ubicar; (c) los faltantes de cada turno viajan en el historial y
// los no preguntados se le recuerdan al entrevistador.

// v0.4 (03/10, segunda corrida de Project24 por consola): la clasificación
// salió bien (crear/editar/borrar/arrastrar separados) pero el JSON traía un
// '"' suelto después de la última '}' y el parser lo descartó 3 veces → todo
// por la red del harness. Además 4 de 5 preguntas fueron sobre el semáforo
// con otras palabras, y las respuestas quedaron como ítems sueltos.
// Cambios: parser recorta al último '}' y el reintento dice el error real;
// el harness detecta preguntas del mismo tema y pasa al siguiente faltante;
// una respuesta que detalla una feature se escribe dentro de esa feature.

// v0.3 (03/10, evidencia Project24): Qwen copió cada línea entera como un
// solo ítem (2 features en vez de ~8) y el entrevistador dijo LISTO de
// entrada. Cambios: (a) el harness corta cada línea por oración antes de
// numerar; (b) una feature que junta varias acciones vuelve al modelo para
// separarla (mismo reintento de cobertura); (c) el entrevistador primero
// lista lo que falta (JSON) y recién después pregunta: decir "LISTO" ya no
// es la salida más corta.

// v0.2 (03/10, pedido de Miche): entrevista de completitud. Después de la
// plantilla, Qwen puede hacer hasta 10 preguntas (no obligatorias) sobre lo
// que una app así suele necesitar y el usuario no mencionó; dice LISTO cuando
// alcanza. Preguntar de más cuesta un "no" (que queda como restricción y
// evita que TechLeader o el Specialist lo inventen); no preguntar deja huecos
// en silencio. La clasificación pasa a ser una llamada aparte, al final.
export const MAX_QUESTIONS = 10;

// Campos de la plantilla. `tipo` = pista del tipo de ítem que suele salir de
// ese campo (Qwen puede moverlo si la línea claramente es de otro tipo).
export const FIELDS = {
  construir: { label: "Qué querés construir", tipo: "contexto" },
  hacer: { label: "Qué tiene que hacer", tipo: "feature" },
  ver: { label: "Cómo se tiene que ver", tipo: "estilo" },
  no: { label: "Qué no debe hacer", tipo: "restriccion" },
};
const OTHER_FIELDS = {
  libre: "sin campo",
  respuesta: "respuesta",
  ajuste: "ajuste",
};
export const fieldLabel = (f) => FIELDS[f]?.label.toLowerCase() || OTHER_FIELDS[f] || f;

export const TIPOS = ["contexto", "feature", "estilo", "restriccion", "descartado"];
const TIPO_ALIAS = {
  contexto: "contexto", context: "contexto",
  feature: "feature", features: "feature", funcionalidad: "feature",
  estilo: "estilo", style: "estilo", diseno: "estilo",
  restriccion: "restriccion", restricciones: "restriccion", restriction: "restriccion", limite: "restriccion",
  descartado: "descartado", descartar: "descartado",
};

// Texto que aparece precargado en el input al empezar un proyecto.
export const TEMPLATE_TEXT = `Qué querés construir:
-

Qué tiene que hacer:
-

Cómo se tiene que ver:
-

Qué no debe hacer:
- `;

// Ejemplo que se muestra en el chat (otro dominio, para no sesgar).
export const TEMPLATE_EXAMPLE = `Qué querés construir:
- Una app para guardar mis recetas, simple

Qué tiene que hacer:
- Cargar recetas con ingredientes y pasos
- Buscar recetas por ingrediente
- Marcar recetas como favoritas

Cómo se tiene que ver:
- Colores cálidos, fotos grandes

Qué no debe hacer:
- Sin usuarios ni login`;

export function norm(t) {
  return String(t ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s*/;
const stripBullet = (s) => String(s).replace(BULLET, "").trim();

// Corta por oración (. ; ! ?) seguidos de espacio, sin cortar dentro de
// paréntesis ni números ("1.5"). La plantilla pide una idea por línea, pero
// la gente escribe párrafos (Project24: 4 ideas en una línea).
export function splitSentences(text) {
  const out = [];
  let depth = 0, cur = "";
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    cur += ch;
    if (depth === 0 && /[.;!?]/.test(ch) && /\s/.test(s[i + 1] || "") ) {
      out.push(cur);
      cur = "";
    }
  }
  out.push(cur);
  return out.map((x) => x.trim().replace(/[.;]+$/, "").trim()).filter(Boolean);
}

// Reconoce el encabezado de un campo. Tolera "¿", acentos, mayúsculas, el
// "qué" omitido y contenido en la misma línea después de los dos puntos.
function headerOf(rawLine) {
  const line = norm(rawLine).replace(/^[#*¿\s]+/, "");
  const colon = line.indexOf(":");
  const head = (colon >= 0 && colon <= 45 ? line.slice(0, colon) : line).replace(/[?¿*]/g, "").trim();
  let field = null;
  if (/^(que )?no (debe|tiene que|tendria que|deberia) (hacer|tener)\b/.test(head) || /^(restricciones?|fuera de alcance)$/.test(head)) field = "no";
  else if (/^(que )?(tiene|debe) (que )?(poder )?hacer\b/.test(head) || /^(features?|funcionalidades?)$/.test(head)) field = "hacer";
  else if (/^(como )?se (tiene que|debe|deberia) ver\b/.test(head) || /^(diseno|estilo|aspecto)$/.test(head)) field = "ver";
  else if (/^(que )?(queres|quieres|quiero|vas a|vamos a)? ?construir\b/.test(head) || /^(proyecto|objetivo|idea)$/.test(head)) field = "construir";
  if (!field) return null;
  const rest = colon >= 0 ? stripBullet(String(rawLine).slice(String(rawLine).indexOf(":") + 1)) : "";
  return { field, rest };
}

/**
 * Parte el primer mensaje del usuario según la plantilla.
 * @returns {{hasTemplate:boolean, lines:{field:string,text:string}[], empty:string[]}}
 */
export function parseBrief(text) {
  let field = "libre";
  let hasTemplate = false;
  const lines = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const h = headerOf(raw);
    if (h) {
      hasTemplate = true;
      field = h.field;
      for (const t of splitSentences(h.rest)) lines.push({ field, text: t });
      continue;
    }
    for (const t of splitSentences(stripBullet(raw))) lines.push({ field, text: t });
  }
  const empty = hasTemplate ? Object.keys(FIELDS).filter((f) => !lines.some((l) => l.field === f)) : [];
  return { hasTemplate, lines, empty };
}

export const isCompleteMessage = (content) => /"status"\s*:\s*"COMPLETE"/.test(String(content || ""));

// Respuesta que corta la entrevista ("listo", "nada más"): no es una línea.
// Ojo: "no" NO es control, es una respuesta (queda como restricción).
const CONTROL = /^(listo|ya esta|nada mas|eso es todo|segui|seguir|basta|termina|terminar|ninguna|ninguno|no,? nada mas|no tengo mas)[.! ]*$/;
export const isControlReply = (t) => CONTROL.test(norm(t));

// Respuesta que delega la decisión: no es un sí ni un no.
const DELEGATED = /(^(no (lo )?se|ni idea|no estoy seguro|da igual|me da igual|como (quieras|prefieras|te parezca)|lo que (sea|quieras)|indistinto)\b)|a criterio|lo decid(e|a|is)|decidilo/;
export const isDelegated = (t) => DELEGATED.test(norm(t));

/**
 * Numera TODAS las líneas que escribió el usuario en la conversación.
 * El primer mensaje se parte con la plantilla; los siguientes son
 * "respuesta" (si lo anterior fue una pregunta) o "ajuste" (si lo anterior
 * fue un COMPLETE y el usuario tocó Ajustar).
 */
export function numberLines(conversation = []) {
  const lines = [];
  const preguntas = [];
  const faltantesPrevios = [];
  let last = null;
  let first = true;
  let parsedFirst = null;
  let skip = false; // el usuario cortó la entrevista con "listo"
  let delegatedRun = 0;
  for (const m of conversation) {
    if (m.role !== "user") {
      last = m.content;
      if (!isCompleteMessage(m.content) && String(m.content || "").trim()) preguntas.push(String(m.content).replace(QUESTION_HINT, "").trim());
      for (const f of Array.isArray(m.faltantes) ? m.faltantes : []) if (!faltantesPrevios.includes(f)) faltantesPrevios.push(f);
      continue;
    }
    if (m.auto) continue;
    if (first) {
      first = false;
      parsedFirst = parseBrief(m.content);
      for (const l of parsedFirst.lines) lines.push({ id: `L${lines.length + 1}`, ...l });
      continue;
    }
    if (isControlReply(m.content)) { skip = true; continue; }
    // Dos respuestas seguidas que delegan ("no lo sé", "a criterio") cortan
    // la entrevista: el usuario ya no tiene más para decidir.
    const firstSentence = splitSentences(stripBullet(String(m.content || "").split(/\r?\n/).find((x) => x.trim()) || ""))[0] || "";
    delegatedRun = isDelegated(firstSentence) ? delegatedRun + 1 : 0;
    const field = last && isCompleteMessage(last) ? "ajuste" : "respuesta";
    const pregunta = field === "respuesta" && last ? String(last).replace(QUESTION_HINT, "").trim().slice(0, 200) : undefined;
    for (const raw of String(m.content || "").split(/\r?\n/)) {
      for (const t of splitSentences(stripBullet(raw)))
        lines.push({ id: `L${lines.length + 1}`, field, text: t, ...(pregunta ? { pregunta } : {}), ...(field === "respuesta" && isDelegated(t) ? { delegada: true } : {}) });
    }
  }
  const lastMsg = conversation.at(-1);
  const afterComplete = conversation.some((m) => m.role !== "user" && isCompleteMessage(m.content));
  return {
    lines, preguntas, faltantesPrevios, skip, afterComplete, delegatedRun,
    lastIsAnswer: lastMsg?.role === "user" && !isControlReply(lastMsg.content),
    hasTemplate: !!parsedFirst?.hasTemplate, empty: parsedFirst?.empty || [],
  };
}

const lineTag = (l) =>
  l.field === "respuesta" && l.pregunta ? `respuesta${l.delegada ? " delegada" : ""} a "${l.pregunta}"` : fieldLabel(l.field);

export const INTENT_SYSTEM = `Sos Intent Forge v0.3 del equipo MicheLab.

Recibís las LÍNEAS que escribió el usuario, numeradas (L1, L2...). Entre corchetes va el campo de la plantilla donde la escribió.
Tu trabajo es CLASIFICAR cada línea, NO resumir.

TIPOS:
- contexto: qué es el proyecto, para quién, referencias ("estilo Trello"), adjetivos generales ("sencilla").
- feature: algo que el usuario tiene que poder HACER en la app.
- estilo: cómo se tiene que VER o sentir (colores, sombras, animaciones, efectos al pasar el mouse).
- restriccion: un límite o algo que NO debe hacer ("sin login", "sin base de datos", "solo frontend", "los datos se borran al recargar").
- descartado: SOLO si una línea [ajuste] pide sacar algo; en "de" van la línea que se saca y la línea [ajuste].

REGLAS:
1. Cada línea L tiene que aparecer en "de" de al menos un ítem. Ninguna se pierde.
2. Si una línea nombra varias cosas, separalas: un ítem por cosa.
3. Usá las palabras del usuario. No resumas ni generalices. Nombres, cantidades y listas (por ejemplo entre paréntesis) van dentro del texto del ítem.
4. No agregues ítems que no salgan de una línea.
5. El campo entre corchetes es una pista. Cambiá el tipo solo si la línea claramente es de otro tipo (por ejemplo "drag & drop" escrito en [cómo se tiene que ver] es una feature).
   Si algo necesita un dato o una acción del usuario (prioridad, estado, etiquetas, fechas), es feature aunque esté en [cómo se tiene que ver]: "semáforo de prioridad" → feature "Asignar prioridad a una tarjeta (semáforo)".
   Una feature = UNA acción. "Crear, editar y borrar tarjetas" son tres ítems: "Crear tarjetas", "Editar tarjetas", "Borrar tarjetas".
6. Las líneas [respuesta] y [ajuste] valen igual que las demás. Un [ajuste] corrige lo anterior.
7. Una [respuesta] se lee junto con su pregunta. Si la respuesta es afirmativa, el ítem dice lo que se pidió (por ejemplo "¿Se pueden crear columnas?" + "sí" → feature "Crear columnas"). Si es negativa, es una restriccion con "Sin ..." (por ejemplo "¿Buscar tarjetas?" + "no" → restriccion "Sin búsqueda de tarjetas").
   Una [respuesta delegada] ("no lo sé", "lo dejo a criterio", "da igual") NO es un no: va como contexto "A criterio del equipo: <tema de la pregunta>", con el resto de lo que haya dicho.
   Si la respuesta DETALLA algo que ya está en otra línea, NO hagas un ítem suelto: escribí el detalle dentro de ese ítem y poné las dos líneas en "de". Por ejemplo L5 "semáforo de prioridad" + L9 respuesta "verde baja, amarillo media, rojo alta" + L10 respuesta "se elige en una lista al crear la tarjeta" → {"de":["L5","L9","L10"],"tipo":"feature","texto":"Asignar prioridad al crear la tarjeta, desde una lista (semáforo: verde baja, amarillo media, rojo alta)"}.
8. No hagas preguntas: devolvé siempre el JSON.

SALIDA: EXCLUSIVAMENTE este JSON:
\`\`\`json
{"status":"COMPLETE","project_name":"...","items":[{"de":["L1"],"tipo":"contexto","texto":"..."}],"criterios_holdout":["cómo se verifica cada feature"]}
\`\`\`

EJEMPLO (otro proyecto):
L1 [qué querés construir] Una app para guardar mis recetas, simple
L2 [qué tiene que hacer] cargar recetas con ingredientes y pasos
L3 [cómo se tiene que ver] colores cálidos, fotos grandes, que se puedan marcar favoritas
L4 [qué no debe hacer] sin usuarios ni login
\`\`\`json
{"status":"COMPLETE","project_name":"Recetario","items":[
{"de":["L1"],"tipo":"contexto","texto":"App simple para guardar mis recetas"},
{"de":["L2"],"tipo":"feature","texto":"Cargar recetas con ingredientes y pasos"},
{"de":["L3"],"tipo":"estilo","texto":"Colores cálidos"},
{"de":["L3"],"tipo":"estilo","texto":"Fotos grandes"},
{"de":["L3"],"tipo":"feature","texto":"Marcar recetas como favoritas"},
{"de":["L4"],"tipo":"restriccion","texto":"Sin usuarios ni login"}],
"criterios_holdout":["Se puede cargar una receta con ingredientes y pasos","Se puede marcar una receta como favorita"]}
\`\`\``;

export const QUESTION_SYSTEM = `Sos el entrevistador de Intent Forge (equipo MicheLab).

Leés lo que el usuario escribió sobre la app que quiere y buscás lo que le FALTA decir para poder construirla.
Casi ninguna plantilla está completa la primera vez. Revisá, en este orden:
1. Líneas vagas que no se puedan construir tal cual ("que sea completa", "con estados").
2. Nombres o cantidades que faltan (¿qué columnas?, ¿qué categorías?, ¿cuántos niveles?).
3. Qué datos tiene cada cosa (¿qué campos tiene una tarjeta, un producto, un contacto?).
4. Cómo se usa una feature pedida (¿cómo se elige una prioridad?, ¿qué pasa al borrar?).
5. Algo que una app de este tipo suele tener y el usuario no mencionó (buscar, filtrar, ordenar, comentarios).

REGLAS:
- Nunca preguntes algo que ya está en las líneas ni algo que ya preguntaste.
- Un TEMA ya preguntado no se vuelve a preguntar, aunque sea con otras palabras (si ya preguntaste por la prioridad, pasá a otro tema).
- Nunca preguntes algo que contradiga lo que el usuario dijo que NO quiere.
- No preguntes por tecnología, lenguajes ni frameworks, ni CÓMO se implementa algo (algoritmos, cómo se genera, cómo se calcula): eso lo decide el equipo.
- No preguntes por detalles chicos que el equipo puede decidir solo (tamaños de botones, márgenes, colores exactos).
- La pregunta es UNA, corta y cerrada (sí/no, o elegir con ejemplos).

SALIDA: EXCLUSIVAMENTE este JSON:
\`\`\`json
{"faltantes":["hasta 3 cosas que faltan, de la más importante a la menos"],"pregunta":"la pregunta sobre la primera"}
\`\`\`
Si de verdad no falta nada: {"faltantes":[],"pregunta":null}

EJEMPLO (otro proyecto):
- [qué tiene que hacer] cargar recetas con ingredientes
- [cómo se tiene que ver] colores cálidos
\`\`\`json
{"faltantes":["si las recetas llevan pasos además de ingredientes","si se pueden buscar recetas","si tienen foto"],"pregunta":"¿Las recetas llevan pasos de preparación además de los ingredientes?"}
\`\`\``;

export function formatForQuestion({ lines, preguntas = [], pendientes = [] }) {
  const out = ["LO QUE ESCRIBIÓ EL USUARIO:"];
  for (const l of lines) {
    const tag = lineTag(l);
    out.push(`- [${tag}] ${l.text}`);
  }
  if (preguntas.length) {
    out.push("", `PREGUNTAS QUE YA HICISTE (${preguntas.length}/${MAX_QUESTIONS}, no las repitas):`);
    preguntas.forEach((p) => out.push(`- ${p}`));
  }
  if (pendientes.length) {
    out.push("", "COSAS QUE DETECTASTE ANTES Y TODAVÍA NO PREGUNTASTE (si siguen faltando, preguntá por una de estas antes que volver a un tema ya preguntado):");
    pendientes.forEach((p) => out.push(`- ${p}`));
  }
  out.push("", "¿Qué falta? Respondé con el JSON.");
  return out.join("\n");
}

// ¿Esta pregunta repite el tema de una ya hecha? Compara palabras de
// contenido (raíz de 5 letras), sin contar las que se repiten en 2+ líneas
// del usuario (tarjeta, tarea: aparecen en todas las preguntas).
const Q_STOP = new Set("como cual cuales cuando donde para porque sera seran puede pueden tiene tienen debe deben esta estan hace hacer usar habra cada tipo tipos algun alguna sobre entre desde solo".split(" "));
function topicWords(t, common) {
  return new Set(
    (norm(t).match(/[a-z0-9]{4,}/g) || []).filter((w) => !Q_STOP.has(w)).map((w) => w.slice(0, 5)).filter((w) => !common.has(w)),
  );
}
// Palabras que aparecen en 2+ líneas de la PLANTILLA (no en las respuestas:
// Project24 volvió "común" a "prioridad" por las respuestas y dejó pasar una
// pregunta repetida).
function commonWords(lines) {
  const freq = new Map();
  for (const l of lines) {
    if (l.field === "respuesta" || l.field === "ajuste") continue;
    for (const w of new Set((norm(l.text).match(/[a-z0-9]{4,}/g) || []).map((x) => x.slice(0, 5)))) freq.set(w, (freq.get(w) || 0) + 1);
  }
  return new Set([...freq].filter(([, n]) => n >= 2).map(([w]) => w));
}
// ¿La pregunta toca algo que el usuario ya decidió en "qué no debe hacer"?
// Project24: "¿Cómo se manejará la persistencia si no se usa base de datos?"
export function touchesRestriction(q, lines = []) {
  if (!q) return false;
  const common = commonWords(lines);
  const a = topicWords(q, common);
  return lines.some((l) => l.field === "no" && [...topicWords(l.text, common)].filter((w) => a.has(w)).length >= 2);
}
export function sameTopicAsked(q, preguntas = [], lines = []) {
  if (!q) return false;
  const freq = new Map();
  const common = commonWords(lines);
  const a = topicWords(q, common);
  return preguntas.some((p) => {
    if (norm(p) === norm(q)) return true;
    const b = topicWords(p, common);
    const shared = [...a].filter((w) => b.has(w)).length;
    const min = Math.min(a.size, b.size);
    return min >= 2 && shared / min >= 0.6;
  });
}
// "si las tarjetas tienen comentarios" → "¿Las tarjetas tienen comentarios?"
export function questionFromGap(f) {
  let t = String(f || "").trim().replace(/[?¿.]+$/g, "").replace(/^¿/, "");
  if (!t) return "";
  if (/^si\s+/i.test(t)) t = t.replace(/^si\s+/i, "");
  else if (!/^(que|qué|como|cómo|cuant|cuánt|cual|cuál|donde|dónde|quien|quién)/i.test(t)) return `¿Me contás sobre esto: ${t}?`;
  return `¿${t[0].toUpperCase()}${t.slice(1)}?`;
}

export const isDone = (t) => /^\W*listo\W*$/i.test(String(t || "").trim()) || /^\W*LISTO\b/.test(String(t || "").trim());

// Lee la salida del entrevistador: JSON {faltantes, pregunta}, o (tolerancia)
// texto plano con una pregunta o LISTO.
// Faltantes que son el checklist copiado, no algo del proyecto
// (Project24: "nombres o cantidades que faltan" terminó como pregunta).
const GENERIC_GAP = /(que faltan|feature pedida|suele tener|no menciono|lineas vagas|datos tiene cada cosa|como se usa una feature|hasta 3 cosas)/;
export const isGenericGap = (f) => GENERIC_GAP.test(norm(f));

export function parseInterviewer(raw) {
  const text = String(raw || "");
  const src = jsonSlice(text);
  if (src) {
    try {
      const d = JSON.parse(src.replace(/,\s*([}\]])/g, "$1"));
      const faltantes = (Array.isArray(d.faltantes) ? d.faltantes : []).map(String).map((x) => x.trim()).filter((x) => x && !isGenericGap(x));
      let pregunta = typeof d.pregunta === "string" ? d.pregunta.trim() : "";
      if (!pregunta && faltantes.length) pregunta = `¿Me contás sobre esto: ${faltantes[0]}?`;
      return { done: !pregunta, pregunta, faltantes };
    } catch { /* cae al texto plano */ }
  }
  const q = text.trim().split(/\r?\n/).find((l) => l.trim())?.trim() || "";
  if (!q || isDone(q) || q.includes("{")) return { done: true, pregunta: "", faltantes: [] };
  return { done: false, pregunta: q, faltantes: [] };
}

export function formatLinesForModel({ lines, preguntas = [] }, { forceComplete = false } = {}) {
  const out = ["LÍNEAS DEL USUARIO:"];
  for (const l of lines) {
    const tag = lineTag(l);
    out.push(`${l.id} [${tag}] ${l.text}`);
  }
  if (preguntas.length) {
    out.push("", "PREGUNTAS QUE YA HICISTE (no las repitas):");
    preguntas.forEach((p) => out.push(`- ${p}`));
  }
  if (forceComplete) out.push("", "Ya no podés preguntar más: devolvé el JSON COMPLETE con lo que hay.");
  return out.join("\n");
}

// JSON tolerante: bloque ```json, o el primer {...} del texto; saca
// comentarios // y comas colgantes.
// Recorta del primer '{' al último '}': Project24 trajo '}"' + fence y el
// JSON era válido salvo por esa comilla.
function jsonSlice(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fence ? fence[1] : text;
  const a = src.indexOf("{"), b = src.lastIndexOf("}");
  return a >= 0 && b > a ? src.slice(a, b + 1) : null;
}

export function parseModelOutput(content) {
  const text = String(content || "");
  const src = jsonSlice(text);
  if (src) {
    const clean = src.replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1");
    try {
      const data = JSON.parse(clean);
      if (data && (data.status === "COMPLETE" || Array.isArray(data.items))) return { complete: true, data };
    } catch (e) {
      if (/COMPLETE|"items"/.test(text)) return { complete: false, parseError: true, error: e.message };
    }
  }
  if (/COMPLETE/.test(text)) return { complete: false, parseError: true };
  const question = text.trim().split(/\r?\n/).find((l) => l.trim())?.trim() || "";
  return { complete: false, question };
}

const asIds = (de) =>
  (Array.isArray(de) ? de : String(de ?? "").split(/[\s,;]+/))
    .map((x) => String(x).trim().toUpperCase())
    .filter(Boolean)
    .map((x) => (/^\d+$/.test(x) ? `L${x}` : x));

/**
 * Valida los ítems del modelo contra las líneas numeradas.
 * @returns {{items:object[], invalid:{item:object,reason:string}[], uncovered:string[]}}
 */
// El texto de un ítem tiene que compartir al menos una palabra de contenido
// (raíz de 5 letras) con las líneas que cita; para una respuesta cuenta
// también su pregunta ("no" + "¿Buscar tarjetas?" → "Sin búsqueda de
// tarjetas"). Si las líneas no tienen palabras de contenido, no se exige.
// Project24: "Sin login" citando L10 ("…mediante una lista desplegable").
const stems = (t) => new Set((norm(t).match(/[a-z0-9ñ]{4,}/g) || []).map((w) => w.slice(0, 5)));
export function grounded(texto, srcLines) {
  const src = new Set();
  for (const l of srcLines) for (const w of stems(`${l.text} ${l.pregunta || ""}`)) src.add(w);
  if (!src.size) return true;
  return [...stems(texto)].some((w) => src.has(w));
}

export function validateItems(rawItems, lines) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const items = [];
  const invalid = [];
  for (const it of Array.isArray(rawItems) ? rawItems : []) {
    const tipo = TIPO_ALIAS[norm(it?.tipo).replace(/\s/g, "")];
    const texto = String(it?.texto ?? it?.text ?? "").trim();
    const ids = asIds(it?.de ?? it?.from);
    const de = ids.filter((id) => byId.has(id));
    if (!tipo) { invalid.push({ item: it, reason: `tipo inválido "${it?.tipo}"` }); continue; }
    if (!texto) { invalid.push({ item: it, reason: "texto vacío" }); continue; }
    if (!de.length) { invalid.push({ item: it, reason: `"de" no cita ninguna línea existente (${ids.join(", ") || "vacío"})` }); continue; }
    if (tipo === "descartado" && !de.some((id) => byId.get(id).field === "ajuste")) {
      invalid.push({ item: it, reason: "descartado sin una línea [ajuste] que lo pida" });
      continue;
    }
    if (tipo === "restriccion" && de.some((id) => byId.get(id).delegada)) {
      invalid.push({ item: it, reason: `${de.filter((id) => byId.get(id).delegada).join(", ")} delega la decisión ("no lo sé", "a criterio"): no es una restricción, va como contexto "A criterio del equipo: ..."` });
      continue;
    }
    if (!grounded(texto, de.map((id) => byId.get(id)))) {
      invalid.push({ item: it, reason: `el texto no sale de ${de.join(", ")}: no comparte ninguna palabra con esa(s) línea(s)` });
      continue;
    }
    items.push({ de, tipo, texto });
  }
  const covered = new Set(items.flatMap((i) => i.de));
  const uncovered = lines.map((l) => l.id).filter((id) => !covered.has(id));
  return { items, invalid, uncovered };
}

// Feature que junta varias acciones ("Crear, editar y borrar tarjetas y
// arrastrarlas"): cuenta infinitivos distintos (con pronombre pegado:
// "arrastrarlas") antes de la primera subordinada ("para", "que"...), sin
// contar auxiliares ("poder", "permitir"). Heurístico: en el peor caso pide
// separar de más; nunca decide solo, el modelo separa.
const NOT_ACTION = new Set(
  ("poder deber tener querer haber ser estar hacer permitir dejar ir lograr necesitar " +
    "lugar hogar mar par bar militar popular similar particular regular singular escolar " +
    "familiar solar polar titular celular modular taller placer mujer alfiler").split(" "),
);
const SUBORD = /\b(para|que|cuando|si|al|hasta|mientras|porque|donde|segun)\b/;
export function actionVerbs(text) {
  // "arrastrar y soltar" es una sola acción (drag & drop).
  const head = norm(text).replace(/arrastrar(las|los|la|lo)? y soltar(las|los|la|lo)?/g, "arrastrar").split(SUBORD)[0];
  const verbs = new Set();
  for (const w of head.match(/[a-zñ]+/g) || []) {
    const m = w.match(/^([a-zñ]{1,}?(?:ar|er|ir))(?:se|la|las|lo|los|le|les)?$/);
    if (m && !NOT_ACTION.has(m[1])) verbs.add(m[1]);
  }
  return [...verbs];
}
// Feature que sale solo de respuestas y repite otra feature (mismas palabras,
// sin una acción distinta): es un detalle de esa otra (Project24: "Editar los
// datos de las tarjetas mediante un formulario…" junto a "Editar tarjetas").
export function detailDuplicates(items, lines) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const feats = items.filter((i) => i.tipo === "feature");
  const onlyAnswers = (i) => i.de.every((id) => ["respuesta", "ajuste"].includes(byId.get(id)?.field));
  const words = (t) => new Set((norm(t).match(/[a-z0-9]{4,}/g) || []).filter((w) => !Q_STOP.has(w)).map((w) => w.slice(0, 5)));
  const out = [];
  for (const a of feats) {
    if (!onlyAnswers(a)) continue;
    const va = actionVerbs(a.texto), wa = words(a.texto);
    let best = null;
    for (const b of feats) {
      if (b === a || out.some((x) => x.item === b && x.of === a)) continue;
      const vb = actionVerbs(b.texto);
      if (va.length && vb.length && !va.some((v) => vb.includes(v))) continue; // acciones distintas
      const wb = words(b.texto);
      const shared = [...wa].filter((w) => wb.has(w)).length;
      const min = Math.min(wa.size, wb.size);
      const score = min ? shared / min : 0;
      if (min >= 2 && shared >= 2 && score >= 0.6 && (!best || score > best.score || (!onlyAnswers(b) && onlyAnswers(best.of)))) best = { of: b, score };
    }
    if (best) out.push({ item: a, of: best.of });
  }
  return out;
}

export const compoundFeatures = (items) =>
  items.filter((i) => i.tipo === "feature" && actionVerbs(i.texto).length >= 2);

export function repairFeedback({ uncovered = [], invalid = [], compound = [], details = [] }, lines = []) {
  const out = ["Revisá tu JSON:"];
  const byId = new Map(lines.map((l) => [l.id, l]));
  if (uncovered.length) {
    out.push("- Estas líneas no quedaron en ningún ítem. Asignalas con sus palabras (si detallan otro ítem, agregalas a ese ítem y sumá la línea a su \"de\"; si no hay nada para construir, van como contexto):");
    for (const id of uncovered) {
      const l = byId.get(id);
      out.push(l ? `  ${id}${l.pregunta ? ` (respuesta a "${l.pregunta}")` : ""}: "${l.text}"` : `  ${id}`);
    }
  }
  for (const x of invalid) out.push(`- Ítem inválido (${x.reason}): ${JSON.stringify(x.item)}`);
  for (const x of details)
    out.push(`- "${x.item.texto}" (${x.item.de.join(", ")}) repite "${x.of.texto}": escribí ese detalle dentro de "${x.of.texto}" y sumá ${x.item.de.join(", ")} a su "de"; no lo dejes como ítem aparte.`);
  for (const x of compound)
    out.push(`- La feature "${x.texto}" junta varias acciones (${actionVerbs(x.texto).join(", ")}): separala en un ítem por acción, con el mismo "de".`);
  out.push("Devolvé el JSON COMPLETE entero de nuevo.");
  return out.join("\n");
}

// Red final: lo que el modelo no ubicó lo agrega el harness con el tipo que
// sugiere su campo (o contexto), marcado auto para que la UI lo resalte.
export function fillUncovered(items, lines, uncovered) {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return [
    ...items,
    ...uncovered.map((id) => {
      const l = byId.get(id);
      // Una respuesta suelta ("no") no dice nada sin su pregunta.
      const texto = l.field === "respuesta" && l.pregunta ? `${l.pregunta} → ${l.text}` : l.field === "ajuste" ? `Ajuste: ${l.text}` : l.text;
      return { de: [id], tipo: FIELDS[l.field]?.tipo || "contexto", texto, auto: true };
    }),
  ];
}

function uniq(texts) {
  const seen = new Set();
  return texts.filter((t) => {
    const k = norm(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Arma el refined_prompt. features = feature + estilo (en ese orden), para que
 * reviewer, page plan, traductor y Specialist sigan leyendo lo mismo que antes;
 * estilo/restricciones/contexto viajan además por separado.
 */
export function buildRefined({ project_name, items, criterios_holdout = [], lines = [], attempts = [] }) {
  const firstLine = (i) => Math.min(...i.de.map((id) => Number(id.slice(1))));
  const sorted = [...items].sort((a, b) => firstLine(a) - firstLine(b));
  const of = (t) => uniq(sorted.filter((i) => i.tipo === t).map((i) => i.texto));
  const contexto = of("contexto");
  // El objetivo sale solo de contexto que ubicó el modelo; lo que agregó el
  // harness (auto) queda en `contexto` y resaltado en la tarjeta, pero no
  // ensucia el objetivo que lee TechLeader.
  const objetivoParts = uniq(sorted.filter((i) => i.tipo === "contexto" && !i.auto).map((i) => i.texto));
  const feature = of("feature");
  const estilo = of("estilo");
  const restricciones = of("restriccion");
  const name = String(project_name || "").trim() || contexto[0] || "Proyecto";
  return {
    project_name: name,
    objetivo: objetivoParts.join(". ") || name,
    features: uniq([...feature, ...estilo]),
    criterios_holdout: (Array.isArray(criterios_holdout) ? criterios_holdout : []).map(String).filter((c) => c.trim()),
    restricciones,
    estilo,
    contexto,
    brief: { version: BRIEF_VERSION, lines, items: sorted, repairs: Math.max(0, attempts.length - 1) },
  };
}

/** Texto que recibe TechLeader. Restricciones van después de los criterios
 * (el reviewer toma solo la lista numerada de Features). */
export function buildTechLeaderInput(refined) {
  const parts = [];
  if (refined.project_name) parts.push(`Proyecto: ${refined.project_name}`);
  if (refined.objetivo) parts.push(refined.objetivo);
  if (refined.features?.length) {
    parts.push("", "Features:", "");
    refined.features.forEach((f, i) => parts.push(`${i + 1}. ${f}`));
  }
  if (refined.criterios_holdout?.length) {
    parts.push("", "Criterios de éxito:");
    refined.criterios_holdout.forEach((c) => parts.push(`- ${c}`));
  }
  if (refined.restricciones?.length) {
    parts.push("", "Restricciones (límites que puso el usuario; no planificar trabajo que las contradiga):");
    refined.restricciones.forEach((r) => parts.push(`- ${r}`));
  }
  return parts.join("\n");
}

/** Para la tarjeta de confirmación: cada línea con los ítems que salieron de ella. */
export function linesWithItems(brief) {
  return (brief?.lines || []).map((line) => ({
    line,
    items: (brief.items || []).filter((i) => i.de.includes(line.id)),
  }));
}

export const HARNESS_QUESTIONS = {
  vacio: "Completá la plantilla: qué querés construir, qué tiene que hacer, cómo se tiene que ver y qué no debe hacer.",
  sin_feature: "¿Qué tiene que poder hacer el usuario con la app? Escribí una acción por línea.",
};
// Se agrega a cada pregunta del modelo para que el usuario sepa cómo cortar.
export const QUESTION_HINT = "(Respondé, o escribí \"listo\" para seguir sin más preguntas.)";
const stripHint = (q) => String(q || "").replace(QUESTION_HINT, "").trim();

/**
 * Un turno de Intent Forge.
 *  1. Sin líneas → pregunta del harness (completar la plantilla).
 *  2. Entrevista de completitud: mientras no haya COMPLETE previo, el usuario
 *     no haya dicho "listo" y queden preguntas (máx. 10), Qwen propone UNA
 *     pregunta o dice LISTO.
 *  3. Clasificación acotada con reintentos de cobertura → COMPLETE.
 * @param {object[]} conversation  historial {role, content}
 * @param {object} opts
 * @param {(messages:object[]) => Promise<string>} opts.callModel
 * @param {number} [opts.maxQuestions=10]
 * @param {number} [opts.maxRepairs=2]    reintentos de cobertura/JSON
 */
export async function runIntentForge(conversation, { callModel, maxQuestions = MAX_QUESTIONS, maxRepairs = 2 } = {}) {
  const numbered = numberLines(conversation);
  const { lines } = numbered;
  const preguntas = numbered.preguntas.map(stripHint);
  if (!lines.length) return { status: "ASKING", question: HARNESS_QUESTIONS.vacio, by: "harness", lines };

  const attempts = [];
  // Faltantes de turnos anteriores cuyo tema todavía no se preguntó
  // (Project24: "cuántas columnas y qué estados" se detectó y nunca se preguntó).
  const blocked = (x) => sameTopicAsked(x, preguntas, lines) || touchesRestriction(x, lines);
  const pendientes = (numbered.faltantesPrevios || []).filter((f) => !blocked(questionFromGap(f)));
  const noMoreQuestions = numbered.skip || numbered.afterComplete || preguntas.length >= maxQuestions || numbered.delegatedRun >= 2;

  // 2. Entrevista de completitud.
  if (!noMoreQuestions) {
    const qMessages = [
      { role: "system", content: QUESTION_SYSTEM },
      { role: "user", content: formatForQuestion({ lines, preguntas, pendientes }) },
    ];
    const raw = await callModel(qMessages);
    const iv = parseInterviewer(raw);
    let q = iv.pregunta;
    let by = "model";
    let kind = iv.done ? "listo" : "pregunta";
    if (!iv.done && blocked(q)) {
      // Mismo tema con otras palabras: el harness pasa al siguiente faltante
      // que no se haya preguntado (Project24: 4 de 5 preguntas sobre el semáforo).
      kind = touchesRestriction(q, lines) ? "pregunta_contra_restriccion" : "pregunta_repetida";
      const alt = [...iv.faltantes.slice(1), ...pendientes].map(questionFromGap).find((x) => !blocked(x));
      if (alt) { q = alt; by = "harness_faltante"; kind = "faltante_siguiente"; }
      else q = "";
    }
    attempts.push({ raw, kind, faltantes: iv.faltantes, ...(by !== "model" ? { pregunta_usada: q } : {}) });
    if (q) {
      return { status: "ASKING", question: `${q} ${QUESTION_HINT}`, by, lines, attempts, faltantes: iv.faltantes };
    }
  }

  // 3. Clasificación.
  const messages = [
    { role: "system", content: INTENT_SYSTEM },
    { role: "user", content: formatLinesForModel({ lines, preguntas }) },
  ];
  let last = null;
  for (let i = 0; i <= maxRepairs; i++) {
    const raw = await callModel(messages);
    const parsed = parseModelOutput(raw);
    if (!parsed.complete) {
      attempts.push({ raw, kind: parsed.parseError ? "json_ilegible" : "no_json", error: parsed.error });
      messages.push({ role: "assistant", content: raw }, {
        role: "user",
        content: parsed.parseError
          ? `Tu JSON no se pudo leer (${parsed.error}). Devolvé el JSON COMPLETE válido dentro de \`\`\`json, sin nada después de la última }.`
          : "No preguntes. Devolvé solo el JSON COMPLETE, válido, dentro de ```json.",
      });
      continue;
    }
    const v = validateItems(parsed.data.items, lines);
    v.compound = compoundFeatures(v.items);
    v.details = detailDuplicates(v.items, lines);
    last = { raw, data: parsed.data, ...v };
    attempts.push({ raw, kind: "complete", uncovered: v.uncovered, invalid: v.invalid.map((x) => x.reason), compound: v.compound.map((x) => x.texto), details: v.details.map((x) => `${x.item.texto} ⊂ ${x.of.texto}`) });
    if (!v.uncovered.length && !v.invalid.length && !v.compound.length && !v.details.length) break;
    if (i < maxRepairs) messages.push({ role: "assistant", content: raw }, { role: "user", content: repairFeedback(v, lines) });
  }

  if (!last) {
    // El modelo nunca devolvió un JSON usable: todas las líneas por la red del harness.
    last = { raw: attempts.at(-1)?.raw || "", data: {}, items: [], invalid: [], uncovered: lines.map((l) => l.id) };
  }
  // Lo que siga compuesto después de los reintentos queda marcado (la tarjeta
  // lo resalta para que el usuario lo separe con Ajustar).
  const stillCompound = new Set(compoundFeatures(last.items));
  const items = fillUncovered(last.items.map((i) => (stillCompound.has(i) ? { ...i, compuesta: true } : i)), lines, last.uncovered);
  if (!items.some((i) => i.tipo === "feature") && preguntas.length < maxQuestions) {
    return { status: "ASKING", question: HARNESS_QUESTIONS.sin_feature, by: "harness", lines, attempts };
  }
  const refined = buildRefined({
    project_name: last.data.project_name,
    items,
    criterios_holdout: last.data.criterios_holdout,
    lines,
    attempts: attempts.filter((a) => a.kind !== "pregunta" && a.kind !== "listo" && a.kind !== "pregunta_repetida"),
  });
  refined.brief.preguntas = preguntas;
  return { status: "COMPLETE", refined, raw: last.raw, lines, attempts, auto_added: last.uncovered, compound: [...stillCompound].map((i) => i.texto) };
}
