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
    // TAREA F3.4: Animación de Aparición al Scroll (Reveal)
    // Implementa Intersection Observer para animar secciones clave.
    // ==============================================================
    const sections = document.querySelectorAll('section');
    
    // Opciones del observador: se activa cuando el 20% del elemento es visible en la ventana.
    const observerOptions = {
        root: null, // Observa respecto a la ventana de visualización
        rootMargin: '0px',
        threshold: 0.15 // Se activa cuando el 15% del elemento está visible
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Añadir la clase 'visible' para que CSS active la transición de aparición
                entry.target.classList.add('visible');
                // Detener de observar una vez que se ha animado, optimizando el rendimiento
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        // Observar cada sección para esperar a su aparición en la vista
        sectionObserver.observe(section);
    });


    // ==============================================================
    // Manejo del Formulario de Contacto (Sección R3) - F4.4
    // ==============================================================
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // --- TAREA F3.5: Validación Client-Side ---
            let isValid = true;
            const nameInput = document.getElementById('nombre');
            const emailInput = document.getElementById('email');
            
            // Limpiar mensajes de error previos (si los hubiera)
            nameInput.style.border = '1px solid #ccc';
            emailInput.style.border = '1px solid #ccc';

            // 1. Validar Nombre (Obligatorio)
            if (!data.nombre || data.nombre.trim() === '') {
                alert("Por favor, ingresa tu nombre completo.");
                nameInput.focus();
                nameInput.style.border = '2px solid red'; // Feedback visual de error
                isValid = false;
            }

            // 2. Validar Email (Obligatorio y Formato)
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!data.email || data.email.trim() === '') {
                alert("Por favor, ingresa tu correo electrónico.");
                emailInput.focus();
                emailInput.style.border = '2px solid red'; // Feedback visual de error
                isValid = false;
            } else if (!emailPattern.test(data.email)) {
                alert("El formato del correo electrónico no es válido. Debe incluir @ y un dominio.");
                emailInput.focus();
                emailInput.style.border = '2px solid red'; // Feedback visual de error
                isValid = false;
            }

            if (!isValid) {
                // Si la validación falla, detenemos el proceso de envío
                return; 
            }
            // --- Fin TAREA F3.5 ---


            // Deshabilitar botón y mostrar carga (Solo si es válido)
            const submitButton = e.target.querySelector('.submit-form');
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';

            try {
                console.log("Intentando enviar datos de contacto...");
                // Llamada a la API simulada (window.api.crearContacto)
                const result = await window.api.crearContacto(data);

                if (result.success) {
                    // Éxito: Mostrar mensaje y limpiar formulario
                    alert('✅ ¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.');
                    contactForm.reset(); 
                } else {
                    // Fallo de validación simulada del backend mock
                    alert(`❌ Error al enviar: ${result.message}`);
                }
            } catch (error) {
                console.error("Error de API:", error);
                // Manejo de errores inesperados (ej. red caída, aunque es simulado)
                alert('⚠️ Hubo un problema técnico. Por favor, inténtalo más tarde o llama directamente.');
            } finally {
                // Restaurar botón y estado en cualquier caso
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Solicitud';
            }
        });
    }

    // Nota: La lógica de estadísticas animadas (contadores) se implementará en una tarea posterior.
});
