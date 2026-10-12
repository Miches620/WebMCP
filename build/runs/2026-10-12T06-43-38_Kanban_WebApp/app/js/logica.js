const App = {
    /**
     * Devuelve una copia profunda del estado inicial.
     * @returns {object} Estado clonado.
     */
    crear: function() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta en la columna especificada.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} contenido - Contenido inicial de la tarjeta.
     * @param {string} columnaId - ID de la columna destino.
     * @returns {object} Nuevo estado con la tarjeta añadida.
     */
    crearTarjeta: function(estado, contenido, columnaId) {
        const newCard = {
            id: `card${estado.nextCardId}`,
            content: contenido,
            labels: [],
            comments: [],
            comment_ids: []
        };

        // Clonar el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Encontrar la columna destino y actualizarla
        const targetColumnIndex = nuevoEstado.columns.findIndex(col => col.id === columnaId);
        if (targetColumnIndex !== -1) {
            nuevoEstado.columns[targetColumnIndex].cards = [
                ...nuevoEstado.columns[targetColumnIndex].cards,
                newCard
            ];
        }

        // Incrementar el ID de la tarjeta y devolver el nuevo estado
        nuevoEstado.nextCardId += 1;
        return nuevoEstado;
    },

    /**
     * Mueve una tarjeta de su columna actual a la nueva columna.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} nuevoColumnaId - ID de la columna destino.
     * @returns {object} Nuevo estado con la tarjeta movida.
     */
    moverTarjeta: function(estado, cardId, nuevoColumnaId) {
        let nuevaColumns = [];
        let cardEncontrada = null;

        // 1. Buscar y extraer la tarjeta de su columna original
        for (const column of estado.columns) {
            const cardsWithoutMovedCard = column.cards.filter(card => card.id !== cardId);
            if (column.id === nuevoColumnaId) {
                // Si ya está en el destino, no hacer nada y solo clonar
                nuevaColumns.push({ ...column, cards: [...cardsWithoutMovedCard] });
            } else if (cardEncontrada === null && column.cards.some(card => card.id === cardId)) {
                // Esta es la columna de origen
                nuevaColumns.push({ ...column, cards: [...cardsWithoutMovedCard] });
                cardEncontrada = true; // Marcar que se encontró el origen
            } else {
                // Otras columnas sin cambios
                nuevaColumns.push(column);
            }
        }

        // 2. Crear la nueva tarjeta en la columna destino (si es diferente de la original)
        let nuevoEstado = JSON.parse(JSON.stringify(estado));
        nuevoEstado.columns = [...estado.columns]; // Clonar el array de columnas

        const targetColumnIndex = nuevoEstado.columns.findIndex(col => col.id === nuevoColumnaId);
        if (targetColumnIndex !== -1) {
            // Crear una copia profunda del estado para modificarlo
            let newState = JSON.parse(JSON.stringify(estado));
            
            // 1. Clonar todas las columnas, pero vaciar la tarjeta de su posición original
            const newColumnsArray = estado.columns.map(col => ({
                ...col,
                cards: col.cards.filter(card => card.id !== cardId)
            }));

            // 2. Añadir la tarjeta al destino
            newColumnsArray[targetColumnIndex].cards.push(estado.columns.find(c => c.cards.some(card => card.id === cardId)).cards.find(card => card.id === cardId));
            
            return { ...estado, columns: newColumnsArray };
        }

        // Si por alguna razón no se encuentra la columna destino (debería pasar)
        return estado; 
    },

    /**
     * Añade un comentario a una tarjeta específica.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} texto - Texto del comentario.
     * @param {string} usuario - Usuario que comenta.
     * @returns {object} Nuevo estado con el comentario añadido.
     */
agregarComentario: function(estado, cardId, texto, usuario) {
        // 1. Deep copy the state to ensure immutability
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        let foundCard = null;
        let targetColumnIndex = -1;
        let targetCardIndex = -1;

        // 2. Find Card Location (Iterate through columns and cards)
        for (let i = 0; i < nuevoEstado.columns.length; i++) {
            const column = nuevoEstado.columns[i];
            const cardIndex = column.cards.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                foundCard = column.cards[cardIndex];
                targetColumnIndex = i;
                targetCardIndex = cardIndex;
                break; // Found it, stop searching
            }
        }

        // If the card is not found, return the original state
        if (!foundCard) {
            return estado;
        }

        // 3. Create Comment
        const newCommentId = `c${estado.nextCommentId}`;
        const newComment = {
            id: newCommentId,
            user: usuario,
            text: texto
        };

        // 4. Update Card (Create a copy of the card and append data)
        const updatedCard = {
            ...foundCard,
            comments: [...foundCard.comments, newComment],
            comment_ids: [...foundCard.comment_ids, newCommentId]
        };

        // 5. Update State immutably (Rebuild the structure)

        // Rebuild the cards array for the target column
        const updatedCards = [
            ...nuevoEstado.columns[targetColumnIndex].cards.slice(0, targetCardIndex),
            updatedCard, // The replacement card
            ...nuevoEstado.columns[targetColumnIndex].cards.slice(targetCardIndex + 1)
        ];

        // Rebuild the columns array for the entire state
        const updatedColumns = [
            ...nuevoEstado.columns.slice(0, targetColumnIndex),
            {
                ...nuevoEstado.columns[targetColumnIndex], // Keep other properties of the column
                cards: updatedCards // Replace only the cards array
            },
            ...nuevoEstado.columns.slice(targetColumnIndex + 1)
        ];

        // Create the final new state object, incrementing the counter
        const nuevoState = {
            ...estado,
            columns: updatedColumns,
            nextCommentId: estado.nextCommentId + 1
        };

        return nuevoState;
    },

    /**
     * Añade o actualiza las etiquetas de una tarjeta.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {Array<string>} etiquetas - Lista de nuevas etiquetas.
     * @returns {object} Nuevo estado con las etiquetas actualizadas.
     */
