const Reglas = {

    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} Estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let nuevoMapa = [];

        for (let r = 0; r < 9; r++) {
            let filaActual = nivel[r].split('');
            nuevoMapa.push([]);

            for (let c = 0; c < 9; c++) {
                const simbolo = filaActual[c];
                if (simbolo === '@') {
                    jugador = { r: r, c: c };
                    nuevoMapa[r].push(' '); // El jugador ocupa un espacio vacío en el estado base
                } else if (simbolo === '$' || simbolo === '*') {
                    cajas.push({ r: r, c: c });
                    nuevoMapa[r].push(' '); // La caja ocupa un espacio vacío en el estado base
                } else if (simbolo === '.') {
                    objetivos.push({ r: r, c: c });
                    nuevoMapa[r].push('.');
                } else if (simbolo === '#') {
                    nuevoMapa[r].push('#');
                } else { // ' '
                    nuevoMapa[r].push(' ');
                }
            }
        }

        // Convertir el array de arrays a un array de strings para mantener la estructura del mapa base.
        const mapaString = nuevoMapa.map(row => row.join(''));

        return {
            mapa: mapaString,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Verifica si las coordenadas (r, c) son válidas y no están en una pared.
     * @param {number} r - Fila.
     * @param {number} c - Columna.
     * @param {string[]} mapaBase - El mapa base del nivel.
     * @returns {boolean} True si es un espacio válido (no pared y dentro de límites).
     */
    _isValid(r, c, mapaBase) {
        if (r < 0 || r >= 9 || c < 0 || c >= 9) return false;
        // Solo se puede pasar por espacios vacíos o objetivos. Paredes son '#'.
        return mapaBase[r][c] !== '#';
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento deseado.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover(estado, direccion) {
        const jugador = estado.jugador;
        let dr, dc;

        switch (direccion) {
            case "arriba": dr = -1; dc = 0; break;
            case "abajo": dr = 1; dc = 0; break;
            case "izquierda": dr = 0; dc = -1; break;
            case "derecha": dr = 0; dc = 1; break;
        }

        const nextPlayerR = jugador.r + dr;
        const nextPlayerC = jugador.c + dc;

        // 1. Verificar si el movimiento del jugador es posible (paredes/límites)
        if (!Reglas._isValid(nextPlayerR, nextPlayerC, estado.mapa)) {
            return { ...estado, movimientos: estado.movimientos }; // No hay cambio de estado ni movimientos
        }

        // 2. Verificar si el destino es una caja
        const boxAtTarget = estado.cajas.some(box => box.r === nextPlayerR && box.c === nextPlayerC);

        if (!boxAtTarget) {
            // Caso A: Movimiento simple (a espacio vacío o objetivo)
            return Reglas._createNuevoEstado(estado, jugador, { r: nextPlayerR, c: nextPlayerC }, estado.cajas, state.objetivos, estado.movimientos + 1);
        } else {
            // Caso B: Intento de empuje (Box collision)

            const boxToPush = estado.cajas.find(box => box.r === nextPlayerR && box.c === nextPlayerC);
            
            // Calcular la posición donde debe ir la caja después del empuje
            const pushTargetR = nextPlayerR + dr;
            const pushTargetC = nextPlayerC + dc;

            // Verificar si el destino final de la caja es válido (no pared, no fuera de límites)
            if (!Reglas._isValid(pushTargetR, pushTargetC, estado.mapa)) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje fallido por pared/límite
            }

            // Verificar si el destino final está ocupado por otra caja (colisión de cajas)
            const boxCollision = estado.cajas.some(box => 
                (box !== boxToPush) && (box.r === pushTargetR && box.c === pushTargetC)
            );

            if (boxCollision) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje fallido por otra caja
            }

            // Éxito en el empuje
            const nuevasCajas = estado.cajas.map(box => 
                (box === boxToPush) ? { r: pushTargetR, c: pushTargetC } : box
            );

            return Reglas._createNuevoEstado(estado, jugador, { r: nextPlayerR, c: nextPlayerC }, nuevasCajas, estado.objetivos, estado.movimientos + 1);
        }
    },

    /**
     * Verifica si todas las macetas están sobre un cantero objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel se ha ganado.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.r},${obj.c}`));

        // Verificar si cada caja está en el conjunto de objetivos
        return estado.cajas.every(box => {
            return objetivosSet.has(`${box.r},${box.c}`);
        });
    },

    /**
     * Función interna para crear un nuevo objeto estado, manteniendo la inmutabilidad.
     */
    _createNuevoEstado(estado, nuevoJugador, nuevasCajas, objetivos, nuevosMovimientos) {
        // Nota: Los objetivos no cambian de posición en el juego.
        return {
            mapa: estado.mapa, // El mapa base es estático
            jugador: nuevoJugador,
            cajas: nuevasCajas,
            objetivos: objetivos,
            movimientos: nuevosMovimientos
        };
    }
};

// Exponer la constante Reglas para que el resto del código pueda usarla.
// El harness espera esta estructura global.
