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
        // Guardar el valor actualizado en localStorage
        localStorage.setItem(cellId, newValue);
    } else if (cellId && newValue === "") {
         console.log(`Celda ${cellId} vacía.`);
         // Eliminar la clave de localStorage si la celda está vacía
         localStorage.removeItem(cellId);
    }
}

/**
 * Inicializa los listeners de eventos en todas las celdas del tablero.
 * Esto garantiza que cualquier interacción con una celda editable sea capturada.
 */
function initializeSheet() {
    // Paso 0: Cargar datos persistentes antes de añadir listeners.
    loadStateFromLocalStorage();

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

    // 3. Inicializar selección de filas (R7)
    initializeRowSelection();
}


/**
 * Función principal que arranca la aplicación.
 */
function startApp() {
    // Se llama a la función de inicialización del tablero, incluyendo ahora los controles de columna y las filas.
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

/**
 * Inicializa los listeners de eventos para la selección y manejo de filas (R7).
 * Añade un manejador a los números de fila en el tbody.
 */
function initializeRowSelection() {
    // Selecciona todos los <th> dentro de <tbody>, que contienen los números de fila
    const rowNumberHeaders = document.querySelectorAll('tbody th');

    if (rowNumberHeaders.length === 0) {
        console.warn("No se encontraron cabeceras de número de fila en el cuerpo.");
        return;
    }

    rowNumberHeaders.forEach(header => {
        // Usamos un listener para manejar el click
        header.addEventListener('click', function() {
            const rowNumber = this.innerText.trim();
            if (!rowNumber) return;

            console.log(`Fila ${rowNumber} seleccionada.`);

            // 1. Encontrar la fila completa (<tr>) que contiene este encabezado de número
            const row = this.closest('tr');
            if (!row) {
                console.error("No se pudo encontrar la fila contenedora.");
                return;
            }

            // 2. Seleccionar todas las celdas de datos (td[contenteditable="true"]) en esa fila
            const cellsToClear = row.querySelectorAll('td[contenteditable="true"]');

            if (cellsToClear.length === 0) {
                console.log(`La fila ${rowNumber} no contiene celdas editables para borrar.`);
                return;
            }

            // 3. Borrar el contenido de todas las celdas encontradas en la fila
            let clearedCount = 0;
            cellsToClear.forEach(cell => {
                cell.innerText = ''; // Limpiar texto visible
                cell.innerHTML = ''; // Asegurar limpieza de HTML interno
                clearedCount++;
            });

            console.log(`Fila ${rowNumber} limpiada exitosamente: ${clearedCount} celdas vaciadas.`);
        });
    });
}

function loadStateFromLocalStorage() {
    console.log("Cargando estado de la hoja desde LocalStorage...");
    const cells = document.querySelectorAll('td[contenteditable="true"]');

    let loadedCount = 0;
    cells.forEach(cell => {
        const cellId = cell.getAttribute('data-cell');
        if (cellId && localStorage.getItem(cellId) !== null) {
            const savedValue = localStorage.getItem(cellId);
            // Restaurar el texto guardado en la celda
            cell.innerText = savedValue; 
            loadedCount++;
        }
    });

    console.log(`Estado cargado exitosamente: ${loadedCount} celdas restauradas.`);
}
