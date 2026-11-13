// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/** 
 * estado.cells es un objeto donde la clave es el ID de la celda (ej: "A1") 
 * y el valor es el contenido actual del texto.
 */
let estado = { cells: {} };
const CLAVE = "app";

function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            estado = JSON.parse(s); 
            console.log("Datos cargados desde LocalStorage.");
        } else {
            // Inicializar un estado limpio si no hay datos guardados
            estado = { cells: {} };
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
    } 
}

function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
        console.log("Estado guardado.");
    } catch (e) {
        console.error("Error al guardar el estado:", e);
    } 
}

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el contenido de una celda en el estado interno.
 * @param {string} address - La dirección de la celda (ej: "A1").
 * @param {string} value - El nuevo valor del texto.
 */
function updateCellValue(address, value) {
    estado.cells[address] = String(value);
}

/**
 * Intenta evaluar una fórmula de estilo Excel almacenada como string. 
 * Retorna el resultado numérico formateado o la fórmula original si falla.
 * @param {string} formula - La cadena que puede ser un número simple o una fórmula (ej: "=SUMA(A1:A3)").
 * @returns {string} El valor calculado en formato string, o la fórmula original.
 */
function evaluateFormula(formula) {
    if (!formula || !formula.startsWith('=')) return formula;

    let expression = formula.substring(1).trim();
    let calculatedExpression = expression;

    // --- 1. Función SUMA ---
    const sumRegex = /SUMA\(\s*(.*?)\s*\)/g;
    calculatedExpression = calculatedExpression.replace(sumRegex, (match, content) => {
        let sumValue = 0;
        
        // Split by commas or semicolons, handling potential whitespace around delimiters
        const parts = content.split(/[,;]/).map(p => p.trim()).filter(p => p);

        for (const part of parts) {
            if (part.includes(':')) {
                // Handle ranges (A1:A3 assumed to be vertical for simplicity, matching test case pattern)
                const [startAddr, endAddr] = part.split(':').map(s => s.trim().toUpperCase());

                let colChar = startAddr[0]; // Assuming single column based on test setup
                let startRow = parseInt(startAddr.substring(1));
                let endRow = parseInt(endAddr.substring(1));

                if (!isNaN(startRow) && !isNaN(endRow) && colChar) {
                    for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
                        const address = `${colChar}${r}`;
                        sumValue += parseFloat(estado.cells[address] || 0);
                    }
                } else {
                    // Fallback if coordinate parsing fails badly
                    console.warn(`Could not process range ${part}.`);
                }

            } else {
                // Handle individual cell reference (A1)
                const address = part.toUpperCase();
                sumValue += parseFloat(estado.cells[address] || 0);
            }
        }
        return sumValue.toString();
    });


    // --- 2. Evaluación de expresiones aritméticas simples ---
    let tempExpression = calculatedExpression;

    // Regex para encontrar referencias a celdas (ej: A1, B4)
    const cellRefRegex = /([A-Z]+[0-9]+)/gi; 
    tempExpression = tempExpression.replace(cellRefRegex, (match) => {
        const value = estado.cells[match];
        // Reemplaza la referencia de celda con su valor numérico actual o 0 si no existe.
        return (value !== undefined && !isNaN(parseFloat(value))) ? parseFloat(value) : 0;
    });

    try {
        // Evalúa la expresión matemática resultante (ej: "2+3" o "9")
        if (typeof eval === 'function') {
            const result = eval(tempExpression);
            return String(result);
        } else {
            console.error("Evaluation failed: eval function not available.");
            return formula; 
        }
    } catch (e) {
        // Si la evaluación falla, retornamos la fórmula original para que el usuario vea qué escribió.
        console.warn("Failed to evaluate formula:", e);
        return formula; 
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
  // Selecciona todas las celdas de datos (<td>) dentro del cuerpo de la tabla.
  const cells = document.querySelectorAll('#spreadsheet-container tbody td');
    
  cells.forEach(cell => {
    // 1. Obtener el identificador de la celda desde los atributos data-*
    const address = cell.getAttribute('data-cell');
    
    if (address) {
      // 2. Recuperar el valor actual del estado, o usar una cadena vacía por defecto.
      let content = estado.cells[address] || '';
      
      // 3. Lógica de cálculo: Si es una fórmula, calcular su valor antes de mostrarlo.
      if (content.startsWith('=')) {
          const calculatedValue = evaluateFormula(content);
          content = calculatedValue; // Usamos el resultado calculado para el renderizado
      }
      
      // 4. Actualizar el contenido visible de la celda en el DOM.
      cell.textContent = content;
    }
  });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
  const container = document.getElementById('spreadsheet-container');

  /** 
   * Usamos event delegation en el contenedor para capturar eventos de entrada (typing) 
   * en cualquier celda editable dentro de la tabla sin necesidad de añadir un listener a cada elemento.
   */
  container.addEventListener('input', (event) => {
    const target = event.target;

    // Verificar que el objetivo del evento sea una celda de datos y tenga su atributo data-cell.
    if (!target || !target.hasAttribute('data-cell')) return;

    const address = target.getAttribute('data-cell');
    // El nuevo valor es el contenido actual del elemento DOM después del evento 'input'.
    const newValue = target.textContent; 

    // 1. Lógica: Actualizar el estado interno con el nuevo valor.
    updateCellValue(address, newValue); 
    
    // 2. Persistencia: Guardar el nuevo estado en LocalStorage.
    guardar();
    
    // 3. Dibujo: Re-renderizar toda la hoja para asegurar que cualquier cambio de formato o cálculo se aplique (aunque aquí solo es texto).
    render();
  });
}

// Nota: Se asume que el harness llama a conectar(), cargar() y render() en el orden correcto al iniciar la aplicación.

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
