/**
 * Inicializa la observación de las características al hacer scroll (R5).
 */
function initializeFeaturesAnimation() {
    const featureCards = document.querySelectorAll('.feature-card');

    if (!featureCards.length) return;

    // Usamos IntersectionObserver para detectar cuándo el componente entra en vista
    const observerOptions = {
        root: null, // Observa respecto al viewport
        rootMargin: '0px',
        threshold: 0.2 // Se activa cuando el 20% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // El componente está en vista, lo hacemos visible
                entry.target.classList.add('visible');
                // Dejamos de observar una vez que se ha animado
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    featureCards.forEach(card => {
        // Observar cada tarjeta individualmente
        observer.observe(card);
    });
}

initializeFeaturesAnimation();
