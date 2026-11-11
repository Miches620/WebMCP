let selectedColumn = null; // Variable de estado para rastrear la columna seleccionada
let selectedRowElement = null; // Nueva variable de estado para rastrear la fila seleccionada

/**
 * R1. Maneja el evento de entrada (input) en cualquier celda editable.
 * Esto asegura que los cambios se manejen correctamente y permite futuras validaciones.
 * @param {Event} event El evento de cambio ocurrido en la celda.
 */
function handleCellInput(event) {
    const cell = event.target;
    // 1. Actualizar el valor de la celda que recibió el input (si es un número, lo mantenemos como texto para preservar fórmulas).
    console.log(`Celda ${cell.dataset.cell} actualizada con: "${cell.innerText}"`);

    // Guardar los datos en localStorage inmediatamente después del cambio
    saveCellData(cell);

    // 2. Después de cualquier cambio, recalcular todas las celdas que contengan fórmulas.
    calculateAllFormulas();
}

/**
 * R1. Maneja el evento cuando la celda pierde el foco (blur).
 * Esto es útil para guardar el valor final o ejecutar validaciones al terminar de escribir.
 * @param {Event} event El evento de pérdida de foco.
 */
function handleCellBlur(event) {
    const cell = event.target;
    // Aquí se podría implementar lógica de guardado automático o validación final.
    console.log(`Celda ${cell.dataset.cell} perdió el foco. Valor final: "${cell.innerText}"`);
}

/**
 * Inicializa la funcionalidad de la hoja de cálculo, adjuntando los listeners necesarios.
 */
function initializeSpreadsheet() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) {
        console.error("No se encontró el elemento #spreadsheet.");
        return;
    }

    // Usamos delegación de eventos en la tabla principal para capturar cualquier cambio 
    // que ocurra dentro de las celdas (td).
    spreadsheet.addEventListener('input', handleCellInput);
    spreadsheet.addEventListener('blur', handleCellBlur);
    // Añadimos el listener de foco para saber qué celda está seleccionada
    spreadsheet.addEventListener('focus', (e) => {
        const target = e.target;
        if (target && target.tagName === 'TD') {
            console.log(`Celda ${target.dataset.cell} enfocada.`);
        }
    });

    // Inicializar controles de color
    document.getElementById('apply-color-btn').addEventListener('click', handleColorChange);
    // Añadir listeners para los nuevos controles de fila
    document.getElementById('clear-row-content-btn').addEventListener('click', clearRowContent);
    document.getElementById('delete-row-btn').addEventListener('click', deleteRow);
    // Listeners para ocultar columna y fila (R8)
    document.getElementById('hide-column-btn').addEventListener('click', hideSelectedColumn);
    document.getElementById('hide-row-btn').addEventListener('click', hideSelectedRow);

    // Listener para seleccionar columna haciendo clic en el encabezado (TH)
    const headerRow = document.querySelector('#spreadsheet thead tr');
    if (headerRow) {
        headerRow.addEventListener('click', (e) => {
            const target = e.target;
            // Verificamos si el objetivo es un TH y contiene una letra de columna
            if (target && target.tagName === 'TH' && target.innerText.match(/[A-Z]/)) {
                selectedColumn = target.innerText.trim().toUpperCase();
                console.log(`Columna seleccionada: ${selectedColumn}`);
            } else {
                 selectedColumn = null; // Deseleccionar si se hace clic en otro lugar del encabezado
            }
        });
    }

    // Listener para seleccionar fila haciendo clic en el header de la fila (th.row-header)
    const tbody = document.querySelector('#spreadsheet tbody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.classList.contains('row-header')) {
                // Al hacer clic en el header de la fila, seleccionamos toda la fila TR
                selectedRowElement = target.closest('tr'); 
                console.log("Fila seleccionada para operaciones:", selectedRowElement);
            }
        });
    }

    // Cargar datos guardados al iniciar la aplicación
    loadSpreadsheetData();


    console.log("Spreadsheet App inicializada: Edición inline activa.");
}

/**
 * Recalcula el valor de todas las celdas que contienen fórmulas.
 */
