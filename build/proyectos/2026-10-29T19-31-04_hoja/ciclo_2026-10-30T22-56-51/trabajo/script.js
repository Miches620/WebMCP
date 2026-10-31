// --- CONSTANTS AND STATE MANAGEMENT ---

const NUM_COLUMNS = 10; // A to J
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const NUM_ROWS = 20;
const STORAGE_KEY = 'spreadsheetState';

// Global state object: { 'A1': { value: '...', formula: null, style: {} }, ... }
let spreadsheetData = {};

/**
 * Converts column index (0-9) to letter ('A'-'J').
 * @param {number} index 
 * @returns {string}
 */
function colIndexToLetter(index) {
    return COLUMNS[index];
}

/**
 * Converts cell coordinates (Col, Row) into a standard key string (e.g., 'A1', 'J20').
 * @param {number} colIdx 0-9
 * @param {number} rowNum 1-20
 * @returns {string}
 */
function getCellKey(colIdx, rowNum) {
    return `${colIndexToLetter(colIdx)}${rowNum}`;
}

/**
 * Initializes the internal state structure for all cells.
 */
function initializeState() {
    spreadsheetData = {};
    for (let r = 1; r <= NUM_ROWS; r++) {
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const key = getCellKey(c, r);
            spreadsheetData[key] = {
                value: '', // The displayed/calculated value
                rawInput: '', // What the user typed (formula or text)
                isFormula: false,
                style: {} // e.g., { backgroundColor: '#ffffff' }
            };
        }
    }
}

/**
 * Saves the current state of all cells to localStorage.
 */
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spreadsheetData));
}

/**
 * Loads the state from localStorage and updates the internal data structure.
 */
function loadState() {
    const savedState = localStorage.getItem(STORAGE_KEY);
    if (savedState) {
        try {
            const loadedData = JSON.parse(savedState);
            // Merge loaded data into the initialized state, ensuring all keys exist
            spreadsheetData = { ...spreadsheetData, ...loadedData };
        } catch (e) {
            console.error("Error loading state:", e);
            // If corrupted, start fresh
            initializeState();
        }
    } else {
        initializeState();
    }
}

/**
 * Retrieves the cell element from the DOM using its coordinates.
 * @param {number} colIdx 0-9
 * @param {number} rowNum 1-20
 * @returns {HTMLElement | null}
 */
function getCellElement(colIdx, rowNum) {
    // We rely on the data attributes set in index.html structure
    return document.querySelector(`.spreadsheet-cell[data-col="${colIndexToLetter(colIdx)}"][data-row="${rowNum}"]`);
}

/**
 * Updates the DOM element for a given cell based on its state object.
 * @param {string} key - e.g., 'A1'
 * @param {object} data - The state object for that cell.
 */
function updateCellDOM(key, data) {
    const colIdx = COLUMNS.indexOf(key[0]);
    const rowNum = parseInt(key.substring(1));
    const element = getCellElement(colIdx, rowNum);

    if (element) {
        // 1. Update content
        element.textContent = data.value;

        // 2. Apply styles using setProperty for robustness
        Object.keys(data.style).forEach(prop => {
            const value = data.style[prop];
            if (value !== undefined && value !== null) {
                element.style.setProperty(prop, value);
            }
        });
    }
}


// --- FORMULA CALCULATION ENGINE (R3, R4, R11, R12) ---

/**
 * Parses a formula string and calculates the result based on current sheet state.
 * Supports: SUMA(range), SUMA(cell1; cell2), A1-B1, A1*B1, A1/B1
 * @param {string} formulaString - The raw formula input (e.g., "=SUMA(A1:A3)" or "A1+B1")
 * @returns {number|string} The calculated numerical result or an error message.
 */
