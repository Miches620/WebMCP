// ========================================
// CONSTANTS AND GLOBAL STATE
// ========================================

const ROWS = 20;
const COLS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const COLUMN_HEADER_EL = document.getElementById('column-headers');
const GRID_WRAPPER = document.getElementById('grid-wrapper');

// State structure: { 'A1': { value: '...', formula: null, style: {}, rawContent: '...' }, ... }
let spreadsheetData = {};

// Maps coordinates (e.g., "B3") to their corresponding DOM element
const cellElementMap = new Map(); 

// ========================================
// UTILITIES & STATE MANAGEMENT
// ========================================

/** Generates a unique key for a coordinate (e.g., A1, J20) */
function getCoordKey(row, colLetter) {
    return `${colLetter}${row}`;
}

/** Converts column index (0-9) to letter (A-J) */
function colIndexToLetter(index) {
    return COLS_LETTERS[index];
}

/** Gets the element for a specific coordinate key */
function getCellElement(key) {
    return document.querySelector(`.cell[data-row="${key.slice(1)}"][data-col="${COLS_LETTERS.find(l => l === key.replace(/[0-9]/g, ''))}"]`);
}

/** Retrieves the current raw value (text or number) from a coordinate */
function getValue(key) {
    const data = spreadsheetData[key];
    return data ? (data.formula || data.value || '') : '';
}

/** Initializes the state structure for all 20x10 cells */
function initializeState() {
    spreadsheetData = {};
    for (let r = 1; r <= ROWS; r++) {
        for (let c = 0; c < COLS_LETTERS.length; c++) {
            const colLetter = colIndexToLetter(c);
            const key = getCoordKey(r, colLetter);
            spreadsheetData[key] = {
                value: '',       // The calculated/displayed value (number or text)
                formula: null,   // The raw formula string (e.g., "=SUMA(...)")
                rawContent: '',  // What the user typed initially
                style: {},       // Style object for background color
            };
        }
    }
}

/** Saves the current state to localStorage */
function saveState() {
    localStorage.setItem('spreadsheetData', JSON.stringify(spreadsheetData));
}

/** Loads the state from localStorage */
function loadState() {
    const savedData = localStorage.getItem('spreadsheetData');
    if (savedData) {
        try {
            spreadsheetData = JSON.parse(savedData);
            console.log("State loaded successfully.");
        } catch (e) {
            console.error("Error loading state:", e);
            initializeState(); // Fallback to empty state if corruption occurs
        }
    } else {
        initializeState();
    }
}

// ========================================
// CORE LOGIC: FORMULA EVALUATION
// ========================================

/** 
 * Attempts to evaluate a formula string based on the current spreadsheetData.
 * Handles simple arithmetic, SUMA(range), and list summation (A1;B2).
 * @param {string} key - The coordinate where the formula resides (e.g., "C1").
 * @returns {number|string} The calculated result or an error message.
 */
