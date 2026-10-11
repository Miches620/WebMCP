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
     * @returns {boolean} True si es un espacio válido, False si es pared o fuera de límites.
     */
    _isValid(r, c, mapaBase) {
        if (r < 0 || r >= 9 || c < 0 || c >= 9) return false;
        // Solo se puede pasar por espacios vacíos (' ') o objetivos ('.')
        return mapaBase[r][c] !== '#';
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover(estado, direccion) {
        const { jugador: p } = estado;
        let dr, dc;

        switch (direccion) {
            case "arriba": dr = -1; dc = 0; break;
            case "abajo": dr = 1; dc = 0; break;
            case "izquierda": dr = 0; dc = -1; break;
            case "derecha": dr = 0; dc = 1; break;
        }

        const pNextR = p.r + dr;
        const pNextC = p.c + dc;

        // 1. Verificar si el jugador puede moverse a la posición siguiente (pNext)
        if (!Reglas._isValid(pNextR, pNextC, estado.mapa)) {
            return { ...estado, movimientos: estado.movimientos }; // Bloqueado por pared o límite
        }

        // 2. Verificar si hay cajas en la posición siguiente (pNext)
        const cajaEnPNext = estado.cajas.some(box => box.r === pNextR && box.c === pNextC);

        if (!cajaEnPNext) {
            // Caso A: Movimiento simple (a espacio vacío o objetivo)
            return Reglas._moveSimple(estado, pNextR, pNextC, dr, dc);
        } else {
            // Caso B: Intento de empujar una caja
            const boxToPush = estado.cajas.find(box => box.r === pNextR && box.c === pNextC);

            // Calcular la posición donde debe ir la caja (B_next)
            const bNextR = pNextR + dr;
            const bNextC = pNextC + dc;

            // Verificar si el destino de la caja es válido y no está bloqueado por otra cosa.
            if (!Reglas._isValid(bNextR, bNextC, estado.mapa)) {
                return { ...estado, movimientos: estado.movimientos }; // Bloqueado contra pared o límite
            }

            // Verificar si el destino de la caja está ocupado por otra caja (excluyendo la que estamos empujando)
            const hayOtraCajaEnBNext = estado.cajas.some(box => 
                (box !== boxToPush) && (box.r === bNextR && box.c === bNextC)
            );

            if (hayOtraCajaEnBNext) {
                return { ...estado, movimientos: estado.movimientos }; // Bloqueado contra otra caja
            }

            // Empuje exitoso
            const nuevoEstado = Reglas._push(estado, boxToPush, bNextR, bNextC);
            return nuevoEstado;
        }
    },

    /**
     * Maneja el movimiento simple del jugador.
     */
    _moveSimple(estado, pNextR, pNextC, dr, dc) {
        // Crear un nuevo estado inmutable
        const nuevoJugador = { r: pNextR, c: pNextC };

        // Actualizar cajas y objetivos (no cambian de posición)
        const nuevasCajas = [...estado.cajas];
        const nouveauxObjetivos = [...estado.objetivos];

        return {
            mapa: estado.mapa, // El mapa base no cambia en el movimiento simple
            jugador: nuevoJugador,
            cajas: nuevasCajas,
            objetivos: nouveauxObjetivos,
            movimientos: estado.movimientos + 1
        };
    },

    /**
     * Maneja la lógica de empuje exitoso.
     */
    _push(estado, boxToPush, bNextR, bNextC) {
        // 1. Nuevo jugador se mueve a donde estaba la caja
        const nuevoJugador = { r: boxToPush.r, c: boxToPush.c };

        // 2. La caja se mueve a la nueva posición (bNext)
        const nuevaCajaMovida = { r: bNextR, c: bNextC };

        // 3. Crear el nuevo array de cajas: reemplazar la caja movida y mantener las demás
        let nuevasCajas = estado.cajas.filter(box => 
            !(box.r === boxToPush.r && box.c === boxToPush.c)
        );
        nuevasCajas.push(nuevaCajaMovida);

        // Crear el nuevo estado inmutable
        return {
            mapa: estado.mapa,
            jugador: nuevoJugador,
            cajas: nuevasCajas,
            objetivos: estado.objetivos,
            movimientos: estado.movimientos + 1
        };
    },

    /**
     * Verifica si todas las macetas están sobre un cantero objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel se ha ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Convertir objetivos a un Set de coordenadas para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.r},${obj.c}`));

        // Verificar que cada caja esté en el set de objetivos
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.r},${caja.c}`)) {
                return false; // Hay al menos una caja fuera de un objetivo
            }
        }

        // Si todas las cajas están en objetivos, y el número de cajas es igual al número de objetivos (implícito por la lógica del juego), se gana.
        return true;
    }
};
