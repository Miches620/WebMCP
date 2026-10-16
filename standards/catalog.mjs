// standards/catalog.mjs — FICHAS de los Standards (solo datos: lo cargan el navegador y Node).
//
// 16/10 (decisión de Miche): el stack lo fija el Standard, no un modelo. registry.mjs carga los Standards enteros
// (pasos, pruebas: solo Node); este catálogo tiene lo que necesitan TechLeader, Atomizer y la UI sin cargar eso:
// id, estado (DRAFT/OFICIAL/SUPERSEDED), stack (qué usa y qué no) y requisitos de instalación.
// Un Standard nuevo (p.ej. "quiero probar el stack de moda") nace DRAFT: se agrega su ficha acá y su standard.mjs
// en registry.mjs; la evidencia decide si se oficializa. Nunca se borra uno viejo: se marca SUPERSEDED.

import estado from "./web/app/estado/meta.mjs";
import grilla from "./web/game/grilla/meta.mjs";
import plantillas from "./web/app/plantillas/meta.mjs";

export const STATUSES = ["DRAFT", "OFICIAL", "SUPERSEDED"];
const ALL = [estado, plantillas, grilla];
export const CATALOG = Object.freeze(Object.fromEntries(ALL.map((m) => [m.id, m])));

/** La ficha de un Standard, o falla fuerte. */
export function standardMeta(id) {
  const m = CATALOG[id];
  if (!m) throw new Error(`STANDARD_UNKNOWN: "${id}". Standards: ${Object.keys(CATALOG).join(", ")}`);
  return m;
}

/** Standards que se pueden usar con un tipo de proyecto (los SUPERSEDED no se ofrecen). */
export function standardsFor(profileId) {
  return ALL.filter((m) => m.profiles.includes(profileId) && m.status !== "SUPERSEDED");
}

/** El bloque que recibe el TechLeader (y el Atomizer): el stack como dato, no como sugerencia. */
export function stackText(meta) {
  if (!meta?.stack) return "";
  const s = meta.stack;
  return `STACK (lo fija el Standard ${meta.id} v${meta.version}; NO lo elegís ni lo cambiás):
- Se construye con: ${s.nombre}.
${s.usa.map((u) => `- ${u}`).join("\n")}
- ${s.servidor ? "Hay servidor." : "NO hay servidor: todo corre en el navegador. No planifiques backend, APIs, endpoints ni base de datos."}
- No uses ni nombres (en fases, descripciones ni tareas): ${s.no_usa.join(", ")}. Los ROLES de trabajo (Frontend, Backend, QA…) son otra cosa: se asignan igual.`;
}

const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "sin servidor", "no usar React", "evitar backend": nombrar algo para negarlo no es usarlo
const NEGATION = /\b(sin|no|ni|evitar|evita|nada de|sin usar|prohibido)\s+(\w+\s+){0,2}$/;
// "la API de localStorage", "la API del DOM" son del navegador, no de un servidor
const OK_AFTER = { api: /^\s+(de|del|de la)\s+(localstorage|dom|navegador|html5|drag|portapapeles)/ };

/** Términos de `terms` que aparecen en `text` como palabra entera, sin contar los negados. */
export function mentions(text, terms = []) {
  const t = normalize(text);
  const found = [];
  for (const term of terms) {
    const re = new RegExp(`(^|[^\\w])${escapeRe(normalize(term))}(?![\\w])`, "g");
    let m, real = false;
    while ((m = re.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 30), m.index + m[1].length);
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40);
      const ok = OK_AFTER[normalize(term)];
      if (!NEGATION.test(before) && !(ok && ok.test(after))) { real = true; break; }
    }
    if (real) found.push(term);
  }
  return found;
}

/** Todas las tecnologías que nombra algún Standard (para reconocer un stack pedido en el brief). */
export function knownTech() {
  const names = new Set();
  for (const m of ALL) for (const x of [...m.stack.no_usa, ...(m.stack.tecnologias || [])]) names.add(x);
  return [...names];
}

/**
 * ¿El brief pide un stack? Devuelve lo que nombra y si el Standard elegido lo cubre.
 * Lo usa la UI antes del TechLeader: si Miche pidió algo que el Standard no usa, decide él (nunca un modelo).
 * @returns {{pedidas: string[], fuera: string[], otros: {tech:string, standards:string[]}[]}}
 */
export function stackRequest(briefText, standardId) {
  const meta = standardMeta(standardId);
  const pedidas = mentions(briefText, knownTech());
  const fuera = pedidas.filter((x) => meta.stack.no_usa.some((n) => normalize(n) === normalize(x)));
  const otros = fuera.map((tech) => ({ tech, standards: ALL.filter((m) => m.id !== meta.id && (m.stack.tecnologias || []).some((x) => normalize(x) === normalize(tech))).map((m) => m.id) }));
  return { pedidas, fuera, otros };
}
