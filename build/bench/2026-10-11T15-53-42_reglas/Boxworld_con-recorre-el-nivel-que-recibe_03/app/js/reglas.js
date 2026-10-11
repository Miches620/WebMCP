const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaSimplificado = [];

        // 1. Recorrer el nivel para identificar posiciones clave y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];

                if (char === '@') {
                    jugador = { fila: r, col: c };
                    filaActual.push(' '); // El jugador no cuenta en el mapa base
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    filaActual.push(' '); // La caja no cuenta en el mapa base
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual.push('.');
                } else if (char === '#') {
                    filaActual.push('#');
                } else { // ' '
                    filaActual.push(' ');
                }
            }
            mapaSimplificado.push(filaActual);
        }

        // 2. Devolver el estado inicial
        return {
            mapa: mapaSimplificado,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover al jugador en la dirección especificada. Maneja colisiones y empujes.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado con el movimiento aplicado, o un estado idéntico si falla.
     */
    mover(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevaPosicionJugador = { ...jugadorActual };
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
        let filaDestino, colDestino;
        switch (direccion) {
            case "arriba":
                filaDestino = jugadorActual.fila - 1;
                colDestino = jugadorActual.col;
                break;
            case "abajo":
                filaDestino = jugadorActual.fila + 1;
                colDestino = jugadorActual.col;
                break;
            case "izquierda":
                filaDestino = jugadorActual.fila;
                colDestino = jugadorActual.col - 1;
                break;
            case "derecha":
                filaDestino = jugadorActual.fila;
                colDestino = jugadorActual.col + 1;
                break;
        }

        // --- Validación de Movimiento ---

        // A. Chequear límites y paredes en el mapa base (solo '#', ' ', '.')
        if (filaDestino < 0 || filaDestino >= estado.mapa.length || colDestino < 0 || colDestino >= estado.mapa[0].length) {
            return nuevoEstado; // Fuera de límites
        }

        const mapaBase = estado.mapa[filaDestino][colDestino];
        if (mapaBase === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // B. Chequear colisiones con cajas
        let cajaColision = null;
        for (const caja of estado.cajas) {
            if (caja.fila === filaDestino && caja.col === colDestino) {
                cajaColision = caja;
                break;
            }
        }

        // Caso 1: El destino está vacío o es un objetivo (Movimiento simple)
        if (!cajaColision) {
            nuevaPosicionJugador = { fila: filaDestino, col: colDestino };
            movimientoExitoso = true;
        } 
        // Caso 2: El destino tiene una caja (Intento de empuje)
        else {
            const [filaCaja, colCaja] = [cajaColision.fila, cajaColision.col];

            // Calcular la posición detrás de la caja (donde debe ir la caja para moverse)
            let filaDestinoCaja;
            let colDestinoCaja;
            switch (direccion) {
                case "arriba":
                    filaDestinoCaja = filaCaja - 1;
                    colDestinoCaja = colCaja;
                    break;
                case "abajo":
                    filaDestinoCaja = filaCaja + 1;
                    colDestinoCaja = colCaja;
                    break;
                case "izquierda":
                    filaDestinoCaja = filaCaja;
                    colDestinoCaja = colCaja - 1;
                    break;
                case "derecha":
                    filaDestinoCaja = filaCaja;
                    colDestinoCaja = colCaja + 1;
                    break;
            }

            // Validar si el destino de la caja es válido (no pared, no fuera de límites)
            if (filaDestinoCaja < 0 || filaDestinoCaja >= estado.mapa.length || colDestinoCaja < 0 || colDestinoCaja >= estado.mapa[0].length) {
                return nuevoEstado; // La caja está pegada a un borde
            }

            const mapaBaseDetras = estado.mapa[filaDestinoCaja][colDestinoCaja];
            if (mapaBaseDetras === '#') {
                return nuevoEstado; // La caja está pegada a una pared
            }

            // Validar si el destino de la caja está ocupado por otra cosa (otra caja o jugador)
            let colisionConOtraCosa = false;
            for (const caja of estado.cajas) {
                if ((caja.fila === filaDestinoCaja && caja.col === colDestinoCaja) && !(caja.fila === filaCaja && caja.col === colCaja)) {
                    colisionConOtraCosa = true;
                    break;
                }
            }

            // Si el destino de la caja está libre, ¡empuje exitoso!
            if (!colisionConOtraCosa) {
                nuevaPosicionJugador = { fila: filaDestino, col: colDestino };
                movimientoExitoso = true;

                // Actualizar posiciones de las cajas (solo la caja empujada)
                const indexCajaEmpujable = estado.cajas.findIndex(c => c.fila === filaCaja && c.col === colCaja);
                if (indexCajaEmpujable !== -1) {
                    nuevasCajas[indexCajaEmpujable] = { 
                        fila: filaDestinoCaja, 
                        col: colDestinoCaja 
                    };
                }
            } else {
                return nuevoEstado; // Empuje fallido por otra caja/obstáculo
            }
        }

        // --- Aplicar el estado nuevo si fue exitoso ---
        if (movimientoExitoso) {
            const nuevoEstadoFinal = {
                mapa: estado.mapa, // El mapa base no cambia
                jugador: nuevaPosicionJugador,
                cajas: nuevasCajas,
                objetivos: estado.objetivos,
                movimientos: estado.movimientos + 1
            };
            return nuevoEstadoFinal;
        }

        // Si llegamos aquí y no hubo movimiento exitoso (debería ser cubierto arriba)
        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde: no hay objetivos

        const cajasEnObjetivo = estado.cajas.every(caja => {
            return estado.objetivos.some(obj => obj.fila === caja.fila && obj.col === caja.col);
        });

        // Verificamos que el número de cajas sea igual al número de objetivos, y todas estén en ellos.
        if (estado.cajas.length !== estado.objetivos.length) {
            return false;
        }

        // Si hay la misma cantidad de cajas que objetivos, y cada caja está sobre un objetivo único:
        const ubicacionesCaja = new Set(estado.cajas.map(c => `${c.fila},${c.col}`));
        const ubicacionesObjetivo = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Si los conjuntos de coordenadas son iguales, significa que todas las cajas están sobre objetivos únicos.
        return ubicacionesCaja.size === ubicacionesObjetivo.size && 
               Array.from(ubicacionesCaja).every(coord => ubicacionesObjetivo.has(coord));
    }
};
