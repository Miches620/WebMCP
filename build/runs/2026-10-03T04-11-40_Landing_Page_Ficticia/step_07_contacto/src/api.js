// Capa de datos SIMULADA (backend mock). Los componentes usan solo window.api.
window.api = window.api || {};

// No se requieren nuevas funciones de API para este componente.

// No se requieren nuevas funciones API para este componente.

// No se requieren nuevas llamadas a la API para este componente.

// No se requiere ninguna función de API para este componente.

// No se requiere ninguna función API simulada para este componente, ya que solo maneja animaciones locales y cálculos de contador.

/**
 * Simula el envío de un formulario de contacto a un backend.
 * @param {object} data - Los datos del formulario (name, email, subject, message).
 * @returns {Promise<{success: boolean, message?: string}>} Resultado de la operación.
 */
window.api.submitContactForm = async (data) => {
    console.log("Simulando envío de datos:", data);

    // Simulación de latencia de red
    await new Promise(resolve => setTimeout(resolve, 800));

    // Lógica de simulación: Asumimos éxito siempre para este ejercicio
    if (data.email && data.message) {
        return { success: true };
    } else {
        return { success: false, message: "Datos incompletos o inválidos." };
    }
};

