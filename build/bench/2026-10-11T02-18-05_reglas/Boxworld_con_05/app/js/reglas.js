const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel (10x10).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugadorPos = null;
        let cajasIniciales = [];
        let objetivosIniciales = [];

        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$' || char === '*') {
                    // Las cajas se identifican por $ o * en el mapa inicial.
                    cajasIniciales.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // Filtramos las cajas para que no estén sobre objetivos si el nivel lo define así en la inicialización.
        // Sin embargo, siguiendo el contrato, simplemente listamos todas las posiciones de caja encontradas.
        // El estado solo debe contener coordenadas {fila, col}.

        return {
            mapa: [...nivel], // Copia profunda del mapa estático
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado actual según la dirección especificada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o una copia idéntica si el movimiento falla).
     */
    mover: function(estado, direccion) {
        // 1. Crear un estado base inmutable para devolverlo en caso de fallo.
        const nuevoEstado = {
            mapa: [...estado.mapa],
            jugador: { ...estado.jugador },
            cajas: JSON.parse(JSON.stringify(estado.cajas)), // Copia profunda de cajas
            objetivos: estado.objetivos,
            movimientos: estado.movimientos
        };

        let jugadorNuevo = { ...estado.jugador };
        let cajaMovidaIndex = -1;
        let movimientoExitoso = false;

        // Calcular la posición objetivo del jugador (sin considerar colisiones)
        switch (direccion) {
            case "arriba":
                jugadorNuevo.fila -= 1;
                break;
            case "abajo":
                jugadorNuevo.fila += 1;
                break;
            case "izquierda":
                jugadorNuevo.col -= 1;
                break;
            case "derecha":
                jugadorNuevo.col += 1;
                break;
        }

        // --- Validación de Colisión ---

        // A. Chequear límites y paredes (Mapa estático)
        const fila = jugadorNuevo.fila;
        const col = jugadorNuevo.col;

        if (fila < 0 || fila >= estado.mapa.length || col < 0 || col >= estado.mapa[0].length) {
            return nuevoEstado; // Fuera de límites
        }
        if (estado.mapa[fila][col] === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // B. Chequear si hay cajas en la posición objetivo del jugador
        const cajaEnDestino = estado.cajas.find(c => c.fila === fila && c.col === col);

        if (!cajaEnDestino) {
            // Movimiento simple (solo el jugador se mueve)
            nuevoEstado.jugador = jugadorNuevo;
            nuevoEstado.movimientos += 1;
            movimientoExitoso = true;
        } else {
            // Hay una caja en destino, intentar empujar
            const [filaCaja, colCaja] = [cajaEnDestino.fila, cajaEnDestino.col];

            // Calcular la posición objetivo de la caja (un paso más allá)
            let nuevaFilaCaja = filaCaja;
            let nuevaColCaja = colCaja;

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

            // Chequear si la posición objetivo de la caja es válida (no pared, no fuera)
            if (nuevaFilaCaja < 0 || nuevaFilaCaja >= estado.mapa.length || 
                nuevaColCaja < 0 || nuevaColCaja >= estado.mapa[0].length ||
                estado.mapa[nuevaFilaCaja][nuevaColCaja] === '#') {
                return nuevoEstado; // La caja está contra una pared o fuera de límites
            }

            // Chequear si la posición objetivo de la caja está ocupada por otra cosa (otra caja)
            const hayOtraCajaEnDestino = estado.cajas.some(c => 
                (c !== cajaEnDestino && c.fila === nuevaFilaCaja && c.col === nuevaColCaja)
            );

            if (hayOtraCajaEnDestino) {
                return nuevoEstado; // La caja está bloqueada por otra caja
            }

            // --- Movimiento de Empuje Exitoso ---
            nuevoEstado.jugador = jugadorNuevo;
            
            // Actualizar la posición de la caja empujada
            const cajasActualizadas = estado.cajas.map(c => {
                if (c.fila === filaCaja && c.col === colCaja) {
                    return { fila: nuevaFilaCaja, col: nuevaColCaja };
                }
                return c;
            });
            nuevoEstado.cajas = cajasActualizadas;

            nuevoEstado.movimientos += 1;
            movimientoExitoso = true;
        }

        // Si el movimiento fue exitoso (ya sea simple o empuje), devolver el nuevo estado.
        if (movimientoExitoso) {
            return nuevoEstado;
        } else {
            // Devolver la copia original si no hubo cambios válidos.
            return nuevoEstado; 
        }
    },

    /**
     * Verifica si todas las cajas están sobre objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde sin objetivos

        // Crear un set de coordenadas objetivo para una búsqueda rápida
        const objetivosSet = new Set();
        for (const obj of estado.objetivos) {
            objetivosSet.add(`${obj.fila},${obj.col}`);
        }

        // Verificar si cada objetivo tiene al menos una caja encima
        let objetivosCubiertos = 0;
        const objetivosCubiertosSet = new Set();

        for (const box of estado.cajas) {
            const key = `${box.fila},${box.col}`;
            if (objetivosSet.has(key)) {
                // Solo contamos que el objetivo está cubierto una vez, aunque haya varias cajas encima.
                if (!objetivosCubiertosSet.has(key)) {
                    objetivosCubiertos++;
                    objetivosCubiertosSet.add(key);
                }
            }
        }

        return objetivosCubiertos === estado.objetivos.length;
    }
};
