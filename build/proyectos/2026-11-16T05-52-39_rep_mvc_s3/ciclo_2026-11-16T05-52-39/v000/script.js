// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/** 
 * estado: Objeto donde las claves son las coordenadas "ColFila" (ej: A1, J20) y los valores son el contenido del texto.
 */
let estado = {};

// Definición de dimensiones para inicialización
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const ROWS = Array.from({ length: 20 }, (_, i) => (i + 1).toString()); // De "1" a "20"

// Inicializar el estado con todas las celdas vacías
for (const col of COLS) {
    for (const row of ROWS) {
        estado[`${col}${row}`] = "";
    }
}

const CLAVE = "app";

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
 * Actualiza el estado global con el contenido de una celda específica, guardando inmediatamente.
 * @param {HTMLElement} cellElement - El elemento DOM que fue editado.
 * @param {string} value - El nuevo valor del texto.
 */
function setCellValue(cellElement, value) {
    const col = cellElement.dataset.col;
    const row = cellElement.dataset.row;
    const key = `${col}${row}`;

    if (col && row) {
        estado[key] = value;
        guardar();
        // Después de cambiar el estado, siempre debemos renderizar para reflejar los cambios.
        render(); 
    }
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('.editable[contenteditable="true"]');

    cells.forEach(cell => {
        const col = cell.dataset.col;
        const row = cell.dataset.row;
        const key = `${col}${row}`;
        
        // Obtener el valor de estado o usar vacío si no existe (aunque debería existir por la inicialización)
        const value = estado[key] !== undefined ? estado[key] : "";

        // Actualizar el contenido visible del elemento DOM.
        cell.textContent = value;
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const cellGrid = document.getElementById('cell-grid');

    if (!cellGrid) return;

    /** 
     * Maneja el guardado de contenido cuando el usuario termina de editar (focusout). 
     * Se usa delegación de eventos en el contenedor principal (#cell-grid).
     */
    cellGrid.addEventListener('focusout', function(e) {
        if (e.target.classList.contains('editable')) {
            const target = e.target;
            // El contenido que se guarda es lo que está visible en el DOM al perder foco.
            const newValue = target.textContent; 
            
            setCellValue(target, newValue);
        }
    });

    /** 
     * Maneja el guardado de contenido cuando se presiona Enter (keydown).
     */
    cellGrid.addEventListener('keydown', function(e) {
        if (e.target.classList.contains('editable')) {
            // Detectar la tecla Enter
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevenir el comportamiento por defecto del formulario/cursor
                const target = e.target;
                const newValue = target.textContent; 

                setCellValue(target, newValue);
            }
        }
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
