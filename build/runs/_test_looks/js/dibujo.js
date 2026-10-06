function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const objetivos = estado.objetivos;
    const cajas = estado.cajas;
    const jugadorPos = estado.jugador;

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Establecer la estructura de la cuadrícula (10 columnas)
    tablero.style.gridTemplateColumns = 'repeat(10, 1fr)';

    const mapa = estado.mapa;
    const altura = mapa.length;
    const ancho = mapa[0].length;

    // Iterar sobre el mapa para dibujar cada casillero
    for (let r = 0; r < altura; r++) {
        for (let c = 0; c < ancho; c++) {
            const casilla = document.createElement('div');
            casilla.className = 'casillero';

            // Determinar el tipo base del casillero
            if (mapa[r][c] === '#') {
                casilla.classList.add('pared'); // Color de pared
            } else if (mapa[r][c] === '.') {
                casilla.classList.add('objetivo'); // Color objetivo
            } else {
                // Piso o espacio vacío (' ' o '.')
                casilla.classList.add('piso'); // Color piso
            }

            let esObjetivo = objetivos.some(obj => obj.fila === r && obj.col === c);
            if (esObjetivo) {
                casilla.classList.add('objetivo');
            }

            // 2. Dibujar cajas
            const hayCaja = cajas.some(caja => caja.fila === r && caja.col === c);
            if (hayCaja) {
                casilla.classList.add('caja');
            }

            // 3. Dibujar jugador
            if (r === jugadorPos.fila && c === jugadorPos.col) {
                casilla.classList.add('jugador');
            }

            tablero.appendChild(casilla);
        }
    }

    // Actualizar el HUD
    document.getElementById('movimientos').textContent = `Movimientos: ${estado.movimientos}`;
    document.getElementById('nivel').textContent = `Nivel: ${numeroNivel}`;
}
