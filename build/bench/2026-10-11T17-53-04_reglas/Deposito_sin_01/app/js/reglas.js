const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (8x8).
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
    let jugador = null;
    let cajas = [];
    let objetivos = [];
    let mapaInicial = [];

    for (let r = 0; r < nivel.length; r++) {
        const rowString = nivel[r];
        if (typeof rowString !== 'string') continue; // Maneja filas no válidas o indefinidas

        let nuevaFila = [];
        for (let c = 0; c < rowString.length; c++) {
            const char = rowString[c];

            if (char === '@') {
                jugador = { fila: r, col: c };
                nuevaFila.push(' '); // El mapa solo muestra piso/paredes/objetivos
            } else if (char === '$') {
                cajas.push({ fila: r, col: c });
                nuevaFila.push(' ');
            } else if (char === '.') {
                objetivos.push({ fila: r, col: c });
                nuevaFila.push('.');
            } else if (char === '#') {
                nuevaFila.push('#');
            } else { // ' ' o cualquier otro carácter de piso
                nuevaFila.push(' ');
            }
        }
        mapaInicial.push(nuevaFila.join(''));
    }

    return {
        mapa: mapaInicial,
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
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevaPosicionJugador = { ...jugadorActual };
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        let targetR = jugadorActual.fila;
        let targetC = jugadorActual.col;

        switch (direccion) {
            case "arriba":
                targetR -= 1;
                break;
            case "abajo":
                targetR += 1;
                break;
            case "izquierda":
                targetC -= 1;
                break;
            case "derecha":
                targetC += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        if (targetR < 0 || targetR > 7 || targetC < 0 || targetC > 7) {
            return estado; // Fuera de límites
        }

        // 2. Comprobar si el destino es una pared o fuera del mapa
        const pared = nuevoEstado.mapa[targetR][targetC] === '#';
        if (pared) {
            return estado;
        }

        // 3. Verificar colisiones con cajas
        let cajaEnDestinoIndex = -1;
        for (let i = 0; i < nuevoEstado.cajas.length; i++) {
            const caja = nuevoEstado.cajas[i];
            if (caja.fila === targetR && caja.col === targetC) {
                cajaEnDestinoIndex = i;
                break;
            }
        }

        // Caso A: Mover a un espacio vacío o objetivo (no hay cajas en destino)
        if (cajaEnDestinoIndex === -1) {
            nuevaPosicionJugador.fila = targetR;
            nuevaPosicionJugador.col = targetC;
            movimientoExitoso = true;

        } else {
            // Caso B: Intentar empujar una caja
            const cajaAEmpujar = nuevoEstado.cajas[cajaEnDestinoIndex];
            let destinoDetrasR = cajaAEmpujar.fila;
            let destinoDetrasC = cajaAEmpujar.col;

            switch (direccion) {
                case "arriba":
                    destinoDetrasR -= 1;
                    break;
                case "abajo":
                    destinoDetrasR += 1;
                    break;
                case "izquierda":
                    destinoDetrasC -= 1;
                    break;
                case "derecha":
                    destinoDetrasC += 1;
                    break;
            }

            // Verificar si el destino detrás de la caja es válido (no pared, no fuera)
            if (destinoDetrasR < 0 || destinoDetrasR > 7 || destinoDetrasC < 0 || destinoDetrasC > 7) {
                return estado; // Bloqueado por límite
            }

            // Verificar si el destino detrás de la caja es una pared o está ocupado por otra cosa (caja/pared)
            const paredDetras = nuevoEstado.mapa[destinoDetrasR][destinoDetrasC] === '#';
            let hayOtraCajaDetras = false;

            for (let i = 0; i < nuevoEstado.cajas.length; i++) {
                if (i !== cajaEnDestinoIndex && nuevoEstado.cajas[i].fila === destinoDetrasR && nuevoEstado.cajas[i].col === destinoDetrasC) {
                    hayOtraCajaDetras = true;
                    break;
                }
            }

            if (paredDetras || hayOtraCajaDetras) {
                return estado; // Bloqueado por pared o caja
            }

            // ¡Empuje exitoso!
            nuevaPosicionJugador.fila = targetR;
            nuevaPosicionJugador.col = targetC;

            // Actualizar la posición de la caja empujada
            const nuevaCajaAEmpujar = { ...cajaAEmpujar, fila: destinoDetrasR, col: destinoDetrasC };
            nuevasCajas[cajaEnDestinoIndex] = nuevaCajaAEmpujar;

            movimientoExitoso = true;
        }

        // 4. Crear el nuevo estado si hubo movimiento exitoso
        if (movimientoExitoso) {
            return {
                mapa: nuevoEstado.mapa, // El mapa no cambia en esta lógica
                jugador: nuevaPosicionJugador,
                cajas: nuevasCajas,
                objetivos: nuevoEstado.objetivos,
                movimientos: estado.movimientos + 1
            };
        }

        // Si llegamos aquí y movimientoExitoso es false (debería haber sido capturado arriba)
        return estado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        for (const caja of estado.cajas) {
            let estaSobreObjetivo = false;
            for (const objetivo of estado.objetivos) {
                if (caja.fila === objetivo.fila && caja.col === objetivo.col) {
                    estaSobreObjetivo = true;
                    break;
                }
            }
            // Si encontramos una caja que NO está sobre ningún objetivo, el nivel no se ha ganado.
            if (!estaSobreObjetivo) {
                return false;
            }
        }
        // Si todas las cajas fueron revisadas y todas están sobre objetivos
        return true;
    }
};
