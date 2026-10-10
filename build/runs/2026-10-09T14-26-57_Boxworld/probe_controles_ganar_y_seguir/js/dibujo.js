function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById("tablero");
    const nivelDisplay = document.getElementById("nivel");
    const movimientosDisplay = document.getElementById("movimientos");

    // 1. Limpiar el tablero
    tablero.innerHTML = "";

    // Establecer las columnas del grid (fijo a 10)
    tablero.style.gridTemplateColumns = "repeat(10, 1fr)";

    const mapa = estado.mapa;
    const filas = mapa.length;
    const columnas = mapa[0].length;

    // 2. Dibujar cada casillero
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const cellDiv = document.createElement("div");
            cellDiv.className = "casillero";

            // Determinar el tipo base: pared o piso
            if (mapa[r][c] === "#") {
                cellDiv.classList.add("pared");
            } else {
                cellDiv.classList.add("piso");
            }

            let isObjective = false;
            let isBox = false;
            let isPlayer = false;

            // Verificar si es objetivo
            for (let i = 0; i < estado.objetivos.length; i++) {
                if (estado.objetivos[i].fila === r && estado.objetivos[i].col === c) {
                    isObjective = true;
                    break;
                }
            }

            // Verificar si hay caja
            for (let i = 0; i < estado.cajas.length; i++) {
                if (estado.cajas[i].fila === r && estado.cajas[i].col === c) {
                    isBox = true;
                    break;
                }
            }

            // Verificar si está el jugador
            if (estado.jugador.fila === r && estado.jugador.col === c) {
                isPlayer = true;
            }

            // Añadir clases de superposición
            if (isObjective) {
                cellDiv.classList.add("objetivo");
            }
            if (isBox) {
                cellDiv.classList.add("caja");
            }
            if (isPlayer) {
                cellDiv.classList.add("jugador");
            }

            tablero.appendChild(cellDiv);
        }
    }

    // 3. Actualizar el HUD
    document.getElementById("movimientos").textContent = "Movimientos: " + estado.movimientos;
    nivelDisplay.textContent = "Nivel: " + numeroNivel;
}
