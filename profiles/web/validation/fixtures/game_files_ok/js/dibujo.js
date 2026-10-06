function dibujar(estado, numeroNivel) {
  const t = document.getElementById("tablero"); t.innerHTML = "";
  t.style.gridTemplateColumns = "repeat(" + estado.mapa[0].length + ", 1fr)";
  estado.mapa.forEach((fila, r) => [...fila].forEach((ch, c) => {
    const d = document.createElement("div");
    d.className = "casillero " + (ch === "#" ? "pared" : "piso");
    if (estado.objetivos.some((o) => o.fila === r && o.col === c)) d.classList.add("objetivo");
    if (estado.cajas.some((b) => b.fila === r && b.col === c)) d.classList.add("caja");
    if (estado.jugador.fila === r && estado.jugador.col === c) d.classList.add("jugador");
    t.appendChild(d);
  }));
  document.getElementById("movimientos").textContent = estado.movimientos;
  document.getElementById("nivel").textContent = numeroNivel;
}
