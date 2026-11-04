// Constantes globales de la aplicación
const NUM_ROWS = 20; // Número máximo de filas
const NUM_COLS = 10; // Número máximo de columnas (A a J)
const STORAGE_KEY = "spreadsheetData";

// Selector de elementos clave
const spreadsheetContainer = document.getElementById("spreadsheet-container");
const cells = document.querySelectorAll(".cell");
const rowLabels = document.querySelectorAll(".row-label");
const columnHeaders = document.querySelectorAll(".column-header");

/**
 * @typedef {Object} Coordinates
 * @property {string} col - Columna de la celda (A, B, C, etc.)
 * @property {number} row - Número de fila (1 a 20)
 */

// ===============================================================
// UTILIDADES Y GESTIÓN DE ESTADO
// ===============================================================

/**
 * Obtiene las coordenadas de una celda dada su elemento DOM.
 * @param {HTMLElement} cellEl - El elemento <td class="cell">.
 * @returns {Coordinates} Coordenadas columna y fila.
 */
const getCellCoordinates = (cellEl) => {
    return {
        col: cellEl.dataset.col,
        row: parseInt(cellEl.dataset.row),
    };
};

/**
 * Convierte un índice de columna (0-9) a su letra correspondiente (A-J).
 * @param {number} index - Índice numérico de la columna.
 * @returns {string} Letra de la columna.
 */
const getColumnLetter = (index) => {
    return String.fromCharCode("A".charCodeAt(0) + index);
};

/**
 * Obtiene el elemento celda DOM basándose en coordenadas.
 * @param {string} col - Columna ('A' a 'J').
 * @param {number} row - Fila (1 a 20).
 * @returns {HTMLElement | null} El elemento <td class="cell"> o null si no existe.
 */
const getCellElement = (col, row) => {
    // Buscamos el selector de forma eficiente usando data attributes.
    return document.querySelector(`[data-col="${col}"][data-row="${row}"]`);
};

/**
 * Obtiene el valor actual del contenido de una celda.
 * @param {HTMLElement} cellEl - El elemento <td class="cell">.
 * @returns {string} Contenido de la celda.
 */
const getCellValue = (cellEl) => {
    return cellEl.textContent.trim();
};

/**
 * Actualiza el valor visible y el estado interno de una celda.
 * Esto se usa para escribir contenido sin disparar cálculos automáticos.
 * @param {HTMLElement} cellEl - El elemento <td class="cell"> a actualizar.
 * @param {string} value - Nuevo valor (texto o fórmula).
 */
const updateCellContent = (cellEl, value) => {
    if (!value) {
        cellEl.textContent = "";
        cellEl.dataset.formula = ""; // Limpiar estado de fórmula
        return;
    }

    // Si es una fórmula, guardamos la fórmula y mostramos el valor calculado/inicial.
    const isFormula = value.trim().startsWith("=");
    if (isFormula) {
        cellEl.dataset.formula = value.trim(); // Guardar la fórmula en dataset
        // El cálculo real se realiza después de establecer el contenido temporalmente.
    } else {
        cellEl.textContent = value;
        cellEl.dataset.formula = "";
    }
};

/**
 * Guarda todos los datos visibles (contenido y color) del estado actual de la hoja en localStorage.
 */
const saveStateToLocalStorage = () => {
    const state = {};
    // Iterar sobre todas las celdas para capturar su contenido, fórmula y fondo.
    cells.forEach(cellEl => {
        const coords = getCellCoordinates(cellEl);
        state[`${coords.col}${coords.row}`] = {
            value: cellEl.textContent,
            formula: cellEl.dataset.formula || "",
            backgroundColor: cellEl.style.backgroundColor || "",
        };
    });

    // Guardar estado de visibilidad (columnas/filas ocultas)
    const visibilityState = {};
    cells.forEach(cellEl => {
        const coords = getCellCoordinates(cellEl);
        visibilityState[`${coords.col}${coords.row}`] = cellEl.style.display;
    });

    localStorage.setItem(`${STORAGE_KEY}_data`, JSON.stringify(state));
    localStorage.setItem(`${STORAGE_KEY}_vis`, JSON.stringify(visibilityState));
};

/**
 * Carga el estado de la hoja desde localStorage y aplica los valores iniciales.
 */
