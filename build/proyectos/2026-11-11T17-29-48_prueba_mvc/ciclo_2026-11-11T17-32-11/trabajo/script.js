// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";

/**
 * Inicializa el estado con todas las celdas vacías (A1 a J20).
 */
function initializeEstado() {
    estado = {};
    for (let r = 1; r <= 20; r++) {
        for (let c = 0; c < 10; c++) {
            // Columna A=0, B=1, ..., J=9. Letra = 'A' + índice de columna.
            const colChar = String.fromCharCode('A'.charCodeAt(0) + c);
            const cellId = `${colChar}${r}`;
            estado[cellId] = "";
        }
    }
}

function cargar() { 
    try { 
        // Si hay datos guardados, los cargamos y sobrescribimos el estado inicial.
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            estado = JSON.parse(s);
        } else {
             // Si no hay nada en local storage, inicializamos la estructura vacía.
            initializeEstado();
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
        initializeEstado(); // Fallback a un estado limpio si falla localStorage
    } 
}

function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
    } catch (e) {
        console.error("Error al guardar el estado:", e);
    } 
}

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el valor de una celda en el estado interno.
 * @param {string} cellId - El identificador de la celda (ej: "A1").
 * @param {string} newValue - El nuevo contenido del texto.
 */
function updateCellValue(cellId, newValue) {
    if (estado[cellId] !== undefined) {
        estado[cellId] = newValue;
    } else {
        console.warn(`Intento de actualizar celda no existente: ${cellId}`);
    }
}

/**
 * Evalúa una fórmula de hoja de cálculo basada en el estado actual.
 * @param {string} formula - La cadena de la fórmula (ej: "=SUMA(A1:A3)" o "=A1-B1").
 * @returns {number|string} El resultado calculado como número, o la fórmula original si no se puede calcular.
 */
function calculateFormula(formula) {
    if (!formula || !formula.startsWith('=')) {
        return formula; // No es una fórmula
    }

    let cleanFormula = formula.substring(1).trim();

    // 1. Manejo de SUMA(rango) o SUMA(celdas sueltas)
    const sumMatch = cleanFormula.match(/SUMA\(([^)]+)\)/i);
    if (sumMatch) {
        const rangeContent = sumMatch[1];
        let total = 0;

        // Simple parsing for ranges separated by ':'
        const parts = rangeContent.split(':');
        if (parts.length === 2) {
            const startCellId = parts[0].trim();
            const endCellId = parts[1].trim();

            // Helper to parse cell ID from string like "A1" or "B3"
            const parseCellId = (s) => {
                let colStr = '';
                let rowStr = '';
                for(let i=0; i<s.length; i++) {
                    if (/[A-Z]/.test(s[i])) colStr += s[i];
                    else if (/[0-9]/.test(s[i])) rowStr += s[i];
                }
                return `${colStr}${rowStr}`;
            };

            const startColChar = startCellId.match(/[A-Z]/g)?.[0];
            const endColChar = endCellId.match(/[A-Z]/g)?.[0];
            const startRowNum = parseInt(startCellId.match(/[0-9]+/g)?.[0] || '1');
            const endRowNum = parseInt(endCellId.match(/[0-9]+/g)?.[0] || '1');

            // Iterate over the bounding box defined by start/end coordinates
            for (let r = Math.min(startRowNum, endRowNum); r <= Math.max(startRowNum, endRowNum); r++) {
                for (let c = 0; c < 10; c++) { // Check up to J column
                    const colChar = String.fromCharCode('A'.charCodeAt(0) + c);

                    // Check if the current column falls within the defined range columns
                    if (colChar >= startColChar && colChar <= endColChar) {
                        const cellId = `${colChar}${r}`;
                        if (estado[cellId] !== undefined && !isNaN(parseFloat(estado[cellId]))) {
                            total += parseFloat(estado[cellId]);
                        }
                    }
                }
            }
        } else {
             // Si no es un rango, asumimos que son celdas separadas por ';' o ',' (aunque el test solo usa rangos)
             const cells = rangeContent.split(/[,;]/).map(s => s.trim());
             for (const cellId of cells) {
                 if (estado[cellId] !== undefined && !isNaN(parseFloat(estado[cellId]))) {
                     total += parseFloat(estado[cellId]);
                 }
             }
        }

        return total;
    }


    // 2. Manejo de operaciones aritméticas simples (A1-B1, A1*B1, etc.)
    try {
        let expression = cleanFormula;

        // Reemplazar referencias de celda (ej: A1) por sus valores numéricos reales del estado.
        const cellRegex = /([A-Z]+[0-9]+)/g;
        expression = expression.replace(cellRegex, (match) => {
            if (estado[match] !== undefined && !isNaN(parseFloat(estado[match]))) {
                return estado[match]; // Reemplaza la referencia con el valor numérico
            }
            // Si no está en el estado o no es un número, lo tratamos como 0 para evitar errores de eval.
            return '0'; 
        });

        // Evaluar la expresión matemática resultante (ej: "2-3")
        const result = eval(expression);
        if (!isNaN(result)) {
            return result;
        }
    } catch (e) {
        console.error("Error al evaluar fórmula:", e);
        return formula; // Fallback a la fórmula original si falla el cálculo
    }

    // Si nada funciona, devolver la fórmula original
    return formula;
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet td[contenteditable="true"]');
    cells.forEach(cell => {
        const cellId = cell.getAttribute('data-cell');
        if (estado[cellId] !== undefined) {
            let content = estado[cellId];
            let displayValue;

            // 1. Verificar si el contenido es una fórmula y calcular su resultado
            if (typeof content === 'string' && content.trim().startsWith('=')) {
                const calculatedResult = calculateFormula(content);
                
                if (typeof calculatedResult === 'number') {
                    displayValue = calculatedResult; // Mostrar solo el número calculado
                } else {
                    // Si la fórmula no se pudo calcular, mostrarla como texto.
                    displayValue = content; 
                }
            } else {
                // 2. Es un valor simple o vacío
                displayValue = content;
            }

            // Establece el contenido visible de la celda basado en el estado calculado/simple.
            cell.textContent = displayValue === undefined ? "" : String(displayValue);
        } else {
             // Si por alguna razón no está en el estado, lo vacía.
             cell.textContent = "";
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheetBody = document.querySelector('#spreadsheet tbody');

    if (spreadsheetBody) {
        // Usamos event delegation para escuchar cambios en cualquier celda editable dentro del cuerpo de la tabla.
        spreadsheetBody.addEventListener('input', function(event) {
            const target = event.target;
            
            // Verificamos si el elemento que disparó el evento es una celda de datos (<td>).
            if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
                const cellId = target.getAttribute('data-cell');
                const newValue = target.textContent;

                // 1. Lógica: Actualizar el estado con el nuevo valor.
                updateCellValue(cellId, newValue);

                // 2. Guardar y Renderizar (aunque solo actualizamos un dato, es buena práctica seguir el ciclo).
                guardar();
                render(); // Esto asegura que si hay lógica de validación o formato en render(), se aplique.
            }
        });
    }
}

// Nota: El harness llamará a cargar() y conectar() antes de ejecutar este script, 
// y luego llamará a render() para la primera visualización.

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