function calculateAllFormulas() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    // Selecciona todas las celdas de datos (td) dentro del cuerpo de la hoja de cálculo.
    const cells = spreadsheet.querySelectorAll('tbody td');

    cells.forEach(cell => {
        let formulaText = cell.innerText.trim();

        // Solo procesamos si el contenido parece una fórmula y no es vacío.
        if (formulaText && typeof formulaText === 'string' && formulaText.startsWith('=')) {
            try {
                const calculatedValue = evaluateFormula(formulaText);
                
                // Actualizar el texto visible de la celda con el resultado calculado.
                cell.innerText = calculatedValue;

            } catch (e) {
                console.error(`Error evaluando fórmula en ${cell.dataset.cell}:`, e);
                // Si falla, dejamos la fórmula original visible o un mensaje de error.
                if (!cell.innerText.startsWith('=')) {
                     cell.innerText = "ERROR";
                }
            }
        }
    });
}

/**
 * Evalúa el contenido de una cadena que representa una fórmula de hoja de cálculo.
 * @param {string} formula La fórmula con signo '=' inicial.
 * @returns {number|string} El resultado calculado o un mensaje de error.
 */
function evaluateFormula(formula) {
    // Eliminar el signo '=' inicial para facilitar el parsing.
    let formulaString = formula.substring(1); 

    // --- Manejo de SUMA (Rango o Celdas Sueltas) ---
    if (formulaString.toUpperCase().startsWith('SUMA')) {
        const match = formulaString.match(/SUMA\(([^)]+)\)/i);
        if (!match) return "Sintaxis incorrecta";

        let argumentsList = match[1];
        
        // Determinar si es un rango (ej: A1:A3) o celdas sueltas (ej: A1;B2;C3)
        if (argumentsList.includes(':')) {
            const rangeString = argumentsList;
            
            let sum = 0;
            // Simple manejo de rango vertical en la misma columna
            const [startCellRef, endCellRef] = rangeString.split(':');
            
            if (startCellRef && endCellRef) {
                const startRow = parseInt(startCellRef.substring(1));
                const endRow = parseInt(endCellRef.substring(1));
                const colLetter = startCellRef.match(/[A-Z]+/)[0];

                for (let i = startRow; i <= endRow; i++) {
                    // Obtener el valor de la celda en esa columna y fila
                    const cellKey = `${colLetter}${i}`;
                    const cellElement = document.querySelector(`[data-cell="${cellKey}"]`);
                    if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                        sum += parseFloat(cellElement.innerText);
                    }
                }
                return sum;
            }

        } else if (argumentsList.includes(';')) {
            // Celdas sueltas: A1;B2;C3
            const refs = argumentsList.split(';');
            let sum = 0;
            refs.forEach(ref => {
                const cellElement = document.querySelector(`[data-cell="${ref.trim()}"]`);
                if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                    sum += parseFloat(cellElement.innerText);
                }
            });
            return sum;
        }
    }

    // --- Manejo de Operaciones Aritméticas Básicas (A1-B1, A1*B1, etc.) ---
    try {
        let expression = formulaString;

        // Expresión regular para encontrar patrones de referencia de celda (Ej: [A-Z]+[0-9]+)
        const cellRefRegex = /([A-Z]+\d+)/g; 
        expression = expression.replace(cellRefRegex, (match) => {
            // Buscar el elemento en la hoja de cálculo usando data-cell
            const cellElement = document.querySelector(`[data-cell="${match}"]`);
            if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                return cellElement.innerText; // Devolver el valor numérico como string para eval()
            }
            // Si no se encuentra o no es un número, devolver '0' para evitar errores de sintaxis en eval().
            return '0'; 
        });

        // Evaluar la expresión matemática resultante (ej: "2-3")
        const result = Function(`return ${expression}`)();
        return result;

    } catch (e) {
        console.error("Error de evaluación:", e);
        return "#ERROR!";
    }
}


// Llamada principal para arrancar la aplicación
initializeSpreadsheet();

/**
 * R5. Aplica un color de fondo a todas las celdas de la columna actualmente seleccionada.
 */
