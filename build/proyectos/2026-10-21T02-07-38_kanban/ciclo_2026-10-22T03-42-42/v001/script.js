// ==================================================
// VARIABLES GLOBALES Y CONSTANTES
// ==================================================
const COLUMNS = ['pendiente', 'en-curso', 'completa'];
let cardsData = {}; // { id: { title, description, priority, column, timestamp } }

// R16: Definición de orden y colores de prioridad
const PRIORITY_ORDER = {
    'alta': 3,
    'media': 2,
    'baja': 1
};

/**
 * Inicializa el estado del tablero cargando datos o inicializando la estructura.
 */
function initializeBoard() {
    const storedData = localStorage.getItem('kanbanCards');
    if (storedData) {
        cardsData = JSON.parse(storedData);
    } else {
        // Inicializar con un estado vacío si no hay datos guardados
        cardsData = {};
    }

    COLUMNS.forEach(colId => {
        const container = document.getElementById(`cards-${colId}`);
        if (container) {
            renderCardsToContainer(colId, container);
        }
    });

    updateCounters();
}

// ==================================================
// RENDERIZADO Y MANIPULACIÓN DE CARDS
// ==================================================

/**
 * Crea el HTML de una tarjeta a partir de un objeto de datos.
 * @param {Object} card - Objeto con los datos de la tarjeta.
 * @returns {HTMLElement} El elemento div completo de la tarjeta.
 */
function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.setAttribute('data-id', card.id);
    cardEl.setAttribute('draggable', 'true'); // R6: draggable='true'

    // R6: Drag Handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.setAttribute('draggable', 'true');
    dragHandle.ondragstart = (e) => handleDragStart(e, card.id);

    // Contenedor de contenido para manejar el padding del drag handle
    const bodyEl = document.createElement('div');
    bodyEl.className = 'card-body';

    // R14: Actions container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'card-actions';

    // Botón Eliminar (R7, R17)
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.className = 'action-btn';
    deleteBtn.onclick = () => confirmDelete(card.id);

    // Botón Editar (R5, R17)
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '✏️';
    editBtn.className = 'action-btn';
    editBtn.onclick = () => openModal('edit', card.id);

    actionsContainer.appendChild(deleteBtn);
    actionsContainer.appendChild(editBtn);

    // Contenido de la tarjeta
    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = card.title;

    const descriptionEl = document.createElement('div');
    descriptionEl.className = 'card-description';
    descriptionEl.textContent = card.description || 'Sin descripción.';

    // R3: Etiqueta de prioridad
    const priorityTag = document.createElement('span');
    priorityTag.className = `priority-tag priority-${card.priority}`;
    priorityTag.textContent = card.priority.toUpperCase();

    bodyEl.appendChild(titleEl);
    bodyEl.appendChild(descriptionEl);
    bodyEl.appendChild(priorityTag);

    // Ensamblar la tarjeta
    cardEl.appendChild(dragHandle); // Debe ir primero para el layout
    cardEl.appendChild(actionsContainer);
    cardEl.appendChild(bodyEl);

    return cardEl;
}

/**
 * Renderiza todas las tarjetas de una columna específica, aplicando la lógica de ordenamiento.
 * @param {string} colId - ID de la columna ('pendiente', 'en-curso', etc.).
 * @param {HTMLElement} containerEl - El contenedor DOM donde se insertarán las tarjetas.
 */
function renderCardsToContainer(colId, containerEl) {
    // 1. Filtrar y obtener los datos de las tarjetas para esta columna
    let cards = Object.values(cardsData).filter(card => card.column === colId);

    // 2. R16: Ordenamiento (Prioridad descendente -> Tiempo ascendente)
    cards.sort((a, b) => {
        const priorityA = PRIORITY_ORDER[a.priority] || 0;
        const priorityB = PRIORITY_ORDER[b.priority] || 0;

        // Comparar por prioridad (descendente: alta > media > baja)
        if (priorityA !== priorityB) {
            return priorityB - priorityA; // Si B tiene mayor valor, va primero
        }
        // Si la prioridad es igual, ordenar por tiempo (más reciente arriba = descendente de timestamp)
        return b.timestamp - a.timestamp;
    });

    // 3. Limpiar el contenedor antes de renderizar
    containerEl.innerHTML = '';

    // 4. Renderizar los elementos DOM
    cards.forEach(card => {
        const cardElement = createCardElement(card);
        containerEl.appendChild(cardElement);
    });
}

/**
 * Actualiza el contador de tarjetas en cada columna y guarda la estructura.
 */
function updateCounters() {
    COLUMNS.forEach(colId => {
        const count = Object.values(cardsData).filter(card => card.column === colId).length;
        document.querySelector(`.card-counter[data-column="${colId}"]`).textContent = count;
    });

    // R23: Guardar el estado en LocalStorage
    localStorage.setItem('kanbanCards', JSON.stringify(cardsData));
}


// ==================================================
// MODAL Y CRUD OPERATIONS (Creación/Edición)
// ==================================================

/**
 * Abre o prepara el modal para crear o editar una tarjeta.
 * @param {string} mode - 'create' o 'edit'.
 * @param {string|null} cardId - ID de la tarjeta si estamos editando.
 */
