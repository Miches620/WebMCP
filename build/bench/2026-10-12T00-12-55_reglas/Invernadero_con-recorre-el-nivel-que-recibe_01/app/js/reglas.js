const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = { fila: -1, col: -1 };
        let cajas = [];
        let objetivos = [];

        // Recorrer el mapa para encontrar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // El mapa en el estado solo debe contener '#', ' ', '.'
        const mapaLimpio = nivel.map(fila => fila.replace(/[@$]/g, ' ').trim());

        return {
            mapa: mapaLimpio,
            jugador: jugadorPos,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover al jugador o empujar una caja.
     * @param {object} estado - El estado actual del juego.
     * @param {string} direccion - Dirección de movimiento ("arriba", "abajo", "izquierda", "derecha").
     * @returns {object} Un nuevo estado (inmutable) con el movimiento aplicado, o un estado idéntico si falla.
     */
    mover: function(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = { ...nuevoEstado.jugador };
        let cajasActuales = [...nuevoEstado.cajas];
        let nuevasCajas = [...cajasActuales];
        let nuevaPosJugador = { ...jugadorActual };
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (nextPlayer)
        let nextPlayer = { ...jugadorActual };
        switch (direccion) {
            case "arriba":
                nextPlayer.fila -= 1;
                break;
            case "abajo":
                nextPlayer.fila += 1;
                break;
            case "izquierda":
                nextPlayer.col -= 1;
                break;
            case "derecha":
                nextPlayer.col += 1;
                break;
        }

        const filas = nuevoEstado.mapa.length;
        const columnas = newEstado.mapa[0].length;

        // Validación de límites y paredes en la posición objetivo del jugador
        if (nextPlayer.fila < 0 || nextPlayer.fila >= filas ||
            nextPlayer.col < 0 || nextPlayer.col >= columnas ||
            nuevoEstado.mapa[nextPlayer.fila][nextPlayer.col] === '#') {
            return nuevoEstado; // Colisión con pared o límite, no se mueve nada.
        }

        // 2. Verificar si la posición objetivo del jugador está ocupada por una caja
        const cajaEnDestino = cajasActuales.some(caja =>
            caja.fila === nextPlayer.fila && caja.col === nextPlayer.col
        );

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (a espacio vacío o objetivo)
            nuevaPosJugador = nextPlayer;
            movimientoExitoso = true;
        } else {
            // Caso 2: Intento de empujar una caja
            let cajaAEmpujarIndex = cajasActuales.findIndex(caja =>
                caja.fila === nextPlayer.fila && caja.col === nextPlayer.col
            );

            if (cajaAEmpujarIndex !== -1) {
                // Calcular la posición detrás de la caja (destino final)
                let destinoFinal = { ...nextPlayer };
                switch (direccion) {
                    case "arriba":
                        destinoFinal.fila -= 1;
                        break;
                    case "abajo":
                        destinoFinal.fila += 1;
                        break;
                    case "izquierda":
                        destinoFinal.col -= 1;
                        break;
                    case "derecha":
                        destinoFinal.col += 1;
                        break;
                }

                // Validación del destino final: debe ser dentro, no pared y no otra caja
                const esValidoDestino = (
                    destinoFinal.fila >= 0 && destinoFinal.fila < filas &&
                    destinoFinal.col >= 0 && destinoFinal.col < columnas &&
                    nuevoEstado.mapa[destinoFinal.fila][destinoFinal.col] !== '#'
                );

                const hayOtraCajaEnDestino = cajasActuales.some((caja, index) => {
                    // Ignorar la caja que estamos empujando (la de índice cajaAEmpujarIndex)
                    if (index === cajaAEmpujarIndex) return false;
                    return caja.fila === destinoFinal.fila && caja.col === destinoFinal.col;
                });

                if (esValidoDestino && !hayOtraCajaEnDestino) {
                    // Empuje exitoso: 
                    // 1. El jugador se mueve a la posición de la caja.
                    nuevaPosJugador = nextPlayer;
                    
                    // 2. La caja se mueve al destino final.
                    const cajaEmpujada = { ...cajasActuales[cajaAEmpujarIndex] };
                    cajaEmpujada.fila = destinoFinal.fila;
                    cajaEmpujada.col = destinoFinal.col;

                    // Actualizar la lista de cajas (reemplazando la caja empujada)
                    nuevasCajas[cajaAEmpujarIndex] = cajaEmpujada;
                    movimientoExitoso = true;
                } else {
                    // Empuje fallido: no se mueve nada.
                    return nuevoEstado; 
                }
            }
        }

        if (movimientoExitoso) {
            // Crear el estado final actualizado
            const nuevoEstadoFinal = {
                mapa: nuevoEstado.mapa, // El mapa no cambia en la lógica de movimiento/empuje
                jugador: nuevaPosJugador,
                cajas: nuevasCajas,
                objetivos: nuevoEstado.objetivos,
                movimientos: nuevoEstado.movimientos + 1
            };
            return nuevoEstadoFinal;
        }

        // Si no hubo movimiento exitoso (ej. colisión con caja contra pared)
        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        // Para cada objetivo, debe haber al menos una caja encima.
        for (const objetivo of estado.objetivos) {
            let hayCajaEncima = false;
            for (const caja of estado.cajas) {
                if (caja.fila === objetivo.fila && caja.col === objetivo.col) {
                    hayCajaEncima = true;
                    break;
                }
            }
            // Si encontramos un objetivo sin caja, el nivel no está ganado.
            if (!hayCajaEncima) {
                return false;
            }
        }
        // Si revisamos todos los objetivos y todos tienen una caja, se ganó.
        return true;
    }
};
