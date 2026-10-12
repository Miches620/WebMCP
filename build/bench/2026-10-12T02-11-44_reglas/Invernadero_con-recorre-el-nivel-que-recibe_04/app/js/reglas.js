const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaNuevo = [];

        // 1. Recorrer el nivel para identificar elementos y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = nivel[r].split('');
            mapaNuevo.push(filaActual);

            for (let c = 0; c < filaActual.length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { row: r, col: c };
                } else if (char === '$') {
                    cajas.push({ row: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ row: r, col: c });
                }
            }
        }

        // 2. Limpiar el mapa para que solo contenga '#', ' ', '.'
        let mapaFinal = [];
        for (let r = 0; r < nivel.length; r++) {
            let filaStrings = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaStrings.push('#');
                } else if (char === '.') {
                    filaStrings.push('.');
                } else { // ' ', '@', '$' se convierten en espacio o son ignorados si no es objetivo
                    filaStrings.push(' ');
                }
            }
            mapaFinal.push(filaStrings);
        }

        return {
            mapa: mapaFinal,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevaPosicionJugador = { ...jugador };
        let nuevasCajas = [...cajas];
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
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

        let targetR = jugador.row + dr;
        let targetC = jugador.col + dc;

        // Verificar límites del mapa (9x9)
        const maxRow = estado.mapa.length - 1;
        const maxCol = estado.mapa[0].length - 1;

        if (targetR < 0 || targetR > maxRow || targetC < 0 || targetC > maxCol) {
            return { ...estado }; // Fuera de límites
        }

        // Verificar colisión con pared en el destino del jugador
        if (estado.mapa[targetR][targetC] === '#') {
            return { ...estado };
        }

        // 2. Determinar si hay cajas en la ruta y manejar empujes
        let cajaEnDestino = cajas.find(c => c.row === targetR && c.col === targetC);

        if (cajaEnDestino) {
            // Intentar empujar una caja
            const posEmpuje = { row: targetR + dr, col: targetC + dc };

            // Verificar si el espacio detrás de la caja es válido y no está bloqueado
            let puedeEmpujar = true;
            if (posEmpuje.row < 0 || posEmpuje.row > maxRow || posEmpuje.col < 0 || posEmpuje.col > maxCol) {
                puedeEmpujar = false; // Fuera de límites
            } else if (estado.mapa[posEmpuje.row][posEmpuje.col] === '#') {
                puedeEmpujar = false; // Pared detrás
            } else {
                // Verificar si hay otra caja en la posición de empuje
                const cajaDetras = cajas.some(c => c.row === posEmpuje.row && c.col === posEmpuje.col);
                if (cajaDetras) {
                    puedeEmpujar = false; // Otra caja detrás
                }
            }

            if (!puedeEmpujar) {
                return { ...estado }; // No se puede empujar la caja
            } else {
                // Movimiento exitoso: Mover jugador y mover caja
                nuevaPosicionJugador = { row: targetR, col: targetC };
                const nuevaCajaMovida = { row: posEmpuje.row, col: posEmpuje.col };

                // Crear el nuevo array de cajas (inmutabilidad)
                nuevasCajas = cajas.map(c => 
                    (c.row === cajaEnDestino.row && c.col === cajaEnDestino.col) ? nuevaCajaMovida : c
                );
            }

        } else {
            // El destino es un espacio libre (no hay caja), solo mover al jugador
            nuevaPosicionJugador = { row: targetR, col: targetC };
        }

        // 3. Crear y devolver el nuevo estado
        return {
            mapa: estado.mapa, // El mapa no cambia
            jugador: nuevaPosicionJugador,
            cajas: nuevasCajas,
            objetivos: estado.objetivos,
            movimientos: estado.movimientos + 1
        };
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        const cajasEnObjetivo = estado.cajas.every(caja => {
            return estado.objetivos.some(obj => obj.row === caja.row && obj.col === caja.col);
        });

        // Verificación más estricta: ¿Hay un objetivo sin caja?
        const objetivosSinCaja = estado.objetivos.filter(obj => 
            !estado.cajas.some(caja => caja.row === obj.row && caja.col === obj.col)
        );

        return objetivosSinCaja.length === 0;
    }
};
