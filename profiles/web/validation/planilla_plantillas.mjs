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

export const PLANTILLAS_VERSION = "planilla_plantillas v0.7"; // v0.7 (29/10): lugares (escribir_y_ver, seleccionar_y_usar, grilla); las de ítems piden "item"; boton_en solo con texto entre comillas // v0.6 (22/10): se_ve_en_item, centrado, mover con manija
// v0.5 (19/10, 1ª corrida de npm run proyecto con project26): (a) una RESTRICCIÓN no se prueba con una plantilla que
// HACE lo prohibido (R28: "Sin … eliminar tarjetas en Completa" salió como "borro y desaparece", lo contrario);
// (b) "se ven estos textos" solo con textos que el usuario puso ENTRE COMILLAS en ese requisito (salían "contador de
// tarjetas dentro de la columna" o "Crear nuevas tarjetas", que son descripciones, no textos de la pantalla);
// (c) confirmar_al_borrar: la pregunta que aparece al borrar, antes de confirmar (R7 y R26 salían como texto fijo).
// v0.4 (19/10): las RESTRICCIONES de Miche también se prueban ("no se puede borrar en Completa"): no_borrar_en.
// v0.3 (17/10, diseño de 3 capas con Miche): las plantillas hablan de TIPOS (item, grupo). El pedido a Qwen se escribe con
// los nombres del glosario de la app ("tarjeta", "columna") y lo que Qwen contesta con esos nombres se traduce a tipos.
// Una plantilla que necesita un tipo que la app no tiene (glosario: "grupo": null) no se ofrece.
import { palabra, tiene, tipoDe, leerGlosario } from "./glosario.mjs";
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
// 20/10: Qwen manda los nombres en "campos" (lista) y los valores aparte ("valor_nuevo": {"prioridad": "alta"}); se juntan
const VALORES_APARTE = ["valor_nuevo", "valores_nuevos", "valor", "valores", "nuevos"];
export function juntaCampos(c) {
  const base = Array.isArray(c?.campos) ? Object.fromEntries(c.campos.map((k) => [String(k), ""])) : c?.campos && typeof c.campos === "object" ? { ...c.campos } : {};
  for (const k of VALORES_APARTE) { const v = c?.[k]; if (v && typeof v === "object" && !Array.isArray(v)) for (const [n, x] of Object.entries(v)) { const m = Object.keys(base).find((b) => b.trim().toLowerCase() === n.trim().toLowerCase()) || n; base[m] = x; } }
  return base;
}
const list = (x) => (Array.isArray(x) ? x : isText(x) ? [x] : []).map(String).map((s) => s.trim()).filter(Boolean);
// artículos: "la columna" / "el grupo". Sin saber el género, se deduce de la última letra (alcanza para el pedido).
const fem = (w) => /a$|ion$|ión$|dad$/i.test(w);
const art = (g, tipo) => { const w = palabra(g, tipo); return `${fem(w) ? "la" : "el"} ${w}`; };
const un = (g, tipo) => { const w = palabra(g, tipo); return `${fem(w) ? "una" : "un"} ${w}`; };
/** Los textos de una plantilla con los nombres de la app: {un_item}, {el_grupo}, {items}, {grupo}… ([[…]] solo si la app tiene grupos) */
export function conNombres(txt, g) {
  return String(txt).replace(/\[\[(.*?)\]\]/g, (_, x) => (tiene(g, "grupo") ? x : ""))
    .replace(/\{un_(item|grupo|lugar)\}/g, (_, t) => un(g, t)).replace(/\{el_(item|grupo|lugar)\}/g, (_, t) => art(g, t))
    .replace(/\{otro_grupo\}/g, () => { const w = palabra(g, "grupo"); return `${fem(w) ? "otra" : "otro"} ${w}`; })
    .replace(/\{(item|grupo|lugar)s\}/g, (_, t) => palabra(g, t, true)).replace(/\{(item|grupo|lugar)\}/g, (_, t) => palabra(g, t));
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
    requiere: ["item"],
    dice: "se puede crear {un_item}[[ (y aparece en {un_grupo})]]",
    casilleros: { grupo: "opcional: dónde tiene que aparecer" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ esta: A, ...(c.grupo ? { en: c.grupo } : {}) }] }),
  },
  crear_con_campos: {
    requiere: ["item"],
    dice: "al crear se cargan campos y {el_item} los muestra",
    casilleros: { campos: '{ "nombre del campo": "valor de ejemplo" } (descripcion, prioridad…; el título no)' },
    arma: (c) => { const { campos } = camposDe(juntaCampos(c)); return { hago: { agregar: A, campos }, veo: [{ en_item: A, contiene: Object.values(campos) }] }; },
    necesita: (c) => { const { campos, faltan } = camposDe(juntaCampos(c)); return faltan.length ? `un valor de ejemplo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : !Object.keys(campos).length ? `"campos" con al menos un campo (que no sea el título) y su valor` : null; },
  },
  editar: {
    requiere: ["item"],
    dice: "se puede editar {un_item} (el texto nuevo queda y el viejo no)",
    casilleros: { campos: "opcional: campos que se cambian al editar, con el valor nuevo" },
    arma: (c) => { const { campos } = camposDe(juntaCampos(c)); const has = Object.keys(campos).length > 0; return { dado: [{ agregar: A }], hago: { editar: A, a: B, ...(has ? { campos } : {}) }, veo: [{ esta: B }, { no_esta: A }, ...(has ? [{ en_item: B, contiene: Object.values(campos) }] : [])] }; },
    necesita: (c) => { const { faltan } = camposDe(juntaCampos(c)); return faltan.length ? `un valor nuevo para ${faltan.map((k) => `"${k}"`).join(", ")} (uno de los que nombra el usuario)` : null; },
  },
  borrar: {
    requiere: ["item"],
    dice: "se puede borrar {un_item} (desaparece; si hay contador, baja)",
    casilleros: { grupo: "opcional: {el_grupo} cuyo contador baja" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { eliminar: A }, veo: [{ no_esta: A }, ...(c.grupo ? [{ contador: c.grupo, cambia: -1 }] : [])] }),
  },
  mover: {
    requiere: ["item", "grupo"],
    // 23/10 (R32 ×3): Qwen mandaba "a": "Pendiente, En Curso, Completa" cuando el pedido no nombra un destino; se toma
    // el primero que no es donde aparece lo nuevo, y "desde" con lista se descarta
    ajusta: (c, g) => { const ini = leerGlosario(g).glosario.inicio, sep = (x) => String(x).split(/\s*(?:,|\by\b|\/)\s*/).map((t) => t.trim()).filter(Boolean); const out = { ...c }; if (isText(c.a) && sep(c.a).length > 1) out.a = sep(c.a).find((x) => !mismo(x, ini)) || sep(c.a)[0]; if (isText(c.desde) && sep(c.desde).length > 1) delete out.desde; return out; },
    dice: "{un_item} se mueve (arrastrando o con un control) a {otro_grupo}",
    casilleros: { a: "{el_grupo} de destino", desde: "opcional: {el_grupo} de origen (para los contadores)", manija: "opcional: SOLO si el usuario escribe el símbolo o texto de donde se agarra para arrastrar (p. ej. ⠿), tal cual" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { mover: A, a: c.a, ...(isText(c.manija) ? { manija: c.manija.trim() } : {}) }, veo: [{ esta: A, en: c.a }, ...(c.desde ? [{ contador: c.desde, cambia: -1 }, { contador: c.a, cambia: 1 }] : [])] }),
    necesita: (c, g) => (!isText(c.a) ? `"a": ${art(g, "grupo")} de destino` : null),
  },
  contador_al_crear: {
    requiere: ["item", "grupo"],
    dice: "{un_grupo} muestra la cantidad de {items} que tiene y sube al crear",
    casilleros: { grupo: "{el_grupo} con contador" },
    arma: (c) => ({ hago: { agregar: A }, veo: [{ contador: c.grupo, cambia: 1 }] }),
    necesita: (c, g) => (!isText(c.grupo) ? `"${palabra(g, "grupo")}"` : null),
  },
  recargar_sigue: {
    dice: "lo creado sigue después de recargar la página (se guarda)",
    casilleros: {},
    // 29/10: en una app de lugares (sin ítems que se crean) se escribe en un lugar y se mira que siga ahí
    arma: (c, g) => (tiene(g, "item") || !tiene(g, "lugar") ? { dado: [{ agregar: A }], hago: { recargar: true }, veo: [{ esta: A }] } : { dado: [{ escribir: A, en: "B2" }], hago: { recargar: true }, veo: [{ muestra: A, en: "B2" }] }),
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
    requiere: ["item"],
    dice: "algo aparece en {el_item} solo al pasar el mouse por encima",
    casilleros: { textos: '["lo que aparece", …] (íconos o palabras)' },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { pasar_mouse: A }, veo: [{ al_pasar: list(c.textos), en_item: A }] }),
    necesita: (c) => (!list(c.textos).length ? `"textos": lo que aparece` : null),
  },
  estilo: {
    dice: "una cosa tiene un estilo medible: color de fondo, color, ancho, alto, padding, borde, redondeo, sombra, scroll",
    casilleros: { de: '"pagina" | [["{grupo}" | ]]"{item}" | "boton"', nombre: "[[si es {grupo}: su nombre; ]]si es botón: sus palabras", prop: "background-color | color | width | height | padding | border-top-style | border-top-left-radius | box-shadow | overflow-y", valor: '"#rrggbb", "Npx", una palabra (dashed, scroll), o "con sombra"' },
    arma: (c, g) => {
      // 20/10: "columnas con overflow:scroll" quiere decir que la columna scrollea. Mirar solo el estilo dejaba pasar la app
      // del 19/10 (la columna crecía y scrolleaba la página; lo vio Miche). Con "inicio" se prueba lo que pasa: 10 ítems
      // (llevados a esa columna si no es donde aparecen) → scrollea adentro y entra en la ventana.
      const ini = g ? leerGlosario(g).glosario.inicio : null;
      if (c.de === "grupo" && c.prop === "overflow-y" && /scroll|auto/i.test(String(c.valor)) && ini && isText(c.nombre)) {
        const n = String(c.nombre).trim(), llenos = Array.from({ length: 10 }, (_, i) => `QA Lleno ${i + 1}`);
        return { dado: [...llenos.map((x) => ({ agregar: x })), ...(mismo(n, ini) ? [] : llenos.map((x) => ({ mover: x, a: n })))], veo: [{ desborde: n }] };
      }
      const de = c.de === "pagina" ? "pagina" : c.de === "grupo" ? { grupo: c.nombre } : c.de === "boton" ? { control: list(c.nombre).flatMap((x) => x.split(/\s+/)) } : { item: A };
      const valor = /sombra/i.test(String(c.valor)) ? { distinto: "none" } : c.prop === "overflow-y" && /scroll/i.test(String(c.valor)) ? ["scroll", "auto"] : c.valor;
      return { ...(c.de === "item" ? { dado: [{ agregar: A }] } : {}), veo: [{ estilo: { de, prop: c.prop, valor } }] };
    },
    necesita: (c, g) => (!["pagina", "grupo", "item", "boton"].includes(c.de) ? `"de": pagina, ${palabra(g, "grupo")}, ${palabra(g, "item")} o boton` : (c.de === "grupo" || c.de === "boton") && !list(c.nombre).length ? `"nombre": ${c.de === "grupo" ? `el nombre de ${art(g, "grupo")}` : "las palabras del botón"}` : !isText(c.prop) ? `"prop"` : !isText(c.valor) ? `"valor"` : null),
  },
  color_segun_valor: {
    requiere: ["item"],
    dice: "{el_item} se pinta de un color según el valor de un campo (p. ej. prioridad alta = rojo)",
    casilleros: { campo: "el campo (p. ej. prioridad)", valor: "el valor (p. ej. alta)", familia: "rojo | amarillo | verde" },
    arma: (c) => ({ hago: { agregar: A, campos: { [c.campo]: c.valor } }, veo: [{ en_item: A, contiene: [c.valor] }, { color_en_item: A, texto: c.valor, familia: c.familia }] }),
    necesita: (c) => (!isText(c.campo) || !isText(c.valor) ? `"campo" y "valor"` : !["rojo", "amarillo", "verde"].includes(c.familia) ? `"familia": rojo, amarillo o verde` : null),
  },
  confirmar_al_borrar: {
    requiere: ["item"],
    dice: "al borrar {un_item} aparece una pregunta de confirmación con cierto texto (antes de confirmar)",
    casilleros: { texto: "el texto de la pregunta, tal cual lo escribió el usuario" },
    arma: (c) => ({ dado: [{ agregar: A }], hago: { eliminar: A }, veo: [{ pregunta: String(c.texto).trim() }, { no_esta: A }] }),
    necesita: (c) => (!isText(c.texto) ? `"texto": la pregunta, tal cual` : null),
  },
  no_borrar_en: {
    requiere: ["item", "grupo"],
    dice: "RESTRICCIÓN: {un_item} que está en cierto {grupo} NO se puede borrar (se intenta y sigue ahí)",
    casilleros: { grupo: "{el_grupo} donde no se puede borrar", mensaje: "opcional: SOLO si el usuario escribe entre comillas el mensaje que se muestra al intentarlo, tal cual" },
    // 23/10 (R33): "al intentar eliminar en 'Completa', mostrar el mensaje '…'" → además del "sigue ahí", el mensaje aparece al apretar borrar
    arma: (c) => ({ dado: [{ agregar: A }, { mover: A, a: c.grupo }], hago: { eliminar: A }, veo: [...(isText(c.mensaje) ? [{ pregunta: String(c.mensaje).trim() }] : []), { esta: A, en: c.grupo }] }),
    necesita: (c, g) => (!isText(c.grupo) ? `"${palabra(g, "grupo")}"` : null),
  },
  // 22/10: un símbolo o texto que se ve SIEMPRE dentro de cada ítem (la manija ⠿ de project26: R6 quedaba sin prueba)
  se_ve_en_item: {
    requiere: ["item"],
    dice: "dentro de {un_item} se ve siempre (sin pasar el mouse) un símbolo o texto que el usuario escribió",
    casilleros: { textos: '["⠿", …] (tal cual los escribió el usuario)' },
    arma: (c) => ({ dado: [{ agregar: A }], veo: [{ en_item: A, contiene: list(c.textos) }] }),
    necesita: (c) => (!list(c.textos).length ? `"textos": lo que se ve adentro` : null),
  },
  // 22/10 (Miche: "no se ven centradas las columnas"): mismo espacio libre a la izquierda y a la derecha
  centrado: {
    dice: "algo queda centrado en la página, de izquierda a derecha (mismo espacio libre a cada lado)",
    casilleros: { de: '[["{grupo}s" (todos juntos) | ]]"boton"', nombre: "si es botón: sus palabras" },
    arma: (c) => ({ veo: [{ centrado: c.de === "boton" ? { control: list(c.nombre).flatMap((x) => x.split(/\s+/)) } : "grupos" }] }),
    necesita: (c, g) => (c.de === "boton" ? (!list(c.nombre).length ? `"nombre": las palabras del botón` : null) : !["grupos", "grupo"].includes(c.de) ? `"de": "${palabra(g, "grupo", true)}" (todos juntos) o "boton"` : !tiene(g, "grupo") ? "esta app no tiene grupos" : null),
  },
  orden_por_campo: {
    requiere: ["item", "grupo"],
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
  // ---------- 29/10 (2º proyecto, hoja de cálculo): LUGARES que ya existen, con acciones de persona ----------
  escribir_y_ver: {
    requiere: ["lugar"],
    dice: "escribo algo en {un_lugar} (un texto, un número o una fórmula) y {un_lugar} muestra lo que tiene que mostrar (el texto, o el resultado)",
    casilleros: { antes: 'opcional: lo que ya está escrito antes, { "A1": "2", "A2": "3" }', en: '{el_lugar} donde escribo, por su columna y su fila (p. ej. "A3")', escribo: "lo que escribo, tal cual", muestra: "lo que tiene que mostrar (el resultado, si es una cuenta)", muestra_en: "opcional: dónde se ve, si no es donde escribo" },
    arma: (c) => {
      const antes = c.antes && typeof c.antes === "object" && !Array.isArray(c.antes) ? Object.entries(c.antes).map(([k, v]) => ({ escribir: String(v), en: k.trim().toUpperCase() })) : [];
      let esc = String(c.escribo), mu = String(c.muestra ?? "");
      // un texto suelto (no una cuenta) se cambia por uno de prueba, para que valga con cualquier texto
      if (!esc.trim().startsWith("=") && mu === esc && !/^-?[\d.,]+$/.test(esc.trim())) { esc = A; mu = A; }
      return { ...(antes.length ? { dado: antes } : {}), hago: { escribir: esc, en: String(c.en).trim().toUpperCase() }, veo: [{ muestra: mu, en: String(c.muestra_en || c.en).trim().toUpperCase() }] };
    },
    necesita: (c, g) => (!CELDA.test(String(c.en || "").trim()) ? `"en": ${art(g, "lugar")} donde se escribe, por su columna y su fila (p. ej. A3)` : !isText(String(c.escribo ?? "")) ? `"escribo": lo que se escribe` : c.muestra == null || typeof c.muestra === "object" ? `"muestra": lo que tiene que mostrar` : c.muestra_en && !CELDA.test(String(c.muestra_en).trim()) ? `"muestra_en": por su columna y su fila (p. ej. B1)` : c.antes && (typeof c.antes !== "object" || Array.isArray(c.antes) || !Object.keys(c.antes).every((k) => CELDA.test(k.trim()))) ? `"antes": { "A1": "valor", … } (por columna y fila)` : null),
  },
  seleccionar_y_usar: {
    requiere: ["lugar"],
    dice: "selecciono {un_lugar}, una columna o una fila (con un clic en ella, en su letra o en su número) y uso un control: borrar, vaciar (borra el contenido y deja el lugar), ocultar o color (de fondo)",
    casilleros: { seleccion: '"C" (una columna), "3" (una fila) o "A1" ({un_lugar})', accion: "borrar | vaciar | ocultar | color", color: "opcional: SOLO si el usuario dice el color, #rrggbb" },
    arma: (c) => {
      const sel = String(c.seleccion).trim().toUpperCase(), m = /^([A-Z]{1,3})?(\d{1,4})?$/.exec(sel), col = m[1], fil = m[2];
      const lugares = col && fil ? [sel] : col ? [`${col}1`, `${col}2`] : [`A${fil}`, `B${fil}`];
      const textos = [A, B].slice(0, lugares.length);
      let accion = String(c.accion).trim().toLowerCase();
      if (accion === "borrar" && col && fil) accion = "vaciar"; // borrar UNA celda es borrarle lo que tiene
      if (accion === "color") { const valor = /^#[0-9a-f]{6}$/i.test(String(c.color || "")) ? c.color : COLOR_PRUEBA; return { dado: [{ clic: sel }], hago: { usar: "color", valor }, veo: lugares.map((l) => ({ fondo: valor, en: l })) }; }
      const dado = [...lugares.map((l, i) => ({ escribir: textos[i], en: l })), { clic: sel }];
      if (accion === "vaciar") return { dado, hago: { usar: "vaciar" }, veo: lugares.map((l) => ({ muestra: "", en: l })) };
      return { dado, hago: { usar: accion }, veo: [...textos.map((t) => ({ no_esta: t })), ...(accion === "ocultar" && !(col && fil) ? [{ oculta: sel }] : [])] };
    },
    necesita: (c) => (!/^([A-Z]{1,3}\d{1,4}|[A-Z]{1,3}|\d{1,4})$/i.test(String(c.seleccion || "").trim()) ? `"seleccion": una columna ("C"), una fila ("3") o un lugar ("A1")` : !["borrar", "vaciar", "ocultar", "color"].includes(String(c.accion || "").trim().toLowerCase()) ? `"accion": borrar, vaciar, ocultar o color` : null),
  },
  grilla: {
    requiere: ["lugar"],
    dice: "la pantalla muestra una grilla de {lugars} con encabezados: letras arriba (columnas) y números al costado (filas)",
    casilleros: { columnas: '"A-J" (de cuál a cuál)', filas: '"1-20" (de cuál a cuál)' },
    arma: (c) => ({ veo: [{ encabezados: { columnas: rangoLetras(c.columnas), filas: rangoNumeros(c.filas) } }] }),
    necesita: (c) => (!rangoLetras(c.columnas).length ? `"columnas": de cuál a cuál, p. ej. "A-J"` : !rangoNumeros(c.filas).length ? `"filas": de cuál a cuál, p. ej. "1-20"` : null),
  },
};
const CELDA = /^[A-Za-z]{1,3}\d{1,4}$/;
const COLOR_PRUEBA = "#ffcc00";
function rangoLetras(x) {
  const m = /^\s*([A-Za-z])\s*(?:-|a|…|\.\.)\s*([A-Za-z])\s*$/.exec(String(x || ""));
  if (!m) return [];
  const a = m[1].toUpperCase().charCodeAt(0), b = m[2].toUpperCase().charCodeAt(0);
  return b >= a && b - a < 26 ? Array.from({ length: b - a + 1 }, (_, i) => String.fromCharCode(a + i)) : [];
}
function rangoNumeros(x) {
  const m = /^\s*(\d{1,4})\s*(?:-|a|…|\.\.)\s*(\d{1,4})\s*$/.exec(String(x || ""));
  if (!m) return [];
  const a = Number(m[1]), b = Number(m[2]);
  return b >= a && b - a < 500 ? Array.from({ length: b - a + 1 }, (_, i) => String(a + i)) : [];
}

// v0.2 (1ª corrida real con plantillas, 17/10): Qwen usó "orden_por_campo" y "al_pasar_mouse" en R15, que no habla de
// ordenar ni de pasar el mouse. Cada plantilla necesita que el requisito la NOMBRE (palabras en castellano o inglés).
export const PERTINENCIA = {
  crear: /crea|agreg|añad|anad|nuev|add\b/i, crear_con_campos: /crea|agreg|añad|anad|nuev|campo/i, editar: /edit|modific|cambi/i,
  borrar: /borr|elimin|quit|delet/i, confirmar_al_borrar: /confirm|seguro|pregunt|consult/i, no_borrar_en: /(sin|no|prohib|impedir|evitar|intent)\w*\b[^.]*(borr|elimin)/i, mover: /mov|arrastr|drag|solt/i, contador_al_crear: /contador|cantidad|counter|cuenta/i,
  recargar_sigue: /guard|recarg|persist|localstorage|se mantien|no se pierd/i, al_pasar_mouse: /hover|pasar|mouse|encima/i,
  orden_por_campo: /orden|priori|arriba|abajo|primer|recient|descend|ascend/i, color_segun_valor: /color|rojo|verde|amarill|azul/i,
  centrado: /centr|al medio|alinead/i, se_ve_en_item: /muestr|se ve|[ií]cono|s[ií]mbolo|manija|[^\p{L}\p{N}\s.,;:()'"¿?¡!\-–\/&#%+=*<>]/u,
  escribir_y_ver: /escrib|edit|f[oó]rmula|funci|suma|rest|multipl|divi|=|resultado|calcul|inline|clic|valor|actualiz/i,
  seleccionar_y_usar: /selecc|borr|elimin|vac[ií]|ocult|color|pint|fondo|column|fila/i,
  grilla: /column|fila|grilla|tabla|encabez|letra|n[uú]mero/i,
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
  // v0.5: una restricción ("Restricción: …", "Sin …", "No …") no se prueba HACIENDO lo prohibido
  const RESTR = /^\s*(restricci[oó]n\s*:\s*)?(sin|no|nunca|prohib)/i;
  const POSITIVAS = new Set(["crear", "crear_con_campos", "editar", "borrar", "mover"]);
  if (RESTR.test(String(text0).replace(/^\s*restricci[oó]n\s*:\s*/i, "")) || /^\s*restricci[oó]n\s*:/i.test(String(text0))) (Array.isArray(choices) ? choices : []).forEach((ch, i) => { if (POSITIVAS.has(ch?.plantilla)) p.push(`elección ${i + 1} (${ch.plantilla}): es una RESTRICCIÓN (algo que NO tiene que pasar); no se prueba haciéndolo. Usá una plantilla que pruebe que no se puede (p. ej. no_borrar_en) o "sin_fila"`); });
  // v0.5: "se ven estos textos" solo con lo que el usuario puso entre comillas en este requisito
  const citados = [...String(text0).matchAll(/(['"“‘«])(.+?)(['"”’»])/g)].map((m) => m[2].trim().toLowerCase());
  // 29/10 (hoja de cálculo): "hay un botón que dice 'Ocultar Columna'" sin que el usuario lo dijera: un botón es un CÓMO
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => { if (ch?.plantilla === "boton_en") { const fuera = list(ch.palabras).filter((x) => !citados.some((c) => c.includes(x.toLowerCase()))); if (fuera.length) p.push(`elección ${i + 1} (boton_en): ${fuera.map((x) => `"${x}"`).join(", ")} no lo escribió el usuario entre comillas como el texto de un botón: decir qué botón hay es el CÓMO; usá la plantilla de lo que hace`); } });
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => { if (ch?.plantilla === "se_ven_textos") { const fuera = list(ch.textos).filter((x) => !citados.some((c) => c === x.toLowerCase() || c.includes(x.toLowerCase()))); if (fuera.length) p.push(`elección ${i + 1} (se_ven_textos): ${fuera.map((x) => `"${x}"`).join(", ")} no está entre comillas en el requisito: solo se prueban textos que el usuario citó (lo demás es una descripción, no un texto de la pantalla)`); } });
  (Array.isArray(choices) ? choices : []).forEach((ch, i) => {
    const escritos = ch?.plantilla === "se_ve_en_item" ? list(ch.textos) : ch?.plantilla === "mover" && isText(ch.manija) ? [ch.manija.trim()] : ch?.plantilla === "no_borrar_en" && isText(ch.mensaje) ? [ch.mensaje.trim()] : [];
    const fuera = escritos.filter((x) => !said.includes(x.toLowerCase()));
    if (fuera.length) p.push(`elección ${i + 1} (${ch.plantilla}): ${fuera.map((x) => `"${x}"`).join(", ")} no está escrito en el requisito: solo lo que escribió el usuario, tal cual`);
  });
  if (STYLE_WORDS.test(String(text0)) && !used.has("estilo")) p.push(`AVISO: el requisito nombra estilos medibles (${String(text).match(STYLE_WORDS)[0]}…): agregá una elección "estilo" por cada uno`);
  return p;
}

// glosario v0.2: lo que se crea aparece en "inicio"; una prueba que crea y mira otro grupo prueba algo imposible
const mismo = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
function fueraDelInicio(ch, g) {
  const ini = leerGlosario(g).glosario.inicio;
  if (!ini) return null;
  const donde = { crear: ch.grupo, contador_al_crear: ch.grupo, borrar: ch.grupo, orden_por_campo: ch.grupo, mover: ch.desde }[ch.plantilla];
  if (donde && !mismo(donde, ini)) return `${palabra(g, "grupo")} "${donde}": lo que se crea aparece en "${ini}" (usá "${ini}")`;
  if (ch.plantilla === "mover" && mismo(ch.a, ini)) return `"a": "${ini}" es donde ya aparece lo que se crea; elegí otr${/a$/.test(palabra(g, "grupo")) ? "a" : "o"} ${palabra(g, "grupo")}`;
  return null;
}

/** Lo que eligió Qwen → filas (sin validar todavía) + problemas por elección. Función pura. */
export function rowsFromChoices(choices, id, glosario) {
  const filas = [], problems = [];
  const ok = plantillasPara(glosario);
  (Array.isArray(choices) ? choices : []).forEach((ch0, i) => {
    let ch = eleccionATipos(ch0, glosario);
    const t = ok[ch?.plantilla];
    if (t?.ajusta) ch = t.ajusta(ch, glosario);
    if (!t) { problems.push(`elección ${i + 1}: la plantilla "${ch?.plantilla}" no existe (usá: ${Object.keys(ok).join(", ")})`); return; }
    const falta = t.necesita?.(ch, glosario) || fueraDelInicio(ch, glosario);
    if (falta) { problems.push(`elección ${i + 1} (${ch.plantilla}): falta ${falta}`); return; }
    filas.push({ r: id, ...t.arma(ch, glosario), _plantilla: ch.plantilla });
  });
  return { filas, problems };
}

export function systemPromptPlantillas(glosario) {
  const g = glosario, I = palabra(g, "item"), G = palabra(g, "grupo"), hasG = tiene(g, "grupo");
  // casilleros de grupo: se le muestran a Qwen con el nombre de la app ("columna"); los que la app no tiene, afuera
  const cas = (c) => (c === "grupo" ? G : c);
  const lines = Object.entries(plantillasPara(g)).map(([k, t]) => { const cs = Object.entries(t.casilleros).filter(([c]) => hasG || !["grupo", "solo_en", "desde"].includes(c)); return `- ${k}: ${conNombres(t.dice, g)}.${cs.length ? ` Casilleros: ${cs.map(([c, d]) => `"${cas(c)}" (${conNombres(d, g)})`).join(", ")}.` : ""}`; });
  const hasL = tiene(g, "lugar") && !tiene(g, "item"), L = palabra(g, "lugar");
  const ejemplos = hasL ? `Ejemplos (otra app: una tabla de notas de alumnos, con letras arriba y números al costado; acá cada casillero es ${un(g, "lugar")}).
"Se puede escribir en cualquier ${L}" → { "usa": [ { "plantilla": "escribir_y_ver", "en": "B2", "escribo": "Ana", "muestra": "Ana" } ] }
"El promedio con =PROMEDIO(A1:A2) muestra el resultado" → { "usa": [ { "plantilla": "escribir_y_ver", "antes": { "A1": "6", "A2": "8" }, "en": "A3", "escribo": "=PROMEDIO(A1:A2)", "muestra": "7" } ] }
"Si cambia una nota, el promedio se actualiza" → { "usa": [ { "plantilla": "escribir_y_ver", "antes": { "A1": "6", "A2": "8", "A3": "=PROMEDIO(A1:A2)" }, "en": "A1", "escribo": "10", "muestra": "9", "muestra_en": "A3" } ] }
"Se puede ocultar una columna" → { "usa": [ { "plantilla": "seleccionar_y_usar", "seleccion": "B", "accion": "ocultar" } ] }
"Pintar el fondo de una fila" → { "usa": [ { "plantilla": "seleccionar_y_usar", "seleccion": "2", "accion": "color" } ] }
"Cada ${L} es un <td> con un input" → { "sin_fila": "dice cómo está armada por dentro" }` : null;
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

${ejemplos || `Ejemplos (otra app: recetas${hasG ? `, agrupadas en "Para probar" y "Favoritas"` : ""}; acá cada receta es ${un(g, "item")}).
${hasG ? `"Al borrar una receta desaparece y baja el contador de Favoritas" → { "usa": [ { "plantilla": "borrar", "${G}": "Favoritas" } ] }\n` : ""}"Las recetas tienen fondo #FFF8E7 y sombra" → { "usa": [ { "plantilla": "estilo", "de": "${I}", "prop": "background-color", "valor": "#FFF8E7" }, { "plantilla": "estilo", "de": "${I}", "prop": "box-shadow", "valor": "con sombra" } ] }
${hasG ? `"Se ordenan por dificultad: fácil arriba, difícil abajo" → { "usa": [ { "plantilla": "orden_por_campo", "campo": "dificultad", "valores": ["fácil", "difícil"], "${G}": "Para probar" } ] }\n` : ""}"Cada receta es un div 'card' con header y body" → { "sin_fila": "dice cómo está armada por dentro" }`}`;
}
