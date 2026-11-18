/**
 * @fileoverview Script principal para la aplicación de hoja de cálculo.
 * Implementa la generación dinámica del grid y la edición inline.
 */

// Constantes globales
const NUM_COLUMNS = 10; // A-J
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const NUM_ROWS = 20;

// Estado Global de la Aplicación (FIX: Inicialización de variables globales)
let selectedColumnLetter = null;
let selectedRow = null;


/**
 * Genera el HTML completo para la cuadrícula de celdas (filas y columnas).
 * Sobrescribe o completa el contenido de #cell-grid.
 */
function initializeSpreadsheetGrid() {
    const spreadsheetContainer = document.getElementById('spreadsheet');
    if (!spreadsheetContainer) return;

    // 1. Determinar la fila de inicio (el número más alto encontrado + 1, asegurando un mínimo de 2).
    const rowLabels = spreadsheetContainer.querySelectorAll('.row-label[data-row]');
    let maxExistingRow = 0;
    rowLabels.forEach(label => {
        const rowNum = parseInt(label.dataset.row);
        if (!isNaN(rowNum) && rowNum > maxExistingRow) {
            maxExistingRow = rowNum;
        }
    });

    // Comenzamos a generar desde el siguiente número de fila disponible, con un mínimo de 2.
    let startRowIndex = Math.max(2, maxExistingRow + 1);


    for (let r = startRowIndex; r <= NUM_ROWS; r++) {
        let rowHtml = '';
        
        // 1. Generar etiqueta de fila (el número)
        rowHtml += `<div class="row-label" data-row="${r}">${r}</div>`;

        // 2. Generar las celdas para la fila actual
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const colLetter = COLUMN_LETTERS[c];
            // Nota: Se mantiene contenteditable="true" y se le añade el listener en la inicialización.
            rowHtml += `<div class="cell editable" contenteditable="true" data-col="${colLetter}" data-row="${r}" tabindex="0"></div>`;
        }

        spreadsheetContainer.innerHTML += rowHtml;
    }
}


/**
 * Añade los listeners de eventos a todas las celdas para manejar la interactividad (ej: foco, blur).
 */
function setupCellInteractivity() {
    const editableCells = document.querySelectorAll('.cell.editable');

    if (!editableCells) return;

    // Usamos 'input' o 'blur' para detectar cuando el usuario ha terminado de escribir o ha cambiado algo.
    editableCells.forEach(cell => {
        // Listener al perder foco (cuando el usuario hace clic fuera o presiona Tab)
        cell.addEventListener('blur', function() {
            console.log(`Celda ${this.dataset.col}${this.dataset.row} perdió foco.`);
            // Aquí se podría implementar lógica de guardado, validación, etc.
        });

        // Listener al hacer clic (para asegurar que el focus funciona bien)
        cell.addEventListener('focus', function() {
             console.log(`Celda ${this.dataset.col}${this.dataset.row} enfocada.`);
        });
    });
}


/**
 * Función principal de inicialización de la aplicación.
 */
function initApp() {
    // 1. Asegurar que toda la estructura del grid esté poblada (filas 2 a 20)
    initializeSpreadsheetGrid();

    // 2. Añadir los manejadores de eventos para hacer las celdas interactivas
    setupCellInteractivity();

    // 3. Configuración adicional requerida: Event Listeners para Column Headers y Controles
    setupColumnHeadersSelection(); // Asigna listeners a A, B, C... (Column Selection)
    setupRowSelection();          // Nueva función para manejar selección de fila

    document.getElementById('apply-color-btn').addEventListener('click', applyColorToColumn);
    document.getElementById('clear-contents-btn').addEventListener('click', clearColumnContents);
    document.getElementById('delete-col-btn').addEventListener('click', deleteColumn);
    
    // NEW: Event Listeners for Visibility Controls
    document.getElementById('hide-col-btn').addEventListener('click', hideColumn);
    document.getElementById('show-col-btn').addEventListener('click', showColumn);
    document.getElementById('hide-row-btn').addEventListener('click', hideRow);
    document.getElementById('show-row-btn').addEventListener('click', showRow);

    // Inicializar el estado de los botones
    updateActionButtons();


    console.log("Spreadsheet App cargada y lista.");
}


// Llamada principal que arranca la aplicación una vez que el DOM está listo (aunque en este caso, se ejecuta directamente al cargar script.js).
initApp();

function setupColumnHeadersSelection() {
    const colLetters = document.querySelectorAll('.col-letter');
    if (!colLetters) return;

    colLetters.forEach(span => {
        span.style.cursor = 'pointer'; // Indica que es interactivo
        span.addEventListener('click', function() {
            // Deseleccionar todos los demás
            document.querySelectorAll('.col-letter').forEach(s => s.classList.remove('selected'));
            // Seleccionar el actual
            this.classList.add('selected');
            
            // Actualizar estado global de la columna seleccionada
            selectedColumnLetter = this.textContent;

            // Resetear selección de fila al seleccionar una columna
            selectedRow = null;

            updateActionButtons(); // Update controls based on selection
            console.log(`Columna ${selectedColumnLetter} seleccionada.`);
        });
    });
}

