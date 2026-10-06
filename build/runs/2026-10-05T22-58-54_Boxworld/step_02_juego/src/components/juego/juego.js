/**
 * Boxworld Game Logic
 * Manages state, rendering, and game interactions (movement/collision).
 */

// --- GAME DATA DEFINITION (R3) ---
const NIVELES_DATA = [
    { // Nivel 1
        playerStart: { x: 0, y: 9 },
        boxesInitial: [{ x: 2, y: 8 }, { x: 3, y: 8 }],
        objectives: [{ x: 0, y: 7 }, { x: 1, y: 7 }],
        walls: [
            { x: 4, y: 0, w: 2, h: 10 }, // Wall down the middle
            { x: 8, y: 0, w: 1, h: 10 }  // Wall on the right edge
        ]
    },
    { // Nivel 2
        playerStart: { x: 9, y: 0 },
        boxesInitial: [{ x: 7, y: 3 }, { x: 8, y: 4 }],
        objectives: [{ x: 6, y: 5 }, { x: 7, y: 5 }],
        walls: [
            { x: 0, y: 2, w: 10, h: 1 }, // Wall across the top
            { x: 0, y: 8, w: 10, h: 1 }  // Wall near the bottom
        ]
    },
    { // Nivel 3 (More complex)
        playerStart: { x: 0, y: 9 },
        boxesInitial: [{ x: 2, y: 7 }, { x: 4, y: 7 }, { x: 6, y: 7 }],
        objectives: [{ x: 1, y: 8 }, { x: 3, y: 8 }, { x: 5, y: 8 }],
        walls: [
            { x: 0, y: 0, w: 1, h: 10 }, // Left wall
            { x: 9, y: 0, w: 1, h: 10 }  // Right wall
        ]
    },
    { // Nivel 4 (Small map focus)
        playerStart: { x: 1, y: 8 },
        boxesInitial: [{ x: 2, y: 7 }],
        objectives: [{ x: 0, y: 9 }] ,
        walls: [
            { x: 0, y: 0, w: 1, h: 10 },
            { x: 9, y: 0, w: 1, h: 10 }
        ]
    },
    { // Nivel 5 (Final challenge)
        playerStart: { x: 8, y: 2 },
        boxesInitial: [{ x: 6, y: 4 }, { x: 7, y: 3 }],
        objectives: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
        walls: [
            { x: 0, y: 0, w: 1, h: 10 },
            { x: 9, y: 0, w: 1, h: 10 }
        ]
    }
];

// --- GAME STATE (A2) ---
const estado = {
    nivel: 1,
    maxNivel: NIVELES_DATA.length,
    playerPos: null, // {x, y}
    boxes: [],       // [{x, y}, ...]
    moves: 0,        // Contador de movimientos (R7)
    isGameOver: false,
    levelData: null  // Datos del nivel actual
};

const GRID_SIZE = 10; // 10x10 map

/**
 * Inicializa el estado del juego con los datos del nivel.
 * @param {number} nivelNum - El número de nivel a cargar (1-indexed).
 */
function loadLevel(nivelNum) {
    if (nivelNum < 1 || nivelNum > estado.maxNivel) return false;

    const data = NIVELES_DATA[nivelNum - 1];
    estado.levelData = JSON.parse(JSON.stringify(data)); // Deep copy
    
    // Reset state for the new level
    estado.playerPos = { ...data.playerStart };
    estado.boxes = data.boxesInitial.map(b => ({ ...b }));
    estado.moves = 0;
    estado.isGameOver = false;

    console.log(`Nivel ${nivelNum} cargado.`);
    dibujar();
    actualizarHUD();
    document.getElementById('btn-reiniciar').disabled = false;
    document.getElementById('mensaje-estado').classList.add('hidden');
}


/**
 * Determina si una posición (x, y) está dentro de los límites del mapa.
 */
