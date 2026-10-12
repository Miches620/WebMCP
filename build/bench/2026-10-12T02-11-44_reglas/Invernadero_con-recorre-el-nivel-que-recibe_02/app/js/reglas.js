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

        // 1. Encontrar posiciones iniciales y construir el mapa base (solo #, ' ', '.')
        const mapaBase = nivel.map(fila => fila.split('')); // Clonar la estructura de caracteres

        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    // Limpiar el mapa base en la posición del jugador
                    mapaBase[r][c] = ' '; 
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    // Limpiar el mapa base en la posición de las cajas
                    mapaBase[r][c] = ' ';
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    // Los objetivos se mantienen como '.' en el mapa
                }
            }
        }

        return {
            mapa: mapaBase, // El mapa solo contiene '#', ' ', '.'
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas están sobre objetivos, el nivel se gana
        return true;
    },

    /**
     * Mueve al jugador y/o empuja macetas según la dirección.
     * @param {object} estado - El estado actual del juego (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado, o el estado original si no hay movimiento válido.
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let newPlayerPos = { ...jugador };
        let newCajas = [...cajas];
        let moved = false;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones aún)
        switch (direccion) {
            case "arriba":
                newPlayerPos.fila -= 1;
                break;
            case "abajo":
                newPlayerPos.fila += 1;
                break;
            case "izquierda":
                newPlayerPos.col -= 1;
                break;
            case "derecha":
                newPlayerPos.col += 1;
                break;
        }

        const { fila: pF, col: pC } = newPlayerPos;
        const mapa = estado.mapa;
        const altura = mapa.length;
        const ancho = mapa[0].length;

        // Validación de límites y paredes para el jugador
        if (pF < 0 || pF >= altura || pC < 0 || pC >= ancho || mapa[pF][pC] === '#') {
            return estado; // Colisión con pared o fuera del mapa
        }

        let cajaColisionada = null;
        let indiceCajaColisionada = -1;

        // 2. Verificar si el jugador intenta moverse a una posición ocupada por una caja
        for (let i = 0; i < cajas.length; i++) {
            const caja = cajas[i];
            if (caja.fila === pF && caja.col === pC) {
                cajaColisionada = caja;
                indiceCajaColisionada = i;
                break;
            }
        }

        // 3. Manejar el movimiento
        if (!cajaColisionada) {
            // Movimiento simple (sin cajas involucradas)
            const newState = {
                mapa: estado.mapa, // El mapa no cambia
                jugador: newPlayerPos,
                cajas: estado.cajas,
                objetivos: estado.objetivos,
                movimientos: estado.movimientos + 1
            };
            return newState;

        } else {
            // Intento de empuje (Pushing)
            let nuevaCajaPos = { ...cajaColisionada };
            
            // Calcular la posición objetivo para la caja
            switch (direccion) {
                case "arriba":
                    nuevaCajaPos.fila -= 1;
                    break;
                case "abajo":
                    nuevaCajaPos.fila += 1;
                    break;
                case "izquierda":
                    nuevaCajaPos.col -= 1;
                    break;
                case "derecha":
                    nuevaCajaPos.col += 1;
                    break;
            }

            // Validación de la posición objetivo para la caja:
            // a) Debe estar dentro del mapa y no ser pared.
            if (nuevaCajaPos.fila < 0 || nuevaCajaPos.fila >= altura || 
                nuevaCajaPos.col < 0 || nuevaCajaPos.col >= ancho || 
                mapa[nuevaCajaPos.fila][nuevaCajaPos.col] === '#') {
                return estado; // La caja choca contra una pared o límite
            }

            // b) No debe haber otra caja en la posición objetivo de la caja
            let colisionConOtraCaja = false;
            for (let i = 0; i < cajas.length; i++) {
                if (i !== indiceCajaColisionada && cajas[i].fila === nuevaCajaPos.fila && cajas[i].col === nuevaCajaPos.col) {
                    colisionConOtraCaja = true;
                    break;
                }
            }

            if (colisionConOtraCaja) {
                return estado; // La caja choca contra otra caja
            }

            // Movimiento exitoso de empuje:
            const nuevoEstado = {
                mapa: estado.mapa,
                jugador: newPlayerPos,
                cajas: [...cajas], // Clonar el array de cajas para modificarlo
                objetivos: estado.objetivos,
                movimientos: estado.movimientos + 1
            };

            // Actualizar la posición de la caja empujada en el nuevo estado
            nuevoEstado.cajas[indiceCajaColisionada] = nuevaCajaPos;
            return nuevoEstado;
        }
    }
};
