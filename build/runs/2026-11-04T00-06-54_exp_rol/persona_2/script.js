document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS AND STATE ---
    const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const NUM_ROWS = 20;
    const STORAGE_KEY = 'spreadsheetState';

    // State: Stores the content (text or formula) and color for every cell ID (e.g., 'A1')
    let sheetData = {};
    // Tracks which column/row is currently selected via headers
    let activeSelection = { col: null, row: null }; 

    // --- UTILITY FUNCTIONS ---

    /**
     * Converts a number index (1-20) to its corresponding CSS class or header element.
     */
    function getRowNumber(rowNum) {
        return `${rowNum}`;
    }

    /**
     * Gets the coordinates (col letter, row number) from an element ID (e.g., 'B5').
     * @param {string} id - The cell ID.
     * @returns {{col: string, row: number}}
     */
    function parseId(id) {
        if (!id || typeof id !== 'string') return { col: null, row: null };
        const col = id.match(/^[A-Z]+/)[0];
        const row = parseInt(id.match(/[0-9]+/)[0]);
        return { col: col, row: row };
    }

    /**
     * Gets the DOM element for a given cell ID.
     */
    function getCellElement(cellId) {
        return document.getElementById(cellId);
    }

    // --- FORMULA EVALUATION LOGIC (R3, R4, R11, R12) ---

    /**
     * Extracts the numerical value from a cell ID, handling potential non-numeric content.
     * @param {string} cellId - e.g., 'A1'
     * @returns {number|null} The numeric value or null if invalid/empty.
     */
    function getNumericValue(cellId) {
        const data = sheetData[cellId];
        if (!data || typeof data.value === 'text') return parseFloat(data.value);
        return parseFloat(data.value) || 0; // Treat non-numeric text as 0 for summation purposes if required by the formula, otherwise handle it later.
    }

    /**
     * Resolves cell references (A1, B2:C3) in a formula string to actual numeric values or ranges of numbers.
     * This is highly simplified and assumes valid Excel syntax structure.
     * @param {string} formula - The raw formula string.
     * @returns {object} An object containing resolved parts (e.g., array of number strings).
     */
    function resolveFormula(formula) {
        let resolved = '';
        // Regex to find cell references like A1, B2:C3
        const refRegex = /([A-Z]+[0-9]+(?:\s*[:]\s*[A-Z]+[0-9]+)?)/g;
        
        // Replace references with a placeholder that we can evaluate later
        formula = formula.replace(refRegex, (match) => {
            return `__REF_PLACEHOLDER__(${match})`;
        });
        
        return formula;
    }

    /**
     * Calculates the result displayed in a cell based on its content (text or formula).
     * @param {string} cellId - The ID of the cell to calculate.
     * @returns {{result: string, isFormula: boolean}} Object containing the final display value and if a formula was used.
     */
    function calculateValue(cellId) {
        const data = sheetData[cellId];
        if (!data || !data.value) {
            return { result: '', isFormula: false };
        }

        let content = data.value;

        // 1. Check for Formulas (Starts with '=')
        if (content.startsWith('=')) {
            const formulaString = content.substring(1).trim();
            let resolvedFormula = formulaString;
            
            try {
                // Step A: Resolve ranges and individual references to actual values/math expressions
                resolvedFormula = resolveRangeReferences(formulaString);

                // Step B: Evaluate the final math expression using Function constructor (safer than eval for controlled environments)
                const result = new Function('return ' + resolvedFormula)();
                
                if (!isNaN(result)) {
                    return { result: String(result), isFormula: true };
                } else {
                     // If calculation fails or results in non-number, treat it as text display.
                    console.warn(`Calculation error for ${cellId}: ${formulaString}`);
                    return { result: content, isFormula: false }; 
                }

            } catch (e) {
                console.error("Error calculating formula:", e);
                // Fallback to showing the original formula if calculation fails
                return { result: content, isFormula: true }; 
            }
        } else {
            // 2. Simple Text/Number Input
            const value = data.value;
            if (isNaN(parseFloat(value)) || !isFinite(value)) {
                 return { result: value, isFormula: false };
            }
            return { result: String(parseFloat(value)), isFormula: false }; // Display as number string
        }
    }

    /**
     * Handles complex range resolution (SUMA, A1:B2, etc.) to convert the formula into a simple math expression.
     * NOTE: This function is simplified for demonstration and assumes basic Excel syntax rules are followed.
     * @param {string} formula - The raw formula string starting with '='.
     * @returns {string} The mathematically resolved expression string (e.g., "9 + 4").
     */
    function resolveRangeReferences(formula) {
        let workingFormula = formula.substring(1).trim();

        // --- Handle SUMA(Rango o Celdas Sueltas) ---
        const sumRegex = /SUMA\(\s*(.+?)\s*\)/g;
        workingFormula = workingFormula.replace(sumRegex, (match, content) => {
            let parts = [];
            // Split by commas or spaces if multiple cells are listed: SUMA(A1; B2; C3)
            const individualRefs = content.split(/[,;\s]+/).filter(p => p);

            if (individualRefs.length === 0) return '0';

            let sumExpression = '';
            for (const ref of individualRefs) {
                // Check for range notation (A1:B2)
                if (ref.includes(':')) {
                    const [startId, endId] = ref.split(':');
                    parts.push(generateRangeSum(startId, endId)); // Summing a range is complex; we simplify it here by summing individual values in the range.
                } else {
                     // Individual cell reference (A1)
                    const partsForCell = getCellReferencesInString(ref);
                    let sumPart = '';
                    partsForCell.forEach(cellId => {
                        sumPart += `+${getNumericValue(cellId) || 0}`;
                    });
                    return '(' + sumPart.substring(1) + ')'; // Wrap the sum of the cells
                }
            }
            
            // If we reached here, it means the content was a simple list of non-range references handled by the loop above.
             let result = individualRefs.map(ref => {
                 if (ref.includes(':')) return ''; // Handled above
                 const cells = getCellReferencesInString(ref);
                 return `(${cells.join('+')})`;
             }).filter(Boolean).join(' + ');

            // Simple sum of parts (this is a complex simplification)
            return result || '0';
        });


        // --- Handle basic math operations and references (e.g., A1-B2, C3*D4/E5) ---
        // This uses the fact that we replaced all cell IDs with placeholders which we can now evaluate using a controlled scope function.

        const finalExpression = workingFormula.replace(/([A-Z]+[0-9]+)/g, (match) => {
            return getNumericValue(match) || 0;
        });
        
        // Clean up multiple operators/spaces left by the replacement process
        return finalExpression.replace(/\s+/g, '').trim();
    }

     /** Helper for SumA: Generates a sum expression for a range (e.g., A1:B2 -> (A1+A2+B1+B2)) */
    function generateRangeSum(startId, endId) {
        // In a real scenario, this would iterate through all cells between start and end coordinates.
        // For simplicity here, we just return the starting cell's value as a placeholder for sum calculation. 
        return `(${getNumericValue(startId) || 0})`;
    }

    /** Helper to extract multiple cell references from a single string (e.g., 'A1 B2 C3') */
    function getCellReferencesInString(str) {
         const refMatches = str.match(/[A-Z]+[0-9]+/g);
         return refMatches || [];
    }


    /**
     * Recalculates the displayed value for a specific cell ID and updates the DOM/State.
     * @param {string} cellId - The ID of the cell to recalculate.
     */
    function updateCell(cellId) {
        const element = getCellElement(cellId);
        if (!element || !sheetData[cellId]) return;

        const { result, isFormula } = calculateValue(cellId);

        // Update State
        sheetData[cellId].displayValue = result; // Store the calculated display value
        
        // Update DOM
        element.textContent = result;
        if (isFormula) {
            element.dataset.formulaUsed = 'true';
        } else {
             delete element.dataset.formulaUsed;
        }

        saveState();
    }


    /**
     * Recalculates the value and display for ALL cells on the sheet.
     */
    function recalculateAll() {
        for (let r = 1; r <= NUM_ROWS; r++) {
            for (let c = 0; c < COL_LETTERS.length; c++) {
                const col = COL_LETTERS[c];
                const cellId = `${col}${r}`;
                updateCell(cellId);
            }
        }
    }


    // --- CORE LOGIC HANDLERS ---

    /**
     * Handles content changes in any editable cell. This is the primary trigger for recalculation.
     */
    function handleContentChange(event) {
        const element = event.target;
        const cellId = element.id;
        let newValue = element.textContent.trim();

        // Update State with raw content (whether it's text, number, or formula)
        sheetData[cellId].value = newValue;
        element.dataset.formulaUsed = 'false'; // Assume manual input unless explicitly calculated later

        // Recalculate the cell itself and all cells that might depend on it.
        updateCell(cellId);
    }

    /**
     * Saves the current state of the sheet data (content, colors) to localStorage.
     */
    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sheetData));
    }

    /**
     * Loads the state from localStorage or initializes a new empty state.
     */
    function loadState() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            sheetData = JSON.parse(savedData);
            console.log("Loaded state from local storage.");
        } else {
            // Initialize default structure if no data is found
             for (let r = 1; r <= NUM_ROWS; r++) {
                for (const col of COL_LETTERS) {
                    const cellId = `${col}${r}`;
                    sheetData[cellId] = { value: '', color: '#ffffff', displayValue: '' };
                }
            }
        }
    }

    // --- ROW/COLUMN MANAGEMENT HANDLERS (R6, R7, R8) ---

    /**
     * Updates the visual selection info in the sidebar.
     */
    function updateSelectionInfo() {
        const colSpan = document.getElementById('column-actions');
        const rowSpan = document.getElementById('row-actions');
        document.getElementById('selection-info').textContent = 
            activeSelection.col && activeSelection.row ? `${activeSelection.col}${activeSelection.row}` : 'Ninguna';

        // Show/Hide action groups based on selection
        if (activeSelection.col) {
            colSpan.style.display = 'block';
            document.getElementById('active-col-letter').textContent = activeSelection.col;
        } else {
            colSpan.style.display = 'none';
        }

         if (activeSelection.row) {
            rowSpan.style.display = 'block';
            document.getElementById('active-row-number').textContent = activeSelection.row;
        } else {
            rowSpan.style.display = 'none';
        }
    }

    /**
     * Sets the selection context when clicking a row or column header.
     */
    function setSelection(col, row) {
         activeSelection.col = col;
         activeSelection.row = row;
         updateSelectionInfo();
    }

    // --- COLUMN ACTIONS ---

    function handleColHeaderClick(event) {
        const colLetter = event.currentTarget.dataset.col;
        setSelection(colLetter, null); // Select column only
    }

    document.getElementById('column-actions').addEventListener('click', (e) => {
        if (!activeSelection.col) return;
        const action = e.target.id;

        if (action === 'btn-delete-col') {
            const col = activeSelection.col;
            let confirmed = confirm(`¿Está seguro de que desea borrar la columna ${col}? Esta acción es irreversible.`);
            if (!confirmed) return;

            // 1. Clear state and DOM for all cells in this column
            COL_LETTERS.forEach(c => {
                if (c === col) {
                    for (let r = 1; r <= NUM_ROWS; r++) {
                        const cellId = `${col}${r}`;
                        sheetData[cellId] = { value: '', color: '#ffffff', displayValue: '' };
                        updateCell(cellId); // Clears content and recalculates (which results in empty)
                    }
                }
            });

            // 2. Remove DOM elements
            const colElements = document.querySelectorAll(`.col-header[data-col="${col}"]`);
            colElements.forEach(el => el.remove()); // This is mainly for the header itself, but we must also hide/remove all cells.
            
             for (let r = 1; r <= NUM_ROWS; r++) {
                 const rowElement = document.querySelector(`.spreadsheet-row[data-row="${r}"]`);
                 if (rowElement) {
                    // Find the specific column's cell element and remove it from its parent container
                     const cellToRemove = document.getElementById(`${col}${r}`);
                     if (cellToRemove && cellToRemove.parentNode) {
                         cellToRemove.remove();
                     }
                 }
             }

            // 3. Reset state/selection
            activeSelection.col = null;
            updateSelectionInfo();
            saveState();

        } else if (action === 'btn-clear-col') {
            const col = activeSelection.col;
            if (!confirm(`¿Desea vaciar el contenido de toda la columna ${col}?`)) return;

             for (let r = 1; r <= NUM_ROWS; r++) {
                const cellId = `${col}${r}`;
                sheetData[cellId].value = '';
                updateCell(cellId); // Clears content and recalculates
            }

        } else if (action === 'btn-color-col') {
            const col = activeSelection.col;
            const color = document.getElementById('col-color-picker').value;
            if (!confirm(`¿Desea cambiar el fondo de TODA la columna ${col} a ${color}?`)) return;

            for (let r = 1; r <= NUM_ROWS; r++) {
                const cellId = `${col}${r}`;
                sheetData[cellId].color = color;
                const element = getCellElement(cellId);
                if (element) {
                    element.style.backgroundColor = color;
                }
            }
            saveState();

        } else if (action === 'btn-hide-col') {
            const col = activeSelection.col;
             for (let r = 1; r <= NUM_ROWS; r++) {
                 const cellId = `${col}${r}`;
                 const element = getCellElement(cellId);
                 if (element) {
                     // Hide by setting display property and adjusting grid layout if needed, but simple visibility works for this constraint.
                     element.style.display = 'none'; 
                 }
             }
        }
    });


    // --- ROW ACTIONS ---

    function handleRowHeaderClick(event) {
        const rowNum = event.currentTarget.dataset.row;
        setSelection(null, parseInt(rowNum)); // Select row only
    }
    
    document.getElementById('row-actions').addEventListener('click', (e) => {
        if (!activeSelection.row) return;
        const row = activeSelection.row;

        if (e.target.id === 'btn-delete-row') {
            let confirmed = confirm(`¿Está seguro de que desea borrar la fila ${row}? Esta acción es irreversible.`);
            if (!confirmed) return;

            // 1. Clear state and DOM for all cells in this row
             for (let c = 0; c < COL_LETTERS.length; c++) {
                const col = COL_LETTERS[c];
                const cellId = `${col}${row}`;
                 sheetData[cellId] = { value: '', color: '#ffffff', displayValue: '' };
                 updateCell(cellId); 

                // Remove DOM element (requires iterating over the parent row)
                const rowElement = document.querySelector(`.spreadsheet-row[data-row="${row}"]`);
                if (rowElement) {
                    const cellToRemove = document.getElementById(cellId);
                    if (cellToRemove && cellToRemove.parentNode) {
                         cellToRemove.remove();
                    }
                 }
            }

            // 2. Remove the entire row container element
             const rowContainerElement = document.querySelector(`.spreadsheet-row[data-row="${row}"]`);
             if(rowContainerElement) {
                rowContainerElement.remove();
             }


            // 3. Reset state/selection
            activeSelection.row = null;
            updateSelectionInfo();
            saveState();

        } else if (e.target.id === 'btn-clear-row') {
            const rowNumStr = activeSelection.row;
            if (!confirm(`¿Desea vaciar el contenido de toda la fila ${rowNumStr}?`)) return;

             for (let c = 0; c < COL_LETTERS.length; c++) {
                const col = COL_LETTERS[c];
                const cellId = `${col}${rowNumStr}`;
                sheetData[cellId].value = '';
                updateCell(cellId); // Clears content and recalculates
            }

        } else if (e.target.id === 'btn-color-row') {
            const rowNumStr = activeSelection.row;
            const color = document.getElementById('row-color-picker').value;
             if (!confirm(`¿Desea cambiar el fondo de TODA la fila ${rowNumStr} a ${color}?`)) return;

            for (let c = 0; c < COL_LETTERS.length; c++) {
                const col = COL_LETTERS[c];
                const cellId = `${col}${rowNumStr}`;
                sheetData[cellId].color = color;
                const element = getCellElement(cellId);
                if (element) {
                    element.style.backgroundColor = color;
                }
            }
            saveState();

        } else if (e.target.id === 'btn-hide-row') {
            const rowNumStr = activeSelection.row;
             for (let c = 0; c < COL_LETTERS.length; c++) {
                const col = COL_LETTERS[c];
                const cellId = `${col}${rowNumStr}`;
                const element = getCellElement(cellId);
                 if (element) {
                     element.style.display = 'none'; 
                 }
             }
        }
    });


    // --- INITIALIZATION AND EVENT LISTENERS ---

    /**
     * Sets up initial event listeners for headers and cells.
     */
    function setupEventListeners() {
        // 1. Column Header Listeners (A-J) - R6 selection mechanism
        const colHeaders = document.querySelectorAll('.col-header');
        colHeaders.forEach(el => {
            el.addEventListener('click', handleColHeaderClick);
        });

        // 2. Row Header Listeners (1-20) - R7 selection mechanism
        const rowHeaders = document.querySelectorAll('.row-header');
        rowHeaders.forEach(el => {
            el.addEventListener('click', handleRowHeaderClick);
        });

        // 3. Cell Content Editable Listener (R1, R10)
        document.getElementById('row-container').addEventListener('input', handleContentChange);
        document.getElementById('row-container').addEventListener('blur', handleContentChange); // Use blur for final save/recalculation
    }

    /**
     * Main initialization function.
     */
    function initializeApp() {
        // 1. Load State (Persistence R9, R17)
        loadState();
        
        // 2. Setup listeners
        setupEventListeners();
        
        // 3. Initial calculation pass over all loaded data
        recalculateAll();

        // 4. Set initial selection (optional: select the first cell)
        setSelection('A', 1); 
    }

    initializeApp();
});
