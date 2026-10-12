const App = {
    /**
     * Crea una copia profunda del estado inicial.
     * @returns {Object} Estado clonado.
     */
    crear: function() {
        // Asume que ESTADO_INICIAL está disponible globalmente (desde js/datos.js)
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta en la columna especificada.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} columnId - ID de la columna destino.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} contenido - Contenido inicial de la tarjeta.
     * @returns {Object} Nuevo estado con la tarjeta añadida.
     */
    crearTarjeta: function(estado, columnId, titulo, contenido) {
        const newCard = {
            id: 'card_' + Date.now(), // ID simple único para el ejemplo
            titulo: titulo,
            contenido: contenido,
            labels: [],
            comments: []
        };

        // Clonar estado y encontrar la columna destino
        const newState = JSON.parse(JSON.stringify(estado));
        const targetColumnIndex = newState.columns.findIndex(col => col.id === columnId);

        if (targetColumnIndex !== -1) {
            // Crear una copia de la columna objetivo, añadiendo el nuevo card
            newState.columns[targetColumnIndex] = {
                ...newState.columns[targetColumnIndex],
                cards: [...newState.columns[targetColumnIndex].cards, newCard]
            };
        }

        return newState;
    },

    /**
     * Mueve una tarjeta de su columna actual a la columna destino.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} sourceColumnId - ID de la columna origen.
     * @param {string} targetColumnId - ID de la columna destino.
     * @returns {Object} Nuevo estado con la tarjeta movida.
     */
    moverTarjeta: function(estado, cardId, sourceColumnId, targetColumnId) {
        const newState = JSON.parse(JSON.stringify(estado));

        // 1. Encontrar y remover de la columna origen
        let foundCard = null;
        let sourceColIndex = -1;

        for (let i = 0; i < newState.columns.length; i++) {
            const col = newState.columns[i];
            if (col.id === sourceColumnId) {
                sourceColIndex = i;
                // Filtrar la tarjeta de la columna origen
                const remainingCards = col.cards.filter(card => card.id !== cardId);

                // Crear una copia del estado con la columna modificada
                newState.columns[i] = {
                    ...col,
                    cards: remainingCards
                };
                break;
            }
        }

        if (sourceColIndex === -1) return estado; // No se encontró origen

        // 2. Añadir a la columna destino
        const targetColumnIndex = newState.columns.findIndex(col => col.id === targetColumnId);

        if (targetColumnIndex !== -1) {
            const targetCol = newState.columns[targetColumnIndex];
            // Crear una copia de la columna destino, añadiendo el card movido
            newState.columns[targetColumnIndex] = {
                ...targetCol,
                cards: [...targetCol.cards, { ...foundCard }] // Usamos foundCard que ya fue copiado en el paso 1 si fuera necesario, pero aquí simplemente lo recreamos para seguridad.
            };

             // Re-ejecutando la lógica de añadir al destino con el card original (ya que no guardé 'foundCard' globalmente)
            const cardToMove = estado.columns[sourceColIndex].cards.find(c => c.id === cardId);
            if (cardToMove) {
                newState.columns[targetColumnIndex] = {
                    ...targetCol,
                    cards: [...targetCol.cards, JSON.parse(JSON.stringify(cardToMove))]
                };
            } else {
                 // Si por alguna razón no se encuentra el card original en el estado de entrada, devolvemos el estado sin cambios o con solo la eliminación.
            }

        }

        return newState;
    },

    /**
     * Añade un comentario a una tarjeta específica.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} texto - Texto del nuevo comentario.
     * @returns {Object} Nuevo estado con el comentario añadido.
     */
    agregarComentario: function(estado, cardId, texto) {
        const newState = JSON.parse(JSON.stringify(estado));

        // Buscar la tarjeta y actualizarla en todas las columnas donde pueda estar
        for (let i = 0; i < newState.columns.length; i++) {
            const column = newState.columns[i];
            const cardIndex = column.cards.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                // Clonar la tarjeta y añadir el comentario
                const updatedCard = {
                    ...column.cards[cardIndex],
                    comments: [...column.cards[cardIndex].comments, {
                        usuario: "Usuario", // Placeholder de usuario
                        texto: texto
                    }]
                };

                // Clonar la columna y reemplazar la tarjeta actualizada
                newState.columns[i] = {
                    ...column,
                    cards: [
                        ...column.cards.slice(0, cardIndex),
                        updatedCard,
                        ...column.cards.slice(cardIndex + 1)
                    ]
                };
            }
        }

        return newState;
    },

    /**
     * Asigna una etiqueta existente a la tarjeta.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} labelId - ID de la etiqueta a añadir.
     * @returns {Object} Nuevo estado con la etiqueta añadida.
     */
    agregarEtiqueta: function(estado, cardId, labelId) {
        const newState = JSON.parse(JSON.stringify(estado));

        // Buscar y actualizar la tarjeta en todas las columnas posibles
        for (let i = 0; i < newState.columns.length; i++) {
            const column = newState.columns[i];
            const cardIndex = column.cards.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                const currentCard = column.cards[cardIndex];
                // Evitar duplicados de etiquetas
                if (!currentCard.labels.includes(labelId)) {
                    // Clonar la tarjeta y añadir la etiqueta
                    const updatedCard = {
                        ...currentCard,
                        labels: [...currentCard.labels, labelId]
                    };

                    // Clonar la columna y reemplazar la tarjeta actualizada
                    newState.columns[i] = {
                        ...column,
                        cards: [
                            ...column.cards.slice(0, cardIndex),
                            updatedCard,
                            ...column.cards.slice(cardIndex + 1)
                        ]
                    };
                }
            }
        }

        return newState;
    },

    /**
     * Actualiza el título y contenido de una tarjeta.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} titulo - Nuevo título.
     * @param {string} contenido - Nuevo contenido.
     * @returns {Object} Nuevo estado con los datos de la tarjeta editados.
     */
    editarTarjeta: function(estado, cardId, titulo, contenido) {
        const newState = JSON.parse(JSON.stringify(estado));

        // Buscar y actualizar la tarjeta en todas las columnas posibles
        for (let i = 0; i < newState.columns.length; i++) {
            const column = newState.columns[i];
            const cardIndex = column.cards.findIndex(card => card.id === cardId);

            if (cardIndex !== -1) {
                // Clonar la tarjeta y actualizar sus propiedades
                const updatedCard = {
                    ...column.cards[cardIndex],
                    titulo: titulo,
                    contenido: contenido
                };

                // Clonar la columna y reemplazar la tarjeta actualizada
                newState.columns[i] = {
                    ...column,
                    cards: [
                        ...column.cards.slice(0, cardIndex),
                        updatedCard,
                        ...column.cards.slice(cardIndex + 1)
                    ]
                };
            }
        }

        return newState;
    },

    /**
     * Elimina completamente una tarjeta de la columna.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a borrar.
     * @param {string} columnId - ID de la columna que contiene la tarjeta.
     * @returns {Object} Nuevo estado sin la tarjeta eliminada.
     */
    borrarTarjeta: function(estado, cardId, columnId) {
        const newState = JSON.parse(JSON.stringify(estado));

        // Buscar la columna y filtrar el array de tarjetas
        for (let i = 0; i < newState.columns.length; i++) {
            if (newState.columns[i].id === columnId) {
                // Filtrar la tarjeta por ID
                const remainingCards = newState.columns[i].cards.filter(card => card.id !== cardId);

                // Crear una copia del estado con la columna modificada
                newState.columns[i] = {
                    ...newState.columns[i],
                    cards: remainingCards
                };
                return newState; // Asumimos que el columnId es único
            }
        }

        return estado; // Si no se encuentra la columna, devolver el estado original
    }
};
