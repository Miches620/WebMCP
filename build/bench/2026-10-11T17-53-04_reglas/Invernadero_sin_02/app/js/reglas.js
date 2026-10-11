const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        const numRows = nivel.length;
        if (numRows === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };

        // Inicializamos el nuevo mapa para asegurar que solo contenga '#', ' ', y '.'
        let nuevoMapa = [];

        for (let r = 0; r < numRows; r++) {
            let filaActual = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                
                // Determinamos el carácter que va en el mapa: @ y $ se reemplazan por espacio.
                let mapaChar = char;
                if (char === '@' || char === '$') {
                    mapaChar = ' '; 
                }

                filaActual += mapaChar;

                // Lógica de detección de elementos permanece basada en el nivel original
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
            nuevoMapa.push(filaActual);
        }

        return {
            mapa: nuevoMapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado actual según la dirección.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaFila = jugador.fila;
        let nuevaCol = jugador.col;

        // 1. Calcular la posición objetivo del jugador
        switch (direccion) {
            case "arriba":
                nuevaFila -= 1;
                break;
            case "abajo":
                nuevaFila += 1;
                break;
            case "izquierda":
                nuevaCol -= 1;
                break;
            case "derecha":
                nuevaCol += 1;
                break;
        }

        // Función auxiliar para verificar si una coordenada está dentro del mapa y no es pared.
        const isValidCoord = (r, c) => {
            if (r < 0 || r >= 9 || c < 0 || c >= 9) return false; // Fuera de límites
            return estado.mapa[r][c] !== '#'; // No es pared
        };

        // --- Verificación de colisión y movimiento ---

        // A. Si el destino del jugador está fuera de límites o es una pared, no se mueve nada.
        if (!isValidCoord(nuevaFila, nuevaCol)) {
            return { ...estado }; // Retorna copia superficial para asegurar inmutabilidad
        }

        let estadoNuevo = { 
            mapa: [...estado.mapa], 
            jugador: { ...jugador }, 
            cajas: JSON.parse(JSON.stringify(estado.cajas)), // Deep copy de cajas
            objetivos: [...estado.objetivos], 
            movimientos: estado.movimientos
        };

        // B. Verificar si el destino del jugador está ocupado por una caja (Push attempt)
        let boxToPushIndex = -1;
        for (let i = 0; i < state.cajas.length; i++) {
            const box = state.cajas[i];
            if (box.fila === nuevaFila && box.col === nuevaCol) {
                boxToPushIndex = i;
                break;
            }
        }

        // Caso 1: Intento de empuje (Box collision)
        if (boxToPushIndex !== -1) {
            const cajaOriginal = state.cajas[boxToPushIndex];
            let destinoEmpujadoFila = cajaOriginal.fila;
            let destinoEmpujadoCol = cajaOriginal.col;

            // Calcular la posición final del empuje (un paso más allá de la caja)
            switch (direccion) {
                case "arriba":
                    destinoEmpujadoFila -= 1;
                    break;
                case "abajo":
                    destinoEmpujadoFila += 1;
                    break;
                case "izquierda":
                    destinoEmpujadoCol -= 1;
                    break;
                case "derecha":
                    destinoEmpujadoCol += 1;
                    break;
            }

            // Verificar si el destino del empuje es válido (no pared, no fuera de límites)
            if (!isValidCoord(destinoEmpujadoFila, destinoEmpujadoCol)) {
                return estado; // Empuje fallido: la caja está contra una pared o límite.
            }

            // Verificar si el destino del empuje está ocupado por otra cosa (otra caja u obstáculo)
            let collisionWithOtherBox = false;
            for (let i = 0; i < state.cajas.length; i++) {
                if (i !== boxToPushIndex && state.cajas[i].fila === destinoEmpujadoFila && state.cajas[i].col === destinoEmpujadoCol) {
                    collisionWithOtherBox = true;
                    break;
                }
            }

            // Si el empuje es exitoso:
            if (!collisionWithOtherBox) {
                // 1. Actualizar la posición de la caja en el nuevo estado
                estadoNuevo.cajas[boxToPushIndex] = { fila: destinoEmpujadoFila, col: destinoEmpujadoCol };

                // 2. Mover al jugador a donde estaba la caja
                estadoNuevo.jugador = { fila: nuevaFila, col: nuevaCol };

                // 3. Incrementar movimientos
                estadoNuevo.movimientos = estado.movimientos + 1;
                return estadoNuevo;
            } else {
                return estado; // Empuje fallido: otra caja bloquea el camino.
            }

        } 
        // Caso 2: Movimiento simple (No hay cajas en la posición objetivo)
        else {
            // Si es un movimiento válido y no empuja nada, se mueve el jugador.
            estadoNuevo.jugador = { fila: nuevaFila, col: nuevaCol };
            estadoNuevo.movimientos = estado.movimientos + 1;
            return estadoNuevo;
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas de las cajas para búsqueda rápida
        const cajaCoords = new Set();
        cajas.forEach(box => {
            cajaCoords.add(`${box.fila},${box.col}`);
        });

        // Verificar cada objetivo
        for (const obj of objetivos) {
            const coordKey = `${obj.fila},${obj.col}`;
            if (!cajaCoords.has(coordKey)) {
                return false; // Encontrado un objetivo sin caja encima
            }
        }

        return true; // Todos los objetivos están cubiertos
    }
};
