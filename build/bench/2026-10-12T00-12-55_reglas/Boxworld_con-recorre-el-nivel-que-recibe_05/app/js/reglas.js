const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // 1. Identificar posiciones iniciales y construir el mapa base
        const mapaBase = nivel.map(fila => fila.split(''));

        for (let r = 0; r < mapaBase.length; r++) {
            for (let c = 0; c < mapaBase[r].length; c++) {
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

        // 2. Limpiar el mapa base para que solo contenga '#', ' ', '.'
        const mapaLimpio = [];
        for (let r = 0; r < nivel.length; r++) {
            let filaString = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '#' || char === ' ' || char === '.') {
                    filaString += char;
                } else if (char === '@' || char === '$') {
                    // Ignoramos jugador y cajas para el mapa base
                }
            }
            mapaLimpio.push(filaString);
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
     * Intenta mover al jugador en la dirección dada y actualiza el estado.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado con la posición actualizada o el estado original si el movimiento falla.
     */
    mover(estado, direccion) {
        const { jugador: p } = estado;
        let nuevaPosicionJugador = { ...p };

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones aún)
        switch (direccion) {
            case "arriba":
                nuevaPosicionJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosicionJugador.col += 1;
                break;
        }

        const { fila: r, col: c } = nuevaPosicionJugador;
        const mapa = estado.mapa;
        const altura = mapa.length;
        const ancho = mapa[0].length;

        // Validación de límites y paredes (si el destino es fuera o pared)
        if (r < 0 || r >= altura || c < 0 || c >= ancho || mapa[r][c] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Movimiento inválido
        }

        // 2. Verificar colisión con cajas en la posición objetivo
        const cajaEnDestino = estado.cajas.find(box => box.fila === r && box.col === c);

        if (!cajaEnDestino) {
            // Caso A: Movimiento libre (no hay caja en el destino)
            return {
                ...estado,
                jugador: nuevaPosicionJugador,
                movimientos: estado.movimientos + 1
            };
        } else {
            // Caso B: Colisión con una caja. Intentar empujar.
            const box = cajaEnDestino;
            let destinoCaja = { ...box };

            // Calcular la posición donde iría la caja después de ser empujada
            switch (direccion) {
                case "arriba":
                    destinoCaja.fila -= 1;
                    break;
                case "abajo":
                    destinoCaja.fila += 1;
                    break;
                case "izquierda":
                    destinoCaja.col -= 1;
                    break;
                case "derecha":
                    destinoCaja.col += 1;
                    break;
            }

            // Validación del destino de la caja: ¿Es válido el empuje?
            const esValidoEmpuje = (
                destinoCaja.fila >= 0 && destinoCaja.fila < altura &&
                destinoCaja.col >= 0 && destinoCaja.col < ancho &&
                mapa[destinoCaja.fila][destinoCaja.col] !== '#' // No choca con pared/límite
            );

            if (!esValidoEmpuje) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (pared o límite)
            }

            // Verificar si el destino de la caja está ocupado por otra caja
            const hayOtraCajaEnDestino = estado.cajas.some(otherBox => 
                otherBox !== box && otherBox.fila === destinoCaja.fila && otherBox.col === destinoCaja.col
            );

            if (hayOtraCajaEnDestino) {
                return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (otra caja)
            }

            // 3. El empuje es exitoso
            const nuevasCajas = estado.cajas.map(b => 
                b === box ? destinoCaja : b
            );

            return {
                ...estado,
                jugador: nuevaPosicionJugador,
                cajas: nuevasCajas,
                movimientos: estado.movimientos + 1
            };
        }
    },

    /**
     * Verifica si el nivel ha sido completado (todas las cajas cubren objetivos).
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si todas las cajas están sobre un objetivo, False en caso contrario.
     */
    ganado(estado) {
        const { objetivos: objetivosActuales, cajas } = estado;

        if (objetivosActuales.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas cubiertas por las cajas
        const ubicacionesCajas = new Set(cajas.map(box => `${box.fila},${box.col}`));

        // Verificar si cada objetivo está en el set de ubicaciones de las cajas
        for (const obj of objetivosActuales) {
            if (!ubicacionesCajas.has(`${obj.fila},${obj.col}`)) {
                return false; // Hay un objetivo sin caja encima
            }
        }

        // Si pasamos por todos los objetivos y están cubiertos, el nivel está ganado.
        return true;
    }
};
