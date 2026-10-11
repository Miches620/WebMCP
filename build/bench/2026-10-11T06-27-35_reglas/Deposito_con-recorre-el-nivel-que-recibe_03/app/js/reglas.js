const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let nuevoMapa = [];

        for (let r = 0; r < nivel.length; r++) {
            let filaActual = nivel[r];
            let nuevaFila = '';

            for (let c = 0; c < filaActual.length; c++) {
                const char = filaActual[c];
                let tipoMapa = ' '; // Por defecto, es piso vacío

                if (char === '#') {
                    tipoMapa = '#';
                } else if (char === '.') {
                    // Los objetivos siempre son puntos en el mapa base.
                    tipoMapa = '.';
                    objetivos.push({ fila: r, col: c });
                } else if (char === '@') {
                    jugador = { fila: r, col: c };
                    tipoMapa = ' '; // El jugador ocupa un espacio vacío en el mapa base
                } else if (char === '$' || char === '*') {
                    // Las cajas se detectan por su símbolo inicial.
                    cajas.push({ fila: r, col: c });
                    tipoMapa = ' '; // La caja ocupa un espacio vacío en el mapa base
                } else if (char === ' ') {
                    tipoMapa = ' ';
                }

                nuevaFila += tipoMapa;
            }
            nuevoMapa.push(nuevaFila);
        }

        // Aseguramos que las cajas y objetivos no se superpongan en la inicialización del mapa, 
        // solo necesitamos el estado base de paredes/pisos/objetivos.
        return {
            mapa: nuevoMapa,
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
     * @returns {object} Un nuevo estado inmutable, o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        let { jugador, cajas, movimientos } = estado;

        // 1. Calcular la posición objetivo del jugador (P_new)
        let pNew = { ...jugador };
        switch (direccion) {
            case "arriba":
                pNew.fila -= 1;
                break;
            case "abajo":
                pNew.fila += 1;
                break;
            case "izquierda":
                pNew.col -= 1;
                break;
            case "derecha":
                pNew.col += 1;
                break;
        }

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const isValidPos = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            // Si el mapa base tiene una pared en esa posición, es inválido.
            if (estado.mapa[r][c] === '#') {
                return false;
            }
            return true;
        };

        // 2. Verificar si P_new está fuera de límites o contra una pared
        if (!isValidPos(pNew.fila, pNew.col)) {
            return { ...estado, movimientos: movimientos }; // No hay cambio
        }

        // 3. Comprobar colisión con cajas
        const cajaEnPNew = cajas.some(c => c.fila === pNew.fila && c.col === pNew.col);

        if (!cajaEnPNew) {
            // Caso A: Movimiento simple (a piso o objetivo)
            let nuevoEstado = { ...estado, movimientos: movimientos + 1 };
            nuevoEstado.jugador = pNew;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empuje
            const cajaAEmpujar = cajas.find(c => c.fila === pNew.fila && c.col === pNew.col);

            let boxTarget = { ...cajaAEmpujar }; // Posición donde irá la caja
            switch (direccion) {
                case "arriba":
                    boxTarget.fila -= 1;
                    break;
                case "abajo":
                    boxTarget.fila += 1;
                    break;
                case "izquierda":
                    boxTarget.col -= 1;
                    break;
                case "derecha":
                    boxTarget.col += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido (no pared, no fuera de límites)
            if (!isValidPos(boxTarget.fila, boxTarget.col)) {
                return { ...estado, movimientos: movimientos }; // Empuje fallido por pared/límite
            }

            // Verificar si el destino de la caja está ocupado por otra caja (y no es su propia posición)
            const hayOtraCajaEnDestino = cajas.some(c => 
                (c !== cajaAEmpujar) && 
                (c.fila === boxTarget.fila && c.col === boxTarget.col)
            );

            if (hayOtraCajaEnDestino) {
                return { ...estado, movimientos: movimientos }; // Empuje fallido por otra caja
            }

            // Éxito en el empuje
            let nuevoEstado = { ...estado, movimientos: movimientos + 1 };
            nuevoEstado.jugador = pNew;
            
            // Actualizar cajas: reemplazar la posición antigua de la caja por la nueva
            const nuevasCajas = cajas.map(c => {
                if (c.fila === cajaAEmpujar.fila && c.col === cajaAEmpujar.col) {
                    return boxTarget; // Esta es la caja que se movió
                }
                return c; // Otras cajas permanecen igual
            });
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        const cajaCoords = new Set(estado.cajas.map(c => `${c.fila},${c.col}`));

        for (const objetivo of estado.objetivos) {
            const coordObjetivo = `${objetivo.fila},${objetivo.col}`;
            if (!cajaCoords.has(coordObjetivo)) {
                return false; // Al menos un objetivo no tiene caja encima
            }
        }
        return true; // Todos los objetivos tienen una caja encima
    }
};
