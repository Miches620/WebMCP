// --- CONFIGURATION CONSTANTS ---
const NUM_COLUMNS = 10; // A to J
const NUM_ROWS = 20;   // 1 to 20
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// --- STATE MANAGEMENT ---
let sheetData = {}; // Stores the actual content and formula structure: { "A1": { value: "...", formula: "=..." } }
let selectedColumn = null;
let selectedRow = null;
const STORAGE_KEY = 'spreadsheetData';

// --- DOM ELEMENTS CACHING ---
const gridContainer = document.getElementById('grid-container');
const rowHeadersDiv = document.getElementById('row-headers');
const columnHeadersDiv = document.getElementById('column-headers');
const controlsPanel = {
    deleteCol: document.getElementById('delete-col-btn'),
    clearCol: document.getElementById('clear-col-btn'),
    colorCol: document.getElementById('color-col-btn'),
    hideCol: document.getElementById('hide-col-btn'),

    deleteRow: document.getElementById('delete-row-btn'),
    clearRow: document.getElementById('clear-row-btn'),
    colorRow: document.getElementById('color-row-btn'),
    hideRow: document.getElementById('hide-row-btn')
};


// --- UTILITY FUNCTIONS ---

/** Converts row number (1-20) and column index (0-9) to A1 notation (e.g., 1 -> 'A', 5 -> 'E') */
function getCoord(colIndex, rowIndex) {
    return `${COL_LETTERS[colIndex]}${rowIndex + 1}`;
}

/** Gets the raw value of a cell from the data model or returns null/0 if missing. */
function getValue(coord) {
    if (!sheetData[coord]) return null;
    const cell = sheetData[coord];
    // If it's a formula, calculate its current result based on dependencies
    return evaluateFormula(coord); 
}

/**
 * Finds all coordinates that are referenced in the given coordinate's formula.
 * Example: "=SUMA(A1;B2)" -> ["A1", "B2"]
 */
function getDependencies(formula) {
    if (!formula || !formula.startsWith('=')) return [];

    const match = /([A-Z]+[0-9]+)/g; // Regex to find patterns like A1, B2, etc.
    let matches = [...new Set(formula.matchAll(match))].map(m => m[0]);
    return matches;
}

/**
 * Parses and evaluates the formula string based on Excel logic (SUMA, +, -, *, /).
 * @param {string} coord - The coordinate of the cell containing the formula.
 * @returns {number|string} The calculated numerical result or the original text if calculation fails.
 */
function evaluateFormula(coord) {
    const cell = sheetData[coord];
    if (!cell || !cell.formula || !cell.formula.startsWith('=')) {
        return getValue(coord); // If no formula, just return stored value (which is already calculated or text).
    }

    let formulaString = cell.formula;

    // 1. Standardize separators and operators for easier parsing
    // Replace Excel list separator (;) with comma for JS array functions
    formulaString = formulaString.replace(/;/g, ','); 

    try {
        let resultValue;

        if (formulaString.toUpperCase().startsWith("=SUMA")) {
            // Handle SUMA(range) or SUMA(cell1, cell2, ...)
            const argsStr = formulaString.substring(4).trim(); // Remove "=SUMA"
            
            let coordinatesToSum = [];

            if (argsStr.includes(':')) {
                // Range format: A1:A3 -> Need to extract all cells in the range
                const rangeCoords = argsStr.split(':')[1]; 
                for (let r = 0; r < NUM_ROWS; r++) {
                    for (let c = 0; c < NUM_COLUMNS; c++) {
                        const coord = getCoord(c, r);
                        // Simple check: if the coordinate is within the range span (A1 to J20)
                        // For simplicity here, we assume valid ranges are provided.
                        if (coord.includes(rangeCoords.charAt(0)) && coord.endsWith(rangeCoords.slice(-1))) {
                             coordinatesToSum.push(coord);
                        }
                    }
                }
            } else {
                // List format: A1,B2,C3
                const listCoords = argsStr.split(',');
                 listCoords.forEach(c => coordinatesToSum.push(c.trim()));
            }

            let sum = 0;
            coordinatesToSum.forEach(coord => {
                const val = getValue(coord);
                if (typeof val === 'number') {
                    sum += val;
                }
            });
            resultValue = sum;

        } else if (!isNaN(parseFloat(formulaString.substring(1))) && formulaString.startsWith("=")) {
             // Simple arithmetic operations: =A1-B1, =A1*B1 etc.
             // Replace coordinates with their current calculated values for evaluation
            let evalString = formulaString;
            const dependencies = getDependencies(formulaString);

            for (const coord of dependencies) {
                const value = getValue(coord) || 0; // Use 0 if dependency is empty/non-numeric
                // Escape regex characters in the number representation to ensure clean replacement
                evalString = evalString.replace(new RegExp(`(${coord})`, 'g'), `(${value})`);
            }

             try {
                 // Using new Function() for safe evaluation of math expressions
                 resultValue = new Function('return ' + evalString)(); 
             } catch (e) {
                console.error("Math evaluation error:", e);
                return "Error";
             }


        } else if (formulaString.includes('+') || formulaString.includes('*') || formulaString.includes('/') || formulaString.includes('-')) {
            // Fallback for simple arithmetic that wasn't caught by the explicit dependency replacement above 
            // This is complex, but we rely on the coordinate replacement logic above being sufficient.
             let evalString = formulaString;
            const dependencies = getDependencies(formulaString);

            for (const coord of dependencies) {
                const value = getValue(coord) || 0;
                evalString = evalString.replace(new RegExp(`(${coord})`, 'g'), `(${value})`);
            }
            try {
                 resultValue = new Function('return ' + evalString)(); 
             } catch (e) {
                console.error("Math evaluation error:", e);
                return "Error";
             }

        } else {
            // Unrecognized formula format
            return "#ERROR!";
        }


        // Check if the result is a number and round it nicely
        if (!isNaN(resultValue) && isFinite(resultValue)) {
            return parseFloat(resultValue.toFixed(2));
        } 
        
        return String(resultValue);

    } catch (error) {
        console.error(`Error calculating ${coord}:`, error);
        return "#CALC!";
    }
}


