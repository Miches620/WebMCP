/**
 * @param {HTMLElement} root - El elemento raíz del componente (#inicio).
 */
function initializeInicio(root) {
    // Función para manejar la animación de entrada al hacer scroll (R5)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2 // Se activa cuando el 20% del elemento es visible
    };

    /**
     * IntersectionObserver que detecta cuándo la sección Hero entra en vista.
     */
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Al detectar que el elemento está visible, añadimos una clase al root.
                // Esta clase activa los estilos CSS de animación para todos los elementos con data-animate.
                root.classList.add('data-visible'); 
                observer.unobserve(entry.target); // Dejar de observar una vez activado
            }
        });
    }, observerOptions);

    // Observar el contenedor principal de la sección Hero (el root)
    observer.observe(root);
}
