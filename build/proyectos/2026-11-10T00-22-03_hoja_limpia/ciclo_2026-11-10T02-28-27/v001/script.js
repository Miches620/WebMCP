/**
 * Obtiene el valor numérico de una celda específica en la hoja de cálculo.
 * @param {string} col Columna (A, B, etc.)
 * @param {number} row Número de fila (1-20)
 * @returns {number} El valor numérico o 0 si no es un número válido.
 */
function getNumericValue(col, row) {
    const selector = `[data-col="${col}"][data-row="${row}"]`;
    const targetCell = document.querySelector(`#spreadsheet-body ${selector}`);

    if (!targetCell) {
        console.warn(`Celda no encontrada: ${col}${row}`);
        return 0;
    }

    let value = targetCell.textContent.trim();

    // Si el contenido es una fórmula, ya debería haber sido calculado y mostrado como número.
    if (value.startsWith('=')) {
        try {
            // Intentamos evaluar fórmulas simples de JavaScript para obtener el valor numérico
            return eval(value); 
        } catch (e) {
            console.error(`Error al evaluar fórmula ${col}${row}:`, e);
            return NaN;
        }
    }

    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

/**
 * Evalúa una fórmula de hoja de cálculo simple (SUMA, +, -, *, /).
 * @param {string} formula La cadena de la fórmula (ej: "=SUMA(A1:A3)")
 * @returns {number|string} El resultado calculado o el texto original si falla.
 */
function evaluateFormula(formula) {
    let cleanFormula = formula.toUpperCase().trim();

    // 1. Manejo de SUMA(RANGO)
    const sumMatch = cleanFormula.match(/^=SUMA\(([^)]+)\)$/);
    if (sumMatch && sumMatch[1]) {
        const rangeString = sumMatch[1]; // Ej: A1:A3

        // Extraer coordenadas de inicio y fin
        const startCoordMatch = rangeString.match(/([A-Z]+)(\d+)/);
        const endCoordMatch = rangeString.match(/([A-Z]+)(\d+)$/);

        if (startCoordMatch && endCoordMatch) {
            const startCol = startCoordMatch[1];
            const startRow = parseInt(startCoordMatch[2]);
            const endCol = endCoordMatch[1];
            const endRow = parseInt(endCoordMatch[2]);

            let sum = 0;

            // Iterar sobre el rango (simplificado para rangos verticales como A1:A3)
            if (startCol === endCol && startRow <= endRow) { 
                for (let r = startRow; r <= endRow; r++) {
                    sum += getNumericValue(startCol, r);
                }
            } else if (startCol !== endCol && startRow === endRow) { // Rango horizontal A1:J1
                 const colChars = [];
                 for (let i = 0; i < 10; i++) {
                     colChars.push(String.fromCharCode('A'.charCodeAt(0) + i));
                 }

                 // Encontrar el índice de la columna inicial y final
                 const startIndex = colChars.indexOf(startCol);
                 const endIndex = colChars.indexOf(endCol);

                 if (startIndex !== -1 && endIndex !== -1) {
                     for (let c = startIndex; c <= endIndex; c++) {
                         sum += getNumericValue(colChars[c], startRow);
                     }
                 }
            } else if (startCol === endCol && startRow === endRow) {
                // Caso de celda única, no debería pasar con SUMA pero por seguridad.
                return getNumericValue(startCol, startRow);
            }

            return sum;
        }
    }

    // 2. Manejo de operaciones básicas (A1-B1, A1*B1, etc.)
    try {
        let expression = cleanFormula;
        const cellRegex = /([A-Z]+)(\d+)/g; // Captura A1, B2, etc.

        expression = expression.replace(cellRegex, (match, col, row) => {
            return getNumericValue(col, parseInt(row));
        });

        // Evaluar la expresión matemática resultante de JavaScript
        const result = eval(expression);
        if (!isNaN(result)) {
             return result;
        }
    } catch (e) {
        console.error("Error al evaluar fórmula:", e);
    }


    // Si nada funciona, devolver el valor original o un mensaje de error
    return formula; 
}

