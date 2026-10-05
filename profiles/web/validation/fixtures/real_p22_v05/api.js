// Capa de datos SIMULADA (backend mock). La UI usa solo window.api.
window.api = window.api || {};

/**
 * Simula la creación de un nuevo contacto en la base de datos.
 * @param {object} data - Los datos del formulario (nombre, email, mensaje).
 * @returns {Promise<{success: boolean, message: string}>} Una promesa que resuelve con el resultado simulado.
 */
window.api.crearContacto = async (data) => {
    console.log("API Mock: Recibiendo datos de contacto:", data);

    // Simular latencia de red/servidor
    await new Promise(resolve => setTimeout(resolve, 300));

    // Validación simulada simple
    if (!data || !data.email || !data.nombre) {
        return { success: false, message: "Por favor, completa todos los campos requeridos." };
    }

    // Simular éxito de la operación
    console.log("API Mock: Contacto creado exitosamente.");
    return { 
        success: true, 
        message: `Gracias ${data.nombre}. Hemos recibido tu solicitud y te contactaremos en breve.` 
    };
};

// Nota: Se han añadido funciones simuladas para que app.js pueda llamar a window.api.crearContacto().
