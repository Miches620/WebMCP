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
        let mapaLimpio = [];

        for (let r = 0; r < nivel.length; r++) {
            let filaActual = "";
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    filaActual += ' '; // El jugador no se cuenta en el mapa limpio
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    filaActual += ' '; // La caja no se cuenta en el mapa limpio
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual += '.';
                } else if (char === '#') {
                    filaActual += '#';
                } else {
                    // Espacio vacío ' '
                    filaActual += ' ';
                }
            }
            mapaLimpio.push(filaActual);
        }

        return {
            mapa: mapaLimpio,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado actual en la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado con los cambios, o el estado original si no se puede mover.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorNuevoFila = estado.jugador.fila;
        let jugadorNuevoCol = estado.jugador.col;
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador
        switch (direccion) {
            case "arriba":
                jugadorNuevoFila -= 1;
                break;
            case "abajo":
                jugadorNuevoFila += 1;
                break;
            case "izquierda":
                jugadorNuevoCol -= 1;
                break;
            case "derecha":
                jugadorNuevoCol += 1;
                break;
        }

        // Verificar límites y paredes en la posición objetivo del jugador
        if (jugadorNuevoFila < 0 || jugadorNuevoFila >= estado.mapa.length ||
            jugadorNuevoCol < 0 || jugadorNuevoCol >= estado.mapa[0].length ||
            estado.mapa[jugadorNuevoFila][jugadorNuevoCol] === '#') {
            return nuevoEstado; // Colisión con pared o límite
        }

        // Verificar si la posición objetivo está ocupada por una caja
        const colisionCaja = estado.cajas.some(c => 
            c.fila === jugadorNuevoFila && c.col === jugadorNuevoCol
        );

        if (!colisionCaja) {
            // Movimiento simple (a piso o objetivo vacío)
            nuevoEstado.jugador = { fila: jugadorNuevoFila, col: jugadorNuevoCol };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Colisión con caja: Intentar empujar
            let cajasMovidas = [];
            let estadoCajasActualizado = JSON.parse(JSON.stringify(estado.cajas));

            // Iterar sobre las cajas para ver si alguna puede ser empujada por el jugador
            for (let i = 0; i < estadoCajasActualizado.length; i++) {
                const caja = estadoCajasActualizado[i];
                
                // Solo consideramos la caja que está en la posición objetivo del jugador
                if (caja.fila === jugadorNuevoFila && caja.col === jugadorNuevoCol) {
                    let cajaNuevaFila = caja.fila;
                    let cajaNuevaCol = caja.col;

                    // Calcular dónde iría la caja si es empujada
                    switch (direccion) {
                        case "arriba":
                            cajaNuevaFila -= 1;
                            break;
                        case "abajo":
                            cajaNuevaFila += 1;
                            break;
                        case "izquierda":
                            cajaNuevaCol -= 1;
                            break;
                        case "derecha":
                            cajaNuevaCol += 1;
                            break;
                    }

                    // Verificar si la nueva posición de la caja es válida:
                    // 1. No está fuera del mapa (ya cubierto por el chequeo general, pero mejor ser explícito)
                    if (cajaNuevaFila < 0 || cajaNuevaFila >= estado.mapa.length ||
                        cajaNuevaCol < 0 || cajaNuevaCol >= estado.mapa[0].length) {
                        continue; // No puede moverse fuera del mapa
                    }

                    // 2. La nueva posición no es una pared
                    if (estado.mapa[cajaNuevaFila][cajaNuevaCol] === '#') {
                        continue; // Bloqueada por pared
                    }

                    // 3. La nueva posición no está ocupada por otra caja (o el jugador, pero el jugador ya se movió)
                    const colisionOtraCaja = estadoCajasActualizado.some((c, j) => 
                        j !== i && c.fila === cajaNuevaFila && c.col === cajaNuevaCol
                    );

                    if (!colisionOtraCaja) {
                        // ¡Éxito! La caja puede moverse.
                        cajasMovidas.push({
                            indice: i,
                            nuevaPosicion: { fila: cajaNuevaFila, col: cajaNuevaCol }
                        });
                    }
                }
            }

            if (cajasMovidas.length > 0) {
                // El movimiento fue exitoso y se empujaron cajas
                nuevoEstado.movimientos += 1;
                
                // Actualizar posiciones de las cajas movidas
                const nuevasCajas = [...estado.cajas];
                for (const cajaMovida of cajasMovidas) {
                    const indice = cajaMovida.indice;
                    nuevasCajas[indice] = { 
                        fila: cajaMovida.nuevaPosicion.fila, 
                        col: cajaMovida.nuevaPosicion.col 
                    };
                }
                nuevoEstado.cajas = nuevasCajas;

                // Actualizar posición del jugador (el jugador siempre se mueve a la casilla original de la caja)
                nuevoEstado.jugador = { fila: jugadorNuevoFila, col: jugadorNuevoCol };
                return nuevoEstado;
            } else {
                // Colisión con cajas, pero ninguna puede moverse (bloqueo total)
                return nuevoEstado; 
            }
        }
    },

    /**
     * Verifica si el nivel ha sido completado.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si todas las cajas están sobre objetivos, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        let objetivosCubiertos = 0;
        const objetivosPendientes = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Identificar qué cajas están sobre un objetivo
        const ubicacionesCajasSobreObjetivo = estado.cajas.filter(c => {
            return objectivesPendientes.has(`${c.fila},${c.col}`);
        });

        // Crear un set de coordenadas únicas donde hay cajas y que son objetivos
        const objetivosCubiertosSet = new Set();
        for (const caja of estado.cajas) {
             if (estado.objetivos.some(o => o.fila === caja.fila && o.col === caja.col)) {
                objetivosCubiertosSet.add(`${caja.fila},${caja.col}`);
            }
        }

        // Contar cuántos objetivos únicos han sido cubiertos
        let count = 0;
        for (const objetivo of estado.objetivos) {
             if (estado.cajas.some(c => c.fila === objetivo.fila && c.col === objetivo.col)) {
                count++;
            }
        }

        return count === estado.objetivos.length;
    }
};
