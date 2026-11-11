/**
 * R1. Configura la edición inline para todas las celdas de la hoja de cálculo.
 * Utiliza delegación de eventos en el tbody para manejar los cambios de contenido
 * en cualquier celda editable (<td>).
 */
function setupCellEditing() {
    const spreadsheetBody = document.getElementById('spreadsheet-body');

    if (!spreadsheetBody) {
        console.error("Error: No se encontró el cuerpo de la hoja de cálculo con id 'spreadsheet-body'.");
        return;
    }

    // Usamos event delegation para escuchar cambios en cualquier <td> dentro del tbody.
    spreadsheetBody.addEventListener('input', function(event) {
        const target = event.target;

        // Verificamos si el elemento que disparó el evento es una celda de datos editable.
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            // En un entorno real, aquí se enviaría la actualización al backend o a un estado global.
            // Por ahora, solo confirmamos que el contenido fue escrito correctamente en la celda.
            const col = target.getAttribute('data-col');
            const row = target.getAttribute('data-row');
            const value = target.textContent;

            console.log(`Celda ${col}${row} actualizada: "${value}"`);
        }
    });

    // Opcional: Manejar el evento de foco para asegurar que la experiencia sea fluida al hacer clic.
    spreadsheetBody.addEventListener('focusin', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            // Esto simplemente asegura que el foco está en la celda correcta, lo cual es nativo, 
            // pero ayuda a confirmar la funcionalidad de edición.
            console.log(`Foco puesto en ${target.getAttribute('data-col')}${target.getAttribute('data-row')}. Listo para editar.`);
        }
    });
}

/**
 * Función principal que inicializa todas las funcionalidades de la hoja de cálculo.
 */
function initializeSpreadsheet() {
    // 1. Configurar la edición inline (R1)
    setupCellEditing();

    // Nota: La estructura de encabezados (A-J y 1-20) ya está definida en index.html,
    // por lo que solo necesitamos inicializar los eventos.
}


// Llamada única para arrancar la aplicación cuando el script se carga.
initializeSpreadsheet();
