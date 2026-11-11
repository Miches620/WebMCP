/**
 * Inicializa la funcionalidad de edición inline en todas las celdas de datos.
 * Aunque el atributo contenteditable está presente en el HTML, es buena práctica
 * añadir listeners para gestionar el foco y los cambios de manera programática,
 * preparando la estructura para futuras funcionalidades (como guardar o validar).
 */
function initializeCellEditing() {
    // Selecciona todas las celdas de datos que son editables.
    const dataCells = document.querySelectorAll('#spreadsheet-grid td[contenteditable="true"]');

    dataCells.forEach(cell => {
        // Añadimos un listener 'blur' (cuando se pierde el foco) para simular la finalización de la edición.
        cell.addEventListener('blur', function() {
            console.log(`Celda ${this.dataset.cell} perdió el foco. Valor actual: "${this.textContent}"`);
            // Aquí iría lógica de persistencia o validación en futuras implementaciones.
        });

        // Opcionalmente, un listener 'focus' para resaltar visualmente la celda al hacer clic (si se requiere).
        cell.addEventListener('focus', function() {
            this.classList.add('focused-cell'); // Asumiendo que styles.css tiene una clase .focused-cell
        });

        // Limpiar el foco visual cuando se haga clic en cualquier parte del documento.
        document.body.addEventListener('click', function(e) {
            if (!e.target.closest('[contenteditable="true"]')) {
                dataCells.forEach(c => c.classList.remove('focused-cell'));
            }
        });
    });
}

// Función principal que arranca la aplicación
function startApp() {
    initializeCellEditing();
}

startApp();
