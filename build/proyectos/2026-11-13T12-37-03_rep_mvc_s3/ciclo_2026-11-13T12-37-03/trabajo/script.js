// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";

/** 
 * Genera el objeto inicial del estado con todas las coordenadas predefinidas (A1 a J20).
 */
function initializeEstado() {
    const state = {};
    // Columnas A-J (índice 0 a 9)
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    // Filas 1-20
    for (let r = 1; r <= 20; r++) {
        for (let c = 0; c < columns.length; c++) {
            const col = columns[c];
            const cellCoord = `${col}${r}`;
            state[cellCoord] = ""; // Inicialmente vacío
        }
    }
    return state;
}

// Inicializamos el estado la primera vez que se carga el script.
estado = initializeEstado();


function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            const loadedState = JSON.parse(s);
            // Fusionamos lo cargado con la estructura base para asegurar que todas las claves existan,
            // aunque en este caso simple, simplemente reemplazaremos el estado completo.
            estado = loadedState; 
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
 * Actualiza el valor de una celda en el estado.
 * @param {string} cellCoord - Coordenada de la celda (ej: "A1", "J20").
 * @param {string} value - El nuevo contenido del texto.
 */
function updateCellValue(cellCoord, value) {
    if (estado[cellCoord] !== undefined) {
        estado[cellCoord] = String(value);
    } else {
        console.warn(`Coordenada no reconocida en el estado: ${cellCoord}`);
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');
    
    cells.forEach(td => {
        // Obtenemos la coordenada de la celda (ej: A1) usando el atributo data-cell
        const cellCoord = td.getAttribute('data-cell');
        
        if (cellCoord && estado[cellCoord] !== undefined) {
            // Establecemos el contenido visible con lo que está en el estado
            td.textContent = estado[cellCoord];
        } else {
             // Caso de seguridad si la coordenada no existe o el estado falló
            td.textContent = ""; 
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const tbody = document.querySelector('#spreadsheet-grid tbody');
    if (!tbody) return;

    // Event delegation para capturar cambios de celdas de datos (blur)
    tbody.addEventListener('blur', (event) => {
        const target = event.target;

        if (target && target.hasAttribute('contenteditable') && target.dataset.cell) {
            const cellCoord = target.getAttribute('data-cell');
            let newValue = target.textContent; 

            updateCellValue(cellCoord, newValue);
        }
    }, true);

    // --- Manejo de Ocultar Columnas (Headers en elad thead) ---
    const colHeaders = document.querySelectorAll('.col-header[data-col-index]');
    colHeaders.forEach(header => {
        // Usamos el menú contextual (clic derecho) para activar la función de ocultar/mostrar columna
        header.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); // Previene el menú contextual por defecto del navegador
            const colIndex = parseInt(header.getAttribute('data-col-index'));
            if (!isNaN(colIndex)) {
                toggleHideColumn(colIndex);
            }
        });
    });

    // --- Manejo de Ocultar Filas (Headers en elad thead) ---
    const rowHeaders = document.querySelectorAll('.row-header');
    rowHeaders.forEach(header => {
        // Usamos el menú contextual (clic derecho) para activar la función de ocultar/mostrar fila
        header.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); // Previene el menú contextual por defecto del navegador
            const rowIndex = header.textContent.trim(); 
            if (rowIndex && !isNaN(parseInt(rowIndex))) {
                toggleHideRow(parseInt(rowIndex));
            }
        });
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
