const App = {
    /**
     * Crea una copia profunda del estado inicial.
     * @returns {Object} Estado clonado.
     */
    crear: function() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Agrega una nueva tarjeta al tablero, siempre en 'Pendiente'.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} titulo - Título de la tarjeta.
     * @param {string} descripcion - Descripción de la tarjeta.
     * @param {string} prioridad - Prioridad ('alta', 'media', 'baja').
     * @returns {Object} Nuevo estado con la tarjeta agregada y contadores actualizados.
     */
    agregarTarjeta: function(estado, titulo, descripcion, prioridad) {
        const nuevaTarjeta = {
            id: "c" + Date.now(),
            titulo: titulo,
            descripcion: descripcion,
            prioridad: prioridad,
            columnaId: "Pendiente",
            fechaCreacion: Date.now()
        };

        // 1. Clonar el estado para inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 2. Añadir la tarjeta a los arrays de tarjetas
        nuevoEstado.cards.push(nuevaTarjeta);

        // 3. Actualizar contadores: Solo 'Pendiente' recibe el incremento
        if (nuevoEstado.columns["Pendiente"]) {
            nuevoEstado.columns["Pendiente"].counter += 1;
        }

        return nuevoEstado;
    },

    /**
     * Edita los detalles de una tarjeta existente.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} id - ID de la tarjeta a editar.
     * @param {string} titulo - Nuevo título.
     * @param {string} descripcion - Nueva descripción.
     * @param {string} prioridad - Nueva prioridad.
     * @returns {Object} Nuevo estado con la tarjeta editada y contadores sin cambios (ya que no cambia de columna).
     */
    editarTarjeta: function(estado, id, titulo, descripcion, prioridad) {
        // 1. Clonar el estado para inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 2. Buscar y actualizar la tarjeta
        const cardIndex = nuevoEstado.cards.findIndex(card => card.id === id);

        if (cardIndex !== -1) {
            nuevoEstado.cards[cardIndex] = {
                ...nuevoEstado.cards[cardIndex], // Mantener propiedades no editables como columnaId y fechaCreacion
                titulo: titulo,
                descripcion: descripcion,
                prioridad: prioridad
            };
        }

        // Los contadores no cambian al editar contenido dentro de la misma columna.
        return nuevoEstado;
    },

    /**
     * Elimina permanentemente una tarjeta del tablero.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} id - ID de la tarjeta a borrar.
     * @returns {Object} Nuevo estado sin la tarjeta y con contadores ajustados.
     */
    borrarTarjeta: function(estado, id) {
        // 1. Clonar el estado para inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 2. Identificar la columna de la tarjeta a borrar
        const cardIndex = nuevoEstado.cards.findIndex(card => card.id === id);
        if (cardIndex === -1) {
            return estado; // Tarjeta no encontrada, devolver el estado original
        }

        const tarjetaBorrada = nuevoEstado.cards[cardIndex];
        const columnaOrigenId = tarjetaBorrada.columnaId;

        // 3. Filtrar la tarjeta del array de tarjetas
        nuevoEstado.cards = nuevoEstado.cards.filter(card => card.id !== id);

        // 4. Ajustar contadores: Decrementar el contador de la columna origen
        if (nuevoEstado.columns[columnaOrigenId]) {
            nuevoEstado.columns[columnaOrigenId].counter -= 1;
        }

        return nuevoEstado;
    },

    /**
     * Mueve una tarjeta de su columna actual a la columna destino.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} columnaDestino - ID de la columna de destino ('Pendiente', 'En_Curso', 'Completa').
     * @returns {Object} Nuevo estado con la tarjeta movida y contadores ajustados.
     */
    moverTarjeta: function(estado, cardId, columnaDestino) {
        // 1. Clonar el estado para inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 2. Buscar la tarjeta y su origen
        const cardIndex = nuevoEstado.cards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
            return estado; // Tarjeta no encontrada
        }

        const tarjetaMovida = nuevoEstado.cards[cardIndex];
        const columnaOrigenId = tarjetaMovida.columnaId;

        // 3. Verificar si el movimiento es válido y necesario
        if (columnaOrigenId === columnaDestino) {
            return estado; // Ya está en la columna destino
        }

        // 4. Actualizar la tarjeta con la nueva columna
        nuevoEstado.cards[cardIndex] = {
            ...tarjetaMovida,
            columnaId: columnaDestino
        };

        // 5. Ajustar contadores
        if (nuevoEstado.columns[columnaOrigenId]) {
            nuevoEstado.columns[columnaOrigenId].counter -= 1;
        }
        if (nuevoEstado.columns[columnaDestino]) {
            nuevoEstado.columns[columnaDestino].counter += 1;
        }

        return nuevoEstado;
    }
};
