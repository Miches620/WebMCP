// check_catalog.mjs — catálogo CERRADO de chequeos ejecutables (Validation profile: SPA).
//
// Decisión 01/10: el juez de cobertura es Validation ejecutando el artefacto.
// Un requisito se traduce a chequeos de este catálogo (lo hace
// check_translator.mjs con Qwen, sin escribir código) y cada chequeo se
// ejecuta en Chromium real: PASS / FAIL / NOT_APPLICABLE lo decide el código.
//
// Alcance v0.1: solo lo que se ve y se usa en la SPA (backend simulado /
// datos mockeados). Los elementos se buscan por TEXTO visible (label, name,
// placeholder, aria-label, texto del botón), con una lista de sinónimos que
// da el traductor, porque el traductor no conoce el DOM.

import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "./form_runtime.mjs";

export const CATALOG_VERSION = "check_catalog v0.8";
// v0.8 (06/10, web/game por archivos): chequeos sobre el CONTRATO del juego (NIVELES y Reglas
// existen en la página): game_levels (al menos N niveles), moves_one_cell (de a un casillero,
// la pared bloquea), fixed_map_size (todos los niveles del mismo tamaño y el tablero lo dibuja).
// Cierran R3, R5 y R6 de Boxworld, que con la página sola quedaban SIN_CHEQUEO.
// v0.7.4 (05/10, Boxworld build 7): la foto de pantalla (SNAP) incluye data-*; reset_restores daba
// "las teclas no cambian nada" en un juego que marca jugador/cajas con data-type.
// v0.7.3 (05/10, Boxworld build 6): no_js_errors devuelve también la línea del error (errors[].line).

// v0.7.2 (05/10, Boxworld build 5): not_won_immediately también falla si la victoria ya
// se ve recién cargada la página (3 de 5 niveles tenían las cajas sobre los objetivos).

// v0.7.1 (05/10, Boxworld build 4): key_changes dio PASS a "el avatar se mueve con las
// flechas" y el avatar NO se movía: el estado cambiaba (contador 0 → 3) pero dibujar()
// nunca se volvía a llamar; lo que cambiaba era el texto del contador y el mensaje.
// board_changes mira solo el TABLERO (la grilla con más casilleros, o un canvas).

// v0.7 (05/10, web/app y web/game): chequeos de INTERACCIÓN. Evidencia: Boxworld
// build 3 — el juego "ganaba" con el primer movimiento, reiniciar quedaba
// deshabilitado y el contador de movimientos se verificó con numbers_animate
// ("cambian solos"): 5 de 8 requisitos SIN_CHEQUEO y el bug invisible.
//   key_changes          apretar una tecla cambia la pantalla (cualquier cosa, también un texto)
//   board_changes        (juego, v0.7.1) apretar una tecla cambia el TABLERO
//   click_changes        hacer clic en un control cambia la pantalla
//   counter_on_action    el número junto a una etiqueta cambia después de actuar
//   not_won_immediately  (juego) UN movimiento no alcanza para ganar
//   reset_restores       (juego) después de jugar, reiniciar vuelve al estado inicial

// v0.6.1 (05/10, Boxworld build 3): sections_visible dio FAIL falso en #juego (10/21):
// las 11 palabras que faltaban eran el overlay de victoria, con style="display:none"
// en el HTML, que aparece al ganar. El texto adentro de un descendiente con `hidden`
// o display:none inline se cuenta aparte (ondemand) y no entra en el total.

// v0.6 (05/10): components_render — chequeo de BASE. Evidencia: Boxworld build 2,
// el JS de #juego era una función anónima que nadie llamaba; el tablero
// (#game-board) quedó vacío y Validation no lo vio (sections_visible cuenta
// palabras, y los títulos y botones del HTML estático se veían). Ahora, por
// componente con <script data-component>: los contenedores que su JS nombra
// (#id o .clase) y que siguen vacíos después de cargar. Si TODOS siguen vacíos,
// el componente no dibujó nada → FAIL. No cuentan los contenedores "a demanda"
// (dentro de un form, aria-live/role=alert|status, o nombre tipo mensaje/feedback/
// error/estado): esos se llenan después de una acción.

// v0.5 (03/10): sections_visible — chequeo de BASE (lo corre el harness, no el
// traductor). Evidencia: en Project22 v0.6.1 el hero y el contacto quedaron con
// opacity:0 para siempre (CSS global `section{opacity:0}` + observer que no los
// vigilaba) y Validation dio PASS igual: innerText ignora la opacidad. Ahora cada
// pieza anclada con data-feature se mira DESPUÉS de llevarla a pantalla con la
// rueda del mouse, y se cuentan solo las palabras que se ven de verdad
// (opacidad acumulada ≥ 0.5, visibility, display, tamaño).

// v0.4 (02/10): chequeos de requisitos TRANSVERSALES y de interacción, que en
// Project22 quedaron SIN_CHEQUEO o con FAIL falso: sin scroll horizontal en
// celular, hover que cambia el estilo, nav fija que lleva a la sección, aparición
// al hacer scroll, animación de entrada, números que cambian y sección con
// botón. "Visualmente atractivo" o "código limpio" siguen sin chequeo: no se
// pueden medir ejecutando la página.

// v0.3 (01/10): chequeos de CONTENIDO por sección. Evidencia: con el esqueleto
// v0.4 (título por feature), todo text_visible pasa también en el esqueleto
// vacío → no discrimina (R3/R4 quedaron SIN_EVIDENCIA). Y el traductor
// representaba "en carrusel" con click_reveals inventado (R1 FAIL falso).
// Los tres nuevos ubican la sección por id / título / aria-label y miden lo
// que hay ADENTRO, sin contar los títulos.

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const words = (arr) => (Array.isArray(arr) ? arr : [arr]).map(norm).filter((w) => w.length >= 2);
const matches = (text, syn) => { const n = norm(text); return words(syn).some((w) => n.includes(w)); };
const fieldText = (f) => `${f.name} ${f.id} ${f.placeholder} ${f.label}`;

