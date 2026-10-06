const Reglas = (function () {
  function crearEstado(nv) {
    const mapa = [], cajas = [], objetivos = []; let jugador = null;
    nv.forEach((f, r) => { let m = ""; [...f].forEach((ch, c) => {
      if ("$*".includes(ch)) cajas.push({ fila: r, col: c });
      if (".*+".includes(ch)) objetivos.push({ fila: r, col: c });
      if ("@+".includes(ch)) jugador = { fila: r, col: c };
      m += ch === "#" ? "#" : (".*+".includes(ch) ? "." : " ");
    }); mapa.push(m); });
    return { mapa, jugador, cajas, objetivos, movimientos: 0 };
  }
  const D = { arriba: [-1, 0], abajo: [1, 0], izquierda: [0, -1], derecha: [0, 1] };
  function mover(e, d) {
    const [df, dc] = D[d]; const f = e.jugador.fila + df, c = e.jugador.col + dc;
    const pared = (f, c) => e.mapa[f][c] === "#";
    const caja = (f, c) => e.cajas.findIndex((b) => b.fila === f && b.col === c);
    const n = { ...e, jugador: { ...e.jugador }, cajas: e.cajas.map((b) => ({ ...b })) };
    if (pared(f, c)) return n;
    const i = caja(f, c);
    if (i >= 0) { if (pared(f + df, c + dc) || caja(f + df, c + dc) >= 0) return n; n.cajas[i] = { fila: f + df, col: c + dc }; }
    n.jugador = { fila: f, col: c }; n.movimientos++; return n;
  }
  function ganado(e) { return e.objetivos.every((o) => e.cajas.some((b) => b.fila === o.fila && b.col === o.col)); }
  return { crearEstado, mover, ganado };
})();
