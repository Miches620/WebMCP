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
});
