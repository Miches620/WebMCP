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

export const PLANTILLAS_VERSION = "planilla_plantillas v0.4";
// v0.4 (19/10): las RESTRICCIONES de Miche también se prueban ("no se puede borrar en Completa"): no_borrar_en.
// v0.3 (17/10, diseño de 3 capas con Miche): las plantillas hablan de TIPOS (item, grupo). El pedido a Qwen se escribe con
// los nombres del glosario de la app ("tarjeta", "columna") y lo que Qwen contesta con esos nombres se traduce a tipos.
// Una plantilla que necesita un tipo que la app no tiene (glosario: "grupo": null) no se ofrece.
import { palabra, tiene, tipoDe } from "./glosario.mjs";
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
// artículos: "la columna" / "el grupo". Sin saber el género, se deduce de la última letra (alcanza para el pedido).
const fem = (w) => /a$|ion$|ión$|dad$/i.test(w);
const art = (g, tipo) => { const w = palabra(g, tipo); return `${fem(w) ? "la" : "el"} ${w}`; };
const un = (g, tipo) => { const w = palabra(g, tipo); return `${fem(w) ? "una" : "un"} ${w}`; };
/** Los textos de una plantilla con los nombres de la app: {un_item}, {el_grupo}, {items}, {grupo}… ([[…]] solo si la app tiene grupos) */
export function conNombres(txt, g) {
  return String(txt).replace(/\[\[(.*?)\]\]/g, (_, x) => (tiene(g, "grupo") ? x : ""))
    .replace(/\{un_(item|grupo)\}/g, (_, t) => un(g, t)).replace(/\{el_(item|grupo)\}/g, (_, t) => art(g, t))
    .replace(/\{otro_grupo\}/g, () => { const w = palabra(g, "grupo"); return `${fem(w) ? "otra" : "otro"} ${w}`; })
    .replace(/\{(item|grupo)s\}/g, (_, t) => palabra(g, t, true)).replace(/\{(item|grupo)\}/g, (_, t) => palabra(g, t));
}
// los casilleros propios de las plantillas no se traducen (si la app llama "campo" a sus ítems, "campo" sigue siendo el campo)
const RESERVADAS = new Set(["plantilla", "campos", "campo", "valor", "valores", "textos", "palabras", "a", "desde", "solo_en", "de", "nombre", "prop", "familia", "reciente_primero"]);
/** Lo que contestó Qwen con los nombres de la app → tipos: { "columna": "X" } → { grupo: "X" }; "de": "tarjeta" → "item". */
export function eleccionATipos(ch, g) {
  if (!ch || typeof ch !== "object") return ch;
  const out = {};
  for (const [k, v] of Object.entries(ch)) { const t = RESERVADAS.has(k) ? null : tipoDe(g, k); out[t || k] = v; }
  if (typeof out.de === "string" && !["pagina", "boton"].includes(out.de)) out.de = tipoDe(g, out.de) || (/^bot[oó]n$/i.test(out.de) ? "boton" : /^p[aá]gina$/i.test(out.de) ? "pagina" : out.de);
  return out;
}
/** Las plantillas que tienen sentido en esta app (las que necesitan un tipo que no tiene, afuera). */
export function plantillasPara(g) {
  return Object.fromEntries(Object.entries(PLANTILLAS).filter(([, t]) => (t.requiere || []).every((x) => tiene(g, x))));
}

