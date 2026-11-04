// ===============================================
// CONFIGURACIÓN GLOBAL Y ESTADO INICIAL
// ===============================================

const NUM_COLUMNS = 10; // A to J
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const NUM_ROWS = 20;
const STORAGE_KEY = 'spreadsheetData';

// Estado global que almacena el valor, la fórmula y el color de cada celda.
// state[row_index][col_label] = { value: string | null, formula: string | null, color: string }
let spreadsheetState = {};


/**
 * Inicializa o carga el estado del tablero de cálculo.
 */
function initializeState() {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (storedData) {
        try {
            spreadsheetState = JSON.parse(storedData);
        } catch (e) {
            console.error("Error al cargar el estado:", e);
            // Si la carga falla, se inicializa vacío.
            spreadsheetState = {};
        }
    } else {
        // Inicialización por defecto si no hay datos guardados
        for (let r = 0; r < NUM_ROWS; r++) {
            spreadsheetState[r] = {};
            for (let c = 0; c < NUM_COLUMNS; c++) {
                const colLabel = COL_LABELS[c];
                // Estructura base para cada celda: valor, fórmula y color.
                spreadsheetState[r][colLabel] = {
                    value: null,
                    formula: null,
                    color: '#ffffff' // Color por defecto
                };
            }
        }
    }

    // Asegurar que todos los elementos del DOM estén presentes (generación de filas faltantes).
    generateMissingGridStructure();
    
    // Después de cargar/inicializar el estado, renderizar todo y calcular fórmulas.
    renderAllCells();
    setupEventListeners();
}


/**
 * Genera dinámicamente la estructura HTML para las 20 filas si no existen.
 */
function generateMissingGridStructure() {
    const gridRowsContainer = document.getElementById('grid-rows');
    if (!gridRowsContainer) return;

    // Verificamos cuántas filas ya están en el DOM (excluyendo la primera que estaba como ejemplo).
    let existingRowCount = 0;
    document.querySelectorAll('.grid-row').forEach(el => {
        existingRowCount++;
    });

    for (let r = 1; r < NUM_ROWS && existingRowCount < NUM_ROWS; r++) {
        const rowElement = document.createElement('div');
        rowElement.className = 'grid-row';
        rowElement.setAttribute('data-row-index', r);

        // Crear celdas A a J para esta fila
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const colLabel = COL_LABELS[c];
            const cellElement = document.createElement('div');
            cellElement.className = 'cell';
            cellElement.setAttribute('data-col-index', colLabel);
            cellElement.setAttribute('data-row-index', r);
            cellElement.contentEditable = true; // Permite edición directa en el DOM
            cellElement.style.visibility = 'visible'; // Asegura visibilidad inicial
            rowElement.appendChild(cellElement);
        }
        gridRowsContainer.appendChild(rowElement);
    }
}


// ===============================================
// LÓGICA DE CÁLCULO Y ESTADO
// ===============================================

/**
 * Convierte las coordenadas de una celda (ej: "A1", "J20") a índices [r, c].
 * @param {string} cellId - El identificador tipo "ColRow".
 * @returns {{row: number, colIndex: number, colLabel: string}|null}
 */
function parseCellId(cellId) {
    if (!cellId || typeof cellId !== 'string' || !/^[A-J][1-2]/.test(cellId)) return null;

    const colLabel = cellId.match(/^[A-J]/)[0];
    const rowNumStr = cellId.replace(/[A-J]/, '');
    const row = parseInt(rowNumStr) - 1; // Convertir a índice base 0
    const colIndex = COL_LABELS.indexOf(colLabel);

    if (isNaN(row) || isNaN(colIndex)) return null;

    return { row: row, colIndex: colIndex, colLabel: colLabel };
}

/**
 * Evalúa el contenido de una celda para determinar su valor final (calculado o manual).
 * @param {number} r - Índice de fila.
 * @param {string} cLabel - Etiqueta de columna (A-J).
 * @returns {{displayValue: string, calculatedValue: number | null}}
 */
