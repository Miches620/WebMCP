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
 * Inicializa la aplicación, llamando a todas las funciones de configuración necesarias.
 */
function initializeApp() {
    setupCellEditing();
    setupColumnSelection(); // Nueva inicialización para la selección de columnas
}

// Llamada principal para iniciar la aplicación al cargar el script.
initializeApp();