/** Cada plantilla: qué dice (para el pedido), sus casilleros, y cómo arma la fila. */
export const PLANTILLAS = {
  crear: {
    dice: "se puede crear {un_item}[[ (y aparece en {un_grupo})]]",
    casilleros: { grupo: "opcional: dónde tiene que aparecer" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ esta: A, ...(c.grupo ? { en: c.grupo } : {}) }] }),
  },
  crear_con_campos: {
    dice: "al crear se cargan campos y {el_item} los muestra",
    casilleros: { campos: '{ "nombre del campo": "valor de ejemplo" } (descripcion, prioridad…; el título no)' },
    arma: (c) => { const { campos } = camposDe(c.campos); return { hago: { agregar: A, campos }, veo: [{ en_item: A, contiene: Object.values(campos) }] }; },
    necesita: (c) => { const { campos, faltan } = camposDe(c.campos); return faltan.length ? `un valor de ejemplo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : !Object.keys(campos).length ? `"campos" con al menos un campo (que no sea el título) y su valor` : null; },
  },
  editar: {
    dice: "se puede editar {un_item} (el texto nuevo queda y el viejo no)",
    casilleros: { campos: "opcional: campos que se cambian al editar, con el valor nuevo" },
    arma: (c) => { const { campos } = camposDe(c.campos); const has = Object.keys(campos).length > 0; return { dado: [{ agregar: A }], hago: { editar: A, a: B, ...(has ? { campos } : {}) }, veo: [{ esta: B }, { no_esta: A }, ...(has ? [{ en_item: B, contiene: Object.values(campos) }] : [])] }; },
    necesita: (c) => { const { faltan } = camposDe(c.campos); return faltan.length ? `un valor nuevo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : null; },
  },
  borrar: {
    dice: "se puede borrar {un_item} (desaparece; si hay contador, baja)",
    casilleros: { grupo: "opcional: {el_grupo} cuyo contador baja" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { eliminar: A }, veo: [{ no_esta: A }, ...(c.grupo ? [{ contador: c.grupo, cambia: -1 }] : [])] }),
  },
  mover: {
    requiere: ["grupo"],
    dice: "{un_item} se mueve (arrastrando o con un control) a {otro_grupo}",
    casilleros: { a: "{el_grupo} de destino", desde: "opcional: {el_grupo} de origen (para los contadores)" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { mover: A, a: c.a }, veo: [{ esta: A, en: c.a }, ...(c.desde ? [{ contador: c.desde, cambia: -1 }, { contador: c.a, cambia: 1 }] : [])] }),
    necesita: (c, g) => (!isText(c.a) ? `"a": ${art(g, "grupo")} de destino` : null),
  },
  contador_al_crear: {
    requiere: ["grupo"],
    dice: "{un_grupo} muestra la cantidad de {items} que tiene y sube al crear",
    casilleros: { grupo: "{el_grupo} con contador" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ contador: c.grupo, cambia: 1 }] }),
    necesita: (c, g) => (!isText(c.grupo) ? `"${palabra(g, "grupo")}"` : null),
  },
  recargar_sigue: {
    dice: "lo creado sigue después de recargar la página (se guarda)",
    casilleros: {},
    arma: () => ({ dado: [{ agregar: A }], hago: { recargar: true }, veo: [{ esta: A }] }),
  },
  se_ven_textos: {
    dice: "en la pantalla se ven ciertos textos (p. ej. títulos)",
    casilleros: { textos: '["texto", …] tal cual los escribió el usuario' },
    arma: (c) => ({ veo: list(c.textos).map((t) => ({ esta: t })) }),
    necesita: (c) => (!list(c.textos).length ? `"textos": la lista de textos que se ven` : null),
  },
  boton_en: {
    dice: "hay un botón con ciertas palabras[[ (y, si se pide, SOLO en {un_grupo})]]",
    casilleros: { palabras: '["palabras", "del", "botón"]', solo_en: "opcional: {el_grupo} donde está (solo ahí)" },
    arma: (c) => ({ veo: [{ control: list(c.palabras), ...(c.solo_en ? { solo_en: c.solo_en } : {}) }] }),
    necesita: (c) => (!list(c.palabras).length ? `"palabras": las palabras del botón` : null),
  },
  al_pasar_mouse: {
    dice: "algo aparece en {el_item} solo al pasar el mouse por encima",
    casilleros: { textos: '["lo que aparece", …] (íconos o palabras)' },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { pasar_mouse: A }, veo: [{ al_pasar: list(c.textos), en_item: A }] }),
    necesita: (c) => (!list(c.textos).length ? `"textos": lo que aparece` : null),
  },
  estilo: {
    dice: "una cosa tiene un estilo medible: color de fondo, color, ancho, alto, padding, borde, redondeo, sombra, scroll",
    casilleros: { de: '"pagina" | [["{grupo}" | ]]"{item}" | "boton"', nombre: "[[si es {grupo}: su nombre; ]]si es botón: sus palabras", prop: "background-color | color | width | height | padding | border-top-style | border-top-left-radius | box-shadow | overflow-y", valor: '"#rrggbb", "Npx", una palabra (dashed, scroll), o "con sombra"' },
    arma: (c) => {
      const de = c.de === "pagina" ? "pagina" : c.de === "grupo" ? { grupo: c.nombre } : c.de === "boton" ? { control: list(c.nombre).flatMap((x) => x.split(/\s+/)) } : { item: A };
      const valor = /sombra/i.test(String(c.valor)) ? { distinto: "none" } : c.prop === "overflow-y" && /scroll/i.test(String(c.valor)) ? ["scroll", "auto"] : c.valor;
      return { ...(c.de === "item" ? { dado: [{ agregar: A }] } : {}), veo: [{ estilo: { de, prop: c.prop, valor } }] };
    },
    necesita: (c, g) => (!["pagina", "grupo", "item", "boton"].includes(c.de) ? `"de": pagina, ${palabra(g, "grupo")}, ${palabra(g, "item")} o boton` : (c.de === "grupo" || c.de === "boton") && !list(c.nombre).length ? `"nombre": ${c.de === "grupo" ? `el nombre de ${art(g, "grupo")}` : "las palabras del botón"}` : !isText(c.prop) ? `"prop"` : !isText(c.valor) ? `"valor"` : null),
  },
  color_segun_valor: {
    dice: "{el_item} se pinta de un color según el valor de un campo (p. ej. prioridad alta = rojo)",
    casilleros: { campo: "el campo (p. ej. prioridad)", valor: "el valor (p. ej. alta)", familia: "rojo | amarillo | verde" },
    arma: (c) => ({ hago: { agregar: A, campos: { [c.campo]: c.valor } }, veo: [{ en_item: A, contiene: [c.valor] }, { color_en_item: A, texto: c.valor, familia: c.familia }] }),
    necesita: (c) => (!isText(c.campo) || !isText(c.valor) ? `"campo" y "valor"` : !["rojo", "amarillo", "verde"].includes(c.familia) ? `"familia": rojo, amarillo o verde` : null),
  },
  no_borrar_en: {
    requiere: ["grupo"],
    dice: "RESTRICCIÓN: {un_item} que está en cierto {grupo} NO se puede borrar (se intenta y sigue ahí)",
    casilleros: { grupo: "{el_grupo} donde no se puede borrar" },
    arma: (c) => ({ dado: [{ agregar: A }, { mover: A, a: c.grupo }], hago: { eliminar: A }, veo: [{ esta: A, en: c.grupo }] }),
    necesita: (c, g) => (!isText(c.grupo) ? `"${palabra(g, "grupo")}"` : null),
  },
  orden_por_campo: {
    requiere: ["grupo"],
    dice: "en {un_grupo} los {items} se ordenan por un campo (y, si se pide, a igual valor primero el más reciente)",
    casilleros: { campo: "el campo (p. ej. prioridad)", valores: '["valor de arriba", …, "valor de abajo"]', grupo: "{el_grupo}", reciente_primero: "opcional: true si a igual valor va primero el más reciente" },
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
      return { dado, veo: [{ orden, en: c.grupo }] };
    },
    necesita: (c, g) => (!isText(c.campo) ? `"campo"` : list(c.valores).length < 2 ? `"valores": al menos 2, de arriba abajo` : !isText(c.grupo) ? `"${palabra(g, "grupo")}"` : null),
  },
};

