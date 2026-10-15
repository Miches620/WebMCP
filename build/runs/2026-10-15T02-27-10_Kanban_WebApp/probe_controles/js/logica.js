/**
 * App: Contiene la lógica de negocio para manipular el estado del Kanban Board.
 * Todas las funciones devuelven un nuevo estado (inmutable).
 */

// Definición global del objeto App para que esté disponible en el scope de prueba.
const App = {};

/**
 * Función auxiliar para clonar profundamente el estado.
 * @param {Object} state - El estado a clonar.
 * @returns {Object} Una copia profunda del estado.
 */
function deepClone(state) {
    return JSON.parse(JSON.stringify(state));
}

/**
 * Crea un nuevo estado inicial clonando el estado base.
 * @returns {Object} Un nuevo estado profundo.
 */
App.crear = function() {
    // Se asume que ESTADO_INICIAL está disponible globalmente en js/datos.js
    return deepClone(ESTADO_INICIAL);
};

/**
 * Crea una nueva tarjeta y la añade a la primera columna del tablero.
 * @param {Object} estado - El estado actual.
 * @param {string} titulo - Título de la nueva tarjeta.
 * @param {string} descripcion - Descripción de la nueva tarjeta.
 * @returns {Object} Nuevo estado con la tarjeta añadida.
 */
App.crearTarjeta = function(estado, titulo, descripcion) {
    const nuevoEstado = deepClone(estado);

    // Asumimos que siempre hay al menos una columna para crear la tarjeta
    if (nuevoEstado.columnas.length === 0) return nuevoEstado;

    // Generación de ID simple y único para el ejemplo
    const nuevaCardId = 'card_' + Date.now() + Math.floor(Math.random() * 100);
    const nuevaTarjeta = {
        id: nuevaCardId,
        titulo: titulo,
        descripcion: descripcion,
        etiquetas: [],
        comentarios: []
    };

    // Añadir la tarjeta a la primera columna (la activa por defecto)
    nuevoEstado.columnas[0].tarjetas = [...nuevoEstado.columnas[0].tarjetas, nuevaTarjeta];

    return nuevoEstado;
};

/**
 * Mueve una tarjeta de su columna actual a la columna objetivo.
 * @param {Object} estado - El estado actual.
 * @param {string} cardId - ID de la tarjeta a mover.
 * @param {string} targetColumnId - ID de la columna destino.
 * @returns {Object} Nuevo estado con la tarjeta movida.
 */
App.moverTarjeta = function(estado, cardId, targetColumnId) {
    const nuevoEstado = deepClone(estado);

    let sourceColumnIndex = -1;
    let cardToMove = null;

    // 1. Encontrar y remover la tarjeta de su columna origen
    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];
        const cardIndex = col.tarjetas.findIndex(t => t.id === cardId);

        if (cardIndex !== -1) {
            sourceColumnIndex = i;
            // Clonar la tarjeta antes de moverla para asegurar que el objeto sea independiente
            cardToMove = deepClone(col.tarjetas[cardIndex]);
            break;
        }
    }

    if (!cardToMove || sourceColumnIndex === -1) {
        console.error("Tarjeta no encontrada o columna origen inválida.");
        return estado; // Devolver el estado original si falla
    }

    // Remover de la fuente (usando filter para crear un nuevo array sin la tarjeta)
    nuevoEstado.columnas[sourceColumnIndex].tarjetas = nuevoEstado.columnas[sourceColumnIndex].tarjetas.filter(t => t.id !== cardId);

    // 2. Encontrar y añadir la tarjeta a la columna destino
    const targetColumn = nuevoEstado.columnas.find(col => col.id === targetColumnId);

    if (targetColumn) {
        // Añadir el objeto clonado de la tarjeta al array destino
        targetColumn.tarjetas.push(cardToMove);
    } else {
        console.error("Columna destino no encontrada.");
        return estado; // Devolver el estado original si falla
    }

    return nuevoEstado;
};

/**
 * Añade un comentario a una tarjeta específica.
 * @param {Object} estado - El estado actual.
 * @param {string} cardId - ID de la tarjeta objetivo.
 * @param {string} contenido - Contenido del comentario.
 * @returns {Object} Nuevo estado con el comentario añadido.
 */
