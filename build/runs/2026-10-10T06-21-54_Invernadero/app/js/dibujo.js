function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const nivelElemento = document.getElementById('nivel');
    const movimientosElemento = document.getElementById('movimientos');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Establecer la estructura de la cuadrícula (9 columnas)
    tablero.style.gridTemplateColumns = 'repeat(9, 1fr)';

    const altura = estado.mapa.length; // Debe ser 9
    const ancho = estado.mapa[0].length; // Debe ser 9

    // 2. Dibujar los casilleros
    for (let r = 0; r < altura; r++) {
        for (let c = 0; c < ancho; c++) {
            const casilla = document.createElement('div');
            casilla.classList.add('casillero');

            // Determinar la clase base (pared o piso)
            if (estado.mapa[r][c] === '#') {
                casilla.classList.add('pared');
            } else {
                casilla.classList.add('piso');
            }

            let clasesAdicionales = [];

            // 3. Verificar elementos especiales en la posición (r, c)
            const esObjetivo = estado.mapa[r][c] === '.';
            if (esObjetivo) {
                clasesAdicionales.push('objetivo');
            }

            // CORRECCIÓN: Renombrar el parámetro de .some() para evitar colisión con la variable 'c' del bucle for.
            const esCaja = estado.cajas.some(p => p.fila === r && p.col === c);
            if (esCaja) {
                clasesAdicionales.push('caja');
            }

            const esJugador = estado.jugador.fila === r && estado.jugador.col === c;
            if (esJugador) {
                // El jugador siempre tiene prioridad visual sobre la caja si está encima, 
                // pero en el dibujo solo se añade la clase 'jugador' al div del casillero.
                clasesAdicionales.push('jugador');
            }

            casilla.classList.add(...clasesAdicionales);
            tablero.appendChild(casilla);
        }
    }

    // 4. Actualizar el HUD (Head-Up Display)
    movimientosElemento.textContent = `Movimientos: ${estado.movimientos}`;
    nivelElemento.textContent = `Nivel ${numeroNivel}`;
}
