function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const nivelDisplay = document.getElementById('nivel');
    const movimientosDisplay = document.getElementById('movimientos');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Establecer la plantilla de columnas (asumiendo que es un cuadrado o rectangular fijo)
    // Dado que el mapa es 10x10, usamos 10 columnas.
    tablero.style.gridTemplateColumns = 'repeat(10, 1fr)';

    const filas = estado.mapa.length;
    if (filas === 0) return;
    const columnas = estado.mapa[0].length;

    // 2. Dibujar cada casillero
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const cell = document.createElement('div');
            cell.className = 'casillero';

            // Determinar el tipo base del casillero
            const tileType = estado.mapa[r][c];
            if (tileType === '#') {
                cell.classList.add('pared');
            } else if (tileType === '.') {
                cell.classList.add('objetivo');
            } else {
                // Piso o objetivo sin caja encima
                cell.classList.add('piso');
            }

            let isBox = false;
            let isPlayer = false;

            // Verificar si hay una caja en esta posición
            for (const box of estado.cajas) {
                if (box.fila === r && box.col === c) {
                    cell.classList.add('caja');
                    isBox = true;
                    break;
                }
            }

            // Verificar si el jugador está en esta posición
            if (estado.jugador.fila === r && estado.jugador.col === c) {
                cell.classList.add('jugador');
                isPlayer = true;
            }

            tablero.appendChild(cell);
        }
    }

    // 3. Actualizar el HUD (Head-Up Display)
    movimientosDisplay.textContent = `Movimientos: ${estado.movimientos}`;
    nivelDisplay.textContent = `Nivel ${numeroNivel}`;
}
