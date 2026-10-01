// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.
window.api = window.api || {};

/**
 * Simula la lectura de un archivo de texto fuente que contiene los productos de la carta.
 * @returns {Promise<string>} Una promesa que resuelve con el contenido del archivo como string.
 */
window.api.leerArchivoCarta = async () => {
    console.log("Simulando lectura de archivo de Carta...");
    // Simulación de latencia de red/lectura de disco
    await new Promise(resolve => setTimeout(resolve, 300));

    const contenidoTexto = `
========================================
CARTA DE PRODUCTOS - AROMA CAFÉ
========================================

1. Tostado Clásico (Grano Entero)
   Descripción: Mezcla equilibrada de Colombia y Brasil. Ideal para el día a día.
   Notas: Chocolate, caramelo, nuez.
   Precio: $2500 CLP / 500g

2. Espresso Premium (Molido)
   Descripción: Blend intenso con cuerpo y notas achocolatadas. Perfecto para máquinas de espresso.
   Notas: Cacao amargo, especias, tostado profundo.
   Precio: $3200 CLP / 400g

3. Filtro Floral (Grano Entero)
   Descripción: Etiopía Yirgacheffe. Perfil delicado y aromático para métodos de filtrado.
   Notas: Jazmín, floral, cítricos suaves.
   Precio: $2800 CLP / 500g

4. Blend Especial (Molido)
   Descripción: Una mezcla única que resalta la acidez y el cuerpo en cada taza.
   Notas: Frutal, caramelo, toque de vainilla.
   Precio: $3000 CLP / 400g

========================================
Nota: Todos los precios son aproximados y están sujetos a cambios.
`;
    return contenidoTexto.trim();
};


/**
 * Procesa el texto crudo de la carta, extrayendo y modelando los datos de cada producto.
 * @param {string} rawText El contenido completo del archivo de la carta.
 * @returns {Promise<Array<{nombre: string, descripcion: string, precio: string}>>} Una promesa que resuelve con el array de productos estructurados.
 */
window.api.parseCartaData = async (rawText) => {
    console.log("Procesando y modelando datos de la carta...");
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular procesamiento

    // Regex para capturar bloques de productos: busca un número seguido de punto y texto hasta el siguiente bloque o final del string.
    const productRegex = /(\d+\.\s)(.*?)\n\s*Descripción:(.*?)\n\s*Notas:(.*?)\n\s*Precio:(.*?)(?=\n\d+\.|={2,}|$)/gs;

    let match;
    const products = [];

    while ((match = productRegex.exec(rawText)) !== null) {
        // match[1] es el número (ej: "1. ")
        // match[2] es el nombre/tipo del producto (Ej: "Tostado Clásico (Grano Entero)")
        const rawName = match[2].trim(); 
        // match[3] es la descripción
        const description = match[3].trim();
        // match[4] son las notas (no se usan en el modelo final, pero se capturan)
        // const notes = match[4].trim();
        // match[5] es el precio
        const price = match[5].trim();

        products.push({
            nombre: rawName,
            descripcion: description,
            precio: price
        });
    }

    return products;
};


/**
 * Endpoint principal para obtener todos los datos estructurados del menú de la carta.
 * Orquesta la lectura y el parseo de los datos.
 * @returns {Promise<Array<{nombre: string, descripcion: string, precio: string}>>} Una promesa que resuelve con el array completo de productos.
 */
window.api.getMenuData = async () => {
    console.log("Obteniendo y estructurando datos completos del menú...");
    try {
        // 1. Leer el archivo crudo
        const rawText = await window.api.leerArchivoCarta();
        // 2. Procesar los datos crudos en estructura JSON
        const menuData = await window.api.parseCartaData(rawText);
        return menuData;
    } catch (error) {
        console.error("Error al obtener los datos del menú:", error);
        // En un entorno real, se manejaría el error de forma más robusta. Aquí devolvemos un array vacío por seguridad.
        return []; 
    }
};