const loadStateFromLocalStorage = () => {
    const savedData = localStorage.getItem(`${STORAGE_KEY}_data`);
    const savedVisibility = localStorage.getItem(`${STORAGE_KEY}_vis`);

    if (!savedData) return;

    const cellStates = JSON.parse(savedData);
    const visibilityMap = JSON.parse(savedVisibility || '{}');

    // 1. Aplicar valores y fórmulas a todas las celdas
    cells.forEach(cellEl => {
        const coords = getCellCoordinates(cellEl);
        const key = `${coords.col}${coords.row}`;
        const state = cellStates[key];

        if (state) {
            // Restaura el fondo
            cellEl.style.backgroundColor = state.backgroundColor;

            let contentToSet = state.formula || state.value;
            updateCellContent(cellEl, contentToSet);

            // Si había una fórmula guardada, forzar un cálculo al cargar
            if (state.formula) {
                calculateDependenciesForCell(cellEl);
            } else {
                // Solo contenido estático
                cellEl.textContent = state.value;
            }
        }
    });

    // 2. Aplicar visibilidad de filas y columnas
    document.querySelectorAll(".row-label").forEach(rowLabel => {
        const rowNumber = rowLabel.textContent.trim();
        if (visibilityMap[`${rowNumber}_vis`]) {
            rowLabel.style.display = visibilityMap[`${rowNumber}_vis`];
        } else {
             // Por defecto, mostrar
             rowLabel.style.display = ""; 
        }
    });

    document.querySelectorAll(".column-header").forEach(colHeader => {
        const colLetter = colHeader.dataset.col;
        if (visibilityMap[`${colLetter}_vis`]) {
            colHeader.style.display = visibilityMap[`${colLetter}_vis`];
        } else {
             // Por defecto, mostrar
             colHeader.style.display = ""; 
        }
    });

    cells.forEach(cellEl => {
         const coords = getCellCoordinates(cellEl);
         if (visibilityMap[`${coords.col}${coords.row}_vis`]) {
            // Aplicar visibilidad a la celda
            cellEl.style.display = visibilityMap[`${coords.col}${coords.row}_vis`];
        } else {
             cellEl.style.display = ""; 
        }
    });
};


// ===============================================================
// MOTOR DE CÁLCULOS Y FÓRMULAS
// ===============================================================

/**
 * Convierte la fórmula de rango (ej: A1:A3) en un array de coordenadas.
 * @param {string} rangeString - Rango de texto como "A1:B5".
 * @returns {Array<HTMLElement>} Array de elementos celda DOM que componen el rango.
 */
const getRangeElements = (rangeString) => {
    // Regex para capturar la primera coordenada y la última. Ejemplo: A1:J20
    const match = rangeString.match(/([A-Z]+)\d+:\s*([A-Z]+)\d+/i);
    if (!match) return [];

    const startColLetter = match[1][0];
    const endColLetter = match[2][0];
    const startRow = parseInt(rangeString.split(':')[1].replace(/[^0-9]/g, ''));
    const endRow = parseInt(rangeString.split(':').pop().replace(/[^0-9]/g, ''));

    let elements = [];
    // Convertir letras a índices (A=0, B=1...)
    const colToIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);

    for (let r = startRow; r <= endRow; r++) {
        for (let cIndex = colToIndex(startColLetter); cIndex <= colToIndex(endColLetter); cIndex++) {
            const colLetter = getColumnLetter(cIndex);
            elements.push(getCellElement(colLetter, r));
        }
    }
    return elements;
};

/**
 * Evalúa el contenido de una fórmula matemática (operadores +, -, *, /).
 * @param {string[]} values - Array de valores numéricos a operar.
 * @returns {number | NaN} El resultado matemático.
 */
const evaluateMathOperation = (values) => {
    if (values.length === 0) return "";

    // Usamos eval con precaución, pero es el más directo para evaluar expresiones matemáticas simples.
    try {
        // Filtramos nulos o vacíos y convertimos a float.
        const numericValues = values.filter(v => v !== null && v !== undefined).map(v => parseFloat(v));

        if (numericValues.some(isNaN)) {
            return "Error: Datos no numéricos";
        }
        
        // Evaluar la cadena de números unidos por operadores.
        let calculationString = numericValues.join("");
        // Este paso es simplificado, en un entorno real se usaría un parser AST. 
        // Aquí asumimos que los valores ya vienen separados correctamente para eval().
        return eval(calculationString).toString();

    } catch (e) {
        console.error("Error al evaluar operación matemática:", e);
        return "Fórmula inválida";
    }
};


