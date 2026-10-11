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
        let mapaBase = [];

        // 1. Recorrer el nivel para identificar elementos y construir el mapa base
        for (let r = 0; r < nivel.length; r++) {
            const rowString = nivel[r];
            if (!rowString) continue; // Safety check for malformed input rows

            let nuevaFilaMapa = [];
            for (let c = 0; c < rowString.length; c++) {
                const char = rowString[c];

                if (char === '@') {
                    jugador = { fila: r, col: c };
                    nuevaFilaMapa.push(' '); // El jugador no se dibuja en el mapa base
                } else if (char === '$' || char === '*') {
                    // Caja o caja sobre objetivo
                    cajas.push({ fila: r, col: c });
                    nuevaFilaMapa.push(' '); // La caja no se dibuja en el mapa base
                } else if (char === '.') {
                    objetivos.push({ fila: r, col: c });
                    nuevaFilaMapa.push('.');
                } else if (char === '#') {
                    nuevaFilaMapa.push('#');
                } else {
                    // ' ', '+', o cualquier otro carácter que no sea un elemento móvil/especial
                    nuevaFilaMapa.push(' ');
                }
            }
            mapaBase.push(nuevaFilaMapa.join(''));
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
     * Verifica si el estado actual del juego es un estado de victoria.
     * Se gana cuando todas las posiciones objetivo tienen una caja encima.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si se ha ganado, false en caso contrario.
     */
ganado: function(estado) {
        if (!estado || !estado.objetivos || estado.objetivos.length === 0) return false;

        // Crear un set de coordenadas objetivo para una búsqueda rápida
        const objetivosSet = new Set(estado.objetivos.map(obj => `${obj.fila},${obj.col}`));

        // Verificar si cada caja está sobre un objetivo
        let cajasSobreObjetivo = 0;
        for (const caja of estado.cajas) {
            if (objetivosSet.has(`${caja.fila},${caja.col}`)) {
                cajasSobreObjetivo++;
            }
        }

        return cajasSobreObjetivo === estado.objetivos.length;
    },

    /**
     * Intenta mover al jugador en la dirección especificada, manejando colisiones y empujes de cajas.
     * Devuelve un NUEVO estado si el movimiento es válido, o el estado original si falla.
     * @param {object} estado - El estado actual del juego.
     * @param {string} direccion - La dirección deseada ("arriba", "abajo", "izquierda", "derecha").
     * @returns {object} Un nuevo objeto de estado (o el original) con los cambios aplicados.
     */
mover: function(estado, direccion) {
        // Clonar el estado para asegurar que solo se devuelva un nuevo estado si hay éxito
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const jugadorActual = estado.jugador;
        let nuevaPosicionJugador = { ...jugadorActual };

        // 1. Calcular la posición tentativa del jugador (p_new)
        switch (direccion) {
            case "arriba":
                nuevaPosicionJugador.fila -= 1;
                break;
            case "abajo":
                nuevaPosicionJugador.fila += 1;
                break;
            case "izquierda":
                nuevaPosicionJugador.col -= 1;
                break;
            case "derecha":
                nuevaPosicionJugador.col += 1;
                break;
        }

        // Función auxiliar para verificar si una posición es válida (dentro de límites y no pared)
        const esValido = (r, c) => {
            // Asumiendo que el mapa tiene dimensiones fijas o que los límites son manejados por 0-9.
            if (r < 0 || r >= estado.mapa.length || c < 0 || c >= estado.mapa[0].length) return false;
            return estado.mapa[r][c] !== '#';
        };

        // Verificar si el movimiento del jugador es posible en primer lugar (pared o fuera de límites)
        if (!esValido(nuevaPosicionJugador.fila, nuevaPosicionJugador.col)) {
            return estado; 
        }

        // 2. Verificar si la posición tentativa está ocupada por una caja
        let cajaEnDestino = estado.cajas.find(c => c.fila === nuevaPosicionJugador.fila && c.col === nuevaPosicionJugador.col);

        if (!cajaEnDestino) {
            // Caso 1: Movimiento a un espacio vacío (piso o objetivo). ¡Éxito!
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;
            return nuevoEstado;
        } else {
            // Caso 2: Posición tentativa ocupada por una caja. Intentar empujar.

            let posicionCaja = cajaEnDestino;
            let nuevaPosicionCaja = { ...posicionCaja };

            switch (direccion) {
                case "arriba":
                    nuevaPosicionCaja.fila -= 1;
                    break;
                case "abajo":
                    nuevaPosicionCaja.fila += 1;
                    break;
                case "izquierda":
                    nuevaPosicionCaja.col -= 1;
                    break;
                case "derecha":
                    nuevaPosicionCaja.col += 1;
                    break;
            }

            // Verificar si el destino de la caja es válido (no pared y no fuera de límites)
            if (!esValido(nuevaPosicionCaja.fila, nuevaPosicionCaja.col)) {
                return estado; // La caja está contra una pared o límite. No se puede empujar.
            }

            // Verificar si el destino de la caja está ocupado por otra caja (colisión)
            const hayOtraCaja = estado.cajas.some(c => 
                c !== posicionCaja && c.fila === nuevaPosicionCaja.fila && c.col === nuevaPosicionCaja.col
            );

            if (hayOtraCaja) {
                return estado; // Colisión con otra caja. No se puede empujar.
            }

            // Empuje exitoso: Actualizar posiciones de jugador y caja
            nuevoEstado.jugador = nuevaPosicionJugador;
            nuevoEstado.movimientos += 1;

            // Actualizar la posición de la caja en el nuevo estado (CORRECCIÓN DE REFERENCIA)
            let nuevasCajas = estado.cajas.map(c => ({ ...c })); // Clonar array y objetos internos
            
            // Buscar e identificar la caja que se movió usando coordenadas, no referencias.
            for (let i = 0; i < nuevasCajas.length; i++) {
                const caja = nuevasCajas[i];
                if (caja.fila === posicionCaja.fila && caja.col === posicionCaja.col) {
                    // Actualizar la posición de esta caja específica
                    nuevasCajas[i] = { 
                        fila: nuevaPosicionCaja.fila, 
                        col: nuevaPosicionCaja.col 
                    };
                    break;
                }
            }

            nuevoEstado.cajas = nuevasCajas;
            return nuevoEstado;
        }
    }
};
