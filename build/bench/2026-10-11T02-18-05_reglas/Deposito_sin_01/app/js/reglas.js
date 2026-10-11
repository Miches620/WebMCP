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

    // Paso 1: Generar el mapa de fondo (solo #, ' ', '.')
    const mapa = nivel.map((fila) => {
        let filaNueva = '';
        for(let c = 0; c < fila.length; c++) {
            const char = fila[c];
            if (char === '#') {
                // Paredes siempre son '#'
                filaNueva += '#';
            } else if (char === '.' || char === '+' || char === '*') {
                // Si es un marcador de objetivo, el mapa muestra '.'
                filaNueva += '.';
            } else if (char === ' ') {
                // Espacio vacío permanece como ' '
                filaNueva += ' ';
            } else {
                // Maneja @ y $ (y cualquier otro carácter no deseado en el mapa). 
                // Estos caracteres desaparecen del mapa, dejando un espacio de piso (' ').
                filaNueva += ' '; 
            }
        }
        return filaNueva;
    });

    // Paso 2: Detectar entidades (Jugador, Cajas, Objetivos)
    for (let r = 0; r < nivel.length; r++) {
        for (let c = 0; c < nivel[r].length; c++) {
            const char = nivel[r][c];

            // Detectar Jugador: '@' o '+'
            if (char === '@' || char === '+') {
                jugador = { fila: r, col: c };
            } 
            
            // Detectar Cajas: '$' o '*'
            if (char === '$' || char === '*') {
                cajas.push({ fila: r, col: c });
            }

            // Detectar Objetivos: '.', '+', o '*'
            if (char === '.' || char === '+' || char === '*') {
                objetivos.push({ fila: r, col: c });
            }
        }
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
     * Mueve el estado del juego según la dirección. Maneja colisiones y empujes de cajas.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (o el mismo si no hubo movimiento).
     */
mover(estado, direccion) {
    // Crear un estado base para devolverlo si no hay cambios
    const nuevoEstado = JSON.parse(JSON.stringify(estado)); 

    let jugadorActual = estado.jugador;
    let nuevasCajas = [...estado.cajas];
    let nuevaPosicionJugador = { ...jugadorActual };
    let movimientoExitoso = false;

    // 1. Calcular la posición objetivo del jugador (P_destino)
    let pDestino = { ...jugadorActual };
    switch (direccion) {
        case "arriba": pDestino.fila -= 1; break;
        case "abajo": pDestino.fila += 1; break;
        case "izquierda": pDestino.col -= 1; break;
        case "derecha": pDestino.col += 1; break;
    }

    // Verificar si P_destino está fuera de límites o es una pared
    if (pDestino.fila < 0 || pDestino.fila >= estado.mapa.length || 
        pDestino.col < 0 || pDestino.col >= estado.mapa[0].length ||
        estado.mapa[pDestino.fila][pDestino.col] === '#') {
        return nuevoEstado; // Colisión con pared o límite
    }

    // 2. Verificar si P_destino está ocupado por una caja
    const cajaEnDestino = nuevasCajas.some(c => c.fila === pDestino.fila && c.col === pDestino.col);

    if (!cajaEnDestino) {
        // Caso 1: Movimiento libre (solo el jugador se mueve)
        nuevaPosicionJugador = pDestino;
        nuevoEstado.jugador = nuevaPosicionJugador;
        nuevoEstado.movimientos += 1;
        movimientoExitoso = true;

    } else {
        // Caso 2: Intento de empujar una caja
        let cajaAEmpujarIndex = nuevasCajas.findIndex(c => c.fila === pDestino.fila && c.col === pDestino.col);
        const cajaAEmpujar = nuevasCajas[cajaAEmpujarIndex];

        // Calcular la posición destino de la caja (C_destino)
        let cDestino = { ...cajaAEmpujar };
        switch (direccion) {
            case "arriba": cDestino.fila -= 1; break;
            case "abajo": cDestino.fila += 1; break;
            case "izquierda": cDestino.col -= 1; break;
            case "derecha": cDestino.col += 1; break;
        }

        // Verificar si C_destino es válido: no pared, no fuera de límites, y no ocupado por otra caja
        const esParedCDestino = (cDestino.fila < 0 || cDestino.fila >= estado.mapa.length || 
                                 cDestino.col < 0 || cDestino.col >= estado.mapa[0].length ||
                                 estado.mapa[cDestino.fila][cDestino.col] === '#');

        const otraCajaEnCDestino = nuevasCajas.some((c, index) => 
            index !== cajaAEmpujarIndex && c.fila === cDestino.fila && c.col === cDestino.col);

        if (!esParedCDestino && !otraCajaEnCDestino) {
            // ¡Movimiento exitoso! Empujamos la caja y al jugador.
            
            // 1. Actualizar cajas: la caja se mueve a C_destino
            const nuevasCajasActualizadas = [...estado.cajas];
            nuevasCajasActualizadas[cajaAEmpujarIndex] = cDestino;
            nuevoEstado.cajas = nuevasCajasActualizadas;

            // 2. Actualizar jugador: el jugador se mueve a la posición original de la caja (pDestino)
            nuevaPosicionJugador = pDestino;
            nuevoEstado.jugador = nuevaPosicionJugador;
            
            nuevoEstado.movimientos += 1;
            movimientoExitoso = true;

        } else {
            // Colisión con pared o caja en el destino de la caja. No hay movimiento.
            return nuevoEstado;
        }
    }

    if (movimientoExitoso) {
        // Si hubo un movimiento exitoso, actualizamos el estado final del jugador y movimientos.
        nuevoEstado.jugador = nuevaPosicionJugador;
    } else {
        // Si no hubo movimiento o fue bloqueado, devolvemos el estado original copiado.
        return nuevoEstado; 
    }

    return nuevoEstado;
},

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0) return true; // No hay objetivos que cumplir

        for (const objetivo of objetivos) {
            let cajaEnObjetivo = false;
            for (const caja of cajas) {
                if (caja.fila === objetivo.fila && caja.col === objetivo.col) {
                    cajaEnObjetivo = true;
                    break;
                }
            }
            if (!cajaEnObjetivo) {
                return false; // Al menos un objetivo no tiene caja encima
            }
        }
        return true;
    }
};
