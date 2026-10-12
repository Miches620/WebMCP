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
        let cajasArray = [];
        let objetivosArray = [];

        // Recorrer el mapa para identificar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasArray.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosArray.push({ fila: r, col: c });
                }
            }
        }

        // El mapa en el estado solo debe contener '#', ' ', '.'
        const mapaLimpio = nivel.map(fila => fila.replace(/[@\$]/g, ''));

        return {
            mapa: mapaLimpio,
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set();
        estado.objetivos.forEach(obj => objectivesSet.add(`${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objectivosSet.has(`${caja.fila},${caja.col}`)) {
                return false;
            }
        }
        return true;
    },

    /**
     * Intenta mover al jugador en la dirección dada, manejando colisiones y empujes de cajas.
     * @param {object} estado - El estado actual del juego (se usa como base).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento posible.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad antes de cualquier cambio
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        let nuevaFilaJugador = jugadorActual.fila;
        let nuevaColJugador = jugadorActual.col;

        switch (direccion) {
            case "arriba":
                nuevaFilaJugador -= 1;
                break;
            case "abajo":
                nuevaFilaJugador += 1;
                break;
            case "izquierda":
                nuevaColJugador -= 1;
                break;
            case "derecha":
                nuevaColJugador += 1;
                break;
        }

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const esValido = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            // Pared o fuera del mapa
            return estado.mapa[r][c] !== '#';
        };

        // Verificar si el movimiento básico es posible (paredes/límites)
        if (!esValido(nuevaFilaJugador, nuevaColJugador)) {
            return nuevoEstado; // No se mueve nada
        }

        // 2. Comprobar colisión con cajas en la posición objetivo del jugador
        const cajaEnDestino = nuevasCajas.find(caja => caja.fila === nuevaFilaJugador && caja.col === nuevaColJugador);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (sin cajas en el destino)
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            return nuevoEstado; // Solo actualizamos la posición del jugador
        } else {
            // Caso 2: Intento de empujar una caja
            const cajaDestino = cajaEnDestino;

            let nuevaFilaCaja = cajaDestino.fila;
            let nuevaColCaja = cajaDestino.col;

            // Calcular la posición donde debe ir la caja (detrás del jugador)
            switch (direccion) {
                case "arriba":
                    nuevaFilaCaja -= 1;
                    break;
                case "abajo":
                    nuevaFilaCaja += 1;
                    break;
                case "izquierda":
                    nuevaColCaja -= 1;
                    break;
                case "derecha":
                    nuevaColCaja += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido (no pared, no fuera de límites)
            if (!esValido(nuevaFilaCaja, nuevaColCaja)) {
                return nuevoEstado; // La caja está bloqueada por una pared o límite. No se mueve nada.
            }

            // Verificar si el destino de la caja está ocupado por otra caja (colisión múltiple)
            const hayOtraCaja = nuevasCajas.some(c => 
                c !== cajaDestino && c.fila === nuevaFilaCaja && c.col === nuevaColCaja
            );

            if (hayOtraCaja) {
                return nuevoEstado; // La caja está bloqueada por otra caja. No se mueve nada.
            }

            // Movimiento exitoso de empuje:
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            nuevoEstado.movimientos += 1;

            // Actualizar la posición de la caja en el nuevo estado
            const indexCaja = nuevasCajas.findIndex(c => c === cajaDestino);
            if (indexCaja !== -1) {
                nuevasCajas[indexCaja] = { fila: nuevaFilaCaja, col: nuevaColCaja };
            }

            nuevoEstado.cajas = nuevasCajas;
            return nuevoEstado;
        }
    }
};
