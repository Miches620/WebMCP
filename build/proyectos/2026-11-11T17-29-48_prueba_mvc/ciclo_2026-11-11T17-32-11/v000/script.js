// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";

/**
 * Inicializa el estado con todas las celdas vacías (A1 a J20).
 */
function initializeEstado() {
    estado = {};
    for (let r = 1; r <= 20; r++) {
        for (let c = 0; c < 10; c++) {
            // Columna A=0, B=1, ..., J=9. Letra = 'A' + índice de columna.
            const colChar = String.fromCharCode('A'.charCodeAt(0) + c);
            const cellId = `${colChar}${r}`;
            estado[cellId] = "";
        }
    }
}

function cargar() { 
    try { 
        // Si hay datos guardados, los cargamos y sobrescribimos el estado inicial.
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            estado = JSON.parse(s);
        } else {
             // Si no hay nada en local storage, inicializamos la estructura vacía.
            initializeEstado();
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
        initializeEstado(); // Fallback a un estado limpio si falla localStorage
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
 * Actualiza el valor de una celda en el estado interno.
 * @param {string} cellId - El identificador de la celda (ej: "A1").
 * @param {string} newValue - El nuevo contenido del texto.
 */
function updateCellValue(cellId, newValue) {
    if (estado[cellId] !== undefined) {
        estado[cellId] = newValue;
    } else {
        console.warn(`Intento de actualizar celda no existente: ${cellId}`);
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet td[contenteditable="true"]');
    cells.forEach(cell => {
        const cellId = cell.getAttribute('data-cell');
        if (estado[cellId] !== undefined) {
            // Establece el contenido visible de la celda basado en el estado.
            cell.textContent = estado[cellId];
        } else {
             // Si por alguna razón no está en el estado, lo vacía.
             cell.textContent = "";
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheetBody = document.querySelector('#spreadsheet tbody');

    if (spreadsheetBody) {
        // Usamos event delegation para escuchar cambios en cualquier celda editable dentro del cuerpo de la tabla.
        spreadsheetBody.addEventListener('input', function(event) {
            const target = event.target;
            
            // Verificamos si el elemento que disparó el evento es una celda de datos (<td>).
            if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
                const cellId = target.getAttribute('data-cell');
                const newValue = target.textContent;

                // 1. Lógica: Actualizar el estado con el nuevo valor.
                updateCellValue(cellId, newValue);

                // 2. Guardar y Renderizar (aunque solo actualizamos un dato, es buena práctica seguir el ciclo).
                guardar();
                render(); // Esto asegura que si hay lógica de validación o formato en render(), se aplique.
            }
        });
    }
}

// Nota: El harness llamará a cargar() y conectar() antes de ejecutar este script, 
// y luego llamará a render() para la primera visualización.

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
