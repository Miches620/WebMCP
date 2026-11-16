// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = { 
    cells: {} // Key format: "ColumnLetter, RowNumber" (e.g., "A, 1")
};
const CLAVE = "app";

/**
 * Carga el estado desde localStorage.
 */
function cargar() { try { const s = localStorage.getItem(CLAVE); if (s) estado = JSON.parse(s); } catch (e) {} }

/**
 * Guarda el estado actual en localStorage.
 */
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {} }

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Extrae las coordenadas de una celda a partir de su atributo data-cell="(X, Y)".
 * @param {HTMLElement} element El elemento TD.
 * @returns {{col: string, row: number}|null} Las coordenadas o null si fallan.
 */
function obtenerCoordenadas(element) {
    const dataCell = element.getAttribute('data-cell');
    if (!dataCell) return null;

    // Regex para capturar Columna y Número de Fila (ej: A, 1)
    const match = dataCell.match(/(\([A-Z]\, [0-9]+\))/);
    if (!match) return null;

    // Limpiar paréntesis y obtener la cadena "Col, Row"
    const coordsString = match[1].replace(/[()]/g, ''); 
    
    // Dividir por coma (puede haber espacios extra)
    const parts = coordsString.split(',').map(p => p.trim());
    
    if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
        return null;
    }

    return { col: parts[0], row: parseInt(parts[1]) };
}


/**
 * Obtiene el valor de una celda dada su referencia (ej: "A1"). 
 * Intenta convertirlo a número si es posible, o devuelve 0.
 * @param {string} reference La referencia de la celda ("A1", "B3").
 * @returns {number|null} El valor numérico de la celda en el estado.
 */
function getCellValue(reference) {
    // Regex para capturar Columna (letras) y Número de Fila (dígitos). 
    const match = reference.match(/([A-Z]+)\s*(\d+)/i);
    if (!match) return null;

    let col = match[1].toUpperCase();
    let row = parseInt(match[2]); 
    
    // Key format: "Col, Row" (ej: "A, 1")
    const key = `${col}, ${row}`;

    const value = estado.cells[key];
    return typeof value === 'number' ? value : parseFloat(value) || null;
}

/**
 * Evalúa una fórmula de hoja de cálculo simple. Soporta SUMA y operaciones aritméticas básicas (+, -, *, /).
 * @param {string} formula La cadena de la fórmula (debe empezar con '=').
 * @returns {number|null} El resultado calculado o null si falla.
 */
function calcularFormula(formula) {
    let cleanFormula = formula.trim();
    if (!cleanFormula || !cleanFormula.startsWith('=')) return null;

    // Quitar el signo igual inicial para el procesamiento interno
    let content = cleanFormula.substring(1); 

    try {
        // 1. Manejar SUMA()
        const sumMatch = content.match(/^SUMA\((.*)\)$/i);
        if (sumMatch) {
            const argsString = sumMatch[1]; // Contenido dentro de los paréntesis
            
            // Separar argumentos por punto y coma o comas, e ignorar espacios en blanco
            let argumentsList = argsString.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0);

            if (argumentsList.length === 0) return null;

            let totalSum = 0;
            for (const arg of argumentsList) {
                // Verificar si el argumento es un rango o una celda suelta
                if (arg.includes(':')) {
                    // Manejo de rangos: A1:A3 -> se asume que la columna es la misma para todas las celdas del rango.
                    const parts = arg.split(':').map(p => p.trim()).filter(p => p);
                    if (parts.length === 2) {
                        const startRef = parts[0]; // Ej: A1
                        const endRef = parts[1];   // Ej: A3

                        const startMatch = startRef.match(/([A-Z]+)(\d+)/i);
                        const endMatch = endRef.match(/([A-Z]+)(\d+)/i);

                        if (startMatch && endMatch) {
                            const col = startMatch[1].toUpperCase();
                            const startRow = parseInt(startMatch[2]);
                            const endRow = parseInt(endMatch[2]);

                            for (let r = startRow; r <= endRow; r++) {
                                const value = getCellValue(`${col}${r}`);
                                if (value !== null) totalSum += value;
                            }
                        } else {
                             // Si el formato de rango es incorrecto, lo tratamos como celdas sueltas separadas por ':'
                             for(const ref of parts) {
                                 totalSum += getCellValue(ref);
                             }
                        }

                    } else { 
                        // Caso borde: múltiples rangos separados (no estándar pero posible)
                         for(const ref of arg.split(/[\s,;]/).filter(p => p.includes(':'))){
                              totalSum += getCellValue(ref);
                         }
                    }

                } else {
                    // Celda suelta simple: A1
                    const value = getCellValue(arg);
                    if (value !== null) totalSum += value;
                }
            }
            return totalSum;
        }

        // 2. Manejar Operaciones Aritméticas Básicas (+, -, *, /)
        let tempContent = content;
        
        // Reemplazamos referencias de celda (A1, B3) con sus valores numéricos entre paréntesis para que eval() funcione correctamente.
        tempContent = tempContent.replace(/([A-Z]+)\s*(\d+)/gi, (match, col, row) => {
            const value = getCellValue(`${col}${row}`);
            return value !== null ? `(${value})` : match;
        });

        // Evaluar la expresión matemática en el entorno del navegador.
        // Se asume que los paréntesis ya manejan precedencia.
        return eval(tempContent);

    } catch (e) {
        console.error("Error evaluating formula:", e);
        return null; 
    }
}


