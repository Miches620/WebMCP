const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (10x10).
     * @returns {object} El estado inicial del juego.
     */
crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];

        if (!nivel || nivel.length === 0) {
            return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
        }

        const H = nivel.length;
        // Asumimos que todas las filas tienen la misma longitud
        const W = nivel[0].length;

        let mapaBaseArray = Array(H).fill(0).map(() => Array(W));

        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                const char = nivel[r][c];

                // Identificar posiciones clave
                
                // Player: @ or + (based on failure description)
                if (char === '@' || char === '+') {
                    jugador = { fila: r, col: c };
                } 
                
                // Boxes: $ or *
                if (char === '$' || char === '*') {
                    cajas.push({ fila: r, col: c });
                } 
                
                // Objectives: ., *, + (based on failure description)
                let isObjective = char === '.' || char === '*' || char === '+';
                if (isObjective) {
                    objetivos.push({ fila: r, col: c });
                }

                // Construir el mapa base simplificado (#, ' ', .)
                let mapChar;
                if (char === '#') {
                    mapChar = '#'; // Pared
                } else if (['.', '*', '+'].includes(char)) {
                    // Si es un objetivo, en el mapa debe ser '.'
                    mapChar = '.';
                } else if (char === '$' || char === '@' || char === ' ') {
                    // Cajas, jugador o espacio vacío se representan como piso (' ')
                    mapChar = ' ';
                } else {
                    // Fallback para cualquier otro carácter inesperado
                    mapChar = ' ';
                }
                mapaBaseArray[r][c] = mapChar;
            }
        }

        // Convertir la matriz de caracteres a un array de strings (filas)
        const mapa = mapaBaseArray.map(row => row.join(''));

        // 2. Crear el estado inicial
        const estado = {
            mapa: mapa,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };

        return estado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
ganado: function(estado) {
        if (estado.objetivos.length === 0) return false;

        const objetivosSet = new Set();
        for (const obj of estado.objetivos) {
            objetivosSet.add(`${obj.fila},${obj.col}`);
        }

        let coveredObjectivesCount = 0;
        const coveredLocations = new Set();

        for (const caja of estado.cajas) {
            const boxLocationKey = `${caja.fila},${caja.col}`;
            if (objetivosSet.has(boxLocationKey)) {
                if (!coveredLocations.has(boxLocationKey)) {
                    coveredObjectivesCount++;
                    coveredLocations.add(boxLocationKey);
                }
            }
        }

        return coveredObjectivesCount === estado.objetivos.length;
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión/empuje.
     * @param {object} estado - El estado actual (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección del movimiento.
     * @returns {object} Un nuevo estado que refleja el movimiento o el estado original si es inválido.
     */
mover: function(estado, direccion) {
        // Clonamos el estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let jugadorNuevoFila = estado.jugador.fila;
        let jugadorNuevoCol = estado.jugador.col;
        
        // Dimensiones del mapa (FIX: Usar dimensiones reales)
        const H = estado.mapa.length;
        if (H === 0) return estado;
        const W = estado.mapa[0].length;

        // 1. Calcular la posición objetivo del jugador (P_new)
        switch (direccion) {
            case "arriba":
                [jugadorNuevoFila, jugadorNuevoCol] = [estado.jugador.fila - 1, estado.jugador.col]; break;
            case "abajo":
                [jugadorNuevoFila, jugadorNuevoCol] = [estado.jugador.fila + 1, estado.jugador.col]; break;
            case "izquierda":
                [jugadorNuevoFila, jugadorNuevoCol] = [estado.jugador.fila, estado.jugador.col - 1]; break;
            case "derecha":
                [jugadorNuevoFila, jugadorNuevoCol] = [estado.jugador.fila, estado.jugador.col + 1]; break;
        }

        // Verificar límites del mapa (FIX: Usar dimensiones dinámicas)
        if (jugadorNuevoFila < 0 || jugadorNuevoFila >= H || jugadorNuevoCol < 0 || jugadorNuevoCol >= W) {
            return estado; // Fuera de límites
        }
        
        // Verificar si el destino es una pared. Si lo es, no se puede mover.
        if (estado.mapa[jugadorNuevoFila][jugadorNuevoCol] === '#') {
             return estado; 
        }

        // 2. Determinar si hay una caja en la posición objetivo del jugador
        const boxEnDestino = estado.cajas.some(box => 
            box.fila === jugadorNuevoFila && box.col === jugadorNuevoCol
        );

        if (!boxEnDestino) {
            // Caso A: Movimiento simple (sin caja en destino, y ya chequeamos que no sea pared)
            nuevoEstado.jugador = { fila: jugadorNuevoFila, col: jugadorNuevoCol };
            nuevoEstado.movimientos = estado.movimientos + 1;
            return nuevoEstado;
        } else {
            // Caso B: Colisión con una caja (Intentar empujar)

            // Encontrar la caja que está en el destino del jugador
            const boxAEmpujar = estado.cajas.find(box => 
                box.fila === jugadorNuevoFila && box.col === jugadorNuevoCol
            );

            if (!boxAEmpujar) {
                 return estado; // Seguridad
            }

            // Calcular la posición de empuje (detrás de la caja)
            let pushFila = jugadorNuevoFila;
            let pushCol = jugadorNuevoCol;

            switch (direccion) {
                case "arriba":
                    pushFila -= 1; break;
                case "abajo":
                    pushFila += 1; break;
                case "izquierda":
                    pushCol -= 1; break;
                case "derecha":
                    pushCol += 1; break;
            }

            // Verificar si el empuje es posible:
            
            // 1. Debe estar dentro de límites del mapa. (FIX: Usar dimensiones dinámicas)
            if (pushFila < 0 || pushFila >= H || pushCol < 0 || pushCol >= W) {
                return estado; // Empujar fuera de límites
            }

            // 2. La posición de empuje no debe ser una pared.
            const esPared = estado.mapa[pushFila][pushCol] === '#';
            if (esPared) {
                return estado; // Empujar contra pared
            }

            // 3. Verificar si hay otra caja en la posición de empuje
            const boxEnPushDestino = estado.cajas.some(box => 
                box !== boxAEmpujar && box.fila === pushFila && box.col === pushCol
            );

            if (boxEnPushDestino) {
                return estado; // Empujar contra otra caja
            }

            // --- Movimiento exitoso de empuje ---
            nuevoEstado.movimientos = estado.movimientos + 1;

            // Actualizar posición del jugador: va a donde estaba la caja
            nuevoEstado.jugador = { fila: boxAEmpujar.fila, col: boxAEmpujar.col };

            // Actualizar cajas:
            let nuevasCajas = [];
            for (const box of estado.cajas) {
                if (box === boxAEmpujar) {
                    // La caja empujada se mueve a la nueva posición
                    nuevasCajas.push({ fila: pushFila, col: pushCol });
                } else {
                    // Las demás cajas permanecen en su lugar
                    nuevasCajas.push(box);
                }
            }
            nuevoEstado.cajas = nuevasCajas;

            return nuevoEstado;
        }
    }
};
