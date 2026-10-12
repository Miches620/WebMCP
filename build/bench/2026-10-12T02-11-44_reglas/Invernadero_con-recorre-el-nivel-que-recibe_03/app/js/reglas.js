const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let nuevoMapa = [];

        // 1. Recorrer el nivel para identificar posiciones y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            let filaActual = nivel[r];
            let nuevaFila = '';
            for (let c = 0; c < filaActual.length; c++) {
                const char = filaActual[c];

                if (char === '@') {
                    jugador = { r: r, c: c };
                    nuevaFila += ' '; // El jugador no se dibuja en el mapa base
                } else if (char === '$') {
                    cajas.push({ r: r, c: c });
                    nuevaFila += ' '; // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivos.push({ r: r, c: c });
                    nuevaFila += '.';
                } else if (char === '#') {
                    nuevaFila += '#';
                } else if (char === ' ') {
                    nuevaFila += ' ';
                }
            }
            nuevoMapa.push(nuevaFila);
        }

        // 2. Construir el estado
        return {
            mapa: nuevoMapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve al jugador y/o empuja las cajas según la dirección.
     * @param {object} estado - El estado actual del juego.
     * @param {string} direccion - Dirección de movimiento ("arriba", "abajo", "izquierda", "derecha").
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        const jugador = estado.jugador;
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

        // Posición objetivo del jugador (sin considerar cajas)
        const nextPlayerPos = { r: jugador.r + dr, c: jugador.c + dc };

        // --- Validación de movimiento básico ---

        // 1. Chequear límites y paredes en la posición destino
        if (nextPlayerPos.r < 0 || nextPlayerPos.r >= estado.mapa.length ||
            nextPlayerPos.c < 0 || nextPlayerPos.c >= estado.mapa[0].length) {
            return { ...estado }; // Fuera de límites
        }

        if (estado.mapa[nextPlayerPos.r][nextPlayerPos.c] === '#') {
            return { ...estado }; // Colisión con pared
        }

        // 2. Chequear si la posición destino está ocupada por una caja
        const boxAtTarget = estado.cajas.some(box => box.r === nextPlayerPos.r && box.c === nextPlayerPos.c);

        if (!boxAtTarget) {
            // Movimiento simple (solo jugador)
            return Reglas._crearNuevoEstado(estado, nextPlayerPos, [], 1);
        } else {
            // Intentando empujar una caja
            const boxToPush = estado.cajas.find(box => box.r === nextPlayerPos.r && box.c === nextPlayerPos.c);

            // Posición destino de la caja (detrás del jugador)
            const pushTargetPos = { r: nextPlayerPos.r + dr, c: nextPlayerPos.c + dc };

            // 3. Validación de empuje
            // Chequear límites y paredes en el destino final de la caja
            if (pushTargetPos.r < 0 || pushTargetPos.r >= estado.mapa.length ||
                pushTargetPos.c < 0 || pushTargetPos.c >= estado.mapa[0].length) {
                return { ...estado }; // Colisión con límite
            }

            // Chequear si el destino final de la caja es una pared o está ocupado por otra caja
            if (estado.mapa[pushTargetPos.r][pushTargetPos.c] === '#') {
                return { ...estado }; // Colisión con pared en el destino
            }

            const boxCollision = estado.cajas.some(box => 
                (box !== boxToPush) && (box.r === pushTargetPos.r && box.c === pushTargetPos.c)
            );

            if (boxCollision) {
                return { ...estado }; // Colisión con otra caja en el destino
            }

            // Empuje exitoso: 
            // El jugador va a nextPlayerPos, la caja va a pushTargetPos.
            const newCajas = estado.cajas.map(box => {
                if (box === boxToPush) {
                    return { r: pushTargetPos.r, c: pushTargetPos.c }; // Mover caja
                }
                return box; // Otras cajas permanecen
            });

            // El jugador se mueve a nextPlayerPos y la caja también se considera movida en el estado nuevo
            return Reglas._crearNuevoEstado(estado, nextPlayerPos, newCajas, 1);
        }
    },

    /**
     * Verifica si todas las posiciones de los objetivos están cubiertas por al menos una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos, se considera ganado

        const cajaPositions = new Set();
        estado.cajas.forEach(box => {
            cajaPositions.add(`${box.r},${box.c}`);
        });

        for (const objetivo of estado.objetivos) {
            if (!cajaPositions.has(`${objetivo.r},${objetivo.c}`)) {
                return false; // Algún objetivo no está cubierto
            }
        }
        return true;
    },

    /**
     * Método auxiliar para crear un nuevo estado de forma inmutable.
     * @param {object} estado - Estado original.
     * @param {object} newPlayerPos - Nueva posición del jugador.
     * @param {Array<{r: number, c: number}>} newCajas - Nuevas posiciones de las cajas.
     * @param {number} movimientosIncremento - Cuántos movimientos se incrementan.
     * @returns {object} El nuevo estado.
     */
    _crearNuevoEstado: function(estado, newPlayerPos, newCajas, movimientosIncremento) {
        // Clonamos el estado para asegurar inmutabilidad
        return {
            mapa: JSON.parse(JSON.stringify(estado.mapa)), // Copia profunda del mapa (array de strings)
            jugador: newPlayerPos,
            cajas: newCajas,
            objetivos: state.objetivos, // Los objetivos no cambian
            movimientos: estado.movimientos + movimientosIncremento
        };
    }
};
