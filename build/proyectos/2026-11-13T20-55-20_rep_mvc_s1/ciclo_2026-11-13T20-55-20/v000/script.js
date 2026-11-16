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
 * Actualiza el estado global cuando un usuario termina de editar una celda.
 * @param {HTMLElement} cellElement - El elemento <td> que ha sido modificado.
 */
function handleCellUpdate(cellElement) {
    // Lógica principal para actualizar el estado a partir del DOM.
    updateCellState(cellElement);
    // Luego se llama a guardar() y render() en conectar().
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
