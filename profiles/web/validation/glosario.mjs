// glosario.mjs — GLOSARIO de la app (17/10, diseño de 3 capas acordado con Miche).
//
// Por qué: las plantillas y el juez de la planilla nacieron con el Kanban y tenían "tarjeta" y "columna" escritos en el
// código. Con 20 proyectos eso termina en un juez que "sabe de todo". Miche (17/10): "no quiero una plantilla multiuso,
// quiero algo funcional, escalable y bien diseñado".
//
// Las 3 capas:
//   1. Acciones y observaciones genéricas (planilla.mjs): agregar, editar, eliminar, mover, recargar, pasar_mouse;
//      esta, contiene, orden, contador, control, estilo… Un conjunto chico y cerrado.
//   2. Cómo se encuentran las cosas, como lo haría una persona: los TIPOS de abajo. Fijos.
//   3. El glosario (este módulo lo lee): un DATO de cada proyecto que dice cómo se llama cada tipo en esa app.
//      Kanban: { "item": "tarjeta", "grupo": "columna" }. Lo escribe Qwen (o Miche) y lo revisa Miche.
//
// El juez solo conoce tipos. Las filas pueden venir escritas con los nombres de la app ({ "columna": "Pendiente" }) y
// se traducen acá. Regla para que no vuelva el monstruo: un tipo o una acción nueva entra a las capas 1 y 2 solo si
// la piden 2 proyectos distintos (experiencia que se repite → conocimiento).

export const GLOSARIO_VERSION = "glosario v0.3"; // v0.3 (29/10): tipo "lugar"
// v0.2 (20/10, banco de 5 modelos escribiendo la planilla): el error que más se repitió fue probar "lo nuevo" en el grupo
// equivocado ("creo una tarjeta → sube el contador de En Curso"). "inicio" dice DÓNDE aparece lo que se crea (lo decide
// Miche en el glosario); las plantillas que crean usan ese grupo.

/** Los tipos que sabe encontrar el juez (capa 2). control y pagina no necesitan nombre: son iguales en toda app. */
export const TIPOS = {
  item: "lo que el usuario crea, edita y borra; se encuentra por su texto",
  grupo: "un contenedor con título que agrupa ítems; se encuentra por su título",
  // 29/10 (2º proyecto, hoja de cálculo): lo que YA está en la pantalla y no crea el usuario; se nombra por su columna
  // y su fila, como lo lee una persona ("A1"). Excepción consciente a la regla de los 2 proyectos (ver CAMBIOS): no es
  // un tipo de dominio sino la forma de nombrar un lugar en cualquier grilla o tabla.
  lugar: "un lugar fijo de una grilla o tabla (no lo crea el usuario); se encuentra por el encabezado de su columna y el de su fila",
};
const GENERICO = { item: "elemento", grupo: "grupo", lugar: null };

const nrm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const plural = (w) => (/[aeiou]$/i.test(w) ? `${w}s` : `${w}es`);

/** Revisa un glosario. Devuelve { ok, problems[], glosario } (con los tipos que faltan en genérico). */
export function leerGlosario(g) {
  const p = [];
  if (g != null && (typeof g !== "object" || Array.isArray(g))) return { ok: false, problems: ["el glosario es un objeto { tipo: nombre }"], glosario: { ...GENERICO } };
  for (const [k, v] of Object.entries(g || {})) {
    if (k === "inicio") { if (typeof v !== "string" || !v.trim() || v.length > 40) p.push(`inicio: el nombre del grupo donde aparece lo que se crea (p. ej. el primero)`); continue; }
    if (!TIPOS[k]) p.push(`"${k}" no es un tipo (tipos: ${Object.keys(TIPOS).join(", ")}, y "inicio")`);
    else if (v !== null && (typeof v !== "string" || !/^[\p{L} ]{2,30}$/u.test(v.trim()))) p.push(`${k}: "${v}" tiene que ser una palabra (el nombre en singular), o null si la app no tiene ese tipo`);
  }
  // null = la app no tiene ese tipo (p. ej. una hoja de cálculo no tiene grupos): las plantillas que lo necesitan no se ofrecen
  return { ok: !p.length, problems: p, glosario: { ...GENERICO, ...Object.fromEntries(Object.entries(g || {}).filter(([k, v]) => TIPOS[k] && (typeof v === "string" || v === null)).map(([k, v]) => [k, v === null ? null : v.trim().toLowerCase()])), ...(typeof g?.inicio === "string" && g.inicio.trim() ? { inicio: g.inicio.trim() } : {}) } };
}

/** El nombre de un tipo en esta app ("tarjeta"), o en plural ("tarjetas"). */
export function palabra(g, tipo, pl = false) {
  const w = leerGlosario(g).glosario[tipo] || tipo;
  return pl ? plural(w) : w;
}

/** ¿La app tiene este tipo? (control y pagina, siempre) */
export function tiene(g, tipo) {
  return tipo === "control" || tipo === "pagina" || leerGlosario(g).glosario[tipo] != null;
}

/** ¿Qué tipo es esta palabra? Acepta el tipo mismo, el nombre de la app y su plural. null si no es ninguno. */
export function tipoDe(g, word) {
  const w = nrm(word);
  if (!w) return null;
  if (TIPOS[w]) return w;
  const gl = leerGlosario(g).glosario;
  for (const [t, name] of Object.entries(gl)) if (name && (w === nrm(name) || w === nrm(plural(name)))) return t;
  return null;
}

/** Una regex que reconoce "<nombre del tipo> Algo" al principio (p. ej. "columna Pendiente"). */
export function prefijoDe(g, tipo) {
  const name = nrm(palabra(g, tipo));
  return new RegExp(`^(${name}|${nrm(plural(name))}|${tipo}s?)\\s+`, "i");
}

/** estilo.de escrito con los nombres de la app ({ "columna": "Pendiente" }) → con tipos ({ "grupo": "Pendiente" }). */
export function deATipos(de, g) {
  if (!de || typeof de !== "object" || Array.isArray(de)) return de;
  const out = {};
  for (const [k, v] of Object.entries(de)) { const t = k === "control" ? "control" : tipoDe(g, k); out[t || k] = v; }
  return out;
}

/** Una fila con los nombres de la app → con tipos (lo único que lleva nombres es estilo.de). Pura; no toca la original. */
export function filaATipos(row, g) {
  if (!row || typeof row !== "object" || !Array.isArray(row.veo) || !row.veo.some((v) => v?.estilo?.de && typeof v.estilo.de === "object")) return row;
  return { ...row, veo: row.veo.map((v) => (v?.estilo?.de && typeof v.estilo.de === "object" ? { ...v, estilo: { ...v.estilo, de: deATipos(v.estilo.de, g) } } : v)) };
}

/** Clases que suelen marcar un ítem en cualquier app, más el nombre que le da esta app (p. ej. "tarjeta", "receta"). */
const ITEM_WORDS = ["card", "item", "task", "note", "ticket"];
export function itemClassRe(g) {
  const name = nrm(palabra(g, "item")).replace(/[^a-z]/g, "");
  const ws = [...new Set([...ITEM_WORDS, ...(name ? [name] : [])])];
  return new RegExp(`(^|[-_])(${ws.join("|")})$`, "i");
}
