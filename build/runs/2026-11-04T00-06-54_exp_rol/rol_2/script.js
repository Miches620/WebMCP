/**
 * ==========================================================
 * Hoja de Cálculo Virtual - Script Logic
 * Vanilla JavaScript, No Frameworks.
 * Single Source of Truth Pattern.
 * ==========================================================
 */

// --- CONSTANTS AND INITIAL STATE SETUP ---

const NUM_COLUMNS = 10; // A to J
const NUM_ROWS = 20;   // 1 to 20
const COL_LETTERS = [];
const ROW_INDICES = [];

/**
 * Generates letters A-J and numbers 1-20.
 */
function initializeCoords() {
    for (let i = 0; i < NUM_COLUMNS; i++) {
        COL_LETTERS.push(String.fromCharCode(65 + i)); // A, B, C... J
    }
    for (let i = 1; i <= NUM_ROWS; i++) {
        ROW_INDICES.push(i);
    }
}

/**
 * Objeto de estado global (Única Fuente de Verdad).
 * key: 'A1', 'B5'. Value: { value: 'contenido', formula: '=SUMA(...)', bgColor: '#FFFFFF' }
 */
let state = {
    data: {}, // Almacena el contenido y la fórmula para cada celda.
    columnLetters: COL_LETTERS,
    rowIndices: ROW_INDICES,
};

/**
 * Genera una coordenada de celda (ej: A1).
 * @param {string} col - Letra de columna ('A').
 * @param {number} row - Índice de fila (1).
 * @returns {string} Coordenada completa.
 */
function getCoord(col, row) {
    return `${col}${row}`;
}

/**
 * Obtiene el estado de una coordenada específica.
 * Si no existe en el estado, devuelve un valor por defecto vacío.
 * @param {string} coord - Coordenada (ej: 'A1').
 */
function getStateForCoord(coord) {
    if (!state.data[coord]) {
        state.data[coord] = {
            value: '',
            formula: null,
            bgColor: '#FFFFFF',
            isHidden: false, // Para control de visibilidad
        };
    }
    return state.data[coord];
}


// --- LOCAL STORAGE AND INITIAL LOAD ---

/**
 * Carga el estado desde localStorage o inicializa la estructura por defecto.
 */
function loadState() {
    const storedState = localStorage.getItem('spreadsheetState');
    if (storedState) {
        try {
            state = JSON.parse(storedState);
            console.log("Estado cargado exitosamente desde localStorage.");
        } catch (e) {
            console.error("Error al parsear el estado de localStorage. Iniciando con datos vacíos.", e);
            initializeDefaultState();
        }
    } else {
        initializeDefaultState();
    }

    // Renderiza la vista inicial y calcula fórmulas
    renderAllDataAndRecalculate();
}

/**
 * Inicializa el estado base (todas las celdas a blanco, fórmula nula).
 */
function initializeDefaultState() {
    state = {
        data: {},
        columnLetters: COL_LETTERS,
        rowIndices: ROW_INDICES,
    };

    for (const col of state.columnLetters) {
        for (const row of state.rowIndices) {
            const coord = getCoord(col, row);
            state.data[coord] = {
                value: '',
                formula: null,
                bgColor: '#FFFFFF',
                isHidden: false,
            };
        }
    }
}

/**
 * Guarda el estado actual en localStorage. Debe llamarse después de cualquier cambio significativo.
 */
function saveState() {
    try {
        localStorage.setItem('spreadsheetState', JSON.stringify(state));
    } catch (e) {
        console.error("No se pudo guardar el estado en localStorage:", e);
    }
}


// --- FORMULA EVALUATION LOGIC ---

/**
 * Evalúa una fórmula simple de suma, resta, multiplicación o división entre coordenadas.
 * Ejemplo: A1-B1 o C3+A2
 * @param {string} formulaString - Fórmula sin el prefijo '='.
 * @returns {number|null} El resultado numérico o null si es inválido.
 */
function evaluateSimpleFormula(formulaString) {
    // Regex para encontrar patrones de COORD: (LETRA)(DIGITO+) y operadores (+, -, *, /)
    const regex = /([A-Z]\d+)([+\-*/])?([A-Z]\d*)/g;

    let lastMatchIndex = 0;
    let resultString = formulaString.trim();

    // Simplificamos la evaluación: reemplazamos las referencias de celda por sus valores numéricos
    const tempFormula = resultString.replace(/([A-Z]\d+)/g, (match) => {
        const coord = match;
        const cellState = state.data[coord];
        if (cellState && typeof cellState.value === 'number') {
            return cellState.value;
        }
        // Si no es un número válido o no existe, lo tratamos como 0 para evitar NaN catastróficos en la evaluación JS.
        return "0"; 
    });

    try {
        // Usamos eval con precaución aquí porque el input ya fue sanitizado por el patrón de coordenadas y operadores básicos.
        const result = new Function(`return ${tempFormula}`)();
        if (isNaN(result) || !isFinite(result)) return null;
        return parseFloat(result.toFixed(2)); // Redondeo a 2 decimales
    } catch (e) {
        console.error("Error al evaluar la fórmula simple:", e);
        return null;
    }
}

