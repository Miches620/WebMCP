const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (filas).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasIniciales = [];
        let objetivosIniciales = [];
        
        // Paso 1: Identificar posiciones iniciales y construir el mapa base.
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasIniciales.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // El mapa solo contiene paredes ('#'), pisos (' ') y objetivos ('.').
        const mapaBase = nivel; 

        return {
            mapa: mapaBase,
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado actual según la dirección.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hubo movimiento).
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugador = estado.jugador;
        let nuevaPosJugador = { ...jugador };
        let cajaMovida = false;
        let cajasNuevas = [...estado.cajas];
        let movimientosIncrementados = 0;

        // Calcular la posición objetivo del jugador (sin considerar colisiones)
        switch (direccion) {
            case "arriba":
                nuevaPosJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosJugador.col += 1;
                break;
        }

        const { fila: r, col: c } = nuevaPosJugador;
        const filas = estado.mapa.length;
        const columnas = estado.mapa[0].length;

        // 1. Validación de límites y paredes (si el destino es fuera o pared)
        if (r < 0 || r >= filas || c < 0 || c >= columnas || estado.mapa[r][c] === '#') {
            return nuevoEstado; // No se mueve nada
        }

        // 2. Verificar si hay cajas en la posición objetivo del jugador
        const cajaEnDestino = estado.cajas.some(caja => caja.fila === r && caja.col === c);

        if (!cajaEnDestino) {
            // Movimiento simple (solo el jugador se mueve)
            nuevoEstado.jugador = nuevaPosJugador;
            return nuevoEstado;
        } else {
            // Hay una caja en destino, intentar empujar
            const cajasDetras = estado.cajas.filter(caja => caja.fila === r && caja.col === c);

            if (cajasDetras.length > 0) {
                // Identificar la caja que está directamente delante del jugador
                const cajaObjetivo = cajasDetras[0];
                let posDetras = { ...cajaObjetivo };

                // Calcular dónde estaría el objeto detrás de la caja objetivo
                switch (direccion) {
                    case "arriba":
                        posDetras.fila -= 1;
                        break;
                    case "abajo":
                        posDetras.fila += 1;
                        break;
                    case "izquierda":
                        posDetras.col -= 1;
                        break;
                    case "derecha":
                        posDetras.col += 1;
                        break;
                }

                // Validación de empuje: ¿Puede la caja moverse?
                const puedeEmpujar = (
                    posDetras.fila >= 0 && posDetras.fila < filas &&
                    posDetras.col >= 0 && posDetras.col < columnas &&
                    estado.mapa[posDetras.fila][posDetras.col] !== '#' && // No choca con pared
                    !estado.cajas.some(caja => caja.fila === posDetras.fila && caja.col === posDetras.col) // No choca con otra caja
                );

                if (puedeEmpujar) {
                    // ¡Movimiento exitoso de empuje!
                    nuevoEstado.jugador = nuevaPosJugador;
                    nuevoEstado.movimientos += 1;
                    cajaMovida = true;

                    // Actualizar la posición de la caja que fue empujada
                    let cajasActualizadas = [];
                    for (const caja of estado.cajas) {
                        if (caja.fila === r && caja.col === c) {
                            // Esta es la caja que se mueve
                            cajasActualizadas.push({ fila: posDetras.fila, col: posDetras.col });
                        } else {
                            // Otras cajas permanecen igual
                            cajasActualizadas.push(caja);
                        }
                    }
                    nuevoEstado.cajas = cajasActualizadas;

                } else {
                    // Empuje fallido (choca con pared o caja)
                    return nuevoEstado; 
                }
            } else {
                 // Esto no debería pasar si la lógica de cajaEnDestino es correcta, pero por seguridad:
                 return nuevoEstado;
            }
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Creamos un set de coordenadas objetivo para fácil verificación
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificamos si cada caja está sobre una coordenada objetivo
        for (const caja of estado.cajas) {
            const coordCaja = `${caja.fila},${caja.col}`;
            if (!objetivosSet.has(coordCaja)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas están sobre objetivos, el nivel se ha ganado.
        return true;
    }
};