etiquetarTarjeta: function(estado, cardId, etiquetas) {
    // Creamos una copia profunda del estado para garantizar la inmutabilidad.
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    let foundCard = false;

    // Iteramos sobre las columnas para encontrar la tarjeta.
    for (let i = 0; i < nuevoEstado.columns.length; i++) {
        const column = nuevoEstado.columns[i];
        
        // Buscamos el índice de la tarjeta dentro de esta columna específica.
        const cardIndex = column.cards.findIndex(card => card.id === cardId);

        if (cardIndex !== -1) {
            foundCard = true;
            
            // Creamos la nueva versión de la tarjeta, manteniendo todas las propiedades originales 
            // y sobrescribiendo solo los labels.
            const originalCard = column.cards[cardIndex];
            const updatedCard = { 
                ...originalCard, 
                labels: etiquetas
            };

            // Reconstruimos el array de tarjetas para esta columna (de forma inmutable).
            const newCards = [
                ...column.cards.slice(0, cardIndex), // Tarjetas antes del objetivo
                updatedCard,                          // La tarjeta actualizada
                ...column.cards.slice(cardIndex + 1) // Tarjetas después del objetivo
            ];

            // Actualizamos la columna en el nuevo estado con las tarjetas reconstruidas.
            nuevoEstado.columns[i] = {
                ...column,
                cards: newCards
            };
        }
    }

    // Si no se encontró la tarjeta, devolvemos una copia profunda del estado original 
    // para mantener el contrato de devolver siempre un nuevo estado.
    if (!foundCard) {
        return JSON.parse(JSON.stringify(estado));
    }

    return nuevoEstado;
},

    /**
     * Actualiza el contenido principal de una tarjeta.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} nuevoContenido - Nuevo texto para el contenido.
     * @returns {object} Nuevo estado con el contenido actualizado.
     */
editarTarjeta: function(estado, cardId, nuevoContenido) {
    const updatedColumns = estado.columns.map(column => {
        let cardFoundInColumn = false;
        
        // Mapeamos las tarjetas de la columna actual para encontrar y actualizar la tarjeta deseada
        const newCards = column.cards.map(card => {
            if (card.id === cardId) {
                cardFoundInColumn = true;
                // Creamos una nueva tarjeta con el contenido actualizado, manteniendo todas las demás propiedades
                return { ...card, content: nuevoContenido }; 
            }
            return card;
        });

        // Si la tarjeta fue encontrada y actualizada en esta columna, devolvemos un objeto de columna nuevo.
        if (cardFoundInColumn) {
            return {
                ...column, // Mantenemos el resto de las propiedades de la columna (id, title, etc.)
                cards: newCards // Usamos el array de tarjetas recién mapeado
            };
        }
        
        // Si no se encontró la tarjeta en esta columna, devolvemos la columna original.
        return column; 
    });

    // Creamos el nuevo estado completo, reemplazando solo las columnas con la versión actualizada.
    const nuevoEstado = {
        ...estado, // Copiamos propiedades de nivel superior (nextCardId, etc.)
        columns: updatedColumns
    };

    return nuevoEstado;
},

    /**
     * Elimina completamente una tarjeta y sus comentarios asociados.
     * @param {object} estado - El estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a borrar.
     * @returns {object} Nuevo estado sin la tarjeta eliminada.
     */
borrarTarjeta: function(estado, cardId) {
    // Creamos un nuevo array de columnas filtrando la tarjeta con el ID dado en cada columna.
    const newColumns = estado.columns.map(column => ({
        ...column,
        cards: column.cards.filter(card => card.id !== cardId)
    }));

    // Devolvemos un nuevo objeto de estado que preserva todas las claves del estado original 
    // (como nextCardId y nextCommentId) y reemplaza el array de columnas con la versión filtrada.
    return {
        ...estado,
        columns: newColumns
    };
}
};
