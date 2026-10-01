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
 * Inicializa el catálogo de cafés al cargar la página.
 */
const initializeCatalogo = async () => {
    const catalogoSection = document.getElementById('catalogo');
    if (!catalogoSection) return;

    // Limpiar contenido placeholder si existe
    let htmlContent = '';

    try {
        // 1. Obtener datos simulados de la API
        const productos = await window.api.listarProductos();

        // 2. Generar el HTML para cada producto
        productos.forEach(producto => {
            htmlContent += renderProductCard(producto);
        });

        // 3. Insertar el contenido en el contenedor del carrusel
        const carouselContainer = catalogoSection.querySelector('.carousel-container');
        if (carouselContainer) {
             // Limpiamos los placeholders y agregamos el contenido dinámico
            carouselContainer.innerHTML = htmlContent;
        }

    } catch (error) {
        console.error("Error al cargar el catálogo de productos:", error);
        catalogoSection.querySelector('.carousel-container').innerHTML = '<p style="text-align: center;">Lo sentimos, no pudimos cargar nuestro catálogo en este momento.</p>';
    }
};

// Ejecutar la inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    initializeCatalogo();
});
