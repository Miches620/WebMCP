function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const contadorMovimientos = document.getElementById('movimientos');
    const nivelDisplay = document.getElementById('nivel');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Establecer la estructura de la grilla (9x9)
    tablero.style.gridTemplateColumns = 'repeat(9, 1fr)';

    const mapa = estado.mapa;
    const filas = mapa.length; // Debe ser 9
    const columnas = mapa[0].length; // Debe ser 9

    // Actualizar HUDs
    contadorMovimientos.textContent = estado.movimientos;
    nivelDisplay.textContent = numeroNivel;

    // 2. Dibujar casilleros fila por fila
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const celda = document.createElement('div');
            celda.className = 'casillero';

            // Determinar el tipo base del casillero
            const tipoBase = mapa[r][c];
            if (tipoBase === '#') {
                celda.classList.add('pared');
            } else if (tipoBase === '.') {
                celda.classList.add('objetivo');
            } else { // ' ' o cualquier otro espacio vacío
                celda.classList.add('piso');
            }

            // 3. Verificar elementos superpuestos (Jugador, Caja)
            let esCaja = false;
            let esJugador = false;

            // Chequear si hay caja en esta posición
            for (const caja of estado.cajas) {
                if (caja.fila === r && caja.col === c) {
                    esCaja = true;
                    break;
                }
            }

            // Chequear si está el jugador en esta posición
            if (estado.jugador.fila === r && estado.jugador.col === c) {
                esJugador = true;
            }

            // Aplicar clases de superposición
            if (esCaja) {
                celda.classList.add('caja');
            }
            if (esJugador) {
                celda.classList.add('jugador');
            }

            tablero.appendChild(celda);
        }
    }
}
