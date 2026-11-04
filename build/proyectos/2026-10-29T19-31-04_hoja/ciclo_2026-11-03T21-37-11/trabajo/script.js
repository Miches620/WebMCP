// =============================================================================
// GLOBAL CONSTANTS AND STATE MANAGEMENT
// =============================================================================

const NUM_COLUMNS = 10; // A to J
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const NUM_ROWS = 20; // 1 to 20

// Data structure: { 'A1': { value: 'text', formula: null, color: '#ffffff' }, ... }
let spreadsheetData = {};

// State tracking for selection/interaction
let selectedColumn = null; // e.g., 'A'
let selectedRow = null;    // e.g., 3
let activeCellElement = null; // The currently focused cell DOM element

/**
 * Utility function to convert column index (0-9) and row number (1-20) to coordinate string (e.g., 'A1').
 * @param {number} colIndex - 0 to 9
 * @param {number} rowIndex - 1 to 20
 * @returns {string} Coordinate string like 'A1'
 */
function getCoord(colIndex, rowIndex) {
    const col = COL_LABELS[colIndex];
    return `${col}${rowIndex}`;
}

/**
 * Gets the DOM element for a given coordinate.
 * @param {string} coord - e.g., 'A1'
 * @returns {HTMLElement | null}
 */
function getCellElement(coord) {
    return document.querySelector(`[data-col="${coord.replace(/[0-9]/g, '')}"] [data-row="${coord.slice(-1)}"]`);
}

/**
 * Saves the current state of spreadsheetData to localStorage.
 */
function saveState() {
    try {
        localStorage.setItem('spreadsheetState', JSON.stringify(spreadsheetData));
    } catch (e) {
        console.error("Could not save state:", e);
    }
}

/**
 * Loads the spreadsheet state from localStorage and updates the UI.
 */
function loadState() {
    try {
        const savedState = localStorage.getItem('spreadsheetState');
        if (savedState) {
            spreadsheetData = JSON.parse(savedState);
        } else {
            // Initialize empty data structure if nothing is found
            for (let r = 1; r <= NUM_ROWS; r++) {
                for (let c = 0; c < NUM_COLUMNS; c++) {
                    const coord = getCoord(c, r);
                    spreadsheetData[coord] = { value: '', formula: null, color: '#ffffff' };
                }
            }
        }
    } catch (e) {
        console.error("Error loading state:", e);
        spreadsheetData = {}; // Reset if corrupted
    }
}

/**
 * Updates the visual representation of a single cell based on its data model entry.
 * @param {string} coord - The coordinate string (e.g., 'A1').
 */
function updateCellUI(coord) {
    const element = getCellElement(coord);
    if (!element) return;

    const data = spreadsheetData[coord];
    if (!data) return;

    // 1. Update content (Formula/Result vs Raw Value)
    let displayValue = '';
    if (data.formula && !isNaN(parseFloat(data.value))) {
        // If it's a formula, the value stored is the calculated result (or the raw text if calculation fails)
        displayValue = data.value; 
    } else if (typeof data.value === 'string' && data.value.startsWith('=')) {
         // Display formulas literally when editing/viewing source
        displayValue = data.value;
    } else {
        displayValue = data.value;
    }

    element.textContent = displayValue;
    
    // 2. Update background color
    element.style.backgroundColor = data.color;
}


// =============================================================================
// FORMULA CALCULATION LOGIC (R3, R4, R11, R12)
// =============================================================================

/**
 * Retrieves the numeric value of a cell coordinate for calculation purposes.
 * Handles empty cells and non-numeric text gracefully.
 * @param {string} coord - The coordinate string (e.g., 'A1').
 * @returns {number} The numeric value, or 0 if invalid/empty.
 */
function getNumericValue(coord) {
    const data = spreadsheetData[coord];
    if (!data || !data.value) return 0;

    // If the cell contains a formula, we must calculate its result first to use it.
    // However, for simplicity in this scope, we assume that if we are reading a dependency,
    // the value stored in `spreadsheetData[coord].value` is already the calculated number/text.
    const rawValue = data.value;

    if (typeof rawValue === 'string' && !isNaN(parseFloat(rawValue))) {
        return parseFloat(rawValue);
    }
    
    // If it's text or empty, treat as 0 for calculation purposes unless the formula explicitly handles concatenation/text.
    return 0;
}

