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
 * Obtiene el valor numérico de una celda del estado.
 * Devuelve 0 si no es un número válido o si la celda no existe.
 */
function getCellValue(cellId) {
    const value = estado[cellId];
    if (value === undefined || value === null) return 0;
    // Intenta parsear el valor a flotante. Si falla, devuelve el valor original como string.
    return isNaN(parseFloat(value)) ? value : parseFloat(value);
}

/**
 * Calcula la suma de una cadena que contiene referencias de celdas separadas por ':' o ','.
 * Ej: "A1:A3" -> Suma A1, A2, A3. Ej: "B1;C1" -> Suma B1, C1.
 * @param {string} rangeString - La cadena que representa el rango/celdas a sumar.
 * @returns {number} La suma calculada.
 */
function calculateSum(rangeString) {
    // Reemplazar separadores de lista (;) o comas por espacios para un manejo uniforme
    let cellsToSum = rangeString.replace(/;/g, ' ').replace(/,/g, ' ');

    // Si contiene rangos tipo A1:A3, lo procesamos primero
    const ranges = cellsToSum.match(/[A-Z]+\d+(?::[A-Z]+\d+)*|([A-Z]\d+)/g);
    if (!ranges) return 0;

    let total = 0;
    for (const range of ranges) {
        // Si es un rango simple tipo A1:A3
        if (range.includes(':')) {
            const [startCell, endCell] = range.split(':');
            
            // Asume que el rango está en la misma columna y se incrementa la fila
            const startCol = startCell[0];
            let startRow = parseInt(startCell.substring(1));
            let endRow = parseInt(endCell.substring(1));

            for (let r = startRow; r <= endRow; r++) {
                total += getCellValue(startCol + r);
            }
        } else {
             // Es una celda individual (A1)
            total += getCellValue(range);
        }
    }
    return total;
}

/**
 * Evalúa una fórmula de hoja de cálculo.
 * @param {string} formulaString - La cadena que comienza con '='.
 * @returns {string|number} El resultado calculado o la fórmula original si falla.
 */
function evaluateFormula(formulaString) {
    let formula = formulaString.trim();
    if (!formula.startsWith('=')) return formula;

    // Eliminar el signo de igual inicial para empezar a parsear
    formula = formula.substring(1).trim();

    try {
        // 1. Manejo específico para SUMA: =SUMA(...)
        const sumRegex = /^SUMA\((.+)\)$/;
        if (sumRegex.test(formula)) {
            const content = formula.substring(4, formula.length - 1).trim(); // Extract content inside ()
            return calculateSum(content);
        }

        // 2. Manejo de expresiones matemáticas complejas: A1-B1*C2
        let expression = formula;
        
        // Regex para capturar referencias a celdas (ej: A1, Z99)
        const cellRefRegex = /([A-Z]+[1-9]\d*)/g; 

        // Reemplazar cada referencia de celda con su valor actual en el estado.
        expression = expression.replace(cellRefRegex, (match) => {
            return getCellValue(match);
        });

        // Evaluar la expresión matemática resultante usando eval()
        const result = eval(expression);
        return result;

    } catch (e) {
        console.error("Error evaluando fórmula:", e);
        return formulaString; // Si hay error, devolvemos el string original para que se muestre la fórmula.
    }
}


/**
 * Actualiza el estado de una celda específica.
 * @param {string} cellId - La clave de la celda (ej: "A1").
 * @param {string} newValue - El nuevo contenido textual.
 */
function actualizarCelda(cellId, newValue) {
    if (estado[cellId] !== undefined) {
        // Guardamos el valor tal cual lo escribió el usuario (incluso si es una fórmula).
        estado[cellId] = String(newValue); 
        // Después de cambiar el estado, siempre guardamos y redibujamos para sincronizar.
        guardar();
        render();
    }
}


/**
 * Vacía el contenido de todas las celdas en una columna dada.
 * @param {string} columnChar - La letra de la columna (ej: "A").
 */
