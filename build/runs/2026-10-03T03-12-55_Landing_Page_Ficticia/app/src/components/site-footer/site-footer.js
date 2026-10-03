/**
 * Inicializa las animaciones de aparición al hacer scroll (R5).
 * Utiliza IntersectionObserver para detectar cuándo el footer es visible y anima sus columnas.
 */
function animateFooterElements() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1 // Dispara cuando el 10% del elemento es visible
    };

    // Selecciona todas las columnas de información que deben animarse
    const elementsToObserve = document.querySelectorAll('#site-footer .footer-col');

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Añadir la clase 'visible' para activar la transición CSS
                entry.target.classList.add('visible');
                // Dejar de observar el elemento después de animarlo
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    elementsToObserve.forEach(element => {
        // Observar cada columna para que se active la animación al hacer scroll
        observer.observe(element);
    });
}

// Ejecutar la función cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', animateFooterElements);
