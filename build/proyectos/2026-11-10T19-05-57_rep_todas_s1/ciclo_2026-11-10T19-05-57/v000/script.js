/**
 * R1: Maneja el evento de cambio en las celdas editables.
 * Cuando un usuario escribe o pega contenido, esta función captura el valor 
 * y lo registra (simulando que se actualiza algún estado global).
 * @param {Event} event El evento de cambio ocurrido en el elemento.
 */
function handleCellChange(event) {
    const cell = event.target;
    const cellId = cell.getAttribute('data-cell');
    const newValue = cell.innerText.trim();

    if (cellId && newValue !== "") {
        console.log(`Celda ${cellId} actualizada: "${newValue}"`);
        // Aquí iría la lógica real para guardar o procesar el valor en un sistema de estado.
    } else if (cellId && newValue === "") {
         console.log(`Celda ${cellId} vacía.`);
    }
}

/**
 * Inicializa los listeners de eventos en todas las celdas del tablero.
 * Esto garantiza que cualquier interacción con una celda editable sea capturada.
 */
function initializeSheet() {
    // Selecciona todos los <td> que tienen el atributo contenteditable="true"
    const cells = document.querySelectorAll('td[contenteditable="true"]');

    if (cells.length === 0) {
        console.warn("No se encontraron celdas editables en la hoja.");
        return;
    }

    // Adjunta el listener de 'input' y 'blur' a cada celda.
    // Usamos 'input' para cambios mientras tecleas, y 'blur' cuando sales de la celda.
    cells.forEach(cell => {
        // Listener para captura inmediata durante la escritura
        cell.addEventListener('input', handleCellChange); 
        // Listener adicional al salir de la celda (mejor práctica)
        cell.addEventListener('blur', handleCellChange); 
    });

    console.log("Hoja de cálculo inicializada y lista para editar.");
}


/**
 * Función principal que arranca la aplicación.
 */
function startApp() {
    // Se llama a la función de inicialización del tablero.
    initializeSheet();
}

// --- Llamada de inicio de la aplicación ---
window.onload = startApp;
