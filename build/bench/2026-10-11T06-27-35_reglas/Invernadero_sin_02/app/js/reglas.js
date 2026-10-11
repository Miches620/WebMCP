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
        let nuevoMapa = [];

        // Paso 1: Identificar posiciones y construir el mapa limpio
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = "";
            for (let c = 0; c < nivel[r].length; c++) {
                const simbolo = nivel[r][c];

                if (simbolo === '@') {
                    jugador = { fila: r, col: c };
                    filaActual += ' '; // El jugador ocupa un espacio vacío en el mapa limpio
                } else if (simbolo === '$' || simbolo === '*') {
                    cajas.push({ fila: r, col: c });
                    filaActual += ' '; // Las cajas ocupan un espacio vacío en el mapa limpio
                } else if (simbolo === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual += '.';
                } else if (simbolo === '#') {
                    filaActual += '#';
                } else { // ' ' o cualquier otro símbolo que no sea de inicio
                    filaActual += ' ';
                }
            }
            nuevoMapa.push(filaActual);
        }

        // Asegurarse de que el mapa final solo contenga #, ' ', y '.'
        const estado = {
            mapa: nuevoMapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugador = estado.jugador;
        let nuevaPosicionJugador = { ...jugador };
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (P_next)
        let pNext = { ...jugador };
        if (direccion === "arriba") pNext.fila--;
        else if (direccion === "abajo") pNext.fila++;
        else if (direccion === "izquierda") pNext.col--;
        else if (direccion === "derecha") pNext.col++;

        // 2. Validaciones básicas de movimiento del jugador
        const mapa = estado.mapa;
        const maxFila = mapa.length - 1;
        const maxCol = mapa[0].length - 1;

        if (pNext.fila < 0 || pNext.fila > maxFila || pNext.col < 0 || pNext.col > maxCol) {
            return estado; // Fuera de límites
        }

        // Verificar si el destino es una pared
        if (mapa[pNext.fila][pNext.col] === '#') {
            return estado;
        }

        let cajaAEmpujar = null;
        let indiceCaja = -1;

        // 3. Comprobar colisión con cajas
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === pNext.fila && caja.col === pNext.col) {
                // El jugador intenta moverse a una casilla con una caja
                cajaAEmpujar = caja;
                indiceCaja = i;
                break;
            }
        }

        if (cajaAEmpujar) {
            // Intentar empujar la caja
            let pBoxNext = { ...cajaAEmpujar };
            if (direccion === "arriba") pBoxNext.fila--;
            else if (direccion === "abajo") pBoxNext.fila++;
            else if (direccion === "izquierda") pBoxNext.col--;
            else if (direccion === "derecha") pBoxNext.col++;

            // Validaciones para el destino de la caja:
            // a) No puede ser pared ni fuera de límites
            if (pBoxNext.fila < 0 || pBoxNext.fila > maxFila || pBoxNext.col < 0 || pBoxNext.col > maxCol || mapa[pBoxNext.fila][pBoxNext.col] === '#') {
                return estado; // La caja choca contra una pared o límite
            }

            // b) No puede haber otra caja en el destino de la caja
            let colisionCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCaja && estado.cajas[i].fila === pBoxNext.fila && estado.cajas[i].col === pBoxNext.col) {
                    colisionCaja = true;
                    break;
                }
            }

            if (colisionCaja) {
                return estado; // La caja choca contra otra caja
            }

            // ¡Empuje exitoso! Actualizar el estado de la caja y del jugador.
            nuevoEstado.cajas[indiceCaja] = pBoxNext;
            nuevaPosicionJugador = { ...cajaAEmpujar }; // El jugador va donde estaba la caja
            movimientoExitoso = true;

        } else {
            // Movimiento simple (a espacio vacío o objetivo)
            nuevaPosicionJugador = pNext;
            movimientoExitoso = true;
        }

        if (movimientoExitoso) {
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
        } else {
            // Si no hubo movimiento exitoso, devolver el estado original sin cambios
            return estado;
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const cajas = estado.cajas;
        const objetivos = estado.objetivos;

        if (cajas.length !== objetivos.length) {
            // Si no hay la misma cantidad de macetas que objetivos, no se puede ganar.
            return false;
        }

        for (let i = 0; i < cajas.length; i++) {
            const cajaPos = estado.cajas[i];
            const objetivoPos = objetivos[i]; // Asumimos un orden de correspondencia simple, aunque el contrato no lo garantiza, es la forma más lógica para este puzzle.

            // Verificamos si cada caja está en una posición que coincide con algún objetivo.
            let encontradoObjetivo = false;
            for (const obj of objetivos) {
                if (cajaPos.fila === obj.fila && cajaPos.col === obj.col) {
                    encontradoObjetivo = true;
                    break;
                }
            }

            if (!encontradoObjetivo) {
                return false; // Al menos una caja no está sobre un objetivo
            }
        }

        // Si iteramos por todas las cajas y todas están en objetivos, se ganó.
        return true;
    }
};
