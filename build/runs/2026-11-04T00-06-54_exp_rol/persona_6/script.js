/**
 * Hoja de Cálculo Sin Framework - Script Principal
 * Implementa la lógica de fórmulas, persistencia y manipulación del grid.
 */

const COLS = 10; // A-J
const ROWS = 20; // 1-20
const STORAGE_KEY = 'spreadsheetData';

// --- Estado Global ---
let state = {}; // Almacena el estado de cada celda: { "A1": { value: "", formula: null, color: "#ffffff" } }
let activeSelection = { col: null, row: null };
let selectedCellElement = null; // El elemento DOM actualmente seleccionado o editado

// --- Utilidades de Coordenadas ---

/** Convierte un índice numérico (0-9) a la letra de columna ('A'-'J'). */
const colIndexToLetter = (index) => {
    return String.fromCharCode('A'.charCodeAt(0) + index);
};

/** Convierte una letra de columna ('A'-'J') a un índice numérico (0-9). */
const letterToColIndex = (letter) => {
    return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
};

/** Obtiene la coordenada (ej: "A1") a partir de índices y números. */
const getCoord = (colIndex, rowIndex) => {
    if (colIndex < 0 || colIndex >= COLS || rowIndex < 0 || rowIndex >= ROWS) return null;
    const letter = colIndexToLetter(colIndex);
    const rowNumber = rowIndex + 1;
    return `${letter}${rowNumber}`;
};

/** Obtiene el elemento DOM de una coordenada, si existe. */
const getCellElement = (coord) => {
    return document.querySelector(`[data-coord="${coord}"]`);
};


// --- Gestión del Estado y Persistencia ---

/** Inicializa o carga los datos desde localStorage. */
function loadState() {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
        state = JSON.parse(storedData);
    } else {
        // Inicializar el estado completo si no hay nada guardado
        for (let r = 1; r <= ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const coord = getCoord(c, r - 1);
                state[coord] = { value: "", formula: null, color: "#ffffff" };
            }
        }
    }
}

/** Guarda el estado actual del grid en localStorage. */
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Error guardando datos en LocalStorage:", e);
    }
}

/** Actualiza el estado de una celda y su representación DOM. */
function updateCellStateAndDOM(coord, newValue = null, newFormula = null, newColor = null) {
    const cellElement = getCellElement(coord);
    if (!cellElement) return;

    // 1. Actualizar el estado global
    state[coord] = {
        value: (newValue !== null) ? newValue : state[coord].value,
        formula: (newFormula !== null) ? newFormula : state[coord].formula,
        color: (newColor !== null) ? newColor : state[coord].color
    };

    // 2. Actualizar el DOM
    cellElement.textContent = ''; // Limpiar contenido antes de renderizar
    cellElement.style.backgroundColor = state[coord].color;

    if (state[coord].formula && !isNaN(parseFloat(state[coord].formula).replace(/[A-Z]\d/g, ''))) {
        // Si es una fórmula y parece un cálculo numérico directo (ej: "=1+2")
        cellElement.textContent = evaluateFormula(state[coord].formula);
    } else if (!isNaN(parseFloat(state[coord].value)) || state[coord].formula) {
         // Si es texto o contiene referencias de fórmula complejas, se evalúa el resultado final
         const displayValue = state[coord].formula ? evaluateFormula(state[coord].formula) : state[coord].value;
         cellElement.textContent = isNaN(parseFloat(displayValue)) ? (typeof displayValue === 'string' && displayValue.startsWith('=') ? displayValue : displayValue) : displayValue;
    } else {
        // Valor simple de texto o número literal
        cellElement.textContent = state[coord].value || '';
    }

    saveState();
}


// --- Lógica de Fórmulas y Cálculo (R3, R4, R11, R12) ---

/** 
 * Evalúa una fórmula dada. Maneja SUMA, referencias y operaciones básicas.
 * @param {string} formula - La fórmula como string (ej: "=SUMA(A1;B2);C3" o "=A1-B1").
 * @returns {number|string} El resultado calculado o el valor de texto si falla.
 */
