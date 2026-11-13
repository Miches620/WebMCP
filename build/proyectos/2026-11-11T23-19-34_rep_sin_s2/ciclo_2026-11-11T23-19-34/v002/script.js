/**
 * @function generateColumnLetters
 * Generates an array of column letters from A to J (10 columns).
 * @returns {string[]} Array containing ['A', 'B', ..., 'J'].
 */
function generateColumnLetters() {
    const letters = [];
    for (let i = 0; i < 10; i++) {
        letters.push(String.fromCharCode('A'.charCodeAt(0) + i));
    }
    return letters;
}

/**
 * Handles input and blur events for a data cell to determine if formula evaluation is needed.
 * If the content starts with '=', it attempts to calculate the result based on current sheet values.
 * @param {HTMLElement} cellElement The TD element that triggered the event.
 */
function handleCellInput(cellElement) {
    let currentValue = cellElement.textContent.trim();

    if (!currentValue) return;

    // Check if the content looks like a formula (starts with '=')
    if (currentValue.startsWith('=')) {
        const formulaString = currentValue;
        
        try {
            // Evaluate the formula using the entire table context
            const result = evaluateFormula(formulaString, document.getElementById('spreadsheetTable'));
            
            // Update the display value only if evaluation was successful and yielded a number/string
            if (result !== null && typeof result === 'number') {
                cellElement.textContent = result; // Display only the computed result
            } else if (typeof result === 'string' && result !== '#ERROR') {
                 cellElement.textContent = result;
            } 
        } catch (e) {
            console.error("Error evaluating formula:", e);
            // If calculation fails, display an error message
            cellElement.textContent = "#ERROR"; 
        }
    } else {
        // If it's a manual input, simply ensure the content is retained.
    }
}

/**
 * Parses and evaluates an Excel-style formula string based on current cell values in the sheet.
 * Handles SUMA(range) and basic arithmetic operations (A1-B1, A1*B1, etc.).
 * @param {string} formulaString The full formula including '='.
 * @param {HTMLElement} tableElement The main spreadsheet table element.
 * @returns {number|string|null} The calculated result or null if parsing/evaluation fails.
 */
