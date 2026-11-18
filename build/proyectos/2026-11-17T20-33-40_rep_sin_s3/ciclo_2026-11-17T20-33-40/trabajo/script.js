/**
 * @fileoverview Script principal para la aplicación de hoja de cálculo.
 * Implementa la generación dinámica del grid y la edición inline.
 */

// Constantes globales
const NUM_COLUMNS = 10; // A-J
const COLUMN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const NUM_ROWS = 20;

/**
 * Genera el HTML completo para la cuadrícula de celdas (filas y columnas).
 * Sobrescribe o completa el contenido de #cell-grid.
 */
function initializeSpreadsheetGrid() {
    const cellGridContainer = document.getElementById('cell-grid');
    if (!cellGridContainer) return;

    // Limpiar cualquier placeholder existente si es necesario, aunque en este caso simplemente agregaremos los elementos faltantes.
    // Dado que el HTML ya incluye la fila 1, solo generamos las filas restantes (2 a 20).

    const existingRows = cellGridContainer.querySelectorAll('.row-label');
    let startRowIndex = 1;
    if (existingRows.length === NUM_ROWS) {
        // Si por alguna razón se cargó todo, no hacemos nada.
        return;
    } else if (existingRows.length > 0 && existingRows[0].dataset.row == '1') {
        // Detectamos que la fila 1 ya está ahí y necesitamos empezar desde el 2.
        startRowIndex = 2;
    }

    for (let r = startRowIndex; r <= NUM_ROWS; r++) {
        let rowHtml = '';
        
        // 1. Generar etiqueta de fila (el número)
        rowHtml += `<div class="row-label" data-row="${r}">${r}</div>`;

        // 2. Generar las celdas para la fila actual
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const colLetter = COLUMN_LETTERS[c];
            // Nota: Se mantiene contenteditable="true" del HTML y se le añade el listener en la inicialización.
            rowHtml += `<div class="cell editable" contenteditable="true" data-col="${colLetter}" data-row="${r}" tabindex="0"></div>`;
        }

        cellGridContainer.innerHTML += rowHtml;
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

    console.log("Spreadsheet App cargada y lista.");
}


// Llamada principal que arranca la aplicación una vez que el DOM está listo (aunque en este caso, se ejecuta directamente al cargar script.js).
initApp();