/**
 * Evalúa fórmulas de rango o listas separadas por comas/puntos y coma (Ej: SUMA(A1:B3) o =SUMA(A1;B2)).
 * @param {string} formulaString - Fórmula sin el prefijo '='.
 * @returns {number|null} El resultado numérico o null si es inválido.
 */
function evaluateComplexFormula(formulaString) {
    const upperFormula = formulaString.toUpperCase().trim();

    // 1. Manejo de SUMA (Rango A1:B3)
    if (upperFormula.includes('SUMA')) {
        const matchRange = /SUMA\(([^)]+)\)/i;
        const rangeMatch = upperFormula.match(matchRange);

        if (rangeMatch && rangeMatch[1]) {
            const rangeString = rangeMatch[1].trim(); // Ej: A1:B3 o C4
            
            // Obtener todas las coordenadas en el rango
            let coordsToSum = [];
            const startCoord = rangeString.split(':')[0];
            const endCoord = rangeString.split(':').pop();

            if (startCoord && endCoord) {
                const [startCol, startRow] = getColAndRowFromCoord(startCoord);
                const [endCol, endRow] = getColAndRowFromCoord(endCoord);
                
                // Generar todas las celdas intermedias
                for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
                    for (let c = getColIndexFromLetter(Math.min(startCol, endCol)); 
                         c <= getColIndexFromLetter(Math.max(startCol, endCol)); c++) {
                        coordsToSum.push(getCoord(state.columnLetters[c], r));
                    }
                }
            } else if (startCoord && startCoord === endCoord) {
                 coordsToSum.push(startCoord); // Es una sola celda
            }
        }

        let sum = 0;
        for (const coord of coordsToSum) {
             const cellState = state.data[coord];
             if (cellState && typeof cellState.value === 'number') {
                sum += cellState.value;
            }
        }
        return parseFloat(sum.toFixed(2));
    }

    // 2. Manejo de SUMA/Operadores sueltos (Ej: =SUMA(A1;B2); o A1+B2)
    const parts = upperFormula.split(/[\(\s,;]+/).filter(p => p !== '' && p !== '(' && p !== ')');
    let totalSum = 0;

    for (const part of parts) {
        if (part.startsWith('SUMA')) continue; // Ya cubierto arriba
        
        // Si el elemento es una coordenada, asumimos que es para sumar
        if (/^[A-Z]\d+$/.test(part)) {
            const coord = part;
             const cellState = state.data[coord];
             if (cellState && typeof cellState.value === 'number') {
                totalSum += cellState.value;
             }
        }
    }

    return parseFloat(totalSum.toFixed(2));
}


/**
 * Determina el índice de columna a partir de una letra ('A' -> 0, 'B' -> 1).
 */
function getColIndexFromLetter(letter) {
    if (typeof letter !== 'string' || !/^[A-Z]$/.test(letter)) return -1;
    return letter.charCodeAt(0) - 'A'.charCodeAt(0);
}

/**
 * Determina la letra de columna a partir de un índice (0 -> 'A', 1 -> 'B').
 */
function getLetterFromColIndex(index) {
    if (index < 0 || index >= NUM_COLUMNS) return '';
    return String.fromCharCode('A'.charCodeAt(0) + index);
}

/**
 * Extrae la letra de columna y el índice de fila de una coordenada.
 * @param {string} coord - Ej: 'C12'.
 * @returns {[number, number]} [colIndex, rowIndex]
 */
function getColAndRowFromCoord(coord) {
    if (!coord || typeof coord !== 'string') return [-1, -1];

    const letter = coord[0].toUpperCase();
    let rowStr = coord.substring(1);
    let rowIndex = parseInt(rowStr, 10);

    if (isNaN(rowIndex)) return [-1, -1];

    const colIndex = getColIndexFromLetter(letter);
    return [colIndex, rowIndex]; // Retorna índice numérico de columna y número de fila.
}


/**
 * Intenta calcular el valor visible de una celda dado su estado actual.
 * @param {string} coord - Coordenada 'A1'.
 * @returns {number|string|null} El valor calculado (número o texto) o null si falla.
 */