function evaluateFormula(key) {
    const data = spreadsheetData[key];
    if (!data || typeof data.formula !== 'string' || !data.formula.startsWith('=')) {
        return ''; 
    }

    let formula = data.formula.substring(1); // Remove '='

    try {
        // --- 1. Handle SUMA and Ranges (e.g., "=SUMA(A1:B2)" or "=(A1;B2)") ---
        if (formula.toUpperCase().startsWith('SUMA')) {
            const match = formula.match(/\(([^)]+)\)/);
            if (!match) return 'Error';
            let rangeContent = match[1];

            // Check for simple ranges like A1:B2
            const rangeMatch = rangeContent.match(/([A-Z]+[0-9]+):([A-Z]+[0-9]+)/);
            if (rangeMatch) {
                let startKey = rangeMatch[1];
                let endKey = rangeMatch[2];

                // Simple implementation: iterate over all cells between start and end keys
                const startCoords = getCoordsFromKey(startKey);
                const endCoords = getCoordsFromKey(endKey);

                let totalSum = 0;
                let count = 0;

                // Find the bounding box (min/max row/col)
                const minR = Math.min(Math.min(...startCoords.map(c => parseInt(c.slice(1)))), ...endCoords.map(c => parseInt(c.slice(1))));
                const maxR = Math.max(Math.max(...startCoords.map(c => parseInt(c.slice(1)))), ...endCoords.map(c => parseInt(c.slice(1))));
                const minC = Math.min(...startCoords.map(c => c[0].charCodeAt(0) - 'A'.charCodeAt(0)));
                const maxC = Math.max(...endCoords.map(c => c[0].charCodeAt(0) - 'A'.charCodeAt(0)));

                for (let r = minR; r <= maxR; r++) {
                    for (let c = minC; c <= maxC; c++) {
                        const colLetter = colIndexToLetter(c);
                        const currentKey = getCoordKey(r, colLetter);
                        if (!['Error', 'texto'].includes(spreadsheetData[currentKey].value)) {
                            totalSum += parseFloat(getValue(currentKey)) || 0;
                            count++;
                        }
                    }
                }
                return totalSum.toFixed(2);

            } else {
                // Handle list summation (A1;B2;C3)
                const individualKeys = rangeContent.split(';');
                let sum = 0;
                individualKeys.forEach(k => k = k.trim());
                if (k) {
                    let value = parseFloat(getValue(k)) || 0;
                    sum += value;
                }
                return sum.toFixed(2);
            }

        } else if (formula.includes('+') || formula.includes('-') || formula.includes('*') || formula.includes('/')) {
            // --- 2. Handle Arithmetic Operations (e.g., "=A1-B1") ---
            let expression = formula;
            
            // Replace cell references (A1, B2) with their numerical values for evaluation
            expression = expression.replace(/([A-Z]+[0-9]+)/g, (match) => {
                const value = getValue(match);
                if (!isNaN(parseFloat(value))) {
                    return parseFloat(value);
                }
                // If the cell contains text or is empty, treat it as 0 for arithmetic purposes
                return 0;
            });

            try {
                // Use Function constructor for safe evaluation of mathematical expressions
                const result = new Function('return ' + expression)();
                return parseFloat(result.toFixed(2));
            } catch (e) {
                console.error("Arithmetic error:", e);
                return "Error";
            }

        } else {
             // If it starts with '=' but doesn't match known patterns
             return 'Invalid Formula';
        }
    } catch (e) {
        console.error("Formula evaluation failed for", key, ":", e);
        return "ERROR";
    }
}

/** Helper to generate coordinates from a single cell key (for range checks) */
function getCoordsFromKey(key) {
    const r = parseInt(key.slice(1));
    const cLetter = key[0];
    const colIndex = cLetter.charCodeAt(0) - 'A'.charCodeAt(0);

    let coords = [];
    for (let i = 0; i < COLS_LETTERS.length; i++) {
        if (i === colIndex) {
            coords.push(`${colIndexToLetter(i)}${r}`);
        }
    }
    return coords;
}


/** Recalculates the value and updates the display for a specific cell key */
function updateCellDisplay(key, forceRecalc = false) {
    const data = spreadsheetData[key];
    if (!data) return;

    let newValue = '';
    let finalContent = '';

    // If we are forcing recalculation or if the formula was just set/changed:
    if (forceRecalc || data.formula) {
        newValue = evaluateFormula(key);
        finalContent = newValue;
    } else {
        // Otherwise, use the raw content (text input)
        finalContent = getValue(key);
    }

    // Update state and DOM
    data.value = finalContent === '0' ? 0 : parseFloat(finalContent) || finalContent; // Store as number if possible
    data.rawContent = finalContent;
    
    const element = document.querySelector(`.cell[data-row="${key.slice(1)}"][data-col="${key[0]}"]`);
    if (element) {
        element.textContent = finalContent === '' ? '' : String(finalContent);
        // Ensure the display value is updated, but keep formula visible on click
        element.dataset.displayValue = finalContent; 
    }
}

