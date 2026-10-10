const Reglas = {

    // Helper para obtener coordenadas opuestas según la dirección
    getOpposite(direccion) {
        switch (direccion) {
            case "arriba": return "abajo";
            case "abajo": return "arriba";
            case "izquierda": return "derecha";
            case "derecha": return "izquierda";
        }
    },

    // Crea el estado inicial del juego a partir de un nivel.
crearEstado(nivel) {
        const filas = nivel.length;
        if (filas === 0) return { mapa: [], jugador: null, cajas: [], objetivos: [], movimientos: 0 };
        const columnas = nivel[0].length;

        let jugadorInicial = null;
        let cajasIniciales = [];
        let objetivosIniciales = [];

        // Paso 1: Identificar posiciones iniciales y objetivos
        for (let r = 0; r < filas; r++) {
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@' || char === '+') {
                    // Jugador puede empezar en @ o +
                    jugadorInicial = { fila: r, col: c };
                } else if (char === '$' || char === '*') {
                    // Las cajas se identifican por $ o *
                    cajasIniciales.push({ fila: r, col: c });
                } 
                
                // Identificar objetivos: '.' es el marcador estándar. 
                // Incluimos *, + como posibles marcadores de objetivo en la posición inicial.
                if (char === '.' || char === '*' || char === '+') {
                    objetivosIniciales.push({ fila: r, col: c });
                }
            }
        }

        // Paso 2: Construir el mapa limpio (solo #, ' ', '.')
        let mapaLimpio = [];
        for (let r = 0; r < filas; r++) {
            let filaMapa = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '#') {
                    filaMapa += '#'; // Pared
                } else if (char === '.' || char === '+' || char === '*') {
                    // Si el carácter es un objetivo o un marcador que debe ser tratado como tal en el mapa limpio.
                    filaMapa += '.'; 
                } else if (char === '@' || char === '$') {
                    // Jugador o caja: espacio libre ' '
                    filaMapa += ' '; 
                } else {
                    // Cualquier otro carácter que no sea pared, se trata como espacio vacío.
                    filaMapa += ' ';
                }
            }
            mapaLimpio.push(filaMapa);
        }

        return {
            mapa: mapaLimpio,
            jugador: jugadorInicial,
            cajas: cajasIniciales,
            objetivos: objetivosIniciales,
            movimientos: 0
        };
    },

    // Intenta mover al jugador y empujar macetas si es necesario.
    mover(estado, direccion) {
        const { jugador, cajas } = estado;
        let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Copia profunda del estado
        nuevoEstado.movimientos = estado.movimientos;

        // Vector de movimiento (dr, dc)
        let dr, dc;
        switch (direccion) {
            case "arriba": dr = -1; dc = 0; break;
            case "abajo": dr = 1; dc = 0; break;
            case "izquierda": dr = 0; dc = -1; break;
            case "derecha": dr = 0; dc = 1; break;
        }

        // Posición potencial del jugador (P_new)
        const pNew = { fila: jugador.fila + dr, col: jugador.col + dc };

        // 1. Verificar límites y paredes en P_new
        if (pNew.fila < 0 || pNew.fila >= 9 || pNew.col < 0 || pNew.col >= 9) {
            return estado; // Fuera de límites
        }
        if (estado.mapa[pNew.fila][pNew.col] === '#') {
            return estado; // Colisión con pared
        }

        // 2. Verificar si P_new está ocupado por una caja
        const cajaEnPNew = cajas.find(c => c.fila === pNew.fila && c.col === pNew.col);

        if (!cajaEnPNew) {
            // Caso A: Movimiento simple (sin empujar)
            nuevoEstado.jugador = pNew;
            nuevoEstado.movimientos++;
            return nuevoEstado;
        } else {
            // Caso B: Intento de empuje
            const cajaPos = cajaEnPNew;
            // Posición potencial del destino de la caja (B_new)
            const bNew = { fila: cajaPos.fila + dr, col: cajaPos.col + dc };

            // Verificar si el destino B_new es válido para la caja
            if (bNew.fila < 0 || bNew.fila >= 9 || bNew.col < 0 || bNew.col >= 9) {
                return estado; // Colisión con límite
            }

            // Verificar si el destino B_new es una pared o está ocupado por otra caja
            if (estado.mapa[bNew.fila][bNew.col] === '#') {
                return estado; // Colisión de la caja contra pared
            }

            const hayOtraCaja = cajas.some(c => c !== cajaPos && c.fila === bNew.fila && c.col === bNew.col);
            if (hayOtraCaja) {
                return estado; // Colisión de la caja contra otra caja
            }

            // Si es válido, realizar el movimiento y empuje
            nuevoEstado.jugador = cajaPos; // El jugador se mueve a donde estaba la caja
            nuevoEstado.cajas = nuevoEstado.cajas.map(c => {
                if (c.fila === cajaPos.fila && c.col === cajaPos.col) {
                    return bNew; // La caja que fue empujada cambia de posición
                }
                return c;
            });
            nuevoEstado.movimientos++;
            return nuevoEstado;
        }
    },

    // Verifica si todas las macetas están sobre un objetivo.
    ganado(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        const objetivosSet = new Set(estado.objetivos.map(o => `${o.fila},${o.col}`));
        let macetasSobreObjetivo = 0;

        for (const caja of estado.cajas) {
            if (objetivosSet.has(`${caja.fila},${caja.col}`)) {
                macetasSobreObjetivo++;
            }
        }

        return macetasSobreObjetivo === estado.objetivos.length;
    }
};
