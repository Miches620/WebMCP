const App = {
    /**
     * Devuelve una copia profunda del estado inicial.
     * @param {object} estado - El estado actual (se ignora, pero se mantiene la firma).
     * @returns {object} Un nuevo estado profundo.
     */
crear: function() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta en una columna específica.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} columnaId - ID de la columna destino.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} contenido - Contenido principal de la tarjeta.
     * @returns {object} El nuevo estado del tablero.
     */
    crearTarjeta: function(estado, columnaId, titulo, contenido) {
        const nuevaCard = {
            id: 'card_' + Date.now(), // ID único simple
            titulo: titulo,
            contenido: contenido,
            etiquetas: [],
            comentarios: [],
            estado_columna: "Nueva Tarea"
        };

        // Crear una copia profunda del estado para asegurar inmutabilidad
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Encontrar la columna destino y añadir la tarjeta
        const columnaDestino = nuevoEstado.columnas.find(col => col.id === columnaId);
        if (columnaDestino) {
            // Crear una copia de las tarjetas para modificar el array sin afectar el original
            nuevoEstado.columnas = nuevoEstado.columnas.map(col => ({
                ...col,
                tarjetas: [...col.tarjetas]
            }));

            const columnaActualizada = nuevoEstado.columnas.find(col => col.id === columnaId);
            if (columnaActualizada) {
                 columnaActualizada.tarjetas.push(nuevaCard);
            }
        }

        return nuevoEstado;
    },

    /**
     * Mueve una tarjeta de un origen a un destino.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} origenColumnaId - ID de la columna de origen.
     * @param {string} destinoColumnaId - ID de la columna de destino.
     * @returns {object} El nuevo estado del tablero.
     */
moverTarjeta: function(estado, cardId, origenColumnaId, destinoColumnaId) {
    // 1. Crear una copia profunda del estado para garantizar la inmutabilidad
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    let cardToMove = null;

    // 2. Primera pasada: Extraer el objeto de la tarjeta y removerlo de la columna de origen en el nuevo estado.
    nuevoEstado.columnas = nuevoEstado.columnas.map(col => {
        if (col.id === origenColumnaId) {
            // Encontrar el objeto real de la tarjeta antes de filtrar
            const foundCard = col.tarjetas.find(card => card.id === cardId);

            if (!foundCard) return col; // Si no se encuentra, devolver la columna sin cambios

            cardToMove = foundCard;

            // Filtrar la tarjeta del array de tarjetas de origen
            return { ...col, tarjetas: col.tarjetas.filter(card => card.id !== cardId) };
        }
        return col;
    });

    // Si no se pudo extraer la tarjeta (ej. ID incorrecto), devolver el estado original
    if (!cardToMove) return estado;

    // 3. Segunda pasada: Añadir la tarjeta extraída a la columna de destino en el nuevo estado.
    nuevoEstado.columnas = nuevoEstado.columnas.map(col => {
        if (col.id === destinoColumnaId) {
            // Agregar la tarjeta al array de tarjetas del destino
            return {
                ...col,
                tarjetas: [...col.tarjetas, cardToMove] // Usar spread para inmutabilidad
            };
        }
        return col;
    });

    return nuevoEstado;
},

    /**
     * Agrega un comentario a una tarjeta específica.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta destino.
     * @param {string} texto - Texto del nuevo comentario.
     * @returns {object} El nuevo estado del tablero.
     */
    agregarComentario: function(estado, cardId, texto) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Buscar la tarjeta y añadir el comentario
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const cardIndex = columna.tarjetas.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                // Crear una copia de la tarjeta para modificarla
                const tarjetaActualizada = { ...columna.tarjetas[cardIndex] };
                
                // Añadir el comentario con estructura requerida
                const nuevoComentario = { 
                    autor: "Usuario", // Usamos un autor genérico si no se pasa
                    texto: texto,
                    fecha: new Date().toISOString() // Añadimos fecha para mejor simulación
                };

                // Crear una copia de los comentarios y añadir el nuevo
                const nuevosComentarios = [...columna.tarjetas[cardIndex].comentarios, nuevoComentario];
                
                // Actualizar la tarjeta en el estado copiado
                columna.tarjetas[cardIndex] = { 
                    ...columna.tarjetas[cardIndex], 
                    comentarios: nuevosComentarios 
                };

                return nuevoEstado;
            }
        }
        return estado; // Si no se encuentra la tarjeta, devolver el estado original
    },

    /**
     * Agrega una etiqueta (tag) a la tarjeta.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta destino.
     * @param {string} etiquetaTexto - Texto de la nueva etiqueta.
     * @returns {object} El nuevo estado del tablero.
     */
    agregarEtiqueta: function(estado, cardId, etiquetaTexto) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Buscar la tarjeta y añadir la etiqueta si no existe
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const cardIndex = columna.tarjetas.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                const tarjetaActualizada = { ...columna.tarjetas[cardIndex] };
                
                // Verificar duplicados y añadir la etiqueta si es nueva
                if (!tarjetaActualizada.etiquetas.includes(etiquetaTexto)) {
                    const nuevasEtiquetas = [...tarjetaActualizada.etiquetas, etiquetaTexto];

                    // Actualizar el estado copiado
                    columna.tarjetas[cardIndex] = { 
                        ...columna.tarjetas[cardIndex], 
                        etiquetas: nuevasEtiquetas 
                    };
                }
                return nuevoEstado;
            }
        }
        return estado; // Si no se encuentra la tarjeta, devolver el estado original
    },

    /**
     * Edita el título y contenido de una tarjeta.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a editar.
     * @param {string} tituloNuevo - Nuevo título para la tarjeta.
     * @param {string} contenidoNuevo - Nuevo contenido principal de la tarjeta.
     * @returns {object} El nuevo estado del tablero.
     */
    editarTarjeta: function(estado, cardId, tituloNuevo, contenidoNuevo) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Buscar la tarjeta y actualizar sus propiedades
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const cardIndex = columna.tarjetas.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                // Actualizar la tarjeta en el estado copiado
                columna.tarjetas[cardIndex] = { 
                    ...columna.tarjetas[cardIndex], 
                    titulo: tituloNuevo, 
                    contenido: contenidoNuevo 
                };
                return nuevoEstado;
            }
        }
        return estado; // Si no se encuentra la tarjeta, devolver el estado original
    },

    /**
     * Elimina completamente una tarjeta del tablero.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a borrar.
     * @returns {object} El nuevo estado del tablero.
     */
    borrarTarjeta: function(estado, cardId) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Iterar sobre todas las columnas para encontrar y eliminar la tarjeta
        nuevoEstado.columnas = nuevoEstado.columnas.map(col => {
            const tarjetasFiltradas = col.tarjetas.filter(card => card.id !== cardId);
            return { ...col, tarjetas: [...tarjetasFiltradas] };
        });

        // Nota: Si la tarjeta se encuentra y se elimina, el nuevoEstado es devuelto. 
        // Si no se encuentra, devuelve una copia idéntica al estado original (lo cual está bien).
        return nuevoEstado;
    }
};
