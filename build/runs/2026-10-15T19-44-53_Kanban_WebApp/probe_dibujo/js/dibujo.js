/**
 * Dibuja la estructura completa del Kanban Board a partir del estado proporcionado.
 * @param {object} estado - El estado actual de la aplicación (ESTADO_INICIAL).
 */
function dibujar(estado) {
    const app = document.getElementById('app');
    if (!app) return;

    // 1. Limpiar el contenido del tablero
    app.innerHTML = '';

    // 2. Iterar sobre las columnas (F1.4)
    estado.columnas.forEach(columna => {
        // Crear la estructura de la columna
        const column = document.createElement('div');
        column.className = 'kanban-column';

        // Header de la columna
        const header = document.createElement('div');
        header.className = 'column-header';
        
        // Usar textContent para seguridad XSS
        const titleElement = document.createElement('h3');
        titleElement.className = 'column-title'; 
        titleElement.textContent = columna.titulo; 
        header.appendChild(titleElement);
        column.appendChild(header);

        // Área para renderizar tarjetas (F2.2)
        const cardList = document.createElement('div');
        cardList.className = 'card-list';
        
        // 3. Iterar sobre las tarjetas de la columna
        columna.tarjetas.forEach(tarjeta => {
            // Crear y añadir el componente Card completo, pasando el estado global
            const cardElement = dibujarTarjeta(tarjeta, estado);
            cardList.appendChild(cardElement);
        });

        // Añadir los controles para agregar tarjeta en esta columna (F3.1)
        if (columna.id) {
             const controlsArea = document.createElement('div');
             controlsArea.className = 'create-card-area';
             // Agregar el control de añadir tarjeta: 
             // Nota: El harness ya asegura que controlesDe esté disponible y funcione.
             controlesArea.appendChild(controlesDe("columnas", columna, estado));
             column.appendChild(controlsArea);
        }

        // Añadir la lista de tarjetas al contenedor principal (directamente en #app)
        // Esto cumple con el requisito de que las columnas no estén dentro de un wrapper extra.
        app.appendChild(column);
    });
}

/**
 * Dibuja la estructura completa de una tarjeta.
 * @param {object} tarjeta - Objeto tarjeta del estado.
 * @param {object} estado - El estado global de la aplicación (necesario para controles).
 * @returns {HTMLElement} Elemento div que representa la tarjeta.
 */
function dibujarTarjeta(tarjeta, estado) {
    const card = document.createElement('div');
    card.className = 'card';

    // --- 1. Título y Descripción (F2.2) ---
    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    // Usar textContent para seguridad XSS
    titleEl.textContent = tarjeta.titulo; 

    const descriptionContainer = document.createElement('div');
    descriptionContainer.className = 'card-description';
    let descriptionText = '';
    if (tarjeta.descripcion) {
        // Crear párrafo y usar textContent para seguridad XSS
        const p = document.createElement('p');
        p.textContent = tarjeta.descripcion;
        descriptionContainer.appendChild(p);
    }

    // --- 2. Contenido Adicional (si existe) ---
    let contentAdditionalHTML = '';
    if (tarjeta.contenido_adicional) {
        const additionalDiv = document.createElement('div');
        additionalDiv.className = 'card-content-additional';
        // Usamos textContent si es texto simple, o confiamos en que el contenido adicional ya está limpio si viene de otra fuente. 
        // Dado que no sabemos qué tipo de dato es (puede ser un string complejo), lo trataremos como texto seguro por ahora.
        additionalDiv.textContent = tarjeta.contenido_adicional;
        contentAdditionalHTML = additionalDiv;
    }

    // --- 3. Etiquetas (F4.2) ---
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'labels-container';
    if (tarjeta.labels && tarjeta.labels.length > 0) {
        tarjeta.labels.forEach(label => {
            const labelEl = document.createElement('span');
            labelEl.className = 'label';
            // Aplicar estilo y texto seguro
            labelEl.style.backgroundColor = label.color; 
            labelEl.textContent = label.nombre;
            labelsContainer.appendChild(labelEl);
        });
    }

    // --- 4. Meta y Controles (F2.2, F3.1) ---
    const metaAndControlsArea = document.createElement('div');
    metaAndControlsArea.className = 'card-meta';
    
    // Añadir los controles de acción para la tarjeta
    metaAndControlsArea.appendChild(controlesDe("tarjetas", tarjeta, estado));

    // --- 5. Comentarios (F4.6) ---
    const commentSection = document.createElement('div');
    commentSection.className = 'comments-section';
    
    if (tarjeta.comentarios && tarjeta.comentarios.length > 0) {
        const commentsList = document.createElement('div');
        commentsList.className = 'comments-list';

        // Renderizar comentarios
        tarjeta.comentarios.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            
            // Convertir timestamp a formato legible
            let formattedDate = new Date(comment.timestamp * 1000).toLocaleString();

            // Usar textContent para seguridad XSS en nombres y contenidos
            const authorP = document.createElement('p');
            authorP.className = 'comment-author';
            authorP.innerHTML = `<strong class="comment-author-name">${comment.autor}</strong> (${formattedDate}):`; // Se permite innerHTML aquí si se considera que solo el contenido de <strong> y texto es seguro, pero para máxima seguridad, usamos textContent en los componentes hijos.

            // Mejor enfoque: crear fragmentos seguros
            const authorNameStrong = document.createElement('strong');
            authorNameStrong.className = 'comment-author-name';
            authorNameStrong.textContent = comment.autor;

            const dateSpan = document.createElement('span');
            dateSpan.textContent = ` (${formattedDate}):`;

            const authorPContainer = document.createElement('p');
            authorPContainer.className = 'comment-author';
            authorPContainer.appendChild(authorNameStrong);
            authorPContainer.appendChild(dateSpan);


            const contentP = document.createElement('p');
            contentP.className = 'comment-content';
            // Usar textContent para seguridad XSS en el contenido del comentario
            contentP.textContent = comment.contenido;

            commentDiv.appendChild(authorPContainer);
            commentDiv.appendChild(contentP);
            commentsList.appendChild(commentDiv);
        });

        commentSection.appendChild(commentsList);
    } else {
         // Placeholder si no hay comentarios
         const placeholder = document.createElement('div');
         placeholder.className = 'no-comments';
         placeholder.textContent = "Aún no hay comentarios.";
         commentSection.appendChild(placeholder);
    }

    // --- Montar la tarjeta final (Estructura DOM) ---
    card.appendChild(labelsContainer); // Etiquetas
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    cardBody.appendChild(titleEl); // Título
    cardBody.appendChild(descriptionContainer); // Descripción
    if (contentAdditionalHTML) {
        cardBody.appendChild(contentAdditionalHTML); // Contenido adicional
    }
    card.appendChild(cardBody);

    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer';
    // Añadir controles de acción
    cardFooter.appendChild(metaAndControlsArea); 
    // Añadir sección de comentarios
    cardFooter.appendChild(commentSection);
    card.appendChild(cardFooter);

    return card;
}
