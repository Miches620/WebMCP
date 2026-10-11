const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel raw (array de strings).
     * @param {string[]} nivel - El mapa del nivel en formato array de strings.
     * @returns {object} Estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // 1. Identificar posiciones clave y construir el mapa base (sin jugadores ni cajas marcadas)
        const mapaBase = nivel.map(fila => fila.split(''));

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // 2. Limpiar el mapa base para que solo contenga '#', ' ', '.'
        const mapaFinal = nivel.map(fila => {
            let nuevaFila = '';
            for (let i = 0; i < fila.length; i++) {
                const char = fila[i];
                if (char === '#' || char === ' ' || char === '.') {
                    nuevaFila += char;
                } else {
                    // Reemplaza cualquier marcador de jugador/caja con espacio vacío para el mapa base
                    nuevaFila += ' '; 
                }
            }
            return nuevaFila;
        });


        return {
            mapa: mapaFinal,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si el movimiento es inválido.
     */
    mover(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevaPosicionJugador = { ...jugadorActual };
        let movimientoValido = false;

        // Definición de cambios de coordenadas por dirección: [dr, dc]
        const direccionesCambio = {
            "arriba": [-1, 0],
            "abajo": [1, 0],
            "izquierda": [0, -1],
            "derecha": [0, 1]
        };

        let [dr, dc] = direccionesCambio[direccion];
        let posDestinoJugador = { fila: jugadorActual.fila + dr, col: jugadorActual.col + dc };

        // --- 1. Validación de límites y paredes (Paredes son '#' en el mapa base) ---
        if (posDestinoJugador.fila < 0 || posDestinoJugador.fila >= 10 ||
            posDestinoJugador.col < 0 || posDestinoJugador.col >= 10) {
            return estado; // Fuera de límites
        }

        // Verificar si el destino del jugador es una pared en el mapa base
        if (estado.mapa[posDestinoJugador.fila][posDestinoJugador.col] === '#') {
            return estado; 
        }


        // --- 2. Comprobar colisión con cajas ---
        let cajaColision = null;
        for (const caja of estado.cajas) {
            if (caja.fila === posDestinoJugador.fila && caja.col === posDestinoJugador.col) {
                cajaColision = caja;
                break;
            }
        }

        // Caso A: No hay colisión con cajas, movimiento simple
        if (!cajaColision) {
            nuevaPosicionJugador = posDestinoJugador;
            movimientoValido = true;
        } 
        // Caso B: Hay colisión con una caja (Intentando empujar)
        else {
            let cajaAEmpujar = cajaColision;
            let posDestinoCaja = { fila: cajaAEmpujar.fila + dr, col: cajaAEmpujar.col + dc };

            // 2.1 Validación de la pared detrás de la caja (el destino final de la caja)
            if (posDestinoCaja.fila < 0 || posDestinoCaja.fila >= 10 ||
                posDestinoCaja.col < 0 || posDestinoCaja.col >= 10) {
                return estado; // La caja está contra el borde del mapa
            }

            // Verificar si la pared detrás de la caja es una pared en el mapa base
            if (estado.mapa[posDestinoCaja.fila][posDestinoCaja.col] === '#') {
                return estado; // No se puede empujar, hay pared detrás
            }

            // 2.2 Validación de colisión secundaria: ¿Hay otra caja en el destino final?
            let collisionSecondary = false;
            for (const caja of estado.cajas) {
                if (caja !== cajaAEmpujar && caja.fila === posDestinoCaja.fila && caja.col === posDestinoCaja.col) {
                    collisionSecondary = true;
                    break;
                }
            }

            if (collisionSecondary) {
                return estado; // No se puede empujar, hay otra caja en el camino
            }

            // Movimiento de Empuje Válido:
            nuevaPosicionJugador = posDestinoJugador;
            movimientoValido = true;

            // Actualizar la posición de la caja que fue empujada
            const indexCaja = estado.cajas.findIndex(c => c.fila === cajaAEmpujar.fila && c.col === cajaAEmpujar.col);
            if (indexCaja !== -1) {
                nuevaCajas[indexCaja] = posDestinoCaja;
            }
        }

        // --- 3. Construir el nuevo estado si fue válido ---
        if (movimientoValido) {
            const nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar completamente
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.cajas = nuevaCajas;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }

        // Si no fue válido, devolver el estado original sin cambios
        return estado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado el nivel.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) {
            // Si no hay objetivos o cajas, asumimos que no se puede ganar por esta lógica.
            return false;
        }

        const cajaPosiciones = new Set(estado.cajas.map(c => `${c.fila},${c.col}`));
        
        for (const objetivo of estado.objetivos) {
            const objKey = `${objetivo.fila},${objetivo.col}`;
            if (!cajaPosiciones.has(objKey)) {
                return false; // Algún objetivo no tiene caja encima
            }
        }

        // Si iteramos sobre todos los objetivos y encontramos una caja para cada uno, se ganó.
        return true;
    }
};
