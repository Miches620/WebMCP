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

/**
 * Evalúa una fórmula de estilo Excel en el estado actual del sistema.
 * @param {string} formula - La fórmula ingresada (debe empezar con '=').
 * @param {Object.<string, string>} state - El objeto de estado global (estado[coordenada] = valor).
 * @returns {string} El resultado calculado como cadena, o la fórmula original si no es válida.
 */
function evalFormula(formula, state) {
    if (!formula || !formula.startsWith('=')) {
        return formula; // No es una fórmula, devolverlo tal cual.
    }

    let expression = formula.substring(1).trim();

    // 1. Manejo de SUMA()
    const sumMatch = expression.match(/^SUMA\((.*)\)$/i);
    if (sumMatch) {
        const args = sumMatch[1];
        let valuesToSum = [];
        
        // Identificar argumentos separados por ; o espacios, manejando rangos A1:A3
        const parts = args.split(/[;,]\s*|\s+/).filter(p => p);

        for (const part of parts) {
            if (part.includes(':')) {
                // Rango simple vertical (e.g., A1:A3)
                const [startRef, endRef] = part.split(':').map(r => r.toUpperCase());
                
                if (startRef[0] !== endRef[0]) continue; // Debe ser la misma columna

                const startRow = parseInt(startRef.substring(startRef.length - 1));
                const endRow = parseInt(endRef.substring(endRef.length - 1));
                const colChar = startRef[0];

                for (let r = startRow; r <= endRow; r++) {
                    const key = colChar + r;
                    if (state[key] !== undefined) {
                        valuesToSum.push(parseFloat(state[key]));
                    }
                }
            } else {
                // Celda suelta (e.g., B2)
                const key = part.toUpperCase();
                if (state[key] !== undefined) {
                    valuesToSum.push(parseFloat(state[key]));
                }
            }
        }

        const total = valuesToSum.reduce((acc, val) => acc + val, 0);
        return total.toString();
    }


    // 2. Manejo de Operaciones Aritméticas Simples (Ej: =A1-B1, =A1*B1)
    const refRegex = /([A-Z]+[0-9]+)/g;
    let expressionString = expression.replace(refRegex, (match) => {
        // Reemplaza las referencias de celda con sus valores numéricos actuales para poder evaluar la expresión JS
        const value = state[match] !== undefined ? parseFloat(state[match]) : 0;
        return isNaN(value) ? '0' : value;
    });

    try {
        // Usamos new Function() de forma controlada.
        const result = new Function('return ' + expressionString);
        return parseFloat(result()).toString();
    } catch (e) {
        console.error("Error al evaluar la expresión:", e);
        // Si falla la evaluación, devolvemos la fórmula original para que el usuario la vea.
        return formula; 
    }
}

// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const tableBody = document.querySelector("#spreadsheetTable tbody");
    if (!tableBody) return;

    const rows = 20;
    const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''); // A-J (10 chars)

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
                let contenidoMostrar = contenido;

                // Evaluar la fórmula antes de mostrarla en el DOM
                if (contenido.startsWith('=')) {
                    contenidoMostrar = evalFormula(contenido, estado);
                }
                
                // Actualizar el DOM con el contenido calculado o original.
                cellElement.textContent = contenidoMostrar;
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

                // 3. DIBUJO: Refrescar la vista (esto recalculará todas las fórmulas)
                render();
            }
        });
    }
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
