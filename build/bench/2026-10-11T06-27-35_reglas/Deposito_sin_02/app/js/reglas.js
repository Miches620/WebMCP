const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // Inicializar el mapa limpio (solo paredes, pisos y objetivos)
        let mapaLimpio = nivel.map(fila => fila.split('').filter(char => char !== '@' && char !== '$' && char !== '*')).join('');
        
        // Reconstruir el mapa de strings para mantener la estructura 8x8
        let mapaArray = [];
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    filaActual += ' '; // El jugador ocupa un espacio vacío en el mapa limpio
                } else if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                    // Si es caja, asumimos que su posición base es piso o objetivo si no hay pared
                    filaActual += (nivel[r][c] === '.' ? '.' : ' '); 
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual += '.';
                } else if (char === '#') {
                    filaActual += '#';
                } else { // Espacio vacío o piso normal
                    filaActual += ' ';
                }
            }
            mapaArray.push(filaActual);
        }

        // Ajuste final del mapa para asegurar que solo contiene #, ' ', '.'
        let estado = {
            mapa: mapaArray,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevaPosicionJugador = { ...jugador };

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

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const esValido = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) return false;
            return estado.mapa[r][c] !== '#';
        };

        // Verificar si el jugador puede moverse a la nueva posición (sin cajas delante)
        if (!esValido(nuevaPosicionJugador.fila, nuevaPosicionJugador.col)) {
            return { ...estado }; // Colisión con pared o fuera de límites
        }

        // 2. Verificar si hay una caja en el destino del jugador
        const cajaEnDestino = cajas.some(c => c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (a piso o objetivo)
            let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar el estado
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empujar una caja
            const cajaAEmpujar = cajas.find(c => c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col);

            // Calcular la posición detrás de la caja (destino final)
            let destinoCaja = { ...nuevaPosicionJugador };
            switch (direccion) {
                case "arriba":
                    destinoCaja.fila -= 1;
                    break;
                case "abajo":
                    destinoCaja.fila += 1;
                    break;
                case "izquierda":
                    destinoCaja.col -= 1;
                    break;
                case "derecha":
                    destinoCaja.col += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido y no contiene otra caja
            const puedeEmpujar = (
                esValido(destinoCaja.fila, destinoCaja.col) && // No choca con pared/límite
                !cajas.some(c => c !== cajaAEmpujar && c.fila === destinoCaja.fila && c.col === destinoCaja.col) // No choca con otra caja
            );

            if (puedeEmpujar) {
                // Empuje exitoso: 
                let nuevoEstado = JSON.parse(JSON.stringify(estado));
                nuevoEstado.movimientos += 1;

                // Actualizar posición del jugador
                nuevoEstado.jugador = nuevaPosicionJugador;

                // Actualizar la caja empujada (reemplazarla en el array de cajas)
                const nuevoCajas = cajas.map(c => {
                    if (c === cajaAEmpujar) {
                        return { fila: destinoCaja.fila, col: destinoCaja.col };
                    }
                    return c;
                });
                nuevoEstado.cajas = nuevoCajas;

                return nuevoEstado;
            } else {
                // Empuje fallido (choca con pared o caja)
                return { ...estado }; // Devolver estado sin cambios
            }
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const { cajas, objetivos } = estado;

        if (objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(objectivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está sobre un objetivo
        let todasLasCajasEnObjetivo = cajas.every(caja => {
            return objetivosSet.has(`${caja.fila},${caja.col}`);
        });

        return todasLasCajasEnObjetivo;
    }
};
