/**
 * Hoja de Cálculo - Script Principal
 * Implementa la gestión del estado, el cálculo de fórmulas y la sincronización con el DOM.
 */

// --- CONSTANTES Y CONFIGURACIÓN GLOBAL ---
const NUM_ROWS = 20;
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const STORAGE_KEY = 'spreadsheetData';

// El objeto de estado global (Fuente Única de Verdad)
let state = {}; 

// --- UTILERÍAS DE ESTRUCTURA Y LECTURA ---

/**
 * Inicializa la estructura del estado vacío para todas las celdas.
 */
function initializeState() {
    state = {};
    for (let r = 1; r <= NUM_ROWS; r++) {
        state[r] = {};
        for (const col of COL_LETTERS) {
            state[r][col] = {
                value: '', // El texto visible actualmente (puede ser el resultado o el contenido manual)
                rawInput: '', // Lo que escribió el usuario (texto plano o fórmula completa)
                formula: null, // Fórmula detectada si comienza con '='
                color: '#ffffff'
            };
        }
    }
}

/**
 * Convierte un índice de columna ('A', 'B', ...) a su valor.
 * @param {number} index Índice (0-9).
 */
function getColLetter(index) {
    return COL_LETTERS[index];
}

/**
 * Obtiene el estado de una celda dada su referencia (ej: A1, C5).
 * @param {string} col Columna ('A' - 'J').
 * @param {number} row Fila (1 - 20).
 * @returns {object} El objeto de estado de la celda.
 */
function getState(col, row) {
    if (!state[row] || !state[row][col]) {
        throw new Error(`Estado no encontrado para ${col}${row}`);
    }
    return state[row][col];
}

/**
 * Obtiene el valor numérico de una celda, manejando errores.
 * @param {string} col Columna.
 * @param {number} row Fila.
 * @returns {number} Valor numérico seguro o 0.
 */
function getNumericValue(col, row) {
    const cell = getState(col, row);
    const val = parseFloat(cell.value.replace(/[^0-9.-]/g, '')); // Limpiar texto no numérico
    return isNaN(val) ? 0 : val;
}

// --- LÓGICA DE CÁLCULO Y ESTADO (R3, R4, R11, R12) ---

/**
 * Evalúa la expresión matemática o la función SUMA.
 * @param {string[]} references Array de referencias de celdas ("A1", "B2").
 * @returns {number} El resultado numérico del cálculo.
 */
function evaluateReferences(references) {
    let total = 0;
    for (const ref of references) {
        // Extraer col y row del formato 'ColRow'
        const match = ref.match(/([A-Z]+)([1-9]\d*)/);
        if (!match) continue;

        const col = match[1];
        const row = parseInt(match[2]);

        const numVal = getNumericValue(col, row);
        total += numVal;
    }
    return total;
}


/**
 * Evalúa el contenido de una celda basándose en su fórmula.
 * @param {string} col Columna donde está la fórmula.
 * @param {number} row Fila donde está la fórmula.
 */
