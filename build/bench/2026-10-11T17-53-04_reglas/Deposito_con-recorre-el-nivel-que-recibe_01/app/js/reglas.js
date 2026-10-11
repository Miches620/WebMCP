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
        let cajasPos = [];
        let objetivosPos = [];
        let mapaNuevo = [];

        // 1. Parsear el nivel para obtener posiciones y construir el mapa base
        for (let r = 0; r < filas; r++) {
            let filaString = nivel[r];
            let nuevaFilaMapa = '';
            for (let c = 0; c < columnas; c++) {
                const char = filaString[c];

                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                    nuevaFilaMapa += ' '; // El jugador no se dibuja en el mapa base
                } else if (char === '$') {
                    cajasPos.push({ fila: r, col: c });
                    nuevaFilaMapa += ' '; // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivosPos.push({ fila: r, col: c });
                    nuevaFilaMapa += '.';
                } else if (char === '#') {
                    nuevaFilaMapa += '#';
                } else { // ' '
                    nuevaFilaMapa += ' ';
                }
            }
            mapaNuevo.push(nuevaFilaMapa);
        }

        // 2. Crear el estado inicial
        return {
            mapa: mapaNuevo,
            jugador: jugadorPos,
            cajas: cajasPos,
            objetivos: objetivosPos,
            movimientos: 0
        };
    },

    /**
     * Calcula un nuevo estado después de intentar mover al jugador.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
        let nuevaFilaJugador = jugador.fila;
        let nuevaColJugador = jugador.col;

        // 1. Calcular la posición objetivo del jugador
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

        // Verificar si el movimiento del jugador es posible (pared o fuera de límites)
        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        if (nuevaFilaJugador < 0 || nuevaFilaJugador >= filas ||
            nuevaColJugador < 0 || nuevaColJugador >= columnas ||
            estado.mapa[nuevaFilaJugador][nuevaColJugador] === '#') {
            // Colisión con pared o límite, no hay movimiento.
            return JSON.parse(JSON.stringify(estado));
        }

        let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Copia profunda del estado actual
        nuevoEstado.movimientos = estado.movimientos; // Inicialmente sin cambios

        // 2. Verificar si hay cajas en la posición objetivo
        const cajaEnFrente = estado.cajas.some(caja =>
            caja.fila === nuevaFilaJugador && caja.col === nuevaColJugador
        );

        if (!cajaEnFrente) {
            // Caso 1: Movimiento libre (no hay cajas en el camino).
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            return nuevoEstado;
        } else {
            // Caso 2: Hay al menos una caja delante. Intentar empujar.

            const direccionCoords = {
                "arriba": -1, "abajo": 1, "izquierda": 0, "derecha": 0
            };
            let dr, dc;
            switch (direccion) {
                case "arriba": [dr, dc] = [-1, 0]; break;
                case "abajo": [dr, dc] = [1, 0]; break;
                case "izquierda": [dr, dc] = [0, -1]; break;
                case "derecha": [dr, dc] = [0, 1]; break;
            }

            // Identificar la caja que está en el camino (la primera encontrada)
            let cajaAEmpujarIndex = estado.cajas.findIndex(c =>
                c.fila === nuevaFilaJugador && c.col === nuevaColJugador
            );
            const cajaAEmpujar = estado.cajas[cajaAEmpujarIndex];

            // Calcular la posición objetivo de la caja (un paso más allá)
            let nuevaFilaCaja = cajaAEmpujar.fila + dr;
            let nuevaColCaja = cajaAEmpujar.col + dc;

            // Verificar si el espacio detrás de la caja es válido para empujarla
            const filasMapa = estado.mapa.length;
            const columnasMapa = state.mapa[0].length;

            if (nuevaFilaCaja < 0 || nuevaFilaCaja >= filasMapa ||
                nuevaColCaja < 0 || nuevaColCaja >= columnasMapa ||
                estado.mapa[nuevaFilaCaja][nuevaColCaja] === '#') {
                // La caja choca contra una pared o límite, no se mueve nada.
                return JSON.parse(JSON.stringify(estado));
            }

            // Verificar si el espacio detrás de la caja está ocupado por otra caja
            const hayOtraCajaDetras = estado.cajas.some((caja, index) => {
                if (index === cajaAEmpujarIndex) return false; // No es ella misma
                return caja.fila === nuevaFilaCaja && caja.col === nuevaColCaja;
            });

            if (hayOtraCajaDetras) {
                // La caja choca contra otra caja, no se mueve nada.
                return JSON.parse(JSON.stringify(estado));
            }

            // ¡Movimiento exitoso! Actualizar el estado.

            // 1. Mover al jugador a la posición de la caja
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };

            // 2. Mover la caja
            const nuevasCajas = [...estado.cajas];
            nuevasCajas[cajaAEmpujarIndex] = { fila: nuevaFilaCaja, col: nuevaColCaja };
            nuevoEstado.cajas = nuevasCajas;

            // 3. Incrementar movimientos
            nuevoEstado.movimientos = estado.movimientos + 1;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        if (objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Crear un set de coordenadas objetivo para fácil verificación
        const objetivosSet = new Set();
        for (const obj of objetivos) {
            objetivosSet.add(`${obj.fila},${obj.col}`);
        }

        // Verificar si cada caja está sobre una coordenada objetivo
        let todasCubiertas = true;
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                todasCubiertas = false;
                break;
            }
        }

        // Para ganar, necesitamos que el número de cajas sea igual al número de objetivos Y todas estén en la posición correcta.
        if (estado.cajas.length !== objetivos.length) {
             return false; // Si no hay la misma cantidad de cajas y objetivos, no se puede haber ganado.
        }

        // Dado que el contrato implica que si las posiciones coinciden para todos los objetivos, es un nivel completado:
        let cubiertos = 0;
        for (const obj of objetivos) {
            const cajaSobreObjetivo = estado.cajas.some(caja =>
                caja.fila === obj.fila && caja.col === obj.col
            );
            if (cajaSobreObjetivo) {
                cubiertos++;
            }
        }

        return cubiertos === objetivos.length;
    }
};
