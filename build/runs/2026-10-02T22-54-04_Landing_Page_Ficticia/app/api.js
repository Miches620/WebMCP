// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.
window.api = window.api || {};

/**
 * Simula la creación de un nuevo contacto enviando los datos a un endpoint ficticio.
 * @param {object} datos - Objeto con nombre, email y mensaje.
 * @returns {Promise<string>} Una promesa que resuelve con el mensaje de éxito o error.
 */
window.api.crearContacto = async (datos) => {
    console.log("Simulando envío de contacto:", datos);
    // Simular latencia de red
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!datos || !datos.email || !datos.nombre) {
        return "Error: Por favor, complete todos los campos.";
    }

    // Simulación exitosa
    const successMessage = `¡Gracias ${datos.nombre}! Hemos recibido tu solicitud y nos pondremos en contacto contigo en breve a la dirección ${datos.email}.`;
    return successMessage;
};
