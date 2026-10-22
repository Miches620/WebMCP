// visual.mjs v0.1 (22/10/2026) — reglas visuales que se MIDEN en la página, para cualquier app web.
// No dicen si algo es "lindo": dicen si se puede leer, tocar y si es parejo. Lo que pidió el usuario (colores, medidas)
// lo prueba la planilla; estas reglas nunca lo contradicen (la planilla manda: si una regla choca, gana la planilla).
// Origen: Miche (22/10) "una skill para que mejore la parte visual"; evidencia 10/10: una Skill sin medida es placebo.
export const VISUAL_VERSION = "visual v0.1";

/** Las reglas: id → { dice (para el que construye), mide (para el juez) }. */
// "como": la parte Skill (cómo se arregla, en una línea); "dice": lo que se mide.
export const REGLAS_VISUALES = {
  contraste: { dice: "todo texto se lee contra su fondo: contraste de al menos 4.5 a 1 (3 a 1 si la letra es grande: 24px, o 19px en negrita)", como: "sobre fondos claros o de color medio, letra oscura (#1a1a1a); sobre fondos oscuros, letra blanca. Si el color de fondo lo pidió el usuario, cambiá el color de la LETRA, no el fondo" },
  no_se_corta: { dice: "nada se sale de su caja ni queda cortado: ningún contenedor tiene scroll hacia el costado por algo que no entra", como: "con padding y borde, el ancho total crece: usá box-sizing: border-box (o un ancho que entre en el contenedor); si el usuario pidió un ancho, respetalo y hacé que lo de afuera tenga lugar" },
  letra_minima: { dice: "ningún texto visible tiene letra de menos de 12px", como: "subí el font-size a 12px o más" },
  tocables: { dice: "todo lo que se aprieta o se agarra (botones, campos, manijas) mide al menos 24×24px", como: "agrandá con padding o min-width/min-height" },
  parejo: { dice: "la app usa pocos valores distintos: como mucho 4 redondeos de borde y 6 tamaños de letra", como: "reusá los mismos valores (p. ej. redondeo 4px y 8px; letra 12, 14, 16, 20, 28px)" },
  sin_corrimiento: { dice: "con la ventana de 1280px la página no tiene scroll hacia el costado", como: "que el ancho total de lo que va en fila entre en la ventana (o que ese contenedor scrollee solo)" },
};
/** Filas de planilla para las reglas visuales: con 3 ítems creados, se mide cada regla. ids V1… */
export function filasVisuales(reglas = Object.keys(REGLAS_VISUALES)) {
  return reglas.map((k, i) => ({ id: `V${i + 1}.1`, r: `V${i + 1}`, dado: [{ agregar: "QA Vis 1" }, { agregar: "QA Vis 2" }, { agregar: "QA Vis 3" }], veo: [{ visual: k }], _plantilla: "visual" }));
}

/** Corre adentro de la página: devuelve { regla: { ok, detalle } }. Se pasa como función a page.evaluate. */
export const MEDIR_VISUAL = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05; };
  const visto = (e) => { for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) <= 0.05) return false; } return vis(e); };
  const quien = (el) => `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}${el.classList.length ? ` class="${[...el.classList].slice(0, 2).join(" ")}"` : ""}>`;
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const mezcla = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
  const fondo = (el) => { // el fondo que se ve detrás: se apilan los fondos de los ancestros (null si hay imagen/degradé)
    const capas = [];
    for (let x = el; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.backgroundImage && s.backgroundImage !== "none") return null; const c = rgb(s.backgroundColor); if (c && c.a > 0) { capas.push(c); if (c.a >= 1) break; } }
    let f = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of capas.reverse()) f = mezcla(c, f);
    return f;
  };
  const lum = (c) => { const t = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // textos visibles (un elemento por texto)
  const textos = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (n.nodeValue.trim() && el && !el.closest("script, style") && visto(el)) textos.add(el); }
  const out = {};
  // contraste
  const malos = [];
  for (const el of textos) {
    const s = getComputedStyle(el), c = rgb(s.color), f = fondo(el); if (!c || !f) continue;
    const tam = parseFloat(s.fontSize), negrita = Number(s.fontWeight) >= 700, grande = tam >= 24 || (negrita && tam >= 18.66);
    const r = ratio(mezcla(c, f), f), min = grande ? 3 : 4.5;
    if (r < min) malos.push({ el: quien(el), texto: el.textContent.trim().slice(0, 20), r: Math.round(r * 100) / 100, min, color: s.color, fondo: `rgb(${Math.round(f.r)}, ${Math.round(f.g)}, ${Math.round(f.b)})` });
  }
  const uno = new Map(); for (const m of malos) if (!uno.has(m.el + m.color)) uno.set(m.el + m.color, m);
  out.contraste = { ok: !malos.length, detalle: malos.length ? [...uno.values()].slice(0, 4).map((m) => `${m.el} "${m.texto}": ${m.r} a 1 (mínimo ${m.min}; letra ${m.color} sobre ${m.fondo})`).join(" · ") : `${textos.size} textos se leen bien` };
  // letra mínima
  const chicas = [...textos].filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12);
  out.letra_minima = { ok: !chicas.length, detalle: chicas.length ? chicas.slice(0, 4).map((el) => `${quien(el)} "${el.textContent.trim().slice(0, 15)}": ${getComputedStyle(el).fontSize}`).join(" · ") : "ninguna letra de menos de 12px" };
  // tocables
  const toc = [...document.querySelectorAll("button, input:not([type=hidden]), select, textarea, a[href], [onclick], [draggable=true], [role=button]")].filter(visto);
  const chicos = toc.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
  out.tocables = { ok: !chicos.length, detalle: chicos.length ? chicos.slice(0, 4).map((el) => { const r = el.getBoundingClientRect(); return `${quien(el)}${el.textContent.trim() ? ` "${el.textContent.trim().slice(0, 15)}"` : ""}: ${Math.round(r.width)}×${Math.round(r.height)}px`; }).join(" · ") : `${toc.length} controles de 24×24px o más` };
  // parejo
  const todos = [...document.querySelectorAll("body *")].filter(visto);
  const radios = new Set(todos.map((el) => getComputedStyle(el).borderTopLeftRadius).filter((x) => x && x !== "0px"));
  const letras = new Set([...textos].map((el) => getComputedStyle(el).fontSize));
  const okP = radios.size <= 4 && letras.size <= 6;
  out.parejo = { ok: okP, detalle: `${radios.size} redondeos (${[...radios].join(", ") || "—"}; máximo 4) · ${letras.size} tamaños de letra (${[...letras].join(", ")}; máximo 6)` };
  // no se corta: un contenedor (no la página) con scroll hacia el costado porque algo no entra
  const cortes = todos.filter((el) => { const s = getComputedStyle(el); return s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0; });
  out.no_se_corta = { ok: !cortes.length, detalle: cortes.length ? cortes.slice(0, 3).map((el) => { const hijo = [...el.querySelectorAll("*")].filter(visto).find((c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 1); return `${quien(el)} tiene ${el.scrollWidth}px de contenido en ${el.clientWidth}px${hijo ? ` (no entra ${quien(hijo)}, de ${Math.round(hijo.getBoundingClientRect().width)}px)` : ""}`; }).join(" · ") : "nada se sale de su caja" };
  // sin corrimiento horizontal
  const ancho = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  out.sin_corrimiento = { ok: ancho <= innerWidth + 1, detalle: ancho <= innerWidth + 1 ? `entra en ${innerWidth}px` : `la página mide ${ancho}px de ancho y la ventana ${innerWidth}px` };
  return out;
};
