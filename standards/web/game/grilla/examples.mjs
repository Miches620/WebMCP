// examples.mjs — "pruebas primero" (DRAFT, 11/10): EJEMPLOS que escribe Gemma, como DATOS.
//
// Diseño: docs/DISENO_pruebas_primero.md. Gemma no escribe código de prueba: escribe ejemplos en
// JSON ("con este nivel, después de estas flechas, el estado tiene que ser esto") y el harness los
// convierte en pruebas ejecutables, igual que convierte coordenadas en niveles.
// Por ahora es un EXPERIMENTO: lo usa build/examples_bench.mjs para medir si los ejemplos de Gemma
// sirven como compuerta (¿son correctos? ¿atrapan los errores que atrapa el harness?). No entra en
// los builds hasta tener esa evidencia.


// v0.2 (11/10, 1ª corrida): con el nivel DIBUJADO como strings, 103 de 115 ejemplos se descartaron
// (filas de largos distintos, '$' ≠ '.') y 6 de 12 tenían la posición esperada corrida en uno. Es lo
// mismo que pasó con los niveles en b8: Gemma no cuenta caracteres. → el ejemplo va en COORDENADAS
// (como niveles.json) y el harness arma el nivel.
// v0.3 (12/10, 2ª corrida): 82 de 100 se descartaron igual. Dos causas, y ninguna es un error del
// ejemplo: (1) se usaban las reglas de un NIVEL JUGABLE (tantas cajas como objetivos, al menos una caja)
// y un ejemplo de "moverse a un piso libre" no necesita cajas; (2) el "tamaño" no coincidía con las
// coordenadas (objetivo en la columna 4 de un mapa de 5). → el harness arma el nivel del tamaño que
// hace falta para que entren todas las posiciones (las del nivel y las de "espera") y no exige
// cantidades: solo que nada se pise.
const DIRS = ["arriba", "abajo", "izquierda", "derecha"];
const P = (o) => (o && typeof o === "object" ? `{fila:${o.fila},col:${o.col}}` : String(o));
const pt = (x) => Array.isArray(x) && x.length === 2 && x.every(Number.isInteger) ? { fila: x[0], col: x[1] }
  : x && Number.isInteger(x.fila) && Number.isInteger(x.col) ? { fila: x.fila, col: x.col } : null;
const sortP = (l) => [...(l || [])].map((x) => ({ fila: x?.fila, col: x?.col })).sort((a, b) => a.fila - b.fila || a.col - b.col);
const sameP = (a, b) => !!a && !!b && a.fila === b.fila && a.col === b.col;
const sameList = (a, b) => JSON.stringify(sortP(a)) === JSON.stringify(sortP(b));

export const EXAMPLE_FMT = `{ "ejemplos": [
  { "nombre": "empujar una caja a la derecha",
    "jugador": [1, 1], "cajas": [[1, 2]], "objetivos": [[1, 3]], "paredes": [],
    "flechas": ["derecha"],
    "espera": { "jugador": [1, 2], "cajas": [[1, 3]], "movimientos": 1, "ganado": true } }
] }`;

/** Pedido del paso "pruebas" (no ve código: solo brief + contrato). */
export const examplesPrompt = (c) => `PASO DE PRUEBAS (antes de escribir el código): escribí entre 6 y 10 EJEMPLOS de cómo tiene que funcionar js/reglas.js, como JSON. No escribas código.
Cada ejemplo es un nivel CHICO en COORDENADAS (no lo dibujes: el harness lo arma con un borde de pared alrededor, justo después de la posición más lejana): "jugador" [fila, col], "cajas", "objetivos" y "paredes" (listas de [fila, col], pueden estar vacías). Las posiciones empiezan en 1 (la fila 0 y la columna 0 son el borde). Ninguna caja ni el jugador empiezan sobre un objetivo, y nada se pisa con otra cosa. Después, las "flechas" que se aprietan en orden (puede ser ninguna: []) y lo que "espera" al final: cualquiera de jugador [fila, col], cajas [[fila, col], ...], movimientos (número) y ganado (true o false). Para "chocar contra una pared", poné la pared en "paredes".
Cubrí: estado recién creado, moverse a un piso libre, chocar contra una pared, empujar una caja, caja contra pared o contra otra caja (no se mueve nada y movimientos no cambia), y ganar.
Formato:
### FILE: ejemplos.json
\`\`\`json
${EXAMPLE_FMT}
\`\`\``;

