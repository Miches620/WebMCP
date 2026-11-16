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
    // Establecer el contenido de la celda basándose en lo que está en estado.
    if (estado.cells[key] !== undefined) {
        cell.textContent = estado.cells[key];
    } else {
        cell.textContent = '';
    }
  });
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

         // Opcional: Agregar un listener simple de click para que, si el estado está vacío, se muestre algo al hacer clic.
         cell.addEventListener('click', () => {
             if (estado.cells[cell.dataset.cell] === "") {
                 cell.textContent = ""; // Asegurar que esté visualmente limpio antes de editar
             } else {
                // Si ya hay contenido, lo render() se encargará. Esto solo sirve para asegurar la visibilidad al hacer click en una celda vacía.
             }
         });
    });
}

/**
 * El harness llamará a cargar(), y luego debe llamar a conectar() y render().
 */

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