function evaluateFormula(formula) {
    let expression = formula.trim();

    if (!expression || !expression.startsWith('=')) return '';

    // 1. Limpieza inicial: quitar el signo '='
    expression = expression.substring(1).trim();

    // Función auxiliar para obtener el valor numérico de una coordenada (ej: A1)
    const getCellNumericValue = (coord) => {
        const stateData = state[coord];
        if (!stateData) return 0;
        let valueToEval = stateData.formula || stateData.value;

        // Si la celda fuente es una fórmula, debe evaluarse su resultado primero.
        if (stateData.formula && !isNaN(parseFloat(evaluateFormula(stateData.formula)))) {
             return parseFloat(evaluateFormula(stateData.formula));
        }
        
        const num = parseFloat(valueToEval);
        return isNaN(num) ? 0 : num; // Devuelve 0 si no es un número válido para cálculos
    };

    // 2. Manejo de SUMA (Detecta patrones como SUMA(A1:B2) o SUMA(A1;B2))
    const sumRegex = /SUMA\(\s*(.*?)\s*\)/i;
    if (sumRegex.test(expression)) {
        let match = expression.match(sumRegex);
        let rangeContent = match[1];

        // Manejo de rangos (ej: A1:B2)
        const rangeMatch = rangeContent.match(/([A-Z]+)\d+:\s*([A-Z]+)\d+/i);
        if (rangeMatch) {
            let startCoord = rangeMatch[1] + rangeMatch[2].substring(0, 1); // Ejemplo: A1
            let endCoord = rangeMatch[3] + rangeMatch[4].substring(0, 1);   // Ejemplo: B2

            const [startCol, startRow] = getCoordsFromCoord(startCoord);
            const [endCol, endRow] = getCoordsFromCoord(endCoord);
            
            let totalSum = 0;
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    const coord = getCoord(c, r - 1);
                    totalSum += getCellNumericValue(coord);
                }
            }
            return totalSum.toFixed(2);
        } else {
             // Manejo de celdas sueltas (ej: A1;B2;C3)
            const coords = rangeContent.split(';');
            let sum = 0;
            coords.forEach(coord => {
                const trimmedCoord = coord.trim();
                if (trimmedCoord) {
                    sum += getCellNumericValue(trimmedCoord);
                }
            });
            return sum.toFixed(2);
        }
    }

    // 3. Manejo de operaciones básicas (+, -, *, /)
    // Reemplazar todas las referencias de coordenadas (A1, B2, etc.) por sus valores numéricos calculados.
    let finalExpression = expression;

    // Regex para encontrar patrones de coordenadas como A1, J20, etc. (Letra + 1 o más dígitos)
    const coordRegex = /([A-Z]{1,2}\d{1,3})/g;

    finalExpression = finalExpression.replace(coordRegex, (match) => {
        // Intentar obtener el valor numérico de la coordenada encontrada
        return getCellNumericValue(match).toString();
    });

    try {
        // Usamos eval() con precaución aquí porque es un entorno controlado por nosotros, 
        // y solo recibe expresiones matemáticas después de sustituir las coordenadas.
        const result = new Function('return ' + finalExpression)();
        if (typeof result === 'number') {
            return result.toFixed(2);
        }
    } catch (e) {
        console.warn("Error al evaluar la fórmula:", e, "Expresión:", finalExpression);
    }

    // Si falla la evaluación o no es numérico, devolver el texto original de la fórmula para que el usuario lo vea.
    return formula; 
}

/** Helper: Convierte una coordenada (ej: A1) en [colIndex, rowIndex] (0-based). */
const getCoordsFromCoord = (coord) => {
    if (!coord || coord.length < 2) return [null, null];
    const letter = coord[0].toUpperCase();
    const rowNumStr = coord.substring(1);
    
    const colIndex = letterToColIndex(letter);
    const rowIndex = parseInt(rowNumStr) - 1; // Convertir a 0-based index

    return [colIndex, rowIndex];
};


// --- Renderizado y Eventos de la Interfaz ---

/** Genera los encabezados de columna (A-J). */
function setupColumnHeaders() {
    const headerContainer = document.getElementById('column-headers');
    headerContainer.innerHTML = '<div class="corner-cell"></div>'; // Esquina superior izquierda

    for (let i = 0; i < COLS; i++) {
        const letter = colIndexToLetter(i);
        const headerDiv = document.createElement('div');
        headerDiv.className = 'column-header';
        headerDiv.textContent = letter;
        headerDiv.dataset.colIndex = i;
        headerDiv.dataset.columnLetter = letter;
        headerDiv.addEventListener('click', () => selectColumn(i));
        headerContainer.appendChild(headerDiv);
    }
}

