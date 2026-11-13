// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/**
 * @type {Object.<string, string>} Mapea coordenadas (e.g., "A1") a su contenido actual.
 */
let estado = {}; 
const CLAVE = "app";

function cargar() { try { const s = localStorage.getItem(CLAVE); if (s) estado = JSON.parse(s); } catch (e) {} }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {} }

// ===== LÓGICA: funciones que cambian `estado` (o calculan con él). NO tocan la página: sin document. =====

/**
 * Actualiza el estado interno de una celda específica.
 * @param {string} coordenada - La clave de la celda (ej: "B5").
 * @param {string} valor - El nuevo contenido escrito por el usuario.
 */
function actualizarCelda(coordenada, valor) {
    estado[coordenada] = String(valor); 
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const tableBody = document.querySelector("#spreadsheetTable tbody");
    if (!tableBody) return;

    const rows = 20;
    const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''); // A-J (10 chars)

    // Limpiar el contenido existente antes de redibujar para evitar duplicados o inconsistencias
    // Aunque en este caso no es estrictamente necesario si solo actualizamos el textContent,
    // es una buena práctica de renderizado.
    
    for (let r = 1; r <= rows; r++) {
        const rowElement = tableBody.querySelector(`tr:nth-child(${r})`);
        if (!rowElement) continue;

        for (let c = 0; c < columns.length; c++) {
            const columnaChar = columns[c];
            const coordenada = columnaChar + r;
            const cellElement = rowElement.querySelector(`[data-cell="${coordenada}"]`);
            
            if (cellElement) {
                // Obtener el valor de estado, si no existe, es una cadena vacía.
                const contenido = estado[coordenada] || ""; 
                
                // Actualizar el DOM con el contenido del estado.
                cellElement.textContent = contenido;
            }
        }
    }
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const tableContainer = document.getElementById('spreadsheetTable');

    if (tableContainer) {
        // Usamos delegación de eventos para escuchar cambios en cualquier celda editable sin añadir listeners individuales.
        tableContainer.addEventListener('input', (event) => {
            let target = event.target;

            // Verificamos que el evento provenga de una celda editable (<td>)
            if (target && target.hasAttribute('contenteditable') && target.tagName === 'TD') {
                const coordenada = target.getAttribute('data-cell');
                const nuevoValor = target.textContent; 

                // 1. LÓGICA: Actualizar el estado con los datos del evento
                actualizarCelda(coordenada, nuevoValor);

                // 2. PERSISTENCIA: Guardar el cambio en local storage
                guardar();

                // 3. DIBUJO: Refrescar la vista (aunque en este caso solo actualizamos un elemento, es bueno mantener el ciclo completo)
                render();
            }
        });
    }
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
