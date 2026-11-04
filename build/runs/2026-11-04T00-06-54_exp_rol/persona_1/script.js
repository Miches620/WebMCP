// ==============================================
// CONFIGURACIÓN Y CONSTANTES
// ==============================================

const MAX_ROWS = 20;
const MAX_COLS = 10; // A-J
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROWS = Array.from({ length: MAX_ROWS }, (_, i) => i + 1);

// Objeto global para mantener el estado de la hoja (valores, fórmulas, colores, visibilidad)
let spreadsheetState = {};
let selectedRowIndex = null;
let selectedColIndex = null;

const $gridArea = document.getElementById('spreadsheet-grid');
const $rowSelectors = document.getElementById('row-selectors');
const $colSelectors = document.getElementById('column-selectors');

// ==============================================
// UTILIDADES Y MÉTODOS DE COORDINACIÓN
// ==============================================

/**
 * Convierte un índice de columna (0-9) a su letra ('A'-'J').
 * @param {number} index - Índice numérico.
 * @returns {string} La letra correspondiente.
 */
function colIndexToLetter(index) {
    return COLUMNS[index];
}

/**
 * Obtiene el identificador de la celda (ej: 'A1').
 * @param {number} row - Número de fila.
 * @param {string} col - Letra de columna.
 * @returns {string} Coordenada A1.
 */
function getCoord(row, col) {
    return `${col}${row}`;
}

/**
 * Obtiene la referencia del DOM para una celda dada su coordenada.
 * @param {string} coord - Coordenada (ej: 'A1').
 * @returns {HTMLElement | null} El elemento DIV de la celda o null.
 */
function getCellElement(coord) {
    return document.querySelector(`.cell[data-col="${coord.replace(/[0-9]/g, '')}"][data-row="${coord.slice(-1)}"]`);
}

/**
 * Determina si un valor es un número flotante o entero.
 * @param {*} val - Valor a verificar.
 * @returns {number | null} El valor numérico o null.
 */
function parseNumber(val) {
    if (typeof val === 'string' && !isNaN(parseFloat(val)) && isFinite(val)) {
        return parseFloat(val);
    } else if (typeof val === 'number') {
        return val;
    }
    return null;
}

// ==============================================
// GESTIÓN DEL ESTADO Y PERSISTENCIA (LOCALSTORAGE)
// ==============================================

/**
 * Inicializa el estado de la hoja si no existe o carga desde localStorage.
 */
function initializeState() {
    if (!localStorage.getItem('spreadsheetState')) {
        let emptyState = {};
        for (let r = 1; r <= MAX_ROWS; r++) {
            emptyState[r] = {};
            for (let c = 0; c < MAX_COLS; c++) {
                const colLetter = colIndexToLetter(c);
                const coord = getCoord(r, colLetter);
                emptyState[r][colLetter] = {
                    value: '',
                    formula: null,
                    color: '#ffffff',
                    isHidden: false
                };
            }
        }
        spreadsheetState = emptyState;
        saveState(); // Guarda la estructura inicial vacía
    } else {
        spreadsheetState = JSON.parse(localStorage.getItem('spreadsheetState'));
    }
}

/**
 * Guardar el estado completo de la hoja en localStorage.
*/
function saveState() {
    try {
        localStorage.setItem('spreadsheetState', JSON.stringify(spreadsheetState));
    } catch (e) {
        console.error("Error guardando el estado en LocalStorage:", e);
    }
}

/**
 * Actualiza el modelo de datos para una celda dada su coordenada y valor.
 * @param {string} coord - Coordenada A1.
 * @param {string} rawValue - El texto que se escribió.
 */
