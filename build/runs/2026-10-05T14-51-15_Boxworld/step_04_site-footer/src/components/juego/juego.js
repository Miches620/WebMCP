// --- ESTADO GLOBAL DEL JUEGO SIMULADO ---
let gameState = {
    level: 1,
    mapWidth: 8, // Columnas
    mapHeight: 6, // Filas
    playerPos: { x: 0, y: 0 },
    boxes: [], // Array de coordenadas {x, y} que deben contener una caja
    isGameOver: false
};

// Nivel inicial simulado (Coordenadas donde DEBEN estar las cajas)
const initialLevelData = [
    { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
    { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 },
    { x: 4, y: 2 }, { x: 5, y: 2 }
];

// --- UTILIDADES DE JUEGO ---

/**
 * Genera el HTML para una celda del mapa.
 * @param {number} x - Coordenada X.
 * @param {number} y - Coordenada Y.
 * @param {string} type - 'empty', 'box', 'avatar'.
 * @returns {HTMLElement} El elemento div de la celda.
 */
function createCellElement(x, y, type) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.x = x;
    cell.dataset.y = y;

    if (type === 'box') {
        const boxDiv = document.createElement('div');
        boxDiv.className = 'box';
        boxDiv.textContent = '📦'; // Emoji para caja
        cell.appendChild(boxDiv);
    } else if (type === 'avatar') {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'avatar';
        avatarDiv.innerHTML = '👤'; // Emoji para avatar
        cell.appendChild(avatarDiv);
    }
    return cell;
}

/**
 * Renderiza el estado actual del juego en el DOM.
 */
function renderBoard() {
    const mapGrid = document.getElementById('map-grid');
    if (!mapGrid) return;

    // Limpiar tablero antes de redibujar
    mapGrid.innerHTML = '';
    
    // Configurar CSS Grid usando la variable JS para el número de columnas
    mapGrid.style.gridTemplateColumns = `repeat(${gameState.mapWidth}, 1fr)`;
    mapGrid.style.setProperty('--map-width', gameState.mapWidth);

    for (let y = 0; y < gameState.mapHeight; y++) {
        for (let x = 0; x < gameState.mapWidth; x++) {
            let type = 'empty';
            let element = createCellElement(x, y, 'empty');

            // Verificar si hay un objeto en esta coordenada
            const isBoxLocation = initialLevelData.some(coord => coord.x === x && coord.y === y);
            
            if (gameState.playerPos.x === x && gameState.playerPos.y === y) {
                type = 'avatar';
                element = createCellElement(x, y, 'avatar');
            } else if (isBoxLocation) {
                // Si es una ubicación de caja requerida, la renderizamos como box
                type = 'box';
                element = createCellElement(x, y, 'box');
            }

            mapGrid.appendChild(element);
        }
    }
}

/**
 * Actualiza el estado visual del juego después de un movimiento exitoso.
 */
function updateGameVisuals() {
    // Re-renderizar todo para asegurar que la posición del avatar y las cajas estén correctas.
    renderBoard();
}

/**
 * Verifica si el jugador ha logrado colocar todas las cajas.
 * @returns {boolean} True si se ganó.
 */
function checkWinCondition() {
    const currentBoxes = [];
    // Recorrer todo el DOM para encontrar elementos .box que no estén en su posición inicial (simulación)
    document.querySelectorAll('.cell').forEach(cell => {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);

        if (cell.querySelector('.box')) {
            // En esta simulación, simplemente contamos cuántas cajas están renderizadas en el mapa.
            currentBoxes.push({ x: x, y: y });
        }
    });

    // Si el número de cajas visibles coincide con las requeridas, se gana.
    return currentBoxes.length >= initialLevelData.length;
}


/**
 * Intenta mover al avatar en la dirección dada (dx, dy).
 * @param {number} dx - Cambio en X (-1, 0, 1).
 * @param {number} dy - Cambio en Y (-1, 0, 1).
 */
