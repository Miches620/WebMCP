const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROWS_COUNT = 20;
const STORAGE_KEY = 'spreadsheetData';

// --- STATE MANAGEMENT (The Single Source of Truth) ---
/**
 * @type {Object.<string, {value: string, formula: string|null, style: string}>}
 * Key format: "A1", "J20"
 */
let spreadsheetData = {}; 

// Tracks the currently selected column/row for global operations (R6, R7)
let activeColumn = null;
let activeRow = null;

/**
 * Inicializa la estructura de datos en el modelo interno para todas las celdas.
 * Esto garantiza que cada celda exista en el objeto incluso si está vacía.
 */
function initializeDataModel() {
    spreadsheetData = {};
    for (let r = 1; r <= ROWS_COUNT; r++) {
        for (const col of COLUMNS) {
            const address = `${col}${r}`;
            spreadsheetData[address] = {
                value: '', // Valor literal ingresado por el usuario
                formula: null, // Fórmula detectada (Ej: "=A1+B1")
                style: '#ffffff' // Color de fondo por defecto
            };
        }
    }
}

/**
 * Carga los datos desde localStorage o inicializa el modelo.
 */
function loadData() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        try {
            spreadsheetData = JSON.parse(storedData);
        } catch (e) {
            console.error("Error al cargar los datos de la hoja de cálculo:", e);
            initializeDataModel(); // Fallback
        }
    } else {
        initializeDataModel();
    }
}

/**
 * Guarda el estado actual del modelo en localStorage.
 */
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spreadsheetData));
}


// ========================================================
// 📐 CÁLCULOS Y LÓGICA DE FÓRMULAS (R3, R4, R11, R12)
// ========================================================

/**
 * Intenta determinar si una cadena es una fórmula válida y la parsea.
 * Detecta patrones: SUMA(rango), SUMA(celda;...) o Operadores directos (=A1+B1).
 * @param {string} inputString El contenido del input de la celda.
 * @returns {{formula: string|null, rawValue: string}}
 */
function parseFormula(inputString) {
    if (!inputString || !inputString.startsWith('=')) {
        return { formula: null, rawValue: inputString };
    }

    let formula = inputString;

    // 1. Detectar SUMA(rango) o SUMA(celda;...)
    const sumMatch = formula.match(/=SUMA\(([^)]+)\)/i);
    if (sumMatch) {
        formula = '=SUMA(' + sumMatch[1] + ')';
    }

    // 2. Normalizar separadores: reemplazar punto y coma por comas si es un rango simple, o dejarlo si es una lista de celdas.
    // Esto simplifica la evaluación matemática posterior.
    formula = formula.replace(/;/g, ',').trim();


    return { formula: formula, rawValue: inputString };
}

/**
 * Obtiene el valor numérico calculado actual para un dato de celda.
 * Prioriza el resultado del cálculo sobre el valor literal almacenado.
 * @param {string} address La dirección de la celda (Ej: "A1").
 * @returns {number|null} El valor numérico o null si no es numérico.
 */
function getNumericValue(address) {
    const cell = spreadsheetData[address];
    if (!cell || !cell.formula) {
        // Intentar parsear el valor literal como número
        const val = parseFloat(cell.value);
        return isNaN(val) ? null : val;
    }

    // Si hay fórmula, el resultado debe haber sido calculado previamente y estar en la celda (simulado aquí).
    // En un sistema real, esto debería venir del cálculo que lo escribió.
    const calculatedResult = calculateCellFormula(address);
    return typeof calculatedResult === 'number' ? calculatedResult : null;
}

/**
 * Evalúa una fórmula dada su dirección y el estado actual de la hoja.
 * @param {string} address La celda que contiene la fórmula.
 * @returns {string|number} El resultado calculado como string o número.
 */
function calculateCellFormula(address) {
    const cell = spreadsheetData[address];
    if (!cell || !cell.formula) return null;

    let formulaStr = cell.formula;
    let result = null;

    try {
        // Paso 1: Reemplazar referencias de celda (A1, B2) por sus valores numéricos reales.
        // Esto es complejo en JS puro sin un motor de eval robusto. Usaremos una aproximación simple con regex.
        formulaStr = formulaStr.replace(/([A-Z]+)\d+/g, (match) => {
            const value = getNumericValue(match);
            return value === null ? '0' : value; // Reemplazamos por su valor numérico o 0 si no se puede calcular.
        });

        // Paso 2: Evaluar la expresión matemática resultante con `eval`.
        // NOTA: En producción real, el uso de eval es peligroso. Aquí se acepta dada la restricción "sin frameworks".
        const calculated = eval(formulaStr);

        if (isNaN(calculated) || !isFinite(calculated)) {
            return 'Error'; // Manejo básico de errores de cálculo
        }

        // Limitar a 4 decimales para simular Excel
        result = parseFloat(calculated.toFixed(4));
    } catch (e) {
        console.error(`Error calculando ${address}:`, e);
        return 'ERROR';
    }

    return result;
}


