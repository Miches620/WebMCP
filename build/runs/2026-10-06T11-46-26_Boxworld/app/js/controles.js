let nivelActual = 0;
let estado;

/**
 * Inicializa el juego o un nuevo nivel específico.
 * @param {number} i - El índice del nivel a cargar.
 */
function iniciarNivel(i) {
    if (!NIVELES || !NIVELES[i]) {
        console.error("Nivel no encontrado.");
        return;
    }

    // 1. Crear el estado inicial con las reglas
    estado = Reglas.crearEstado(NIVELES[i]);

    // 2. Limpiar mensajes y dibujar la escena
    document.getElementById('mensaje').textContent = '';
    dibujar(estado, nivelActual);
}

/**
 * Maneja el movimiento del jugador basado en las teclas presionadas.
 * @param {KeyboardEvent} e - El evento de teclado.
 */
function manejarTeclado(e) {
    let direccion;
    switch (e.key) {
        case 'ArrowUp':
            direccion = "arriba";
            break;
        case 'ArrowDown':
            direccion = "abajo";
            break;
        case 'ArrowLeft':
            direccion = "izquierda";
            break;
        case 'ArrowRight':
            direccion = "derecha";
            break;
        default:
            return; // No es una flecha de movimiento
    }

    e.preventDefault();

    // 1. Calcular el nuevo estado después del movimiento
    const nuevoEstado = Reglas.mover(estado, direccion);

    // 2. Actualizar el estado global
    estado = nuevoEstado;

    // 3. Dibujar la nueva escena y actualizar HUD
    dibujar(estado, nivelActual);

    // 4. Verificar si se ganó el nivel
    if (Reglas.ganado(estado)) {
        document.getElementById('mensaje').textContent = "¡Nivel completado!";
    }
}

/**
 * Maneja la acción de reiniciar el nivel actual.
 */
function manejarReiniciar() {
    // Reinicia el estado al inicial del nivel actual
    const nuevoEstado = Reglas.crearEstado(NIVELES[nivelActual]);
    estado = nuevoEstado;
    dibujar(estado, nivelActual);
    document.getElementById('mensaje').textContent = '';
}

/**
 * Maneja la acción de avanzar al siguiente nivel.
 */
function manejarSiguiente() {
    if (nivelActual < NIVELES.length - 1) {
        nivelActual++;
        iniciarNivel(nivelActual);
    } else {
        document.getElementById('mensaje').textContent = "¡Has completado todos los niveles!";
        // Deshabilitar botón de siguiente si no hay más niveles
        document.getElementById('btn-siguiente').disabled = true;
    }
}

// --- Inicialización de Event Listeners y Juego ---

// 1. Listener para el teclado (movimiento)
document.addEventListener('keydown', manejarTeclado);

// 2. Listener para el botón Reiniciar
document.getElementById('btn-reiniciar').addEventListener('click', manejarReiniciar);

// 3. Listener para el botón Siguiente Nivel
document.getElementById('btn-siguiente').addEventListener('click', manejarSiguiente);


// Iniciar el juego en el nivel 0 al cargar la página
iniciarNivel(0);
