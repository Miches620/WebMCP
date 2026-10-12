const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de la representación textual del nivel.
     * @param {string[]} nivel - Array de strings que representan el mapa (filas).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasArray = [];
        let objetivosArray = [];
        let mapaInicial = JSON.parse(JSON.stringify(nivel)); // Copia profunda de las filas

        // 1. Identificar posiciones iniciales y limpiar el mapa base
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                    mapaInicial[r] = mapaInicial[r].substring(0, c) + ' ' + mapaInicial[r].substring(c + 1);
                } else if (char === '$') {
                    cajasArray.push({ fila: r, col: c });
                    mapaInicial[r] = mapaInicial[r].substring(0, c) + ' ' + mapaInicial[r].substring(c + 1);
                } else if (char === '.') {
                    objetivosArray.push({ fila: r, col: c });
                    // Los objetivos se mantienen como '.' en el estado base del mapa
                }
            }
        }

        return {
            mapa: mapaInicial, // Mapa con solo #, ' ', y '.'
            jugador: jugadorPos,
            cajas: cajasArray,
            objetivos: objetivosArray,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección. Devuelve un nuevo estado inmutable.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Nuevo estado o el estado original si el movimiento es inválido.
     */
mover(estado, direccion) {
    const jugador = estado.jugador;
    let nuevaFila = jugador.fila;
    let nuevaCol = jugador.col;

    // 1. Calcular la posición objetivo del jugador
    switch (direccion) {
        case "arriba":
            nuevaFila -= 1;
            break;
        case "abajo":
            nuevaFila += 1;
            break;
        case "izquierda":
            nuevaCol -= 1;
            break;
        case "derecha":
            nuevaCol += 1;
            break;
    }

    const filas = estado.mapa.length;
    // Asumimos que el mapa no está vacío y todas las filas tienen la misma longitud
    if (filas === 0) return { ...estado }; 
    const columnas = estado.mapa[0].length;

    // Validación de límites y paredes en la posición objetivo del jugador
    if (nuevaFila < 0 || nuevaFila >= filas || nuevaCol < 0 || nuevaCol >= columnas) {
        return { ...estado }; // Fuera de límites
    }
    if (estado.mapa[nuevaFila][nuevaCol] === '#') {
        return { ...estado }; // Colisión con pared
    }

    // Verificar si hay una caja en la posición objetivo del jugador
    const cajaEnDestino = estado.cajas.some(c => c.fila === nuevaFila && c.col === nuevaCol);

    if (!cajaEnDestino) {
        // Caso 1: Movimiento simple (a espacio o objetivo)
        return {
            mapa: JSON.parse(JSON.stringify(estado.mapa)), // Copia inmutable del mapa
            jugador: { fila: nuevaFila, col: nuevaCol },
            cajas: estado.cajas.map(c => ({ ...c })), // Copia de cajas
            objetivos: estado.objetivos.map(o => ({ ...o })), // Copia de objetivos
            movimientos: estado.movimientos + 1
        };
    } else {
        // Caso 2: Intento de empujar una caja
        const cajaAEmpujar = estado.cajas.find(c => c.fila === nuevaFila && c.col === nuevaCol);

        let destinoCajaFila = cajaAEmpujar.fila;
        let destinoCajaCol = cajaAEmpujar.col;

        // Calcular la posición de destino para la caja
        switch (direccion) {
            case "arriba":
                destinoCajaFila -= 1;
                break;
            case "abajo":
                destinoCajaFila += 1;
                break;
            case "izquierda":
                destinoCajaCol -= 1;
                break;
            case "derecha":
                destinoCajaCol += 1;
                break;
        }

        // Validación de la posición destino para la caja:
        // 1. ¿Está fuera de límites?
        if (destinoCajaFila < 0 || destinoCajaFila >= filas || destinoCajaCol < 0 || destinoCajaCol >= columnas) {
            return { ...estado }; // La caja cae fuera del mapa
        }

        // 2. ¿Está bloqueada por una pared?
        if (estado.mapa[destinoCajaFila][destinoCajaCol] === '#') {
            return { ...estado }; // Colisión con pared en destino de la caja
        }

        // 3. ¿Hay otra cosa (caja) bloqueando el movimiento de la caja?
        const colisionaConOtroObjeto = estado.cajas.some(c => c !== cajaAEmpujar && c.fila === destinoCajaFila && c.col === destinoCajaCol);

        if (colisionaConOtroObjeto) {
            return { ...estado }; // Colisión con otra caja
        }

        // Si el movimiento es válido:
        
        // 1. Crear la lista de cajas actualizadas: filtrar la caja vieja y añadir la nueva posición
        const nuevoCajas = estado.cajas.filter(c => !(c.fila === nuevaFila && c.col === nuevaCol));
        nuevoCajas.push({ fila: destinoCajaFila, col: destinoCajaCol });

        // 2. Construir el nuevo estado inmutable
        const nuevoEstado = {
            mapa: JSON.parse(JSON.stringify(estado.mapa)),
            jugador: { fila: nuevaFila, col: nuevaCol },
            cajas: [...nuevoCajas], // Usamos spread para asegurar que es una copia del array de cajas
            objetivos: estado.objetivos.map(o => ({ ...o })),
            movimientos: estado.movimientos + 1
        };

        return nuevoEstado;
    }
},

    /**
     * Verifica si todas las cajas están sobre los objetivos.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado, False en caso contrario.
     */
    ganado(estado) {
        if (estado.objetivos.length === 0) return true; // Caso borde: no hay objetivos

        const cajasEnObjetivos = estado.cajas.every(caja => {
            return estado.objetivos.some(obj => caja.fila === obj.fila && caja.col === obj.col);
        });

        // Verificación más estricta: ¿Hay una caja para CADA objetivo?
        const objetivosCubiertos = new Set();
        estado.cajas.forEach(caja => {
            for (let i = 0; i < estado.objetivos.length; i++) {
                const obj = estado.objetivos[i];
                if (caja.fila === obj.fila && caja.col === obj.col) {
                    objetivosCubiertos.add(obj);
                    break;
                }
            }
        });

        return objetivosCubiertos.size === estado.objetivos.length;
    }
};
