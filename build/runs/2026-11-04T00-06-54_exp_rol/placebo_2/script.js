// Constantes globales de la hoja de cálculo
const NUM_COLUMNS = 10; // A a J
const NUM_ROWS = 20;   // 1 a 20
const STORAGE_KEY = "spreadsheetData";

/**
 * @type {Object<string, Cell>} Mapa que almacena el estado completo de la hoja.
 * Key: Coordenada (ej: "A1"). Value: Objeto con valor, fórmula y color.
 */
let spreadsheetState = {};

// --- Helpers de Utilidad ---

/** Genera la letra de columna para un índice dado (0=A, 9=J). */
const getColumnLetter = (colIndex) => {
    let letter = '';
    while (colIndex >= 0) {
        letter = String.fromCharCode(65 + colIndex) + letter;
        colIndex = Math.floor(colIndex / 26) - 1;
    }
    return letter;
};

/** Convierte una coordenada "A1" a índices (fila=0-19, columna=0-9). */
const getCoordinatesFromCellId = (cellId) => {
    if (!cellId || typeof cellId !== 'string') return null;
    const colChar = cellId[0];
    let colIndex = colChar.charCodeAt(0) - 65; // A=0, B=1...
    const rowNumber = parseInt(cellId.substring(1));
    if (colIndex < 0 || colIndex >= NUM_COLUMNS || isNaN(rowNumber) || rowNumber < 1 || rowNumber > NUM_ROWS) {
        return null;
    }
    // Ajustamos a índice basado en la estructura HTML/JS (fila-1, columna-1)
    return { rowIndex: rowNumber - 1, colIndex: colIndex };
};

/** Obtiene el identificador de la celda a partir de sus índices. */
const getCellIdFromIndices = (rowIndex, colIndex) => {
    if (rowIndex < 0 || rowIndex >= NUM_ROWS || colIndex < 0 || colIndex >= NUM_COLUMNS) return null;
    const colLetter = getColumnLetter(colIndex);
    const rowNumber = rowIndex + 1;
    return `${colLetter}${rowNumber}`;
};

/** Obtiene todas las coordenadas dentro de un rango definido por dos puntos. */
const generateRangeCoordinates = (startCellId, endCellId) => {
    const startCoords = getCoordinatesFromCellId(startCellId);
    const endCoords = getCoordinatesFromCellId(endCellId);

    if (!startCoords || !endCoords) return [];

    let coordinates = [];
    // Iterar de la columna mínima a máxima
    for (let c = Math.min(startCoords.colIndex, endCoords.colIndex); c <= Math.max(startCoords.colIndex, endCoords.colIndex); c++) {
        // Iterar de la fila mínima a máxima
        for (let r = Math.min(startCoords.rowIndex, endCoords.rowIndex); r <= Math.max(startCoords.rowIndex, endCoords.rowIndex); r++) {
            coordinates.push({ row: r, col: c });
        }
    }
    return coordinates;
};

/** Obtiene el valor numérico de una celda, manejando errores si no es un número válido. */
const getNumericValue = (cellId) => {
    const cellData = spreadsheetState[cellId];
    if (!cellData || typeof cellData.value === 'text') return 0;

    try {
        // Intentar evaluar el valor como flotante, si falla devuelve NaN
        return parseFloat(cellData.value);
    } catch (e) {
        return 0;
    }
};


// --- Lógica de Cálculo y Fórmulas ---