/**
 * Calcula el valor de una fórmula dada su cadena de texto.
 * @param {HTMLElement} cellEl - El elemento celda que contiene la fórmula.
 * @returns {string} El resultado calculado o un mensaje de error.
 */
const calculateFormulaValue = (cellEl) => {
    const formulaText = getCellValue(cellEl);
    if (!formulaText || !formulaText.startsWith("=")) {
        return ""; // No es una fórmula
    }

    let workingFormula = formulaText.substring(1).trim(); // Remover el '=' inicial
    let resultValue = "";
    let errorState = false;

    // 1. Manejo de SUMA (Rango o Celdas sueltas)
    if (workingFormula.toUpperCase().startsWith("SUMA")) {
        // Limpiamos "SUMA(" y el paréntesis final ")"
        const argsString = workingFormula.substring(4).trim();

        let rangesAndCells = [];

        // Detectar si es un rango (ej: A1:B5) o celdas separadas por ; (ej: A1;B2;C3)
        if (argsString.includes(':')) {
            const rangeMatch = argsString.match(/([A-Z]+[0-9]+):?([A-Z]+[0-9]*)/);
            if (rangeMatch) {
                rangesAndCells.push(getRangeElements(rangeMatch[0]).map(el => el.textContent));
            }
        } else if (argsString.includes(';')) {
            // Celdas sueltas: A1; B2; C3
            const cellRefs = argsString.split(';').map(s => s.trim());
            rangesAndCells = cellRefs.map(ref => getCellElement(ref[0], ref[1]) ? getCellValue(getCellElement(ref[0], ref[1])) : null);
        } else {
             // Caso de una sola celda o rango simple, aunque el input debería manejarlo.
            const singleRef = argsString;
            const matchSingle = singleRef.match(/([A-Z]+)([0-9]+)/i);
            if (matchSingle) {
                rangesAndCells.push(getCellElement(matchSingle[1], matchSingle[2]) ? getCellValue(getCellElement(matchSingle[1], matchSingle[2])) : null);
            }
        }

        // Recolectar todos los valores numéricos para la suma
        const numericValues = rangesAndCells.flat().filter(v => typeof v === 'string' && !isNaN(parseFloat(v)));
        if (numericValues.length > 0) {
            resultValue = numericValues.reduce((acc, val) => acc + parseFloat(val), 0).toString();
        } else {
            resultValue = "Error: No se encontraron valores";
        }

    // 2. Manejo de Operadores Aritméticos (+, -, *, /)
    } else {
        // Parsear la fórmula para obtener referencias como B1, C1, etc.
        const references = workingFormula.match(/[A-Z]+[0-9]+/g);

        if (!references) {
            return "Error: Sintaxis inválida";
        }

        let parts = [];
        for (const ref of references) {
            // Obtener coordenadas de la referencia (ej: B1)
            const colLetter = ref[0];
            const rowNumber = parseInt(ref.substring(colLetter.length));
            const cellEl = getCellElement(colLetter, rowNumber);

            if (cellEl && !isNaN(parseFloat(getCellValue(cellEl)))) {
                parts.push(parseFloat(getCellValue(cellEl))); // Almacenar el valor numérico
            } else if (typeof parseFloat(ref) === 'number' && isNaN(parseFloat(ref))) {
                 // Si es una constante numérica literal como en "=10+5"
                parts.push(parseFloat(ref));
            } else {
                // Si la referencia apunta a texto o está fuera de rango
                return `Error: Referencia ${ref} no válida`;
            }
        }

        // Evaluar la expresión matemática (ejemplo simplificado para +, -, *, /)
        let calculationString = workingFormula; // Usar el string original si es complejo
        try {
             // Reemplazar referencias de texto por sus valores numéricos antes de eval
             calculationString = calculationString.replace(/([A-Z]+[0-9]+)/g, (match) => {
                const colLetter = match[0][0];
                const rowNumber = parseInt(match[0].substring(1));
                const cellEl = getCellElement(colLetter, rowNumber);
                if (cellEl && !isNaN(parseFloat(getCellValue(cellEl)))) {
                    return parseFloat(getCellValue(cellEl)).toString();
                }
                return 'NaN'; // Esto causará un error si no es válido
            });

            resultValue = eval(calculationString).toString();

        } catch (e) {
            console.error("Error al evaluar la fórmula:", e);
            resultValue = "Fórmula inválida";
        }
    }

    return resultValue;
};