/**
 * Recalculates the value of a specific cell and updates both sheetData and the DOM.
 * @param {string} coord - The coordinate to recalculate (e.g., "A1").
 */
function updateCell(coord) {
    const cell = sheetData[coord];
    if (!cell) return;

    let displayValue = '';
    let finalValue = cell.value || ""; // Always use the raw stored value if no formula is present

    if (cell.formula && cell.formula.startsWith('=')) {
        // If it's a formula, calculate the result
        finalValue = evaluateFormula(coord);
        displayValue = finalValue;

        // Update internal data model: store the calculated number/string, but keep the formula
        sheetData[coord].value = displayValue; 
    } else {
        // If it's text or a direct input, just use the stored value.
        displayValue = cell.value;
    }

    const cellElement = document.getElementById(`cell-${coord}`);
    if (cellElement) {
        cellElement.textContent = displayValue;
        // Ensure the displayed content reflects whether it was a formula calculation or raw text input
        cellElement.setAttribute('data-display-value', displayValue); 
    }

    saveData();
}


/**
 * Triggered whenever any cell's value changes (either manually or via recalculation).
 * This function must recursively check all cells that depend on the changed coordinate.
 * @param {string} changedCoord - The coordinate whose content changed.
 */
function triggerRecalculations(changedCoord) {
    // 1. Find all formulas that use the changed coordination (A*B, C=A+B etc.)
    let affectedCoords = [];

    for (const coord in sheetData) {
        const cell = sheetData[coord];
        if (cell.formula && getDependencies(cell.formula).includes(changedCoord)) {
            affectedCoords.push(coord);
        }
    }

    // 2. Recalculate the affected cells sequentially
    for (const coord of affectedCoords) {
        updateCell(coord);
    }
}


// --- CORE INITIALIZATION AND RENDERING ---