/**
 * R1. Configura la edición inline para todas las celdas de la hoja de cálculo.
 * Utiliza delegación de eventos en el tbody para manejar los cambios de contenido
 * en cualquier celda editable (<td>).
 */
function setupCellEditing() {
    const spreadsheetBody = document.getElementById('spreadsheet-body');

    if (!spreadsheetBody) {
        console.error("Error: No se encontró el cuerpo de la hoja de cálculo con id 'spreadsheet-body'.");
        return;
    }

    // Usamos event delegation para escuchar cambios en cualquier <td> dentro del tbody.
    spreadsheetBody.addEventListener('input', function(event) {
        const target = event.target;

        // Verificamos si el elemento que disparó el evento es una celda de datos editable.
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            const col = target.getAttribute('data-col');
            const row = target.getAttribute('data-row');
            let rawValue = target.textContent;

            // 1. Si el contenido comienza con '=', asumimos que es una fórmula y la calculamos.
            if (rawValue && typeof rawValue === 'string' && rawValue.trim().startsWith('=')) {
                try {
                    const calculatedValue = evaluateFormula(rawValue);
                    
                    // Actualizamos el texto de la celda con el resultado numérico, no la fórmula.
                    target.textContent = calculatedValue; 
                } catch (e) {
                    console.error("Error al calcular la fórmula:", e);
                    // Si falla el cálculo, mantenemos el valor original para que el usuario lo vea.
                }
            } else {
                 // Si es solo texto o número, simplemente dejamos el contenido como está.
            }
        }
    });

    // Opcional: Manejar el evento de foco para asegurar que la experiencia sea fluida al hacer clic.
    spreadsheetBody.addEventListener('focusin', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            // Esto simplemente asegura que el foco está en la celda correcta, lo cual es nativo, 
            // pero ayuda a confirmar la funcionalidad de edición.
            console.log(`Foco puesto en ${target.getAttribute('data-col')}${target.getAttribute('data-row')}. Listo para editar.`);
        }
    });
}

/**
 * Función principal que inicializa todas las funcionalidades de la hoja de cálculo.
 */
function initializeSpreadsheet() {
    // 1. Configurar la edición inline (R1)
    setupCellEditing();

    // 2. Configurar selección y formato de celdas (R5)
    setupCellSelectionAndFormatting();
}


// Llamada única para arrancar la aplicación cuando el script se carga.
initializeSpreadsheet();

