let nivelActual = 0;
let estado;

/**
 * Inicializa el juego o reinicia un nivel específico.
 * @param {number} i - El índice del nivel a cargar (empezando en 0).
 */
function iniciarNivel(i) {
    nivelActual = i;
    // Crear el nuevo estado basado en los niveles definidos
    estado = Reglas.crearEstado(NIVELES[i]);

    // Limpiar mensajes y dibujar la escena inicial
    document.getElementById('mensaje').textContent = "¡Acomoda las cajas!";
    dibujar(estado, nivelActual + 1);
}

/**
 * Maneja el movimiento del avatar basado en la entrada de teclado.
 */
function manejarMovimientoTeclado(event) {
    // Si ya se ganó el nivel, ignorar los movimientos
    if (Reglas.ganado(estado)) {
        return;
    }

    let direccion = null;
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
    }

    if (direccion) {
        event.preventDefault();
        // Calcular el nuevo estado con el movimiento
        estado = Reglas.mover(estado, direccion);
        dibujar(estado, nivelActual + 1);

        // Verificar si se ganó el nivel después del movimiento
        if (Reglas.ganado(estado)) {
            document.getElementById('mensaje').textContent = "¡Nivel completado!";
        } else if (estado.movimientos > estado.cajas.length * 2) {
             // Ejemplo de mensaje si se quiere añadir un límite o advertencia, aunque no está en el contrato.
             // Lo dejamos simple por ahora: solo el mensaje de victoria.
        }
    }
}

/**
 * Configura los listeners de eventos para botones y teclado.
 */
function configurarListeners() {
    // Listener global para las flechas del teclado
    document.addEventListener('keydown', manejarMovimientoTeclado);

    // Botón Reiniciar Nivel
    document.getElementById('btn-reiniciar').onclick = function() {
        iniciarNivel(nivelActual);
    };

    // Botón Siguiente Nivel
    document.getElementById('btn-siguiente').onclick = function() {
        if (nivelActual < NIVELES.length - 1) {
            const siguienteNivelIndex = nivelActual + 1;
            iniciarNivel(siguienteNivelIndex);
        } else {
            document.getElementById('mensaje').textContent = "¡Has completado todos los niveles!";
            // Deshabilitar el botón si no hay más niveles
            this.disabled = true;
        }
    };
}

// Inicialización del juego al cargar la página
configurarListeners();
iniciarNivel(0);
