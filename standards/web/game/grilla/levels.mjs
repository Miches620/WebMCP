// levels.mjs — niveles de un juego de grilla tipo Sokoban: de coordenadas a strings, y
// verificación de que se puedan resolver. Determinista (lo hace el harness, no Gemma).
//
// v0.8.1 (06/10, Boxworld build 8): Gemma no puede contar caracteres. En b5–b8 escribió
// los niveles como strings y TODOS tenían filas de largo distinto (9 a 13 para un mapa de
// 10) y cajas ≠ objetivos (3 cajas y 13 objetivos), aun con el problema exacto en el
// reintento. Ahora propone cada nivel como COORDENADAS (jugador, cajas, objetivos y paredes
// interiores; el borde lo pone el harness), el harness arma los strings y prueba con un
// solver que cada nivel se pueda ganar. Nunca hubo, en ningún build, niveles verificados.

const key = (f, c) => f * 1000 + c;
const isInt = (x) => Number.isInteger(x);

/** Normaliza un punto: [f, c] o {fila, col}. null si no sirve. */
function pt(p) {
  if (Array.isArray(p) && p.length === 2 && isInt(p[0]) && isInt(p[1])) return [p[0], p[1]];
  if (p && typeof p === "object" && isInt(p.fila) && isInt(p.col)) return [p.fila, p.col];
  return null;
}

/**
 * Valida un nivel en coordenadas y lo convierte a strings Sokoban.
 * Interior: filas 1..rows-2, columnas 1..cols-2 (el borde siempre es pared).
 * @returns {{rows?:string[], problems:string[]}}
 */
export function levelFromSpec(spec, { rows = 10, cols = 10 } = {}, n = "nivel") {
  const problems = [];
  if (!spec || typeof spec !== "object") return { problems: [`${n}: no es un objeto {jugador, cajas, objetivos, paredes}.`] };
  const inside = ([f, c]) => f >= 1 && f <= rows - 2 && c >= 1 && c <= cols - 2;
  const list = (name) => {
    const raw = spec[name] ?? [];
    if (!Array.isArray(raw)) { problems.push(`${n}: "${name}" tiene que ser una lista de [fila, col].`); return []; }
    const pts = raw.map(pt);
    if (pts.some((p) => !p)) problems.push(`${n}: "${name}" tiene elementos que no son [fila, col] con números enteros.`);
    const ok = pts.filter(Boolean);
    const out = ok.filter(inside);
    if (out.length < ok.length && name !== "paredes") problems.push(`${n}: "${name}" tiene posiciones fuera del interior (filas 1–${rows - 2}, columnas 1–${cols - 2}).`);
    return out;
  };
  const jug = pt(spec.jugador);
  if (!jug) problems.push(`${n}: "jugador" tiene que ser [fila, col].`);
  else if (!inside(jug)) problems.push(`${n}: el jugador ${JSON.stringify(jug)} está fuera del interior (filas 1–${rows - 2}, columnas 1–${cols - 2}).`);
  const cajas = list("cajas"), objetivos = list("objetivos"), paredes = list("paredes");
  const dup = (l) => new Set(l.map((p) => key(...p))).size !== l.length;
  if (dup(cajas)) problems.push(`${n}: hay dos cajas en el mismo casillero.`);
  if (dup(objetivos)) problems.push(`${n}: hay dos objetivos en el mismo casillero.`);
  if (!cajas.length) problems.push(`${n}: no tiene cajas.`);
  if (cajas.length !== objetivos.length) problems.push(`${n}: tiene ${cajas.length} cajas y ${objetivos.length} objetivos; tienen que ser la misma cantidad.`);
  const W = new Set(paredes.map((p) => key(...p)));
  const B = new Set(cajas.map((p) => key(...p)));
  const G = new Set(objetivos.map((p) => key(...p)));
  if (jug && W.has(key(...jug))) problems.push(`${n}: el jugador está sobre una pared.`);
  if (jug && B.has(key(...jug))) problems.push(`${n}: el jugador está sobre una caja.`);
  if (cajas.some((p) => W.has(key(...p)))) problems.push(`${n}: hay una caja sobre una pared.`);
  if (objetivos.some((p) => W.has(key(...p)))) problems.push(`${n}: hay un objetivo sobre una pared.`);
  if (cajas.length && cajas.every((p) => G.has(key(...p)))) problems.push(`${n}: todas las cajas empiezan sobre un objetivo (ya está ganado).`);
  if (problems.length || !jug) return { problems };
  const rowsOut = [];
  for (let f = 0; f < rows; f++) {
    let s = "";
    for (let c = 0; c < cols; c++) {
      const k = key(f, c);
      const border = f === 0 || c === 0 || f === rows - 1 || c === cols - 1;
      const isJ = jug[0] === f && jug[1] === c;
      if (border || W.has(k)) s += "#";
      else if (B.has(k)) s += G.has(k) ? "*" : "$";
      else if (isJ) s += G.has(k) ? "+" : "@";
      else s += G.has(k) ? "." : " ";
    }
    rowsOut.push(s);
  }
  return { rows: rowsOut, problems };
}

