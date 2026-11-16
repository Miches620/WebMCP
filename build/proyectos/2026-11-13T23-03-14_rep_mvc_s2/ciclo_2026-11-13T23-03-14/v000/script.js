// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====

/**
 * Inicializa el estado con 20 filas y 10 columnas (A-J).
 * El estado será un objeto donde la clave es "ColRow" (ej: "A1") y el valor es el contenido textual.
 */
let estado = {};

const ROWS = 20;
const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, 10); // A a J
const CLAVE = "app";

// Inicialización del estado completo (20 * 10 = 200 celdas)
for (let r = 1; r <= ROWS; r++) {
    for (let c = 0; c < COLS.length; c++) {
        const colChar = COLS[c];
        const cellId = colChar + r;
        estado[cellId] = "";
    }
}

function cargar() { try { const s = localStorage.getItem(CLAVE); if (s) estado = JSON.parse(s); } catch (e) {} }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {} }


// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el estado de una celda específica.
 * @param {string} cellId - La clave de la celda (ej: "A1").
 * @param {string} newValue - El nuevo contenido textual.
 */
function actualizarCelda(cellId, newValue) {
    if (estado[cellId] !== undefined) {
        estado[cellId] = String(newValue);
        // Después de cambiar el estado, siempre guardamos y redibujamos para sincronizar.
        guardar();
        render();
    }
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const tableBody = document.getElementById('spreadsheetTable');
    if (!tableBody) return;

    // Iterar sobre todas las celdas del estado y actualizar el DOM
    for (let r = 1; r <= ROWS; r++) {
        for (let cIndex = 0; cIndex < COLS.length; cIndex++) {
            const colChar = COLS[cIndex];
            const cellId = colChar + r;

            // Encontrar el elemento TD correspondiente en la estructura HTML
            // Usamos un selector robusto basado en data-cell para evitar errores de DOM traversal
            const targetCell = document.querySelector(`td[data-cell="${cellId}"]`);

            if (targetCell) {
                // Asignar el valor del estado al contenido visible
                targetCell.textContent = estado[cellId] || '';
            }
        }
    }
}


// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====

/**
 * Maneja el guardado cuando el usuario termina de editar (blur o Enter).
 * @param {HTMLElement} target - La celda que perdió foco o presionó Enter.
 */
function handleCellChange(target) {
    const cellId = target.getAttribute('data-cell');
    if (!cellId) return;

    // El contenido actual del elemento editable es el nuevo valor a guardar
    const newValue = target.textContent; 
    
    actualizarCelda(cellId, newValue);
}


function conectar() {
    // Usamos event delegation en el tbody para capturar eventos de todas las celdas sin añadir listeners individuales.
    const tableBody = document.querySelector('#spreadsheetTable tbody');
    if (!tableBody) return;

    // 1. Evento de pérdida de foco (blur): Se dispara al hacer clic fuera o con Tab.
    // Esto captura el cambio cuando termina la edición.
    tableBody.addEventListener('focusout', (e) => {
        const target = e.target;
        if (target && target.hasAttribute('contenteditable') && target.getAttribute('data-cell')) {
            handleCellChange(target);
        }
    });

    // 2. Evento de pulsación de tecla (keydown): Para detectar Enter.
    tableBody.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target && target.hasAttribute('contenteditable') && target.getAttribute('data-cell')) {
            // Solo procesar si se presiona Enter y no estamos en un estado de edición especial
            if (e.key === 'Enter') {
                e.preventDefault(); // Previene el salto de línea por defecto en contenteditable
                handleCellChange(target);
            }
        }
    });

    // Nota: No es necesario añadir listeners para 'input' o 'change' porque la lógica requiere esperar a focusout/Enter.
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
