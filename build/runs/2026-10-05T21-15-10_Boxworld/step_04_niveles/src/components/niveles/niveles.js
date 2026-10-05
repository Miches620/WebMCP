let gameState = {
    currentLevelIndex: 0,
    score: 0,
    playerPos: null, // {row: r, col: c}
    mapData: [],     // El estado actual del tablero (array de arrays)
    levelData: []    // Datos completos del nivel actual
};

const BOARD_SIZE = 5; // 5x5 grid

/**
 * Estructura de datos para los niveles.
 * Cada nivel contiene el mapa inicial, la posición de inicio y las coordenadas objetivo.
 */
const LEVELS = [
    {
        level: 1,
        map: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        startPos: { row: 2, col: 0 }, // (r, c)
        targetBoxes: [
            { r: 1, c: 1 },
            { r: 2, c: 3 }
        ],
        initialMessage: "¡Nivel 1! Coloca las cajas en su lugar. Recuerda que el objetivo es mover todas las cajas a sus posiciones marcadas.",
    },
    {
        level: 2,
        map: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        startPos: { row: 4, col: 0 },
        targetBoxes: [
            { r: 1, c: 1 },
            { r: 2, c: 3 },
            { r: 4, c: 4 }
        ],
        initialMessage: "¡Nivel 2! Más cajas para mover. ¡Concéntrate en la secuencia!",
    },
    {
        level: 3,
        map: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        startPos: { row: 2, col: 4 },
        targetBoxes: [
            { r: 1, c: 1 },
            { r: 2, c: 3 },
            { r: 4, c: 0 }
        ],
        initialMessage: "¡Nivel 3! ¡Cuidado con los movimientos innecesarios! El contador es clave.",
    },
    {
        level: 4,
        map: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        startPos: { row: 4, col: 2 },
        targetBoxes: [
            { r: 1, c: 1 },
            { r: 2, c: 3 },
            { r: 4, c: 0 },
            { r: 4, c: 4 }
        ],
        initialMessage: "¡Nivel 4! ¡Este es el más difícil hasta ahora! Piensa en la estrategia.",
    },
    {
        level: 5,
        map: [
            [0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0]
        ],
        startPos: { row: 2, col: 2 },
        targetBoxes: [
            { r: 1, c: 1 },
            { r: 2, c: 3 },
            { r: 4, c: 0 },
            { r: 4, c: 4 }
        ],
        initialMessage: "¡Nivel 5! ¡El desafío final! Demuéstrame que eres un maestro de Boxworld.",
    }
];

/**
 * Inicializa el juego o avanza al siguiente nivel.
 */
function initializeGame() {
    gameState.currentLevelIndex = 0;
    gameState.score = 0;
    document.getElementById('btn-next-level').disabled = true;
    document.getElementById('message-area').innerHTML = '';

    loadLevel(LEVELS[gameState.currentLevelIndex]);
}

/**
 * Carga los datos de un nivel específico y renderiza el tablero.
 * @param {object} levelData - Los datos del nivel a cargar.
 */
function loadLevel(levelData) {
    // 1. Resetear estado global
    gameState.playerPos = levelData.startPos;
    gameState.mapData = JSON.parse(JSON.stringify(levelData.map)); // Deep copy
    gameState.levelData = levelData;

    // 2. Actualizar UI de estado
    document.getElementById('level-display').textContent = levelData.level;
    document.getElementById('score-display').textContent = gameState.score;
    document.getElementById('message-area').innerHTML = `<strong>${levelData.initialMessage}</strong>`;

    // 3. Renderizar el tablero
    renderBoard();
}

/**
 * Dibuja el estado actual del juego en el DOM.
 */
function renderBoard() {
    const gridContainer = document.getElementById('board-grid');
    gridContainer.innerHTML = '';
    gridContainer.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const tile = document.createElement('div');
            tile.classList.add('tile', 'empty');
            tile.dataset.row = r;
            tile.dataset.col = c;

            // Determinar el contenido y la clase del tile
            let content = '';
            let className = 'empty';

            if (gameState.mapData[r][c] === 1) { // Box
                className = 'box';
                content = '📦';
            } else if (r === gameState.playerPos.row && c === gameState.playerPos.col) { // Player
                className = 'player';
                content = '👤';
            } else if (gameState.levelData.targetBoxes.some(t => t.r === r && t.c === c)) { // Target spot (visual hint, but not a tile type itself)
                 // No cambia la clase base, pero podemos añadir un borde o texto si fuera necesario.
            }

            tile.classList.add(className);
            tile.textContent = content;
            gridContainer.appendChild(tile);
        }
    }
}


/**
 * Intenta mover al jugador en la dirección dada y actualiza el estado del juego.
 * @param {number} dr - Cambio de fila (-1, 0, 1).
 * @param {number} dc - Cambio de columna (-1, 0, 1).
 */
