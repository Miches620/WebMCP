/**
 * R1. Maneja el evento de entrada (input) en cualquier celda editable.
 * Esto asegura que los cambios se manejen correctamente y permite futuras validaciones.
 * @param {Event} event El evento de cambio ocurrido en la celda.
 */
function handleCellInput(event) {
    const cell = event.target;
    // En este punto, simplemente confirmamos que el contenido ha cambiado.
    // Si hubiera lógica de validación o persistencia, iría aquí.
    console.log(`Celda ${cell.dataset.cell} actualizada con: "${cell.innerText}"`);
}

/**
 * R1. Maneja el evento cuando la celda pierde el foco (blur).
 * Esto es útil para guardar el valor final o ejecutar validaciones al terminar de escribir.
 * @param {Event} event El evento de pérdida de foco.
 */
function handleCellBlur(event) {
    const cell = event.target;
    // Aquí se podría implementar lógica de guardado automático o validación final.
    console.log(`Celda ${cell.dataset.cell} perdió el foco. Valor final: "${cell.innerText}"`);
}

/**
 * Inicializa la funcionalidad de la hoja de cálculo, adjuntando los listeners necesarios.
 */
function initializeSpreadsheet() {
    const spreadsheet = document.getElementById('spreadsheet');
    if (!spreadsheet) {
        console.error("No se encontró el elemento #spreadsheet.");
        return;
    }

    // Usamos delegación de eventos en la tabla principal para capturar cualquier cambio 
    // que ocurra dentro de las celdas (td).
    spreadsheet.addEventListener('input', handleCellInput);
    spreadsheet.addEventListener('blur', handleCellBlur);

    console.log("Spreadsheet App inicializada: Edición inline activa.");
}


// Llamada principal para arrancar la aplicación
initializeSpreadsheet();