// Definición del catálogo: tipo → { descripción para el traductor, params, run }.
// `params` es el esquema que valida el harness (string[] = lista de sinónimos).
export const CATALOG = {
  no_js_errors: {
    describe: "La página carga sin errores de JavaScript.",
    params: {},
  },
  text_visible: {
    describe: "Hay texto visible en la página que menciona algo concreto (una etiqueta, un mensaje, un dato). NO sirve para demostrar que una sección existe o tiene contenido (los títulos de sección ya vienen en la página).",
    params: { text: "string[]" },
  },
  control_visible: {
    describe: "Hay un botón, link, select o pestaña visible cuyo texto menciona algo. Usar para 'permitir hacer X' / 'botón para X'.",
    params: { text: "string[]" },
  },
  field_exists: {
    describe: "Hay un campo de formulario (input, select, textarea) cuyo label/nombre/placeholder menciona algo.",
    params: { field: "string[]" },
  },
  field_required: {
    describe: "Ese campo es obligatorio: si se deja vacío (y el resto está completo), el envío queda bloqueado.",
    params: { field: "string[]" },
  },
  field_optional: {
    describe: "Ese campo es opcional: si se deja vacío (y el resto está completo), el envío pasa.",
    params: { field: "string[]" },
  },
  submit_empty_blocked: {
    describe: "Enviar el formulario vacío queda bloqueado.",
    params: {},
  },
  valid_submit_passes: {
    describe: "Con todos los campos completos con datos válidos, el envío pasa.",
    params: {},
  },
  section_content: {
    describe: "La sección que se llama/titula X tiene contenido propio visible (al menos 8 palabras además de sus títulos). Usar para 'sección X con historia/descripción/información'.",
    params: { section: "string[]" },
  },
  section_items: {
    describe: "La sección X muestra una lista de varios elementos repetidos con texto (tarjetas, productos, ítems de menú; al menos 2). Usar para 'catálogo/lista/carta de productos', 'productos disponibles'.",
    params: { section: "string[]" },
  },
  carousel: {
    describe: "La sección X muestra sus elementos en un carrusel: hay controles (anterior/siguiente) o desplazamiento horizontal, y al usarlos los elementos se mueven. Usar para 'en carrusel/carrousel/slider'.",
    params: { section: "string[]" },
  },
  section_control: {
    describe: "La sección X tiene al menos un botón o link visible (ej. el botón de llamada a la acción de un hero). Usar para 'sección X con botón / CTA / llamada a la acción'.",
    params: { section: "string[]" },
  },
  no_horizontal_scroll: {
    describe: "La página no tiene scroll horizontal ni en celular (390 px) ni en escritorio (1280 px). Usar para 'responsive', 'escritorio y móvil', 'se adapta a celular'.",
    params: {},
  },
  hover_changes: {
    describe: "Al pasar el mouse por encima de botones y/o tarjetas cambia su estilo (color, sombra, tamaño, posición). En elementos van palabras como 'boton', 'tarjeta', 'enlace'. Usar para 'efectos hover'.",
    params: { elementos: "string[]" },
  },
  nav_scroll: {
    describe: "La barra de navegación queda fija arriba al bajar por la página y sus enlaces llevan a cada sección. Usar para 'navegación / menú fijo', 'scroll suave a cada sección'.",
    params: {},
  },
  reveal_on_scroll: {
    describe: "Hay contenido que aparece (estaba oculto o desplazado y se hace visible) al bajar con el scroll. Usar para 'animaciones al hacer scroll', 'elementos que aparecen'.",
    params: {},
  },
  entrance_animation: {
    describe: "La sección X tiene una animación o transición en los primeros segundos de carga. Usar para 'animación de entrada' de una sección (ej. el hero).",
    params: { section: "string[]" },
  },
  numbers_animate: {
    describe: "En la sección X hay números que cambian solos al verla (contadores animados). Usar para 'estadísticas / contadores animados'.",
    params: { section: "string[]" },
  },
  sections_visible: {
    describe: "BASE (no lo usa el traductor): cada pieza con data-feature (header, secciones, footer) muestra su texto cuando el usuario llega a ella con el scroll.",
    params: {},
    base: true,
  },
  components_render: {
    describe: "BASE (no lo usa el traductor): cada componente con JS llena al menos uno de los contenedores que su JS nombra (un tablero vacío es FAIL).",
    params: {},
    base: true,
  },
  key_changes: {
    describe: "Al apretar una tecla (flechas, espacio, enter o una letra) algo cambia en la pantalla. Usar para 'se mueve con las flechas / con el teclado'.",
    params: { keys: "string[]?" },
  },
  board_changes: {
    describe: "Al apretar una tecla cambia el TABLERO del juego (la grilla o el canvas: una pieza se mueve), no solo un texto o un contador. Usar para 'el avatar / jugador / la pieza se mueve con las flechas'.",
    params: { keys: "string[]?" },
  },
  game_levels: {
    describe: "(Juego con contrato NIVELES/Reglas) El juego trae al menos N niveles. Usar para 'al menos N niveles'; min = [\"N\"].",
    params: { min: "string[]" },
  },
  moves_one_cell: {
    describe: "(Juego con contrato NIVELES/Reglas) Cada movimiento avanza exactamente un casillero y la pared lo bloquea. Usar para 'se mueve de a un casillero'.",
    params: {},
  },
  fixed_map_size: {
    describe: "(Juego con contrato NIVELES/Reglas) Todos los niveles tienen el mismo tamaño de mapa y el tablero dibuja filas x columnas casilleros. Usar para 'el tamaño del mapa es fijo'.",
    params: {},
  },
  click_changes: {
    describe: "Al hacer clic en un control cuyo texto menciona X, algo cambia en la pantalla. Usar para 'botón que hace X' cuando no dice qué texto aparece.",
    params: { click: "string[]" },
  },
  counter_on_action: {
    describe: "El número que está junto a la etiqueta X (movimientos, puntaje, tiempo) cambia después de actuar (teclas o un clic). Usar para 'contador de movimientos / puntaje'.",
    params: { label: "string[]", keys: "string[]?", click: "string[]?" },
  },
  not_won_immediately: {
    describe: "Con UN solo movimiento (una tecla) no aparece un mensaje de victoria ni se completa el nivel. Usar para 'acomodar / llegar / completar el nivel / ganar'.",
    params: { keys: "string[]?" },
  },
  reset_restores: {
    describe: "Después de jugar (teclas), el control X (reiniciar) vuelve la pantalla al estado del inicio. Usar para 'botón reiniciar / volver a empezar'.",
    params: { click: "string[]", keys: "string[]?" },
  },
  click_reveals: {
    describe: "Al hacer clic en un control cuyo texto menciona A, aparece visible texto que menciona B.",
    params: { click: "string[]", expect: "string[]" },
  },
};

/** Valida un chequeo contra el esquema del catálogo. Devuelve el chequeo limpio o null. */
export function normalizeCheck(c) {
  const def = CATALOG[c?.type];
  if (!def) return null;
  const params = {};
  for (const [k, t] of Object.entries(def.params)) {
    const v = c.params?.[k];
    const list = (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).map(String).map((s) => s.trim()).filter(Boolean);
    if (t === "string[]" && !words(list).length && !list.some((x) => /\d/.test(x))) return null; // v0.8: un número ("5") también vale
    if (t === "string[]?" && !list.length) continue; // opcional (v0.7)
    params[k] = list;
  }
  // feature (opcional, lo agrega el harness con anchorSections): id de requisito "Rn"
  if (c.params?.section && Array.isArray(c.params.feature) && /^R\d+$/.test(c.params.feature[0] || "")) params.feature = [c.params.feature[0]];
  return { type: c.type, params };
}


