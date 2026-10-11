const Reglas = {
    /**
     * Crea un nuevo estado inicial del juego a partir de la representación textual del nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (filas).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasArray = [];
        let objetivosArray = [];
        
        // Recorrer el mapa para identificar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasArray.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosArray.push({ fila: r, col: c });
                }
            }
        }

        // El mapa de estado solo contiene paredes, pisos y objetivos.
        const mapaEstado = nivel; 

        return {
            mapa: mapaEstado,
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevaPosJugador = { ...jugadorActual };
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        let targetRow = jugadorActual.fila;
        let targetCol = jugadorActual.col;

        switch (direccion) {
            case "arriba":
                targetRow -= 1;
                break;
            case "abajo":
                targetRow += 1;
                break;
            case "izquierda":
                targetCol -= 1;
                break;
            case "derecha":
                targetCol += 1;
                break;
        }

        // Verificar límites y paredes en la posición objetivo (solo revisamos el mapa base)
        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        if (targetRow < 0 || targetRow >= filas || targetCol < 0 || targetCol >= columnas) {
            return estado; // Fuera de límites
        }

        // Si el destino es una pared, no se puede mover
        if (estado.mapa[targetRow][targetCol] === '#') {
            return estado;
        }

        // 2. Verificar si hay cajas en la posición objetivo
        const cajaEnDestino = nuevasCajas.find(c => c.fila === targetRow && c.col === targetCol);

        if (!cajaEnDestino) {
            // Caso A: El destino está libre (piso o objetivo). Movimiento directo del jugador.
            nuevaPosJugador = { fila: targetRow, col: targetCol };
            movimientoExitoso = true;
        } else {
            // Caso B: Hay una caja en el destino. Intentar empujar.
            const boxToPush = cajaEnDestino;

            // Calcular la posición donde debe ir la caja (detrás de ella)
            let pushRow = boxToPush.fila;
            let pushCol = boxToPush.col;

            switch (direccion) {
                case "arriba":
                    pushRow -= 1;
                    break;
                case "abajo":
                    pushRow += 1;
                    break;
                case "izquierda":
                    pushCol -= 1;
                    break;
                case "derecha":
                    pushCol += 1;
                    break;
            }

            // Verificar si el empuje es posible:
            // 1. Debe estar dentro de límites y no chocar con una pared en la nueva posición (pushRow, pushCol).
            if (pushRow < 0 || pushRow >= filas || pushCol < 0 || pushCol >= columnas) {
                return estado; // Empuje fuera de límites
            }

            // 2. La nueva posición de la caja no puede ser una pared en el mapa base.
            if (estado.mapa[pushRow][pushCol] === '#') {
                return estado; // Empuje contra pared
            }

            // 3. La nueva posición de la caja no debe estar ocupada por otra caja.
            const collisionConOtraCaja = nuevasCajas.some(c => c !== boxToPush && c.fila === pushRow && c.col === pushCol);
            if (collisionConOtraCaja) {
                return estado; // Empuje contra otra caja
            }

            // Si todo es correcto, el empuje es exitoso:
            nuevaPosJugador = { fila: boxToPush.fila, col: boxToPush.col }; // El jugador ocupa la posición original de la caja
            movimientoExitoso = true;

            // Actualizar las cajas: remover la vieja y añadir la nueva posición
            const cajasSinElEmpujado = nuevasCajas.filter(c => c !== boxToPush);
            nuevaCajas = [...cajasSinElEmpujado, { fila: pushRow, col: pushCol }];
        }

        // 3. Construir el nuevo estado si hubo movimiento exitoso
        if (movimientoExitoso) {
            return {
                mapa: estado.mapa, // El mapa base no cambia
                jugador: nuevaPosJugador,
                cajas: nuevaCajas,
                objetivos: estado.objetivos,
                movimientos: estado.movimientos + 1
            };
        } else {
            // Si el movimiento falló en cualquier punto, devolver el estado original sin cambios.
            return estado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre los objetivos del nivel.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde: no hay objetivos

        // Crear un set de coordenadas objetivo para una búsqueda rápida
        const objetivosSet = new Set();
        estado.objetivos.forEach(obj => {
            objectivosSet.add(`${obj.fila},${obj.col}`);
        });

        // Verificar si cada caja está en la lista de objetivos
        for (const caja of estado.cajas) {
            if (!objectivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Hay una caja fuera de un objetivo
            }
        }

        // Si todas las cajas están en los objetivos, y el número de cajas es igual al número de objetivos (implícito por la lógica del juego), se ha ganado.
        return estado.cajas.length === estado.objetivos.length;
    }
};