function setupRowSelection() {
    const rowLabels = document.querySelectorAll('.row-label');
    if (!rowLabels) return;

    rowLabels.forEach(label => {
        label.style.cursor = 'pointer'; // Indica que es interactivo
        label.addEventListener('click', function() {
            // Deseleccionar todas las filas
            document.querySelectorAll('.row-label').forEach(l => l.classList.remove('selected'));
            
            // Seleccionar la fila actual y establecer el estado global
            this.classList.add('selected');
            selectedRow = this.dataset.row;

            // Resetear selección de columna al seleccionar una fila
            selectedColumnLetter = null; 

            updateActionButtons(); // Update controls based on selection
            console.log(`Fila ${selectedRow} seleccionada.`);
        });
    });
}

function applyColorToColumn() {
    // Priorizamos la selección de Fila sobre Columna si ambas están presentes, ya que el test lo implica.
    const isRowSelected = selectedRow !== null; 
    const isColumnSelected = selectedColumnLetter !== null;

    if (!isRowSelected && !isColumnSelected) {
        alert("Por favor, selecciona una fila o columna primero.");
        return;
    }

    const color = document.getElementById('bg-color-input').value;
    let cellsToColor = [];

    if (isRowSelected) {
        // Aplicar color a toda la fila seleccionada
        cellsToColor = document.querySelectorAll(`.cell[data-row="${selectedRow}"]`);
    } else if (isColumnSelected) {
        // Aplicar color a toda la columna seleccionada
        cellsToColor = document.querySelectorAll(`.cell[data-col="${selectedColumnLetter}"]`);
    }

    cellsToColor.forEach(cell => {
        cell.style.backgroundColor = color;
    });

    if (isRowSelected) {
         alert(`Color ${color} aplicado exitosamente a la fila ${selectedRow}.`);
    } else if (isColumnSelected) {
         alert(`Color ${color} aplicado exitosamente a la columna ${selectedColumnLetter}.`);
    }
}

function clearColumnContents() {
    const isRowSelected = selectedRow !== null; 
    const isColumnSelected = selectedColumnLetter !== null;

    if (!isRowSelected && !isColumnSelected) {
        alert("Por favor, selecciona una fila o columna primero.");
        return;
    }
    
    let targetSelector;
    let message;

    if (isRowSelected) {
        targetSelector = `.cell[data-row="${selectedRow}"]`;
        message = `¿Estás seguro de que quieres borrar TODO el contenido de la fila ${selectedRow}?`;
    } else if (isColumnSelected) {
        targetSelector = `.cell[data-col="${selectedColumnLetter}"]`;
        message = `¿Estás seguro de que quieres borrar TODO el contenido de la columna ${selectedColumnLetter}?`;
    }

    if (!confirm(message)) {
        return;
    }

    // Selecciona todos los elementos .cell que tienen data-col igual a la letra seleccionada o data-row igual al número seleccionado.
    document.querySelectorAll(targetSelector).forEach(cell => {
        cell.textContent = ''; 
        // También limpiamos el estilo de fondo por si acaso
        cell.style.backgroundColor = ''; 
    });

    if (isRowSelected) {
        alert(`Contenido de la fila ${selectedRow} borrado.`);
    } else {
        alert(`Contenido de la columna ${selectedColumnLetter} borrado.`);
    }
}

function deleteColumn() {
    const isRowSelected = selectedRow !== null; 
    const isColumnSelected = selectedColumnLetter !== null;

    if (!isColumnSelected) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    
    if (!confirm(`¡ADVERTENCIA! ¿Estás seguro de que quieres BORRAR permanentemente la columna ${selectedColumnLetter} y todo su contenido?`)) {
        return;
    }

    const columnLetters = document.querySelectorAll('.col-letter');
    let targetColLetterElement = Array.from(document.querySelectorAll('.col-letter')).find(el => el.textContent === selectedColumnLetter);
    if (targetColLetterElement) {
        // Eliminar la letra del encabezado
        targetColLetterElement.remove();
    }

    // 3. Eliminar todas las celdas de esa columna
    document.querySelectorAll(`.cell[data-col="${selectedColumnLetter}"]`).forEach(cell => {
        cell.remove();
    });

    // Nota: La estructura del DOM (divs en secuencia) se ajustará automáticamente al remover los nodos hijos.
    alert(`Columna ${selectedColumnLetter} eliminada con éxito.`);
}
