const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - El mapa del nivel (array de strings).
     * @returns {object} Estado inicial del juego.
     */
crearEstado(nivel) {
    let jugador = null;
    let cajas = [];
    // Usamos un Set para asegurar que cada objetivo se registre solo una vez, independientemente del marcador (* o +).
    let objetivosSet = new Set(); 
    let mapaBase = [];

    const R = nivel.length;
    if (R === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
    // Asumimos que el nivel es rectangular y todos los strings tienen la misma longitud.
    const C = nivel[0].length;

    for (let r = 0; r < R; r++) {
        let filaActual = [];
        for (let c = 0; c < C; c++) {
            const tile = nivel[r][c];
            let mapTile = ' '; // Valor por defecto para el mapa base

            // 1. Identificar Objetivo: . , * o +
            if (tile === '.' || tile === '*' || tile === '+') {
                objetivosSet.add(`${r},${c}`);
            }

            // 2. Identificar Caja: $, *, o +
            if (tile === '$' || tile === '*' || tile === '+') {
                cajas.push({ fila: r, col: c });
            }

            // 3. Determinar el contenido del mapa base
            if (tile === '#') {
                mapTile = '#';
            } else if (tile === '@') {
                jugador = { fila: r, col: c };
                mapTile = ' '; // El jugador no se dibuja en el mapa base
            } 
            // Si es un marcador de caja o jugador, el espacio en el mapa base es vacío.
            else if (tile === '$' || tile === '*' || tile === '+') {
                 mapTile = ' ';
            }
            // Si era un objetivo marcado con '.', debe permanecer como '.' en el mapa base.
            else if (tile === '.') {
                mapTile = '.';
            } 
            // Cualquier otro carácter es espacio vacío (' ')
            else {
                mapTile = ' ';
            }

            filaActual.push(mapTile);
        }
        mapaBase.push(filaActual);
    }

    // Convertir el Set de coordenadas a un array de objetos {fila, col}
    let objetivosArray = [];
    for (const coord of objetivosSet) {
        const [rStr, cStr] = coord.split(',');
        objetivosArray.push({ fila: parseInt(rStr), col: parseInt(cStr) });
    }

    return {
        mapa: mapaBase,
        jugador: jugador,
        cajas: cajas,
        objetivos: objetivosArray,
        movimientos: 0
    };
},

    /**
     * Mueve el estado actual según la dirección y las reglas del juego.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (o el original si no hay movimiento).
     */
mover(estado, direccion) {
    // Crear una copia profunda del estado para asegurar inmutabilidad
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    let jugadorActual = estado.jugador;
    let nuevasCajas = [...estado.cajas]; // Copia superficial de la lista de cajas
    let nuevosMovimientos = estado.movimientos;

    // 1. Calcular la posición objetivo del jugador (sin considerar colisiones)
    let nextPlayerPos = { ...jugadorActual };
    switch (direccion) {
        case "arriba":
            nextPlayerPos.fila -= 1;
            break;
        case "abajo":
            nextPlayerPos.fila += 1;
            break;
        case "izquierda":
            nextPlayerPos.col -= 1;
            break;
        case "derecha":
            nextPlayerPos.col += 1;
            break;
    }

    // Verificar límites del mapa (Asumiendo que el mapa es de tamaño fijo, ej: 8x8)
    const maxFila = nuevoEstado.mapa.length - 1;
    const maxCol = nuevoEstado.mapa[0].length - 1;

    if (nextPlayerPos.fila < 0 || nextPlayerPos.fila > maxFila || nextPlayerPos.col < 0 || nextPlayerPos.col > maxCol) {
        return nuevoEstado; // Fuera de límites, no se mueve nada
    }

    // Verificar colisión con pared (usando el mapa base)
    if (nuevoEstado.mapa[nextPlayerPos.fila][nextPlayerPos.col] === '#') {
        return nuevoEstado; // Colisión con pared
    }

    // 2. Comprobar si la posición objetivo está ocupada por una caja
    const cajaEnDestino = nuevasCajas.some(c => c.fila === nextPlayerPos.fila && c.col === nextPlayerPos.col);

    if (!cajaEnDestino) {
        // Movimiento simple (solo el jugador se mueve)
        nuevoEstado.jugador = nextPlayerPos;
        return nuevoEstado;
    } else {
        // 3. Intento de empuje (Pushing)
        let cajaAEmpujarIndex = -1;
        for (let i = 0; i < nuevasCajas.length; i++) {
            const c = nuevasCajas[i];
            if (c.fila === nextPlayerPos.fila && c.col === nextPlayerPos.col) {
                cajaAEmpujarIndex = i;
                break;
            }
        }

        // Calcular la posición destino de la caja empujada
        let boxTargetPos = { ...nextPlayerPos };
        switch (direccion) {
            case "arriba":
                boxTargetPos.fila -= 1;
                break;
            case "abajo":
                boxTargetPos.fila += 1;
                break;
            case "izquierda":
                boxTargetPos.col -= 1;
                break;
            case "derecha":
                boxTargetPos.col += 1;
                break;
        }

        // Verificar si el destino de la caja es válido:
        // a) No puede ser pared (usando mapa base)
        if (nuevoEstado.mapa[boxTargetPos.fila][boxTargetPos.col] === '#') {
            return nuevoEstado; // Colisión con pared al empujar
        }

        // b) No puede estar ocupado por otra caja o el jugador
        const hayColisionCajaDestino = nuevasCajas.some((c, index) => 
            index !== cajaAEmpujarIndex && c.fila === boxTargetPos.fila && c.col === boxTargetPos.col
        );

        if (hayColisionCajaDestino) {
            return nuevoEstado; // Colisión con otra caja al empujar
        }

        // 4. Movimiento exitoso de Empuje
        
        // Crear la nueva lista de cajas para mantener la inmutabilidad
        let nuevasCajasActualizadas = [...nuevasCajas];

        // Actualizar la posición de la caja empujada
        const cajaEmpujadaOriginal = nuevasCajas[cajaAEmpujarIndex];
        const nuevaCajaEmpujada = { ...cajaEmpujadaOriginal, fila: boxTargetPos.fila, col: boxTargetPos.col };
        nuevasCajasActualizadas[cajaAEmpujarIndex] = nuevaCajaEmpujada;

        // Actualizar el estado con las nuevas posiciones y movimientos incrementados
        nuevoEstado.jugador = nextPlayerPos;
        nuevoEstado.cajas = nuevasCajasActualizadas;
        nuevoEstado.movimientos += 1;
        
        return nuevoEstado;
    }
},

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
ganado(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos que cumplir

        // Usamos un Set para almacenar las coordenadas únicas de los objetivos cubiertos.
        const objetivosCubiertos = new Set();

        for (const caja of estado.cajas) {
            const cajaCoord = `${caja.fila},${caja.col}`;
            
            // Verificamos si la posición de la caja coincide con alguna posición objetivo.
            let esObjetivo = false;
            for (const obj of estado.objetivos) {
                if (obj.fila === caja.fila && obj.col === caja.col) {
                    esObjetivo = true;
                    break;
                }
            }

            if (esObjetivo) {
                // Si es un objetivo, lo añadimos al set. El Set garantiza que solo se cuente una vez.
                objetivosCubiertos.add(cajaCoord);
            }
        }

        // Ganamos si el número de objetivos cubiertos únicos es igual al total de objetivos.
        return objetivosCubiertos.size === estado.objetivos.length;
    }
};