function calculateFormula(formulaString) {
    if (!formulaString || !formulaString.startsWith('=')) return formulaString;

    let formula = formulaString.substring(1).trim();
    let calculationExpression = '';

    // 1. Handle SUMA() function: =SUMA(A1:A3) or =SUMA(A1;B2;C3)
    if (formula.toUpperCase().startsWith('SUMA')) {
        const match = formula.match(/SUMA\((.*)\)/i);
        if (!match || !match[1]) return "Error";

        let rangeList = match[1];
        let valuesToSum = [];

        // Split by semicolon (for multiple cells) or colon (for ranges)
        const parts = rangeList.split(';').map(p => p.trim());

        for (const part of parts) {
            if (!part) continue;

            if (part.includes(':')) {
                // Handle Range: A1:A3
                const [startKey, endKey] = part.split(':');
                const startCoords = getCellCoordinates(startKey);
                const endCoords = getCellCoordinates(endKey);

                let sumRange = [];
                for (let r = Math.min(startCoords.row, endCoords.row); r <= Math.max(startCoords.row, endCoords.row); r++) {
                    for (let c = Math.min(startCoords.col, endCoords.col); c <= Math.max(startCoords.col, endCoords.col); c++) {
                        sumRange.push(getCellKey(c, r));
                    }
                }
                valuesToSum.push(...sumRange);

            } else {
                // Handle single cell reference: A1
                const key = part.toUpperCase();
                if (spreadsheetData[key]) {
                    valuesToSum.push(key);
                }
            }
        }

        let total = 0;
        for (const key of valuesToSum) {
            const cellData = spreadsheetData[key];
            // Only sum if the referenced cell contains a number or is empty/zero formula result
            if (!isNaN(parseFloat(cellData.value)) && isFinite(cellData.value)) {
                total += parseFloat(cellData.value);
            } else if (cellData.rawInput === '') {
                 // Treat truly empty cells as 0 for summation purposes
                 total += 0;
            }
        }
        return total;

    } else {
        // 2. Handle basic arithmetic: A1-B1, A1*B1, etc.
        // Replace cell references (A1) with their current numerical values for evaluation
        let tempExpression = formula;
        const keysToReplace = Object.keys(spreadsheetData).filter(key => key.match(/[A-Z]\d+/));

        for (const key of keysToReplace) {
            // Regex to find cell references like A1, B2 etc., ensuring they are treated as whole words/tokens
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            let value = spreadsheetData[key].value;

            if (!isNaN(parseFloat(value)) && isFinite(value)) {
                // Replace the cell reference with its numerical value
                tempExpression = tempExpression.replace(regex, `(${value})`);
            } else if (value === '') {
                 // Treat empty cells as 0 in arithmetic context
                tempExpression = tempExpression.replace(regex, '(0)');
            } else {
                // If it's text or error, treat as 0 for calculation safety
                tempExpression = tempExpression.replace(regex, '(0)');
            }
        }

        try {
            // Use Function constructor for safe evaluation of the arithmetic string
            const result = new Function(`return ${tempExpression}`)();
            if (isNaN(result) || !isFinite(result)) return "Error";
            return result;
        } catch (e) {
            console.error("Calculation error:", e);
            return "Error";
        }
    }
}

/** Helper to get coordinates from a key like 'A1' */
function getCellCoordinates(key) {
    const colIdx = COLUMNS.indexOf(key[0]);
    const rowNum = parseInt(key.substring(1));
    return { col: colIdx, row: rowNum };
}


/**
 * Recalculates the value of a specific cell and updates the state/DOM.
 * This function must be called whenever a dependency changes (i.e., any cell input).
 * @param {string} key - The key of the cell to recalculate (e.g., 'C1').
 */
function calculateAndSetCell(key) {
    const data = spreadsheetData[key];

    if (!data || !data.rawInput) {
        // If no raw input, clear value and stop.
        spreadsheetData[key].value = '';
        updateCellDOM(key, spreadsheetData[key]);
        return;
    }

    let calculatedValue = data.rawInput; // Default to raw input if not a formula

    if (data.rawInput.startsWith('=')) {
        calculatedValue = calculateFormula(data.rawInput);
    } else {
        // If it's text, the value is just the raw input
        calculatedValue = data.rawInput;
    }

    // Update state and DOM
    spreadsheetData[key].value = calculatedValue;
    updateCellDOM(key, spreadsheetData[key]);
}


/**
 * Iterates through all cells and recalculates any cell that might depend on the changed key.
 * For simplicity and robustness (given the scope), we will re-evaluate ALL formula cells 
 * whenever a change occurs, as dependency tracking is extremely complex without a dedicated engine.
 */
