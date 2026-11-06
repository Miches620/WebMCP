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
        
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            // Trigger calculation immediately on input change, especially if a formula is being typed
            calculateFormula(target);
        }
    });

    // También es bueno manejar el blur (cuando sale de la celda) para simular un "guardado" o validación final.
    spreadsheet.addEventListener('blur', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            // Trigger calculation when focus is lost, ensuring the formula is evaluated
            calculateFormula(target);
        }
    });
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

function getValueFromCell(cellRef) {
    // Regex to match standard Excel references (e.g., A1, B20)
    const match = cellRef.match(/([A-Z]+)(\d+)/i);
    if (!match) return null;

    const colChar = match[1].toUpperCase();
    const rowNum = parseInt(match[2]);

    // Find the correct TD element based on data-cell attribute
    const targetCell = document.querySelector(`[data-cell="${colChar}${rowNum}"]`);
    if (targetCell) {
        let value = targetCell.innerText.trim();
        // Attempt to parse as a number, otherwise keep it as string
        return isNaN(parseFloat(value)) ? value : parseFloat(value);
    }
    return null;
}

function calculateFormula(targetElement) {
    const formula = targetElement.innerText.trim();

    if (!formula || !formula.startsWith('=')) {
        // Not a formula or empty, no calculation needed
        return false; 
    }

    let contentToEvaluate = formula.substring(1); // Remove '='
    let result = null;

    try {
        // --- 1. Handle SUMA function (e.g., =SUMA(A1:A3) or =SUMA(A1;B2)) ---
        const sumMatch = contentToEvaluate.match(/^SUMA\((.*)\)$/i);
        if (sumMatch) {
            const argsString = sumMatch[1];
            let values = [];

            // Arguments can be separated by ',' or ';'
            const argList = argsString.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);

            for (const arg of argList) {
                if (arg.includes(':')) {
                    // Range: A1:A3
                    const rangeMatch = arg.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
                    if (rangeMatch) {
                        const startCol = rangeMatch[1].toUpperCase();
                        const startRow = parseInt(rangeMatch[2]);
                        const endCol = rangeMatch[3].toUpperCase();
                        const endRow = parseInt(rangeMatch[4]);

                        // Simple iteration for single-letter columns (A-J)
                        let currentSum = 0;
                        for (let r = startRow; r <= endRow; r++) {
                            let colCodeStart = startCol.charCodeAt(0);
                            let colCodeEnd = endCol.charCodeAt(0);

                            // Iterate through columns from min code to max code
                            for (let code = Math.min(colCodeStart, colCodeEnd); code <= Math.max(colCodeStart, endCol.charCodeAt(0)); code++) {
                                const currentColChar = String.fromCharCode(code);
                                const cellRef = `${currentColChar}${r}`;
                                const value = getValueFromCell(cellRef);
                                if (typeof value === 'number') {
                                    currentSum += value;
                                }
                            }
                        }
                        values.push(currentSum);

                    } else {
                         // Fallback for complex ranges not covered by simple A-J logic
                         const cellValue = getValueFromCell(arg);
                         if (typeof cellValue === 'number') values.push(cellValue);
                    }
                } else {
                    // Individual cell reference: A1
                    const cellValue = getValueFromCell(arg);
                    if (typeof cellValue === 'number') values.push(cellValue);
                }
            }

            let sumResult = 0;
            values.forEach(v => {
                if (typeof v === 'number') {
                    sumResult += v;
                }
            });
            result = sumResult;

        } else {
            // --- 2. Handle Basic Arithmetic Expression (e.g., A1-B2) ---
            let expression = contentToEvaluate;
            
            // Replace cell references with their actual values for evaluation
            const cellRefRegex = /([A-Z]+\d+)/gi; 
            expression = expression.replace(cellRefRegex, (match) => {
                const value = getValueFromCell(match);
                return typeof value === 'number' ? value : match; // Keep non-numeric references as strings if calculation fails
            });

            // Use Function constructor for safe evaluation of mathematical expressions
            result = new Function('return ' + expression)();
        }

    } catch (e) {
        console.error("Calculation failed:", e);
        return null; // Calculation failed
    }
    
    if (typeof result === 'number') {
        // Update the cell content to display the calculated number, not the formula
        targetElement.innerText = result;
        return true; // Indicates successful calculation and update
    }

    return false; // No change or calculation failed/unsupported
}
