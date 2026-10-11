/**
 * Reglas del juego Boxworld.
 * Define la lógica de estado, movimiento y victoria sin interactuar con el DOM.
 */

const Reglas = {
    /**
     * Crea un objeto de estado inicial a partir de la representación textual del nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (filas).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        const height = nivel.length;
        if (height === 0) return null;
        const width = nivel[0].length;

        let jugadorPos = null;
        let cajas = [];
        let objetivos = [];

        // Recorrer el mapa para identificar elementos iniciales
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const char = nivel[y][x];
                if (char === '@') {
                    jugadorPos = { row: y, col: x };
                } else if (char === '$' || char === '*') {
                    cajas.push({ row: y, col: x });
                } else if (char === '.') {
                    objetivos.push({ row: y, col: x });
                }
            }
        }

        // El mapa de estado solo debe contener paredes ('#'), pisos (' ') y objetivos ('.')
        const mapa = nivel.map(fila => Array.from(fila));

        return {
            mapa: mapa, // Usamos un array de arrays para facilitar la lectura interna si es necesario, aunque el contrato acepta strings. Mantendremos la estructura más simple que solo usa los caracteres estáticos.
            jugador: jugadorPos,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover(estado, direccion) {
        // Clonamos el estado para asegurar que cualquier cambio se haga en un objeto nuevo
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let { jugador, cajas } = estado;
        let nextPlayerPos = null;
        let newCajas = [...cajas];
        let moved = false;

        // 1. Calcular la posición objetivo del jugador (target)
        let targetY = jugador.row;
        let targetX = jugador.col;

        switch (direccion) {
            case "arriba":
                targetY -= 1;
                break;
            case "abajo":
                targetY += 1;
                break;
            case "izquierda":
                targetX -= 1;
                break;
            case "derecha":
                targetX += 1;
                break;
        }

        // Verificar límites del mapa (asumiendo que el tamaño es constante)
        const height = estado.mapa.length;
        const width = state.mapa[0].length;

        if (targetY < 0 || targetY >= height || targetX < 0 || targetX >= width) {
            return nuevoEstado; // Fuera de límites
        }

        // Verificar si el destino es una pared
        if (estado.mapa[targetY][targetX] === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // 2. Determinar qué hay en la posición objetivo
        const boxAtTargetIndex = cajas.findIndex(box => box.row === targetY && box.col === targetX);

        if (boxAtTargetIndex !== -1) {
            // Caso: Intentar empujar una caja
            const boxToPush = cajas[boxAtTargetIndex];

            // Calcular la posición donde iría la caja después del empuje
            let nextBoxY = boxToPush.row;
            let nextBoxX = boxToPush.col;

            switch (direccion) {
                case "arriba":
                    nextBoxY -= 1;
                    break;
                case "abajo":
                    nextBoxY += 1;
                    break;
                case "izquierda":
                    nextBoxX -= 1;
                    break;
                case "derecha":
                    nextBoxX += 1;
                    break;
            }

            // Verificar si el empuje es posible:
            // a) ¿Está la nueva posición de la caja dentro del mapa?
            if (nextBoxY < 0 || nextBoxY >= height || nextBoxX < 0 || nextBoxX >= width) {
                return nuevoEstado; // Empujar fuera de límites
            }

            // b) ¿Es el destino final de la caja una pared o está ocupado por otra cosa?
            if (estado.mapa[nextBoxY][nextBoxX] === '#') {
                return nuevoEstado; // Colisión con pared al empujar
            }

            // c) Verificar si hay otra caja en el destino final de la caja
            const isTargetOccupiedByAnotherBox = cajas.some((box, index) => 
                index !== boxAtTargetIndex && box.row === nextBoxY && box.col === nextBoxX
            );

            if (isTargetOccupiedByAnotherBox) {
                return nuevoEstado; // Colisión con otra caja al empujar
            }

            // Empuje exitoso: Actualizar posiciones de jugador y caja
            nuevoEstado.jugador = { row: targetY, col: targetX };
            newCajas[boxAtTargetIndex] = { row: nextBoxY, col: nextBoxX };
            nuevoEstado.cajas = newCajas;
            moved = true;

        } else {
            // Caso: Movimiento simple (el destino es piso o objetivo)
            const tileType = estado.mapa[targetY][targetX];
            if (tileType === ' ') {
                nuevoEstado.jugador = { row: targetY, col: targetX };
                moved = true;
            } else if (tileType === '.') {
                 // El jugador puede moverse a un objetivo si está vacío
                nuevoEstado.jugador = { row: targetY, col: targetX };
                moved = true;
            }
        }

        if (moved) {
            nuevoEstado.movimientos += 1;
        } else {
            // Si no se movió en ningún caso, devolvemos el estado original sin incrementar movimientos
            return nuevoEstado;
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        const { cajas, objetivos } = estado;

        if (objetivos.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objectiveSet = new Set();
        for (const obj of objetivos) {
            objectiveSet.add(`${obj.row},${obj.col}`);
        }

        // Verificar si cada caja está sobre un objetivo
        let coveredObjectivesCount = 0;
        for (const box of cajas) {
            if (objectiveSet.has(`${box.row},${box.col}`)) {
                coveredObjectivesCount++;
            }
        }

        return coveredObjectivesCount === objectives.length;
    }
};
