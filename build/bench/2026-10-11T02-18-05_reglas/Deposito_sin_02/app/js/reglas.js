const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaBase = [];

        // Paso 1: Identificar posiciones y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const simbolo = nivel[r][c];

                if (simbolo === '@') {
                    jugador = { fila: r, col: c };
                    filaActual.push(' '); // El jugador ocupa un espacio vacío en el mapa base
                } else if (simbolo === '$' || simbolo === '*') {
                    cajas.push({ fila: r, col: c });
                    // Si es caja sobre objetivo (*), la tratamos como una caja normal para el estado inicial
                    filaActual.push(' '); 
                } else if (simbolo === '.') {
                    objetivos.push({ fila: r, col: c });
                    filaActual.push('.'); // Objetivo fijo en el mapa base
                } else if (simbolo === '#') {
                    filaActual.push('#'); // Pared
                } else {
                    // Espacio vacío (' ') o cualquier otro carácter no mapeado que debe ser piso
                    filaActual.push(' '); 
                }
            }
            mapaBase.push(filaActual);
        }

        return {
            mapa: mapaBase,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el mismo si no hubo movimiento).
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevaCajas = [...cajas];
        let nuevoJugador = { ...jugador };
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (P_destino)
        let pDestino = { ...jugador };
        switch (direccion) {
            case "arriba":
                pDestino.fila -= 1;
                break;
            case "abajo":
                pDestino.fila += 1;
                break;
            case "izquierda":
                pDestino.col -= 1;
                break;
            case "derecha":
                pDestino.col += 1;
                break;
        }

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const esValido = (r, c) => {
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) {
                return false; // Fuera de límites
            }
            return estado.mapa[r][c] !== '#'; // No es pared
        };

        // --- CASO A: Movimiento simple (P_destino no está ocupado por una caja) ---
        const estaEnCaja = (pos, cajasArray) => {
            return cajasArray.some(c => c.fila === pos.fila && c.col === pos.col);
        };

        if (esValido(pDestino.fila, pDestino.col) && !estaEnCaja(pDestino, cajas)) {
            // Movimiento exitoso a un espacio vacío o objetivo
            nuevoJugador = pDestino;
            nuevosMovimientos++;
            return { ...estado, jugador: nuevoJugador, movimientos: nuevosMovimientos };
        }

        // --- CASO B: Empuje de caja (P_destino está ocupado por una caja) ---
        if (esValido(pDestino.fila, pDestino.col) && estaEnCaja(pDestino, cajas)) {
            // 2. Identificar la caja que se va a empujar y su posición destino (P_destino_caja)
            let cajaEmpujada = cajas.find(c => c.fila === pDestino.fila && c.col === pDestino.col);

            if (!cajaEmpujada) {
                // Esto no debería pasar si estaEnCaja es true, pero por seguridad.
                return { ...estado }; 
            }

            let pDestinoCaja = { ...cajaEmpujada };
            switch (direccion) {
                case "arriba":
                    pDestinoCaja.fila -= 1;
                    break;
                case "abajo":
                    pDestinoCaja.fila += 1;
                    break;
                case "izquierda":
                    pDestinoCaja.col -= 1;
                    break;
                case "derecha":
                    pDestinoCaja.col += 1;
                    break;
            }

            // 3. Verificar si el empuje es posible (P_destino_caja debe ser válido y no estar ocupado por otra caja)
            const puedeEmpujar = esValido(pDestinoCaja.fila, pDestinoCaja.col) && 
                                 !estaEnCaja(pDestinoCaja, cajas);

            if (puedeEmpujar) {
                // Empuje exitoso: Actualizar jugador y caja
                nuevoJugador = pDestino;
                nuevaCajas = nuevaCajas.map(c => ({ ...c })); // Clonar el array de cajas
                
                // Encontrar la caja que se movió (la original)
                const indiceCajaMovida = nuevaCajas.findIndex(c => c.fila === cajaEmpujada.fila && c.col === cajaEmpujada.col);

                if (indiceCajaMovida !== -1) {
                    // Mover la caja
                    nuevaCajas[indiceCajaMovida] = pDestinoCaja;
                } else {
                     // Fallback, aunque no debería ocurrir
                     return { ...estado }; 
                }

                nuevosMovimientos++;
                return { ...estado, jugador: nuevoJugador, cajas: nuevaCajas, movimientos: nuevosMovimientos };
            }
        }

        // --- CASO C: Movimiento inválido (Colisión con pared o caja contra pared/otra caja) ---
        return { ...estado }; // Devolver estado inalterado
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
ganado: function(estado) {
        const { objetivos, cajas } = estado;

        if (objetivos.length === 0) return true; // Mantenemos el comportamiento original para este caso de borde

        // Crear un set de coordenadas donde están las cajas para búsqueda rápida
        const cajasSet = new Set(cajas.map(c => `${c.fila},${c.col}`));

        // Verificar si cada objetivo tiene una caja encima
        for (const objetivo of objetivos) {
            const coordObjetivo = `${objetivo.fila},${objetivo.col}`;
            
            // Si el set de cajas NO contiene la coordenada del objetivo, no hemos ganado.
            if (!cajasSet.has(coordObjetivo)) {
                return false; 
            }
        }

        // Si todos los objetivos fueron revisados y cada uno tiene una caja encima, se gana.
        return true;
    }
};
