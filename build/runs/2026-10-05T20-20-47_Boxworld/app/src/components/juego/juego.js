(root) => {
    const MAP_ROWS = 6;
    const MAP_COLS = 8;

    // Estructura de datos para los niveles (5+ niveles requeridos)
    // Mapa Key: 0=Vacío, 1=Muro, 2=Target Box, 3=Start Position
    const levelsData = [
        { // Nivel 1: Introducción simple
            map: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 3, 0, 2, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            startPos: { row: 2, col: 1 }, // Posición inicial del jugador (3)
            targets: [{ r: 2, c: 3 }, { r: 5, c: 5 }], // Coordenadas de las cajas objetivo (2)
        },
        { // Nivel 2: Más obstáculos y un camino más largo
            map: [
                [0, 0, 1, 0, 0, 0, 0, 0],
                [0, 3, 1, 0, 1, 1, 1, 0],
                [0, 0, 1, 2, 0, 0, 0, 0],
                [0, 1, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            startPos: { row: 1, col: 1 },
            targets: [{ r: 2, c: 3 }, { r: 4, c: 5 }],
        },
        { // Nivel 3: Requiere moverse por el borde
            map: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 3, 0, 2, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0],
                [0, 1, 1, 1, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            startPos: { row: 2, col: 1 },
            targets: [{ r: 2, c: 3 }, { r: 4, c: 5 }],
        },
        { // Nivel 4: Más cajas y un desafío de movimiento
            map: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [0, 3, 0, 2, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            startPos: { row: 2, col: 1 },
            targets: [{ r: 2, c: 3 }, { r: 4, c: 5 }, { r: 1, c: 7 }], // Añadimos un target en el borde
        },
        { // Nivel 5: El desafío final (más cajas)
            map: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 3, 0, 2, 0, 0, 0, 0],
                [0, 0, 0, 1, 0, 0, 0, 0],
                [0, 1, 1, 1, 0, 2, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            startPos: { row: 2, col: 1 },
            targets: [{ r: 2, c: 3 }, { r: 4, c: 5 }, { r: 1, c: 7 }], // Mismo set de targets para el reto final
        }
    ];

    // --- ESTADO DEL JUEGO GLOBAL ---
    let gameState = {
        currentLevelIndex: 0,
        playerPos: null,
        moves: 0,
        boxesPlaced: new Set(), // Almacena "r,c" de las cajas colocadas
        isGameOver: false,
        levelData: null
    };

    // --- REFERENCIAS DOM ---
    const $mapGrid = root.querySelector('#mapa-grid');
    const $nivelActual = root.querySelector('#nivel-actual');
    const $contadorMovimientos = root.querySelector('#contador-movimientos');
    const $cajasRestantes = root.querySelector('#cajas-restantes');
    const $reiniciarBtn = root.querySelector('#reiniciar-btn');
    const $proximoNivelBtn = root.querySelector('#proximo-nivel-btn');
    const $mensajeJuego = root.querySelector('#mensaje-juego');

    // --- FUNCIONES DE UTILIDAD ---

    /** Limpia y renderiza el mapa completo basado en los datos del nivel actual. */
    function renderMap() {
        $mapGrid.innerHTML = ''; // Limpiar contenido anterior
        const level = gameState.levelData;
        if (!level) return;

        // Asegurar que las dimensiones sean correctas para CSS Grid
        $mapGrid.setAttribute('data-cols', MAP_COLS);
        $mapGrid.setAttribute('data-rows', MAP_ROWS);

        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = r;
                tile.dataset.col = c;

                // Determinar el tipo de tile y su contenido visual
                let typeClass = '';
                if (level.map[r][c] === 1) {
                    typeClass = 'wall'; // Muro
                } else if (level.map[r][c] === 2) {
                    typeClass = 'target-box'; // Caja objetivo
                } else if (level.map[r][c] === 3) {
                    typeClass = 'start-pos'; // Posición de inicio
                }

                tile.classList.add(typeClass);
                $mapGrid.appendChild(tile);
            }
        }
        // Después de renderizar la estructura, se llama a updatePlayerPosition para colocar al jugador
        updatePlayerPosition();
    }

    /** Actualiza el estado visual del jugador en el mapa */
    function updatePlayerPosition() {
        if (!gameState.playerPos) return;

        // 1. Limpiar clases de jugador y caja ocupada de todos los tiles
        root.querySelectorAll('.tile').forEach(tile => {
            tile.classList.remove('player', 'occupied');
        });

        // 2. Colocar al jugador en su posición actual
        const playerTile = root.querySelector(`.tile[data-row="${gameState.playerPos.r}"][data-col="${gameState.playerPos.c}"]`);
        if (playerTile) {
            playerTile.classList.add('player');
        }

        // 3. Reaplicar clases de caja ocupada para los tiles que ya fueron llenados
        gameState.boxesPlaced.forEach(coord => {
            const [r, c] = coord.split(',').map(Number);
            const tile = root.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
            if (tile && !['start-pos', 'player'].includes(tile.className)) {
                // Solo marcamos como ocupado si no es el jugador ni la posición inicial
                tile.classList.add('occupied');
            }
        });
    }

    /** Actualiza los contadores de estado (Nivel, Movimientos, Cajas) */
    function updateStatusUI() {
        const level = gameState.levelData;
        if (!level) return;

        $nivelActual.textContent = `${gameState.currentLevelIndex + 1}`;
        $contadorMovimientos.textContent = gameState.moves;
        
        const totalTargets = level.targets.length;
        const placedCount = gameState.boxesPlaced.size;
        $cajasRestantes.textContent = `${totalTargets - placedCount}/${totalTargets}`;

        // Habilitar/Deshabilitar botón de próximo nivel
        if (gameState.currentLevelIndex < levelsData.length - 1) {
            $proximoNivelBtn.disabled = false;
        } else {
            $proximoNivelBtn.disabled = true;
            $proximoNivelBtn.textContent = "🏆 ¡Juego Terminado! 🎉";
        }

        // Habilitar/Deshabilitar botón de reiniciar (si el juego no está en estado final)
        if (!gameState.isGameOver && level) {
             $reiniciarBtn.disabled = false;
        } else {
            $reiniciarBtn.disabled = true;
        }
    }

    /** Lógica principal para mover al jugador */
    function movePlayer(direction) {
        if (gameState.isGameOver || !gameState.levelData) return;

        const currentPos = gameState.playerPos;
        let newR = currentPos.r;
        let newC = currentPos.c;

        // Calcular nueva posición basada en la dirección
        switch (direction) {
            case 'up': newR--; break;
            case 'down': newR++; break;
            case 'left': newC--; break;
            case 'right': newC++; break;
        default: return;
        }

        // 1. Validación de límites y muros
        if (newR < 0 || newR >= MAP_ROWS || newC < 0 || newC >= MAP_COLS) {
            return false; // Fuera de límites
        }
        const targetTile = gameState.levelData.map[newR][newC];
        if (targetTile === 1) {
            return false; // Muro
        }

        // 2. Validación de movimiento: El jugador no puede moverse a una posición ya ocupada por caja
        const targetCoordKey = `${newR},${newC}`;
        if (gameState.boxesPlaced.has(targetCoordKey)) {
            return false; // Ya hay una caja ahí
        }

        // 3. Movimiento Válido: Actualizar estado y UI
        
        // Si el jugador se mueve a un target box vacío, lo ocupa
        if (gameState.levelData.map[newR][newC] === 2 && !gameState.boxesPlaced.has(targetCoordKey)) {
            gameState.boxesPlaced.add(targetCoordKey);
        }

        // Actualizar posición del jugador
        gameState.playerPos = { r: newR, c: newC };
        gameState.moves++;

        updatePlayerPosition();
        updateStatusUI();
        checkWinCondition();
        return true;
    }

    /** Verifica si se han colocado todas las cajas objetivo */
    function checkWinCondition() {
        const level = gameState.levelData;
        if (!level) return false;

        // Contar cuántos targets deberían estar colocados
        const totalTargets = level.targets.length;
        const placedCount = gameState.boxesPlaced.size;

        if (placedCount === totalTargets) {
            gameState.isGameOver = true;
            displayMessage("¡Felicidades! Has acomodado todas las cajas. ¡Nivel completado!", 'success');
            $proximoNivelBtn.disabled = false; // Asegurar que el botón esté listo para avanzar
        } else if (placedCount > 0) {
             // Si se colocaron cajas pero no es el nivel final, simplemente actualizamos estado
             gameState.isGameOver = false;
        }
    }

    /** Muestra un mensaje de resultado en la interfaz */
    function displayMessage(message, type) {
        $mensajeJuego.textContent = message;
        $mensajeJuego.className = `game-message ${type}`;
        $mensajeJuego.classList.remove('hidden');
    }

    /** Inicializa o reinicia el estado del juego para un nivel dado */
    function initializeLevel(index) {
        if (index < 0 || index >= levelsData.length) return;

        gameState.currentLevelIndex = index;
        const level = levelsData[index];
        gameState.levelData = level;

        // Resetear estado de juego
        gameState.moves = 0;
        gameState.boxesPlaced.clear();
        gameState.isGameOver = false;

        // Establecer posición inicial del jugador
        gameState.playerPos = { r: level.startPos.row, c: level.startPos.col };

        // Renderizar y actualizar UI
        renderMap();
        updateStatusUI();
        displayMessage("", null); // Limpiar mensajes anteriores
    }


    // --- MANEJADORES DE EVENTOS ---

    /** Maneja el movimiento del jugador mediante las flechas del teclado */
    function handleKeyDown(event) {
        if (gameState.isGameOver || !gameState.levelData) return;

        let direction = null;
        switch (event.key) {
            case 'ArrowUp': direction = 'up'; break;
            case 'ArrowDown': direction = 'down'; break;
            case 'ArrowLeft': direction = 'left'; break;
            case 'ArrowRight': direction = 'right'; break;
            default: return;
        }

        // Prevenir el scroll por defecto al usar flechas
        event.preventDefault(); 
        movePlayer(direction);
    }

    /** Maneja el clic para avanzar al siguiente nivel */
    function handleNextLevel() {
        if (gameState.isGameOver && gameState.currentLevelIndex < levelsData.length - 1) {
            const nextIndex = gameState.currentLevelIndex + 1;
            initializeLevel(nextIndex);
        } else if (gameState.currentLevelIndex === levelsData.length - 1) {
             displayMessage("¡Has completado todos los niveles! ¡Eres un maestro de Boxworld!", 'success');
             $proximoNivelBtn.disabled = true;
        }
    }

    /** Reinicia el estado del juego al nivel actual */
    function handleRestartLevel() {
        if (gameState.levelData) {
            initializeLevel(gameState.currentLevelIndex);
            displayMessage("¡Nuevo intento! ¡A mover esas cajas!", null);
        }
    }

    // --- INICIALIZACIÓN ---

    // 1. Asignar listeners de eventos globales y locales
    document.addEventListener('keydown', handleKeyDown);
    $reiniciarBtn.addEventListener('click', handleRestartLevel);
    $proximoNivelBtn.addEventListener('click', handleNextLevel);

    // 2. Iniciar el juego en el Nivel 1 (índice 0)
    initializeLevel(0);
}
