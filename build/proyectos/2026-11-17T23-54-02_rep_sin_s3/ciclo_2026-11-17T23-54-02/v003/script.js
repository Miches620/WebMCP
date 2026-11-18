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

    // 3. Configuración adicional requerida: Event Listeners para Columna Headers y Controles
    setupColumnHeadersSelection(); // Asigna listeners a A, B, C...

    document.getElementById('apply-color-btn').addEventListener('click', applyColorToColumn);
    document.getElementById('clear-contents-btn').addEventListener('click', clearColumnContents);
    document.getElementById('delete-col-btn').addEventListener('click', deleteColumn);


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

            // Opcional: Mostrar un mensaje o activar controles si es necesario
            console.log(`Columna ${selectedColumnLetter} seleccionada.`);
        });
    });
}

function applyColorToColumn() {
    if (!selectedColumnLetter) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }

    const color = document.getElementById('bg-color-input').value;
    
    // Selecciona todos los elementos .cell que tienen data-col igual a la letra seleccionada
    document.querySelectorAll(`.cell[data-col="${selectedColumnLetter}"]`).forEach(cell => {
        cell.style.backgroundColor = color;
    });

    alert(`Color ${color} aplicado exitosamente a la columna ${selectedColumnLetter}.`);
}

function clearColumnContents() {
    if (!selectedColumnLetter) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    
    if (!confirm(`¿Estás seguro de que quieres borrar TODO el contenido de la columna ${selectedColumnLetter}?`)) {
        return;
    }

    // Selecciona todos los elementos .cell que tienen data-col igual a la letra seleccionada
    document.querySelectorAll(`.cell[data-col="${selectedColumnLetter}"]`).forEach(cell => {
        cell.textContent = ''; 
        // También limpiamos el estilo de fondo por si acaso
        cell.style.backgroundColor = ''; 
    });

    alert(`Contenido de la columna ${selectedColumnLetter} borrado.`);
}

function deleteColumn() {
    if (!selectedColumnLetter) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    
    if (!confirm(`¡ADVERTENCIA! ¿Estás seguro de que quieres BORRAR permanentemente la columna ${selectedColumnLetter} y todo su contenido?`)) {
        return;
    }

    const columnLetters = document.querySelectorAll('.col-letter');
    let columnIndexToRemove = -1;
    
    // 1. Encontrar el índice del encabezado de columna a eliminar
    columnLetters.forEach((span, index) => {
        if (span.textContent === selectedColumnLetter) {
            columnIndexToRemove = index + 1; // +1 porque empieza en A=0, pero queremos contar desde 1
        }
    });

    // 2. Eliminar el encabezado de columna
    const letterSpanToDelete = document.querySelector(`.col-letter:has(span[data-col="${selectedColumnLetter}"]):not(:nth-child(1))`); // Selector complejo, mejor buscamos por texto si es posible o iteramos más directamente.

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