function calculateCell(col, row) {
    const cellState = getState(col, row);

    // 1. Si no hay fórmula o el contenido es solo texto/vacío, salimos.
    if (!cellState.formula || !cellState.rawInput.startsWith('=')) {
        return false; // Indica que no se calculó nada
    }

    let formulaString = cellState.formula;
    let calculatedValue = '';
    let needsRecalculation = true; 

    try {
        // 2. Manejo de SUMA (Ej: =SUMA(A1;B2;C3) o =SUMA(A1, B2, C3))
        if (formulaString.toUpperCase().startsWith('=SUMA')) {
            const content = formulaString.substring(5).trim(); // Quitar "=SUMA"
            // Normalizar separadores: reemplazar comas y punto y coma por un delimitador único para split
            const cleanedContent = content.replace(/[,;]/g, ',').replace(/\s/g, ''); 
            
            // Asumimos que los argumentos están separados por comas después de limpiar espacios
            const references = cleanedContent.split(',');
            
            if (references.length > 0) {
                calculatedValue = evaluateReferences(references);
                needsRecalculation = true;
            } else {
                 // Fórmula mal formada, mantener el estado actual o dejarlo vacío.
                return false; 
            }
        } 
        // 3. Manejo de operaciones matemáticas (Ej: =A1-B1)
        else {
            // Usamos eval con precaución, pero es la forma más sencilla sin un parser completo.
            // Asegurarse de que el contenido solo contenga referencias válidas y operadores.
            let expression = formulaString;
            expression = expression.replace(/([A-Z]+[1-9]\d*)/g, (match) => {
                const [colMatch, rowMatch] = match.match(/([A-Z]+)([1-9]\d*)/).slice(1);
                if (!colMatch || !rowMatch) return '0'; // Fallback si el match falla
                return getNumericValue(colMatch, parseInt(rowMatch));
            });

            // Evaluar la expresión matemática (ej: 4 - 2 * 3)
            const result = eval(expression);
            calculatedValue = isNaN(result) ? '' : result.toString();
            needsRecalculation = true;
        }

    } catch (e) {
        console.error(`Error calculando ${col}${row}:`, e);
        calculatedValue = 'ERROR';
        needsRecalculation = false; // No actualizamos el estado si hay error grave
    }

    // Actualizar el estado con el resultado calculado
    const oldVisibleValue = state[row][col].value;
    if (oldVisibleValue !== calculatedValue) {
        state[row][col].value = calculatedValue;
        renderCell(col, row); // Solo renderizar esta celda
    }

    return needsRecalculation;
}


/**
 * Calcula recursivamente todas las celdas que dependen de la celda (col, row).
 * Esto asegura que si A1 cambia, B4 se actualice automáticamente.
 * @param {string} changedCol Columna que cambió.
 * @param {number} changedRow Fila que cambió.
 */
function recalculateDependencies(changedCol, changedRow) {
    let recalculatedCount = 0;

    // Iterar sobre todas las celdas para ver cuáles usan la referencia (changedCol, changedRow)
    for (let r = 1; r <= NUM_ROWS; r++) {
        for (const col of COL_LETTERS) {
            if (col === changedCol && r === changedRow) continue; // No recalcular la fuente

            // Solo intentar calcular si es una celda y tiene fórmula.
            const cellState = getState(col, r);
            if (cellState.formula && cellState.rawInput.startsWith('=')) {
                // Llamar a calculateCell. Si este devuelve true, significa que el valor cambió
                // y se actualizó el DOM internamente.
                if (calculateCell(col, r)) {
                    recalculatedCount++;
                }
            }
        }
    }
    return recalculatedCount;
}

// --- MANEJO DE LA INTERFAZ Y EVENTOS ---

/**
 * Sincroniza el estado de una celda en JavaScript con su elemento DOM.
 * @param {string} col Columna.
 * @param {number} row Fila.
 */
function renderCell(col, row) {
    const cellElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cellElement) return;

    const stateData = getState(col, row);

    // 1. Actualizar contenido visible (value)
    cellElement.textContent = stateData.value || '';
    
    // 2. Aplicar color de fondo
    cellElement.style.backgroundColor = stateData.color;
}

/**
 * Maneja el evento blur o Enter en cualquier celda editable.
 * Captura el valor y actualiza el estado, disparando cálculos si es necesario.
 * @param {HTMLElement} target El elemento DOM que perdió el foco.
 */