/**
 * Intenta calcular el valor de una celda y actualiza su contenido si es necesario.
 * Debe ser llamado cuando cambia cualquier dato dependiente.
 * @param {HTMLElement} cellEl - El elemento <td class="cell"> que debe actualizarse.
 */
const calculateDependenciesForCell = (cellEl) => {
    if (!cellEl || !getCellValue(cellEl).startsWith("=")) {
        return; // No es una celda de fórmula o no existe
    }

    // Recalcular el valor usando la fórmula guardada en dataset.
    const newValue = calculateFormulaValue(cellEl);

    // Solo actualizar si el resultado difiere del contenido actual visible (para evitar bucles innecesarios).
    if (String(newValue) !== getCellValue(cellEl)) {
        updateCellContent(cellEl, String(newValue));
        saveStateToLocalStorage(); // Guardar el nuevo cálculo
    }
};


/**
 * Escanea toda la hoja para ver si cualquier fórmula depende de esta celda.
 * Si lo hace, fuerza el recálculo en todas las celdas dependientes.
 * @param {HTMLElement} changedCellEl - La celda que ha sido modificada (el disparador).
 */
const updateAllDependencies = (changedCellEl) => {
    let recalculationsTriggered = 0;

    // Iterar sobre CADA celda de la hoja para verificar si su fórmula usa las coordenadas del changedCell.
    cells.forEach(cellEl => {
        if (!getCellValue(cellEl).startsWith("=")) return;

        const formulaText = getCellValue(cellEl);
        const targetCoords = getCellCoordinates(changedCellEl);
        const isDependencyFound = (formulaText.includes(targetCoords.col) && formulaText.includes(targetCoords.row.toString()));

        if (isDependencyFound) {
            calculateDependenciesForCell(cellEl);
            recalculationsTriggered++;
        }
    });
    
    // Guardar el estado después de la actualización masiva de cálculos.
    if (recalculationsTriggered > 0) {
        saveStateToLocalStorage();
    }
};


// ===============================================================
// MANEJO DE EVENTOS E INTERACCIONES DEL USUARIO
// ===============================================================

/**
 * Maneja el evento de cambio en una celda (escritura, pegado, etc.).
 * @param {Event} event - Evento de input o blur.
 */
const handleCellChange = (event) => {
    const cellEl = event.target;
    let newValue = getCellValue(cellEl);

    // 1. Actualizar el contenido en la memoria y DOM
    updateCellContent(cellEl, newValue);

    // 2. Determinar si se trata de una fórmula o valor estático
    if (newValue.startsWith("=")) {
        // Es fórmula: calcular inmediatamente e intentar actualizar dependencias
        calculateDependenciesForCell(cellEl);
        updateAllDependencies(cellEl); // Actualizar todo lo que usa esta celda
    } else {
        // Es texto/número estático: solo guardar y propagar el cambio de valor.
        saveStateToLocalStorage();
        updateAllDependencies(cellEl); 
    }
};

/**
 * Maneja el clic en la cabecera de una columna (letra A-J).
 * @param {Event} event - Evento del click.
 */
const handleColumnHeaderClick = (event) => {
    const colHeader = event.currentTarget;
    const colLetter = colHeader.dataset.col;

    // 1. Ocultar columna (R8)
    if (colHeader.classList.contains("hidden-col")) {
        showColumn(colLetter);
    } else {
        hideColumn(colLetter);
    }

    // 2. Borrar contenido (R6)
    if (event.ctrlKey && event.altKey && colHeader.dataset.action === "clear") {
        clearColumnContent(colLetter);
    } 
    
    // 3. Cambiar fondo (R6)
    else if (event.metaKey || event.button === 2) { // Comando/Botón derecho simulado para color
        const newColor = prompt("Ingrese el código de color (#RRGGBB):", "#ff0000");
        if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) {
            setBackgroundColorForColumn(colLetter, newColor);
            saveStateToLocalStorage();
        }
    } 
    // 4. Borrar columna completa (R13)
    else if (event.key === 'Delete' || event.altKey && colHeader.dataset.action === "delete") {
         if (confirm(`¿Está seguro de que desea borrar la columna ${colLetter}? Esta acción es irreversible.`)) {
            deleteColumn(colLetter);
        }
    }

    // Siempre guardar el estado después de cualquier manipulación estructural o visual
    saveStateToLocalStorage();
};