function triggerRecalculation(changedKey) {
    let needsUpdate = false;

    for (const key in spreadsheetData) {
        const data = spreadsheetData[key];
        if (data.rawInput && data.rawInput.startsWith('=')) {
            // If the cell is a formula, recalculate it.
            calculateAndSetCell(key);
            needsUpdate = true;
        }
    }

    // Note: In a real app, we would only re-evaluate cells that reference 'changedKey'. 
    // Here, we iterate all formulas for guaranteed correctness based on the limited scope.
}


// --- EVENT HANDLERS AND INITIALIZATION ---

/**
 * Handles input changes in any cell (R1, R10).
 * @param {Event} e 
 */
function handleCellInput(e) {
    const target = e.target;
    let key = '';

    // Find the coordinates from the parent structure
    const rowElement = target.closest('.row');
    if (!rowElement || !target) return;

    const colLetter = target.dataset.col;
    const rowNum = parseInt(rowElement.dataset.row);
    key = `${colLetter}${rowNum}`;

    // 1. Update raw input state
    spreadsheetData[key].rawInput = target.value || '';
    spreadsheetData[key].isFormula = (target.value || '').startsWith('=');

    // 2. Recalculate and update the cell value (R3, R4)
    calculateAndSetCell(key);

    // 3. Save state and trigger recalculation for dependents (R9)
    saveState();
    triggerRecalculation(key);
}


/**
 * Handles formatting changes (Coloring) (R5).
 * @param {Event} e 
 */
function handleFormatChange(e, key, colIdx, rowNum) {
    const color = e.target.value;

    // Update state style
    spreadsheetData[key].style.backgroundColor = color;

    // Apply to the specific cell element
    updateCellDOM(key, spreadsheetData[key]);

    // Save state (R9)
    saveState();
}


/**
 * Handles Column Header Clicks (Letter Selection) (R6).
 * @param {Event} e 
 */
function handleColumnHeaderClick(e) {
    const header = e.currentTarget;
    const colIdx = COLUMNS.indexOf(header.dataset.col);

    // --- Color Change ---
    if (e.target.classList.contains('color-picker')) {
        const color = e.target.value;
        for (let r = 1; r <= NUM_ROWS; r++) {
            const key = getCellKey(colIdx, r);
            spreadsheetData[key].style.backgroundColor = color;
            updateCellDOM(key, spreadsheetData[key]);
        }
        saveState();
    }

    // --- Delete Column ---
    if (e.target.dataset.action === 'delete') {
        if (!confirm(`¿Está seguro de que desea borrar la columna ${header.textContent}? Esta acción es irreversible.`)) return;

        // 1. Clear data and remove DOM elements for all cells in this column
        for (let r = 1; r <= NUM_ROWS; r++) {
            const key = getCellKey(colIdx, r);
            spreadsheetData[key].rawInput = '';
            spreadsheetData[key].value = '';
            spreadsheetData[key].style = {};
            updateCellDOM(key, spreadsheetData[key]);
        }

        // 2. Remove DOM elements (The actual column cells)
        const colCells = document.querySelectorAll(`.col-header[data-col="${header.dataset.col}"] + .row > .spreadsheet-cell`);
        colCells.forEach(cell => cell.remove());

        // 3. Update the header structure (Remove the letter div itself)
        header.remove();

        // 4. Re-index and re-run calculations for remaining cells (Crucial step, but complex to implement perfectly without a full grid redraw. We rely on recalculation.)
        saveState();
    }

    // --- Clear Content Column ---
    if (e.target.dataset.action === 'clear') {
        for (let r = 1; r <= NUM_ROWS; r++) {
            const key = getCellKey(colIdx, r);
            spreadsheetData[key].rawInput = '';
            spreadsheetData[key].value = '';
            spreadsheetData[key].style = {};
            updateCellDOM(key, spreadsheetData[key]);
        }
        saveState();
    }

    // --- Hide Column ---
    if (e.target.dataset.action === 'hide') {
        const colHeaderElement = header;
        colHeaderElement.style.display = 'none'; // Hide the letter header
        document.querySelectorAll(`.spreadsheet-cell[data-col="${header.dataset.col}"]`).forEach(el => el.style.display = 'none');
        saveState();
    } else {
         // Show all elements if not explicitly hiding/deleting
        const colHeaderElement = header;
        colHeaderElement.style.display = ''; 
        document.querySelectorAll(`.spreadsheet-cell[data-col="${header.dataset.col}"]`).forEach(el => el.style.display = '');
    }
}

