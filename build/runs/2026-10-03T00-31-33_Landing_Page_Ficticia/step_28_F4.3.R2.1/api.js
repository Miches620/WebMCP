// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.
window.api = window.api || {};

/**
 * Simula el envío de un formulario de contacto a la base de datos.
 * @param {object} datos - Objeto con los datos del contacto.
 * @returns {Promise<boolean>} Promesa que resuelve con éxito si el envío fue exitoso.
 */
window.api.enviarContacto = async (datos) => {
    console.log("Simulando envío de contacto:", datos);
    // Simula latencia de red
    await new Promise(resolve => setTimeout(resolve, 500)); 

    // Siempre resuelve con éxito según las reglas del proyecto
    return true; 
};
