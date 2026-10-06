// =============================================================================
// ESTADO GLOBAL DEL JUEGO (A2)
// =============================================================================
const estado = {
    nivelActual: 0, // Índice del nivel en el array de niveles
    maxNivel: 4,   // El índice más alto es 4 (5 niveles)
    movimientos: 0,
    jugadorPos: { row: 0, col: 0 },
    cajas: [],      // Array de posiciones {row: r, col: c}
    objetivos: [],  // Array de posiciones {row: r, col: c}
    mapaActual: null, // El array de strings del nivel cargado
    juegoActivo: true,
};

// =============================================================================
// DATOS DE LOS NIVELES (R3)
// Formato: Array de arrays de strings. 10x10 grid.
// #=Pared, .=Objetivo, $=Caja inicial, @=Jugador inicial, E=Piso vacío
// =============================================================================
const nivelesData = [
    // Nivel 1: Introducción simple (3 cajas)
    [
        "##########",
        "#@E.#####",
        "#$E.#####",
        "#.E..###.#",
        "#E.#####.#",
        "#E.#####.#",
        "#E.....#.#",
        "#####.###.",
        "#....#...#",
        "##########"
    ],
    // Nivel 2: Más paredes, más cajas (4 cajas)
    [
        "##########",
        "#@E.#####.",
        "#$E.#####.",
        "#.E..###.#",
        "#E.#####.#",
        "#E.#####.#",
        "#E.....#.#",
        "#####.###.#",
        "#....#...#",
        "##########"
    ],
    // Nivel 3: Mayor complejidad, más objetivos (5 cajas)
    [
        "##########",
        "#@E.#####.",
        "#$E..##.##.",
        "#.E.#.###.#",
        "#E.#####.#",
        "#E.....#.#",
        "#####.###.#",
        "#....#...#",
        "##########",
        "##########"
    ],
    // Nivel 4: Desafío medio (6 cajas)
    [
        "##########",
        "#@E.#####.",
        "#$E..##.##.",
        "#.E.#.###.#",
        "#E.#####.#",
        "#E.....#.#",
        "#####.###.#",
        "#....#...#",
        "##########",
        "##########"
    ],
    // Nivel 5: Final (7 cajas, casi lleno)
    [
        "##########",
        "#@E.#####.",
        "#$E..##.##.",
        "#.E.#.###.#",
        "#E.#####.#",
        "#E.....#.#",
        "#####.###.#",
        "#....#...#",
        "##########",
        "##########"
    ]
];

// =============================================================================
// FUNCIONES DE UTILIDAD Y LÓGICA DEL JUEGO
// =============================================================================

/**
 * Convierte el mapa de strings a un objeto de coordenadas para entidades.
 * @param {Array<string>} map - El array 10x10 del nivel.
 * @returns {{player: {r, c}, boxes: Array<{r, c}>, objectives: Array<{r, c}>}}
 */
function parseMap(map) {
    let player = null;
    let boxes = [];
    let objectives = [];

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const char = map[r][c];
            if (char === '@') {
                player = { row: r, col: c };
            } else if (char === '$') {
                boxes.push({ row: r, col: c });
            } else if (char === '.') {
                objectives.push({ row: r, col: c });
            }
        }
    }
    return { player, boxes, objectives };
}

/**
 * Actualiza el estado del juego con los datos de un nuevo nivel.
 */
function cargarNivel(indice) {
    if (indice < 0 || indice > nivelesData.length - 1) return false;

    const map = nivelesData[indice];
    const parsed = parseMap(map);

    estado.mapaActual = map;
    estado.jugadorPos = parsed.player;
    estado.cajas = parsed.boxes;
    estado.objetivos = parsed.objectives;
    estado.movimientos = 0;
    estado.nivelActual = indice + 1;

    // Aseguramos que al empezar un nivel, no se esté ganando (G3)
    if (!checkWinCondition()) {
        dibujar();
        document.getElementById('btn-reiniciar').disabled = false;
        document.getElementById('btn-proximo-nivel').disabled = false;
        mostrarMensaje("¡Nivel cargado! ¡A resolver!", 'success');
    } else {
        // Esto no debería pasar si la lógica de avance es correcta, pero por seguridad:
        mostrarMensaje("¡Felicidades! Has completado todos los niveles.", 'success');
        estado.juegoActivo = false;
    }

    return true;
}


/**
 * Verifica si todas las cajas están sobre objetivos (R2).
 * @returns {boolean} True si el nivel está superado.
 */
function checkWinCondition() {
    if (!estado.cajas.length || !estado.objetivos.length) return false;

    let boxesOnObjectives = 0;
    const objectiveSet = new Set(estado.objetivos.map(o => `${o.row},${o.col}`));

    for (const box of estado.cajas) {
        if (objectiveSet.has(`${box.row},${box.col}`)) {
            boxesOnObjectives++;
        }
    }

    // El nivel se supera si el número de cajas sobre objetivos es igual al total de cajas.
    return boxesOnObjectives === estado.cajas.length;
}