function isInBounds(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

/**
 * Verifica si la celda en (x, y) es una pared.
 * @returns {boolean} True si hay pared.
 */
function isWall(x, y) {
    if (!isInBounds(x, y)) return true; // Fuera de límites = Pared
    
    // Check against defined walls in the current level data
    for (const wall of estado.levelData.walls) {
        // Simple check for a single point collision with rectangular wall segment
        if (x >= Math.min(wall.x, wall.x + wall.w - 1) && x <= Math.max(wall.x, wall.x + wall.w - 1) &&
            y >= Math.min(wall.y, wall.y + wall.h - 1) && y <= Math.max(wall.y, wall.y + wall.h - 1)) {
            return true;
        }
    }
    return false;
}

/**
 * Verifica si la celda en (x, y) está ocupada por una caja.
 * @returns {{box: object}|null} La caja o null si no hay.
 */
function getBoxAt(x, y) {
    return estado.boxes.find(b => b.x === x && b.y === y);
}

/**
 * Intenta mover al jugador en la dirección (dx, dy). Maneja colisiones con paredes y cajas.
 * @param {number} dx - Cambio en X (-1, 0, 1).
 * @param {number} dy - Cambio en Y (-1, 0, 1).
 * @returns {{success: boolean, message: string}} Resultado de la acción.
 */
function attemptMove(dx, dy) {
    const newX = estado.playerPos.x + dx;
    const newY = estado.playerPos.y + dy;

    // 1. Check boundaries and walls (R2.2)
    if (!isInBounds(newX, newY) || isWall(newX, newY)) {
        return { success: false, message: "¡No puedes pasar por paredes o fuera del mapa!" };
    }

    const boxAtTarget = getBoxAt(newX, newY);

    // 2. Check collision with boxes (R2.3)
    if (boxAtTarget) {
        // Attempt to push the box (R2.4)
        const nextBoxX = newX + dx;
        const nextBoxY = newY + dy;
        
        // The target position for the box is one step further in the direction of movement
        if (!isInBounds(nextBoxX, nextBoxY) || isWall(nextBoxX, nextBoxY)) {
            return { success: false, message: "La caja está bloqueada por una pared o el borde." };
        }

        // Check if the spot *after* the box is empty (i.e., not occupied by another box)
        const boxAtNext = getBoxAt(nextBoxX, nextBoxY);
        if (boxAtNext) {
            return { success: false, message: "No puedes empujar la caja; hay otra bloqueando el camino." };
        }

        // Successful push! Update state.
        const boxIndex = estado.boxes.indexOf(boxAtTarget);
        estado.boxes[boxIndex].x = nextBoxX;
        estado.boxes[boxIndex].y = nextBoxY;
        
        // Move player to the original box spot (newX, newY)
        estado.playerPos.x = newX;
        estado.playerPos.y = newY;

        return { success: true, message: "¡Caja empujada! Buen movimiento." };

    } else {
        // 3. Empty space move (R2.1)
        estado.playerPos.x = newX;
        estado.playerPos.y = newY;
        return { success: true, message: "Movimiento exitoso." };
    }
}

/**
 * Verifica si todas las cajas están en sus objetivos (R2.3).
 * @returns {{success: boolean, message: string}} Resultado de la verificación.
 */
function checkWinCondition() {
    const objectives = estado.levelData.objectives;
    let placedCount = 0;

    // Create a set of objective coordinates for quick lookup
    const objectiveSet = new Set(objectives.map(o => `${o.x},${o.y}`));

    for (const box of estado.boxes) {
        if (objectiveSet.has(`${box.x},${box.y}`)) {
            placedCount++;
        }
    }

    if (placedCount === objectives.length) {
        return { success: true, message: "¡Nivel superado! 🏆" };
    } else {
        const remaining = objectives.length - placedCount;
        return { success: false, message: `Faltan ${remaining} cajas en sus objetivos.` };
    }
}

/**
 * Actualiza el contador de movimientos y verifica la condición de victoria.
 */
function handleSuccessfulMove(message) {
    estado.moves++; // R3.5: Incremento del contador
    const winCheck = checkWinCondition();
    
    // Update UI message and state
    mostrarMensajeEstado(message);

    if (winCheck.success) {
        estado.isGameOver = true;
        document.getElementById('mensaje-estado').style.backgroundColor = '#28a745'; // Success color
        document.getElementById('mensaje-estado').innerHTML = `<strong>${winCheck.message}</strong>`;
        deshabilitarControles(true);
    } else {
        actualizarHUD();
        // If not won, keep controls enabled (unless it's the last level)
        if (estado.nivel < estado.maxNivel) {
            document.getElementById('btn-proximo-nivel').disabled = false;
        }
    }
}

/**
 * Actualiza el HUD con los datos de movimiento y nivel.
 */
function actualizarHUD() {
    document.getElementById('contador-movimientos').textContent = estado.moves;
    document.getElementById('nivel-display').textContent = `${estado.nivel}`;
}

/**
 * Renderiza la grilla completa (10x10) desde el estado actual.
 */
function dibujar() {
    const mapaElement = document.getElementById('mapa');
    mapaElement.innerHTML = ''; // Clear previous state

    // 1. Draw the grid structure and static elements
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.setAttribute('data-x', x);
            cell.setAttribute('data-y', y);

            // Check for walls (R1.5)
            if (isWall(x, y)) {
                cell.setAttribute('data-type', 'pared');
            } else if (estado.levelData.objectives.some(o => o.x === x && o.y === y)) {
                // Check for objectives (R1.5)
                cell.setAttribute('data-type', 'objetivo');
            } else {
                cell.removeAttribute('data-type');
            }

            mapaElement.appendChild(cell);
        }
    }

    // 2. Draw dynamic elements (Player and Boxes)
    const playerCell = document.querySelector(`.cell[data-x="${estado.playerPos.x}"][data-y="${estado.playerPos.y}"]`);
    if (playerCell) {
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        playerCell.appendChild(avatar);
    }

    for (const box of estado.boxes) {
        const cell = document.querySelector(`.cell[data-x="${box.x}"][data-y="${box.y}"]`);
        if (cell) {
            const caja = document.createElement('div');
            caja.className = 'caja';
            cell.appendChild(caja);
        }
    }

    // 3. Update HUD and controls visibility
    actualizarHUD();
    document.getElementById('btn-reiniciar').disabled = estado.isGameOver;
}