function handleCellInput(target) {
    const row = parseInt(target.getAttribute('data-row'));
    const col = target.getAttribute('data-col');

    if (isNaN(row) || !col) return;

    // Leer el contenido textual actual del DOM
    let rawText = target.textContent.trim(); 
    
    // Si es un input editable, el texto puede ser diferente al contenteditable si hubo edición directa en JS.
    if (target.tagName === 'TH' || target.tagName === 'TD') {
        rawText = target.textContent;
    } else if (target.getAttribute('contenteditable') === 'true') {
         // Fallback para asegurar que capturamos lo escrito, aunque contentEditable es usado en la estructura
        rawText = target.innerText.trim(); 
    }

    const cellState = getState(col, row);
    let updated = false;

    if (rawText === '') {
        // Caso de borrado: Limpiamos el estado y salimos.
        cellState.rawInput = '';
        cellState.formula = null;
        cellState.value = '';
        updated = true;
    } else if (rawText.startsWith('=')) {
        // Es una fórmula
        const formulaString = rawText;
        cellState.rawInput = formulaString;
        cellState.formula = formulaString;

        // Intentar calcular y actualizar el valor visible
        if (calculateCell(col, row)) {
            updated = true; // El cálculo cambió algo
        } else if (cellState.value !== rawText) {
             // Si el cálculo falló o no se disparó, pero el usuario escribió algo nuevo que no es fórmula, 
             // lo tratamos como texto simple para evitar perder la entrada si no hay dependencias.
            cellState.rawInput = rawText;
            cellState.formula = null;
            cellState.value = rawText;
            renderCell(col, row);
        }

    } else {
        // Es texto plano (R1: Escribo un texto cualquiera en A1)
        cellState.rawInput = rawText;
        cellState.formula = null;
        cellState.value = rawText;
        updated = true;
    }

    if (updated) {
        // Después de actualizar el estado, recalcular dependencias si la fuente cambió.
        recalculateDependencies(col, row);
    }

    saveState();
}


/**
 * Inicializa los listeners para todas las celdas de datos (A1:J20).
 */
function setupCellListeners() {
    document.querySelectorAll('.cell[contenteditable="true"]').forEach(cell => {
        // Usamos 'blur' y el evento 'keydown' para capturar Enter/Blur
        cell.addEventListener('blur', () => handleCellInput(cell));
        
        // Detectar Enter (simulando un blur después de escribir)
        cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevenir el comportamiento por defecto del input/contenteditable
                handleCellInput(cell);
            }
        });
    });
}


// --- MANEJO DE CONTROLES GLOBALES (R6, R7) ---

/**
 * Obtiene todos los elementos de una columna dada.
 * @param {string} col Columna ('A' - 'J').
 * @returns {HTMLElement[]} Array de TDs/THs de esa columna.
 */
function getColumnElements(col) {
    return document.querySelectorAll(`[data-col="${col}"]`);
}

/**
 * Obtiene todos los elementos de una fila dada.
 * @param {number} row Fila (1 - 20).
 * @returns {HTMLElement[]} Array de THs/TDs de esa fila.
 */
function getRowElements(row) {
    return document.querySelectorAll(`[data-row="${row}"]`);
}


// R6: Borrar columna
document.getElementById('btn-delete-column').addEventListener('click', () => {
    const selectedColEl = document.querySelector('.col-header-active');
    if (!selectedColEl) {
        alert("Debe seleccionar una columna primero.");
        return;
    }
    const colToDelete = selectedColEl.getAttribute('data-col');

    if (confirm(`¿Está seguro de borrar la columna ${colToDelete}? Esto eliminará todos los datos y formatos.`)) {
        // 1. Actualizar Estado: Limpiar todos los datos de esa columna
        for (let r = 1; r <= NUM_ROWS; r++) {
            state[r][colToDelete] = { value: '', rawInput: '', formula: null, color: '#ffffff' };
        }

        // 2. Actualizar DOM: Eliminar elementos y listeners
        const elements = getColumnElements(colToDelete);
        elements.forEach(el => el.remove());

        // 3. Resetear la selección de cabecera (opcional)
        document.querySelectorAll('.col-header').forEach(el => el.classList.remove('selected'));
        console.log(`Columna ${colToDelete} borrada.`);
        saveState();
    }
});

