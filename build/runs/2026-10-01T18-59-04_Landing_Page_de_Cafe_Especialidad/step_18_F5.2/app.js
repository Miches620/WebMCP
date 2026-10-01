// Lógica de la UI.

/**
 * Renderiza el componente Card para un producto específico.
 * @param {Object} producto - Objeto con datos del café.
 * @returns {string} HTML completo de la tarjeta.
 */
const renderProductCard = (producto) => {
    return `
        <div class="product-card" data-id="${producto.id}">
            <img src="${producto.imagenUrl}" alt="Imagen de ${producto.nombre}">
            <div class="card-info">
                <h3>${producto.nombre}</h3>
                <p>${producto.descripcion}</p>
                <button class="btn-ver-detalle" data-id="${producto.id}">Ver Detalles</button>
            </div>
        </div>
    `;
};

/**
 * Renderiza la sección de la Carta (Menú) utilizando los datos obtenidos de la API.
 * @param {Array<{nombre: string, descripcion: string, precio: string}>} menuItems - Lista de ítems del menú.
 */
const renderMenuCard = (menuItems) => {
    const cartaSection = document.getElementById('carta');
    if (!cartaSection) return;

    let htmlContent = '';

    // Título y subtítulo para la sección
    htmlContent += `
        <h2 style="text-align: center; margin-bottom: 30px; color: #6f4e37;">Nuestra Carta</h2>
        <p class="subtitulo" style="text-align: center; margin-bottom: 50px; font-size: 1.2em;">Descubre la variedad de bebidas y productos que elevan tu experiencia cafetera.</p>
    `;

    // Renderizar cada ítem del menú en un formato de lista o tarjeta
    menuItems.forEach(item => {
        htmlContent += `
            <div class="menu-item" style="border-bottom: 1px solid #eee; padding: 20px 0;">
                <div style="display: flex; justify-content: space-between; align-items: baseline">
                    <h3 style="color: #6f4e37; margin-bottom: 0;">${item.nombre}</h3>
                    <span style="font-weight: bold; color: #8b5a3c; font-size: 1.2em;">${item.precio}</span>
                </div>
                <p style="margin-top: 5px; margin-bottom: 10px; color: #555;">${item.descripcion}</p>
            </div>
        `;
    });

    cartaSection.innerHTML = htmlContent;
};


/**
 * Inicializa la sección de la Carta al cargar la página, consumiendo datos de la API.
 */
const initializeMenuCard = async () => {
    console.log("Iniciando carga de la Carta...");
    try {
        // 1. Consumir los datos del menú desde el endpoint simulado
        const menuItems = await window.api.cargarCarta();

        // 2. Renderizar los datos obtenidos en la sección #carta
        renderMenuCard(menuItems);
    } catch (error) {
        console.error("Error al cargar la Carta:", error);
        document.getElementById('carta').innerHTML = '<p style="text-align: center; color: red;">Lo sentimos, no pudimos cargar nuestro menú en este momento.</p>';
    }
};


/**
 * Maneja la validación y el envío del formulario de contacto.
 */
const setupContactFormValidation = () => {
    const form = document.getElementById('contactForm');
    if (!form) return;

    // Función para limpiar mensajes de error previos
    const clearErrors = () => {
        document.querySelectorAll('.error-message').forEach(el => el.remove());
        document.querySelectorAll('.form-group input, .form-group textarea').forEach(input => {
            input.style.borderColor = '#ccc'; // Resetear borde
        });
    };

    // Función para mostrar un mensaje de error
    const displayError = (fieldId, message) => {
        clearErrors();
        const group = document.querySelector(`.form-group [for="${fieldId}"]`).closest('.form-group');
        if (!group) return;

        let errorElement = group.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('p');
            errorElement.className = 'error-message';
            group.appendChild(errorElement);
        }
        errorElement.textContent = message;
        // Resaltar el campo con borde rojo al fallar la validación
        const inputField = document.getElementById(fieldId);
        if (inputField) {
             inputField.style.borderColor = 'red';
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        // 1. Obtener valores y validar
        const nombre = document.getElementById('nombre').value.trim();
        const email = document.getElementById('email').value.trim();
        const mensaje = document.getElementById('mensaje').value.trim();
        const preferencias = document.getElementById('preferencias').value.trim();

        let isValid = true;

        // Validación de Nombre (Obligatorio)
        if (!nombre) {
            displayError('nombre', 'El nombre completo es un campo obligatorio.');
            isValid = false;
        }

        // Validación de Email (Obligatorio y formato)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            displayError('email', 'Por favor, introduce un correo electrónico válido.');
            isValid = false;
        }

        // Validación de Mensaje (Obligatorio)
        if (!mensaje) {
            displayError('mensaje', 'El mensaje es obligatorio para poder contactarnos.');
            isValid = false;
        }

        if (isValid) {
            const formData = {
                nombre: nombre,
                email: email,
                mensaje: mensaje,
                preferencias: preferencias || null // Puede ser nulo si está vacío
            };

            // 2. Simular envío de datos a la API
            try {
                // Asumimos que window.api tiene un endpoint para crear contactos
                const response = await window.api.crearContacto(formData);
                
                alert('¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.');
                form.reset(); // Limpiar el formulario al éxito

            } catch (error) {
                console.error("Error al enviar el formulario:", error);
                alert('Hubo un error al enviar tu mensaje. Por favor, inténtalo más tarde o llámanos directamente.');
            }
        } else {
             // Si no es válido, los errores ya fueron mostrados por displayError
        }
    });
};


