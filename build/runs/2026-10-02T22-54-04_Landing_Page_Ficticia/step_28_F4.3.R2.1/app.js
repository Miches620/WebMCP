// Lógica de la UI.

// Lógica de la UI.

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento suave para el desplazamiento
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});

// Lógica de la UI.

/**
 * Inicializa el observador de intersección (Intersection Observer)
 * para detectar cuándo las secciones clave entran en la vista del usuario,
 * activando así sus animaciones de aparición.
 */
const observerOptions = {
    root: null, // Observa respecto al viewport
    rootMargin: '0px',
    threshold: 0.2 // Se dispara cuando el 20% del elemento es visible
};

/**
 * Callback que se ejecuta cuando un elemento cruza el umbral de intersección.
 * @param {IntersectionObserverEntry[]} entries - Array de entradas observadas.
 * @param {IntersectionObserver} observer - El objeto Intersection Observer.
 */
const handleIntersect = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Si el elemento está visible, añade la clase de activación para animarlo
            entry.target.classList.add('reveal-active');

            // Opcional: Desconectar el observador una vez que se ha activado la animación
            observer.unobserve(entry.target);
        }
    });
};

/**
 * Inicializa y ejecuta el Intersection Observer para las secciones de contenido clave.
 */
const setupRevealAnimations = () => {
    // 1. Seleccionar los contenedores principales que deben animarse: Testimonios y Estadísticas.
    const elementsToObserve = [
        document.querySelector('#testimonios .testimonial-card'), // Observar cada tarjeta de testimonio individualmente
        ...Array.from(document.querySelectorAll('#estadisticas-animadas .stat-item')) // Observar cada ítem estadístico
    ].filter(el => el); // Filtra elementos nulos

    if (elementsToObserve.length === 0) {
        console.warn("No se encontraron elementos clave para animar con Intersection Observer.");
        return;
    }

    // 2. Crear la instancia del observador
    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    // 3. Observar cada elemento seleccionado
    elementsToObserve.forEach(element => {
        observer.observe(element);
    });
};