/**
 * Re-calcula el valor de una celda y actualiza el modelo.
 * @param {string} address La dirección a recalcular.
 */
function updateCell(address) {
    const cell = spreadsheetData[address];

    if (!cell || !cell.formula) {
        return; // No es fórmula, no necesita cálculo
    }

    // 1. Calcular el resultado (esto actualiza internamente la lógica de getNumericValue).
    let resultValue;
    try {
        resultValue = calculateCellFormula(address);
    } catch (e) {
        resultValue = 'CALC ERROR';
    }


    // 2. Actualizar el modelo y renderizar
    spreadsheetData[address].value = ''; // Limpiamos el valor literal si es fórmula
    spreadsheetData[address].calculatedResult = resultValue;

    const targetCell = document.querySelector(`[data-cell="${address}"]`);
    if (targetCell) {
        // Actualiza el DOM solo con el resultado visible
        targetCell.textContent = String(resultValue);
        targetCell.setAttribute('data-calculated', 'true'); // Indicador de que es calculado
    }

    saveData();
}


/**
 * Ejecuta la lógica de actualización completa de la hoja: 
 * 1. Actualiza todas las celdas con fórmulas.
 * 2. Vuelve a renderizar los estilos y valores calculados.
 */
function recalculateSheet() {
    // Iterar sobre todas las celdas para detectar dependencias (R4)
    let updated = true;
    const maxIterations = 50; // Evita bucles infinitos

    for (let i = 0; i < maxIterations && updated; i++) {
        updated = false;
        for (const address of Object.keys(spreadsheetData)) {
            const cell = spreadsheetData[address];
            if (cell.formula) {
                // Comprobamos si el valor de la celda puede haber cambiado y necesita recalcularse.
                // Por simplicidad, simplemente recalculamos todas las fórmulas en cada ciclo hasta que converja.
                const previousContent = document.querySelector(`[data-cell="${address}"]`)?.textContent;
                updateCell(address);

                if (document.querySelector(`[data-cell="${address}"]`) && 
                    String(parseFloat(document.querySelector(`[data-cell="${address}"]`).textContent) || 0).toString() !== String(parseFloat(previousContent) || 0)) {
                    updated = true;
                }
            }
        }
    }
}


// ========================================================
// 🎨 MANEJO DE EVENTOS Y INTERACCIONES (R1, R10)
// ========================================================

/**
 * Maneja el cambio de contenido en una celda editable.
 * @param {HTMLElement} target El elemento TD donde se escribió.
 */
function handleCellInput(target) {
    const address = target.getAttribute('data-cell');
    if (!address) return;

    let inputVal = target.textContent.trim();
    
    // 1. Determinar si es texto o fórmula
    const { formula: newFormula, rawValue: finalRawValue } = parseFormula(inputVal);

    spreadsheetData[address].value = finalRawValue; // Guardar el valor literal (si no hay fórmula)
    spreadsheetData[address].formula = newFormula; 

    // Limpiar la celda de contenido y re-renderizar inmediatamente para mostrar el resultado/texto.
    target.textContent = ''; 
    updateCell(address);

    saveData();
}


/**
 * Actualiza visualmente el estado de una celda (contenido, color).
 * @param {string} address Dirección de la celda.
 */
function renderCell(address) {
    const cell = spreadsheetData[address];
    const targetElement = document.querySelector(`[data-cell="${address}"]`);

    if (!targetElement) return;

    // 1. Establecer Color (R5)
    targetElement.style.backgroundColor = cell.style;

    // 2. Determinar el contenido a mostrar (Cálculo vs. Valor Literal)
    let displayContent = '';
    if (cell.formula) {
        // Si es fórmula, recalculamos y mostramos el resultado
        const result = calculateCellFormula(address);
        displayContent = String(result === null ? '' : result);

        // Actualizar atributos para indicar que es calculado
        targetElement.setAttribute('data-calculated', 'true');
    } else {
        // Si es texto, usamos el valor literal
        displayContent = cell.value;
        targetElement.removeAttribute('data-calculated');
    }
    
    // Actualizar el DOM
    targetElement.textContent = displayContent;
}

/**
 * Llama a renderCell para todas las celdas después de una modificación de datos o estado.
 */
function fullRender() {
    for (const address of Object.keys(spreadsheetData)) {
        renderCell(address);
    }
}


// ========================================================
// ⚙️ OPERACIONES DE COLUMNA Y FILA (R6, R7, R8, R13, R14, R15, R16)
// ========================================================

