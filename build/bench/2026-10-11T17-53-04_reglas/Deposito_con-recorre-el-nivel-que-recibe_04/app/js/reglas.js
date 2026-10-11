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

        let mapa = [];
        let jugador = { fila: -1, col: -1 };
        let cajas = [];
        let objetivos = [];

        for (let r = 0; r < filas; r++) {
            let rowString = ''; // Debe ser un string, no un array de caracteres
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                let mappedChar = ' '; // Por defecto es piso vacío

                if (char === '#') {
                    mappedChar = '#'; // Pared
                } else if (char === '.') {
                    mappedChar = '.'; // Objetivo
                    objetivos.push({ fila: r, col: c });
                } else if (char === ' ') {
                    // Piso vacío
                } else if (char === '@') {
                    // Jugador
                    jugador = { fila: r, col: c };
                    mappedChar = ' '; 
                } else if (char === '$') {
                    // Caja
                    cajas.push({ fila: r, col: c });
                    mappedChar = ' '; // La caja ocupa un espacio de piso en el mapa base
                }
                rowString += mappedChar;
            }
            mapa.push(rowString);
        }

        return {
            mapa: mapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevaPosicionJugador = { ...jugador };
        let nuevasCajas = [...cajas];
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
        let dr, dc;
        switch (direccion) {
            case "arriba": dr = -1; dc = 0; break;
            case "abajo": dr = 1; dc = 0; break;
            case "izquierda": dr = 0; dc = -1; break;
            case "derecha": dr = 0; dc = 1; break;
        }

        let destinoJugador = { fila: jugador.fila + dr, col: jugador.col + dc };

        // Verificar límites y paredes en el destino del jugador
        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        if (destinoJugador.fila < 0 || destinoJugador.fila >= filas || 
            destinoJugador.col < 0 || destinoJugador.col >= columnas) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites
        }

        // Verificar si el destino del jugador es una pared (usando el mapa base)
        if (estado.mapa[destinoJugador.fila][destinoJugador.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
        }

        // 2. Verificar si hay cajas en la posición destino del jugador
        const cajaEnDestino = cajas.some(c => c.fila === destinoJugador.fila && c.col === destinoJugador.col);

        if (!cajaEnDestino) {
            // Caso A: Movimiento simple (sin empujar nada)
            nuevaPosicionJugador = destinoJugador;
            return { 
                ...estado, 
                jugador: nuevaPosicionJugador, 
                movimientos: estado.movimientos + 1 
            };
        } else {
            // Caso B: Intento de empujar una caja
            const cajaAEmpujar = cajas.find(c => c.fila === destinoJugador.fila && c.col === destinoJugador.col);

            // Calcular la posición donde iría la caja (detrás del jugador)
            let destinoCaja = { fila: cajaAEmpujar.fila + dr, col: cajaAEmpujar.col + dc };

            // Verificar si el movimiento de empuje es posible
            const fueraDeLímitesCaja = destinoCaja.fila < 0 || destinoCaja.fila >= filas || 
                                       destinoCaja.col < 0 || destinoCaja.col >= columnas;
            
            // Colisión con pared en el destino de la caja
            const paredEnDestinoCaja = estado.mapa[destinoCaja.fila][destinoCaja.col] === '#';

            // ¿Hay otra caja bloqueando el camino?
            const otraCajaBloqueando = cajas.some(c => 
                (c !== cajaAEmpujar) && c.fila === destinoCaja.fila && c.col === destinoCaja.col
            );

            if (fueraDeLímitesCaja || paredEnDestinoCaja || otraCajaBloqueando) {
                // Empuje fallido: no se mueve nada, ni el jugador ni la caja.
                return { ...estado, movimientos: estado.movimientos }; 
            } else {
                // ¡Empuje exitoso!
                let nuevasCajasActualizadas = [];
                let cajaMovida = false;

                for (const c of cajas) {
                    if (c.fila === cajaAEmpujar.fila && c.col === cajaAEmpujar.col) {
                        // Esta es la caja que se mueve
                        nuevasCajasActualizadas.push(destinoCaja);
                        cajaMovida = true;
                    } else {
                        // Otras cajas permanecen en su lugar
                        nuevasCajasActualizadas.push(c);
                    }
                }

                if (!cajaMovida) {
                     // Esto no debería pasar si cajaEnDestino es true, pero por seguridad:
                     return { ...estado, movimientos: estado.movimientos }; 
                }


                // El jugador ocupa la posición de la caja original
                nuevaPosicionJugador = { fila: cajaAEmpujar.fila, col: cajaAEmpujar.col };

                return { 
                    ...estado, 
                    jugador: nuevaPosicionJugador, 
                    cajas: nuevasCajasActualizadas, 
                    movimientos: estado.movimientos + 1 
                };
            }
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const { cajas, objetivos } = estado;

        if (cajas.length === 0 || objetivos.length === 0) {
            // Si no hay nada que mover o no hay objetivos definidos, asumimos que no se ha ganado aún.
            return false;
        }

        // Crear un set de coordenadas objetivo para búsqueda rápida
        const objetivosSet = new Set(objetivos.map(o => `${o.fila},${o.col}`));

        // Verificar si cada caja está en el conjunto de objetivos
        for (const caja of cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                return false; // Al menos una caja no está sobre un objetivo
            }
        }

        // Si pasamos por todas las cajas, significa que están todas en objetivos
        return true;
    }
};
