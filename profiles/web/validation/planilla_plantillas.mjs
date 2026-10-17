// planilla_plantillas.mjs — PLANTILLAS DE FILA (17/10, decisión de Miche). Qwen elige, el harness arma.
//
// Por qué (3 corridas reales de planilla_writer sobre c22, Project doc claude/evidencia_qwen_planilla_searcher_2026-10-17.md):
// cuando Qwen escribe la fila entera en JSON, lo que escribe es bueno (28 de 32 celdas iguales a la vara), pero en 8 de 16
// requisitos no logra armar una fila válida en 3 intentos, aunque el error le llegue escrito. A un modelo de 7B le sale
// mejor ELEGIR y EXTRAER que COMPONER. Acá Qwen dice qué plantillas aplican a un requisito y completa 2 o 3 casilleros
// (qué columna, qué valor, qué campo); el harness arma la fila con el vocabulario de planilla.mjs. Las filas pasan por
// el MISMO validador que las de Qwen libre (validateRow + chequeos de sentido): cambia quién compone, no la vara.
//
// Una respuesta de Qwen:  { "usa": [ { "plantilla": "borrar", "columna": "Pendiente" }, … ] }   o   { "sin_fila": "motivo" }

export const PLANTILLAS_VERSION = "planilla_plantillas v0.2.1";
const A = "QA Alfa", B = "QA Beta";
const isText = (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 120;
// v0.2 (1ª corrida): Qwen nombra los campos sin valor (["Titulo", "descripción", "prioridad"] o { "Prioridad": "" }).
// El título es el texto de "agregar"; los de texto libre los completa el harness; los de opciones necesitan un valor.
const FREE = /desc|nota|detalle|coment|texto|observ|nombre/i;
export function camposDe(raw) {
  const obj = Array.isArray(raw) ? Object.fromEntries(raw.map((k) => [String(k), ""])) : raw && typeof raw === "object" ? raw : {};
  const out = {}, faltan = [];
  for (const [k, v] of Object.entries(obj)) {
    if (/^t[ií]tulo$/i.test(k.trim())) continue;
    const val = String(v ?? "").trim();
    // texto libre: siempre un texto de prueba "QA …" (2ª corrida: "Nueva descripción" no lo dijo el usuario y se rechazaba 3 veces)
    if (FREE.test(k)) out[k] = val ? (/^qa\b/i.test(val) ? val : `QA ${val}`) : `QA ${k.trim()}`; else if (val) out[k] = val; else faltan.push(k);
  }
  return { campos: out, faltan };
}
const list = (x) => (Array.isArray(x) ? x : isText(x) ? [x] : []).map(String).map((s) => s.trim()).filter(Boolean);

/** Cada plantilla: qué dice (para el pedido), sus casilleros, y cómo arma la fila. */
export const PLANTILLAS = {
  crear: {
    dice: "se puede crear un elemento (y aparece en una columna)",
    casilleros: { columna: "opcional: dónde tiene que aparecer" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ esta: A, ...(c.columna ? { en: c.columna } : {}) }] }),
  },
  crear_con_campos: {
    dice: "al crear se cargan campos y la tarjeta los muestra",
    casilleros: { campos: '{ "nombre del campo": "valor de ejemplo" } (descripcion, prioridad…; el título no)' },
    arma: (c) => { const { campos } = camposDe(c.campos); return { hago: { agregar: A, campos }, veo: [{ en_item: A, contiene: Object.values(campos) }] }; },
    necesita: (c) => { const { campos, faltan } = camposDe(c.campos); return faltan.length ? `un valor de ejemplo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : !Object.keys(campos).length ? `"campos" con al menos un campo (que no sea el título) y su valor` : null; },
  },
  editar: {
    dice: "se puede editar un elemento (el texto nuevo queda y el viejo no)",
    casilleros: { campos: "opcional: campos que se cambian al editar, con el valor nuevo" },
    arma: (c) => { const { campos } = camposDe(c.campos); const has = Object.keys(campos).length > 0; return { dado: [{ agregar: A }], hago: { editar: A, a: B, ...(has ? { campos } : {}) }, veo: [{ esta: B }, { no_esta: A }, ...(has ? [{ en_item: B, contiene: Object.values(campos) }] : [])] }; },
    necesita: (c) => { const { faltan } = camposDe(c.campos); return faltan.length ? `un valor nuevo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : null; },
  },
  borrar: {
    dice: "se puede borrar un elemento (desaparece; si hay contador, baja)",
    casilleros: { columna: "opcional: la columna cuyo contador baja" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { eliminar: A }, veo: [{ no_esta: A }, ...(c.columna ? [{ contador: c.columna, cambia: -1 }] : [])] }),
  },
  mover: {
    dice: "un elemento se mueve (arrastrando o con un control) a otra columna",
    casilleros: { a: "la columna de destino", desde: "opcional: la columna de origen (para los contadores)" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { mover: A, a: c.a }, veo: [{ esta: A, en: c.a }, ...(c.desde ? [{ contador: c.desde, cambia: -1 }, { contador: c.a, cambia: 1 }] : [])] }),
    necesita: (c) => (!isText(c.a) ? `"a": la columna de destino` : null),
  },
  contador_al_crear: {
    dice: "una columna muestra cuántos elementos tiene y sube al crear",
    casilleros: { columna: "la columna con contador" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ contador: c.columna, cambia: 1 }] }),
    necesita: (c) => (!isText(c.columna) ? `"columna"` : null),
  },
  recargar_sigue: {
    dice: "lo creado sigue después de recargar la página (se guarda)",
    casilleros: {},
    arma: () => ({ dado: [{ agregar: A }], hago: { recargar: true }, veo: [{ esta: A }] }),
  },
  se_ven_textos: {
    dice: "en la pantalla se ven ciertos textos (p. ej. los títulos de las columnas)",
    casilleros: { textos: '["texto", …] tal cual los escribió el usuario' },
    arma: (c) => ({ veo: list(c.textos).map((t) => ({ esta: t })) }),
    necesita: (c) => (!list(c.textos).length ? `"textos": la lista de textos que se ven` : null),
  },
  boton_en: {
    dice: "hay un botón con ciertas palabras (y, si se pide, SOLO en una columna)",
    casilleros: { palabras: '["palabras", "del", "botón"]', solo_en: "opcional: la única columna donde está" },
    arma: (c) => ({ veo: [{ control: list(c.palabras), ...(c.solo_en ? { solo_en: c.solo_en } : {}) }] }),
    necesita: (c) => (!list(c.palabras).length ? `"palabras": las palabras del botón` : null),
  },
  al_pasar_mouse: {
    dice: "algo aparece en la tarjeta solo al pasar el mouse por encima",
    casilleros: { textos: '["lo que aparece", …] (íconos o palabras)' },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { pasar_mouse: A }, veo: [{ al_pasar: list(c.textos), en_item: A }] }),
    necesita: (c) => (!list(c.textos).length ? `"textos": lo que aparece` : null),
  },
  estilo: {
    dice: "una cosa tiene un estilo medible: color de fondo, color, ancho, alto, padding, borde, redondeo, sombra, scroll",
    casilleros: { de: '"pagina" | "columna" | "tarjeta" | "boton"', nombre: "si es columna: su nombre; si es botón: sus palabras", prop: "background-color | color | width | height | padding | border-top-style | border-top-left-radius | box-shadow | overflow-y", valor: '"#rrggbb", "Npx", una palabra (dashed, scroll), o "con sombra"' },
    arma: (c) => {
      const de = c.de === "pagina" ? "pagina" : c.de === "columna" ? { columna: c.nombre } : c.de === "boton" ? { control: list(c.nombre).flatMap((x) => x.split(/\s+/)) } : { tarjeta: A };
      const valor = /sombra/i.test(String(c.valor)) ? { distinto: "none" } : c.prop === "overflow-y" && /scroll/i.test(String(c.valor)) ? ["scroll", "auto"] : c.valor;
      return { ...(c.de === "tarjeta" ? { dado: [{ agregar: A }] } : {}), veo: [{ estilo: { de, prop: c.prop, valor } }] };
    },
    necesita: (c) => (!["pagina", "columna", "tarjeta", "boton"].includes(c.de) ? `"de": pagina, columna, tarjeta o boton` : (c.de === "columna" || c.de === "boton") && !list(c.nombre).length ? `"nombre": ${c.de === "columna" ? "el nombre de la columna" : "las palabras del botón"}` : !isText(c.prop) ? `"prop"` : !isText(c.valor) ? `"valor"` : null),
  },
  color_segun_valor: {
    dice: "la tarjeta se pinta de un color según el valor de un campo (p. ej. prioridad alta = rojo)",
    casilleros: { campo: "el campo (p. ej. prioridad)", valor: "el valor (p. ej. alta)", familia: "rojo | amarillo | verde" },
    arma: (c) => ({ hago: { agregar: A, campos: { [c.campo]: c.valor } }, veo: [{ en_item: A, contiene: [c.valor] }, { color_en_item: A, texto: c.valor, familia: c.familia }] }),
    necesita: (c) => (!isText(c.campo) || !isText(c.valor) ? `"campo" y "valor"` : !["rojo", "amarillo", "verde"].includes(c.familia) ? `"familia": rojo, amarillo o verde` : null),
  },
  orden_por_campo: {
    dice: "en una columna los elementos se ordenan por un campo (y, si se pide, a igual valor primero el más reciente)",
    casilleros: { campo: "el campo (p. ej. prioridad)", valores: '["valor de arriba", …, "valor de abajo"]', columna: "la columna", reciente_primero: "opcional: true si a igual valor va primero el más reciente" },
    // el harness crea en un orden DISTINTO al esperado (si no, no prueba que ordene): del último valor al primero
    arma: (c) => {
      const vs = list(c.valores), name = (v) => `QA ${v.charAt(0).toUpperCase()}${v.slice(1)}`;
      const dado = [...vs].reverse().map((v) => ({ agregar: name(v), campos: { [c.campo]: v } }));
      const orden = vs.map(name);
      if (c.reciente_primero === true && vs.length) {
        const top = vs[0], vieja = `${name(top)} Vieja`, nueva = `${name(top)} Nueva`;
        dado.splice(0, dado.length, { agregar: vieja, campos: { [c.campo]: top } }, ...[...vs].slice(1).reverse().map((v) => ({ agregar: name(v), campos: { [c.campo]: v } })), { agregar: nueva, campos: { [c.campo]: top } });
        orden.splice(0, 1, nueva, vieja);
      }
      return { dado, veo: [{ orden, en: c.columna }] };
    },
    necesita: (c) => (!isText(c.campo) ? `"campo"` : list(c.valores).length < 2 ? `"valores": al menos 2, de arriba abajo` : !isText(c.columna) ? `"columna"` : null),
  },
};

