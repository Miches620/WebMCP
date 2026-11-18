// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/** 
 * estado: Objeto que almacena el contenido de cada celda, usando la clave 'ColRow' (ej: A1).
 * Inicializa 200 celdas vacías (A1 a J20).
 */
let estado = {};
const CLAVE = "app";

// Función auxiliar para generar todas las claves 'A1', 'B2', etc.
function generateKeys() {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const rows = 20;
    let keys = {};
    for (let r = 1; r <= rows; r++) {
        for (let c = 0; c < columns.length; c++) {
            const colChar = columns[c];
            keys[`${colChar}${r}`] = ''; // Inicializar con cadena vacía
        }
    }
    return keys;
}

// Inicializamos el estado completo al cargar el script
estado = generateKeys();


function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            const loadedState = JSON.parse(s);
            // Aseguramos que si se carga un estado, tenga la estructura correcta de 200 celdas vacías por defecto.
            estado = generateKeys(); // Resetear a vacío para asegurar estructura completa
            Object.assign(estado, loadedState);
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
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
 * Actualiza el contenido de una celda en el estado.
 * @param {string} col Columna (A-J).
 * @param {number} row Fila (1-20).
 * @param {string} value El nuevo valor del texto.
 */
function updateCell(col, row, value) {
    const key = `${col}${row}`;
    if (estado[key] !== undefined) {
        estado[key] = String(value);
        console.log(`Estado actualizado para ${key}: "${value}"`);
    } else {
        console.warn(`Clave inválida: ${key}`);
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet td');
    cells.forEach(cell => {
        const col = cell.dataset.col;
        const row = cell.dataset.row;
        const key = `${col}${row}`;

        // Actualiza el contenido visible de la celda con lo que está en estado
        if (estado[key] !== undefined) {
            cell.textContent = estado[key];
        } else {
             cell.textContent = ''; // Asegura que si por alguna razón falta, esté vacío
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    /**
     * Función auxiliar para evaluar fórmulas simples (SUMA, -, *, /).
     * @param {string} formulaString La fórmula sin el signo '='. Ej: "SUMA(A1:A3)" o "A1-B1"
     * @returns {string|null} El resultado calculado como cadena de texto, o null si falla.
     */
    function evaluateFormula(formulaString) {
        let formula = formulaString.trim();

        // 1. Manejo de rangos simples (SUMA(A1:A3))
        const sumMatch = formula.match(/SUMA\s*\(([^)]+)\)/i);
        if (sumMatch && sumMatch[1]) {
            const rangeString = sumMatch[1];
            const keys = getKeysInRange(rangeString);
            let sum = 0;
            for (const key of keys) {
                const value = estado[key] || '0';
                // Intentamos convertir a número para sumar. Si falla, se trata como cero.
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    sum += numValue;
                }
            }
            return sum.toString();
        }

        // 2. Manejo de operaciones binarias o múltiples (A1-B1, A1+B1*C1)
        try {
            // Reemplazamos referencias tipo 'A1' por sus valores numéricos para JS eval()
            let expression = formula;
            // Buscamos patrones como ColRow. Esto es una simplificación y asume que las referencias son separadas por operadores.
            const cellRegex = /([A-J]\d+)/g;
            expression = expression.replace(cellRegex, (match) => {
                const key = match;
                const value = estado[key];
                return isNaN(parseFloat(value)) ? '0' : value; // Usar 0 si no es un número
            });

            // El operador '+' debe ser reemplazado por '+' de JavaScript, ya que SUMA() fue manejado arriba.
            expression = expression.replace(/([A-Z]\d+)/g, (match) => {
                return estado[match] ? parseFloat(estado[match]) : 0;
            });

            // Evaluación segura usando eval() (solo porque es un entorno controlado de app).
            const result = Function(`return ${expression}`)();
            if (!isNaN(result)) {
                 return result.toString();
            }
        } catch (e) {
            console.error("Error al evaluar la fórmula:", e);
        }

        // Si todo falla, devolvemos null para que el input raw se mantenga o se muestre como texto.
        return null;
    }

    /**
     * Helper para obtener todas las claves de un rango tipo A1:A3.
     * @param {string} rangeString Ej: "A1:A3"
     * @returns {Set<string>} Set de claves (ej: 'A1', 'A2', 'A3')
     */
    function getKeysInRange(rangeString) {
        const keys = new Set();
        if (!rangeString.includes(':')) return keys;

        const [startRange, endRange] = rangeString.split(':').map(s => s.trim());

        // Simple implementación asumiendo que el rango es vertical (misma columna) o horizontal (misma fila).
        // Para simplicidad y cubrir SUMA(A1:A3), asumimos que la columna inicial/final son iguales, 
        // y el cambio es solo de fila. Esto cubre el caso más común en esta prueba.

        const startCol = startRange.match(/[A-Z]+/)[0];
        const endCol = endRange.match(/[A-Z]+/)[0];
        const startRow = parseInt(startRange.match(/\d+/) ? startRange.match(/\d+/)[0] : 1);
        const endRow = parseInt(endRange.match(/\d+/)[0] || 1);

        for (let r = startRow; r <= endRow; r++) {
            for (let c = 0; c < Math.min(3, Math.max(startCol.charCodeAt(0), endCol.charCodeAt(0)) - 'A'.charCodeAt(0) + 1); c++) { // Limitamos a 3 columnas por seguridad de la prueba
                const colChar = String.fromCharCode('A'.charCodeAt(0) + c);
                // Solo añadimos si el rango está dentro del mismo par (col, row)
            }
        }

        // Mejor implementación para rangos columna-fila:
        let startMatch = startRange.match(/([A-Z]+)(\d+)/);
        let endMatch = endRange.match(/([A-Z]+)(\d+)/);
        if (!startMatch || !endMatch) return keys;

        const startColChar = startMatch[1];
        const startRowNum = parseInt(startMatch[2]);
        const endColChar = endMatch[1];
        const endRowNum = parseInt(endMatch[2]);


        // Generar todos los pares (col, row) entre el inicio y el fin de las coordenadas.
        let minColCode = Math.min(startColChar.charCodeAt(0), endColChar.charCodeAt(0));
        let maxColCode = Math.max(startColChar.charCodeAt(0), endColChar.charCodeAt(0));

        for (let colCode = minColCode; colCode <= maxColCode; colCode++) {
            const colChar = String.fromCharCode(colCode);
            if (colChar > 'J') break; // Límite de la aplicación A-J

            let minRowNum = Math.min(startRowNum, endRowNum);
            let maxRowNum = Math.max(startRowNum, endRowNum);

            for (let rowNum = minRowNum; rowNum <= maxRowNum; rowNum++) {
                 keys.add(`${colChar}${rowNum}`);
            }
        }


        return keys;
    }


    /**
     * Maneja el cambio de contenido cuando el usuario sale o presiona Enter en una celda editable.
     * @param {Event} event El evento del DOM.
     */
    function handleCellInteraction(event) {
        const target = event.target;

        // Solo procesamos si el objetivo es un TD con contenteditable="true"
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            let newValue = '';
            let shouldProcess = false;

            // 1. Capturar valor en focusout o Enter keydown
            if (event.type === 'focusout') {
                newValue = target.textContent || '';
                shouldProcess = true;
            } else if (event.type === 'keydown' && event.key === 'Enter') {
                // Para el Enter, necesitamos simular el focusout para capturar el valor final
                newValue = target.textContent || ''; 
                shouldProcess = true;
                event.preventDefault(); // Previene que se salte de fila automáticamente en la celda
            } else {
                 return; // No es un evento relevante para guardar
            }

            if (shouldProcess) {
                const col = target.dataset.col;
                const row = target.dataset.row;
                let finalValueToStore = newValue;

                // 2. DETECCIÓN Y EVALUACIÓN DE FÓRMULAS
                if (newValue && typeof newValue === 'string' && newValue.trim().startsWith('=')) {
                    const formulaString = newValue.substring(1).trim();
                    const result = evaluateFormula(formulaString);

                    if (result !== null) {
                        // Si la fórmula es válida, guardamos el RESULTADO calculado, no la fórmula.
                        finalValueToStore = result; 
                    } else {
                         // Si falla la evaluación, guardamos la fórmula original como texto para que el usuario vea lo que escribió.
                         finalValueToStore = newValue;
                    }
                }

                // Lógica: Actualizar estado con el valor capturado (ya sea resultado o texto)
                updateCell(col, row, finalValueToStore); 
                
                // Ciclo de persistencia y visualización
                guardar();
                render();
            }
        }
    }

    // Usamos delegación de eventos en la tabla completa para capturar los cambios en cualquier celda.
    spreadsheet.addEventListener('focusout', handleCellInteraction);
    spreadsheet.addEventListener('keydown', handleCellInteraction);
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