function handleMove(dr, dc) {
    const newRow = gameState.playerPos.row + dr;
    const newCol = gameState.playerPos.col + dc;

    // 1. Validación de límites (R6)
    if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
        displayMessage("¡No puedes moverte fuera del tablero!", 'error');
        return false;
    }

    // 2. Validación de obstáculos (R6)
    const targetTileType = gameState.mapData[newRow][newCol];
    if (targetTileType === 1) { // Si el destino es una caja, no se puede mover ahí
        displayMessage("¡Hay una caja en ese casillero! Debes encontrar un espacio vacío.", 'error');
        return false;
    }

    // --- Movimiento Válido ---

    // 3. Actualizar estado del mapa (mover la "caja" que estaba en el jugador al destino)
    const oldMap = gameState.mapData[gameState.playerPos.row][gameState.playerPos.col];
    const newMap = gameState.mapData[newRow][newCol];

    // El casillero anterior se vuelve vacío (0)
    gameState.mapData[gameState.playerPos.row][gameState.playerPos.col] = 0;
    // El nuevo casillero toma el estado del jugador (que es un espacio libre, pero lo marcamos como tal para consistencia)
    gameState.mapData[newRow][newCol] = 0;

    // 4. Actualizar posición del jugador
    gameState.playerPos = { row: newRow, col: newCol };

    // 5. Actualizar puntaje y UI (R7)
    gameState.score += 1;
    document.getElementById('score-display').textContent = gameState.score;

    // 6. Redibujar el tablero
    renderBoard();

    // 7. Verificar condición de victoria
    checkWinCondition();
    return true;
}


/**
 * Verifica si todas las cajas han sido colocadas en sus posiciones objetivo.
 */
function checkWinCondition() {
    const targets = gameState.levelData.targetBoxes;
    let solvedCount = 0;

    // Iterar sobre los objetivos definidos para este nivel
    for (const target of targets) {
        const r = target.r;
        const c = target.c;

        // Si el estado del mapa en la posición objetivo es 'box' (1), significa que está ahí.
        if (gameState.mapData[r][c] === 1) {
            solvedCount++;
        }
    }

    if (solvedCount === targets.length) {
        displayMessage(`🎉 ¡Nivel ${gameState.levelData.level} completado! Has movido todas las cajas a su lugar.`, 'success');
        document.getElementById('btn-next-level').disabled = false;
        // Deshabilitar controles de movimiento al ganar
        window.removeEventListener('keydown', handleKeyDown); 
    } else {
        displayMessage(`Aún faltan ${targets.length - solvedCount} cajas por colocar en su lugar. ¡Sigue intentándolo!`, 'info');
    }
}

/**
 * Maneja la entrada del teclado (R4, R5).
 */
function handleKeyDown(event) {
    let moved = false;
    switch (event.key) {
        case 'ArrowUp':
            moved = handleMove(-1, 0);
            break;
        case 'ArrowDown':
            moved = handleMove(1, 0);
            break;
        case 'ArrowLeft':
            moved = handleMove(0, -1);
            break;
        case 'ArrowRight':
            moved = handleMove(0, 1);
            break;
        default:
            return; // Ignorar otras teclas
    }

    if (moved) {
        // Si el movimiento fue exitoso, actualizamos la UI de mensaje y score.
        document.getElementById('message-area').innerHTML = `Movimiento realizado. ${gameState.score} movimientos totales.`;
    } else if (!moved && event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        // Si el movimiento falló, no hacemos nada más que lo que handleMove ya hizo (mostrar mensaje de error).
    }
}

/**
 * Muestra un mensaje temporal en la zona designada.
 * @param {string} message - El texto a mostrar.
 * @param {('info'|'success'|'error')} type - Tipo de mensaje para estilizarlo.
 */
function displayMessage(message, type) {
    const area = document.getElementById('message-area');
    let color = '';
    if (type === 'success') {
        color = 'var(--color-success)';
    } else if (type === 'error') {
        color = 'var(--color-accent)';
    } else {
        color = '#ccc';
    }

    area.innerHTML = `<strong>${message}</strong>`;
    area.style.borderColor = color;
}


// --- Event Listeners y Inicialización ---

document.addEventListener('DOMContentLoaded', () => {
    const btnRestart = document.getElementById('btn-restart');
    const btnNextLevel = document.getElementById('btn-next-level');

    // 1. Manejo de Reinicio (Botón)
    btnRestart.addEventListener('click', () => {
        // Re-cargar el nivel actual para resetear la posición y el score
        loadLevel(gameState.levelData);
        displayMessage("¡Nivel reiniciado! ¡A por ello!", 'info');
    });

    // 2. Manejo de Próximo Nivel (Botón)
    btnNextLevel.addEventListener('click', () => {
        if (gameState.currentLevelIndex < LEVELS.length - 1) {
            gameState.currentLevelIndex++;
            loadLevel(LEVELS[gameState.currentLevelIndex]);
            displayMessage(`¡Preparándonos para el Nivel ${LEVELS[gameState.currentLevelIndex].level}!`, 'success');
        } else {
            displayMessage("🏆 ¡Has completado todos los niveles! ¡Eres un maestro de Boxworld!", 'success');
            btnNextLevel.disabled = true;
        }
    });

    // 3. Manejo de Teclado (R4, R5)
    window.addEventListener('keydown', handleKeyDown);

    // Iniciar el juego al cargar la página
    initializeGame();
});
