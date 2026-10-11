const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasCoords = [];
        let objetivosCoords = [];
        let mapaStrings = []; // Array to hold strings for the map

        for (let r = 0; r < filas; r++) {
            let currentRowString = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                
                // Track coordinates
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasCoords.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosCoords.push({ fila: r, col: c });
                }

                // Determine the character for the map string based on rules: 
                // Map only contains #, ' ', '.'
                let mapChar;
                if (char === '#') {
                    mapChar = '#';
                } else if (char === '.') {
                    mapChar = '.';
                } else if (char === '@' || char === '$') {
                    // Player and boxes are treated as empty space ' ' in the map.
                    mapChar = ' '; 
                } else {
                    // Regular floor space ' '.
                    mapChar = char; 
                }
                currentRowString += mapChar;
            }
            mapaStrings.push(currentRowString);
        }

        return {
            mapa: mapaStrings, // Array of strings
            jugador: jugadorPos,
            cajas: cajasCoords,
            objetivos: objetivosCoords,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (inmutable) con el movimiento aplicado o sin cambios si es inválido.
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return { ...estado };
        const columnas = estado.mapa[0].length;

        let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar el estado para inmutabilidad
        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas];
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
        let nextPlayerPos = { ...jugadorActual };
        switch (direccion) {
            case "arriba":
                nextPlayerPos.fila -= 1;
                break;
            case "abajo":
                nextPlayerPos.fila += 1;
                break;
            case "izquierda":
                nextPlayerPos.col -= 1;
                break;
            case "derecha":
                nextPlayerPos.col += 1;
                break;
        }

        // Verificar límites del mapa
        if (nextPlayerPos.fila < 0 || nextPlayerPos.fila >= filas || nextPlayerPos.col < 0 || nextPlayerPos.col >= columnas) {
            return nuevoEstado; // Fuera de límites
        }

        // Verificar si el destino es una pared en el mapa base
        if (estado.mapa[nextPlayerPos.fila][nextPlayerPos.col] === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // 2. Detectar colisiones con cajas
        const cajaEnDestino = estado.cajas.some(c => c.fila === nextPlayerPos.fila && c.col === nextPlayerPos.col);

        if (!cajaEnDestino) {
            // Movimiento simple (a un espacio vacío o objetivo)
            nuevoEstado.jugador = nextPlayerPos;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Colisión con caja: Intentar empujar
            const cajaDestino = estado.cajas.find(c => c.fila === nextPlayerPos.fila && c.col === nextPlayerPos.col);

            let pushTargetPos = { ...cajaDestino }; // Posición donde la caja intentará moverse
            switch (direccion) {
                case "arriba":
                    pushTargetPos.fila -= 1;
                    break;
                case "abajo":
                    pushTargetPos.fila += 1;
                    break;
                case "izquierda":
                    pushTargetPos.col -= 1;
                    break;
                case "derecha":
                    pushTargetPos.col += 1;
                    break;
            }

            // Verificar si el destino del empuje es válido (no pared, no fuera de límites)
            if (pushTargetPos.fila < 0 || pushTargetPos.fila >= filas || pushTargetPos.col < 0 || pushTargetPos.col >= columnas) {
                return nuevoEstado; // Empujar fuera de límites
            }

            // Verificar si el destino del empuje es una pared en el mapa base
            if (estado.mapa[pushTargetPos.fila][pushTargetPos.col] === '#') {
                return nuevoEstado; // Colisión con pared al intentar empujar
            }

            // Verificar si el destino del empuje está ocupado por otra caja
            const hayOtraCajaDetras = estado.cajas.some(c => c !== cajaDestino && c.fila === pushTargetPos.fila && c.col === pushTargetPos.col);
            if (hayOtraCajaDetras) {
                return nuevoEstado; // Colisión con otra caja al intentar empujar
            }

            // ¡Empuje exitoso! Actualizar estado:
            nuevoEstado.jugador = nextPlayerPos;
            nuevoEstado.movimientos += 1;

            // Crear nuevas coordenadas de cajas (actualizando solo la caja movida)
            let nuevasCajasActualizadas = [];
            for (const c of estado.cajas) {
                if (c.fila === cajaDestino.fila && c.col === cajaDestino.col) {
                    // Esta es la caja que se mueve
                    nuevasCajasActualizadas.push(pushTargetPos);
                } else {
                    // Otras cajas permanecen igual
                    nuevasCajasActualizadas.push(c);
                }
            }
            nuevoEstado.cajas = nuevasCajasActualizadas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si el nivel ha sido ganado (todas las cajas están sobre objetivos).
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ganó, False en caso contrario.
     */
    ganado: function(estado) {
        if (!estado.objetivos || estado.objetivos.length === 0) return true; // Caso sin objetivos

        const objetivosCubiertos = new Set();

        for (const caja of estado.cajas) {
            // Verificar si la posición de la caja coincide con algún objetivo
            const esObjetivo = estado.objetivos.some(obj => obj.fila === caja.fila && obj.col === caja.col);
            if (esObjetivo) {
                objetivosCubiertos.add(`${caja.fila},${caja.col}`);
            }
        }

        // Se gana si el número de objetivos cubiertos es igual al total de objetivos
        return objetivosCubiertos.size === estado.objetivos.length;
    }
};
