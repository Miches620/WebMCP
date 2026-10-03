/**
 * @param {HTMLElement} root - El elemento raíz del componente (#site-header).
 */
function initializeSiteHeader(root) {
    const menuToggle = root.querySelector('.menu-toggle');
    const mainNav = root.querySelector('#main-nav');

    if (!menuToggle || !mainNav) return;

    // 1. Funcionalidad de Toggle del Menú Móvil (Hamburger)
    menuToggle.addEventListener('click', () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true';
        menuToggle.setAttribute('aria-expanded', isExpanded);

        if (isExpanded === 'true') {
            mainNav.classList.add('active');
        } else {
            mainNav.classList.remove('active');
        }
    });

    // 2. Funcionalidad de Scroll Suave para Enlaces Internos
    const navLinks = root.querySelectorAll('.nav-list a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Si estamos en móvil y el menú está abierto, cerramos el menú después del click
                if (window.innerWidth <= 992 && mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                    menuToggle.setAttribute('aria-expanded', 'false');
                }

                // Usamos scrollIntoView con comportamiento suave, aunque body ya lo tiene configurado
                e.preventDefault(); 
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}
