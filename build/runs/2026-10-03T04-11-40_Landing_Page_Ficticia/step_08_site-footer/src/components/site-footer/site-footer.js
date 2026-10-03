/**
 * Inicializa el pie de página, actualizando el año del copyright.
 */
function initializeFooter() {
    // Actualizar el año en la sección de derechos de autor
    const yearElement = root.querySelector('#current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

initializeFooter();