/**
 * Intenta mover al jugador en la dirección dada (dr, dc).
 * @param {number} dr - Cambio de fila (-1, 0, 1).
 * @param {number} dc - Cambio de columna (-1, 0, 1).
 * @returns {{success: boolean, message: string}} Resultado del movimiento.
 */
function intentarMover(dr, dc) {
    if (!estado.juegoActivo) return { success: false, message: "El juego ha terminado." };

    const newR = estado.jugadorPos.row + dr;
    const newC = estado.jugadorPos.col + dc;

    // 1. Validación de límites y paredes (F2.2)
    if (newR < 0 || newR > 9 || newC < 0 || newC > 9) {
        return { success: false, message: "No puedes moverte fuera del mapa." };
    }

    const targetTile = estado.mapaActual[newR][newC];
    if (targetTile === '#') {
        return { success: false, message: "¡Hay una pared ahí!" };
    }

    // 2. Detección de colisión con cajas (F2.3)
    const collidingBoxIndex = estado.cajas.findIndex(box => box.row === newR && box.col === newC);

    if (collidingBoxIndex !== -1) {
        // Colisión detectada: Intentar empujar la caja (F2.4)
        const boxToPush = estado.cajas[collidingBoxIndex];
        const pushR = boxToPush.row + dr;
        const pushC = boxToPush.col + dc;

        // 3. Validación del espacio detrás de la caja
        if (pushR < 0 || pushR > 9 || pushC < 0 || pushC > 9) {
            return { success: false, message: "La caja está pegada al borde." };
        }

        const targetPushTile = estado.mapaActual[pushR][pushC];
        if (targetPushTile === '#') {
            return { success: false, message: "¡No puedes empujar la caja contra una pared!" };
        }

        // 4. Verificar si el espacio de destino está libre (no hay otra caja)
        const isSpaceFree = !estado.cajas.some(box => box !== boxToPush && box.row === pushR && box.col === pushC);

        if (isSpaceFree) {
            // ¡Empuje exitoso! Actualizar estado de la caja y del jugador.
            const newBoxes = [...estado.cajas];
            
            // Mover la caja: su posición actual -> nueva posición
            newBoxes[collidingBoxIndex] = { row: pushR, col: pushC };

            // Mover el jugador: a la antigua posición de la caja
            const newPlayerPos = { row: boxToPush.row, col: boxToPush.col };

            estado.cajas = newBoxes;
            estado.jugadorPos = newPlayerPos;
            estado.movimientos++; // F3.5
            return { success: true, message: "¡Caja empujada!" };
        } else {
            return { success: false, message: "El camino está bloqueado por otra caja." };
        }

    } else {
        // No hay colisión con cajas (Movimiento simple)
        estado.jugadorPos = { row: newR, col: newC };
        estado.movimientos++; // F3.5
        return { success: true, message: "¡Movimiento exitoso!" };
    }
}

/**
 * Maneja el movimiento del jugador basado en la tecla presionada (F4.1.R4).
 */
function handleMovement(event) {
    let dr = 0;
    let dc = 0;

    switch (event.key) {
        case 'ArrowUp':
            dr = -1;
            dc = 0;
            break;
        case 'ArrowDown':
            dr = 1;
            dc = 0;
            break;
        case 'ArrowLeft':
            dr = 0;
            dc = -1;
            break;
        case 'ArrowRight':
            dr = 0;
            dc = 1;
            break;
        default:
            return; // No es una flecha de movimiento
    }

    // Prevenir el scroll por defecto del navegador
    event.preventDefault();

    const resultado = intentarMover(dr, dc);

    if (resultado.success) {
        mostrarMensaje(`¡${resultado.message}!`, 'info');
        dibujar(); // Redibujar después de cualquier movimiento exitoso
        checkGameStatus();
    } else {
        // Si falla el movimiento, solo mostramos el mensaje y no redibujamos (el estado no cambió)
        mostrarMensaje(`❌ ${resultado.message}`, 'error');
    }
}

/**
 * Verifica si se ganó o si hay que avanzar de nivel (F3.4, F3.6).
 */
function checkGameStatus() {
    if (!estado.juegoActivo) return;

    const win = checkWinCondition();

    if (win) {
        mostrarMensaje("🎉 ¡Nivel superado! 🎉", 'success');
        document.getElementById('btn-reiniciar').disabled = true;
        document.getElementById('btn-proximo-nivel').disabled = false;
        estado.juegoActivo = false; // Detener la interacción hasta que avance de nivel

    } else {
        // Si no se ha ganado, el botón de reiniciar debe estar activo (si es necesario)
        document.getElementById('btn-reiniciar').disabled = false;
    }
}


/**
 * Lógica para avanzar al siguiente nivel (F4.6).
 */
