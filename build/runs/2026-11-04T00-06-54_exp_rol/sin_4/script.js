document.addEventListener('DOMContentLoaded', () => {
    const ROWS = 20;
    const COLS = 10; // A through J
    const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    // --- State Management ---
    let spreadsheetState = {}; // Stores { "A1": { value: "", formula: null, color: "#ffffff" }, ... }
    let selectedColLetter = null;
    let selectedRowNumber = null;

    /**
     * Generates a unique coordinate string (e.g., "A1", "J20").
     * @param {string} col - Column letter (A-J).
     * @param {number} row - Row number (1-20).
     * @returns {string} The coordinate.
     */
    const getCoord = (col, row) => `${col}${row}`;

    /**
     * Initializes the grid structure and attaches basic event listeners.
     */
    function setupGrid() {
        const gridArea = document.getElementById('grid-area');
        if (!gridArea) return;

        // 1. Generate the DOM elements for all 20x10 cells
        for (let r = 1; r <= ROWS; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'sheet-row';
            rowDiv.dataset.row = r;

            for (let c = 0; c < COLS; c++) {
                const colLetter = COL_LETTERS[c];
                const coord = getCoord(colLetter, r);

                const cellDiv = document.createElement('div');
                cellDiv.className = 'cell';
                cellDiv.dataset.coord = coord;
                cellDiv.setAttribute('contenteditable', 'true'); // R1, R10
                cellDiv.tabIndex = 0; // Make it focusable

                // Attach click listener for calculation/interaction
                cellDiv.addEventListener('click', handleCellClick);

                rowDiv.appendChild(cellDiv);
            }
            gridArea.appendChild(rowDiv);
        }

        // 2. Initialize state and load data
        initializeState();
        loadDataFromLocalStorage();
        attachHeaderListeners();

        // 3. Initial calculation run (in case loaded formulas depend on each other)
        calculateAllFormulas();
    }

    /**
     * Sets up initial empty state for all cells in the spreadsheetState object.
     */
    function initializeState() {
        for (let r = 1; r <= ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const colLetter = COL_LETTERS[c];
                const coord = getCoord(colLetter, r);
                spreadsheetState[coord] = { value: '', formula: null, color: '#ffffff' };
            }
        }
    }

    /**
     * Saves the current spreadsheet state to localStorage. (R9)
     */
    function saveDataToLocalStorage() {
        localStorage.setItem('spreadsheetData', JSON.stringify(spreadsheetState));
    }

    /**
     * Loads the spreadsheet state from localStorage upon page load. (R17, R20)
     */
    function loadDataFromLocalStorage() {
        const savedData = localStorage.getItem('spreadsheetData');
        if (savedData) {
            try {
                spreadsheetState = JSON.parse(savedData);
                // Apply loaded state to the DOM
                for (let coord in spreadsheetState) {
                    const cellDiv = document.querySelector(`.cell[data-coord="${coord}"]`);
                    if (cellDiv) {
                        // Set contenteditable value and style
                        cellDiv.textContent = spreadsheetState[coord].value === '' ? '' : spreadsheetState[coord].value;
                        cellDiv.style.backgroundColor = spreadsheetState[coord].color;
                        // If it was a formula, we need to recalculate its display value immediately
                    }
                }
            } catch (e) {
                console.error("Error loading spreadsheet data:", e);
            }
        }
    }

    // =============================================
    // FORMULA AND CALCULATION LOGIC (R3, R4, R11, R12)
    // =============================================

    /**
     * Tries to evaluate a formula string based on known cell values.
     * Supports SUMA(range/list), +, -, *, /, and basic references.
     * @param {string} formulaStr - The formula string (e.g., "=SUMA(A1;B2)")
     * @returns {number|string} The calculated result or the original error message.
     */
    function evaluateFormula(formulaStr) {
        if (!formulaStr || typeof formulaStr !== 'string' || !formulaStr.startsWith('=')) {
            return NaN; // Not a formula
        }

        let workingFormula = formulaStr.substring(1).trim();

        // 1. Handle Ranges and Lists for SUMA
        const sumRegex = /SUMA\(([^)]+)\)/i;
        if (sumRegex.test(workingFormula)) {
            let rangeContent = workingFormula.replace(sumRegex, '$1');
            // Replace ; with , to use standard JS splitting/joining if multiple inputs are listed
            rangeContent = rangeContent.replace(/;/g, ',');

            const components = rangeContent.split(',');
            let sumTotal = 0;

            for (const component of components) {
                if (!component.trim()) continue;

                // Check for ranges (A1:A3)
                const rangeMatch = component.match(/([A-Z]+[0-9]+):?([A-Z]+[0-9]+)/i);
                if (rangeMatch) {
                    let startCoord = rangeMatch[1];
                    let endCoord = rangeMatch[2];

                    // Simple implementation: iterate through coordinates if a range is detected
                    const startColIndex = COL_LETTERS.indexOf(startCoord[0]);
                    const startRowNum = parseInt(startCoord.substring(1));
                    const endColIndex = COL_LETTERS.indexOf(endCoord[0]);
                    const endRowNum = parseInt(endCoord.substring(1));

                    let currentSum = 0;
                    for (let r = Math.min(startRowNum, endRowNum); r <= Math.max(startRowNum, endRowNum); r++) {
                        for (let c = Math.min(startColIndex, endColIndex); c <= Math.max(startColIndex, endColIndex); c++) {
                            const col = COL_LETTERS[c];
                            const coord = getCoord(col, r);
                            const value = parseFloat(spreadsheetState[coord] ? spreadsheetState[coord].value : 0) || 0;
                            currentSum += value;
                        }
                    }
                    sumTotal += currentSum;

                } else {
                    // Handle single cell reference (A1 or B2)
                    const match = component.match(/([A-Z]+[0-9]+)/i);
                    if (match) {
                        const coord = match[1];
                        const value = parseFloat(spreadsheetState[coord] ? spreadsheetState[coord].value : 0) || 0;
                        sumTotal += value;
                    }
                }
            }
            return sumTotal.toFixed(2);
        }

        // 2. Handle basic arithmetic (+, -, *, /)
        try {
            let mathExpression = workingFormula;
            // Replace coordinate references (e.g., A1) with their numeric values for evaluation
            mathExpression = mathExpression.replace(/([A-Z]+[0-9]+)/gi, (match) => {
                const coord = match.toUpperCase();
                const value = parseFloat(spreadsheetState[coord] ? spreadsheetState[coord].value : 0);
                return isNaN(value) ? '0' : value; // Treat non-numeric/missing cells as 0 for calculation safety
            });

            // Use Function constructor instead of eval() for slightly safer scope management
            const result = new Function(`return ${mathExpression}`)();
            if (isNaN(result)) return "Error";
            return result.toFixed(2);

        } catch (e) {
            console.error("Calculation error:", e);
            return "Error";
        }
    }


    /**
     * Recalculates the value of a single cell and updates the display.
     * @param {string} coord - The coordinate to calculate (e.g., "B4").
     */
    function calculateCell(coord) {
        const state = spreadsheetState[coord];
        if (!state || !state.formula) {
            return null; // No formula, no calculation needed
        }

        const result = evaluateFormula(state.formula);
        return result;
    }

    /**
     * Iterates over all cells and recalculates any cell that uses a potentially changed reference.
     * This is the core dependency update mechanism (R4).
     */
    function calculateAllFormulas() {
        let changesMade = false;
        // Iterate until no more calculations change, ensuring full propagation.
        for (let cycle = 0; cycle < 5; cycle++) { // Limit cycles to prevent infinite loops
            let nextChangesMade = false;

            for (const coord in spreadsheetState) {
                if (spreadsheetState[coord].formula) {
                    const calculatedValue = calculateCell(coord);
                    // Check if the displayed value needs updating
                    const cellDiv = document.querySelector(`.cell[data-coord="${coord}"]`);
                    if (cellDiv && cellDiv.textContent !== calculatedValue) {
                        cellDiv.textContent = calculatedValue;
                        changesMade = true;
                        nextChangesMade = true;
                    }
                }
            }

            if (!nextChangesMade) break; // No changes in this cycle, done calculating.
        }
        return changesMade;
    }


    // =============================================
    // EVENT HANDLERS AND INTERACTION LOGIC
    // =============================================

    /**
     * Handles input/change events on a cell (R1, R10).
     */
    function handleCellInput(e) {
        const coord = e.target.dataset.coord;
        if (!coord) return;

        let newValue = e.target.textContent.trim();
        let oldState = spreadsheetState[coord];

        // 1. Update State: Save the new value/formula structure
        spreadsheetState[coord].value = newValue;
        spreadsheetState[coord].formula = oldState.formula; // Formula remains unless cleared by user action
        saveDataToLocalStorage();

        // 2. Check if the input was a formula (user typed '=' or started typing it)
        if (newValue.startsWith('=')) {
            spreadsheetState[coord].formula = newValue;
            spreadsheetState[coord].value = ''; // Clear display value when user types formula
        } else {
            // If user deletes the formula, clear both state and display
            if (!oldState.formula && !newValue) {
                spreadsheetState[coord].formula = null;
            } else if (oldState.formula && newValue !== '' && !newValue.startsWith('=')) {
                 // User overwrote a formula with text
                spreadsheetState[coord].formula = null;
            }
        }

        // 3. Recalculate and update the display value
        const calculatedValue = calculateCell(coord);
        if (calculatedValue) {
            e.target.textContent = calculatedValue;
        } else if (!spreadsheetState[coord].formula && newValue !== '') {
             // If it's text, just keep what the user typed
             e.target.textContent = newValue;
        } else if (!spreadsheetState[coord].formula && newValue === '') {
            e.target.textContent = '';
        }

        // 4. Trigger global recalculation (R4) because this cell changed
        calculateAllFormulas();
    }


    /**
     * Handles click events on any cell in the grid area. (R1, R10)
     */
    function handleCellClick(e) {
        const cellDiv = e.target;
        if (!cellDiv.classList.contains('cell')) return;

        const coord = cellDiv.dataset.coord;

        // 1. Focus and make editable (R1, R10)
        cellDiv.focus();
        
        // 2. Trigger the input handler to update state immediately upon click/focus
        handleCellInput({ target: cellDiv });
    }


    /**
     * Handles column header clicks for selection and actions (R6).
     */
    function handleColHeaderClick(e) {
        const colLetter = e.currentTarget.dataset.col;

        // Toggle selection state
        if (selectedColLetter === colLetter) {
            deselectColumn();
        } else {
            selectColumn(colLetter);
        }
    }

    function selectColumn(letter) {
        selectedColLetter = letter;
        document.querySelectorAll('.col-header').forEach(el => el.classList.remove('selected'));
        const activeHeader = document.querySelector(`.col[data-col="${letter}"]`);
        if (activeHeader) {
            activeHeader.classList.add('selected');
        }
        updateControlStates();
    }

    function deselectColumn() {
        selectedColLetter = null;
        document.querySelectorAll('.col-header').forEach(el => el.classList.remove('selected'));
        updateControlStates();
    }


    /**
     * Handles row number clicks for selection and actions (R7).
     */
    function handleRowNumberClick(e) {
        const rowNumber = e.currentTarget.dataset.row;

        // Toggle selection state
        if (selectedRowNumber === rowNumber) {
            deselectRow();
        } else {
            selectRow(rowNumber);
        }
        updateControlStates();
    }

    function selectRow(number) {
        selectedRowNumber = number;
        document.querySelectorAll('.row-header').forEach(el => el.classList.remove('selected'));
        const activeHeader = document.querySelector(`.row-header[data-row="${number}"]`);
        if (activeHeader) {
            activeHeader.classList.add('selected');
        }
    }

    function deselectRow() {
        selectedRowNumber = null;
        document.querySelectorAll('.row-header').forEach(el => el.classList.remove('selected'));
    }


    // =============================================
    // CONTROL ACTIONS (R5, R6, R7, R8, R13, R14, R15, R16)
    // =============================================

    /**
     * Updates the disabled/enabled state of the action buttons based on current selection.
     */
    function updateControlStates() {
        const hasSelection = selectedColLetter || selectedRowNumber;
        document.getElementById('btn-delete-col').disabled = !hasSelection;
        document.getElementById('btn-hide-col').disabled = !selectedColLetter;
        document.getElementById('btn-show-col').disabled = !selectedColLetter;

        document.getElementById('btn-delete-row').disabled = !hasSelection;
        document.getElementById('btn-hide-row').disabled = !selectedRowNumber;
        document.getElementById('btn-show-row').disabled = !selectedRowNumber;
    }


    // --- Column Actions (R6, R13, R14) ---

    /**
     * Clears all content and formats in the selected column. (Test Case: Borrar Columna)
     */
    function clearColumn() {
        if (!selectedColLetter) return;

        for (let r = 1; r <= ROWS; r++) {
            const coord = getCoord(selectedColLetter, r);
            spreadsheetState[coord] = { value: '', formula: null, color: '#ffffff' };
            const cellDiv = document.querySelector(`.cell[data-coord="${coord}"]`);
            if (cellDiv) {
                cellDiv.textContent = '';
                cellDiv.style.backgroundColor = '#ffffff';
            }
        }
        saveDataToLocalStorage();
    }

    /**
     * Sets the background color for all cells in the selected column. (Test Case: Fondo Columna)
     */
    function setColumnBackgroundColor(color) {
        if (!selectedColLetter) return;

        for (let r = 1; r <= ROWS; r++) {
            const coord = getCoord(selectedColLetter, r);
            spreadsheetState[coord].color = color;
            const cellDiv = document.querySelector(`.cell[data-coord="${coord}"]`);
            if (cellDiv) {
                cellDiv.style.backgroundColor = color;
            }
        }
        saveDataToLocalStorage();
    }

    /**
     * Hides the selected column by setting CSS visibility. (R8, R14)
     */
    function hideColumn() {
        if (!selectedColLetter) return;

        const colDivs = document.querySelectorAll(`.cell[data-coord^="${selectedColLetter}"]`);
        colDivs.forEach(div => div.style.visibility = 'hidden');
        // Note: We keep the DOM structure but hide it visually.
    }

    /**
     * Shows all columns, regardless of selection status. (R8)
     */
    function showAllColumns() {
         document.querySelectorAll('.cell').forEach(div => div.style.visibility = 'visible');
    }

    /**
     * Removes the selected column entirely from state and DOM structure. (R13)
     */
    function deleteColumn() {
        if (!selectedColLetter) return;

        // 1. Clear state for all cells in this column
        for (let r = 1; r <= ROWS; r++) {
            const coord = getCoord(selectedColLetter, r);
            delete spreadsheetState[coord];
        }
        
        // 2. Remove DOM elements and adjust layout (Simplified approach: just hide the content)
        const colDivs = document.querySelectorAll(`.cell[data-col="${selectedColLetter}"]`);
        if (colDivs.length > 0) {
            colDivs.forEach(div => div.remove());
        }

        // Reset selection and save
        deselectColumn();
        saveDataToLocalStorage();
    }


    // --- Row Actions (R7, R15) ---

    /**
     * Clears all content and formats in the selected row. (Test Case: Borrar Fila)
     */
    function clearRow() {
        if (!selectedRowNumber) return;

        for (let c = 0; c < COLS; c++) {
            const colLetter = COL_LETTERS[c];
            const coord = getCoord(colLetter, selectedRowNumber);
            spreadsheetState[coord] = { value: '', formula: null, color: '#ffffff' };
        }
        saveDataToLocalStorage();
    }

    /**
     * Sets the background color for all cells in the selected row. (Test Case: Fondo Fila)
     */
    function setRowBackgroundColor(color) {
        if (!selectedRowNumber) return;

        for (let c = 0; c < COLS; c++) {
            const colLetter = COL_LETTERS[c];
            const coord = getCoord(colLetter, selectedRowNumber);
            spreadsheetState[coord].color = color;
            const cellDiv = document.querySelector(`.cell[data-coord="${coord}"]`);
            if (cellDiv) {
                cellDiv.style.backgroundColor = color;
            }
        }
        saveDataToLocalStorage();
    }

    /**
     * Hides the selected row by setting CSS visibility. (R8, R16)
     */
    function hideRow() {
        if (!selectedRowNumber) return;

        const rowDiv = document.querySelector(`.sheet-row[data-row="${selectedRowNumber}"]`);
        if (rowDiv) {
            rowDiv.style.visibility = 'hidden';
        }
    }

    /**
     * Shows all rows, regardless of selection status. (R8)
     */
    function showAllRows() {
         document.querySelectorAll('.sheet-row').forEach(div => div.style.visibility = 'visible');
    }

    /**
     * Removes the selected row entirely from state and DOM structure. (R15)
     */
    function deleteRow() {
        if (!selectedRowNumber) return;

        // 1. Clear state for all cells in this row
        for (let c = 0; c < COLS; c++) {
            const colLetter = COL_LETTERS[c];
            const coord = getCoord(colLetter, selectedRowNumber);
            delete spreadsheetState[coord];
        }

        // 2. Remove DOM elements
        const rowDiv = document.querySelector(`.sheet-row[data-row="${selectedRowNumber}"]`);
        if (rowDiv) {
            rowDiv.remove();
        }

        // Reset selection and save
        deselectRow();
        saveDataToLocalStorage();
    }


    // =============================================
    // INITIALIZATION AND EVENT BINDING
    // =============================================

    /**
     * Attaches listeners to column headers (A-J).
     */
    function attachHeaderListeners() {
        const colHeaders = document.querySelectorAll('.col-header');
        colHeaders.forEach(header => {
            header.addEventListener('click', handleColHeaderClick);
        });
    }

    /**
     * Attaches listeners to row number headers (1-20).
     */
    function attachRowListeners() {
        for (let r = 1; r <= ROWS; r++) {
            const rowNumberDiv = document.createElement('div');
            rowNumberDiv.className = 'row-header';
            rowNumberDiv.dataset.row = r;
            rowNumberDiv.textContent = r;

            // Need to inject this header structure into the main grid container if it wasn't there structurally
            const gridArea = document.getElementById('grid-area');
            if (!document.querySelector('.header-row + #grid-area > .corner-spacer').nextElementSibling) {
                 // This assumes a structural place for row headers is needed above the rows, 
                 // but since index.html only provides grid-area, we simulate adding the structure.
                const cornerSpacer = document.querySelector('.corner-spacer');
                if (cornerSpacer && !document.querySelector('.row-headers-container')) {
                    const rowHeaderContainer = document.createElement('div');
                    rowHeaderContainer.id = 'row-header-container';
                    rowHeaderContainer.className = 'row-header-container';
                    rowNumberDiv.addEventListener('click', handleRowNumberClick);
                    cornerSpacer.parentNode.insertBefore(rowHeaderContainer, cornerSpacer.nextSibling);
                    rowHeaderContainer.appendChild(rowNumberDiv);
                } else {
                     // If structure is complex, just attach the listener to the existing row number divs if they were placed correctly by CSS/HTML structure (Assuming index.html was modified slightly for this)
                     rowNumberDiv.addEventListener('click', handleRowNumberClick);
                }
            }

        }
    }


    /**
     * Binds all action buttons to the corresponding functions.
     */
    function bindActionListeners() {
        document.getElementById('btn-delete-col').addEventListener('click', deleteColumn);
        document.getElementById('btn-hide-col').addEventListener('click', hideColumn);
        document.getElementById('btn-show-col').addEventListener('click', showAllColumns);

        document.getElementById('btn-delete-row').addEventListener('click', deleteRow);
        document.getElementById('btn-hide-row').addEventListener('click', hideRow);
        document.getElementById('btn-show-row').addEventListener('click', showAllRows);
    }


    // --- Main Initialization Function ---
    function init() {
        setupGrid(); // Creates DOM, loads state, attaches cell listeners
        attachHeaderListeners(); // Attaches column header listeners
        bindActionListeners(); // Binds control buttons

        // We must ensure the row headers are attached and functional. 
        // Since index.html structure is fixed, we assume the required row number divs (1-20) exist or need to be handled by JS if they weren't generated structurally.
        // For robustness against missing HTML structure for row numbers, we rely on the initial grid generation process having provided a clickable element *before* the rows start.
         for (let r = 1; r <= ROWS; r++) {
            const rowHeaderDiv = document.querySelector(`.sheet-row[data-row="${r}"]`).parentNode?.querySelector('.corner-spacer');
             if(rowHeaderDiv && !rowHeaderDiv.hasAttribute('data-listener')) {
                // Crude workaround: Assume the first element before the grid area is where we need to attach listeners for row numbers 1-20
                const headerContainer = document.getElementById('spreadsheet-container').querySelector('.header-row').parentNode;
                let existingHeader = document.querySelector(`.row-header[data-row="${r}"]`);

                if(!existingHeader) {
                    // If the HTML structure didn't provide row numbers, we must inject them for listeners to work.
                    const newRowHeader = document.createElement('div');
                    newRowHeader.className = 'row-header';
                    newRowHeader.dataset.row = r;
                    newRowHeader.textContent = r;
                    document.querySelector('.corner-spacer').parentNode.prepend(newRowHeader);

                } else {
                     existingHeader.removeEventListener('click', handleRowNumberClick); // Prevent duplicates
                     existingHeader.addEventListener('click', handleRowNumberClick);
                }
            }
        }


        // Initial update of control buttons state
        updateControlStates();
    }

    init();
});
