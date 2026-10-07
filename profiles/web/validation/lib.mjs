// lib.mjs — piezas compartidas por los Validation profiles web (06/10, paso 2: salieron de
// check_catalog.mjs sin cambios). Funciones que corren en la página (MARK_SECTION, SNAP, …),
// normalización de texto y búsqueda de controles.

export { INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "./form_runtime.mjs";
import { INIT, fieldsInfo, fillForm, submitAndJudge, waitForSettle } from "./form_runtime.mjs";

export const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
export const words = (arr) => (Array.isArray(arr) ? arr : [arr]).map(norm).filter((w) => w.length >= 2);
export const matches = (text, syn) => { const n = norm(text); return words(syn).some((w) => n.includes(w)); };
export const fieldText = (f) => `${f.name} ${f.id} ${f.placeholder} ${f.label}`;

// Definición del catálogo: tipo → { descripción para el traductor, params, run }.
// `params` es el esquema que valida el harness (string[] = lista de sinónimos).


// ---- helpers de sección (corren en la página) ----
// Marca con data-vc-section la sección que matchea y con data-vc-item los
// elementos del grupo repetido más grande dentro de ella. Devuelve un resumen.
export const MARK_SECTION = ([ws, feature]) => {
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
export const SEEN_WORDS = (el) => {
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
export const ITEM_LEFTS = () => [...document.querySelectorAll("[data-vc-item]")].map((e) => Math.round(e.getBoundingClientRect().left));
// v0.4: estilo comparable para hover
export const STYLE_SNAP = (el) => { const c = getComputedStyle(el); return [c.color, c.backgroundColor, c.boxShadow, c.transform, c.borderColor, c.opacity, c.textDecorationLine, c.outlineStyle].join("|"); };
export const HOVER_KINDS = [
  { re: /(bot|button|btn|cta)/, sel: "button, .btn, [class*=button], [class*=cta], input[type=submit], a[class*=btn]", label: "botón" },
  { re: /(tarjet|card)/, sel: "[class*=card], article", label: "tarjeta" },
  { re: /(enlace|link|vinculo)/, sel: "a[href]", label: "enlace" },
];
export const NUMBERS_IN = (sel) => [...document.querySelectorAll(sel + " *")].filter((e) => !e.children.length && /\d/.test(e.textContent || "")).map((e) => (e.textContent || "").trim()).join(" | ");
export const NAV_RE = /(anterior|siguiente|previo|prev|next|‹|›|←|→|«|»|^\s*<\s*$|^\s*>\s*$)/i;

/** Primer control visible cuyo texto (o value / aria-label) menciona alguna palabra. */
export async function findControl(page, syn) {
  const loc = page.locator("button, a, [role=tab], [role=button], input[type=button], input[type=submit], summary").filter({ visible: true });
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    const t = (await el.innerText().catch(() => "")) || (await el.getAttribute("value")) || (await el.getAttribute("aria-label")) || "";
    if (matches(t, syn)) return { loc: el, text: t.trim() };
  }
  return null;
}

export async function visibleTexts(page, selector) {
  return page.$$eval(selector, (els) =>
    els.filter((e) => e.offsetParent !== null || e.getClientRects().length)
      .map((e) => [e.innerText, e.value, e.getAttribute("aria-label"), e.getAttribute("title")].filter(Boolean).join(" ")),
  );
}

export const SEEN_SRC = SEEN_WORDS.toString();

// ---------- interacción (v0.7) ----------
export const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
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
export const SNAP = (withText) => {
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
export const diffCount = (a, b) => {
  if (a.length === b.length) return a.reduce((s, x, i) => s + (x === b[i] ? 0 : 1), 0);
  const m = new Map();
  a.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
  b.forEach((x) => m.set(x, (m.get(x) || 0) - 1));
  return [...m.values()].reduce((s, v) => s + Math.abs(v), 0);
};
export const diffSample = (a, b) => (a.length === b.length ? b.filter((x, i) => x !== a[i]) : b.filter((x) => !a.includes(x))).slice(0, 2).map((x) => x.slice(0, 70));
// Números en elementos chicos cuyo texto nombra alguna etiqueta (ej. "Movimientos: 0").
export const LABELED_NUMBERS = (ws) => {
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
export const BOARD_SNAP = () => {
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
export const WIN_AT_LOAD = ["ganaste", "victoria", "felicitaciones", "nivel completado", "nivel superado", "superaste"];
export const WIN_WORDS = ["ganaste", "ganado", "victoria", "felicitaciones", "completado", "completaste", "superado", "superaste", "nivel completo", "you win"];

// components_render, paso 1 (página SIN JavaScript, o sea el HTML tal como lo escribió
// Gemma): por cada <script data-component="id">, los elementos de #id que su JS nombra
// (por id o por clase) y que están vacíos (sin hijos ni texto) o son <canvas>.
export const RENDER_STATIC = () => {
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
export const RENDER_AFTER = (comps) => comps.map(({ id, refs }) => {
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
