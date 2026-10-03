// Lógica de la UI.

// Lógica de la UI.

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento suave para el desplazamiento
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Lógica de la UI.

/**
 * Inicializa el observador de intersección (Intersection Observer)
 * para detectar cuándo las secciones clave entran en la vista del usuario,
 * activando así sus animaciones de aparición.
 */
const observerOptions = {
    root: null, // Observa respecto al viewport
    rootMargin: '0px',
    threshold: 0.2 // Se dispara cuando el 20% del elemento es visible
};

/**
 * Callback que se ejecuta cuando un elemento cruza el umbral de intersección.
 * @param {IntersectionObserverEntry[]} entries - Array de entradas observadas.
 * @param {IntersectionObserver} observer - El objeto Intersection Observer.
 */
const handleIntersect = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Si el elemento está visible, añade la clase de activación para animarlo
            entry.target.classList.add('reveal-active');

            // Opcional: Desconectar el observador una vez que se ha activado la animación
            observer.unobserve(entry.target);
        }
    });
};

/**
 * Inicializa y ejecuta el Intersection Observer para las secciones de contenido clave.
 */
const setupRevealAnimations = () => {
    // 1. Seleccionar los contenedores principales que deben animarse: Testimonios y Estadísticas.
    const elementsToObserve = [
        document.querySelector('#testimonios .testimonial-card'), // Observar cada tarjeta de testimonio individualmente
        ...Array.from(document.querySelectorAll('#estadisticas-animadas .stat-item')) // Observar cada ítem estadístico
    ].filter(el => el); // Filtra elementos nulos

    if (elementsToObserve.length === 0) {
        console.warn("No se encontraron elementos clave para animar con Intersection Observer.");
        return;
    }

    // 2. Crear la instancia del observador
    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    // 3. Observar cada elemento seleccionado
    elementsToObserve.forEach(element => {
        observer.observe(element);
    });
};


document.addEventListener('DOMContentLoaded', () => {
    // Lógica de navegación (ya existente)
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento suave para el desplazamiento
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Llamar a la función de animación al cargar la página
    setupRevealAnimations();
});
