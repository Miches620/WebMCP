function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Limpiar el contenedor principal
    appContainer.innerHTML = '';

    // --- Lógica de Ordenamiento de Tarjetas (Prioridad y Fecha) ---
    /**
     * Función auxiliar para obtener la prioridad numérica: Alta=3, Media=2, Baja=1.
     */
    const getPriorityValue = (priority) => {
        switch (priority) {
            case 'alta': return 3;
            case 'media': return 2;
            case 'baja': return 1;
            default: return 0;
        }
    };

    /**
     * Función de comparación para ordenar tarjetas.
     * Ordena por prioridad descendente, y luego por fecha de creación descendente (más reciente primero).
     */
    const cardComparator = (cardA, cardB) => {
        const priorityA = getPriorityValue(cardA.prioridad);
        const priorityB = getPriorityValue(cardB.prioridad);

        // 1. Comparar por prioridad (descendente)
        if (priorityA !== priorityB) {
            return priorityB - priorityA;
        }

        // 2. Si la prioridad es igual, comparar por fecha (descendente: más reciente primero)
        const dateA = cardA.fechaCreacion || 0;
        const dateB = cardB.fechaCreacion || 0;
        return dateB - dateA;
    };

    // --- Dibujar Columnas y Contenido ---
    for (const colId in estado.columns) {
        if (!estado.columns[colId]) continue;

        const columnState = estado.columns[colId];
        const container = document.createElement('div');
        container.className = 'column-container';
        container.dataset.columnId = colId;

        // 1. Header de la Columna (Título y Contador)
        const header = document.createElement('div');
        header.className = 'column-header';
        
        // Usar textContent para seguridad
        const titleElement = document.createElement('h3');
        titleElement.textContent = columnState.title;
        header.appendChild(titleElement);

        const counterElement = document.createElement('p');
        counterElement.textContent = `(${columnState.counter})`;
        header.appendChild(counterElement);
        container.appendChild(header);

        // 2. Botón Agregar Tarjeta (Solo en Pendiente)
        if (colId === 'Pendiente') {
            const addButton = document.createElement('button');
            addButton.className = 'add-card-button';
            addButton.textContent = '➕ Agregar tarjeta';
            container.appendChild(addButton);
        }

        // 3. Lista de Tarjetas (Card List)
        const cardList = document.createElement('div');
        cardList.className = 'card-list';
        cardList.setAttribute('data-column-id', colId);
        container.appendChild(cardList);

        // 4. Filtrar, Ordenar y Dibujar Tarjetas de esta columna
        const cardsInColumn = estado.cards.filter(card => card.columnaId === colId);
        
        // Aplicar el ordenamiento complejo: Prioridad (Alta > Media > Baja) -> Fecha (Descendente)
        cardsInColumn.sort(cardComparator);

        cardsInColumn.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.dataset.cardId = card.id;

            // Contenedor principal de la tarjeta (incluye el drag handle)
            cardElement.innerHTML = `
                <div class="drag-handle" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', event.target.dataset.cardId)" ondragend="">⠿</div>
                <div class="card-body">
                    <div class="priority-label priority-${card.prioridad}">${card.prioridad}</div>
                    <h4 class="card-title">${card.titulo}</h4>
                    <p class="card-description">${card.descripcion}</p>
                </div>
                <div class="card-actions">
                    <!-- Los controles de acción son inyectados por controlesDe -->
                </div>
            `;

            // Inyectar los controles (Editar, Eliminar)
            const actionContainer = cardElement.querySelector('.card-actions');
            actionContainer.appendChild(controlesDe("cards", cardElement, estado));

            cardList.appendChild(cardElement);
        });

        appContainer.appendChild(container);
    }

    // 5. Agregar el control general de "Agregar tarjeta" al final del #app
    const appControl = controlesDe("app", null, estado);
    if (appControl) {
        appContainer.appendChild(appControl);
    }
}