document.addEventListener('DOMContentLoaded', () => {
    // Lógica de navegación (ya existente)
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento suave para el desplazamiento
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Lógica de Validación y Envío del Formulario de Contacto ---
    const contactForm = document.querySelector('#contacto .contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Obtener valores y limpiar errores previos
            const nombreInput = document.getElementById('nombre');
            const emailInput = document.getElementById('email');
            const mensajeTextarea = document.getElementById('mensaje');
            const submitButton = document.querySelector('.submit-form-btn');

            // Limpiar mensajes de error anteriores
            document.querySelectorAll('#contacto .error-message').forEach(el => el.remove());

            const nombre = nombreInput ? nombreInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const mensaje = mensajeTextarea ? mensajeTextarea.value.trim() : '';

            let isValid = true;

            // 2. Validación de campos obligatorios y formato
            if (!nombre) {
                displayError(nombreInput, 'Por favor, ingresa tu nombre completo.');
                isValid = false;
            } else {
                displayError(nombreInput, ''); // Limpiar error si se vuelve a intentar
            }

            // Regex simple para email: [texto]@[texto].[dominio]
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                displayError(emailInput, 'El correo electrónico es obligatorio.');
                isValid = false;
            } else if (!emailRegex.test(email)) {
                displayError(emailInput, 'Por favor, ingresa un formato de email válido (ej: usuario@dominio.com).');
                isValid = false;
            } else {
                displayError(emailInput, ''); // Limpiar error si es válido
            }

            if (!mensaje) {
                displayError(mensajeTextarea, 'Por favor, describe tu consulta.');
                isValid = false;
            } else {
                displayError(mensajeTextarea, ''); // Limpiar error si se vuelve a intentar
            }


            // 3. Manejo del envío si es válido
            if (isValid) {
                submitButton.disabled = true;
                submitButton.textContent = 'Enviando...';

                const formData = { nombre, email, mensaje };

                try {
                    // Llamada a la API simulada
                    const resultMessage = await window.api.crearContacto(formData);

                    // Mostrar éxito y limpiar formulario
                    document.querySelector('#contacto .form-group').forEach(group => group.classList.remove('has-error'));
                    contactForm.reset();
                    displaySuccessMessage(resultMessage);

                } catch (error) {
                    console.error("Error al enviar el contacto:", error);
                    alert("Hubo un error inesperado al conectar con nuestro servidor.");
                } finally {
                    // Restaurar botón
                    submitButton.disabled = false;
                    submitButton.textContent = 'Enviar Mensaje';
                }
            }
        });
    }

    /**
     * Muestra el mensaje de error debajo del campo correspondiente.
     * @param {HTMLElement} inputElement - El elemento <input> o <textarea>.
     * @param {string} message - El mensaje de error a mostrar.
     */
    const displayError = (inputElement, message) => {
        let errorContainer = inputElement.parentNode.querySelector('.error-message');
        if (!errorContainer) {
            errorContainer = document.createElement('span');
            errorContainer.className = 'error-message';
            inputElement.parentNode.appendChild(errorContainer);
        }
        errorContainer.textContent = message;

        // Añadir clase de error visualmente (aunque el CSS lo maneja, es buena práctica)
        if (message) {
             inputElement.closest('.form-group').classList.add('has-error');
        } else {
             inputElement.closest('.form-group').classList.remove('has-error');
        }
    };

    /**
     * Muestra un mensaje de éxito en la sección del formulario.
     * @param {string} message - El mensaje de confirmación.
     */
    const displaySuccessMessage = (message) => {
        const formContainer = document.querySelector('#contacto .form-group');
        if (!formContainer) return;

        // Crear un contenedor temporal para el mensaje de éxito
        let successMessageDiv = document.getElementById('contact-success-message');
        if (!successMessageDiv) {
            successMessageDiv = document.createElement('div');
            successMessageDiv.id = 'contact-success-message';
            successMessageDiv.className = 'alert alert-success'; // Asumiendo una clase de alerta
            formContainer.parentNode.insertBefore(successMessageDiv, formContainer);
        }
        successMessageDiv.innerHTML = `<p>${message}</p>`;
    };


    // Llamar a la función de animación al cargar la página
    setupRevealAnimations();
});

// Lógica de la UI.

// ... [Código existente] ...

/**
 * Inicializa y ejecuta el Intersection Observer para las secciones de contenido clave.
 */
const setupRevealAnimations = () => {
    // 1. Seleccionar los contenedores principales que deben animarse: Testimonios y Estadísticas.
    // Se asegura que cada elemento individual sea observado para un efecto más granular.
    const elementsToObserve = [
        ...Array.from(document.querySelectorAll('#testimonios .testimonial-card')), // Observar todas las tarjetas de testimonio
        ...Array.from(document.querySelectorAll('#estadisticas-animadas .stat-item')) // Observar cada ítem estadístico
    ].filter(el => el); // Filtra elementos nulos

    if (elementsToObserve.length === 0) {
        console.warn("No se encontraron elementos clave para animar con Intersection Observer.");
        return;
    }

    // 2. Crear la instancia del observador
    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    // 3. Observar cada elemento seleccionado
    elementsToObserve.forEach(element => {
        observer.observe(element);
    });
};


