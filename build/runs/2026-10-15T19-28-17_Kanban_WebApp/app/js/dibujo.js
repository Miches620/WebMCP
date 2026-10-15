function dibujar(estado) {
    const app = document.getElementById('app');
    if (!app) return;

    // 1. Limpiar el contenedor principal, sin wrapper extra (Corrección estructural)
    app.innerHTML = '';

    /**
     * Helper para renderizar etiquetas (F4.2)
     */
    function renderLabels(cardEl, card) {
        if (!card.etiquetas || card.etiquetas.length === 0) {
            return;
        }
        const labelsContainer = document.createElement('div');
        labelsContainer.className = 'labels-container';

        card.etiquetas.forEach(label => {
            const labelEl = document.createElement('span');
            labelEl.className = 'label';
            labelEl.style.backgroundColor = label.color;
            // Usar textContent para prevenir XSS
            labelEl.textContent = label.nombre; 
            labelsContainer.appendChild(labelEl);
        });

        // Buscar el contenedor de acciones/pie de página y anteponer los labels antes de él
        const cardBody = cardEl.querySelector('.card-body');
        if (cardBody) {
             let targetElement = cardBody.querySelector('.card-actions') || cardBody.querySelector('.card-footer');

             // Si el contenedor existe, insertamos labels justo antes de él
            if (targetElement) {
                cardBody.insertBefore(labelsContainer, targetElement);
            } else {
                 // Caso general si no encontramos un punto específico
                cardBody.appendChild(labelsContainer);
            }
        }
    }


    // 2. Iterar sobre las columnas y añadirlas directamente a #app (Corrección estructural)
    estado.columnas.forEach(col => {
        // Crear el contenedor de la columna
        const columnEl = document.createElement('div');
        columnEl.className = 'column';

        // Header de la Columna
        const header = document.createElement('div');
        header.className = 'column-header';
        // Usar textContent para prevenir XSS
        header.textContent = col.nombre; 
        columnEl.appendChild(header);

        // Contenedor donde irán las tarjetas (área drop)
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'card-list';
        columnEl.appendChild(cardsContainer);


        // Dibujar Tarjetas dentro de la columna (F2.2, F4.6, etc.)
        col.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';

            // Contenido principal de la tarjeta - Usando DOM puro y textContent (Corrección XSS)
            const titleEl = document.createElement('div');
            titleEl.className = 'card-title';
            titleEl.textContent = card.titulo; 

            const descriptionEl = document.createElement('div');
            descriptionEl.className = 'card-description';
            descriptionEl.textContent = card.descripcion;

            // Contenedor de cuerpo donde irá el resto del contenido (etiquetas, comentarios, acciones)
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body'; 

            // Estructura inicial: Título -> Descripción -> Cuerpo/Contenido
            cardEl.appendChild(titleEl);
            cardEl.appendChild(descriptionEl);
            cardEl.appendChild(cardBody);


            // Renderizar Etiquetas (F4.2) - Se pasa el elemento cardEl para que los labels se inserten en su lugar correcto
            renderLabels(cardEl, card);

            // 3. Dibujar el área de comentarios y su contenido (F4.6)
            const commentsContainer = document.createElement('div');
            commentsContainer.className = 'comments-container';
            
            if (card.comentarios && card.comentarios.length > 0) {
                card.comentarios.forEach(comment => {
                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';

                    // Creamos elementos P y usamos textContent para todos los textos (Corrección XSS)
                    const authorP = document.createElement('p');
                    authorP.className = 'comment-author';
                    authorP.textContent = comment.autor; 

                    const contentP = document.createElement('p');
                    contentP.className = 'comment-contenido';
                    contentP.textContent = comment.contenido; // ¡IMPORTANTE! Usar textContent aquí

                    // Cálculo de tiempo (el cálculo sigue siendo el mismo)
                    const timeAgoEl = document.createElement('p');
                    timeAgoEl.className = 'comment-timestamp';
                    timeAgoEl.textContent = `Hace ${Math.floor((Date.now() - comment.timestamp) / (1000 * 60)) / 60} minutos`;

                    commentEl.appendChild(authorP);
                    commentEl.appendChild(contentP);
                    commentEl.appendChild(timeAgoEl);
                    commentsContainer.appendChild(commentEl);
                });
            } else {
                 // Si no hay comentarios, solo el contenedor vacío para mantener la estructura
                const emptyCommentPlaceholder = document.createElement('div');
                emptyCommentPlaceholder.className = 'comment-placeholder';
                emptyCommentPlaceholder.textContent = 'Aún no hay comentarios.';
                commentsContainer.appendChild(emptyCommentPlaceholder);
            }

            // Añadir el contenedor de comentarios al cardBody
            const hr = document.createElement('hr'); 
            cardBody.appendChild(hr);
            cardBody.appendChild(commentsContainer);


            // 4. Agregar Controles de Acciones para la Tarjeta (F3.3, F2.2)
            const controls = controlesDe("cards", card, estado);
            if (controls) {
                // Colocar los controles al final del cuerpo de la tarjeta
                cardBody.appendChild(document.createElement('div')); // Espaciador antes de acciones
                cardBody.appendChild(controls);
            }

            // Añadir la tarjeta al contenedor visible de tarjetas
            cardsContainer.appendChild(cardEl);
        });

        // 5. Agregar Controles de Acciones para Columnas (Crear Tarjeta)
        const columnControls = controlesDe("columnas", col, estado);
        if (columnControls) {
            // Colocar los controles debajo del header y arriba de las tarjetas
             document.querySelector('.column-header')?.parentNode.appendChild(columnControls);
        }

        // Añadir la columna completa directamente al contenedor principal #app (Corrección estructural)
        app.appendChild(columnEl);
    });
}