/**
 * v0.1.1 (06/10, Boxworld b10): casilleros VIVOS = desde donde una caja todavía puede llegar a
 * algún objetivo (se calcula "tirando" desde los objetivos: la caja vino de x si el jugador
 * pudo pararse detrás). b10: los 3 intentos trajeron un nivel con cajas pegadas a la pared
 * (columna 1) y objetivos en la columna 2; el harness solo decía "NO se puede ganar".
 * @returns {Set<number>} índices f*C+c
 */
export function liveSquares(rows) {
  const R = rows.length, C = Math.max(...rows.map((r) => r.length));
  const wall = (f, c) => f < 0 || f >= R || c < 0 || c >= C || (rows[f][c] ?? "#") === "#";
  const live = new Set(), st = [];
  rows.forEach((s, f) => [...s].forEach((ch, c) => { if (".*+".includes(ch)) { live.add(f * C + c); st.push([f, c]); } }));
  const D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (st.length) {
    const [f, c] = st.pop();
    for (const [df, dc] of D) {
      const bf = f - df, bc = c - dc;          // la caja estaba acá…
      const pf = bf - df, pc = bc - dc;        // …y el jugador detrás
      if (wall(bf, bc) || wall(pf, pc) || live.has(bf * C + bc)) continue;
      live.add(bf * C + bc); st.push([bf, bc]);
    }
  }
  return live;
}
/**
 * v0.1.4 (Boxworld b12): ¿algún movimiento desde el inicio ya gana? b12 trajo un nivel 1 con
 * "@$." (una flecha y listo) y el chequeo not_won_immediately del propio Standard mandó a
 * corregir controles.js 3 veces (6 min) por un problema que era del NIVEL.
 */
