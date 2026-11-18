/**
 * Genera una secuencia de letras del alfabeto para las columnas (A, B, C...)
 * @param {number} count - Número de columnas a generar.
 * @returns {string[]} Array con las letras correspondientes.
 */
function generateColumnLetters(count) {
    const letters = [];
    for (let i = 0; i < count; i++) {
        // ASCII code for 'A' is 65. We add the index (i) to get B, C, etc.
        letters.push(String.fromCharCode(65 + i));
    }
    return letters;
}

/**
 * Inicializa la funcionalidad de edición y manejo de eventos para todas las celdas de datos.
 */
function initializeCellEditing() {
    const dataCells = document.querySelectorAll('#spreadsheet-grid tbody td');
    const colorPicker = document.getElementById('cell-background-color');
    let activeCell = null;

    // 1. Manejar eventos en las celdas de datos
    dataCells.forEach(cell => {
        // Listener para el evento 'input' (se dispara al escribir)
        cell.addEventListener('focus', function() {
            clearActiveState(activeCell);
            this.classList.add('highlighted');
            activeCell = this;
        });

        cell.addEventListener('blur', function() {
            // Al perder foco, removemos la clase de resaltado
            this.classList.remove('highlighted');
            activeCell = null;
        });


        // Listener para el evento 'click' (más robusto que solo focus para algunos casos)
        cell.addEventListener('click', function() {
             clearActiveState(activeCell);
             this.classList.add('highlighted');
             activeCell = this;
        });

    });


    // 2. Manejar eventos en el selector de color (Color Picker)
    colorPicker.addEventListener('input', function() {
        const selectedColor = this.value;

        if (activeCell && !isColumnSelected()) { // Solo aplica si no estamos seleccionando una columna entera
            handleColorChange(activeCell, selectedColor);
        } else if (isColumnSelected()) {
             // Si está seleccionada la columna, se debe usar el botón de acción para aplicar color.
             console.log("Por favor, use el botón '🎨 Rellenar Color Columna' para seleccionar fondo en toda la columna.");
        } else {
            console.log("Por favor, haga clic en una celda primero para seleccionar su fondo.");
        }
    });
}

/**
 * Maneja el contenido de una celda cuando se modifica (input event).
 * @param {HTMLElement} cell - La celda que ha sido editada.
 */
function handleCellInput(cell) {
    const newValue = cell.innerText.trim();
    const cellCoordinates = cell.dataset.cell;

    if (!cellCoordinates) return;

    console.log(`[Evento de entrada detectado] Celda ${cellCoordinates} actualizada a: "${newValue}"`);

    // En un entorno real, aquí se enviaría el valor a un modelo o estado central.
    // Por ahora, solo confirmamos que la lectura del texto funciona correctamente.
    if (newValue) {
        console.log(`Valor capturado exitosamente para ${cellCoordinates}.`);
    } else {
        console.log(`Celda ${cellCoordinates} vacía.`);
    }
}

/**
 * Función principal de inicialización que prepara la hoja de cálculo y los listeners de columna.
 */
function initSpreadsheet() {
    // 1. Cargar estado guardado al iniciar la página (R9)
    loadSpreadsheetState();

    // 2. Inicializar los eventos de edición en todas las celdas (R1)
    initializeCellEditing();

    // 3. Asignar selectores a los encabezados de columna
    const columnSelectors = document.querySelectorAll('.column-selector');
    columnSelectors.forEach(header => {
        header.addEventListener('click', function() {
            selectColumn(this);
        });
    });

    // 4. Asignar listeners de guardado a todas las celdas editables (R9)
    const editableCells = document.querySelectorAll('.spreadsheet-grid td[contenteditable="true"]');
    editableCells.forEach(cell => {
        // Usamos 'input' para guardar inmediatamente mientras se escribe, y 'blur' como respaldo.
        cell.addEventListener('input', () => handleCellInput(cell));
        cell.addEventListener('blur', () => handleCellInput(cell)); 
    });

    // 5. Inicializar listeners de acciones
    document.getElementById('delete-column-btn').addEventListener('click', deleteSelectedColumn);
    document.getElementById('clear-column-content-btn').addEventListener('click', clearSelectedColumnContent);
    document.getElementById('color-fill-column-btn').addEventListener('click', colorFillSelectedColumn);


    console.log("Hoja de Cálculo inicializada con éxito.");
    console.log("Prueba: Ahora puedes hacer clic y escribir directamente en cualquier celda para probar la funcionalidad inline.");
}

// Llamada única que arranca la aplicación
document.addEventListener('DOMContentLoaded', initSpreadsheet);

/**
 * Limpia el estado visual de todas las celdas.
 * @param {HTMLElement} oldCell - Celda a limpiar (si existe).
 */
function clearActiveState(oldCell) {
    if (oldCell && !oldCell.classList.contains('column-selected')) {
        oldCell.classList.remove('highlighted');
    }
}

/**
 * Selecciona una columna haciendo clic en su letra de encabezado.
 * @param {HTMLElement} headerElement - El <th> que contiene la letra de la columna.
 */
function selectColumn(headerElement) {
    const colIndex = parseInt(headerElement.dataset.colIndex);
    if (isNaN(colIndex)) return;

    // Limpiar selección previa
    document.querySelectorAll('.column-selector').forEach(h => h.classList.remove('selected'));
    document.getElementById('spreadsheet-grid').querySelectorAll('tbody td, th').forEach(cell => {
        cell.classList.remove('column-selected');
    });

    // Marcar selección actual en el encabezado y las celdas de la columna
    headerElement.classList.add('selected');

    const columnCells = document.querySelectorAll(`[data-col-index="${colIndex}"]`);
    columnCells.forEach(cell => {
        if (cell.tagName === 'TD' || cell.tagName === 'TH') { // Aplica a celdas de datos y headers si es necesario
            cell.classList.add('column-selected');
        }
    });

    // Habilitar controles de acción
    document.getElementById('delete-column-btn').disabled = false;
    document.getElementById('clear-column-content-btn').disabled = false;
    document.getElementById('color-fill-column-btn').disabled = false;

    console.log(`Columna ${headerElement.dataset.columnLetter} seleccionada (Índice: ${colIndex}).`);
}