// ---- helpers de sección (corren en la página) ----
// Marca con data-vc-section la sección que matchea y con data-vc-item los
// elementos del grupo repetido más grande dentro de ella. Devuelve un resumen.
const MARK_SECTION = ([ws, feature]) => {
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const vis = (e) => !!(e.offsetParent !== null || e.getClientRects().length) && getComputedStyle(e).visibility !== "hidden";
  document.querySelectorAll("[data-vc-section],[data-vc-item]").forEach((e) => { e.removeAttribute("data-vc-section"); e.removeAttribute("data-vc-item"); });
  const hit = (t) => ws.some((w) => norm(t).includes(w));
  const cands = [...document.querySelectorAll("section, article, [role=region], main > div, [id]")].filter((e) => !["HTML", "BODY", "MAIN", "HEADER", "NAV", "FOOTER", "FORM", "INPUT", "BUTTON", "A", "TEXTAREA", "SELECT", "LABEL"].includes(e.tagName) && vis(e));
  const score = (e) => {
    const h = e.querySelector("h1, h2, h3, h4");
    if (hit(e.id) || hit(e.getAttribute("aria-label"))) return 3;
    if (h && hit(h.innerText)) return 2;
    return 0;
  };
  const scored = cands.map((e) => ({ e, s: score(e), sec: e.tagName === "SECTION" || e.tagName === "ARTICLE" ? 1 : 0 })).filter((x) => x.s > 0);
  scored.sort((a, b) => (b.sec - a.sec) || (b.s - a.s));
  // Anclaje por feature: si la página trae data-feature="Rn" (esqueleto v0.4), manda esa.
  // v0.5: data-feature puede listar varios ("R3 R5") y una feature puede estar en
  // varias secciones (R3 = Características, Testimonios…): entre las ancladas
  // gana la que matchea las palabras; si ninguna, la primera anclada.
  const anchoredAll = feature ? [...document.querySelectorAll(`[data-feature~="${feature}"]`)] : [];
  const anchored = anchoredAll.length <= 1 ? anchoredAll[0] || null
    : (scored.find((x) => anchoredAll.includes(x.e))?.e || anchoredAll.find((e) => score(e) > 0) || anchoredAll[0]);
  const sec = anchored || scored[0]?.e;
  if (!sec) return null;
  sec.setAttribute("data-vc-section", "1");
  const heads = [...sec.querySelectorAll("h1, h2, h3, h4")].filter((h) => !h.closest("[data-vc-item]"));
  // texto propio = texto visible de la sección menos el de sus títulos de nivel sección
  let text = sec.innerText || "";
  const secHeads = heads.filter((h) => !h.parentElement.closest("li, article, .card, [class*=card], [class*=item]"));
  for (const h of secHeads) text = text.replace(h.innerText, " ");
  const wordsN = text.split(/\s+/).filter((w) => /[a-záéíóúñ0-9]{2,}/i.test(w)).length;
  // grupo repetido más grande: hijos de un mismo padre con igual tag+clase y texto
  let best = [];
  for (const parent of [sec, ...sec.querySelectorAll("*")]) {
    const groups = {};
    for (const ch of parent.children) {
      if (!vis(ch) || ["SCRIPT", "STYLE", "BUTTON", "INPUT", "LABEL", "H1", "H2", "H3", "H4", "BR"].includes(ch.tagName)) continue;
      if ((ch.innerText || "").trim().length < 3) continue;
      const k = ch.tagName + "." + [...ch.classList].sort().join(".");
      (groups[k] = groups[k] || []).push(ch);
    }
    for (const g of Object.values(groups)) if (g.length > best.length && !g[0].matches(".form-group, [class*=form-group]") && !g[0].querySelector("input, textarea, select")) best = g;
  }
  best.forEach((e) => e.setAttribute("data-vc-item", "1"));
  return { id: (sec.id || sec.tagName.toLowerCase()) + (anchored ? ` [${feature}]` : ""), words: wordsN, items: best.length, sample: best.slice(0, 3).map((e) => e.innerText.trim().split("\n")[0].slice(0, 40)) };
};
// v0.5: palabras que se VEN dentro de un elemento (opacidad acumulada, visibility, display, tamaño)
const SEEN_WORDS = (el) => {
  const count = (t) => t.split(/\s+/).filter((w) => /[a-záéíóúñ0-9]{2,}/i.test(w)).length;
  let total = 0, seen = 0, ondemand = 0;
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    let op = 1;
    for (let a = e; a && a !== document.documentElement; a = a.parentElement) {
      const c = getComputedStyle(a);
      if (c.display === "none" || c.visibility === "hidden" || c.visibility === "collapse") return false;
      op *= Number(c.opacity);
      // v0.5.1: recortado por un ancestro con overflow (ej. nav con max-height:0 y overflow:hidden)
      if (a !== e && c.overflow !== "visible" && (c.overflowX !== "visible" || c.overflowY !== "visible")) {
        const q = a.getBoundingClientRect();
        const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (w < 1 || h < 1) return false;
      }
    }
    return op >= 0.5;
  };
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    let p = n.parentElement;
    if (!p || p.closest("script, style, noscript, template")) continue;
    const k = count(n.textContent || "");
    if (!k) continue;
    // v0.6.1 (Boxworld build 3): contenido "a demanda" marcado en el propio HTML — un
    // descendiente con `hidden` o `style="display:none"` (overlay de "¡Nivel completado!",
    // modal, pestaña) no está roto: espera una acción. No cuenta ni a favor ni en contra.
    // La pieza misma (el ancla) oculta sigue siendo FAIL, y el ocultamiento por CSS
    // (opacity, clases, visibility) sigue contando: ese fue el bug de Project22.
    const od = p.closest('[hidden], [style*="display:none" i], [style*="display: none" i]');
    if (od && od !== el && el.contains(od)) { ondemand += k; continue; }
    total += k;
    // v0.5.2: <option> no tiene caja propia; se ve si se ve su <select>
    if (p.closest("option, optgroup")) p = p.closest("select") || p;
    // v0.5.2: se acumula entre llamadas (una sección más alta que la pantalla se recorre de a tramos)
    const memo = (window.__vcSeen = window.__vcSeen || new WeakSet());
    if (memo.has(n) || shown(p)) { memo.add(n); seen += k; }
  }
  return { total, seen, ondemand };
};
const ITEM_LEFTS = () => [...document.querySelectorAll("[data-vc-item]")].map((e) => Math.round(e.getBoundingClientRect().left));
// v0.4: estilo comparable para hover
const STYLE_SNAP = (el) => { const c = getComputedStyle(el); return [c.color, c.backgroundColor, c.boxShadow, c.transform, c.borderColor, c.opacity, c.textDecorationLine, c.outlineStyle].join("|"); };
const HOVER_KINDS = [
  { re: /(bot|button|btn|cta)/, sel: "button, .btn, [class*=button], [class*=cta], input[type=submit], a[class*=btn]", label: "botón" },
  { re: /(tarjet|card)/, sel: "[class*=card], article", label: "tarjeta" },
  { re: /(enlace|link|vinculo)/, sel: "a[href]", label: "enlace" },
];
const NUMBERS_IN = (sel) => [...document.querySelectorAll(sel + " *")].filter((e) => !e.children.length && /\d/.test(e.textContent || "")).map((e) => (e.textContent || "").trim()).join(" | ");
const NAV_RE = /(anterior|siguiente|previo|prev|next|‹|›|←|→|«|»|^\s*<\s*$|^\s*>\s*$)/i;

/** Primer control visible cuyo texto (o value / aria-label) menciona alguna palabra. */
async function findControl(page, syn) {
  const loc = page.locator("button, a, [role=tab], [role=button], input[type=button], input[type=submit], summary").filter({ visible: true });
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    const t = (await el.innerText().catch(() => "")) || (await el.getAttribute("value")) || (await el.getAttribute("aria-label")) || "";
    if (matches(t, syn)) return { loc: el, text: t.trim() };
  }
  return null;
}

async function visibleTexts(page, selector) {
  return page.$$eval(selector, (els) =>
    els.filter((e) => e.offsetParent !== null || e.getClientRects().length)
      .map((e) => [e.innerText, e.value, e.getAttribute("aria-label"), e.getAttribute("title")].filter(Boolean).join(" ")),
  );
}

const SEEN_SRC = SEEN_WORDS.toString();

