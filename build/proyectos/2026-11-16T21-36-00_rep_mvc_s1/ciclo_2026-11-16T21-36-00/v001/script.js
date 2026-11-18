// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/**
 * estado almacena los contenidos de todas las celdas en formato clave_valor.
 * Clave: "COLumna_FILA" (Ej: A_1, J_20)
 * Valor: Contenido textual de la celda.
 */
let estado = {};
const CLAVE = "app";

/**
 * Carga el estado desde localStorage.
 */
function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) estado = JSON.parse(s); 
    } catch (e) {
        console.error("Error al cargar el estado:", e);
    }
}

/**
 * Guarda el estado actual en localStorage.
 */
function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
    } catch (e) {
        console.error("Error al guardar el estado:", e);
    } 
}

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el estado interno para una celda dada su coordenada y nuevo valor.
 * @param {string} col Columna (A-J)
 * @param {number} row Fila (1-20)
 * @param {string} value Nuevo contenido de la celda.
 */
function updateCell(col, row, value) {
    const key = `${col}_${row}`;
    // Solo actualizamos si el valor es diferente al que ya está guardado para evitar llamadas innecesarias a render/guard
    if (estado[key] !== String(value)) {
        estado[key] = String(value);
    }
}

/**
 * Obtiene las coordenadas de la celda activa.
 * @param {HTMLElement} element El elemento <td> que disparó el evento.
 * @returns {{col: string, row: number}|null} Objeto con columna y fila o null si no es una celda válida.
 */
function getCoordinatesFromElement(element) {
    const dataCell = element.getAttribute('data-cell');
    if (!dataCell) return null;

    // El formato en el HTML es (A, 1). Necesitamos parsearlo.
    const match = dataCell.match(/\(([^,]+),\s*(\d+)\)/);
    if (match && match[1] && match[2]) {
        return { col: match[1], row: parseInt(match[2], 10) };
    }
    return null;
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====

/**
 * Rellena todas las celdas de la tabla basándose en el estado actual.
 */
function render() {
    const rows = document.querySelectorAll('#spreadsheet-grid tbody tr');
    if (rows.length === 0) return;

    // Helper function to get numeric value of a cell reference from estado
    /**
     * @param {string} ref Ej: "A1", "J20"
     * @returns {number|null} Valor numérico o null si no se puede obtener.
     */
    function getValueFromState(ref) {
        const match = ref.match(/([A-Z]+)_(\d+)/);
        if (match) {
            const col = match[1];
            const row = parseInt(match[2], 10);
            const value = estado[`${col}_${row}`] || '';
            const numValue = parseFloat(value);
            return isNaN(numValue) ? null : numValue;
        }
        return null;
    }

    // Helper function to calculate the result of a formula string
    function calculateFormula(formulaString) {
        // 1. Handle SUMA(range) or SUMA(cell1; cell2...)
        const sumMatch = formulaString.match(/SUMA\((.*)\)/i);
        if (sumMatch) {
            const args = sumMatch[1].split(';').map(s => s.trim());
            let total = 0;
            for (const arg of args) {
                // Check for range format A1:A3 or single cell reference A1
                const rangeMatch = arg.match(/([A-Z]+)(\d+):?([A-Z]+)?(\d*)/i);
                if (!rangeMatch) continue;

                let tempSum = 0;
                let startColLetter = rangeMatch[1];
                let startRow = parseInt(rangeMatch[2], 10);
                let endColLetter = rangeMatch[3] ? rangeMatch[3].toUpperCase() : startColLetter;
                let endRow = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : startRow;

                // Determine the actual column bounds (A to J, max 10 columns)
                const colCodeStart = startColLetter.charCodeAt(0);
                const colCodeEnd = endColLetter.charCodeAt(0);


                for (let r = startRow; r <= endRow; r++) {
                    for (let cCode = colCodeStart; cCode <= colCodeEnd && cCode <= 'A'.charCodeAt(0) + 9; cCode++) {
                        const colLetter = String.fromCharCode(cCode);
                        const value = getValueFromState(`${colLetter}_${r}`);
                        if (typeof value === 'number') tempSum += value;
                    }
                }
                total += tempSum;
            }
            return total.toString();
        }

        // 2. Handle basic math operations (=A1-B1, etc.)
        let expression = formulaString.substring(1).replace(/([A-Z]+)_(\d+)/g, (match, col, row) => {
             const value = getValueFromState(`${col}_${row}`);
             return typeof value === 'number' ? value : 0; // Replace cell reference with its numeric value
        });

        try {
            // Use Function constructor for safe evaluation context
            const result = new Function(`return (${expression})`)();
            if (typeof result === 'number' && !isNaN(result)) {
                return result.toString();
            }
        } catch (e) {
            console.warn("Error evaluating formula:", e);
        }

        // If all fails, return the original string or an error indicator
        return "ERROR"; 
    }


    // Iteramos sobre todas las filas y columnas para asegurar que cada celda refleje 'estado'.
    for (let r = 1; r <= 20; r++) {
        const rowElement = document.querySelector(`[data-row="${r}"]`);
        if (!rowElement) continue;

        // Buscamos todas las celdas de la fila actual (desde A hasta J, que son los hijos directos del tbody tr)
        const cells = Array.from(rowElement.querySelectorAll('td'));

        for (let c = 0; c < 10; c++) {
            const cellElement = cells[c];
            // Obtenemos la columna de la celda actual (A, B, C...)
            const colCode = 'A'.charCodeAt(0) + c;
            const colLetter = String.fromCharCode(colCode);

            const key = `${colLetter}_${r}`;
            let valueToDisplay = estado[key] || '';
            
            // Actualiza el contenido visible de la celda
            if (valueToDisplay.startsWith('=')) {
                const result = calculateFormula(valueToDisplay);
                cellElement.textContent = result; 
            } else {
                cellElement.textContent = valueToDisplay; 
            }
        }
    }
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheetGrid = document.getElementById('spreadsheet-grid');

    if (!spreadsheetGrid) return;

    /**
     * Maneja el cambio de contenido al perder foco (blur) o presionar Enter.
     * @param {Event} event El evento que disparó la acción (focusout/keydown).
     */
    function handleCellChange(event) {
        const target = event.target;

        // 1. Determinar coordenadas y valor
        const coords = getCoordinatesFromElement(target);
        if (!coords) return;

        let newValue = '';
        
        // Si es un blur o Enter, el valor está en innerText (o value si fuera input).
        if (event.type === 'blur') {
            newValue = target.textContent;
        } else if (event.type === 'keydown' && event.key === 'Enter') {
             // El evento de keydown ocurre antes del blur, pero el valor final es lo que queda en el DOM
             // Simplemente capturamos el contenido actual del elemento editable.
            newValue = target.textContent; 
        }

        if (newValue !== undefined) {
            const col = coords.col;
            const row = coords.row;
            
            // 2. Lógica: Actualizar estado
            updateCell(col, row, newValue);
            
            // 3. Guardar y Renderizar
            guardar();
            render();
        }
    }

    // Escuchamos en el contenedor principal (spreadsheet-grid) para capturar eventos de los hijos contenteditable.
    spreadsheetGrid.addEventListener('blur', handleCellChange);
    spreadsheetGrid.addEventListener('keydown', function(event) {
        const target = event.target;
        if (target.hasAttribute('contenteditable') && target.textContent !== undefined) {
            // Solo procesar si se presionó Enter, que implica finalización de la edición
            if (event.key === 'Enter') {
                handleCellChange(event);
                // Prevenir el comportamiento por defecto del formulario/input al presionar enter
                event.preventDefault(); 
            }
        }
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
