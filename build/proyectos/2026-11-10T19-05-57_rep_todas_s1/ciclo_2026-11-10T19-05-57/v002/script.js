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
    // 1. Listener para celdas editables (R1)
    const cells = document.querySelectorAll('td[contenteditable="true"]');

    if (cells.length === 0) {
        console.warn("No se encontraron celdas editables en la hoja.");
        return;
    }

    cells.forEach(cell => {
        // Listener para captura inmediata durante la escritura
        cell.addEventListener('input', handleCellChange); 
        // Listener adicional al salir de la celda (mejor práctica)
        cell.addEventListener('blur', handleCellChange); 
    });

    console.log("Hoja de cálculo inicializada y lista para editar.");

    // 2. Inicializar controles de columna (R6)
    initializeColumnControls();
}


/**
 * Función principal que arranca la aplicación.
 */
function startApp() {
    // Se llama a la función de inicialización del tablero, incluyendo ahora los controles de columna.
    initializeSheet();
}

// --- Llamada de inicio de la aplicación ---
window.onload = startApp;

/**
 * Inicializa los listeners de eventos para la gestión de columnas (borrar/limpiar).
 * Asigna un manejador a cada botón de borrado de columna.
 */
function initializeColumnControls() {
    const deleteButtons = document.querySelectorAll('.delete-column-btn');

    if (deleteButtons.length === 0) return;

    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation(); // Detiene la propagación del evento para evitar disparadores innecesarios en el contenedor padre

            const colHeader = this.closest('.col-header');
            if (!colHeader) return;

            // Obtener la letra de la columna asociada (A, B, C...)
            const colLetter = colHeader.getAttribute('data-col-letter');
            if (!colLetter) {
                console.error("No se pudo determinar la letra de la columna.");
                return;
            }

            // 1. Seleccionar todas las celdas del cuerpo (tbody)
            const bodyRows = document.querySelector('tbody').querySelectorAll('tr');
            const columnCells = [];

            bodyRows.forEach(row => {
                // Las celdas de datos en una fila están en orden A, B, C...
                const cellsInRow = row.querySelectorAll('td[contenteditable="true"]');
                
                // Calcular el índice basado en la letra ('A' -> 0, 'B' -> 1, etc.)
                const colIndex = colLetter.charCodeAt(0) - 'A'.charCodeAt(0);

                if (colIndex >= 0 && colIndex < cellsInRow.length) {
                    // Añadir la celda correspondiente a esta columna en esta fila
                    columnCells.push(cellsInRow[colIndex]);
                }
            });

            // 2. Limpiar el contenido de todas las celdas encontradas para esa columna
            let clearedCount = 0;
            columnCells.forEach(cell => {
                cell.innerText = ''; // Borra el texto visible
                cell.innerHTML = ''; // Asegura que cualquier contenido HTML interno también se borre
                clearedCount++;
            });

            console.log(`Columna ${colLetter} vaciada exitosamente: ${clearedCount} celdas limpiadas.`);
        });
    });
}
