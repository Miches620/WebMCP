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
        let mapaNuevo = [];

        // Paso 1: Identificar posiciones y construir el mapa base (sin @ ni $)
        for (let r = 0; r < 9; r++) {
            let filaActual = nivel[r].split('');
            let filaMapa = [];
            for (let c = 0; c < 9; c++) {
                const char = filaActual[c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    filaMapa.push(' '); // El jugador no se dibuja en el mapa base
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    filaMapa.push(' '); // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaMapa.push('.');
                } else if (char === '#') {
                    filaMapa.push('#');
                } else { // ' '
                    filaMapa.push(' ');
                }
            }
            mapaNuevo.push(filaMapa);
        }

        // Asegurarse de que el jugador fue encontrado
        if (!jugador) {
             console.error("Error: Jugador no encontrado en el nivel.");
        }


        return {
            mapa: mapaNuevo,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (!estado || !estado.objetivos || !estado.cajas) return false;

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Hay al menos una caja fuera de un objetivo
            }
        }

        // Si todas las cajas están en los objetivos, el nivel está ganado.
        return true;
    },

    /**
     * Intenta mover al jugador según la dirección y maneja empujes de macetas.
     * @param {object} estado - El estado actual del juego (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado que contiene el movimiento o el estado original si falla.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = nuevoEstado.jugador;
        let cajasActuales = [...nuevoEstado.cajas];
        let mapaActual = nuevoEstado.mapa;

        // 1. Calcular la posición objetivo del jugador (P_destino)
        let pDestino = { ...jugadorActual };
        switch (direccion) {
            case "arriba": pDestino.fila -= 1; break;
            case "abajo": pDestino.fila += 1; break;
            case "izquierda": pDestino.col -= 1; break;
            case "derecha": pDestino.col += 1; break;
        }

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const isValidPos = (r, c) => {
            if (r < 0 || r >= 9 || c < 0 || c >= 9) return false; // Fuera de límites
            // Revisar el mapa base para paredes
            return mapaActual[r][c] !== '#';
        };

        // Si la posición destino es inválida (pared o fuera), no se mueve nada.
        if (!isValidPos(pDestino.fila, pDestino.col)) {
            return nuevoEstado;
        }


        // 2. Verificar si el destino está ocupado por una caja
        const cajaEnDestino = cajasActuales.find(c => c.fila === pDestino.fila && c.col === pDestino.col);

        if (!cajaEnDestino) {
            // Caso A: Movimiento simple (sin colisión con macetas)
            nuevoEstado.jugador = pDestino;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Colisión con una caja, intentar empujar

            let pDetras = { ...pDestino }; // Posición detrás de la caja (donde queremos que vaya la caja)
            switch (direccion) {
                case "arriba": pDetras.fila -= 1; break;
                case "abajo": pDetras.fila += 1; break;
                case "izquierda": pDetras.col -= 1; break;
                case "derecha": pDetras.col += 1; break;
            }

            // Verificar si el espacio detrás de la caja es válido (no pared, no fuera)
            if (!isValidPos(pDetras.fila, pDetras.col)) {
                return nuevoEstado; // No se puede empujar contra una pared o límite
            }

            // Verificar si el espacio detrás de la caja está ocupado por OTRA caja
            const otraCajaEnDestras = cajasActuales.some(c => 
                c !== cajaEnDestino && c.fila === pDetras.fila && c.col === pDetras.col
            );

            if (otraCajaEnDestras) {
                return nuevoEstado; // No se puede empujar contra otra caja
            }

            // ¡Empuje exitoso! Actualizar estado:
            
            // 1. Mover al jugador a la posición de la caja
            nuevoEstado.jugador = pDestino;

            // 2. Mover la caja (la que estaba en destino) a la posición detrás
            const indiceCaja = cajasActuales.findIndex(c => c === cajaEnDestino);
            if (indiceCaja !== -1) {
                cajasActuales[indiceCaja] = pDetras;
            }

            // 3. Actualizar el estado de las cajas en el nuevo objeto
            nuevoEstado.cajas = [...cajasActuales];

            // 4. Incrementar movimientos
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }
    }
};
