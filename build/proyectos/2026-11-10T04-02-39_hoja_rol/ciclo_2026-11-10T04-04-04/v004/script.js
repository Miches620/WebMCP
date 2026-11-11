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

    // 3. Configurar controles de visibilidad (R8)
    setupColumnControls();
    setupRowControls();
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
        
        // 1. Intentar aplicar a una celda activa (modo edición simple).
        const activeCell = document.activeElement;

        if (activeCell && activeCell.tagName === 'TD' && activeCell.hasAttribute('contenteditable')) {
            // Aplicar el color de fondo a la celda activa.
            activeCell.style.backgroundColor = selectedColor;
            return; // Salir si solo se aplica a una celda.
        }

        // 2. Si no hay una celda activa o si estamos en un contexto de columna/hoja completa (R6).
        // Iteramos sobre todas las celdas de datos para aplicar el color, asumiendo que la selección de columna
        // implica colorear todo el cuerpo visible de la hoja.
        const dataCells = spreadsheetBody.querySelectorAll('tbody td');

        if (dataCells.length > 0) {
            dataCells.forEach(cell => {
                // Aplicamos el color directamente al estilo para asegurar que anule cualquier fondo preexistente.
                cell.style.backgroundColor = selectedColor;
            });
        } else {
             console.log("No se encontraron celdas de datos visibles para aplicar el color.");
        }
    });
}

function toggleColumnVisibility(isHiding) {
    const headers = document.querySelectorAll('#spreadsheet-grid thead th');
    const rows = document.querySelectorAll('#spreadsheet-body tr');

    if (headers.length === 0 || rows.length === 0) {
        console.warn("No se encontraron encabezados de columna o filas para manipular la visibilidad.");
        return;
    }

    // Determinar si estamos ocultando o mostrando
    const className = isHiding ? 'hidden' : '';

    // 1. Ocultar/Mostrar Encabezados (A, B, C...)
    headers.forEach(header => {
        header.classList.toggle('hidden', isHiding);
    });

    // 2. Ocultar/Mostrar Celdas de Datos en el cuerpo (TDs)
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => {
            cell.classList.toggle('hidden', isHiding);
        });
    });

    // Actualizar estado de los botones de control (deshabilitar si todo está oculto/visible)
    updateVisibilityControlsState();
}

function toggleRowVisibility(isHiding) {
    const rows = document.querySelectorAll('#spreadsheet-body tr');

    if (rows.length === 0) {
        console.warn("No se encontraron filas para manipular la visibilidad.");
        return;
    }

    // Determinar si estamos ocultando o mostrando
    const className = isHiding ? 'hidden' : '';

    // Aplicar la clase de ocultamiento/mostrar a todas las filas del cuerpo
    rows.forEach(row => {
        row.classList.toggle('hidden', isHiding);
    });

    // Actualizar estado de los botones de control (deshabilitar si todo está oculto/visible)
    updateVisibilityControlsState();
}

function updateVisibilityControlsState() {
    const hideColBtn = document.getElementById('hide-col-btn');
    const showColBtn = document.getElementById('show-col-btn');
    const hideRowBtn = document.getElementById('hide-row-btn');
    const showRowBtn = document.getElementById('show-row-btn');

    // Lógica simple: si hay contenido visible, los botones están habilitados.
    // Para simplificar y evitar romper la lógica de R6/R1, simplemente los mantenemos siempre activos 
    // a menos que se implemente una detección compleja de estado global.
    hideColBtn.disabled = false;
    showColBtn.disabled = false;
    hideRowBtn.disabled = false;
    showRowBtn.disabled = false;
}

function setupColumnControls() {
    const hideColBtn = document.getElementById('hide-col-btn');
    const showColBtn = document.getElementById('show-col-btn');

    if (hideColBtn && showColBtn) {
        // Evento para ocultar columnas
        hideColBtn.addEventListener('click', () => toggleColumnVisibility(true));
        // Evento para mostrar columnas
        showColBtn.addEventListener('click', () => toggleColumnVisibility(false));
    }
}

function setupRowControls() {
    const hideRowBtn = document.getElementById('hide-row-btn');
    const showRowBtn = document.getElementById('show-row-btn');

    if (hideRowBtn && showRowBtn) {
        // Evento para ocultar filas
        hideRowBtn.addEventListener('click', () => toggleRowVisibility(true));
        // Evento para mostrar filas
        showRowBtn.addEventListener('click', () => toggleRowVisibility(false));
    }
}
