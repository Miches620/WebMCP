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

        let jugadorPos = null;
        let cajasIniciales = [];
        let objetivosIniciales = [];

        // Recorrer el mapa para identificar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$' || char === '*') {
                    // Las cajas se almacenan por coordenadas. No importa si es $ o * inicialmente.
                    cajasIniciales.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // El mapa de estado debe contener solo '#', ' ', '.'
        const mapaEstado = nivel.map(fila => 
            fila.split('').map(char => {
                if (char === '@' || char === '$' || char === '*') return ' '; // Simplificamos la representación en el mapa base
                return char;
            }).join('')
        );

        // Inicializar estado
        const estado = {
            mapa: mapaEstado,
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento deseado.
     * @returns {object} Un nuevo estado (o el original si no hubo movimiento).
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return { ...estado };
        const columnas = estado.mapa[0].length;

        let jugadorNuevoPos = { ...estado.jugador };
        let cajasNuevas = [...estado.cajas];
        let movimientosActualizados = estado.movimientos;
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (P_target)
        switch (direccion) {
            case "arriba":
                jugadorNuevoPos.fila -= 1;
                break;
            case "abajo":
                jugadorNuevoPos.fila += 1;
                break;
            case "izquierda":
                jugadorNuevoPos.col -= 1;
                break;
            case "derecha":
                jugadorNuevoPos.col += 1;
                break;
        }

        // Verificar límites y paredes en P_target
        if (jugadorNuevoPos.fila < 0 || jugadorNuevoPos.fila >= filas ||
            jugadorNuevoPos.col < 0 || jugadorNuevoPos.col >= columnas ||
            estado.mapa[jugadorNuevoPos.fila][jugadorNuevoPos.col] === '#') {
            return { ...estado }; // Colisión con pared o límite
        }

        // Verificar si P_target está ocupado por una caja
        const cajaEnPTarget = estado.cajas.some(c => 
            c.fila === jugadorNuevoPos.fila && c.col === jugadorNuevoPos.col
        );

        if (!cajaEnPTarget) {
            // Caso 1: Movimiento simple (a piso o objetivo)
            const nuevoEstado = {
                ...estado,
                jugador: jugadorNuevoPos,
                movimientos: estado.movimientos + 1
            };
            return nuevoEstado;

        } else {
            // Caso 2: Intento de empujar una caja
            let cajaAEmpujarIndex = -1;
            for (let i = 0; i < estado.cajas.length; i++) {
                const c = estado.cajas[i];
                if (c.fila === jugadorNuevoPos.fila && c.col === jugadorNuevoPos.col) {
                    cajaAEmpujarIndex = i;
                    break;
                }
            }

            // Calcular la posición objetivo de la caja (B_target)
            let cajaTargetPos = { ...jugadorNuevoPos };
            switch (direccion) {
                case "arriba":
                    cajaTargetPos.fila -= 1;
                    break;
                case "abajo":
                    cajaTargetPos.fila += 1;
                    break;
                case "izquierda":
                    cajaTargetPos.col -= 1;
                    break;
                case "derecha":
                    cajaTargetPos.col += 1;
                    break;
            }

            // Verificar si B_target es válido para el empuje:
            // 1. No puede ser pared o fuera de límites.
            if (cajaTargetPos.fila < 0 || cajaTargetPos.fila >= filas ||
                cajaTargetPos.col < 0 || cajaTargetPos.col >= columnas ||
                estado.mapa[cajaTargetPos.fila][cajaTargetPos.col] === '#') {
                return { ...estado }; // Colisión con pared al empujar
            }

            // 2. No puede haber otra caja o jugador en B_target (solo paredes/piso).
            const hayObstaculoEnBTarget = estado.cajas.some((c, i) => 
                i !== cajaAEmpujarIndex && c.fila === cajaTargetPos.fila && c.col === cajaTargetPos.col
            );

            if (hayObstaculoEnBTarget) {
                return { ...estado }; // Colisión con otra caja al empujar
            }

            // Empuje exitoso: Actualizar estado
            const nuevoEstado = {
                ...estado,
                jugador: jugadorNuevoPos,
                cajas: [...estado.cajas], // Copia de cajas
                movimientos: estado.movimientos + 1
            };

            // Mover la caja (actualizando el array de cajas)
            nuevoEstado.cajas[cajaAEmpujarIndex] = cajaTargetPos;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las macetas están sobre un cantero objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) {
            // Si no hay objetivos o cajas, asumimos que no se puede ganar por esta lógica.
            return false;
        }

        const cajaPosiciones = new Set(state.cajas.map(c => `${c.fila},${c.col}`));
        let todasCubiertas = true;

        for (const objetivo of estado.objetivos) {
            const objetivoKey = `${objetivo.fila},${objetivo.col}`;
            if (!cajaPosiciones.has(objetivoKey)) {
                todasCubiertas = false;
                break;
            }
        }

        return todasCubiertas;
    }
};
