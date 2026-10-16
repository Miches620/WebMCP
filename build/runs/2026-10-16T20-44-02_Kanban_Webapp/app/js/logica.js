/**
 * App object containing all core business logic for Kanban board operations.
 * All methods return a new, immutable state object.
 */
const App = {

    /**
     * Returns a deep copy of the initial state.
     * @returns {object} A fresh state object.
     */
    crear: function() {
        // Deep clone ESTADO_INICIAL to ensure immutability
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Creates a new card and adds it to the active column.
     * @param {object} estado - The current state.
     * @param {string} titulo - Title of the new card.
     * @param {string} descripcion - Description of the new card.
     * @param {('alta'|'media'|'baja')} prioridad - Priority level.
     * @returns {object} The new state object.
     */
    crearTarjeta: function(estado, titulo, descripcion, prioridad) {
        const nuevaColumnaId = estado.columnaActivaId;
        const columnaActual = estado.columnas.find(c => c.id === nuevaColumnaId);

        if (!columnaActual) return estado; // Should not happen if state is valid

        // 1. Generate unique ID (simple simulation based on existing IDs)
        let maxIdNum = 0;
        columnaActual.tarjetas.forEach(card => {
            const match = card.id.match(/t(\d+)$/);
            if (match && match[1]) {
                maxIdNum = Math.max(maxIdNum, parseInt(match[1]));
            }
        });
        const nuevoCardId = `t${maxIdNum + 1}`;

        // 2. Create the new card object
        const nuevaTarjeta = {
            id: nuevoCardId,
            titulo: titulo,
            descripcion: descripcion,
            prioridad: prioridad
        };

        // 3. Create a deep copy of the state to ensure immutability
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 4. Update the active column's cards and counter
        const nuevaColumnaActual = nuevoEstado.columnas.find(c => c.id === nuevaColumnaId);
        if (nuevaColumnaActual) {
            nuevaColumnaActual.tarjetas = [...nuevaColumnaActual.tarjetas, nuevaTarjeta];
            nuevaColumnaActual.counter += 1;
        }

        return nuevoEstado;
    },

    /**
     * Edits the details of an existing card.
     * @param {object} estado - The current state.
     * @param {string} id - ID of the card to edit.
     * @param {string} titulo - New title.
     * @param {string} descripcion - New description.
     * @param {('alta'|'media'|'baja')} prioridad - New priority.
     * @returns {object} The new state object.
     */
    editarTarjeta: function(estado, id, titulo, descripcion, prioridad) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Iterate through all columns to find and update the card
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const tarjetasActualizadas = columna.tarjetas.map(card => {
                if (card.id === id) {
                    // Found the card, return a new object with updated data
                    return { ...card, titulo: titulo, descripcion: descripcion, prioridad: prioridad };
                }
                return card;
            });

            // Check if any card was actually updated in this column
            if (tarjetasActualizadas.some(card => card.id === id)) {
                nuevoEstado.columnas[i].tarjetas = tarjetasActualizadas;
                // Counter does not change on edit, so no update needed here.
                return nuevoEstado; // Return immediately after modification
            }
        }

        // If the card was not found, return the original state copy
        return estado;
    },

    /**
     * Deletes a card from the specified column.
     * @param {object} estado - The current state.
     * @param {string} id - ID of the card to delete.
     * @param {string} columnaId - ID of the column containing the card.
     * @returns {object} The new state object.
     */
    borrarTarjeta: function(estado, id, columnaId) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const columnaEncontrada = nuevoEstado.columnas.find(c => c.id === columnaId);

        if (!columnaEncontrada) return estado;

        // 1. Filter out the card to be deleted
        const nuevasTarjetas = columnaEncontrada.tarjetas.filter(card => card.id !== id);

        // 2. Update the column state
        nuevoEstado.columnas[nuevoEstado.columnas.findIndex(c => c.id === columnaId)].tarjetas = nuevasTarjetas;

        // 3. Decrement counter
        columnaEncontrada.counter -= 1;

        return nuevoEstado;
    },

    /**
     * Moves a card from its current column to a new column.
     * @param {object} estado - The current state.
     * @param {string} cardId - ID of the card to move.
     * @param {string} nuevaColumnaId - ID of the destination column.
     * @returns {object} The new state object.
     */
    moverTarjeta: function(estado, cardId, nuevaColumnaId) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 1. Find the source column and the card's original location
        let origenColumnaIndex = -1;
        let tarjetaMovida = null;

        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const card = columna.tarjetas.find(c => c.id === cardId);
            if (card) {
                origenColumnaIndex = i;
                tarjetaMovida = card;
                break;
            }
        }

        // Check if the source column or card exists
        if (origenColumnaIndex === -1 || !tarjetaMovida) return estado;

        const columnaOrigen = nuevoEstado.columnas[origenColumnaIndex];
        const columnaDestino = nuevoEstado.columnas.find(c => c.id === nuevaColumnaId);

        if (!columnaDestino) return estado; // Destination column does not exist

        // 2. Perform the move operation (Immutability required)

        // A. Remove card from origin
        const nuevasTarjetasOrigen = columnaOrigen.tarjetas.filter(card => card.id !== cardId);
        nuevoEstado.columnas[origenColumnaIndex].tarjetas = nuevasTarjetasOrigen;
        nuevoEstado.columnas[origenColumnaIndex].counter -= 1;

        // B. Add card to destination
        const nuevasTarjetasDestino = [...columnaDestino.tarjetas, tarjetaMovida];
        nuevoEstado.columnas[nuevoEstado.columnas.findIndex(c => c.id === nuevaColumnaId)].tarjetas = nuevasTarjetasDestino;
        nuevoEstado.columnas[nuevoEstado.columnas.findIndex(c => c.id === nuevaColumnaId)].counter += 1;

        return nuevoEstado;
    }
};
