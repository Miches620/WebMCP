/**
 * Inicializa la animación de entrada (Entrance Animation) para el Hero Section.
 * Utiliza IntersectionObserver para detectar cuándo la sección es visible en el viewport.
 */
function initializeHeroAnimation() {
    const heroSection = root; // 'root' is the <section id="inicio">

    if (!heroSection) return;

    // 1. Configurar el observador de intersección
    const observerOptions = {
        root: null, // Observa respecto al viewport
        rootMargin: '0px',
        threshold: 0.2 // Se dispara cuando el 20% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Si la sección está visible, añade la clase 'is-visible' al contenedor principal
                heroSection.classList.add('is-visible');

                // 2. Animación de secuencia: Añadir clases a los elementos internos con delay
                const elementsToAnimate = [
                    root.querySelector('[data-animate]:nth-child(1)'), // H1
                    root.querySelector('[data-animate]:nth-child(2)'), // Subtitle
                    root.querySelector('[data-animate]:nth-child(3)'), // CTA Group
                    root.querySelector('[data-animate]:nth-child(4)')  // Image Area
                ];

                elementsToAnimate.forEach((el, index) => {
                    if (el) {
                        // Usamos un pequeño timeout para asegurar que la transición se aplique secuencialmente
                        setTimeout(() => {
                            el.classList.add('is-visible');
                        }, 100 + (index * 200)); // Retraso creciente: 100ms, 300ms, 500ms...
                    }
                });

                // Detener la observación una vez que se ha animado
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar el contenedor principal de la sección
    observer.observe(heroSection);
}

initializeHeroAnimation();