/**
 * Maneja el clic en la cabecera de una fila (número 1-20).
 * @param {Event} event - Evento del click.
 */
const handleRowHeaderClick = (event) => {
    const rowLabel = event.currentTarget;
    const rowNumber = parseInt(rowLabel.textContent);

    // 1. Ocultar fila (R8)
    if (rowLabel.classList.contains("hidden-row")) {
        showRow(rowNumber);
    } else {
        hideRow(rowNumber);
    }

     // 2. Borrar contenido (R7)
    if (event.ctrlKey && event.altKey && rowLabel.dataset.action === "clear") {
        clearRowContent(rowNumber);
    } 
    
    // 3. Cambiar fondo (R7)
    else if (event.metaKey || event.button === 2) { // Comando/Botón derecho simulado para color
        const newColor = prompt("Ingrese el código de color (#RRGGBB):", "#ff0000");
        if (newColor && /^#[0-9A-Fa-f]{6}$/.test(newColor)) {
            setBackgroundColorForRow(rowNumber, newColor);
            saveStateToLocalStorage();
        }
    } 
    // 4. Borrar fila completa (R15)
    else if (event.key === 'Delete' || event.altKey && rowLabel.dataset.action === "delete") {
         if (confirm(`¿Está seguro de que desea borrar la fila ${rowNumber}? Esta acción es irreversible.`)) {
            deleteRow(rowNumber);
        }
    }

    // Siempre guardar el estado después de cualquier manipulación estructural o visual
    saveStateToLocalStorage();
};


// ===============================================================
// ACCIONES DE MANIPULACIÓN DE LA HOJA (CRUD/VISIBILIDAD)
// ===============================================================

/**
 * Oculta completamente una columna.
 * @param {string} colLetter - Letra de la columna ('A'-'J').
 */