/** Traverses all cells and recalculates any cell whose dependencies might have changed */
function recalculateSheet() {
    console.log("--- Recalculating Sheet ---");
    let changedKeys = new Set();
    let changedCount = 0;

    // Iteratively attempt to update every cell until no changes occur (to handle cascading formulas)
    let stable = false;
    while (!stable && changedKeys.size < COLS_LETTERS.length * ROWS) {
        changedKeys.clear();
        let initialChangedCount = 0;

        for (let r = 1; r <= ROWS; r++) {
            for (let i = 0; i < COLS_LETTERS.length; i++) {
                const colLetter = colIndexToLetter(i);
                const key = getCoordKey(r, colLetter);

                // Only recalculate if it's a formula cell or if we suspect dependencies changed
                if (spreadsheetData[key].formula) {
                    updateCellDisplay(key, true); // Recalculate and update display
                    initialChangedCount++;
                } else if (changedKeys.has(getCoordKey(r, colLetter))) {
                     // If a dependency was cleared/updated, re-evaluate text cells too
                     updateCellDisplay(key, false); 
                }
            }
        }

        if (initialChangedCount === 0) {
             stable = true; // No formula cells to process
        } else if (changedKeys.size === 0) {
             // In a real scenario, we would track *which* cell changed and only update dependents.
             // Since this is complex dependency graph tracking, for simplicity, we rely on the full loop check.
             stable = true;
        }
    }
    console.log("--- Recalculation Complete ---");
}

// ========================================
// UI HANDLERS: EDITING & INPUT
// ========================================

/** Handles making a cell editable (on click/focus) */
function handleCellClick(event) {
    const element = event.currentTarget;
    const key = element.dataset.key; 

    if (!element || !key) return;

    // Check if the user is interacting with the formula bar or a dedicated input field (not implemented here, but good practice)
    // For this setup, we simulate editing by making the cell content editable.
    
    const data = spreadsheetData[key];
    if (!data) return;

    // If there is text/formula, allow editing
    element.contentEditable = 'true';
    element.focus();

    // Select all content to facilitate easy replacement (e.g., deleting formulas)
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, 0);

    // Setup temporary listener to handle the input change after focus/blur
    let tempInputHandler = (e) => {
        if (e.type === 'blur' || e.key === 'Enter') {
            handleCellBlur(key, e);
            document.removeEventListener('blur', tempInputHandler);
            document.removeEventListener('keydown', tempInputHandler);
        }
    };

    // Add temporary listeners to manage the input process lifecycle
    element.addEventListener('blur', tempInputHandler);
    element.addEventListener('keydown', tempInputHandler);
}

/** Handles saving the content when the cell loses focus */
function handleCellBlur(key, event) {
    const element = document.querySelector(`.cell[data-row="${key.slice(1)}"][data-col="${key[0]}"]`);
    if (!element) return;
    
    let newRawContent = element.textContent.trim();

    // 1. Update the state's raw content
    spreadsheetData[key].rawContent = newRawContent;

    // 2. Determine if input is a formula
    if (newRawContent.startsWith('=')) {
        spreadsheetData[key].formula = newRawContent;
        spreadsheetData[key].value = null; // Clear display value temporarily
        console.log(`Formula detected in ${key}: ${newRawContent}`);
    } else {
        spreadsheetData[key].formula = null;
        spreadsheetData[key].value = newRawContent === '' ? '' : (isNaN(parseFloat(newRawContent)) ? newRawContent : parseFloat(newRawContent));
    }

    // 3. Update the display based on whether it's a formula or text
    if (spreadsheetData[key].formula) {
        updateCellDisplay(key, true); // Recalculate and update
    } else {
        updateCellDisplay(key, false); // Just set text value
    }

    // Clean up editing state
    element.contentEditable = 'false';
    saveState();
    recalculateSheet(); // Important: Trigger global recalculation after any input change
}


// ========================================
// UI HANDLERS: ROW/COLUMN OPERATIONS (R6, R7, R8, R13-R16)
// ========================================