// R7: Borrar fila
document.getElementById('btn-delete-row').addEventListener('click', () => {
    const selectedRowEl = document.querySelector('.row-header-active');
    if (!selectedRowEl) {
        alert("Debe seleccionar una fila primero.");
        return;
    }
    const rowToDelete = parseInt(selectedRowEl.getAttribute('data-row'));

    if (confirm(`¿Está seguro de borrar la fila ${rowToDelete}? Esto eliminará todos los datos y formatos.`)) {
        // 1. Actualizar Estado: Eliminar/resetear todos los datos de esa fila
        for (const col of COL_LETTERS) {
            state[rowToDelete][col] = { value: '', rawInput: '', formula: null, color: '#ffffff' };
        }

        // 2. Actualizar DOM: Eliminar elementos y listeners
        const elements = getRowElements(rowToDelete);
        elements.forEach(el => el.remove());

        // 3. Resetear la selección de cabecera (opcional)
        document.querySelectorAll('.row-header').forEach(el => el.classList.remove('selected'));
        console.log(`Fila ${rowToDelete} borrada.`);
        saveState();
    }
});

// R5: Rellenar color en selección
document.getElementById('btn-fill-selection').addEventListener('click', () => {
    const selectionElements = document.querySelectorAll('.cell.selected');
    if (selectionElements.length === 0) {
        alert("Por favor, seleccione celdas primero.");
        return;
    }

    const colorPicker = document.getElementById('color-picker').value;

    // Actualizar el estado y renderizar cada celda seleccionada
    selectionElements.forEach(el => {
        const r = parseInt(el.getAttribute('data-row'));
        const c = el.getAttribute('data-col');
        if (r && c) {
            getState(c, r).color = colorPicker;
            renderCell(c, r); // Renderiza para aplicar el fondo en el DOM
        }
    });

    saveState();
});


// R6: Borrar columna contenido
document.getElementById('btn-clear-selection').addEventListener('click', () => {
    const selectedColEl = document.querySelector('.col-header-active');
    if (!selectedColEl) {
        alert("Debe seleccionar una columna primero.");
        return;
    }
    const colToClear = selectedColEl.getAttribute('data-col');

    if (confirm(`¿Desea vaciar el contenido de toda la columna ${colToClear}?`)) {
        // 1. Actualizar Estado: Limpiar todos los datos de esa columna
        for (let r = 1; r <= NUM_ROWS; r++) {
            state[r][colToClear] = { value: '', rawInput: '', formula: null, color: state[r][colToClear].color }; // Mantener el color
        }

        // 2. Renderizar todos los elementos de la columna para reflejar el vacío
        for (let r = 1; r <= NUM_ROWS; r++) {
            renderCell(colToClear, r);
        }

        saveState();
    }
});


// R6: Toggle Columna Visible/Invisible
document.getElementById('btn-toggle-column').addEventListener('click', () => {
    const selectedColEl = document.querySelector('.col-header-active');
    if (!selectedColEl) {
        alert("Debe seleccionar una columna primero.");
        return;
    }
    const colToToggle = selectedColEl.getAttribute('data-col');
    let isVisible = selectedColEl.classList.contains('visible');

    // 1. Toggle DOM Visibility (CSS Grid/Display)
    document.querySelectorAll(`[data-col="${colToToggle}"]`).forEach(el => {
        if (isVisible) {
            el.style.display = 'none'; // Ocultar
        } else {
            el.style.display = ''; // Mostrar
        }
    });

    // 2. Actualizar estado de visibilidad en el header
    selectedColEl.classList.toggle('visible', !isVisible);
    
    saveState();
});


// R7: Toggle Fila Visible/Invisible
document.getElementById('btn-toggle-row').addEventListener('click', () => {
    const selectedRowEl = document.querySelector('.row-header-active');
    if (!selectedRowEl) {
        alert("Debe seleccionar una fila primero.");
        return;
    }
    const rowToToggle = parseInt(selectedRowEl.getAttribute('data-row'));
    let isVisible = selectedRowEl.classList.contains('visible');

    // 1. Toggle DOM Visibility
    document.querySelectorAll(`[data-row="${rowToToggle}"]`).forEach(el => {
        if (isVisible) {
            el.style.display = 'none'; // Ocultar
        } else {
            el.style.display = ''; // Mostrar
        }
    });

    // 2. Actualizar estado de visibilidad en el header
    selectedRowEl.classList.toggle('visible', !isVisible);

    saveState();
});


// --- GESTIÓN DE DATOS Y PERSISTENCIA (R9, R17) ---

