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
