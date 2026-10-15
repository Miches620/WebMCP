function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Vaciar el contenedor principal
    appContainer.innerHTML = '';

    /**
     * Crea y añade la estructura de una etiqueta (label).
     * @param {Array<object>} labels - Array de objetos etiqueta.
     * @returns {HTMLElement} Elemento div con clase .labels-container.
     */
    function renderizarEtiquetas(labels) {
        const container = document.createElement('div');
        container.className = 'labels-container';
        if (!labels || labels.length === 0) return container;

        labels.forEach(label => {
            const labelEl = document.createElement('span');
            labelEl.className = 'label';
            // Usamos style.backgroundColor para asegurar que el color se aplique correctamente
            labelEl.style.backgroundColor = label.color; 
            labelEl.textContent = label.nombre; // Usando textContent
            container.appendChild(labelEl);
        });
        return container;
    }

    /**
     * Crea y añade el contenido de la sección de comentarios.
     * @param {Array<object>} comentarios - Array de objetos comentario.
     * @returns {HTMLElement} Elemento div con clase .comments-section.
     */
    function renderizarComentarios(comentarios) {
        const section = document.createElement('div');
        section.className = 'comments-section';
        if (!comentarios || comentarios.length === 0) return section;

        // Ordenar por timestamp (el más antiguo primero)
        const sortedComments = [...comentarios].sort((a, b) => a.timestamp - b.timestamp);

        sortedComments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment';

            // Autor y timestamp
            const authorAuthor = document.createElement('span');
            authorAuthor.className = 'comment-author';
            // Formateo básico de fecha
            const dateString = new Date(comment.timestamp).toLocaleString(); 
            authorAuthor.textContent = `${comment.autor} (${dateString})`;

            const contentP = document.createElement('p');
            // Usamos textContent para evitar XSS y mostrar el contenido literal del estado
            contentP.textContent = comment.contenido; 

            commentEl.appendChild(authorAuthor);
            commentEl.appendChild(document.createTextNode('\n')); // Separador visual simple
            commentEl.appendChild(contentP);
            section.appendChild(commentEl);
        });

        return section;
    }


    /**
     * Crea el componente Card completo.
     * @param {object} card - El objeto tarjeta del estado.
     * @returns {HTMLElement} Elemento div con clase .card.
     */
    function renderizarTarjeta(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';

        // 1. Título y Descripción (Usando textContent para seguridad)
        const titleEl = document.createElement('h3');
        titleEl.className = 'card-title';
        titleEl.textContent = card.título;

        const descriptionEl = document.createElement('p');
        descriptionEl.className = 'card-description';
        // Aseguramos que la descripción sea tratada como texto
        descriptionEl.textContent = card.descripción || ''; 

        // Contenedor de etiquetas y comentarios (separados por HR)
        const labelsContainer = renderizarEtiquetas(card.labels);
        
        let commentsSection = null;
        if (card.comentarios && card.comentarios.length > 0) {
            commentsSection = renderizarComentarios(card.comentarios);
        }

        // Estructura de contenido principal: Título -> Descripción -> HR -> Labels -> HR -> Comments
        cardEl.appendChild(document.createElement('hr')); 
        cardEl.appendChild(labelsContainer);
        if (commentsSection) {
             cardEl.appendChild(document.createElement('hr')); 
            cardEl.appendChild(commentsSection);
        }


        // 2. Controles de acciones
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'ctl-controles';

        // Mover tarjeta (acción "tarjetas")
        const moverControls = controlesDe("mover", null, card);
        if (moverControls) controlsContainer.appendChild(moverControls);

        // Agregar comentario (acción "tarjetas")
        const comentarioControls = controlesDe("comentario", null, card);
        if (comentarioControls) controlsContainer.appendChild(comentarioControls);

        // Editar tarjeta (acción "tarjetas")
        const editarControls = controlesDe("editar", null, card);
        if (editarControls) controlsContainer.appendChild(editarControls);

        // Borrar tarjeta (acción "tarjetas")
        const borrarControls = controlesDe("borrar", null, card);
        if (borrarControls) controlsContainer.appendChild(borrarControls);

        // Agregar etiqueta (acción "tarjetas")
        const etiquetaControls = controlesDe("etiqueta", null, card);
        if (etiquetaControls) controlsContainer.appendChild(etiquetaControls);

        cardEl.appendChild(controlsContainer);

        return cardEl;
    }

    /**
     * Crea y añade el componente Columna completa.
     * @param {object} column - El objeto columna del estado.
     * @returns {HTMLElement} Elemento div con clase .kanban-column.
     */
    function renderizarColumna(column) {
        const colEl = document.createElement('div');
        colEl.className = 'kanban-column';

        // 1. Header y Título de Columna
        const header = document.createElement('div');
        header.className = 'column-header';
        const title = document.createElement('h2');
        title.className = 'column-title';
        title.textContent = column.nombre; // Usando textContent
        header.appendChild(title);

        // Controles para crear tarjeta (acción de columna)
        const createCardControls = controlesDe("crear", null, { columnaId: column.id });
        if (createCardControls) header.appendChild(createCardControls);


        // 2. Lista de Tarjetas
        const cardList = document.createElement('div');
        cardList.className = 'card-list';

        column.tarjetas.forEach(card => {
            const cardEl = renderizarTarjeta(card);
            cardList.appendChild(cardEl);
        });

        colEl.appendChild(header);
        colEl.appendChild(cardList);

        return colEl;
    }


    // 3. Iterar sobre todas las columnas y dibujar el tablero
    estado.columnas.forEach(col => {
        const colEl = renderizarColumna(col);
        // ERROR CORREGIDO: Se añade directamente a appContainer, no se usa un wrapper 'kanban-board' extra.
        appContainer.appendChild(colEl); 
    });
}
