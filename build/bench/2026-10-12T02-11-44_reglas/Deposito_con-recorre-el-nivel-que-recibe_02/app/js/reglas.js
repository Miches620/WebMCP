const Reglas = {
    /**
     * Crea el estado inicial del juego a partir de un nivel dado.
     * @param {string[]} nivel - Array de strings que representan el mapa (filas).
     * @returns {object} El estado inicial del juego.
     */
    crearEstado: function(nivel) {
        const filas = nivel.length;
        if (filas === 0) return null;
        const columnas = nivel[0].length;

        let jugadorPos = null;
        let cajasList = [];
        let objetivosList = [];
        let mapaNuevo = [];

        // 1. Parsear el nivel para inicializar posiciones y el mapa base
        for (let r = 0; r < filas; r++) {
            mapaNuevo[r] = '';
            for (let c = 0; c < columnas; c++) {
                const char = nivel[r][c];
                if (char === '@') {
                    jugadorPos = { fila: r, col: c };
                } else if (char === '$') {
                    cajasList.push({ fila: r, col: c });
                } else if (char === '.') {
                    objetivosList.push({ fila: r, col: c });
                }
            }
        }

        // 2. Construir el mapa base sin jugadores ni cajas iniciales
        for (let r = 0; r < filas; r++) {
            mapaNuevo[r] = Array.from(nivel[r]).join('');
            // Reemplazar caracteres de entidades por espacios en blanco para que solo queden #, ' ', '.'
            mapaNuevo[r] = mapaNuevo[r].replace(/[@$]/g, ' ');
        }

        return {
            mapa: mapaNuevo,
            jugador: jugadorPos,
            cajas: cajasList,
            objetivos: objetivosList,
            movimientos: 0
        };
    },

    /**
     * Mueve el estado del juego según la dirección y las reglas de colisión.
     * @param {object} estado - El estado actual (inmutable).
     * @param {"arriba" | "abajo" | "izquierda" | "derecha"} direccion - Dirección deseada.
     * @returns {object} Un nuevo estado que refleja el movimiento o la falta de él.
     */
    mover: function(estado, direccion) {
        const filas = estado.mapa.length;
        if (filas === 0) return { ...estado }; // Evitar errores si el mapa está vacío

        const columnas = estado.mapa[0].length;

        // Función auxiliar para obtener la posición objetivo del jugador
        let p_new = { ...estado.jugador };
        switch (direccion) {
            case "arriba":
                p_new.fila -= 1;
                break;
            case "abajo":
                p_new.fila += 1;
                break;
            case "izquierda":
                p_new.col -= 1;
                break;
            case "derecha":
                p_new.col += 1;
                break;
        }

        // 1. Validación de límites y paredes para el jugador
        if (p_new.fila < 0 || p_new.fila >= filas || p_new.col < 0 || p_new.col >= columnas) {
            return { ...estado }; // Fuera de límites
        }

        // Verificar si la nueva posición del jugador es una pared en el mapa base
        if (estado.mapa[p_new.fila][p_new.col] === '#') {
            return { ...estado }; // Colisión con pared
        }

        let nuevoEstado = {
            ...estado,
            jugador: { ...p_new },
            cajas: [...estado.cajas],
            movimientos: estado.movimientos
        };

        // 2. Verificar si la nueva posición del jugador está ocupada por una caja
        const cajaEnPosicionObjetivo = estado.cajas.some(caja => caja.fila === p_new.fila && caja.col === p_new.col);

        if (!cajaEnPosicionObjetivo) {
            // Movimiento simple (sin empujar cajas)
            nuevoEstado.jugador = { ...p_new };
            return nuevoEstado;
        }

        // 3. Intentar empujar una caja
        let cajaAEmpujarIndex = -1;
        for (let i = 0; i < estado.cajas.length; i++) {
            const caja = estado.cajas[i];
            if (caja.fila === p_new.fila && caja.col === p_new.col) {
                cajaAEmpujarIndex = i;
                break;
            }
        }

        // Calcular la posición de empuje para la caja
        let b_push = { ...estado.jugador }; // Empieza en la posición actual del jugador (que es donde está la caja)
        switch (direccion) {
            case "arriba":
                b_push.fila -= 1;
                break;
            case "abajo":
                b_push.fila += 1;
                break;
            case "izquierda":
                b_push.col -= 1;
                break;
            case "derecha":
                b_push.col += 1;
                break;
        }

        // Validación de la posición de empuje (b_push)
        let puedeEmpujar = true;

        // a) ¿Está fuera de límites o es una pared?
        if (b_push.fila < 0 || b_push.fila >= filas || b_push.col < 0 || b_push.col >= columnas) {
            puedeEmpujar = false;
        } else if (estado.mapa[b_push.fila][b_push.col] === '#') {
            puedeEmpujar = false;
        }

        // b) ¿Está la posición de empuje ocupada por otra caja?
        if (puedeEmpujar) {
            const otrasCajas = estado.cajas.filter((_, index) => index !== cajaAEmpujarIndex);
            if (otrasCajas.some(caja => caja.fila === b_push.fila && caja.col === b_push.col)) {
                puedeEmpujar = false; // Bloqueado por otra caja
            }
        }

        // 4. Aplicar el movimiento si es exitoso (empuje)
        if (puedeEmpujar) {
            // Crear nuevo estado con cajas actualizadas y jugador movido
            let nuevasCajas = [...estado.cajas];
            
            // Mover la caja empujada
            nuevasCajas[cajaAEmpujarIndex] = { ...b_push };

            nuevoEstado.jugador = { ...p_new };
            nuevoEstado.cajas = nuevasCajas;
            nuevoEstado.movimientos += 1; // Incremento de movimientos solo si se empuja exitosamente
            return nuevoEstado;
        } else {
            // No se puede mover ni empujar, devolver estado original
            return { ...estado };
        }
    },

    /**
     * Verifica si todas las cajas están sobre un objetivo.
     * @param {object} estado - El estado actual del juego.
     * @returns {boolean} True si el nivel está ganado.
     */
ganado: function(estado) {
        if (estado.objetivos.length === 0 || estado.cajas.length === 0) return false;

        // Crear un set de coordenadas objetivo (los lugares que deben estar cubiertos)
        const objectivesSet = new Set();
        estado.objetivos.forEach(obj => objectivesSet.add(`${obj.fila},${obj.col}`));

        // Crear un set de coordenadas caja (dónde están las cajas actualmente)
        const boxesSet = new Set();
        estado.cajas.forEach(box => boxesSet.add(`${box.fila},${box.col}`));

        // Verificar si cada objetivo tiene al menos una caja encima
        for (const coord of objectivesSet) {
            if (!boxesSet.has(coord)) {
                return false; // Al menos un objetivo no está cubierto por ninguna caja
            }
        }
        return true; // Todos los objetivos están cubiertos
    }
};
