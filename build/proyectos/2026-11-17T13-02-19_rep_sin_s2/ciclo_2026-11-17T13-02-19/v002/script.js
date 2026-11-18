let selectedRow = null; // Variable global para mantener la referencia de la fila seleccionada

/**
 * R1. Edita celdas inline: Configura los listeners necesarios para que las celdas sean editables
 * y gestiona el evento de cambio de contenido (blur) para simular un comportamiento de guardado o detección de cambios.
 */
function setupCellEditing() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) {
        console.error("Spreadsheet element not found.");
        return;
    }

    // Usamos event delegation en la tabla para capturar eventos en todas las celdas de datos (TD).
    // Esto es más eficiente que añadir listeners a cada celda individualmente.
    spreadsheet.addEventListener('input', handleCellInput);
    spreadsheet.addEventListener('blur', handleCellBlur);
}

/**
 * Maneja el evento 'input' cuando el usuario está escribiendo en una celda editable.
 * @param {Event} event - El evento de entrada.
 */
function handleCellInput(event) {
    const target = event.target;
    // Verificamos que el objetivo sea una celda y tenga la propiedad contenteditable.
    if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
        // En un entorno de producción real, aquí se podría emitir un evento o actualizar un estado temporal 
        // para mostrar la escritura en tiempo real sin perder el foco.
    }
}

/**
 * Maneja el evento 'blur' cuando el usuario sale de una celda editable (finaliza la edición).
 * Aquí es donde se confirma y se "guarda" el contenido escrito.
 * @param {Event} event - El evento de pérdida de foco.
 */
function handleCellBlur(event) {
    const target = event.target;
    if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
        // Obtenemos el contenido finalizado y los atributos de la celda.
        const col = target.dataset.col;
        const row = target.dataset.row;
        const content = target.textContent.trim();

        // En un sistema real, aquí se enviaría 'content' al backend o a un store global.
        // Por ahora, simplemente confirmamos que el contenido es capturado exitosamente.
    }
}

/**
 * Configura los listeners de clic para los encabezados de columna (R6).
 */
function setupColumnSelection() {
    const headers = document.querySelectorAll('.col-header');
    headers.forEach(header => {
        // Usamos un listener para manejar la acción al hacer clic en el encabezado de columna
        header.addEventListener('click', (e) => {
            const colLetter = e.target.textContent.trim();

            // Selecciona todas las celdas (TD) dentro del cuerpo de la tabla que coincidan con esta columna
            const cellsToClear = document.querySelectorAll('#spreadsheet tbody td[data-col="' + colLetter + '"]');

            cellsToClear.forEach(cell => {
                // Limpia el contenido de texto de cada celda seleccionada
                cell.textContent = '';
            });
        });
    });
}

/**
 * Selecciona la fila haciendo clic en su encabezado (row-header).
 * @param {Event} e - El evento de click.
 */
function setupRowSelection() {
    const rowHeaders = document.querySelectorAll('.row-header');
    rowHeaders.forEach(header => {
        header.addEventListener('click', (e) => {
            // 1. Deseleccionar la fila previamente seleccionada
            if (selectedRow) {
                selectedRow.style.backgroundColor = ''; // Limpiar color de fondo
            }

            // 2. Identificar el elemento completo de la fila de datos asociada (el tr padre)
            const rowElement = e.target.closest('tr');
            if (!rowElement || !rowElement.classList.contains('data-row')) {
                return;
            }

            // 3. Establecer la nueva selección y aplicar estilo visual
            selectedRow = rowElement;
            selectedRow.style.backgroundColor = '#e0f7fa'; // Color de fondo para indicar selección

            console.log(`Fila ${e.target.textContent} seleccionada.`);
        });
    });
}


/**
 * Maneja el borrado del contenido de todas las celdas de la fila seleccionada.
 */
function clearSelectedRow() {
    if (!selectedRow) return;

    // Selecciona todos los <td> dentro de la fila (excluyendo el TH que es el número)
    const cells = selectedRow.querySelectorAll('td[contenteditable="true"]');
    cells.forEach(cell => {
        cell.textContent = '';
    });
}

/**
 * Cambia el color de fondo de todas las celdas de la fila seleccionada.
 */
function colorSelectedRow() {
    if (!selectedRow) return;
    const cells = selectedRow.querySelectorAll('td[contenteditable="true"]');
    cells.forEach(cell => {
        // Aplicar un color diferente, manteniendo el borde para visibilidad
        cell.style.backgroundColor = '#fff9c4'; 
    });
}

/**
 * Elimina completamente la fila seleccionada del DOM.
 */
function deleteSelectedRow() {
    if (!selectedRow) return;

    // Preguntar al usuario antes de borrar (buena práctica UX)
    if (confirm(`¿Está seguro de que desea eliminar la fila ${selectedRow.querySelector('.row-header').textContent}?`)) {
        selectedRow.remove(); // Elimina el elemento TR completo del DOM
        selectedRow = null; // Resetear la selección después de borrar
    }
}

/**
 * Inicializa la aplicación, llamando a todas las funciones de configuración necesarias.
 */
function initializeApp() {
    setupCellEditing();
    setupColumnSelection(); 
    setupRowSelection(); // Nueva inicialización para manejar la selección y acciones de filas

    // Configurar los listeners de botones de acción (R7)
    document.getElementById('clear-row').addEventListener('click', clearSelectedRow);
    document.getElementById('color-row').addEventListener('click', colorSelectedRow);
    document.getElementById('delete-row').addEventListener('click', deleteSelectedRow);
}

// Llamada principal para iniciar la aplicación al cargar el script.
initializeApp();