/** Genera la estructura de celdas en el grid (20x10). */
function setupGrid() {
    const gridArea = document.getElementById('grid-area');
    gridArea.innerHTML = ''; // Limpiar antes de generar

    for (let r = 1; r <= ROWS; r++) {
        // Crear la fila contenedora
        const rowDiv = document.createElement('div');
        rowDiv.className = 'spreadsheet-row';
        rowDiv.dataset.rowIndex = r - 1; // Usamos índice 0-based para el dataset

        // Crear los 10 elementos de columna (A a J)
        for (let c = 0; c < COLS; c++) {
            const coord = getCoord(c, r - 1);
            const cellDiv = document.createElement('div');
            cellDiv.className = 'spreadsheet-cell';
            cellDiv.dataset.coord = coord; // Identificador clave
            cellDiv.tabIndex = 0; // Hacerlo enfocable

            // Inicializar el estado visual y de datos (Esto se sobreescribe con loadState/renderCell)
            cellDiv.contentEditable = "false"; 
            cellDiv.textContent = ''; 
            
            // Añadir listener para hacer la celda editable al clickearla o enfocarla
            cellDiv.addEventListener('click', (e) => handleCellClick(e, coord));
            cellDiv.addEventListener('blur', () => handleBlur(coord)); // Cuando pierde foco

            rowDiv.appendChild(cellDiv);
        }
        gridArea.appendChild(rowDiv);
    }
}

/** Renderiza o actualiza el estado visual de todas las celdas basándose en `state`. */
function renderAllCells() {
    Object.keys(state).forEach(coord => {
        const cellElement = getCellElement(coord);
        if (cellElement) {
            // Aplicar color y contenido del estado guardado
            updateCellStateAndDOM(coord, null, null, state[coord].color); 
        }
    });
}

// --- Manejadores de Eventos de la Interfaz ---

/**
 * Hace que una celda sea editable al hacer clic o enfocar.
 */
function handleCellClick(e, coord) {
    const cellElement = e.currentTarget;
    
    // 1. Deshabilitar cualquier selección previa y actualizar el estado visual
    if (selectedCellElement && selectedCellElement !== cellElement) {
        selectedCellElement.classList.remove('selected');
    }
    selectedCellElement = cellElement;
    cellElement.classList.add('selected');

    // 2. Ponerlo en modo editable
    cellElement.contentEditable = "true";
    cellElement.focus();

    // 3. Actualizar la selección activa (para botones de herramientas)
    activeSelection = { col: letterToColIndex(coord[0]), row: parseInt(coord.substring(1)) - 1 };
}

/** Maneja lo que sucede cuando una celda pierde foco, guardando el contenido y recalculando. */
function handleBlur(coord) {
    const cellElement = getCellElement(coord);
    if (!cellElement) return;

    // Capturar el nuevo valor del DOM (puede ser texto o fórmula)
    let newValue = cellElement.textContent.trim();
    let formulaValue = null;
    
    // Determinar si lo que se escribió es una fórmula
    if (newValue.startsWith('=')) {
        formulaValue = newValue;
        // Guardamos la fórmula y limpiamos el texto para mostrarlo como fórmula en el estado
        updateCellStateAndDOM(coord, null, formulaValue, state[coord].color); 
        // El contenido editable se mantiene visible con el signo '='
        cellElement.textContent = newValue; 

    } else {
        formulaValue = null;
        // Guardamos solo el valor y actualizamos la vista
        updateCellStateAndDOM(coord, newValue, formulaValue, state[coord].color);
        // El contenido editable debe mostrar el valor limpio
        cellElement.textContent = newValue; 
    }

    // Después de cualquier cambio de datos, se deben recalcular todas las fórmulas dependientes.
    recalculateAllDependentCells(coord);
    saveState();
}


/** Selecciona una columna haciendo clic en su letra (R6). */
function selectColumn(colIndex) {
    // Deseleccionar cualquier celda previamente seleccionada
    if (selectedCellElement) {
        selectedCellElement.classList.remove('selected');
        selectedCellElement = null;
    }

    activeSelection.col = colIndex;
    activeSelection.row = null; // Reseteamos la selección de fila

    // Actualizar botones de herramientas y habilitar acciones
    document.getElementById('btn-delete-selected').disabled = false;
    document.getElementById('btn-clear-selection').disabled = false;

    console.log(`Columna ${colIndex} seleccionada.`);
}