/** Initializes the grid structure in the DOM and data model. */
function initializeGrid() {
    gridContainer.innerHTML = '';
    rowHeadersDiv.innerHTML = '';
    columnHeadersDiv.innerHTML = '';
    sheetData = {}; // Reset state

    // 1. Render Row Headers (Numbers 1-20)
    let rowHeaderHTML = '<div class="corner"></div>'; // Empty corner cell
    for (let r = 1; r <= NUM_ROWS; r++) {
        rowHeaderHTML += `<div class="header row-label">${r}</div>`;
    }
    rowHeadersDiv.innerHTML = rowHeaderHTML;

    // 2. Render Column Headers (Letters A-J)
    let colHeaderHTML = '';
    for (let i = 0; i < NUM_COLUMNS; i++) {
        colHeaderHTML += `<div class="header col-label">${COL_LETTERS[i]}</div>`;
    }
    columnHeadersDiv.innerHTML = colHeaderHTML;

    // 3. Render Cells (A1:J20) and Initialize Data Model
    for (let r = 0; r < NUM_ROWS; r++) {
        const rowNum = r + 1;
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const coord = getCoord(c, r);

            // Create the DOM structure for the cell
            const cellElement = document.createElement('div');
            cellElement.id = `cell-${coord}`;
            cellElement.classList.add('data-cell', 'editable');
            cellElement.setAttribute('data-coord', coord);
            cellElement.textContent = ''; // Empty initially

            // Attach the element to the grid container (after row headers)
            gridContainer.appendChild(cellElement);

            // Initialize data model entry
            sheetData[coord] = { value: '', formula: null, color: 'transparent' };
        }
    }
}


/** Loads state from localStorage or initializes empty sheet */
function loadState() {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
        try {
            const loadedState = JSON.parse(savedData);
            sheetData = loadedState;

            // Apply data and styles to the DOM elements
            for (const coord in sheetData) {
                const cellElement = document.getElementById(`cell-${coord}`);
                if (cellElement && typeof sheetData[coord].value !== 'undefined') {
                    // Set initial content based on stored value/formula
                    cellElement.textContent = sheetData[coord].value || ''; 
                    
                    // Re-run calculation to ensure formulas are resolved correctly upon load
                    setTimeout(() => updateCell(coord), 50); 

                } else if (cellElement) {
                     // If no data was saved for this coord, it remains empty.
                }
            }
        } catch (e) {
            console.error("Failed to parse stored spreadsheet data:", e);
            localStorage.removeItem(STORAGE_KEY); // Clear bad data
        }
    }
}