/** Evalúa una fórmula compleja que puede contener múltiples operaciones o funciones. */
const evaluateFormula = (formulaString) => {
    let formula = formulaString.trim();

    if (!formula.startsWith("=")) return NaN; // No es fórmula válida

    // 1. Manejar SUMA(RANGO) - Esto requiere un parser específico para rangos y listas separadas por ;
    const sumMatch = formula.match(/^=SUMA\((.*)\)$/i);
    if (sumMatch && sumMatch[1]) {
        const argumentsString = sumMatch[1].trim();
        // Separar argumentos de la suma (puede ser un rango "A1:A3" o celdas sueltas "A1;B2")
        const argumentList = argumentsString.split(';').map(s => s.trim());

        let totalSum = 0;
        for (const arg of argumentList) {
            if (arg.includes(':')) {
                // Es un rango: A1:A3
                const [startId, endId] = arg.split(':').map(s => s.trim());
                const rangeCoords = generateRangeCoordinates(startId, endId);

                for (const coord of rangeCoords) {
                    const cellId = getCellIdFromIndices(coord.row, coord.col);
                    if (spreadsheetState[cellId]) {
                        totalSum += getNumericValue(cellId);
                    }
                }
            } else {
                // Es una celda suelta: A1
                const cellId = arg;
                if (spreadsheetState[cellId]) {
                    totalSum += getNumericValue(cellId);
                }
            }
        }
        return totalSum;
    }

    // 2. Manejar operaciones matemáticas directas (A1-B1, A1*B1, etc.)
    let expression = formula.substring(1).trim(); // Quitar el '=' inicial

    // Sustituir referencias de celdas como variables para evaluación JS segura
    const cellReferences = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    for (let i = 0; i < NUM_COLUMNS; i++) {
        const colLetter = getColumnLetter(i);
        // Buscar referencias de columna como variables en la expresión. Ejemplo: A1, B2, etc.
        const regex = new RegExp(`(${colLetter}[1-9]\\d{0,1})`, 'g');
        expression = expression.replace(regex, (match) => {
            return getNumericValue(match).toString(); // Reemplazar "A1" con su valor numérico actual
        });
    }

    try {
        // Evaluar la expresión matemática resultante en JavaScript
        const result = eval(expression);
        return isNaN(result) ? 0 : result;
    } catch (e) {
        console.error("Error evaluating expression:", e);
        return NaN; // Fallo de cálculo
    }
};

/** Recalcula el valor visible de una celda dada su coordenada. */
const calculateCellDisplayValue = (cellId) => {
    const cellData = spreadsheetState[cellId];
    if (!cellData || !cellData.value) return null;

    if (cellData.formula && typeof cellData.formula === 'string') {
        // Si hay fórmula, se debe calcular el resultado y mostrarlo.
        return evaluateFormula(cellData.formula);
    } else {
        // Si no hay fórmula o es texto/valor directo, simplemente devolver el valor.
        return getNumericValue(cellId);
    }
};

/** Lógica central que fuerza la recalculación de todas las celdas dependientes. */
const triggerRecalculation = (updatedCellId) => {
    // Recalcula primero la celda que disparó el evento, ya que su valor puede haber cambiado.
    recalculateAndUpdate(updatedCellId);

    // Para un sistema robusto de hoja de cálculo, se necesitaría un grafo de dependencias.
    // Simplificaremos limitándonos a recalcular todas las celdas con fórmulas en todo el rango,
    // ya que cualquier cambio podría afectar a ellas.
    for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const cellId = getCellIdFromIndices(r, c);
            if (spreadsheetState[cellId] && spreadsheetState[cellId].formula) {
                recalculateAndUpdate(cellId);
            }
        }
    }
};

/** Actualiza el valor mostrado en la interfaz y el estado interno de una celda. */
const recalculateAndUpdate = (cellId) => {
    if (!spreadsheetState[cellId]) return;

    // 1. Calcular el nuevo valor visible basado en las fórmulas o valores actuales.
    const newValueDisplay = calculateCellDisplayValue(cellId);

    let displayedValue = '';
    if (typeof newValueDisplay === 'number' && !isNaN(newValueDisplay)) {
        displayedValue = newValueDisplay.toFixed(2).replace(/\.?0+$/, ''); // Limpiar decimales innecesarios
    } else if (typeof calculateCellDisplayValue(cellId) === 'string') {
        // Si el cálculo resultó en un string (ej: "OK")
        displayedValue = String(calculateCellDisplayValue(cellId));
    } else {
        // De lo contrario, se muestra el valor que está en el estado interno.
        displayedValue = spreadsheetState[cellId].value || '';
    }

    // 2. Actualizar el DOM y la representación visual (si es necesario)
    const cellElement = document.getElementById(cellId);
    if (cellElement && displayedValue !== cellElement.textContent) {
        cellElement.textContent = displayedValue;
    }

    // Nota: No actualizamos 'value' del estado con el valor calculado, 
    // ya que si es una fórmula, queremos que persista la fórmula para futuras recalculaciones.
};


// --- Gestión de Eventos y Interacciones (R1, R10) ---

/** Maneja el evento de entrada o edición en una celda específica. */
const handleCellInput = (event) => {
    const cellElement = event.target;
    const cellId = cellElement.id;
    let newValue = cellElement.value;

    // 1. Actualizar el estado interno con el nuevo valor crudo.
    spreadsheetState[cellId] = {
        ...spreadsheetState[cellId],
        value: newValue,
        formula: spreadsheetState[cellId].formula // No tocar la fórmula si existía
    };

    // 2. Forzar el recálculo y actualización del DOM debido al cambio de valor fuente.
    triggerRecalculation(cellId);
};


