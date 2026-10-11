const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel (Sokoban format).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaBase = [];

        // 1. Parsear el nivel para encontrar posiciones y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = nivel[r].split('');
            let nuevaFila = [];
            for (let c = 0; c < filaActual.length; c++) {
                const char = filaActual[c];
                if (char === '@') {
                    jugador = { r: r, c: c };
                    nuevaFila.push(' '); // El jugador no se dibuja en el mapa base
                } else if (char === '$' || char === '*') {
                    cajas.push({ r: r, c: c });
                    nuevaFila.push(' '); // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivos.push({ r: r, c: c });
                    nuevaFila.push('.');
                } else if (char === '#') {
                    nuevaFila.push('#');
                } else {
                    // Espacio vacío ' '
                    nuevaFila.push(' ');
                }
            }
            mapaBase.push(nuevaFila.join(''));
        }

        return {
            mapa: mapaBase, // Solo contiene '#', ' ', '.'
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Intenta mover al jugador en la dirección dada. Maneja colisiones y empujes de cajas.
     * @param {object} estado - El estado actual del juego.
     * @param {string} direccion - Dirección deseada ("arriba", "abajo", "izquierda", "derecha").
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
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

        const { r: jr, c: jc } = estado.jugador;
        let nuevaR = jr + dr;
        let nuevaC = jc + dc;

        // 1. Validación de límites y paredes (Mapa base)
        if (nuevaR < 0 || nuevaR >= estado.mapa.length || nuevaC < 0 || nuevaC >= estado.mapa[0].length) {
            return nuevoEstado; // Fuera de límites
        }

        // Si el destino es una pared, no se puede mover
        if (estado.mapa[nuevaR][nuevaC] === '#') {
            return nuevoEstado;
        }

        let cajaAEmpujar = null;
        let indiceCajaColision = -1;

        // 2. Comprobar si el destino está ocupado por una caja
        for (let i = 0; i < estado.cajas.length; i++) {
            const c = state.cajas[i];
            if (c.r === nuevaR && c.c === nuevaC) {
                cajaAEmpujar = c;
                indiceCajaColision = i;
                break;
            }
        }

        // 3. Manejo de colisión con caja
        if (cajaAEmpujar) {
            // Calcular la posición donde debe ir la caja empujada
            let destinoCajaR = nuevaR + dr;
            let destinoCajaC = nuevaC + dc;

            // Validación del espacio detrás de la caja:
            // a) Debe estar dentro de límites y no ser una pared.
            if (destinoCajaR < 0 || destinoCajaR >= estado.mapa.length || destinoCajaC < 0 || destinoCajaC >= estado.mapa[0].length) {
                return nuevoEstado; // Colisión contra el borde del mapa
            }

            // b) El espacio detrás debe ser un piso válido (no pared, no otra caja).
            if (estado.mapa[destinoCajaR][destinoCajaC] === '#') {
                return nuevoEstado; // Colisión contra una pared
            }

            let colisionConOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                const c = state.cajas[i];
                // Si el destino de la caja es ocupado por otra caja, no se puede empujar
                if ((c.r === destinoCajaR && c.c === destinoCajaC) && (i !== indiceCajaColision)) {
                    colisionConOtraCaja = true;
                    break;
                }
            }

            if (colisionConOtraCaja) {
                return nuevoEstado; // Colisión con otra caja
            }

            // --- Movimiento exitoso de empuje ---
            nuevoEstado.jugador = { r: nuevaR, c: nuevaC };
            
            // Actualizar la posición de la caja empujada
            const cajaActualizada = { ...cajaAEmpujar };
            cajaActualizada.r = destinoCajaR;
            cajaActualizada.c = destinoCajaC;

            // Reemplazar la caja en el array (usando índice)
            nuevoEstado.cajas[indiceCajaColision] = cajaActualizada;

        } else {
            // 4. Movimiento simple (sin cajas involucradas)
            nuevoEstado.jugador = { r: nuevaR, c: nuevaC };
        }

        // 5. Actualizar movimientos y devolver el nuevo estado
        nuevoEstado.movimientos = estado.movimientos + 1;
        return nuevoEstado;
    },

    /**
     * Verifica si todas las posiciones objetivo están ocupadas por una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Crear un set de coordenadas de cajas para búsqueda rápida
        const cajaCoords = new Set();
        estado.cajas.forEach(c => {
            cajaCoords.add(`${c.r},${c.c}`);
        });

        // Verificar si cada objetivo está en el set de cajas
        for (const obj of estado.objetivos) {
            if (!cajaCoords.has(`${obj.r},${obj.c}`)) {
                return false; // Algún objetivo no tiene caja encima
            }
        }

        return true; // Todos los objetivos están cubiertos
    }
};
