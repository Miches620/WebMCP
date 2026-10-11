const Reglas = {

    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa 9x9.
     * @returns {object} El estado inicial del juego.
     */
crearEstado(nivel) {
    let jugador = null;
    let cajas = [];
    let objetivos = [];

    // Determinar dimensiones del nivel
    const R = nivel.length;
    if (R === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
    const C = nivel[0].length;

    // Paso 1: Identificar objetivos y elementos dinámicos (Jugador y Cajas)
    let jugadorEncontrado = false;
    for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
            const char = nivel[r][c];

            // Identificar objetivos: '.' es el marcador principal. También incluimos '+' y '*' si están presentes, 
            // ya que las pruebas fallidas sugieren que estos pueden marcar ubicaciones objetivo.
            if (char === '.') {
                objetivos.push({ fila: r, col: c });
            } else if ((char === '+' || char === '*') && !['#', ' ', '.'].includes(char)) {
                 // Añadimos objetivos si el carácter es un marcador de objetivo potencial y no ya lo hemos contado.
                if (!objetivos.some(obj => obj.fila === r && obj.col === c)) {
                    objetivos.push({ fila: r, col: c });
                }
            }

            // Identificar Jugador (solo el primero)
            if ((char === '@' || char === '+') && !jugadorEncontrado) {
                jugador = { fila: r, col: c };
                jugadorEncontrado = true;
            } 
            // Identificar Cajas
            else if ((char === '$' || char === '*') && (char !== '.')) {
                cajas.push({ fila: r, col: c });
            }
        }
    }

    // Paso 2: Construir el mapa final como un array de strings
    let mapa = [];
    for (let r = 0; r < R; r++) {
        let rowString = '';
        for (let c = 0; c < C; c++) {
            const char = nivel[r][c];

            if (char === '#') {
                rowString += '#';
            } else if (char === '.') {
                // Objetivo: siempre visible en el mapa.
                rowString += '.';
            } else if ((char === '@' || char === '+') && jugador && jugador.fila === r && jugador.col === c) {
                 // Jugador: se elimina del mapa, dejando un espacio vacío ' '.
                rowString += ' ';
            } else if ((char === '$' || char === '*') && cajas.some(box => box.fila === r && box.col === c)) {
                // Caja: se elimina del mapa, dejando un espacio vacío ' '.
                rowString += ' ';
            } else if (char === ' ') {
                 // Piso vacío
                rowString += ' ';
            } else {
                // Cualquier otro carácter que no sea pared ni objetivo visible debe ser tratado como piso.
                rowString += ' ';
            }
        }
        mapa.push(rowString);
    }

    return {
        mapa: mapa,
        jugador: jugador,
        cajas: cajas,
        objetivos: objetivos,
        movimientos: 0
    };
},

    /**
     * Calcula el nuevo estado después de intentar mover al jugador en una dirección.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado o el estado original si el movimiento falla.
     */
    mover(estado, direccion) {
        const { jugador: p } = estado;
        let nextR = p.fila;
        let nextC = p.col;

        // 1. Calcular la posición objetivo del jugador (sin considerar cajas aún)
        switch (direccion) {
            case "arriba":
                nextR -= 1;
                break;
            case "abajo":
                nextR += 1;
                break;
            case "izquierda":
                nextC -= 1;
                break;
            case "derecha":
                nextC += 1;
                break;
        }

        // Verificar límites y paredes en la posición objetivo del jugador.
        if (nextR < 0 || nextR >= 9 || nextC < 0 || nextC >= 9) {
            return estado; // Fuera de límites
        }
        if (estado.mapa[nextR][nextC] === '#') {
            return estado; // Colisión con pared
        }

        // Verificar si hay una caja en la posición objetivo del jugador.
        const boxAtTarget = estado.cajas.some(box => box.fila === nextR && box.col === nextC);

        if (!boxAtTarget) {
            // Caso 1: Movimiento simple (no hay cajas delante).
            return Reglas._crearNuevoEstado(estado, p, { fila: nextR, col: nextC }, estado.cajas, state.objetivos, estado.movimientos + 1);
        } else {
            // Caso 2: Intento de empujar una caja.
            const box = estado.cajas.find(box => box.fila === nextR && box.col === nextC);

            // Calcular la posición detrás de la caja (donde queremos que vaya).
            let pushTargetR = nextR;
            let pushTargetC = nextC;

            switch (direccion) {
                case "arriba":
                    pushTargetR -= 1;
                    break;
                case "abajo":
                    pushTargetR += 1;
                    break;
                case "izquierda":
                    pushTargetC -= 1;
                    break;
                case "derecha":
                    pushTargetC += 1;
                    break;
            }

            // Verificar si el empuje es posible.
            if (pushTargetR < 0 || pushTargetR >= 9 || pushTargetC < 0 || pushTargetC >= 9) {
                return estado; // Empujar fuera de límites
            }
            if (estado.mapa[pushTargetR][pushTargetC] === '#') {
                return estado; // Empujar contra pared
            }

            // Verificar si el destino del empuje está ocupado por otra caja.
            const boxCollision = estado.cajas.some(otherBox => 
                otherBox !== box && otherBox.fila === pushTargetR && otherBox.col === pushTargetC
            );

            if (boxCollision) {
                return estado; // Empujar contra otra caja
            }

            // El empuje es válido. Crear el nuevo estado.
            const newCajas = estado.cajas.map(b => 
                (b.fila === nextR && b.col === nextC) ? { fila: pushTargetR, col: pushTargetC } : b
            );

            // El jugador se mueve a la posición de la caja original.
            const newPlayer = { fila: nextR, col: nextC };

            return Reglas._crearNuevoEstado(estado, p, newPlayer, newCajas, estado.objetivos, estado.movimientos + 1);
        }
    },

    /**
     * Verifica si todas las macetas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
ganado(estado) {
        // Si no hay objetivos, el juego no puede considerarse ganado por esta condición.
        if (estado.objetivos.length === 0) return false;

        // Creamos un Set de todas las coordenadas objetivo que deben ser cubiertas.
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Usamos otro Set para rastrear qué objetivos han sido cubiertos por una caja.
        const cubiertos = new Set();

        for (const box of estado.cajas) {
            const boxCoord = `${box.fila},${box.col}`;
            
            // Verificamos si la posición de la caja coincide con alguna coordenada objetivo.
            if (objetivosSet.has(boxCoord)) {
                cubiertos.add(boxCoord);
            }
        }

        // El juego está ganado si el número de objetivos cubiertos es igual al total de objetivos.
        return cubiertos.size === objetivosSet.size;
    },

    /**
     * Método privado para crear y devolver un nuevo estado inmutable.
     * @param {object} estado - Estado original.
     * @param {object} oldPlayer - Posición antigua del jugador.
     * @param {object} newPlayer - Nueva posición del jugador.
     * @param {Array<object>} newCajas - Lista de cajas actualizadas.
     * @param {Array<object>} objetivos - Objetivos (no cambian).
     * @param {number} nuevosMovimientos - Nuevo contador de movimientos.
     * @returns {object} El nuevo estado.
     */
    _crearNuevoEstado(estado, oldPlayer, newPlayer, newCajas, objetivos, nuevosMovimientos) {
        // Clonamos el mapa para asegurar la inmutabilidad (aunque en este juego no cambia).
        const nuevoMapa = estado.mapa.map(fila => fila.split(''));

        return {
            mapa: nuevoMapa,
            jugador: newPlayer,
            cajas: newCajas,
            objetivos: objetivos,
            movimientos: nuevosMovimientos
        };
    }
};