/**
 * Obtiene el rango de direcciones para una columna dada.
 * @param {string} colLetter La letra de la columna (Ej: 'A').
 * @returns {string[]} Array de direcciones ["A1", "A2", ..., "A20"].
 */
function getColumnAddresses(colLetter) {
    return Array.from({ length: ROWS_COUNT }, (_, i) => `${colLetter}${i + 1}`);
}

/**
 * Obtiene el rango de direcciones para una fila dada.
 * @param {number} rowNum El número de la fila (Ej: 3).
 * @returns {string[]} Array de direcciones ["A3", "B3", ..., "J3"].
 */
function getRowAddresses(rowNum) {
    return COLUMNS.map(col => `${col}${rowNum}`);
}

/**
 * Actualiza los botones globales de control (Habilitar/Deshabilitar).
 */
function updateControlsState() {
    const hasData = Object.values(spreadsheetData).some(c => c.value || c.formula);
    document.getElementById('btn-delete-col').disabled = !activeColumn;
    document.getElementById('btn-clear-col').disabled = !(activeColumn && activeRow); // Solo si está activo y hay filas para afectar
    document.getElementById('btn-hide-col').disabled = !activeColumn;

    document.getElementById('btn-delete-row').disabled = !activeRow;
    document.getElementById('btn-clear-row').disabled = !(activeRow && activeColumn);
    document.getElementById('btn-hide-row').disabled = !activeRow;
}


// --- COLUMNA HANDLERS (R6, R13, R14) ---

function handleColumnAction(actionType, colLetter) {
    const addresses = getColumnAddresses(colLetter);
    let wasEmpty = true;

    if (actionType === 'delete') { // Borrar Columna (R13)
        // 1. Limpiar el modelo de datos
        addresses.forEach(address => delete spreadsheetData[address]);
        // 2. Eliminar del DOM
        const colCells = document.querySelectorAll(`[data-cell^="${colLetter}"]`);
        if (colCells.length > 0) {
            colCells.forEach(el => el.remove());
        }
        // 3. Actualizar estado
        activeColumn = null; // Desactivar columna
    } else if (actionType === 'clear') { // Vaciar Columna (R6)
        addresses.forEach(address => {
            spreadsheetData[address].value = '';
            spreadsheetData[address].formula = null;
        });
        fullRender();
    } else if (actionType === 'style') { // Cambiar Color de Fondo (R6)
        const color = document.getElementById('color-picker').value;
        addresses.forEach(address => {
            spreadsheetData[address].style = color;
        });
        fullRender();
    } else if (actionType === 'hide') { // Ocultar Columna (R14)
        // 1. Actualizar el modelo para reflejar ocultación
        addresses.forEach(address => {
            spreadsheetData[address].isHidden = true;
        });

        // 2. Ocultar elementos del DOM
        const colCells = document.querySelectorAll(`[data-cell^="${colLetter}"]`);
        if (colCells.length > 0) {
            colCells.forEach(el => el.style.display = 'none');
        }
    }
    // Si se borró la columna, desactivamos todos los selectores
    activeColumn = colLetter; 
    updateControlsState();
    saveData();
}

// --- FILA HANDLERS (R7, R15, R16) ---

function handleRowAction(actionType, rowNum) {
    const addresses = getRowAddresses(rowNum);
    
    if (actionType === 'delete') { // Borrar Fila (R15)
        // 1. Limpiar el modelo de datos
        addresses.forEach(address => delete spreadsheetData[address]);
        // 2. Eliminar del DOM
        const rowElements = document.querySelectorAll(`#row-${rowNum} td`);
        if (rowElements.length > 0) {
            rowElements.forEach(el => el.remove());
        }
        // Nota: Al eliminar una fila, la lógica de índice debe ser reescrita o gestionada por CSS/JS complejo.
        // Para este alcance, solo eliminamos los elementos y asumimos que la estructura del HTML lo maneja (o se reconstruye).
        const rowElement = document.getElementById(`row-${rowNum}`);
        if (rowElement) {
            rowElement.remove();
        }

        activeRow = null; // Desactivar fila
    } else if (actionType === 'clear') { // Vaciar Fila (R7)
        addresses.forEach(address => {
            spreadsheetData[address].value = '';
            spreadsheetData[address].formula = null;
        });
        fullRender();
    } else if (actionType === 'style') { // Cambiar Color de Fondo (R7)
        const color = document.getElementById('color-picker').value;
        addresses.forEach(address => {
            spreadsheetData[address].style = color;
        });
        fullRender();
    } else if (actionType === 'hide') { // Ocultar Fila (R16)
        // 1. Actualizar el modelo para reflejar ocultación
        spreadsheetData['rowHidden'] = spreadsheetData['rowHidden'] || [];
        if (!spreadsheetData['rowHidden'].includes(rowNum)) {
             spreadsheetData['rowHidden'] = [...spreadsheetData['rowHidden'], rowNum];
        }

        // 2. Ocultar elementos del DOM
        const rowElement = document.getElementById(`row-${rowNum}`);
        if (rowElement) {
            rowElement.style.display = 'none';
        }
    }
    activeRow = rowNum; // Mantener la fila activa si se sigue trabajando en ella
    updateControlsState();
    saveData();
}


