// acceptance.mjs — pruebas de aceptación de js/reglas.js del Standard "juego de grilla" (DRAFT).
// Las declara el Standard; el motor (harness/files_engine.mjs) las corre en Node sin navegador,
// con niveles chicos propios. Cada prueba dice qué función revisar (fn) y, si falla, qué
// esperaba y qué dio: ese texto es lo que lee Gemma.
// Origen: Boxworld b3–b9 (05–06/10). b9 sumó la pista "el jugador quedó encima de una caja".

const P = (o) => (o && typeof o === "object" ? `{fila:${o.fila},col:${o.col}}` : String(o));
const same = (a, b) => !!a && !!b && a.fila === b.fila && a.col === b.col;
const sortP = (l) => [...(l || [])].map((x) => ({ fila: x?.fila, col: x?.col })).sort((a, b) => a.fila - b.fila || a.col - b.col);
const sameList = (a, b) => JSON.stringify(sortP(a)) === JSON.stringify(sortP(b));
const L = (rows) => JSON.stringify(rows);
// v0.8.2: diagnóstico determinista que se agrega al mensaje (lo que Gemma no ve sola)
const why = (e) => (e?.jugador && (e.cajas || []).some((c) => same(c, e.jugador)))
  ? " El jugador quedó ENCIMA de una caja: mover no vio la caja. En estado.mapa no hay cajas (solo '#', ' ' y '.'); las cajas están en estado.cajas: antes de mover, buscá si hay una caja en el destino con estado.cajas."
  : "";

export const RULE_TESTS = [
  { name: "crearEstado lee jugador, cajas y objetivos", fn: "crearEstado", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.crearEstado(lv);
    const ok = same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }]) && sameList(e?.objetivos, [{ fila: 1, col: 3 }]) && e?.movimientos === 0;
    return ok || `crearEstado(${L(lv)}) tendría que dar jugador {fila:1,col:1}, cajas [{fila:1,col:2}], objetivos [{fila:1,col:3}], movimientos 0; dio jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], objetivos [${(e?.objetivos || []).map(P)}], movimientos ${e?.movimientos}.`;
  } },
  { name: "recién creado no está ganado", fn: "ganado", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    return R.ganado(R.crearEstado(lv)) === false || `ganado(crearEstado(${L(lv)})) tendría que ser false (la caja no está en el objetivo).`;
  } },
  { name: "la pared bloquea", fn: "mover", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "izquierda");
    return (same(e?.jugador, { fila: 1, col: 1 }) && e?.movimientos === 0) || `con ${L(lv)}, mover(estado, "izquierda") choca con la pared: el jugador sigue en {fila:1,col:1} y movimientos 0; quedó ${P(e?.jugador)} y movimientos ${e?.movimientos}.`;
  } },
  { name: "empujar una caja", fn: "mover", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 2 }) && sameList(e?.cajas, [{ fila: 1, col: 3 }]) && e?.movimientos === 1) || `con ${L(lv)}, mover(estado, "derecha") empuja la caja: jugador {fila:1,col:2}, caja {fila:1,col:3}, movimientos 1; quedó jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], movimientos ${e?.movimientos}.${why(e)}`;
  } },
  { name: "caja en el objetivo = ganado", fn: "ganado", after: "mover", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    return R.ganado(R.mover(R.crearEstado(lv), "derecha")) === true || `con ${L(lv)}, después de mover "derecha" la única caja está en el único objetivo: ganado tiene que ser true.`;
  } },
  { name: "mover no modifica el estado que recibe", fn: "mover", input: ["#####", "#@$.#", "#####"], run(R, lv) {
    const e = R.crearEstado(lv); R.mover(e, "derecha");
    return (same(e.jugador, { fila: 1, col: 1 }) && sameList(e.cajas, [{ fila: 1, col: 2 }])) || `mover tiene que devolver un estado NUEVO: después de mover(e, "derecha"), e.jugador sigue en {fila:1,col:1} y su caja en {fila:1,col:2}; quedó ${P(e.jugador)}.`;
  } },
  { name: "de a un casillero", fn: "mover", input: ["######", "#@   #", "#    #", "######"], run(R, lv) {
    const d = R.mover(R.crearEstado(lv), "derecha"), b = R.mover(R.crearEstado(lv), "abajo");
    return (same(d?.jugador, { fila: 1, col: 2 }) && same(b?.jugador, { fila: 2, col: 1 })) || `con ${L(lv)}, "derecha" deja al jugador en {fila:1,col:2} y "abajo" en {fila:2,col:1} (un casillero por vez); quedó ${P(d?.jugador)} y ${P(b?.jugador)}.`;
  } },
  { name: "caja contra pared no se mueve", fn: "mover", input: ["####", "#@$#", "####"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }]) && e?.movimientos === 0) || `con ${L(lv)}, la caja tiene una pared detrás: "derecha" no mueve nada (jugador {fila:1,col:1}, caja {fila:1,col:2}, movimientos 0); quedó jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], movimientos ${e?.movimientos}.${why(e)}`;
  } },
  { name: "caja contra caja no se mueve", fn: "mover", input: ["######", "#@$$.#", "######"], run(R, lv) {
    const e = R.mover(R.crearEstado(lv), "derecha");
    return (same(e?.jugador, { fila: 1, col: 1 }) && e?.movimientos === 0) || `con ${L(lv)}, la caja tiene otra caja detrás: "derecha" no mueve nada (jugador {fila:1,col:1}, movimientos 0); quedó ${P(e?.jugador)}, movimientos ${e?.movimientos}.${why(e)}`;
  } },
  { name: "lee '*' y '+'", fn: "crearEstado", input: ["######", "#+$ *#", "######"], run(R, lv) {
    const e = R.crearEstado(lv);
    return (same(e?.jugador, { fila: 1, col: 1 }) && sameList(e?.cajas, [{ fila: 1, col: 2 }, { fila: 1, col: 4 }]) && sameList(e?.objetivos, [{ fila: 1, col: 1 }, { fila: 1, col: 4 }]) && (e?.mapa || [])[1] === "#.  .#")
      || `crearEstado(${L(lv)}): '+' es jugador sobre objetivo y '*' caja sobre objetivo → jugador {fila:1,col:1}, cajas [{fila:1,col:2},{fila:1,col:4}], objetivos [{fila:1,col:1},{fila:1,col:4}], mapa fila 1 "#.  .#"; dio jugador ${P(e?.jugador)}, cajas [${(e?.cajas || []).map(P)}], objetivos [${(e?.objetivos || []).map(P)}], mapa fila 1 ${JSON.stringify((e?.mapa || [])[1])}.`;
  } },
];

/** Una prueba por nivel: ningún nivel empieza ganado y todos se pueden crear. */
export const LEVEL_TESTS = [
  (R, nv, i) => {
    try {
      const e = R.crearEstado(nv);
      return R.ganado(e)
        ? { name: `nivel ${i + 1} no empieza ganado`, fn: "ganado", ok: false, detail: `ganado(crearEstado(NIVELES[${i}])) da true recién creado.` }
        : { name: `nivel ${i + 1} no empieza ganado`, ok: true };
    } catch (e) { return { name: `nivel ${i + 1} se puede crear`, fn: "crearEstado", ok: false, detail: `crearEstado(NIVELES[${i}]) tiró: ${e.message}` }; }
  },
];
