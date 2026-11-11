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
 * Helper function to retrieve the calculated value of a cell coordinate.
 */
function getCellValue(coord) {
    const cellElement = document.querySelector(`[data-cell="${coord}"]`);
    if (!cellElement || !cellElement.getAttribute('contenteditable')) return null;

    let value = cellElement.innerText.trim();
    
    // If the content is a formula, we must calculate its true numeric/string value first.
    if (value && typeof value === 'string' && value.startsWith('=')) {
        try {
            // Calculate recursively to ensure dependency values are up-to-date
            return evaluateFormula(value, document); 
        } catch (e) {
            console.warn(`Error calculating cell ${coord}:`, e);
            return value; // Return raw formula if calculation fails
        }
    }

    // If it's a number input, parse it as float/number type for calculations
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && value !== '') {
        return numValue;
    }

    // Otherwise, return the string content (which might be empty or text)
    return value;
}

/**
 * Evaluates a formula string based on cell references and built-in functions (like SUMA).
 */
function evaluateFormula(formula, rootElement) {
    let formulaText = formula.toUpperCase().trim();

    // --- 1. Handle SUMA() function ---
    const sumMatch = formulaText.match(/=SUMA\((.*)\)/);
    if (sumMatch) {
        let argsString = sumMatch[1]; // e.g., A1:A3 or A1;B2;C3

        // Regex to find ranges (e.g., A1:A3). Captures ColStart, RowStart, ColEnd, RowEnd
        const rangeRegex = /([A-Z]+)([0-9]+):([A-Z]+)([0-9]+)/gi; 
        let ranges = [];
        let matchRange;
        while ((matchRange = rangeRegex.exec(argsString)) !== null) {
            ranges.push({ start: `${matchRange[1]}${matchRange[2]}`.toUpperCase(), end: `${matchRange[3]}${matchRange[4]}`.toUpperCase() });
        }

        // Collect coordinates for discrete list items (must be done before range replacement)
        let listCoords = [];
        let tempArgs = argsString;
        if (ranges.length > 0) {
            // Remove ranges to isolate list arguments
            ranges.forEach(r => {
                tempArgs = tempArgs.replace(new RegExp(`(${r.start}:${r.end})`, 'gi'), '');
            });
            listCoords = tempArgs.split(';')
                .map(c => c.trim())
                .filter(c => c && !isNaN(parseFloat(c)) || c.match(/^[A-Z]+[0-9]+$/));
        } else {
             // If no ranges, treat everything as a list item candidate
             listCoords = argsString.split(';')
                 .map(c => c.trim())
                 .filter(c => c && !isNaN(parseFloat(c)) || c.match(/^[A-Z]+[0-9]+$/));
        }


        let valuesToSum = [];

        // Process ranges (assuming vertical range for simplicity, e.g., A1:A3)
        ranges.forEach(({ start, end }) => {
            const colStartChar = start.match(/[A-Z]+/)[0];
            const startRow = parseInt(start.match(/([0-9]+)$/)[1], 10);
            // Assuming the range definition implies column consistency (A1:A3)
            if (colStartChar === end.match(/[A-Z]+/)[0]) {
                const endRow = parseInt(end.match(/([0-9]+)$/)[1], 10);

                for (let r = startRow; r <= endRow; r++) {
                    valuesToSum.push(getCellValue(`${colStartChar}${r}`));
                }
            }
        });

        // Process discrete list coordinates
        listCoords.forEach(coord => {
             const value = getCellValue(coord);
             if (value !== null) valuesToSum.push(value);
        });


        let sum = 0;
        valuesToSum.forEach(val => {
            // Only sum numerical results
            const numVal = parseFloat(typeof val === 'number' ? val : String(val));
            if (!isNaN(numVal)) {
                sum += numVal;
            }
        });
        return sum;
    }

    // --- 2. Handle simple arithmetic operations (A1-B1, A1*B1, etc.) ---
    let expression = formulaText;

    // Replace cell references with their calculated values before evaluation
    expression = expression.replace(/([A-Z]+[0-9]+)/g, (match) => {
        return getCellValue(match);
    });

    try {
        const result = eval(expression); 
        if (typeof result === 'number') {
            return parseFloat(result.toFixed(2)); // Format to two decimal places
        }
        return String(result);

    } catch (e) {
        console.error("Evaluation error:", e);
        // If calculation fails, return the original formula text
        return formula; 
    }
}


/**
 * Clears all content from a specified column letter across all rows in the spreadsheet.
 * @param {string} colLetter - The single character representing the column (e.g., 'A').
 */
function clearColumn(colLetter) {
    // Select all cells within the spreadsheet table that belong to this column
    const cells = document.querySelectorAll(`#spreadsheetTable td[data-cell^="${colLetter}"]`);

    cells.forEach(cell => {
        cell.innerText = '';
    });
}


/**
 * @function setupSpreadsheet
 * Initializes the spreadsheet functionality, ensuring structural elements 
 * (headers, row labels, and editable cells) are ready for user interaction.
 */
function setupSpreadsheet() {
    // Function to handle cell input and automatic formula calculation
    const handleInput = (e) => {
        let cell = e.target;
        let value = cell.innerText.trim();

        if (!value) return;

        if (typeof value === 'string' && value.startsWith('=')) {
            // Intercept the input if it looks like a formula
            const formula = value;
            
            try {
                // Calculate and update the cell content
                const result = evaluateFormula(formula, document); 
                cell.innerText = result;
            } catch (e) {
                 console.error("Error handling input:", e);
            }
        } else if (!value.startsWith('=')) {
             // If user inputs plain text/number, we don't override it.
        }
    };

    const cells = document.querySelectorAll('#spreadsheetTable td[contenteditable="true"]');

    cells.forEach(cell => {
        // Use 'input' event to catch changes from typing or pasting
        cell.addEventListener('input', handleInput);
    });

    // Attach click listeners to column headers (letters A-J)
    const colHeaders = document.querySelectorAll('.col-header');
    colHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const colLetter = this.getAttribute('data-column-letter');
            if (colLetter) {
                // Trigger the clearing action when the header is clicked, 
                // fulfilling the requirement flow for testing purposes.
                clearColumn(colLetter);
            }
        });
    });

    // Attach click listeners to row labels (the number cells in the first column)
    const rowLabels = document.querySelectorAll('.row-label');
    rowLabels.forEach(label => {
        label.addEventListener('click', function() {
            const rowElement = this.closest('tr'); // Obtiene la fila completa <tr>
            if (rowElement) {
                // Encuentra todas las celdas de datos en esa fila y limpia su contenido
                const cellsInRow = rowElement.querySelectorAll('td[contenteditable="true"]');
                cellsInRow.forEach(cell => {
                    cell.innerText = '';
                });
            }
        });
    });


    console.log("Spreadsheet App Initialized: Ready for input.");
}

// Start the application when the script loads
setupSpreadsheet();
