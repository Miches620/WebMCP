const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
    let jugadorPos = null;
    let cajasIniciales = [];
    let objetivosIniciales = [];
    const mapaBase = [];

    // Iteramos sobre las filas (r) y columnas (c) para construir el estado.
    for (let r = 0; r < nivel.length; r++) {
        let rowString = '';
        for (let c = 0; c < nivel[r].length; c++) {
            const char = nivel[r][c];
            let mapChar = char;

            // Determinar el carácter para la representación estática del mapa.
            // Si es un jugador o caja, ocupan espacio pero no son parte de la estructura base del mapa (se reemplazan por ' ').
            if (char === '@' || char === '$') {
                mapChar = ' '; 
            } else if (char !== '#' && char !== '.' && char !== ' ') {
                 // Fallback para asegurar que siempre se añada un carácter y mantener la alineación.
                 mapChar = ' ';
            }

            rowString += mapChar; // Siempre añadimos un carácter para mantener el ancho de la grilla.

            // Registrar entidades y objetivos basándose en los caracteres originales.
            if (char === '.') {
                objetivosIniciales.push({ fila: r, col: c });
            } 
            
            if (char === '@') {
                jugadorPos = { fila: r, col: c };
            } else if (char === '$') {
                cajasIniciales.push({ fila: r, col: c });
            }
        }
        mapaBase.push(rowString);
    }

    return {
        mapa: mapaBase,
        jugador: jugadorPos,
        cajas: cajasIniciales,
        objetivos: objetivosIniciales,
        movimientos: 0
    };
},

    /**
     * Intenta mover al jugador o empujar una caja.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento válido.
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaPosJugador = { ...jugador };

        // 1. Calcular la posición objetivo del jugador
        switch (direccion) {
            case "arriba":
                nuevaPosJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosJugador.col += 1;
                break;
        }

        // Verificar límites del mapa (8x8)
        if (nuevaPosJugador.fila < 0 || nuevaPosJugador.fila > 7 || 
            nuevaPosJugador.col < 0 || nuevaPosJugador.col > 7) {
            return { ...estado, movimientos: estado.movimientos }; // No se mueve nada
        }

        // Verificar si la posición objetivo es una pared
        if (estado.mapa[nuevaPosJugador.fila][nuevaPosJugador.col] === '#') {
            return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
        }

        let cajasNuevas = [...estado.cajas];
        let jugadorMovido = false;
        let movimientoValido = true;

        // 2. Verificar colisiones y determinar el nuevo estado
        
        // A) ¿Hay una caja en la posición objetivo? (Intento de empuje)
        const cajaEnDestino = estado.cajas.some(caja => 
            caja.fila === nuevaPosJugador.fila && caja.col === nuevaPosJugador.col
        );

        if (cajaEnDestino) {
            // Es un empuje. Calcular la posición donde debe ir la caja.
            let posCajaOriginal = null;
            for (const caja of estado.cajas) {
                if (caja.fila === nuevaPosJugador.fila && caja.col === nuevaPosJugador.col) {
                    posCajaOriginal = caja;
                    break;
                }
            }

            let posCajaDestino = { ...posCajaOriginal };
            switch (direccion) {
                case "arriba": posCajaDestino.fila -= 1; break;
                case "abajo": posCajaDestino.fila += 1; break;
                case "izquierda": posCajaDestino.col -= 1; break;
                case "derecha": posCajaDestino.col += 1; break;
            }

            // Verificar si el destino de la caja es válido:
            // 1. No puede salir del mapa (ya cubierto por límites, pero mejor verificar)
            if (posCajaDestino.fila < 0 || posCajaDestino.fila > 7 || 
                posCajaDestino.col < 0 || posCajaDestino.col > 7) {
                return { ...estado, movimientos: estado.movimientos }; // Colisión con borde
            }

            // 2. No puede chocar contra una pared en el destino de la caja
            if (estado.mapa[posCajaDestino.fila][posCajaDestino.col] === '#') {
                return { ...estado, movimientos: estado.movimientos }; // Colisión con pared
            }

            // 3. No puede chocar contra otra caja en el destino de la caja
            const hayOtraCajaEnDestino = estado.cajas.some(caja => 
                !(caja === posCajaOriginal) && // Excluir la caja que estamos moviendo
                caja.fila === posCajaDestino.fila && 
                caja.col === posCajaDestino.col
            );

            if (hayOtraCajaEnDestino) {
                return { ...estado, movimientos: estado.movimientos }; // Colisión con otra caja
            }

            // Si todo es válido: ¡Empuje exitoso!
            cajasNuevas = cajasNuevas.map(c => 
                (c === posCajaOriginal) ? posCajaDestino : c
            );
            jugadorMovido = true;

        } else {
            // B) No hay caja en destino, solo movimiento simple (piso/objetivo).
            // Solo necesitamos verificar si la posición objetivo está ocupada por otra caja.
            const cajaEnDestinoSimple = estado.cajas.some(caja => 
                caja.fila === nuevaPosJugador.fila && caja.col === nuevaPosJugador.col
            );

            if (cajaEnDestinoSimple) {
                 // Esto no debería pasar si la lógica de cajas es correcta, pero por seguridad:
                 return { ...estado, movimientos: estado.movimientos }; 
            }
        }


        // 3. Construir el nuevo estado exitoso
        const nuevoEstado = {
            mapa: estado.mapa, // El mapa no cambia
            jugador: nuevaPosJugador,
            cajas: cajasNuevas,
            objetivos: estado.objetivos,
            movimientos: estado.movimientos + 1
        };

        return nuevoEstado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, false en caso contrario.
     */
ganado: function(estado) {
        // Si no hay objetivos, la condición se cumple vacuamente.
        if (estado.objetivos.length === 0) return true;

        // 1. Crear un set de coordenadas objetivo que deben ser cubiertos
        const objetivosSet = new Set();
        estado.objetivos.forEach(obj => objetivosSet.add(`${obj.fila},${obj.col}`));

        // 2. Crear un set de coordenadas donde hay cajas (la cobertura)
        const cajasSet = new Set();
        estado.cajas.forEach(box => cajasSet.add(`${box.fila},${box.col}`));

        // 3. Verificar si cada objetivo tiene al menos una caja encima
        for (const objCoord of objetivosSet) {
            if (!cajasSet.has(objCoord)) {
                return false; // Encontramos un objetivo sin cobertura de caja
            }
        }

        // Si todos los objetivos fueron revisados y están cubiertos, se gana.
        return true;
    }
};
