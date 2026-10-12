const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (8x8).
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaTemporalArray = []; 

        for (let r = 0; r < nivel.length; r++) {
            let currentRowChars = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];

                if (char === '@') {
                    jugador = { fila: r, col: c };
                    currentRowChars.push(' '); // Player spot becomes empty space in state map
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    currentRowChars.push(' '); // Box spot becomes empty space in state map
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    currentRowChars.push('.'); // Objective remains '.'
                } else {
                    // Includes '#', ' ', etc., which are kept as is for the base map structure
                    currentRowChars.push(char);
                }
            }
            mapaTemporalArray.push(currentRowChars.join(''));
        }

        return {
            mapa: mapaTemporalArray, // Contiene solo '#', ' ', '.'
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
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;

        // Definición de direcciones (dr: cambio en fila, dc: cambio en columna)
        let dr, dc;
        switch (direccion) {
            case "arriba":
                dr = -1; dc = 0; break;
            case "abajo":
                dr = 1; dc = 0; break;
            case "izquierda":
                dr = 0; dc = -1; break;
            case "derecha":
                dr = 0; dc = 1; break;
        }

        // Posición objetivo del jugador (P_new)
        const pNewFila = jugador.fila + dr;
        const pNewCol = jugador.col + dc;

        // 1. Validación de límites y paredes en P_new
        if (pNewFila < 0 || pNewFila >= 8 || pNewCol < 0 || pNewCol >= 8) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites
        }

        // Verificar si la nueva posición es una pared en el mapa base (solo '#')
        if (estado.mapa[pNewFila][pNewCol] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
        }

        let nuevoEstado = { ...estado, movimientos: estado.movimientos };
        let cajasNuevas = JSON.parse(JSON.stringify(cajas));
        let jugadorNuevo = { ...jugador };

        // 2. Verificar colisiones en P_new
        const cajaEnPNew = cajas.some(c => c.fila === pNewFila && c.col === pNewCol);

        if (!cajaEnPNew) {
            // Caso A: Movimiento simple (a espacio o objetivo)
            jugadorNuevo = { fila: pNewFila, col: pNewCol };
            nuevoEstado.jugador = jugadorNuevo;
            nuevoEstado.movimientos += 1;

        } else {
            // Caso B: Intento de empujar una caja
            const cajaAEmpujarIndex = cajas.findIndex(c => c.fila === pNewFila && c.col === pNewCol);
            if (cajaAEmpujarIndex === -1) return estado; // No debería pasar

            // Posición objetivo de la caja (B_new)
            const bNewFila = pNewFila + dr;
            const bNewCol = pNewCol + dc;

            // Validación del empuje:
            // 1. ¿Está fuera de límites?
            if (bNewFila < 0 || bNewFila >= 8 || bNewCol < 0 || bNewCol >= 8) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje contra borde
            }

            // 2. ¿Es pared en B_new?
            if (estado.mapa[bNewFila][bNewCol] === '#') {
                return { ...estado, movimientos: estado.movimientos }; // Empuje contra pared
            }

            // 3. ¿Está ocupado por otra caja o el jugador en B_new?
            const colisionBox = cajas.some((c, index) => index !== cajaAEmpujarIndex && c.fila === bNewFila && c.col === bNewCol);
            const colisionPlayer = (bNewFila === jugador.fila && bNewCol === jugador.col); // No debería pasar si el jugador se mueve primero

            if (colisionBox || colisionPlayer) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje contra otra caja/jugador
            }

            // ¡Empuje exitoso! Actualizar estados
            nuevoEstado.movimientos += 1;
            jugadorNuevo = { fila: pNewFila, col: pNewCol };

            // Crear la nueva lista de cajas (caja empujada se mueve)
            cajasNuevas = [...cajas];
            const cajaEmpujada = cajasNuevas[cajaAEmpujarIndex];
            cajaEmpujada.fila = bNewFila;
            cajaEmpujada.col = bNewCol;

            nuevoEstado.cajas = cajasNuevas;
            nuevoEstado.jugador = jugadorNuevo;
        }

        // Devolver el nuevo estado inmutable
        return { ...estado, movimientos: nuevoEstado.movimientos, caja: nuevoEstado.cajas, jugador: nuevoEstado.jugador };
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        const { objetivos, cajas } = estado;

        if (objetivos.length === 0) return true; // Caso borde sin objetivos

        // Para cada objetivo, debe haber al menos una caja encima.
        return objetivos.every(obj => {
            return cajas.some(caja => caja.fila === obj.fila && caja.col === obj.col);
        });
    }
};