/**
 * Actualiza el estado interno de la celda basándose en su elemento DOM y nuevo valor.
 * Si el valor comienza con '=', intenta calcularlo primero.
 * @param {HTMLElement} element El elemento que ha cambiado.
 * @param {string} newValue El texto actual del elemento.
 * @returns {boolean} True si se pudo actualizar, False en caso contrario.
 */
function actualizarCeldaEstado(element, newValue) {
    const coords = obtenerCoordenadas(element);
    if (!coords) return false;

    // Formato de clave requerido: Columna, Espacio, Número (ej: "A, 1")
    const key = `${coords.col}, ${coords.row}`;
    let valueToStore = newValue;

    // Detectar si es una fórmula para calcular el resultado antes de guardarlo en estado.cells
    if (newValue && typeof newValue === 'string' && newValue.trim().startsWith('=')) {
        const calculatedValue = calcularFormula(newValue);
        if (calculatedValue !== null) {
            // Si la fórmula se calcula exitosamente, solo guardamos el resultado numérico/texto final.
            valueToStore = calculatedValue; 
        } else {
            // Si falla el cálculo, lo guardamos como texto para que el usuario pueda ver la fórmula y corregirla.
            valueToStore = newValue;
        }
    }

    // Actualizar estado con el valor final (calculado o ingresado)
    estado.cells[key] = valueToStore;
    return true;
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
  const bodyRows = document.querySelectorAll('#spreadsheet-grid tbody tr');

  bodyRows.forEach(row => {
      // Iteramos sobre todos los hijos de las filas (los TD). 
      // El primer hijo es el th.row-header, por lo que empezamos en índice 1.
      const rowCells = Array.from(row.children);
      for (let i = 1; i < rowCells.length; i++) {
          const cellElement = rowCells[i];
          if (!cellElement) continue;

          // Extraer la clave de coordenadas del atributo data-cell="(X, Y)"
          const dataCell = cellElement.getAttribute('data-cell');
          if (!dataCell) continue;

          const coordsMatch = dataCell.match(/(\([A-Z]\, [0-9]+\))/);
          if (!coordsMatch) continue;
          
          // Crear la clave de estado ("A, 1")
          const key = coordsMatch[1].replace(/[()]/g, ''); 

          // Obtener el valor del estado (o vacío si no existe)
          let cellValue = estado.cells[key] || '';

          // Si el valor almacenado es numérico o una fórmula que debería mostrarse como texto...
          if (typeof cellValue === 'number') {
              cellElement.textContent = cellValue;
          } else if (typeof cellValue === 'string' && cellValue.startsWith('=')) {
              // Si el valor guardado es la fórmula, lo procesamos para mostrar el resultado
             const calculatedResult = calcularFormula(cellValue);
             if (calculatedResult !== null) {
                 cellElement.textContent = calculatedResult;
             } else {
                 cellElement.textContent = cellValue; // Mostrar la fórmula si falla el cálculo
             }
          } else {
              // Valor normal o vacío
              cellElement.textContent = cellValue;
          }
      }
  });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const grid = document.getElementById('spreadsheet-grid');

    if (!grid) return;

    /**
     * Maneja el guardado de datos cuando el usuario deja de editar (focusout).
     */
    grid.addEventListener('focusout', function(event) {
        const target = event.target;
        // Solo procesar si es un TD editable
        if (!target || !target.hasAttribute('contenteditable') || !target.dataset.cell) return;

        // El valor que se está guardando en estado puede ser el texto literal o ya calculado, 
        // pero para actualizarCeldaEstado lo pasamos tal cual está visiblemente en el DOM.
        const newValue = target.textContent;
        
        // 1. LÓGICA: Actualizar el estado interno (Esto calcula si es necesario)
        actualizarCeldaEstado(target, newValue); 
        
        // 2. GUARDAR y DIBUJAR
        guardar();
        render();
    });

    /**
     * Maneja el guardado de datos cuando se presiona Enter dentro de una celda editable.
     */
    grid.addEventListener('keydown', function(event) {
        const target = event.target;

        // Solo procesar si es un TD editable y la tecla presionada fue Enter
        if (!target || !target.hasAttribute('contenteditable') || event.key !== 'Enter') return;

        // Prevenir el comportamiento por defecto del formulario (si lo hubiera)
        event.preventDefault(); 

        const newValue = target.textContent;

        // 1. LÓGICA: Actualizar el estado interno (Esto calcula si es necesario)
        actualizarCeldaEstado(target, newValue); 
        
        // 2. GUARDAR y DIBUJAR
        guardar();
        render();
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
