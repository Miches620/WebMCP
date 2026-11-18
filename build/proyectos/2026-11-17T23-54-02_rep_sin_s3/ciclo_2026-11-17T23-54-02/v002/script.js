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
    const spreadsheetContainer = document.getElementById('spreadsheet');
    if (!spreadsheetContainer) return;

    // Dado que el HTML ahora incluye la fila 1, solo generamos las filas restantes (2 a 20).

    // Contar cuántos elementos de clase 'row-label' ya existen para determinar dónde empezar.
    const existingRowLabels = spreadsheetContainer.querySelectorAll('.row-label');
    let startRowIndex = 1;
    if (existingRowLabels.length > 0) {
        // Asumimos que el primer row-label encontrado es la fila 1, y empezamos a generar desde la siguiente.
        startRowIndex = parseInt(existingRowLabels[0].dataset.row) + 1;
    }

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

    console.log("Spreadsheet App cargada y lista.");
}


// Llamada principal que arranca la aplicación una vez que el DOM está listo (aunque en este caso, se ejecuta directamente al cargar script.js).
initApp();
