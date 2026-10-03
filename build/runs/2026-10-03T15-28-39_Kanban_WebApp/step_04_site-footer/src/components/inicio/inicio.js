// --- Estado Global Simulado del Tablero ---
let kanbanState = {
    cards: {
        'c001': { id: 'c001', status: 'pendiente', content: 'Diseñar arquitectura API', description: 'Definir endpoints y modelos de datos para el backend.', labels: ['Urgente', 'Backend'], comments: [{ author: 'Sistema', text: 'Tarea inicial creada.' }] },
        'c002': { id: 'c002', status: 'pendiente', content: 'Revisar UX/UI del Dashboard', description: 'Asegurar la coherencia visual en todos los componentes.', labels: ['UX/UI'], comments: [] },
        'c003': { id: 'c003', status: 'en_progreso', content: 'Implementar lógica de drag & drop', description: 'Conectar la funcionalidad de movimiento entre columnas.', labels: ['Frontend'], comments: [{ author: 'Juan P.', text: 'Pendiente de pruebas en el entorno staging.' }] },
        'c004': { id: 'c004', status: 'completado', content: 'Diseño inicial del layout', description: 'Definición de la estructura base y paleta de colores.', labels: ['Design'], comments: [] }
    },
    columns: {
        'pendiente': { title: 'Pendiente', cards: ['c001', 'c002'] },
        'en_progreso': { title: 'En Progreso', cards: ['c003'] },
        'completado': { title: 'Completado', cards: ['c004'] }
    }
};

// --- Elementos DOM ---
const kanbanBoard = root.querySelector('.kanban-board');
const cardListContainers = root.querySelectorAll('.card-list');
const modal = root.querySelector('#card-detail-modal');
const btnAddCard = root.querySelector('#btn-add-card');
const btnAddColumn = root.querySelector('#btn-add-column');

// --- Funciones de Renderizado y Actualización ---

/**
 * Crea el HTML para una etiqueta (label).
 * @param {string} labelText - El texto de la etiqueta.
 * @returns {HTMLElement} Elemento span con clase 'label'.
 */
function createLabelElement(labelText) {
    const label = document.createElement('span');
    label.className = `label label-${labelText.toLowerCase().replace(/[^a-z]/g, '')}`;
    label.textContent = labelText;
    return label;
}

/**
 * Renderiza una tarjeta completa en el DOM.
 * @param {Object} cardData - Datos de la tarjeta del estado global.
 * @param {HTMLElement} targetList - El contenedor donde se debe añadir la tarjeta.
 */
function renderCard(cardData, targetList) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.dataset.id = cardData.id;
    card.dataset.status = cardData.status;

    // Contenido de la tarjeta
    const contentDiv = document.createElement('div');
    contentDiv.className = 'card-content';
    contentDiv.innerHTML = `<h3>${cardData.content}</h3><p>${cardData.description}</p>`;
    
    // Etiquetas en el resumen (solo muestra las primeras 2)
    const labelContainerSummary = document.createElement('div');
    cardData.labels.slice(0, 2).forEach(label => {
        labelContainerSummary.appendChild(createLabelElement(label));
    });

    // Footer y botones de acción
    const footerDiv = document.createElement('div');
    footerDiv.className = 'card-footer';
    
    // Mostrar etiquetas en el resumen (si hay)
    if (labelContainerSummary.children.length > 0) {
        footerDiv.appendChild(document.createRange().createContextualFragment(labelContainerSummary));
    }

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-small btn-secondary edit-btn';
    editBtn.textContent = '✏️ Editar';
    editBtn.dataset.id = cardData.id;
    editBtn.addEventListener('click', () => openCardDetails(cardData.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-danger delete-btn';
    deleteBtn.textContent = '🗑️ Borrar';
    deleteBtn.dataset.id = cardData.id;
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que se dispare el evento de la tarjeta
        if(confirm("¿Estás seguro de que quieres eliminar esta tarea?")) {
            handleDeleteCard(cardData.id);
        }
    });

    footerDiv.appendChild(editBtn);
    footerDiv.appendChild(deleteBtn);

    // Ensamblar la tarjeta
    card.appendChild(contentDiv);
    card.appendChild(labelContainerSummary); // Añadimos las etiquetas aquí también para el resumen visual
    card.appendChild(footerDiv);

    targetList.appendChild(card);
}

/**
 * Refresca todo el tablero, eliminando y volviendo a renderizar todas las tarjetas.
 */
function refreshBoard() {
    // 1. Limpiar todos los contenedores de tarjetas
    document.querySelectorAll('.card-list').forEach(list => list.innerHTML = '');

    // 2. Iterar sobre el estado y re-renderizar
    for (const status in kanbanState.columns) {
        const columnList = document.querySelector(`.kanban-column[data-status="${status}"] .card-list`);
        if (columnList) {
            kanbanState.columns[status].cards.forEach(cardId => {
                const cardData = kanbanState.cards[cardId];
                if (cardData) {
                    renderCard(cardData, columnList);
                }
            });
        }
    }
    // Re-adjuntar listeners de drag and drop después del renderizado completo
    setupDragAndDropListeners();
}

