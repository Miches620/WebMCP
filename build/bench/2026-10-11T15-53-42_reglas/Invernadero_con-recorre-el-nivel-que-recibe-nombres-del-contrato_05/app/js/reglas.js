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
        let cajasArray = [];
        let objetivosArray = [];

        // Recorrer el mapa para encontrar posiciones iniciales
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

        // El mapa de estado solo contiene elementos estáticos (#, ' ', .)
        const mapaEstado = nivel.map(fila => Array.from(fila));

        return {
            mapa: mapaEstado,
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };
    },

    /**
     * Determina si el estado actual cumple la condición de victoria.
     * Se gana cuando todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set();
        estado.objetivos.forEach(obj => {
            objetivosSet.add(`${obj.fila},${obj.col}`);
        });

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas están sobre objetivos, se gana
        return true;
    },

    /**
     * Intenta mover al jugador y/o empujar macetas según la dirección.
     * @param {object} estado - El estado actual del juego (no se modifica).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado que refleja el movimiento o el intento fallido.
     */
    mover: function(estado, direccion) {
        // 1. Crear un estado base para devolver si no hay cambios (movimiento inválido)
        const estadoBase = JSON.parse(JSON.stringify(estado));

        let jugadorNuevoPos = null;
        let cajasNuevas = [...estado.cajas];
        let movimientosIncrementados = false;

        // Función auxiliar para calcular la posición objetivo
        const getTargetPos = (pos, dir) => {
            switch (dir) {
                case "arriba": return { fila: pos.fila - 1, col: pos.col };
                case "abajo": return { fila: pos.fila + 1, col: pos.col };
                case "izquierda": return { fila: pos.fila, col: pos.col - 1 };
                case "derecha": return { fila: pos.fila, col: pos.col + 1 };
            }
        };

        // Calcular la posición objetivo del jugador
        jugadorNuevoPos = getTargetPos(estado.jugador, direccion);

        // Verificar límites y paredes (usando el mapa estático)
        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        if (jugadorNuevoPos.fila < 0 || jugadorNuevoPos.fila >= filas ||
            jugadorNuevoPos.col < 0 || jugadorNuevoPos.col >= columnas) {
            return estadoBase; // Fuera de límites
        }

        // Si el destino es una pared, no se puede mover
        if (estado.mapa[jugadorNuevoPos.fila][jugadorNuevoPos.col] === '#') {
            return estadoBase;
        }

        let cajaAEmpujar = null;
        let indiceCajaAEmpujar = -1;

        // 2. Verificar si el destino del jugador contiene una caja
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === jugadorNuevoPos.fila && caja.col === jugadorNuevoPos.col) {
                cajaAEmpujar = caja;
                indiceCajaAEmpujar = i;
                break;
            }
        }

        // 3. Lógica de movimiento
        if (cajaAEmpujar) {
            // Intentar empujar la caja
            const posDestinoCaja = getTargetPos(cajaAEmpujar, direccion);

            // Verificar si el destino del empuje es válido:
            // a) No puede ser pared o fuera de límites.
            if (posDestinoCaja.fila < 0 || posDestinoCaja.fila >= filas ||
                posDestinoCaja.col < 0 || posDestinoCaja.col >= columnas ||
                estado.mapa[posDestinoCaja.fila][posDestinoCaja.col] === '#') {
                return estadoBase; // Empuje bloqueado por pared/límite
            }

            // b) No puede haber otra caja en el destino del empuje.
            let hayOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCajaAEmpujar && estado.cajas[i].fila === posDestinoCaja.fila && estado.cajas[i].col === posDestinoCaja.col) {
                    hayOtraCaja = true;
                    break;
                }
            }

            if (hayOtraCaja) {
                return estadoBase; // Empuje bloqueado por otra caja
            }

            // Movimiento exitoso: Jugador y Caja se mueven
            const nuevoEstado = JSON.parse(JSON.stringify(estado));

            // Mover jugador
            nuevoEstado.jugador = jugadorNuevoPos;

            // Mover la caja (actualizar el array de cajas)
            cajasNuevas[indiceCajaAEmpujar] = posDestinoCaja;
            nuevoEstado.cajas = cajasNuevas;

            nuevoEstado.movimientos = estado.movimientos + 1;
            return nuevoEstado;

        } else {
            // El destino es un espacio libre (o objetivo). Solo se mueve el jugador.
            const nuevoEstado = JSON.parse(JSON.stringify(estado));

            // Mover solo al jugador
            nuevoEstado.jugador = jugadorNuevoPos;
            nuevoEstado.movimientos = estado.movimientos + 1;
            return nuevoEstado;
        }
    }
};
