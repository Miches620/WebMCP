// intent_mention_check.mjs — "Mencionaste y no incluí"
//
// Chequeo DETERMINISTA (sin LLM) que corre cuando Intent Forge devuelve
// COMPLETE: compara lo que el usuario dijo en la entrevista contra el
// refined_prompt resultante y devuelve las FRASES del usuario que tienen
// palabras de contenido que no aparecen en ningún lado del refined_prompt
// (ni como feature, ni en objetivo/criterios, ni como exclusión explícita).
//
// Origen: Project20 — el usuario pidió panadería, reseñas y precios, y el
// refined_prompt salió con 4 features sin ninguno de los tres. El reviewer
// dio GAP=0 porque se compara contra el refined_prompt ya recortado.
//
// Es heurístico a propósito: NO decide nada. Solo muestra frases para que
// el humano elija Incluir / Excluir a propósito / Falso aviso.

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

function synKey(w) {
  for (const g of SYN) if (g.some((s) => w.startsWith(s.slice(0, 5)))) return g[0];
  return w.slice(0, 5); // raíz de 5 letras: "catalogos" ~ "catalogo"
}

function terms(t) {
  return [
    ...new Set((norm(t).match(/[a-z0-9]{4,}/g) || []).filter((w) => !STOP.has(w))),
  ];
}

// Corta un mensaje en frases por . , ; y saltos de línea, sin cortar
// dentro de paréntesis ("cafés (lattes, capuccinos)" queda junto).
function splitPhrases(msg) {
  let depth = 0,
    cur = "";
  const parts = [];
  for (const ch of String(msg || "")) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[.,;\n]/.test(ch)) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * @param {string[]} userMessages  mensajes del usuario en la entrevista
 * @param {object}   refined        refined_prompt de Intent Forge
 * @param {object}   [opts]
 * @param {string[]} [opts.exclusiones]   frases que el usuario excluyó a propósito
 * @param {string[]} [opts.ignoradas]     frases marcadas como falso aviso
 * @returns {{phrase:string, missing:string[], message:number}[]}
 */
export function missingMentions(userMessages, refined, opts = {}) {
  const exclusiones = opts.exclusiones || [];
  const ignoradas = new Set((opts.ignoradas || []).map(norm));
  const rpText = [
    refined?.project_name,
    refined?.objetivo,
    ...(refined?.features || []),
    ...(refined?.criterios_holdout || []),
    ...exclusiones,
  ].join(" ");
  const have = new Set(terms(rpText).map(synKey));
  const out = [];
  const seen = new Set();
  (userMessages || []).forEach((msg, mi) => {
    for (const phrase of splitPhrases(msg)) {
      if (ignoradas.has(norm(phrase))) continue;
      const ts = terms(phrase);
      if (!ts.length) continue;
      const fresh = ts.filter((w) => !have.has(synKey(w)) && !seen.has(synKey(w)));
      if (!fresh.length) continue;
      fresh.forEach((w) => seen.add(synKey(w)));
      out.push({ phrase, missing: fresh, message: mi + 1 });
    }
  });
  return out;
}
