const App = {
    /**
     * Crea una copia profunda del estado inicial.
     * @returns {Object} El estado inicial copiado.
     */
    crear() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta y la añade a la columna especificada.
     * @param {Object} estado - Estado actual de la aplicación.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} descripcion - Descripción de la nueva tarjeta.
     * @param {('alta'|'media'|'baja')} prioridad - Prioridad de la tarjeta.
     * @param {string} columnaOrigenId - ID de la columna donde se creará la tarjeta.
     * @returns {Object} Nuevo estado con la tarjeta añadida y contadores actualizados.
     */
crearTarjeta(estado, titulo, descripcion, prioridad, columnaOrigenId) {
    // 1. Crear nueva tarjeta
    const nuevaTarjeta = {
        id: estado.nextCardId,
        titulo: titulo,
        descripcion: descripcion,
        prioridad: prioridad,
        timestamp: Date.now()
    };

    // 2. Copiar el estado para mantener la inmutabilidad (Deep copy)
    let nuevoEstado = JSON.parse(JSON.stringify(estado));

    // 3. Encontrar y actualizar la columna destino de forma inmutable
    const columnasActualizadas = nuevoEstado.columnas.map(columna => {
        if (columna.id === columnaOrigenId) {
            // Crear una nueva columna con el array de tarjetas actualizado
            return {
                ...columna, // Copiar todas las propiedades existentes
                tarjetas: [...columna.tarjetas, nuevaTarjeta] // Crear nuevo array de tarjetas
            };
        }
        return columna; // Devolver la columna sin cambios
    });

    // 4. Reemplazar el array de columnas en el estado y actualizar nextCardId
    nuevoEstado = {
        ...nuevoEstado,
        columnas: columnasActualizadas,
        nextCardId: estado.nextCardId + 1 // Incrementamos solo el ID
    };

    return nuevoEstado;
},

    /**
     * Edita los detalles de una tarjeta existente.
     * @param {Object} estado - Estado actual de la aplicación.
     * @param {number} id - ID de la tarjeta a editar.
     * @param {string} nuevoTitulo - Nuevo título.
     * @param {string} nuevaDescripcion - Nueva descripción.
     * @param {('alta'|'media'|'baja')} nuevaPrioridad - Nueva prioridad.
     * @returns {Object} Nuevo estado con la tarjeta actualizada.
     */
    editarTarjeta(estado, id, nuevoTitulo, nuevaDescripcion, nuevaPrioridad) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Buscar y actualizar la tarjeta en todas las columnas
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const tarjetaEncontrada = columna.tarjetas.find(t => t.id === id);

            if (tarjetaEncontrada) {
                // Actualizar campos y timestamp
                Object.assign(tarjetaEncontrada, {
                    titulo: nuevoTitulo,
                    descripcion: nuevaDescripcion,
                    prioridad: nuevaPrioridad,
                    timestamp: Date.now() // Actualiza el tiempo de edición
                });
                // El contador no cambia al editar, solo los datos internos.
            }
        }

        return nuevoEstado;
    },

    /**
     * Elimina una tarjeta del estado global.
     * @param {Object} estado - Estado actual de la aplicación.
     * @param {number} id - ID de la tarjeta a borrar.
     * @param {string} columnaId - ID de la columna donde se encuentra la tarjeta.
     * @returns {Object} Nuevo estado sin la tarjeta eliminada y con contadores ajustados.
     */
borrarTarjeta(estado, id, columnaId) {
        // Creamos una copia profunda del estado para garantizar la inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        const columnIndex = nuevoEstado.columnas.findIndex(c => c.id === columnaId);

        if (columnIndex !== -1) {
            const originalColumn = nuevoEstado.columnas[columnIndex];
            
            // Filtrar la tarjeta por ID
            const tarjetasFiltradas = originalColumn.tarjetas.filter(t => t.id !== id);
            
            // Crear una nueva columna con las tarjetas filtradas para mantener la inmutabilidad
            const nuevaColumna = {
                ...originalColumn,
                tarjetas: tarjetasFiltradas
            };

            // Reconstruir el array de columnas reemplazando la columna antigua por la nueva
            nuevoEstado.columnas = [
                ...nuevoEstado.columnas.slice(0, columnIndex),
                nuevaColumna,
                ...nuevoEstado.columnas.slice(columnIndex + 1)
            ];
        }

        return nuevoEstado;
    },

    /**
     * Mueve una tarjeta de una columna a otra.
     * @param {Object} estado - Estado actual de la aplicación.
     * @param {number} cardId - ID de la tarjeta a mover.
     * @param {string} origenColumnaId - ID de la columna de origen.
     * @param {string} destinoColumnaId - ID de la columna de destino.
     * @returns {Object} Nuevo estado con la tarjeta movida y contadores actualizados.
     */
moverTarjeta(estado, cardId, origenColumnaId, destinoColumnaId) {
    // Crear una copia profunda del estado para garantizar inmutabilidad
    let nuevoEstado = JSON.parse(JSON.stringify(estado));

    // Encontrar los índices de las columnas en el nuevo estado
    const origenColumnaIndex = nuevoEstado.columnas.findIndex(c => c.id === origenColumnaId);
    const destinoColumnaIndex = nuevoEstado.columnas.findIndex(c => c.id === destinoColumnaId);

    if (origenColumnaIndex === -1 || destinoColumnaIndex === -1) {
        return estado; 
    }

    // Obtener referencias a las columnas en el nuevo estado
    const columnaOrigen = nuevoEstado.columnas[origenColumnaIndex];
    const columnaDestino = nuevoEstado.columnas[destinoColumnaIndex];

    // 1. Encontrar la tarjeta a mover
    const tarjetasOrigenActuales = [...columnaOrigen.tarjetas];
    const tarjetaAMover = tarjetasOrigenActuales.find(t => t.id === cardId);

    if (!tarjetaAMover) {
        return estado; // Tarjeta no encontrada en el origen
    }

    // 2. Actualizar la columna de origen (filtrar y actualizar contador)
    const tarjetasOrigenActualizadas = tarjetasOrigenActuales.filter(t => t.id !== cardId);
    
    // Reemplazar el objeto columna en el nuevo estado para mantener inmutabilidad
    nuevoEstado.columnas[origenColumnaIndex] = {
        ...columnaOrigen, 
        tarjetas: tarjetasOrigenActualizadas,
        counter: tarjetasOrigenActualizadas.length // Se calcula la longitud para evitar NaN
    };

    // 3. Actualizar la columna de destino (añadir tarjeta y actualizar contador)
    const tarjetasDestinoActualizadas = [...columnaDestino.tarjetas, tarjetaAMover];

    // Reemplazar el objeto columna en el nuevo estado
    nuevoEstado.columnas[destinoColumnaIndex] = {
        ...columnaDestino, 
        tarjetas: tarjetasDestinoActualizadas,
        counter: tarjetasDestinoActualizadas.length // Se calcula la longitud para evitar NaN
    };

    return nuevoEstado;
}
};
