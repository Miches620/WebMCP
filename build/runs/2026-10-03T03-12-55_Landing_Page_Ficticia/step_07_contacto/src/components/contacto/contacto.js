/**
 * @param {HTMLElement} root - El elemento raíz de este componente (#contacto).
 */
function initializeContacto(root) {
    const form = root.querySelector('#contactForm');
    const messageDiv = root.querySelector('#formMessage');
    const submitBtn = root.querySelector('#submitBtn');

    if (!form || !messageDiv) return;

    // 1. Animación al hacer scroll (Intersection Observer)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.2 // Se activa cuando el 20% del elemento es visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Añadir una clase para animar la aparición de los elementos al entrar en vista
                root.classList.add('animate-visible'); 
                observer.unobserve(entry.target); // Dejar de observar una vez visible
            }
        });
    }, observerOptions);

    // Observamos el contenedor principal del formulario para activar la animación
    observer.observe(root);


    // 2. Manejo del envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Limpiar mensajes anteriores y deshabilitar botón
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12h12a4 4 0 01-8 0z"></path></svg> Enviando...</span>';
        submitBtn.classList.add('cursor-not-allowed');

        // Validación client-side
        if (!validateForm(form)) {
            messageDiv.textContent = 'Por favor, revisa todos los campos del formulario.';
            messageDiv.className = 'p-3 rounded text-center mb-md bg-red-100 text-red-700';
            messageDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Enviar Consulta';
            submitBtn.classList.remove('cursor-not-allowed');
            return;
        }

        // Recolectar datos
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            // Simular envío API (usando la lógica de window.api si existiera, o simulándolo)
            messageDiv.textContent = 'Enviando tu consulta... Por favor, espera.';
            messageDiv.className = 'p-3 rounded text-center mb-md bg-yellow-100 text-yellow-700';
            messageDiv.style.display = 'block';

            // Simulación de latencia y envío exitoso
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            // Mostrar éxito
            messageDiv.textContent = '✅ ¡Mensaje enviado con éxito! Nos pondremos en contacto contigo lo antes posible.';
            messageDiv.className = 'p-3 rounded text-center mb-md bg-green-100 text-green-700';
            submitBtn.innerHTML = 'Consulta Enviada';
            form.reset();

        } catch (error) {
            // Manejo de error simulado
            messageDiv.textContent = `❌ Error al enviar: ${error.message}. Intenta más tarde o llámanos directamente.`;
            messageDiv.className = 'p-3 rounded text-center mb-md bg-red-100 text-red-700';
        } finally {
            // Restaurar estado del botón después de la operación
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Enviar Consulta';
                submitBtn.classList.remove('cursor-not-allowed');
            }, 1000);
        }
    });
}

/**
 * Valida los campos del formulario de contacto.
 * @param {HTMLFormElement} form - El formulario a validar.
 * @returns {boolean} True si el formulario es válido, False en caso contrario.
 */
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;

    inputs.forEach(input => {
        // Validación básica de requerido (ya lo hace el navegador, pero es bueno tenerlo explícito)
        if (!input.value.trim()) {
            isValid = false;
        } 
        // Validación específica de email
        else if (input.id === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
            alert('Por favor, introduce un correo electrónico válido.');
            isValid = false;
        }
    });

    return isValid;
}
