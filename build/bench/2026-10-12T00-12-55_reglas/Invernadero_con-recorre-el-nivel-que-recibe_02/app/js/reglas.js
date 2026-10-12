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

        // Clonar el mapa para que solo contenga '#', ' ', '.'
        const mapaLimpiado = nivel.map(fila => fila.replace(/[@\$]/g, ''));

        return {
            mapa: mapaLimpiado,
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return estado;
        const columnas = estado.mapa[0].length;

        let { jugador, cajas } = estado;
        let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar el estado para inmutabilidad

        // Helper para calcular coordenadas objetivo
        const getCoords = (r, c) => ({ r: Math.max(0, Math.min(filas - 1, r)), c: Math.max(0, Math.min(columnas - 1, c)) });

        let nuevaPosJugador = { ...jugador };
        let nuevasCajas = JSON.parse(JSON.stringify(cajas));
        let movimientoExitoso = false;

        // 1. Calcular la posición potencial del jugador (N_r, N_c)
        let targetR = jugador.fila;
        let targetC = jugador.col;

        switch (direccion) {
            case "arriba":
                targetR -= 1;
                break;
            case "abajo":
                targetR += 1;
                break;
            case "izquierda":
                targetC -= 1;
                break;
            case "derecha":
                targetC += 1;
                break;
        }

        // Verificar límites y paredes en la posición objetivo del jugador
        if (targetR < 0 || targetR >= filas || targetC < 0 || targetC >= columnas) {
            return estado; // Fuera de límites
        }
        if (estado.mapa[targetR][targetC] === '#') {
            return estado; // Colisión con pared
        }

        // 2. Verificar si el objetivo es una caja
        const boxIndex = cajas.findIndex(box => box.fila === targetR && box.col === targetC);

        if (boxIndex !== -1) {
            // Intentando empujar una caja
            const cajaAEmpujar = cajas[boxIndex];
            let posDetrasR = cajaAEmpujar.fila;
            let posDetrasC = cajaAEmpujar.col;

            switch (direccion) {
                case "arriba":
                    posDetrasR -= 1;
                    break;
                case "abajo":
                    posDetrasR += 1;
                    break;
                case "izquierda":
                    posDetrasC -= 1;
                    break;
                case "derecha":
                    posDetrasC += 1;
                    break;
            }

            // Verificar si el espacio detrás de la caja es válido y no está bloqueado
            if (posDetrasR < 0 || posDetrasR >= filas || posDetrasC < 0 || posDetrasC >= columnas) {
                return estado; // Colisión con límite del mapa
            }

            // Verificar si el espacio detrás es pared o contiene otra caja
            const charDetras = estado.mapa[posDetrasR][posDetrasC];
            if (charDetras === '#') {
                return estado; // Bloqueado por pared
            }

            let hayOtraCajaBloqueando = false;
            for (let i = 0; i < cajas.length; i++) {
                // Ignoramos la caja que estamos empujando
                if (i === boxIndex) continue;
                if (cajas[i].fila === posDetrasR && cajas[i].col === posDetrasC) {
                    hayOtraCajaBloqueando = true;
                    break;
                }
            }

            if (hayOtraCajaBloqueando) {
                return estado; // Bloqueado por otra caja
            }

            // Movimiento exitoso: Empuje de caja
            nuevoEstado.movimientos += 1;
            nuevaPosJugador = { ...cajaAEmpujar }; // El jugador va donde estaba la caja
            
            // Actualizar cajas: mover la caja empujada y mantener el resto
            const nuevasCajasActualizadas = [...cajas];
            nuevasCajasActualizadas[boxIndex] = { fila: posDetrasR, col: posDetrasC }; // Nueva posición de la caja
            nuevoEstado.cajas = nuevasCajasActualizadas;

        } else {
            // 3. Movimiento simple (sin cajas)
            nuevoEstado.movimientos += 1;
            nuevaPosJugador = { ...{ fila: targetR, col: targetC } };
        }

        // Actualizar la posición del jugador en el nuevo estado
        nuevoEstado.jugador = nuevaPosJugador;
        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        if (objetivos.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas de cajas para búsqueda rápida
        const cajaCoords = new Set();
        estado.cajas.forEach(box => {
            cajaCoords.add(`${box.fila},${box.col}`);
        });

        for (const objetivo of objetivos) {
            const coordObjetivo = `${objetivo.fila},${objetivo.col}`;
            // Si la coordenada del objetivo no está en el set de cajas, significa que no hay caja encima.
            if (!cajaCoords.has(coordObjetivo)) {
                return false;
            }
        }

        return true; // Todos los objetivos están cubiertos
    }
};
