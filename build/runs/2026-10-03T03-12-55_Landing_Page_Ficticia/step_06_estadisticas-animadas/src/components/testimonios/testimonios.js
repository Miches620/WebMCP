/**
 * Inicializa la animación de aparición al hacer scroll (Intersection Observer).
 * Esto hace que los testimonios aparezcan suavemente cuando el usuario se desplaza hasta ellos.
 */
function initializeTestimonialAnimations() {
    const elements = document.querySelectorAll('.fade-in-element');

    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null, // Observa respecto al viewport
            rootMargin: '0px',
            threshold: 0.1 // Se activa cuando el 10% del elemento es visible
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Cuando el elemento entra en vista, lo mostramos y detenemos la observación
                    entry.target.style.opacity = 1;
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        elements.forEach(element => {
            // Inicialmente, los elementos están ocultos y ligeramente desplazados (esto se maneja en CSS)
            observer.observe(element);
        });
    } else {
        // Fallback para navegadores antiguos: simplemente los mostramos
        document.querySelectorAll('.fade-in-element').forEach(el => {
             el.style.opacity = 1;
        });
    }
}

// Ejecutar la función de inicialización cuando el componente está listo
initializeTestimonialAnimations();
