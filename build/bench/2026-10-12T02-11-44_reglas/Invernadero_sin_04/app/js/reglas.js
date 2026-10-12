const Reglas = {
    /**
     * Crea un nuevo estado inicial a partir de la representación del nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // Inicializar el mapa limpio (solo #, ' ', '.') reemplazando @ y $ por espacios para mantener la longitud de la fila.
        const mapaLimpio = nivel.map(fila => {
            let nuevaFila = '';
            for (let i = 0; i < fila.length; i++) {
                const char = fila[i];
                if (char === '@' || char === '$') {
                    nuevaFila += ' '; // Reemplazar jugador o caja con un espacio
                } else {
                    nuevaFila += char; // Mantener #, ' ', '.'
                }
            }
            return nuevaFila;
        });

        // Encontrar posiciones clave (esto debe hacerse sobre el nivel original)
        for (let r = 0; r < nivel.length; r++) {
            const fila = nivel[r];
            for (let c = 0; c < fila.length; c++) {
                const char = fila[c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        return {
            mapa: mapaLimpio, // Mapa sin jugadores ni cajas
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado inmutable, o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaFila = jugador.fila;
        let nuevaCol = jugador.col;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas aún)
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

        // Verificar límites y paredes en la posición objetivo del jugador
        if (nuevaFila < 0 || nuevaFila >= 9 || nuevaCol < 0 || nuevaCol >= 9) {
            return estado; // Fuera de límites
        }
        const pared = estado.mapa[nuevaFila][nuevaCol] === '#';
        if (pared) {
            return estado; // Colisión con pared
        }

        // Verificar si hay cajas en la posición objetivo del jugador
        let cajaEnDestino = estado.cajas.find(c => c.fila === nuevaFila && c.col === nuevaCol);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (sin empujar nada)
            const nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar el estado
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Intento de empujar una caja (cajaEnDestino)

            // Calcular la posición objetivo para la caja (detrás de ella)
            let destinoCajaFila = nuevaFila;
            let destinoCajaCol = nuevaCol;

            switch (direccion) {
                case "arriba":
                    destinoCajaFila -= 1;
                    break;
                case "abajo":
                    destinoCajaFila += 1;
                    break;
                case "izquierda":
                    destinoCajaCol -= 1;
                    break;
                case "derecha":
                    destinoCajaCol += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido (no pared, no fuera de límites)
            if (destinoCajaFila < 0 || destinoCajaFila >= 9 || destinoCajaCol < 0 || destinoCajaCol >= 9) {
                return estado; // La caja choca contra el borde del mapa
            }

            const paredDestino = estado.mapa[destinoCajaFila][destinoCajaCol] === '#';
            if (paredDestino) {
                return estado; // La caja choca contra una pared
            }

            // Verificar si hay otra caja en el destino de la caja
            const collisionBox = estado.cajas.some(c => 
                c !== cajaEnDestino && c.fila === destinoCajaFila && c.col === destinoCajaCol
            );

            if (collisionBox) {
                return estado; // La caja choca contra otra caja
            }

            // ¡Movimiento exitoso de empuje! Crear nuevo estado.
            const nuevoEstado = JSON.parse(JSON.stringify(estado));

            // 1. Actualizar posición del jugador: va donde estaba la caja
            nuevoEstado.jugador = { fila: nuevaFila, col: nuevaCol };

            // 2. Actualizar posición de la caja empujada
            const indexCaja = nuevoEstado.cajas.findIndex(c => c === cajaEnDestino);
            if (indexCaja !== -1) {
                nuevoEstado.cajas[indexCaja] = { fila: destinoCajaFila, col: destinoCajaCol };
            }

            // 3. Actualizar movimientos
            nuevoEstado.movimientos += 1;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
ganado: function(estado) {
        // Si no hay objetivos, se considera ganado (o el estado inicial es inválido).
        if (estado.objetivos.length === 0) return true;

        // Crear un set de coordenadas donde están las cajas para búsqueda rápida
        const cajasSet = new Set();
        estado.cajas.forEach(box => cajasSet.add(`${box.fila},${box.col}`));

        // Verificar si cada objetivo tiene al menos una caja encima
        for (const objetivo of estado.objetivos) {
            const key = `${objetivo.fila},${objetivo.col}`;
            if (!cajasSet.has(key)) {
                return false; // Encontramos un objetivo sin cubrir
            }
        }

        // Si el bucle termina, significa que todos los objetivos están cubiertos por al menos una caja.
        return true;
    }
};