/** Handles actions triggered by clicking a column header letter */
function handleColumnAction(event, colIndex, action) {
    const colLetter = colIndex;
    console.log(`Column ${colLetter} Action: ${action}`);

    if (action === 'delete') {
        // Delete Column (R13)
        let keysToDelete = [];
        for (let r = 1; r <= ROWS; r++) {
            const key = getCoordKey(r, colLetter);
            keysToDelete.push(key);
            // Remove from DOM and state
            document.querySelector(`.cell[data-row="${r}"][data-col="${colLetter}"]`).remove();
            delete spreadsheetData[key];
        }
        // Remove the header element
        const colHeaderEl = document.querySelector(`.col-header[data-col-index="${colLetter}"]`);
        if (colHeaderEl) colHeaderEl.remove();

    } else if (action === 'clear') {
        // Clear Column Content (R6)
        for (let r = 1; r <= ROWS; r++) {
            const key = getCoordKey(r, colLetter);
            spreadsheetData[key] = { value: '', formula: null, rawContent: '', style: {} };
            updateCellDisplay(key, false);
        }

    } else if (action === 'color') {
        // Color Column Background (R6)
        const color = event.target.dataset.color;
        if (!color) return;

        for (let r = 1; r <= ROWS; r++) {
            const key = getCoordKey(r, colLetter);
            spreadsheetData[key].style['background-color'] = color;
            document.querySelector(`.cell[data-row="${r}"][data-col="${colLetter}"]`).style.backgroundColor = color;
        }

    } else if (action === 'hide') {
        // Hide Column (R8, R14)
        const colHeaderEl = document.querySelector(`.col-header[data-col-index="${colLetter}"]`);
        if (colHeaderEl && !colHeaderEl.classList.contains('hidden')) {
            colHeaderEl.classList.add('hidden');

            // Hide all cells in the column and update state visibility markers
            for (let r = 1; r <= ROWS; r++) {
                const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${colLetter}"]`);
                if (cellEl) {
                    cellEl.classList.add('hidden');
                }
            }
        }
    } else if (action === 'unhide') {
        // Unhide Column (Reverse of hide)
         const colHeaderEl = document.querySelector(`.col-header[data-col-index="${colLetter}"]`);
         if (colHeaderEl && colHeaderEl.classList.contains('hidden')) {
            colHeaderEl.classList.remove('hidden');

            for (let r = 1; r <= ROWS; r++) {
                const cellEl = document.querySelector(`.cell[data-row="${r}"][data-col="${colLetter}"]`);
                if (cellEl) {
                    cellEl.classList.remove('hidden');
                }
            }
        }
    }
    saveState();
    recalculateSheet();
}

/** Handles actions triggered by clicking a row number */
function handleRowAction(event, rowIndex, action) {
    const rowNum = String(rowIndex);
    console.log(`Row ${rowNum} Action: ${action}`);

    if (action === 'delete') {
        // Delete Row (R15)
        let keysToDelete = [];
        for (let i = 0; i < COLS_LETTERS.length; i++) {
            const colLetter = colIndexToLetter(i);
            const key = getCoordKey(rowNum, colLetter);
            keysToDelete.push(key);
            // Remove from DOM and state
            document.querySelector(`.cell[data-row="${rowNum}"][data-col="${colLetter}"]`).remove();
            delete spreadsheetData[key];
        }
        // Remove the row number element
        const rowNumberEl = document.querySelector(`.row-number[data-row-index="${rowNum}"]`);
        if (rowNumberEl) rowNumberEl.remove();

    } else if (action === 'clear') {
        // Clear Row Content (R7)
        for (let i = 0; i < COLS_LETTERS.length; i++) {
            const colLetter = colIndexToLetter(i);
            const key = getCoordKey(rowNum, colLetter);
            spreadsheetData[key] = { value: '', formula: null, rawContent: '', style: {} };
            updateCellDisplay(key, false);
        }

    } else if (action === 'color') {
        // Color Row Background (R7)
        const color = event.target.dataset.color;
         if (!color) return;

        for (let i = 0; i < COLS_LETTERS.length; i++) {
            const colLetter = colIndexToLetter(i);
            const key = getCoordKey(rowNum, colLetter);
            spreadsheetData[key].style['background-color'] = color;
            document.querySelector(`.cell[data-row="${rowNum}"][data-col="${colLetter}"]`).style.backgroundColor = color;
        }

    } else if (action === 'hide') {
        // Hide Row (R8, R16)
         const rowNumberEl = document.querySelector(`.row-number[data-row-index="${rowNum}"]`);
         if (rowNumberEl && !rowNumberEl.classList.contains('hidden')) {
            rowNumberEl.classList.add('hidden');

            // Hide all cells in the row
            for (let i = 0; i < COLS_LETTERS.length; i++) {
                const cellEl = document.querySelector(`.cell[data-row="${rowNum}"][data-col="${colIndexToLetter(i)}"]`);
                if (cellEl) {
                    cellEl.classList.add('hidden');
                }
            }
        }
    } else if (action === 'unhide') {
        // Unhide Row
         const rowNumberEl = document.querySelector(`.row-number[data-row-index="${rowNum}"]`);
         if (rowNumberEl && rowNumberEl.classList.contains('hidden')) {
            rowNumberEl.classList.remove('hidden');

            for (let i = 0; i < COLS_LETTERS.length; i++) {
                const cellEl = document.querySelector(`.cell[data-row="${rowNum}"][data-col="${colIndexToLetter(i)}"]`);
                if (cellEl) {
                    cellEl.classList.remove('hidden');
                }
            }
        }
    }
    saveState();
    recalculateSheet();
}


