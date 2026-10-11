const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - El mapa del nivel (array de strings 9x9).
     * @returns {object} Estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // Inicializar el mapa sin jugadores ni cajas, solo paredes y pisos/objetivos.
        const mapaInicial = nivel.map(fila => 
            fila.replace(/@/g, ' ').replace(/\$/g, ' ')
        );

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
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

        return {
            mapa: mapaInicial,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado que refleja el movimiento o la falta de él.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugadorPos = estado.jugador;
        let nuevaFila = jugadorPos.fila;
        let nuevaCol = jugadorPos.col;

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

        // 1. Verificar límites y paredes en la posición objetivo del jugador (sin considerar cajas)
        if (nuevaFila < 0 || nuevaFila >= 9 || nuevaCol < 0 || nuevaCol >= 9 || estado.mapa[nuevaFila][nuevaCol] === '#') {
            return nuevoEstado; // Colisión con pared o límite, no se mueve nada.
        }

        // 2. Verificar si la posición objetivo está ocupada por una caja
        const hayCajaEnDestino = estado.cajas.some(c => c.fila === nuevaFila && c.col === nuevaCol);

        if (!hayCajaEnDestino) {
            // Movimiento simple (a piso o objetivo vacío)
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            return nuevoEstado;
        } else {
            // Intentar empujar una caja
            const cajaAEmpujar = estado.cajas.find(c => c.fila === nuevaFila && c.col === nuevaCol);

            let destinoCajaFila = nuevaFila;
            let destinoCajaCol = nuevaCol;

            // Calcular la posición detrás de la caja (donde debe ir el empuje)
            switch (direccion) {
                case "arriba":
                    destinoCajaFila -= 1;
                    break;
                case "abajo":
                    destinoCajaFila += 1;
                    break;
                case "izquierda":
                    destinoCajaCol -= 1;
                    break;
                case "derecha":
                    destinoCajaCol += 1;
                    break;
            }

            // Verificar si el destino del empuje es válido (dentro de límites, no pared, y no ocupado por otra caja)
            const esValidoDestino = (
                destinoCajaFila >= 0 && destinoCajaFila < 9 &&
                destinoCajaCol >= 0 && destinoCajaCol < 9 &&
                estado.mapa[destinoCajaFila][destinoCajaCol] !== '#' &&
                !estado.cajas.some(c => c !== cajaAEmpujar && c.fila === destinoCajaFila && c.col === destinoCajaCol)
            );

            if (esValidoDestino) {
                // ¡Movimiento exitoso de empuje!
                nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
                nuevoEstado.movimientos += 1;

                // Actualizar la posición de la caja en el nuevo estado
                const nuevasCajas = estado.cajas.map(c => {
                    if (c === cajaAEmpujar) {
                        return { fila: destinoCajaFila, col: destinoCajaCol };
                    }
                    return c;
                });
                nuevoEstado.cajas = nuevasCajas;

                return nuevoEstado;
            } else {
                // El empuje falla (pared o caja bloqueada), no se mueve nada.
                return nuevoEstado;
            }
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(state.objetivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas fueron revisadas y están sobre objetivos, se ganó.
        return true;
    }
};
