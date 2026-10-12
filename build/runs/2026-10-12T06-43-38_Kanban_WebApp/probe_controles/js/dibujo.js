function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Limpiar el contenedor principal
    appContainer.innerHTML = '';

    // 2. Crear la estructura del tablero (contenedor de columnas)
    const boardContainer = document.createElement('div');
    boardContainer.className = 'kanban-board';
    
    estado.columns.forEach(column => {
        // 3. Crear y poblar cada columna
        const columnDiv = document.createElement('div');
        columnDiv.className = 'kanban-column';
        columnDiv.dataset.columnaId = column.id;

        // Título de la Columna
        const title = document.createElement('h3');
        title.textContent = column.title;
        columnDiv.appendChild(title);

        // Contenedor de Tarjetas dentro de la columna
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'card-list';
        
        if (column.cards && column.cards.length > 0) {
            column.cards.forEach(card => {
                // 4. Crear y poblar cada tarjeta
                const cardDiv = document.createElement('div');
                cardDiv.className = 'kanban-card';
                cardDiv.dataset.cardId = card.id;

                // Contenido principal de la tarjeta
                const contentP = document.createElement('p');
                contentP.className = 'card-content';
                contentP.textContent = card.content;
                cardDiv.appendChild(contentP);

                // Etiquetas (Labels)
                if (card.labels && card.labels.length > 0) {
                    const labelsContainer = document.createElement('div');
                    labelsContainer.className = 'card-labels';
                    card.labels.forEach(label => {
                        const labelSpan = document.createElement('span');
                        labelSpan.textContent = label;
                        labelSpan.className = 'label badge';
                        labelsContainer.appendChild(labelSpan);
                    });
                    cardDiv.appendChild(labelsContainer);
                }

                // Acciones de la Tarjeta (Editar, etc.)
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'card-actions';
                
                // Botón Editar
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Editar';
                editBtn.dataset.accion = 'editarTarjeta';
                editBtn.dataset.cardId = card.id;
                actionsDiv.appendChild(editBtn);

                // Botón Etiquetar (o un botón de acción general)
                const labelActionBtn = document.createElement('button');
                labelActionBtn.textContent = 'Etiquetas';
                labelActionBtn.dataset.accion = 'etiquetarTarjeta';
                labelActionBtn.dataset.cardId = card.id;
                actionsDiv.appendChild(labelActionBtn);

                // Botón Borrar (Se puede poner aquí o en un menú, lo pondremos visible)
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Borrar';
                deleteBtn.dataset.accion = 'borrarTarjeta';
                deleteBtn.dataset.cardId = card.id;
                actionsDiv.appendChild(deleteBtn);

                cardDiv.appendChild(actionsDiv);


                // Comentarios
                if (card.comments && card.comments.length > 0) {
                    const commentsSection = document.createElement('div');
                    commentsSection.className = 'card-comments';
                    
                    // Mostrar el contador de comentarios y un botón para añadir
                    const commentHeader = document.createElement('h4');
                    commentHeader.textContent = `Comentarios (${card.comments.length})`;
                    commentsSection.appendChild(commentHeader);

                    // Lista de comentarios existentes
                    const commentsList = document.createElement('div');
                    commentsList.className = 'comments-list';
                    
                    card.comments.forEach((comment, index) => {
                        const commentDiv = document.createElement('div');
                        commentDiv.className = 'comment';
                        commentDiv.innerHTML = `<strong>${comment.user}:</strong> ${comment.text}`;
                        commentsList.appendChild(commentDiv);
                    });

                    // Botón para añadir comentario (usa el formulario fijo)
                    const addCommentBtn = document.createElement('button');
                    addCommentBtn.textContent = 'Añadir Comentario';
                    addCommentBtn.dataset.accion = 'setCommentCardId'; // Acción auxiliar para llenar el input hidden
                    addCommentBtn.dataset.cardId = card.id;
                    commentsSection.appendChild(addCommentBtn);

                    commentsSection.appendChild(commentsList);
                    cardDiv.appendChild(commentsSection);
                }


                cardsContainer.appendChild(cardDiv);
            });
        }

        columnDiv.appendChild(cardsContainer);
        boardContainer.appendChild(columnDiv);
    });

    // 5. Insertar el tablero en el contenedor #app
    appContainer.appendChild(boardContainer);
}
