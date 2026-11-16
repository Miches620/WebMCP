// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";

/**
 * Obtiene el valor actual de una celda editable en el DOM.
 * @param {HTMLElement} target - El elemento <td> editado.
 * @returns {string} El contenido del texto.
 */
function getCellValue(target) {
    // Usamos textContent para obtener el valor limpio, incluso si hay formato invisible.
    return target.textContent.trim();
}

/**
 * Actualiza el estado global con el valor de la celda proporcionada.
 * @param {HTMLElement} cellElement - El elemento <td> que ha cambiado.
 */
function updateCellState(cellElement) {
    const key = cellElement.getAttribute('data-cell');
    if (key !== null) {
        estado[key] = getCellValue(cellElement);
    } else {
        console.warn("Celda sin data-cell detectada:", cellElement);
    }
}

function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) estado = JSON.parse(s); 
    } catch (e) {} 
}

function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
    } catch (e) {} 
}

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Tries to calculate a formula string based on the current state of the spreadsheet.
 * @param {string} formula - The formula string (ej: "=SUMA(A1:A3)").
 * @returns {string|number} El resultado calculado como string, o la fórmula original si no se pudo calcular.
 */
function calculateFormula(formula) {
    if (typeof formula !== 'string' || !formula.startsWith('=')) {
        return formula;
    }

    let content = formula.substring(1).trim();

    try {
        // Normalizamos separadores de listas en fórmulas: reemplazamos ';' por ',' para el parsing interno.
        content = content.replace(/;/g, ',');

        // Expresión regular para capturar funciones como SUMA(...) o expresiones matemáticas simples.
        const matchFunction = content.match(/^([A-Z]+)\((.*)\)/);

        if (matchFunction) {
            const funcName = matchFunction[1].toUpperCase();
            let argsString = matchFunction[2];

            if (funcName === 'SUMA') {
                return calculateSum(argsString);
            }
        } 

        return formula;

    } catch (e) {
        console.error("Error calculating formula:", e);
        return formula; // Devolver original si hay error
    }
}

/**
 * Calcula la suma de celdas referenciadas en una cadena de argumentos.
 * Soporta rangos (A1:A3) y listados de celdas (A1, B2).
 * @param {string} argsString - La cadena de argumentos dentro de la función (ej: "A1:A3").
 * @returns {number|string} El resultado numérico sumado o 0 si no hay datos válidos.
 */
function calculateSum(argsString) {
    let total = 0;

    // Regex para encontrar referencias de celda: (A1:B2 | A1)
    const cellRegex = /([A-Z]+[0-9]+)(?::[A-Z]+[0-9]+)?/g;
    let match;

    while ((match = cellRegex.exec(argsString)) !== null) {
        const reference = match[0];
        
        if (reference.includes(':')) {
            // Manejar rango A1:A3 
            const [startRef, endRef] = reference.split(':');
            
            let startCol = startRef[0];
            let startRow = parseInt(startRef.substring(1));
            let endCol = endRef[0];
            let endRow = parseInt(endRef.substring(1));

            // Solo sumamos si la columna es constante (ej: A1:A3)
            if (startCol === endCol && startCol !== '') { 
                for (let r = startRow; r <= endRow; r++) {
                    const key = `${startCol}${r}`;
                    const value = estado[key];
                    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                        total += parseFloat(value);
                    }
                }
            }
        } else {
            // Manejar celda individual A1
            const key = reference;
            const value = estado[key];
            if (typeof value === 'string' && !isNaN(parseFloat(value))) {
                total += parseFloat(value);
            }
        }
    }

    return total;
}


/**
 * Actualiza el estado global cuando un usuario termina de editar una celda.
 * @param {HTMLElement} cellElement - El elemento <td> que ha sido modificado.
 */
function handleCellUpdate(cellElement) {
    // 1. Update state with raw input first (puede ser la fórmula).
    updateCellState(cellElement);
    
    const key = cellElement.getAttribute('data-cell');
    let currentValue = estado[key];

    // 2. Detectar y calcular fórmulas si es necesario, actualizando el estado con el resultado numérico.
    if (typeof currentValue === 'string' && currentValue.trim().startsWith('=')) {
        const calculatedValue = calculateFormula(currentValue);
        
        // Si la fórmula se pudo calcular exitosamente y resultó en un valor numérico válido.
        if (typeof calculatedValue === 'number') {
             // Guardamos el resultado formateado como string, ya que este es el dato persistente.
            estado[key] = String(calculatedValue); 
        } else if (calculatedValue !== currentValue) {
             // Si no se detectó una fórmula o falló, mantenemos la lógica de estado normal.
             estado[key] = calculatedValue;
        }
    }
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet-container [contenteditable="true"]');

    cells.forEach(cell => {
        const key = cell.getAttribute('data-cell');
        if (estado[key] !== undefined) {
            // Solo actualizamos el contenido si el estado tiene un valor guardado.
            // Esto asegura que la vista refleje siempre 'estado'.
            cell.textContent = estado[key];
        } else if (key === null) {
             // Caso de seguridad por si falta data-cell o está vacío en estado.
             cell.textContent = '';
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const container = document.getElementById('spreadsheet-container');

    if (container) {
        // 1. Listener para cuando el usuario sale de una celda editable (focusout/blur).
        // Usamos event delegation sobre el contenedor principal para capturar eventos en cualquier celda hija.
        container.addEventListener('focusout', function(event) {
            const target = event.target;

            // Verificamos si el objetivo es una celda editable y si realmente perdimos el foco.
            if (target && target.hasAttribute('contenteditable') === true) {
                handleCellUpdate(target);
                guardar();
                render();
            }
        });

        // 2. Listener para Enter en celdas editable.
        container.addEventListener('keydown', function(event) {
            const target = event.target;

            if (target && target.hasAttribute('contenteditable') === true && event.key === 'Enter') {
                // Prevenimos el comportamiento por defecto del formulario/input que podría ser hacer scroll o saltar de fila.
                event.preventDefault(); 
                
                // El valor se actualiza con lo que está en la celda después de presionar Enter.
                handleCellUpdate(target);
                guardar();
                render();
            }
        });
    }
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
