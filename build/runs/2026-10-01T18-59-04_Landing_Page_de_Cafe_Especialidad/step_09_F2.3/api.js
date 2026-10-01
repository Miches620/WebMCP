// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.
window.api = window.api || {};

/**
 * Simula la obtención de una lista de productos de café.
 * @returns {Promise<Array>} Lista de objetos de café.
 */
async function listarProductos() {
    // Simulación de latencia de red
    await new Promise(resolve => setTimeout(resolve, 300));

    const productos = [
        { id: 1, nombre: "Origen Etiopía Yirgacheffe", descripcion: "Notas florales de jazmín y limón. Cuerpo medio.", imagenUrl: "images/cafe_placeholder.jpg" },
        { id: 2, nombre: "Colombia Huila Supremo", descripcion: "Perfil equilibrado con notas a chocolate y caramelo. Ideal para el día a día.", imagenUrl: "images/cafe_placeholder.jpg" },
        { id: 3, nombre: "Guatemala Antigua", descripcion: "Intenso cuerpo con matices de cacao oscuro y especias. Perfecto para espresso.", imagenUrl: "images/cafe_placeholder.jpg" },
        { id: 4, nombre: "Sumatra Mandheling", descripcion: "Terroso y profundo, con notas ahumadas y especiadas. Ideal para amantes del café robusto.", imagenUrl: "images/cafe_placeholder.jpg" }
    ];

    return productos;
}

window.api.listarProductos = listarProductos;
