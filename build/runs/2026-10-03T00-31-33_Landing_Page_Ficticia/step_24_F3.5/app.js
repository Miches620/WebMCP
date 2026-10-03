// Lógica de la UI.

/**
 * Inicializa el comportamiento de scroll suave para los enlaces internos del Navbar.
 */
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');
    const headerHeight = 80; // Asumiendo una altura de cabecera fija

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Calcula la posición de scroll, restando la altura del header para que el contenido no quede oculto detrás de él.
                const offsetTop = targetElement.offsetTop - headerHeight; 

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
});

/**
 * Inicializa el comportamiento de scroll suave para los enlaces internos del Navbar.
 */
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');
    const headerHeight = 80; // Asumiendo una altura de cabecera fija

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Calcula la posición de scroll, restando la altura del header para que el contenido no quede oculto detrás de él.
                const offsetTop = targetElement.offsetTop - headerHeight; 

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- TAREA F3.4: Implementación del Observador de Intersección (Reveal on Scroll) ---

    const options = {
        root: null, // El viewport es el root
        rootMargin: '0px',
        threshold: 0.2 // Se activa cuando el 20% del elemento está visible
    };

    /**
     * Función de callback para Intersection Observer API.
     * @param {IntersectionObserverEntry[]} entries - Lista de elementos que cruzaron la intersección.
     */
    const handleIntersect = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // El elemento está visible en el viewport
                entry.target.classList.add('visible');
                
                // Detener la observación una vez que se ha animado para no re-animar al hacer scroll hacia arriba/abajo
                observer.unobserve(entry.target); 
            } else {
                // Opcional: Si quieres que el elemento desaparezca si sale de vista, puedes añadir lógica aquí.
            }
        });
    };

    // Observadores para secciones principales (Testimonios y Estadísticas)
    const observer = new IntersectionObserver(handleIntersect, options);

    // 1. Observar la sección de Testimonios
    const testimoniosSection = document.querySelector('#testimonios');
    if (testimoniosSection) {
        observer.observe(testimoniosSection);
    }

    // 2. Observar la sección de Estadísticas Animadas
    const estadisticasSection = document.querySelector('#estadisticas-animadas');
    if (estadisticasSection) {
        observer.observe(estadisticasSection);
    }
});