/**
 * Inicializa el catálogo de cafés al cargar la página, incluyendo la lógica del carrusel.
 */
const initializeCatalogo = async () => {
    const catalogoSection = document.getElementById('catalogo');
    if (!catalogoSection) return;

    // 1. Obtener datos simulados de la API
    let productos;
    try {
        productos = await window.api.listarProductos();
    } catch (error) {
        console.error("Error al cargar el catálogo de productos:", error);
        catalogoSection.querySelector('.carousel-wrapper').innerHTML = '<p style="text-align: center;">Lo sentimos, no pudimos cargar nuestro catálogo en este momento.</p>';
        return;
    }

    // 2. Generar y renderizar el HTML para cada producto
    let htmlContent = '';
    productos.forEach(producto => {
        htmlContent += renderProductCard(producto);
    });

    const carouselContainer = catalogoSection.querySelector('.carousel-container');
    if (carouselContainer) {
         // Limpiamos los placeholders y agregamos el contenido dinámico
        carouselContainer.innerHTML = htmlContent;
    }


    // 3. Implementar la lógica del carrusel
    const carouselWrapper = catalogoSection.querySelector('.carousel-wrapper');
    const prevButton = catalogoSection.querySelector('.btn-nav.prev');
    const nextButton = catalogoSection.querySelector('.btn-nav.next');

    if (prevButton && nextButton) {
        // Función para actualizar el estado de los botones (habilitar/deshabilitar)
        const updateCarouselState = () => {
            const scrollLeft = carouselContainer.scrollLeft;
            const maxScrollLeft = carouselContainer.scrollWidth - carouselContainer.clientWidth;

            // Deshabilitar Prev si estamos al inicio
            prevButton.disabled = scrollLeft <= 5; // Usamos un pequeño margen para evitar saltos bruscos
            
            // Deshabilitar Next si estamos al final (considerando el ancho visible)
            nextButton.disabled = Math.abs(scrollLeft - maxScrollLeft) < 10;
        };

        const scrollCarousel = (direction) => {
            const cardWidth = document.querySelector('.product-card').offsetWidth + 25; // Ancho de tarjeta + gap
            const scrollAmount = cardWidth * 1.5; // Desplazamos un poco más que una tarjeta para efecto visual

            carouselContainer.scrollBy({
                left: direction === 'next' ? scrollAmount : -scrollAmount,
                behavior: 'smooth'
            });
        };

        // Event Listeners
        prevButton.addEventListener('click', () => {
            scrollCarousel('prev');
            updateCarouselState();
        });

        nextButton.addEventListener('click', () => {
            scrollCarousel('next');
            updateCarouselState();
        });

        // Inicializar el estado de los botones y escuchar eventos de scroll manual del usuario
        window.addEventListener('scroll', updateCarouselState);
        document.querySelector('.carousel-container').addEventListener('scroll', updateCarouselState);
        
        // Llamar al estado inicial
        updateCarouselState();
    }
};

// Ejecutar la inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initializeCatalogo();
    setupContactFormValidation(); // Inicializar validación del formulario de contacto
    initializeMenuCard(); // <-- NUEVA INICIALIZACIÓN DE LA CARTA
});
