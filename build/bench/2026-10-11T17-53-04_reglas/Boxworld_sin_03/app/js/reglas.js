const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un mapa de nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (10x10).
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
        const filas = nivel.length;
        if (filas === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
        
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasArray = [];
        let objetivosArray = [];
        let mapaBase = [];

        // Paso 1: Identificar posiciones iniciales y construir el mapa base (solo #, ' ', '.')
        for (let r = 0; r < filas; r++) {
            const filaStr = nivel[r];
            let nuevaFila = '';
            for (let c = 0; c < columnas; c++) {
                const char = filaStr[c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                    nuevaFila += ' '; // El jugador no se cuenta en el mapa base
                } else if (char === '$') {
                    cajasArray.push({ fila: r, col: c });
                    nuevaFila += ' '; // La caja no se cuenta en el mapa base
                } else if (char === '.') {
                    objetivosArray.push({ fila: r, col: c });
                    nuevaFila += '.';
                } else if (char === '#') {
                    nuevaFila += '#';
                } else { // ' '
                    nuevaFila += ' ';
                }
            }
            mapaBase.push(nuevaFila);
        }

        const estado = {
            mapa: mapaBase,
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Intenta mover al jugador en la dirección dada y maneja colisiones/empujes.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si el movimiento falla).
     */
mover(estado, direccion) {
        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let nuevasCajas = [...estado.cajas]; // Copia superficial de la lista de cajas
        let nuevosMovimientos = estado.movimientos;

        // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
        let nuevaFilaJugador = jugadorActual.fila;
        let nuevaColJugador = jugadorActual.col;

        switch (direccion) {
            case "arriba":
                nuevaFilaJugador -= 1;
                break;
            case "abajo":
                nuevaFilaJugador += 1;
                break;
            case "izquierda":
                nuevaColJugador -= 1;
                break;
            case "derecha":
                nuevaColJugador += 1;
                break;
        }

        // Verificar límites del mapa (Asumiendo un tamaño fijo, aunque el contrato no lo especifica, se mantiene la lógica original)
        const FILA_MAX = estado.mapa.length;
        const COL_MAX = estado.mapa[0].length;

        if (nuevaFilaJugador < 0 || nuevaFilaJugador >= FILA_MAX || nuevaColJugador < 0 || nuevaColJugador >= COL_MAX) {
            return estado; // Fuera de límites
        }

        // Verificar colisión con pared en la posición objetivo del jugador
        if (estado.mapa[nuevaFilaJugador][nuevaColJugador] === '#') {
            return estado; // Colisión con pared
        }

        // 2. Detectar si hay cajas en el camino o en destino
        const cajaEnDestino = nuevasCajas.some(caja => caja.fila === nuevaFilaJugador && caja.col === nuevaColJugador);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento libre (sin cajas en el destino)
            // Creamos una copia del estado y actualizamos solo jugador y movimientos
            const nuevoEstado = JSON.parse(JSON.stringify(estado));
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            nuevoEstado.movimientos = estado.movimientos + 1;
            return nuevoEstado;
        } else {
            // Caso 2: Hay una caja en el destino (Intento de empuje)

            // Identificar la caja que está justo delante del jugador
            let cajaAEmpujarIndex = -1;
            for (let i = 0; i < nuevasCajas.length; i++) {
                if (nuevasCajas[i].fila === nuevaFilaJugador && nuevasCajas[i].col === nuevaColJugador) {
                    cajaAEmpujarIndex = i;
                    break;
                }
            }

            // Calcular la posición objetivo de la caja empujada
            let nuevaFilaCaja = nuevaFilaJugador;
            let nuevaColCaja = nuevaColJugador;

            switch (direccion) {
                case "arriba":
                    nuevaFilaCaja -= 1;
                    break;
                case "abajo":
                    nuevaFilaCaja += 1;
                    break;
                case "izquierda":
                    nuevaColCaja -= 1;
                    break;
                case "derecha":
                    nuevaColCaja += 1;
                    break;
            }

            // Verificar si el empuje es posible:
            // a) ¿La nueva posición de la caja está fuera de límites o contra una pared?
            if (nuevaFilaCaja < 0 || nuevaFilaCaja >= FILA_MAX || nuevaColCaja < 0 || nuevaColCaja >= COL_MAX || estado.mapa[nuevaFilaCaja][nuevaColCaja] === '#') {
                return estado; // Empuje fallido (pared o límite)
            }

            // b) ¿La nueva posición de la caja está ocupada por otro objeto (otra caja)?
            const colisionConOtroObjeto = nuevasCajas.some((caja, i) => i !== cajaAEmpujarIndex && caja.fila === nuevaFilaCaja && caja.col === nuevaColCaja);

            if (colisionConOtroObjeto) {
                return estado; // Empuje fallido (otra caja bloquea)
            }

            // Si el empuje es exitoso:
            const nuevoEstado = JSON.parse(JSON.stringify(estado));

            // 1. Actualizar posición del jugador
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };

            // 2. Crear y actualizar la caja empujada (asegurando inmutabilidad)
            const cajaMovida = { fila: nuevaFilaCaja, col: nuevaColCaja };
            nuevoEstado.cajas[cajaAEmpujarIndex] = cajaMovida;

            // 3. Actualizar movimientos
            nuevoEstado.movimientos = estado.movimientos + 1;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las posiciones objetivo están ocupadas por al menos una caja.
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
                return false; // Al menos un objetivo no está cubierto
            }
        }
        return true; // Todos los objetivos están cubiertos
    }
};
