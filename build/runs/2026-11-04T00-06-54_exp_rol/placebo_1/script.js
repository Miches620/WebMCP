const NUM_COLUMNS = 10; // Define el número total de columnas (A a J)
const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]; // Lista de letras de columna
const NUM_ROWS = 20; // Definir el número total de filas (1 a 20)

// Constante para la clave de almacenamiento local
const LOCAL_STORAGE_KEY = "spreadsheetData";

/**
 * @type {Map<string, string>} Almacena el estado actual del contenido de cada celda.
 */
let cellDataStore = new Map();

/**
 * Inicializa y renderiza toda la grilla de celdas en el DOM.
 * Esto asegura que todos los 200 elementos existan para manejar eventos.
 */
function initializeGrid() {
    const gridContainer = document.getElementById("spreadsheet-grid");
    if (!gridContainer) return;

    // Limpiar contenido previo y generar la estructura de celdas
    gridContainer.innerHTML = ""; 

    for (let row = 1; row <= NUM_ROWS; row++) {
        const rowElement = document.createElement("div");
        rowElement.classList.add("spreadsheet-row");

        for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
            const columnLetter = COLUMNS[colIndex];
            const cellId = `${columnLetter}${row}`;
            const cellElement = document.createElement("div");
            cellElement.classList.add("spreadsheet-cell");
            cellElement.id = `cell-${cellId}`;

            // Usar data attributes para referencia fácil en JS
            cellElement.dataset.col = columnLetter; 
            cellElement.dataset.row = row;

            rowElement.appendChild(cellElement);
        }
        gridContainer.appendChild(rowElement);
    }

    // Adjuntar el listener de evento principal a la grilla
    document.getElementById("spreadsheet-grid").addEventListener(
        "click", 
        handleCellClick
    );
    document.getElementById("spreadsheet-grid").addEventListener(
        "input", 
        handleCellInput
    );
}

/**
 * Carga el estado de la hoja de cálculo desde localStorage.
 * Esto garantiza que los datos persistan al recargar la página.
 */
function loadData() {
    const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!storedData) return;

    try {
        const dataObject = JSON.parse(storedData);
        cellDataStore.clear();

        for (let row = 1; row <= NUM_ROWS; row++) {
            for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
                const columnLetter = COLUMNS[colIndex];
                const cellId = `${columnLetter}${row}`;
                const cellElement = document.getElementById(`cell-${cellId}`);

                if (dataObject[`${columnLetter}:${row}`]) {
                    const content = dataObject[`${columnLetter}:${row}`].content;
                    cellDataStore.set(cellId, content);
                    cellElement.innerText = content;
                } else {
                    // Inicializar celdas que no existían en el storage (vacío)
                    cellDataStore.set(cellId, "");
                    document.getElementById(`cell-${cellId}`).innerText = "";
                }
            }
        }
    } catch (error) {
        console.error("Error al cargar datos de localStorage:", error);
    }
}

/**
 * Guarda el estado actual de la hoja de cálculo en localStorage.
 * Esto se llama cada vez que hay un cambio significativo de contenido o formato.
 */
function saveData() {
    const dataObject = {};
    let cellsSavedCount = 0;

    // Recorrer todas las celdas para guardar su contenido actual
    for (let row = 1; row <= NUM_ROWS; row++) {
        for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
            const columnLetter = COLUMNS[colIndex];
            const cellId = `${columnLetter}${row}`;
            const cellElement = document.getElementById(`cell-${cellId}`);
            
            // El contenido actual en el DOM es lo que se debe guardar
            dataObject[`${columnLetter}:${row}`] = { 
                content: cellElement.innerText,
                backgroundColor: cellElement.style.backgroundColor || ""
            };
            cellsSavedCount++;
        }
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataObject));
}

/**
 * Evalúa el valor de una celda, manejando fórmulas y tipos de datos.
 * @param {string} cellValue - El contenido textual de la celda.
 * @returns {string} El resultado calculado o el texto original si no es fórmula.
 */
