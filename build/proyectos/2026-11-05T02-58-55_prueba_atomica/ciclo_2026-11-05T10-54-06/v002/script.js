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
            console.log(`Celda ${target.getAttribute('data-cell')} actualizada con: "${target.innerText}"`);
            // Calcular inmediatamente al escribir
            calculateCell(target); 
        }
    });

    // También es bueno manejar el blur (cuando sale de la celda) para simular un "guardado" o validación final.
    spreadsheet.addEventListener('blur', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            console.log(`Celda ${target.getAttribute('data-cell')} perdió el foco.`);
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
    setupCellEditing();
    // Aquí se añadirían futuras inicializaciones (ej: carga de datos, cálculos)
}

// Llamada principal para arrancar la aplicación
initializeSpreadsheet();
