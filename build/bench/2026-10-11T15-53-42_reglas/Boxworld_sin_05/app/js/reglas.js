const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 10x10.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const map = [];
        let jugadorPos = null;
        let cajasPos = [];
        let objetivosPos = [];

        // 1. Parsear el mapa y encontrar posiciones iniciales
        for (let r = 0; r < nivel.length; r++) {
            let row = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    row += '#';
                } else if (char === ' ') {
                    row += ' ';
                } else if (char === '.') {
                    row += '.';
                    objetivosPos.push({ fila: r, col: c });
                } else if (char === '$') {
                    row += ' '; // El mapa solo lleva piso/pared/objetivo
                    cajasPos.push({ fila: r, col: c });
                } else if (char === '@') {
                    row += ' '; // El mapa solo lleva piso/pared/objetivo
                    jugadorPos = { fila: r, col: c };
                } else {
                    // Esto debería ser imposible si el nivel es válido
                    row += '?'; 
                }
            }
            map.push(row);
        }

        return {
            mapa: map,
            jugador: jugadorPos,
            cajas: cajasPos,
            objetivos: objetivosPos,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificar si cada caja está en una posición que coincide con un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está sobre un objetivo
            }
        }

        // Si todas las cajas están en objetivos, y hay al menos un objetivo, se gana.
        return estado.cajas.length > 0 && estado.objetivos.length > 0;
    },

    /**
     * Intenta mover el jugador según la dirección dada, manejando colisiones y empujes.
     * @param {object} estado - El estado actual del juego (se usa para leer).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado que contiene el resultado del movimiento.
     */
    mover: function(estado, direccion) {
        const MAX_SIZE = 10;

        // Función auxiliar para obtener la nueva posición (r, c)
        let newPlayerPos = { ...estado.jugador };
        switch (direccion) {
            case "arriba":
                newPlayerPos.fila -= 1;
                break;
            case "abajo":
                newPlayerPos.fila += 1;
                break;
            case "izquierda":
                newPlayerPos.col -= 1;
                break;
            case "derecha":
                newPlayerPos.col += 1;
                break;
        }

        // 1. Validación de límites y paredes (Mapa)
        if (newPlayerPos.fila < 0 || newPlayerPos.fila >= MAX_SIZE ||
            newPlayerPos.col < 0 || newPlayerPos.col >= MAX_SIZE ||
            estado.mapa[newPlayerPos.fila][newPlayerPos.col] === '#') {
            // Movimiento inválido: fuera de límites o contra pared
            return { ...estado, movimientos: estado.movimientos };
        }

        let newCajas = [...estado.cajas];
        let playerMovedSuccessfully = false;

        // 2. Verificar colisión con cajas
        const collidingBoxIndex = newCajas.findIndex(box => 
            box.fila === newPlayerPos.fila && box.col === newPlayerPos.col
        );

        if (collidingBoxIndex !== -1) {
            // Hay una caja en el destino del jugador, intentar empujar
            const box = newCajas[collidingBoxIndex];
            let pushTarget = { ...box };

            // Calcular la posición objetivo de la caja
            switch (direccion) {
                case "arriba":
                    pushTarget.fila -= 1;
                    break;
                case "abajo":
                    pushTarget.fila += 1;
                    break;
                case "izquierda":
                    pushTarget.col -= 1;
                    break;
                case "derecha":
                    pushTarget.col += 1;
                    break;
            }

            // Validación de empuje: ¿Es el destino del box válido?
            const isPushTargetValid = (
                pushTarget.fila >= 0 && pushTarget.fila < MAX_SIZE &&
                pushTarget.col >= 0 && pushTarget.col < MAX_SIZE &&
                estado.mapa[pushTarget.fila][pushTarget.col] !== '#'
            );

            // Verificar si el destino del box está ocupado por otra caja o es inválido
            let targetOccupiedByBox = false;
            for (let i = 0; i < newCajas.length; i++) {
                if (i !== collidingBoxIndex && newCajas[i].fila === pushTarget.fila && newCajas[i].col === pushTarget.col) {
                    targetOccupiedByBox = true;
                    break;
                }
            }

            // Condición de éxito del empuje: Debe ser válido y no estar ocupado por otra caja
            if (isPushTargetValid && !targetOccupiedByBox) {
                // ¡Empuje exitoso! Actualizar la posición de la caja.
                newCajas[collidingBoxIndex] = pushTarget;
                playerMovedSuccessfully = true;
            } else {
                // Empuje fallido (pared o otra caja), el jugador no se mueve.
                return { ...estado, movimientos: estado.movimientos };
            }

        } else {
            // No hay colisión con cajas, solo movimiento del jugador.
            playerMovedSuccessfully = true;
        }


        // 3. Construir y devolver el nuevo estado (Inmutabilidad)
        const newState = {
            mapa: estado.mapa, // El mapa no cambia en este modelo de estado
            jugador: newPlayerPos,
            cajas: newCajas,
            objetivos: estado.objetivos,
            movimientos: state.movimientos + (playerMovedSuccessfully ? 1 : 0)
        };

        return newState;
    }
};
