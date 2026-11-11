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

    // 2. Configurar el selector de color para cambiar fondos (R5)
    setupColorPicker();
}


// Llamada única para arrancar la aplicación cuando el script se carga.
initializeSpreadsheet();

function setupColorPicker() {
    const colorPicker = document.getElementById('background-color-picker');
    const spreadsheetBody = document.getElementById('spreadsheet-body');

    if (!colorPicker || !spreadsheetBody) {
        console.error("Error: No se encontraron los elementos del selector de color o el cuerpo de la hoja.");
        return;
    }

    // Event listener para cuando cambia el color seleccionado
    colorPicker.addEventListener('input', function(event) {
        const selectedColor = event.target.value;
        
        // Intentamos encontrar la celda actualmente enfocada (el elemento activo).
        // Usamos document.activeElement porque es más fiable que solo escuchar 'focusin' 
        // si el usuario hace clic en cualquier parte de la hoja y luego usa el color picker.
        const activeCell = document.activeElement;

        if (activeCell && activeCell.tagName === 'TD') {
            // Verificamos si es una celda editable antes de aplicar estilos.
            if (activeCell.hasAttribute('contenteditable')) {
                // Aplicar el color de fondo a la celda activa.
                activeCell.style.backgroundColor = selectedColor;
            } else {
                console.warn("El elemento activo no es una celda editable.");
            }
        } else {
             console.log("Ninguna celda visible está actualmente enfocada para aplicar el color de fondo.");
        }
    });
}
