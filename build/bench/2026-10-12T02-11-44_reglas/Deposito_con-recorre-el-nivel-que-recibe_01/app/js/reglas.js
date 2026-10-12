const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let mapa = [];
        let jugador = { fila: -1, col: -1 };
        let cajas = [];
        let objetivos = [];

        for (let r = 0; r < filas; r++) {
            let filaMapa = [];
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaMapa.push('#'); // Pared
                } else if (char === '.') {
                    filaMapa.push('.'); // Objetivo
                    objetivos.push({ fila: r, col: c });
                } else if (char === ' ') {
                    filaMapa.push(' '); // Piso vacío
                } else if (char === '@') {
                    // Inicialmente el jugador está en este punto
                    if (r < filas && c < columnas) {
                        jugador = { fila: r, col: c };
                        filaMapa[c] = ' '; // El mapa solo guarda piso/objetivo
                    } else {
                         filaMapa[c] = ' ';
                    }
                } else if (char === '$') {
                    // Inicialmente hay una caja aquí
                    if (r < filas && c < columnas) {
                        cajas.push({ fila: r, col: c });
                        filaMapa[c] = ' '; // El mapa solo guarda piso/objetivo
                    }
                } else {
                     filaMapa.push(' ');
                }
            }
            mapa.push(filaMapa);
        }

        return {
            mapa: mapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (inmutable) con el movimiento aplicado o sin cambios si colisiona.
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevaCajas = [...cajas];
        let nuevoJugador = { ...jugador };
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (targetPlayerPos)
        let targetPlayerPos = { fila: jugador.fila, col: jugador.col };
        switch (direccion) {
            case "arriba":
                targetPlayerPos.fila -= 1;
                break;
            case "abajo":
                targetPlayerPos.fila += 1;
                break;
            case "izquierda":
                targetPlayerPos.col -= 1;
                break;
            case "derecha":
                targetPlayerPos.col += 1;
                break;
        }

        // Helper para verificar si una posición está dentro del mapa y no es pared
        const esValidoPiso = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            // Si el mapa en esa posición es '#', es pared.
            return estado.mapa[r][c] !== '#';
        };

        // Helper para verificar si una caja está en una posición dada
        const estaCajaEn = (r, c) => {
            return cajas.some(caja => caja.fila === r && caja.col === c);
        };

        // 2. Verificar colisión con paredes o límites del mapa para el jugador
        if (!esValidoPiso(targetPlayerPos.fila, targetPlayerPos.col)) {
            return { ...estado, movimientos: estado.movimientos }; // No se mueve nada
        }

        let cajaAEmpujar = null;
        // 3. Verificar si el jugador intenta empujar una caja
        if (estaCajaEn(targetPlayerPos.fila, targetPlayerPos.col)) {
            cajaAEmpujar = cajas.find(c => c.fila === targetPlayerPos.fila && c.col === targetPlayerPos.col);

            // Calcular la posición destino de la caja (detrás del jugador)
            let destFila = cajaAEmpujar.fila;
            let destCol = cajaAEmpujar.col;
            switch (direccion) {
                case "arriba":
                    destFila -= 1;
                    break;
                case "abajo":
                    destFila += 1;
                    break;
                case "izquierda":
                    destCol -= 1;
                    break;
                case "derecha":
                    destCol += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido (no pared, no fuera de límites)
            if (!esValidoPiso(destFila, destCol)) {
                 return { ...estado, movimientos: estado.movimientos }; // Colisión con pared/borde
            }

            // Verificar si hay otra caja en el destino de la caja (colisión lateral)
            const colisionCajaDestino = estaCajaEn(destFila, destCol);
            if (colisionCajaDestino) {
                return { ...estado, movimientos: estado.movimientos }; // Colisión con otra caja
            }

            // --- Empuje exitoso ---
            nuevoJugador = { fila: targetPlayerPos.fila, col: targetPlayerPos.col };
            
            // Actualizar cajas: la caja se mueve a destFila/destCol
            nuevaCajas = nuevaCajas.map(caja => 
                (caja === cajaAEmpujar) ? { fila: destFila, col: destCol } : caja
            );

            return {
                ...estado,
                jugador: nuevoJugador,
                cajas: nuevaCajas,
                movimientos: estado.movimientos + 1
            };

        } else {
            // --- Movimiento simple (sin empujar) ---
            nuevoJugador = targetPlayerPos;
            return {
                ...estado,
                jugador: nuevoJugador,
                cajas: nuevaCajas, // Las cajas no cambian
                movimientos: estado.movimientos + 1
            };
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        const cajas = estado.cajas;
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Comprobar si cada caja está en una posición objetivo
        for (const caja of cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false;
            }
        }
        return true;
    }
};