// ---------- interacción (v0.7) ----------
const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
/** Palabras del traductor → teclas de Playwright. Sin teclas → las cuatro flechas. */
export function keysFrom(list) {
  const out = [];
  const add = (...k) => k.forEach((x) => { if (!out.includes(x)) out.push(x); });
  for (const raw of list || []) {
    const w = norm(raw);
    if (/flecha|arrow|cursor|direcc/.test(w)) add(...ARROWS);
    else if (/arriba|^up$/.test(w)) add("ArrowUp");
    else if (/abajo|^down$/.test(w)) add("ArrowDown");
    else if (/izquierda|^left$/.test(w)) add("ArrowLeft");
    else if (/derecha|^right$/.test(w)) add("ArrowRight");
    else if (/espacio|space/.test(w)) add("Space");
    else if (/enter|intro/.test(w)) add("Enter");
    else if (/wasd/.test(w)) add("w", "a", "s", "d");
    else if (/^[a-z0-9]$/.test(w)) add(w);
    else if (/^(arrowup|arrowdown|arrowleft|arrowright|escape|tab)$/i.test(raw)) add(raw);
  }
  return out.length ? out : [...ARROWS];
}
// Foto de la pantalla (dentro de <main>, o body): tag, clases, style, disabled y, si
// withText, el texto de las hojas. Un <canvas> entra con un resumen de sus píxeles.
// v0.7.4: los MENSAJES (nombre tipo mensaje/estado/feedback, aria-live, role=status|alert) no
// cuentan: "¡Nivel reiniciado!" o "movimiento inválido" cambian aunque la pantalla de juego no cambie.
const SNAP = (withText) => {
  const root = document.querySelector("main") || document.body;
  const out = [];
  const MSG = /mensaje|message|msg|feedback|toast|aviso|alert|notif|status/i;
  const isMsg = (e) => !!e.closest("[aria-live], [role=status], [role=alert]") || [e, ...(function* up(x) { while ((x = x.parentElement) && x !== root) yield x; })(e)].some((x) => MSG.test(`${x.id} ${x.getAttribute("class") || ""}`));
  const px = (c) => { try { const u = c.toDataURL(); let h = 0; for (let i = 0; i < u.length; i += 7) h = (h * 31 + u.charCodeAt(i)) | 0; return u.length + ":" + h; } catch { return "?"; } };
  for (const e of root.querySelectorAll("*")) {
    if (e.closest("script, style") || isMsg(e)) continue;
    // v0.7.4 (Boxworld build 7): el jugador y las cajas se marcaban con data-type: sin data-* la foto no veía que se movían
    const data = e.getAttributeNames().filter((n) => n.startsWith("data-") && !n.startsWith("data-vc-")).map((n) => n + "=" + e.getAttribute(n)).join(",");
    let line = `${e.tagName}.${e.getAttribute("class") || ""}|${data}|${e.getAttribute("style") || ""}|${e.disabled ? "disabled" : ""}`;
    if (e.tagName === "CANVAS") line += "|" + px(e);
    if (withText && !e.children.length) line += "|" + (e.textContent || "").trim();
    out.push(line);
  }
  return out;
};
// Misma cantidad de elementos → se compara posición por posición (un avatar que se mueve
// cambia QUÉ casillero tiene la clase, no cuántos la tienen). Si no, multiconjunto.
const diffCount = (a, b) => {
  if (a.length === b.length) return a.reduce((s, x, i) => s + (x === b[i] ? 0 : 1), 0);
  const m = new Map();
  a.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
  b.forEach((x) => m.set(x, (m.get(x) || 0) - 1));
  return [...m.values()].reduce((s, v) => s + Math.abs(v), 0);
};
const diffSample = (a, b) => (a.length === b.length ? b.filter((x, i) => x !== a[i]) : b.filter((x) => !a.includes(x))).slice(0, 2).map((x) => x.slice(0, 70));
// Números en elementos chicos cuyo texto nombra alguna etiqueta (ej. "Movimientos: 0").
const LABELED_NUMBERS = (ws) => {
  const n = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out = [];
  for (const e of document.querySelectorAll("body *")) {
    if (e.closest("script, style")) continue;
    const t = (e.innerText || "").trim();
    if (!t || t.length > 80 || !/\d/.test(t)) continue;
    if (ws.some((w) => n(t).includes(w))) out.push({ e, t: t.replace(/\s+/g, " ") });
  }
  // el más chico: fuera los que contienen a otro que ya nombra la etiqueta
  return out.filter((x) => !out.some((y) => y !== x && x.e.contains(y.e))).map((x) => x.t);
};
// El tablero: dentro de <main>, el elemento con más hijos directos (≥ 9, una grilla) o el
// <canvas> más grande. Foto de su subárbol: tag, clases, data-*, style (y píxeles si es canvas).
const BOARD_SNAP = () => {
  const root = document.querySelector("main") || document.body;
  let board = null, best = 8;
  for (const e of root.querySelectorAll("*")) if (e.children.length > best) { best = e.children.length; board = e; }
  if (!board) {
    const cs = [...root.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height);
    board = cs[0] || null;
  }
  if (!board) return { found: false, lines: [] };
  const px = (c) => { try { const u = c.toDataURL(); let h = 0; for (let i = 0; i < u.length; i += 7) h = (h * 31 + u.charCodeAt(i)) | 0; return u.length + ":" + h; } catch { return "?"; } };
  const line = (e) => `${e.tagName}.${e.getAttribute("class") || ""}|${e.getAttributeNames().filter((n) => n.startsWith("data-") && !n.startsWith("data-vc-")).map((n) => n + "=" + e.getAttribute(n)).join(",")}|${e.getAttribute("style") || ""}${e.tagName === "CANVAS" ? "|" + px(e) : ""}`;
  const lines = [line(board), ...[...board.querySelectorAll("*")].map(line)];
  return { found: true, label: board.id ? "#" + board.id : board.tagName.toLowerCase() + (board.className ? "." + String(board.className).split(" ")[0] : ""), lines };
};
const WIN_AT_LOAD = ["ganaste", "victoria", "felicitaciones", "nivel completado", "nivel superado", "superaste"];
const WIN_WORDS = ["ganaste", "ganado", "victoria", "felicitaciones", "completado", "completaste", "superado", "superaste", "nivel completo", "you win"];

// components_render, paso 1 (página SIN JavaScript, o sea el HTML tal como lo escribió
// Gemma): por cada <script data-component="id">, los elementos de #id que su JS nombra
// (por id o por clase) y que están vacíos (sin hijos ni texto) o son <canvas>.
const RENDER_STATIC = () => {
  const ON_DEMAND = /feedback|mensaje|message|msg|error|status|estado|alert|aviso|toast|resultado|result|notif|success|exito/i;
  const SKIP = new Set(["IMG", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "OPTION", "BR", "HR", "SVG", "VIDEO", "AUDIO", "IFRAME", "SOURCE", "A", "LABEL"]);
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out = [];
  for (const sc of document.querySelectorAll("script[data-component]")) {
    const id = sc.getAttribute("data-component");
    const root = document.getElementById(id);
    if (!root) continue;
    const js = sc.textContent || "";
    const byId = (x) => new RegExp(`['"\`]#?${esc(x)}['"\`\\s.:\\[]`).test(js);
    const byClass = (k) => new RegExp(`['"\`\\s]\\.${esc(k)}(?![\\w-])|(?:getElementsByClassName|classList\\.contains)\\(\\s*['"\`]${esc(k)}['"\`]`).test(js);
    const refs = [];
    for (const el of root.querySelectorAll("*")) {
      if (SKIP.has(el.tagName.toUpperCase())) continue;
      const canvas = el.tagName.toUpperCase() === "CANVAS";
      if (!canvas && (el.children.length || (el.textContent || "").trim())) continue;
      // contenedores "a demanda" (se llenan después de una acción: mensaje de error, de
      // éxito, de ganaste): vacíos al cargar está bien. Real: #formFeedback de Project22 v0.7.1.
      const name = `${el.id} ${el.className}`;
      if (el.closest("form") || el.matches("[aria-live], [role=alert], [role=status]") || ON_DEMAND.test(name)) continue;
      const k = [...el.classList].find(byClass);
      if (el.id && byId(el.id)) refs.push({ label: "#" + el.id, sel: "#" + CSS.escape(el.id), canvas });
      else if (k) refs.push({ label: "." + k, sel: `#${CSS.escape(id)} .${CSS.escape(k)}`, canvas });
    }
    if (refs.length) out.push({ id, refs });
  }
  return out;
};
// paso 2 (página CON JavaScript, ya cargada): ¿cuáles siguen vacíos?
const RENDER_AFTER = (comps) => comps.map(({ id, refs }) => {
  const blank = (c) => {
    try {
      const d = c.getContext("2d")?.getImageData(0, 0, c.width, c.height).data;
      if (!d) return false;
      for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
      return true;
    } catch { return false; }
  };
  const empty = refs.filter((r) => {
    const el = document.querySelector(r.sel);
    if (!el) return false; // lo reemplazó el JS: cambió
    return r.canvas ? blank(el) : !el.children.length && !(el.textContent || "").trim();
  }).map((r) => r.label);
  return { id, refs: refs.length, empty, ok: empty.length < refs.length };
});

