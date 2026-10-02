/**
 * @fileoverview Lógica de la UI para la Landing Page Ficticia.
 * Maneja interacciones, animaciones y llamadas a la capa de datos simulada (window.api).
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS inicializado: Cargando lógica de la interfaz.");

    // ==============================================================
    // TAREA F3.1: Scroll Suave en Navegación (Navbar)
    // ==============================================================
    const navLinks = document.querySelectorAll('#site-header a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault(); // Prevenir el salto brusco por defecto del navegador

            const targetId = link.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento 'smooth' para garantizar la animación,
                // incluso si el CSS no estuviera configurado o por robustez.
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ==============================================================
    // Lógica de Animaciones al Scroll (Sección R5)
    // Se implementará en una tarea posterior, pero se deja el espacio.
    // ==============================================================
    const sections = document.querySelectorAll('section');
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2 // El elemento debe estar visible al 20% para activar la clase
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Detener de observar una vez que se ha animado
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        // Inicialmente, todas las secciones tienen la clase 'opacity: 0' en CSS,
        // el observador añade la clase 'visible' para activar la transición.
        sectionObserver.observe(section);
    });


    // ==============================================================
    // Manejo del Formulario de Contacto (Sección R3)
    // ==============================================================
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Deshabilitar botón y mostrar carga
            const submitButton = e.target.querySelector('.submit-form');
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';

            try {
                console.log("Intentando enviar datos de contacto...");
                // Llamada a la API simulada (Ahora existe en api.js)
                const result = await window.api.crearContacto(data);

                if (result.success) {
                    alert('¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.');
                    contactForm.reset(); // Limpiar formulario
                } else {
                    alert(`Error al enviar: ${result.message}`);
                }
            } catch (error) {
                console.error("Error de API:", error);
                alert('Hubo un problema al conectar con el servidor. Por favor, inténtalo más tarde.');
            } finally {
                // Restaurar botón y estado
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Solicitud';
            }
        });
    }

    // Nota: La lógica de estadísticas animadas (contadores) se implementará en una tarea posterior.
});