// --- Gestión de Estilo (R5) ---

/** Cambia el fondo de una celda específica. */
const changeCellBackground = (cellId, color) => {
    const cellElement = document.getElementById(cellId);
    if (!cellElement) return;

    // 1. Actualizar estado y DOM
    spreadsheetState[cellId].backgroundColor = color;
    cellElement.style.backgroundColor = color;
};

/** Aplica el fondo a todas las celdas de una columna o fila (usado por los manejadores de selección). */
const applyBackgroundToAxis = (axisCells, color) => {
    for (const cellId of axisCells) {
        changeCellBackground(cellId, color);
    }
};


// --- Gestión de Columnas y Filas (R6, R7, R8, R13, R14, R15, R16) ---

/** Obtiene todos los IDs de las celdas de una columna específica. */
const getAllCellIdsInColumn = (colIndex) => {
    let ids = [];
    for (let r = 0; r < NUM_ROWS; r++) {
        ids.push(getCellIdFromIndices(r, colIndex));
    }
    return ids;
};

/** Obtiene todos los IDs de las celdas de una fila específica. */
const getAllCellIdsInRow = (rowIndex) => {
    let ids = [];
    for (let c = 0; c < NUM_COLUMNS; c++) {
        ids.push(getCellIdFromIndices(rowIndex, c));
    }
    return ids;
};

/** Resetea el contenido de todas las celdas en una columna o fila. */
const clearAxisContent = (axisCells) => {
    for (const cellId of axisCells) {
        // Limpiar valor y fórmula del estado, pero mantener formato de fondo
        if (spreadsheetState[cellId]) {
            spreadsheetState[cellId].value = "";
            spreadsheetState[cellId].formula = null;
            // Mantener el color actual o resetearlo a blanco si se desea. Aquí lo mantenemos.
        }
    }
};

/** Borra completamente una columna (contenido, fórmula y estado). */
const deleteColumn = (colIndex) => {
    let columnIds = getAllCellIdsInColumn(colIndex);

    // 1. Limpiar el estado de la hoja para estas celdas.
    columnIds.forEach(cellId => {
        delete spreadsheetState[cellId];
        // Opcional: Si queremos que las referencias se ajusten, esto sería complejo.
        // Aquí solo borramos los datos y ocultamos visualmente.
    });

    // 2. Actualizar el DOM (ocultar la columna).
    const columnElement = document.getElementById(`col-${colIndex}`);
    if (columnElement) {
        columnElement.style.display = 'none';
    }

    // 3. Persistencia: Guardar el nuevo estado de la hoja.
    saveState();
};

/** Oculta una columna. */
const toggleColumnVisibility = (colIndex, isVisible) => {
    let columnElement = document.getElementById(`col-${colIndex}`);
    if (!columnElement) return;

    if (isVisible) {
        columnElement.style.display = ''; // Mostrar
    } else {
        columnElement.style.display = 'none'; // Ocultar
    }

    // Nota: No borramos el estado, solo lo ocultamos visualmente.
    saveState();
};


/** Borra completamente una fila. */
const deleteRow = (rowIndex) => {
    let rowIds = getAllCellIdsInRow(rowIndex);

    // 1. Limpiar el estado de la hoja para estas celdas.
    rowIds.forEach(cellId => {
        delete spreadsheetState[cellId];
    });

    // 2. Actualizar el DOM (ocultar/eliminar la fila).
    const rowElement = document.getElementById(`row-${rowIndex}`);
    if (rowElement) {
        rowElement.style.display = 'none';
    }

    // 3. Persistencia: Guardar el nuevo estado de la hoja.
    saveState();
};

/** Oculta una fila. */
const toggleRowVisibility = (rowIndex, isVisible) => {
    let rowElement = document.getElementById(`row-${rowIndex}`);
    if (!rowElement) return;

    if (isVisible) {
        rowElement.style.display = ''; // Mostrar
    } else {
        rowElement.style.display = 'none'; // Ocultar
    }

    // Nota: No borramos el estado, solo lo ocultamos visualmente.
    saveState();
};


// --- Inicialización y Persistencia (R9, R17) ---