function updateCellState(coord, rawValue) {
    const row = parseInt(coord.slice(-1));
    const colLetter = coord.replace(/[0-9]/g, '');

    if (!spreadsheetState[row] || !spreadsheetState[row][colLetter]) return;

    let newState = { ...spreadsheetState[row][colLetter] };

    // 1. Detectar si es fórmula o valor literal
    const isFormula = rawValue && rawValue.trim().startsWith('=');
    
    if (isFormula) {
        newState.formula = rawValue;
        newState.value = ''; // El valor visible será el resultado, no la fórmula misma
    } else {
        newState.formula = null;
        newState.value = rawValue;
    }

    // 2. Aplicar el nuevo estado y guardar
    spreadsheetState[row][colLetter] = newState;
    saveState();
    
    // Después de cambiar el valor, forzar la recalculación de todas las celdas dependientes
    recalculateAllDependencies(coord);
}

/**
 * Actualiza visualmente una celda con su estado modelado (valor y color).
 * @param {string} coord - Coordenada A1.
 */
function renderCell(coord) {
    const element = getCellElement(coord);
    if (!element) return;

    const state = spreadsheetState[parseInt(coord.slice(-1))][coord.replace(/[0-9]/g, '')];
    
    // 1. Establecer el contenido editable (lo que ve el usuario)
    if (state.formula) {
        element.textContent = state.value || ''; // Mostrar resultado de la fórmula si existe
    } else {
        element.textContent = state.value || ''; // Mostrar valor literal
    }

    // 2. Manejar clases y estilos
    element.style.backgroundColor = state.color;
    
    // Asegurar que el atributo contenteditable esté siempre presente para la edición
    if (!element.hasAttribute('contenteditable')) {
        element.setAttribute('contenteditable', 'true');
    }
}

/**
 * Recalcula el contenido de una celda específica basada en su fórmula y los valores actuales del modelo.
 * @param {string} coord - Coordenada A1.
 */
function recalculateCell(coord) {
    const row = parseInt(coord.slice(-1));
    const colLetter = coord.replace(/[0-9]/g, '');
    const state = spreadsheetState[row][colLetter];

    if (!state || !state.formula) {
        renderCell(coord); // Solo renderizar si no hay fórmula
        return;
    }

    let formulaString = state.formula;
    let resolvedFormula = formulaString;

    // 1. Reemplazar referencias de coordenadas (A1, B2) por sus valores numéricos actuales.
    // Expresión regular para encontrar patrones como A1, C5, etc.
    resolvedFormula = resolvedFormula.replace(/([A-Z]+)([0-9]+)/g, (match, colLetterRef, rowNumStr) => {
        const r = parseInt(rowNumStr);
        const c = colLetterRef;
        const currentCoord = getCoord(r, c);
        // Obtener el valor *visible* del modelo para esa celda.
        const valState = spreadsheetState[r][c]; 
        let valueToInsert;

        if (valState && valState.formula) {
            // Si la referencia es otra fórmula, debe usar su resultado calculado
            valueToInsert = valState.value || '0'; 
        } else if (valState) {
            valueToInsert = valState.value || '0';
        } else {
            valueToInsert = '0'; // Por defecto si no existe
        }
        return valueToInsert;
    });

    let calculatedValue = null;
    try {
        // 2. Evaluar la fórmula convertida a JS. Solo se usa eval() porque es el único camino sin librerías,
        // pero está contenido y limitado a las variables del spreadsheetState.
        calculatedValue = new Function('return ' + resolvedFormula)();
    } catch (e) {
        console.error(`Error al evaluar fórmula ${coord}:`, e);
        calculateError(coord, "¡ERROR!");
        return;
    }

    // 3. Actualizar el estado y la vista con el resultado numérico o formateado.
    const finalValue = isNaN(parseFloat(calculatedValue)) ? String(calculatedValue) : calculatedValue;
    
    state.value = finalValue; // El valor almacenado es el resultado, no la fórmula
    renderCell(coord);
}

/**
 * Fuerza el cálculo de todas las celdas que dependen directamente del cambio en 'sourceCoord'.
 * (Implementación simplificada: Recalcula todo el rango A1:J20 para asegurar dependencia).
 * En un sistema real, se usaría un grafo de dependencias. Aquí es más seguro recalcular todo.
 * @param {string} sourceCoord - La celda que acaba de cambiar.
 */