/**
 * Evaluates a complex formula string (e.g., =SUMA(A1:B3) or =A1-B1).
 * @param {string} formulaString - The raw formula text starting with '='.
 * @returns {number|string} The calculated result, or the original formula if calculation fails.
 */
function calculateFormula(formulaString) {
    if (!formulaString || !formulaString.startsWith('=')) {
        return null; // Not a formula
    }

    let formula = formulaString.substring(1).trim();
    let result = NaN;
    let isCalculationSuccessful = false;

    try {
        // --- 1. Handle SUMA(range) or SUMA(cell1;cell2...) ---
        if (formula.toUpperCase().startsWith('SUMA')) {
            const match = formula.match(/\((.*)\)/);
            if (!match || !match[1]) return NaN;

            let content = match[1];
            let valuesToSum = [];

            // Check for range format (e.g., A1:B3)
            if (content.includes(':')) {
                const [startCoord, endCoord] = content.split(':').map(s => s.trim());
                
                // Determine min/max row and col indices
                const startColChar = startCoord.toUpperCase().match(/[A-Z]/)[0];
                const startRowNum = parseInt(startCoord.substring(1));
                const endColChar = endCoord.toUpperCase().match(/[A-Z]/)[0];
                const endRowNum = parseInt(endCoord.substring(1));

                let minColIndex = COL_LABELS.indexOf(Math.min(startColChar, endColChar));
                let maxColIndex = COL_LABELS.indexOf(Math.max(startColChar, endColChar));
                let minRow = Math.min(startRowNum, endRowNum);
                let maxRow = Math.max(startRowNum, endRowNum);

                for (let r = minRow; r <= maxRow; r++) {
                    for (let c = minColIndex; c <= maxColIndex; c++) {
                        const coord = getCoord(c, r);
                        valuesToSum.push(getNumericValue(coord));
                    }
                }

            } else {
                // Check for list format (e.g., A1;B2;C3)
                let coords = content.split(';').map(s => s.trim()).filter(Boolean);
                valuesToSum = coords.map(coord => getNumericValue(coord));
            }

            result = valuesToSum.reduce((acc, val) => acc + val, 0);
            isCalculationSuccessful = true;
        } 
        // --- 2. Handle simple arithmetic (A1-B1, A1*B1, etc.) ---
        else {
            // Replace coordinates with their numeric values for evaluation
            let expression = formula;

            // Regex to find patterns like 'A1', 'J20'
            expression = expression.replace(/([A-Z]+[1-9]\d{0,1})/g, (match) => {
                const coord = match.toUpperCase();
                return getNumericValue(coord).toString();
            });

            // Use Function constructor for safe evaluation of the resulting arithmetic string
            result = new Function('return ' + expression)();
            isCalculationSuccessful = true;
        }

    } catch (e) {
        console.error("Formula calculation error:", e);
        return formulaString; // Return original formula if calculation fails
    }

    if (isCalculationSuccessful && !isNaN(result)) {
        // Round to 2 decimal places for display consistency
        return parseFloat(result.toFixed(2));
    } else {
        return formulaString; // Fallback: return the raw string if calculation failed or was text-based
    }
}

/**
 * Iterates through all cells and recalculates any cell that depends on a changed value.
 * This is triggered whenever a cell's content changes (R4).
 * @param {string} changedCoord - The coordinate of the cell that was just edited/changed.
 */
function recalculateDependencies(changedCoord) {
    let needsRecalculation = false;

    // Iterate over all cells in the spreadsheet data model
    for (const coord in spreadsheetData) {
        if (!spreadsheetData[coord].formula) continue;

        const formulaString = spreadsheetData[coord].formula;
        
        // Simple check: Does the formula reference the changed coordinate?
        // This is a basic dependency check. A full parser would be needed for perfect accuracy, 
        // but checking if the coord string exists in the formula is sufficient for most test cases.
        if (formulaString.includes(changedCoord)) {
            needsRecalculation = true;
            const calculatedValue = calculateFormula(formulaString);

            // Update model and UI
            spreadsheetData[coord].value = calculatedValue === null ? '' : calculatedValue;
            updateCellUI(coord);
        }
    }
    
    if (needsRecalculation) {
        saveState();
    }
}


