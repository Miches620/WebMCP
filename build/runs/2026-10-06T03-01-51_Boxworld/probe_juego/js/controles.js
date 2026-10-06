let nivelActual = 0;
let estado;

/**
 * Inicializa el juego o un nuevo nivel específico.
 * @param {number} i - El índice del nivel a cargar.
 */
function iniciarNivel(i) {
    // Verificar si NIVELES está definido y si existe el nivel solicitado
    if (typeof NIVELES === 'undefined' || !NIVELES[i]) {
        document.getElementById('mensaje').textContent = "¡No hay más niveles!";
        return;
    }

    nivelActual = i;
    // Crear el estado inicial usando la lógica de reglas
    estado = Reglas.crearEstado(NIVELES[i]);
    
    // Limpiar mensajes y dibujar la escena
    document.getElementById('mensaje').textContent = "";
    dibujar(estado, nivelActual);
}

/**
 * Maneja el movimiento del jugador basado en las teclas presionadas.
 */
function manejarMovimientoTeclado(event) {
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

    event.preventDefault();

    // 1. Calcular el nuevo estado después del intento de movimiento
    const nuevoEstado = Reglas.mover(estado, direccion);

    // Solo actualizamos si hubo un movimiento exitoso (el estado ha cambiado)
    if (nuevoEstado && nuevoEstado !== estado) {
        estado = nuevoEstado;
        dibujar(estado, nivelActual);

        // 2. Verificar condición de victoria
        if (Reglas.ganado(estado)) {
            document.getElementById('mensaje').textContent = "¡Nivel completado! 🎉";
        } else {
             document.getElementById('mensaje').textContent = "";
        }
    }
}

/**
 * Maneja el reinicio del nivel actual.
 */
function reiniciarNivel() {
    // Recrear el estado inicial usando los datos del nivel actual
    estado = Reglas.crearEstado(NIVELES[nivelActual]);
    dibujar(estado, nivelActual);
    document.getElementById('mensaje').textContent = "¡Reiniciado! Inténtalo de nuevo.";
}

/**
 * Maneja la transición al siguiente nivel.
 */
function siguienteNivel() {
    const proximoNivelIndex = nivelActual + 1;
    if (typeof NIVELES[proximoNivelIndex] !== 'undefined') {
        iniciarNivel(proximoNivelIndex);
        document.getElementById('mensaje').textContent = "¡Siguiente Nivel cargado!";
    } else {
        document.getElementById('mensaje').textContent = "🎉 ¡Has completado todos los niveles! 🎉";
        // Deshabilitar el botón de siguiente nivel si no hay más contenido
        document.getElementById('btn-siguiente').disabled = true;
    }
}

// --- Listeners Globales ---

// 1. Listener para las teclas de flecha (Movimiento)
document.addEventListener('keydown', manejarMovimientoTeclado);

// 2. Listener para el botón Reiniciar
document.getElementById('btn-reiniciar').addEventListener('click', reiniciarNivel);

// 3. Listener para el botón Siguiente Nivel
document.getElementById('btn-siguiente').addEventListener('click', siguienteNivel);


// --- Inicialización del Juego ---
// Inicia el juego cargando el nivel 0
iniciarNivel(0);
