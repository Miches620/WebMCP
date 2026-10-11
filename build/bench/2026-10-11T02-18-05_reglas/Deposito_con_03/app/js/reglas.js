const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 8x8.
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
    const mapa = [];
    let jugadorPos = null;
    const cajas = [];
    const objetivos = new Set();

    // Inicializar el mapa con dimensiones dinámicas del nivel recibido
    for (let r = 0; r < nivel.length; r++) {
        mapa[r] = [];
        for (let c = 0; c < nivel[r].length; c++) {
            mapa[r][c] = ' '; // Inicializar con piso vacío temporalmente
        }
    }

    // Recorriendo el nivel para parsear elementos
    for (let r = 0; r < nivel.length; r++) {
        for (let c = 0; c < nivel[r].length; c++) {
            const char = nivel[r][c];
            
            if (char === '#') {
                mapa[r][c] = '#'; // Pared
            } else if (char === ' ') {
                // Piso vacío
                mapa[r][c] = ' '; 
            } else if (char === '.') {
                objetivos.add({ fila: r, col: c });
                mapa[r][c] = '.'; // Objetivo/Piso
            } else if (char === '@' || char === '+') {
                // Jugador inicial (@ o +)
                jugadorPos = { fila: r, col: c };
                // El mapa base no muestra al jugador. 
                mapa[r][c] = ' '; 
            } else if (char === '$' || char === '*') {
                // Caja ($ o *). '*' es caja sobre objetivo, pero la caja sigue siendo una caja.
                cajas.push({ fila: r, col: c });
                mapa[r][c] = ' '; // El mapa base no muestra las cajas
            } else {
                // Manejo de cualquier otro carácter inesperado
                mapa[r][c] = ' '; 
            }
        }
    }

    return {
        mapa: mapa,
        jugador: jugadorPos,
        cajas: cajas,
        objetivos: Array.from(objetivos),
        movimientos: 0
    };
},

    /**
     * Calcula el estado después de intentar mover al jugador en una dirección.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si no hay movimiento posible.
     */
mover(estado, direccion) {
    // Clonar el estado para asegurar que no se modifique si el movimiento falla o es exitoso
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    const { jugador: p } = estado;
    let r_new = p.fila;
    let c_new = p.col;

    // 1. Calcular la posición objetivo del jugador (p_next)
    switch (direccion) {
        case "arriba":
            r_new -= 1;
            break;
        case "abajo":
            r_new += 1;
            break;
        case "izquierda":
            c_new -= 1;
            break;
        case "derecha":
            c_new += 1;
            break;
    }

    // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
    const isValidPos = (r, c) => {
        if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) return false; // Fuera de límites
        return estado.mapa[r][c] !== '#'; // No es pared
    };

    // Verificar si la posición objetivo contiene una caja
    const cajaEnFrente = estado.cajas.some(box => box.fila === r_new && box.col === c_new);

    // Caso A: Intento de movimiento simple (sin cajas en el camino)
    if (!cajaEnFrente && isValidPos(r_new, c_new)) {
        // Movimiento exitoso simple
        const nuevoJugador = { fila: r_new, col: c_new };

        return {
            mapa: estado.mapa, // El mapa no cambia
            jugador: nuevoJugador,
            cajas: JSON.parse(JSON.stringify(estado.cajas)), // Clonar cajas
            objetivos: estado.objetivos,
            movimientos: estado.movimientos + 1
        };
    }

    // Caso B: Intento de empujar una caja
    if (cajaEnFrente) {
        // Calcular la posición destino para la caja (nextBoxPos)
        let r_next = r_new;
        let c_next = c_new;

        switch (direccion) {
            case "arriba":
                r_next -= 1;
                break;
            case "abajo":
                r_next += 1;
                break;
            case "izquierda":
                c_next -= 1;
                break;
            case "derecha":
                c_next += 1;
                break;
        }

        const nextBoxPos = { fila: r_next, col: c_next };

        // 1. ¿Es el destino de la caja válido? (No pared y dentro de límites)
        if (!isValidPos(r_next, c_next)) {
            return estado; // Colisión con pared o límite
        }

        // 2. ¿Hay otra caja en el destino de la caja (bloqueando el empuje)?
        const hayOtraCaja = estado.cajas.some(box => box.fila === r_next && box.col === c_next);

        if (!hayOtraCaja) {
            // Empuje exitoso: 
            // Nuevo jugador en caja, nueva caja en destino.
            const nuevoJugador = { fila: r_new, col: c_new }; // El jugador se mueve a la posición de la caja original

            // Clonar y actualizar las cajas
            const nuevasCajasActualizadas = estado.cajas.map(box => {
                // Si esta es la caja que estamos empujando (en r_new, c_new)
                if (box.fila === r_new && box.col === c_new) {
                    return nextBoxPos; // Moverla a la nueva posición
                }
                return box; // De lo contrario, mantener su posición
            });

            return {
                mapa: estado.mapa,
                jugador: nuevoJugador,
                cajas: nuevasCajasActualizadas,
                objetivos: estado.objetivos,
                movimientos: estado.movimientos + 1
            };
        }
    }

    // Si ninguna de las condiciones anteriores se cumplió (pared o caja bloqueada)
    return estado;
},

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        const cajasEnObjetivo = estado.cajas.every(box => 
            estado.objetivos.some(obj => obj.fila === box.fila && obj.col === box.col)
        );

        return cajasEnObjetivo;
    },

    /**
     * Método privado para crear un nuevo objeto de estado (garantizando inmutabilidad).
     * @param {object} estado - Estado original.
     * @param {object} p_new - Nueva posición del jugador.
     * @param {array} cajas_new - Nuevas posiciones de las cajas.
     * @param {number} movimientos_incremento - Cuántos movimientos se sumaron (1 o 0).
     * @returns {object} Nuevo estado.
     */
    _crearNuevoEstado(estado, p_new, cajas_new, movimientos_incremento) {
        return {
            mapa: JSON.parse(JSON.stringify(estado.mapa)), // Clonar el mapa
            jugador: p_new,
            cajas: cajas_new,
            objetivos: estado.objetivos, // Los objetivos no cambian
            movimientos: estado.movimientos + movimientos_incremento
        };
    }
};

// Exportación simulada para el entorno de juego (aunque se usa globalmente)
// En este contexto, simplemente definimos la constante Reglas.