/**
 * Inicializa los listeners de arrastrar y soltar.
 */
function setupDragAndDropListeners() {
    let draggedCard = null;

    document.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => card.style.opacity = '0.5', 0); // Efecto visual de arrastre
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
            draggedCard = null;
        });
    });

    document.querySelectorAll('.card-list').forEach(list => {
        // Drag Over: Permite soltar la tarjeta en esta lista
        list.addEventListener('dragover', (e) => {
            e.preventDefault(); 
            const targetColumn = list.closest('.kanban-column');
            targetColumn.querySelector('.column-header').style.backgroundColor = 'rgba(74, 144, 226, 0.1)'; // Feedback visual
        });

        // Drag Leave: Quita el feedback visual
        list.addEventListener('dragleave', (e) => {
            const targetColumn = list.closest('.kanban-column');
            targetColumn.querySelector('.column-header').style.backgroundColor = 'transparent';
        });

        // Drop: Maneja la caída de la tarjeta
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetList = list;
            const newStatus = targetList.dataset.status;
            const cardId = e.dataTransfer.getData('text/plain');

            // 1. Actualizar el estado global
            if (kanbanState.cards[cardId]) {
                const oldStatus = kanbanState.cards[cardId].status;
                kanbanState.cards[cardId].status = newStatus;
                
                // 2. Mover la tarjeta en el DOM
                const cardElement = document.querySelector(`.kanban-card[data-id="${cardId}"]`);
                if (cardElement) {
                    targetList.appendChild(cardElement);
                }

                // 3. Actualizar los índices de las columnas (simulación simple)
                updateColumnCardLists();
            }
            
            // Resetear el feedback visual
            const targetColumn = list.closest('.kanban-column');
            targetColumn.querySelector('.column-header').style.backgroundColor = 'transparent';
        });
    });
}

/**
 * Actualiza los arrays de IDs en kanbanState.columns después de un movimiento.
 */
function updateColumnCardLists() {
    // Limpiar todos los índices primero
    for (const status in kanbanState.columns) {
        kanbanState.columns[status].cards = [];
    }

    // Recorrer el estado de las tarjetas y reconstruir la lista de IDs por columna
    for (const cardId in kanbanState.cards) {
        const status = kanbanState.cards[cardId].status;
        if (kanbanState.columns[status]) {
            kanbanState.columns[status].cards.push(cardId);
        }
    }
}


// --- Funcionalidades CRUD y Interacción ---

/**
 * Maneja la creación de una nueva tarjeta.
 */
function handleCreateCard() {
    const title = prompt("Ingresa el título de la nueva tarea:");
    if (!title) return;
    const description = prompt("Describe brevemente la tarea:");
    if (description === null) return;

    // Generar ID único simulado
    const newId = 'c' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const defaultStatus = 'pendiente';

    const newCardData = {
        id: newId,
        status: defaultStatus,
        content: title,
        description: description,
        labels: ['Nuevo'],
        comments: [{ author: 'Sistema', text: `Tarea creada por el usuario.` }]
    };

    // 1. Actualizar estado global
    kanbanState.cards[newId] = newCardData;
    if (!kanbanState.columns[defaultStatus].cards.includes(newId)) {
        kanbanState.columns[defaultStatus].cards.push(newId);
    }

    // 2. Renderizar el cambio
    refreshBoard();
    alert(`Tarjeta "${title}" creada con éxito en la columna Pendiente.`);
}

/**
 * Maneja la eliminación de una tarjeta (R6).
 * @param {string} cardId - ID de la tarjeta a eliminar.
 */
function handleDeleteCard(cardId) {
    if (!confirm("¿Estás seguro de que deseas borrar esta tarea? Esta acción es irreversible.")) return;

    // 1. Eliminar del estado global
    delete kanbanState.cards[cardId];

    // 2. Actualizar la lista de IDs en la columna correspondiente
    let statusToDelete = null;
    for (const status in kanbanState.columns) {
        const index = kanbanState.columns[status].cards.indexOf(cardId);
        if (index > -1) {
            kanbanState.columns[status].cards.splice(index, 1);
            statusToDelete = status;
            break;
        }
    }

    // 3. Renderizar el cambio
    refreshBoard();
    alert(`Tarjeta ${cardId} eliminada del tablero.`);
}


// --- Funcionalidades de Detalles (Modal) ---

/**
 * Abre el modal de detalles para una tarjeta específica, cargando su estado actual.
 * @param {string} cardId - ID de la tarjeta a mostrar.
 */
function openCardDetails(cardId) {
    const cardData = kanbanState.cards[cardId];
    if (!cardData) return;

    // 1. Llenar datos básicos del modal
    document.getElementById('modal-card-id').textContent = `(${cardId})`;
    document.getElementById('modal-title').innerHTML = `${cardData.content} <span id="modal-card-id">${cardId}</span>`;
    document.getElementById('modal-description').textContent = cardData.description;
    document.getElementById('edit-content').value = cardData.description;

    // 2. Renderizar etiquetas (R4)
    const labelContainer = document.getElementById('current-labels');
    labelContainer.innerHTML = '';
    cardData.labels.forEach(label => {
        labelContainer.appendChild(createLabelElement(label));
    });

    // 3. Renderizar comentarios (R3)
    renderComments(cardId);

    // 4. Mostrar el modal
    modal.classList.remove('hidden');
}

