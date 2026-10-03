/**
 * Maneja la lógica de animación al hacer scroll (Intersection Observer).
 * Se asegura de que los elementos no estén ocultos por defecto en el DOM.
 */
function setupScrollAnimation() {
    const targets = document.querySelectorAll('[data-animation-target]');

    if (!targets.length) return;

    // Configuración del observador: se activa cuando el 15% del elemento es visible
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Mostrar el elemento al entrar en vista
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target); // Detener la observación después de mostrarlo
            }
        });
    }, observerOptions);

    targets.forEach(target => {
        // Inicialmente, aplicar el estado oculto para que la animación funcione
        target.style.opacity = 0;
        target.style.transform = 'translateY(20px)';
        // Asegurar que la transición esté definida en línea si no está en CSS global
        target.style.transition = 'all var(--transition-speed) ease-out';
        observer.observe(target);
    });
}

/**
 * Muestra el mensaje de feedback en la sección de contacto, gestionando clases y contenido.
 * @param {string} message - El texto del mensaje a mostrar.
 * @param {'success'|'error'|'loading'} type - Tipo de mensaje para estilizarlo.
 */
function showFeedback(message, type) {
    const feedbackDiv = document.getElementById('formFeedback');
    if (!feedbackDiv) return;

    // Limpiar clases y contenido previo
    feedbackDiv.innerHTML = '';
    feedbackDiv.className = 'mb-md p-3 rounded text-center'; // Reset classes
    feedbackDiv.classList.add('hidden'); 

    let successClass = 'bg-success text-green-700';
    let errorClass = 'bg-error text-red-700';
    let loadingClass = 'bg-yellow-100 text-yellow-800'; // Usamos un color de advertencia para carga

    if (type === 'success') {
        feedbackDiv.classList.add(successClass);
        feedbackDiv.innerHTML = `<p class="mb-0">${message}</p>`;
        feedbackDiv.classList.remove('hidden');
    } else if (type === 'error') {
        feedbackDiv.classList.add(errorClass);
        feedbackDiv.innerHTML = `<p class="mb-0">${message}</p>`;
        feedbackDiv.classList.remove('hidden');
    } else if (type === 'loading') {
        // Mostrar un mensaje de carga más neutro
        feedbackDiv.classList.add(loadingClass);
        feedbackDiv.innerHTML = `<div class="d-flex align-items-center justify-content-center">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> 
            ${message}
        </div>`;
        feedbackDiv.classList.remove('hidden');
    } else {
         // Caso por defecto o inicialización
         feedbackDiv.innerHTML = '';
    }
}


/**
 * Valida el formulario de contacto antes del envío.
 * @param {Event} e - El evento de submit.
 * @returns {boolean} True si la validación es exitosa, False en caso contrario.
 */
function validateForm(e) {
    const form = document.getElementById('contactForm');
    if (!form) return false;

    // Limpiar mensajes previos y clases de error
    document.querySelectorAll('.form-group input:not([type="submit"]), .form-group select, .form-group textarea').forEach(el => {
        el.classList.remove('is-invalid');
    });
    showFeedback('', null); // Limpiar feedback

    let isValid = true;

    // Obtener elementos del formulario
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const subjectSelect = document.getElementById('subject');
    const messageTextarea = document.getElementById('message');

    // Función de validación individual y feedback visual
    const validateField = (input, requiredMessage) => {
        if (!input || !requiredMessage) return true; // Si el elemento no existe o no es requerido, pasa.

        const value = input.value.trim();
        let fieldValid = true;
        let errorMessage = '';

        if (!value) {
            fieldValid = false;
            errorMessage = 'Este campo es obligatorio.';
        } else if (input.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                fieldValid = false;
                errorMessage = 'Por favor, ingresa un correo electrónico válido.';
            }
        }

        // Aplicar feedback visual
        if (fieldValid) {
            input.classList.remove('is-invalid');
        } else {
            input.classList.add('is-invalid');
            showFeedback(errorMessage || 'Por favor, completa este campo.', 'error'); // Usamos el feedback general para errores de validación
        }

        return fieldValid;
    };

    // 1. Validación de Nombre
    if (!validateField(nameInput, 'Nombre Completo')) {
        isValid = false;
    } else {
        showFeedback('', null); // Limpiar feedback si es válido
    }

    // 2. Validación de Email (Formato)
    if (!validateField(emailInput, 'Correo Electrónico')) {
        isValid = false;
    }

    // 3. Validación de Asunto (Select)
    if (!validateField(subjectSelect, 'Área de Interés / Asunto')) {
        isValid = false;
    }

    // 4. Validación de Mensaje
    if (!validateField(messageTextarea, 'Mensaje / Detalles del Proyecto')) {
        isValid = false;
    }

    return isValid;
}


// Event Listener principal para el formulario y la inicialización
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contactForm');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validateForm(e)) {
                // Si la validación falla, el feedback ya está mostrado por validateForm
                return;
            }

            const submitButton = form.querySelector('.btn--primary');
            const originalText = submitButton.textContent;

            // 1. Mostrar estado de carga y deshabilitar botón
            showFeedback('Enviando tu solicitud...', 'loading');
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Enviando...';

            // 2. Recolectar datos
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                subject: document.getElementById('subject').value,
                message: document.getElementById('message').value
            };

            try {
                // 3. Simular envío API (Asumiendo que window.api ya tiene esta función)
                const result = await window.api.submitContactForm(formData);

                if (result && result.success) {
                    showFeedback('✅ ¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.', 'success');
                    form.reset(); // Limpiar el formulario visiblemente
                } else {
                    // Manejo de errores específicos del backend simulado
                    const errorMessage = result && result.message ? result.message : 'Intenta más tarde o contacta por teléfono.';
                    showFeedback(`❌ Error al enviar: ${errorMessage}`, 'error');
                }

            } catch (error) {
                console.error("Error durante la simulación API:", error);
                showFeedback('⚠️ Hubo un problema de conexión. Por favor, inténtalo de nuevo.', 'error');
            } finally {
                // 4. Restaurar estado del botón
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }

    // Inicializar animaciones al cargar la página
    setupScrollAnimation();
});
