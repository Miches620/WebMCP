function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const nivelDisplay = document.getElementById('nivel');
    const movimientosDisplay = document.getElementById('movimientos');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Establecer la estructura de la grilla (9 columnas)
    tablero.style.gridTemplateColumns = 'repeat(9, 1fr)';

    const mapa = estado.mapa;
    const cajas = estado.cajas;
    const jugadorPos = { fila: estado.jugador.fila, col: estado.jugador.col };

    // Iterar sobre el mapa (filas y columnas)
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const casilleroDiv = document.createElement('div');
            casilleroDiv.className = 'casillero';

            // Determinar el tipo base del piso/pared
            if (mapa[r][c] === '#') {
                casilleroDiv.classList.add('pared');
            } else {
                casilleroDiv.classList.add('piso');
            }

            // 2. Verificar si es un objetivo
            const objetivos = estado.objetivos;
            if (objetivos.some(obj => obj.fila === r && obj.col === c)) {
                casilleroDiv.classList.add('objetivo');
            }

            // 3. Verificar si hay una caja en esta posición
            const tieneCaja = cajas.some(caja => caja.fila === r && caja.col === c);
            if (tieneCaja) {
                casilleroDiv.classList.add('caja');
            }

            // 4. Verificar si el jugador está en esta posición
            const esJugador = (r === jugadorPos.fila && c === jugadorPos.col);
            if (esJugador) {
                casilleroDiv.classList.add('jugador');
            }

            tablero.appendChild(casilleroDiv);
        }
    }

    // 5. Actualizar el HUD
    movimientosDisplay.textContent = estado.movimientos;
    nivelDisplay.textContent = numeroNivel;
}
