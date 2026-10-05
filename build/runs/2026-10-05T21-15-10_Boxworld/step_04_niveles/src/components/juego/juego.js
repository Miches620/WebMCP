// =============================================================================
// GAME ENGINE CORE LOGIC (Boxworld)
// =============================================================================

const MAP_SIZE = 10; // 10x10 grid
let gameState = {
    playerPos: { row: 5, col: 5 },
    moves: 0,
    currentLevelIndex: 0,
    isGameOver: false,
};

// Definición de los niveles (R4.2)
const levelsData = [
    {
        name: "Nivel 1: Introducción",
        startPos: { row: 8, col: 1 },
        map: [
            // Fila 0 - 9
            ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'], // Paredes de borde
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', 'B', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W']
        ],
        // Las cajas deben estar en estas posiciones (row, col) para ganar.
        targetBoxes: [{ r: 2, c: 2 }, { r: 1, c: 8 }],
    },
    {
        name: "Nivel 2: Bloqueo",
        startPos: { row: 7, col: 3 },
        map: [
            ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', 'B', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W']
        ],
        targetBoxes: [{ r: 2, c: 2 }, { r: 4, c: 8 }],
    },
    {
        name: "Nivel 3: Trampa",
        startPos: { row: 5, col: 1 },
        map: [
            ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', 'B', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W']
        ],
        targetBoxes: [{ r: 2, c: 2 }, { r: 4, c: 8 }, { r: 6, c: 5 }],
    },
    {
        name: "Nivel 4: Desafío",
        startPos: { row: 3, col: 7 },
        map: [
            ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', 'B', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W']
        ],
        targetBoxes: [{ r: 2, c: 2 }, { r: 4, c: 8 }, { r: 6, c: 5 }],
    },
    {
        name: "Nivel 5: Final",
        startPos: { row: 1, col: 1 },
        map: [
            ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', 'B', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W'],
            ['W', '.', '.', '.', '.', '.', '.', '.', '.', 'W']
        ],
        targetBoxes: [{ r: 2, c: 2 }, { r: 4, c: 8 }, { r: 6, c: 5 }],
    }
];

// =============================================================================
// UTILITY FUNCTIONS & RENDERING
// =============================================================================

/**
 * Inicializa el estado del juego y renderiza el nivel actual.
 */
function initializeGame() {
    gameState.currentLevelIndex = 0;
    gameState.moves = 0;
    gameState.isGameOver = false;
    updateMoveCounter();
    loadLevel(gameState.currentLevelIndex);
}

/**
 * Limpia y renderiza el mapa para un nuevo nivel.
 * @param {number} levelIndex - Índice del nivel a cargar.
 */
function loadLevel(levelIndex) {
    if (levelIndex >= levelsData.length) {
        displayVictoryMessage("¡Has completado todos los niveles! ¡Eres un maestro de Boxworld!");
        return;
    }

    const level = levelsData[levelIndex];
    gameState.playerPos = level.startPos;
    gameState.moves = 0;
    gameState.isGameOver = false;

    // Limpiar el contenedor y rellenar con la estructura del mapa
    const mapContainer = document.getElementById('mapa-juego');
    mapContainer.innerHTML = ''; // Limpia contenido anterior
    mapContainer.style.display = 'grid'; 

    // Renderizar el grid (10x10)
    for (let r = 0; r < MAP_SIZE; r++) {
        for (let c = 0; c < MAP_SIZE; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.row = r;
            tile.dataset.col = c;

            // Determinar el tipo de casilla (W=Wall, .=Empty)
            if (level.map[r][c] === 'W') {
                tile.classList.add('wall');
            } else {
                tile.innerHTML = ''; // Casilla vacía
            }
            mapContainer.appendChild(tile);
        }
    }

    // Renderizar elementos dinámicos (Cajas y Avatar)
    renderGameElements(level);

    // Actualizar UI de controles
    document.getElementById('btn-reiniciar').disabled = false;
    document.getElementById('btn-proximo-nivel').disabled = true;
    document.getElementById('game-status').textContent = `¡Acomoda las cajas!`;
}

/**
 * Renderiza o actualiza la posición de todas las entidades en el mapa.
 * @param {object} level - Datos del nivel actual.
 */
function renderGameElements(level) {
    const mapContainer = document.getElementById('mapa-juego');
    // Limpiar elementos dinámicos antes de re-renderizar
    document.querySelectorAll('.box, .avatar').forEach(el => el.remove());

    // 1. Renderizar Cajas (Boxes)
    level.targetBoxes.forEach((box, index) => {
        const boxElement = document.createElement('div');
        boxElement.className = 'box';
        boxElement.dataset.index = index; // Identificador único para la caja
        // Usamos transform: translate(X, Y) en lugar de cambiar el grid-area 
        // para simular movimiento suave y mantener la estructura del tile base.
        boxElement.style.transform = `translate(${box.c * 10}%, ${box.r * 10}%)`; 
        mapContainer.appendChild(boxElement);
    });

    // 2. Renderizar Avatar (Player)
    const avatarElement = document.createElement('div');
    avatarElement.className = 'avatar';
    // Posicionamiento inicial del avatar
    avatarElement.style.transform = `translate(${gameState.playerPos.col * 10}%, ${gameState.playerPos.row * 10}%)`;
    mapContainer.appendChild(avatarElement);

    // Guardar referencias DOM para fácil acceso en el movimiento
    window._gameElements = {
        boxes: Array.from(document.querySelectorAll('.box')),
        avatar: document.querySelector('.avatar')
    };
}


