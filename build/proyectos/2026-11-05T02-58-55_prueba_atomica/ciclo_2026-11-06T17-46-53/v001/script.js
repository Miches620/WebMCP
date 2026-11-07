/**
 * R1. Maneja la edición de celdas inline.
 * Se adjunta un listener al contenedor principal para capturar eventos 
 * en cualquier celda editable (td con data-cell).
 */
function setupCellEditing() {
    const spreadsheet = document.getElementById('spreadsheet');

    if (!spreadsheet) {
        console.error("Error: No se encontró la tabla de cálculo.");
        return;
    }

    // Usamos event delegation para escuchar en toda la tabla, 
    // pero solo actuar si el elemento objetivo es una celda de datos editable.
    spreadsheet.addEventListener('input', function(event) {
        const target = event.target;
        
        // Verificamos que el elemento sea un TD y tenga el atributo data-cell
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            const cellId = target.getAttribute('data-cell');
            const value = target.innerText;

            // GUARDAR DATO EN LOCALSTORAGE
            localStorage.setItem(`spreadsheet_${cellId}`, JSON.stringify(value));

            console.log(`Celda ${cellId} actualizada con: "${value}"`);
            // Calcular inmediatamente al escribir
            calculateCell(target); 
        }
    });

    // También es bueno manejar el blur (cuando sale de la celda) para simular un "guardado" o validación final.
    spreadsheet.addEventListener('blur', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            const cellId = target.getAttribute('data-cell');
            const value = target.innerText;

            // GUARDAR DATO EN LOCALSTORAGE
            localStorage.setItem(`spreadsheet_${cellId}`, JSON.stringify(value));

            console.log(`Celda ${cellId} perdió el foco.`);
            // Calcular al perder el foco
            calculateCell(target); 
        }
    });
}

/**
 * Helper function to convert cell ID (e.g., 'A1') into coordinates {r: row, c: col}.
 */
function getCoordinates(cellId) {
    const match = cellId.match(/([A-Z]+)([0-9]+)/);
    if (!match) return { r: -1, c: -1 };

    const columnStr = match[1];
    const rowNum = parseInt(match[2]);
    let colIndex = 0;
    for (let i = 0; i < columnStr.length; i++) {
        colIndex += Math.pow(2, columnStr.charCodeAt(i) - 'A'.charCodeAt(0));
    }

    return { r: rowNum - 1, c: colIndex - 1 }; // Usamos índices base 0 para arrays/loops internos
}

/**
 * Helper function to convert coordinates back to cell ID (e.g., {r: 2, c: 3} -> 'D3').
 */
function getCellIdFromCoordinates(row, col) {
    const rowNum = row + 1;
    let columnStr = '';
    let tempCol = col;
    while (tempCol >= 0) {
        columnStr = String.fromCharCode('A'.charCodeAt(0) + (tempCol % 26)) + columnStr;
        tempCol = Math.floor(tempCol / 26) - 1;
    }
    return `${columnStr}${rowNum}`;
}

/**
 * Calculates the value of a cell based on its content, handling formulas like SUMA() and basic arithmetic.
 */
