// contract.mjs — paso 1 del Standard web/app/estado: el CONTRATO como datos (12/10, DRAFT).
//
// Diseño aprobado por Miche (12/10, "construilo así"): en una app el contrato no se conoce de antemano
// (un Kanban y un contador no tienen las mismas acciones). Gemma lo propone como JSON (estado inicial de
// ejemplo + acciones) y el harness lo valida, arregla los nombres y con él arma js/datos.js, el texto
// del contrato de los pasos siguientes y las pruebas de la lógica.
// Igual que los niveles en grilla: Gemma da datos, el código decide si sirven. Nada de un dominio acá.

const CONTROLS = ["boton", "formulario", "arrastrar", "teclado"];
const RESERVED = new Set(["crear", "estado", "App", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof", "let", "new", "return", "super", "switch", "this", "throw", "try", "typeof", "var", "void", "while", "with", "yield", "constructor", "prototype", "__proto__"]);
export const MAX_STATE_CHARS = 2500; // el estado va en el contrato de cada pedido (16k de contexto)
export const MAX_ACTIONS = 12;

/** "Agregar tarea" / "agregar_tarea" / "agregár-tarea" → "agregarTarea". null si no queda un nombre. */
export function toIdentifier(x) {
  const parts = String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/gi, "n").split(/[^A-Za-z0-9$]+/).filter(Boolean);
  if (!parts.length) return null;
  // camelCase: la primera palabra como venía (sin la primera mayúscula), las demás con mayúscula
  const id = parts.map((p, i) => (i === 0 ? p[0].toLowerCase() + p.slice(1) : p[0].toUpperCase() + p.slice(1))).join("");
  return /^[A-Za-z_$][\w$]*$/.test(id) ? id : null;
}

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
/** Números de feature: 3, "3", "R3", "feature 3" → 3. */
const featNum = (f) => { const m = String(f ?? "").match(/(\d+)/); return m ? Number(m[1]) : null; };

/**
 * Valida y normaliza el contrato. Las acciones que no sirven se descartan con el porqué.
 * @param {object} json   lo que escribió Gemma
 * @param {{features: string[], style: number[]}} h   features del brief (1..N) y cuáles son de estilo
 * @returns {{error}|{items:[contract], reports:[report], dropped:string[]}}
 */
export function parseContract(json, h = {}) {
  if (!isPlain(json)) return { error: 'el JSON tiene que ser { "estado": {...}, "acciones": [...], "se_ve": [...] }.' };
  const estado = json.estado;
  if (!isPlain(estado) || !Object.keys(estado).length) return { error: '"estado" tiene que ser un objeto con datos (el estado inicial de la app, con ejemplos).' };
  const stateTxt = JSON.stringify(estado);
  if (stateTxt.length > MAX_STATE_CHARS) return { error: `"estado" es muy largo (${stateTxt.length} caracteres; hasta ${MAX_STATE_CHARS}): dejá 2 o 3 ejemplos por lista.` };
  if (!Array.isArray(json.acciones) || !json.acciones.length) return { error: '"acciones" tiene que ser una lista con lo que el usuario puede hacer.' };
  const nFeat = (h.features || []).length;
  const keys = Object.keys(estado);
  const dropped = [], renamed = [], acciones = [];
  const used = new Set();
  json.acciones.slice(0, MAX_ACTIONS).forEach((a, i) => {
    const label = `acción ${i + 1}${a?.nombre ? ` ("${String(a.nombre).slice(0, 40)}")` : ""}`;
    const bad = (why) => dropped.push(`${label}: ${why}`);
    if (!isPlain(a)) return bad("tiene que ser un objeto.");
    const nombre = toIdentifier(a.nombre);
    if (!nombre) return bad('"nombre" tiene que ser un verbo en camelCase (p.ej. "agregarItem").');
    if (RESERVED.has(nombre)) return bad(`"${nombre}" no se puede usar como nombre (es del contrato o de JavaScript).`);
    if (used.has(nombre)) return bad(`"${nombre}" está repetida.`);
    if (nombre !== a.nombre) renamed.push(`${a.nombre} → ${nombre}`);
    let params = a.params ?? [];
    if (!Array.isArray(params)) return bad('"params" tiene que ser una lista de nombres (p.ej. ["texto"]).');
    params = params.map((p) => toIdentifier(isPlain(p) ? p.nombre ?? p.name : p));
    if (params.some((p) => !p)) return bad('"params" tiene nombres que no sirven: usá nombres cortos en camelCase.');
    // "estado" va siempre primero y no se lista (si Gemma lo puso, se saca)
    let ejemplo = a.ejemplo ?? [];
    if (!Array.isArray(ejemplo)) ejemplo = [ejemplo];
    if (params[0] === "estado") { params = params.slice(1); if (ejemplo.length === params.length + 1) ejemplo = ejemplo.slice(1); }
    if (new Set(params).size !== params.length || params.includes("estado")) return bad('"params" tiene nombres repetidos (o "estado" en otro lugar que no es el primero).');
    if (ejemplo.length !== params.length) return bad(`"ejemplo" tiene que tener un valor por cada param (${params.length}: ${params.join(", ") || "ninguno"}) y tiene ${ejemplo.length}.`);
    const control = CONTROLS.includes(String(a.control || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")) ? String(a.control).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "boton";
    const features = [...new Set([].concat(a.features ?? []).map(featNum).filter((n) => n && n >= 1 && (!nFeat || n <= nFeat)))];
    const cambia = [].concat(a.cambia ?? []).map(String).filter((k) => keys.includes(k));
    const hace = String(a.hace ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    used.add(nombre);
    acciones.push({ nombre, params, ejemplo, hace, control, features, cambia });
  });
  if (json.acciones.length > MAX_ACTIONS) dropped.push(`hay ${json.acciones.length} acciones; se usan las primeras ${MAX_ACTIONS}.`);
  if (!acciones.length) return { error: `ninguna acción sirve: ${dropped.slice(0, 3).join(" | ")}` };
  const seVe = [...new Set([].concat(json.se_ve ?? json.seVe ?? []).map(featNum).filter((n) => n && n >= 1 && (!nFeat || n <= nFeat)))];
  const contract = { estado, acciones, se_ve: seVe };
  return { items: [contract], reports: [{ renamed, dropped: [...dropped], gaps: gapsOf(contract, h) }], dropped };
}

/** Features del brief (sin las de estilo) que no cumple ninguna acción ni están en "se_ve". */
export function gapsOf(contract, h = {}) {
  const covered = new Set([...contract.acciones.flatMap((a) => a.features), ...contract.se_ve]);
  return (h.features || []).map((f, i) => i + 1).filter((n) => !(h.style || []).includes(n) && !covered.has(n));
}

/** De todos los contratos válidos (juntando intentos), el que menos features deja afuera (empate: el último). */
export function bestContract(items, reports, h) {
  let best = 0;
  items.forEach((c, i) => { if (gapsOf(c, h).length + (reports[i]?.dropped?.length || 0) <= gapsOf(items[best], h).length + (reports[best]?.dropped?.length || 0)) best = i; });
  return best;
}

/** Problemas que no rompen (se reintenta y se queda el mejor): features sin cubrir y acciones descartadas. */
export function contractProblems(parsed, h = {}) {
  const c = parsed?.items?.[0];
  if (!c) return [];
  const rep = parsed.reports?.[0] || {};
  return [
    ...(rep.dropped || []),
    ...gapsOf(c, h).map((n) => `la feature ${n} ("${String(h.features[n - 1]).slice(0, 80)}") no está en "features" de ninguna acción ni en "se_ve".`),
  ];
}

export const datosJs = (estado) => `// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)\nconst ESTADO_INICIAL = ${JSON.stringify(estado, null, 2)};\n`;

/** Firma de una acción: agregarItem(estado, texto). */
export const signature = (a) => `${a.nombre}(${["estado", ...a.params].join(", ")})`;
