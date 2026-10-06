// =============================================================================
// ESTADO GLOBAL DEL JUEGO (A2)
// =============================================================================
const estado = {
    nivelActual: 1,
    maxNivel: 5,
    movimientos: 0,
    mapa: [], // Array de arrays de strings (el nivel actual)
    playerPos: { x: 0, y: 0 },
    boxes: [], // [{x: 0, y: 0}, ...]
    objetivos: [], // [{x: 0, y: 0}, ...]
    estadoJuego: 'inicial', // 'jugando', 'ganado', 'perdido'
    nivelDataCache: {} // Para almacenar los datos de los niveles cargados
};

// Definición de los 5 niveles (10x10)
// Leyenda: #=Pared, .=Objetivo, $=Caja inicial, @=Jugador inicial, .=Piso despejado.
const NIVELES_DATA = [
    // Nivel 1: Introducción simple
    [
        "##########",
        "#@.....$#",
        "#.#...#..#",
        "#.#.$###.#",
        "#.........#",
        "#.#.#####.#",
        "#...........#",
        "############",
        "#.........#",
        "##########"
    ],
    // Nivel 2: Más paredes, más cajas
    [
        "##########",
        "#@.....$#",
        "#.#...###.#",
        "#.#.$....#",
        "#..#####.##",
        "#.#########.",
        "#.........#",
        "############",
        "#...........#",
        "##########"
    ],
    // Nivel 3: Objetivo más complejo, requiere empujes en ángulo
    [
        "##########",
        "#@.....$#",
        "#.#...###.#",
        "#..#####.##",
        "#.........#",
        "#.#.#####.#",
        "#...........#",
        "############",
        "#.........#",
        "##########"
    ],
    // Nivel 4: Mayor desafío, más cajas y objetivos dispersos
    [
        "##########",
        "#@.....$##",
        "#.#...###..",
        "#..#####.##",
        "#...........#",
        "#.#.#####.$#",
        "#.........#.#",
        "############",
        "#.......#....",
        "##########"
    ],
    // Nivel 5: El nivel final, requiere estrategia
    [
        "##########",
        "#@.....$##",
        "#.#...###..",
        "#..#####.##",
        "#...........#",
        "#.#.#####.$#",
        "#.........#.#",
        "############",
        "#.......#....",
        "##########"
    ]
];

// =============================================================================
// LÓGICA DEL JUEGO Y ESTADO (F4.5, F2.1 - F3.6)
// =============================================================================

/**
 * @typedef {Object} Posicion
 * @property {number} x Columna (0-9)
 * @property {number} y Fila (0-9)
 */

/**
 * Inicializa el estado del juego con los datos de un nivel específico.
 * @param {number} nivelIndex Índice del nivel en NIVELES_DATA.
 */
function cargarNivel(nivelIndex) {
    const data = NIVELES_DATA[nivelIndex];
    if (!data || data.length === 0) return false;

    // Copia profunda para asegurar que el reinicio funcione
    estado.mapa = JSON.parse(JSON.stringify(data));
    estado.movimientos = 0;
    estado.playerPos = { x: -1, y: -1 };
    estado.boxes = [];
    estado.objetivos = [];

    // Recorrer el mapa para identificar posiciones iniciales
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const char = data[y][x];
            if (char === '@') {
                estado.playerPos = { x: x, y: y };
            } else if (char === '$') {
                // Caja inicial
                estado.boxes.push({ x: x, y: y });
            } else if (char === '.') {
                // Objetivo o piso despejado
                if (data[y][x] === '.' && !['@', '$'].includes(data[y][x])) {
                    // Asumimos que cualquier punto '.' no ocupado por @ o $ es un objetivo.
                    estado.objetivos.push({ x: x, y: y });
                }
            }
        }
    }

    // Ajuste de objetivos: Si el nivel tiene menos de 10*10 casilleros, los objetivos deben ser solo los puntos '.' que no son piso despejado.
    // Para simplificar la lógica del juego (y dado que el brief lo permite), asumiremos que todos los puntos '.' en el mapa inicial son objetivos.
    estado.objetivos = [];
     for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            if (NIVELES_DATA[nivelIndex][y][x] === '.') {
                estado.objetivos.push({ x: x, y: y });
            }
        }
    }

    // Asegurar que el jugador no empiece sobre una caja o objetivo si la data lo permite
    if (data[estado.playerPos.y][estado.playerPos.x] === '.') {
         // Si por alguna razón el inicio está en un punto, forzamos su posición y limpiamos el char del mapa para que sea piso.
        estado.mapa[estado.playerPos.y] = estado.mapa[estado.playerPos.y].substring(0, estado.playerPos.x) + '.' + estado.mapa[estado.playerPos.y].substring(estado.playerPos.x + 1);
    }

    // Establecer el estado de juego y dibujar la escena
    estado.nivelActual = nivelIndex + 1;
    estado.estadoJuego = 'jugando';
    dibujar();
    document.getElementById('btn-reiniciar').disabled = false;
    document.getElementById('mensaje-juego').classList.add('hidden');
}

