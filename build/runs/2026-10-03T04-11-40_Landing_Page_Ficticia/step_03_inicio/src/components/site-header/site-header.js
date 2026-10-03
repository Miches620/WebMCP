/**
 * Maneja la funcionalidad de navegación y menú hamburguesa.
 * @param {HTMLElement} root - El elemento raíz del componente (#site-header).
 */
function initializeSiteHeader(root) {
    const menuToggle = root.querySelector('.menu-toggle');
    const mainNav = root.querySelector('.main-nav');
    const navLinks = root.querySelectorAll('.main-nav a[href^="#"]');

    // 1. Toggle del menú hamburguesa para móvil
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
        });
    }

    // 2. Manejo de scroll suave y cierre del menú en enlaces internos
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = e.currentTarget.getAttribute('href');
            
            // Si el enlace es interno, hacemos scroll
            if (href && href !== '#') {
                // Intentamos hacer scroll suavemente a la sección objetivo
                document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });

                // Y si estamos en móvil, cerramos el menú después del clic
                if (window.innerWidth <= 992) {
                    mainNav.classList.remove('active');
                }
            }
        });
    });
}

initializeSiteHeader(root);
