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

        // El mapa en el estado solo debe contener '#', ' ', '.'
        // Reemplazamos @ y $ por un espacio para mantener la estructura del tablero.
        const mapaLimpiado = nivel.map(fila => fila.replace(/[@$]/g, ' '));

        return {
            mapa: mapaLimpiado,
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado o el estado original si el movimiento es inválido.
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaPosJugador = { ...jugador };

        // 1. Calcular la posición objetivo del jugador (P_new)
        switch (direccion) {
            case "arriba":
                nuevaPosJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosJugador.col += 1;
                break;
        }

        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        // Validación de límites y paredes para P_new
        if (nuevaPosJugador.fila < 0 || nuevaPosJugador.fila >= filas ||
            nuevaPosJugador.col < 0 || nuevaPosJugador.col >= columnas) {
            return { ...estado }; // Fuera de límites
        }

        // Verificar si P_new es una pared
        if (estado.mapa[nuevaPosJugador.fila][nuevaPosJugador.col] === '#') {
            return { ...estado }; // Colisión con pared
        }

        // 2. Comprobar colisiones en P_new
        const cajaEnPNew = estado.cajas.some(c => c.fila === nuevaPosJugador.fila && c.col === nuevaPosJugador.col);

        if (!cajaEnPNew) {
            // Caso 1: Movimiento simple (a un espacio vacío o objetivo)
            const nuevoEstado = {
                ...estado,
                jugador: nuevaPosJugador,
                movimientos: estado.movimientos + 1
            };
            return nuevoEstado;

        } else {
            // Caso 2: Intento de empujar una caja (B)
            const cajaAEmpujar = estado.cajas.find(c => c.fila === nuevaPosJugador.fila && c.col === nuevaPosJugador.col);
            let posCajaOriginal = { ...cajaAEmpujar };

            // Calcular la posición objetivo de la caja (B_target)
            let posObjetivoCaja = { ...posCajaOriginal };
            switch (direccion) {
                case "arriba":
                    posObjetivoCaja.fila -= 1;
                    break;
                case "abajo":
                    posObjetivoCaja.fila += 1;
                    break;
                case "izquierda":
                    posObjetivoCaja.col -= 1;
                    break;
                case "derecha":
                    posObjetivoCaja.col += 1;
                    break;
            }

            // Validación de B_target: Límites, Paredes o Colisión con otra caja
            if (posObjetivoCaja.fila < 0 || posObjetivoCaja.fila >= filas ||
                posObjetivoCaja.col < 0 || posObjetivoCaja.col >= columnas) {
                return { ...estado }; // B_target fuera de límites
            }

            if (estado.mapa[posObjetivoCaja.fila][posObjetivoCaja.col] === '#') {
                return { ...estado }; // B_target contra pared
            }

            // Verificar si hay otra caja en B_target
            const colisionOtraCaja = estado.cajas.some(c => 
                c !== cajaAEmpujar && c.fila === posObjetivoCaja.fila && c.col === posObjetivoCaja.col
            );

            if (colisionOtraCaja) {
                return { ...estado }; // B_target contra otra caja
            }

            // Movimiento exitoso de empuje:
            const nuevoEstado = {
                ...estado,
                jugador: nuevaPosJugador,
                movimientos: estado.movimientos + 1,
                cajas: estado.cajas.map(c => {
                    if (c === cajaAEmpujar) {
                        return posObjetivoCaja; // Mover la caja empujada
                    }
                    return c; // Dejar el resto de cajas quietas
                })
            };

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
ganado: function(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0 || cajas.length === 0) {
            return false; // No hay nada que cubrir o no hay macetas
        }

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(objetivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está sobre un objetivo
        let cubiertas = 0;
        for (const caja of cajas) {
            if (objetivosSet.has(`${caja.fila},${caja.col}`)) {
                cubiertas++;
            }
        }

        // El nivel se supera si el número de macetas sobre objetivos es igual al total de objetivos.
        return cubiertas === objetivos.length;
    }
};