/** Selecciona una fila haciendo clic en su número (R7). */
function selectRow(rowIndex) {
    // Deseleccionar cualquier celda previamente seleccionada
    if (selectedCellElement) {
        selectedCellElement.classList.remove('selected');
        selectedCellElement = null;
    }

    activeSelection.row = rowIndex;
    activeSelection.col = null; // Reseteamos la selección de columna

    // Actualizar botones de herramientas y habilitar acciones
    document.getElementById('btn-delete-selected').disabled = false;
    document.getElementById('btn-clear-selection').disabled = false;

    console.log(`Fila ${rowIndex} seleccionada.`);
}

/** 
 * Recalcula todas las celdas cuyo contenido depende de la coordenada modificada (A1).
 * Esto es clave para que las fórmulas se actualicen automáticamente.
 */
function recalculateAllDependentCells(triggerCoord) {
    // En una implementación real, aquí sería un mapa de dependencias. 
    // Por simplicidad y robustez en este contexto, recorremos todas las celdas 
    // e intentamos evaluarlas si contienen fórmulas. Esto asegura que si A1 cambia, B4 (que usa A1) se actualice.

    let recalculatedCount = 0;
    Object.keys(state).forEach(coord => {
        const cellElement = getCellElement(coord);
        if (!cellElement) return;

        // Solo recalcular si la celda contiene una fórmula
        if (state[coord].formula && state[coord].formula.startsWith('=')) {
            const newValue = evaluateFormula(state[coord].formula);
            
            // Si el valor calculado es diferente al que se muestra, actualizamos y lo guardamos.
            const currentValueDisplay = cellElement.textContent;

            if (currentValueDisplay !== newValue) {
                updateCellStateAndDOM(coord, null, state[coord].formula, state[coord].color);
                recalculatedCount++;
            }
        }
    });
    console.log(`Recálculo de ${recalculatedCount} celdas completado.`);
}


// --- Funcionalidades Avanzadas (Herramientas) ---

/** 
 * Borra el contenido o la fórmula de la selección activa (R6, R7).
 */
function handleClearSelection() {
    if (!activeSelection.col && !activeSelection.row) return;

    let coordsToClear = [];
    if (activeSelection.col !== null) { // Selección de Columna
        for (let r = 0; r < ROWS; r++) {
            coordsToClear.push(getCoord(activeSelection.col, r));
        }
    } else if (activeSelection.row !== null) { // Selección de Fila
        for (let c = 0; c < COLS; c++) {
            coordsToClear.push(getCoord(c, activeSelection.row));
        }
    }

    if (coordsToClear.length === 0) return;

    // Limpiar estado y DOM para todas las coordenadas
    coordsToClear.forEach(coord => {
        state[coord] = { value: "", formula: null, color: "#ffffff" };
        const cellElement = getCellElement(coord);
        if (cellElement) {
            updateCellStateAndDOM(coord, "", null, "#ffffff"); 
        }
    });

    // Re-renderizar para asegurar que todos los estilos y contenidos se limpien
    renderAllCells();
    saveState();
}


/** Borra completamente la columna o la fila de selección activa (R6, R7). */
function handleDeleteSelection() {
    if (!activeSelection.col && !activeSelection.row) return;

    let coordsToDelete = [];
    if (activeSelection.col !== null) { // Borrar Columna
        for (let r = 0; r < ROWS; r++) {
            coordsToDelete.push(getCoord(activeSelection.col, r));
        }
        // Remover la cabecera de la columna
        const colHeader = document.querySelector(`[data-column-letter="${colIndexToLetter(activeSelection.col)}"]`);
        if (colHeader) colHeader.remove();

    } else if (activeSelection.row !== null) { // Borrar Fila
        for (let c = 0; c < COLS; c++) {
            coordsToDelete.push(getCoord(c, activeSelection.row));
        }
        // Remover el contenedor de la fila completa
        const rowElement = document.querySelector(`[data-row-index="${activeSelection.row}"]`);
        if (rowElement) rowElement.remove();
    }

    // Eliminar del estado global y del DOM
    coordsToDelete.forEach(coord => {
        delete state[coord];
        const cellElement = getCellElement(coord);
        if (cellElement) cellElement.remove(); // Remover el elemento físico
    });

    activeSelection.col = null; 
    activeSelection.row = null;
    selectedCellElement = null;

    // Limpiar botones y guardar estado vacío
    document.getElementById('btn-delete-selected').disabled = true;
    document.getElementById('btn-clear-selection').disabled = true;
    saveState();
}


