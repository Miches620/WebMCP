const Reglas = {
    /**
     * Crea un nuevo estado inicial a partir del mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} Estado inicial del juego.
     */
crearEstado(nivel) {
    let jugador = null;
    let cajas = [];
    let objetivos = [];

    // Determinar dimensiones dinámicamente
    const R = nivel.length;
    if (R === 0) {
        return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
    }
    const C = nivel[0].length;

    // El mapa limpio solo contiene '#', ' ', '.'
    const mapaLimpio = nivel.map(fila => fila.split('').filter((char) => 
        !['@', '$'].includes(char)
    ).join(''));

    for (let r = 0; r < R; r++) {
        // Asegurarse de que la fila existe y tiene longitud C
        if (!nivel[r] || nivel[r].length !== C) continue;

        for (let c = 0; c < C; c++) {
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
        mapa: mapaLimpio,
        jugador: jugador,
        cajas: cajas,
        objetivos: objetivos,
        movimientos: 0
    };
},

    /**
     * Intenta mover al jugador según la dirección. Maneja colisiones y empujes de cajas.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (inmutable) con el movimiento aplicado o sin cambios si colisiona.
     */
    mover(estado, direccion) {
        let { jugador, cajas, movimientos } = estado;

        // 1. Calcular la posición objetivo del jugador
        let nextPlayerPos = { ...jugador };
        switch (direccion) {
            case "arriba":
                nextPlayerPos.fila -= 1;
                break;
            case "abajo":
                nextPlayerPos.fila += 1;
                break;
            case "izquierda":
                nextPlayerPos.col -= 1;
                break;
            case "derecha":
                nextPlayerPos.col += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        if (nextPlayerPos.fila < 0 || nextPlayerPos.fila > 7 || nextPlayerPos.col < 0 || nextPlayerPos.col > 7) {
            return { ...estado, movimientos: movimientos }; // No se mueve si está fuera de límites
        }

        // Verificar pared en la posición objetivo (usando el mapa limpio)
        if (estado.mapa[nextPlayerPos.fila][nextPlayerPos.col] === '#') {
            return { ...estado, movimientos: movimientos }; // Colisión con pared
        }

        let nuevoEstado = { 
            ...estado, 
            movimientos: movimientos 
        };
        let jugadorMovido = false;
        let cajasMovidas = [];

        // 2. Verificar si la posición objetivo está ocupada por una caja
        const boxAtTargetIndex = cajas.findIndex(box => 
            box.fila === nextPlayerPos.fila && box.col === nextPlayerPos.col
        );

        if (boxAtTargetIndex !== -1) {
            // Hay una caja en el destino, intentar empujar
            const cajaAEmpujar = cajas[boxAtTargetIndex];
            let posDetrasCaja = { ...cajaAEmpujar };

            // Calcular la posición detrás de la caja (donde debe ir la caja)
            switch (direccion) {
                case "arriba":
                    posDetrasCaja.fila -= 1;
                    break;
                case "abajo":
                    posDetrasCaja.fila += 1;
                    break;
                case "izquierda":
                    posDetrasCaja.col -= 1;
                    break;
                case "derecha":
                    posDetrasCaja.col += 1;
                    break;
            }

            // Verificar si el movimiento de la caja es válido:
            // 1. No puede salir del mapa (límites)
            if (posDetrasCaja.fila < 0 || posDetrasCaja.fila > 7 || posDetrasCaja.col < 0 || posDetrasCaja.col > 7) {
                return { ...estado, movimientos: movimientos }; // Colisión con borde
            }

            // 2. No puede chocar contra una pared en el destino de la caja
            if (estado.mapa[posDetrasCaja.fila][posDetrasCaja.col] === '#') {
                return { ...estado, movimientos: movimientos }; // Colisión con pared detrás de la caja
            }

            // 3. No puede chocar contra otra caja en el destino de la caja
            const collisionWithBox = cajas.some(box => 
                box !== cajaAEmpujar && box.fila === posDetrasCaja.fila && box.col === posDetrasCaja.col
            );

            if (collisionWithBox) {
                return { ...estado, movimientos: movimientos }; // Colisión con otra caja detrás de la caja
            }

            // --- Empuje exitoso ---
            nuevoEstado.movimientos = movimientos + 1;
            
            // Actualizar cajas: mover la caja empujada y crear una nueva lista de cajas
            const nuevasCajas = [...cajas];
            nuevasCajas[boxAtTargetIndex] = { ...cajaAEmpujar, fila: posDetrasCaja.fila, col: posDetrasCaja.col };
            nuevoEstado.cajas = nuevasCajas;

            // Actualizar jugador: el jugador se mueve a la posición de la caja original
            nuevoEstado.jugador = { ...cajaAEmpujar, fila: nextPlayerPos.fila, col: nextPlayerPos.col };
            
            // El estado final es el nuevo estado con cajas y jugador actualizados
            return nuevoEstado;

        } else {
            // 3. Movimiento simple (sin caja)
            nuevoEstado.jugador = nextPlayerPos;
            nuevoEstado.movimientos = movimientos + 1;
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
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está en un objetivo
            }
        }

        // Si todas las cajas fueron revisadas y están sobre objetivos, se gana.
        return true;
    }
};
