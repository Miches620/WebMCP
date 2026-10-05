const MAX_LEVELS = 5;

// Estructura de datos para los niveles (Mapa, dimensiones, estado inicial)
const levelsData = [
    {
        level: 1,
        mapWidth: 8,
        mapHeight: 6,
        initialMoves: 20,
        cajasPendientes: 5,
        // Mapa de ejemplo: S=Suelo, P=Pared, A=Avatar inicial, O=Objetivo/Meta, C=Caja
        mapLayout: [
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['P', 'A', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'P', 'S', 'C', 'O', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'C', 'P'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
        ],
        startPos: { x: 1, y: 1 }, // Columna (x), Fila (y)
        goalPositions: [{ x: 3, y: 2 }, { x: 7, y: 4 }], // Coordenadas de los objetivos
    },
    {
        level: 2,
        mapWidth: 8,
        mapHeight: 6,
        initialMoves: 15,
        cajasPendientes: 7,
        mapLayout: [
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['P', 'A', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'P', 'S', 'C', 'O', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'C', 'P'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
        ],
        startPos: { x: 1, y: 1 },
        goalPositions: [{ x: 3, y: 2 }, { x: 7, y: 4 }],
    },
    {
        level: 3,
        mapWidth: 8,
        mapHeight: 6,
        initialMoves: 25,
        cajasPendientes: 10,
        mapLayout: [
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['P', 'A', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'P', 'S', 'C', 'O', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'C', 'P'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
        ],
        startPos: { x: 1, y: 1 },
        goalPositions: [{ x: 3, y: 2 }, { x: 7, y: 4 }],
    },
    {
        level: 4,
        mapWidth: 8,
        mapHeight: 6,
        initialMoves: 15,
        cajasPendientes: 9,
        mapLayout: [
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['P', 'A', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'P', 'S', 'C', 'O', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'C', 'P'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
        ],
        startPos: { x: 1, y: 1 },
        goalPositions: [{ x: 3, y: 2 }, { x: 7, y: 4 }],
    },
    {
        level: 5,
        mapWidth: 8,
        mapHeight: 6,
        initialMoves: 30,
        cajasPendientes: 12,
        mapLayout: [
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['P', 'A', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'P', 'S', 'C', 'O', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'S', 'P'],
            ['P', 'S', 'S', 'S', 'S', 'S', 'C', 'P'],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P']
        ],
        startPos: { x: 1, y: 1 },
        goalPositions: [{ x: 3, y: 2 }, { x: 7, y: 4 }],
    }
];

// Estado global del juego (simulado)
let gameState = {
    currentLevelIndex: -1, // Empieza en -1 para que el primer clic cargue Nivel 0
    movesRemaining: 0,
    cajasAcomodadas: 0,
    isGameActive: false,
};

/**
 * Inicializa y renderiza el mapa del nivel actual.
 */
function loadLevel(levelIndex) {
    const levelData = levelsData[levelIndex];
    if (!levelData) {
        console.error("Nivel no encontrado.");
        return;
    }

    gameState.currentLevelIndex = levelIndex;
    gameState.movesRemaining = levelData.initialMoves;
    gameState.cajasAcomodadas = 0;
    gameState.isGameActive = true;

    const gridElement = document.getElementById('grid-juego');
    const viewport = document.getElementById('mapa-viewport');
    
    // Limpiar el contenido anterior
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${levelData.mapWidth}, 1fr)`;
    gridElement.style.gridTemplateRows = `repeat(${levelData.mapHeight}, 1fr)`;

    // Actualizar estado visual
    document.getElementById('nivel-actual').textContent = levelData.level;
    document.getElementById('movimientos-restantes').textContent = levelData.initialMoves;
    document.getElementById('cajas-pendientes').textContent = levelData.cajasPendientes;

    // Renderizar el mapa
    for (let y = 0; y < levelData.mapHeight; y++) {
        for (let x = 0; x < levelData.mapWidth; x++) {
            const tile = document.createElement('div');
            tile.className = `tile ${levelData.mapLayout[y][x] === 'S' ? 'suelo' : levelData.mapLayout[y][x] === 'P' ? 'pared' : ''}`;
            tile.dataset.x = x;
            tile.dataset.y = y;

            let content = '';
            if (levelData.mapLayout[y][x] === 'A') {
                content = '<span class="avatar">🚶</span>'; // Avatar inicial
            } else if (levelData.mapLayout[y][x] === 'C') {
                content = '<span class="caja">📦</span>'; // Caja
            } else if (levelData.mapLayout[y][x] === 'O') {
                content = '<span class="objetivo">🎯</span>'; // Objetivo
            }

            tile.innerHTML = content;
            gridElement.appendChild(tile);
        }
    }

    // Colocar el avatar en su posición inicial (simulando la carga)
    const startTile = document.querySelector(`.tile[data-x="${levelData.startPos.x}"][data-y="${levelData.startPos.y}"]`);
    if (startTile) {
        startTile.innerHTML = '<span class="avatar">🚶</span>';
    }

    // Habilitar controles y mensaje
    document.getElementById('btn-reiniciar').disabled = false;
    document.getElementById('btn-proximo-nivel').disabled = false;
    document.getElementById('mensaje-juego').textContent = `¡Nivel ${levelData.level} cargado! ¡Mueve el avatar con las flechas para empezar!`;

    // Añadir listeners de eventos (solo si no están ya añadidos)
    setupEventListeners();
}


/**
 * Maneja la lógica del movimiento y colisiones (simulado).
 * @param {number} dx - Cambio en X (-1, 0, 1)
 * @param {number} dy - Cambio en Y (-1, 0, 1)
 */
function moveAvatar(dx, dy) {
    if (!gameState.isGameActive || gameState.movesRemaining <= 0) return;

    const currentTile = document.querySelector('.avatar')?.closest('.tile');
    if (!currentTile) return;

    const currentX = parseInt(currentTile.dataset.x);
    const currentY = parseInt(currentTile.dataset.y);

    const newX = currentX + dx;
    const newY = currentY + dy;

    // 1. Validación de límites y paredes (simulación)
    if (newX < 0 || newY < 0 || !document.querySelector(`.tile[data-x="${newX}"][data-y="${newY}"]`)) {
        console.log("Movimiento inválido: fuera de mapa o pared.");
        return;
    }

    // 2. Simular movimiento y colisión (Aquí iría la lógica compleja)
    const targetTile = document.querySelector(`.tile[data-x="${newX}"][data-y="${newY}"]`);
    if (!targetTile || targetTile.classList.contains('pared')) {
        console.log("Movimiento inválido: golpeó pared.");
        return;
    }

    // 3. Actualizar estado y UI
    gameState.movesRemaining--;
    document.getElementById('movimientos-restantes').textContent = gameState.movesRemaining;

    // Mover el avatar visualmente (simulación de la transición)
    const avatarElement = document.querySelector('.avatar');
    if (avatarElement) {
        currentTile.innerHTML = ''; // Limpiar posición antigua
        targetTile.appendChild(avatarElement); // Colocar en nueva posición
        // Actualizar dataset del tile para reflejar la nueva posición del avatar si fuera necesario, aunque el grid lo maneja por data-x/y
    }

    // 4. Comprobar condiciones de victoria/derrota (simulación)
    if (gameState.movesRemaining <= 0) {
        endGame(false); // Derrota por falta de movimientos
    } else if (checkWinCondition()) {
        endGame(true); // Victoria
    }
}

/**
 * Simula la verificación de si se han acomodado todas las cajas.
 */
function checkWinCondition() {
    // En un juego real, esto contaría cuántas cajas están en los objetivos.
    // Aquí simulamos que ganaste si el nivel es 5 y has hecho suficientes movimientos.
    if (gameState.currentLevelIndex === levelsData.length - 1 && gameState.movesRemaining > 0) {
        return true;
    }
    return false;
}

/**
 * Finaliza la partida, mostrando mensaje de éxito o fracaso.
 * @param {boolean} success - Si el jugador ganó.
 */
function endGame(success) {
    gameState.isGameActive = false;
    const messageBox = document.getElementById('mensaje-juego');

    if (success) {
        messageBox.innerHTML = `🎉 ¡Nivel ${levelsData[gameState.currentLevelIndex].level} completado! <br>¡Excelente trabajo!`;
        document.getElementById('btn-proximo-nivel').disabled = false;
        document.getElementById('btn-reiniciar').disabled = true;
    } else {
        messageBox.innerHTML = `💀 ¡Fin del juego! Te quedaste sin movimientos en el Nivel ${levelsData[gameState.currentLevelIndex].level}.`;
        document.getElementById('btn-proximo-nivel').disabled = true;
        document.getElementById('btn-reiniciar').disabled = false;
    }
}

/**
 * Configura los listeners de eventos para la interacción del usuario.
 */
function setupEventListeners() {
    // Limpiar listeners previos para evitar duplicados
    const gridElement = document.getElementById('grid-juego');
    gridElement.onkeydown = null; // Desvincular listener anterior

    // 1. Teclado (Movimiento del Avatar)
    document.addEventListener('keydown', (e) => {
        if (!gameState.isGameActive) return;
        let dx = 0, dy = 0;
        switch(e.key) {
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
                return; // No es una flecha de movimiento
        }
        e.preventDefault();
        moveAvatar(dx, dy);
    });

    // 2. Botones de control
    document.getElementById('btn-reiniciar').onclick = () => {
        if (gameState.currentLevelIndex !== -1) {
            loadLevel(gameState.currentLevelIndex); // Recarga el mismo nivel
        }
    };

    document.getElementById('btn-proximo-nivel').onclick = async () => {
        const nextLevelIndex = gameState.currentLevelIndex + 1;
        if (nextLevelIndex < MAX_LEVELS) {
            // Simular carga de datos del siguiente nivel
            await new Promise(resolve => setTimeout(resolve, 500)); 
            loadLevel(nextLevelIndex);
        } else {
            document.getElementById('mensaje-juego').textContent = "🏆 ¡Felicidades! Has completado todos los niveles.";
            document.getElementById('btn-proximo-nivel').disabled = true;
        }
    };

    // 3. Botón de inicio (simulado, ya que el primer nivel se carga al iniciar)
    const startButton = document.createElement('button');
    startButton.id = 'btn-iniciar';
    startButton.className = 'btn';
    startButton.textContent = '▶️ Iniciar Juego';
    startButton.onclick = () => {
        loadLevel(0); // Cargar el primer nivel al hacer clic en iniciar
    };
    // Insertar botón de inicio antes del panel de control si es necesario, o simplemente llamar a loadLevel(0) al final.
}

// Inicialización: Al cargar la página, se configura el estado inicial y los listeners.
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Nota: El botón 'Iniciar Juego' debe ser visible para que el usuario inicie el juego. 
    // Para este ejercicio, asumiremos que al cargar la página, el primer nivel está listo para ser iniciado manualmente por el usuario (o se podría añadir un botón de inicio en el HTML).
});
