function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const movimientosDisplay = document.getElementById('movimientos');
    const nivelDisplay = document.getElementById('nivel');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    if (!estado || !estado.mapa || estado.mapa.length === 0) {
        console.error("Estado inválido para dibujar.");
        return;
    }

    const filas = estado.mapa.length;
    // Asumimos que todas las filas tienen la misma longitud (ancho del mapa)
    const columnas = estado.mapa[0].length; 

    // 2. Configurar el grid template columns
    tablero.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;

    // Helper para verificar si una coordenada está ocupada por un elemento específico
    const estaOcupadoPor = (coords, fila, col) => {
        return coords.some(coord => coord.fila === fila && coord.col === col);
    };

    // 3. Iterar y dibujar cada casillero
    for (let i = 0; i < filas; i++) {
        for (let j = 0; j < columnas; j++) {
            const char = estado.mapa[i][j];
            let clases = ['casillero'];

            // Determinar el tipo base del casillero
            if (char === '#') {
                clases.push('pared');
            } else if (char === ' ') {
                clases.push('piso');
            } else if (char === '.') {
                clases.push('piso', 'objetivo'); // El objetivo siempre está en un piso
            }

            // Verificar si hay jugador aquí
            const esJugador = estado.jugador && estado.jugador.fila === i && estado.jugador.col === j;
            if (esJugador) {
                clases.push('jugador');
            }

            // Verificar si hay caja aquí
            const esCaja = estado.cajas.some(box => box.fila === i && box.col === j);
            if (esCaja) {
                clases.push('caja');
            }

            // Verificar si es objetivo (aunque ya se añadió en el char, lo reforzamos por seguridad)
            const esObjetivo = estado.objetivos.some(obj => obj.fila === i && obj.col === j);
            if (esObjetivo) {
                clases.push('objetivo');
            }

            // Crear y añadir el div del casillero
            const casillaDiv = document.createElement('div');
            casillaDiv.className = clases.join(' ');
            tablero.appendChild(casillaDiv);
        }
    }

    // 4. Actualizar HUD (Head-Up Display)
    movimientosDisplay.textContent = `Movimientos: ${estado.movimientos}`;
    nivelDisplay.textContent = `Nivel ${numeroNivel}`;
}