function openModal(mode, cardId = null) {
    const modal = document.getElementById('cardModal');
    const form = document.getElementById('cardForm');
    document.getElementById('modalTitle').textContent = mode === 'create' ? 'Crear Nueva Tarjeta' : 'Editar Tarjeta';

    // Limpiar formulario y estado
    form.reset();
    document.getElementById('cardId').value = '';
    document.getElementById('currentColumn').value = '';

    if (mode === 'edit' && cardId) {
        const card = cardsData[cardId];
        if (!card) return;

        // R5: Llenar campos de edición
        document.getElementById('cardId').value = card.id;
        document.getElementById('currentColumn').value = card.column;
        document.getElementById('title').value = card.title;
        document.getElementById('description').value = card.description;
        document.getElementById('priority').value = card.priority;

        // Mostrar el modal
        modal.style.display = 'block';
    } else if (mode === 'create') {
        // Si es creación, se asume que la columna actual es Pendiente por defecto
        document.getElementById('currentColumn').value = 'pendiente'; 
        modal.style.display = 'block';
    }
}

/**
 * Cierra el modal de edición/creación.
 */
function closeModal() {
    document.getElementById('cardModal').style.display = 'none';
}

// Event Listener para el formulario (Crear o Editar)
document.getElementById('cardForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const mode = document.getElementById('cardId').value ? 'edit' : 'create';
    saveCard(mode);
});

/**
 * Guarda los datos de la tarjeta en el estado global y actualiza la UI.
 * @param {string} mode - 'create' o 'edit'.
 */
function saveCard(mode) {
    const id = document.getElementById('cardId').value || Date.now().toString();
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const priority = document.getElementById('priority').value;
    const column = document.getElementById('currentColumn').value;

    if (mode === 'create') {
        // Crear nueva tarjeta
        cardsData[id] = {
            id: id,
            title: title,
            description: description,
            priority: priority,
            column: column,
            timestamp: Date.now() // R16: Timestamp para ordenamiento
        };
    } else if (mode === 'edit') {
        // Editar tarjeta existente
        const oldCard = cardsData[id];
        if (!oldCard) return;

        cardsData[id] = {
            ...oldCard, // Mantener el ID y la columna original
            title: title,
            description: description,
            priority: priority,
            timestamp: Date.now() // Actualizar timestamp al editar
        };
    }

    // 1. Cerrar modal
    closeModal();

    // 2. Re-renderizar la columna afectada (y todas para asegurar el orden)
    COLUMNS.forEach(colId => {
        const container = document.getElementById(`cards-${colId}`);
        if (container) {
            renderCardsToContainer(colId, container);
        }
    });

    // 3. Actualizar contadores y guardar
    updateCounters();
}


// ==================================================
// ELIMINACIÓN Y DRAG & DROP
// ==================================================

/**
 * Muestra el modal de confirmación antes de eliminar una tarjeta (R7, R26).
 * @param {string} cardId - ID de la tarjeta a borrar.
 */
function confirmDelete(cardId) {
    if (!confirm("¿Está seguro de borrar la tarjeta?")) {
        return; // Cancelar si el usuario presiona 'Cancelar'
    }

    deleteCard(cardId);
}

/**
 * Elimina una tarjeta del estado y de la UI.
 * @param {string} cardId - ID de la tarjeta a borrar.
 */
function deleteCard(cardId) {
    if (!cardsData[cardId]) return;

    const card = cardsData[cardId];
    const colId = card.column;

    // 1. Eliminar del estado global
    delete cardsData[cardId];

    // 2. Re-renderizar la columna afectada (y todas)
    const containerEl = document.getElementById(`cards-${colId}`);
    if (containerEl) {
        renderCardsToContainer(colId, containerEl);
    }

    // 3. Actualizar contadores y guardar
    updateCounters();
}


// --- Drag & Drop Handlers ---

let draggedCardId = null; // Almacena el ID de la tarjeta que se arrastra

/**
 * Maneja el inicio del arrastre (R6).
 */
function handleDragStart(e, cardId) {
    draggedCardId = cardId;
    // Establecer datos para el evento de drop
    e.dataTransfer.setData('text/plain', cardId); 

    // Añadir clase visual al elemento arrastrado (el contenedor .card)
    const draggedElement = document.querySelector(`.card[data-id="${cardId}"]`);
    if (draggedElement) {
        setTimeout(() => {
            draggedElement.classList.add('dragging');
        }, 0);
    }
}

/**
 * Maneja el evento dragover en los contenedores de columna.
 */
function handleDragOver(e) {
    e.preventDefault(); // Necesario para permitir el drop
    // Aquí se podría añadir un feedback visual al contenedor destino si fuera necesario
}

/**
 * Maneja el evento de soltado (drop).
 * @param {Event} e - Evento de drop.
 * @param {string} targetColId - ID de la columna destino.
 */
function handleDrop(e, targetColId) {
    e.preventDefault();

    // 1. Limpiar clase visual del elemento arrastrado
    const draggedElement = document.querySelector(`.card[data-id="${draggedCardId}"]`);
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }

    const sourceCardId = e.dataTransfer.getData('text/plain');
    if (!sourceCardId) return;

    // 2. Actualizar el estado de la tarjeta en cardsData
    const cardToMove = cardsData[sourceCardId];
    if (cardToMove && cardToMove.column !== targetColId) {
        // Solo actualizamos si realmente cambia de columna
        cardToMove.column = targetColId;
        cardToMove.timestamp = Date.now(); // Actualizar timestamp al mover

        // 3. Re-renderizar la UI para reflejar el cambio y mantener el orden (R15)
        COLUMNS.forEach(colId => {
            const container = document.getElementById(`cards-${colId}`);
            if (container) {
                renderCardsToContainer(colId, container);
            }
        });

        // 4. Actualizar contadores y guardar
        updateCounters();
    }
}


// ==================================================
// INICIALIZACIÓN
// ==================================================
document.addEventListener('DOMContentLoaded', initializeBoard);
