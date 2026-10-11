// examples.mjs — "pruebas primero" (DRAFT, 11/10): EJEMPLOS que escribe Gemma, como DATOS.
//
// Diseño: docs/DISENO_pruebas_primero.md. Gemma no escribe código de prueba: escribe ejemplos en
// JSON ("con este nivel, después de estas flechas, el estado tiene que ser esto") y el harness los
// convierte en pruebas ejecutables, igual que convierte coordenadas en niveles.
// Por ahora es un EXPERIMENTO: lo usa build/examples_bench.mjs para medir si los ejemplos de Gemma
// sirven como compuerta (¿son correctos? ¿atrapan los errores que atrapa el harness?). No entra en
// los builds hasta tener esa evidencia.

const DIRS = ["arriba", "abajo", "izquierda", "derecha"];
const P = (o) => (o && typeof o === "object" ? `{fila:${o.fila},col:${o.col}}` : String(o));
const pt = (x) => Array.isArray(x) && x.length === 2 && x.every(Number.isInteger) ? { fila: x[0], col: x[1] }
  : x && Number.isInteger(x.fila) && Number.isInteger(x.col) ? { fila: x.fila, col: x.col } : null;
const sortP = (l) => [...(l || [])].map((x) => ({ fila: x?.fila, col: x?.col })).sort((a, b) => a.fila - b.fila || a.col - b.col);
const sameP = (a, b) => !!a && !!b && a.fila === b.fila && a.col === b.col;
const sameList = (a, b) => JSON.stringify(sortP(a)) === JSON.stringify(sortP(b));

export const EXAMPLE_FMT = `{ "ejemplos": [
  { "nombre": "empujar una caja a la derecha",
    "nivel": ["#####", "#@$.#", "#####"],
    "flechas": ["derecha"],
    "espera": { "jugador": [1, 2], "cajas": [[1, 3]], "movimientos": 1, "ganado": true } }
] }`;

/** Pedido del paso "pruebas" (no ve código: solo brief + contrato). */
export const examplesPrompt = (c) => `PASO DE PRUEBAS (antes de escribir el código): escribí entre 6 y 10 EJEMPLOS de cómo tiene que funcionar js/reglas.js, como JSON. No escribas código.
Cada ejemplo: un "nivel" CHICO (3 a 6 filas, todas del mismo largo, borde de '#', exactamente un '@', tantas '$' como '.'), las "flechas" que se aprietan en orden (puede ser ninguna: []) y lo que "espera" después: cualquiera de jugador [fila, col], cajas [[fila, col], ...], movimientos (número) y ganado (true o false). Las filas y columnas empiezan en 0.
Cubrí: estado recién creado, moverse a un piso libre, chocar contra una pared, empujar una caja, caja contra pared o contra otra caja (no se mueve nada y movimientos no cambia), y ganar.
Formato:
### FILE: ejemplos.json
\`\`\`json
${EXAMPLE_FMT}
\`\`\``;

/** Valida los ejemplos (forma, nivel chico y bien armado). Los que no sirven se descartan con el porqué. */
export function parseExamples(json) {
  const list = Array.isArray(json?.ejemplos) ? json.ejemplos : Array.isArray(json) ? json : null;
  if (!list) return { error: 'el JSON tiene que ser { "ejemplos": [ ... ] }.' };
  const items = [], dropped = [];
  list.forEach((ex, i) => {
    const n = `ejemplo ${i + 1}${ex?.nombre ? ` (${String(ex.nombre).slice(0, 50)})` : ""}`;
    const bad = (why) => dropped.push(`${n}: ${why}`);
    const nv = ex?.nivel;
    if (!Array.isArray(nv) || nv.length < 3 || nv.length > 8 || !nv.every((f) => typeof f === "string")) return bad("el nivel tiene que ser un array de 3 a 8 strings.");
    if (new Set(nv.map((f) => f.length)).size !== 1) return bad("las filas del nivel tienen largos distintos.");
    const all = nv.join("");
    if (/[^#.$@ ]/.test(all)) return bad(`caracteres que no son del formato: ${[...new Set(all.replace(/[#.$@ ]/g, ""))].join(" ")}.`);
    if ((all.match(/@/g) || []).length !== 1) return bad("tiene que haber exactamente un '@'.");
    if ((all.match(/\$/g) || []).length !== (all.match(/\./g) || []).length) return bad("tantas '$' como '.'.");
    const fl = ex.flechas ?? [];
    if (!Array.isArray(fl) || !fl.every((d) => DIRS.includes(d))) return bad(`"flechas" tiene que ser una lista de ${DIRS.join(", ")}.`);
    const e = ex.espera || {};
    const espera = {};
    if (e.jugador !== undefined) { const p = pt(e.jugador); if (!p) return bad('"espera.jugador" tiene que ser [fila, col].'); espera.jugador = p; }
    if (e.cajas !== undefined) { const l = Array.isArray(e.cajas) ? e.cajas.map(pt) : null; if (!l || l.some((x) => !x)) return bad('"espera.cajas" tiene que ser [[fila, col], ...].'); espera.cajas = l; }
    if (e.movimientos !== undefined) { if (!Number.isInteger(e.movimientos)) return bad('"espera.movimientos" tiene que ser un número entero.'); espera.movimientos = e.movimientos; }
    if (e.ganado !== undefined) { if (typeof e.ganado !== "boolean") return bad('"espera.ganado" tiene que ser true o false.'); espera.ganado = e.ganado; }
    if (!Object.keys(espera).length) return bad('"espera" no dice nada que se pueda comprobar.');
    items.push({ nombre: String(ex.nombre || n), nivel: nv, flechas: fl, espera });
  });
  return { items, dropped };
}

/** Corre un ejemplo contra Reglas. true o el mensaje (lo que esperaba y lo que dio). */
export function runExample(R, ex) {
  try {
    let e = R.crearEstado(ex.nivel);
    for (const d of ex.flechas) e = R.mover(e, d);
    const bad = [];
    const w = ex.espera;
    if (w.jugador && !sameP(e?.jugador, w.jugador)) bad.push(`jugador ${P(w.jugador)} y dio ${P(e?.jugador)}`);
    if (w.cajas && !sameList(e?.cajas, w.cajas)) bad.push(`cajas [${w.cajas.map(P)}] y dio [${(e?.cajas || []).map(P)}]`);
    if (w.movimientos !== undefined && e?.movimientos !== w.movimientos) bad.push(`movimientos ${w.movimientos} y dio ${e?.movimientos}`);
    if (w.ganado !== undefined) { const g = R.ganado(e); if (g !== w.ganado) bad.push(`ganado ${w.ganado} y dio ${g}`); }
    return !bad.length || `${ex.nombre}: con ${JSON.stringify(ex.nivel)} y flechas [${ex.flechas.join(", ")}] esperaba ${bad.join("; ")}.`;
  } catch (err) {
    return `${ex.nombre}: tiró un error: ${err.message}`;
  }
}

/** Esqueleto que no hace nada: un ejemplo que PASA acá no prueba nada (rojo). */
export const SKELETON = `const Reglas = { crearEstado(nivel) { return {}; }, mover(estado, direccion) { return estado; }, ganado(estado) { return undefined; } };`;