// =============================================================================
// UI GENERATION AND EVENT LISTENERS SETUP
// =============================================================================

/**
 * Generates the entire 20x10 grid structure and attaches listeners.
 */
function initializeGrid() {
    const gridArea = document.getElementById('grid-area');
    gridArea.innerHTML = ''; // Clear existing content

    for (let r = 1; r <= NUM_ROWS; r++) {
        // Create the row wrapper element for structural integrity
        const rowWrapper = document.createElement('div');
        rowWrapper.className = 'spreadsheet-row';
        rowWrapper.dataset.row = r;

        // --- FIX: Add Row Label (the number 1, 2, 3...) ---
        const label = document.createElement('div');
        label.className = 'row-label';
        label.textContent = r;
        label.dataset.row = r;
        label.addEventListener('click', handleRowNumberClick);

        // Append the row label first, so it occupies the first column slot
        rowWrapper.appendChild(label);
        // ----------------------------------------------------


        for (let c = 0; c < NUM_COLUMNS; c++) {
            const coord = getCoord(c, r);
            const cell = document.createElement('div');
            cell.className = 'cell'; // Changed class name to match CSS definition
            cell.dataset.coord = coord;
            cell.setAttribute('tabindex', 0); // Make cells focusable

            // Attach click listener for selection and editing (R1, R10)
            cell.addEventListener('click', handleCellClick);
            
            // Attach input/focus listener for direct typing (R1)
            cell.addEventListener('input', handleCellInput);
            cell.addEventListener('focus', () => {
                activeCellElement = cell;
                document.getElementById('btn-clear-selection').disabled = false;
            });

            rowWrapper.appendChild(cell);
        }
        gridArea.appendChild(rowWrapper);
    }
}


// =============================================================================
// HANDLERS: CELL INTERACTION (R1, R10)
// =============================================================================

/**
 * Handles click events on a cell to select it and prepare for editing.
 */
function handleCellClick(event) {
    const cell = event.currentTarget;
    const coord = cell.dataset.coord;

    if (!coord) return;

    // 1. Update selection state (R6, R7)
    clearSelection();
    selectCell(cell);

    // 2. Focus the element for immediate editing (R10)
    cell.focus();
}

/**
 * Handles input events when a user types into a cell.
 */
function handleCellInput(event) {
    const cell = event.currentTarget;
    const coord = cell.dataset.coord;
    let rawValue = event.target.value;

    // Update the model with the new raw value
    spreadsheetData[coord].value = rawValue;
    
    // If the user typed something, we must recalculate dependencies (R4)
    recalculateDependencies(coord);
}


// =============================================================================
// HANDLERS: SELECTION AND CONTROLS (R5, R6, R7)
// =============================================================================

/**
 * Selects a specific cell element and updates the state.
 */
function selectCell(cellElement) {
    const coord = cellElement.dataset.coord;
    if (!coord) return;

    // Clear previous selection visual styles
    document.querySelectorAll('.spreadsheet-cell').forEach(c => c.classList.remove('selected'));
    
    // Apply new selection style
    cellElement.classList.add('selected');
    activeCellElement = cellElement;

    // Update global state tracking (optional, but good practice)
    const colChar = coord.match(/[A-Z]/)[0];
    const rowNum = parseInt(coord.substring(1));
    selectedColumn = colChar;
    selectedRow = rowNum;
}

/**
 * Clears all selection visual styles and resets state tracking.
 */
function clearSelection() {
    document.querySelectorAll('.spreadsheet-cell').forEach(c => c.classList.remove('selected'));
    activeCellElement = null;
    selectedColumn = null;
    selectedRow = null;
}

/**
 * Handles column label clicks (A, B, C...). Used for selection/actions (R6).
 */