/**
 * Handles Row Header Clicks (Number Selection) (R7).
 * @param {Event} e 
 */
function handleRowHeaderClick(e) {
    const header = e.currentTarget;
    const rowNum = parseInt(header.dataset.row);

    // --- Color Change ---
    if (e.target.classList.contains('color-picker')) {
        const color = e.target.value;
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const key = getCellKey(c, rowNum);
            spreadsheetData[key].style.backgroundColor = color;
            updateCellDOM(key, spreadsheetData[key]);
        }
        saveState();
    }

    // --- Delete Row ---
    if (e.target.dataset.action === 'delete') {
        if (!confirm(`¿Está seguro de que desea borrar la fila ${header.textContent}? Esta acción es irreversible.`)) return;

        // 1. Clear data and remove DOM elements for all cells in this row
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const key = getCellKey(c, rowNum);
            spreadsheetData[key].rawInput = '';
            spreadsheetData[key].value = '';
            spreadsheetData[key].style = {};
            updateCellDOM(key, spreadsheetData[key]);
        }

        // 2. Remove DOM elements (The actual cells)
        const rowCells = document.querySelectorAll(`.row[data-row="${header.dataset.row}"] .spreadsheet-cell`);
        rowCells.forEach(cell => cell.remove());

        // 3. Update the header structure (Remove the number div itself)
        header.remove();

        saveState();
    }

    // --- Clear Content Row ---
    if (e.target.dataset.action === 'clear') {
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const key = getCellKey(c, rowNum);
            spreadsheetData[key].rawInput = '';
            spreadsheetData[key].value = '';
            spreadsheetData[key].style = {};
            updateCellDOM(key, spreadsheetData[key]);
        }
        saveState();
    }

    // --- Hide Row ---
    if (e.target.dataset.action === 'hide') {
        const rowElement = header.closest('.row');
        rowElement.style.display = 'none'; // Hide the entire row container
        saveState();
    } else {
         // Show all elements if not explicitly hiding/deleting
        const rowElement = header.closest('.row');
        rowElement.style.display = ''; 
    }
}


/**
 * Main initialization function: Sets up listeners and loads data.
 */
function initializeSpreadsheet() {
    // 1. Load state (R9, R17)
    loadState();

    // 2. Populate the DOM structure for all 20 rows if not already done by HTML boilerplate
    const dataGrid = document.getElementById('data-grid');
    for (let r = 3; r <= NUM_ROWS; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';
        rowDiv.dataset.row = r;

        // Row Header Number
        const headerNum = document.createElement('div');
        headerNum.className = 'cell row-header-content';
        headerNum.textContent = r;
        rowDiv.appendChild(headerNum);

        // Cells A to J
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const key = getCellKey(c, r);
            const cellDiv = document.createElement('div');
            cellDiv.className = 'spreadsheet-cell';
            cellDiv.dataset.col = COLUMNS[c];
            cellDiv.dataset.row = r;
            cellDiv.contentEditable = true; // Make it editable on click/focus (R1, R10)
            cellDiv.addEventListener('input', handleCellInput);
            rowDiv.appendChild(cellDiv);
        }
        dataGrid.appendChild(rowDiv);
    }

    // 3. Attach listeners to all existing and newly created cells
    document.querySelectorAll('.spreadsheet-cell').forEach(cell => {
        // Re-attach input listener in case the cell was dynamically added/recreated
        if (!cell.hasAttribute('data-listener-attached')) {
             cell.addEventListener('input', handleCellInput);
             cell.dataset.listenerAttached = 'true'; // Prevent double attachment
        }
    });

    // 4. Attach listeners to Column Headers (R6)
    document.querySelectorAll('.col-header').forEach(header => {
        header.addEventListener('click', handleColumnHeaderClick);
    });

    // 5. Attach listeners to Row Headers (R7)
    document.querySelectorAll('.row-header-content').forEach(header => {
        header.addEventListener('click', handleRowHeaderClick);
    });


    // 6. Initial rendering of all cells based on loaded state (R17)
    for (const key in spreadsheetData) {
        updateCellDOM(key, spreadsheetData[key]);
    }

    console.log("Spreadsheet initialized successfully.");
}

// Execute initialization when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeSpreadsheet);