// ========================================
// INITIALIZATION & EVENT LISTENERS
// ========================================

/** Sets up all necessary event listeners for the grid and headers */
function setupEventListeners() {
    // 1. Grid Cell Click Listener (R1, R10)
    document.getElementById('grid-wrapper').addEventListener('click', handleCellClick);
    
    // 2. Column Header Listeners (R6, R8)
    COLUMN_HEADER_EL.querySelectorAll('.col-header').forEach(header => {
        const colLetter = header.dataset.colIndex;

        // Add listeners for actions stored in data attributes
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.col-header')) return;
            handleColumnAction(e, colLetter, 'edit'); // Placeholder if needed
        });
    });

    // 3. Row Number Listeners (R7, R8)
    document.querySelectorAll('.row-number').forEach(rowNumberEl => {
        const rowIndex = rowNumberEl.dataset.rowIndex;
        
        // Attach listeners for actions stored in data attributes/buttons (assuming button structure is handled by CSS or external UI)
        // For simplicity, we treat the number itself as the trigger point and rely on a dedicated action panel (if one existed).
        // Since no explicit row-action buttons are defined in the HTML base, we attach handlers based on assumed functionality.
    });

     // --- Attach global event listeners for demonstration actions (Simulating UI controls) ---
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // A. Column Action Simulation (Triggering from the header element itself if we assume buttons are placed nearby)
        if (target.closest('.col-header')) {
            const colHeaderEl = target.closest('.col-header');
            const colLetter = colHeaderEl.dataset.colIndex;

            // Example: Clicking a simulated "Delete Column" button associated with this header
             if (e.type === 'click' && e.target.dataset.action === 'delete') {
                handleColumnAction(e, colLetter, 'delete');
            } else if (e.type === 'click' && e.target.dataset.action === 'color') {
                 const color = e.target.dataset.color;
                 // Pass the event target to retrieve attributes like data-color
                handleColumnAction(e, colLetter, 'color'); 
            } else if (e.type === 'click' && e.target.dataset.action === 'hide') {
                handleColumnAction(e, colLetter, 'hide');
            }
        }

        // B. Row Action Simulation (Triggering from the row number element)
        if (target.closest('.row-number')) {
            const rowNumberEl = target.closest('.row-number');
            const rowIndex = rowNumberEl.dataset.rowIndex;
             if (e.type === 'click' && e.target.dataset.action === 'delete') {
                handleRowAction(e, rowIndex, 'delete');
            } else if (e.type === 'click' && e.target.dataset.action === 'color') {
                 const color = e.target.dataset.color;
                 handleRowAction(e, rowIndex, 'color'); 
            } else if (e.type === 'click' && e.target.dataset.action === 'hide') {
                handleRowAction(e, rowIndex, 'hide');
            }
        }

    });


     // Initialize all cell event listeners for editing capability
    document.querySelectorAll('.cell').forEach(cell => {
        const key = `${cell.dataset.col}${cell.dataset.row}`;
        cell.dataset.key = key; // Store the full coordinate key on the element itself
        cell.addEventListener('click', handleCellClick);
    });

}


/** Main function to set up the entire spreadsheet */
function initializeSpreadsheet() {
    // 1. Load existing data or initialize state
    loadState();
    
    // 2. Populate initial UI structure and event listeners
    setupEventListeners();

    // 3. Initial display update (Populate text/formulas into DOM based on loaded state)
    for (let r = 1; r <= ROWS; r++) {
        for (let i = 0; i < COLS_LETTERS.length; i++) {
            const colLetter = colIndexToLetter(i);
            const key = getCoordKey(r, colLetter);
            // This also runs the initial update/formula check for loaded data
            updateCellDisplay(key, true); 
        }
    }

    console.log("Spreadsheet Initialized and State Loaded.");
}


// Run the application setup when the DOM is fully ready
document.addEventListener('DOMContentLoaded', initializeSpreadsheet);
