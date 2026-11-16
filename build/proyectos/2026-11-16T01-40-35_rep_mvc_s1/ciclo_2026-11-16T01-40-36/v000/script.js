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
 * Actualiza el estado interno de la celda basándose en su elemento DOM y nuevo valor.
 * @param {HTMLElement} element El elemento que ha cambiado.
 * @param {string} newValue El texto actual del elemento.
 * @returns {boolean} True si se pudo actualizar, False en caso contrario.
 */
function actualizarCeldaEstado(element, newValue) {
    const coords = obtenerCoordenadas(element);
    if (!coords) return false;

    // Formato de clave requerido: Columna, Espacio, Número (ej: "A, 1")
    const key = `${coords.col}, ${coords.row}`;

    // Actualizar estado y retornar éxito
    estado.cells[key] = newValue;
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
          const cellValue = estado.cells[key] || '';

          // Actualizar el contenido visible del elemento DOM
          cellElement.textContent = cellValue;
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

        const newValue = target.textContent;
        
        // 1. LÓGICA: Actualizar el estado interno
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

        // 1. LÓGICA: Actualizar el estado interno
        actualizarCeldaEstado(target, newValue); 
        
        // 2. GUARDAR y DIBUJAR
        guardar();
        render();
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