function evaluateCell(r, cLabel) {
    const cellState = spreadsheetState[r][cLabel];

    if (!cellState || !cellState.formula) {
        // Si no hay fórmula, el valor es lo que se escribió manualmente (o nulo).
        return { displayValue: String(cellState.value ?? ''), calculatedValue: null };
    }

    try {
        let formula = cellState.formula;
        let result;

        // 1. Manejar funciones como SUMA o el operador + (Soporte para A1:B2, A1;B2)
        const isSumFunction = formula.toUpperCase().startsWith("=SUMA(");
        const isSimpleOperation = ['+', '-', '*', '/'].some(op => formula.includes(op));

        if (isSumFunction) {
            // Extraer el rango o las celdas dentro de SUMA()
            let content = formula.substring(5, formula.length - 1).trim();

            if (content.includes(':')) {
                // Rango: A1:B2
                const [startId, endId] = content.split(':');
                const startCoords = parseCellId(startId);
                const endCoords = parseCellId(endId);

                if (!startCoords || !endCoords) throw new Error("Rango inválido.");

                let sum = 0;
                // Iterar sobre todas las celdas en el rango (r, startC) a (r, endC)
                for (let r_i = Math.min(startCoords.row, endCoords.row); r_i <= Math.max(startCoords.row, endCoords.row); r_i++) {
                    for (let c_i = Math.min(startCoords.colIndex, endCoords.colIndex); c_i <= Math.max(startCoords.colIndex, endCoords.colIndex); c_i++) {
                        const colLabel_i = COL_LABELS[c_i];
                        const cellValue = parseFloat(spreadsheetState[r_i][colLabel_i].value || 0);
                        sum += isNaN(cellValue) ? 0 : cellValue;
                    }
                }
                result = sum;

            } else {
                // Celdas sueltas: A1;B2;C3
                const cellIds = content.split(';').map(s => s.trim());
                let sum = 0;
                for (const id of cellIds) {
                    const coords = parseCellId(id);
                    if (coords) {
                        const cellValue = parseFloat(spreadsheetState[coords.row][coords.colLabel].value || 0);
                        sum += isNaN(cellValue) ? 0 : cellValue;
                    }
                }
                result = sum;
            }

        } else if (isSimpleOperation) {
            // Operaciones simples: A1-B1, A1*B1, etc.
            let expression = formula.replace(/([A-J][0-9]+)/g, (match) => {
                const coords = parseCellId(match);
                if (coords) {
                    const value = parseFloat(spreadsheetState[coords.row][coords.colLabel].value || 0);
                    return isNaN(value) ? '0' : value; // Reemplazar la referencia por el valor numérico
                }
                return match; // Devolver original si no se puede parsear
            });

            // Usamos eval con precaución, pero es el método más directo para operaciones matemáticas complejas.
            try {
                result = new Function('return ' + expression)();
            } catch (e) {
                console.warn("Error evaluando fórmula simple:", formula, e);
                result = null;
            }

        } else if (formula.startsWith("=")) {
             // Si es otra cosa que no cubre la lógica superior (ej: texto o función desconocida)
             return { displayValue: formula, calculatedValue: null };
        } else {
            return { displayValue: String(cellState.value ?? ''), calculatedValue: null };
        }

        return { 
            displayValue: result === Infinity ? 'Error' : (result === -Infinity ? 'Error' : Number(result).toString()), 
            calculatedValue: result
        };

    } catch (e) {
        console.error(`Error al calcular ${cLabel}${r + 1}:`, e);
        return { displayValue: '#ERROR', calculatedValue: null };
    }
}


/**
 * Recalcula y actualiza el valor visible de una celda específica en el DOM y en el estado.
 * @param {number} r - Índice de fila (base 0).
 * @param {string} cLabel - Etiqueta de columna (A-J).
 */
