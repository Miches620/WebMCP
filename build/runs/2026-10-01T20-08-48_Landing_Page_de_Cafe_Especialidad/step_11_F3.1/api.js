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
