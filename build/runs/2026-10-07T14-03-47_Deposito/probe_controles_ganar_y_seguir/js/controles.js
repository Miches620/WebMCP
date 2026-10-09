let nivelActual = 0;
let estado;

/**
 * Inicializa el juego o reinicia un nivel específico.
 * @param {number} i - El índice del nivel a cargar (0-based).
 */
function iniciarNivel(i) {
    if (!NIVELES[i]) {
        console.error("Nivel no encontrado en el índice:", i);
        return;
    }

    nivelActual = i;
    // 1. Crear el estado inicial usando las reglas del juego
    estado = Reglas.crearEstado(NIVELES[i]);

    // 2. Limpiar mensajes y dibujar la escena
    document.getElementById('mensaje').textContent = '';
    dibujar(estado, nivelActual + 1);
}

/**
 * Maneja el movimiento del operario basado en las teclas presionadas.
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

    // Guardamos el estado actual para poder compararlo después del intento de movimiento
    const estadoAnterior = estado; 

    // 1. Calcular el nuevo estado después del intento de movimiento
    const nuevoEstado = Reglas.mover(estadoAnterior, direccion);

    // Verificamos si hubo un movimiento exitoso (el contador debe haber aumentado)
    if (nuevoEstado.movimientos > estadoAnterior.movimientos) {
        // 2. Actualizar el estado global solo si fue exitoso
        estado = nuevoEstado;

        // 3. Dibujar la nueva escena y actualizar HUD
        dibujar(estado, nivelActual + 1);

        // 4. Verificar si se ganó el nivel
        if (Reglas.ganado(estado)) {
            document.getElementById('mensaje').textContent = "¡Nivel completado! 🎉";
        } else {
             // Si hubo movimiento pero no ganamos, limpiamos cualquier mensaje de éxito anterior
            document.getElementById('mensaje').textContent = ""; 
        }
    }
    // Si el movimiento falló (colisión), 'estado' permanece igual y nada se dibuja ni se actualiza.
}

/**
 * Maneja el clic en el botón Reiniciar.
 */
function manejarReiniciar() {
    iniciarNivel(nivelActual);
}

/**
 * Maneja el clic en el botón Siguiente Nivel.
 */
function manejarSiguienteNivel() {
    const siguienteIndice = nivelActual + 1;
    if (NIVELES[siguienteIndice]) {
        iniciarNivel(siguienteIndice);
    } else {
        document.getElementById('mensaje').textContent = "¡Felicidades! Has completado todos los niveles.";
        // Deshabilitar botón si no hay más niveles
        document.getElementById('btn-siguiente').disabled = true;
    }
}

// --- Inicialización de Event Listeners y Juego ---

// 1. Listener para el teclado (Flechas)
document.addEventListener('keydown', manejarMovimientoTeclado);

// 2. Listeners para los botones
document.getElementById('btn-reiniciar').addEventListener('click', manejarReiniciar);
document.getElementById('btn-siguiente').addEventListener('click', manejarSiguienteNivel);


// 3. Iniciar el juego en el Nivel 1 (índice 0) al cargar la página
iniciarNivel(0);
