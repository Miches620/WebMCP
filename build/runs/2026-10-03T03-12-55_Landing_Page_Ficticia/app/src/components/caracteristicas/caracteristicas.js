/**
 * Inicializa el Intersection Observer para animar las tarjetas de características
 * cuando entran en la vista (Scroll Animation - R5).
 */
function initializeFeatureAnimations() {
    const revealElements = document.querySelectorAll('.reveal');

    if (!revealElements.length) return;

    // Opción del observador: disparar cuando el elemento esté visible al 10% de su área
    const options = {
        root: null, 
        rootMargin: '0px', 
        threshold: 0.1 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Si el elemento está visible, añade la clase para activar la animación CSS
                entry.target.classList.add('is-visible');
                // Deja de observar una vez que se ha animado
                observer.unobserve(entry.target); 
            }
        });
    }, options);

    revealElements.forEach(element => {
        observer.observe(element);
    });
}

// Ejecutar la función al cargar el componente
initializeFeatureAnimations();
