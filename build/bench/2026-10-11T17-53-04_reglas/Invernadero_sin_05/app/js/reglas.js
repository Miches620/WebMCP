const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
    let jugadorPos = null;
    let cajasIniciales = [];
    let objetivosIniciales = [];
    
    const R = nivel.length;
    if (R === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };

    const C = nivel[0].length;
    let nuevoMapa = [];

    for (let r = 0; r < R; r++) {
        let filaChars = [];
        for (let c = 0; c < C; c++) {
            const char = nivel[r][c];
            let mapaChar = char;

            if (char === '@') {
                jugadorPos = { fila: r, col: c };
                mapaChar = ' '; // El jugador no se dibuja en el mapa base
            } else if (char === '$') {
                cajasIniciales.push({ fila: r, col: c });
                mapaChar = ' '; // La caja no se dibuja en el mapa base
            } else if (char === '.') {
                objetivosIniciales.push({ fila: r, col: c });
                // '.' permanece como '.', ya que es un carácter permitido
            } 
            // Si char es '#' o ' ', mapaChar mantiene su valor original

            filaChars.push(mapaChar);
        }
        nuevoMapa.push(filaChars.join(''));
    }

    const estado = {
        mapa: nuevoMapa,
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
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento posible.
     */
    mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const dr = { "arriba": -1, "abajo": 1, "izquierda": 0, "derecha": 0 };
        const dc = { "arriba": 0, "abajo": 0, "izquierda": -1, "derecha": 1 };

        // Posición potencial del jugador después de moverse
        let nextPlayerR = estado.jugador.fila + dr[direccion];
        let nextPlayerC = estado.jugador.col + dc[direccion];

        // --- Validación de límites y paredes (Mapa) ---
        if (nextPlayerR < 0 || nextPlayerR >= 9 || nextPlayerC < 0 || nextPlayerC >= 9) {
            return nuevoEstado; // Fuera de límites
        }
        if (estado.mapa[nextPlayerR][nextPlayerC] === '#') {
            return nuevoEstado; // Colisión con pared
        }

        // --- Validación de colisiones con cajas ---
        const cajaEnDestino = estado.cajas.some(caja => 
            caja.fila === nextPlayerR && caja.col === nextPlayerC
        );

        if (!cajaEnDestino) {
            // Caso 1: Movimiento simple (sin cajas en el destino)
            nuevoEstado.jugador = { fila: nextPlayerR, col: nextPlayerC };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }

        // Caso 2: Intento de empujar una caja
        const cajaAEmpujar = estado.cajas.find(caja => 
            caja.fila === nextPlayerR && caja.col === nextPlayerC
        );

        // Calcular la posición detrás de la caja (donde debe ir el jugador)
        let pushTargetR = nextPlayerR + dr[direccion];
        let pushTargetC = nextPlayerC + dc[direccion];

        // 2a. Validación del destino final de la caja
        if (pushTargetR < 0 || pushTargetR >= 9 || pushTargetC < 0 || pushTargetC >= 9) {
            return nuevoEstado; // La caja cae fuera del mapa
        }
        if (estado.mapa[pushTargetR][pushTargetC] === '#') {
            return nuevoEstado; // Colisión con pared detrás de la caja
        }

        // 2b. Validación de si el destino final está ocupado por otra caja
        const hayOtraCajaDetras = estado.cajas.some(otraCaja => 
            otraCaja !== cajaAEmpujar && 
            otraCaja.fila === pushTargetR && 
            otraCaja.col === pushTargetC
        );

        if (hayOtraCajaDetras) {
            return nuevoEstado; // Colisión con otra caja detrás de la caja objetivo
        }

        // --- Movimiento exitoso: Empuje ---
        nuevoEstado.jugador = { fila: nextPlayerR, col: nextPlayerC };
        nuevoEstado.movimientos += 1;

        // Actualizar cajas: mover la caja y eliminar su posición antigua
        const nuevasCajas = estado.cajas.map(caja => {
            if (caja === cajaAEmpujar) {
                return { fila: pushTargetR, col: pushTargetC }; // Nueva posición de la caja empujada
            }
            return caja; // Las otras cajas no se mueven
        });

        nuevoEstado.cajas = nuevasCajas;
        return nuevoEstado;
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Creamos un set de coordenadas objetivo para una búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));

        // Verificamos si cada caja está sobre un objetivo
        let todasCubiertas = true;
        for (const caja of estado.cajas) {
            if (!objetivosSet.has(`${caja.fila},${caja.col}`)) {
                todasCubiertas = false;
                break;
            }
        }

        // Nota: La regla es que *todos* los objetivos deben tener una caja encima.
        // Revisaremos si el número de cajas coincide con el número de objetivos, y si cada caja está en un objetivo.
        if (estado.cajas.length !== estado.objetivos.length) {
             return false; // No se puede ganar si no hay la misma cantidad de macetas que objetivos
        }

        // Si tenemos la misma cantidad y todas las cajas están sobre objetivos, es ganado.
        return todasCubiertas;
    }
};
