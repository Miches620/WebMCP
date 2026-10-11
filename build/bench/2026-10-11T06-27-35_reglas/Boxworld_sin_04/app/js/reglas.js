const Reglas = {

    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 10x10.
     * @returns {object} El estado inicial del juego.
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
                } else if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        return {
            mapa: nivel, // Solo contiene '#', ' ', '.'
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección dada.
     * @param {object} estado - El estado actual del juego (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado o el estado original si el movimiento es imposible.
     */
    mover(estado, direccion) {
        // 1. Crear un estado base para posibles cambios (copia profunda necesaria)
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let dr, dc;
        switch (direccion) {
            case "arriba":
                dr = -1; dc = 0; break;
            case "abajo":
                dr = 1; dc = 0; break;
            case "izquierda":
                dr = 0; dc = -1; break;
            case "derecha":
                dr = 0; dc = 1; break;
        }

        const { fila: r, col: c } = estado.jugador;
        let nuevaFila = r + dr;
        let nuevaCol = c + dc;

        // Verificar límites y paredes en la posición objetivo del jugador (P_new)
        if (nuevaFila < 0 || nuevaFila >= 10 || nuevaCol < 0 || nuevaCol >= 10 || estado.mapa[nuevaFila][nuevaCol] === '#') {
            return nuevoEstado; // Colisión con pared o límite
        }

        // Verificar si la posición P_new está ocupada por una caja
        const cajaEnPew = estado.cajas.some(box => box.fila === nuevaFila && box.col === nuevaCol);

        if (!cajaEnPew) {
            // Caso 1: Movimiento a un espacio vacío o objetivo (No hay cajas involucradas)
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Colisión con una caja. Intentar empujar.

            // Encontrar la caja específica que está en P_new
            const cajaAEmpujar = estado.cajas.find(box => box.fila === nuevaFila && box.col === nuevaCol);

            // Calcular la posición donde iría la caja (B_new)
            let bNuevaFila = nuevaFila + dr;
            let bNuevaCol = nuevaCol + dc;

            // Verificar si el destino de la caja es válido:
            // 1. No puede ser pared o límite.
            if (bNuevaFila < 0 || bNuevaFila >= 10 || bNuevaCol < 0 || bNuevaCol >= 10 || estado.mapa[bNuevaFila][bNuevaCol] === '#') {
                return nuevoEstado; // La caja está contra una pared, no se puede empujar.
            }

            // 2. No puede haber otra caja ni el jugador en B_new (solo debe ser un espacio vacío o objetivo).
            const hayObstaculoEnBNew = estado.cajas.some(box => box !== cajaAEmpujar && box.fila === bNuevaFila && box.col === bNuevaCol);

            if (hayObstaculoEnBNew) {
                return nuevoEstado; // La caja está bloqueada por otra caja.
            }

            // Si llegamos aquí, el empuje es posible.
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            nuevoEstado.movimientos += 1;

            // Actualizar la posición de la caja en el nuevo estado
            const nuevasCajas = estado.cajas.map(box => {
                if (box === cajaAEmpujar) {
                    return { fila: bNuevaFila, col: bNuevaCol }; // La caja se mueve
                } else {
                    return box; // Otras cajas permanecen en su lugar
                }
            });

            nuevoEstado.cajas = nuevasCajas;
            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set();
        state.objetivos.forEach(obj => objectivesSet.add(`${obj.fila},${obj.col}`));

        let cajasSobreObjetivoCount = 0;

        for (const caja of estado.cajas) {
            if (objectivosSet.has(`${caja.fila},${caja.col}`)) {
                cajasSobreObjetivoCount++;
            }
        }

        // El nivel está ganado si el número de cajas sobre objetivos es igual al total de objetivos.
        return cajasSobreObjetivoCount === state.objetivos.length;
    }
};
