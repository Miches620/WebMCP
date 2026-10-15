/**
 * Dibuja la estructura completa del Kanban Board a partir del estado proporcionado.
 * @param {object} estado - El estado actual de la aplicación (ESTADO_INICIAL).
 */
function dibujar(estado) {
    const app = document.getElementById('app');
    if (!app) return;

    // 1. Limpiar el contenido del tablero
    app.innerHTML = '';

    // Contenedor principal del Kanban Board Wrapper (F1.2)
    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'kanban-board'; // Clase asumida para el wrapper principal
    app.appendChild(boardWrapper);

    // 2. Iterar sobre las columnas (F1.4)
    estado.columnas.forEach(columna => {
        // Crear la estructura de la columna
        const column = document.createElement('div');
        column.className = 'kanban-column';

        // Header de la columna
        const header = document.createElement('div');
        header.className = 'column-header';
        header.innerHTML = `<h3 class="column-title">${columna.titulo}</h3>`; // Usando una clase más específica para el título visible
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
             // Aquí se usa el estado global:
             controlsArea.appendChild(controlesDe("columnas", columna, estado));
             column.appendChild(controlsArea);
        }

        // Añadir el contenedor de tarjetas al wrapper del tablero
        boardWrapper.appendChild(cardList);
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

    // 1. Título y Descripción (F2.2)
    let innerHTML = `
        <div class="card-title">${tarjeta.titulo}</div>
        <div class="card-description">
            ${tarjeta.descripcion ? `<p>${tarjeta.descripcion}</p>` : ''}
        </div>
    `;

    // 2. Contenido Adicional (si existe)
    if (tarjeta.contenido_adicional) {
        innerHTML += `
            <div class="card-content-additional">${tarjeta.contenido_adicional}</div>
        `;
    }

    // 3. Etiquetas (F4.2)
    let labelsHTML = '';
    if (tarjeta.labels && tarjeta.labels.length > 0) {
        const labelContainer = document.createElement('div');
        labelContainer.className = 'labels-container';
        tarjeta.labels.forEach(label => {
            const labelEl = document.createElement('span');
            labelEl.className = 'label';
            // Usamos style para aplicar el color específico del estado
            labelEl.style.backgroundColor = label.color; 
            labelEl.textContent = label.nombre;
            labelContainer.appendChild(labelEl);
        });
        labelsHTML = `<div class="labels-container">${labelContainer.outerHTML}</div>`;
    }

    // 4. Meta y Controles (F2.2, F3.1)
    const metaAndControlsArea = document.createElement('div');
    metaAndControlsArea.className = 'card-meta';
    
    // Añadir los controles de acción para la tarjeta, pasando el estado global
    metaAndControlsArea.appendChild(controlesDe("tarjetas", tarjeta, estado));

    // 5. Comentarios (F4.6)
    const commentSection = document.createElement('div');
    commentSection.className = 'comments-section';
    
    if (tarjeta.comentarios && tarjeta.comentarios.length > 0) {
        const commentsList = document.createElement('div');
        commentsList.className = 'comments-list';

        // Renderizar comentarios en orden cronológico inverso (aunque el estado lo mantenga así, es buena práctica asegurar la visualización)
        tarjeta.comentarios.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'comment';
            
            // Convertir timestamp a formato legible
            let formattedDate = new Date(comment.timestamp * 1000).toLocaleString();

            commentDiv.innerHTML = `
                <p class="comment-author"><strong class="comment-author-name">${comment.autor}</strong> (${formattedDate}):</p>
                <p class="comment-content">${comment.contenido}</p>
            `;
            commentsList.appendChild(commentDiv);
        });

        commentSection.appendChild(commentsList);
    } else {
         // Placeholder si no hay comentarios, pero se mantiene la estructura para el control de acción
         const placeholder = document.createElement('div');
         placeholder.className = 'no-comments';
         placeholder.textContent = "Aún no hay comentarios.";
         commentSection.appendChild(placeholder);
    }

    // Montar el contenido principal del card
    card.innerHTML = `
        ${labelsHTML}
        <div class="card-body">
            ${innerHTML}
        </div>
        <div class="card-footer">
             ${metaAndControlsArea.outerHTML}
             ${commentSection.outerHTML}
        </div>
    `;

    return card;
}
