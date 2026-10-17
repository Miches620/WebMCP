// Estado global para almacenar todas las tareas
let kabanBoardState = {
    'pendiente': [],
    'encourso': [],
    'completado': []
};

const STORAGE_KEY = 'kanbanBoardData';

document.addEventListener('DOMContentLoaded', () => {
    loadBoard();
});


// ========================================
// 1. MANEJO DE LOCALSTORAGE Y ALMACENAMIENTO
// ========================================

/** Carga el estado del tablero desde LocalStorage o inicializa un estado vacío. */
function loadBoard() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        kabanBoardState = JSON.parse(storedData);
    } else {
        // Inicialización de datos si no hay nada guardado
        kabanBoardState = {
            'pendiente': [], 
            'encourso': [], 
            'completado': []
        };
    }
    renderAllCards();
}

/** Guarda el estado actual del tablero en LocalStorage. */
function saveBoard() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(kabanBoardState));
}


// ========================================
// 2. RENDERING Y VISUALIZACIÓN (UI)
// ========================================

/** Genera el HTML para una única tarjeta */
function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.setAttribute('draggable', 'true');
    cardEl.dataset.id = card.id;
    cardEl.id = `card-${card.id}`;

    // Eventos de arrastre
    cardEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => cardEl.classList.add('dragging'), 0); // Aplicar clase de dragging
    });

    cardEl.addEventListener('dragend', () => {
        cardEl.classList.remove('dragging');
    });


    // Contenido principal de la tarjeta
    let bodyHTML = `<strong>${card.title}</strong>`;
    bodyHTML += `<p style="font-size:0.9em; margin-top: 5px;">${card.body}</p>`;

    // Botones de acciones (solo se muestran al pasar el mouse)
    const actionsHTML = `
        <div class="card-actions">
            <button class="action-btn edit-btn" onclick="openModal('${card.id}', '${card.status}')">✏️ Editar</button>
            <button class="action-btn delete-btn" onclick="deleteCard('${card.id}', '${card.status}')">🗑️ Eliminar</button>
        </div>`;

    cardEl.innerHTML = bodyHTML + actionsHTML;
    return cardEl;
}

/** Limpia y vuelve a renderizar todas las tarjetas en el DOM */
function renderAllCards() {
    // 1. Limpiar contenedores existentes
    ['pendiente', 'encourso', 'completado'].forEach(status => {
        document.getElementById(`cards-contenedor-${status}`).innerHTML = '';
    });

    // 2. Renderizar tarjetas y actualizar contadores
    for (const status in kabanBoardState) {
        let containerEl = document.getElementById(`cards-contenedor-${status}`);
        let countSpan = document.querySelector(`#${status} .card-count`);

        if (!containerEl || !countSpan) continue;

        // Renderizar cada tarjeta del estado en su contenedor correspondiente
        kabanBoardState[status].forEach(card => {
            const cardElement = createCardElement(card);
            containerEl.appendChild(cardElement);
        });
        
        // Actualizar el contador de la columna
        countSpan.textContent = `(${kabanBoardState[status].length})`;
    }
}

/** Función para actualizar los contadores de todas las columnas después de una acción */
function updateAllCounters() {
    for (const status in kabanBoardState) {
        let countSpan = document.querySelector(`#${status} .card-count`);
        if (countSpan) {
            const count = kabanBoardState[status].length;
            countSpan.textContent = `(${count})`;
        }
    }
}


// ========================================
// 3. FUNCIONALIDAD CRUD Y MODAL
// ========================================

/** Abre el modal de creación o edición */
function openModal(cardId, currentStatus) {
    const modal = document.getElementById('card-modal');
    const form = document.getElementById('card-form');
    
    document.querySelector('.close-btn').setAttribute('aria-hidden', 'false');
    modal.classList.remove('hidden');

    // Resetear el formulario para un nuevo guardado
    form.reset();

    if (cardId) {
        // Modo Edición
        const card = kabanBoardState[currentStatus].find(c => c.id === cardId);
        if (!card) return;

        document.getElementById('title-input').value = card.title;
        document.getElementById('body-input').value = card.body;
        document.getElementById('card-id-input').value = cardId;
        document.getElementById('current-status-input').value = currentStatus; // Mantener el estado actual

        document.querySelector('.modal-content h2').textContent = 'Editar Tarjeta';

    } else {
        // Modo Creación
        document.getElementById('card-id-input').value = ''; // Limpiar ID
        document.getElementById('current-status-input').value = currentStatus;
        document.getElementById('title-input').focus();
        document.querySelector('.modal-content h2').textContent = 'Crear Nueva Tarjeta';
    }
}