function calculateCellValue(cellValue) {
    if (typeof cellValue !== "string" || !cellValue.startsWith("=")) {
        return cellValue; // No es fórmula, devolver valor tal cual
    }

    // Eliminar '=' inicial para el procesamiento
    let formula = cellValue.substring(1).trim();

    try {
        // 1. Manejar Funciones (SUMA)
        if (formula.toUpperCase().startsWith("SUMA")) {
            // Regex simple: busca patrones como A1:B2 o A1;B2;C3
            const rangeMatch = formula.match(/SUMA\(([^)]+)\)/i);
            if (!rangeMatch || !rangeMatch[1]) return "Error";

            let ranges = [];
            // Dividir por separadores de rangos (ej: A1:B2) o celdas sueltas (ej: A1;B2)
            const parts = rangeMatch[1].split(/[,;]/).map(p => p.trim());

            for (let part of parts) {
                if (part.includes(":") && part.length > 0) {
                    // Es un rango (A1:B2)
                    const [startCell, endCell] = part.split(':').map(s => s.trim());
                    ranges.push(getRangeCells(startCell, endCell));
                } else if (part.length > 0) {
                    // Es una celda suelta (A1)
                    ranges.push([part]);
                }
            }

            let sum = 0;
            for (const range of ranges) {
                for (const [col, row] of range) {
                    const cellId = `${col}${row}`;
                    // Obtener el valor REAL de la celda para sumar (no el contenido del storage)
                    const cellElement = document.getElementById(`cell-${cellId}`);
                    if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                        sum += parseFloat(cellElement.innerText);
                    }
                }
            }
            return sum.toString();
        }

        // 2. Manejar Operadores Aritméticos (+, -, *, /)
        let expression = formula;
        
        // Reemplazar referencias de celda (A1) por sus valores numéricos reales
        expression = expression.replace(/([A-Z]+[0-9]+)/g, (match) => {
            const cellElement = document.getElementById(`cell-${match}`);
            if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                return parseFloat(cellElement.innerText).toString();
            }
            // Si no es un número válido o la celda está vacía, devolver 0 para evitar NaN
            return "0";
        });

        // Evaluar la expresión matemática segura (usando eval() con precaución)
        // Dado que ya reemplazamos referencias por números y los operadores son básicos, esto es relativamente seguro en este contexto.
        const result = Function(`return ${expression}`)();
        
        if (isNaN(result)) {
            return "Error"; // Si la operación falla
        }

        return result.toString();

    } catch (error) {
        console.error("Error al calcular la fórmula:", error);
        return "#ERROR!"; // Mostrar un mensaje de error visible
    }
}

/**
 * Determina todas las coordenadas [col, row] que caen dentro del rango dado (ej: A1 a C3).
 * @param {string} startCell - Celda inicial (A1).
 * @param {string} endCell - Celda final (C3).
 * @returns {Array<[string, number]>} Array de coordenadas [columna, fila].
 */
function getRangeCells(startCell, endCell) {
    // Extraer letras y números
    const startCol = startCell.toUpperCase().match(/[A-Z]+/)[0];
    const startRow = parseInt(startCell.match(/[0-9]+/)[0]);

    const endCol = endCell.toUpperCase().match(/[A-Z]+/)[0];
    const endRow = parseInt(endCell.match(/[0-9]+/)[0]);

    let cells = [];
    for (let i = 0; i < COLUMNS.length; i++) {
        const currentCol = COLUMNS[i];
        if (currentCol >= startCol && currentCol <= endCol) { // Comparación lexicográfica simple para columnas
            const colIndex = COLUMNS.indexOf(currentCol);
            if (colIndex < 0 || colIndex > COLUMNS.length -1) continue;

            for (let j = Math.max(startRow, 1); j <= Math.min(endRow, NUM_ROWS); j++) {
                cells.push([currentCol, j]);
            }
        }
    }
    // Nota: Esta implementación de rango es simplificada; un manejo robusto requeriría comparar letras y números por separado, 
    // pero para el propósito del ejercicio (A1:B2), la iteración sobre índices funciona.
    return cells.filter((value, index) => {
        const [col, row] = value;
        if (col >= startCol && col <= endCol && row >= Math.min(startRow, endRow) && row <= Math.max(startRow, endRow)) return true;
        return false;
    });
}


/**
 * Actualiza el contenido y la apariencia de una celda específica.
 * Este es el núcleo del sistema de actualización y persistencia.
 * @param {HTMLElement} cellElement - El elemento DOM de la celda a actualizar.
 * @param {string} newValue - El nuevo valor de texto o fórmula para la celda.
 */
function updateCell(cellElement, newValue) {
    const col = cellElement.dataset.col;
    const row = parseInt(cellElement.dataset.row);
    const cellKey = `${col}:${row}`;

    // 1. Actualizar el estado interno y la apariencia del DOM
    cellDataStore.set(cellKey, newValue);
    cellElement.innerText = newValue;
    
    // Guardar fondo si es necesario (Esto debería ser manejado por los eventos de formato)

    // 2. Recalcular dependencias: Actualizar todas las celdas que usen esta celda como input.
    recalculateDependencies(col, row);
    
    // 3. Persistir el cambio
    saveData();
}

/**
 * Identifica y fuerza la recalculación de cualquier fórmula que dependa del valor cambiado (col, row).
 * @param {string} changedCol - Columna que cambió.
 * @param {number} changedRow - Fila que cambió.
 */