/**
 * Guarda el estado actual en localStorage.
 */
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("No se pudo guardar el estado en LocalStorage:", e);
    }
}

/**
 * Carga el estado desde localStorage o inicializa si no existe nada.
 */
function loadState() {
    try {
        const storedState = localStorage.getItem(STORAGE_KEY);
        if (storedState) {
            state = JSON.parse(storedState);
            console.log("Estado cargado de LocalStorage.");
        } else {
            initializeState();
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
        initializeState();
    }
}


// --- INICIALIZACIÓN PRINCIPAL ---

/**
 * Función principal de renderizado que dibuja toda la hoja desde el estado 'state'.
 */
function render() {
    // 1. Limpiar y re-renderizar celdas visibles (solo lo necesario)
    document.querySelectorAll('.cell').forEach(el => {
        const r = parseInt(el.getAttribute('data-row'));
        const c = el.getAttribute('data-col');

        if (!r || !c) return;

        // Asegurarse de que la estructura del estado exista para esta celda antes de leerla
        if (state[r] && state[r][c]) {
            renderCell(c, r);
        } else {
             // Si por alguna razón el elemento existe pero no en el estado, lo limpiamos.
             el.textContent = '';
             el.style.backgroundColor = '#ffffff';
        }
    });

    // 2. Re-aplicar los listeners (necesario si se eliminaron/añadieron elementos)
    setupCellListeners();
}


/**
 * Inicializa la aplicación: Carga datos, renderiza y establece eventos globales.
 */
function init() {
    loadState();
    render();

    // 3. Configurar manejo de selección (clic en letras/números)
    document.querySelectorAll('.row-label').forEach(el => {
        el.addEventListener('click', function() {
            // Deseleccionar primero
            document.querySelectorAll('.row-header, .col-header').forEach(e => e.classList.remove('selected'));
            
            // Seleccionar esta fila/columna y aplicar la clase activa de UI
            this.parentElement.querySelector('.row-label').classList.add('selected');
            const rowNumber = this.getAttribute('data-row');

            // Deseleccionar columnas primero (para evitar conflictos)
            document.querySelectorAll('.cell.selected').forEach(e => e.classList.remove('selected'));
            
            // Seleccionar todas las celdas de la fila
            getRowElements(rowNumber).forEach(el => el.classList.add('selected'));

            // Actualizar el estado visual (solo para control UI)
            document.getElementById('btn-delete-row').disabled = false;
        });
    });

    document.querySelectorAll('.col-header').forEach(el => {
        el.addEventListener('click', function() {
            // Deseleccionar primero
            document.querySelectorAll('.row-header, .col-header').forEach(e => e.classList.remove('selected'));
            
            // Seleccionar esta columna y aplicar la clase activa de UI
            this.parentElement.querySelector('.col-header').classList.add('selected');
            const colLetter = this.getAttribute('data-col');

            // Deseleccionar filas primero (para evitar conflictos)
            document.querySelectorAll('.cell.selected').forEach(e => e.classList.remove('selected'));

            // Seleccionar todas las celdas de la columna
            getColumnElements(colLetter).forEach(el => el.classList.add('selected'));
            
            // Actualizar el estado visual (solo para control UI)
            document.getElementById('btn-delete-column').disabled = false;
        });
    });

    // 4. Configurar manejo de selección por celda individual (para aplicar fondo/borrar)
    document.querySelectorAll('.cell').forEach(el => {
        el.addEventListener('click', function() {
            const r = parseInt(this.getAttribute('data-row'));
            const c = this.getAttribute('data-col');

            // Deseleccionar todo
            document.querySelectorAll('.cell.selected').forEach(e => e.classList.remove('selected'));
            
            // Seleccionar solo esta celda
            this.classList.add('selected');
        });
    });


    // 5. Habilitar/Deshabilitar botones de acción según la selección inicial
    document.getElementById('btn-delete-column').disabled = true;
    document.getElementById('btn-delete-row').disabled = true;

}

// Ejecutar el script cuando el DOM esté completamente cargado
window.addEventListener('load', init);
