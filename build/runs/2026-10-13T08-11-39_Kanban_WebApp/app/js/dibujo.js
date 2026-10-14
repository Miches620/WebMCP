function dibujar(estado) {
    const app = document.getElementById('app');
    if (!app) return;

    // 1. Limpiar el contenedor principal
    app.innerHTML = '';

    // 2. Iterar sobre las columnas
    estado.columns.forEach(column => {
        // Crear la columna
        const columnEl = document.createElement('div');
        columnEl.className = 'column';
        columnEl.id = column.id;

        // Título de la columna
        const titleEl = document.createElement('h2');
        titleEl.textContent = column.title;
        columnEl.appendChild(titleEl);

        // Contenedor para las tarjetas dentro de esta columna
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'card-list'; // Asumiendo que existe una clase contenedora para las tarjetas
        columnEl.appendChild(cardsContainer);

        // 3. Iterar sobre las tarjetas de la columna
        column.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.id = card.id;

            // Contenido principal de la tarjeta
            const contentEl = document.createElement('div');
            contentEl.className = 'card-content';
            contentEl.innerHTML = `<h3>${card.content}</h3>`; // Usamos h3 para el contenido por defecto

            // Etiquetas (Labels)
            if (card.labels && card.labels.length > 0) {
                const labelsContainer = document.createElement('div');
                labelsContainer.className = 'labels-container';
                card.labels.forEach(label => {
                    const labelEl = document.createElement('span');
                    labelEl.className = 'label';
                    labelEl.textContent = label;
                    labelsContainer.appendChild(labelEl);
                });
                contentEl.appendChild(labelsContainer);
            }

            // Comentarios
            if (card.comments && card.comments.length > 0) {
                const commentsContainer = document.createElement('div');
                commentsContainer.className = 'comments-container';
                card.comments.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';
                    commentEl.innerHTML = `
                        <p class="comment-user">${comment.user}</p>
                        <p class="comment-text">${comment.text}</p>
                    `;
                    commentsContainer.appendChild(commentEl);
                });
                contentEl.appendChild(commentsContainer);
            }

            // Agregar el contenido a la tarjeta
            cardEl.appendChild(contentEl);

            // 4. Añadir controles de acción (Mover, Comentar, Etiquetar, Editar, Borrar)
            const controls = controlesDe("cards", card, estado);
            if (controls) {
                cardEl.appendChild(controls);
            }

            // Agregar la tarjeta al contenedor de tarjetas de la columna
            cardsContainer.appendChild(cardEl);
        });

        // 5. Añadir el control para agregar nueva tarjeta a la columna
        const addCardControls = controlesDe("columns", column, estado);
        if (addCardControls) {
             columnEl.appendChild(addCardControls);
        }


        // Agregar la columna al contenedor principal de la app
        app.appendChild(columnEl);
    });
}
