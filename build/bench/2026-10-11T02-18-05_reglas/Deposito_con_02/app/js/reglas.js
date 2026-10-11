const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {{mapa: string[], jugador: {fila: number, col: number}, cajas: {fila: number, col: number}[], objetivos: {fila: number, col: number}[], movimientos: number}} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        return {
            mapa: nivel,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección dada. Maneja colisiones y empujes de cajas.
     * @param {{mapa: string[], jugador: {fila: number, col: number}, cajas: {fila: number, col: number}[], objetivos: {fila: number, col: number}[], movimientos: number}} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - La dirección del movimiento.
     * @returns {{mapa: string[], jugador: {fila: number, col: number}, cajas: {fila: number, col: number}[], objetivos: {fila: number, col: number}[], movimientos: number}} El nuevo estado (o el original si no hay movimiento).
     */
    mover(estado, direccion) {
        const { jugador, cajas } = estado;

        // 1. Definir vectores de dirección [dr, dc]
        let dr, dc;
        switch (direccion) {
            case "arriba":
                [dr, dc] = [-1, 0]; break;
            case "abajo":
                [dr, dc] = [1, 0]; break;
            case "izquierda":
                [dr, dc] = [0, -1]; break;
            case "derecha":
                [dr, dc] = [0, 1]; break;
        }

        // Coordenadas objetivo del jugador (P_next)
        const pNext = { fila: jugador.fila + dr, col: jugador.col + dc };

        // --- Validación de movimiento básico ---

        // 1. Chequear límites y paredes en P_next
        if (pNext.fila < 0 || pNext.fila >= estado.mapa.length ||
            pNext.col < 0 || pNext.col >= estado.mapa[0].length) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites
        }

        if (estado.mapa[pNext.fila][pNext.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Pared
        }

        // 2. Chequear si hay cajas en P_next
        const cajaEnPNext = cajas.some(c => c.fila === pNext.fila && c.col === pNext.col);

        if (!cajaEnPNext) {
            // Movimiento simple (sin colisión de caja)
            return Reglas._crearNuevoEstado(estado, { ...jugador, fila: pNext.fila, col: pNext.col }, cajas, estado.movimientos + 1);
        }

        // --- Manejo de Empuje (Pushing) ---

        // Si hay caja en P_next, calculamos la posición donde debe ir la caja (B_next)
        const bNext = { fila: pNext.fila + dr, col: pNext.col + dc };

        // 3. Chequear si B_next es válido para el empuje
        // A. ¿Está fuera de límites o contra una pared?
        if (bNext.fila < 0 || bNext.fila >= estado.mapa.length ||
            bNext.col < 0 || bNext.col >= estado.mapa[0].length) {
            return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (pared/límite)
        }

        if (estado.mapa[bNext.fila][bNext.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (pared)
        }

        // B. ¿Hay otra caja en B_next?
        const hayOtraCajaEnBNext = cajas.some(c => c.fila === bNext.fila && c.col === bNext.col);
        if (hayOtraCajaEnBNext) {
            return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (otra caja)
        }

        // 4. El empuje es exitoso
        const nuevoJugador = { ...jugador, fila: pNext.fila, col: pNext.col };
        let nuevasCajas = [];
        let cajaEmpujada = null;

        // Actualizar posiciones de las cajas
        for (const caja of cajas) {
            if (caja.fila === pNext.fila && caja.col === pNext.col) {
                // Esta es la caja que se empuja
                nuevasCajas.push({ fila: bNext.fila, col: bNext.col });
                cajaEmpujada = true;
            } else {
                // Otras cajas permanecen en su lugar
                nuevasCajas.push(caja);
            }
        }

        if (!cajaEmpujada) {
             // Esto no debería pasar si la lógica de cajaEnPNext es correcta, pero por seguridad:
             return { ...estado, movimientos: estado.movimientos };
        }


        // Devolver el nuevo estado con jugador actualizado, cajas actualizadas y movimiento incrementado
        return Reglas._crearNuevoEstado(estado, nuevoJugador, nuevasCajas, estado.movimientos + 1);
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {{mapa: string[], jugador: {fila: number, col: number}, cajas: {fila: number, col: number}[], objetivos: {fila: number, col: number}[], movimientos: number}} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado(estado) {
        const { cajas, objetivos } = estado;

        if (objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Creamos un set de coordenadas de las cajas para búsqueda rápida
        const cajaCoords = new Set(cajas.map(c => `${c.fila},${c.col}`));

        // Verificamos si cada objetivo tiene una caja encima
        for (const objetivo of objetivos) {
            if (!cajaCoords.has(`${objetivo.fila},${objetivo.col}`)) {
                return false; // Encontramos un objetivo sin caja
            }
        }
        return true; // Todos los objetivos tienen caja
    },

    /**
     * Método privado para crear una copia inmutable del estado con actualizaciones específicas.
     * @param {object} estado - Estado original.
     * @param {{fila: number, col: number}} nuevoJugador - Nueva posición del jugador.
     * @param {{fila: number, col: number}[]} nuevasCajas - Array de posiciones actualizadas de las cajas.
     * @param {number} nuevosMovimientos - Nuevo contador de movimientos.
     * @returns {object} El estado copiado y actualizado.
     */
    _crearNuevoEstado(estado, nuevoJugador, nuevasCajas, nuevosMovimientos) {
        return {
            mapa: [...estado.mapa], // Copia superficial del array de strings
            jugador: { ...nuevoJugador },
            cajas: [...nuevasCajas], // Copia profunda de las coordenadas de cajas
            objetivos: estado.objetivos, // Los objetivos no cambian
            movimientos: nuevosMovimientos
        };
    }
};