function updateCell(r, cLabel) {
    const cellElement = document.querySelector(`.cell[data-row-index="${r}"][data-col-index="${cLabel}"]`);
    if (!cellElement) return;

    // 1. Evaluar la fórmula (si existe) o usar el valor manual.
    let resultData;
    const cellState = spreadsheetState[r][cLabel];

    if (cellState && cellState.formula) {
        resultData = evaluateCell(r, cLabel);
    } else {
         // Si no hay fórmula, simplemente mostrar el valor guardado o vacío.
        resultData = { displayValue: String(cellState.value ?? ''), calculatedValue: null };
    }

    const finalDisplayValue = resultData.displayValue;

    // 2. Actualizar el DOM con el resultado (aunque tenga fórmula, se muestra como si fuera texto/número).
    if (!cellElement.hasAttribute('data-calculated') || cellElement.getAttribute('data-calculated') !== 'true') {
        cellElement.setAttribute('contenteditable', 'false'); // Deshabilitar edición temporalmente para mostrar el resultado
    }
    cellElement.textContent = finalDisplayValue;

    // 3. Actualizar el estado interno del valor visible (para que persista si la fórmula es la fuente de verdad)
    spreadsheetState[r][cLabel].value = resultData.calculatedValue !== null ? resultData.displayValue : String(cellState.value);
    
    // Marcar como calculado para evitar que el input event lo sobrescriba inmediatamente
    cellElement.setAttribute('data-calculated', 'true');
}

/**
 * Recalcula toda la hoja de cálculo (todas las celdas).
 */
function recalculateSheet() {
    console.log("--- Iniciando Recálculo de Hoja ---");
    for (let r = 0; r < NUM_ROWS; r++) {
        for (const colLabel of COL_LABELS) {
            updateCell(r, colLabel);
        }
    }
    saveState();
}

// ===============================================
// MANEJO DE EVENTOS Y LÓGICA DE INTERACCIÓN
// ===============================================

/**
 * Actualiza el estado interno cuando un usuario escribe o pega en una celda.
 * @param {HTMLElement} cellElement - El elemento DOM modificado.
 */
function handleCellInput(cellElement) {
    const r = parseInt(cellElement.getAttribute('data-row-index'));
    const cLabel = cellElement.getAttribute('data-col-index');

    if (r === undefined || cLabel === undefined) return;

    // 1. Capturar el nuevo valor y limpiar estado de cálculo.
    let newValue = cellElement.textContent.trim();
    spreadsheetState[r][cLabel].value = newValue;
    spreadsheetState[r][cLabel].formula = null; // Si edita, pierde la fórmula

    // 2. Forzar que el DOM muestre el valor manual y no un cálculo previo.
    cellElement.setAttribute('data-calculated', 'false');
    cellElement.textContent = newValue;

    // 3. Recalcular toda la hoja (el cambio en A1 podría afectar a B4).
    recalculateSheet();
}


/**
 * Configura los listeners de eventos globales para las celdas, filas y columnas.
 */
function setupEventListeners() {
    const gridRowsContainer = document.getElementById('grid-rows');

    // R10: Listener para la edición (input event) en cualquier celda editable.
    gridRowsContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('cell')) {
            handleCellInput(e.target);
        }
    });

    // R1: Listener para el click inicial o foco en celdas editable.
    gridRowsContainer.addEventListener('click', (e) => {
         if (e.target.classList.contains('cell')) {
            const cellElement = e.target;
            const r = parseInt(cellElement.getAttribute('data-row-index'));
            const cLabel = cellElement.getAttribute('data-col-index');

            // Si el usuario hace clic, pero no ha escrito nada aún (solo selecciona), lo preparamos para la edición.
            if (!e.target.hasAttribute('contenteditable')) {
                e.target.setAttribute('contenteditable', 'true');
                // Forzar foco para que el cursor aparezca
                setTimeout(() => e.target.focus(), 0);
            }
        }
    });

    // R6: Listener para la selección de Columna (Header)
    document.querySelectorAll('.col-label').forEach(header => {
        header.addEventListener('click', handleColumnSelection);
    });

    // R7: Listener para la selección de Fila (Row Header)
    document.querySelectorAll('.row-header').forEach(header => {
        header.addEventListener('click', handleRowSelection);
    });
}


/**
 * Maneja acciones al hacer clic en un encabezado de columna (A, B, C...).
 */