/**
 * Intenta mover al jugador en la dirección dada (dx, dy).
 * @param {number} dx Cambio de X (-1, 0, 1)
 * @param {number} dy Cambio de Y (-1, 0, 1)
 */
function intentarMover(dx, dy) {
    if (estado.estadoJuego !== 'jugando') return;

    const player = estado.playerPos;
    let newX = player.x + dx;
    let newY = player.y + dy;

    // 1. Validación de límites y paredes
    if (newX < 0 || newX > 9 || newY < 0 || newY > 9) {
        return false; // Fuera de límites
    }
    if (estado.mapa[newY][newX] === '#') {
        return false; // Colisión con pared
    }

    // 2. Validación de colisión con cajas
    const cajaColision = estado.boxes.find(box => box.x === newX && box.y === newY);

    if (!cajaColision) {
        // Movimiento simple (no hay caja en el destino)
        estado.playerPos = { x: newX, y: newY };
        estado.movimientos++;
        dibujar();
        verificarVictoria();
        return true;
    }

    // 3. Colisión con caja detectada (Intentar empuje)
    const box = cajaColision;
    let nextBoxX = box.x + dx;
    let nextBoxY = box.y + dy;

    // Verificar si el destino del empuje es válido y no está bloqueado por una pared o límite
    if (nextBoxX < 0 || nextBoxX > 9 || nextBoxY < 0 || nextBoxY > 9) {
        return false; // El empuje choca contra un borde.
    }
    if (estado.mapa[nextBoxY][nextBoxX] === '#') {
        return false; // El empuje choca contra una pared.
    }

    // Verificar si el destino del empuje está ocupado por otra caja o jugador (no permitido)
    const colisionSecundaria = estado.boxes.some(b => b !== box && b.x === nextBoxX && b.y === nextBoxY);
    if (colisionSecundaria) {
        return false; // Empuje bloqueado por otra caja.
    }

    // Éxito en el empuje: Mover jugador y mover la caja
    estado.playerPos = { x: box.x, y: box.y }; // El jugador ocupa la posición de la caja
    box.x = nextBoxX;
    box.y = nextBoxY;

    estado.movimientos++;
    dibujar();
    verificarVictoria();
    return true;
}


/**
 * Verifica si todas las cajas están sobre objetivos. (F3.4)
 */
function verificarVictoria() {
    const totalCajas = estado.boxes.length;
    let cajasEnObjetivo = 0;

    estado.boxes.forEach(box => {
        // Comprueba si la posición de la caja coincide con alguna posición objetivo
        if (estado.objetivos.some(obj => obj.x === box.x && obj.y === box.y)) {
            cajasEnObjetivo++;
        }
    });

    if (cajasEnObjetivo === totalCajas) {
        estado.estadoJuego = 'ganado';
        mostrarMensaje("🎉 ¡Nivel superado! Has colocado todas las cajas en su lugar.", true);
        document.getElementById('btn-reiniciar').disabled = true;
    } else if (estado.estadoJuego === 'jugando') {
         // Si no se ha ganado, el botón de reiniciar está activo.
    }
}

/**
 * Muestra un mensaje temporal en la interfaz.
 * @param {string} mensaje El texto a mostrar.
 * @param {boolean} esExito Indica si es un mensaje de éxito (ganado).
 */
function mostrarMensaje(mensaje, esExito) {
    const msgElement = document.getElementById('mensaje-juego');
    msgElement.textContent = mensaje;
    msgElement.classList.remove('hidden');

    if (esExito) {
        msgElement.style.backgroundColor = '#d4edda'; // Verde claro de éxito
        msgElement.style.borderColor = 'var(--color-success)';
    } else {
        msgElement.style.backgroundColor = '#fff3cd';
        msgElement.style.borderColor = 'var(--color-secondary)';
    }

    // Ocultar el mensaje después de 4 segundos
    setTimeout(() => {
        msgElement.classList.add('hidden');
    }, 4000);
}