/**
 * Verifica si actualmente hay una columna seleccionada por el usuario.
 * @returns {boolean} True si está seleccionado, False en caso contrario.
 */
function isColumnSelected() {
    const selectedHeader = document.querySelector('.column-selector.selected');
    return !!selectedHeader;
}

/**
 * Obtiene las coordenadas de la columna seleccionada.
 * @returns {{index: number, letter: string}|null}
 */
function getSelectedColumnInfo() {
    const selectedHeader = document.querySelector('.column-selector.selected');
    if (selectedHeader) {
        return {
            index: parseInt(selectedHeader.dataset.colIndex),
            letter: selectedHeader.dataset.columnLetter
        };
    }
    return null;
}

/**
 * Borra completamente la columna seleccionada de la grilla.
 */
function deleteSelectedColumn() {
    const colInfo = getSelectedColumnInfo();
    if (!colInfo) return;

    const columnIndex = colInfo.index;
    const gridBody = document.querySelector('#spreadsheet-grid tbody');
    const rows = gridBody.querySelectorAll('tr');

    // 1. Eliminar celdas de datos de todas las filas
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].remove();
        }
    });

    // 2. Eliminar el encabezado de la columna delad 'thead'
    const headerCells = document.querySelector('#spreadsheet-grid thead tr').children;
    let headerIndex = -1;
    for (let i = 0; i < headerCells.length; i++) {
        if (headerCells[i].dataset.colIndex == columnIndex) {
            headerCells[i].remove();
            break;
        }
    }

    // Deseleccionar y limpiar controles
    document.querySelectorAll('.column-selector').forEach(h => h.classList.remove('selected'));
    document.getElementById('spreadsheet-grid').querySelectorAll('tbody td, th').forEach(cell => {
        cell.classList.remove('column-selected');
    });
    clearActionButtons();

    console.log(`Columna ${colInfo.letter} eliminada con éxito.`);
}


/**
 * Limpia el contenido de todas las celdas de la columna seleccionada, manteniendo la estructura HTML.
 */
function clearSelectedColumnContent() {
    const colInfo = getSelectedColumnInfo();
    if (!colInfo) return;

    const columnIndex = colInfo.index;
    const gridBody = document.querySelector('#spreadsheet-grid tbody');
    const rows = gridBody.querySelectorAll('tr');

    // 1. Limpiar celdas de datos
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].innerHTML = ''; // Vaciar contenido, mantener el elemento
            cells[columnIndex].textContent = '';
        }
    });

    // 2. Limpiar la celda de encabezado si lo hubiera
    const headerCells = document.querySelector('#spreadsheet-grid thead tr').children;
    if (headerCells[columnIndex]) {
         headerCells[columnIndex].innerHTML = '';
    }


    console.log(`Contenido de la columna ${colInfo.letter} limpiado con éxito.`);
}

/**
 * Rellena el fondo de color en todas las celdas de la columna seleccionada.
 */
function colorFillSelectedColumn() {
    const colInfo = getSelectedColumnInfo();
    if (!colInfo) return;

    const selectedColor = document.getElementById('cell-background-color').value;
    const columnIndex = colInfo.index;
    const gridBody = document.querySelector('#spreadsheet-grid tbody');
    const rows = gridBody.querySelectorAll('tr');

    // 1. Aplicar color a celdas de datos
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
            cells[columnIndex].style.backgroundColor = selectedColor;
            cells[columnIndex].classList.add('highlighted'); // Mantener el resaltado visual
        }
    });

    // 2. Aplicar color al encabezado de la columna
     const headerCells = document.querySelector('#spreadsheet-grid thead tr').children;
    if (headerCells[columnIndex]) {
         headerCells[columnIndex].style.backgroundColor = selectedColor + '80'; // Ligeramente más oscuro para diferenciarlo
    }

    console.log(`Columna ${colInfo.letter} rellena con color: ${selectedColor}`);
}


/**
 * Mantiene el estado de los botones de acción sincronizado con la selección de columna.
 */
function updateColumnSelectionState() {
    const isSelected = !!document.querySelector('.column-selector.selected');
    const buttons = [
        document.getElementById('delete-column-btn'),
        document.getElementById('clear-column-content-btn'),
        document.getElementById('color-fill-column-btn')
    ];

    buttons.forEach(btn => {
        btn.disabled = !isSelected;
    });
}

/**
 * Resetea el estado de los botones a deshabilitado (útil después de borrar una columna).
 */
function clearActionButtons() {
     document.getElementById('delete-column-btn').disabled = true;
     document.getElementById('clear-column-content-btn').disabled = true;
     document.getElementById('color-fill-column-btn').disabled = true;
}


/**
 * Maneja el cambio de color para una celda individual (usado por el Color Picker).
 * @param {HTMLElement} cell - La celda que ha sido editada.
 * @param {string} color - El nuevo código de color.
 */
function handleColorChange(cell, color) {
    // Solo aplicar si no estamos en modo de selección de columna completa
    if (isColumnSelected()) return;

    cell.style.backgroundColor = color;
    cell.classList.add('highlighted');

    console.log(`Fondo de ${cell.dataset.cell} cambiado a: ${color}`);
}