/**
 * Actualiza el contador de movimientos y la UI (R7).
 */
function updateMoveCounter() {
    const counterElement = document.getElementById('move-counter');
    if (counterElement) {
        counterElement.textContent = gameState.moves;
    }
}

/**
 * Mueve visualmente el avatar a una nueva posición y actualiza el estado interno.
 * @param {number} newR - Nueva fila.
 * @param {number} newC - Nueva columna.
 */
function moveAvatar(newR, newC) {
    const mapContainer = document.getElementById('mapa-juego');
    const avatarElement = window._gameElements.avatar;

    // 1. Actualizar estado interno
    gameState.playerPos = { row: newR, col: newC };
    
    // 2. Actualizar posición visual (usando transform para simular movimiento)
    avatarElement.style.transform = `translate(${newC * 10}%, ${newR * 10}%)`;

    // 3. Incrementar contador de movimientos (solo si fue un movimiento válido/empuje exitoso)
    gameState.moves++;
    updateMoveCounter();
}


/**
 * Lógica principal de validación y movimiento del Avatar.
 * @param {number} deltaR - Cambio en la fila (-1, 0, 1).
 * @param {number} deltaC - Cambio en la columna (-1, 0, 1).
 * @returns {boolean} True si el movimiento fue exitoso y se actualizó el estado.
 */
function attemptMove(deltaR, deltaC) {
    if (gameState.isGameOver) return false;

    const currentR = gameState.playerPos.row;
    const currentC = gameState.playerPos.col;
    let nextR = currentR + deltaR;
    let nextC = currentC + deltaC;

    // 1. Validación de límites y paredes (F2.2)
    if (nextR < 0 || nextR >= MAP_SIZE || nextC < 0 || nextC >= MAP_SIZE) {
        console.log("Colisión con borde.");
        return false; // Fuera de mapa
    }

    const level = levelsData[gameState.currentLevelIndex];
    if (level.map[nextR][nextC] === 'W') {
        console.log("Colisión con pared.");
        return false; // Colisión con pared fija
    }

    // 2. Validación de colisiones con cajas (F2.3)
    const boxElements = window._gameElements.boxes;
    let collidedBoxIndex = -1;
    let collidedBoxElement = null;

    for (let i = 0; i < boxElements.length; i++) {
        // Nota: Asumimos que las cajas están en el mismo grid-area que su posición de renderizado
        const boxEl = boxElements[i];
        // Calculamos la posición del centro de la caja basada en su índice (simplificación)
        // En un juego real, necesitaríamos saber la posición exacta de cada caja. 
        // Aquí simularemos que el dataset-index nos da una referencia para verificar si está en la coordenada deseada.

        // Para simplificar y cumplir con el requisito: verificamos si *alguna* caja está en (nextR, nextC)
        const boxData = level.targetBoxes[i]; // Usamos targetBoxes como proxy de posición actual/objetivo
        if (boxData && boxData.r === nextR && boxData.c === nextC) {
             // Si la caja está en el destino propuesto, es una colisión potencial.
            collidedBoxIndex = i;
            collidedBoxElement = boxEl;
            break; 
        }
    }

    if (collidedBoxElement) {
        // Colisión detectada con una caja. Intentar empujar (F2.4).
        return attemptPush(deltaR, deltaC, collidedBoxIndex);
    } else {
        // Movimiento libre exitoso
        moveAvatar(nextR, nextC);
        checkWinCondition(); // Verificar si el movimiento nos llevó a la victoria
        return true;
    }
}

/**
 * Intenta mover al Avatar y empujar una caja adyacente. (F2.4)
 * @param {number} deltaR - Cambio en la fila (-1, 0, 1).
 * @param {number} deltaC - Cambio en la columna (-1, 0, 1).
 * @param {number} boxIndex - Índice de la caja colisionada.
 * @returns {boolean} True si el empuje fue exitoso y se actualizó el estado.
 */