/** Cierra el modal */
function closeModal() {
    document.getElementById('card-modal').classList.add('hidden');
     // Resetear foco y aria-state si fuera necesario
     document.querySelector('.close-btn').setAttribute('aria-hidden', 'true');
}


/** Maneja el envío del formulario (Creación o Edición) */
document.getElementById('card-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const title = document.getElementById('title-input').value.trim();
    const body = document.getElementById('body-input').value.trim();
    let cardId = document.getElementById('card-id-input').value;
    const status = document.getElementById('current-status-input').value;

    // Constraint check: No permitir tarjetas vacías
    if (!title || !body) {
        alert("Por favor, rellena el título y la descripción de la tarjeta.");
        return;
    }
    
    let cardData = { 
        id: cardId || Date.now().toString(), // Usar ID existente o generar uno nuevo
        title: title, 
        body: body, 
        status: status 
    };

    if (cardId) {
        // EDICIÓN: Actualizar la tarjeta en el estado y re-renderizar
        const index = kabanBoardState[status].findIndex(c => c.id === cardId);
        if (index !== -1) {
            kabanBoardState[status][index] = cardData;
        }
    } else {
        // CREACIÓN: Añadir la tarjeta al estado
        kabanBoardState[status].push(cardData);
    }

    saveBoard();
    renderAllCards(); // Re-renderiza todo para reflejar los cambios
    closeModal();
});


/** Elimina una tarjeta específica */
function deleteCard(cardId, currentStatus) {
    // Constraint check: No permitir eliminar tarjetas de 'Completado'
    if (currentStatus === 'completado') {
        alert("⚠️ Restricción: No puedes eliminar tareas que están marcadas como 'Completadas'.");
        return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar esta tarjeta? Esta acción no se puede deshacer.")) {
        const initialLength = kabanBoardState[currentStatus].length;
        
        // Filtrar la tarjeta por ID y actualizar el estado
        kabanBoardState[currentStatus] = kabanBoardState[currentStatus].filter(card => card.id !== cardId);

        if (kabanBoardState[currentStatus].length < initialLength) {
            saveBoard();
            renderAllCards(); // Re-renderizar todo el tablero
            alert("Tarjeta eliminada con éxito.");
        }
    }
}


// ========================================
// 4. DRAG AND DROP LOGIC (Mover Tarjetas)
// ========================================

/** Permite que un área de drop sea objetivo del arrastre */
function allowDrop(event) {
    event.preventDefault();
    // Esto es crucial para que el evento 'drop' funcione
}


/** Maneja la lógica cuando una tarjeta es soltada en una columna (destino) */
function handleDrop(event, targetStatus) {
    event.preventDefault();
    const cardId = event.dataTransfer.getData('text/plain'); // Obtener ID de la tarjeta arrastrada

    if (!cardId) return; 

    // Encontrar el índice y la tarjeta que se está moviendo (estado ORÍGINO)
    let sourceStatus = null;
    let cardIndex = -1;
    let cardToMove = null;

    for (const status in kabanBoardState) {
        if (kabanBoardState[status].some(c => c.id === cardId)) {
            sourceStatus = status;
            cardIndex = kabanBoardState[status].findIndex(c => c.id === cardId);
            cardToMove = JSON.parse(JSON.stringify(kabanBoardState[status][cardIndex])); // Clonar objeto
            break;
        }
    }

    if (!sourceStatus) {
        console.error("Tarjeta no encontrada en el estado.");
        return;
    }
    
    // 1. Validaciones de restricción (No mover a 'Completado' si era eliminada, aunque aquí es solo por buenas prácticas)
    // La lógica principal de movimiento está OK porque estamos moviendo una tarjeta existente.

    // Si el origen y el destino son los mismos, no hacer nada
    if (sourceStatus === targetStatus) return;


    // 2. Actualizar el estado (kabanBoardState)
    
    // A. Eliminar la tarjeta del estado de Origen
    kabanBoardState[sourceStatus].splice(cardIndex, 1);

    // B. Modificar la tarjeta movida con el nuevo estado y añadirla al destino
    cardToMove.status = targetStatus;
    kabanBoardState[targetStatus] = kabanBoardState[targetStatus]; // Asegurar que exista (por si acaso)
    kabanBoardState[targetStatus].push(cardToMove);

    // 3. Persistencia y Renderización
    saveBoard();
    renderAllCards();
}


/** Función global para permitir el llamado desde HTML */
window.allowDrop = allowDrop;
window.handleDrop = handleDrop;
window.openModal = openModal;
window.closeModal = closeModal;

