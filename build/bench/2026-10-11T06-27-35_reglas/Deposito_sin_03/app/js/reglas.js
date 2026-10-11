const Reglas = {
    /**
     * Crea un estado inicial a partir de la representación del nivel.
     * @param {string[]} nivel - Array de strings (8x8) que definen el mapa.
     * @returns {object} Estado inicial del juego.
     */
    crearEstado: function(nivel) {
        let jugador = null;
        let cajas = [];
        let objetivos = [];
        let mapaBase = [];

        for (let r = 0; r < 8; r++) {
            let filaActual = nivel[r].split('');
            let nuevaFilaMapa = [];

            for (let c = 0; c < 8; c++) {
                const char = filaActual[c];
                let mapaChar = ' '; // Default floor space

                if (char === '#') {
                    mapaChar = '#';
                } else if (char === '.') {
                    // Objetivo fijo
                    objetivos.push({ r: r, c: c });
                    mapaChar = '.';
                } else if (char === '@') {
                    jugador = { r: r, c: c };
                    mapaChar = ' '; // El jugador ocupa un espacio de piso en el mapa base
                } else if (char === '$' || char === '*') {
                    // Caja. Se registra la posición y se deja como piso en el mapa base.
                    cajas.push({ r: r, c: c });
                    mapaChar = ' ';
                } else {
                    // Espacio vacío o cualquier otro carácter no mapeado (se trata como piso)
                    mapaChar = ' ';
                }
                nuevaFilaMapa.push(mapaChar);
            }
            mapaBase.push(nuevaFilaMapa);
        }

        return {
            mapa: mapaBase,
            jugador: jugador,
            cajas: cajas,
            objetivos: objetivos,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección. Maneja colisiones y empujes.
     * @param {object} estado - El estado actual del juego.
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección de movimiento.
     * @returns {object} Un nuevo estado (inmutable) o el estado original si no hay movimiento.
     */
    mover: function(estado, direccion) {
        // Clonar el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        let r = estado.jugador.r;
        let c = estado.jugador.c;
        let dr = 0, dc = 0;

        if (direccion === "arriba") {
            dr = -1; dc = 0;
        } else if (direccion === "abajo") {
            dr = 1; dc = 0;
        } else if (direccion === "izquierda") {
            dr = 0; dc = -1;
        } else if (direccion === "derecha") {
            dr = 0; dc = 1;
        }

        let nextR = r + dr;
        let nextC = c + dc;

        // 1. Verificar límites y paredes en el destino inmediato del jugador
        if (nextR < 0 || nextR > 7 || nextC < 0 || nextC > 7 || nuevoEstado.mapa[nextR][nextC] === '#') {
            return estado; // Colisión con pared o límite
        }

        // Verificar si el destino inmediato está ocupado por una caja
        let boxCollision = false;
        for (const caja of estado.cajas) {
            if (caja.r === nextR && caja.c === nextC) {
                boxCollision = true;
                break;
            }
        }

        // Caso 1: Movimiento simple (destino no tiene caja)
        if (!boxCollision) {
            nuevoEstado.jugador = { r: nextR, c: nextC };
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        }

        // Caso 2: Intento de empuje (destino inmediato tiene caja)
        let boxToPushIndex = -1;
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.r === nextR && caja.c === nextC) {
                boxToPushIndex = i;
                break;
            }
        }

        // Calcular la posición detrás de la caja
        let pushNextR = nextR + dr;
        let pushNextC = nextC + dc;

        // 2. Verificar si el empuje es posible (destino final no tiene pared, está dentro del mapa y no hay otra caja)
        if (pushNextR >= 0 && pushNextR <= 7 && pushNextC >= 0 && pushNextC <= 7 && nuevoEstado.mapa[pushNextR][pushNextC] !== '#') {

            // Verificar si el destino final está ocupado por otra caja
            let collisionWithOtherBox = false;
            for (const caja of estado.cajas) {
                if ((caja.r === pushNextR && caja.c === pushNextC) && !(caja.r === nextR && caja.c === nextC)) {
                    collisionWithOtherBox = true;
                    break;
                }
            }

            if (!collisionWithOtherBox) {
                // Empuje exitoso: 
                // 1. Actualizar posición del jugador a la antigua posición de la caja.
                nuevoEstado.jugador = { r: nextR, c: nextC };
                
                // 2. Actualizar la posición de la caja empujada.
                let nuevaCajaPosicion = { r: pushNextR, c: pushNextC };
                
                // Creamos una copia del array de cajas y actualizamos el elemento correcto
                let nuevasCajas = JSON.parse(JSON.stringify(estado.cajas));
                nuevasCajas[boxToPushIndex] = nuevaCajaPosicion;
                nuevoEstado.cajas = nuevasCajas;

                // 3. Incrementar movimientos.
                nuevoEstado.movimientos += 1;
                return nuevoEstado;
            }
        }

        // Si el empuje falla (pared, límite o caja contra otra caja)
        return estado;
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado el nivel.
     */
    ganado: function(estado) {
        if (estado.objetivos.length === 0) return true; // No hay objetivos, por defecto es ganador

        for (const objetivo of estado.objetivos) {
            let cajaEnObjetivo = false;
            for (const caja of estado.cajas) {
                if (caja.r === objetivo.r && caja.c === objetivo.c) {
                    cajaEnObjetivo = true;
                    break;
                }
            }
            // Si encontramos un objetivo sin caja, el nivel no está ganado
            if (!cajaEnObjetivo) {
                return false;
            }
        }
        // Todos los objetivos tienen una caja encima
        return true;
    }
};
