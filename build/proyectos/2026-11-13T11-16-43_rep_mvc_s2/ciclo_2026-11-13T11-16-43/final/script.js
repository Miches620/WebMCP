// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";

/** Inicializa el estado con todas las 200 celdas (A1 a J20) y sus valores vacíos. */
function initializeEstado() {
    estado = {};
    for (let r = 1; r <= 20; r++) {
        for (let c = 0; c < 10; c++) {
            // Columna A=0, B=1, ..., J=9. Letra = 'A' + índice de columna.
            const colLetter = String.fromCharCode('A'.charCodeAt(0) + c);
            const cellId = `${colLetter}${r}`;
            estado[cellId] = '';
        }
    }
}

function cargar() { 
    // Siempre inicializar el estado para asegurar que todas las claves existan, incluso si no hay datos guardados.
    initializeEstado(); 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            let loadedState = JSON.parse(s);
            // Fusionar el estado cargado con la estructura inicial para garantizar que las claves faltantes no rompan nada.
            estado = { ...estado, ...loadedState };
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
 * Actualiza el valor de una celda específica en el estado global.
 * @param {string} cellId - El identificador de la celda (ej: "A1").
 * @param {string} value - El nuevo contenido del texto.
 */
function setCellValue(cellId, value) {
    if (!estado[cellId]) {
        console.warn(`Intento de actualizar una celda no inicializada: ${cellId}`);
        return; // Prevenir errores si el ID es inválido.
    }
    // Almacenamos el valor limpio y estandarizado (string).
    estado[cellId] = String(value); 
}

/**
 * Limpia el contenido de todas las celdas de una columna específica en el estado y la vista.
 * @param {string} colLetter - La letra de la columna (ej: "A").
 */
function clearColumnContent(colLetter) {
    if (!/[A-Z]/.test(colLetter)) return;

    // Iterar sobre todas las filas (1 a 20).
    for (let r = 1; r <= 20; r++) {
        const cellId = `${colLetter}${r}`;
        setCellValue(cellId, ''); // Establecer el estado en vacío.
    }

    // Guardar y redibujar para que los cambios sean visibles inmediatamente.
    guardar();
    render();
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const tableBody = document.getElementById('spreadsheetTable');

    // 2. Iterar sobre todas las celdas de datos (tbody > tr > td[data-cell])
    const cells = tableBody.querySelectorAll('td[data-cell]');

    cells.forEach(cellElement => {
        const cellId = cellElement.getAttribute('data-cell');
        // Obtener el valor del estado, si no existe por algún motivo (aunque debería existir), usar vacío.
        const valueFromState = estado[cellId] || ''; 
        
        // Actualizar el contenido visible de la celda.
        cellElement.textContent = valueFromState;

        // Asegurarse de que el atributo contenteditable esté presente para el manejo de eventos.
        cellElement.setAttribute('contenteditable', 'true');
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const tableBody = document.getElementById('spreadsheetTable');
    // Seleccionamos la fila <thead> que contiene las letras A-J
    const headerRow = document.querySelector('#spreadsheetTable thead tr');

    /**
     * Manejador de eventos para celdas editables. Captura el valor cuando el usuario termina de editar (blur o change).
     */
    function handleCellChange(event) {
        const target = event.target;
        // 1. Identificar la celda por su atributo data-cell.
        const cellId = target.getAttribute('data-cell');
        if (!cellId) return;

        // 2. Obtener el nuevo valor del DOM.
        let newValue = target.textContent; 

        // 3. Lógica: Actualizar el estado con el valor finalizado (blur/change).
        setCellValue(cellId, newValue);

        // 4. Guardar y Renderizar para reflejar los cambios en toda la app.
        guardar();
        render();
    }

    // Usamos event delegation en el tbody para escuchar cualquier cambio en cualquier TD hijo editable.
    tableBody.addEventListener('blur', handleCellChange);
    tableBody.addEventListener('change', handleCellChange);

    // Event listener para manejar clics en los encabezados de columna (A, B, C...)
    if (headerRow) {
        headerRow.addEventListener('click', function(e) {
            const target = e.target;
            // Verificamos si el clic fue sobre un encabezado que tiene data-col-letter
            if (target.hasAttribute('data-col-letter')) {
                const colLetter = target.getAttribute('data-col-letter');
                clearColumnContent(colLetter);
            }
        });
    }
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