// v0.2 (1ª corrida real con plantillas, 17/10): Qwen usó "orden_por_campo" y "al_pasar_mouse" en R15, que no habla de
// ordenar ni de pasar el mouse. Cada plantilla necesita que el requisito la NOMBRE (palabras en castellano o inglés).
export const PERTINENCIA = {
  crear: /crea|agreg|añad|anad|nuev|add\b/i, crear_con_campos: /crea|agreg|añad|anad|nuev|campo/i, editar: /edit|modific|cambi/i,
  borrar: /borr|elimin|quit|delet/i, mover: /mov|arrastr|drag|solt/i, contador_al_crear: /contador|cantidad|counter|cuenta/i,
  recargar_sigue: /guard|recarg|persist|localstorage|se mantien|no se pierd/i, al_pasar_mouse: /hover|pasar|mouse|encima/i,
  orden_por_campo: /orden|priori|arriba|abajo|primer|recient|descend|ascend/i, color_segun_valor: /color|rojo|verde|amarill|azul/i,
  estilo: /\d+\s*px|#[0-9a-f]{3,6}|padding|border|borde|radius|redond|sombra|shadow|overflow|scroll|width|height|ancho|alto|fondo|color/i,
};
const STYLE_WORDS = /\d+\s*px|#[0-9a-f]{6}|padding|border|radius|overflow|width|height|sombra/i;
/** ¿Las elecciones tienen que ver con el requisito? ¿Falta una parte que el requisito nombra? → problemas (para el reintento). */
export function relevanceProblems(choices, text0) {
  const p = [];
  // lo que está entre comillas es el NOMBRE de algo ("botón 'Agregar tarjeta'"), no lo que pide el requisito (2ª corrida: R2 → crear)
  const text = String(text0).replace(/(['"“”‘’«»]).*?\1/g, " ");
  const said = String(text0).toLowerCase();
  const used = new Set((Array.isArray(choices) ? choices : []).map((c) => c?.plantilla));
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => { const re = PERTINENCIA[ch?.plantilla]; if (re && !re.test(String(text))) p.push(`elección ${i + 1} (${ch.plantilla}): el requisito no habla de eso; usá solo plantillas de lo que dice`); });
  // un valor exacto de estilo (#rrggbb, Npx) tiene que estar escrito en ESTE requisito (2ª corrida: R10 copió el #102C54 de R9)
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => { if (ch?.plantilla === "estilo" && typeof ch.valor === "string" && /^#[0-9a-f]{3,6}$|^\d+(\.\d+)?px$/i.test(ch.valor.trim()) && !said.includes(ch.valor.trim().toLowerCase())) p.push(`elección ${i + 1} (estilo): el valor "${ch.valor}" no está en este requisito; usá solo los valores que dice`); });
  if (STYLE_WORDS.test(String(text0)) && !used.has("estilo")) p.push(`AVISO: el requisito nombra estilos medibles (${String(text).match(STYLE_WORDS)[0]}…): agregá una elección "estilo" por cada uno`);
  return p;
}

/** Lo que eligió Qwen → filas (sin validar todavía) + problemas por elección. Función pura. */
export function rowsFromChoices(choices, id) {
  const filas = [], problems = [];
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => {
    const t = PLANTILLAS[ch?.plantilla];
    if (!t) { problems.push(`elección ${i + 1}: la plantilla "${ch?.plantilla}" no existe (usá: ${Object.keys(PLANTILLAS).join(", ")})`); return; }
    const falta = t.necesita?.(ch);
    if (falta) { problems.push(`elección ${i + 1} (${ch.plantilla}): falta ${falta}`); return; }
    filas.push({ r: id, ...t.arma(ch), _plantilla: ch.plantilla });
  });
  return { filas, problems };
}

export function systemPromptPlantillas() {
  const lines = Object.entries(PLANTILLAS).map(([k, t]) => `- ${k}: ${t.dice}.${Object.keys(t.casilleros).length ? ` Casilleros: ${Object.entries(t.casilleros).map(([c, d]) => `"${c}" (${d})`).join(", ")}.` : ""}`);
  return `Elegís cómo comprobar UN requisito de una app web usando PLANTILLAS. No escribís pruebas: decís qué plantillas aplican y completás sus casilleros. El sistema arma las pruebas y las corre en un navegador real.

Respondé SOLO con JSON: { "usa": [ { "plantilla": "nombre", …casilleros } ] }
o, si el requisito NO se puede comprobar usando la app (dice cómo está programada por dentro), { "sin_fila": "motivo corto" }.

Plantillas:
${lines.join("\n")}

Reglas:
1. SOLO lo que dice ESE requisito; no agregues cosas ni copies otros requisitos.
2. Nombres de columnas, palabras de botones, campos y valores: tal cual los escribió el usuario, sin comillas.
3. Si el requisito tiene varias partes (tres prioridades, colores de varias cosas), una elección por parte.
4. Si ninguna plantilla sirve, "sin_fila" con el motivo.

Ejemplos (otra app: recetas, con columnas "Para probar" y "Favoritas").
"Al borrar una receta desaparece y baja el contador de Favoritas" → { "usa": [ { "plantilla": "borrar", "columna": "Favoritas" } ] }
"Las recetas tienen fondo #FFF8E7 y sombra" → { "usa": [ { "plantilla": "estilo", "de": "tarjeta", "prop": "background-color", "valor": "#FFF8E7" }, { "plantilla": "estilo", "de": "tarjeta", "prop": "box-shadow", "valor": "con sombra" } ] }
"Se ordenan por dificultad: fácil arriba, difícil abajo" → { "usa": [ { "plantilla": "orden_por_campo", "campo": "dificultad", "valores": ["fácil", "difícil"], "columna": "Para probar" } ] }
"Cada receta es un div 'card' con header y body" → { "sin_fila": "dice cómo está armada por dentro" }`;
}
