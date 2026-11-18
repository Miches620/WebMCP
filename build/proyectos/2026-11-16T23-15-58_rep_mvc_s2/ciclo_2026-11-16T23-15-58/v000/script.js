// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/** 
 * estado: Objeto que almacena el contenido de cada celda, usando la clave 'ColRow' (ej: A1).
 * Inicializa 200 celdas vacías (A1 a J20).
 */
let estado = {};
const CLAVE = "app";

// Función auxiliar para generar todas las claves 'A1', 'B2', etc.
function generateKeys() {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const rows = 20;
    let keys = {};
    for (let r = 1; r <= rows; r++) {
        for (let c = 0; c < columns.length; c++) {
            const colChar = columns[c];
            keys[`${colChar}${r}`] = ''; // Inicializar con cadena vacía
        }
    }
    return keys;
}

// Inicializamos el estado completo al cargar el script
estado = generateKeys();


function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            const loadedState = JSON.parse(s);
            // Aseguramos que si se carga un estado, tenga la estructura correcta de 200 celdas vacías por defecto.
            estado = generateKeys(); // Resetear a vacío para asegurar estructura completa
            Object.assign(estado, loadedState);
        }
    } catch (e) {
        console.error("Error al cargar el estado:", e);
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
 * Actualiza el contenido de una celda en el estado.
 * @param {string} col Columna (A-J).
 * @param {number} row Fila (1-20).
 * @param {string} value El nuevo valor del texto.
 */
function updateCell(col, row, value) {
    const key = `${col}${row}`;
    if (estado[key] !== undefined) {
        estado[key] = String(value);
        console.log(`Estado actualizado para ${key}: "${value}"`);
    } else {
        console.warn(`Clave inválida: ${key}`);
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet td');
    cells.forEach(cell => {
        const col = cell.dataset.col;
        const row = cell.dataset.row;
        const key = `${col}${row}`;

        // Actualiza el contenido visible de la celda con lo que está en estado
        if (estado[key] !== undefined) {
            cell.textContent = estado[key];
        } else {
             cell.textContent = ''; // Asegura que si por alguna razón falta, esté vacío
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    /**
     * Maneja el cambio de contenido cuando el usuario sale o presiona Enter en una celda editable.
     * @param {Event} event El evento del DOM.
     */
    function handleCellInteraction(event) {
        const target = event.target;

        // Solo procesamos si el objetivo es un TD con contenteditable="true"
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            let newValue = '';
            let shouldProcess = false;

            // 1. Capturar valor en focusout o Enter keydown
            if (event.type === 'focusout') {
                newValue = target.textContent || '';
                shouldProcess = true;
            } else if (event.type === 'keydown' && event.key === 'Enter') {
                // Para el Enter, necesitamos simular el focusout para capturar el valor final
                // y luego prevenir el comportamiento por defecto de enviar formulario/saltar línea.
                newValue = target.textContent || ''; 
                shouldProcess = true;
                event.preventDefault(); // Previene que se salte de fila automáticamente en la celda
            } else {
                 return; // No es un evento relevante para guardar
            }

            if (shouldProcess) {
                const col = target.dataset.col;
                const row = target.dataset.row;

                // Lógica: Actualizar estado con el valor capturado
                updateCell(col, row, newValue); 
                
                // Ciclo de persistencia y visualización
                guardar();
                render();
            }
        }
    }

    // Usamos delegación de eventos en la tabla completa para capturar los cambios en cualquier celda.
    spreadsheet.addEventListener('focusout', handleCellInteraction);
    spreadsheet.addEventListener('keydown', handleCellInteraction);
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