/** Genera la estructura completa de celdas en el DOM y inicializa el estado interno. */
const initializeSpreadsheetGrid = () => {
    const bodyContainer = document.getElementById("spreadsheet-body");
    let htmlContent = '';

    // Iterar por filas (0 a 19) y columnas (0 a 9)
    for (let r = 0; r < NUM_ROWS; r++) {
        const rowId = `row-${r}`;
        htmlContent += `<tr id="${rowId}">`;

        for (let c = 0; c < NUM_COLUMNS; c++) {
            const cellId = getCellIdFromIndices(r, c);
            // Crear la estructura HTML de la celda y el contenedor de columna.
            htmlContent += `<td id="${cellId}" class="spreadsheet-cell" data-column-index="${c}">`;
            htmlContent += `<div id="col-${c}" style="display: table-cell;">`; // Contenedor invisible para lógica de columna
            htmlContent += `</div>`;
            htmlContent += `</td>`;
        }
        htmlContent += `</tr>`;
    }

    bodyContainer.innerHTML = htmlContent;
};

/** Inicializa el estado interno con todas las celdas vacías y los listeners. */
const initializeStateAndListeners = () => {
    // 1. Inicializar estado vacío para TODAS las celdas (A1 a J20)
    for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const cellId = getCellIdFromIndices(r, c);
            spreadsheetState[cellId] = {
                value: "",
                formula: null,
                backgroundColor: "" // Color por defecto
            };
        }
    }

    // 2. Asignar el listener de entrada a todo el cuerpo de la hoja (Delegación)
    const spreadsheetBody = document.getElementById("spreadsheet-body");
    if (spreadsheetBody) {
        spreadsheetBody.addEventListener('input', handleCellInput);
    }

    // 3. Configurar listeners para selección y manipulación de ejes
    setupAxisListeners();
};

/** Guarda el estado actual completo del objeto spreadsheetState en localStorage. */
const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spreadsheetState));
    console.log("Estado guardado localmente."); // Para depuración
};

/** Carga el estado de la hoja desde localStorage o inicializa si no existe. */
const loadState = () => {
    const storedState = localStorage.getItem(STORAGE_KEY);
    if (storedState) {
        spreadsheetState = JSON.parse(storedState);
        console.log("Estado cargado exitosamente de localStorage.");
    } else {
        // Si no hay estado, inicializamos completamente la estructura y el estado vacío
        initializeSpreadsheetGrid();
        initializeStateAndListeners();
    }

    // Tras cargar o inicializar, forzar una actualización visual completa.
    renderSheetFromState();
};

/** Renderiza todos los datos del estado en el DOM (se llama al inicio). */
const renderSheetFromState = () => {
    for (let r = 0; r < NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const cellId = getCellIdFromIndices(r, c);
            const cellElement = document.getElementById(cellId);
            if (!cellElement) continue;

            const state = spreadsheetState[cellId];
            if (state) {
                // 1. Restaurar el contenido de entrada (value y fórmula).
                cellElement.setAttribute('contenteditable', 'true');
                cellElement.setAttribute('data-formula', state.formula || '');
                cellElement.textContent = ''; // Limpiar el texto para que solo muestre el cálculo

                // 2. Aplicar color de fondo guardado
                if (state.backgroundColor) {
                    cellElement.style.backgroundColor = state.backgroundColor;
                } else {
                    cellElement.style.backgroundColor = '';
                }

                // 3. Recalcular y mostrar el valor visible correcto
                recalculateAndUpdate(cellId);
            }
        }
    }
};


// --- Setup de Listeners para Ejes (Columnas/Filas) ---

