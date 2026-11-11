/**
 * Inicializa la funcionalidad de edición inline en todas las celdas de datos.
 * Aunque el atributo contenteditable está presente en el HTML, es buena práctica
 * añadir listeners para gestionar el foco y los cambios de manera programática,
 * preparando la estructura para futuras funcionalidades (como guardar o validar).
 */
function initializeCellEditing() {
    // Helper function to get value from a given coordinate (e.g., 'A1')
    const getValue = (coordinate) => {
        const cell = document.querySelector(`td[data-cell="${coordinate}"]`);
        if (!cell) return null;

        let text = cell.textContent.trim();
        // Attempt to parse as float if it looks like a number, otherwise use the string.
        return isNaN(parseFloat(text)) ? text : parseFloat(text);
    };

    // Helper function to calculate formulas based on Excel rules (SUMA, +, -, *, /)
    const evaluateFormula = (formulaString) => {
        try {
            let formula = formulaString.toUpperCase();
            if (!formula.startsWith('=')) return null;
            formula = formula.substring(1); // Remove '='

            // --- 1. SUMA Range (e.g., SUMA(A1:A3)) ---
            const sumMatch = formula.match(/SUMA\((.*)\)/);
            if (sumMatch) {
                let rangeString = sumMatch[1]; // e.g., A1:A3

                // Basic parsing for ranges assuming they are single column contiguous ranges (like A1:A3)
                const coords = rangeString.split(':').map(s => s.trim());
                if (coords.length !== 2 || !coords[0] || !coords[1]) return null;

                let startCoord = coords[0]; // e.g., A1
                let endCoord = coords[1];   // e.g., A3

                const startCol = startCoord[0].toUpperCase();
                const startRow = parseInt(startCoord.substring(1));
                const endRow = parseInt(endCoord.substring(1));

                if (!startCol || isNaN(startRow) || isNaN(endRow)) return null;

                let total = 0;
                for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
                    const cellValue = getValue(`${startCol}${r}`);
                    if (cellValue !== null && typeof cellValue === 'number') {
                        total += cellValue;
                    } else if (typeof cellValue === 'string' && !isNaN(parseFloat(cellValue))) {
                         // Handle case where text content might be a number string
                         total += parseFloat(cellValue);
                    }
                }
                return total;
            }

            // --- 2. Simple Operations (A1-B1, A1*B1, etc.) ---
            let expression = formula;

            // Replace coordinates with numeric values for evaluation
            expression = expression.replace(/([A-Z]+[0-9]+)/g, (match) => {
                const value = getValue(match);
                return typeof value === 'number' ? value : parseFloat(value) || 0; // Use number or default to 0
            });

            // Evaluate the resulting mathematical string expression
            if (!isNaN(parseFloat(expression))) {
                // Using Function constructor for safe evaluation of arithmetic expressions in this controlled scope.
                return new Function('return ' + expression)();
            }

        } catch (e) {
            console.error("Error evaluating formula:", e);
            return null;
        }
        return null; // Calculation failed or unsupported formula type
    };


    // Selecciona todas las celdas de datos que son editables.
    const dataCells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');

    dataCells.forEach(cell => {
        // Añadimos un listener 'blur' (cuando se pierde el foco) para simular la finalización de la edición y calcular fórmulas.
        cell.addEventListener('blur', function() {
            let content = this.textContent.trim();
            let calculatedValue = null;

            if (content.startsWith('=')) {
                // Intentar evaluar fórmula
                calculatedValue = evaluateFormula(content);

                // Si la evaluación fue exitosa y resultó en un número, actualizamos el contenido de la celda.
                if (typeof calculatedValue === 'number' && !isNaN(calculatedValue)) {
                    this.textContent = calculatedValue; // Mostrar resultado numérico
                } else {
                    // Si falla o no es una fórmula manejada, lo dejamos como texto original.
                    console.warn(`No se pudo calcular la fórmula en ${this.dataset.cell}: ${content}`);
                }

            } else {
                 // Limpiamos el contenido si era solo un valor numérico sin formato de celda
                 this.textContent = content;
            }
        });

        // Opcionalmente, un listener 'focus' para resaltar visualmente la celda al hacer clic (si se requiere).
        cell.addEventListener('focus', function() {
            this.classList.add('focused-cell'); // Asumiendo que styles.css tiene una clase .focused-cell
        });
    });

    // Listener global para limpiar el foco visual cuando se haga clic en cualquier parte del documento (fuera de las celdas).
    document.body.addEventListener('click', function(e) {
        if (!e.target.closest('[contenteditable="true"]')) {
            dataCells.forEach(c => c.classList.remove('focused-cell'));
        }
    });
}

// Función principal que arranca la aplicación
function startApp() {
    initializeCellEditing();
}

startApp();