App.agregarComentario = function(estado, cardId, contenido) {
    const nuevoEstado = deepClone(estado);

    // Buscar la tarjeta y su columna contenedora
    let foundCard = null;
    let targetColumnIndex = -1;

    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];
        const card = col.tarjetas.find(t => t.id === cardId);
        if (card) {
            foundCard = card;
            targetColumnIndex = i;
            break;
        }
    }

    if (!foundCard) return estado;

    // Crear el nuevo comentario
    const nuevoComentario = {
        autor: "Usuario", // Asumiendo un autor por defecto para la simulación
        contenido: contenido,
        timestamp: new Date().toISOString()
    };

    // Actualizar el array de comentarios de la tarjeta (clonando y añadiendo)
    const updatedComments = [...foundCard.comentarios, nuevoComentario];

    // Reconstruir la tarjeta con los nuevos comentarios
    const updatedCard = { ...foundCard, comentarios: updatedComments };

    // Actualizar el array de tarjetas en la columna correcta (usando map para inmutabilidad)
    nuevoEstado.columnas[targetColumnIndex].tarjetas = nuevoEstado.columnas[targetColumnIndex].tarjetas.map(t => 
        t.id === cardId ? updatedCard : t
    );

    return nuevoEstado;
};

/**
 * Añade una etiqueta a la tarjeta especificada.
 * @param {Object} estado - El estado actual.
 * @param {string} cardId - ID de la tarjeta objetivo.
 * @param {string} nombreEtiqueta - Nombre de la nueva etiqueta.
 * @param {string} colorEtiqueta - Color hexadecimal de la etiqueta.
 * @returns {Object} Nuevo estado con la etiqueta añadida.
 */
App.etiquetarTarjeta = function(estado, cardId, nombreEtiqueta, colorEtiqueta) {
    const nuevoEstado = deepClone(estado);

    // Buscar y actualizar la tarjeta
    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];
        const cardIndex = col.tarjetas.findIndex(t => t.id === cardId);

        if (cardIndex !== -1) {
            const card = col.tarjetas[cardIndex];
            // Verificar si la etiqueta ya existe para evitar duplicados
            const etiquetasExistentes = card.etiquetas;
            if (etiquetasExistentes.some(e => e.nombre === nombreEtiqueta)) {
                return estado; // Etiqueta ya existe, no hacer cambios
            }

            // Crear la nueva etiqueta y actualizar el array de etiquetas
            const nuevaEtiqueta = { nombre: nombreEtiqueta, color: colorEtiqueta };
            const updatedEtiquetas = [...etiquetasExistentes, nuevaEtiqueta];

            // Reconstruir la tarjeta con las nuevas etiquetas
            const updatedCard = { ...card, etiquetas: updatedEtiquetas };

            // Actualizar el array de tarjetas en la columna correcta
            nuevoEstado.columnas[i].tarjetas = nuevoEstado.columnas[i].tarjetas.map(t => 
                t.id === cardId ? updatedCard : t
            );
            return nuevoEstado;
        }
    }

    return estado; // Tarjeta no encontrada
};

/**
 * Actualiza el título y la descripción de una tarjeta.
 * @param {Object} estado - El estado actual.
 * @param {string} cardId - ID de la tarjeta objetivo.
 * @param {string} nuevoTitulo - Nuevo título.
 * @param {string} nuevaDescripcion - Nueva descripción.
 * @returns {Object} Nuevo estado con los datos editados.
 */
App.editarTarjeta = function(estado, cardId, nuevoTitulo, nuevaDescripcion) {
    const nuevoEstado = deepClone(estado);

    // Buscar y actualizar la tarjeta
    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];
        const cardIndex = col.tarjetas.findIndex(t => t.id === cardId);

        if (cardIndex !== -1) {
            const card = col.tarjetas[cardIndex];
            // Crear la tarjeta actualizada
            const updatedCard = { 
                ...card, 
                titulo: nuevoTitulo, 
                descripcion: nuevaDescripcion 
            };

            // Actualizar el array de tarjetas en la columna correcta
            nuevoEstado.columnas[i].tarjetas = nuevoEstado.columnas[i].tarjetas.map(t => 
                t.id === cardId ? updatedCard : t
            );
            return nuevoEstado;
        }
    }

    return estado; // Tarjeta no encontrada
};


/**
 * Elimina una tarjeta del tablero.
 * @param {Object} estado - El estado actual.
 * @param {string} cardId - ID de la tarjeta a borrar.
 * @returns {Object} Nuevo estado sin la tarjeta eliminada.
 */
App.borrarTarjeta = function(estado, cardId) {
    const nuevoEstado = deepClone(estado);

    // Iterar sobre todas las columnas y filtrar el array de tarjetas
    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];
        const originalTarjetasLength = col.tarjetas.length;

        // Filtrar la tarjeta por ID
        col.tarjetas = col.tarjetas.filter(t => t.id !== cardId);

        if (col.tarjetas.length < originalTarjetasLength) {
            // Si se encontró y eliminó, devolvemos el estado inmediatamente
            return nuevoEstado;
        }
    }

    return estado; // Tarjeta no encontrada o nada que borrar
};