function recalculateAllDependencies(sourceCoord) {
    // Solo necesitamos revisar las celdas que tienen fórmulas
    for (let r = 1; r <= MAX_ROWS; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const colLetter = colIndexToLetter(c);
            const coord = getCoord(r, colLetter);

            // Solo recalculamos si la celda tiene una fórmula y no está oculta
            if (spreadsheetState[r][colLetter] && spreadsheetState[r][colLetter].formula) {
                recalculateCell(coord);
            } else if (!document.querySelector(`.cell[data-col="${colLetter}"][data-row="${r}"]`).style.display) {
                 // Renderizar incluso si está oculta para mantener el estado en memoria (aunque no se vea)
                renderCell(coord); 
            }
        }
    }
}

/**
 * Muestra un mensaje de error visualmente y guarda el estado.
 */
function calculateError(coord, message) {
    const row = parseInt(coord.slice(-1));
    const colLetter = coord.replace(/[0-9]/g, '');
    spreadsheetState[row][colLetter].value = `ERROR: ${message}`;
    saveState();
}


// ==============================================
// MANEJO DE EVENTOS Y INTERACCIÓN DEL USUARIO
// ==============================================

/**
 * Maneja la edición de una celda cuando el usuario pierde el foco (blur).
 * @param {Event} e - Evento de evento.
 */
function handleCellEdit(e) {
    const element = e.target;
    if (!element || !element.dataset.col || !element.dataset.row) return;

    const coord = getCoord(parseInt(element.dataset.row), element.dataset.col);
    const rawValue = element.textContent.trim(); // Capturamos el texto tal cual está en el DOM

    // 1. Actualizar el modelo de datos y guardar (Esto también dispara la recalculación)
    updateCellState(coord, rawValue);

    // Nota: La función updateCellState ya llama a recalculateAllDependencies(coord).
}


/**
 * Inicializa los selectores de fila y columna en el DOM.
 */
function initializeSelectors() {
    let rowHtml = '';
    for (let r = 1; r <= MAX_ROWS; r++) {
        rowHtml += `<div class="selector-item row-selector" data-row-index="${r}">${r}</div>`;
    }
    $rowSelectors.innerHTML = `<h4>Filas</h4>` + rowHtml;

    let colHtml = '';
    COLUMNS.forEach(col => {
        colHtml += `<div class="selector-item col-selector" data-col-index="${col}">${col}</div>`;
    });
    $colSelectors.innerHTML = `<h4>Columnas</h4>` + colHtml;
}

/**
 * Maneja la selección de una fila o columna y resalta el elemento activo.
 * @param {HTMLElement} selectorItem - El div del selector clickeado.
 * @param {'row' | 'col'} type - Tipo de selector ('row' o 'col').
 */
function selectDimension(selectorItem, type) {
    // Deseleccionar todos primero (limpieza visual)
    document.querySelectorAll('.selection-section .selector-item').forEach(el => {
        el.classList.remove('selected');
    });

    // Seleccionar el actual
    selectorItem.classList.add('selected');

    if (type === 'row') {
        const rowIndex = parseInt(selectorItem.dataset.rowIndex);
        selectedRowIndex = rowIndex;
        selectedColIndex = null;
    } else if (type === 'col') {
        const colIndex = selectorItem.dataset.colIndex;
        selectedColIndex = COLUMNS.indexOf(colIndex);
        selectedRowIndex = null;
    }

    // Actualizar el estado de los botones de acción
    updateActionButtons();
}


/**
 * Aplica un color de fondo a una dimensión (fila o columna) y actualiza el estado.
 * @param {'row' | 'col'} type - Tipo de dimensión.
 * @param {HTMLElement} selectorItem - El elemento del selector clickeado.
 * @param {string} colorHex - Código hexadecimal del color.
 */
