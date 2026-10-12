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

        let mapaInicial = [];
        for (let r = 0; r < filas; r++) {
            mapaInicial[r] = '';
            for (let c = 0; c < columnas; c++) {
                // Inicializamos el mapa con los caracteres estáticos, reemplazando @ y $ por espacios temporales.
                if (nivel[r][c] === '#') {
                    mapaInicial[r] += '#';
                } else if (nivel[r][c] === '.') {
                    mapaInicial[r] += '.';
                } else {
                    // Espacio vacío, objetivo o inicio de caja/jugador.
                    mapaInicial[r] += ' '; 
                }
            }
        }

        let jugador = null;
        let cajas = [];
        let objetivos = [];

        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                if (nivel[r][c] === '@') {
                    jugador = { fila: r, col: c };
                } else if (nivel[r][c] === '$') {
                    cajas.push({ fila: r, col: c });
                } else if (nivel[r][c] === '.') {
                    objetivos.push({ fila: r, col: c });
                }
            }
        }

        return {
            mapa: mapaInicial, // Solo contiene #, ' ', '.'
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return { ...estado };
        const columnas = estado.mapa[0].length;

        // Clonar el estado para asegurar que no se modifique si el movimiento falla
        let nuevoEstado = JSON.parse(JSON.stringify(estado));
        nuevoEstado.movimientos = estado.movimientos; // Inicializar movimientos con el valor actual

        const jugadorActual = { ...estado.jugador };
        let nuevaPosicionJugador = { fila: jugadorActual.fila, col: jugadorActual.col };

        // 1. Calcular la posición objetivo del jugador (P_target)
        switch (direccion) {
            case "arriba":
                nuevaPosicionJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosicionJugador.col += 1;
                break;
        }

        // Verificar límites y paredes en P_target
        if (nuevaPosicionJugador.fila < 0 || nuevaPosicionJugador.fila >= filas ||
            nuevaPosicionJugador.col < 0 || nuevaPosicionJugador.col >= columnas) {
            return estado; // Fuera de límites
        }

        const paredEnTarget = nuevoEstado.mapa[nuevaPosicionJugador.fila][nuevaPosicionJugador.col] === '#';
        if (paredEnTarget) {
            return estado; // Colisión con pared
        }

        // 2. Verificar si P_target está ocupado por una caja
        let cajaAEmpujarIndex = -1;
        for (let i = 0; i < nuevoEstado.cajas.length; i++) {
            const caja = nuevoEstado.cajas[i];
            if (caja.fila === nuevaPosicionJugador.fila && caja.col === nuevaPosicionJugador.col) {
                cajaAEmpujarIndex = i;
                break;
            }
        }

        // Caso 1: No hay cajas en P_target (Movimiento simple)
        if (cajaAEmpujarIndex === -1) {
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }

        // Caso 2: Hay una caja en P_target (Intento de empuje)
        const cajaOriginal = nuevoEstado.cajas[cajaAEmpujarIndex];
        let nuevaPosicionCaja = { fila: cajaOriginal.fila, col: cajaOriginal.col }; // Posición actual de la caja

        // Calcular la posición final deseada para la caja (P_push)
        switch (direccion) {
            case "arriba":
                nuevaPosicionCaja.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionCaja.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionCaja.col -= 1;
                break;
            case "derecha":
                nuevaPosicionCaja.col += 1;
                break;
        }

        // Verificar si P_push es válido (límites, paredes)
        if (nuevaPosicionCaja.fila < 0 || nuevaPosicionCaja.fila >= filas ||
            nuevaPosicionCaja.col < 0 || nuevaPosicionCaja.col >= columnas) {
            return estado; // Empuje fuera de límites
        }

        const paredEnPush = nuevoEstado.mapa[nuevaPosicionCaja.fila][nuevaPosicionCaja.col] === '#';
        if (paredEnPush) {
            return estado; // Empuje contra pared
        }

        // Verificar si P_push está ocupado por otra caja o el jugador (el jugador no puede estar en P_push porque se mueve al lugar de la caja)
        let colisionBox = false;
        for (let i = 0; i < nuevoEstado.cajas.length; i++) {
            // Ignoramos la caja que estamos moviendo (cajaAEmpujarIndex)
            if (i !== cajaAEmpujarIndex) {
                const otraCaja = nuevoEstado.cajas[i];
                if (otraCaja.fila === nuevaPosicionCaja.fila && otraCaja.col === nuevaPosicionCaja.col) {
                    colisionBox = true;
                    break;
                }
            }
        }

        // Si la colisión es detectada, el empuje falla
        if (colisionBox) {
            return estado; 
        }


        // Empuje exitoso: Actualizar estados
        nuevoEstado.jugador = nuevaPosicionJugador;
        nuevoEstado.movimientos += 1;

        // Mover la caja en el array de cajas
        const nuevasCajas = [...nuevoEstado.cajas];
        nuevasCajas[cajaAEmpujarIndex] = { ...cajaOriginal, fila: nuevaPosicionCaja.fila, col: nuevaPosicionCaja.col };
        nuevoEstado.cajas = nuevasCajas;

        return nuevoEstado;
    },

    /**
     * Verifica si todas las posiciones objetivo están cubiertas por al menos una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        // Crear un set de coordenadas de las cajas para búsqueda rápida
        const ubicacionesCajas = new Set();
        for (const caja of estado.cajas) {
            ubicacionesCajas.add(`${caja.fila},${caja.col}`);
        }

        // Verificar cada objetivo
        for (const objetivo of estado.objetivos) {
            if (!ubicacionesCajas.has(`${objetivo.fila},${objetivo.col}`)) {
                return false; // Al menos un objetivo no está cubierto
            }
        }

        return true; // Todos los objetivos están cubiertos
    }
};