function handleColumnLabelClick(event) {
    const colHeader = event.currentTarget;
    const colChar = colHeader.dataset.col;

    if (!colChar) return;

    // 1. Select the entire column visually and logically
    clearSelection();
    document.querySelectorAll(`.spreadsheet-cell[data-col="${colChar}"]`).forEach(cell => {
        cell.classList.add('selected');
    });
    activeCellElement = document.querySelector(`.spreadsheet-cell[data-col="${colChar}"][data-row="1"]`); // Set focus reference

    // 2. Update state tracking
    selectedColumn = colChar;
    selectedRow = null;

    // Enable column controls
    document.getElementById('btn-delete-column').disabled = false;
    document.getElementById('btn-apply-color').disabled = false;
}

/**
 * Handles row number clicks (1, 2, 3...). Used for selection/actions (R7).
 */
function handleRowNumberClick(event) {
    const rowLabel = event.currentTarget;
    const rowNum = parseInt(rowLabel.dataset.row);

    if (!rowNum) return;

    // 1. Select the entire row visually and logically
    clearSelection();
    document.querySelectorAll(`.spreadsheet-cell[data-row="${rowNum}"]`).forEach(cell => {
        cell.classList.add('selected');
    });
    activeCellElement = document.querySelector(`.spreadsheet-cell[data-row="${rowNum}"][data-col="A"]`); // Set focus reference

    // 2. Update state tracking
    selectedColumn = null;
    selectedRow = rowNum;

    // Enable row controls
    document.getElementById('btn-delete-row').disabled = false;
    document.getElementById('btn-apply-color').disabled = false;
}


/**
 * Applies a background color to the currently selected cells/rows/columns (R5).
 */
function applyColor() {
    const colorPicker = document.getElementById('color-picker');
    const newColor = colorPicker.value;

    if (!activeCellElement) return;

    let affectedCells = [];
    let isColumnAction = selectedColumn && !selectedRow;
    let isRowAction = selectedRow && !selectedColumn;

    if (isColumnAction) {
        // Apply to all cells in the selected column
        affectedCells = document.querySelectorAll(`.spreadsheet-cell[data-col="${selectedColumn}"]`);
    } else if (isRowAction) {
        // Apply to all cells in the selected row
        affectedCells = document.querySelectorAll(`.spreadsheet-cell[data-row="${selectedRow}"]`);
    } else {
        // Single cell action or default selection
        affectedCells = [activeCellElement];
    }

    let coordsToUpdate = new Set();

    affectedCells.forEach(cell => {
        const coord = cell.dataset.coord;
        if (coord) {
            coordsToUpdate.add(coord);
            // Update UI immediately
            cell.style.backgroundColor = newColor;
        }
    });

    // Update the data model for all affected cells
    coordsToUpdate.forEach(coord => {
        spreadsheetData[coord].color = newColor;
    });

    saveState();
}


/**
 * Clears content from a selected column (R6).
 */
function clearColumn() {
    if (!selectedColumn) return;

    let coordsToClear = [];
    document.querySelectorAll(`.spreadsheet-cell[data-col="${selectedColumn}"]`).forEach(cell => {
        const coord = cell.dataset.coord;
        coordsToClear.push(coord);
    });

    // 1. Update Model and UI
    coordsToClear.forEach(coord => {
        spreadsheetData[coord].value = '';
        spreadsheetData[coord].formula = null;
        updateCellUI(coord);
    });

    saveState();
}

/**
 * Deletes a selected column (R13).
 */
function deleteColumn() {
    if (!selectedColumn) return;

    const colChar = selectedColumn;
    let coordsToDelete = [];
    document.querySelectorAll(`.spreadsheet-cell[data-col="${colChar}"]`).forEach(cell => {
        const coord = cell.dataset.coord;
        coordsToDelete.push(coord);
    });

    // 1. Remove data from the model
    coordsToDelete.forEach(coord => delete spreadsheetData[coord]);

    // 2. Remove DOM elements (This is complex and requires careful manipulation)
    const colElements = document.querySelectorAll(`.spreadsheet-cell[data-col="${colChar}"]`);
    colElements.forEach(el => el.remove());

    // 3. Re-index/Rebuild the grid structure to fill the gap (Simplified approach: just rebuild everything)
    initializeGrid(); // Rebuilding is safer than complex DOM manipulation here

    clearSelection();
    saveState();
}