function applyColorToDimension(type, selectorItem, colorHex) {
    const isRow = type === 'row';
    const targetIndex = isRow ? parseInt(selectorItem.dataset.rowIndex) : selectorItem.dataset.colIndex;

    // Iterar sobre todas las celdas de esa dimensión y actualizar el estado/DOM
    for (let r = 1; r <= MAX_ROWS; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const colLetter = colIndexToLetter(c);
            const coord = getCoord(r, colLetter);

            if (isRow) { // Si seleccionamos Fila R: Aplicar a todas las columnas de esa fila
                if (r === parseInt(selectorItem.dataset.rowIndex)) {
                    // Actualizar el estado y la vista para esta celda específica
                     spreadsheetState[r][colLetter].color = colorHex;
                     renderCell(coord); 
                }
            } else { // Si seleccionamos Columna C: Aplicar a todas las filas de esa columna
                 if (colLetter === targetIndex) {
                    // Actualizar el estado y la vista para esta celda específica
                     spreadsheetState[r][colLetter].color = colorHex;
                     renderCell(coord); 
                }
            }
        }
    }

    saveState();
}


/**
 * Borra contenido o limpia un área seleccionada.
 * @param {'row' | 'col'} type - Tipo de dimensión.
 * @param {HTMLElement} selectorItem - El elemento del selector clickeado.
 */
function clearDimension(type, selectorItem) {
    const isRow = type === 'row';
    const targetIndex = isRow ? parseInt(selectorItem.dataset.rowIndex) : selectorItem.dataset.colIndex;

    for (let r = 1; r <= MAX_ROWS; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const colLetter = colIndexToLetter(c);
            const coord = getCoord(r, colLetter);

            if (isRow) { // Si seleccionamos Fila R: Limpiar todas las columnas de esa fila
                if (r === parseInt(selectorItem.dataset.rowIndex)) {
                    spreadsheetState[r][colLetter].value = '';
                    spreadsheetState[r][colLetter].formula = null;
                    renderCell(coord); 
                }
            } else { // Si seleccionamos Columna C: Limpiar todas las filas de esa columna
                if (colLetter === targetIndex) {
                    spreadsheetState[r][colLetter].value = '';
                    spreadsheetState[r][colLetter].formula = null;
                    renderCell(coord); 
                }
            }
        }
    }

    saveState();
}


/**
 * Borra una dimensión (fila o columna) completa.
 * @param {'row' | 'col'} type - Tipo de dimensión.
 * @param {HTMLElement} selectorItem - El elemento del selector clickeado.
 */
function deleteDimension(type, selectorItem) {
    const isRow = type === 'row';
    const targetIndex = isRow ? parseInt(selectorItem.dataset.rowIndex) : selectorItem.dataset.colIndex;

    if (!confirm(`¿Está seguro de que desea borrar la ${isRow ? 'fila' : 'columna'} ${targetIndex}? Esta acción es irreversible.`)) {
        return;
    }

    // 1. Limpiar el estado y los selectores
    delete spreadsheetState[isRow ? targetIndex : undefined]; // Borra las entradas de la fila/columna entera del modelo
    
    if (type === 'row') {
         // Recalcular índices visuales si borramos una fila para mantener la coherencia de la interfaz.
        const rowNum = parseInt(selectorItem.dataset.rowIndex);
        document.querySelector(`.row[data-row-index="${rowNum}"]`).remove();
    } else { // Columna
         // Eliminar el selector y ajustar los índices visuales (solo si fuera necesario, aquí es complejo sin re-renderizar todo)
         const colLetter = targetIndex;
         document.getElementById(`col-${colLetter}`).remove();
    }

    saveState();
    recalculateAllDependencies(getCoord(1, 'A')); // Forzar recalculación global tras la estructura
}


/**
 * Oculta o muestra una dimensión completa.
 * @param {'row' | 'col'} type - Tipo de dimensión.
 * @param {HTMLElement} selectorItem - El elemento del selector clickeado.
 */