// ========================================================
// 🚀 INITIALIZATION AND EVENT LISTENERS
// ========================================================

/**
 * Maneja el clic en los encabezados de columna (R6).
 * @param {HTMLElement} colHeader El elemento th de la letra.
 */
function handleColumnClick(colHeader) {
    const colLetter = colHeader.getAttribute('data-col');
    activeColumn = colLetter;

    // 1. Marcar como activo/seleccionar (simulación visual)
    document.querySelectorAll('[role="columnheader"]').forEach(h => h.classList.remove('selected'));
    colHeader.classList.add('selected');
    
    // 2. Actualizar el estado de los botones
    updateControlsState();

    // Simular selección de la primera fila para habilitar operaciones (R6)
    activeRow = 1;
}

/**
 * Maneja el clic en los encabezados de fila (R7).
 * @param {HTMLElement} rowHeader El elemento th del número.
 */
function handleRowClick(rowHeader) {
    const rowNum = parseInt(rowHeader.getAttribute('data-row'));
    activeRow = rowNum;

    // 1. Marcar como activo/seleccionar (simulación visual)
    document.querySelectorAll('[role="rowheader"]').forEach(h => h.classList.remove('selected'));
    rowHeader.classList.add('selected');

    // 2. Actualizar el estado de los botones
    updateControlsState();
}


function setupEventListeners() {
    const tableWrapper = document.getElementById('spreadsheet-grid');

    // R1, R10: Listener para entrada de datos en cualquier TD editable
    tableWrapper.addEventListener('input', (e) => {
        if (e.target.hasAttribute('contenteditable') && e.target.tagName === 'TD') {
            handleCellInput(e.target);
        }
    });

    // R6: Listener para hacer clic en los encabezados de columna
    document.querySelectorAll('[role="columnheader"]').forEach(header => {
        header.addEventListener('click', () => handleColumnClick(header));
    });

    // R7: Listener para hacer clic en los encabezados de fila
    document.querySelectorAll('[role="rowheader"]').forEach(header => {
        header.addEventListener('click', () => handleRowClick(header));
    });


    // --- CONTROLES GLOBALES (R5, R6, R7) ---

    // Color Picker Listener (R5)
    document.getElementById('color-picker').addEventListener('input', (e) => {
        const color = e.target.value;
        
        if (activeColumn && activeRow) { // Si hay un contexto de celda activo
            handleColumnAction('style', activeColumn); 
        } else if (activeColumn) { // Solo columna activa (R6)
            handleColumnAction('style', activeColumn);
        } else if (activeRow) { // Solo fila activa (R7)
             handleRowAction('style', activeRow);
        } else {
            // Si no hay contexto, simplemente actualizamos el color de la celda seleccionada si existe
            const selectedCell = document.querySelector('.selected-cell');
            if(selectedCell) {
                 selectedCell.style.backgroundColor = color;
            }
            saveData(); // Guardar solo el estilo global temporalmente si no hay contexto de operación
        }

    });
    
    // Botones de Operaciones de Columna
    document.getElementById('btn-delete-col').addEventListener('click', () => {
        if (activeColumn) handleColumnAction('delete', activeColumn);
    });
    document.getElementById('btn-clear-col').addEventListener('click', () => {
        if (activeColumn) handleColumnAction('clear', activeColumn);
    });
    document.getElementById('btn-hide-col').addEventListener('click', () => {
        if (activeColumn) handleColumnAction('hide', activeColumn);
    });

    // Botones de Operaciones de Fila
    document.getElementById('btn-delete-row').addEventListener('click', () => {
        if (activeRow) handleRowAction('delete', activeRow);
    });
    document.getElementById('btn-clear-row').addEventListener('click', () => {
        if (activeRow) handleRowAction('clear', activeRow);
    });
    document.getElementById('btn-hide-row').addEventListener('click', () => {
        if (activeRow) handleRowAction('hide', activeRow);
    });

}


/**
 * Main execution function
 */
function init() {
    loadData(); // Cargar datos de localStorage o inicializar el modelo
    setupEventListeners(); // Configurar listeners
    recalculateSheet();   // Ejecutar cálculos para poblar la hoja con resultados guardados
    fullRender();         // Dibujar toda la interfaz (valores y estilos)
}

// Iniciar la aplicación al cargar el script.js
document.addEventListener('DOMContentLoaded', init);
