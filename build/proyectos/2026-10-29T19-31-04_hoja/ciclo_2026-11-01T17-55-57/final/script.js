

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

function toggleColumnVisibility(columnLabel) {
    const colName = columnLabel.dataset.col;
    if (!colName) return;

    // 1. Obtener todos los elementos de la columna (incluyendo el header label)
    const cellsToToggle = document.querySelectorAll(`.cell[data-col="${colName}"]`);
    const headerLabel = document.querySelector(`.col-label[data-col="${colName}"]`);

    let isHidden = headerLabel.classList.contains('hidden');

    if (isHidden) {
        // Mostrar columna
        cellsToToggle.forEach(cell => cell.classList.remove('hidden'));
        headerLabel.classList.remove('hidden');
        console.log(`Columna ${colName} mostrada.`);
    } else {
        // Ocultar columna
        cellsToToggle.forEach(cell => cell.classList.add('hidden'));
        headerLabel.classList.add('hidden');
        console.log(`Columna ${colName} oculta.`);
    }

    // 2. Actualizar la selección y los controles después de ocultar/mostrar
    // Esto es crucial para que el estado visual sea correcto.
    const selectedRow = document.querySelector('.row-label.selected')?.closest('.row-container');
    if (selectedRow) {
        // Si había una fila seleccionada, forzamos la deselección y reselección para actualizar los estilos de las celdas visibles.
        document.querySelectorAll('.row-label').forEach(label => label.classList.remove('selected'));
        const newSelectedLabel = selectedRow.querySelector('.row-label');
        if (newSelectedLabel) {
            newSelectedLabel.click(); // Re-ejecuta la lógica de selección
        }
    }
}

function toggleRowVisibility(rowLabel) {
    const rowData = rowLabel.dataset.row;
    if (!rowData) return;

    // 1. Obtener el contenedor completo de la fila
    const rowContainer = rowLabel.closest('.row-container');
    if (!rowContainer) return;

    let isHidden = rowContainer.querySelector('.row-label').classList.contains('hidden');

    if (isHidden) {
        // Mostrar fila
        rowContainer.querySelectorAll('.cell, .row-label').forEach(el => el.classList.remove('hidden'));
        console.log(`Fila ${rowData} mostrada.`);
    } else {
        // Ocultar fila
        rowContainer.classList.add('hidden');
        rowLabel.classList.add('hidden'); // También ocultamos la etiqueta de la fila
        console.log(`Fila ${rowData} oculta.`);
    }

    // 2. Actualizar el estado de selección y controles
    const selectedLabel = document.querySelector('.row-label.selected');
    if (selectedLabel) {
        // Si se ocultó la fila seleccionada, deseleccionamos todo
        if (rowContainer === selectedLabel.closest('.row-container')) {
            selectedLabel.classList.remove('selected');
            document.querySelectorAll('.cell').forEach(cell => cell.classList.remove('selected'));
        }
    }
    updateControlStates();
}

function initializeColumnListeners() {
    // Asignar listeners a todos los encabezados de columna (A, B, C...)
    document.querySelectorAll('.col-label').forEach(label => {
        label.addEventListener('click', function() {
            // Al hacer clic en la etiqueta de la columna, simplemente seleccionamos esa columna para que el usuario pueda ver su estado.
            // Esto es útil si se implementa un menú contextual más avanzado.
            // Por ahora, solo nos aseguramos de que la selección funcione correctamente.
        });
    });

    // Inicializar los listeners de las etiquetas de fila (1, 2, 3...)
    document.querySelectorAll('.row-label').forEach(label => {
        label.addEventListener('click', selectRow);
    });
}
