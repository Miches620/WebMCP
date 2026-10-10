let nivelActual = 0;
let estado;

/**
 * Inicializa el juego en un nivel específico.
 * @param {number} i - El índice del nivel a cargar (0-based).
 */
function iniciarNivel(i) {
    nivelActual = i;
    // Crea el nuevo estado basado en los datos del nivel NIVELES[i]
    estado = Reglas.crearEstado(NIVELES[i]);

    // Limpia mensajes y dibuja la escena inicial
    document.getElementById('mensaje').textContent = '';
    dibujar(estado, nivelActual + 1);
}

/**
 * Maneja el movimiento del jugador basado en las teclas presionadas.
 * @param {KeyboardEvent} event - El evento de teclado.
 */
function manejarMovimientoTeclado(event) {
    event.preventDefault();

    let direccion;
    switch (event.key) {
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

    // 1. Calcular el nuevo estado después del intento de movimiento
    const nuevoEstado = Reglas.mover(estado, direccion);

    // Actualizar el estado siempre con el resultado calculado (éxito o fracaso)
    estado = nuevoEstado;

    // Redibujar el tablero para reflejar la nueva posición (o falta de ella)
    dibujar(estado, nivelActual + 1);

    // Verificar condición de victoria después del movimiento y redibujado.
    if (Reglas.ganado(estado)) {
        document.getElementById('mensaje').textContent = "¡Nivel completado!";
    } else if (!document.getElementById('mensaje').textContent) {
        // Si no hay mensaje, lo dejamos vacío o lo limpiamos si el jugador se mueve.
        // Para este caso, solo nos preocupamos por mostrar la victoria.
    }
}

/**
 * Maneja el clic del botón de reinicio.
 */
function manejarReiniciarNivel() {
    // Reinicia el estado a su configuración inicial para el nivel actual
    estado = Reglas.crearEstado(NIVELES[nivelActual]);
    document.getElementById('mensaje').textContent = '';
    dibujar(estado, nivelActual + 1);
}

/**
 * Maneja el clic del botón de siguiente nivel.
 */
function manejarSiguienteNivel() {
    const proximoNivelIndex = nivelActual + 1;
    // Verificar si existe un siguiente nivel en el array NIVELES
    if (proximoNivelIndex < NIVELES.length) {
        iniciarNivel(proximoNivelIndex);
    } else {
        document.getElementById('mensaje').textContent = "¡Has completado todos los niveles!";
        // Deshabilitar el botón de siguiente nivel si no hay más contenido
        document.getElementById('btn-siguiente').disabled = true;
    }
}

// --- Listeners de Eventos ---

// Listener para las teclas de flecha (Movimiento)
document.addEventListener('keydown', manejarMovimientoTeclado);

// Listener para el botón Reiniciar
document.getElementById('btn-reiniciar').addEventListener('click', manejarReiniciarNivel);

// Listener para el botón Siguiente Nivel
document.getElementById('btn-siguiente').addEventListener('click', manejarSiguienteNivel);


// --- Inicio del Juego ---
iniciarNivel(0);
