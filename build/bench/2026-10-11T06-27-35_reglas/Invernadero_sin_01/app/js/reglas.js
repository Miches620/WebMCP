const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} Estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let nuevoMapa = [];

        for (let r = 0; r < 9; r++) {
            let filaActual = nivel[r].split('');
            nuevoMapa.push([]);
            for (let c = 0; c < 9; c++) {
                const simbolo = filaActual[c];

                if (simbolo === '@') {
                    jugador = { r: r, c: c };
                    nuevoMapa[r].push(' '); // El jugador ocupa un espacio vacío en el estado base
                } else if (simbolo === '$' || simbolo === '*') {
                    cajas.push({ r: r, c: c });
                    nuevoMapa[r].push(' '); // La caja ocupa un espacio vacío en el estado base
                } else if (simbolo === '.') {
                    objetivos.push({ r: r, c: c });
                    nuevoMapa[r].push('.');
                } else if (simbolo === '#') {
                    nuevoMapa[r].push('#');
                } else { // ' '
                    nuevoMapa[r].push(' ');
                }
            }
        }

        // Convertir el array de arrays a un array de strings para mantener la estructura del mapa.
        const mapaString = nuevoMapa.map(row => row.join(''));

        return {
            mapa: mapaString,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
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
        // Crear un clon profundo para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const [dr, dc] = this._getDelta(direccion);
        let jugadorActual = estado.jugador;
        let cajaEnfrente = null;
        let nuevaPosicionJugador = { r: jugadorActual.r + dr, c: jugadorActual.c + dc };

        // 1. Verificar si el movimiento es posible (dentro de límites y no pared)
        if (!this._isValid(nuevaPosicionJugador.r, nuevaPosicionJugador.c, estado.mapa)) {
            return nuevoEstado; // Bloqueado por pared o límite
        }

        // 2. Verificar si hay una caja en el destino del jugador
        const boxAtTarget = state.cajas.some(box => box.r === nuevaPosicionJugador.r && box.c === nuevaPosicionJugador.c);

        if (!boxAtTarget) {
            // Caso A: Movimiento simple (a piso o objetivo)
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empuje
            let cajaAEmpujar = state.cajas.find(box => box.r === nuevaPosicionJugador.r && box.c === nuevaPosicionJugador.c);
            let posicionDestinoCaja = { r: cajaAEmpujar.r + dr, c: cajaAEmpujar.c + dc };

            // Verificar si el destino de la caja es válido (no pared y no fuera del mapa)
            if (!this._isValid(posicionDestinoCaja.r, posicionDestinoCaja.c, estado.mapa)) {
                return nuevoEstado; // La caja está contra una pared o límite
            }

            // Verificar si el destino de la caja está ocupado por otra caja
            const boxCollision = state.cajas.some(box => 
                (box !== cajaAEmpujar) && (box.r === posicionDestinoCaja.r && box.c === posicionDestinoCaja.c)
            );

            if (boxCollision) {
                return nuevoEstado; // La caja está contra otra caja
            }

            // Empuje exitoso: Actualizar posiciones
            nuevoEstado.jugador = newPosicionJugador;
            nuevoEstado.movimientos += 1;

            // Crear nuevas coordenadas de cajas (inmutabilidad)
            let nuevasCajas = estado.cajas.map(box => {
                if (box === cajaAEmpujar) {
                    return posicionDestinoCaja; // La caja se mueve
                }
                return box; // Otras cajas permanecen
            });
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    },

    /**
     * Verifica si el nivel ha sido ganado (todas las macetas sobre objetivos).
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si todas las cajas están en un objetivo, False en caso contrario.
     */
    ganado: function(estado) {
        if (!estado.objetivos || estado.objetivos.length === 0) return true; // No hay objetivos

        const cajaPosiciones = new Set(estado.cajas.map(box => `${box.r},${box.c}`));
        let objetivosCubiertos = 0;

        for (const objetivo of estado.objetivos) {
            if (cajaPosiciones.has(`${objetivo.r},${objetivo.c}`)) {
                objetivosCubiertos++;
            }
        }

        return objetivosCubiertos === state.objetivos.length;
    },

    /**
     * Helper: Obtiene el delta de coordenadas para una dirección dada.
     */
    _getDelta: function(direccion) {
        switch (direccion) {
            case "arriba": return [-1, 0];
            case "abajo": return [1, 0];
            case "izquierda": return [0, -1];
            case "derecha": return [0, 1];
            default: return [0, 0];
        }
    },

    /**
     * Helper: Verifica si una posición (r, c) es válida en el mapa base.
     */
    _isValid: function(r, c, mapaBase) {
        // Chequeo de límites del mapa 9x9
        if (r < 0 || r >= 9 || c < 0 || c >= 9) {
            return false;
        }

        // Chequeo si es pared en el mapa base.
        const fila = mapaBase[r];
        if (!fila || !fila[c]) return false; // Seguridad
        
        return fila[c] !== '#';
    }
};
