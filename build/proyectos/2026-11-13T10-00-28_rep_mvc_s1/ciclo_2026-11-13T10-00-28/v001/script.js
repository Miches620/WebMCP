// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
let estado = {};
const CLAVE = "app";
const TOTAL_FILAS = 20;
const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// Inicializa el estado con todas las celdas vacías, pero presentes.
function inicializarEstado() {
    estado = {};
    for (let r = 1; r <= TOTAL_FILAS; r++) {
        for (const col of COLUMNAS) {
            const cellId = `${col}${r}`;
            estado[cellId] = ''; // Inicializa cada celda con un valor vacío
        }
    }
}

/**
 * Actualiza el estado interno de una celda específica.
 * @param {string} cellId - ID de la celda (Ej: 'A1').
 * @param {string} value - El nuevo valor ingresado por el usuario.
 */
function actualizarCelda(cellId, value) {
    if (!estado.hasOwnProperty(cellId)) {
        console.warn(`Intento de actualizar una celda no inicializada: ${cellId}`);
        return;
    }
    // Actualizamos el estado con el valor recibido (el texto puro).
    estado[cellId] = value;
    guardar();
    // Después de la lógica, siempre renderizamos para asegurar que cualquier formato o cálculo se aplique.
    render();
}


function cargar() { 
    try { 
        const s = localStorage.getItem(CLAVE); 
        if (s) {
            const loadedState = JSON.parse(s);
            // Aseguramos que el estado cargado tenga la estructura completa, rellenando lo faltante.
            inicializarEstado();
            for (const cellId in loadedState) {
                if (loadedState.hasOwnProperty(cellId)) {
                    estado[cellId] = loadedState[cellId];
                }
            }
        } else {
             // Si no hay datos guardados, inicializamos el estado vacío completo.
            inicializarEstado();
        }
    } catch (e) { 
        console.error("Error al cargar el estado:", e);
        inicializarEstado(); // Fallback seguro
    } 
}

function guardar() { 
    try { 
        localStorage.setItem(CLAVE, JSON.stringify(estado)); 
    } catch (e) { 
        console.error("Error al guardar el estado:", e); 
    } 
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const cells = document.querySelectorAll('td[data-cell]');

    cells.forEach(cell => {
        const cellId = cell.getAttribute('data-cell');
        const currentValueInState = estado[cellId];

        // Regla: No redibujar si el elemento está activo (el usuario lo está editando).
        if (document.activeElement === cell) {
            return; 
        }

        // Establecer el contenido visible del TD desde el estado.
        // Usamos innerText o textContent para evitar que la manipulación de innerHTML cause problemas con contenteditable.
        cell.textContent = currentValueInState;
    });
}


// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheetBody = document.querySelector('tbody');

    if (!spreadsheetBody) return;

    /**
     * Manejador genérico para cualquier cambio en las celdas editables.
     * Solo se dispara cuando el usuario deja de escribir o termina de editar (blur/change).
     */
    const handleCellChange = (event) => {
        // 1. Identificar la celda que disparó el evento.
        const target = event.target;
        if (target.tagName !== 'TD' || !target.hasAttribute('data-cell')) {
            return;
        }

        const cellId = target.getAttribute('data-cell');
        // 2. Obtener el valor *real* que se quedó en el DOM después de la edición.
        let newValue = target.textContent.trim();

        // 3. Lógica: Actualizar el estado con el valor finalizado.
        actualizarCelda(cellId, newValue);
    };


    // Usamos Event Delegation para escuchar eventos sobre todos los TDs sin adjuntar listeners individuales.
    spreadsheetBody.addEventListener('blur', handleCellChange);
    spreadsheetBody.addEventListener('change', handleCellChange);

    // Manejador de Clic en Encabezados de Columna (Letra)
    const colHeaders = document.querySelectorAll('.col-header');

    colHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const columnLetter = this.textContent.trim();
            
            // 1. Limpiar el estado de todas las celdas en esta columna.
            for (let r = 1; r <= TOTAL_FILAS; r++) {
                const cellId = `${columnLetter}${r}`;
                estado[cellId] = ''; // Establecer el valor a vacío en el estado global
            }

            // 2. Guardar y redibujar para reflejar el cambio de forma permanente.
            guardar();
            render();
        });
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