/**
 * Maneja la lógica de movimiento del jugador (R4, R5).
 */
function handleKeyDown(event) {
    if (estado.isGameOver || estado.levelData === null) return;

    let dx = 0;
    let dy = 0;

    switch (event.key) {
        case 'ArrowUp':
            dy = -1;
            break;
        case 'ArrowDown':
            dy = 1;
            break;
        case 'ArrowLeft':
            dx = -1;
            break;
        case 'ArrowRight':
            dx = 1;
            break;
        default:
            return; // Ignore other keys
    }

    event.preventDefault();
    
    // Attempt move and handle state update if successful
    const result = attemptMove(dx, dy);

    if (result.success) {
        handleSuccessfulMove(result.message);
    } else {
        mostrarMensajeEstado(`❌ ${result.message}`);
    }
}


/**
 * Muestra un mensaje temporal en la interfaz de usuario.
 */
function mostrarMensajeEstado(mensaje) {
    const msgBox = document.getElementById('mensaje-estado');
    msgBox.textContent = mensaje;
    msgBox.classList.remove('hidden');

    // Clear message after 2 seconds, unless it's a win/loss state handled by handleSuccessfulMove
    if (!estado.isGameOver) {
        setTimeout(() => {
            msgBox.classList.add('hidden');
        }, 2000);
    }
}

/**
 * Deshabilita o habilita los controles de juego.
 */
function deshabilitarControles(disabled) {
    document.getElementById('btn-reiniciar').disabled = disabled;
    document.getElementById('btn-proximo-nivel').disabled = disabled || estado.isGameOver;
}

/**
 * Reinicia el nivel actual al estado inicial (R4.4).
 */
function resetLevel() {
    if (!estado.levelData) return;
    // Re-load the level data to ensure a clean state copy
    loadLevel(estado.nivel); 
    mostrarMensajeEstado("Nivel reiniciado. ¡Inténtalo de nuevo!");
}

/**
 * Avanza al siguiente nivel (R4.7).
 */
function nextLevel() {
    if (estado.levelData === null) return;
    const nextLevelNum = estado.nivel + 1;

    if (nextLevelNum <= estado.maxNivel) {
        loadLevel(nextLevelNum);
        mostrarMensajeEstado(`¡Preparándote para el Nivel ${nextLevelNum}...`);
    } else {
        mostrarMensajeEstado("🎉 ¡Has completado todos los niveles! 🎉");
        deshabilitarControles(true);
    }
}


// --- INITIALIZATION AND EVENT LISTENERS (A3) ---

function initGame() {
    // 1. Setup Event Listeners for Controls
    document.getElementById('btn-reiniciar').addEventListener('click', resetLevel);
    document.getElementById('btn-proximo-nivel').addEventListener('click', nextLevel);

    // 2. Setup Keyboard Listener (R4)
    window.addEventListener('keydown', handleKeyDown);

    // 3. Load the first level and draw the initial scene (A3, F1.6)
    loadLevel(estado.nivel);
}

initGame();
