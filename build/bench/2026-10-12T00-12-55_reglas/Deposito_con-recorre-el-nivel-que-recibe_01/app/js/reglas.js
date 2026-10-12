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
        let mapaNuevo = [];

        // Primera pasada: identificar posiciones y construir el mapa base
        for (let r = 0; r < filas; r++) {
            mapaNuevo[r] = '';
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

        // Segunda pasada: construir el mapa de solo paredes, pisos y objetivos
        const mapaFinal = [];
        for (let r = 0; r < filas; r++) {
            mapaFinal[r] = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    mapaFinal[r] += '#'; // Pared
                } else if (char === '.') {
                    mapaFinal[r] += '.'; // Objetivo
                } else {
                    // Piso o espacio vacío
                    mapaFinal[r] += ' '; 
                }
            }
        }

        return {
            mapa: mapaFinal,
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    /**
     * Calcula la nueva posición (fila, col) basándose en la dirección.
     * @param {object} pos - Posición actual {fila, col}.
     * @param {string} direccion - Dirección de movimiento ("arriba", "abajo", "izquierda", "derecha").
     * @returns {object|null} Nueva posición o null si está fuera del mapa.
     */
    _getNuevaPosicion: function(pos, direccion) {
        let nuevaFila = pos.fila;
        let nuevaCol = pos.col;

        switch (direccion) {
            case "arriba":
                nuevaFila--;
                break;
            case "abajo":
                nuevaFila++;
                break;
            case "izquierda":
                nuevaCol--;
                break;
            case "derecha":
                nuevaCol++;
                break;
        }

        // Validación de límites (asumiendo que el mapa es rectangular)
        const filas = this.estadoActual ? this.estadoActual.mapa.length : 8;
        const columnas = this.estadoActual ? this.estadoActual.mapa[0].length : 8;

        if (nuevaFila < 0 || nuevaFila >= filas || nuevaCol < 0 || nuevaCol >= columnas) {
            return null; // Fuera de límites
        }
        return { fila: nuevaFila, col: nuevaCol };
    },

    /**
     * Verifica si una posición es válida para moverse (no pared y dentro del mapa).
     * @param {string[]} mapa - El mapa actual.
     * @param {number} r - Fila a verificar.
     * @param {number} c - Columna a verificar.
     * @returns {boolean} True si es un piso o objetivo, false si es pared o fuera de límites.
     */
    _esPosicionValida: function(mapa, r, c) {
        const filas = mapa.length;
        if (r < 0 || r >= filas) return false;
        const columnas = mapa[0].length;
        if (c < 0 || c >= columnas) return false;

        const char = mapa[r][c];
        return char !== '#'; // Solo paredes son inválidas
    },

    /**
     * Intenta mover al jugador o empujar cajas.
     * @param {object} estado - El estado actual del juego.
     * @param {string} direccion - Dirección de movimiento deseada.
     * @returns {object} Un nuevo estado (inmutable) con el movimiento aplicado, o un estado idéntico si falla.
     */
    mover: function(estado, direccion) {
        // 1. Calcular la posición objetivo del jugador
        const nuevaPosJugador = this._getNuevaPosicion(estado.jugador, direccion);

        if (!nuevaPosJugador || !this._esPosicionValida(estado.mapa, nuevaPosJugador.fila, nuevaPosJugador.col)) {
            // Colisión con pared o fuera de límites
            return { ...estado, movimientos: estado.movimientos }; // Retorna estado sin cambios
        }

        let nuevoEstado = { ...estado, movimientos: estado.movimientos };
        let jugadorMueve = false;
        let cajasMovidas = [];
        let nuevaPosCajas = [...estado.cajas];

        // 2. Verificar si la posición objetivo está ocupada por una caja
        const cajaEnDestinoIndices = estado.cajas.map(c => `${c.fila},${c.col}`);
        const destinoOcupadoPorCaja = cajaEnDestinoIndices.includes(`${nuevaPosJugador.fila},${nuevaPosJugador.col}`);

        if (!destinoOcupadoPorCaja) {
            // Caso 1: Movimiento simple (el destino es piso/objetivo)
            nuevoEstado.jugador = nuevaPosJugador;
            nuevoEstado.cajas = [...estado.cajas]; // No hay cajas que mover
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empuje (el destino está ocupado por una caja)

            // Identificar la caja específica en el destino
            const cajaDestino = estado.cajas.find(c => c.fila === nuevaPosJugador.fila && c.col === nuevaPosJugador.col);
            if (!cajaDestino) {
                // Esto no debería pasar si la lógica de detección es correcta, pero por seguridad:
                return { ...estado, movimientos: estado.movimientos }; 
            }

            // Calcular el destino final de la caja (un paso más en la dirección)
            const nuevaPosCajaDestino = this._getNuevaPosicion(cajaDestino, direccion);

            if (!nuevaPosCajaDestino || !this._esPosicionValida(estado.mapa, nuevaPosCajaDestino.fila, nuevaPosCajaDestino.col)) {
                // La caja no puede moverse (pared o límite)
                return { ...estado, movimientos: estado.movimientos }; // No se mueve nada
            }

            // Verificar si el destino final de la caja está libre (no ocupado por otra caja)
            const otroCajaEnDestino = estado.cajas.some(c => 
                c !== cajaDestino && c.fila === nuevaPosCajaDestino.fila && c.col === nuevaPosCajaDestino.col
            );

            if (otroCajaEnDestino) {
                // La caja no puede moverse porque choca con otra caja
                return { ...estado, movimientos: estado.movimientos }; // No se mueve nada
            }

            // ¡Empuje exitoso! Actualizar posiciones
            nuevoEstado.jugador = nuevaPosJugador;
            nuevoEstado.cajas = nuevoEstado.cajas.map(c => {
                if (c === cajaDestino) {
                    return nuevaPosCajaDestino; // La caja se mueve
                }
                return c; // Otras cajas permanecen en su lugar
            });
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
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return true; // Caso trivial

        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Comprobar si cada caja está en un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está sobre un objetivo
            }
        }

        // Si todas las cajas están en objetivos, se gana.
        return true;
    }
};