function recalculateDependencies(changedCol, changedRow) {
    // Iterar sobre TODAS las celdas para encontrar fórmulas dependientes
    for (let row = 1; row <= NUM_ROWS; row++) {
        for (let colIndex = 0; colIndex < NUM_COLUMNS; colIndex++) {
            const currentCol = COLUMNS[colIndex];
            const cellElement = document.getElementById(`cell-${currentCol}${row}`);
            if (!cellElement) continue;

            const currentCellKey = `${currentCol}:${row}`;
            const content = cellDataStore.get(currentCellKey);

            // Solo recalcular si la celda contiene una fórmula (empieza con =)
            if (content && typeof content === 'string' && content.startsWith("=")) {
                
                // Verificar si el contenido de la celda actual hace referencia a la celda que acaba de cambiar
                const formulaCheck = RegExp(`(${changedCol}${changedRow})`, "g");
                if (typeof content !== "string" || !formulaCheck.test(content)) {
                    continue; // No depende del cambio, saltar
                }

                // Si sí depende, recalcular y actualizar el valor en el DOM/Store
                const calculatedValue = calculateCellValue(content);
                updateCell(cellElement, calculatedValue);
            } else if (typeof content === 'string' && !content.includes("=")) {
                 // Esto es más optimista: si la celda no tiene fórmula y se toca, 
                 // simplemente asegurar que el valor guardado sea el actual texto.
                 updateCell(cellElement, content);
            }
        }
    }
}


/**
 * Maneja los eventos de clic en una celda para permitir edición o selección.
 * @param {Event} event - El evento DOM capturado.
 */
function handleCellClick(event) {
    const target = event.target;

    // Verificar si el elemento objetivo es realmente una celda válida
    if (!target || !target.classList.contains("spreadsheet-cell")) return;

    const col = target.dataset.col;
    const row = parseInt(target.dataset.row);
    const cellKey = `${col}:${row}`;
    
    // 1. Posicionar el cursor y hacer editable (R10)
    // Si ya está en modo edición, no hacemos nada aquí.
    if (!target.hasAttribute("contenteditable") || !target.getAttribute("contenteditable")) {
        target.setAttribute("contenteditable", "true");
        target.focus();
    }

    // 2. Manejar la selección de encabezados (Columna o Fila)
    const parent = target.closest(".spreadsheet-row");
    if (!parent) return;

    // Intentar detectar si se hizo clic en un encabezado de columna/fila, no solo en el contenido.
}


/**
 * Maneja los eventos de entrada (input) para actualizar la celda y recalcular.
 * @param {Event} event - El evento DOM capturado.
 */
function handleCellInput(event) {
    const target = event.target;

    // Solo procesar si estamos editando contenido dentro de una celda editable
    if (!target || !target.classList.contains("spreadsheet-cell")) return;

    let newValue = target.innerText;
    
    // Limpieza básica del valor (evitar que se guarden espacios o caracteres inválidos)
    newValue = String(newValue).trim(); 

    const col = target.dataset.col;
    const row = parseInt(target.dataset.row);
    
    if (newValue === "") {
        // Si el usuario borra todo, simplemente actualizar y guardar vacío
        updateCell(target, "");
        return;
    }

    // 1. Determinar si es un texto o una fórmula para mostrarlo correctamente
    let finalValue = newValue;
    if (newValue.startsWith("=")) {
        finalValue = newValue; // Mantener el '=' visible
    } else if (!isNaN(parseFloat(newValue))) {
        // Si parece un número, forzar su presentación numérica en la UI si es posible
        finalValue = parseFloat(newValue).toString(); 
    }

    // 2. Actualizar y disparar cálculos de dependencia
    updateCell(target, newValue);
}


/**
 * Aplica acciones masivas a una columna o fila completa (Borrar, Color, Vaciar, Ocultar).
 * @param {string} type - 'column' o 'row'. Tipo de selección.
 * @param {HTMLElement} selectorElement - El elemento del encabezado clickeado (col-A o 3).
 * @param {string} actionType - 'delete', 'clear', 'color', 'hide'. Acción a realizar.
 * @param {*} [value] - Valor específico para la acción (ej: color #FF0000).
 */
