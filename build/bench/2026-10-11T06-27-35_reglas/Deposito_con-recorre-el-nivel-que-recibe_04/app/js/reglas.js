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

        let jugador = { fila: -1, col: -1 };
        let cajas = [];
        let objetivos = [];
        let mapaInicial = [];

        // Paso 1: Parsear el nivel para encontrar elementos y construir el mapa base.
        for (let r = 0; r < filas; r++) {
            let filaActual = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];

                if (char === '#') {
                    filaActual += '#';
                } else if (char === '.') {
                    // Objetivo, siempre es piso en el estado.mapa
                    objetivos.push({ fila: r, col: c });
                    filaActual += '.';
                } else if (char === ' ') {
                    // Piso vacío
                    filaActual += ' ';
                } else if (char === '$' || char === '*') {
                    // Caja
                    cajas.push({ fila: r, col: c });
                    // La caja ocupa un espacio de piso en el mapa base
                    filaActual += ' '; 
                } else if (char === '@') {
                    // Jugador
                    jugador = { fila: r, col: c };
                    filaActual += ' '; // El jugador se mueve sobre piso vacío
                } else {
                    // Manejar cualquier otro carácter que no deba estar en el mapa base.
                    filaActual += ' '; 
                }
            }
            mapaInicial.push(filaActual);
        }

        return {
            mapa: mapaInicial,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado actual según la dirección. Maneja colisiones y empujes.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = { ...estado.jugador };
        let cajasActuales = [...estado.cajas];
        let movimientosActuales = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        let nextPlayerRow = jugadorActual.fila;
        let nextPlayerCol = jugadorActual.col;

        switch (direccion) {
            case "arriba":
                nextPlayerRow -= 1;
                break;
            case "abajo":
                nextPlayerRow += 1;
                break;
            case "izquierda":
                nextPlayerCol -= 1;
                break;
            case "derecha":
                nextPlayerCol += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        const filas = nuevoEstado.mapa.length;
        const columnas = nuevoEstado.mapa[0].length;

        if (nextPlayerRow < 0 || nextPlayerRow >= filas || nextPlayerCol < 0 || nextPlayerCol >= columnas) {
            return estado; // Fuera de límites
        }

        // Verificar si el destino es una pared
        if (nuevoEstado.mapa[nextPlayerRow][nextPlayerCol] === '#') {
            return estado; // Colisión con pared
        }

        // 2. Determinar qué hay en la posición objetivo del jugador
        const cajaEnDestino = cajasActuales.find(c => c.fila === nextPlayerRow && c.col === nextPlayerCol);

        if (!cajaEnDestino) {
            // Caso A: Mover a un espacio vacío (piso o objetivo)
            nuevoEstado.jugador = { fila: nextPlayerRow, col: nextPlayerCol };
            return nuevoEstado; // Movimiento exitoso sin empujar cajas
        } else {
            // Caso B: Intentar empujar una caja
            const boxToPush = cajaEnDestino;

            // Calcular la posición objetivo de la caja (detrás del jugador)
            let nextBoxRow = boxToPush.fila;
            let nextBoxCol = boxToPush.col;

            switch (direccion) {
                case "arriba":
                    nextBoxRow -= 1;
                    break;
                case "abajo":
                    nextBoxRow += 1;
                    break;
                case "izquierda":
                    nextBoxCol -= 1;
                    break;
                case "derecha":
                    nextBoxCol += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido:
            // 1. No puede salir del mapa (ya cubierto por nextPlayerRow/Col check, pero mejor ser explícito)
            if (nextBoxRow < 0 || nextBoxRow >= filas || nextBoxCol < 0 || nextBoxCol >= columnas) {
                return estado; // Caja fuera de límites
            }

            // 2. No puede chocar con una pared en su destino
            if (nuevoEstado.mapa[nextBoxRow][nextBoxCol] === '#') {
                return estado; // Colisión caja contra pared
            }

            // 3. No puede chocar con otra caja en su destino
            const hayOtraCaja = cajasActuales.some(c => c !== boxToPush && c.fila === nextBoxRow && c.col === nextBoxCol);
            if (hayOtraCaja) {
                return estado; // Colisión caja contra otra caja
            }

            // Si el empuje es exitoso:
            const nuevoEstadoEmpujado = JSON.parse(JSON.stringify(estado));

            // 1. Actualizar posición del jugador
            nuevoEstadoEmpujado.jugador = { fila: nextPlayerRow, col: nextPlayerCol };

            // 2. Actualizar la lista de cajas (reemplazando la caja empujada)
            const nuevasCajas = cajasActuales.map(c => 
                (c.fila === boxToPush.fila && c.col === boxToPush.col) ? 
                { fila: nextBoxRow, col: nextBoxCol } : 
                c
            );
            nuevoEstadoEmpujado.cajas = nuevasCajas;

            // 3. Incrementar movimientos
            nuevoEstadoEmpujado.movimientos = movimientosActuales + 1;

            return nuevoEstadoEmpujado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) {
            // Si no hay objetivos o cajas, se considera que no se ha completado el nivel de forma significativa.
            return false;
        }

        const cajaPosiciones = new Set(estado.cajas.map(c => `${c.fila},${c.col}`));
        
        for (const objetivo of estado.objetivos) {
            const objetivoKey = `${objetivo.fila},${objetivo.col}`;
            if (!cajaPosiciones.has(objetivoKey)) {
                return false; // Al menos un objetivo no tiene caja encima
            }
        }

        // Si iteramos sobre todos los objetivos y encontramos una caja para cada uno, se ha ganado.
        return true;
    }
};