/**
 * Renderiza todo el estado del juego en el DOM (F1.6, F2.1 - F3.2)
*/
function dibujar() {
    const mapaContainer = document.getElementById('mapa');
    if (!mapaContainer) return;

    // Limpiar y reconstruir la grilla completa
    mapaContainer.innerHTML = '';

    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.setAttribute('data-x', x);
            tile.setAttribute('data-y', y);

            // Determinar el tipo de casillero basado en el mapa de estado
            let type = estado.mapa[y][x];
            if (type === '#') {
                tile.classList.add('pared');
            } else if (type === '.') {
                tile.classList.add('piso');
                // Si es un objetivo, lo marcamos con el atributo data-type para CSS
                const isObjective = estado.objetivos.some(obj => obj.x === x && obj.y === y);
                if (isObjective) {
                    tile.setAttribute('data-type', 'objetivo');
                } else {
                     tile.setAttribute('data-type', 'piso');
                }
            } else {
                 // Si es un espacio vacío o inicial, lo tratamos como piso por defecto
                tile.classList.add('piso');
                tile.setAttribute('data-type', 'piso');
            }

            // Sobrescribir el tipo si hay elementos dinámicos (Cajas, Jugador)
            let elementPlaced = false;

            if (x === estado.playerPos.x && y === estado.playerPos.y) {
                tile.setAttribute('data-type', 'jugador');
                elementPlaced = true;
            } else if (estado.boxes.some(box => box.x === x && box.y === y)) {
                tile.setAttribute('data-type', 'caja');
                elementPlaced = true;
            }

            mapaContainer.appendChild(tile);
        }
    }

    // Actualizar HUD (F3.2)
    document.getElementById('movimiento-contador').textContent = estado.movimientos;
    document.getElementById('nivel-display').textContent = `${estado.nivelActual} / ${estado.maxNivel}`;

    // Habilitar/Deshabilitar botones según el estado del juego
    const btnReiniciar = document.getElementById('btn-reiniciar');
    const btnProximoNivel = document.getElementById('btn-proximo-nivel');

    if (estado.estadoJuego === 'ganado') {
        btnReiniciar.disabled = true;
        btnProximoNivel.disabled = false; // Permite avanzar al siguiente nivel
    } else if (estado.estadoJuego !== 'jugando') {
         // Si por alguna razón el estado no es jugable, deshabilitar ambos
        btnReiniciar.disabled = true;
        btnProximoNivel.disabled = true;
    } else {
        btnReiniciar.disabled = false; // Siempre activo mientras se juega
        btnProximoNivel.disabled = false;
    }
}

// =============================================================================
// MANEJO DE EVENTOS Y CONTROLADOR (F4.1, F4.2)
// =============================================================================

/**
 * Maneja el movimiento del jugador basado en la tecla presionada.
 * @param {KeyboardEvent} e Evento de teclado.
 */
function handleKeydown(e) {
    let dx = 0;
    let dy = 0;

    switch (e.key) {
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
            return; // Ignorar otras teclas
    }

    e.preventDefault(); // Prevenir el scroll de la página
    intentarMover(dx, dy);
}

/**
 * Reinicia el nivel actual al estado inicial (F4.4).
 */
function reiniciarNivel() {
    // Volver a cargar los datos del nivel actual para resetear posiciones y movimientos
    cargarNivel(estado.nivelActual - 1);
    mostrarMensaje("🔄 Nivel reiniciado. ¡Inténtalo de nuevo!", false);
}

/**
 * Avanza al siguiente nivel (F4.7).
 */
function proximoNivel() {
    if (estado.nivelActual >= estado.maxNivel) {
        mostrarMensaje("🏆 ¡Has completado todos los niveles! ¡Excelente trabajo!", true);
        return;
    }

    const nextLevelIndex = estado.nivelActual; // El índice es Nivel - 1
    cargarNivel(nextLevelIndex);
    mostrarMensaje(`🚀 Iniciando el Nivel ${estado.nivelActual + 1}...`, false);
}


/**
 * Función de inicialización principal (A3).
 */
function iniciar() {
    // 1. Event Listeners para Teclado (R4)
    document.addEventListener('keydown', handleKeydown);

    // 2. Event Listeners para Botones (R2)
    document.getElementById('btn-reiniciar').addEventListener('click', reiniciarNivel);
    document.getElementById('btn-proximo-nivel').addEventListener('click', proximoNivel);

    // 3. Cargar el primer nivel al iniciar la aplicación
    cargarNivel(0);
}

// Ejecutar la inicialización cuando el script se carga
iniciar();