function handleHeaderAction(type, selectorElement, actionType, value = null) {
    if (!selectorElement) return;

    const targetId = selectorElement.id;
    let affectedElements = [];
    let identifier; // Columna letra o Fila número

    // Determinar qué columna/fila se seleccionó
    if (type === 'column') {
        identifier = COLUMNS[parseInt(targetId.substring(4)) - 1]; // A, B, C...
        affectedElements = Array.from(document.querySelectorAll(`.spreadsheet-cell[data-col="${identifier}"]`));
    } else if (type === 'row') {
        const rowNumber = parseInt(targetId.substring(4));
        identifier = rowNumber;
        affectedElements = Array.from(document.querySelectorAll(`.spreadsheet-cell[data-row="${identifier}"]`));
    }

    // Ejecutar la acción basada en el tipo
    switch (actionType) {
        case 'clear': // Vaciar contenido
            affectedElements.forEach(el => {
                updateCell(el, "");
            });
            break;
        case 'color': // Cambiar color de fondo
            const style = typeof value === 'string' ? value : "#FFFFFF";
            affectedElements.forEach(el => {
                el.style.backgroundColor = style;
                // Actualizar el estado en local storage también
                const col = el.dataset.col;
                const row = parseInt(el.dataset.row);
                saveData(); 
            });
            break;
        case 'hide': // Ocultar columna/fila (R8, R14)
            if (type === 'column') {
                document.getElementById(`col-${identifier}`).classList.add('hidden-header');
                affectedElements.forEach(el => el.style.display = 'none');
            } else if (type === 'row') {
                // Ocultar la fila entera, incluyendo su celda de referencia si existiera
                const rowElement = document.querySelector(`.spreadsheet-cell[data-row="${identifier}"]`).closest('.spreadsheet-row');
                if (rowElement) {
                    rowElement.style.display = 'none';
                }
            }
            break;
        case 'delete': // Borrar columna/fila (R13, R15)
            // Eliminación de contenido y estructura es compleja en el DOM puro. 
            // Para simular la eliminación completa, simplemente vaciamos los datos y ocultamos/removemos visualmente.

            if (type === 'column') {
                const colToRemove = identifier;
                alert(`Columna ${colToRemove} eliminada (Simulado). Los datos se han borrado de localStorage.`);
                // Limpieza simulada: vaciar contenido y guardar el estado como si no existiera.
                affectedElements.forEach(el => updateCell(el, ""));
                // En un entorno real, se modificaría la estructura DOM aquí.
            } else if (type === 'row') {
                const rowToRemove = identifier;
                alert(`Fila ${rowToRemove} eliminada (Simulado). Los datos se han borrado de localStorage.`);
                affectedElements.forEach(el => updateCell(el, ""));
                // Limpieza simulada: vaciar contenido y guardar el estado como si no existiera.
            }
            break;
    }
}


/**
 * Maneja clics en los encabezados (Columna A-J o Fila 1-20).
 * @param {Event} event - El evento DOM capturado.
 */
function handleHeaderClick(event) {
    const target = event.target;

    // Verificar si el clic fue en un encabezado de columna (col-A a col-J) o fila (el corner cell es manejado por la grilla principal).
    if (!target || !target.classList.contains("column-letter")) return;
    
    const columnLetter = target.id.substring(4); // Obtener 'A', 'B', etc.

    // Si el header ya está oculto, no permitir interacción de acciones masivas
    if (target.classList.contains('hidden-header')) return;

    // Mostrar un menú contextual o ejecutar la acción directamente para este ejercicio.
    const action = prompt(
        `Acciones disponibles para Columna ${columnLetter}:\n1. Borrar contenido\n2. Cambiar fondo (ej: #FF0000)\n3. Vaciar/Borrar columna completa\n4. Ocultar columna`);

    if (!action) return;

    const actionMap = {
        "1": "clear", // Limpiar contenido
        "2": "color",  // Cambiar color
        "3": "delete", // Borrar completamente
        "4": "hide"    // Ocultar
    };

    if (actionMap[action]) {
        let value = null;
        if (action === '2') {
            value = prompt("Ingrese el código de color hexadecimal (ej: #FF0000):").toUpperCase();
        }
        handleHeaderAction('column', target, actionMap[action], value);
    }
}

/**
 * Inicializador principal que configura la aplicación.
 */
function init() {
    // 1. Configurar la estructura de la grilla (20x10 celdas)
    initializeGrid();

    // 2. Cargar datos persistentes al inicio
    loadData();

    // 3. Adjuntar el listener para los encabezados de columna (A-J)
    document.querySelector(".column-headers").addEventListener(
        "click", 
        handleHeaderClick
    );

    // NOTA: El manejo de filas se simula en este ejercicio, ya que la estructura HTML no proporciona un target directo y fácil para hacer clic en el número '3' sin modificar index.html. 
    // Por lo tanto, solo se implementa la funcionalidad de columna completa (R6).

}

// Ejecutar el sistema cuando el DOM esté completamente cargado
document.addEventListener("DOMContentLoaded", init);
