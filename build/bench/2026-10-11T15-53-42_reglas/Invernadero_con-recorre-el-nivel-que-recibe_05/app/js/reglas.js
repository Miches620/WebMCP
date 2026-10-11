const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasIniciales = [];
        let objetivosIniciales = [];

        // Recorrer el mapa para encontrar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasIniciales.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // El mapa de estado solo contiene paredes, pisos y objetivos estáticos.
        const mapaEstado = nivel.map(fila => Array.from(fila));

        return {
            mapa: mapaEstado,
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento posible.
     */
    mover: function(estado, direccion) {
        const pr = estado.jugador.fila;
        const pc = estado.jugador.col;

        let nr = pr;
        let nc = pc;

        // 1. Calcular la posición potencial del jugador (nr, nc)
        switch (direccion) {
            case "arriba":
                nr -= 1;
                break;
            case "abajo":
                nr += 1;
                break;
            case "izquierda":
                nc -= 1;
                break;
            case "derecha":
                nc += 1;
                break;
        }

        // Helper para verificar si una posición es válida (dentro de límites y no pared)
        const isValidPos = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            // Verificar si es pared en el mapa base
            return estado.mapa[r][c] !== '#';
        };

        if (!isValidPos(nr, nc)) {
            return { ...estado, movimientos: estado.movimientos }; // No se puede mover (pared o límite)
        }

        // 2. Verificar si la posición destino contiene cajas
        const boxesAtTarget = estado.cajas.filter(box => box.fila === nr && box.col === nc);

        if (boxesAtTarget.length === 0) {
            // Caso A: Movimiento simple (sin colisión con caja)
            return {
                ...estado,
                jugador: { fila: nr, col: nc },
                movimientos: estado.movimientos + 1
            };
        } else {
            // Caso B: Intento de empujar cajas
            const pushTarget = this._getPushTarget(estado, direccion, nr, nc);

            if (!pushTarget) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje bloqueado
            }

            // 3. Movimiento exitoso (Empujando cajas)
            const nuevoEstado = {
                ...estado,
                jugador: { fila: nr, col: nc }, // El jugador se mueve a la posición de las cajas
                movimientos: estado.movimientos + 1
            };

            // Actualizar posiciones de las cajas movidas
            const nuevasCajas = estado.cajas.map(box => {
                if (box.fila === nr && box.col === nc) {
                    return { ...box, fila: pushTarget.r, col: pushTarget.c }; // Mover a la nueva posición
                }
                return box; // Caja que no se mueve
            });

            nuevoEstado.cajas = nuevasCajas;
            return nuevoEstado;
        }
    },

    /**
     * Determina el objetivo de empuje (la casilla detrás de las cajas).
     * @param {object} estado - Estado actual.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @param {number} nr - Fila destino (donde están las cajas).
     * @param {number} nc - Columna destino (donde están las cajas).
     * @returns {{r: number, c: number} | null} Coordenadas de destino o null si está bloqueado.
     */
    _getPushTarget: function(estado, direccion, nr, nc) {
        let tr = nr; // Target Row
        let tc = nc; // Target Col

        // Calcular la posición detrás de las cajas (el objetivo del empuje)
        switch (direccion) {
            case "arriba":
                tr -= 1;
                break;
            case "abajo":
                tr += 1;
                break;
            case "izquierda":
                tc -= 1;
                break;
            case "derecha":
                tc += 1;
                break;
        }

        // Verificar si el destino del empuje es válido (dentro de límites y no pared)
        const isValidPushTarget = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            // Debe ser piso o objetivo, no pared
            return estado.mapa[r][c] !== '#';
        };

        if (!isValidPushTarget(tr, tc)) {
            return null; // Bloqueado por pared o límite
        }

        // Verificar si el destino del empuje está ocupado por otra caja
        const isBlockedByBox = estado.cajas.some(box => box.fila === tr && box.col === tc);
        if (isBlockedByBox) {
            return null; // Bloqueado por otra caja
        }

        // Si todo está bien, el destino es válido
        return { r: tr, c: tc };
    },


    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado el nivel.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0) return true; // No hay objetivos, por defecto es ganado o no aplica

        // Crear un set de coordenadas de las cajas para búsqueda rápida
        const cajaCoords = new Set(cajas.map(box => `${box.fila},${box.col}`));

        // Verificar si cada objetivo tiene una caja encima
        for (const obj of objetivos) {
            if (!cajaCoords.has(`${obj.fila},${obj.col}`)) {
                return false; // Al menos un objetivo no está cubierto
            }
        }
        return true;
    }
};