function toggleVisibility(type, selectorItem) {
    const isVisible = !spreadsheetState[type === 'row' ? parseInt(selectorItem.dataset.rowIndex) : undefined] || 
                       !spreadsheetState[type === 'row' ? parseInt(selectorItem.dataset.rowIndex) : undefined][selectorItem.dataset.colIndex]?.isHidden;

    const coordPrefix = type === 'row' ? `row-${selectorItem.dataset.rowIndex}` : `col-${selectorItem.dataset.colIndex}`;
    
    let newState = { ...spreadsheetState[type === 'row' ? parseInt(selectorItem.dataset.rowIndex) : undefined][selectorItem.dataset.colIndex] };

    if (type === 'row') {
        // Manejar fila completa: hay que iterar sobre todas las columnas para actualizar la visibilidad de cada celda
        for (let c = 0; c < MAX_COLS; c++) {
            const colLetter = colIndexToLetter(c);
            const coord = getCoord(parseInt(selectorItem.dataset.rowIndex), colLetter);

            if (isVisible) { // Ocultar
                spreadsheetState[parseInt(selectorItem.dataset.rowIndex)][colLetter].isHidden = true;
                document.querySelector(`.cell[data-col="${colLetter}"][data-row="${selectorItem.dataset.rowIndex}"]`).style.display = 'none';
            } else { // Mostrar
                // Restaurar el valor y la visibilidad del estado (asumiendo que no se borró)
                spreadsheetState[parseInt(selectorItem.dataset.rowIndex)][colLetter].isHidden = false;
                document.querySelector(`.cell[data-col="${colLetter}"][data-row="${selectorItem.dataset.rowIndex}"]`).style.display = '';
            }
        }
    } else { // Columna completa
         for (let r = 1; r <= MAX_ROWS; r++) {
            const coord = getCoord(r, selectorItem.dataset.colIndex);

            if (isVisible) { // Ocultar
                spreadsheetState[r][selectorItem.dataset.colIndex].isHidden = true;
                document.querySelector(`.cell[data-col="${selectorItem.dataset.colIndex}"][data-row="${r}"]`).style.display = 'none';
            } else { // Mostrar
                 // Restaurar el valor y la visibilidad del estado
                spreadsheetState[r][selectorItem.dataset.colIndex].isHidden = false;
                document.querySelector(`.cell[data-col="${selectorItem.dataset.colIndex}"][data-row="${r}"]`).style.display = '';
            }
        }
    }

    saveState();
}


/**
 * Actualiza el estado de los botones (habilitar/deshabilitar) en función de la selección actual.
 */
function updateActionButtons() {
    const hasSelection = selectedRowIndex !== null || selectedColIndex !== null;
    
    document.getElementById('btn-delete-row').disabled = !selectedRowIndex;
    document.getElementById('btn-hide-row').disabled = !selectedRowIndex;
    document.getElementById('btn-show-row').disabled = !selectedRowIndex;

    document.getElementById('btn-delete-col').disabled = !selectedColIndex;
    document.getElementById('btn-hide-col').disabled = !selectedColIndex;
    document.getElementById('btn-show-col').disabled = !selectedColIndex;

    // Los botones de borrar/limpiar solo se habilitan si hay selección activa en alguna dimensión
    document.getElementById('btn-clear-selection').disabled = !hasSelection;
    document.getElementById('btn-delete-row').disabled = !selectedRowIndex;
    document.getElementById('btn-delete-col').disabled = !selectedColIndex;
}

// ==============================================
// MANEJO DE EVENTOS GLOBALES (EVENT DELEGATION)
// ==============================================