/**
 * Cierra el modal de detalles.
 */
function closeCardDetails() {
    modal.classList.add('hidden');
}

/**
 * Renderiza la lista de comentarios en el modal.
 * @param {string} cardId - ID de la tarjeta asociada a los comentarios.
 */
function renderComments(cardId) {
    const cardData = kanbanState.cards[cardId];
    const commentsList = document.getElementById('comments-list');
    commentsList.innerHTML = '';

    if (!cardData || !cardData.comments || cardData.comments.length === 0) {
        commentsList.innerHTML = '<p style="color: var(--color-text-secondary);">Aún no hay comentarios en esta tarea.</p>';
        return;
    }

    cardData.comments.forEach(comment => {
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = `<strong>${comment.author}:</strong> ${comment.text}`;
        commentsList.appendChild(item);
    });
}

/**
 * Maneja el envío de un nuevo comentario (R3).
 * @param {Event} e - Evento del formulario.
 */
function handleCommentSubmit(e) {
    e.preventDefault();
    const cardId = document.getElementById('modal-card-id').textContent.trim().replace(/[()]/g, '');
    const commentText = document.getElementById('comment-text').value;

    if (!commentText || !kanbanState.cards[cardId]) return;

    // Simular autor (puede ser mejor usar un usuario logueado)
    const simulatedAuthor = "Usuario Visitante"; 

    // Actualizar estado global
    kanbanState.cards[cardId].comments.push({ author: simulatedAuthor, text: commentText });

    // Re-renderizar comentarios en el modal
    renderComments(cardId);

    // Limpiar formulario y dar feedback
    e.target.reset();
}


/**
 * Maneja la edición de contenido y etiquetas (R5, R4).
 */
function handleSaveCardChanges() {
    const cardId = document.getElementById('modal-card-id').textContent.trim().replace(/[()]/g, '');
    if (!kanbanState.cards[cardId]) return;

    // 1. Actualizar Contenido (R5)
    const newDescription = document.getElementById('edit-content').value;
    kanbanState.cards[cardId].description = newDescription;
    
    // Nota: El contenido principal (título) no se edita aquí, solo la descripción.

    // 2. Actualizar Etiquetas (R4) - Lógica simplificada para el prototipo
    const labelContainer = document.getElementById('current-labels');
    const newLabelsArray = Array.from(labelContainer.querySelectorAll('.label-tag')).map(el => el.textContent);
    kanbanState.cards[cardId].labels = newLabelsArray;

    // 3. Refrescar la vista (tanto en el modal como en el tablero)
    refreshBoard();
    openCardDetails(cardId); // Re-abrir para ver los cambios reflejados
    alert("¡Cambios guardados con éxito!");
}

/**
 * Añade una etiqueta nueva a la tarjeta.
 */
function handleAddLabel() {
    const cardId = document.getElementById('modal-card-id').textContent.trim().replace(/[()]/g, '');
    const inputElement = document.getElementById('new-label-input');
    let newLabelText = inputElement.value.trim();

    if (!newLabelText || !kanbanState.cards[cardId]) return;

    // Verificar si ya existe la etiqueta
    if (kanbanState.cards[cardId].labels.includes(newLabelText)) {
        alert("Esta etiqueta ya está presente.");
        return;
    }

    // 1. Actualizar estado global
    kanbanState.cards[cardId].labels.push(newLabelText);

    // 2. Renderizar la nueva etiqueta en el modal
    const labelContainer = document.getElementById('current-labels');
    const newTag = document.createElement('span');
    newTag.className = 'label-tag';
    newTag.textContent = newLabelText;
    labelContainer.appendChild(newTag);

    // 3. Limpiar input
    inputElement.value = '';
}


// --- Inicialización y Event Listeners ---

function initialize() {
    // 1. Renderizar el tablero al cargar
    refreshBoard();

    // 2. Setup de listeners globales
    btnAddCard.addEventListener('click', handleCreateCard);
    document.getElementById('close-modal-btn').addEventListener('click', closeCardDetails);
    
    // Listeners del formulario de comentarios (R3)
    const commentForm = document.getElementById('comment-form');
    if(commentForm) {
        commentForm.addEventListener('submit', handleCommentSubmit);
    }

    // Listener para guardar cambios en el modal (R5, R4)
    document.getElementById('save-card-btn').addEventListener('click', handleSaveCardChanges);

    // Listener para añadir etiquetas (R4)
    document.getElementById('add-label-btn').addEventListener('click', handleAddLabel);

    // 3. Setup de Drag and Drop listeners (se llama al final porque refreshBoard ya lo hace, pero es buena práctica tenerlo aquí también)
    setupDragAndDropListeners();
}


initialize();
