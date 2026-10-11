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
        let cajasIniciales = [];
        let objetivosIniciales = [];

        // 1. Identificar posiciones iniciales y construir el mapa base
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasIniciales.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // 2. Crear el estado base
        const estado = {
            mapa: JSON.parse(JSON.stringify(nivel)), // Copia profunda de las filas
            jugador: jugadorPos,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorActual = estado.jugador;
        let cajasActuales = state.cajas;
        let movimientosActuales = estado.movimientos;

        let nuevaFilaJugador = jugadorActual.fila;
        let nuevaColJugador = jugadorActual.col;
        let cajaMovidaIndex = -1; // Índice de la caja que se empuja, si aplica

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
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

        // Verificar límites y paredes en la posición objetivo del jugador
        const filas = estado.mapa.length;
        const columnas = state.mapa[0].length;

        if (nuevaFilaJugador < 0 || nuevaFilaJugador >= filas || 
            nuevaColJugador < 0 || nuevaColJugador >= columnas) {
            return nuevoEstado; // Fuera de límites
        }

        // Verificar si la posición objetivo es una pared
        if (estado.mapa[nuevaFilaJugador][nuevaColJugador] === '#') {
            return nuevoEstado; 
        }

        // 2. Comprobar colisión con cajas
        let cajaEnDestino = false;
        cajaMovidaIndex = -1;
        for (let i = 0; i < cajasActuales.length; i++) {
            const caja = cajasActuales[i];
            if (caja.fila === nuevaFilaJugador && caja.col === nuevaColJugador) {
                cajaEnDestino = true;
                cajaMovidaIndex = i;
                break;
            }
        }

        // Caso A: No hay cajas en el destino, movimiento simple del jugador
        if (!cajaEnDestino) {
            nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };
            nuevoEstado.movimientos = movimientosActuales + 1;
            return nuevoEstado;
        }

        // Caso B: Hay una caja en el destino (Intento de empuje)
        const cajaEmpujada = cajasActuales[cajaMovidaIndex];
        let nuevaFilaCaja = nuevaFilaJugador;
        let nuevaColCaja = nuevaColJugador;

        // Calcular la posición detrás de la caja (donde debe ir el jugador después)
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
        // 1. ¿La posición detrás de la caja está dentro del mapa?
        if (nuevaFilaCaja < 0 || nuevaFilaCaja >= filas || 
            nuevaColCaja < 0 || nuevaColCaja >= columnas) {
                return nuevoEstado; // Empuje fuera de límites
        }

        // 2. ¿La posición detrás de la caja no es una pared?
        if (estado.mapa[nuevaFilaCaja][nuevaColCaja] === '#') {
            return nuevoEstado; // Empuje contra pared
        }

        // 3. ¿La posición detrás de la caja está ocupada por otra caja?
        let hayOtraCajaDetras = false;
        for (let i = 0; i < cajasActuales.length; i++) {
            if (i !== cajaMovidaIndex) { // No comparar con la caja que estamos moviendo
                const cajaCheck = cajasActuales[i];
                if (cajaCheck.fila === nuevaFilaCaja && cajaCheck.col === nuevaColCaja) {
                    hayOtraCajaDetras = true;
                    break;
                }
            }
        }

        if (hayOtraCajaDetras) {
            return nuevoEstado; // Empuje contra otra caja
        }

        // --- Movimiento exitoso de empuje ---

        // 1. Actualizar la posición del jugador
        nuevoEstado.jugador = { fila: nuevaFilaJugador, col: nuevaColJugador };

        // 2. Actualizar la posición de la caja movida
        const cajasNuevas = JSON.parse(JSON.stringify(cajasActuales));
        cajasNuevas[cajaMovidaIndex] = { fila: nuevaFilaCaja, col: nuevaColCaja };
        nuevoEstado.cajas = cajasNuevas;

        // 3. Incrementar movimientos
        nuevoEstado.movimientos = movimientosActuales + 1;
        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        const objetivos = estado.objetivos;
        const cajas = estado.cajas;

        if (objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Crear un set de coordenadas de las cajas para búsqueda rápida
        const ubicacionesCaja = new Set();
        cajas.forEach(c => {
            ubicacionesCaja.add(`${c.fila},${c.col}`);
        });

        // Verificar cada objetivo
        for (const objetivo of objetivos) {
            const keyObjetivo = `${objetivo.fila},${objetivo.col}`;
            if (!ubicacionesCaja.has(keyObjetivo)) {
                return false; // Al menos un objetivo no tiene caja encima
            }
        }

        // Si pasamos por todos los objetivos y encontramos una caja en cada uno
        return true;
    }
};