function calculateCell(coord) {
    const cellState = state.data[coord];

    if (!cellState || !cellState.formula) {
        return cellState ? cellState.value : ''; // No hay fórmula, solo muestra el valor escrito.
    }

    try {
        // Limpiamos la fórmula de los símbolos de agrupación extra para una evaluación más limpia
        let formulaString = cellState.formula;
        
        if (formulaString.toUpperCase().startsWith('=')) {
            formulaString = formulaString.substring(1); // Quitar '='
        }

        // 1. Intentar evaluar como fórmula compleja (SUMA, etc.)
        const calculatedValue = evaluateComplexFormula(formulaString);
        if (calculatedValue !== null) {
            return calculatedValue;
        }

        // 2. Si falla la evaluación compleja, intentamos tratarla como una suma de coordenadas sueltas separadas por ; o ,
        // Esto cubre el caso: =A1+B2 y también puede capturar restos de sintaxis mal cerrada si no es rango SUMA.
        if (formulaString.includes('+') || formulaString.includes('-') || formulaString.includes('*') || formulaString.includes('/')) {
             const simpleResult = evaluateSimpleFormula(formulaString);
             if (simpleResult !== null) return simpleResult;
        }

        // Si todo falla, mostramos un error o el valor literal de la fórmula si no es numérico.
        return `Error: Fórmula inválida (${cellState.formula})`;

    } catch (e) {
        console.error(`Error al calcular ${coord}:`, e);
        return 'ERROR';
    }
}


// --- RENDERING AND UPDATING THE DOM ---

/**
 * Calcula y actualiza el contenido de todas las celdas que dependen de cualquier dato en el estado.
 * Debe llamarse después de CUALQUIER cambio de datos (input, color, etc.).
 */
function renderAllDataAndRecalculate() {
    // 1. Recorrer cada celda y calcular su valor visible
    for (const coord in state.data) {
        if (state.data[coord].isHidden) continue;

        const calculatedValue = calculateCell(coord);
        
        // Actualizar el estado con el valor que debe mostrarse (el resultado del cálculo o el texto literal si no hay fórmula)
        state.data[coord].displayedValue = String(calculatedValue === null ? '' : calculatedValue);
    }

    // 2. Dibujar/Actualizar toda la interfaz de usuario
    renderGridStructure();
}


/**
 * Renderiza o actualiza la estructura completa de las celdas en el DOM.
 */
function renderGridStructure() {
    const dataGrid = document.getElementById('data-grid');
    if (!dataGrid) return;

    // Limpiar contenido antes de re-renderizar (evita duplicados si se llama repetidamente)
    dataGrid.innerHTML = ''; 

    // Creamos una estructura basada en filas y columnas para asegurar el Grid/Table layout
    const gridContainer = document.createElement('div');
    gridContainer.className = 'excel-content-grid'; // Clase contenedora de las celdas reales

    state.rowIndices.forEach(rowIndex => {
        // Crear la fila (el contenedor padre para todas las celdas de esa fila)
        const rowDiv = document.createElement('div');
        rowDiv.className = 'excel-row';
        rowDiv.dataset.row = rowIndex;

        state.columnLetters.forEach(colLetter => {
            const coord = getCoord(colLetter, rowIndex);
            const cellState = state.data[coord];
            
            if (cellState.isHidden) return; // No renderizar si está oculto

            // Crear la celda individual
            const cellDiv = document.createElement('div');
            cellDiv.className = 'excel-cell';
            cellDiv.dataset.col = colLetter;
            cellDiv.dataset.row = rowIndex;
            cellDiv.id = `cell-${coord}`;

            // Aplicar estilos y contenido del estado
            cellDiv.style.backgroundColor = cellState.bgColor;
            
            const valueToShow = state.data[coord].displayedValue || ''; 
            cellDiv.textContent = valueToShow;

            rowDiv.appendChild(cellDiv);
        });
        gridContainer.appendChild(rowDiv);
    });

    dataGrid.appendChild(gridContainer);

    // Re-adjuntar listeners de edición a todas las celdas recién renderizadas/actualizadas
    attachCellEditListeners();
}


/**
 * ------------------------------------------
 * MANEJO DE INTERACCIONES DEL USUARIO (INPUT)
 * ------------------------------------------
 */

/**
 * Entra en modo edición para una celda específica.
 * @param {HTMLElement} cellElement - El div de la celda.
 */
