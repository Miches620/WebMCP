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

// --- TAREA F3.6: Manejo del Formulario de Contacto ---

/**
 * Maneja el envío del formulario de contacto, simulando la comunicación con la API.
 */
const handleContactFormSubmit = async (e) => {
    e.preventDefault();

    const form = e.target;
    const nameInput = form.querySelector('#nombre');
    const emailInput = form.querySelector('#email');
    const serviceSelect = form.querySelector('#servicio');
    const messageTextarea = form.querySelector('#mensaje');
    
    // 1. Recolección de datos
    const formData = {
        nombre: nameInput ? nameInput.value : '',
        email: emailInput ? emailInput.value : '',
        servicio: serviceSelect ? serviceSelect.value : '',
        mensaje: messageTextarea ? messageTextarea.value : ''
    };

    // 2. Preparación de la UI para el envío (Feedback visual)
    const submitButton = form.querySelector('.submit-form');
    const successMessageContainer = document.getElementById('contacto').querySelector('.success-message');
    const errorSummaryContainer = document.getElementById('contacto').querySelector('.form-error-summary');

    // Limpiar mensajes anteriores y deshabilitar el botón
    if (successMessageContainer) successMessageContainer.remove();
    if (errorSummaryContainer) errorSummaryContainer.remove();
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
        // 3. Llamada a la API simulada
        const isSuccess = await window.api.enviarContacto(formData);

        if (isSuccess) {
            // Éxito: Mostrar mensaje y limpiar formulario
            if (successMessageContainer) successMessageContainer.remove(); // Asegurarse de que no exista antes de añadirlo
            
            const successHtml = `
                <div class="success-message" style="padding: 20px; background-color: #e6ffe6; border: 1px solid #b3ffb3; color: #006400; margin-bottom: 20px; border-radius: 5px;">
                    ✅ ¡Mensaje enviado con éxito! Nos pondremos en contacto contigo lo antes posible.
                </div>
            `;
            // Insertar el mensaje justo encima del formulario
            form.insertAdjacentHTML('beforebegin', successHtml);

            form.reset(); // Limpiar los campos
        } else {
            // Fallo (aunque la API siempre devuelve true, es buena práctica)
            throw new Error("Error desconocido al enviar.");
        }
    } catch (error) {
        // Manejo de errores: Mostrar mensaje de error
        const errorHtml = `
            <div class="form-error-summary" style="padding: 15px; background-color: #ffe6e6; border: 1px solid #ffb3b3; color: #cc0000; margin-bottom: 20px; border-radius: 5px;">
                ❌ Lo sentimos, ocurrió un error al enviar tu consulta. Por favor, inténtalo más tarde o llámanos directamente.
            </div>
        `;
        if (errorSummaryContainer) errorSummaryContainer.remove();
        form.insertAdjacentHTML('beforebegin', errorHtml);

    } finally {
        // 4. Restaurar el estado del botón
        submitButton.disabled = false;
        submitButton.textContent = 'Enviar Consulta';
    }
};


/**
 * Inicializa el evento de envío para el formulario de contacto.
 */
const initializeContactForm = () => {
    const contactForm = document.querySelector('#contacto .contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);
    }
};

// Llamar a la inicialización al final del DOMContentLoaded para asegurar que todos los elementos existen.
initializeContactForm();
