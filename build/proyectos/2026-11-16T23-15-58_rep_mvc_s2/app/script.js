// ===== DATOS: la ÚNICA fuente de verdad. Todo lo que se ve sale de acá. =====
/** 
 * estado: Objeto que almacena el contenido y visibilidad de cada celda/fila/columna.
 * Claves de celdas: 'ColRow' (ej: A1).
 * Visibilidad: { colVisibility: {A: true, B: true, ...}, rowVisibility: {1: true, 2: true, ...} }
 */
let estado = {};
const CLAVE = "app";

// Función auxiliar para generar todas las claves 'A1', 'B2', etc. Y la estructura de visibilidad.
function generateKeys() {
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const rows = 20;
    let keys = {};

    // Inicializar estado de visibilidad (todo visible por defecto)
    let colVisibility = {};
    let rowVisibility = {};
    for (const col of columns) {
        colVisibility[col] = true;
    }
     for (let r = 1; r <= rows; r++) {
        rowVisibility[r] = true;
    }

    // Inicializar estado de celdas y metadatos
    keys.colVisibility = colVisibility;
    keys.rowVisibility = rowVisibility;


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
            estado = generateKeys(); // Resetear a vacío para asegurar estructura completa y visibilidad por defecto
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

/** 
 * Toggle la visibilidad de una columna, actualizando el estado y guardando.
 * @param {string} col Columna a ocultar/mostrar (A-J).
 */
function toggleColumnVisibility(col) {
    if (!['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].includes(col)) {
        console.error("Columna no válida:", col);
        return;
    }

    const isVisible = estado.colVisibility[col];
    estado.colVisibility[col] = !isVisible;
    
    guardar();
    render();
}

/** 
 * Toggle la visibilidad de una fila, actualizando el estado y guardando.
 * @param {number} row Fila a ocultar/mostrar (1-20).
 */
function toggleRowVisibility(row) {
     if (isNaN(parseInt(row)) || parseInt(row) < 1 || parseInt(row) > 20) {
        console.error("Fila no válida:", row);
        return;
    }

    const isVisible = estado.rowVisibility[row];
    estado.rowVisibility[row] = !isVisible;
    
    guardar();
    render();
}


// ===== DIBUJO: render() arma la pantalla entera desde `estado`. Lo que se muestra se calcula acá; la página no guarda datos. =====
function render() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    const rowHeaders = document.querySelectorAll('#row-headers th');
    const colHeaders = document.querySelectorAll('.col-header');
    const allCells = document.querySelectorAll('#spreadsheet td');

    // 1. Controlar visibilidad de columnas y filas en los encabezados (TH)
    
    // Column Headers: Ocultar/Mostrar la columna completa si el estado lo indica.
    let colIndex = 0;
    colHeaders.forEach(th => {
        const col = th.dataset.col;
        const isVisible = estado.colVisibility[col];
        if (isVisible) {
            th.style.display = ''; // Mostrar
        } else {
            th.style.display = 'none'; // Ocultar
        }
        colIndex++;
    });

     // Row Headers: Controlar la visibilidad del TH de la fila
    rowHeaders.forEach(th => {
        const row = th.dataset.row;
        const isVisible = estado.rowVisibility[row];
         if (isVisible) {
            th.style.display = ''; // Mostrar
        } else {
            th.style.display = 'none'; // Ocultar
        }
    });


    // 2. Controlar visibilidad de las celdas (TD) y su contenido
    allCells.forEach(cell => {
        const col = cell.dataset.col;
        const row = cell.dataset.row;
        const key = `${col}${row}`;

        // Verificar si tanto la columna como la fila están visibles
        const colVisible = estado.colVisibility[col];
        const rowVisible = estado.rowVisibility[row];

        if (colVisible && rowVisible) {
            cell.style.display = ''; // Mostrar el contenido
            // Actualiza el contenido visible de la celda con lo que está en estado
            if (estado[key] !== undefined) {
                cell.textContent = estado[key];
            } else {
                 cell.textContent = ''; 
            }
        } else {
             cell.style.display = 'none'; // Ocultar la celda completa
             // Limpiar contenido para evitar texto fantasma si se vuelve a mostrar
             cell.textContent = ''; 
        }
    });
}

// ===== CONTROLES: conectar() se llama UNA sola vez. Cada evento: llama a la LÓGICA, después guardar() y render(). =====
function conectar() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) return;

    /**
     * Función auxiliar para evaluar fórmulas simples (SUMA, -, *, /).
     * [ ... Código existente de evaluateFormula ... ]
     */
    function evaluateFormula(formulaString) {
        let formula = formulaString.trim();

        // 1. Manejo de rangos simples (SUMA(A1:A3))
        const sumMatch = formula.match(/SUMA\s*\(([^)]+)\)/i);
        if (sumMatch && sumMatch[1]) {
            const rangeString = sumMatch[1];
            const keys = getKeysInRange(rangeString);
            let sum = 0;
            for (const key of keys) {
                const value = estado[key] || '0';
                // Intentamos convertir a número para sumar. Si falla, se trata como cero.
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    sum += numValue;
                }
            }
            return sum.toString();
        }

        // 2. Manejo de operaciones binarias o múltiples (A1-B1, A1+B1*C1)
        try {
            // Reemplazamos referencias tipo 'A1' por sus valores numéricos para JS eval()
            let expression = formula;
            // Buscamos patrones como ColRow. Esto es una simplificación y asume que las referencias son separadas por operadores.
            const cellRegex = /([A-Z]\d+)/g;
            expression = expression.replace(cellRegex, (match) => {
                const key = match;
                const value = estado[key];
                return isNaN(parseFloat(value)) ? '0' : value; // Usar 0 si no es un número
            });

            // El operador '+' debe ser reemplazado por '+' de JavaScript, ya que SUMA() fue manejado arriba.
            expression = expression.replace(/([A-Z]\d+)/g, (match) => {
                return estado[match] ? parseFloat(estado[match]) : 0;
            });

            // Evaluación segura usando eval() (solo porque es un entorno controlado de app).
            const result = Function(`return ${expression}`)();
            if (!isNaN(result)) {
                 return result.toString();
            }
        } catch (e) {
            console.error("Error al evaluar la fórmula:", e);
        }

        // Si todo falla, devolvemos null para que el input raw se mantenga o se muestre como texto.
        return null;
    }

    /**
     * Helper para obtener todas las claves de un rango tipo A1:A3.
     * [ ... Código existente de getKeysInRange ... ]
     */
    function getKeysInRange(rangeString) {
        const keys = new Set();
        if (!rangeString.includes(':')) return keys;

        const [startRange, endRange] = rangeString.split(':').map(s => s.trim());

        // Mejor implementación para rangos columna-fila:
        let startMatch = startRange.match(/([A-Z]+)(\d+)/);
        let endMatch = endRange.match(/([A-Z]+)(\d+)/);
        if (!startMatch || !endMatch) return keys;

        const startColChar = startMatch[1];
        const startRowNum = parseInt(startMatch[2]);
        const endColChar = endMatch[1];
        const endRowNum = parseInt(endMatch[2]);


        // Generar todos los pares (col, row) entre el inicio y el fin de las coordenadas.
        let minColCode = Math.min(startColChar.charCodeAt(0), endColChar.charCodeAt(0));
        let maxColCode = Math.max(startColChar.charCodeAt(0), endColChar.charCodeAt(0));

        for (let colCode = minColCode; colCode <= maxColCode; colCode++) {
            const colChar = String.fromCharCode(colCode);
            if (colChar > 'J') break; // Límite de la aplicación A-J

            let minRowNum = Math.min(startRowNum, endRowNum);
            let maxRowNum = Math.max(startRowNum, endRowNum);

            for (let rowNum = minRowNum; rowNum <= maxRowNum; rowNum++) {
                 keys.add(`${colChar}${rowNum}`);
            }
        }


        return keys;
    }


    /**
     * Maneja el cambio de contenido cuando el usuario sale o presiona Enter en una celda editable.
     * [ ... Código existente de handleCellInteraction ... ]
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
                newValue = target.textContent || ''; 
                shouldProcess = true;
                event.preventDefault(); // Previene que se salte de fila automáticamente en la celda
            } else {
                 return; // No es un evento relevante para guardar
            }

            if (shouldProcess) {
                const col = target.dataset.col;
                const row = target.dataset.row;
                let finalValueToStore = newValue;

                // 2. DETECCIÓN Y EVALUACIÓN DE FÓRMULAS
                if (newValue && typeof newValue === 'string' && newValue.trim().startsWith('=')) {
                    const formulaString = newValue.substring(1).trim();
                    const result = evaluateFormula(formulaString);

                    if (result !== null) {
                        // Si la fórmula es válida, guardamos el RESULTADO calculado, no la fórmula.
                        finalValueToStore = result; 
                    } else {
                         // Si falla la evaluación, guardamos la fórmula original como texto para que el usuario vea lo que escribió.
                         finalValueToStore = newValue;
                    }
                }

                // Lógica: Actualizar estado con el valor capturado (ya sea resultado o texto)
                updateCell(col, row, finalValueToStore); 
                
                // Ciclo de persistencia y visualización
                guardar();
                render();
            }
        }
    }

    // --- NUEVO: Manejador de contexto (clic derecho) para headers ---
     /**
      * Maneja el evento de clic derecho en los encabezados.
      * @param {Event} e Evento del DOM.
      */
    function handleHeaderContextMenu(e) {
        e.preventDefault(); // Evita el menú contextual por defecto del navegador

        const target = e.target;
        let colToToggle = null;
        let rowToToggle = null;

        // 1. Detectar si se hizo clic en un encabezado de columna (col-header)
        if (target.classList.contains('col-header')) {
            const col = target.dataset.col;
            if (col) {
                showContextMenu(e.clientX, e.clientY, 'Columna', col);
                return;
            }
        } 
        // 2. Detectar si se hizo clic en un encabezado de fila (row-header)
        else if (target.classList.contains('row-header')) {
             const row = target.dataset.row;
             if (row) {
                showContextMenu(e.clientX, e.clientY, 'Fila', parseInt(row));
                return;
            }
        } else {
            // Si se hace clic en el TH vacío de la esquina superior izquierda o fuera de un header reconocido
            return; 
        }

        /** Muestra un menú contextual simulado (se puede mejorar con un elemento real, pero por simplicidad usamos JS) */
        function showContextMenu(x, y, type, value) {
             const menu = document.createElement('div');
             menu.className = 'context-menu';
             menu.style.left = `${x}px`;
             menu.style.top = `${y}px`;

             let contentHTML = `<strong>${type} ${value}</strong><br>`;
             contentHTML += `<button class="toggle-btn" data-action="col_hide" data-value="${value}">Ocultar ${type}</button>`;
             contentHTML += `<button class="toggle-btn" data-action="col_show" data-value="${value}">Mostrar ${type}</button>`;

             if (type === 'Fila') {
                 contentHTML = `<strong>${type} ${value}</strong><br>`;
                 contentHTML += `<button class="toggle-btn" data-action="row_hide" data-value="${value}">Ocultar ${type}</button>`;
                 contentHTML += `<button class="toggle-btn" data-action="row_show" data-value="${value}">Mostrar ${type}</button>`;
            }

             menu.innerHTML = contentHTML;
             document.body.appendChild(menu);

             // Añadir listeners al menú simulado
             menu.querySelectorAll('.toggle-btn').forEach(button => {
                 button.addEventListener('click', (e) => {
                     const action = e.target.dataset.action;
                     const value = e.target.dataset.value;
                     document.body.removeChild(menu); // Remover menú al hacer clic

                     if (action === 'col_hide') {
                         toggleColumnVisibility(value);
                     } else if (action === 'col_show') {
                         // Para mostrar, simplemente cambiamos el estado a true
                         estado.colVisibility[value] = true;
                         guardar();
                         render();
                     } else if (action === 'row_hide') {
                         toggleRowVisibility(parseInt(value));
                     } else if (action === 'row_show') {
                        // Para mostrar, simplemente cambiamos el estado a true
                         estado.rowVisibility[value] = true;
                         guardar();
                         render();
                    }
                 });
             });

             // Remover menú al hacer clic fuera
             document.addEventListener('click', function clickHandler(e) {
                if (!menu.contains(e.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', clickHandler);
                }
            });

        }
    }


    // Usamos delegación de eventos en la tabla completa para capturar los cambios en cualquier celda editable.
    spreadsheet.addEventListener('focusout', handleCellInteraction);
    spreadsheet.addEventListener('keydown', handleCellInteraction);
    
    // NUEVO: Añadir evento de contexto (clic derecho) al contenedor de encabezados
    const headerContainer = document.querySelector('#col-headers, #row-headers'); 
    if (headerContainer) {
        headerContainer.addEventListener('contextmenu', handleHeaderContextMenu);
    }
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