/**
 * Ejecuta una lista de chequeos sobre un artefacto HTML.
 * @returns {Promise<Array<{type, params, result:"PASS"|"FAIL"|"NOT_APPLICABLE", detail:string}>>}
 */
export async function runChecks(htmlPath, checks) {
  const url = pathToFileURL(resolve(htmlPath)).href;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const ctx = { dialogs: [], pageErrors: [], pageStacks: [] };
  page.on("pageerror", (e) => { ctx.pageErrors.push(e.message); ctx.pageStacks.push({ message: e.message, stack: String(e.stack || "") }); });
  page.on("dialog", (d) => { ctx.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await page.addInitScript(INIT);
  await page.route(/^https?:/, (r) => r.abort());
  const reload = async () => { ctx.pageErrors.length = 0; ctx.pageStacks.length = 0; await page.goto(url, { waitUntil: "load" }); await waitForSettle(page); };

  const out = [];
  try {
    for (const c of checks) {
      const r = { ...c, result: "FAIL", detail: "" };
      try {
        await reload();
        const fields = (await fieldsInfo(page)) || [];
        const findField = () => fields.filter((f) => matches(fieldText(f), c.params.field));
        switch (c.type) {
          case "no_js_errors":
            r.result = ctx.pageErrors.length ? "FAIL" : "PASS";
            r.detail = ctx.pageErrors.join(" | ").slice(0, 200) || "sin excepciones";
            // v0.7.3: dónde (línea del index.html) para que el harness ubique la función que falla
            r.errors = ctx.pageStacks.map((x) => ({ message: x.message, line: Number((x.stack.match(/\.html:(\d+):\d+/) || [])[1]) || null }));
            break;
          case "text_visible": {
            const body = await page.evaluate(() => document.body.innerText);
            const hit = words(c.params.text).find((w) => norm(body).includes(w));
            r.result = hit ? "PASS" : "FAIL";
            r.detail = hit ? `visible: "${hit}"` : `no aparece: ${c.params.text.join(" / ")}`;
            break;
          }
          case "control_visible": {
            const texts = await visibleTexts(page, "button, a, select, [role=tab], [role=button], input[type=submit], input[type=button]");
            const hit = texts.find((t) => matches(t, c.params.text));
            r.result = hit ? "PASS" : "FAIL";
            r.detail = hit ? `control: "${hit.slice(0, 60)}"` : `ningún control menciona: ${c.params.text.join(" / ")}`;
            break;
          }
          case "field_exists": {
            const f = findField();
            r.result = f.length ? "PASS" : "FAIL";
            r.detail = f.length ? `campo: ${f.map((x) => x.name || x.id || x.label).join(", ")}` : `no hay campo: ${c.params.field.join(" / ")}`;
            break;
          }
          case "field_required":
          case "field_optional": {
            // Se miden TODOS los campos que matchean: el traductor a veces usa la
            // lista como varios campos ("nombre", "email") y no como sinónimos
            // de uno (exp_translator 01/10). Cada uno tiene que cumplir.
            const f = findField();
            if (!f.length) { r.detail = `no hay campo: ${c.params.field.join(" / ")}`; break; }
            // Línea base: con todo completo, ¿el envío pasa? Si no, no se puede medir.
            await fillForm(page, fields);
            const base = await submitAndJudge(page, ctx);
            if (!base.accepted) { r.result = "FAIL"; r.detail = `un envío completo no pasa (${base.why}); no se puede medir`; break; }
            const parts = [];
            let allOk = true;
            for (const field of f) {
              await reload();
              await fillForm(page, fields, { empty: [field.index] });
              const s = await submitAndJudge(page, ctx);
              const blocked = !s.accepted;
              const ok = (c.type === "field_required") === blocked;
              allOk = allOk && ok;
              parts.push(`${field.name || field.id}: vacío → ${blocked ? "bloqueado" : "pasa"}${ok ? "" : " ✗"}`);
            }
            r.result = allOk ? "PASS" : "FAIL";
            r.detail = parts.join("; ");
            break;
          }
          case "submit_empty_blocked": {
            if (!fields.length) { r.detail = "no hay formulario"; break; }
            await fillForm(page, fields, { empty: fields.map((f) => f.index) });
            const s = await submitAndJudge(page, ctx);
            r.result = s.accepted ? "FAIL" : "PASS";
            r.detail = s.why;
            break;
          }
          case "valid_submit_passes": {
            if (!fields.length) { r.detail = "no hay formulario"; break; }
            await fillForm(page, fields);
            const s = await submitAndJudge(page, ctx);
            r.result = s.accepted ? "PASS" : "FAIL";
            r.detail = s.why;
            break;
          }
          case "section_content": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            // 20 → 8 (02/10): 20 era arbitrario y un hero real (título + subtítulo + botón) tiene
            // ~14 palabras fuera del título (Project22). Los controles siguen en 0 (esqueleto, sections_vacio).
            r.result = info.words >= 8 ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${info.words} palabras propias (mín. 8)`;
            break;
          }
          case "section_items": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            r.result = info.items >= 2 ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${info.items} ítems${info.items ? ` (${info.sample.join(" · ")})` : ""}`;
            break;
          }
          case "carousel": {
            const vp = page.viewportSize();
            const tryOnce = async () => {
              const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
              if (!info) return { detail: `no hay sección: ${c.params.section.join(" / ")}` };
              if (info.items < 2) return { detail: `#${info.id}: ${info.items} ítems, no hay carrusel` };
              const before = await page.evaluate(ITEM_LEFTS);
              // 1) controles anterior/siguiente dentro de la sección
              const ctl = page.locator("[data-vc-section] :is(button, a, [role=button])").filter({ visible: true });
              const n = await ctl.count();
              let sawControl = false;
              for (let i = 0; i < n; i++) {
                const el = ctl.nth(i);
                const t = [(await el.innerText().catch(() => "")), (await el.getAttribute("aria-label")) || "", (await el.getAttribute("class")) || ""].join(" ");
                if (!NAV_RE.test(t) && !/(next|prev|siguiente|anterior)/i.test(t)) continue;
                sawControl = true;
                if (await el.isDisabled().catch(() => false)) continue;
                await el.click({ timeout: 2000 }).catch(() => {});
                await page.waitForTimeout(100); await waitForSettle(page);
                const after = await page.evaluate(ITEM_LEFTS);
                if (after.some((x, k) => Math.abs(x - before[k]) > 5)) return { pass: true, detail: `#${info.id}: ${info.items} ítems; clic en "${t.trim().split(/\s+/).slice(0, 3).join(" ")}" los desplaza` };
              }
              // 2) contenedor con scroll horizontal
              const scrolled = await page.evaluate(() => {
                const items = [...document.querySelectorAll("[data-vc-item]")];
                let p = items[0]?.parentElement;
                while (p && !p.hasAttribute("data-vc-section")) {
                  const ox = getComputedStyle(p).overflowX;
                  if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 10) { p.scrollLeft += 200; return true; }
                  p = p.parentElement;
                }
                return false;
              });
              if (scrolled) {
                await page.waitForTimeout(400);
                const after = await page.evaluate(ITEM_LEFTS);
                if (after.some((x, k) => Math.abs(x - before[k]) > 5)) return { pass: true, detail: `#${info.id}: ${info.items} ítems en contenedor con scroll horizontal` };
              }
              return { detail: `#${info.id}: ${info.items} ítems; ${sawControl ? "controles sin efecto o deshabilitados" : "sin controles anterior/siguiente ni scroll horizontal"}` };
            };
            let res = await tryOnce();
            if (!res.pass) {
              // Puede que a este ancho entren todos y los controles estén deshabilitados: probar angosto.
              await page.setViewportSize({ width: 480, height: 800 });
              await reload();
              const narrow = await tryOnce();
              if (vp) await page.setViewportSize(vp);
              if (narrow.pass) res = { pass: true, detail: narrow.detail + " (a 480 px)" };
              else res.detail += ` | a 480 px: ${narrow.detail.replace(/^#[^:]+: /, "")}`;
            }
            r.result = res.pass ? "PASS" : "FAIL";
            r.detail = res.detail;
            break;
          }
          case "section_control": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            const ctl = await page.$$eval("[data-vc-section] :is(button, a[href], [role=button], input[type=submit], input[type=button])", (els) =>
              els.filter((e) => e.offsetParent !== null || e.getClientRects().length).map((e) => (e.innerText || e.value || e.getAttribute("aria-label") || "").trim()).filter(Boolean));
            r.result = ctl.length ? "PASS" : "FAIL";
            r.detail = ctl.length ? `#${info.id}: control "${ctl[0].slice(0, 40)}"` : `#${info.id}: sin botones ni links`;
            break;
          }
          case "no_horizontal_scroll": {
            const vp = page.viewportSize();
            const parts = [];
            let ok = true;
            for (const w of [390, 1280]) {
              await page.setViewportSize({ width: w, height: 800 });
              await reload();
              const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
              const over = m.sw - m.iw;
              if (over > 1) ok = false;
              parts.push(`${w}px: ${over > 1 ? `desborda ${over}px` : "ok"}`);
            }
            if (vp) await page.setViewportSize(vp);
            r.result = ok ? "PASS" : "FAIL";
            r.detail = parts.join("; ");
            break;
          }
          case "hover_changes": {
            const ws = words(c.params.elementos);
            const kinds = HOVER_KINDS.filter((k) => ws.some((w) => k.re.test(w)));
            if (!kinds.length) { r.detail = `no sé qué elemento es: ${c.params.elementos.join(" / ")}`; break; }
            const parts = [];
            let ok = true;
            for (const k of kinds) {
              const loc = page.locator(k.sel).filter({ visible: true });
              const n = Math.min(await loc.count(), 5);
              let changed = false, tried = 0;
              for (let i = 0; i < n && !changed; i++) {
                const el = loc.nth(i);
                await el.scrollIntoViewIfNeeded().catch(() => {});
                await page.mouse.move(0, 0);
                await page.waitForTimeout(150); await waitForSettle(page);
                const before = await el.evaluate(STYLE_SNAP).catch(() => null);
                if (before === null) continue;
                tried++;
                await el.hover({ timeout: 2000 }).catch(() => {});
                await page.waitForTimeout(500);
                const after = await el.evaluate(STYLE_SNAP).catch(() => before);
                changed = before !== after;
              }
              if (!changed) ok = false;
              parts.push(`${k.label}: ${!tried ? "no hay" : changed ? "cambia al pasar el mouse" : `sin cambio (${tried} probados)`}`);
            }
            r.result = ok ? "PASS" : "FAIL";
            r.detail = parts.join("; ");
            break;
          }
          case "nav_scroll": {
            const res = await page.evaluate(() => {
              const links = [...document.querySelectorAll("header a[href^='#'], nav a[href^='#']")].filter((a) => a.getAttribute("href").length > 1 && document.querySelector(a.getAttribute("href")) && (a.offsetParent !== null || a.getClientRects().length));
              if (!links.length) return null;
              // el link cuyo destino está más abajo
              links.sort((a, b) => document.querySelector(b.getAttribute("href")).getBoundingClientRect().top - document.querySelector(a.getAttribute("href")).getBoundingClientRect().top);
              const a = links[0];
              a.setAttribute("data-vc-link", "1");
              const nav = a.closest("header, nav");
              nav.setAttribute("data-vc-nav", "1");
              return { href: a.getAttribute("href"), n: links.length };
            });
            if (!res) { r.detail = "no hay enlaces de navegación a secciones (#id)"; break; }
            await page.click("[data-vc-link]", { timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1500); await waitForSettle(page);
            const st = await page.evaluate((href) => {
              const t = document.querySelector(href).getBoundingClientRect();
              const n = document.querySelector("[data-vc-nav]").getBoundingClientRect();
              return { y: Math.round(scrollY), targetTop: Math.round(t.top), navTop: Math.round(n.top), navBottom: Math.round(n.bottom) };
            }, res.href);
            const arrived = st.y > 50 && st.targetTop > -60 && st.targetTop < 250;
            const fixed = st.navTop > -2 && st.navBottom > 0;
            r.result = arrived && fixed ? "PASS" : "FAIL";
            r.detail = `clic en ${res.href}: ${arrived ? "llegó a la sección" : `no llegó (scrollY ${st.y}, sección a ${st.targetTop}px)`}; nav ${fixed ? "sigue visible arriba" : "se fue con el scroll"}`;
            break;
          }
          case "reveal_on_scroll": {
            await page.setViewportSize({ width: 1280, height: 800 });
            await reload();
            const marked = await page.evaluate(() => {
              const hidden = (e) => { const c = getComputedStyle(e); return Number(c.opacity) < 0.5 || c.visibility === "hidden"; };
              const below = [...document.querySelectorAll("main *, section, article")].filter((e) => e.getBoundingClientRect().top > innerHeight + 10 && (e.innerText || "").trim().length > 3);
              const h = below.filter(hidden).slice(0, 10);
              h.forEach((e) => e.setAttribute("data-vc-rev", "1"));
              return h.length;
            });
            if (!marked) { r.detail = "nada oculto debajo del primer pantallazo: no hay aparición al hacer scroll"; break; }
            for (let i = 0; i < 40; i++) {
              await page.mouse.wheel(0, 250); await page.waitForTimeout(120);
              if (await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2)) break;
            }
            await page.waitForTimeout(1000);
            const shown = await page.evaluate(() => [...document.querySelectorAll("[data-vc-rev]")].filter((e) => { const c = getComputedStyle(e); return Number(c.opacity) > 0.9 && c.visibility !== "hidden"; }).length);
            r.result = shown > 0 ? "PASS" : "FAIL";
            r.detail = `${marked} elementos ocultos abajo; ${shown} aparecieron al bajar`;
            await page.setViewportSize({ width: 1280, height: 720 });
            break;
          }
          case "entrance_animation": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            const n = await page.evaluate(() => (window.__entrance || []).filter((e) => e.closest("[data-vc-section]")).length);
            r.result = n ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${n ? `${n} elementos animados al cargar` : "nada se animó al cargar"}`;
            break;
          }
          case "numbers_animate": {
            const info = await page.evaluate(MARK_SECTION, [words(c.params.section), c.params.feature?.[0] || null]);
            if (!info) { r.detail = `no hay sección: ${c.params.section.join(" / ")}`; break; }
            const before = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
            if (!before) { r.detail = `#${info.id}: no hay números`; break; }
            await page.locator("[data-vc-section]").scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(300);
            const early = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
            await page.waitForTimeout(2500);
            const after = await page.evaluate(NUMBERS_IN, "[data-vc-section]");
            const changed = early !== after || before !== after;
            r.result = changed ? "PASS" : "FAIL";
            r.detail = `#${info.id}: ${changed ? `"${before.slice(0, 40)}" → "${after.slice(0, 40)}"` : `los números no cambian ("${after.slice(0, 50)}")`}`;
            break;
          }
          case "sections_visible": {
            // Cada pieza anclada: llevarla a pantalla con la rueda (dispara observers reales),
            // esperar las transiciones y contar las palabras que se ven. Visible = ≥ 50 %.
            await page.setViewportSize({ width: 1280, height: 800 });
            await reload();
            const anchors = await page.evaluate(() => [...document.querySelectorAll("[data-feature]")].map((e, i) => {
              e.setAttribute("data-vc-anchor", String(i));
              return { i, id: e.id || e.tagName.toLowerCase(), features: (e.getAttribute("data-feature") || "").split(/\s+/).filter(Boolean) };
            }));
            if (!anchors.length) { r.result = "NOT_APPLICABLE"; r.detail = "la página no tiene piezas con data-feature"; break; }
            const parts = [], byFeature = {}, per = [];
            for (const a of anchors) {
              const target = await page.evaluate((i) => {
                const e = document.querySelector(`[data-vc-anchor="${i}"]`);
                const top = e.getBoundingClientRect().top + scrollY;
                return Math.max(0, Math.min(top - 80, document.documentElement.scrollHeight - innerHeight));
              }, a.i);
              for (let k = 0; k < 60; k++) {
                const y = await page.evaluate(() => scrollY);
                if (Math.abs(y - target) < 30) break;
                await page.mouse.wheel(0, Math.max(-300, Math.min(300, target - y)));
                await page.waitForTimeout(60);
              }
              await page.waitForTimeout(900);
              const measure = () => page.evaluate(([src, i]) => (0, eval)(`(${src})`)(document.querySelector(`[data-vc-anchor="${i}"]`)), [SEEN_SRC, a.i]);
              let w = await measure();
              // v0.5.2 (Project22 v0.7.1, contacto): la pieza puede ser más alta que la pantalla y
              // su contenido de abajo aparece recién al llegar ahí. Se recorre de a tramos, como un
              // usuario, y cuenta lo que se vio en algún momento.
              for (let k = 0; k < 12 && w.seen < w.total; k++) {
                const more = await page.evaluate((i) => {
                  const r = document.querySelector(`[data-vc-anchor="${i}"]`).getBoundingClientRect();
                  return r.bottom > innerHeight + 5 && scrollY + innerHeight < document.documentElement.scrollHeight - 2;
                }, a.i);
                if (!more) break;
                for (let s = 0; s < 2; s++) { await page.mouse.wheel(0, 250); await page.waitForTimeout(60); }
                await page.waitForTimeout(700);
                w = await measure();
              }
              const ok = w.total === 0 ? false : w.seen / w.total >= 0.5;
              parts.push(`#${a.id}: ${w.seen}/${w.total} palabras visibles${w.ondemand ? ` (+${w.ondemand} a demanda)` : ""}${ok ? "" : " ✗"}`);
              per.push({ id: a.id, features: a.features, seen: w.seen, total: w.total, ondemand: w.ondemand || 0, ok });
              for (const f of a.features) byFeature[f] = (byFeature[f] ?? true) && ok;
            }
            r.anchors = per;
            r.features = Object.fromEntries(Object.entries(byFeature).map(([f, ok]) => [f, ok ? "PASS" : "FAIL"]));
            r.result = Object.values(byFeature).every(Boolean) ? "PASS" : "FAIL";
            r.detail = parts.join("; ");
            await page.setViewportSize({ width: 1280, height: 720 });
            break;
          }
          case "components_render": {
            const ctxNoJs = await browser.newContext({ javaScriptEnabled: false });
            let found = [];
            try {
              const p0 = await ctxNoJs.newPage();
              await p0.route(/^https?:/, (x) => x.abort());
              await p0.goto(url, { waitUntil: "load" });
              found = await p0.evaluate(RENDER_STATIC);
            } finally { await ctxNoJs.close(); }
            const comps = await page.evaluate(RENDER_AFTER, found);
            if (!comps.length) { r.result = "NOT_APPLICABLE"; r.detail = "ningún componente con JS nombra contenedores"; break; }
            r.components = comps;
            const bad = comps.filter((x) => !x.ok);
            r.result = bad.length ? "FAIL" : "PASS";
            r.detail = comps.map((x) => `#${x.id}: ${x.ok ? `${x.refs - x.empty.length}/${x.refs} contenedores con contenido` : `nada dibujado (${x.empty.slice(0, 4).join(", ")} vacíos)`}`).join("; ");
            break;
          }
          case "key_changes": {
            const keys = keysFrom(c.params.keys);
            const changed = [];
            for (const k of keys) {
              await reload();
              const a = await page.evaluate(SNAP, true);
              await page.keyboard.press(k);
              await page.waitForTimeout(150); await waitForSettle(page);
              const b = await page.evaluate(SNAP, true);
              if (diffCount(a, b)) changed.push(k);
            }
            r.result = changed.length ? "PASS" : "FAIL";
            r.detail = changed.length ? `cambia la pantalla: ${changed.join(", ")}` : `ninguna tecla cambia nada (${keys.join(", ")})`;
            break;
          }
          case "game_levels": {
            const min = Number((c.params.min || []).map((x) => String(x).match(/\d+/)?.[0]).find(Boolean) || 1);
            const n = await page.evaluate(() => (typeof NIVELES !== "undefined" && Array.isArray(NIVELES) ? NIVELES.length : -1));
            if (n < 0) { r.detail = "la página no define NIVELES (contrato del juego)"; break; }
            r.result = n >= min ? "PASS" : "FAIL";
            r.detail = `${n} niveles (se piden al menos ${min})`;
            break;
          }
          case "moves_one_cell": {
            const t = await page.evaluate(() => {
              if (typeof Reglas === "undefined") return { err: "la página no define Reglas (contrato del juego)" };
              try {
                const lv = ["######", "#@   #", "#    #", "######"];
                const e = Reglas.crearEstado(lv);
                const d = Reglas.mover(e, "derecha"), b = Reglas.mover(e, "abajo"), w = Reglas.mover(e, "izquierda");
                const dd = Reglas.mover(d, "derecha");
                const p = (x) => x && x.jugador ? x.jugador.fila + "," + x.jugador.col : "?";
                return { d: p(d), b: p(b), w: p(w), dd: p(dd) };
              } catch (err) { return { err: String(err.message || err) }; }
            });
            if (t.err) { r.detail = t.err; break; }
            const ok = t.d === "1,2" && t.b === "2,1" && t.w === "1,1" && t.dd === "1,3";
            r.result = ok ? "PASS" : "FAIL";
            r.detail = ok ? "derecha → (1,2), otra vez → (1,3), abajo → (2,1), contra la pared se queda en (1,1)" : `desde (1,1): derecha → ${t.d} (esperado 1,2), otra vez → ${t.dd} (1,3), abajo → ${t.b} (2,1), izquierda contra la pared → ${t.w} (1,1)`;
            break;
          }
          case "fixed_map_size": {
            const t = await page.evaluate(() => {
              if (typeof NIVELES === "undefined") return { err: "la página no define NIVELES (contrato del juego)" };
              const dims = NIVELES.map((nv) => nv.length + "x" + Math.max(...nv.map((f) => f.length)));
              const tab = document.getElementById("tablero");
              return { dims: [...new Set(dims)], first: dims[0], cells: tab ? tab.children.length : -1, need: NIVELES[0].length * NIVELES[0][0].length };
            });
            if (t.err) { r.detail = t.err; break; }
            const ok = t.dims.length === 1 && t.cells === t.need;
            r.result = ok ? "PASS" : "FAIL";
            r.detail = ok ? `todos los niveles son de ${t.first} y el tablero dibuja ${t.cells} casilleros` : `tamaños: ${t.dims.join(", ")}; el tablero dibuja ${t.cells} casilleros de ${t.need}`;
            break;
          }
          case "board_changes": {
            const keys = keysFrom(c.params.keys);
            const changed = [];
            let label = null;
            for (const k of keys) {
              await reload();
              const a = await page.evaluate(BOARD_SNAP);
              if (!a.found) break;
              label = a.label;
              await page.keyboard.press(k);
              await page.waitForTimeout(150); await waitForSettle(page);
              const b = await page.evaluate(BOARD_SNAP);
              if (diffCount(a.lines, b.lines)) changed.push(k);
            }
            if (!label) { r.detail = "no hay tablero (una grilla con 9 o más casilleros, o un canvas)"; break; }
            r.result = changed.length ? "PASS" : "FAIL";
            r.detail = changed.length ? `${label} cambia con: ${changed.join(", ")}` : `${label} no cambia con ninguna tecla (${keys.join(", ")}): puede cambiar el estado o un texto, pero el tablero no se redibuja`;
            break;
          }
          case "click_changes": {
            const ctl = await findControl(page, c.params.click);
            if (!ctl) { r.detail = `ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
            const a = await page.evaluate(SNAP, true);
            if (await ctl.loc.isDisabled().catch(() => false)) { r.detail = `"${ctl.text.slice(0, 40)}" está deshabilitado`; break; }
            await ctl.loc.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(150); await waitForSettle(page);
            const b = await page.evaluate(SNAP, true);
            const d = diffCount(a, b);
            r.result = d ? "PASS" : "FAIL";
            r.detail = d ? `clic "${ctl.text.slice(0, 40)}" → ${d} cambios` : `clic "${ctl.text.slice(0, 40)}" → no cambia nada`;
            break;
          }
          case "counter_on_action": {
            const ws = words(c.params.label);
            const before = await page.evaluate(LABELED_NUMBERS, ws);
            if (!before.length) { r.detail = `no hay ningún número junto a: ${c.params.label.join(" / ")}`; break; }
            let did = "";
            if (c.params.click?.length) {
              const ctl = await findControl(page, c.params.click);
              if (!ctl) { r.detail = `ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
              await ctl.loc.click({ timeout: 2000 }).catch(() => {}); did = `clic "${ctl.text.slice(0, 30)}"`;
            } else {
              const keys = keysFrom(c.params.keys);
              for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(120); }
              did = keys.join(", ");
            }
            await waitForSettle(page);
            const after = await page.evaluate(LABELED_NUMBERS, ws);
            const changed = after.join(" | ") !== before.join(" | ");
            r.result = changed ? "PASS" : "FAIL";
            r.detail = `${did}: "${before.join(" | ").slice(0, 60)}" → ${changed ? `"${after.join(" | ").slice(0, 60)}"` : "no cambia"}`;
            break;
          }
          case "not_won_immediately": {
            const keys = keysFrom(c.params.keys);
            const won = [], moved = [];
            // v0.7.2 (Boxworld build 5): niveles cuyas cajas EMPIEZAN sobre los objetivos → ganado al cargar.
            // Al cargar solo cuentan palabras inequívocas ("completado" suelto puede ser "niveles completados: 0").
            const loadText = norm(await page.evaluate(() => document.body.innerText));
            const atLoad = WIN_AT_LOAD.find((x) => loadText.includes(x));
            if (atLoad) { r.detail = `recién cargado ya aparece la victoria ("${atLoad}"): el nivel empieza resuelto`; break; }
            for (const k of keys) {
              await reload();
              const a = await page.evaluate(SNAP, true);
              const t0 = norm(await page.evaluate(() => document.body.innerText));
              await page.keyboard.press(k);
              await page.waitForTimeout(200); await waitForSettle(page);
              const t1 = norm(await page.evaluate(() => document.body.innerText));
              if (diffCount(a, await page.evaluate(SNAP, true))) moved.push(k);
              const w = WIN_WORDS.find((x) => t1.includes(x) && !t0.includes(x));
              if (w) won.push(`${k} → "${w}"`);
            }
            if (!moved.length) { r.result = "FAIL"; r.detail = `ninguna tecla cambia nada (${keys.join(", ")}): no se puede jugar`; break; }
            r.result = won.length ? "FAIL" : "PASS";
            r.detail = won.length ? `con UN movimiento ya aparece la victoria: ${won.join("; ")}` : `${moved.length} movimientos de prueba, ninguno gana`;
            break;
          }
          case "reset_restores": {
            const keys = keysFrom(c.params.keys);
            const s0 = await page.evaluate(SNAP, false);
            for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(120); }
            await waitForSettle(page);
            const s1 = await page.evaluate(SNAP, false);
            const d1 = diffCount(s0, s1);
            if (!d1) { r.detail = `las teclas (${keys.join(", ")}) no cambian nada: no hay qué reiniciar`; break; }
            const ctl = await findControl(page, c.params.click);
            if (!ctl) { r.detail = `después de jugar, ningún control visible menciona: ${c.params.click.join(" / ")}`; break; }
            if (await ctl.loc.isDisabled().catch(() => false)) { r.detail = `después de jugar, "${ctl.text.slice(0, 40)}" está deshabilitado`; break; }
            await ctl.loc.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(150); await waitForSettle(page);
            const s2 = await page.evaluate(SNAP, false);
            const d2 = diffCount(s0, s2);
            r.result = d2 === 0 ? "PASS" : "FAIL";
            r.detail = d2 === 0 ? `jugar cambió ${d1} elementos; "${ctl.text.slice(0, 30)}" los volvió todos al inicio`
              : `jugar cambió ${d1} elementos; después de "${ctl.text.slice(0, 30)}" quedan ${d2} distintos del inicio (ej. ${diffSample(s0, s2).join(" ; ")})`;
            break;
          }
          case "click_reveals": {
            const loc = page.locator("button, a, [role=tab], [role=button], input[type=button], summary").filter({ visible: true });
            const n = await loc.count();
            let clicked = null;
            for (let i = 0; i < n && !clicked; i++) {
              const t = (await loc.nth(i).innerText().catch(() => "")) || (await loc.nth(i).getAttribute("value")) || "";
              if (matches(t, c.params.click)) { await loc.nth(i).click({ timeout: 2000 }).catch(() => {}); clicked = t.trim(); }
            }
            if (!clicked) { r.detail = `ningún control menciona: ${c.params.click.join(" / ")}`; break; }
            await page.waitForTimeout(100); await waitForSettle(page);
            const body = await page.evaluate(() => document.body.innerText);
            const hit = words(c.params.expect).find((w) => norm(body).includes(w));
            r.result = hit ? "PASS" : "FAIL";
            r.detail = hit ? `clic "${clicked.slice(0, 40)}" → visible "${hit}"` : `clic "${clicked.slice(0, 40)}" → no aparece: ${c.params.expect.join(" / ")}`;
            break;
          }
          default:
            r.result = "NOT_APPLICABLE";
            r.detail = "tipo fuera del catálogo";
        }
      } catch (e) {
        r.result = "FAIL";
        r.detail = `error del chequeo: ${e.message.slice(0, 150)}`;
      }
      out.push(r);
    }
  } finally {
    await browser.close();
  }
  return out;
}