function setupEventListeners() {
    // 1. Evento de edición en la celda (Focus Out/Blur)
    $gridArea.addEventListener('blur', handleCellEdit, { capture: true });
    // También es útil capturar el evento keyup para asegurar que el cambio se registre si no sale el foco
     $gridArea.addEventListener('input', function(e) {
        if (e.target.classList.contains('cell')) {
            const coord = getCoord(parseInt(e.target.dataset.row), e.target.dataset.col);
            // Esto asegura que la recalculación ocurra inmediatamente después de un input manual
             updateCellState(coord, e.target.textContent); 
        }
    });


    // 2. Eventos en Selectores (Fila y Columna) - Delegación
    $rowSelectors.addEventListener('click', (e) => {
        if (e.target.classList.contains('selector-item')) {
            const rowIndex = e.target.dataset.rowIndex;
            selectDimension(e.target, 'row');
        }
    });

    $colSelectors.addEventListener('click', (e) => {
        if (e.target.classList.contains('selector-item')) {
            const colIndex = e.target.dataset.colIndex;
            selectDimension(e.target, 'col');
        }
    });

    // 3. Eventos de Botones de Acción
    document.getElementById('btn-clear-selection').addEventListener('click', () => {
        if (selectedRowIndex && selectedColIndex) {
             alert("La limpieza masiva en este contexto requiere una lógica más avanzada para definir el rango exacto. Por ahora, solo se puede limpiar por dimensión.");
        } else if (selectedRowIndex) {
            clearDimension('row', document.querySelector(`.selector-item[data-row-index="${selectedRowIndex}"]`));
        } else if (selectedColIndex) {
            clearDimension('col', document.querySelector(`.selector-item[data-col-index="${selectedColIndex}"]`));
        }
    });

    document.getElementById('btn-delete-row').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-row-index="${selectedRowIndex}"]`);
        if (selectorItem) deleteDimension('row', selectorItem);
    });

    document.getElementById('btn-delete-col').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-col-index="${selectedColIndex}"]`);
        if (selectorItem) deleteDimension('col', selectorItem);
    });

    // Color de fondo (se asume que el color se pasa como argumento o se obtiene del UI)
     document.getElementById('btn-set-color').addEventListener('click', () => {
        const color = prompt("Introduce el código HEX del color de fondo (ej: #FF0000):", "#ff0000");
        if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) {
            // La lógica actual solo permite aplicar un color a la dimensión seleccionada. 
            // Si ambas están seleccionadas, se aplica el último color o hay que mejorar esta función.
             if (selectedRowIndex) {
                applyColorToDimension('row', document.querySelector(`.selector-item[data-row-index="${selectedRowIndex}"]`), color);
            } else if (selectedColIndex) {
                applyColorToDimension('col', document.querySelector(`.selector-item[data-col-index="${selectedColIndex}"]`), color);
            } else {
                 alert("Por favor, selecciona una fila o columna primero.");
             }
        }
    });

    // Ocultar/Mostrar Fila y Columna
    document.getElementById('btn-hide-row').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-row-index="${selectedRowIndex}"]`);
        if (selectorItem) toggleVisibility('row', selectorItem);
    });

    document.getElementById('btn-show-row').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-row-index="${selectedRowIndex}"]`);
        if (selectorItem) toggleVisibility('row', selectorItem);
    });

    document.getElementById('btn-hide-col').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-col-index="${selectedColIndex}"]`);
         if (selectorItem) toggleVisibility('col', selectorItem);
    });

     document.getElementById('btn-show-col').addEventListener('click', () => {
        const selectorItem = document.querySelector(`.selector-item[data-col-index="${selectedColIndex}"]`);
        if (selectorItem) toggleVisibility('col', selectorItem);
    });
}


// ==============================================
// INICIALIZACIÓN PRINCIPAL
// ==============================================

function initSpreadsheet() {
    initializeState();
    setupEventListeners();
    
    // 1. Rellenar el DOM de celdas y selectores (Aunque HTML provee la estructura, debemos asegurar los listeners)
    for (let r = 1; r <= MAX_ROWS; r++) {
        for (let c = 0; c < MAX_COLS; c++) {
            const colLetter = colIndexToLetter(c);
            const coord = getCoord(r, colLetter);
            renderCell(coord); // Renderiza el estado inicial (vacío) en cada celda
        }
    }

    // 2. Establecer la selección por defecto (ej: A1) y actualizar botones
    selectDimension(document.querySelector('.selector-item[data-row-index="1"]'), 'row');
    selectDimension(document.querySelector('.selector-item[data-col-index="A"]'), 'col');

    // 3. Recalcular todo por si hay valores preestablecidos en localStorage que requieren cálculo
    recalculateAllDependencies('A1'); 
}

// Ejecutar la aplicación al cargar el script
initSpreadsheet();