const hideColumn = (colLetter) => {
    document.querySelectorAll(`.column-header[data-col="${colLetter}"]`).forEach(el => {
        el.classList.add("hidden-col");
        el.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll(`.cell[data-col="${colLetter}"]`).forEach(el => {
        el.style.display = "none";
    });
};

/**
 * Muestra una columna previamente oculta.
 * @param {string} colLetter - Letra de la columna ('A'-'J').
 */
const showColumn = (colLetter) => {
    document.querySelectorAll(`.column-header[data-col="${colLetter}"]`).forEach(el => {
        el.classList.remove("hidden-col");
        el.setAttribute('aria-hidden', 'false');
    });
     document.querySelectorAll(`.cell[data-col="${colLetter}"]`).forEach(el => {
        el.style.display = ""; // Mostrar en línea
    });
};

/**
 * Oculta completamente una fila.
 * @param {number} rowNumber - Número de la fila (1-20).
 */
const hideRow = (rowNumber) => {
    document.getElementById(`row-label-${rowNumber}`).classList.add("hidden-row");
    for (let i = 0; i < NUM_COLS; i++) {
        const colLetter = getColumnLetter(i);
        const cellsInRow = document.querySelectorAll(`.cell[data-col="${colLetter}"][data-row="${rowNumber}"]`);
        cellsInRow.forEach(el => el.style.display = "none");
    }
};

/**
 * Muestra una fila previamente oculta.
 * @param {number} rowNumber - Número de la fila (1-20).
 */
const showRow = (rowNumber) => {
    document.getElementById(`row-label-${rowNumber}`).classList.remove("hidden-row");
     for (let i = 0; i < NUM_COLS; i++) {
        const colLetter = getColumnLetter(i);
        const cellsInRow = document.querySelectorAll(`.cell[data-col="${colLetter}"][data-row="${rowNumber}"]`);
        cellsInRow.forEach(el => el.style.display = ""); // Mostrar en línea
    }
};


/**
 * Limpia todo el contenido de una columna (valores y fórmulas).
 * @param {string} colLetter - Letra de la columna.
 */
const clearColumnContent = (colLetter) => {
    document.querySelectorAll(`.cell[data-col="${colLetter}"]`).forEach(cellEl => {
        // Borrar contenido visible e invisible
        updateCellContent(cellEl, ""); 
    });
};

/**
 * Limpia todo el contenido de una fila (valores y fórmulas).
 * @param {number} rowNumber - Número de la fila.
 */
const clearRowContent = (rowNumber) => {
    document.querySelectorAll(`.cell[data-row="${rowNumber}"]`).forEach(cellEl => {
        updateCellContent(cellEl, ""); 
    });
};

/**
 * Borra el elemento DOM de una columna y actualiza la lógica.
 * @param {string} colLetter - Letra de la columna a borrar.
 */
const deleteColumn = (colLetter) => {
    // 1. Remover los elementos celda
    document.querySelectorAll(`.cell[data-col="${colLetter}"]`).forEach(el => el.remove());

    // 2. Remover headers y actualizar DOM
    const headerToDelete = document.querySelector(`.column-header[data-col="${colLetter}"]`);
    if (headerToDelete) {
        headerToDelete.remove();
    }

    // Nota: La reindexación de columnas no se implementa aquí para mantener la estructura A-J fija,
    // pero sí debe eliminarse del estado lógico y el localStorage.
};

/**
 * Borra el elemento DOM de una fila y actualiza la lógica.
 * @param {number} rowNumber - Número de la fila a borrar.
 */
const deleteRow = (rowNumber) => {
    // 1. Remover los elementos celda
    document.querySelectorAll(`#row-label-${rowNumber}`).forEach(el => el.remove());
    document.querySelectorAll(`.cell[data-row="${rowNumber}"]`).forEach(el => el.remove());

    // Nota: Similarmente, se mantiene la estructura de 20 filas vacías para preservar los IDs/Selectores.
};


/**
 * Cambia el color de fondo de todos los elementos de una columna.
 * @param {string} colLetter - Letra de la columna.
 * @param {string} colorCode - Código hexadecimal del color.
 */
const setBackgroundColorForColumn = (colLetter, colorCode) => {
    document.querySelectorAll(`.cell[data-col="${colLetter}"]`).forEach(cellEl => {
        cellEl.style.backgroundColor = colorCode;
    });
};

/**
 * Cambia el color de fondo de todos los elementos de una fila.
 * @param {number} rowNumber - Número de la fila.
 * @param {string} colorCode - Código hexadecimal del color.
 */
const setBackgroundColorForRow = (rowNumber, colorCode) => {
    document.querySelectorAll(`.cell[data-row="${rowNumber}"]`).forEach(cellEl => {
        cellEl.style.backgroundColor = colorCode;
    });
};


// ===============================================================
// INICIALIZACIÓN Y LISTENERS GLOBALES
// ===============================================================

/**
 * Inicializa el estado de la hoja: añade listeners y carga datos guardados.
 */
const initializeSpreadsheet = () => {
    // 1. Asignar listener a todas las celdas para escritura/cambios (R1, R10)
    cells.forEach(cellEl => {
        // Usamos 'input' para detectar la escritura en tiempo real y 'blur' para guardar el estado final.
        cellEl.addEventListener("input", handleCellChange);
        cellEl.addEventListener("blur", (event) => {
            // Forzar el cálculo al perder el foco, incluso si no es una fórmula
            calculateDependenciesForCell(event.target);
            saveStateToLocalStorage();
        });
    });

    // 2. Asignar listeners a los encabezados de columna y fila para acciones complejas (R6, R7)
    columnHeaders.forEach(headerEl => {
        // Usamos el evento 'contextmenu' o simulaciones para las acciones avanzadas, pero asignaremos un listener general.
        // En este caso, asumimos que los botones de acción se añaden mediante clases/atributos en index.html
        // y usamos un delegado o simplemente adjuntamos al header si está listo.
         headerEl.addEventListener("click", handleColumnHeaderClick);
    });

    document.querySelectorAll(".row-label").forEach(labelEl => {
        labelEl.addEventListener("click", handleRowHeaderClick);
    });


    // 3. Cargar el estado persistente (R9, R17) y ejecutar cálculos iniciales.
    loadStateFromLocalStorage();

    // Finalmente, guardar un estado inicial limpio para asegurar que la sesión actual se guarde bien.
    saveStateToLocalStorage();
};

// Ejecutar la aplicación al cargar el script
initializeSpreadsheet();