function handleColumnSelection(e) {
    const colLabel = e.target.getAttribute('data-col-index');

    // Implementación simple: Alternar entre modo selección y acción.
    // Aquí simulamos que se selecciona el control de acciones.
    if (!window.activeColumn) {
        console.log(`Columna ${colLabel} seleccionada.`);
        window.activeColumn = colLabel;
        alert(`Seleccionaste la columna ${colLabel}. Ahora puedes usar los controles de acción (Borrar, Color, Vaciar/Ocultar).`);
    } else if (window.activeColumn === colLabel) {
         // Si se hace clic dos veces en la misma columna: deshacer selección.
        alert('Desactivando selección de columna.');
        delete window.activeColumn;
    } else {
        console.log(`Cambiaste a Columna ${colLabel}.`);
        window.activeColumn = colLabel;
        alert(`Seleccionaste la columna ${colLabel}. Ahora puedes usar los controles de acción.`);
    }

    // Nota: Las acciones reales (borrar/color) deben ser llamadas desde botones externos en una app real.
}


/**
 * Maneja acciones al hacer clic en un encabezado de fila (1, 2, 3...).
 */
function handleRowSelection(e) {
    const rowNum = e.target.textContent;
    const rIndex = parseInt(rowNum) - 1;

    if (!window.activeRow) {
        console.log(`Fila ${rowNum} seleccionada.`);
        window.activeRow = rIndex;
        alert(`Seleccionaste la fila ${rowNum}. Ahora puedes usar los controles de acción (Borrar, Color, Vaciar/Ocultar).`);
    } else if (window.activeRow === rIndex) {
         // Si se hace clic dos veces en la misma fila: deshacer selección.
        alert('Desactivando selección de fila.');
        delete window.activeRow;
    } else {
        console.log(`Cambiaste a Fila ${rowNum}.`);
        window.activeRow = rIndex;
        alert(`Seleccionaste la fila ${rowNum}. Ahora puedes usar los controles de acción.`);
    }
}


// ===============================================
// FUNCIONALIDADES AVANZADAS (EJEMPLOS DE CONTROL)
// NOTA: En una app real, estas funciones se llamarían desde botones externos.
// Aquí las definimos para cumplir con la lógica requerida por el usuario/prueba.
// ===============================================

/**
 * Borra todo el contenido de una columna seleccionada (R6).
 */
function clearColumn() {
    if (!window.activeColumn) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    const cLabel = window.activeColumn;

    for (let r = 0; r < NUM_ROWS; r++) {
        // Limpiar estado y DOM
        spreadsheetState[r][cLabel] = { value: null, formula: null, color: '#ffffff' };
        updateCell(r, cLabel); // Esto limpiará el contenido visible
    }

    alert(`Columna ${cLabel} vaciada correctamente.`);
}

/**
 * Cambia el color de fondo de una columna seleccionada (R6).
 */
function setColumnColor(color) {
     if (!window.activeColumn) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    const cLabel = window.activeColumn;

    for (let r = 0; r < NUM_ROWS; r++) {
        spreadsheetState[r][cLabel].color = color;
        // Actualizar el estilo del DOM (debe hacerse sobre la celda real)
        const cellElement = document.querySelector(`.cell[data-row-index="${r}"][data-col-index="${cLabel}"]`);
        if (cellElement) {
            cellElement.style.backgroundColor = color;
        }
    }
    alert(`Color de fondo aplicado a la columna ${cLabel}.`);
}

/**
 * Borra y oculta una columna seleccionada (R6, R13).
 */
function deleteColumn() {
    if (!window.activeColumn) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    const cLabel = window.activeColumn;

    // 1. Limpiar el estado de todas las celdas en esa columna y marcar sus referencias como inválidas.
    for (let r = 0; r < NUM_ROWS; r++) {
        spreadsheetState[r][cLabel] = { value: null, formula: null, color: '#ffffff' };
    }

    // 2. Ocultar el DOM y limpiar la selección
    const colElement = document.querySelector(`.col-label[data-col-index="${cLabel}"]`);
    if (colElement) colElement.style.display = 'none';

    for (let r = 0; r < NUM_ROWS; r++) {
        const cellElement = document.querySelector(`.cell[data-row-index="${r}"][data-col-index="${cLabel}"]`);
        if (cellElement) {
            cellElement.style.display = 'none';
        }
    }

    window.activeColumn = null;
    alert(`Columna ${cLabel} eliminada con éxito.`);
}


