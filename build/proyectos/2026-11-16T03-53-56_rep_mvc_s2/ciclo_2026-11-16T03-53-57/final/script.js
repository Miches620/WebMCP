// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====

/**
 * Estado global para almacenar los datos de la hoja de cálculo.
 * La estructura es un objeto donde las claves son las coordenadas (ej: "A1", "J20")
 * y los valores son el texto contenido en esa celda.
 */
let estado = {
    data: {}
};
const CLAVE = "app";

/**
 * Carga el estado desde localStorage si existe.
 */
function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) 
            estado = JSON.parse(s); 
    } catch (e) {
        console.error("Error al cargar el estado:", e);
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
 * Convierte un índice de columna (0-9) en su letra correspondiente (A-J).
 * @param {number} index - El índice de columna (0=A, 1=B, etc.)
 * @returns {string} La letra de la columna.
 */
function getColChar(index) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return alphabet[index].toUpperCase();
}

/**
 * Genera una clave de coordenada (ej: "A1", "J20").
 * @param {number} colIndex - Índice de la columna (0-9).
 * @param {number} rowIndex - Número de la fila (1-20).
 * @returns {string} La clave de la celda.
 */
function getCoordinate(colIndex, rowIndex) {
    return getColChar(colIndex) + rowIndex;
}

/**
 * Actualiza el estado con un nuevo valor para una coordenada específica.
 * Esta función es puramente lógica y no interactúa con el DOM.
 * @param {string} col - La letra de la columna (A-J).
 * @param {number} row - El número de la fila (1-20).
 * @param {string} value - El nuevo texto a guardar.
 */
function updateCellState(col, row, value) {
    const coordinate = getCoordinate(colToIndex(col), row);
    estado.data[coordinate] = String(value || '');
}

/**
 * Helper para convertir letras de columna (A-J) a índices numéricos (0-9).
 * @param {string} colChar - La letra de la columna.
 * @returns {number} El índice numérico (0-9).
 */
function colToIndex(colChar) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return alphabet.indexOf(colChar);
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const sheetBody = document.getElementById('spreadsheet').querySelector('tbody');
    if (!sheetBody) return;

    // Iterar sobre las 20 filas (1 a 20)
    for (let r = 1; r <= 20; r++) {
        // Obtener todas las celdas de la fila actual. Los hijos directos del tbody son los TRs.
        const rowElement = sheetBody.querySelectorAll(`[data-row="${r}"]`);
        if (!rowElement) continue;

        // Iterar sobre las 10 columnas (A a J) dentro de esa fila
        for (let cIndex = 0; cIndex < 10; cIndex++) {
            const colChar = getColChar(cIndex);
            const coordinate = getCoordinate(cIndex, r);

            // Encontrar el TD específico usando sus atributos data-col y data-row
            // Esto es más seguro que usar selectores CSS complejos en un bucle.
            let cellElement = null;
            for (const td of rowElement) {
                if (td.getAttribute('data-col') === colChar) {
                    cellElement = td;
                    break;
                }
            }

            if (cellElement) {
                // Obtener el valor guardado en estado, si no existe, es una cadena vacía.
                const valueToShow = estado.data[coordinate] || "";
                
                // Establecer el contenido visible del elemento DOM.
                cellElement.textContent = valueToShow;
            }
        }
    }
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    /**
     * Manejador central para el contenido editable de las celdas.
     * Se adjunta un listener al contenedor principal (el <table>).
     * @param {Event} e - El evento disparado (focusout o keydown).
     */
    function handleCellEdit(e) {
        const target = e.target;

        // Verificar si el elemento objetivo es una celda editable y tiene las propiedades correctas
        if (!target || !target.hasAttribute('contenteditable') || !(target.dataset.col && target.dataset.row)) {
            return;
        }

        let newValue = '';
        let shouldUpdate = false;

        // 1. Determinar el nuevo valor basado en el evento:
        if (e.type === 'focusout' || e.type === 'blur') {
            // Se perdió el foco. El contenido visible es el valor a guardar.
            newValue = target.textContent;
            shouldUpdate = true;

        } else if (e.type === 'keydown' && e.key === 'Enter') {
            // Se presionó Enter. Es equivalente a perder el foco y confirmar el valor.
            newValue = target.textContent;
            shouldUpdate = true;
            // Prevenir el comportamiento por defecto de Enter en un contenteditable
            e.preventDefault(); 

        } else {
            // Si es cualquier otro evento, ignorar o no hacer nada (ya que solo queremos focusout/Enter).
            return;
        }

        if (shouldUpdate && newValue !== undefined) {
            const col = target.dataset.col;
            const row = parseInt(target.dataset.row);

            // 2. Lógica: Actualizar el estado con el nuevo valor.
            updateCellState(col, row, newValue);

            // 3. Guardar y Redibujar: persistir los datos y actualizar la UI.
            guardar();
            render();
        }
    }

    // Usamos event delegation en el contenedor principal para capturar eventos de cualquier celda hija.
    spreadsheet.addEventListener('focusout', handleCellEdit);
    spreadsheet.addEventListener('keydown', handleCellEdit); 
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
