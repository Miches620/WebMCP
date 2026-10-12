const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - El mapa del nivel (array de strings 9x9).
     * @returns {object} Estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        // mapaTemporal is unused in the final logic, but we keep the structure clean.

        const R = nivel.length;
        if (R === 0) {
            return {
                mapa: [],
                jugador: null,
                cajas: [],
                objetivos: [],
                movimientos: 0
            };
        }
        // Asumimos que todos los niveles son rectangulares y tienen la misma longitud de fila.
        const C = nivel[0].length;

        // Primera pasada para identificar posiciones clave
        for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        // Construir el mapa final (solo #, ' ', .)
        let mapaFinal = [];
        for (let r = 0; r < R; r++) {
            let filaString = '';
            for (let c = 0; c < C; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaString += '#';
                } else if (char === '.') {
                    filaString += '.';
                } else { // ' ', '$', '@' o cualquier otro carácter que no sea pared, objetivo ni caja/jugador inicial
                    filaString += ' ';
                }
            }
            mapaFinal.push(filaString);
        }

        return {
            mapa: mapaFinal,
            jugador: jugador,
            cajas: JSON.parse(JSON.stringify(cajas)), // Deep copy
            objetivos: JSON.parse(JSON.stringify(objetivos)), // Deep copy
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado que refleja el movimiento o el estado original si falla.
     */
mover: function(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstadoBase = JSON.parse(JSON.stringify(estado));
        let nuevaPosicionJugador = { ...estado.jugador };

        // 1. Calcular la posición objetivo del jugador (targetPlayer)
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
                nuevaPosicionJugador.col += 1; // CORRECCIÓN: Debe ser +1 para derecha
                break;
        }

        // Verificar límites y paredes en la posición objetivo del jugador
        if (nuevaPosicionJugador.fila < 0 || nuevaPosicionJugador.fila > 8 ||
            nuevaPosicionJugador.col < 0 || nuevaPosicionJugador.col > 8 ||
            estado.mapa[nuevaPosicionJugador.fila][nuevaPosicionJugador.col] === '#') {
            return estado; // Movimiento imposible: pared o fuera de límites, devolver el estado original (o su copia)
        }

        // 2. Verificar colisión con cajas (cajas en la posición objetivo del jugador)
        const cajaEnTarget = estado.cajas.some(c => c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col);

        if (!cajaEnTarget) {
            // Caso 1: Movimiento simple (sin cajas involucradas)
            const nuevoEstado = JSON.parse(JSON.stringify(estado));
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empujar una caja (cajaEnTarget es true)

            // Calcular la posición detrás de la caja (targetCrateBehind)
            let nuevaPosicionCajaDetras = { ...nuevaPosicionJugador };
            switch (direccion) {
                case "arriba":
                    nuevaPosicionCajaDetras.fila -= 1;
                    break;
                case "abajo":
                    nuevaPosicionCajaDetras.fila += 1;
                    break;
                case "izquierda":
                    nuevaPosicionCajaDetras.col -= 1;
                    break;
                case "derecha":
                    nuevaPosicionCajaDetras.col += 1; // CORRECCIÓN: Debe ser +1 para derecha
                    break;
            }

            // Verificar si el espacio detrás de la caja es válido para empujar:
            // a) No puede ser pared o fuera de límites.
            if (nuevaPosicionCajaDetras.fila < 0 || nuevaPosicionCajaDetras.fila > 8 ||
                nuevaPosicionCajaDetras.col < 0 || nuevaPosicionCajaDetras.col > 8 ||
                estado.mapa[nuevaPosicionCajaDetras.fila][nuevaPosicionCajaDetras.col] === '#') {
                return estado; // Empuje fallido: pared detrás de la caja
            }

            // b) No puede haber otra caja en el espacio detrás (verificar colisión con otras cajas).
            const hayOtraCajaDetras = estado.cajas.some((c, index) => {
                // Excluir la caja que estamos empujando de la verificación de colisión
                if (c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col) {
                    return false; 
                }
                // Verificar si cualquier otra caja está en el espacio detrás
                return c.fila === nuevaPosicionCajaDetras.fila && c.col === nuevaPosicionCajaDetras.col;
            });

            if (hayOtraCajaDetras) {
                return estado; // Empuje fallido: otra caja detrás
            }

            // 3. Movimiento exitoso de empuje
            const nuevoEstado = JSON.parse(JSON.stringify(estado));
            nuevoEstado.movimientos += 1;

            // Actualizar posición del jugador (se mueve a la antigua posición de la caja)
            nuevoEstado.jugador = nuevaPosicionJugador;

            // Encontrar el índice de la caja que fue empujada y actualizar su posición
            const cajaEmpujadaIndex = estado.cajas.findIndex(c => c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col);
            
            if (cajaEmpujadaIndex !== -1) {
                // Crear la copia de la caja actualizada
                const cajaActualizada = { 
                    ...estado.cajas[cajaEmpujadaIndex], 
                    fila: nuevaPosicionCajaDetras.fila, 
                    col: nuevaPosicionCajaDetras.col 
                };
                
                // Reemplazar la caja en el array de cajas del nuevo estado (asegurando que es una copia)
                nuevoEstado.cajas = [...estado.cajas];
                nuevoEstado.cajas[cajaEmpujadaIndex] = cajaActualizada;
            }

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas de cajas para búsqueda rápida
        const cajaCoords = new Set();
        estado.cajas.forEach(c => cajaCoords.add(`${c.fila},${c.col}`));

        // Verificar cada objetivo
        for (const obj of estado.objetivos) {
            const coord = `${obj.fila},${obj.col}`;
            if (!cajaCoords.has(coord)) {
                return false; // Al menos un objetivo no está cubierto
            }
        }

        // Si pasamos por todos los objetivos y encontramos caja, el nivel está ganado.
        return true;
    }
};
