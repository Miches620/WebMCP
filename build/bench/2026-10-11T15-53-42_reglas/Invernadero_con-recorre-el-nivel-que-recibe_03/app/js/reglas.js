const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - El mapa del nivel (array de strings).
     * @returns {object} Estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasPos = [];
        let objetivosPos = [];

        // Recorrer el mapa para identificar posiciones clave
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasPos.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosPos.push({ fila: r, col: c });
                }
            }
        }

        // El mapa de estado solo contiene paredes ('#'), pisos (' ') y objetivos ('.')
        const mapaEstado = nivel.map(fila => 
            Array.from(fila).map(char => char === '.' ? '.' : (char === '#' ? '#' : ' '))
        );

        return {
            mapa: mapaEstado,
            jugador: jugadorPos,
            cajas: cajasPos,
            objetivos: objetivosPos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let dr = 0; // Cambio de fila
        let dc = 0; // Cambio de columna

        switch (direccion) {
            case "arriba":
                dr = -1;
                dc = 0;
                break;
            case "abajo":
                dr = 1;
                dc = 0;
                break;
            case "izquierda":
                dr = 0;
                dc = -1;
                break;
            case "derecha":
                dr = 0;
                dc = 1;
                break;
        }

        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        // Posición objetivo del jugador (sin considerar cajas)
        let tr = jugador.fila + dr;
        let tc = jugador.col + dc;

        // 1. Validación de límites y paredes para el movimiento básico
        if (tr < 0 || tr >= filas || tc < 0 || tc >= columnas || estado.mapa[tr][tc] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // No hay cambio
        }

        // 2. Verificar si el destino está ocupado por una caja
        const boxAtTarget = estado.cajas.some(box => box.fila === tr && box.col === tc);

        if (!boxAtTarget) {
            // Movimiento simple (sin cajas involucradas)
            return Reglas._crearNuevoEstado(estado, jugador, { fila: tr, col: tc }, estado.cajas, 1);
        } else {
            // Intentando empujar una caja
            const boxIndex = estado.cajas.findIndex(box => box.fila === tr && box.col === tc);
            if (boxIndex === -1) return state; // Error de lógica

            // Posición objetivo para la caja (detrás de ella)
            let tbr = tr + dr;
            let tbc = tc + dc;

            // Validación del destino de la caja: límites, paredes o colisión con otra caja
            if (tbr < 0 || tbr >= filas || tbc < 0 || tbc >= columnas || estado.mapa[tbr][tbc] === '#') {
                return state; // La caja no puede moverse porque choca contra pared/borde
            }

            // Verificar si el destino de la caja está ocupado por otra caja (excluyendo la que estamos empujando)
            const collisionWithOtherBox = estado.cajas.some((box, index) => 
                index !== boxIndex && box.fila === tbr && box.col === tbc
            );

            if (collisionWithOtherBox) {
                return state; // La caja no puede moverse porque choca contra otra caja
            }

            // Movimiento exitoso de empuje
            const nuevasCajas = [...estado.cajas];
            // Actualizar la posición de la caja movida
            nuevasCajas[boxIndex] = { fila: tbr, col: tbc };

            // El jugador se mueve a donde estaba la caja
            return Reglas._crearNuevoEstado(state, jugador, { fila: tr, col: tc }, nuevasCajas, 1);
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos, se considera ganado

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const box of estado.cajas) {
            if (!objetivosSet.has(`${box.fila},${box.col}`)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas están sobre objetivos, el nivel se ha completado
        return true;
    },

    /**
     * Método privado para crear un nuevo estado de forma inmutable.
     * @param {object} estado - Estado original.
     * @param {object} jugadorNuevo - Nueva posición del jugador.
     * @param {array} cajasNuevas - Array actualizado de posiciones de las cajas.
     * @param {number} movimientosIncremento - Cuántos movimientos se suman.
     * @returns {object} Nuevo estado.
     */
    _crearNuevoEstado: function(estado, jugadorNuevo, cajasNuevas, movimientosIncremento) {
        // Clonamos el estado para asegurar inmutabilidad
        return {
            mapa: state.mapa, // El mapa no cambia en este juego
            jugador: jugadorNuevo,
            cajas: [...cajasNuevas],
            objetivos: state.objetivos,
            movimientos: estado.movimientos + movimientosIncremento
        };
    }
};
