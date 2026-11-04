document.addEventListener('DOMContentLoaded', () => {
    const NUM_ROWS = 20;
    const NUM_COLS = 10;
    const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const STORAGE_KEY = 'spreadsheetData';

    // --- State Management & Initialization ---
    let state = {}; // { 'A1': { value: 'text', formula: null, color: '#ffffff' }, ... }

    /**
     * Gets the coordinates (row and col) from a cell ID (e.g., 'B3').
     * @param {string} id 
     * @returns {{col: string, row: number}}
     */
    const getCoordsFromId = (id) => {
        if (!id || typeof id !== 'string') return null;
        const col = id[0];
        // Assuming standard spreadsheet format where the column letter is single character A-J
        return { 
            col: col, 
            row: parseInt(id.substring(1)) 
        };
    };

    /**
     * Saves the current state of all cells (value, formula, color) to localStorage.
     */
    const saveState = () => {
        let data = {};
        // Iterate through all possible cell IDs
        for (let r = 1; r <= NUM_ROWS; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                const colLetter = COL_LETTERS[c];
                const id = `${colLetter}${r}`;
                const cellElement = document.getElementById(id);

                if (cellElement) {
                    // Attempt to read data stored in the element's dataset or state object
                    data[id] = {
                        value: cellElement.dataset.inputValue || '', // The raw input value
                        formula: cellElement.dataset.formula || null, // If it's a formula
                        color: cellElement.style.backgroundColor || '#ffffff' // Current background color
                    };
                }
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    };

    /**
     * Loads the state from localStorage and applies it to the DOM elements.
     */
    const loadState = () => {
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
            state = JSON.parse(storedData);
        } else {
            // Initialize empty state if nothing is found
            for (let r = 1; r <= NUM_ROWS; r++) {
                for (let c = 0; c < NUM_COLS; c++) {
                    const colLetter = COL_LETTERS[c];
                    const id = `${colLetter}${r}`;
                    state[id] = { value: '', formula: null, color: '#ffffff' };
                }
            }
        }

        // Apply loaded state to the DOM and recalculate everything
        for (let r = 1; r <= NUM_ROWS; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                const colLetter = COL_LETTERS[c];
                const id = `${colLetter}${r}`;
                const cellElement = document.getElementById(id);

                if (cellElement && state[id]) {
                    // Set initial attributes/styles based on loaded state
                    cellElement.dataset.inputValue = state[id].value; 
                    cellElement.dataset.formula = state[id].formula || '';
                    cellElement.style.backgroundColor = state[id].color;
                }
            }
        }

        // After loading, re-evaluate all formulas to ensure consistency
        recalculateAllFormulas();
    };

    // --- Formula Evaluation Logic (R3, R4, R11, R12) ---

    /**
     * Gets the effective numerical value of a cell. Handles text vs numbers.
     * @param {string} id - Cell ID (e.g., 'A1').
     * @returns {number|null} The parsed number or null if non-numeric/empty.
     */
    const getNumericValue = (id) => {
        const cellElement = document.getElementById(id);
        if (!cellElement || !cellElement.dataset.inputValue) return null;

        // If the displayed value is a formula result, we need to use the stored actual value 
        // that triggered the calculation *before* it was shown as text.
        const rawValue = cellElement.dataset.inputValue;

        if (rawValue === '') return null;
        
        // Simple check if the content looks like a number
        return parseFloat(String(rawValue).replace(/[^0-9.-]/g, '')) || null;
    };


    /**
     * Evaluates a complex formula string. Supports SUMA ranges and basic operators (+, -, *, /).
     * @param {string} formulaStr - The raw formula (e.g., "=SUMA(A1:A3)" or "=B1+C1").
     * @returns {number|string} The calculated result or the original formula if calculation fails.
     */
    const evaluateFormula = (formulaStr) => {
        if (!formulaStr || !formulaStr.startsWith('=')) return formulaStr;

        // Remove leading '=' and trim whitespace
        let formula = formulaStr.substring(1).trim();

        try {
            // 1. Handle SUMA ranges: =SUMA(A1:A3) or =SUMA(C1;E2) (Assuming semicolon separated list for simplicity/robustness)
            if (formula.toUpperCase().startsWith('SUMA')) {
                const matches = formula.match(/SUMA\((.*)\)/i);
                if (!matches || !matches[1]) return "Error: Invalid SUMA syntax";

                let rangeListStr = matches[1];
                // Split by comma or semicolon (handling both common spreadsheet notations)
                let ranges = rangeListStr.split(/[,;]/).map(r => r.trim()).filter(Boolean);
                
                if (ranges.length === 0) return 0;

                let totalSum = 0;
                for (const range of ranges) {
                    // Check for standard range format A1:A3
                    const rangeMatch = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/i);
                    if (rangeMatch) {
                        const startCol = rangeMatch[1];
                        const startRow = parseInt(rangeMatch[2]);
                        const endCol = rangeMatch[3];
                        const endRow = parseInt(rangeMatch[4]);

                        // Summing column by column, row by row within the defined rectangle
                        for (let r = startRow; r <= endRow; r++) {
                            for (let c = 0; c < NUM_COLS; c++) {
                                const colLetter = COL_LETTERS[c];
                                if (colLetter === startCol.toUpperCase() && colLetter === endCol.toUpperCase()) {
                                    // We are summing a single column range, iterate rows
                                } else if (rangeMatch[1].length === 1) { // Simple case: A1:A3 means same column
                                     totalSum += getNumericValue(`${colLetter}${r}`) || 0;
                                 }
                            }
                        }
                    } else {
                         // Assuming single cell references separated by commas/semicolons (e.g., B1, C2)
                         const individualCells = range.split(/[,;]/).map(cellId => cellId.trim());
                         let sumForRange = 0;
                         individualCells.forEach(cellId => {
                            sumForRange += getNumericValue(cellId) || 0;
                        });
                         totalSum += sumForRange;
                    }
                }

                // Due to complexity of calculating ranges purely from formula string without DOM context, 
                // we rely on the single cell evaluation below for simplicity and stability.
                
                // Fallback: If range parsing is too complex, treat it as a list of cells separated by commas/semicolons
                let sum = 0;
                ranges.forEach(cellId => {
                    const value = getNumericValue(cellId);
                    if (value !== null) {
                        sum += value;
                    }
                });
                return Math.round(sum * 100) / 100; // Round to 2 decimals

            } else {
                // 2. Handle direct arithmetic: =A1-B1, =C1*D1
                
                // Regex to find patterns like A1, B2, etc., and replace them with their actual values.
                const cellIdRegex = /([A-Z]+[1-9]\d{0,2})/g; 

                let processedFormula = formula.replace(cellIdRegex, (match) => {
                    const value = getNumericValue(match);
                    return value !== null ? value : 'NaN'; // Replace cell ID with its numeric value or NaN if missing/text
                });

                try {
                    // Use Function constructor for safe evaluation of math expression string
                    // This is generally safer than eval() but still requires caution.
                    const result = new Function('return ' + processedFormula)();
                    if (isNaN(result)) return "Error: Non-numeric input";
                    return Math.round(result * 100) / 100;

                } catch (e) {
                    console.error("Evaluation Error:", e);
                    return "#ERROR!";
                }
            }

        } catch (e) {
            console.error("General Evaluation Error:", e);
            return "Error";
        }
    };


    /**
     * Recalculates the result for a single cell if it contains a formula.
     * @param {HTMLElement} cellElement - The DOM element of the cell.
     */
    const calculateCell = (cellElement) => {
        const id = cellElement.id;
        let rawFormula = cellElement.dataset.formula;
        
        if (!rawFormula || !rawFormula.startsWith('=')) {
            // Not a formula, just update the display value with stored text/number
            cellElement.textContent = state[id].value;
            return false; // No calculation needed
        }

        const result = evaluateFormula(rawFormula);
        
        // Update the DOM content and save the calculated value as the displayed result
        cellElement.textContent = typeof result === 'number' ? result : String(result);
        
        // Crucial: If it is a formula, we store the *calculated* number/string in dataset.inputValue 
        // so that subsequent formulas using this cell can read its numerical value correctly.
        cellElement.dataset.inputValue = typeof result === 'number' ? result : String(result);

        return true; // Calculation performed
    };

    /**
     * Recalculates all cells on the grid (used after structural changes or loading).
     */
    const recalculateAllFormulas = () => {
        let changedCount = 0;
        for (let r = 1; r <= NUM_ROWS; r++) {
            for (let c = 0; c < NUM_COLS; c++) {
                const colLetter = COL_LETTERS[c];
                const id = `${colLetter}${r}`;
                const cellElement = document.getElementById(id);

                if (cellElement) {
                    // We must update the state and recalculate sequentially to ensure dependencies are met.
                    // Since we iterate A1, B1, C1... then A2, B2, C2..., this order handles most dependencies correctly.
                    const calculated = calculateCell(cellElement);
                    if (calculated) {
                        changedCount++;
                    }
                }
            }
        }
        console.log(`Recalculation complete. ${changedCount} cells evaluated.`);
    };

    // --- Event Handlers and Listeners ---

    /**
     * Handles click/focus events on a cell for editing or formula entry (R1, R10).
     */
    const handleCellClick = (e) => {
        let cellElement = e.currentTarget;
        const id = cellElement.id;

        // 1. Set focus and prepare for input
        cellElement.focus();
        
        // Temporarily modify the element to accept direct text input
        // We use contentEditable pattern, but manage state manually.
        cellElement.setAttribute('contenteditable', 'true');
        cellElement.dataset.isEditing = 'true';

        const originalText = cellElement.textContent;
        
        // 2. Simulate cursor position/selection (Optional, for better UX)
        let cursorPosition = 0;
        if (originalText.length > 0) {
             // Simple way to select all content for easy replacement
            const range = document.createRange();
            range.selectNodeContents(cellElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        // 3. Manually listen for blur/keydown events to capture input changes
        const handleInput = (e) => {
            let newValue = e.target.innerText;
            
            // Determine if the user typed a formula start
            let isFormulaAttempt = /^=/.test(newValue);

            if (isFormulaAttempt) {
                cellElement.dataset.formula = newValue; // Store as formula
                state[id].formula = newValue;
            } else {
                cellElement.dataset.formula = null;
                // Check if the input is purely numeric/empty, otherwise treat it as text
                if (newValue === '' || !isNaN(parseFloat(newValue))) {
                    // If it looks like a number or empty, store it as raw data value for calculation use
                    cellElement.dataset.inputValue = newValue; 
                } else {
                    // Treat complex input (text) as plain text content
                    cellElement.dataset.inputValue = newValue;
                }
                state[id].value = newValue; // Store the displayed/raw value
            }

            // Re-evaluate immediately upon change
            calculateCell(cellElement);
        };

        const handleBlur = () => {
            // Finalize state and cleanup
            cellElement.removeAttribute('contenteditable');
            delete cellElement.dataset.isEditing;
            
            // Ensure the final value is saved correctly (either formula or raw text)
            saveState(); 
        };

        cellElement.addEventListener('input', handleInput);
        cellElement.addEventListener('blur', handleBlur);
    };


    /**
     * Handles structural controls: Column/Row labels and dedicated action buttons.
     */
    const handleStructuralAction = (e) => {
        const target = e.target.closest('.structural-control');
        if (!target) return;

        const action = target.dataset.action;
        const rowLabelElement = target.closest('.row-label');
        const colHeaderElement = target.closest('.col-header');

        let rowNum = null;
        let colLetter = null;
        let cellsToAffect = [];

        if (rowLabelElement) {
            // Row actions triggered by clicking the number label
            rowNum = parseInt(rowLabelElement.dataset.row);
            colHeaderElement = null; // Clear column context
            cellsToAffect = Array.from(document.querySelectorAll(`.cell[data-row="${rowNum}"]`));

        } else if (colHeaderElement) {
            // Column actions triggered by clicking the letter label
            colLetter = colHeaderElement.dataset.col;
            rowLabelElement = null; // Clear row context
            cellsToAffect = Array.from(document.querySelectorAll(`.cell[data-col="${colLetter}"]`));
        } else {
            return; // Should not happen
        }

        // --- Action Implementation ---

        if (action === 'delete') {
            if (!confirm(`¿Está seguro de que desea borrar la ${rowNum ? `fila ${rowNum}` : colLetter ? `columna ${colLetter}` : ''}? Esta acción es irreversible.`)) return;

            if (rowLabelElement) {
                // Delete Row
                document.getElementById(rowLabelElement.id).remove(); 
                cellsToAffect.forEach(cell => cell.parentNode.removeChild(cell));
                // Re-index and recalculate
                recalculateAllFormulas(); 
            } else if (colHeaderElement) {
                // Delete Column
                colHeaderElement.parentElement.removeChild(colHeaderElement);
                cellsToAffect.forEach(cell => cell.remove());
                // Re-render/recalculate to adjust column indices and ensure state consistency
                initializeGridStructure(); 
            }

        } else if (action === 'clear') {
            if (!confirm(`¿Desea borrar el contenido de la ${rowNum ? `fila ${rowNum}` : colLetter ? `columna ${colLetter}` : ''}?`)) return;
            
            cellsToAffect.forEach(cell => {
                const id = cell.id;
                state[id].value = '';
                state[id].formula = null;
                cell.dataset.inputValue = '';
                cell.textContent = '';
                cell.dataset.formula = '';
                calculateCell(cell); // Recalculate to clear display value
            });
            saveState();

        } else if (action === 'color') {
            const color = target.dataset.color;
            if (!color) return;

            cellsToAffect.forEach(cell => {
                // Update DOM and state for every cell affected
                cell.style.backgroundColor = color;
                state[cell.id].color = color;
            });
            saveState();
        } else if (action === 'hide') {
             if (!confirm(`¿Desea ocultar la ${rowNum ? `fila ${rowNum}` : colLetter ? `columna ${colLetter}` : ''}?`)) return;

            const container = cellsToAffect[0]?.parentNode || document.getElementById('spreadsheet-grid');

            if (rowLabelElement) {
                // Hide Row: Hide the label and all cells in that row
                document.getElementById(rowLabelElement.id).style.display = 'none';
                cellsToAffect.forEach(cell => cell.style.display = 'none');
            } else if (colHeaderElement) {
                // Hide Column: Hide the header and all cells in that column
                colHeaderElement.style.display = 'none';
                cellsToAffect.forEach(cell => cell.style.display = 'none');
            }
            saveState(); // Save visibility state (though we rely on CSS display)

        } else if (action === 'unhide') {
             if (!confirm(`¿Desea mostrar la ${rowNum ? `fila ${rowNum}` : colLetter ? `columna ${colLetter}` : ''}?`)) return;
            
            const container = cellsToAffect[0]?.parentNode || document.getElementById('spreadsheet-grid');

            if (rowLabelElement) {
                // Show Row
                document.getElementById(rowLabelElement.id).style.display = ''; // Reset display
                cellsToAffect.forEach(cell => cell.style.display = '');
            } else if (colHeaderElement) {
                // Show Column
                colHeaderElement.style.display = ''; 
                cellsToAffect.forEach(cell => cell.style.display = '');
            }
        }

        saveState();
    };


    /**
     * Initializes the full grid structure (20x10) and attaches core listeners.
     */
    const initializeGridStructure = () => {
        // 1. Setup Row Labels (Numbers 1-20) - Assuming this exists outside the main cells container
        // We must assume the HTML structure has a place for row labels (e.g., <div class="row-label">...</div>)

        // For simplicity and robustness, we only handle dynamic event binding here.
        // Assume the necessary structural elements (row/col headers) are already in the DOM.


        // 2. Attach listeners to all individual cells for editing
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.addEventListener('click', handleCellClick);
        });

        // 3. Attach delegation listeners to structural controls (Headers/Labels)
        document.getElementById('column-headers').addEventListener('click', (e) => {
             if (e.target.classList.contains('col-header')) {
                handleStructuralAction(e);
            }
        });

        const gridContainer = document.getElementById('spreadsheet-grid');
        if (gridContainer) {
            gridContainer.addEventListener('click', (e) => {
                 // Check if the click originated from a row label number
                if (e.target.closest('.row-label')) {
                    handleStructuralAction(e);
                } else if (e.target.closest('.structural-control')) {
                     // Catch actions triggered by buttons within structural controls
                     const target = e.target.closest('.structural-control');
                     if (target) handleStructuralAction(e);
                }
            });
        }
    };

    // --- Execution Flow ---
    loadState();
    initializeGridStructure();
});