function evaluateFormula(formulaString, tableElement) {
    let formula = formulaString.substring(1).trim(); // Remove leading '='

    // --- 1. Handle SUMA(range) ---
    if (formula.toUpperCase().startsWith('SUMA')) {
        const match = formula.match(/SUMA\((.*)\)/i);
        if (!match || !match[1]) return null;

        const rangeString = match[1]; // e.g., A1:A3 or B2;C4

        let totalSum = 0;
        // Split by semicolon to handle discrete cells OR ranges
        const parts = rangeString.split(/;\s*/); 

        for (const part of parts) {
            if (!part) continue;
            
            // Check for single column range pattern (A1:A3) - Must be in the same column
            const rangeMatch = part.match(/^([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)$/i); 

            if (rangeMatch && rangeMatch[1] === rangeMatch[3]) {
                // Single column range found: A1:A3
                const col = rangeMatch[1];
                const startRow = parseInt(rangeMatch[2]);
                const endRow = parseInt(rangeMatch[4]);

                for (let r = startRow; r <= endRow; r++) {
                    const cellElement = document.querySelector(`[data-cell="${col}${r}"]`);
                    if (cellElement && cellElement.textContent !== '') {
                        // Get the numeric value of the dependency
                        let val = parseFloat(cellElement.textContent);
                        if (!isNaN(val)) {
                            totalSum += val;
                        }
                    }
                }
            } else if (part.match(/^[A-Z]+[0-9]+$/i)) {
                 // Handle single discrete cell reference like A1 
                 const cellElement = document.querySelector(`[data-cell="${part}"]`);
                 if (cellElement && cellElement.textContent !== '') {
                    let val = parseFloat(cellElement.textContent);
                    if (!isNaN(val)) totalSum += val;
                }
            }
        }
        return totalSum;
    } 
    
    // --- 2. Handle Arithmetic Operations (A1-B1, A1*B1, etc.) ---
    else {
        try {
            let expression = formula; 

            // Regex to find cell references like A1, B5, J20
            expression = expression.replace(/([A-Z]+)([0-9]+)/g, (match, col, row) => {
                const cellElement = document.querySelector(`[data-cell="${col}${row}"]`);
                if (cellElement && cellElement.textContent !== '') {
                    // Get the numeric value of the dependency
                    let val = parseFloat(cellElement.textContent);
                    return isNaN(val) ? '0' : val; 
                }
                return '0'; // Default to zero if dependency is missing/empty
            });

            // Use Function constructor for safe evaluation context (eval alternative)
            const result = new Function('return ' + expression)();
            return parseFloat(result);

        } catch (e) {
            console.warn("Arithmetic evaluation failed:", e);
            return null; // Indicate failure
        }
    }
}


/**
 * @function setupSpreadsheet
 * Initializes the spreadsheet functionality, ensuring structural elements 
 * (headers, row labels, and editable cells) are ready for user interaction.
 * This function handles R1 (inline editing) and validates R2 structure,
 * and now includes formula evaluation logic for R3.
 */
function setupSpreadsheet() {
    const table = document.getElementById('spreadsheetTable');

    // --- 1. Handle Cell Input Listeners (R1) ---
    // Select all data cells that are contenteditable
    const tds = table.querySelectorAll('tbody td[contenteditable="true"]');

    tds.forEach(td => {
        // Attach event listeners to handle input changes and final calculations on blur
        td.addEventListener('input', function() {
            handleCellInput(this);
        });
        // Using 'blur' ensures the calculation runs after typing stops, which is better UX for formulas.
        td.addEventListener('blur', function() {
            handleCellInput(this);
        });
    });

    // --- 2. Handle Row Selection and Actions (R7) ---

    /**
     * Selects a row based on the clicked label, highlights it, and displays context menu options.
     * @param {HTMLElement} labelElement The clicked row-label TH element.
     */
    function selectRow(labelElement) {
        const row = labelElement.closest('tr');

        // Deselect all rows first (remove previous highlight class if used)
        document.querySelectorAll('.row-label').forEach(l => l.parentElement.classList.remove('selected-row'));
        
        // Select the new row
        if (row) {
            row.classList.add('selected-row');
            console.log(`Row ${labelElement.textContent} selected.`);
        }
    }

    /**
     * Executes an action on the currently selected row.
     * @param {Function} actionFn The function to execute (e.g., delete, clear, color).
 * @param {...any} args Arguments for the action function.
 */
    function performRowAction(actionFn, ...args) {
        const selectedRow = document.querySelector('.selected-row')?.parentElement;
        if (!selectedRow) return alert("No row selected.");

        try {
            actionFn.call(selectedRow, ...args);
        } catch (e) {
            console.error("Error performing row action:", e);
            alert(`Failed to perform action: ${e.message}`);
        }
    }


    // Context Menu Handler (Right Click on Row Label)
    table.addEventListener('contextmenu', function(e) {
        if (!e.target.closest('.row-label')) return;
        e.preventDefault();

        const label = e.target;
        selectRow(label); // Select row first

        // Simple context menu simulation (in a real app, this would use CSS/JS for placement)
        let menuHtml = `
            <div class="context-menu" style="position:absolute; top:${e.clientY}px; left:${e.clientX}px;">
                <button data-action="delete">🗑️ Borrar Fila</button>
                <button data-action="clear">🧹 Borrar Contenido</button>
                <div class="separator"></div>
                <label for="colorPicker" style="display:block; margin: 5px;">Cambiar Fondo:</label>
                <input type="color" id="colorPicker" value="#ff0000" style="width:100%; height:30px; padding: 0; border: none; cursor: pointer;">
                <button data-action="apply-color">🎨 Aplicar Color</button>
            </div>`;

        // Append menu temporarily for interaction (assuming a global spot or body)
        document.body.insertAdjacentHTML('beforeend', menuHtml);

        const menu = document.querySelector('.context-menu');

        // Setup listeners for the temporary menu
        menu.querySelectorAll('button').forEach(button => {
            button.onclick = function() {
                const action = this.dataset.action;
                if (action === 'delete') {
                    performRowAction(deleteRow);
                } else if (action === 'clear') {
                    performRowAction(clearContent);
                } else if (action === 'apply-color') {
                     const color = document.getElementById('colorPicker').value;
                     performRowAction(changeBackgroundColor, color);
                }
                menu.remove(); // Close menu after action
            };
        });

        // Handle clicking outside the menu to close it
        document.addEventListener('click', function outsideClick(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', outsideClick);
            }
        }, { once: true }); // Use one-time listener for cleanup
    });


    // Event Listener for Row Label Click (Single Click Selection)
    table.addEventListener('click', function(e) {
        const label = e.target.closest('.row-label');
        if (label && !e.dataCoords) { // Only run if not triggered by context menu logic
            selectRow(label);
        }
    });

    // --- Row Action Implementations ---

    /** Deletes the entire row element from the DOM. */
    function deleteRow() {
        const selectedRow = document.querySelector('.selected-row')?.parentElement;
        if (selectedRow) {
            if (confirm("¿Está seguro de que desea eliminar esta fila?")) {
                selectedRow.remove();
                console.log("Row deleted.");
            }
        } else {
            alert("Por favor, seleccione una fila para borrarla.");
        }
    }

    /** Clears content from all cells in the selected row. */
    function clearContent() {
        const selectedRow = document.querySelector('.selected-row')?.parentElement;
        if (selectedRow) {
            // Select all TD elements within the row
            const tdsInRow = selectedRow.querySelectorAll('td');
            tdsInRow.forEach(td => {
                td.textContent = ''; // Clear content
                // Optional: also clear background color on content clear
                td.style.backgroundColor = ''; 
            });
            console.log("Content cleared.");
        } else {
            alert("Por favor, seleccione una fila para borrar contenido.");
        }
    }

    /** Sets the background color for all cells in the selected row. */
    function changeBackgroundColor(color) {
        const selectedRow = document.querySelector('.selected-row')?.parentElement;
        if (selectedRow) {
            const tdsInRow = selectedRow.querySelectorAll('td');
            tdsInRow.forEach(td => {
                td.style.backgroundColor = color;
                // Note: We keep the content, only changing background as per requirement focus.
            });
            console.log(`Background set to ${color}.`);
        } else {
            alert("Por favor, seleccione una fila para cambiar el fondo.");
        }
    }

    console.log("Spreadsheet App Initialized: Ready for input and row management.");
}

// Start the application when the script loads
setupSpreadsheet();