/** Prepara los listeners para las cabeceras (A-J, 1-20). */
const setupAxisListeners = () => {
    // Listener global para la selección de columnas y filas.
    document.getElementById("spreadsheet-container").addEventListener('click', (event) => {
        let target = event.target;

        // Manejo de Columna (Clic en el TH con letras A-J)
        if (target.closest('.header-col')) {
            const colIndex = parseInt(target.getAttribute('data-column-index'));
            const isSelected = target.classList.contains('selected');

            if (!isSelected) {
                // Deseleccionar todas las columnas primero
                document.querySelectorAll('.header-col').forEach(el => el.classList.remove('selected'));
                target.classList.add('selected');
            } else {
                // Desseleccionar si ya está seleccionado
                target.classList.remove('selected');
            }
        }

        // Manejo de Fila (Clic en el TH con números 1-20)
        if (target.closest('.header-row')) {
            const rowIndex = parseInt(target.getAttribute('data-row-index'));
            const isSelected = target.classList.contains('selected');

            if (!isSelected) {
                // Deseleccionar todas las filas primero
                document.querySelectorAll('.header-row').forEach(el => el.classList.remove('selected'));
                target.classList.add('selected');
            } else {
                // Deseleccionar si ya está seleccionado
                target.classList.remove('selected');
            }
        }

        // Si se selecciona un eje, actualizamos la interfaz para mostrar los controles de gestión (botones)
        const selectedColumn = document.querySelector('.header-col.selected');
        const selectedRow = document.querySelector('.header-row.selected');
        if(selectedColumn || selectedRow) {
            // Aquí se podría activar un panel lateral con botones de control, 
            // pero por simplicidad, asumimos que los métodos globales manejan la UI.
        }
    });

    // Listener para aplicar color en el eje (se asume que hay un botón global o modal activo)
    document.getElementById('color-picker').addEventListener('input', (e) => {
        const selectedColumn = document.querySelector('.header-col.selected');
        const selectedRow = document.querySelector('.header-row.selected');
        const color = e.target.value;

        if (selectedColumn) {
            // Aplicar color a toda la columna seleccionada
            const colIndex = parseInt(selectedColumn.getAttribute('data-column-index'));
            let columnIds = getAllCellIdsInColumn(colIndex);
            applyBackgroundToAxis(columnIds, color);
        }

        if (selectedRow) {
            // Aplicar color a toda la fila seleccionada
            const rowIndex = parseInt(selectedRow.getAttribute('data-row-index'));
            let rowIds = getAllCellIdsInRow(rowIndex);
            applyBackgroundToAxis(rowIds, color);
        }
    });

    // Listener para borrar contenido en el eje (se asume que hay un botón global o modal activo)
    document.getElementById('clear-content').addEventListener('click', () => {
        const selectedColumn = document.querySelector('.header-col.selected');
        const selectedRow = document.querySelector('.header-row.selected');

        if (selectedColumn) {
            const colIndex = parseInt(selectedColumn.getAttribute('data-column-index'));
            let columnIds = getAllCellIdsInColumn(colIndex);
            clearAxisContent(columnIds);
            // Forzar recálculo en todo caso, aunque no haya fórmulas dependientes de otros datos borrados.
            triggerRecalculation(); 
        }

        if (selectedRow) {
            const rowIndex = parseInt(selectedRow.getAttribute('data-row-index'));
            let rowIds = getAllCellIdsInRow(rowIndex);
            clearAxisContent(rowIds);
            triggerRecalculation();
        }
    });


    // Listeners para acciones de gestión (Borrar/Ocultar) - Asumiendo botones en la UI

    document.getElementById('delete-column').addEventListener('click', () => {
        const selectedColumn = document.querySelector('.header-col.selected');
        if (!selectedColumn) {
            alert("Por favor, selecciona una columna para borrar.");
            return;
        }
        if (confirm("¿Estás seguro de que quieres eliminar esta columna y todo su contenido?")) {
            const colIndex = parseInt(selectedColumn.getAttribute('data-column-index'));
            deleteColumn(colIndex);
        }
    });

    document.getElementById('hide-column').addEventListener('click', () => {
        const selectedColumn = document.querySelector('.header-col.selected');
        if (!selectedColumn) {
            alert("Por favor, selecciona una columna para ocultar.");
            return;
        }
        const colIndex = parseInt(selectedColumn.getAttribute('data-column-index'));
        // Ocultar: pasar false (no visible)
        toggleColumnVisibility(colIndex, true); 
    });

    document.getElementById('delete-row').addEventListener('click', () => {
        const selectedRow = document.querySelector('.header-row.selected');
        if (!selectedRow) {
            alert("Por favor, selecciona una fila para borrar.");
            return;
        }
        if (confirm("¿Estás seguro de que quieres eliminar esta fila y todo su contenido?")) {
            const rowIndex = parseInt(selectedRow.getAttribute('data-row-index'));
            deleteRow(rowIndex);
        }
    });

    document.getElementById('hide-row').addEventListener('click', () => {
        const selectedRow = document.querySelector('.header-row.selected');
        if (!selectedRow) {
            alert("Por favor, selecciona una fila para ocultar.");
            return;
        }
        // Ocultar: pasar false (no visible)
        toggleRowVisibility(parseInt(selectedRow.getAttribute('data-row-index')), true); 
    });
};


// --- Ejecución principal ---

/** Función que se ejecuta al cargar la página para inicializar todo el sistema. */
const initApp = () => {
    loadState(); // Carga o crea estado y renderiza en el DOM
};

// Iniciar la aplicación cuando el DOM esté completamente cargado.
document.addEventListener('DOMContentLoaded', initApp);
