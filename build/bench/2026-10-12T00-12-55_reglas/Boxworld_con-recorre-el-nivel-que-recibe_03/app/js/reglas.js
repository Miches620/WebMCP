const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaBase = [];

        for (let r = 0; r < nivel.length; r++) {
            let filaActual = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { row: r, col: c };
                    filaActual += ' '; // El jugador no forma parte del mapa base
                } else if (char === '$') {
                    cajas.push({ row: r, col: c });
                    filaActual += '.'; // Las cajas se tratan como objetivos en el mapa base para simplificar la representación visual de obstáculos estáticos si es necesario, aunque solo necesitamos saber su posición. Usaremos '.' o ' ' según lo que no sea pared.
                } else if (char === '.') {
                    objetivos.push({ row: r, col: c });
                    filaActual += '.';
                } else if (char === '#') {
                    filaActual += '#';
                } else { // Espacio ' '
                    filaActual += ' ';
                }
            }
            mapaBase.push(filaActual);
        }

        // Ajuste para el mapa base: si la caja está en un objetivo, debe ser tratado como '.' o ' '. 
        // Dado que el contrato dice que el estado.mapa solo tiene '#', ' ', y '.', ajustaremos las cajas a ocupar espacio de piso/objetivo.
        let mapaFinal = [];
        for (let r = 0; r < nivel.length; r++) {
            let fila = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@' || char === '$') {
                    // Estos caracteres son reemplazados por el espacio vacío en el mapa base.
                    fila += ' ';
                } else if (char === '.') {
                    fila += '.';
                } else {
                    fila += char;
                }
            }
            mapaFinal.push(fila);
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
     * Intenta mover el estado dado en la dirección especificada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado o el estado original si el movimiento falla.
     */
    mover(estado, direccion) {
        const { jugador: p } = estado;
        let nuevaPosicionJugador = { ...p };

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones aún)
        switch (direccion) {
            case "arriba":
                nuevaPosicionJugador.row -= 1;
                break;
            case "abajo":
                nuevaPosicionJugador.row += 1;
                break;
            case "izquierda":
                nuevaPosicionJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosicionJugador.col += 1;
                break;
        }

        const { mapa } = estado;
        const altura = mapa.length;
        const ancho = mapa[0].length;

        // Validación de límites y paredes para el jugador
        if (nuevaPosicionJugador.row < 0 || nuevaPosicionJugador.row >= altura ||
            nuevaPosicionJugador.col < 0 || nuevaPosicionJugador.col >= ancho) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites
        }

        if (mapa[nuevaPosicionJugador.row][nuevaPosicionJugador.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
        }

        // 2. Verificar colisiones con cajas
        const cajaEnTarget = estado.cajas.find(c => c.row === nuevaPosicionJugador.row && c.col === nuevaPosicionJugador.col);

        if (!cajaEnTarget) {
            // Movimiento simple (sin empujar nada)
            return { 
                ...estado, 
                jugador: nuevaPosicionJugador, 
                movimientos: estado.movimientos + 1 
            };
        } else {
            // Intentar empujar la caja
            const box = cajaEnTarget;
            let nuevaPosicionCaja = { ...box };

            switch (direccion) {
                case "arriba":
                    nuevaPosicionCaja.row -= 1;
                    break;
                case "abajo":
                    nuevaPosicionCaja.row += 1;
                    break;
                case "izquierda":
                    nuevaPosicionCaja.col -= 1;
                    break;
                case "derecha":
                    nuevaPosicionCaja.col += 1;
                    break;
            }

            // Validación de la nueva posición de la caja (Target del empuje)
            if (nuevaPosicionCaja.row < 0 || nuevaPosicionCaja.row >= altura ||
                nuevaPosicionCaja.col < 0 || nuevaPosicionCaja.col >= ancho) {
                return { ...estado, movimientos: estado.movimientos }; // Caja fuera de límites
            }

            // Colisión del target del empuje con paredes o cajas estáticas (mapa base)
            if (mapa[nuevaPosicionCaja.row][nuevaPosicionCaja.col] === '#') {
                return { ...estado, movimientos: estado.movimientos }; // Caja contra pared
            }

            // Colisión del target del empuje con otra caja
            const hayOtraCaja = estado.cajas.some(c => 
                c !== box && c.row === nuevaPosicionCaja.row && c.col === nuevaPosicionCaja.col
            );

            if (hayOtraCaja) {
                return { ...estado, movimientos: estado.movimientos }; // Caja contra otra caja
            }

            // Empuje exitoso
            const nuevasCajas = estado.cajas.map(c => 
                (c === box) ? nuevaPosicionCaja : c
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
     * Verifica si todas las cajas están sobre los objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        const cajasEnPosicion = new Set(estado.cajas.map(c => `${c.row},${c.col}`));
        
        for (const objetivo of estado.objetivos) {
            if (!cajasEnPosicion.has(`${objetivo.row},${objetivo.col}`)) {
                return false; // Algún objetivo no está cubierto
            }
        }
        return true; // Todos los objetivos están cubiertos
    }
};
