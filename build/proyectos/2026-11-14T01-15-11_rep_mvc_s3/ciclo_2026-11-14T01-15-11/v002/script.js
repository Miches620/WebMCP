// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = { 
    cells: {} // Key format: "ColLetterRowNumber" (e.g., A1, J20)
};
const CLAVE = "app";

/**
 * Carga el estado persistido desde localStorage al inicio.
 */
function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            estado = JSON.parse(s);
        } else {
             // Inicializar todas las celdas si no hay nada guardado, para asegurar la estructura
            const allCells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');
            allCells.forEach(cell => {
                const key = cell.dataset.cell;
                if (!estado.cells[key]) {
                    estado.cells[key] = '';
                }
            });
        }
    } catch (e) { 
        console.error("Error al cargar el estado:", e); 
        // Si hay un error, mantenemos el estado vacío y permitimos que la app funcione sin datos previos.
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
 * Actualiza el estado interno de una celda específica.
 * @param {string} key - La clave de la celda (ej: "A1").
 * @param {string} value - El nuevo contenido del texto.
 */
function updateCellState(key, value) {
    if (!estado.cells[key] || estado.cells[key] !== value) {
        estado.cells[key] = value;
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
  const allCells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');
  allCells.forEach(cell => {
    const key = cell.dataset.cell;
    let rawValue = estado.cells[key] !== undefined ? estado.cells[key] : '';

    // CALCULAR: Aplicar la lógica de fórmula antes de mostrar el texto.
    const displayValue = calculateValue(rawValue);

    // Establecer el contenido de la celda basándose en lo que se debe mostrar (calculado o raw).
    cell.textContent = displayValue;
  });
}

/**
 * Evalúa una fórmula estilo Excel si es detectada en la cadena de texto.
 * @param {string} formulaString - El contenido raw de la celda, ej: "=SUMA(A1:A3)" o "2+3".
 * @returns {number|string} El valor calculado como número, o el string original si no es una fórmula.
 */
function calculateValue(formulaString) {
    if (typeof formulaString !== 'string' || !formulaString.startsWith('=')) {
        return formulaString;
    }

    let formula = formulaString.substring(1).trim(); // Quitar el '=' inicial

    // 1. Evaluación de funciones: SUMA(...)
    const sumRegex = /SUMA\(([^)]+)\)/i;
    if (formula.match(sumRegex)) {
        let content = formula.match(sumRegex)[1];
        return calculateSumRange(content);
    }

    // 2. Evaluación de rangos simples (Ej: A1-B1, A1*B1)
    try {
        // Reemplazamos referencias tipo 'A1' por su valor numérico real en el estado.
        let processedFormula = formula.replace(/([A-Z]\d+)/g, (match) => {
            const key = match;
            const value = parseFloat(estado.cells[key]);
            return isNaN(value) ? '0' : value; // Usamos '0' para evitar errores de eval si la celda no existe o es texto.
        });

        // Si después del reemplazo, el string restante solo contiene números y operadores matemáticos básicos, lo evaluamos.
        if (!isNaN(parseFloat(processedFormula))) {
             // Evaluar usando Function constructor (más seguro que eval() en este contexto controlado)
            const result = new Function('return ' + processedFormula);
            return parseFloat(result());
        }

    } catch (e) {
        console.warn("Error al evaluar la fórmula:", e);
        // Si falla la evaluación, devolvemos el string original para que se muestre la fórmula.
        return formulaString;
    }

    // 3. Caso por defecto: si no coincide con patrones conocidos, devolver la cadena original.
    return formulaString;
}


/**
 * Calcula la suma de celdas dentro de un rango (ej: A1:A3 o A1;B2;C3).
 * @param {string} rangeContent - El contenido del argumento de SUMA (Ej: "A1:A3" o "A1;B2;C3").
 * @returns {number} La suma total.
 */
function calculateSumRange(rangeContent) {
    const keys = [];

    // Separar celdas sueltas (separadas por ;) o rangos (A1:A3)
    let parts = rangeContent.split(/;\s*|\s+/g).filter(p => p); // Divide por ; o espacios en blanco
    
    for (const part of parts) {
        if (part.includes(':')) {
            // Es un rango A1:A3
            let [startKey, endKey] = part.split(':');
            
            // Simplificación de recorrido de rangos para el contexto del ejercicio:
            // Asumimos que los rangos son pequeños y manejables por la estructura actual (ColLetterRowNumber).
            const startCol = getColumnLetter(startKey);
            const startRow = parseInt(startKey.substring(startCol.length));
            const endCol = getColumnLetter(endKey);
            const endRow = parseInt(endKey.substring(endCol.length));

            // Recorrer desde la columna inicial hasta final, y de fila inicial hasta final.
            for (let i = 0; i < startCol.length && i <= endCol.length && startCol[i] <= endCol[i]; i++) {
                const colLetter = String.fromCharCode(startCol.charCodeAt(i) + (endCol.charCodeAt(i) - startCol.charCodeAt(i)));
                for (let j = startRow; j <= endRow; j++) {
                    keys.push(`${colLetter}${j}`);
                }
            }


        } else {
             // Es una celda suelta (A1, B2)
            const key = part;
            if (estado.cells[key] !== undefined) {
                 keys.push(key);
            }
        }
    }
    
    let totalSum = 0;
    for (const key of keys) {
        const value = parseFloat(estado.cells[key]);
        if (!isNaN(value)) {
            totalSum += value;
        }
    }
    return totalSum;
}

/**
 * Función auxiliar para obtener la letra de columna de una clave (ej: "A1" -> "A").
 */
function getColumnLetter(key) {
    // Asume que el formato es siempre [LETRA][NÚMERO]
    const match = key.match(/^([A-Z]+)([0-9]+)$/);
    return match ? match[1] : '';
}


// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    // Función manejadora de cambios (focusout o Enter)
    const handleCellChange = (event) => {
        let cellElement = event.target;
        if (!cellElement || !cellElement.dataset.cell) return;

        const key = cellElement.dataset.cell;
        // Obtener el contenido actual del elemento editable
        let newValue = cellElement.textContent; 

        // 1. Actualizar Lógica (Estado)
        updateCellState(key, newValue);
        
        // 2. Guardar y Redibujar
        guardar();
        render();
    };

    // Seleccionar todas las celdas de datos para adjuntar los listeners necesarios
    const editableCells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');

    editableCells.forEach(cell => {
        // 1. Manejar salida de foco (focusout)
        // Usamos focusout porque el blur no burbujea y es lo más cercano a perder el foco en un evento manejable.
        cell.addEventListener('focusout', handleCellChange);

        // 2. Manejar la tecla Enter (keydown)
        cell.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                // Prevenir el comportamiento por defecto (que podría añadir un salto de línea o enviar un formulario)
                event.preventDefault();
                
                // Simular la pérdida de foco para disparar la lógica de guardado
                handleCellChange(event); 
            }
        });

         // Listener simple de click para asegurar limpieza visual al empezar a editar una celda vacía
         cell.addEventListener('click', () => {
             if (estado.cells[cell.dataset.cell] === "") {
                 cell.textContent = ""; // Asegurar que esté visualmente limpio antes de editar
             } else {
                // Si ya hay contenido, lo render() se encargará. Esto solo sirve para asegurar la visibilidad al hacer click en una celda vacía.
             }
         });
    });

    // --- NUEVA LÓGICA: Manejo de Selección de Fila (Row Headers) ---

    const rowHeaders = document.querySelectorAll('.row-header');
    if (rowHeaders.length > 0) {
        rowHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                let rowNumber = e.currentTarget.dataset.row;
                if (!rowNumber) return;

                // Deseleccionar cualquier fila previamente seleccionada
                document.querySelectorAll('.row-header').forEach(h => h.classList.remove('selected'));
                
                // Seleccionar la fila actual y actualizar el estado interno
                e.currentTarget.classList.add('selected');
                estado.selectedRow = parseInt(rowNumber);

            });
        });
    }

    // --- NUEVA LÓGICA: Manejo de Teclas Global (Delete/Supr) para la fila seleccionada ---
    document.addEventListener('keydown', (e) => {
        if (!estado.selectedRow) return; // Solo actuar si hay una fila seleccionada

        // La tecla Supr en muchos entornos se mapea a 'Delete'
        if (e.key === 'Delete') { 
            e.preventDefault(); 

            const row = estado.selectedRow;
            let cellsClearedCount = 0;

            // Iterar sobre todas las celdas de la fila seleccionada (A hasta J)
            for (let i = 0; i < 10; i++) { 
                const colLetter = String.fromCharCode('A'.charCodeAt(0) + i);
                const key = `${colLetter}${row}`;
                
                // 1. Actualizar Lógica (Estado): Vaciar la celda en el estado
                if (estado.cells[key] !== undefined) {
                    updateCellState(key, "");
                    cellsClearedCount++;

                    // 2. Actualizar Visualmente: Limpiar el contenido inmediatamente para feedback instantáneo
                    const cellElement = document.querySelector(`td[data-cell="${key}"]`);
                    if (cellElement) {
                        cellElement.textContent = "";
                    }
                }
            }
            
            // 3. Guardar y Redibujar el estado global para asegurar que los cálculos se actualicen correctamente
            guardar();
            render();
        }
    });
}

/**
 * El harness llamará a cargar(), y luego debe llamar a conectar() y render().
 */

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
