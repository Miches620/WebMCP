const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings (8x8) que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapa = [];

        // 1. Parsear el mapa y encontrar posiciones iniciales
        for (let r = 0; r < nivel.length; r++) {
            let filaString = nivel[r];
            if (!filaString) continue; // Skip if row is undefined or null

            let filaMapa = "";
            for (let c = 0; c < filaString.length; c++) {
                const char = filaString[c];

                if (char === '@') {
                    jugador = { r: r, c: c };
                    filaMapa += ' '; // El jugador no se dibuja en el mapa base
                } else if (char === '$') {
                    cajas.push({ r: r, c: c });
                    filaMapa += ' '; // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivos.push({ r: r, c: c });
                    filaMapa += '.';
                } else if (char === '#') {
                    filaMapa += '#';
                } else { // ' '
                    filaMapa += ' ';
                }
            }
            mapa.push(filaMapa);
        }

        return {
            mapa: mapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado actual según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugador = estado.jugador;
        let nextR = jugador.r;
        let nextC = jugador.c;

        switch (direccion) {
            case "arriba":
                nextR -= 1;
                break;
            case "abajo":
                nextR += 1;
                break;
            case "izquierda":
                nextC -= 1;
                break;
            case "derecha":
                nextC += 1;
                break;
        }

        // --- 1. Comprobar si el movimiento es posible (sin cajas) ---
        if (!Reglas._esValidoMovimiento(estado, nextR, nextC)) {
            return estado; // Movimiento inválido: pared o fuera de límites
        }

        // Si no hay cajas en la posición objetivo, solo movemos al jugador.
        let cajaEnDestino = false;
        for (const caja of estado.cajas) {
            if (caja.r === nextR && caja.c === nextC) {
                cajaEnDestino = true;
                break;
            }
        }

        if (!cajaEnDestino) {
            // Movimiento simple del jugador
            nuevoEstado.jugador = { r: nextR, c: nextC };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // --- 2. Intentar empujar una caja ---

            // Encontrar la caja que está en el destino (nextR, nextC)
            let cajaAEmpujar = estado.cajas.find(c => c.r === nextR && c.c === nextC);

            if (!cajaAEmpujar) {
                // Esto no debería pasar si cajaEnDestino es true, pero por seguridad.
                return estado;
            }

            // Calcular la posición donde irá la caja (detrás del jugador)
            let pushR = nextR;
            let pushC = nextC;

            switch (direccion) {
                case "arriba":
                    pushR -= 1;
                    break;
                case "abajo":
                    pushR += 1;
                    break;
                case "izquierda":
                    pushC -= 1;
                    break;
                case "derecha":
                    pushC += 1;
                    break;
            }

            // Comprobar si el espacio de empuje es válido (no pared, no fuera de límites)
            if (!Reglas._esValidoMovimiento(estado, pushR, pushC)) {
                return estado; // La caja está contra una pared o límite. No se mueve nada.
            }

            // Comprobar si el espacio de empuje contiene otra caja (colisión secundaria)
            let hayOtraCaja = false;
            for (const caja of estado.cajas) {
                if (caja !== cajaAEmpujar && caja.r === pushR && caja.c === pushC) {
                    hayOtraCaja = true;
                    break;
                }
            }

            if (hayOtraCaja) {
                return estado; // La caja está bloqueada por otra caja. No se mueve nada.
            }

            // --- 3. Movimiento exitoso de empuje ---
            nuevoEstado.jugador = { r: nextR, c: nextC };
            nuevoEstado.movimientos += 1;

            // Actualizar la posición de la caja empujada
            let nuevasCajas = estado.cajas.map(c => ({ ...c })); // Clonar el array y los objetos
            for (let i = 0; i < nuevasCajas.length; i++) {
                if (nuevasCajas[i].r === cajaAEmpujar.r && nuevasCajas[i].c === cajaAEmpujar.c) {
                    // Encontramos la caja a empujar, actualizamos su posición
                    nuevasCajas[i] = { r: pushR, c: pushC };
                    break;
                }
            }
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si una posición (r, c) es válida para el movimiento del jugador o la caja.
     * Debe estar dentro de límites y no ser pared ('#').
     * @param {object} estado - El estado actual.
     * @param {number} r - Fila objetivo.
     * @param {number} c - Columna objetivo.
     * @returns {boolean} True si es un movimiento válido, false en caso contrario.
     */
    _esValidoMovimiento: function(estado, r, c) {
        // 1. Chequear límites (8x8)
        if (r < 0 || r > 7 || c < 0 || c > 7) {
            return false;
        }

        // 2. Chequear pared en el mapa base
        if (estado.mapa[r][c] === '#') {
            return false;
        }

        // 3. Chequear si hay una caja en la posición objetivo (solo relevante para movimiento del jugador)
        for (const caja of estado.cajas) {
            if (caja.r === r && caja.c === c) {
                return false; // No se puede mover a donde está una caja, a menos que sea el empuje.
            }
        }

        // Si pasa todas las validaciones, es un espacio libre o objetivo.
        return true;
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return false; // No hay objetivos, no se puede ganar

        const ubicacionesObjetivo = new Set();
        for (const obj of estado.objetivos) {
            ubicacionesObjetivo.add(`${obj.r},${obj.c}`);
        }

        // Verificar que cada caja esté en una ubicación objetivo
        for (const caja of estado.cajas) {
            if (!ubicacionesObjetivo.has(`${caja.r},${caja.c}`)) {
                return false;
            }
        }

        // Si todas las cajas están sobre objetivos, el nivel está ganado.
        return true;
    }
};