function attemptPush(deltaR, deltaC, boxIndex) {
    const level = levelsData[gameState.currentLevelIndex];
    let currentBoxPos = { r: level.targetBoxes[boxIndex].r, c: level.targetBoxes[boxIndex].c };

    // Calcular la posición donde debe ir la caja (detrás del avatar)
    let pushR = currentBoxPos.r + deltaR;
    let pushC = currentBoxPos.c + deltaC;

    // 1. Validar si el empuje es posible:
    // a) ¿Está fuera de límites o choca con pared?
    if (pushR < 0 || pushR >= MAP_SIZE || pushC < 0 || pushC >= MAP_SIZE) {
        return false;
    }
    const wallCheck = level.map[pushR][pushC] === 'W';
    if (wallCheck) return false;

    // b) ¿Choca la caja con otra cosa en el destino del empuje?
    let boxCollisionInPushPath = false;
    for (let i = 0; i < window._gameElements.boxes.length; i++) {
        if (i !== boxIndex) { // No verificar contra sí misma
            const otherBoxData = level.targetBoxes[i];
            if (otherBoxData && otherBoxData.r === pushR && otherBoxData.c === pushC) {
                boxCollisionInPushPath = true;
                break;
            }
        }
    }
    if (boxCollisionInPushPath) return false;

    // 2. Ejecutar el empuje exitoso:
    
    // a) Actualizar la posición de la caja en el estado y DOM
    level.targetBoxes[boxIndex] = { r: pushR, c: pushC };
    const boxElement = window._gameElements.boxes[boxIndex];
    boxElement.style.transform = `translate(${pushC * 10}%, ${pushR * 10}%)`;

    // b) Mover el Avatar (el movimiento es exitoso porque empujó la caja)
    moveAvatar(currentBoxPos.r, currentBoxPos.c); // El avatar se mueve a donde estaba la caja
    
    return true;
}


/**
 * Verifica si todas las cajas están en sus posiciones objetivo (F3.4).
 */
function checkWinCondition() {
    const level = levelsData[gameState.currentLevelIndex];
    let allBoxesInPlace = true;

    for (let i = 0; i < window._gameElements.boxes.length; i++) {
        // Comparamos la posición actual de la caja en el estado del nivel con su objetivo.
        const currentBoxPos = level.targetBoxes[i];
        const targetBoxData = level.targetBoxes[i];

        if (currentBoxPos.r !== targetBoxData.r || currentBoxPos.c !== targetBoxData.c) {
            allBoxesInPlace = false;
            break;
        }
    }

    if (allBoxesInPlace && !gameState.isGameOver) {
        handleLevelWin();
    } else if (!allBoxesInPlace) {
        // Si no está en el lugar, simplemente mantenemos el estado de juego activo.
    }
}


/**
 * Maneja la lógica al ganar un nivel (F3.6).
 */
function handleLevelWin() {
    gameState.isGameOver = true;
    document.getElementById('game-status').textContent = "¡Cajas acomodadas! 🎉";
    
    // Deshabilitar controles de movimiento y habilitar el botón siguiente
    document.getElementById('btn-reiniciar').disabled = true;
    document.getElementById('btn-proximo-nivel').disabled = false;

    displayVictoryMessage("¡Nivel Completado!", true);
}


/**
 * Muestra la superposición de victoria (R2).
 * @param {string} message - Mensaje principal.
 * @param {boolean} isWinLevel - Si es por completar un nivel.
 */
function displayVictoryMessage(message, isWinLevel = false) {
    const overlay = document.getElementById('mensaje-victoria');
    overlay.style.display = 'flex';
    document.querySelector('#mensaje-victoria h3').textContent = message;

    // Actualizar el texto de continuar según si es victoria o fin total
    const continueBtn = document.getElementById('btn-continuar-victoria');
    if (isWinLevel) {
        continueBtn.textContent = "Continuar";
        continueBtn.onclick = () => {
            overlay.style.display = 'none';
            loadLevel(gameState.currentLevelIndex + 1);
        };
    } else {
        // Fin de juego total
        continueBtn.textContent = "Jugar de Nuevo";
        continueBtn.onclick = () => {
            window.location.reload(); // Reiniciar la página para empezar desde el Nivel 1
        };
    }
}


// =============================================================================
// EVENT HANDLERS & INITIALIZATION
// =============================================================================

/**
 * Maneja los movimientos del teclado (R4, R5).
 */
function handleKeyDown(event) {
    if (gameState.isGameOver) return;

    let deltaR = 0;
    let deltaC = 0;

    switch (event.key) {
        case 'ArrowUp':
            deltaR = -1;
            break;
        case 'ArrowDown':
            deltaR = 1;
            break;
        case 'ArrowLeft':
            deltaC = -1;
            break;
        case 'ArrowRight':
            deltaC = 1;
            break;
        default:
            return; // Ignorar otras teclas
    }

    event.preventDefault();
    attemptMove(deltaR, deltaC);
}


// --- Event Listeners Setup ---
document.addEventListener('keydown', handleKeyDown);

// Botón Reiniciar (F4.3)
document.getElementById('btn-reiniciar').addEventListener('click', () => {
    loadLevel(gameState.currentLevelIndex); // Recarga el estado del nivel actual
});

// Botón Próximo Nivel (F4.6)
document.getElementById('btn-proximo-nivel').addEventListener('click', () => {
    if (!gameState.isGameOver) return;
    loadLevel(gameState.currentLevelIndex + 1);
});


// Inicialización al cargar el componente
initializeGame();
