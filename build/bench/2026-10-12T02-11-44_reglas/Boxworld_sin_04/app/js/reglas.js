const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 10x10.
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let nuevoMapa = [];

        if (!nivel || nivel.length === 0) {
            return {
                mapa: [],
                jugador: null,
                cajas: [],
                objetivos: [],
                movimientos: 0
            };
        }

        const R = nivel.length;
        // Asumimos que el nivel es rectangular y al menos la primera fila existe
        const C = nivel[0].length; 

        for (let r = 0; r < R; r++) {
            let filaActual = '';
            for (let c = 0; c < C; c++) {
                const char = nivel[r][c];
                
                // 1. Identificar ubicaciones usando el carácter original
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }

                // 2. Construir el mapa sin jugador ni cajas
                let mapChar = char;
                if (char === '@' || char === '$') {
                    mapChar = ' '; // Reemplazar @ y $ por espacio en el mapa visible
                }
                
                filaActual += mapChar;
            }
            nuevoMapa.push(filaActual);
        }

        return {
            mapa: nuevoMapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las posiciones objetivo están cubiertas por al menos una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde: no hay objetivos

        const cajasEnPosiciones = new Set();
        estado.cajas.forEach(c => {
            cajasEnPosiciones.add(`${c.fila},${c.col}`);
        });

        for (const objetivo of estado.objetivos) {
            if (!cajasEnPosiciones.has(`${objetivo.fila},${objetivo.col}`)) {
                return false;
            }
        }
        return true;
    },

    /**
     * Mueve el jugador y potencialmente las cajas según la dirección dada.
     * @param {object} estado - El estado actual del juego (no se modifica).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado que refleja el movimiento o el estado original si es inválido.
     */
    mover(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaPosicionJugador = { ...jugador };

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas aún)
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

        // Helper para verificar límites y paredes en el mapa base (sin cajas/jugadores)
        const esValidoPiso = (r, c) => {
            if (r < 0 || r >= 10 || c < 0 || c >= 10) return false; // Fuera de límites
            // El mapa solo tiene paredes '#' en los bordes y divisiones.
            return estado.mapa[r][c] !== '#';
        };

        // 2. Verificar si el movimiento es posible (pared o fuera de límites)
        if (!esValidoPiso(nuevaPosicionJugador.fila, nuevaPosicionJugador.col)) {
            return { ...estado, movimientos: estado.movimientos }; // No se mueve
        }

        // 3. Verificar colisión con cajas
        const cajaColision = estado.cajas.some(c => 
            c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col
        );

        if (!cajaColision) {
            // Caso A: Movimiento simple (no hay cajas en el destino)
            const nuevoEstado = {
                mapa: estado.mapa, // El mapa no cambia
                jugador: nuevaPosicionJugador,
                cajas: [...estado.cajas],
                objetivos: [...estado.objetivos],
                movimientos: estado.movimientos + 1
            };
            return nuevoEstado;
        }

        // Caso B: Colisión con caja (Intentar empujar)
        const cajaAEmpujar = estado.cajas.find(c => 
            c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col
        );

        if (!cajaAEmpujar) {
             // Esto no debería pasar si la lógica de colisión es correcta, pero por seguridad:
            return { ...estado, movimientos: estado.movimientos }; 
        }

        let cajaDestino = { ...cajaAEmpujar };
        let nuevaPosicionCaja = { ...cajaDestino };

        // Calcular la posición donde irá la caja después de ser empujada
        switch (direccion) {
            case "arriba":
                nuevaPosicionCaja.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionCaja.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionCaja.col -= 1;
                break;
            case "derecha":
                nuevaPosicionCaja.col += 1;
                break;
        }

        // Verificar si el destino de la caja es válido:
        // 1. No puede ser pared o fuera de límites.
        if (!esValidoPiso(nuevaPosicionCaja.fila, nuevaPosicionCaja.col)) {
            return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (pared)
        }

        // 2. No puede colisionar con otra caja en su destino.
        const hayOtraCajaEnDestino = estado.cajas.some(c => 
            c !== cajaAEmpujar && c.fila === nuevaPosicionCaja.fila && c.col === nuevaPosicionCaja.col
        );

        if (hayOtraCajaEnDestino) {
            return { ...estado, movimientos: estado.movimientos }; // Empuje fallido (otra caja)
        }

        // 4. ¡Empuje exitoso! Crear el nuevo estado.
        const nuevasCajas = estado.cajas.map(c => {
            if (c === cajaAEmpujar) {
                return nuevaPosicionCaja; // Actualizar la posición de la caja empujada
            }
            return c; // Las demás cajas permanecen igual
        });

        const nuevoEstado = {
            mapa: estado.mapa,
            jugador: nuevaPosicionJugador,
            cajas: nuevasCajas,
            objetivos: [...estado.objetivos],
            movimientos: estado.movimientos + 1
        };

        return nuevoEstado;
    }
};