function setupCellSelectionAndFormatting() {
    const spreadsheetBody = document.getElementById('spreadsheet-body');
    const headerRow = document.querySelector('#spreadsheet-grid thead tr'); // Captura la fila de encabezados (A, B, C...)
    const colorPicker = document.getElementById('color-picker');
    const applyButton = document.getElementById('apply-format-btn');
    // Nuevos elementos de control para ocultar y borrar contenido
    const hideColumnBtn = document.getElementById('hide-column-btn');
    const hideRowBtn = document.getElementById('hide-row-btn');
    const clearColumnContentBtn = document.getElementById('clear-column-content-btn');

    let selectedCell = null; // Celda individual seleccionada
    let selectedColumnLetter = null; // Columna completa seleccionada (ej: 'A')
    let selectedRowNumber = null; // Fila completa seleccionada (ej: '3')

    // Función para limpiar la selección visual en cualquier elemento
    const clearSelection = () => {
        if (selectedCell) {
            selectedCell.style.outline = '';
            selectedCell = null;
        }
        // Limpiar estilos de columna y fila
        Array.from(spreadsheetBody.querySelectorAll('tr')).forEach(row => {
            row.style.backgroundColor = '';
        });
        selectedColumnLetter = null; 
        selectedRowNumber = null;
    };

    // Función para aplicar selección visual a una fila completa
    const selectRowVisual = (rowNum) => {
        selectedRowNumber = rowNum;
        Array.from(spreadsheetBody.querySelectorAll(`[data-row="${rowNum}"] td`)).forEach(td => {
            td.style.backgroundColor = '#e0e0ff'; // Color de selección de fila
        });
    };

    // Función para actualizar el estado de los botones de ocultar y borrar contenido
    const updateControlsState = () => {
        hideColumnBtn.disabled = !selectedColumnLetter;
        hideRowBtn.disabled = !selectedRowNumber;
        clearColumnContentBtn.disabled = !selectedColumnLetter; // Habilitar el botón de borrado si hay columna seleccionada
    };


    // 1. Manejar la selección de celdas (Click en TD)
    spreadsheetBody.addEventListener('click', function(event) {
        const target = event.target;

        if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
            clearSelection(); // Limpiar cualquier selección previa

            // Seleccionar el nuevo objetivo de celda individual
            selectedCell = target;
            selectedCell.style.outline = '2px solid blue'; 
            selectedColumnLetter = null; // Deseleccionar columna si se selecciona una celda
            selectedRowNumber = null; // Deseleccionar fila si se selecciona una celda
        } else if (target.tagName === 'TH' && !target.hasAttribute('data-col') && target.textContent.match(/^\d+$/)) {
             // Si hacemos clic en el número de la fila, seleccionamos la fila
            clearSelection(); 
            selectedRowNumber = target.textContent.trim();
            selectRowVisual(selectedRowNumber);
        } else if (target.tagName === 'TH' && target.hasAttribute('data-col')) {
             // Si hacemos clic en el encabezado de columna, seleccionamos la columna
            clearSelection(); 
            selectedColumnLetter = target.textContent.trim().toUpperCase();
            Array.from(headerRow.children).forEach(th => th.style.backgroundColor = ''); // Limpiar todos
            target.style.backgroundColor = '#ccc'; // Marcar columna activa
        } else {
             // Si hacemos clic en cualquier otro lugar, limpiamos todo
             clearSelection();
        }
        updateControlsState();
    });

    // 2. Manejar la selección de columnas (Click en TH del thead)
    if (headerRow) {
        headerRow.addEventListener('click', function(event) {
            const target = event.target;

            if (target.tagName === 'TH' && target.textContent.match(/[A-Z]/)) {
                // Limpiar selección de celda y fila si se selecciona una columna
                clearSelection(); 
                
                selectedColumnLetter = target.textContent.trim().toUpperCase();
                
                // Aplicar un indicador visual a la cabecera seleccionada (opcional, pero útil)
                Array.from(headerRow.children).forEach(th => th.style.backgroundColor = ''); // Limpiar todos
                target.style.backgroundColor = '#ccc'; // Marcar columna activa
            } else {
                 // Si se hace clic en cualquier otro lugar del thead, limpiar selección
                 clearSelection();
                 selectedColumnLetter = null;
                 Array.from(headerRow.children).forEach(th => th.style.backgroundColor = ''); 
            }
            updateControlsState();
        });
    }

    // 3. Manejar la selección de filas (Click en TH del número de fila)
    spreadsheetBody.addEventListener('click', function(event) {
        const target = event.target;

        if (target.tagName === 'TH' && !target.hasAttribute('data-col') && target.textContent.match(/^\d+$/)) { // Asumimos que el TH sin data-col es el número de fila
            clearSelection(); 
            selectedRowNumber = target.textContent.trim();
            selectRowVisual(selectedRowNumber);
        } else if (target.tagName === 'TD' && target.hasAttribute('contenteditable')) {
             // Si se hace clic en una celda, la lógica de TD ya lo maneja y llama a clearSelection()
        }
        updateControlsState();
    });

    // 4. Manejar la aplicación del color (Botón o Input)
    const applyFormat = () => {
        let targetElements = [];

        if (selectedColumnLetter && selectedRowNumber === null) { // Modo Columna: Solo columna seleccionada
            targetElements = document.querySelectorAll(`#spreadsheet-body td[data-col="${selectedColumnLetter}"]`);
        } else if (selectedCell) {
            // Modo Celda Individual: Solo la celda seleccionada
            targetElements = [selectedCell];
        } else if (selectedRowNumber) { // Modo Fila Completa: Seleccionado por el número de fila
             targetElements = document.querySelectorAll(`#spreadsheet-body tr[data-row="${selectedRowNumber}"] td`);
        } else {
            alert("Por favor, selecciona una celda o columna/fila primero.");
            return;
        }

        const selectedColor = colorPicker.value;
        
        // Aplicar el fondo de color seleccionado a todos los elementos objetivo
        targetElements.forEach(element => {
            element.style.backgroundColor = selectedColor;
        });
    };

    // Evento para el botón "Aplicar Formato"
    applyButton.addEventListener('click', applyFormat);

    // --- NUEVA LÓGICA DE BORRAR CONTENIDO DE COLUMNA ---
    clearColumnContentBtn.addEventListener('click', () => {
        if (!selectedColumnLetter) return;

        const colLetter = selectedColumnLetter;
        
        // Seleccionar y borrar contenido de todas las celdas en la columna seleccionada
        const targetElements = document.querySelectorAll(`#spreadsheet-body td[data-col="${colLetter}"]`);

        targetElements.forEach(element => {
            element.textContent = '';
            element.innerHTML = '';
        });

        alert(`Contenido de la Columna ${colLetter} ha sido borrado.`);
    });


    // --- NUEVA LÓGICA DE OCULTAR COLUMNA ---
    hideColumnBtn.addEventListener('click', () => {
        if (!selectedColumnLetter) return;

        const colLetter = selectedColumnLetter;
        
        // 1. Ocultar TH en el encabezado
        Array.from(headerRow.children).forEach(th => {
            if (th.textContent.trim().toUpperCase() === colLetter) {
                th.style.display = 'none';
            } else {
                th.style.display = ''; // Asegurar que los demás estén visibles
            }
        });

        // 2. Ocultar TD en el cuerpo de la hoja
        document.querySelectorAll(`#spreadsheet-body td[data-col="${colLetter}"]`).forEach(td => {
            td.style.display = 'none';
        });

        alert(`Columna ${colLetter} ha sido oculta.`);
    });

    // --- NUEVA LÓGICA DE OCULTAR FILA ---
    hideRowBtn.addEventListener('click', () => {
        if (!selectedRowNumber) return;

        const rowNum = selectedRowNumber;
        
        // 1. Ocultar la fila completa (TR) en el cuerpo de la hoja
        const targetRow = document.querySelector(`#spreadsheet-body tr[data-row="${rowNum}"]`);
        if (targetRow) {
            targetRow.style.display = 'none';
            alert(`Fila ${rowNum} ha sido oculta.`);
        }
    });


    // Opcional: Permitir aplicar al cambiar el input (aunque el botón es más explícito)
    colorPicker.addEventListener('change', () => {
        // No hacer nada aquí, mantener la UX de usar el botón "Aplicar Formato"
    });

    // Manejar borrado de contenido con tecla Supr/Delete
    document.addEventListener('keydown', function(event) {
        const isDeleteKey = (event.key === 'Delete' || event.keyCode === 46);

        if (!isDeleteKey) return;
        
        event.preventDefault(); // Prevenir la acción por defecto del navegador

        // Prioridad: Borrar Fila si está seleccionada
        if (selectedRowNumber) {
            const targetElements = document.querySelectorAll(`#spreadsheet-body tr[data-row="${selectedRowNumber}"] td`);
            targetElements.forEach(element => {
                element.textContent = '';
                element.innerHTML = '';
            });
            return;
        }

        // Segunda prioridad: Borrar Columna si está seleccionada
        if (selectedColumnLetter) {
            const targetElements = document.querySelectorAll(`#spreadsheet-body td[data-col="${selectedColumnLetter}"]`);

            targetElements.forEach(element => {
                element.textContent = '';
                element.innerHTML = '';
            });
            return;
        }
    });
}
