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

        const R = nivel.length;
        if (R === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
        
        // Asumimos que todas las filas tienen la misma longitud
        const C = nivel[0].length;

        // Recorrer el nivel para identificar posiciones clave
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
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

        // El mapa de estado solo debe contener '#', ' ', '.'
        // Reemplazamos cualquier carácter que no sea #, espacio o punto por un espacio.
        const mapaLimpiado = nivel.map(fila => fila.replace(/[^# .]/g, ' '));

        return {
            mapa: mapaLimpiado,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento válido.
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugadorPos = estado.jugador;
        let nuevaFila = jugadorPos.fila;
        let nuevaCol = jugadorPos.col;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
        switch (direccion) {
            case "arriba":
                nuevaFila -= 1;
                break;
            case "abajo":
                nuevaFila += 1;
                break;
            case "izquierda":
                nuevaCol -= 1;
                break;
            case "derecha":
                nuevaCol += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        if (nuevaFila < 0 || nuevaFila > 7 || nuevaCol < 0 || nuevaCol > 7) {
            return estado; // Fuera de límites
        }

        // Verificar pared en la posición objetivo
        if (estado.mapa[nuevaFila][nuevaCol] === '#') {
            return estado; // Colisión con pared
        }

        let cajaImpactada = null;
        let indiceCajaImpactada = -1;

        // 2. Verificar si hay una caja en la posición objetivo
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === nuevaFila && caja.col === nuevaCol) {
                cajaImpactada = caja;
                indiceCajaImpactada = i;
                break;
            }
        }

        // 3. Manejar el movimiento
        if (!cajaImpactada) {
            // Caso A: Movimiento simple (a piso o objetivo)
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empuje de caja
            let pushTargetFila = cajaImpactada.fila;
            let pushTargetCol = cajaImpactada.col;

            // Calcular la posición final deseada para la caja (detrás del jugador)
            switch (direccion) {
                case "arriba":
                    pushTargetFila -= 1;
                    break;
                case "abajo":
                    pushTargetFila += 1;
                    break;
                case "izquierda":
                    pushTargetCol -= 1;
                    break;
                case "derecha":
                    pushTargetCol += 1;
                    break;
            }

            // Verificar si el empuje es posible:
            // a) No puede salir del mapa (límites)
            if (pushTargetFila < 0 || pushTargetFila > 7 || pushTargetCol < 0 || pushTargetCol > 7) {
                return estado; // Colisión con límite
            }

            // b) El destino final no puede ser una pared
            if (estado.mapa[pushTargetFila][pushTargetCol] === '#') {
                return estado; // Colisión con pared en el destino
            }

            // c) El destino final no puede tener otra caja
            let hayOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCajaImpactada && estado.cajas[i].fila === pushTargetFila && estado.cajas[i].col === pushTargetCol) {
                    hayOtraCaja = true;
                    break;
                }
            }

            if (hayOtraCaja) {
                return estado; // Colisión con otra caja
            }

            // Empuje exitoso: Actualizar el estado
            nuevoEstado.jugador = { fila: cajaImpactada.fila, col: cajaImpactada.col }; // El jugador ocupa la posición anterior de la caja
            nuevoEstado.cajas[indiceCajaImpactada] = { fila: pushTargetFila, col: pushTargetCol }; // La caja se mueve al destino
            nuevoEstado.movimientos += 1;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        const cajasEnObjetivo = new Set();
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            const key = `${caja.fila},${caja.col}`;
            cajasEnObjetivo.add(key);
        }

        for (const objetivo of estado.objetivos) {
            const objectiveKey = `${objetivo.fila},${objetivo.col}`;
            if (!cajasEnObjetivo.has(objectiveKey)) {
                return false; // Al menos un objetivo no está cubierto
            }
        }

        return true; // Todos los objetivos están cubiertos
    }
};
