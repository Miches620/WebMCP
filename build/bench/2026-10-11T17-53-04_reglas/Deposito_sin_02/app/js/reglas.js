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
        let nuevoMapa = [];

        const H = nivel.length;
        if (H === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };

        // Asumimos que todas las filas tienen la misma longitud si el nivel es válido.
        const W = nivel[0].length; 

        // Iteramos sobre las filas y columnas para recolectar coordenadas y construir el mapa limpio.
        for (let r = 0; r < H; r++) {
            let tempRowArray = []; // Array temporal de caracteres para la fila actual
            const currentRow = nivel[r];

            if (!currentRow) continue; // Seguridad adicional si alguna fila está ausente

            for (let c = 0; c < W; c++) {
                const char = currentRow[c];
                
                // Determinar el carácter que va en el mapa limpio.
                // @ y $ se reemplazan por ' ', ya que no deben aparecer en estado.mapa.
                let mapChar = char;
                if (char === '@' || char === '$') {
                    mapChar = ' '; 
                }

                tempRowArray.push(mapChar);

                // Recolectar coordenadas basadas en el carácter ORIGINAL del nivel.
                if (char === '@') {
                    jugador = { row: r, col: c };
                } else if (char === '$') {
                    cajas.push({ row: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ row: r, col: c });
                }
            }
            // Almacenar la fila como una cadena de caracteres en nuevoMapa.
            nuevoMapa.push(tempRowArray.join('')); 
        }

        return {
            mapa: nuevoMapa, // Mapa de caracteres (solo #, ' ', .)
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover al jugador o empujar una caja.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let { row: pr, col: pc } = jugador;

        // 1. Calcular la posición objetivo del jugador (sin considerar obstáculos aún)
        let nextPr = pr;
        let nextPc = pc;

        switch (direccion) {
            case "arriba":
                nextPr -= 1;
                break;
            case "abajo":
                nextPr += 1;
                break;
            case "izquierda":
                nextPc -= 1;
                break;
            case "derecha":
                nextPc += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        if (nextPr < 0 || nextPr > 7 || nextPc < 0 || nextPc > 7) {
            return { ...estado, movimientos: estado.movimientos }; // No se mueve
        }

        // 2. Verificar colisión con paredes o límites del mapa
        if (estado.mapa[nextPr][nextPc] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión pared
        }

        let nuevaCajas = [...cajas];
        let movimientoExitoso = false;

        // 3. Verificar colisión con cajas
        const cajaEnDestino = cajas.some(c => c.row === nextPr && c.col === nextPc);

        if (!cajaEnDestino) {
            // Movimiento simple (solo jugador)
            return {
                ...estado,
                jugador: { row: nextPr, col: nextPc },
                movimientos: estado.movimientos + 1
            };
        } else {
            // Colisión con caja: Intentar empujar
            const cajaDestino = cajas.find(c => c.row === nextPr && c.col === nextPc);

            // Calcular la posición detrás de la caja (donde debe ir el jugador)
            let pushPr = nextPr;
            let pushPc = nextPc;

            switch (direccion) {
                case "arriba":
                    pushPr -= 1;
                    break;
                case "abajo":
                    pushPr += 1;
                    break;
                case "izquierda":
                    pushPc -= 1;
                    break;
                case "derecha":
                    pushPc += 1;
                    break;
            }

            // Verificar si el espacio detrás de la caja es válido (no pared, no fuera de límites)
            if (pushPr < 0 || pushPr > 7 || pushPc < 0 || pushPc > 7 || estado.mapa[pushPr][pushPc] === '#') {
                return { ...estado, movimientos: estado.movimientos }; // Colisión pared detrás de caja
            }

            // Verificar si el espacio detrás de la caja está ocupado por otra caja
            const hayOtraCajaDetras = cajas.some(c => c !== cajaDestino && c.row === pushPr && c.col === pushPc);
            if (hayOtraCajaDetras) {
                return { ...estado, movimientos: estado.movimientos }; // Colisión otra caja detrás de caja
            }

            // Movimiento exitoso: Empujar la caja y al jugador
            nuevaCajas = nuevaCajas.map(c => 
                (c.row === nextPr && c.col === nextPc) ? { row: pushPr, col: pushPc } : c
            );

            return {
                ...estado,
                jugador: { row: nextPr, col: nextPc }, // El jugador se mueve al lugar de la caja
                cajas: nuevaCajas,
                movimientos: estado.movimientos + 1
            };
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos, se considera ganado

        const cajasEnObjetivos = estado.cajas.every(caja => 
            estado.objetivos.some(obj => caja.row === obj.row && caja.col === obj.col)
        );

        return cajasEnObjetivos;
    }
};