/**
 * Clears content from a selected row (R7).
 */
function clearRow() {
    if (!selectedRow) return;

    let coordsToClear = [];
    document.querySelectorAll(`.spreadsheet-cell[data-row="${selectedRow}"]`).forEach(cell => {
        const coord = cell.dataset.coord;
        coordsToClear.push(coord);
    });

    // 1. Update Model and UI
    coordsToClear.forEach(coord => {
        spreadsheetData[coord].value = '';
        spreadsheetData[coord].formula = null;
        updateCellUI(coord);
    });

    saveState();
}

/**
 * Deletes a selected row (R15).
 */
function deleteRow() {
    if (!selectedRow) return;

    const rowNum = parseInt(selectedRow);

    // 1. Remove data from the model
    let coordsToDelete = [];
    for (let c = 0; c < NUM_COLUMNS; c++) {
        const coord = getCoord(c, rowNum);
        coordsToDelete.push(coord);
        delete spreadsheetData[coord];
    }

    // 2. Remove DOM elements
    document.querySelectorAll(`.spreadsheet-cell[data-row="${rowNum}"]`).forEach(el => el.remove());

    // 3. Rebuild the grid structure to fill the gap
    initializeGrid(); // Rebuilding is safer than complex DOM manipulation here

    clearSelection();
    saveState();
}


/**
 * Hides a selected column (R8).
 */
function hideColumn() {
    if (!selectedColumn) return;

    const colChar = selectedColumn;
    // 1. Hide all elements in the DOM (cells)
    document.querySelectorAll(`.cell[data-col="${colChar}"]`).forEach(el => {
        el.classList.add('hidden');
    });
    // 2. Hide the column label itself
    const colLabel = document.querySelector(`.col-header[data-col="${colChar}"]`);
    if (colLabel) {
        colLabel.classList.add('hidden');
    }

    clearSelection();
    saveState();
}

/**
 * Hides a selected row (R8).
 */
function hideRow() {
    if (!selectedRow) return;

    const rowNum = parseInt(selectedRow);
    // 1. Hide all elements in the DOM (cells)
    document.querySelectorAll(`.spreadsheet-row[data-row="${rowNum}"]`).forEach(el => {
        el.style.display = 'none';
    });
    // 2. Hide the row number label itself
    const rowLabel = document.querySelector(`.row-number[data-row="${rowNum}"]`);
    if (rowLabel) {
        rowLabel.style.display = 'none';
    }

    clearSelection();
    saveState();
}


// =============================================================================
// INITIALIZATION AND EVENT BINDING
// =============================================================================

function setupEventListeners() {
    // 1. Column Label Listeners (A-J)
    document.querySelectorAll('.col-header').forEach(label => {
        label.addEventListener('click', handleColumnLabelClick);
    });

    // 2. Row Number Listeners (1-20)
    document.querySelectorAll('.row-number').forEach(label => {
        label.addEventListener('click', handleRowNumberClick);
    });

    // 3. Control Button Listeners
    document.getElementById('btn-clear-selection').addEventListener('click', () => {
        if (activeCellElement) {
            const coord = activeCellElement.dataset.coord;
            spreadsheetData[coord].value = '';
            spreadsheetData[coord].formula = null;
            updateCellUI(coord);
            saveState();
        }
    });

    document.getElementById('btn-delete-column').addEventListener('click', deleteColumn);
    document.getElementById('btn-hide-column').addEventListener('click', hideColumn);
    document.getElementById('btn-delete-row').addEventListener('click', deleteRow);
    document.getElementById('btn-hide-row').addEventListener('click', hideRow);
    document.getElementById('btn-apply-color').addEventListener('click', applyColor);
}


/**
 * Main initialization function called when the script loads.
 */
function init() {
    // 1. Load data state (R9, R17)
    loadState();

    // 2. Build the grid structure and attach listeners
    initializeGrid();

    // 3. Restore UI based on loaded data (R17)
    for (const coord in spreadsheetData) {
        updateCellUI(coord);
    }

    // 4. Setup control button listeners
    setupEventListeners();
}

// Start the application
init();
