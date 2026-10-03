// Lógica de la UI.

/**
 * Inicializa el comportamiento de scroll suave para los enlaces internos del Navbar.
 */
const initializeScrollSpy = () => {
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');
    // Asumiendo una altura de cabecera fija (ajustar si es necesario)
    const headerHeight = 80; 

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
};


// --- TAREA F3.4: Implementación del Observador de Intersección (Reveal on Scroll) ---

/**
 * Configura el Intersection Observer para animar elementos al hacer scroll.
 */
const initializeIntersectionObserver = () => {
    const options = {
        root: null, // El viewport es el root
        rootMargin: '0px',
        threshold: 0.15 // Se activa cuando el 15% del elemento está visible (más sensible para mejor flujo)
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
            }
        });
    };

    const observer = new IntersectionObserver(handleIntersect, options);

    // Observadores para secciones principales (Características, Testimonios y Estadísticas)
    const seccionesParaObservar = [
        document.querySelector('#caracteristicas'), // Añadido: Características
        document.querySelector('#testimonios'),
        document.querySelector('#estadisticas-animadas')
    ].filter(el => el); // Filtra elementos nulos

    seccionesParaObservar.forEach(section => {
        observer.observe(section);
    });
};


// --- TAREA F3.6: Manejo del Formulario de Contacto ---

/**
 * Maneja el envío del formulario de contacto, simulando la comunicación con la API.
 */
const handleContactFormSubmit = async (e) => {
    e.preventDefault();

    const form = e.target;
    // Usamos selectores más robustos para asegurar que los elementos existen
    const nameInput = form.querySelector('input[name="nombre"]');
    const emailInput = form.querySelector('input[name="email"]');
    const serviceSelect = form.querySelector('select[name="servicio"]');
    const messageTextarea = form.querySelector('textarea[name="mensaje"]');
    
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
            const successHtml = `
                <div class="success-message" style="padding: 20px; background-color: #e6ffe6; border: 1px solid #b3ffb3; color: #006400; margin-bottom: 20px; border-radius: 5px;">
                    ✅ ¡Mensaje enviado con éxito! Nos pondremos en contacto contigo lo antes posible.
                </div>
            `;
            // Insertar el mensaje justo encima del formulario
            form.insertAdjacentHTML('beforebegin', successHtml);

            form.reset(); // Limpiar los campos
        } else {
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

/**
 * TAREA F4.3.R2.1: Inicializar el contador de estadísticas al cargar la página.
 */
const initializeCounters = () => {
    // Seleccionar todos los elementos con la clase 'counter'
    const counters = document.querySelectorAll('.stat-item .counter');

    counters.forEach(counterElement => {
        // Usamos un pequeño retraso para asegurar que el DOM esté listo y los estilos estén aplicados.
        setTimeout(() => {
            if (counterElement && !counterElement.dataset.counted) {
                // Simular la activación del contador
                counterElement.dataset.counted = 'true'; 
            }
        }, 100);
    });
};

/**
 * TAREA F4.3: Animación de entrada para el Hero (Mejora de Flujo Inicial).
 */
const animateHeroContent = () => {
    const heroTitle = document.querySelector('#inicio h1');
    const heroSubtitle = document.querySelector('#inicio p');
    const ctaButton = document.querySelector('#inicio .cta-button');

    if (heroTitle) {
        // Animación de título con retraso progresivo
        setTimeout(() => {
            heroTitle.classList.add('visible');
        }, 100);
    }
    if (heroSubtitle) {
        // Animación de subtítulo después del título
        setTimeout(() => {
            heroSubtitle.classList.add('visible');
        }, 300);
    }
    if (ctaButton) {
        // Animación del botón al final
        setTimeout(() => {
            ctaButton.classList.add('visible');
        }, 500);
    }
};


/**
 * Función principal de inicialización que se ejecuta al cargar el DOM.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicializar navegación (Scroll Spy)
    initializeScrollSpy();

    // 2. Animación Hero: Ejecutar animación específica para la primera impresión
    animateHeroContent();

    // 3. Inicializar animaciones al hacer scroll (Observador de Intersección)
    initializeIntersectionObserver();

    // 4. Inicializar formulario de contacto
    initializeContactForm();

    // 5. Inicializar contadores de estadísticas
    initializeCounters();
});