function calculateCell(cellElement) {
    const formula = cellElement.innerText.trim();
    if (!formula || !formula.startsWith('=')) {
        // Si no es una fórmula, simplemente nos quedamos con el valor actual.
        return; 
    }

    let result = null;
    const formulaBody = formula.substring(1); // Quitar '='

    try {
        // 1. Manejo de SUMA (Rango o Celdas sueltas)
        if (formulaBody.toUpperCase().startsWith('SUMA')) {
            // Regex para capturar el contenido dentro de los paréntesis: (contenido)
            const match = formulaBody.match(/SUMA\((.*)\)/i);
            if (!match || !match[1]) return;

            let argumentsString = match[1];
            let valuesToSum = [];

            // Separar argumentos por coma o punto y coma (asumimos ; como separador principal)
            const argumentList = argumentsString.split(/[,;]/).map(s => s.trim());

            for (const arg of argumentList) {
                if (!arg) continue;

                // Determinar si el argumento es un rango (A1:A3) o una celda suelta (A1)
                if (arg.includes(':')) {
                    const [startCellId, endCellId] = arg.split(':').map(s => s.trim());
                    
                    let startElement = document.querySelector(`[data-cell="${startCellId}"]`);
                    let endElement = document.querySelector(`[data-cell="${endCellId}"]`);

                    if (!startElement || !endElement) {
                        console.warn(`No se encontraron celdas para el rango: ${arg}`);
                        return; 
                    }

                    // Determinar límites del rango (maneja si A1 está después de A3 en la lectura, aunque no debería pasar aquí)
                    const startCoords = getCoordinates(startCellId);
                    const endCoords = getCoordinates(endCellId);

                    let minR = Math.min(startCoords.r, endCoords.r);
                    let maxR = Math.max(startCoords.r, endCoords.r);
                    let minC = Math.min(startCoords.c, endCoords.c);
                    let maxC = Math.max(startCoords.c, endCoords.c);

                    // Iterar sobre todas las celdas dentro del rectángulo definido por los límites
                    for (let r = minR; r <= maxR; r++) {
                        for (let c = minC; c <= maxC; c++) {
                            const cellId = getCellIdFromCoordinates(r, c);
                            const element = document.querySelector(`[data-cell="${cellId}"]`);
                            if (element) {
                                const value = parseFloat(element.innerText) || 0;
                                valuesToSum.push(value);
                            }
                        }
                    }

                } else {
                    // Es una celda suelta (A1, B2, etc.)
                    const element = document.querySelector(`[data-cell="${arg}"]`);
                    if (element) {
                        const value = parseFloat(element.innerText) || 0;
                        valuesToSum.push(value);
                    } else {
                         console.warn(`No se encontró celda para: ${arg}`);
                    }
                }
            }

            result = valuesToSum.reduce((acc, val) => acc + val, 0);
        } 
        // 2. Manejo de Operaciones Aritméticas Simples (A1-B1, A1*B1, etc.)
        else {
            let expression = formulaBody;

            // Regex simple para encontrar patrones como [A-Z]+[0-9]
            const cellRegex = /([A-Z]+[0-9])/g; 
            expression = expression.replace(cellRegex, (match) => {
                const element = document.querySelector(`[data-cell="${match}"]`);
                if (element) {
                    const value = parseFloat(element.innerText);
                    return isNaN(value) ? '0' : value; // Reemplazar la referencia con el valor numérico o 0 si no es un número
                }
                return match; 
            });

            // Evaluar la expresión resultante.
            result = eval(expression);
        }

    } catch (e) {
        console.error("Error al calcular la celda:", e);
        return; // No actualizar si hay error
    }

    // Actualizar el contenido visible de la celda con el resultado calculado
    if (result !== null && !isNaN(result)) {
        cellElement.innerText = result;
        cellElement.dataset.isCalculated = 'true'; 
    } else if (formulaBody) {
         // Si hay fórmula pero no se pudo calcular, mostrar un error o dejar la fórmula si es más útil para el usuario.
         // Para este caso de prueba, asumiremos que debe fallar limpiamente.
         cellElement.innerText = "Error";
    }
}

/**
 * Inicializa la aplicación de hoja de cálculo. 
 * Se encarga de configurar todos los listeners necesarios al cargar la página.
 */
function initializeSpreadsheet() {
    console.log("Inicializando Hoja de Cálculo...");
    loadDataFromLocalStorage(); // Cargar datos antes de configurar listeners
    setupCellEditing();
    // Llamar a la nueva función para manejar la selección y ocultación de filas
    setupRowHidingListeners(); 
    // Inicializar el manejo de columnas y colores (NUEVO)
    setupColumnSelectionAndColoring();
}

// Llamada principal para arrancar la aplicación
initializeSpreadsheet();

function loadDataFromLocalStorage() {
    console.log("Cargando datos guardados en localStorage...");
    const cells = document.querySelectorAll('[data-cell]');
    cells.forEach(cell => {
        const cellId = cell.getAttribute('data-cell');
        // Usamos un prefijo para evitar colisiones con otras partes de la app
        const savedValue = localStorage.getItem(`spreadsheet_${cellId}`);
        if (savedValue !== null) {
            try {
                // Restaurar el valor, asegurando que se muestre como texto
                cell.innerText = JSON.parse(savedValue); 
            } catch (e) {
                console.error("Error al parsear datos de localStorage para:", cellId);
            }
        }
    });
}

function handleHideRow(rowElement) {
    if (!rowElement || !rowElement.parentElement) {
        console.warn("No se pudo encontrar la fila para ocultar.");
        return;
    }

    // Ocultar visualmente toda la fila (incluyendo el label y las celdas)
    rowElement.style.display = 'none';
    
    // Nota: En una implementación real, también deberíamos actualizar los índices de todas las referencias en JS/LocalStorage. 
    // Por simplicidad del scope, solo ocultamos visualmente la fila.
}

