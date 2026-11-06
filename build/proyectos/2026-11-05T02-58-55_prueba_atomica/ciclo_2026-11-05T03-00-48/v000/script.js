/**
 * R1. Maneja la edición de celdas inline.
 * Se adjunta un listener al contenedor principal para capturar eventos 
 * en cualquier celda editable (td con data-cell).
 */
function setupCellEditing() {
    const spreadsheet = document.getElementById('spreadsheet');

    if (!spreadsheet) {
        console.error("Error: No se encontró la tabla de cálculo.");
        return;
    }

    // Usamos event delegation para escuchar en toda la tabla, 
    // pero solo actuar si el elemento objetivo es una celda de datos editable.
    spreadsheet.addEventListener('input', function(event) {
        const target = event.target;
        
        // Verificamos que el elemento sea un TD y tenga el atributo data-cell
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            // El navegador ya maneja la actualización del contenido al escribir, 
            // pero este listener asegura que cualquier cambio de texto se registre o valide si fuera necesario.
            // Para esta prueba simple, solo necesitamos asegurar que el evento se propague y funcione.
            console.log(`Celda ${target.getAttribute('data-cell')} actualizada con: "${target.innerText}"`);
        }
    });

    // También es bueno manejar el blur (cuando sale de la celda) para simular un "guardado" o validación final.
    spreadsheet.addEventListener('blur', function(event) {
        const target = event.target;
        if (target.tagName === 'TD' && target.hasAttribute('data-cell')) {
            console.log(`Celda ${target.getAttribute('data-cell')} perdió el foco.`);
        }
    });
}

/**
 * Inicializa la aplicación de hoja de cálculo. 
 * Se encarga de configurar todos los listeners necesarios al cargar la página.
 */
function initializeSpreadsheet() {
    console.log("Inicializando Hoja de Cálculo...");
    setupCellEditing();
    // Aquí se añadirían futuras inicializaciones (ej: carga de datos, cálculos)
}

// Llamada principal para arrancar la aplicación
initializeSpreadsheet();
