/**
 * R1. Maneja el evento de entrada (input) en cualquier celda editable.
 * Esto asegura que los cambios se manejen correctamente y permite futuras validaciones.
 * @param {Event} event El evento de cambio ocurrido en la celda.
 */
function handleCellInput(event) {
    const cell = event.target;
    // 1. Actualizar el valor de la celda que recibió el input (si es un número, lo mantenemos como texto para preservar fórmulas).
    console.log(`Celda ${cell.dataset.cell} actualizada con: "${cell.innerText}"`);

    // 2. Después de cualquier cambio, recalcular todas las celdas que contengan fórmulas.
    calculateAllFormulas();
}

/**
 * R1. Maneja el evento cuando la celda pierde el foco (blur).
 * Esto es útil para guardar el valor final o ejecutar validaciones al terminar de escribir.
 * @param {Event} event El evento de pérdida de foco.
 */
function handleCellBlur(event) {
    const cell = event.target;
    // Aquí se podría implementar lógica de guardado automático o validación final.
    console.log(`Celda ${cell.dataset.cell} perdió el foco. Valor final: "${cell.innerText}"`);
}

/**
 * Inicializa la funcionalidad de la hoja de cálculo, adjuntando los listeners necesarios.
 */
function initializeSpreadsheet() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) {
        console.error("No se encontró el elemento #spreadsheet.");
        return;
    }

    // Usamos delegación de eventos en la tabla principal para capturar cualquier cambio 
    // que ocurra dentro de las celdas (td).
    spreadsheet.addEventListener('input', handleCellInput);
    spreadsheet.addEventListener('blur', handleCellBlur);

    console.log("Spreadsheet App inicializada: Edición inline activa.");
}

/**
 * Recalcula el valor de todas las celdas que contienen fórmulas.
 */
function calculateAllFormulas() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    // Selecciona todas las celdas de datos (td) dentro del cuerpo de la hoja de cálculo.
    const cells = spreadsheet.querySelectorAll('tbody td');

    cells.forEach(cell => {
        let formulaText = cell.innerText.trim();

        // Solo procesamos si el contenido parece una fórmula y no es vacío.
        if (formulaText && typeof formulaText === 'string' && formulaText.startsWith('=')) {
            try {
                const calculatedValue = evaluateFormula(formulaText);
                
                // Actualizar el texto visible de la celda con el resultado calculado.
                cell.innerText = calculatedValue;

            } catch (e) {
                console.error(`Error evaluando fórmula en ${cell.dataset.cell}:`, e);
                // Si falla, dejamos la fórmula original visible o un mensaje de error.
                if (!cell.innerText.startsWith('=')) {
                     cell.innerText = "ERROR";
                }
            }
        }
    });
}

/**
 * Evalúa el contenido de una cadena que representa una fórmula de hoja de cálculo.
 * @param {string} formula La fórmula con signo '=' inicial.
 * @returns {number|string} El resultado calculado o un mensaje de error.
 */
function evaluateFormula(formula) {
    // Eliminar el signo '=' inicial para facilitar el parsing.
    let formulaString = formula.substring(1); 

    // --- Manejo de SUMA (Rango o Celdas Sueltas) ---
    if (formulaString.toUpperCase().startsWith('SUMA')) {
        const match = formulaString.match(/SUMA\(([^)]+)\)/i);
        if (!match) return "Sintaxis incorrecta";

        let argumentsList = match[1];
        
        // Determinar si es un rango (ej: A1:A3) o celdas sueltas (ej: A1;B2;C3)
        if (argumentsList.includes(':')) {
            const rangeString = argumentsList;
            
            let sum = 0;
            // Simple manejo de rango vertical en la misma columna
            const [startCellRef, endCellRef] = rangeString.split(':');
            
            if (startCellRef && endCellRef) {
                const startRow = parseInt(startCellRef.substring(1));
                const endRow = parseInt(endCellRef.substring(1));
                const colLetter = startCellRef.match(/[A-Z]+/)[0];

                for (let i = startRow; i <= endRow; i++) {
                    // Obtener el valor de la celda en esa columna y fila
                    const cellKey = `${colLetter}${i}`;
                    const cellElement = document.querySelector(`[data-cell="${cellKey}"]`);
                    if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                        sum += parseFloat(cellElement.innerText);
                    }
                }
                return sum;
            }

        } else if (argumentsList.includes(';')) {
            // Celdas sueltas: A1;B2;C3
            const refs = argumentsList.split(';');
            let sum = 0;
            refs.forEach(ref => {
                const cellElement = document.querySelector(`[data-cell="${ref.trim()}"]`);
                if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                    sum += parseFloat(cellElement.innerText);
                }
            });
            return sum;
        }
    }

    // --- Manejo de Operaciones Aritméticas Básicas (A1-B1, A1*B1, etc.) ---
    try {
        let expression = formulaString;

        // Expresión regular para encontrar patrones de referencia de celda (Ej: [A-Z]+[0-9]+)
        const cellRefRegex = /([A-Z]+\d+)/g; 
        expression = expression.replace(cellRefRegex, (match) => {
            // Buscar el elemento en la hoja de cálculo usando data-cell
            const cellElement = document.querySelector(`[data-cell="${match}"]`);
            if (cellElement && !isNaN(parseFloat(cellElement.innerText))) {
                return cellElement.innerText; // Devolver el valor numérico como string para eval()
            }
            // Si no se encuentra o no es un número, devolver '0' para evitar errores de sintaxis en eval().
            return '0'; 
        });

        // Evaluar la expresión matemática resultante (ej: "2-3")
        const result = Function(`return ${expression}`)();
        return result;

    } catch (e) {
        console.error("Error de evaluación:", e);
        return "#ERROR!";
    }
}


// Llamada principal para arrancar la aplicación
initializeSpreadsheet();