document.addEventListener('DOMContentLoaded', () => {
    // Lógica de navegación (ya existente)
    const navLinks = document.querySelectorAll('#site-header nav a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Usamos scrollIntoView con comportamiento suave para el desplazamiento
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // --- Lógica de Validación y Envío del Formulario de Contacto ---
    const contactForm = document.querySelector('#contacto .contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Obtener valores y limpiar errores previos
            const nombreInput = document.getElementById('nombre');
            const emailInput = document.getElementById('email');
            const mensajeTextarea = document.getElementById('mensaje');
            const submitButton = document.querySelector('.submit-form-btn');

            // Limpiar mensajes de error anteriores y éxito
            document.querySelectorAll('#contacto .error-message').forEach(el => el.remove());
            const successMessageDiv = document.getElementById('contact-success-message');
            if (successMessageDiv) {
                successMessageDiv.remove();
            }

            const nombre = nombreInput ? nombreInput.value.trim() : '';
            const email = emailInput ? emailInput.value.trim() : '';
            const mensaje = mensajeTextarea ? mensajeTextarea.value.trim() : '';

            let isValid = true;

            // 2. Validación de campos obligatorios y formato
            if (!nombre) {
                displayError(nombreInput, 'Por favor, ingresa tu nombre completo.');
                isValid = false;
            } else {
                displayError(nombreInput, ''); // Limpiar error si se vuelve a intentar
            }

            // Regex simple para email: [texto]@[texto].[dominio]
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                displayError(emailInput, 'El correo electrónico es obligatorio.');
                isValid = false;
            } else if (!emailRegex.test(email)) {
                displayError(emailInput, 'Por favor, ingresa un formato de email válido (ej: usuario@dominio.com).');
                isValid = false;
            } else {
                displayError(emailInput, ''); // Limpiar error si es válido
            }

            if (!mensaje) {
                displayError(mensajeTextarea, 'Por favor, describe tu consulta.');
                isValid = false;
            } else {
                displayError(mensajeTextarea, ''); // Limpiar error si se vuelve a intentar
            }


            // 3. Manejo del envío si es válido
            if (isValid) {
                submitButton.disabled = true;
                submitButton.textContent = 'Enviando...';

                const formData = { nombre, email, mensaje };

                try {
                    // Llamada a la API simulada
                    const resultMessage = await window.api.crearContacto(formData);

                    // Mostrar éxito y limpiar formulario
                    document.querySelector('#contacto .form-group').forEach(group => group.classList.remove('has-error'));
                    contactForm.reset();
                    displaySuccessMessage(resultMessage);

                } catch (error) {
                    console.error("Error al enviar el contacto:", error);
                    // Usar un mensaje de alerta más amigable si falla la promesa simulada
                    alert("Hubo un error inesperado al conectar con nuestro servidor. Por favor, inténtalo más tarde.");
                } finally {
                    // Restaurar botón
                    submitButton.disabled = false;
                    submitButton.textContent = 'Enviar Mensaje';
                }
            }
        });
    }

    /**
     * Muestra el mensaje de error debajo del campo correspondiente.
     * @param {HTMLElement} inputElement - El elemento <input> o <textarea>.
     * @param {string} message - El mensaje de error a mostrar.
     */
    const displayError = (inputElement, message) => {
        let errorContainer = inputElement.parentNode.querySelector('.error-message');
        if (!errorContainer) {
            errorContainer = document.createElement('span');
            errorContainer.className = 'error-message';
            inputElement.parentNode.appendChild(errorContainer);
        }
        errorContainer.textContent = message;

        // Añadir clase de error visualmente (aunque el CSS lo maneja, es buena práctica)
        if (message) {
             inputElement.closest('.form-group').classList.add('has-error');
        } else {
             inputElement.closest('.form-group').classList.remove('has-error');
        }
    };

    /**
     * Muestra un mensaje de éxito en la sección del formulario.
     * @param {string} message - El mensaje de confirmación.
     */
    const displaySuccessMessage = (message) => {
        // Eliminar cualquier mensaje de éxito previo
        let successMessageDiv = document.getElementById('contact-success-message');
        if (successMessageDiv) {
            successMessageDiv.remove();
        }

        // Crear un contenedor temporal para el mensaje de éxito
        const formContainer = document.querySelector('#contacto .form-group');
        if (!formContainer) return;

        successMessageDiv = document.createElement('div');
        successMessageDiv.id = 'contact-success-message';
        successMessageDiv.className = 'alert alert-success'; // Usando la clase definida en CSS
        successMessageDiv.innerHTML = `<p>${message}</p>`;
        
        // Insertar el mensaje de éxito justo antes del formulario
        formContainer.parentNode.insertBefore(successMessageDiv, formContainer);
    };


    // Llamar a la función de animación al cargar la página
    setupRevealAnimations();
});
