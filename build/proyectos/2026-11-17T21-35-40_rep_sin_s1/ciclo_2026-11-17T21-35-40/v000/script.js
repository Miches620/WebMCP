/**
 * Genera una secuencia de letras del alfabeto para las columnas (A, B, C...)
 * @param {number} count - Número de columnas a generar.
 * @returns {string[]} Array con las letras correspondientes.
 */
function generateColumnLetters(count) {
    const letters = [];
    for (let i = 0; i < count; i++) {
        // ASCII code for 'A' is 65. We add the index (i) to get B, C, etc.
        letters.push(String.fromCharCode(65 + i));
    }
    return letters;
}

/**
 * Inicializa la funcionalidad de edición y manejo de eventos para todas las celdas de datos.
 */
function initializeCellEditing() {
    const dataCells = document.querySelectorAll('#spreadsheet-grid tbody td');
    dataCells.forEach(cell => {
        // Añadimos un listener al evento 'input' (se dispara en tiempo real mientras se escribe)
        cell.addEventListener('input', function() {
            handleCellInput(this);
        });

        // También es útil manejar el foco para saber qué celda está activa
        cell.addEventListener('focus', function() {
            console.log(`Foco movido a la celda: ${this.dataset.cell}`);
        });
    });
}

/**
 * Maneja el contenido de una celda cuando se modifica (input event).
 * @param {HTMLElement} cell - La celda que ha sido editada.
 */
function handleCellInput(cell) {
    const newValue = cell.innerText.trim();
    const cellCoordinates = cell.dataset.cell;

    if (!cellCoordinates) return;

    console.log(`[Evento de entrada detectado] Celda ${cellCoordinates} actualizada a: "${newValue}"`);

    // En un entorno real, aquí se enviaría el valor a un modelo o estado central.
    // Por ahora, solo confirmamos que la lectura del texto funciona correctamente.
    if (newValue) {
        console.log(`Valor capturado exitosamente para ${cellCoordinates}.`);
    } else {
        console.log(`Celda ${cellCoordinates} vacía.`);
    }
}

/**
 * Función principal de inicialización que prepara la hoja de cálculo.
 */
function initSpreadsheet() {
    // 1. Inicializar los eventos de edición en todas las celdas (R1)
    initializeCellEditing();

    console.log("Hoja de Cálculo inicializada con éxito.");
    console.log("Prueba: Ahora puedes hacer clic y escribir directamente en cualquier celda para probar la funcionalidad inline.");
}

// Llamada única que arranca la aplicación
document.addEventListener('DOMContentLoaded', initSpreadsheet);