/** Oculta/Muestra una columna (R8, R14). */
function toggleColumnVisibility(colIndex) {
    const colHeader = document.querySelector(`[data-column-letter="${colIndexToLetter(colIndex)}"]`);
    if (!colHeader) return;

    // 1. Actualizar visibilidad del encabezado de columna (A-J)
    const isHidden = colHeader.style.display === 'none';
    if (isHidden) {
        colHeader.style.display = ''; // Mostrar
        // Mover el contenido oculto al DOM para que la estructura no se rompa visualmente si es necesario, 
        // aunque en este caso, simplemente cambiar display: none basta.
    } else {
        colHeader.style.display = 'none'; // Ocultar
    }

    // 2. Actualizar visibilidad de las celdas (Grid)
    const rowElements = document.querySelectorAll('.spreadsheet-row');
    rowElements.forEach(row => {
        const cellToToggle = row.querySelector(`[data-coord="${getCoord(colIndex, parseInt(row.dataset.rowIndex))}"]`);
        if (cellToToggle) {
            cellToToggle.style.display = isHidden ? '' : 'none'; // Alternar visibilidad
        }
    });

    // 3. Actualizar el estado y la selección
    activeSelection.col = colIndex; // Asumimos que se selecciona por su índice para las herramientas
    if (isHidden) {
        alert(`Columna ${colIndexToLetter(colIndex)} visible.`);
    } else {
        alert(`Columna ${colIndexToLetter(colIndex)} oculta.`);
    }

    saveState();
}

/** Oculta/Muestra una fila (R8, R16). */
function toggleRowVisibility(rowIndex) {
    const rowElement = document.querySelector(`[data-row-index="${rowIndex}"]`);
    if (!rowElement) return;

    // 1. Actualizar visibilidad del contenedor de la fila
    const isHidden = rowElement.style.display === 'none';
    if (isHidden) {
        rowElement.style.display = ''; // Mostrar
    } else {
        rowElement.style.display = 'none'; // Ocultar
    }

    // 2. Actualizar el estado y la selección
    activeSelection.row = rowIndex;
     if (isHidden) {
        alert(`Fila ${rowIndex + 1} visible.`);
    } else {
        alert(`Fila ${rowIndex + 1} oculta.`);
    }

    saveState();
}


/** Cambia el color de fondo para la selección activa (R5). */
function handleFormatBackground() {
    const inputColor = document.getElementById('color-picker').value;
    if (!inputColor) return;

    let coordsToUpdate = [];
    if (activeSelection.col !== null) { // Selección de Columna
        for (let r = 0; r < ROWS; r++) {
            coordsToUpdate.push(getCoord(activeSelection.col, r));
        }
    } else if (activeSelection.row !== null) { // Selección de Fila
        for (let c = 0; c < COLS; c++) {
            coordsToUpdate.push(getCoord(c, activeSelection.col === null ? c : activeSelection.col));
        }
    } else {
        // Si no hay selección activa, no hacer nada o forzar la edición de una celda si está seleccionada
        return; 
    }

    coordsToUpdate.forEach(coord => {
        state[coord].color = inputColor;
        const cellElement = getCellElement(coord);
        if (cellElement) {
            updateCellStateAndDOM(coord, null, null, inputColor);
        }
    });

    saveState();
}


// --- Inicialización Principal ---

function init() {
    // 1. Configurar la estructura inicial del DOM y los listeners de cabecera/fila (Simulando clics en A-J y 1-20)
    setupColumnHeaders();
    setupGrid();

    // 2. Cargar el estado persistente
    loadState();
    renderAllCells(); // Pinta todo basado en lo guardado

    // 3. Configurar listeners de botones de herramientas (Deben estar visibles en index.html)
    document.getElementById('btn-format-background').addEventListener('click', handleFormatBackground);
    document.getElementById('btn-delete-selected').addEventListener('click', handleDeleteSelection);
    document.getElementById('btn-clear-selection').addEventListener('click', handleClearSelection);

    // 4. Implementar la lógica de selección manual (Simulando clics en letra/número)
    // Nota: Como no tenemos un selector visual de filas y columnas, asumimos que el click en los headers y el manejo del grid es suficiente para establecer activeSelection.
}

// Ejecutar al cargar el script
document.addEventListener('DOMContentLoaded', init);