// v0.2 (1ª corrida real con plantillas, 17/10): Qwen usó "orden_por_campo" y "al_pasar_mouse" en R15, que no habla de
// ordenar ni de pasar el mouse. Cada plantilla necesita que el requisito la NOMBRE (palabras en castellano o inglés).
export const PERTINENCIA = {
  crear: /crea|agreg|añad|anad|nuev|add\b/i, crear_con_campos: /crea|agreg|añad|anad|nuev|campo/i, editar: /edit|modific|cambi/i,
  borrar: /borr|elimin|quit|delet/i, no_borrar_en: /(sin|no|prohib|impedir|evitar)\b[^.]*(borr|elimin)/i, mover: /mov|arrastr|drag|solt/i, contador_al_crear: /contador|cantidad|counter|cuenta/i,
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
export function rowsFromChoices(choices, id, glosario) {
  const filas = [], problems = [];
  const ok = plantillasPara(glosario);
  (Array.isArray(choices) ? choices : []).forEach((ch0, i) => {
    const ch = eleccionATipos(ch0, glosario);
    const t = ok[ch?.plantilla];
    if (!t) { problems.push(`elección ${i + 1}: la plantilla "${ch?.plantilla}" no existe (usá: ${Object.keys(ok).join(", ")})`); return; }
    const falta = t.necesita?.(ch, glosario);
    if (falta) { problems.push(`elección ${i + 1} (${ch.plantilla}): falta ${falta}`); return; }
    filas.push({ r: id, ...t.arma(ch), _plantilla: ch.plantilla });
  });
  return { filas, problems };
}

export function systemPromptPlantillas(glosario) {
  const g = glosario, I = palabra(g, "item"), G = palabra(g, "grupo"), hasG = tiene(g, "grupo");
  // casilleros de grupo: se le muestran a Qwen con el nombre de la app ("columna"); los que la app no tiene, afuera
  const cas = (c) => (c === "grupo" ? G : c);
  const lines = Object.entries(plantillasPara(g)).map(([k, t]) => { const cs = Object.entries(t.casilleros).filter(([c]) => hasG || !["grupo", "solo_en", "desde"].includes(c)); return `- ${k}: ${conNombres(t.dice, g)}.${cs.length ? ` Casilleros: ${cs.map(([c, d]) => `"${cas(c)}" (${conNombres(d, g)})`).join(", ")}.` : ""}`; });
  return `Elegís cómo comprobar UN requisito de una app web usando PLANTILLAS. No escribís pruebas: decís qué plantillas aplican y completás sus casilleros. El sistema arma las pruebas y las corre en un navegador real.

Respondé SOLO con JSON: { "usa": [ { "plantilla": "nombre", …casilleros } ] }
o, si el requisito NO se puede comprobar usando la app (dice cómo está programada por dentro), { "sin_fila": "motivo corto" }.

Plantillas:
${lines.join("\n")}

Reglas:
1. SOLO lo que dice ESE requisito; no agregues cosas ni copies otros requisitos.
2. Nombres de ${hasG ? `${palabra(g, "grupo", true)}, ` : ""}palabras de botones, campos y valores: tal cual los escribió el usuario, sin comillas.
3. Si el requisito tiene varias partes (tres prioridades, colores de varias cosas), una elección por parte.
4. Si ninguna plantilla sirve, "sin_fila" con el motivo.

Ejemplos (otra app: recetas${hasG ? `, agrupadas en "Para probar" y "Favoritas"` : ""}; acá cada receta es ${un(g, "item")}).
${hasG ? `"Al borrar una receta desaparece y baja el contador de Favoritas" → { "usa": [ { "plantilla": "borrar", "${G}": "Favoritas" } ] }\n` : ""}"Las recetas tienen fondo #FFF8E7 y sombra" → { "usa": [ { "plantilla": "estilo", "de": "${I}", "prop": "background-color", "valor": "#FFF8E7" }, { "plantilla": "estilo", "de": "${I}", "prop": "box-shadow", "valor": "con sombra" } ] }
${hasG ? `"Se ordenan por dificultad: fácil arriba, difícil abajo" → { "usa": [ { "plantilla": "orden_por_campo", "campo": "dificultad", "valores": ["fácil", "difícil"], "${G}": "Para probar" } ] }\n` : ""}"Cada receta es un div 'card' con header y body" → { "sin_fila": "dice cómo está armada por dentro" }`;
}