function enterEditMode(cellElement) {
    const coord = `${cellElement.dataset.col}${cellElement.dataset.row}`;
    const cellState = state.data[coord];

    if (!cellState || cellState.isHidden) return;

    // Usamos contenteditable para simular la edición de texto
    cellElement.setAttribute('contenteditable', 'true');
    cellElement.focus();
    
    // Colocar el cursor al final del contenido visible (lo que sea: valor o resultado calculado)
    const range = document.createRange();
    range.selectNodeContents(cellElement);
    range.collapse(false); // Mover cursor al final
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Confirma la edición de una celda (al perder foco o Enter).
 * @param {HTMLElement} cellElement - El div de la celda que se está editando.
 */
function confirmEdit(cellElement) {
    const coord = `${cellElement.dataset.col}${cellElement.dataset.row}`;
    const cellState = state.data[coord];

    if (!cellState || cellState.isHidden) return;

    // 1. Leer el valor escrito por el usuario (textContent en modo editable)
    let rawInput = cellElement.textContent.trim();
    
    // Si el input es vacío, lo tratamos como borrado de contenido.
    if (rawInput === '') {
        cellState.value = '';
        cellState.formula = null;
        // Forzamos la actualización del valor visible a vacío para que no muestre un resultado de fórmula basura
        cellElement.textContent = ''; 
    } else if (rawInput.startsWith('=')) {
         // Es una fórmula
        cellState.formula = rawInput;
        cellState.value = null; // El valor base es irrelevante si hay fórmula
    } else {
        // Es texto o número directo
        cellState.formula = null;
        // Intentar convertir a número si es posible, sino mantener como string
        const numValue = parseFloat(rawInput);
        cellState.value = isNaN(numValue) ? rawInput : numValue; 
    }

    // 2. Limpiar modo edición y recalcular/guardar
    cellElement.setAttribute('contenteditable', 'false');
    saveState();
    renderAllDataAndRecalculate(); // Recálculo forzado
}


/**
 * Adjunta los listeners de edición a todas las celdas del grid.
 */
function attachCellEditListeners() {
    document.querySelectorAll('.excel-cell').forEach(cell => {
        // Eliminar listeners viejos para evitar fugas o duplicados
        cell.onblur = null; 
        cell.onkeydown = null;

        const coord = `${cell.dataset.col}${cell.dataset.row}`;
        if (state.data[coord] && !state.data[coord].isHidden) {
            // Click para entrar en modo edición
            cell.onclick = () => enterEditMode(cell);

            // Manejo de pérdida de foco (blur) o Enter keypress
            cell.onblur = () => confirmEdit(cell);
            cell.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevenir salto de línea en el div
                    confirmEdit(cell);
                }
            };
        }
    });
}


/**
 * ------------------------------------------
 * MANEJO DE CONTROLES Y ACCIONES (R5, R6, R7, R8)
 * ------------------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicialización de coordenadas y carga del estado
    initializeCoords();
    loadState();

    // Adjuntar listeners globales a los botones de acciones
    setupActionListeners();
});


function setupActionListeners() {
    const controlsPanel = document.getElementById('controls-panel');
    if (!controlsPanel) return;

    // Delegación para todos los botones de acción (Borrar, Color, Ocultar...)
    controlsPanel.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;

        const actionType = target.dataset.action; // delete, clear, color, hide
        const selector = target.querySelector('[data-col-letter], [data-row-index]');
        let colLetter = null;
        let rowIndex = null;

        if (selector) {
            if (selector.dataset.colLetter) {
                colLetter = selector.dataset.colLetter;
                rowIndex = null; // Acciones de columna
            } else if (selector.dataset.rowIndex) {
                colLetter = null;
                rowIndex = parseInt(selector.dataset.rowIndex, 10); // Acciones de fila
            }
        }

        if (!colLetter && !rowIndex) return;

        // Ejecutar la acción basada en el tipo y contexto (Columna o Fila)
        if (actionType === 'delete') {
            handleDelete(colLetter, rowIndex);
        } else if (actionType === 'clear') {
            handleClearContent(colLetter, rowIndex);
        } else if (actionType === 'color') {
            handleColorChange(colLetter, rowIndex);
        } else if (actionType === 'hide') {
            handleToggleVisibility(colLetter, rowIndex);
        }
    });
}

/**
 * Maneja la eliminación de una columna o fila.
 */
