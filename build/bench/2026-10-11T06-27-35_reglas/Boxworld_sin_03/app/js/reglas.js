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
        let mapaBase = [];

        for (let r = 0; r < nivel.length; r++) {
            let filaActual = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    filaActual.push(' '); // El jugador ocupa un espacio vacío en el mapa base
                } else if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                    filaActual.push(' '); // La caja no afecta la estructura del piso base
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual.push('.');
                } else if (char === '#') {
                    filaActual.push('#');
                } else {
                    // Espacio vacío ' '
                    filaActual.push(' ');
                }
            }
            mapaBase.push(filaActual.join(''));
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
     * Mueve el estado del juego según la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada de movimiento.
     * @returns {object} Un nuevo estado inmutable, o el estado original si el movimiento es imposible.
     */
    mover: function(estado, direccion) {
        const jugadorActual = estado.jugador;
        let nuevaPosicionJugador = { ...jugadorActual };

        // 1. Calcular la posición objetivo del jugador (P_next)
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

        const { fila: r_next, col: c_next } = nuevaPosicionJugador;

        // Validación de límites y paredes en P_next
        if (r_next < 0 || r_next >= estado.mapa.length || 
            c_next < 0 || c_next >= estado.mapa[0].length || 
            estado.mapa[r_next][c_next] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // No se mueve si choca con pared o límite
        }

        // 2. Verificar colisión con cajas en P_next
        const cajaEnPNext = estado.cajas.some(c => c.fila === r_next && c.col === c_next);

        if (!cajaEnPNext) {
            // Caso A: Movimiento simple (a piso o objetivo vacío)
            return {
                ...estado,
                jugador: nuevaPosicionJugador,
                movimientos: estado.movimientos + 1
            };
        } else {
            // Caso B: Intento de empujar una caja
            const cajaAEmpujar = estado.cajas.find(c => c.fila === r_next && c.col === c_next);

            let nuevaPosicionCaja = { ...cajaAEmpujar };
            
            // Calcular la posición donde irá la caja (P_push)
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

            const { fila: r_push, col: c_push } = nuevaPosicionCaja;

            // Validación de P_push: Debe estar dentro del mapa y no ser pared/caja (excepto la caja que se mueve)
            if (r_push < 0 || r_push >= estado.mapa.length || 
                c_push < 0 || c_push >= estado.mapa[0].length || 
                estado.mapa[r_push][c_push] === '#') {
                return { ...estado, movimientos: estado.movimientos }; // No se puede empujar (choca con pared)
            }

            // Verificar si P_push está ocupado por otra caja o el jugador (solo cajas son relevantes aquí)
            const hayOtraCajaEnPPush = estado.cajas.some(c => 
                !(c.fila === r_next && c.col === c_next) && // Excluir la caja que estamos moviendo
                c.fila === r_push && c.col === c_push
            );

            if (hayOtraCajaEnPPush) {
                return { ...estado, movimientos: estado.movimientos }; // No se puede empujar (choca con otra caja)
            }

            // Empuje exitoso: 
            // 1. El jugador va a P_next.
            // 2. La caja va a P_push.
            const nuevasCajas = estado.cajas.map(c => {
                if (c.fila === r_next && c.col === c_next) {
                    return { fila: r_push, col: c_push }; // Mover esta caja
                }
                return c; // Dejar el resto de cajas quietas
            });

            // Asegurarse de que la lista de cajas sea inmutablemente actualizada
            const nuevasCajasEstado = [...cajasAEmpujar.map(c => {
                if (c.fila === r_next && c.col === c_next) {
                    return { fila: r_push, col: c_push };
                }
                return c;
            })];


            return {
                ...estado,
                jugador: nuevaPosicionJugador,
                cajas: nuevasCajasEstado,
                movimientos: estado.movimientos + 1
            };
        }
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        const cajasEnObjetivo = estado.cajas.filter(c => {
            return estado.objetivos.some(o => o.fila === c.fila && o.col === c.col);
        });

        // Si el número de cajas en objetivo es igual al total de objetivos, se ha ganado.
        const objetivosCubiertos = new Set(cajasEnObjetivo.map(c => `${c.fila},${c.col}`));
        const objetivosEsperados = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Comparamos si el set de posiciones cubiertas es igual al set de posiciones objetivo
        if (objectivosCubiertos.size !== objetivosEsperados.size) {
            return false;
        }

        for (const obj of estado.objetivos) {
            let encontrado = false;
            for (const caja of estado.cajas) {
                if (caja.fila === obj.fila && caja.col === obj.col) {
                    encontrado = true;
                    break;
                }
            }
            if (!encontrado) {
                return false;
            }
        }

        return true;
    }
};