function handleHideColumn(columnElement) {
    if (!columnElement || !columnElement.parentElement) {
        console.warn("No se pudo encontrar la columna para ocultar.");
        return;
    }

    // Ocultar visualmente toda la columna (incluyendo el header y las celdas de datos)
    const colIndex = Array.from(columnElement.parentNode.children).indexOf(columnElement);
    
    // 1. Ocultar el encabezado de la columna (la letra A, B, C...)
    columnElement.style.display = 'none';

    // 2. Iterar sobre todas las filas y ocultar la celda correspondiente en esa columna
    const rows = columnElement.closest('tbody').querySelectorAll('tr');
    rows.forEach(row => {
        // Buscar el TD que corresponde a esta columna (el índice es relativo al tbody)
        const cellToHide = row.querySelector(`td:nth-child(${colIndex + 2})`); // +2 porque la primera celda es el row-label
        if (cellToHide) {
            cellToHide.style.display = 'none';
        }
    });

    // Nota: Al ocultar una columna, se rompen las referencias de coordenadas y fórmulas en JS. 
    // Esto requiere un manejo avanzado que está fuera del scope mínimo de corrección.
}

function setupRowSelectionListener() {
    const rowLabels = document.querySelectorAll('.row-label');
    let selectedRowElement = null;

    // Función que maneja la selección de una fila al hacer clic en su etiqueta
    const handleLabelClick = (event) => {
        // Obtener el elemento padre, que es la fila <tr> completa
        const rowElement = event.currentTarget.closest('tr');
        if (rowElement) {
            selectedRowElement = rowElement;
            console.log("Fila seleccionada:", selectedRowElement);
            // Aquí se podría añadir lógica de UI para resaltar la fila
        }
    };

    rowLabels.forEach(label => {
        label.addEventListener('click', handleLabelClick);
    });

    // Devolver una función que permite acceder al elemento seleccionado globalmente, 
    // o simplemente usar el scope si se llama desde un evento de botón.
    return () => selectedRowElement;
}

function setupRowHidingListeners() {
    // Inicializa la selección y obtiene la función que maneja el estado seleccionado
    const getSelectedRow = setupRowSelectionListener(); 

    document.getElementById('hideRowButton').addEventListener('click', function() {
        // Obtener la referencia de la fila seleccionada usando la lógica implementada
        const rowToHide = getSelectedRow(); 
        if (rowToHide) {
            handleHideRow(rowToHide);
        } else {
            alert("Por favor, selecciona una fila primero para ocultarla.");
        }
    });
}

/**
 * Configura los listeners para la selección de columnas y la aplicación de color.
 */
function setupColumnSelectionAndColoring() {
    const colHeaders = document.querySelectorAll('.col-header');
    const applyButton = document.getElementById('applyColorButton');

    // 1. Listener para seleccionar una columna haciendo clic en su letra (<th>)
    colHeaders.forEach(header => {
        header.addEventListener('click', function() {
            // Deseleccionar todos los headers primero
            colHeaders.forEach(h => h.classList.remove('selected-column'));
            
            // Seleccionar el actual y guardar su índice
            this.classList.add('selected-column');
            window.selectedColIndex = parseInt(this.getAttribute('data-col-index'));
            console.log(`Columna seleccionada: ${this.innerText}, Índice: ${window.selectedColIndex}`);
        });
    });

    // 2. Listener para aplicar el color seleccionado a la columna activa
    applyButton.addEventListener('click', function() {
        const selectedColor = document.getElementById('cellColorPicker').value;
        const colIndex = window.selectedColIndex;

        if (colIndex === undefined || isNaN(colIndex)) {
            alert("Por favor, selecciona una columna primero.");
            return;
        }

        // Obtener todas las filas del cuerpo de la tabla
        const rows = document.getElementById('spreadsheet').querySelectorAll('tbody tr');
        let colorAppliedCount = 0;

        rows.forEach(row => {
            // En cada fila, buscamos el TD que corresponde al índice seleccionado (colIndex)
            // Los TDs están en orden: [A], [B], [C]...
            const targetCell = row.querySelectorAll('td')[colIndex]; 
            
            if (targetCell) {
                // Aplicar el color de fondo directamente al elemento TD
                targetCell.style.backgroundColor = selectedColor;
                colorAppliedCount++;
            }
        });

        if (colorAppliedCount > 0) {
             console.log(`Color ${selectedColor} aplicado exitosamente a la columna ${String.fromCharCode('A'.charCodeAt(0) + colIndex)}.`);
        } else {
             console.warn("No se encontraron celdas para aplicar el color.");
        }
    });
}
