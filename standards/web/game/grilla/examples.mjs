// examples.mjs — "pruebas primero" (DRAFT, 11/10): EJEMPLOS que escribe Gemma, como DATOS.
//
// Diseño: docs/DISENO_pruebas_primero.md. Gemma no escribe código de prueba: escribe ejemplos en
// JSON ("con este nivel, después de estas flechas, el estado tiene que ser esto") y el harness los
// convierte en pruebas ejecutables, igual que convierte coordenadas en niveles.
// Por ahora es un EXPERIMENTO: lo usa build/examples_bench.mjs para medir si los ejemplos de Gemma
// sirven como compuerta (¿son correctos? ¿atrapan los errores que atrapa el harness?). No entra en
// los builds hasta tener esa evidencia.

import { levelFromSpec } from "./levels.mjs";

// v0.2 (11/10, 1ª corrida): con el nivel DIBUJADO como strings, 103 de 115 ejemplos se descartaron
// (filas de largos distintos, '$' ≠ '.') y 6 de 12 tenían la posición esperada corrida en uno. Es lo
// mismo que pasó con los niveles en b8: Gemma no cuenta caracteres. → el ejemplo va en COORDENADAS
// (como niveles.json) y el harness arma el nivel con levelFromSpec.
const DIRS = ["arriba", "abajo", "izquierda", "derecha"];
const P = (o) => (o && typeof o === "object" ? `{fila:${o.fila},col:${o.col}}` : String(o));
const pt = (x) => Array.isArray(x) && x.length === 2 && x.every(Number.isInteger) ? { fila: x[0], col: x[1] }
  : x && Number.isInteger(x.fila) && Number.isInteger(x.col) ? { fila: x.fila, col: x.col } : null;
const sortP = (l) => [...(l || [])].map((x) => ({ fila: x?.fila, col: x?.col })).sort((a, b) => a.fila - b.fila || a.col - b.col);
const sameP = (a, b) => !!a && !!b && a.fila === b.fila && a.col === b.col;
const sameList = (a, b) => JSON.stringify(sortP(a)) === JSON.stringify(sortP(b));

export const EXAMPLE_FMT = `{ "ejemplos": [
  { "nombre": "empujar una caja a la derecha",
    "tamaño": [3, 5], "jugador": [1, 1], "cajas": [[1, 2]], "objetivos": [[1, 3]], "paredes": [],
    "flechas": ["derecha"],
    "espera": { "jugador": [1, 2], "cajas": [[1, 3]], "movimientos": 1, "ganado": true } }
] }`;

/** Pedido del paso "pruebas" (no ve código: solo brief + contrato). */
export const examplesPrompt = (c) => `PASO DE PRUEBAS (antes de escribir el código): escribí entre 6 y 10 EJEMPLOS de cómo tiene que funcionar js/reglas.js, como JSON. No escribas código.
Cada ejemplo es un nivel CHICO en COORDENADAS (no lo dibujes: el harness lo arma): "tamaño" [filas, columnas] entre 3 y 7; el borde ya es pared, así que todo va en filas 1 a filas-2 y columnas 1 a columnas-2; "jugador" [fila, col], "cajas" y "objetivos" (la misma cantidad; ninguna caja ni el jugador empiezan sobre un objetivo) y "paredes" interiores (puede ser []). Después, las "flechas" que se aprietan en orden (puede ser ninguna: []) y lo que "espera" al final: cualquiera de jugador [fila, col], cajas [[fila, col], ...], movimientos (número) y ganado (true o false). Las filas y columnas empiezan en 0.
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
    const sz = ex?.["tamaño"] ?? ex?.tamano;
    if (!Array.isArray(sz) || sz.length !== 2 || !sz.every((v) => Number.isInteger(v) && v >= 3 && v <= 8)) return bad('"tamaño" tiene que ser [filas, columnas] entre 3 y 8.');
    const lv = levelFromSpec({ jugador: ex.jugador, cajas: ex.cajas, objetivos: ex.objetivos, paredes: ex.paredes || [] }, { rows: sz[0], cols: sz[1] }, "el nivel");
    if (!lv.rows) return bad(lv.problems.join(" "));
    const nv = lv.rows;
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