function clearColumnContent(columnChar) {
    for (let r = 1; r <= ROWS; r++) {
        const cellId = columnChar + r;
        if (estado.hasOwnProperty(cellId)) {
            // Establecemos el valor a cadena vacía, borrando fórmula o texto.
            estado[cellId] = "";
        }
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
            const targetCell = document.querySelector(`td[data-cell="${cellId}"]`);

            if (targetCell) {
                let rawValue = estado[cellId] || '';
                let displayValue = String(rawValue); // Por defecto, se muestra el string
                
                // Verificar si el valor es una fórmula y calcularlo antes de mostrar.
                if (displayValue.startsWith('=')) {
                    const calculatedResult = evaluateFormula(displayValue);
                    // Si la evaluación fue exitosa y no hay error, mostramos el resultado numérico/calculado.
                    // Nota: `evaluateFormula` ya maneja si debe devolver un string o un number.
                    displayValue = String(calculatedResult); 
                }

                // Asignar el valor (ya calculado o raw) al contenido visible
                targetCell.textContent = displayValue;
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

    // 3. Manejo de clic en cabecera de columna (Letras A-J)
    const headerCells = document.querySelectorAll('#spreadsheetTable thead th');
    headerCells.forEach(th => {
        // Verificamos si la celda contiene una letra de columna válida (A-J).
        const colCharMatch = th.textContent.trim().match(/^[A-Z]$/);
        if (colCharMatch) {
            th.addEventListener('click', () => {
                const columnChar = colCharMatch[0];
                // Ejecutamos la lógica de vaciado al hacer clic en la letra de la columna.
                clearColumnContent(columnChar);

                // Guardar y redibujar para que el cambio se refleje.
                guardar();
                render();
            });
        }
    });
    
    // 4. Context Menu Handler: Maneja acciones al hacer clic derecho en la etiqueta de fila (Row Label).
    tableBody.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (!target || !target.classList.contains('row-label')) return;

        e.preventDefault(); // Previene el menú contextual predeterminado del navegador
        
        // Obtener el índice de la fila del texto visible en la etiqueta (ej: '3').
        const rowIndex = parseInt(target.textContent); 

        // Crear y mostrar un menú simulado para las acciones requeridas.
        let menuDiv = document.createElement('div');
        menuDiv.style.position = 'fixed';
        menuDiv.style.zIndex = '1000';
        menuDiv.style.backgroundColor = '#fff';
        menuDiv.style.border = '1px solid #ccc';
        menuDiv.style.padding = '10px';
        menuDiv.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
        
        let menuHTML = `
            <p style="font-weight: bold; margin-bottom: 10px;">Acciones para Fila ${rowIndex}</p>
            <button class="row-action-btn" data-action="clear">Vaciar Contenido de la Fila</button><br>
            <button class="row-action-btn" data-action="color">Cambiar Color de Fondo</button>
            <input type="color" id="colorPicker" value="#ff0000" style="margin: 10px 5px; vertical-align: middle;">
            <button class="row-action-btn" data-action="delete">Borrar Fila</button><br>
            <button class="row-action-btn" data-action="hide">Ocultar Fila</button><br>
            <button class="row-action-btn" data-action="show">Mostrar Fila</button>
        `;
        menuDiv.innerHTML = menuHTML;
        document.body.appendChild(menuDiv);

        // Manejar clics dentro del menú temporalmente creado
        const handleMenuClick = (e) => {
            const actionButton = e.target.closest('.row-action-btn');
            if (!actionButton) return;

            const action = actionButton.dataset.action;

            if (action === 'clear') {
                clearRowContent(rowIndex);
                guardar();
                render();
            } else if (action === 'delete') {
                deleteRow(rowIndex);
                // deleteRow ya llama a guardar() y render()
            } else if (action === 'color') {
                const color = document.getElementById('colorPicker').value;
                handleRowColorChange(rowIndex, color);
            } else if (action === 'hide') {
                hideRow(rowIndex);
            } else if (action === 'show') {
                showRow(rowIndex);
            }

            // Limpiar el menú después de la acción
            document.body.removeChild(menuDiv);
        };


        // Añadir listener al contenedor del menú para manejar los clics
        const menuListener = (e) => {
            if (e.target.closest('.row-action-btn')) {
                handleMenuClick(e);
            } else if (!e.relatedTarget && !menuDiv.contains(e.relatedTarget)) {
                 // Ocultar si se hace clic fuera del menú
                 document.body.removeChild(menuDiv);
                 document.removeEventListener('click', menuListener);
            }
        };

        document.addEventListener('click', menuListener, { once: true });
    });
}

// ===== ARRANQUE (lo pone el harness: no lo cambies) =====
function arrancar() { cargar(); conectar(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
