const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // Recorrer el nivel para identificar posiciones clave
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // Crear el mapa limpio para el estado (solo #, ' ', .)
        let mapaLimpio = [];
        for (let r = 0; r < 8; r++) {
            let fila = '';
            for (let c = 0; c < 8; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    fila += '#';
                } else if (char === '.') {
                    // Los objetivos se mantienen visibles en el mapa limpio
                    fila += '.';
                } else {
                    // Espacio vacío o donde estaban cajas/jugador, pero no es objetivo.
                    fila += ' ';
                }
            }
            mapaLimpio.push(fila);
        }

        return {
            mapa: mapaLimpio,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado en la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const dr = { "arriba": -1, "abajo": 1, "izquierda": 0, "derecha": 0 }[direccion];
        const dc = { "arriba": 0, "abajo": 0, "izquierda": -1, "derecha": 1 }[direccion];

        let jugadorActual = estado.jugador;
        let nuevaFilaJugador = jugadorActual.fila + dr;
        let nuevaColJugador = jugadorActual.col + dc;

        // 1. Verificar límites y paredes en la posición objetivo del jugador
        if (nuevaFilaJugador < 0 || nuevaFilaJugador > 7 || nuevaColJugador < 0 || nuevaColJugador > 7) {
            return estado; // Fuera de límites
        }

        // Verificar si el destino es una pared. Usamos el mapa limpio para esto.
        if (estado.mapa[nuevaFilaJugador][nuevaColJugador] === '#') {
            return estado; // Colisión con pared
        }

        let cajaEnDestino = estado.cajas.some(c => c.fila === nuevaFilaJugador && c.col === nuevaColJugador);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (destino vacío o objetivo)
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empuje (Pushing)
            let cajaDestino = estado.cajas.find(c => c.fila === nuevaFilaJugador && c.col === nuevaColJugador);

            // Calcular la posición detrás de la caja
            let filaDetras = nuevaFilaJugador + dr;
            let colDetras = nuevaColJugador + dc;

            // Verificar si el destino es válido (no pared, no fuera de límites)
            if (filaDetras < 0 || filaDetras > 7 || colDetras < 0 || colDetras > 7) {
                return estado; // Colisión con límite del mapa
            }

            // Verificar si el destino detrás es una pared.
            if (estado.mapa[filaDetras][colDetras] === '#') {
                return estado; // Empuje bloqueado por pared
            }

            // Verificar si hay otra caja en la posición de empuje (detrás)
            let collisioneCaja = estado.cajas.some(c => c !== cajaDestino && c.fila === filaDetras && c.col === colDetras);
            if (collisioneCaja) {
                return estado; // Empuje bloqueado por otra caja
            }

            // ¡Empuje exitoso! Actualizar el estado
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            nuevoEstado.movimientos += 1;

            // Mover la caja
            cajaDestino.fila = filaDetras;
            cajaDestino.col = colDetras;

            // Devolver el nuevo estado con la caja movida y el jugador actualizado
            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está en una posición que coincide con un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está sobre un objetivo
            }
        }

        // Si todas las cajas están en coordenadas de objetivos, se ha ganado.
        return true;
    }
};
