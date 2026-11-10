/**
 * Obtiene el valor numérico de una celda específica en la hoja de cálculo.
 * @param {string} col Columna (A, B, etc.)
 * @param {number} row Número de fila (1-20)
 * @returns {number} El valor numérico o 0 si no es un número válido.
 */
function getNumericValue(col, row) {
    const selector = `[data-col="${col}"][data-row="${row}"]`;
    const targetCell = document.querySelector(`#spreadsheet-body ${selector}`);

    if (!targetCell) {
        console.warn(`Celda no encontrada: ${col}${row}`);
        return 0;
    }

    let value = targetCell.textContent.trim();

    // Si el contenido es una fórmula, ya debería haber sido calculado y mostrado como número.
    if (value.startsWith('=')) {
        try {
            // Intentamos evaluar fórmulas simples de JavaScript para obtener el valor numérico
            return eval(value); 
        } catch (e) {
            console.error(`Error al evaluar fórmula ${col}${row}:`, e);
            return NaN;
        }
    }

    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

/**
 * Evalúa una fórmula de hoja de cálculo simple (SUMA, +, -, *, /).
 * @param {string} formula La cadena de la fórmula (ej: "=SUMA(A1:A3)")
 * @returns {number|string} El resultado calculado o el texto original si falla.
 */
function evaluateFormula(formula) {
    let cleanFormula = formula.toUpperCase().trim();

    // 1. Manejo de SUMA(RANGO)
    const sumMatch = cleanFormula.match(/^=SUMA\(([^)]+)\)$/);
    if (sumMatch && sumMatch[1]) {
        const rangeString = sumMatch[1]; // Ej: A1:A3

        // Extraer coordenadas de inicio y fin
        const startCoordMatch = rangeString.match(/([A-Z]+)(\d+)/);
        const endCoordMatch = rangeString.match(/([A-Z]+)(\d+)$/);

        if (startCoordMatch && endCoordMatch) {
            const startCol = startCoordMatch[1];
            const startRow = parseInt(startCoordMatch[2]);
            const endCol = endCoordMatch[1];
            const endRow = parseInt(endCoordMatch[2]);

            let sum = 0;

            // Iterar sobre el rango (simplificado para rangos verticales como A1:A3)
            if (startCol === endCol && startRow <= endRow) { 
                for (let r = startRow; r <= endRow; r++) {
                    sum += getNumericValue(startCol, r);
                }
            } else if (startCol !== endCol && startRow === endRow) { // Rango horizontal A1:J1
                 const colChars = [];
                 for (let i = 0; i < 10; i++) {
                     colChars.push(String.fromCharCode('A'.charCodeAt(0) + i));
                 }

                 // Encontrar el índice de la columna inicial y final
                 const startIndex = colChars.indexOf(startCol);
                 const endIndex = colChars.indexOf(endCol);

                 if (startIndex !== -1 && endIndex !== -1) {
                     for (let c = startIndex; c <= endIndex; c++) {
                         sum += getNumericValue(colChars[c], startRow);
                     }
                 }
            } else if (startCol === endCol && startRow === endRow) {
                // Caso de celda única, no debería pasar con SUMA pero por seguridad.
                return getNumericValue(startCol, startRow);
            }

            return sum;
        }
    }

    // 2. Manejo de operaciones básicas (A1-B1, A1*B1, etc.)
    try {
        let expression = cleanFormula;
        const cellRegex = /([A-Z]+)(\d+)/g; // Captura A1, B2, etc.

        expression = expression.replace(cellRegex, (match, col, row) => {
            return getNumericValue(col, parseInt(row));
        });

        // Evaluar la expresión matemática resultante de JavaScript
        const result = eval(expression);
        if (!isNaN(result)) {
             return result;
        }
    } catch (e) {
        console.error("Error al evaluar fórmula:", e);
    }


    // Si nada funciona, devolver el valor original o un mensaje de error
    return formula; 
}

/**
 * R1. Configura la edición inline para todas las celdas de la hoja de cálculo.
 * Utiliza delegación de eventos en el tbody para manejar los cambios de contenido
 * en cualquier celda editable (<td>).
 */
function setupCellEditing() {
    const spreadsheetBody = document.getElementById('spreadsheet-body');

    if (!spreadsheetBody) {
        console.error("Error: No se encontró el cuerpo de la hoja de cálculo con id 'spreadsheet-body'.");
        return;
    }

    // Usamos event delegation para escuchar cambios en cualquier <td> dentro del tbody.
    spreadsheetBody.addEventListener('input', function(event) {
        const target = event.target;

        // Verificamos si el elemento que disparó el evento es una celda de datos editable.
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            const col = target.getAttribute('data-col');
            const row = target.getAttribute('data-row');
            let rawValue = target.textContent;

            // 1. Si el contenido comienza con '=', asumimos que es una fórmula y la calculamos.
            if (rawValue && typeof rawValue === 'string' && rawValue.trim().startsWith('=')) {
                try {
                    const calculatedValue = evaluateFormula(rawValue);
                    
                    // Actualizamos el texto de la celda con el resultado numérico, no la fórmula.
                    target.textContent = calculatedValue; 
                } catch (e) {
                    console.error("Error al calcular la fórmula:", e);
                    // Si falla el cálculo, mantenemos el valor original para que el usuario lo vea.
                }
            } else {
                 // Si es solo texto o número, simplemente dejamos el contenido como está.
            }
        }
    });

    // Opcional: Manejar el evento de foco para asegurar que la experiencia sea fluida al hacer clic.
    spreadsheetBody.addEventListener('focusin', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            // Esto simplemente asegura que el foco está en la celda correcta, lo cual es nativo, 
            // pero ayuda a confirmar la funcionalidad de edición.
            console.log(`Foco puesto en ${target.getAttribute('data-col')}${target.getAttribute('data-row')}. Listo para editar.`);
        }
    });
}

/**
 * Función principal que inicializa todas las funcionalidades de la hoja de cálculo.
 */
function initializeSpreadsheet() {
    // 1. Configurar la edición inline (R1)
    setupCellEditing();

    // Nota: La estructura de encabezados (A-J y 1-20) ya está definida en index.html,
    // por lo que solo necesitamos inicializar los eventos.
}


// Llamada única para arrancar la aplicación cuando el script se carga.
initializeSpreadsheet();
