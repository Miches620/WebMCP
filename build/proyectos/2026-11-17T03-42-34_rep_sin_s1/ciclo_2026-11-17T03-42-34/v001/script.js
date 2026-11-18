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
    const colorPicker = document.getElementById('cell-background-color');
    let activeCell = null;

    // Función para limpiar el foco visual de la celda anterior
    function clearActiveState(oldCell) {
        if (oldCell && oldCell !== activeCell) {
            oldCell.classList.remove('highlighted');
        }
    }

    // 1. Manejar eventos en las celdas de datos
    dataCells.forEach(cell => {
        // Listener para el evento 'input' (se dispara al escribir)
        cell.addEventListener('focus', function() {
            // Al hacer foco, aseguramos que la celda esté activa visualmente y lista para recibir color.
            clearActiveState(activeCell);
            this.classList.add('highlighted');
            activeCell = this;

            // Si ya hay un color seleccionado en el picker, se aplica inmediatamente (o al menos se prepara)
        });

        cell.addEventListener('blur', function() {
            // Al perder foco, removemos la clase de resaltado
            this.classList.remove('highlighted');
            activeCell = null;
        });


        // Listener para el evento 'click' (más robusto que solo focus para algunos casos)
        cell.addEventListener('click', function() {
             clearActiveState(activeCell);
             this.classList.add('highlighted');
             activeCell = this;
        });

        // Añadimos un listener general de foco/clic para simular la selección activa
        // y permitir que el color se aplique correctamente cuando el usuario interactúa con el picker o la celda.
    });


    // 2. Manejar eventos en el selector de color (Color Picker)
    colorPicker.addEventListener('input', function() {
        const selectedColor = this.value;

        // Intentar encontrar la celda actualmente activa para aplicar el color
        if (activeCell) {
            handleColorChange(activeCell, selectedColor);
        } else {
             console.log("Por favor, haga clic en una celda primero para seleccionar su fondo.");
        }
    });

    // Inicialmente, forzamos un foco en la primera celda para que el usuario sepa dónde empezar.
    if (dataCells[0]) {
        dataCells[0].focus();
    }
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

function handleColorChange(cell, color) {
    // Aplicamos el fondo y marcamos la clase de resaltado para que CSS lo maneje visualmente si es necesario
    cell.style.backgroundColor = color;
    cell.classList.add('highlighted');

    console.log(`Fondo de ${cell.dataset.cell} cambiado a: ${color}`);
}