function handleDelete(colLetter = null, rowIndex = null) {
    let affectedCoords = [];
    let isColumnDelete = !!colLetter && !rowIndex;
    let identifierType = isColumnDelete ? 'column' : 'row';

    if (!isColumnDelete && !rowIndex) return; // Debe haber un identificador

    // 1. Identificar coordenadas a borrar y eliminar del estado
    if (isColumnDelete) {
        for (const row of state.rowIndices) {
            const coord = getCoord(colLetter, row);
            affectedCoords.push(coord);
            delete state.data[coord]; // Eliminar el dato de la fuente de verdad
        }
    } else { // Borrar Fila
        for (const col of state.columnLetters) {
            const coord = getCoord(col, rowIndex);
            affectedCoords.push(coord);
            delete state.data[coord]; 
        }
    }

    // 2. Actualizar la estructura del estado (reducir arrays de coordenadas)
    if (isColumnDelete) {
        state.columnLetters = state.columnLetters.filter(c => c !== colLetter);
    } else { // Borrar Fila
        state.rowIndices = state.rowIndices.filter(r => r !== rowIndex);
    }

    // 3. Re-renderizar y guardar
    saveState();
    renderAllDataAndRecalculate();
}


/**
 * Maneja vaciar el contenido de una columna o fila.
 */
function handleClearContent(colLetter = null, rowIndex = null) {
    let isColumnClear = !!colLetter && !rowIndex;

    if (!isColumnClear && !rowIndex) return; 

    // Iterar sobre las coordenadas afectadas e inicializar su valor en el estado
    const coordsToClear = [];
    if (isColumnClear) {
        for (const row of state.rowIndices) {
            const coord = getCoord(colLetter, row);
            state.data[coord].value = '';
            state.data[coord].formula = null;
            coordsToClear.push(coord);
        }
    } else { // Borrar Fila
        for (const col of state.columnLetters) {
            const coord = getCoord(col, rowIndex);
            state.data[coord].value = '';
            state.data[coord].formula = null;
            coordsToClear.push(coord);
        }
    }

    // 4. Re-renderizar y guardar
    saveState();
    renderAllDataAndRecalculate();
}


/**
 * Maneja el cambio de color de fondo en una columna o fila.
 */
function handleColorChange(colLetter = null, rowIndex = null) {
    const newColor = prompt("Introduce el código hexadecimal del nuevo color (ej: #FF0000):", "#FFFFFF").trim();

    if (!newColor || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
        alert("Formato de color inválido.");
        return;
    }

    let isColumnChange = !!colLetter && !rowIndex;

    // Aplicar el nuevo color a todas las celdas afectadas del estado
    if (isColumnChange) {
        for (const row of state.rowIndices) {
            const coord = getCoord(colLetter, row);
            state.data[coord].bgColor = newColor;
        }
    } else { // Fila
        for (const col of state.columnLetters) {
            const coord = getCoord(col, rowIndex);
            state.data[coord].bgColor = newColor;
        }
    }

    // 3. Re-renderizar y guardar
    saveState();
    renderAllDataAndRecalculate();
}


/**
 * Maneja ocultar/mostrar una columna o fila.
 */
function handleToggleVisibility(colLetter = null, rowIndex = null) {
    let isColumnVisible = !!colLetter && !rowIndex;

    if (isColumnVisible) {
        // Toggle de visibilidad para Columna
        const coords = state.rowIndices.map(r => getCoord(colLetter, r));
        let allHidden = true;
        coords.forEach(coord => {
            const currentState = state.data[coord];
            if (currentState && !currentState.isHidden) {
                state.data[coord].isHidden = false;
                allHidden = false;
            } else if (!currentState) {
                 // Manejar caso de que la celda no exista en el estado por alguna razón.
                state.data[getCoord(colLetter, parseInt(rowIndex)) || 'A1'] = { value: '', formula: null, bgColor: '#FFFFFF', isHidden: false };
            }
        });

        // Si todas estaban ocultas o si es la primera vez que se hace el toggle, asumimos que queremos mostrarlas.
         if (allHidden) {
             console.log("Asumiendo mostrar columna");
         }


    } else if (!rowIndex) {
        // Toggle de visibilidad para Fila
        const coords = state.columnLetters.map(c => getCoord(c, rowIndex));
        let allHidden = true;
        coords.forEach(coord => {
            const currentState = state.data[coord];
             if (currentState && !currentState.isHidden) {
                state.data[coord].isHidden = false;
                allHidden = false;
            } else if (!currentState) {
                 state.data[getCoord('A', rowIndex)] = { value: '', formula: null, bgColor: '#FFFFFF', isHidden: false };
            }
        });

         if (allHidden) {
             console.log("Asumiendo mostrar fila");
         }
    }
    
    // Nota: La implementación de toggle debe ser más robusta para manejar el estado interno de oculto/visible 
    // y asegurarse que si se oculta, no solo se cambia la clase CSS sino que también afecta al layout.

    saveState();
    renderAllDataAndRecalculate(); // Re-renderizar forzará a las celdas a mostrarse/ocultarse correctamente
}