export function winsInOneMove(rows) {
  const at = (f, c) => (rows[f] || "")[c] ?? "#";
  let pf = -1, pc = -1; const boxes = new Set(), goals = new Set();
  rows.forEach((s, f) => [...s].forEach((ch, c) => { if ("@+".includes(ch)) { pf = f; pc = c; } if ("$*".includes(ch)) boxes.add(f * 1000 + c); if (".*+".includes(ch)) goals.add(f * 1000 + c); }));
  for (const [df, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const f1 = pf + df, c1 = pc + dc, k1 = f1 * 1000 + c1;
    if (at(f1, c1) === "#" || !boxes.has(k1)) continue;
    const f2 = f1 + df, c2 = c1 + dc, k2 = f2 * 1000 + c2;
    if (at(f2, c2) === "#" || boxes.has(k2)) continue;
    const nb = new Set(boxes); nb.delete(k1); nb.add(k2);
    if ([...goals].every((g) => nb.has(g))) return true;
  }
  return false;
}
/** Cajas que empiezan en un casillero desde donde no pueden llegar a ningún objetivo: [[f, c]]. */
export function stuckBoxes(rows) {
  const C = Math.max(...rows.map((r) => r.length));
  const live = liveSquares(rows), out = [];
  rows.forEach((s, f) => [...s].forEach((ch, c) => { if (ch === "$" && !live.has(f * C + c)) out.push([f, c]); }));
  return out;
}

/**
 * ¿Se puede ganar? Búsqueda por EMPUJES: un estado = cajas + zona alcanzable del jugador
 * (representada por su casillero más chico). Poda: casilleros muertos (esquina que no es objetivo).
 * @returns {{solvable:true, pushes:number}|{solvable:false}|{solvable:null, explored:number}}
 *   pushes: los de la solución encontrada (no siempre la mínima). null = no se decidió dentro del tope
 *   (estados o 4 s): no cuenta como falla.
 */
export function solve(rows, { cap = 200000, ms = 4000 } = {}) {
  const R = rows.length, C = Math.max(...rows.map((r) => r.length));
  const wall = (i) => { const f = Math.floor(i / C), c = i % C; return f < 0 || f >= R || c < 0 || c >= C || (rows[f][c] ?? "#") === "#"; };
  const goals = new Set(), boxes0 = [];
  let p0 = -1;
  rows.forEach((s, f) => [...s].forEach((ch, c) => {
    const i = f * C + c;
    if (".*+".includes(ch)) goals.add(i);
    if ("$*".includes(ch)) boxes0.push(i);
    if ("@+".includes(ch)) p0 = i;
  }));
  const D = [-C, C, -1, 1];
  const ok = (i, d) => { const c = i % C, c2 = (i + d) % C; return Math.abs(c - c2) <= 1; };
  const dead = new Set();
  const live = liveSquares(rows);
  for (let i = 0; i < R * C; i++) if (!wall(i) && !live.has(i)) dead.add(i);
  const won = (bx) => bx.every((b) => goals.has(b));
  if (won(boxes0)) return { solvable: true, pushes: 0 };
  const reach = (p, bs) => {
    const seen = new Set([p]); const st = [p]; let min = p;
    while (st.length) {
      const x = st.pop();
      for (const d of D) {
        const y = x + d;
        if (!ok(x, d) || seen.has(y) || wall(y) || bs.has(y)) continue;
        seen.add(y); st.push(y); if (y < min) min = y;
      }
    }
    return { seen, min };
  };
  // A* por empujes: f = empujes hechos + suma de distancias (Manhattan) de cada caja a su objetivo más cercano
  const G = [...goals];
  const h = (bx) => bx.reduce((acc, b) => acc + Math.min(...G.map((g) => Math.abs(Math.floor(g / C) - Math.floor(b / C)) + Math.abs((g % C) - (b % C)))), 0);
  const heap = [];
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const b0 = [...boxes0].sort((a, z) => a - z);
  const r0 = reach(p0, new Set(b0));
  const visited = new Set([r0.min + "|" + b0.join(",")]);
  push({ b: b0, p: p0, n: 0, f: h(b0) });
  let explored = 0;
  const t0 = Date.now();
  while (heap.length) {
    const s = pop();
    if (++explored > cap || (explored % 500 === 0 && Date.now() - t0 > ms)) return { solvable: null, explored };
    const bs = new Set(s.b);
    const { seen } = reach(s.p, bs);
    for (const box of s.b) for (const d of D) {
      const from = box - d, to = box + d;
      if (!ok(box, d) || !ok(from, d) || !seen.has(from) || wall(to) || bs.has(to) || dead.has(to)) continue;
      const nb = s.b.map((x) => (x === box ? to : x)).sort((a, z) => a - z);
      if (won(nb)) return { solvable: true, pushes: s.n + 1 };
      const r = reach(box, new Set(nb));
      const k = r.min + "|" + nb.join(",");
      if (visited.has(k)) continue;
      visited.add(k);
      push({ b: nb, p: box, n: s.n + 1, f: s.n + 1 + h(nb) });
    }
  }
  return { solvable: false };
}

/**
 * Niveles propuestos por Gemma (JSON) → strings verificados.
 * @returns {{levels:string[][], problems:string[], report:object[]}}
 */
export function levelsFromSpecs(data, { rows = 10, cols = 10, minLevels = 1, cap } = {}) {
  const arr = Array.isArray(data) ? data : data?.niveles;
  if (!Array.isArray(arr)) return { levels: [], problems: ['el JSON tiene que ser { "niveles": [ {...}, {...} ] }.'], report: [] };
  const levels = [], problems = [], report = [];
  arr.forEach((spec, i) => {
    const n = `nivel ${i + 1}`;
    const r = levelFromSpec(spec, { rows, cols }, n);
    if (r.problems.length) { problems.push(...r.problems); report.push({ n: i + 1, ok: false }); return; }
    const stuck = stuckBoxes(r.rows);
    if (stuck.length) {
      problems.push(`${n}: ${stuck.length === 1 ? "la caja en" : "las cajas en"} ${stuck.map((p) => JSON.stringify(p)).join(", ")} no ${stuck.length === 1 ? "puede" : "pueden"} llegar a ningún objetivo: una caja contra la pared solo se mueve a lo largo de esa pared (y en una esquina no se mueve). Alejala de la pared o poné su objetivo pegado a esa misma pared.`);
      report.push({ n: i + 1, ok: false, solvable: false, stuck }); return;
    }
    if (winsInOneMove(r.rows)) {
      problems.push(`${n}: se gana con UN solo movimiento (el jugador ya está pegado a la caja y la caja pegada a su objetivo). Poné al jugador más lejos o la caja a 2 o más casilleros de su objetivo.`);
      report.push({ n: i + 1, ok: false, oneMove: true }); return;
    }
    const sv = solve(r.rows, { cap });
    if (sv.solvable === false) { problems.push(`${n}: NO se puede ganar (el harness probó todos los movimientos posibles): mové cajas, objetivos o paredes.`); report.push({ n: i + 1, ok: false, solvable: false }); return; }
    levels.push(r.rows);
    report.push({ n: i + 1, ok: true, solvable: sv.solvable, pushes: sv.pushes ?? null });
  });
  if (levels.length < minLevels) problems.push(`hay ${levels.length} niveles válidos y se piden al menos ${minLevels}.`);
  return { levels, problems, report };
}

/** El archivo js/niveles.js que escribe el harness. */
export function nivelesJs(levels, report = []) {
  const lines = levels.map((rows, i) => {
    const rp = report.filter((r) => r.ok)[i];
    const note = rp?.solvable ? `resoluble (el solver lo ganó con ${rp.pushes} empujes)` : rp?.solvable === null ? "no se pudo verificar dentro del tope" : "";
    return `  // Nivel ${i + 1}${note ? ` — ${note}` : ""}\n  [\n${rows.map((s) => `    ${JSON.stringify(s)}`).join(",\n")}\n  ]`;
  });
  return `// js/niveles.js — lo escribe el harness a partir de los niveles que propuso el Specialist
// (coordenadas → strings Sokoban: # pared, espacio piso, . objetivo, $ caja, * caja sobre
// objetivo, @ jugador, + jugador sobre objetivo). Cada nivel fue verificado con un solver.
const NIVELES = [
${lines.join(",\n")}
];
`;
}
