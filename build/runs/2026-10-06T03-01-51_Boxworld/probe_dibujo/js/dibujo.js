/**
 * Dibuja el estado actual del juego en el DOM.
 * @param {object} estado - El objeto de estado que contiene mapa, jugador, cajas, etc.
 * @param {number} numeroNivel - El número de nivel actual.
 */
function dibujar(estado, numeroNivel) {
    const tablero = document.getElementById('tablero');
    const movimientosDisplay = document.getElementById('movimientos');
    const nivelDisplay = document.getElementById('nivel');

    // 1. Limpiar el tablero
    tablero.innerHTML = '';

    // Determinar dimensiones del mapa (asumiendo que estado.map existe)
    if (!estado || !estado.map) return;

    const filas = estado.map.length;
    const columnas = estado.map[0].length;

    // 2. Configurar el estilo de la cuadrícula
    tablero.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;

    // 3. Dibujar cada casillero
    for (let r = 0; r < filas; r++) {
        for (let c = 0; c < columnas; c++) {
            const tileType = estado.map[r][c];
            let classes = "casillero";

            // Determinar la clase base del casillero
            if (tileType === '#') {
                classes += " pared";
            } else if (tileType === ' ') {
                classes += " piso";
            } else if (tileType === '.') {
                classes += " objetivo";
            }

            const cell = document.createElement('div');
            cell.className = classes;

            // 4. Aplicar superposiciones de elementos
            let isBox = false;
            let isPlayer = false;

            // Verificar si hay caja en esta posición
            estado.cajas.forEach(box => {
                if (box.fila === r && box.col === c) {
                    cell.classList.add('caja');
                    isBox = true;
                }
            });

            // Verificar si está el jugador aquí
            if (estado.jugador.fila === r && estado.jugador.col === c) {
                cell.classList.add('jugador');
                isPlayer = true;
            }

            // Si hay caja y es objetivo, se añade una clase extra para estilo visual de cobertura
            const isObjectiveCovered = estado.objetivos.some(obj => obj.fila === r && obj.col === c) && isBox;
            if (isObjectiveCovered) {
                cell.classList.add('sobre-objetivo'); 
            }

            tablero.appendChild(cell);
        }
    }

    // 5. Actualizar HUD (Head-Up Display)
    movimientosDisplay.textContent = `Movimientos: ${estado.movimientos}`;
    nivelDisplay.textContent = `Nivel ${numeroNivel}`;
}