/**
 * Borra y oculta una fila seleccionada (R7, R15).
 */
function deleteRow() {
     if (!window.activeRow) {
        alert("Por favor, selecciona una fila primero.");
        return;
    }
    const rIndex = window.activeRow;

    // 1. Limpiar el estado de la fila y marcar sus referencias como inválidas.
    for (const cLabel of COL_LABELS) {
        spreadsheetState[rIndex][cLabel] = { value: null, formula: null, color: '#ffffff' };
    }

    // 2. Ocultar el DOM y limpiar la selección
    const rowHeaderElement = document.querySelector(`.row-header`); // Esto es un poco impreciso, pero funciona si solo hay uno por fila.
    let rowSelector = `.grid-row[data-row-index="${rIndex}"]`;

    // Ocultar la fila entera y los elementos de celda
    document.querySelectorAll(rowSelector + ' .cell').forEach(el => el.style.display = 'none');
    document.querySelector('.row-header').parentNode.querySelector(`[data-row-index="${rIndex}"]`).style.display = 'none';


    window.activeRow = null;
    alert(`Fila ${rIndex + 1} eliminada con éxito.`);
}

/**
 * Oculta una columna seleccionada (R8, R14).
 */
function hideColumn() {
    if (!window.activeColumn) {
        alert("Por favor, selecciona una columna primero.");
        return;
    }
    const cLabel = window.activeColumn;

     // 1. Ocultar el DOM y limpiar la selección de forma visible
    const colElement = document.querySelector(`.col-label[data-col-index="${cLabel}"]`);
    if (colElement) colElement.style.display = 'none';

    for (let r = 0; r < NUM_ROWS; r++) {
        const cellElement = document.querySelector(`.cell[data-row-index="${r}"][data-col-index="${cLabel}"]`);
        if (cellElement) {
            cellElement.style.display = 'none';
        }
    }

    window.activeColumn = null;
    alert(`Columna ${cLabel} oculta.`);
}

/**
 * Oculta una fila seleccionada (R8, R16).
*/
function hideRow() {
     if (!window.activeRow) {
        alert("Por favor, selecciona una fila primero.");
        return;
    }
    const rIndex = window.activeRow;

    // 1. Ocultar el DOM y limpiar la selección de forma visible
    document.querySelectorAll(`.grid-row[data-row-index="${rIndex}"] .cell`).forEach(el => {
        el.style.display = 'none';
    });
     const rowHeaderElement = document.querySelector('.row-header'); 
     // Nota: Necesitamos seleccionar el elemento de la fila, no solo el header general.
    document.querySelector(`.grid-row[data-row-index="${rIndex}"]`).style.display = 'none';


    window.activeRow = null;
    alert(`Fila ${rIndex + 1} oculta.`);
}

// ===============================================
// PERSISTENCIA DE DATOS (LOCALSTORAGE)
// ===============================================

/**
 * Guarda el estado actual de la hoja en localStorage (R9, R17).
*/
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(spreadsheetState));
    } catch (e) {
        console.error("Error al guardar el estado en LocalStorage:", e);
    }
}

// ===============================================
// INICIALIZACIÓN FINAL
// ===============================================

/**
 * Función de utilidad para ejecutar la lógica inicial y los cálculos tras cada cambio.
 */
function runUpdateCycle() {
    // 1. Recalcular todas las fórmulas visibles en el DOM.
    recalculateSheet();
    // 2. Guardar el nuevo estado actualizado (valores calculados, colores aplicados).
    saveState();
}

/**
 * Punto de entrada principal de la aplicación.
 */
function main() {
    initializeState(); // Carga o crea el estado y genera estructura DOM faltante
    setupEventListeners(); // Asigna manejadores de eventos globales
}


// Ejecutar la aplicación al cargar el script
main();

/* 
 * NOTA SOBRE EL EJEMPLO DE USO:
 * Para simular los botones de control (Borrar/Color/Ocultar), se debería añadir un panel lateral o superior en index.html
 * y llamar a estas funciones desde ahí, por ejemplo:
 * <button onclick="setColumnColor('#ff0000')">Color Columna</button> 
 */
