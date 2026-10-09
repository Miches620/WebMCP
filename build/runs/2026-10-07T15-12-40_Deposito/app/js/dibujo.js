/**
 * Dibuja el estado actual del juego en el tablero HTML.
 * @param {object} estado - El objeto de estado que contiene la información del mapa, jugador y cajas.
 * @param {number} numeroNivel - El número de nivel actual (para mostrarlo).
 */
function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const contadorMovimientos = document.getElementById('movimientos');
    const displayNivel = document.getElementById('nivel');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // 2. Configurar las columnas del grid (8x8)
    tablero.style.gridTemplateColumns = 'repeat(8, 1fr)';

    const mapa = estado.mapa;
    const filas = mapa.length; // Debe ser 8
    const columnas = mapa[0].length; // Debe ser 8

    // 3. Dibujar cada casillero
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const claseBase = mapa[r][c] === '#' ? 'pared' : 'piso';
            let clasesAdicionales = '';

            // Determinar si es objetivo
            if (estado.objetivos.some(obj => obj.fila === r && obj.col === c)) {
                clasesAdicionales += ' objetivo ';
            }

            // Determinar si hay caja en esta posición
            const hayCaja = estado.cajas.some(box => box.fila === r && box.col === c);
            if (hayCaja) {
                clasesAdicionales += ' caja ';
            }

            // Determinar si está el jugador en esta posición
            const esJugador = estado.jugador.fila === r && estado.jugador.col === c;
            if (esJugador) {
                clasesAdicionales += ' jugador ';
            }

            // Crear y añadir el div del casillero
            const casilla = document.createElement('div');
            casilla.className = `casillero ${claseBase} ${clasesAdicionales.trim()}`;
            tablero.appendChild(casilla);
        }
    }

    // 4. Actualizar el HUD (Head-Up Display)
    contadorMovimientos.textContent = `Movimientos: ${estado.movimientos}`;
    displayNivel.textContent = `Nivel: ${numeroNivel}`;
}