/** Saves the current state of sheetData to localStorage */
function saveData() {
    // Only save necessary data (value, formula, color)
    const dataToSave = {};
    for (const coord in sheetData) {
        dataToSave[coord] = {
            value: sheetData[coord].value, 
            formula: sheetData[coord].formula, 
            color: sheetData[coord].color
        };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

// --- EVENT HANDLERS & BUSINESS LOGIC ---

/** Handles cell selection and click to initiate editing or recalculation. */
function handleCellClick(event) {
    const target = event.currentTarget;
    const coord = target.getAttribute('data-coord');

    if (selectedColumn !== null && selectedRow !== null) {
        // Deselect previous cell if selection logic is active
        document.getElementById(`cell-${selectedColumn}-${selectedRow}`).classList.remove('selected');
    }

    // Update selection state
    selectedColumn = COL_LETTERS[parseInt(coord.slice(1, 2)) - 1];
    selectedRow = parseInt(coord.slice(-1));
    
    // Visual update
    target.classList.add('selected');
    document.querySelector(`.row-label:nth-child(${selectedRow})`).classList.add('selected');


    // Check for formula calculation needs (If we click a cell, ensure its value is current)
    if (sheetData[coord].formula && sheetData[coord].formula.startsWith('=')) {
        updateCell(coord);
    } else {
         // If it's not a formula, just update the display based on stored raw value
        target.textContent = sheetData[coord].value; 
    }

    // Update button controls state after selection
    updateControlsState();
}


/** Handles manual text input into an editable cell */
function handleInput(event) {
    const target = event.currentTarget;
    const coord = target.getAttribute('data-coord');
    let rawText = target.value;

    // 1. Update the data model's stored value (raw content)
    sheetData[coord].value = rawText;
    sheetData[coord].formula = null; // Clear formula if user types directly

    // 2. Update the internal state and UI display immediately
    updateCell(coord); 

    // 3. Trigger recalculation for any cells that depend on this change
    triggerRecalculations(coord); 
}


/** Sets the content of a cell, handling both text input and formula entry */
function setCellValue(coord, value) {
    const cell = sheetData[coord];

    if (typeof value === 'string' && value.trim().startsWith('=')) {
        // It's a formula
        cell.formula = value;
        cell.value = ''; // Clear raw display value when a formula is set
    } else {
        // It's plain text or number input
        cell.formula = null;
        cell.value = value || '';
    }

    updateCell(coord); 
}


/** --- CONTROL PANEL LOGIC (R6, R7) --- */

function updateControlsState() {
    const colSelected = selectedColumn;
    const rowSelected = selectedRow;

    // Check if any column or row is actually selected to enable controls
    const hasSelection = colSelected && rowSelected;

    document.getElementById('delete-col-btn').disabled = !hasSelection || !selectedColumn;
    document.getElementById('clear-col-btn').disabled = !hasSelection || !selectedColumn;
    document.getElementById('color-col-btn').disabled = !hasSelection || !selectedColumn;
    document.getElementById('hide-col-btn').disabled = !hasSelection || !selectedColumn;

    document.getElementById('delete-row-btn').disabled = !hasSelection || !selectedRow;
    document.getElementById('clear-row-btn').disabled = !hasSelection || !selectedRow;
    document.getElementById('color-row-btn').disabled = !hasSelection || !selectedRow;
    document.getElementById('hide-row-btn').disabled = !hasSelection || !selectedRow;
}

// R6: Column Actions
function handleColumnAction(action) {
    if (!selectedColumn) return;
    const colIndex = COL_LETTERS.indexOf(selectedColumn);

    if (action === 'delete') {
        if (!confirm(`¿Está seguro de que desea borrar la columna ${selectedColumn}? Esta acción es irreversible.`)) return;
        
        // 1. Update DOM: Hide/Remove cells in this column
        document.querySelectorAll(`.data-cell[data-coord^="${selectedColumn}"]`).forEach(el => {
            el.style.display = 'none';
        });

        // 2. Update Data Model (Crucial step)
        const colsToDelete = [];
        for (let r = 1; r <= NUM_ROWS; r++) {
            const coord = `${selectedColumn}${r}`;
            if (sheetData[coord]) {
                colsToDelete.push(coord);
            }
        }
        colsToDelete.forEach(coord => delete sheetData[coord]);

        // 3. Reset selection and save
        selectedColumn = null;
        document.querySelectorAll('.data-cell').forEach(el => el.classList.remove('selected'));
        saveData();
    } else if (action === 'clear') {
        const coords = [];
         for (let r = 1; r <= NUM_ROWS; r++) {
            const coord = `${selectedColumn}${r}`;
            sheetData[coord].value = '';
            sheetData[coord].formula = null;
            coords.push(coord);
        }

        // Clear the DOM and recalculate affected cells (though they are now empty)
        document.querySelectorAll(`.data-cell[data-coord^="${selectedColumn}"]`).forEach(el => {
            el.textContent = '';
        });
        
        saveData();
    } else if (action === 'color') {
        const color = prompt("Ingrese el código de color hexadecimal (ej: #FF0000):", selectedColor || '#ffffcc');
        if (!color) return;
        
        // Apply color to all cells in the column and save state
        document.querySelectorAll(`.data-cell[data-coord^="${selectedColumn}"]`).forEach(el => {
            const coord = el.getAttribute('data-coord');
            sheetData[coord].color = color;
            el.style.backgroundColor = color;
        });
        saveData();

    } else if (action === 'hide') {
         // Hide the column visually and reset selection
        document.querySelectorAll(`.data-cell[data-coord^="${selectedColumn}"]`).forEach(el => {
            el.style.display = 'none';
        });

        // For simplicity in this model, we don't delete the data, just hide it.
        // We must reset selection to avoid confusion since the column is invisible.
        const currentCoord = `${selectedColumn}${selectedRow}`;
        selectedColumn = null; 
        document.querySelectorAll('.data-cell').forEach(el => el.classList.remove('selected'));

        saveData();
    }
}

// R7: Row Actions (Mirroring column logic)
function handleRowAction(action) {
    if (!selectedRow) return;
    const rowNum = selectedRow;

    if (action === 'delete') {
        if (!confirm(`¿Está seguro de que desea borrar la fila ${rowNum}? Esta acción es irreversible.`)) return;

        // 1. Update DOM: Hide/Remove cells in this row
        document.querySelectorAll(`.data-cell[data-coord$="${rowNum}"]`).forEach(el => {
            el.style.display = 'none';
        });
        
        // 2. Update Data Model
        const coordsToDelete = [];
        for (let c = 0; c < NUM_COLUMNS; c++) {
            const coord = getCoord(c, rowNum - 1); // rowNum-1 because index is 0-based
            if (sheetData[coord]) {
                coordsToDelete.push(coord);
            }
        }
        coordsToDelete.forEach(coord => delete sheetData[coord]);

        // 3. Reset selection and save
        selectedRow = null;
        document.querySelectorAll('.data-cell').forEach(el => el.classList.remove('selected'));
        saveData();


    } else if (action === 'clear') {
         const coords = [];
         for (let c = 0; c < NUM_COLUMNS; c++) {
            const coord = getCoord(c, rowNum - 1);
            sheetData[coord].value = '';
            sheetData[coord].formula = null;
            coords.push(coord);
        }

        // Clear the DOM
        document.querySelectorAll(`.data-cell[data-coord$="${rowNum}"]`).forEach(el => {
            el.textContent = '';
        });
        
        saveData();
    } else if (action === 'color') {
        const color = prompt("Ingrese el código de color hexadecimal (ej: #FF0000):", selectedColor || '#ffffcc');
        if (!color) return;

        // Apply color to all cells in the row and save state
        document.querySelectorAll(`.data-cell[data-coord$="${rowNum}"]`).forEach(el => {
            const coord = el.getAttribute('data-coord');
            sheetData[coord].color = color;
            el.style.backgroundColor = color;
        });
        saveData();

    } else if (action === 'hide') {
         // Hide the row visually and reset selection
        document.querySelectorAll(`.data-cell[data-coord$="${selectedRow}"]`).forEach(el => {
            el.style.display = 'none';
        });

        // Reset selection to avoid confusion
        const currentCoord = `${selectedColumn}${selectedRow}`;
        selectedRow = null; 
        document.querySelectorAll('.data-cell').forEach(el => el.classList.remove('selected'));

        saveData();
    }
}


/** Sets up all event listeners */
function setupEventListeners() {
    // --- Cell Interaction Listeners (A1:J20) ---
    document.querySelectorAll('.data-cell').forEach(cell => {
        const coord = cell.getAttribute('data-coord');

        // 1. Click listener for selection and potential recalculation
        cell.addEventListener('click', handleCellClick);

        // 2. Double click/Focus for editing (R1, R10)
        cell.addEventListener('dblclick', (e) => {
            const target = e.currentTarget;
            if (target.readOnly) return; // Prevent focus if already handled by formula calculation

            // Temporarily handle input logic to allow user typing
            target.setAttribute('contenteditable', 'true');
            target.focus();
            
            // Select all text for easy replacement
            const range = window.getSelection().createRange();
            range.selectNodeContents(target);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            // Change cursor to allow typing
            setTimeout(() => { target.setSelectionRange(0, 0); }, 0);
        });
        
        // 3. Blur/Input listener (When user finishes typing)
        cell.addEventListener('blur', (e) => {
             const coord = e.currentTarget.getAttribute('data-coord');
             let rawText = e.currentTarget.innerText;
             
             // Check if the input looks like a formula
             if (rawText.trim().startsWith('=')) {
                 setCellValue(coord, rawText); // Sets formula and triggers calculation
             } else {
                setCellValue(coord, rawText); // Sets text/number and triggers recalculation
             }

            // Re-enable read-only state after input is processed
            e.currentTarget.setAttribute('contenteditable', 'false');
        });
    });


    // --- Control Panel Listeners (R6, R7) ---

    // Column Controls
    document.getElementById('delete-col-btn').addEventListener('click', () => handleColumnAction('delete'));
    document.getElementById('clear-col-btn').addEventListener('click', () => handleColumnAction('clear'));
    document.getElementById('color-col-btn').addEventListener('click', () => handleColumnAction('color'));
    document.getElementById('hide-col-btn').addEventListener('click', () => handleColumnAction('hide'));

    // Row Controls
    document.getElementById('delete-row-btn').addEventListener('click', () => handleRowAction('delete'));
    document.getElementById('clear-row-btn').addEventListener('click', () => handleRowAction('clear'));
    document.getElementById('color-row-btn').addEventListener('click', () => handleRowAction('color'));
    document.getElementById('hide-row-btn').addEventListener('click', () => handleRowAction('hide'));

}


/**
 * Initialization function called when the script loads.
 */
function init() {
    // 1. Setup initial DOM structure (Headers, Labels, Cells)
    initializeGrid();
    
    // 2. Load state from localStorage and populate cell data/styles
    loadState();

    // 3. Attach all event listeners for interactivity
    setupEventListeners();
}


// Start the application
document.addEventListener('DOMContentLoaded', init);
