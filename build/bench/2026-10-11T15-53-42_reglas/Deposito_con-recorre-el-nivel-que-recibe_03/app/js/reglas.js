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
        let cajasList = [];
        let objetivosList = [];

        // Recorrer el mapa para identificar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasList.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosList.push({ fila: r, col: c });
                }
            }
        }

        // El mapa solo contiene paredes, pisos y objetivos
        const mapaLimpio = nivel.map(fila => 
            Array.from(fila).map((char, index) => {
                if (char === '$' || char === '@') return ' '; // Ignorar cajas/jugador en el mapa base
                return char;
            }).join('')
        );

        // Inicializar estado
        const estado = {
            mapa: mapaLimpio,
            jugador: jugadorPos,
            cajas: cajasList,
            objetivos: objetivosList,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Calcula el nuevo estado después de intentar un movimiento.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento posible.
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return { ...estado };
        const columnas = estado.mapa[0].length;

        // Función auxiliar para obtener coordenadas objetivo
        const getTargetCoords = (r, c, dir) => {
            switch (dir) {
                case "arriba": return { r: r - 1, c: c };
                case "abajo": return { r: r + 1, c: c };
                case "izquierda": return { r: r, c: c - 1 };
                case "derecha": return { r: r, c: c + 1 };
            }
        };

        // Coordenadas objetivo del jugador
        let newPlayer = getTargetCoords(estado.jugador.fila, estado.jugador.col, direccion);

        // 1. Validación de límites y paredes (si el destino es pared o fuera)
        if (newPlayer.fila < 0 || newPlayer.fila >= filas || 
            newPlayer.col < 0 || newPlayer.col >= columnas ||
            estado.mapa[newPlayer.fila][newPlayer.col] === '#') {
            return { ...estado }; // No se mueve nada
        }

        // 2. Verificar si hay cajas en el destino del jugador
        const cajaEnDestino = estado.cajas.some(caja => 
            caja.fila === newPlayer.fila && caja.col === newPlayer.col
        );

        if (!cajaEnDestino) {
            // Caso A: Movimiento libre (a piso o objetivo)
            const nuevoEstado = {
                mapa: estado.mapa, // El mapa no cambia
                jugador: { ...newPlayer },
                cajas: [...estado.cajas],
                objetivos: [...estado.objetivos],
                movimientos: estado.movimientos + 1
            };
            return nuevoEstado;
        } else {
            // Caso B: Intento de empujar una caja
            const cajasMovibles = [];
            let cajaEmpujadaIndex = -1;

            // Identificar la caja que está en el destino del jugador
            for (let i = 0; i < estado.cajas.length; i++) {
                if (estado.cajas[i].fila === newPlayer.fila && estado.cajas[i].col === newPlayer.col) {
                    cajaEmpujadaIndex = i;
                    break;
                }
            }

            // Coordenadas objetivo de la caja (un paso más allá del jugador)
            let targetBoxCoords = getTargetCoords(newPlayer.fila, newPlayer.col, direccion);

            // 3. Validación de empuje: ¿Puede moverse la caja?
            const esParedDetrasCaja = estado.mapa[targetBoxCoords.fila][targetBoxCoords.col] === '#';
            
            let hayOtraCajaDetras = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                // Comprobar si alguna otra caja está en la posición objetivo de la caja
                if (i !== cajaEmpujadaIndex && 
                    estado.cajas[i].fila === targetBoxCoords.fila && 
                    estado.cajas[i].col === targetBoxCoords.col) {
                    hayOtraCajaDetras = true;
                    break;
                }
            }

            if (esParedDetrasCaja || hayOtraCajaDetras) {
                return { ...estado }; // Empuje fallido: pared o caja bloquea el paso.
            } else {
                // Empuje exitoso
                const nuevoEstado = {
                    mapa: estado.mapa,
                    jugador: { ...newPlayer },
                    objetivos: [...estado.objetivos],
                    movimientos: estado.movimientos + 1,
                    cajas: [...estado.cajas]
                };

                // Actualizar la posición de la caja empujada
                nuevoEstado.cajas[cajaEmpujadaIndex] = { 
                    fila: targetBoxCoords.fila, 
                    col: targetBoxCoords.col 
                };
                return nuevoEstado;
            }
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return false;

        // Crear un set de coordenadas objetivo para fácil verificación
        const objetivosSet = new Set();
        estado.objetivos.forEach(obj => objectivesSet.add(`${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        let cajasSobreObjetivo = 0;
        for (const caja of estado.cajas) {
            if (objectivosSet.has(`${caja.fila},${caja.col}`)) {
                cajasSobreObjetivo++;
            }
        }

        // El nivel se gana si el número de cajas sobre objetivos es igual al total de objetivos
        return cajasSobreObjetivo === estado.objetivos.length;
    }
};
