const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasCoords = [];
        let objetivosCoords = [];
        let mapaBase = Array(filas).fill(null).map(() => Array(columnas).fill(''));

        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasCoords.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosCoords.push({ fila: r, col: c });
                }

                // Construye el mapa base solo con paredes, pisos y objetivos
                if (['#', ' ', '.'].includes(char)) {
                    mapaBase[r][c] = char;
                } else if (char === '@' || char === '$') {
                    // Si es jugador o caja, en el mapa base se considera piso vacío (' ') si no hay pared.
                    // Sin embargo, siguiendo la regla de que solo debe tener '#', ' ', '.', lo dejamos como espacio por defecto si no es objetivo ni pared.
                    mapaBase[r][c] = (char === '@' || char === '$') ? ' ' : ''; 
                }
            }
        }

        // Ajuste final del mapa base para asegurar que solo contenga '#', ' ', '.'
        const mapaFinal = nivel.map(filaStr => {
            let filaArray = [];
            for (let i = 0; i < filaStr.length; i++) {
                const char = filaStr[i];
                if (char === '.') {
                    filaArray.push('.');
                } else if (char === '#') {
                    filaArray.push('#');
                } else {
                    // Si es espacio vacío, jugador o caja, lo tratamos como piso ' '.
                    filaArray.push(' '); 
                }
            }
            return filaArray.join('');
        });


        const estado = {
            mapa: mapaFinal,
            jugador: jugadorPos,
            cajas: cajasCoords,
            objetivos: objetivosCoords,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Calcula el nuevo estado después de intentar un movimiento.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si el movimiento falla.
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaCol = jugador.col;
        let nuevaFila = jugador.fila;

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
        const filas = estado.mapa.length;
        const columnas = estado.mapa[0].length;

        if (nuevaFila < 0 || nuevaFila >= filas || nuevaCol < 0 || nuevaCol >= columnas) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites
        }

        // Verificar si la posición objetivo es una pared
        if (estado.mapa[nuevaFila][nuevaCol] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
        }

        let cajasAfectadas = [];
        let cajaEnDestino = null;

        // 2. Verificar si hay una caja en la posición objetivo del jugador
        for (const caja of estado.cajas) {
            if (caja.fila === nuevaFila && caja.col === nuevaCol) {
                cajaEnDestino = caja;
                break;
            }
        }

        // Caso 1: No hay cajas en el destino -> Movimiento simple
        if (!cajaEnDestino) {
            const nuevoEstado = {
                mapa: estado.mapa, // El mapa no cambia
                jugador: { fila: nuevaFila, col: nuevaCol },
                cajas: [...estado.cajas],
                objetivos: [...estado.objetivos],
                movimientos: estado.movimientos + 1
            };
            return nuevoEstado;
        }

        // Caso 2: Hay una caja en el destino -> Intento de empuje
        const { fila: boxFila, col: boxCol } = cajaEnDestino;
        let posEmpujable = { fila: boxFila, col: boxCol }; // Posición donde debe ir la caja

        // Calcular la posición final deseada para la caja (un paso más en la dirección)
        switch (direccion) {
            case "arriba":
                posEmpujable.fila -= 1;
                break;
            case "abajo":
                posEmpujable.fila += 1;
                break;
            case "izquierda":
                posEmpujable.col -= 1;
                break;
            case "derecha":
                posEmpujable.col += 1;
                break;
        }

        // Verificar si el empuje es posible:
        // a) Debe estar dentro de límites.
        if (posEmpujable.fila < 0 || posEmpujable.fila >= filas || posEmpujable.col < 0 || posEmpujable.col >= columnas) {
            return { ...estado, movimientos: estado.movimientos }; // Fuera de límites al empujar
        }

        // b) La posición final debe ser un piso o objetivo (no pared).
        if (estado.mapa[posEmpujable.fila][posEmpujable.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared al empujar
        }

        // c) La posición final no debe estar ocupada por otra caja (solo la que estamos moviendo).
        let colisionCaja = false;
        for (const caja of estado.cajas) {
            if ((caja !== cajaEnDestino) && (caja.fila === posEmpujable.fila && caja.col === posEmpujable.col)) {
                colisionCaja = true;
                break;
            }
        }

        if (colisionCaja) {
             return { ...estado, movimientos: estado.movimientos }; // Colisión con otra caja al empujar
        }


        // Empuje exitoso: Crear el nuevo estado
        const nuevoEstado = {
            mapa: estado.mapa,
            jugador: { fila: boxFila, col: boxCol }, // El jugador ocupa la posición de la caja
            cajas: [...estado.cajas],
            objetivos: [...estado.objetivos],
            movimientos: estado.movimientos + 1
        };

        // Actualizar la posición de la caja empujada
        const indexCaja = nuevoEstado.cajas.findIndex(c => c === cajaEnDestino);
        if (indexCaja !== -1) {
            nuevoEstado.cajas[indexCaja] = posEmpujable;
        }

        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length !== estado.objetivos.length) {
            // Si no hay objetivos o la cantidad de cajas es incorrecta, asumimos que no se puede ganar por esta lógica.
            return false;
        }

        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));
        let todasCubiertas = true;

        // Verificamos si cada caja está sobre un objetivo
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                todasCubiertas = false;
                break;
            }
        }

        // Verificamos si todos los objetivos están cubiertos por una caja (y no hay cajas extra)
        let objetivosCubiertos = new Set();
        for (const caja of estado.cajas) {
             if (objetivosSet.has(`${caja.fila},${caja.col}`)) {
                objetivosCubiertos.add(`${caja.fila},${caja.col}`);
            }
        }

        // Si el número de objetivos cubiertos es igual al total de objetivos, se ganó.
        return objetivosCubiertos.size === estado.objetivos.length;
    }
};
