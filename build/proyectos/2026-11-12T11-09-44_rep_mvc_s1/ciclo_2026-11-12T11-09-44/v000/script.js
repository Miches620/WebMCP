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

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
  // Selecciona todas las celdas de datos (<td>) dentro del cuerpo de la tabla.
  const cells = document.querySelectorAll('#spreadsheet-container tbody td');
    
  cells.forEach(cell => {
    // 1. Obtener el identificador de la celda desde los atributos data-*
    const address = cell.getAttribute('data-cell');
    
    if (address) {
      // 2. Recuperar el valor actual del estado, o usar una cadena vacía por defecto.
      const content = estado.cells[address] || '';
      
      // 3. Actualizar el contenido visible de la celda en el DOM.
      // Usamos textContent para evitar problemas si se insertan tags HTML.
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
