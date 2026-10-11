const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (9x9).
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
    let jugador = null;
    let cajas = [];
    let objetivos = [];

    const R = nivel.length;
    if (R === 0) {
        return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
    }
    // Asumimos que todas las filas tienen la misma longitud
    const C = nivel[0].length;

    // 1. Identificar posiciones clave y construir el mapa base (sin $, @)
    for (let r = 0; r < R; r++) {
        const row = nivel[r];
        if (!row) continue; // Seguridad si alguna fila es nula/indefinida

        for (let c = 0; c < C; c++) {
            const char = row[c];
            if (char === '@') {
                jugador = { fila: r, col: c };
            } else if (char === '$') {
                cajas.push({ fila: r, col: c });
            } else if (char === '.') {
                objetivos.push({ fila: r, col: c });
            }
        }
    }

    // 2. Crear el mapa de estado (solo #, ' ', '.') como un array de strings
    const mapaEstado = [];
    for (let r = 0; r < R; r++) {
        let rowString = '';
        const row = nivel[r];
        if (!row) continue;

        for (let c = 0; c < C; c++) {
            const char = row[c];
            let mappedChar;
            if (char === '#') {
                mappedChar = '#'; // Pared
            } else if (char === '.') {
                mappedChar = '.'; // Objetivo
            } else {
                // Esto cubre ' ', '$', y '@' que se convierten en piso vacío.
                mappedChar = ' '; 
            }
            rowString += mappedChar;
        }
        mapaEstado[r] = rowString;
    }

    return {
        mapa: mapaEstado,
        jugador: jugador,
        cajas: cajas,
        objetivos: objetivos,
        movimientos: 0
    };
},

    /**
     * Verifica si el estado actual cumple la condición de victoria.
     * @param {object} estado - El estado del juego.
     * @returns {boolean} True si todas las macetas están sobre un objetivo.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length !== estado.objetivos.length) {
            // Si no hay objetivos o el número de cajas no coincide, asumimos que no se puede ganar por esta regla.
            return false;
        }

        const cajaPosiciones = new Set(estado.cajas.map(c => `${c.fila},${c.col}`));
        let todasCubiertas = true;

        for (const objetivo of estado.objetivos) {
            const objKey = `${objetivo.fila},${objetivo.col}`;
            if (!cajaPosiciones.has(objKey)) {
                todasCubiertas = false;
                break;
            }
        }

        return todasCubiertas;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual (se devuelve un nuevo estado).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Nuevo estado o el estado original si no hay movimiento posible.
     */
    mover(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let pR = estado.jugador.fila;
        let pC = estado.jugador.col;
        let nextPR = pR;
        let nextPC = pC;

        // 1. Calcular la posición potencial del jugador (nextPlayerPos)
        switch (direccion) {
            case "arriba":
                nextPR -= 1;
                break;
            case "abajo":
                nextPR += 1;
                break;
            case "izquierda":
                nextPC -= 1;
                break;
            case "derecha":
                nextPC += 1;
                break;
        }

        // Helper para verificar si una posición es válida (dentro de límites y no pared)
        const isValidPos = (r, c) => {
            if (r < 0 || r >= 9 || c < 0 || c >= 9) return false; // Fuera de límites
            return estado.mapa[r][c] !== '#'; // No es pared
        };

        // Verificar si el movimiento del jugador es posible en la posición potencial
        if (!isValidPos(nextPR, nextPC)) {
            return nuevoEstado; // Colisión con pared o límite
        }

        // 2. Comprobar interacción con cajas
        const cajaEnTarget = estado.cajas.some(c => c.fila === nextPR && c.col === nextPC);

        if (!cajaEnTarget) {
            // Caso A: Movimiento simple (sin macetas involucradas)
            nuevoEstado.jugador = { fila: nextPR, col: nextPC };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empujar una caja
            let pushTargetR = nextPR;
            let pushTargetC = nextPC;

            // Calcular la posición destino del empuje (detrás de la caja)
            switch (direccion) {
                case "arriba":
                    pushTargetR -= 1;
                    break;
                case "abajo":
                    pushTargetR += 1;
                    break;
                case "izquierda":
                    pushTargetC -= 1;
                    break;
                case "derecha":
                    pushTargetC += 1;
                    break;
            }

            // Verificar si el destino del empuje es válido (no pared, no fuera de límites)
            if (!isValidPos(pushTargetR, pushTargetC)) {
                return nuevoEstado; // Empujado contra pared o límite
            }

            // Verificar si hay otra caja en la posición destino del empuje
            const boxCollisionAtPush = estado.cajas.some(c => c.fila === pushTargetR && c.col === pushTargetC);

            if (boxCollisionAtPush) {
                return nuevoEstado; // Empujado contra otra caja
            }

            // 3. Movimiento exitoso de empuje
            nuevoEstado.jugador = { fila: nextPR, col: nextPC };
            nuevoEstado.movimientos += 1;

            // Actualizar cajas: encontrar la caja movida y actualizar su posición
            const nuevasCajas = estado.cajas.map(c => {
                if (c.fila === nextPR && c.col === nextPC) {
                    // Esta es la caja que se mueve
                    return { fila: pushTargetR, col: pushTargetC };
                } else {
                    return c; // Otras cajas permanecen igual
                }
            });

            nuevoEstado.cajas = nuevasCajas;
            return nuevoEstado;
        }
    }
};
