// text_terms.mjs — normalización y términos de contenido (determinista, sin LLM).
//
// Extraído tal cual de intent_mention_check.mjs (03/10) cuando ese chequeo se
// reemplazó por intent_brief.mjs: completeness_reviewer3.mjs (regla de cita)
// y term_coverage_check.mjs seguían usando norm/terms/synKey. Mismo código,
// mismo comportamiento; solo cambia de archivo.

export function norm(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Palabras de relleno / de la propia entrevista que no son contenido.
const STOP = new Set(
  (
    "para como cada debe deben tiene tienen tener hacer puede pueden seria solo " +
    "sobre entre desde hasta donde cuando porque tambien ademas algo algun alguna " +
    "algunos algunas otro otra otros otras mucho muchos poco pocos parte partes forma " +
    "cosa cosas quiero queria queres necesito seccion secciones pagina paginas landing " +
    "page empresa ficticia crear tipo tipos etc informacion suelen suele deberan debera " +
    "deberia mostrara mostrar presentara presentaran presentarse obtendra podra cambiar " +
    "vez busque actualizar unico unica sumo campo campos estar esta estan sera seran sus " +
    "uno una unos unas ellos ella este estos estas ese esa eso esos esas muy mas menos " +
    "bien usar usa usando ver dentro fuera cual cuales todo todos toda todas mismo misma " +
    "igual tal tales asi aca alli ahi gustaria podria sirva sirve agrega agregar agregá " +
    "tambien incluir incluye feature features atomicas atomica mantene resto demas"
  ).split(" "),
);

// Sinónimos mínimos para no avisar por diferencias de redacción obvias.
const SYN = [
  ["card", "cards", "tarjeta", "tarjetas"],
  ["menu", "carta"],
  ["carrousel", "carrusel", "carousel", "slider"],
  ["foto", "fotos", "imagen", "imagenes"],
  ["resena", "resenas", "review", "reviews", "testimonio", "testimonios"],
  ["precio", "precios", "costo", "costos"],
  ["panaderia", "panificados", "panes", "pasteleria"],
  ["contacto", "contactar"],
  ["nosotros", "historia"],
  ["login", "autenticacion", "ingreso"],
  ["carrito", "cart"],
];

export function synKey(w) {
  for (const g of SYN) if (g.some((s) => w.startsWith(s.slice(0, 5)))) return g[0];
  return w.slice(0, 5); // raíz de 5 letras: "catalogos" ~ "catalogo"
}

export function terms(t) {
  return [
    ...new Set((norm(t).match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOP.has(w))),
  ];
}
