const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel (10x10).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaLimpiado = [];

        // 1. Identificar posiciones y limpiar el mapa base
        for (let r = 0; r < 10; r++) {
            let filaActual = nivel[r].split('');
            let nuevaFila = [];
            for (let c = 0; c < 10; c++) {
                const char = filaActual[c];
                if (char === '#') {
                    nuevaFila.push('#');
                } else if (char === '.') {
                    nuevaFila.push('.'); // Objetivo
                    objetivos.push({ r: r, c: c });
                } else if ([' ', '@', '$', '*'].includes(char)) {
                    // Cualquier cosa que no sea pared ni objetivo se considera piso vacío en el mapa base
                    nuevaFila.push(' ');
                } else {
                    // Manejo de cualquier otro carácter inesperado, aunque debería ser cubierto por los anteriores
                    nuevaFila.push(' '); 
                }
            }
            mapaLimpiado.push(nuevaFila);
        }

        // 2. Encontrar posiciones iniciales (Jugador y Cajas)
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugador = { r: r, c: c };
                } else if (['$', '*'].includes(char)) {
                    // Las cajas se registran por su posición inicial.
                    cajas.push({ r: r, c: c });
                }
            }
        }

        return {
            mapa: mapaLimpiado, // Mapa solo con #, ' ', '.'
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover el estado actual en la dirección dada.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si el movimiento falla).
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugadorActual = estado.jugador;
        let rNuevoJugador = jugadorActual.r;
        let cNuevoJugador = jugadorActual.c;
        let cajaAEmpujar = null;
        let indiceCajaAEmpujar = -1;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas)
        switch (direccion) {
            case "arriba":
                rNuevoJugador -= 1; cNuevoJugador = jugadorActual.c; break;
            case "abajo":
                rNuevoJugador += 1; cNuevoJugador = jugadorActual.c; break;
            case "izquierda":
                rNuevoJugador = jugadorActual.r; cNuevoJugador -= 1; break;
            case "derecha":
                rNuevoJugador = jugadorActual.r; cNuevoJugador += 1; break;
        }

        // 2. Validación de colisión básica (Fuera de límites o Pared)
        if (rNuevoJugador < 0 || rNuevoJugador > 9 || cNuevoJugador < 0 || cNuevoJugador > 9) {
            return estado; // Fuera de límites
        }

        // El mapa solo contiene '#', ' ', '.'
        if (estado.mapa[rNuevoJugador][cNuevoJugador] === '#') {
            return estado; // Colisión con pared
        }

        // 3. Verificar si el destino es una caja
        let cajaEnDestino = estado.cajas.find(c => c.r === rNuevoJugador && c.c === cNuevoJugador);

        if (!cajaEnDestino) {
            // Caso A: Movimiento libre (a piso o objetivo)
            nuevoEstado.jugador = { r: rNuevoJugador, c: cNuevoJugador };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empujar una caja
            cajaAEmpujar = cajaEnDestino;

            // Calcular la posición donde debe ir la caja (un paso más en la misma dirección)
            let rNuevaCaja = cajaAEmpujar.r;
            let cNuevaCaja = cajaAEmpujar.c;

            switch (direccion) {
                case "arriba":
                    rNuevaCaja -= 1; break;
                case "abajo":
                    rNuevaCaja += 1; break;
                case "izquierda":
                    cNuevaCaja -= 1; break;
                case "derecha":
                    cNuevaCaja += 1; break;
            }

            // Validación de la nueva posición de la caja:
            // 1. ¿Está fuera de límites?
            if (rNuevaCaja < 0 || rNuevaCaja > 9 || cNuevaCaja < 0 || cNuevaCaja > 9) {
                return estado; // La caja cae al vacío, movimiento inválido
            }

            // 2. ¿Está la nueva posición de la caja ocupada por una pared o otra caja?
            if (estado.mapa[rNuevaCaja][cNuevaCaja] === '#') {
                return estado; // Colisión con pared en el destino final de la caja
            }

            let collisionBox = false;
            for (const box of estado.cajas) {
                // Ignoramos la caja que estamos empujando, solo revisamos otras cajas
                if (!((box.r === cajaAEmpujar.r && box.c === cajaAEmpujar.c))) {
                    if (box.r === rNuevaCaja && box.c === cNuevaCaja) {
                        collisionBox = true;
                        break; // Colisión con otra caja
                    }
                }
            }

            if (collisionBox) {
                return estado; // Otra caja bloquea el movimiento
            }

            // 4. Movimiento exitoso de empuje: Actualizar estado
            nuevoEstado.jugador = { r: cajaAEmpujar.r, c: cajaAEmpujar.c }; // El jugador ocupa la posición anterior de la caja
            nuevoEstado.movimientos += 1;

            // Actualizar cajas: La caja se mueve a (rNuevaCaja, cNuevaCaja)
            let nuevasCajas = estado.cajas.map(box => {
                if (box.r === cajaAEmpujar.r && box.c === cajaAEmpujar.c) {
                    return { r: rNuevaCaja, c: cNuevaCaja }; // Caja movida
                } else {
                    return box; // Otras cajas permanecen igual
                }
            });
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si el nivel ha sido completado (todas las cajas están sobre objetivos).
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si todas las cajas cubren un objetivo, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cubrir

        let objetivosCubiertos = new Set();

        // 1. Identificar qué objetivos están cubiertos por alguna caja
        for (const box of estado.cajas) {
            // Revisamos si la posición de la caja coincide con algún objetivo conocido
            const esObjetivo = estado.objetivos.some(obj => obj.r === box.r && obj.c === box.c);
            if (esObjetivo) {
                // Usamos una clave única para el set: "fila,col"
                objetivosCubiertos.add(`${box.r},${box.c}`);
            }
        }

        // 2. Comparar la cantidad de objetivos cubiertos con el total de objetivos
        if (objetivosCubiertos.size !== estado.objetivos.length) {
            return false;
        }

        // 3. Verificar que cada objetivo esté en el set de cubiertos
        for (const obj of estado.objetivos) {
            if (!objetivosCubiertos.has(`${obj.r},${obj.c}`)) {
                return false;
            }
        }

        return true;
    }
};