function handleMove(dx, dy) {
    if (gameState.isGameOver) return;

    const newX = gameState.playerPos.x + dx;
    const newY = gameState.playerPos.y + dy;

    // 1. Validación de límites del mapa
    if (newX < 0 || newX >= gameState.mapWidth || newY < 0 || newY >= gameState.mapHeight) {
        displayStatus("¡No puedes moverte fuera del tablero!", 'error');
        return;
    }

    // 2. Validación de colisión con cajas (solo se puede moverse a un espacio vacío o sobre otra caja si es el objetivo)
    const targetCell = document.querySelector(`.cell[data-x="${newX}"][data-y="${newY}"]`);
    if (!targetCell) {
        displayStatus("¡Error de colisión!", 'error');
        return;
    }

    // Si la celda destino tiene un box, y no es el objetivo (simulación simple: siempre se puede mover si está dentro del límite)
    if (targetCell.querySelector('.box')) {
        displayStatus("¡Hay una caja ahí! Debes empujarla o encontrar un camino libre.", 'warning');
        return; 
    }

    // Movimiento exitoso: Actualizar estado y UI
    gameState.playerPos = { x: newX, y: newY };
    updateGameVisuals();
    displayStatus("Movimiento realizado. ¡Sigue acomodando!", 'info');

    if (checkWinCondition()) {
        handleVictory();
    } 
}

/**
 * Maneja la victoria del juego.
 */
function handleVictory() {
    gameState.isGameOver = true;
    displayStatus("🎉 ¡Felicidades! Has acomodado todas las cajas en su lugar.", 'success');
    // Deshabilitar controles de movimiento
    document.querySelectorAll('.move-btn').forEach(btn => btn.disabled = true);
}

/**
 * Reinicia el estado del juego al nivel actual.
 */
function restartLevel() {
    gameState.isGameOver = false;
    // Resetear posición a la inicial (0, 0) o una posición segura predefinida
    gameState.playerPos = { x: 0, y: 0 }; 
    updateGameVisuals();
    displayStatus(`Nivel ${gameState.level} reiniciado. ¡A por ello!`, 'info');
}

/**
 * Simula la carga del siguiente nivel.
 */
function nextLevel() {
    if (gameState.isGameOver) {
        // Si se ganó, avanzamos de nivel
        gameState.level++;
        displayStatus(`Cargando Nivel ${gameState.level}...`, 'info');
        
        // Simular la carga de datos y resetear el juego
        setTimeout(() => {
            // Aquí iría la lógica para cargar initialLevelData del nuevo nivel
            initialLevelData.length = 0; // Limpiar niveles anteriores
            
            // Simulamos un nuevo set de cajas más complejo, manteniendo los límites del mapa
            const newBoxesCount = Math.min(20, gameState.mapWidth * gameState.mapHeight / 3);
            for (let i = 0; i < newBoxesCount; i++) {
                const x = Math.floor(Math.random() * gameState.mapWidth);
                const y = Math.floor(Math.random() * gameState.mapHeight);
                // Evitar duplicados en la simulación de cajas
                if (!initialLevelData.some(coord => coord.x === x && coord.y === y)) {
                    initialLevelData.push({ x: x, y: y });
                }
            }

            gameState.isGameOver = false;
            restartLevel(); // Iniciar el nuevo nivel
        }, 500); // Pequeña latencia simulada
    } else {
        displayStatus("Debes completar el nivel actual antes de avanzar.", 'warning');
    }
}


/**
 * Muestra mensajes en la barra de estado.
 * @param {string} message - El mensaje a mostrar.
 * @param {'info'|'success'|'error'|'warning'} type - Tipo de mensaje para estilizarlo.
 */
function displayStatus(message, type) {
    const statusDiv = document.getElementById('game-status');
    let color = 'var(--color-text)';

    if (type === 'success') color = '#4CAF50';
    else if (type === 'error') color = '#F44336';
    else if (type === 'warning') color = '#FF9800';
    else if (type === 'info') color = 'var(--color-secondary)';

    statusDiv.innerHTML = `<strong>${message}</strong>`;
    statusDiv.style.color = color;
}


/**
 * Inicializa el juego al cargar la página (R3).
 */
function initializeGame() {
    // 1. Configurar dimensiones del mapa
    gameState.mapWidth = 8;
    gameState.mapHeight = 6;

    // 2. Asignar listeners a los botones de movimiento
    document.getElementById('btn-move-up').addEventListener('click', () => handleMove(0, -1));
    document.getElementById('btn-move-down').addEventListener('click', () => handleMove(0, 1));
    document.getElementById('btn-move-left').addEventListener('click', () => handleMove(-1, 0));
    document.getElementById('btn-move-right').addEventListener('click', () => handleMove(1, 0));

    // 3. Asignar listeners a los botones de acción (R2)
    document.getElementById('btn-restart').addEventListener('click', restartLevel);
    document.getElementById('btn-next-level').addEventListener('click', nextLevel);

    // 4. Iniciar el juego y renderizar la primera vez
    renderBoard();
    displayStatus("¡Bienvenido a Boxworld! Mueve al avatar para acomodar las cajas.", 'info');
}


// Ejecutar la inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initializeGame);