function handleColorChange() {
    const colorPicker = document.getElementById('background-color-picker');
    const selectedColor = colorPicker ? colorPicker.value : null;

    if (!selectedColor) {
        console.warn("Por favor, seleccione un color.");
        return;
    }

    let cellsToColor = [];

    // 1. Prioridad: Si hay una fila seleccionada (para cumplir con R7)
    if (typeof selectedRowElement !== 'undefined' && selectedRowElement) {
        const cells = selectedRowElement.querySelectorAll('td');
        cellsToColor = Array.from(cells);

    // 2. Alternativa: Si solo hay una columna seleccionada (comportamiento original)
    } else if (typeof selectedColumn !== 'undefined' && selectedColumn) {
        const selector = `#spreadsheet td[data-cell^="${selectedColumn}"]`;
        cellsToColor = Array.from(document.querySelectorAll(selector));

    // 3. No hay contexto de selección válido
    } else {
        console.warn("Debe seleccionar una columna o una fila primero.");
        return;
    }


    cellsToColor.forEach(cell => {
        // Aplicar el estilo de fondo directamente al elemento DOM
        cell.style.backgroundColor = selectedColor;
    });
}

/**
 * Borra el contenido de todas las celdas de la fila seleccionada.
 */
function clearRowContent() {
    if (!selectedRowElement) {
        console.warn("No hay fila seleccionada para borrar el contenido.");
        return;
    }

    // Selecciona todas las celdas de datos (td) dentro de la fila seleccionada, excluyendo el header de la fila.
    const cells = selectedRowElement.querySelectorAll('td');
    cells.forEach(cell => {
        cell.innerText = '';
        // Limpiar estilos para que se vea como borrado
        cell.style.backgroundColor = ''; 
    });
}

/**
 * Elimina completamente la fila seleccionada del DOM.
 */
function deleteRow() {
    if (!selectedRowElement) {
        console.warn("No hay fila seleccionada para borrar.");
        return;
    }

    // Confirmación de seguridad antes de eliminar el elemento del DOM
    if (confirm("¿Está seguro que desea eliminar esta fila completa?")) {
        selectedRowElement.remove();
        selectedRowElement = null; // Resetear la selección
        console.log("Fila eliminada exitosamente.");
    }
}

function hideSelectedColumn() {
    if (!selectedColumn) {
        console.warn("Debe seleccionar una columna primero para ocultarla.");
        return;
    }

    const columnLetter = selectedColumn;
    
    // 1. Ocultar el encabezado de la columna (TH con la letra)
    const headerCell = document.querySelector(`#spreadsheet thead tr th:nth-child(${columnLetter.charCodeAt(0) - 'A'.charCodeAt(0) + 2})`);
    if (headerCell) {
        headerCell.style.display = 'none';
    }

    // 2. Ocultar todas las celdas de datos (TD) bajo esa columna
    const selector = `#spreadsheet td[data-cell^="${columnLetter}"]`;
    const cells = document.querySelectorAll(selector);
    cells.forEach(cell => {
        cell.style.display = 'none';
    });

    console.log(`Columna ${columnLetter} oculta.`);
}

function hideSelectedRow() {
    if (!selectedRowElement) {
        console.warn("Debe seleccionar una fila primero para ocultarla.");
        return;
    }

    // Ocultar la fila completa (TR)
    selectedRowElement.style.display = 'none';
    console.log("Fila oculta exitosamente.");
}

function saveCellData(cell) {
    const cellKey = cell.dataset.cell;
    if (cellKey) {
        localStorage.setItem(cellKey, cell.innerText);
    }
}

function loadSpreadsheetData() {
    // Selecciona todas las celdas de datos (td) que son editables.
    const cells = document.querySelectorAll('#spreadsheet td[contenteditable="true"]');
    cells.forEach(cell => {
        const cellKey = cell.dataset.cell;
        if (cellKey) {
            // Intenta cargar el valor guardado de localStorage
            const savedValue = localStorage.getItem(cellKey);
            if (savedValue !== null && savedValue !== undefined) {
                // Restaura el contenido visible de la celda
                cell.innerText = savedValue; 
            }
        }
    });
}
