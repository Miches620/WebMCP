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

        let mapaBase = [];
        let jugadorPos = null;
        let cajasPos = [];
        let objetivosPos = [];

        // 1. Inicializar el mapa base y encontrar posiciones iniciales
        for (let r = 0; r < filas; r++) {
            let filaActual = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaActual += '#';
                } else if (char === '.') {
                    filaActual += '.';
                    objetivosPos.push({ fila: r, col: c });
                } else if (char === '$') {
                    // Las cajas se registran por su posición inicial
                    cajasPos.push({ fila: r, col: c });
                    filaActual += ' '; // El mapa base no muestra la caja, solo el piso
                } else if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                    filaActual += ' '; // El mapa base no muestra al jugador
                } else {
                    // Espacio vacío o objetivo que ya fue contado como '.'
                    if (char !== '$' && char !== '@') {
                        filaActual += ' ';
                    }
                }
            }
            mapaBase.push(filaActual);
        }

        return {
            mapa: mapaBase,
            jugador: jugadorPos,
            cajas: cajasPos,
            objetivos: objetivosPos,
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
        // Crear una copia profunda para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

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

        const { jugador, cajas } = estado;
        let nuevaPosJugador = { fila: jugador.fila + dr, col: jugador.col + dc };

        // 1. Comprobar límites y paredes para el jugador
        if (nuevaPosJugador.fila < 0 || nuevaPosJugador.fila >= estado.mapa.length ||
            nuevaPosJugador.col < 0 || nuevaPosJugador.col >= estado.mapa[0].length) {
            return nuevoEstado; // Fuera de límites
        }

        if (estado.mapa[nuevaPosJugador.fila][nuevaPosJugador.col] === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // 2. Comprobar si el jugador intenta moverse a una caja
        let cajaImpactada = null;
        for (const caja of cajas) {
            if (caja.fila === nuevaPosJugador.fila && caja.col === nuevaPosJugador.col) {
                cajaImpactada = caja;
                break;
            }
        }

        // 3. Caso: Colisión con una caja (Intento de empuje)
        if (cajaImpactada) {
            let nuevaPosCaja = { fila: cajaImpactada.fila + dr, col: cajaImpactada.col + dc };

            // Comprobar si el destino del empuje es válido
            const puedeEmpujar = 
                nuevaPosCaja.fila >= 0 && nuevaPosCaja.fila < estado.mapa.length &&
                nuevaPosCaja.col >= 0 && nuevaPosCaja.col < estado.mapa[0].length &&
                estado.mapa[nuevaPosCaja.fila][nuevaPosCaja.col] !== '#' && // No choca con pared
                !this._estaOcupadoPorOtraCaja(cajas, nuevaPosCaja); // No choca con otra caja

            if (puedeEmpujar) {
                // Movimiento exitoso: Actualizar jugador y la caja empujada
                nuevoEstado.jugador = nuevaPosJugador;
                
                const nuevasCajas = cajas.map(c => 
                    c.fila === cajaImpactada.fila && c.col === cajaImpactada.col ? 
                    { fila: nuevaPosCaja.fila, col: nuevaPosCaja.col } : 
                    c
                );
                nuevoEstado.cajas = nuevasCajas;

                // Actualizar movimientos y devolver el nuevo estado
                nuevoEstado.movimientos += 1;
                return nuevoEstado;
            } else {
                // El empuje falla (pared o caja bloqueada)
                return nuevoEstado;
            }
        } 
        
        // 4. Caso: Movimiento libre (Piso/Objetivo)
        else {
            // Movimiento exitoso sin cajas involucradas
            nuevoEstado.jugador = nuevaPosJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las posiciones objetivo están ocupadas por una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        const cajasEnObjetivos = estado.cajas.filter(c => 
            estado.objetivos.some(obj => obj.fila === c.fila && obj.col === c.col)
        );

        // Compara la cantidad de objetivos con el número de cajas en ellos
        return cajasEnObjetivos.length === estado.objetivos.length;
    },

    /**
     * Método auxiliar privado para verificar si una posición está ocupada por otra caja.
     * @param {Array<{fila: number, col: number}>} cajas - Lista de posiciones de las cajas.
     * @param {{fila: number, col: number}} pos - Posición a verificar.
     * @returns {boolean} True si la posición está ocupada por otra caja.
     */
    _estaOcupadoPorOtraCaja: function(cajas, pos) {
        return cajas.some(c => c.fila === pos.fila && c.col === pos.col);
    }
};

// Asignamos el método auxiliar estático para que Reglas lo use internamente sin problemas de scope
Reglas._estaOcupadoPorOtraCaja = Reglas._estaOcupadoPorOtraCaja;