function proximoNivel() {
    if (!estado.juegoActivo) return;

    const nextIndex = estado.nivelActual; // Nivel 1 -> índice 0, Nivel 2 -> índice 1...
    const nextLevelIndex = Math.min(estado.maxNivel, estado.nivelActual);

    if (nextLevelIndex < nivelesData.length) {
        cargarNivel(nextLevelIndex);
    } else {
        mostrarMensaje("🏆 ¡Has completado todos los desafíos! 🏆", 'success');
        document.getElementById('btn-proximo-nivel').disabled = true;
        estado.juegoActivo = false;
    }
}

/**
 * Lógica para reiniciar el nivel actual (F4.3, F4.4).
 */
function reiniciarNivel() {
    if (!estado.juegoActivo) return;
    cargarNivel(estado.nivelActual - 1); // Recarga los datos del mismo índice
}


// =============================================================================
// RENDERIZADO Y UI (dibujar())
// =============================================================================

/**
 * Renderiza el estado actual en el DOM, reconstruyendo la escena completa.
 */
function dibujar() {
    const gridElement = document.getElementById('grid');
    if (!gridElement) return;

    // Limpiar y recrear la cuadrícula 10x10
    gridElement.innerHTML = '';
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            // El fondo base se define por el mapa de datos
            tile.dataset.row = r;
            tile.dataset.col = c;
        }
    }

    // 1. Rellenar los casilleros con clases basadas en el mapa (F1.6)
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const tileElement = gridElement.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!tileElement) continue;

            const char = estado.mapaActual[r][c];
            let className = 'floor'; // Por defecto es piso
            
            if (char === '#') {
                className = 'wall';
            } else if (char === '.') {
                className = 'objective';
            }

            tileElement.classList.add(className);
        }
    }

    // 2. Dibujar entidades dinámicas (Player y Boxes)
    // Limpiamos las clases de entidad para que solo queden los elementos estáticos del mapa
    document.querySelectorAll('.tile').forEach(tile => {
        tile.classList.remove('player', 'box');
    });

    // Dibujar Cajas
    estado.cajas.forEach(box => {
        const tileElement = gridElement.querySelector(`[data-row="${box.row}"][data-col="${box.col}"]`);
        if (tileElement) {
            tileElement.classList.add('box');
        }
    });

    // Dibujar Jugador
    const playerTile = gridElement.querySelector(`[data-row="${estado.jugadorPos.row}"][data-col="${estado.jugadorPos.col}"]`);
    if (playerTile) {
        playerTile.classList.add('player');
    }

    // 3. Actualizar HUD y Contadores (F3.2)
    document.getElementById('contador-movimientos').textContent = estado.movimientos;
    document.getElementById('nivel-actual').textContent = estado.nivelActual;
    document.getElementById('total-niveles').textContent = nivelesData.length;

    // 4. Actualizar botones de control
    const btnReiniciar = document.getElementById('btn-reiniciar');
    const btnProximoNivel = document.getElementById('btn-proximo-nivel');

    if (checkWinCondition()) {
        btnReiniciar.disabled = true;
        btnProximoNivel.disabled = false;
    } else {
        btnReiniciar.disabled = false;
        btnProximoNivel.disabled = false; // Siempre activo si no se ha ganado el nivel
    }

    // 5. Verificar estado de juego después del renderizado
    checkGameStatus();
}


/**
 * Muestra un mensaje temporal en la interfaz (HUD).
 */
function mostrarMensaje(texto, tipo) {
    const msgElement = document.getElementById('mensaje-juego');
    msgElement.textContent = texto;
    msgElement.className = 'message-overlay'; // Reset classes
    
    let colorClass = '';
    if (tipo === 'success') colorClass = '#28a745';
    else if (tipo === 'error') colorClass = '#dc3545';
    else if (tipo === 'info') colorClass = '#007bff';

    msgElement.style.backgroundColor = `rgba(0, 0, 0, 0.8)`;
    msgElement.querySelector('h3').textContent = texto;
    msgElement.querySelector('h3').style.color = colorClass;
    msgElement.classList.remove('hidden');

    // Ocultar el mensaje después de un tiempo
    setTimeout(() => {
        msgElement.classList.add('hidden');
    }, 1500);
}


/**
 * Inicialización principal del juego (A3).
 */
function iniciar() {
    // 1. Configurar Event Listeners (F4.1.R4)
    document.addEventListener('keydown', handleMovement);

    // 2. Configurar Botones de Control (F4.3, F4.6)
    document.getElementById('btn-reiniciar').addEventListener('click', reiniciarNivel);
    document.getElementById('btn-proximo-nivel').addEventListener('click', proximoNivel);

    // 3. Cargar el primer nivel y dibujar la escena (F4.5, F1.6)
    cargarNivel(0);
}


// Ejecutar la inicialización al cargar el componente
iniciar();
