const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // Inicializar el mapa base (solo paredes, pisos y objetivos estáticos)
        const mapaBase = nivel.map(fila => fila.split(''));

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const tile = nivel[r][c];
                if (tile === '@') {
                    jugador = { fila: r, col: c };
                } else if (tile === '$' || tile === '*') {
                    // Las cajas se registran por su posición. El mapa base solo lleva el piso/objetivo.
                    cajas.push({ fila: r, col: c });
                } else if (tile === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // Limpiar el mapa base de elementos dinámicos para que solo queden '#', ' ', '.'
        const mapa = nivel.map(fila => 
            Array.from(fila).map(char => {
                if (char === '@' || char === '$' || char === '*') return ' '; // El jugador y las cajas no se dibujan en el mapa base
                return char;
            }).join('')
        );

        return {
            mapa: mapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
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
        const p = estado.jugador;
        let nuevaPosicionJugador = { ...p };

        // 1. Calcular la posición objetivo del jugador (P_new)
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

        // Función auxiliar para verificar si una posición está dentro del mapa y no es pared
        const isValidTile = (r, c) => {
            if (r < 0 || r >= 9 || c < 0 || c >= 9) return false; // Fuera de límites
            return estado.mapa[r][c] !== '#'; // No es pared
        };

        // Verificar si el movimiento del jugador es posible en un espacio vacío o objetivo
        if (!isValidTile(nuevaPosicionJugador.fila, nuevaPosicionJugador.col)) {
            return { ...estado }; // Colisión con pared/límite
        }

        let cajaAEmpujar = null;
        let indiceCajaAEmpujar = -1;

        // 2. Verificar si la posición objetivo está ocupada por una caja
        for (let i = 0; i < estado.cajas.length; i++) {
            const c = estado.cajas[i];
            if (c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col) {
                cajaAEmpujar = c;
                indiceCajaAEmpujar = i;
                break;
            }
        }

        // 3. Manejar el movimiento
        let nuevoEstado = { ...estado }; // Copia superficial para empezar a modificar
        nuevoEstado.movimientos = estado.movimientos;
        let cajasNuevas = [...estado.cajas];
        let jugadorNuevo = { ...p };

        if (cajaAEmpujar) {
            // Intentar empujar la caja
            const posCajaNext = { 
                fila: nuevaPosicionJugador.fila + (direccion === "abajo" ? 1 : direccion === "arriba" ? -1 : 0),
                col: nuevaPosicionJugador.col + (direccion === "derecha" ? 1 : direccion === "izquierda" ? -1 : 0)
            };

            // Verificar si el espacio detrás de la caja es válido y no está ocupado por otra caja
            const isNextValid = isValidTile(posCajaNext.fila, posCajaNext.col);
            let collisionWithOtherBox = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCajaAEmpujar && estado.cajas[i].fila === posCajaNext.fila && estado.cajas[i].col === posCajaNext.col) {
                    collisionWithOtherBox = true;
                    break;
                }
            }

            if (isNextValid && !collisionWithOtherBox) {
                // ¡Empuje exitoso!
                nuevoEstado.movimientos += 1;
                
                // Actualizar caja: la caja se mueve a posCajaNext
                cajasNuevas[indiceCajaAEmpujar] = { ...cajaAEmpujar, fila: posCajaNext.fila, col: posCajaNext.col };

                // Actualizar jugador: el jugador va donde estaba la caja
                jugadorNuevo = { ...nuevaPosicionJugador }; 
                nuevoEstado.jugador = jugadorNuevo;
                nuevoEstado.cajas = cajasNuevas;

            } else {
                // Empuje fallido (pared o otra caja)
                return { ...estado }; // Devolver estado original
            }
        } else {
            // Movimiento simple (a un espacio vacío/objetivo)
            nuevoEstado.movimientos += 1;
            nuevoEstado.jugador = jugadorNuevo;
            // Las cajas no cambian, solo se actualiza el estado general
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un cantero objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        const cajasEnObjetivo = new Set();
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            // Verificar si la posición de la caja coincide con alguna posición objetivo
            if (estado.objetivos.some(obj => obj.fila === caja.fila && obj.col === caja.col)) {
                cajasEnObjetivo.add(`${caja.fila},${caja.col}`);
            }
        }

        // Si el número de cajas en objetivos es igual al total de objetivos, se ha ganado.
        return cajasEnObjetivo.size === estado.objetivos.length;
    }
};
