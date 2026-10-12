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

        // Iteramos sobre el número real de filas proporcionadas en el nivel
        for (let r = 0; r < nivel.length; r++) {
            const rowString = nivel[r];
            if (!rowString) continue; // Saltar si la fila no existe o es nula

            nuevoMapa[r] = [];
            
            // Iteramos solo hasta la longitud real de la cadena de la fila
            for (let c = 0; c < rowString.length; c++) {
                const char = rowString[c];
                let effectiveChar = char;

                if (effectiveChar === '@') {
                    jugador = { fila: r, col: c };
                    nuevoMapa[r].push(' '); // El jugador no se dibuja en el mapa base
                } else if (effectiveChar === '$') {
                    cajas.push({ fila: r, col: c });
                    nuevoMapa[r].push(' '); // La caja no se dibuja en el mapa base
                } else if (effectiveChar === '.') {
                    objetivos.push({ fila: r, col: c });
                    nuevoMapa[r].push('.');
                } else if (effectiveChar === '#') {
                    nuevoMapa[r].push('#');
                } else { // ' ' o cualquier otro carácter que no sea especial
                    nuevoMapa[r].push(' ');
                }
            }
        }

        // Convertir el array de arrays a un array de strings para mantener la estructura del contrato.
        const mapaString = nuevoMapa.map(row => row.join(''));

        return {
            mapa: mapaString,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
mover: function(estado, direccion) {
        // 1. Clonar el estado para asegurar inmutabilidad al inicio del proceso de cálculo.
        // Usaremos este clon como base si no hay movimiento exitoso o para construir el nuevo estado final.
        const estadoBase = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas]; // Copia superficial del array de cajas
        let nuevaPosicionJugador = { ...jugadorActual };
        let movimientoExitoso = false;

        // 2. Calcular la posición objetivo del jugador
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

        let objetivoPos = { fila: jugadorActual.fila + dr, col: jugadorActual.col + dc };

        // Verificar límites del mapa
        if (objetivoPos.fila < 0 || objetivoPos.fila >= estado.mapa.length || objetivoPos.col < 0 || objetivoPos.col >= estado.mapa[0].length) {
            return estado; // Fuera de límites
        }

        // Obtener el carácter del mapa en la posición objetivo
        const charEnObjetivo = estado.mapa[objetivoPos.fila][objetivoPos.col];

        // Verificar pared
        if (charEnObjetivo === '#') {
            return estado; // Colisión con pared
        }

        // 3. Determinar si el objetivo está ocupado por una caja
        let cajaAfectadaIndex = -1;
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === objetivoPos.fila && caja.col === objetivoPos.col) {
                cajaAfectadaIndex = i;
                break;
            }
        }

        // 4. Lógica de movimiento
        if (cajaAfectadaIndex === -1) {
            // Caso A: El destino está libre (no hay caja). Mover jugador directamente.
            nuevaPosicionJugador = objetivoPos;
            movimientoExitoso = true;

        } else {
            // Caso B: El destino está ocupado por una caja. Intentar empujar.
            const cajaOriginal = estado.cajas[cajaAfectadaIndex];
            let posDetras = { fila: objetivoPos.fila + dr, col: objetivoPos.col + dc };

            // Verificar si el espacio detrás de la caja es válido para empujar
            if (posDetras.fila < 0 || posDetras.fila >= estado.mapa.length || posDetras.col < 0 || posDetras.col >= estado.mapa[0].length) {
                return estado; // No se puede empujar fuera del mapa
            }

            const charDetras = estado.mapa[posDetras.fila][posDetras.col];
            if (charDetras === '#') {
                return estado; // La caja choca contra una pared detrás de ella
            }

            // Verificar si el espacio detrás está ocupado por otra caja
            let collisionConOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                const caja = estado.cajas[i];
                // Ignoramos la caja que estamos intentando mover (cajaAfectadaIndex)
                if (i !== cajaAfectadaIndex && caja.fila === posDetras.fila && caja.col === posDetras.col) {
                    collisionConOtraCaja = true;
                    break;
                }
            }

            if (!collisionConOtraCaja) {
                // Empuje exitoso: el jugador va a la caja, y la caja se mueve detrás.
                nuevaPosicionJugador = objetivoPos; // El jugador ocupa donde estaba la caja
                movimientoExitoso = true;

                // *** CORRECCIÓN DE IMMUTABILIDAD: Clonar la caja que se mueve antes de modificarla ***
                let nuevaCajasTemporal = [...estado.cajas]; 
                const cajaMovidaClonada = JSON.parse(JSON.stringify(cajaOriginal)); // Deep clone del objeto caja
                cajaMovidaClonada.fila = posDetras.fila;
                cajaMovidaClonada.col = posDetras.col;

                // Reemplazar la referencia de la caja en el array copiado
                nuevaCajasTemporal[cajaAfectadaIndex] = cajaMovidaClonada; 
                nuevasCajas = nuevaCajasTemporal; // Actualizar nuevasCajas con las posiciones clonadas y movidas
            } else {
                return estado; // Bloqueado por otra caja
            }
        }

        if (movimientoExitoso) {
            // Crear el nuevo estado inmutable usando los valores calculados.
            const nuevoEstadoFinal = JSON.parse(JSON.stringify(estado));
            nuevoEstadoFinal.jugador = nuevaPosicionJugador;
            nuevoEstadoFinal.cajas = nuevasCajas; // Usamos la copia de cajas actualizada/clonada
            nuevoEstadoFinal.movimientos += 1;
            return nuevoEstadoFinal;
        } else {
            // Si no hubo movimiento exitoso, devolver el estado original sin modificar movimientos
            return estado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo de depósito.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        let cajasSobreObjetivo = new Set();

        // Identificar qué coordenadas de objetivo tienen una caja encima
        for (const caja of estado.cajas) {
            for (const objetivo of estado.objetivos) {
                if (caja.fila === objetivo.fila && caja.col === objetivo.col) {
                    cajasSobreObjetivo.add(`${caja.fila},${caja.col}`);
                }
            }
        }

        // Comprobar si el número de objetivos cubiertos es igual al total de objetivos
        return cajasSobreObjetivo.size === estado.objetivos.length;
    }
};
