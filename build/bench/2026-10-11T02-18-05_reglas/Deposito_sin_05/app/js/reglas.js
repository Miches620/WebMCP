const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (8x8).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // 1. Identificar posiciones iniciales
        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (['$', '*'].includes(char)) {
                    // Las cajas se identifican por su posición inicial en el mapa.
                    // Usamos la coordenada para identificar la caja.
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // 2. Crear el estado base
        return {
            mapa: nivel, // El mapa estático solo contiene paredes y objetivos/piso
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado o el estado original si el movimiento falla.
     */
    mover(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const p = estado.jugador;
        let nuevaPosicionJugador = { ...p };
        let cajaEmpujada = null; // Coordenadas de la caja que se empuja (si aplica)

        // 1. Calcular la posición objetivo del jugador
        switch (direccion) {
            case "arriba":
                nuevaPosicionJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosicionJugador.col += 1;
                break;
        }

        const { fila: p_new_r, col: p_new_c } = nuevaPosicionJugador;

        // Verificar límites y paredes en la posición objetivo del jugador
        if (p_new_r < 0 || p_new_r >= estado.mapa.length ||
            p_new_c < 0 || p_new_c >= estado.mapa[0].length ||
            estado.mapa[p_new_r][p_new_c] === '#') {
            return nuevoEstado; // Colisión con pared o fuera de límites
        }

        // Verificar si la posición objetivo del jugador contiene una caja
        const hayCajaEnDestino = estado.cajas.some(c => c.fila === p_new_r && c.col === p_new_c);

        if (!hayCajaEnDestino) {
            // Caso 1: Movimiento simple (a un espacio vacío o objetivo)
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empujar una caja
            const cajaOriginal = estado.cajas.find(c => c.fila === p_new_r && c.col === p_new_c);

            // Calcular la posición objetivo para la caja (detrás del jugador)
            let nuevaPosicionCaja = { ...cajaOriginal };
            switch (direccion) {
                case "arriba":
                    nuevaPosicionCaja.fila -= 1;
                    break;
                case "abajo":
                    nuevaPosicionCaja.fila += 1;
                    break;
                case "izquierda":
                    nuevaPosicionCaja.col -= 1;
                    break;
                case "derecha":
                    nuevaPosicionCaja.col += 1;
                    break;
            }

            const { fila: b_new_r, col: b_new_c } = nuevaPosicionCaja;

            // Verificar si la caja puede moverse (no choca con pared/límites)
            if (b_new_r < 0 || b_new_r >= estado.mapa.length ||
                b_new_c < 0 || b_new_c >= estado.mapa[0].length ||
                estado.mapa[b_new_r][b_new_c] === '#') {
                return nuevoEstado; // Colisión de la caja con pared o fuera de límites
            }

            // Verificar si el destino de la caja está ocupado por otra caja
            const hayOtraCajaEnDestino = estado.cajas.some(c => 
                (c !== cajaOriginal) && (c.fila === b_new_r && c.col === b_new_c)
            );

            if (hayOtraCajaEnDestino) {
                return nuevoEstado; // Colisión de la caja con otra caja
            }

            // ¡Empuje exitoso! Actualizar el estado
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;

            // Actualizar cajas: remover la vieja posición y añadir la nueva
            let nuevasCajas = [];
            estado.cajas.forEach(c => {
                if (c === cajaOriginal) {
                    nuevasCajas.push({ fila: b_new_r, col: b_new_c }); // Caja movida
                } else {
                    nuevasCajas.push(c); // Otras cajas sin cambios
                }
            });
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Creamos un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Verificamos si cada caja está en una posición que coincide con un objetivo
        let todasCubiertas = true;
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                todasCubiertas = false;
                break;
            }
        }

        return todasCubiertas;
    }
};
