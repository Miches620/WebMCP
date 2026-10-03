/**
 * Inicializa el Intersection Observer para animar los testimonios al hacer scroll (R5).
 */
function initializeTestimonialsAnimation() {
    const root = document.getElementById('testimonios');
    if (!root) return;

    // Selecciona todos los elementos que deben animarse
    const elementsToObserve = root.querySelectorAll('.fade-in-element');

    /**
     * Callback ejecutado cuando el elemento entra en la vista.
     * @param {IntersectionObserverEntry[]} entries - Array de entradas observadas.
     */
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Añadir la clase 'visible' para activar las transiciones CSS
                entry.target.classList.add('visible');
                
                // Detener la observación una vez que se ha animado
                observer.unobserve(entry.target);
            }
        });
    };

    // Configuración del observador: dispara cuando el elemento está visible (0.1)
    const observerOptions = {
        root: null, 
        rootMargin: '0px', 
        threshold: 0.2 // Se considera visible si el 20% está en la vista
    };

    // Crear y ejecutar el observador
    const observer = new IntersectionObserver(observerCallback, observerOptions);

    elementsToObserve.forEach(element => {
        observer.observe(element);
    });
}

initializeTestimonialsAnimation();
