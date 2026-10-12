const Reglas = {

    /**
     * Crea el estado inicial del juego a partir de un mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (10x10).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        // 1. Inicializar el mapa limpio y encontrar posiciones
        const mapaLimpio = nivel.map(fila => fila.split('')); // Copia mutable de caracteres

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { fila: r, col: c };
                    // El mapa limpio solo guarda paredes y objetivos/piso.
                    mapaLimpio[r][c] = ' '; 
                } else if (char === '$') {
                    cajas.push({ fila: r, col: c });
                    mapaLimpio[r][c] = ' '; // Las cajas no se dibujan en el mapa base
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    // Los objetivos sí deben permanecer visibles en el mapa limpio
                    mapaLimpio[r][c] = '.'; 
                } else if (char === '#') {
                    // Paredes se mantienen
                    mapaLimpio[r][c] = '#';
                } else if (char === ' ') {
                    // Piso vacío
                    mapaLimpio[r][c] = ' ';
                }
            }
        }

        return {
            mapa: mapaLimpio, // Mapa de caracteres ['#', ' ', '.']
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde: no hay objetivos

        const cajasEnObjetivos = estado.cajas.every(box => {
            return estado.objetivos.some(obj => obj.fila === box.fila && obj.col === box.col);
        });

        return cajasEnObjetivos;
    },

    /**
     * Mueve el jugador y las cajas según la dirección, devolviendo un nuevo estado.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o una copia si el movimiento falla).
     */
    mover(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = nuevoEstado.jugador;
        let nuevasCajas = [...nuevoEstado.cajas];
        let movimientoExitoso = false;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        let targetPlayer = { ...jugadorActual };
        switch (direccion) {
            case "arriba": targetPlayer.fila -= 1; break;
            case "abajo": targetPlayer.fila += 1; break;
            case "izquierda": targetPlayer.col -= 1; break;
            case "derecha": targetPlayer.col += 1; break;
        }

        // Verificar límites del mapa (asumiendo 10x10)
        if (targetPlayer.fila < 0 || targetPlayer.fila >= 10 || targetPlayer.col < 0 || targetPlayer.col >= 10) {
            return nuevoEstado; // Fuera de límites
        }

        // Verificar si el destino es una pared en el mapa base
        if (nuevoEstado.mapa[targetPlayer.fila][targetPlayer.col] === '#') {
             return nuevoEstado; // Colisión con pared
        }


        // 2. Comprobar colisiones y lógica de empuje

        let cajaAEmpujar = null;
        let indiceCaja = -1;

        // ¿Hay una caja en la posición objetivo?
        for (let i = 0; i < nuevasCajas.length; i++) {
            const box = nuevasCajas[i];
            if (box.fila === targetPlayer.fila && box.col === targetPlayer.col) {
                cajaAEmpujar = box;
                indiceCaja = i;
                break;
            }
        }

        // Caso 1: No hay caja en el destino -> Movimiento simple
        if (!cajaAEmpujar) {
            // El movimiento es válido (no pared, no fuera de límites).
            nuevoEstado.jugador = targetPlayer;
            nuevoEstado.movimientos += 1;
            movementExitoso = true;

        } else {
            // Caso 2: Hay caja en el destino -> Intentar empujar
            let boxNext = { ...cajaAEmpujar };
            switch (direccion) {
                case "arriba": boxNext.fila -= 1; break;
                case "abajo": boxNext.fila += 1; break;
                case "izquierda": boxNext.col -= 1; break;
                case "derecha": boxNext.col += 1; break;
            }

            // Verificar si el destino de la caja es válido (no pared, no fuera de límites)
            if (boxNext.fila < 0 || boxNext.fila >= 10 || boxNext.col < 0 || boxNext.col >= 10) {
                return nuevoEstado; // La caja choca contra el borde del mapa
            }

            // Verificar si la posición siguiente de la caja está ocupada por otra cosa (pared o caja)
            if (nuevoEstado.mapa[boxNext.fila][boxNext.col] === '#') {
                return nuevoEstado; // La caja choca contra una pared
            }

            let colisionConOtraCaja = false;
            for (let i = 0; i < nuevasCajas.length; i++) {
                if (i !== indiceCaja && nuevasCajas[i].fila === boxNext.fila && nuevasCajas[i].col === boxNext.col) {
                    colisionConOtraCaja = true;
                    break;
                }
            }

            if (colisionConOtraCaja) {
                return nuevoEstado; // La caja choca contra otra caja
            }

            // ¡Empuje exitoso! Actualizar posiciones.
            nuevoEstado.jugador = cajaAEmpujar; // El jugador ocupa la posición de la caja original
            nuevoEstado.movimientos += 1;
            movementExitoso = true;

            // Mover la caja:
            const nuevaCajaPosicion = { ...boxNext };
            nuevasCajas[indiceCaja] = nuevaCajaPosicion; // Actualizar la posición de la caja empujada

            // Devolver el estado con las cajas actualizadas
            nuevoEstado.cajas = [...nuevasCajas];
        }


        if (movementExitoso) {
             return nuevoEstado;
        } else {
            // Si no hubo movimiento exitoso, devolver una copia del estado original sin cambios de movimientos.
            return JSON.parse(JSON.stringify(estado));
        }
    }
};
