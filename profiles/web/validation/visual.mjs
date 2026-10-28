// visual.mjs v0.1 (22/10/2026) — reglas visuales que se MIDEN en la página, para cualquier app web.
// No dicen si algo es "lindo": dicen si se puede leer, tocar y si es parejo. Lo que pidió el usuario (colores, medidas)
// lo prueba la planilla; estas reglas nunca lo contradicen (la planilla manda: si una regla choca, gana la planilla).
// Origen: Miche (22/10) "una skill para que mejore la parte visual"; evidencia 10/10: una Skill sin medida es placebo.
export const VISUAL_VERSION = "visual v0.2"; // v0.2 (25/10): no_se_superpone (con el mouse encima)

/** Las reglas: id → { dice (para el que construye), mide (para el juez) }. */
// "como": la parte Skill (cómo se arregla, en una línea); "dice": lo que se mide.
export const REGLAS_VISUALES = {
  contraste: { dice: "todo texto se lee contra su fondo: contraste de al menos 4.5 a 1 (3 a 1 si la letra es grande: 24px, o 19px en negrita)", como: "sobre fondos claros o de color medio, letra oscura (#1a1a1a); sobre fondos oscuros, letra blanca. Si el color de fondo lo pidió el usuario, cambiá el color de la LETRA, no el fondo" },
  no_se_corta: { dice: "nada se sale de su caja ni queda cortado: ningún contenedor tiene scroll hacia el costado por algo que no entra", como: "con padding y borde, el ancho total crece: usá box-sizing: border-box (o un ancho que entre en el contenedor); si el usuario pidió un ancho, respetalo y hacé que lo de afuera tenga lugar" },
  letra_minima: { dice: "ningún texto visible tiene letra de menos de 12px", como: "subí el font-size a 12px o más" },
  tocables: { dice: "todo lo que se aprieta o se agarra (botones, campos, manijas) mide al menos 24×24px", como: "agrandá con padding o min-width/min-height" },
  parejo: { dice: "la app usa pocos valores distintos: como mucho 4 redondeos de borde y 6 tamaños de letra", como: "reusá los mismos valores (p. ej. redondeo 4px y 8px; letra 12, 14, 16, 20, 28px)" },
  // 25/10 (Miche: "al hacer hover, los botones de editar y borrar se superponen con el título"): se mide con el mouse encima de un ítem
  no_se_superpone: { dice: "con el mouse encima de un ítem, ningún texto ni botón queda encima de otro", como: "dale lugar a lo que aparece (p. ej. padding-right en el título igual al ancho de los botones, o ponelos en su propia fila); no los tapes con position: absolute", hover: true },
  sin_corrimiento: { dice: "con la ventana de 1280px la página no tiene scroll hacia el costado", como: "que el ancho total de lo que va en fila entre en la ventana (o que ese contenedor scrollee solo)" },
};
/** Filas de planilla para las reglas visuales: con 3 ítems creados, se mide cada regla. ids V1… */
export function filasVisuales(reglas = Object.keys(REGLAS_VISUALES)) {
  // el 1º ítem con un título LARGO (no "QA …", que se cambia por uno corto al azar): con títulos cortos nada llega a pisarse
  const LARGO = "Revisar el pedido del cliente y preparar la entrega final";
  return reglas.map((k, i) => ({ id: `V${i + 1}.1`, r: `V${i + 1}`, dado: [0, 1, 2, 3].map((n) => ({ agregar: n === 0 ? LARGO : `QA Vis ${n + 1}`, campos: { __variante: n } })), ...(REGLAS_VISUALES[k].hover ? { hago: { pasar_mouse: LARGO } } : {}), veo: [{ visual: k }], _plantilla: "visual" }));
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
  // 27/10 (M9 ×3 corridas: la pastilla del contador sumaba un 5º redondeo y V5 la rechazaba): una forma de pastilla
  // (redondeo ≥ la mitad del alto) no es "otro redondeo más", es una forma aparte; se cuenta sola y no suma al máximo
  const pastilla = (el) => { const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0; return r > 0 && r >= el.getBoundingClientRect().height / 2 - 0.5; };
  const radios = new Set(todos.filter((el) => !pastilla(el)).map((el) => getComputedStyle(el).borderTopLeftRadius).filter((x) => x && x !== "0px"));
  const nPast = todos.filter(pastilla).length;
  const letras = new Set([...textos].map((el) => getComputedStyle(el).fontSize));
  const okP = radios.size <= 4 && letras.size <= 6;
  out.parejo = { ok: okP, detalle: `${radios.size} redondeos (${[...radios].join(", ") || "—"}; máximo 4${nPast ? `; más ${nPast} en forma de pastilla, que no cuentan` : ""}) · ${letras.size} tamaños de letra (${[...letras].join(", ")}; máximo 6)` };
  // no se corta: un contenedor (no la página) con scroll hacia el costado porque algo no entra
  const cortes = todos.filter((el) => { const s = getComputedStyle(el); return s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0; });
  // 23/10 (V2 ×5: Gemma achicaba el ancho que pidió el usuario y rompía R12): se dan las cuentas, ancho + relleno + borde
  const px = (x) => Math.round(parseFloat(x) || 0);
  const cuentas = (el) => { const s = getComputedStyle(el); const w = px(s.width), p = px(s.paddingLeft) + px(s.paddingRight), b = px(s.borderLeftWidth) + px(s.borderRightWidth); return s.boxSizing === "border-box" ? `ancho ${w}px (box-sizing: border-box: ya incluye relleno y borde)` : `ancho ${w}px + relleno ${p}px + borde ${b}px = ${w + p + b}px`; };
  out.no_se_corta = { ok: !cortes.length, detalle: cortes.length ? cortes.slice(0, 3).map((el) => { const hijo = [...el.querySelectorAll("*")].filter(visto).find((c) => c.getBoundingClientRect().right > el.getBoundingClientRect().right + 1); const s = getComputedStyle(el), lugar = el.clientWidth - px(s.paddingLeft) - px(s.paddingRight); return `${quien(el)} tiene ${el.scrollWidth}px de contenido en ${el.clientWidth}px${hijo ? `: no entra ${quien(hijo)} (${cuentas(hijo)}) en el lugar de adentro de ${quien(el)} (${el.clientWidth}px − relleno ${px(s.paddingLeft) + px(s.paddingRight)}px = ${lugar}px). Si el usuario pidió ese ancho, respetalo y achicá los rellenos` : ""}`; }).join(" · ") : "nada se sale de su caja" };
  // no se superpone: textos y controles que se pisan (ninguno adentro del otro), con lo que esté visible en ese momento
  const ATOM = "button, input:not([type=hidden]), select, textarea, a[href]";
  const atomos = todos.filter((el) => el.matches(ATOM) || ([...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && !el.closest(ATOM)));
  // lo que se ve de cada uno: recortado por los ancestros que cortan (overflow ≠ visible), si no un elemento escondido por scroll "pisa"
  // de un texto se mide la LETRA (un Range), no la caja: un <div> de título ocupa todo el ancho aunque su texto sea corto
  const caja = (el) => { if (el.matches(ATOM)) return el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((q) => q.width > 0 && q.height > 0); if (!rs.length) return el.getBoundingClientRect(); return { left: Math.min(...rs.map((q) => q.left)), top: Math.min(...rs.map((q) => q.top)), right: Math.max(...rs.map((q) => q.right)), bottom: Math.max(...rs.map((q) => q.bottom)) }; };
  const recorte = (el) => { let r = caja(el), L = r.left, T = r.top, R = r.right, B = r.bottom; for (let x = el.parentElement; x && x !== document.documentElement; x = x.parentElement) { const st = getComputedStyle(x); if (st.overflowX !== "visible" || st.overflowY !== "visible") { const q = x.getBoundingClientRect(); L = Math.max(L, q.left); T = Math.max(T, q.top); R = Math.min(R, q.right); B = Math.min(B, q.bottom); } } return { left: L, top: T, right: R, bottom: B }; };
  const rects = atomos.map(recorte);
  const pisadas = [];
  for (let i = 0; i < atomos.length && pisadas.length < 3; i++) for (let j = i + 1; j < atomos.length && pisadas.length < 3; j++) {
    const a = atomos[i], b = atomos[j]; if (a.contains(b) || b.contains(a)) continue;
    const r = rects[i], q = rects[j], w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (w > 4 && h > 4) pisadas.push(`${quien(a)}${a.textContent.trim() ? ` "${a.textContent.trim().slice(0, 15)}"` : ""} y ${quien(b)}${b.textContent.trim() ? ` "${b.textContent.trim().slice(0, 15)}"` : ""} se pisan ${Math.round(w)}×${Math.round(h)}px`);
  }
  out.no_se_superpone = { ok: !pisadas.length, detalle: pisadas.length ? pisadas.join(" · ") : `${atomos.length} textos y controles, ninguno encima de otro` };
  // sin corrimiento horizontal
  const ancho = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  out.sin_corrimiento = { ok: ancho <= innerWidth + 1, detalle: ancho <= innerWidth + 1 ? `entra en ${innerWidth}px` : `la página mide ${ancho}px de ancho y la ventana ${innerWidth}px` };
  return out;
};

// ---------- reglas de diseño MODERNO (25/10) ----------
// Miche: "llevarlo a un diseño moderno, respetando mi paleta y mis elecciones" + 3 referencias (Jira, Hussle, Eniun).
// Lo que tienen en común las referencias, dicho de forma que el juez lo pueda MEDIR, para cualquier app con ítems agrupados.
// "como" es la parte Skill. Elecciones de Miche (25/10): acento suave por grupo, alto según contenido, título limpio + contador en pastilla.
export const MODERNO_VERSION = "moderno v0.2";
export const REGLAS_MODERNAS = {
  redondeado: { dice: "superficies redondeadas: cada grupo con redondeo de 12px o más y cada ítem de 8px o más", como: "border-radius: 14px en los grupos y 10px en los ítems (no cambies los redondeos que pidió el usuario en otros elementos)" },
  sombra_suave: { dice: "los ítems tienen una sombra suave (difusa: 6px o más; transparente: opacidad 0.3 o menos), sin bordes gruesos", como: "box-shadow: 0 2px 8px rgba(16, 44, 84, 0.12); borde de 1px o ninguno" },
  tipografia: { dice: "la letra es una sans moderna (Inter, system-ui, Segoe UI, Roboto, Helvetica o Arial), no la de serif por defecto ni 'sans-serif' a secas", como: "font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif en body" },
  jerarquia: { dice: "dentro de cada ítem el título se distingue del resto: más grande o más pesado, y el texto secundario en un tono más apagado (pero legible)", como: "título 15px peso 600; descripción 13px con un color más suave que el título" },
  aire: { dice: "los ítems respiran: relleno interno de 12px o más y 8px o más de separación entre uno y otro", como: "padding: 14px en el ítem; gap o margin-bottom de 12px entre ítems" },
  alto_contenido: { dice: "cada ítem mide lo que ocupa su contenido: sin alto fijo que deje más de 40px vacíos abajo", como: "sacá height fijo de los ítems (podés dejar un min-height chico); que el contenido marque el alto" },
  hover_vivo: { dice: "al pasar el mouse por un ítem, el ítem reacciona (se eleva: cambia la sombra o se mueve un poco)", como: ".item:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(16,44,84,.18) } con transition de .15s", hover: true },
  encabezado_limpio: { dice: "el título de cada grupo va limpio, sin una barra pintada de lado a lado que lo envuelva", como: "sacá el fondo de la barra del encabezado (que se vea el fondo del grupo) y separá con espacio, no con una franja de color. OJO: el título y el contador quedan sobre el fondo del grupo: si es claro, poneles letra oscura (p. ej. el color oscuro de la paleta) para que se sigan leyendo" },
  contador_pastilla: { dice: "el contador de cada grupo va en una pastilla: fondo propio distinto del que lo rodea y bien redondeada (8px o más)", como: "padding: 2px 10px; border-radius: 999px; background: un tono más oscuro o más claro del grupo (p. ej. rgba del color oscuro de la paleta al 15%); letra oscura si la pastilla es clara, para que se lea; usá un tamaño de letra que ya exista en la página (no inventes uno nuevo)" },
  acento_por_grupo: { dice: "cada grupo tiene un color de acento suave propio, distinto del de los otros (p. ej. una línea arriba de 3px o un detalle en el encabezado)", como: "border-top: 3px solid <un color suave distinto por grupo>, en tonos que combinen con la paleta del usuario; no cambies los colores que pidió" },
  // 27/10 (moderno v0.2): lo que Miche y Claude vieron a ojo en la app 43/43 y ninguna regla medía
  fondo_a_la_vista: { dice: "el fondo de cada grupo se ve: ningún contenedor de otro color tapa más de la mitad del grupo", como: "dejá sin fondo (background: transparent) el contenedor que va adentro del grupo, para que se vea el color del grupo; los ítems sí tienen su propio color" },
  texto_cerca_del_borde: { dice: "en cada ítem el texto arranca cerca del borde: a 28px o menos del borde de arriba y del de la izquierda (sin franjas vacías reservadas)", como: "relleno del ítem de 12 a 16px y nada más: los rellenos de lo que va adentro del ítem SE SUMAN a ese (relleno del ítem + relleno de adentro ≤ 28px), así que lo de adentro casi no lleva relleno; la manija entra en ese relleno de la izquierda; si los botones que aparecen al pasar el mouse tapan el título, movelos abajo a la derecha (bottom: 10px; right: 10px) en vez de dejar una franja vacía arriba" },
  esquinas: { dice: "lo de adentro respeta las esquinas redondeadas: ningún fondo ni borde se sale de la curva de su contenedor", como: "overflow: hidden en el contenedor redondeado (así recorta lo de adentro a su curva), o el mismo border-radius en la esquina del elemento de adentro" },
};
/** Filas para las reglas modernas (ids M1…): 4 ítems creados (una variante cada uno). */
export function filasModernas(reglas = Object.keys(REGLAS_MODERNAS)) {
  return reglas.map((k, i) => ({ id: `M${i + 1}.1`, r: `M${i + 1}`, dado: [0, 1, 2, 3].map((n) => ({ agregar: `QA Mod ${n + 1}`, campos: { __variante: n } })), veo: [{ moderno: k }], _plantilla: "moderno" }));
}
/** Corre en la página: { regla: { ok, detalle } } para todas menos hover_vivo (que necesita antes/después). Recibe la regex de ítems. */
export const MEDIR_MODERNO = (src) => {
  const re = new RegExp(src, "i");
  const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const quien = (el) => `<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ""}${el.classList.length ? ` class="${[...el.classList].slice(0, 2).join(" ")}"` : ""}>`;
  const esItem = (x) => [...x.classList].some((k) => re.test(k)) || x.tagName === "LI";
  const inItem = (h) => { for (let x = h; x && x !== document.body; x = x.parentElement) if (esItem(x)) return true; return false; };
  const HS = "h1, h2, h3, h4, h5, h6, [class*=title], [class*=titulo], [class*=header]";
  const titled = (a) => [...a.querySelectorAll(HS)].find((h) => !inItem(h) && (h.textContent || "").trim() && h.getClientRects().length);
  let grupos = null;
  for (const p of document.querySelectorAll("body *")) { const hs = [...p.children].filter((c) => titled(c) && vis(c)); if (hs.length >= 2 && (!grupos || hs.length > grupos.length)) grupos = hs; }
  grupos = grupos || [];
  // ítems: el más externo con clase de ítem (no sus partes: card-title, card-body…)
  const items = [...document.querySelectorAll("body *")].filter((x) => vis(x) && esItem(x) && !(x.parentElement && inItem(x.parentElement)));
  const px = (v) => parseFloat(v) || 0;
  const out = {};
  const rgba = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const sinItems = (k) => ({ ok: false, detalle: `no encontré ítems para medir ${k}` });
  // redondeado
  const gMal = grupos.filter((g) => px(getComputedStyle(g).borderTopLeftRadius) < 12), iMal = items.filter((i) => px(getComputedStyle(i).borderTopLeftRadius) < 8);
  out.redondeado = !items.length ? sinItems("redondeado") : { ok: !gMal.length && !iMal.length && grupos.length > 0, detalle: [gMal.length ? `${quien(gMal[0])}: redondeo ${getComputedStyle(gMal[0]).borderTopLeftRadius} (mínimo 12px)` : `grupos: ${grupos.length ? getComputedStyle(grupos[0]).borderTopLeftRadius : "no encontré grupos"}`, iMal.length ? `${quien(iMal[0])}: redondeo ${getComputedStyle(iMal[0]).borderTopLeftRadius} (mínimo 8px)` : `ítems: ${getComputedStyle(items[0]).borderTopLeftRadius}`].join(" · ") };
  // sombra suave
  if (!items.length) out.sombra_suave = sinItems("sombra_suave"); else {
    const s = getComputedStyle(items[0]), sh = s.boxShadow;
    const m = sh && sh !== "none" ? sh.match(/rgba?\([^)]+\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/) : null;
    const col = sh && sh !== "none" ? rgba(sh) : null, blur = m ? Number(m[3]) : 0, alfa = col ? col.a : 1, borde = Math.max(px(s.borderTopWidth), px(s.borderLeftWidth));
    out.sombra_suave = { ok: !!m && blur >= 6 && alfa <= 0.3 && borde <= 1, detalle: `${quien(items[0])}: ${sh === "none" ? "sin sombra" : `sombra difusa ${blur}px, opacidad ${alfa}`}${borde > 1 ? `, borde de ${borde}px (máximo 1)` : ""}` };
  }
  // tipografía
  const fam = getComputedStyle(document.body).fontFamily, prim = fam.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  const MOD = ["inter", "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica", "helvetica neue", "arial", "poppins", "montserrat", "nunito", "open sans", "lato", "manrope", "dm sans"];
  out.tipografia = { ok: MOD.includes(prim), detalle: `body: font-family ${fam}` };
  // jerarquía: dentro del ítem, el texto más destacado (tamaño×peso) vs el resto
  if (!items.length) out.jerarquia = sinItems("jerarquia"); else {
    const it = items[0];
    const txt = [...it.querySelectorAll("*")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && !e.closest("button"));
    const peso = (e) => { const s = getComputedStyle(e); return px(s.fontSize) * (Number(s.fontWeight) >= 600 ? 1.25 : 1); };
    const orden = txt.sort((a, b) => peso(b) - peso(a)), t = orden[0], r = orden.slice(1).filter((e) => (e.textContent || "").trim().length > 8);
    const lum = (c) => { const x = rgba(c); return x ? 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b : 0; };
    const ok = !!t && r.length > 0 && peso(t) > peso(r[0]) && Math.abs(lum(getComputedStyle(t).color) - lum(getComputedStyle(r[0]).color)) >= 12;
    out.jerarquia = { ok, detalle: t ? `título ${quien(t)} ${getComputedStyle(t).fontSize} peso ${getComputedStyle(t).fontWeight} color ${getComputedStyle(t).color}${r[0] ? ` · secundario ${quien(r[0])} ${getComputedStyle(r[0]).fontSize} peso ${getComputedStyle(r[0]).fontWeight} color ${getComputedStyle(r[0]).color}${ok ? "" : " (el título tiene que ser más grande o más pesado, y el secundario de otro tono)"}` : " · no hay texto secundario"}` : "el ítem no tiene textos" };
  }
  // aire
  if (!items.length) out.aire = sinItems("aire"); else {
    const s = getComputedStyle(items[0]), pad = Math.min(px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft));
    const hermanos = items.filter((x) => x.parentElement === items[0].parentElement).map((x) => x.getBoundingClientRect()).sort((a, b) => a.top - b.top);
    const sep = hermanos.length > 1 ? Math.min(...hermanos.slice(1).map((r, i) => Math.round(r.top - hermanos[i].bottom))) : null;
    out.aire = { ok: pad >= 12 && (sep == null || sep >= 8), detalle: `${quien(items[0])}: relleno mínimo ${pad}px (mínimo 12)${sep != null ? ` · separación entre ítems ${sep}px (mínimo 8)` : ""}` };
  }
  // alto según contenido: espacio vacío abajo del último contenido visible
  if (!items.length) out.alto_contenido = sinItems("alto_contenido"); else {
    const vac = items.map((it) => { const r = it.getBoundingClientRect(), s = getComputedStyle(it); const hijos = [...it.querySelectorAll("*")].filter((e) => vis(e) && getComputedStyle(e).position !== "absolute" && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())); const fin = hijos.length ? Math.max(...hijos.map((e) => e.getBoundingClientRect().bottom)) : r.top; return { it, vacio: Math.round(r.bottom - px(s.paddingBottom) - fin), alto: Math.round(r.height) }; });
    const peor = vac.sort((a, b) => b.vacio - a.vacio)[0];
    out.alto_contenido = { ok: peor.vacio <= 40, detalle: `${quien(peor.it)} mide ${peor.alto}px y le quedan ${peor.vacio}px vacíos abajo del contenido (máximo 40)${peor.vacio > 40 ? `; height: ${getComputedStyle(peor.it).height}` : ""}` };
  }
  // encabezado limpio / contador en pastilla / acento por grupo
  const fondoDe = (el) => { for (let x = el; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c && c.a > 0.05) return { c, x }; } return { c: { r: 255, g: 255, b: 255, a: 1 }, x: document.body }; };
  const igual = (a, b) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 12;
  if (!grupos.length) { out.encabezado_limpio = out.contador_pastilla = out.acento_por_grupo = { ok: false, detalle: "no encontré grupos con título" }; } else {
    const barras = [], pastillas = [], firmas = [];
    for (const g of grupos) {
      const t = titled(g), gb = fondoDe(g).c, gr = g.getBoundingClientRect();
      for (let x = t; x && x !== g; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c && c.a > 0.05 && !igual(c, gb) && x.getBoundingClientRect().width >= gr.width * 0.9) { barras.push(`${quien(x)} (fondo ${getComputedStyle(x).backgroundColor} de lado a lado)`); break; } }
      // el contador: el primer número fuera de ítems y botones
      let cont = null; const w = document.createTreeWalker(g, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const el = n.parentElement; if (el && !inItem(el) && !el.closest("button, select, option") && vis(el) && /^\s*\d+\s*$/.test(n.nodeValue)) { cont = el; break; } }
      if (cont) { const s = getComputedStyle(cont), c = rgba(s.backgroundColor), alrededor = fondoDe(cont.parentElement).c; const ok = !!c && c.a > 0.05 && !igual(c, alrededor) && px(s.borderTopLeftRadius) >= 8; if (!ok) pastillas.push(`${quien(cont)} "${cont.textContent.trim()}": fondo ${s.backgroundColor}, redondeo ${s.borderTopLeftRadius}`); } else pastillas.push(`${quien(g)}: no encontré su contador`);
      const gs = getComputedStyle(g), f = [];
      if (px(gs.borderTopWidth) >= 2) f.push(gs.borderTopColor);
      for (const e of g.querySelectorAll("*")) { if (inItem(e) || !vis(e)) continue; if (e.getBoundingClientRect().top > gr.top + 80) continue; const s = getComputedStyle(e); if (px(s.borderTopWidth) >= 2) f.push(s.borderTopColor); if (px(s.borderLeftWidth) >= 3) f.push(s.borderLeftColor); const c = rgba(s.backgroundColor); if (c && c.a > 0.05 && px(s.borderTopLeftRadius) >= 4 && e !== cont) f.push(s.backgroundColor); }
      firmas.push(f.join("|"));
    }
    out.encabezado_limpio = { ok: !barras.length, detalle: barras.length ? `barra pintada en el encabezado: ${barras.slice(0, 2).join(" · ")}` : `${grupos.length} títulos sin barra` };
    out.contador_pastilla = { ok: !pastillas.length, detalle: pastillas.length ? pastillas.slice(0, 3).join(" · ") : "contadores en pastilla" };
    const distintas = new Set(firmas).size === firmas.length && firmas.every(Boolean);
    out.acento_por_grupo = { ok: distintas, detalle: distintas ? `${grupos.length} grupos con acento propio` : `los grupos no tienen un acento distinto cada uno (${firmas.map((f, i) => `${quien(grupos[i])}: ${f || "ninguno"}`).join(" · ").slice(0, 300)})` };
  }
  // fondo a la vista: un contenedor (no ítem) de otro color que tapa más de la mitad de un grupo con fondo propio
  if (!grupos.length) out.fondo_a_la_vista = { ok: false, detalle: "no encontré grupos con título" }; else {
    const tapas = [];
    for (const g of grupos) {
      const gc = rgba(getComputedStyle(g).backgroundColor); if (!gc || gc.a <= 0.05) continue;
      const gr = g.getBoundingClientRect(), area = gr.width * gr.height;
      for (const e of g.querySelectorAll("*")) { if (!vis(e) || inItem(e)) continue; const c = rgba(getComputedStyle(e).backgroundColor); if (!c || c.a <= 0.5 || igual(c, gc)) continue; const r = e.getBoundingClientRect(); if (r.width * r.height >= area * 0.5) { tapas.push(`${quien(e)} (fondo ${getComputedStyle(e).backgroundColor}) tapa el ${Math.round((100 * r.width * r.height) / area)}% de ${quien(g)} (fondo ${getComputedStyle(g).backgroundColor})`); break; } }
    }
    out.fondo_a_la_vista = { ok: !tapas.length, detalle: tapas.length ? tapas.slice(0, 3).join(" · ") : "el fondo de los grupos se ve" };
  }
  // texto cerca del borde: dónde arranca la letra (un Range) respecto del borde del ítem
  if (!items.length) out.texto_cerca_del_borde = sinItems("texto_cerca_del_borde"); else {
    const lejos = [];
    for (const it of items) {
      const ir = it.getBoundingClientRect(); let L = Infinity, T = Infinity, eL = null, eT = null;
      const w = document.createTreeWalker(it, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { if (!/[\p{L}\d]/u.test(n.nodeValue) || !n.parentElement || n.parentElement.closest("button") || !vis(n.parentElement)) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 0) { if (q.left < L) { L = q.left; eL = n.parentElement; } if (q.top < T) { T = q.top; eT = n.parentElement; } } }
      if (L === Infinity) continue;
      const iz = Math.round(L - ir.left), ar = Math.round(T - ir.top);
      if (iz > 28 || ar > 28) lejos.push({ it, iz, ar, eL, eT });
    }
    // 28/10 (M12 ×3 corridas: Gemma bajaba el relleno de adentro a 15 y quedaba en 30 = 15 del ítem + 15): se dan las cuentas, como en no_se_corta
    const cuenta = (it, el, lado, total) => { const K = lado === "top" ? "Top" : "Left", partes = []; let suma = 0; for (let x = el; x; x = x.parentElement) { const st = getComputedStyle(x), pad = px(st[`padding${K}`]) + px(st[`border${K}Width`]), mar = x === it ? 0 : px(st[`margin${K}`]); if (pad) { partes.push(`relleno de ${quien(x)} ${pad}px`); suma += pad; } if (mar) { partes.push(`margen de ${quien(x)} ${mar}px`); suma += mar; } if (x === it) break; } const resto = Math.round(total - suma); return `${total}px = ${partes.join(" + ") || "0"}${resto ? ` + ${resto}px de la línea de texto` : ""}`; };
    const p0 = lejos[0];
    const txt0 = p0 ? [p0.ar > 28 ? `arriba ${cuenta(p0.it, p0.eT, "top", p0.ar)}` : "", p0.iz > 28 ? `a la izquierda ${cuenta(p0.it, p0.eL, "left", p0.iz)}` : ""].filter(Boolean).join(" · ") : "";
    out.texto_cerca_del_borde = { ok: !lejos.length, detalle: p0 ? `${quien(p0.it)}: el texto arranca a ${p0.ar}px del borde de arriba y a ${p0.iz}px del de la izquierda (máximo 28 cada uno). Las cuentas: ${txt0}. Lo que cuenta es la SUMA: bajá los rellenos hasta que dé 28 o menos` : `${items.length} ítems con el texto cerca del borde` };
  }
  // esquinas: algo que pinta (fondo o borde) en la esquina de un contenedor redondeado que no recorta (overflow visible)
  {
    const ESQ = [["TopLeft", "top", "left"], ["TopRight", "top", "right"], ["BottomLeft", "bottom", "left"], ["BottomRight", "bottom", "right"]];
    const malas = [];
    for (const p of document.querySelectorAll("body *")) {
      if (malas.length >= 3) break; if (!vis(p)) continue; const ps = getComputedStyle(p); if (ps.overflowX !== "visible" || ps.overflowY !== "visible") continue;
      const pr = p.getBoundingClientRect();
      for (const [k, v, h] of ESQ) {
        const rad = px(ps[`border${k}Radius`]); if (rad < 6 || malas.length >= 3) continue;
        for (const d of p.querySelectorAll("*")) {
          if (!vis(d)) continue; const dr = d.getBoundingClientRect(); if (Math.abs(dr[v] - pr[v]) > 1 || Math.abs(dr[h] - pr[h]) > 1) continue;
          const ds = getComputedStyle(d), bg = rgba(ds.backgroundColor), V = v[0].toUpperCase() + v.slice(1), H = h[0].toUpperCase() + h.slice(1);
          const pinta = (bg && bg.a > 0.05) || px(ds[`border${V}Width`]) >= 1 || px(ds[`border${H}Width`]) >= 1;
          if (pinta && px(ds[`border${k}Radius`]) < rad - 2) { malas.push(`${quien(d)} se sale de la esquina ${v === "top" ? "de arriba" : "de abajo"} a la ${h === "left" ? "izquierda" : "derecha"} de ${quien(p)} (redondeo ${rad}px; ${quien(d)} tiene ${ds[`border${k}Radius`]}${bg && bg.a > 0.05 ? `, fondo ${ds.backgroundColor}` : ", borde"})`); break; }
        }
      }
    }
    out.esquinas = { ok: !malas.length, detalle: malas.length ? malas.join(" · ") : "nada se sale de las esquinas redondeadas" };
  }
  return out;
};
