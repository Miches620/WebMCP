// acceptance.mjs — pruebas de js/logica.js del Standard web/app/estado (12/10, DRAFT).
//
// No saben de ninguna app: salen del CONTRATO (paso 1). Lo que se prueba es lo que vale para cualquier
// app con estado (decisión de diseño del 12/10):
//   - crear() devuelve una COPIA de ESTADO_INICIAL (si devuelve el mismo objeto, una acción lo rompe);
//   - cada acción, con el estado inicial y su "ejemplo": no tira error, devuelve un estado (objeto),
//     no modifica el que recibe, conserva las claves, hace algo, y el estado son solo datos (Kanban v1:
//     "[object HTMLDivElement]" en pantalla = un elemento guardado en el estado).
// Lo que Gemma dijo que cambia cada acción ("cambia") se OBSERVA y se guarda, pero no bloquea: todavía
// no hay evidencia de que sus expectativas sean correctas (pruebas primero, 11/10: 85% correctas).

const J = (x) => { try { return JSON.stringify(x); } catch { return String(x); } };
const short = (x, n = 160) => { const s = J(x); return s && s.length > n ? s.slice(0, n) + "…" : s; };
const call = (a) => `App.${a.nombre}(<copia de ESTADO_INICIAL>${a.ejemplo.map((v) => ", " + J(v)).join("")})`;

/** Lo primero que no es un dato (función, NaN, Infinity, Map, Set, Date, elemento…), con su camino. */
export function nonData(v, path = "estado", seen = new Set()) {
  if (v === null || typeof v === "string" || typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? null : `${path} es ${v}`;
  if (v === undefined) return null; // JSON lo saca; no rompe la pantalla
  if (typeof v === "function") return `${path} es una función`;
  if (typeof v !== "object") return `${path} es ${typeof v}`;
  if (seen.has(v)) return `${path} apunta a sí mismo`;
  seen.add(v);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = nonData(v[i], `${path}[${i}]`, seen); if (r) return r; } return null; }
  const proto = Object.getPrototypeOf(v);
  if (proto !== null && Object.getPrototypeOf(proto) !== null) return `${path} es un ${v.constructor?.name || "objeto especial"} (no un objeto común)`;
  for (const k of Object.keys(v)) { const r = nonData(v[k], `${path}.${k}`, seen); if (r) return r; }
  return null;
}

/** Cambia algo adentro de cada valor de primer nivel (para ver si crear() comparte objetos con ESTADO_INICIAL). */
function poke(e) {
  for (const k of Object.keys(e || {})) {
    const v = e[k];
    if (Array.isArray(v)) v.push("__prueba__");
    else if (v && typeof v === "object") v.__prueba__ = 1;
    else e[k] = "__prueba__";
  }
}

/**
 * Pruebas para runAcceptance (harness/js_tools.mjs): [{name, fn, after?, run(App) → true | "mensaje"}].
 * @param {{estado, acciones}} c  contrato validado
 */
export function logicTests(c) {
  const ini = J(c.estado);
  const fresh = () => structuredClone(c.estado);
  const keys = Object.keys(c.estado);
  const tests = [
    { name: "crear devuelve ESTADO_INICIAL", fn: "crear", run: (A) => {
      const e = A.crear();
      return J(e) === ini || `App.crear() tiene que devolver una copia de ESTADO_INICIAL (${short(c.estado)}); dio ${short(e)}.`;
    } },
  ];
  // va al final: si crear() devuelve ESTADO_INICIAL mismo, esta prueba lo ensucia
  const copyTest = { name: "crear devuelve una copia nueva", fn: "crear", run: (A) => {
    const e = A.crear(); poke(e);
    const f = A.crear();
    return J(f) === ini || `App.crear() devuelve el mismo objeto (o comparte sus listas) cada vez: después de cambiar lo que devolvió, el siguiente App.crear() ya no es igual a ESTADO_INICIAL. Devolvé una copia profunda: JSON.parse(JSON.stringify(ESTADO_INICIAL)) o structuredClone(ESTADO_INICIAL).`;
  } };
  for (const a of c.acciones) {
    const n = a.nombre, how = call(a);
    // cada prueba de una acción arranca de una copia propia de ESTADO_INICIAL (no de App.crear()): si
    // crear() comparte el objeto, eso lo dicen las pruebas de crear y no ensucia las de las acciones
    const run = (A, e = fresh()) => A[n](e, ...structuredClone(a.ejemplo));
    tests.push(
      { name: `${n} devuelve un estado`, fn: n, run: (A) => {
        const r = run(A);
        return (r && typeof r === "object" && !Array.isArray(r)) || `${how} tiene que DEVOLVER el estado nuevo (un objeto con ${keys.join(", ")}); devolvió ${r === undefined ? "nada (undefined): falta return" : short(r)}.`;
      } },
      { name: `${n} no modifica el estado que recibe`, fn: n, run: (A) => {
        const e = fresh(); run(A, e);
        return J(e) === ini || `${n} modificó el estado que recibió (después de ${how}, ese estado ya no es el inicial): tiene que devolver un estado NUEVO. Copiá antes de cambiar, p.ej. const nuevo = JSON.parse(JSON.stringify(estado)), y devolvé nuevo.`;
      } },
      { name: `${n} conserva las claves del estado`, fn: n, run: (A) => {
        const r = run(A);
        const miss = keys.filter((k) => !(r && k in r));
        return !miss.length || `${how} devolvió un estado sin ${miss.join(", ")}: devolvé el estado COMPLETO (todas sus claves: ${keys.join(", ")}), no solo la parte que cambió.`;
      } },
      // "reiniciar" no cambia el estado inicial: alcanza con que cambie el estado que deja otra acción
      { name: `${n} hace algo`, fn: n, run: (A) => {
        if (J(run(A)) !== ini) return true;
        for (const o of c.acciones) {
          if (o === a) continue;
          let e; try { e = A[o.nombre](fresh(), ...structuredClone(o.ejemplo)); } catch { continue; }
          if (!e || J(e) === ini) continue;
          try { if (J(run(A, structuredClone(e))) !== J(e)) return true; } catch { /* lo ve otra prueba */ }
        }
        return `${how} devolvió el mismo estado (y tampoco cambia nada después de las otras acciones): con el "ejemplo" del contrato (${J(a.ejemplo)}) la acción "${a.hace || n}" tiene que cambiar algo.`;
      } },
      { name: `${n}: el estado son solo datos`, fn: n, run: (A) => {
        const bad = nonData(run(A));
        return !bad || `después de ${how}, ${bad}: en el estado van solo datos (textos, números, true/false, listas y objetos comunes), nunca elementos de la página ni funciones.`;
      } },
    );
  }
  return [...tests, copyTest];
}

/** Observación (no bloquea): ¿cambian las claves que Gemma dijo en "cambia"? */
export function observeChanges(c) {
  return (A) => c.acciones.filter((a) => a.cambia.length).map((a) => {
    try {
      const e = structuredClone(c.estado), r = A[a.nombre](e, ...structuredClone(a.ejemplo));
      const changed = Object.keys(c.estado).filter((k) => J(r?.[k]) !== J(e?.[k]));
      return { accion: a.nombre, dijo: a.cambia, cambio: changed, ok: a.cambia.every((k) => changed.includes(k)) };
    } catch (err) { return { accion: a.nombre, dijo: a.cambia, error: err.message, ok: false }; }
  });
}
