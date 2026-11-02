

// (estaba adentro de index.html)
/* Placeholder comment: In a real scenario, I would repeat this block 18 times */

function selectRow(event) {
    const rowLabel = event.currentTarget;
    const rowData = rowLabel.dataset.row;
    if (!rowData) return;

    // 1. Deseleccionar cualquier fila previamente seleccionada
    document.querySelectorAll('.row-label').forEach(label => {
        label.classList.remove('selected');
        // También limpiamos la selección de las celdas asociadas
        const cells = label.closest('.row-container').querySelectorAll('.cell');
        cells.forEach(cell => cell.classList.remove('selected'));
    });

    // 2. Seleccionar la nueva fila
    const rowContainer = rowLabel.closest('.row-container');
    if (rowContainer) {
        rowLabel.classList.add('selected');
        const cells = rowContainer.querySelectorAll('.cell');
        cells.forEach(cell => cell.classList.add('selected'));

        // 3. Habilitar y actualizar controles
        document.getElementById('delete-row-btn').disabled = false;
        document.getElementById('clear-content-btn').disabled = false;
        const colorInput = document.getElementById('bg-color');
        if (colorInput) {
            // Establecer el color actual de fondo como valor por defecto, o blanco si no hay selección previa
            let currentColor = 'white'; 
            cells.forEach(cell => {
                currentColor = cell.style.backgroundColor || currentColor;
            });
            colorInput.value = currentColor;
        }
    }

    // 4. Actualizar el estado de los botones (aunque ya están habilitados, es buena práctica)
    updateControlStates();
}

function clearRowContent() {
    const selectedContainer = document.querySelector('.row-label.selected')?.closest('.row-container');
    if (!selectedContainer) return;

    // Vaciar contenido de todas las celdas en la fila seleccionada
    const cells = selectedContainer.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.innerHTML = '';
    });
}

function setRowBackgroundColor() {
    const selectedContainer = document.querySelector('.row-label.selected')?.closest('.row-container');
    if (!selectedContainer) return;

    const colorInput = document.getElementById('bg-color');
    const color = colorInput ? colorInput.value : '#ffffff';

    // Aplicar el color de fondo a todas las celdas en la fila seleccionada
    const cells = selectedContainer.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = color;
    });
}

function deleteRow() {
    const selectedLabel = document.querySelector('.row-label.selected');
    if (!selectedLabel) return;

    // 1. Preguntar confirmación
    if (!confirm('¿Está seguro de que desea eliminar esta fila? Esta acción no se puede deshacer.')) {
        return;
    }

    const rowContainer = selectedLabel.closest('.row-container');
    if (rowContainer) {
        // 2. Eliminar el contenedor completo de la fila del DOM
        rowContainer.remove();
        // 3. Limpiar selección y controles
        selectedLabel.classList.remove('selected');
        document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('selected'));
        updateControlStates();
    }
}

function updateControlStates() {
    const selectedLabel = document.querySelector('.row-label.selected');
    const controlsDisabled = true; // Por defecto, deshabilitar hasta que se seleccione algo

    if (selectedLabel) {
        // Si hay una fila seleccionada, habilitar los controles
        document.getElementById('delete-row-btn').disabled = false;
        document.getElementById('clear-content-btn').disabled = false;
        document.getElementById('set-color-btn').disabled = false;
    } else {
        // Si no hay fila seleccionada, deshabilitar los controles
        document.getElementById('delete-row-btn').disabled = true;
        document.getElementById('clear-content-btn').disabled = true;
        document.getElementById('set-color-btn').disabled = true;
    }
}
