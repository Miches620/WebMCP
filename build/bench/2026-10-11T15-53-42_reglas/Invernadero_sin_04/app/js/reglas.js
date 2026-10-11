const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (9x9).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // 1. Identificar posiciones iniciales de elementos clave
        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
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

        // 2. Crear el mapa de estado (solo #, ' ', .)
        let mapaEstado = [];
        for (let r = 0; r < nivel.length; r++) {
            let filaString = '';
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaString += '#';
                } else if (char === ' ' || char === '.') {
                    // Solo mantenemos el carácter base, ignorando @ y $ para el mapa de estado.
                    filaString += char;
                } else {
                    // Esto debería ser imposible si el nivel es válido, pero por seguridad:
                    filaString += ' '; 
                }
            }
            mapaEstado.push(filaString);
        }

        return {
            mapa: mapaEstado,
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
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugadorPos = estado.jugador;
        let nuevaFila = jugadorPos.fila;
        let nuevaCol = jugadorPos.col;

        // 1. Calcular la posición objetivo del jugador (P_target)
        switch (direccion) {
            case "arriba":
                nuevaFila -= 1;
                break;
            case "abajo":
                nuevaFila += 1;
                break;
            case "izquierda":
                nuevaCol -= 1;
                break;
            case "derecha":
                nuevaCol += 1;
                break;
        }

        // Verificar límites del mapa (9x9)
        const MAX_SIZE = 9;
        if (nuevaFila < 0 || nuevaFila >= MAX_SIZE || nuevaCol < 0 || nuevaCol >= MAX_SIZE) {
            return estado; // Fuera de límites
        }

        // Verificar pared en P_target
        if (estado.mapa[nuevaFila][nuevaCol] === '#') {
            return estado;
        }

        // 2. Comprobar si hay cajas delante del jugador
        const cajaDelante = estado.cajas.find(c => c.fila === nuevaFila && c.col === nuevaCol);

        if (!cajaDelante) {
            // Caso A: Movimiento simple (sin empujar nada)
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Intento de Empuje
            const cajaPos = cajaDelante;
            let posEmpujada = { fila: nuevaFila + (direccion === "abajo" ? 1 : direccion === "arriba" ? -1 : 0), col: newCol + (direccion === "derecha" ? 1 : direccion === "izquierda" ? -1 : 0) };

            // Verificar si la caja puede moverse a posEmpujada
            const esPared = estado.mapa[posEmpujada.fila][posEmpujada.col] === '#';
            const fueraDeLimos = posEmpujada.fila < 0 || posEmpujada.fila >= MAX_SIZE || posEmpujada.col < 0 || posEmpujada.col >= MAX_SIZE;

            // Verificar colisión de la caja con otra caja o pared en el destino
            const hayColision = esPared || fueraDeLimos || estado.cajas.some(c => c !== cajaDelante && c.fila === posEmpujada.fila && c.col === posEmpujada.col);

            if (hayColision) {
                return estado; // No se puede empujar, el jugador no se mueve
            } else {
                // Movimiento exitoso de Empuje:
                nuevoEstado.jugador = cajaPos; // El jugador ocupa la posición anterior de la caja
                nuevoEstado.movimientos += 1;

                // Actualizar posiciones de las cajas (la que fue empujada y el resto)
                let nuevasCajas = estado.cajas.map(c => ({ ...c }));

                // Mover la caja actual del jugador a su nueva posición
                const indiceCaja = nuevasCajas.findIndex(c => c === cajaDelante);
                if (indiceCaja !== -1) {
                    nuevasCajas[indiceCaja] = posEmpujada;
                }

                // Actualizar el estado con las cajas movidas
                nuevoEstado.cajas = nuevasCajas;
                return nuevoEstado;
            }
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0 || cajas.length === 0) return false; // No hay nada que verificar

        // Creamos un set de coordenadas objetivo para una búsqueda rápida
        const objetivosSet = new Set(objectivos.map(o => `${o.fila},${o.col}`));

        // Verificamos si cada caja está sobre un objetivo
        let todasCubiertas = true;
        for (const caja of cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                todasCubiertas = false;
                break;
            }
        }

        // Para ganar, necesitamos que el número de cajas sea igual al número de objetivos Y todas estén en ellos.
        if (cajas.length !== objetivos.length) return false; 
        
        return todasCubiertas;
    }
};
