const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa del nivel.
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
        const altura = nivel.length;
        const ancho = nivel[0].length;

        let jugadorPos = null;
        let cajasCoords = [];
        let objetivosCoords = [];
        // Inicializamos mapaBase como un array de arrays de caracteres
        let mapaBase = Array(altura).fill(null).map(() => Array(ancho));

        for (let r = 0; r < altura; r++) {
            for (let c = 0; c < ancho; c++) {
                const char = nivel[r][c];
                let mapChar = ' '; // Valor por defecto: piso vacío

                // 1. Manejo de Paredes
                if (char === '#') {
                    mapChar = '#';
                } else {
                    // Determinar si la ubicación es un marcador de objetivo
                    const isObjectiveLocation = char === '.' || char === '+' || char === '*';

                    // 2. Posición del Jugador (@ o +)
                    if (char === '@' || char === '+') {
                        jugadorPos = { fila: r, col: c };
                    }

                    // 3. Cajas ($ o *)
                    if (char === '$' || char === '*') {
                        cajasCoords.push({ fila: r, col: c });
                    }

                    // 4. Objetivos (., +, *)
                    if (isObjectiveLocation) {
                        objetivosCoords.push({ fila: r, col: c });
                        mapChar = '.'; // Si es un objetivo, el mapa siempre muestra '.'
                    } else if (char === '@') {
                        // Jugador en piso vacío no objetivo
                        mapChar = ' '; 
                    } else if (char === '$' || char === '*') {
                        // Caja en piso vacío no objetivo
                        mapChar = ' ';
                    } else {
                        // Caso por defecto: espacio libre o caracteres tratados como piso
                        mapChar = ' ';
                    }
                }

                mapaBase[r][c] = mapChar;
            }
        }

        // Convertir el mapa base de array 2D a un array de strings para cumplir con la especificación del estado.
        const mapaStringArray = mapaBase.map(row => row.join(''));

        return {
            mapa: mapaStringArray,
            jugador: jugadorPos,
            cajas: cajasCoords,
            objetivos: objetivosCoords,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si el movimiento falla.
     */
mover(estado, direccion) {
    // Crear una copia profunda del estado para asegurar inmutabilidad
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    let jugadorActual = estado.jugador;
    let cajasActual = estado.cajas;
    let nuevaPosicionJugador = null;
    let nuevasCajas = [...cajasActual];
    // let movimientoExitoso = false; // Variable no utilizada, se elimina o ignora

    // 1. Calcular la posición objetivo del jugador (P_next)
    let rNext, cNext;
    switch (direccion) {
        case "arriba":
            rNext = jugadorActual.fila - 1;
            cNext = jugadorActual.col;
            break;
        case "abajo":
            rNext = jugadorActual.fila + 1;
            cNext = jugadorActual.col;
            break;
        case "izquierda":
            rNext = jugadorActual.fila;
            cNext = jugadorActual.col - 1;
            break;
        case "derecha":
            rNext = jugadorActual.fila;
            cNext = jugadorActual.col + 1;
            break;
    }

    // Validación de límites y paredes (P_next)
    if (rNext < 0 || rNext >= estado.mapa.length || cNext < 0 || cNext >= estado.mapa[0].length || estado.mapa[rNext][cNext] === '#') {
        return estado; // Colisión con pared o límite
    }

    // 2. Verificar si P_next está ocupado por una caja
    const boxCollisionIndex = cajasActual.findIndex(box => box.fila === rNext && box.col === cNext);

    if (boxCollisionIndex === -1) {
        // Caso A: No hay caja en P_next. Movimiento simple del jugador.
        nuevoEstado.jugador = { fila: rNext, col: cNext };
        nuevoEstado.movimientos += 1;
        return nuevoEstado;
    } else {
        // Caso B: Hay una caja (Box B) en P_next. Intentar empujar.
        const boxB = cajasActual[boxCollisionIndex];

        // Calcular la posición objetivo de la caja (B_next)
        let rNextBox, cNextBox;
        switch (direccion) {
            case "arriba":
                rNextBox = boxB.fila - 1;
                cNextBox = boxB.col;
                break;
            case "abajo":
                rNextBox = boxB.fila + 1;
                cNextBox = boxB.col;
                break;
            case "izquierda":
                rNextBox = boxB.fila;
                cNextBox = boxB.col - 1;
                break;
            case "derecha":
                rNextBox = boxB.fila;
                cNextBox = boxB.col + 1;
                break;
        }

        // Validación de B_next: Límites, Paredes o Colisión con otra caja (Box C)
        if (rNextBox < 0 || rNextBox >= estado.mapa.length || cNextBox < 0 || cNextBox >= estado.mapa[0].length || estado.mapa[rNextBox][cNextBox] === '#') {
            return estado; // La caja choca contra una pared o límite
        }

        // Verificar si B_next está ocupado por otra caja (Box C)
        const boxCCollision = cajasActual.some(box => 
            (box !== boxB && box.fila === rNextBox && box.col === cNextBox)
        );

        if (boxCCollision) {
            return estado; // La caja choca contra otra caja
        }

        // Movimiento exitoso: Empuje de la caja y movimiento del jugador
        nuevoEstado.jugador = { fila: rNext, col: cNext };
        nuevoEstado.movimientos += 1;

        // Actualizar posiciones de las cajas (Box B se mueve a B_next)
        const nuevasCajasActualizadas = [...cajasActual];
        nuevasCajasActualizadas[boxCollisionIndex] = { fila: rNextBox, col: cNextBox };
        nuevoEstado.cajas = nuevasCajasActualizadas;

        return nuevoEstado;
    }
},

    /**
     * Verifica si todas las posiciones objetivo están cubiertas por al menos una caja.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
ganado(estado) {
    if (!estado || !estado.objetivos || estado.objetivos.length === 0) {
        return true;
    }

    const objetivosCoords = estado.objetivos;
    const cajasCoords = estado.cajas;

    if (!cajasCoords || cajasCoords.length === 0) {
        return false;
    }

    // Crear un set de coordenadas de las cajas para búsqueda rápida
    const cajaSet = new Set();
    for (const coord of cajasCoords) {
        cajaSet.add(`${coord.fila},${coord.col}`);
    }

    // Verificar si cada objetivo tiene una caja encima
    for (const objetivo of objetivosCoords) {
        const coordKey = `${objetivo.fila},${objetivo.col}`;
        if (!cajaSet.has(coordKey)) {
            return false; // Encontrado un objetivo sin caja encima
        }
    }

    // Todos los objetivos están cubiertos
    return true;
}
};
