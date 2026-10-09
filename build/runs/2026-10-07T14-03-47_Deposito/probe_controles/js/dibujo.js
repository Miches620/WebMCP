function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const nivelDisplay = document.getElementById('nivel');
    const movimientosDisplay = document.getElementById('movimientos');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // 2. Configurar la cuadrícula (8x8)
    tablero.style.gridTemplateColumns = 'repeat(8, 1fr)';

    const mapa = estado.mapa;
    const filas = mapa.length; // Debe ser 8
    const columnas = mapa[0].length; // Debe ser 8

    // 3. Dibujar cada casillero
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const claseBase = mapa[r][c] === '#' ? 'pared' : 'piso';
            let clases = `casillero ${claseBase}`;

            // Verificar si es objetivo
            if (mapa[r][c] === '.') {
                clases += ' objetivo';
            }

            // Crear el div del casillero
            const casilla = document.createElement('div');
            casilla.className = clases;

            // 4. Añadir elementos superpuestos (Cajas, Jugador)
            let tieneCaja = false;
            let esJugador = false;

            // Verificar si hay caja en esta posición
            for (const caja of estado.cajas) {
                if (caja.fila === r && caja.col === c) {
                    tieneCaja = true;
                    break;
                }
            }

            // Verificar si el jugador está aquí
            if (estado.jugador.fila === r && estado.jugador.col === c) {
                esJugador = true;
            }

            // Actualizar clases con elementos superpuestos
            if (tieneCaja) {
                casilla.classList.add('caja');
            }
            if (esJugador) {
                casilla.classList.add('jugador');
            }

            tablero.appendChild(casilla);
        }
    }

    // 5. Actualizar HUD
    movimientosDisplay.textContent = `Movimientos: ${estado.movimientos}`;
    nivelDisplay.textContent = `Nivel ${numeroNivel}`;
}
