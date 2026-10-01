document.addEventListener('DOMContentLoaded', () => {
    // ==================================================
    // R1: Lógica del Carrusel de Cafés (F2.4)
    // ==================================================

    const catalogoSection = document.getElementById('catalogo-de-cafes');
    if (catalogoSection) {
        const carouselWrapper = catalogoSection.querySelector('.carousel-wrapper');
        const cardSlider = catalogoSection.querySelector('.card-slider');
        const cards = Array.from(document.querySelectorAll('.cafe-card'));

        // 1. Crear Controles de Navegación (Prev/Next) si no existen
        let prevButton = document.getElementById('prev-carousel');
        let nextButton = document.getElementById('next-carousel');

        if (!prevButton) {
            prevButton = document.createElement('button');
            prevButton.id = 'prev-carousel';
            prevButton.textContent = '← Anterior';
            prevButton.className = 'carousel-control prev';
            catalogoSection.querySelector('.catalogo-container').prepend(prevButton); // Añadir antes del wrapper
        }

        if (!nextButton) {
            nextButton = document.createElement('button');
            nextButton.id = 'next-carousel';
            nextButton.textContent = 'Siguiente →';
            nextButton.className = 'carousel-control next';
            catalogoSection.querySelector('.catalogo-container').appendChild(nextButton); // Añadir después del wrapper
        }

        // 2. Estilos básicos para los controles (Mejora de la UI)
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = `
            /* Estilos para Controles del Carrusel */
            .catalogo-container {
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 10px 0;
            }
            .carousel-control {
                background-color: #6f4e37;
                color: white;
                border: none;
                padding: 10px 20px;
                cursor: pointer;
                font-size: 1em;
                border-radius: 5px;
                transition: background-color 0.3s;
            }
            .carousel-control:hover {
                background-color: #4a362c;
            }
            /* Ajustar el wrapper para que contenga los controles y el slider */
            .catalogo-container .carousel-wrapper {
                flex-grow: 1; /* Permite que ocupe el espacio restante */
                overflow: hidden; /* Asegura que solo se vea lo del slider */
            }
        `;
        document.head.appendChild(styleSheet);


        // 3. Lógica de Navegación
        const cardWidth = cards[0].offsetWidth + 20; // Ancho de una tarjeta + gap (asumiendo que el gap es constante)
        let currentIndex = 0;
        const visibleCardsCount = Math.floor(catalogoSection.clientWidth / (cardWidth - 20));

        // Función para actualizar la posición del carrusel
        const updateCarouselPosition = () => {
            // Calculamos el desplazamiento total basado en cuántas tarjetas visibles queremos mostrar
            const offset = currentIndex * cardWidth;
            cardSlider.style.transform = 'translateX(-' + offset + 'px)';

            // Actualizar estado de los botones (deshabilitar al inicio/final)
            prevButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex >= cards.length - visibleCardsCount || cards.length <= visibleCardsCount;
        };

        // Event Handlers
        const goToNextSlide = () => {
            if (currentIndex < cards.length - visibleCardsCount) {
                currentIndex++;
                updateCarouselPosition();
            }
        };

        const goToPrevSlide = () => {
            if (currentIndex > 0) {
                currentIndex--;
                updateCarouselPosition();
            }
        };

        // Asignar listeners a los botones
        prevButton.addEventListener('click', goToPrevSlide);
        nextButton.addEventListener('click', goToNextSlide);

        // Inicializar la posición del carrusel
        updateCarouselPosition();
    }


    // ==================================================
    // R2: Lógica de Formulario (Validación Cliente)
    // ==================================================
    const contactSection = document.getElementById('formulario-de-contacto');
    if (contactSection) {
        const form = document.getElementById('contactForm');

        // Función para mostrar mensajes de error
        const displayError = (inputElement, message) => {
            let errorContainer = inputElement.parentNode;
            if (!errorContainer.querySelector('.error-message')) {
                errorContainer.innerHTML += `<div class="error-message" style="color: red; font-size: 0.9em; margin-top: 5px;">${message}</div>`;
            } else {
                 const existingError = errorContainer.querySelector('.error-message');
                 existingError.textContent = message;
            }
        };

        // Función para limpiar mensajes de error
        const clearErrors = () => {
            document.querySelectorAll('.form-group').forEach(group => {
                const errorElement = group.querySelector('.error-message');
                if (errorElement) {
                    errorElement.remove();
                }
            });
        };

        // Función de validación principal
        const validateForm = () => {
            clearErrors();
            let isValid = true;

            const nombreInput = document.getElementById('nombre');
            const emailInput = document.getElementById('email');
            const mensajeInput = document.getElementById('mensaje');

            // 1. Validación de Nombre (Obligatorio)
            if (!nombreInput.value.trim()) {
                displayError(nombreInput, 'El nombre completo es un campo obligatorio.');
                isValid = false;
            }

            // 2. Validación de Email (Obligatorio y Formato)
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput.value.trim()) {
                displayError(emailInput, 'El correo electrónico es obligatorio.');
                isValid = false;
            } else if (!emailPattern.test(emailInput.value)) {
                displayError(emailInput, 'Por favor, introduce un correo válido (ej: usuario@dominio.com).');
                isValid = false;
            }

            // 3. Validación de Mensaje (Obligatorio)
            if (!mensajeInput.value.trim()) {
                displayError(mensajeInput, 'El mensaje es obligatorio.');
                isValid = false;
            }

            return isValid;
        };


        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (validateForm()) {
                // Simular envío de datos a la API
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                console.log("Datos a enviar:", data);

                // Llamada al endpoint simulado window.api.crearContacto
                try {
                    const result = await window.api.crearContacto(data);

                    if (result.success) {
                        alert(result.message);
                        form.reset(); 
                    } else {
                        alert("Error de envío: " + result.message);
                    }
                } catch (error) {
                    console.error("Error al enviar el formulario:", error);
                    alert("Hubo un error inesperado al intentar conectar con nuestro sistema.");
                }

            } else {
                console.log("Formulario inválido, mostrando errores.");
            }
        });
    }

    // ==================================================
    // R4: Lógica de Carta (Pendiente)
    // ==================================================
    const cartaSection = document.getElementById('carta');
    if (cartaSection) {
        // Placeholder para la lógica de la carta en una tarea futura
    }

});