/** Arma el nivel de un ejemplo: tamaño justo (nivel + "espera"), borde de pared, nada pisado. null + bad(motivo) si no se puede. */
function buildLevel(ex, bad) {
  const one = (x, name) => { const p = pt(x); if (!p) { bad(`"${name}" tiene que ser [fila, col].`); } return p; };
  const many = (x, name) => { if (x === undefined) return []; if (!Array.isArray(x)) { bad(`"${name}" tiene que ser una lista de [fila, col].`); return null; } const l = x.map(pt); if (l.some((p) => !p)) { bad(`"${name}" tiene elementos que no son [fila, col].`); return null; } return l; };
  const jug = one(ex?.jugador, "jugador"); if (!jug) return null;
  const cajas = many(ex.cajas, "cajas"), obj = many(ex.objetivos, "objetivos"), par = many(ex.paredes, "paredes");
  if (!cajas || !obj || !par) return null;
  const w = ex.espera || {};
  const extra = [pt(w.jugador), ...(Array.isArray(w.cajas) ? w.cajas.map(pt) : [])].filter(Boolean);
  const all = [jug, ...cajas, ...obj, ...par, ...extra];
  if (all.some((p) => p.fila < 1 || p.col < 1)) { bad("hay posiciones en la fila 0 o la columna 0 (son el borde: las posiciones empiezan en 1)."); return null; }
  const rows = Math.max(...all.map((p) => p.fila)) + 2, cols = Math.max(...all.map((p) => p.col)) + 2;
  if (rows > 10 || cols > 10) { bad("el nivel es muy grande (más de 8 filas o columnas): que sea chico."); return null; }
  const key = (p) => `${p.fila},${p.col}`;
  const seen = new Map();
  for (const [name, l] of [["jugador", [jug]], ["caja", cajas], ["objetivo", obj], ["pared", par]]) for (const p of l) {
    const k = key(p), prev = seen.get(k);
    if (prev) { bad(`${prev} y ${name} en el mismo casillero [${p.fila}, ${p.col}] (ninguna caja ni el jugador empiezan sobre un objetivo; nada se pisa).`); return null; }
    seen.set(k, name);
  }
  const out = [];
  for (let f = 0; f < rows; f++) {
    let r = "";
    for (let c = 0; c < cols; c++) {
      const t = f === 0 || c === 0 || f === rows - 1 || c === cols - 1 ? "pared" : seen.get(`${f},${c}`);
      r += t === "pared" ? "#" : t === "caja" ? "$" : t === "jugador" ? "@" : t === "objetivo" ? "." : " ";
    }
    out.push(r);
  }
  return out;
}

/** Valida los ejemplos (forma, nivel chico y bien armado). Los que no sirven se descartan con el porqué. */
export function parseExamples(json) {
  const list = Array.isArray(json?.ejemplos) ? json.ejemplos : Array.isArray(json) ? json : null;
  if (!list) return { error: 'el JSON tiene que ser { "ejemplos": [ ... ] }.' };
  const items = [], dropped = [];
  list.forEach((ex, i) => {
    const n = `ejemplo ${i + 1}${ex?.nombre ? ` (${String(ex.nombre).slice(0, 50)})` : ""}`;
    const bad = (why) => dropped.push(`${n}: ${why}`);
    const nv = buildLevel(ex, bad);
    if (!nv) return;
    const fl = ex.flechas ?? [];
    if (!Array.isArray(fl) || !fl.every((d) => DIRS.includes(d))) return bad(`"flechas" tiene que ser una lista de ${DIRS.join(", ")}.`);
    const e = ex.espera || {};
    const espera = {};
    if (e.jugador !== undefined) { const p = pt(e.jugador); if (!p) return bad('"espera.jugador" tiene que ser [fila, col].'); espera.jugador = p; }
    if (e.cajas !== undefined) { const l = Array.isArray(e.cajas) ? e.cajas.map(pt) : null; if (!l || l.some((x) => !x)) return bad('"espera.cajas" tiene que ser [[fila, col], ...].'); espera.cajas = l; }
    if (e.movimientos !== undefined) { if (!Number.isInteger(e.movimientos)) return bad('"espera.movimientos" tiene que ser un número entero.'); espera.movimientos = e.movimientos; }
    // sin objetivos, "ganado" no dice nada (todos los objetivos = ninguno): se ignora esa parte, no el ejemplo
    if (e.ganado !== undefined && (ex.objetivos || []).length) { if (typeof e.ganado !== "boolean") return bad('"espera.ganado" tiene que ser true o false.'); espera.ganado = e.ganado; }
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
