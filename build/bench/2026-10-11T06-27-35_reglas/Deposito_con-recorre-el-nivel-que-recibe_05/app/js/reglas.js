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

        // 1. Identificar posiciones clave y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
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

        // 2. Crear el mapa base para el estado interno (solo #, ' ', '.')
        let mapaBase = [];
        for (let r = 0; r < nivel.length; r++) {
            let filaString = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaString += '#';
                } else if (char === '.' || char === ' ' || char === '@' || char === '$') {
                    // Usamos espacio para piso, y mantenemos el objetivo si está en la posición inicial.
                    // El dibujo se encargará de diferenciarlo.
                    filaString += (char === '.') ? '.' : ' ';
                } else {
                    filaString += ' '; // Por seguridad
                }
            }
            mapaBase.push(filaString);
        }

        return {
            mapa: mapaBase,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado inmutable, o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar la inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const direcciones = {
            "arriba": { dr: -1, dc: 0 },
            "abajo": { dr: 1, dc: 0 },
            "izquierda": { dr: 0, dc: -1 },
            "derecha": { dr: 0, dc: 1 }
        };

        const delta = direcciones[direccion];
        if (!delta) return estado;

        let jugadorActual = estado.jugador;
        let nuevaPosicionJugador = {
            fila: jugadorActual.fila + delta.dr,
            col: jugadorActual.col + delta.dc
        };

        // 1. Comprobar si el movimiento es posible (dentro de límites y no en pared)
        const maxFilas = estado.mapa.length;
        const maxCols = estado.mapa[0].length;

        if (nuevaPosicionJugador.fila < 0 || nuevaPosicionJugador.fila >= maxFilas ||
            nuevaPosicionJugador.col < 0 || nuevaPosicionJugador.col >= maxCols) {
            return estado; // Fuera de límites
        }

        // Verificar si la casilla destino es una pared (usando el mapa base)
        if (estado.mapa[nuevaPosicionJugador.fila][nuevaPosicionJugador.col] === '#') {
            return estado; // Colisión con pared
        }

        let cajaAEmpujar = null;
        let indiceCaja = -1;

        // 2. Verificar si el destino es una caja
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === nuevaPosicionJugador.fila && caja.col === nuevaPosicionJugador.col) {
                cajaAEmpujar = caja;
                indiceCaja = i;
                break;
            }
        }

        // 3. Caso: Empuje de Caja (Pushing)
        if (cajaAEmpujar) {
            let nuevaPosicionCaja = {
                fila: cajaAEmpujar.fila + delta.dr,
                col: cajaAEmpujar.col + delta.dc
            };

            // Comprobar si la casilla destino de la caja es válida (no pared y no otra caja)
            if (nuevaPosicionCaja.fila < 0 || nuevaPosicionCaja.fila >= maxFilas ||
                nuevaPosicionCaja.col < 0 || nuevaPosicionCaja.col >= maxCols) {
                return estado; // Caja fuera de límites
            }

            // Verificar si la casilla destino está en una pared o es ocupada por otra caja
            if (estado.mapa[nuevaPosicionCaja.fila][nuevaPosicionCaja.col] === '#') {
                return estado; // Colisión con pared al empujar
            }

            let colisionConOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCaja && estado.cajas[i].fila === nuevaPosicionCaja.fila && estado.cajas[i].col === nuevaPosicionCaja.col) {
                    colisionConOtraCaja = true;
                    break;
                }
            }

            if (colisionConOtraCaja) {
                return estado; // Colisión con otra caja al empujar
            }

            // Movimiento exitoso de la caja y el jugador
            nuevoEstado.cajas[indiceCaja] = nuevaPosicionCaja;
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1; // Solo incrementa al empujar con éxito

        } else {
            // 4. Caso: Movimiento simple (sin cajas)
            nuevoEstado.jugador = nuevaPosicionJugador;
            // Los movimientos no cambian en un movimiento simple, solo si se empuja.
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre los objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        for (const objetivo of estado.objetivos) {
            let cajaEnObjetivo = false;
            for (const caja of estado.cajas) {
                if (caja.fila === objetivo.fila && caja.col === objetivo.col) {
                    cajaEnObjetivo = true;
                    break;
                }
            }
            if (!cajaEnObjetivo) {
                return false; // Al menos un objetivo no tiene caja encima
            }
        }
        return true; // Todos los objetivos tienen una caja
    }
};
