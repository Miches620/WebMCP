const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel en formato Sokoban.
     * @param {string[]} nivel - Array de strings representando las filas del mapa.
     * @returns {{map: string[][], jugador: {fila: number, col: number}, cajas: {fila: number, col: number}[], objetivos: {fila: number, col: number}[], movimientos: number}} El estado inicial.
     */
    crearEstado(nivel) {
        const mapa = [];
        let jugadorPos = null;
        const cajas = [];
        const objetivos = new Set();

        // 1. Parsear el mapa y encontrar posiciones iniciales
        for (let r = 0; r < nivel.length; r++) {
            const filaActual = [];
            for (let c = 0; c < nivel[r].length; c++) {
                const char = nivel[r][c];
                if (char === '@' || char === '+') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                }
                // Los objetivos son '.' o '*'
                if (char === '.' || char === '*') {
                    objetivos.add(`${r},${c}`);
                }

                // Construir la representación del mapa solo con elementos estáticos
                let tile = '#'; // Por defecto, es pared si no se especifica
                if (char === ' ') {
                    tile = ' ';
                } else if (char === '.') {
                    tile = '.';
                } else if (char === '$' || char === '*') {
                    // Las cajas ocupan el espacio del mapa para colisiones, pero su representación visual es más compleja.
                    // Para la lógica de movimiento, solo necesitamos saber si hay una caja ahí.
                    tile = ' '; // El mapa base usa espacios donde están las cajas/jugador iniciales
                } else if (char === '@' || char === '+') {
                     tile = ' ';
                }
                filaActual.push(tile);
            }
            mapa.push(filaActual);
        }

        // 2. Ajustar la lista de cajas y objetivos para reflejar el estado inicial real (sin caracteres especiales)
        const cajaIniciales = [];
        for (let r = 0; r < nivel.length; r++) {
            for (let c = 0; c < nivel[r].length; c++) {
                if (nivel[r][c] === '$' || nivel[r][c] === '*') {
                    cajaIniciales.push({ fila: r, col: c });
                }
            }
        }

        // 3. Crear el estado final
        return {
            mapa: mapa, // Mapa base (solo paredes/pisos)
            jugador: jugadorPos,
            cajas: cajaIniciales,
            objetivos: Array.from(objetivos).map(coord => {
                const [r, c] = coord.split(',').map(Number);
                return { fila: r, col: c };
            }),
            movimientos: 0
        };
    },

    /**
     * Verifica si el estado actual ha sido resuelto (todas las cajas sobre objetivos).
     * @param {object} estado - El estado del juego.
     * @returns {boolean} True si todas las cajas están en un objetivo.
     */
    ganado(estado) {
        if (!estado || !estado.objetivos || estado.objetivos.length === 0) return false;

        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));
        let cajasSobreObjetivoCount = 0;

        for (const caja of estado.cajas) {
            if (objetivosSet.has(`${caja.fila},${caja.col}`)) {
                cajasSobreObjetivoCount++;
            }
        }

        return cajasSobreObjetivoCount === state.cajas.length;
    },

    /**
     * Intenta mover al jugador en la dirección dada, manejando colisiones y empujes de cajas.
     * Devuelve un NUEVO estado o el estado original si el movimiento falla.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Nuevo estado después del movimiento o el estado original si es inválido.
     */
    mover(estado, direccion) {
        // Clonar el estado para asegurar que cualquier cambio se aplique a un nuevo objeto
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

        const jugadorActual = estado.jugador;
        let nextPlayerPos = { fila: jugadorActual.fila + dr, col: jugadorActual.col + dc };

        // 1. Validación de límites y paredes para el movimiento del jugador
        if (nextPlayerPos.fila < 0 || nextPlayerPos.fila >= estado.mapa.length ||
            nextPlayerPos.col < 0 || nextPlayerPos.col >= estado.mapa[0].length) {
            return estado; // Fuera de límites
        }

        // Si el destino del jugador es una pared, no se puede mover
        if (estado.mapa[nextPlayerPos.fila][nextPlayerPos.col] === '#') {
            return estado;
        }

        let cajaAEmpujar = null;
        let indiceCaja = -1;

        // 2. Verificar si el destino del jugador es una caja
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === nextPlayerPos.fila && caja.col === nextPlayerPos.col) {
                cajaAEmpujar = caja;
                indiceCaja = i;
                break;
            }
        }

        // 3. Caso: El destino es una caja (Intento de empuje)
        if (cajaAEmpujar) {
            let nextBoxPos = { fila: cajaAEmpujar.fila + dr, col: cajaAEmpujar.col + dc };

            // Validación del movimiento de la caja
            // a) ¿Está fuera de límites o contra una pared?
            if (nextBoxPos.fila < 0 || nextBoxPos.fila >= estado.mapa.length ||
                nextBoxPos.col < 0 || nextBoxPos.col >= estado.mapa[0].length ||
                estado.mapa[nextBoxPos.fila][nextBoxPos.col] === '#') {
                return estado; // Empuje bloqueado por pared o límite
            }

            // b) ¿Está el destino de la caja ocupado por otra cosa (otra caja)?
            let colisionConOtraCaja = false;
            for (let i = 0; i < estado.cajas.length; i++) {
                if (i !== indiceCaja && estado.cajas[i].fila === nextBoxPos.fila && estado.cajas[i].col === nextBoxPos.col) {
                    colisionConOtraCaja = true;
                    break;
                }
            }

            if (colisionConOtraCaja) {
                return estado; // Empuje bloqueado por otra caja
            }

            // Si el empuje es posible: Actualizar posiciones de jugador y caja
            nuevoEstado.jugador = nextPlayerPos;
            
            // Crear una copia del array de cajas para modificarlo
            const nuevasCajas = [...estado.cajas];
            // Mover la caja específica
            nuevasCajas[indiceCaja] = nextBoxPos;
            nuevoEstado.cajas = nuevasCajas;

        } 
        // 4. Caso: El destino es un espacio libre (Movimiento simple)
        else {
            // Solo actualizar posición del jugador
            nuevoEstado.jugador = nextPlayerPos;
        }

        // 5. Actualizar el contador de movimientos
        nuevoEstado.movimientos += 1;

        return nuevoEstado;
    }
};
