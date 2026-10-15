/**
 * Módulo de lógica de negocio para manejar el estado del Kanban Board.
 * Todas las funciones devuelven una COPIA profunda y NUEVA del estado, sin modificar el original.
 */

// Helper function for deep cloning (since we cannot use structuredClone or JSON methods directly in all environments/scenarios)
const deepCopy = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    let copy = {};
    for (let key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            copy[key] = typeof obj[key] === 'object' && obj[key] !== null ? deepCopy(obj[key]) : obj[key];
        }
    }
    return copy;
};

const App = {
    /**
     * @description Devuelve una copia profunda del estado inicial.
     * @param {Object} estado - El estado actual (se ignora, pero se mantiene la firma).
     * @returns {Object} Un nuevo estado copiado.
     */
    crear: function(estado) {
        // Asume que ESTADO_INICIAL está disponible globalmente desde js/datos.js
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * @description Crea una tarjeta nueva y la añade a la columna 'Pendiente'.
     * @param {Object} estado - El estado actual.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} descripcion - Descripción de la nueva tarjeta.
     * @returns {Object} Nuevo estado con la tarjeta añadida.
     */
crearTarjeta: function(estado, titulo, descripcion) {
        const nuevoId = 'card' + Date.now();

        const nuevaTarjeta = {
            id: nuevoId,
            titulo: titulo,
            descripcion: descripcion,
            contenido_adicional: null,
            labels: [],
            comentarios: []
        };

        // Copiamos el estado para asegurar inmutabilidad
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Mapeamos las columnas para actualizar la columna 'pendiente' de forma inmutable
        nuevoEstado.columnas = nuevoEstado.columnas.map(col => {
            if (col.id === 'pendiente') {
                // Creamos una nueva lista de tarjetas incluyendo la nueva tarjeta
                return {
                    ...col,
                    tarjetas: [...col.tarjetas, nuevaTarjeta]
                };
            } else {
                // Devolvemos el resto de las columnas sin cambios (copiadas)
                return col; 
            }
        });

        return nuevoEstado;
    },

    /**
     * @description Mueve una tarjeta de su columna actual a la columna destino.
     * @param {Object} estado - El estado actual.
     * @param {string} tarjetaId - ID de la tarjeta a mover.
     * @param {string} columnaDestinoId - ID de la columna donde se debe mover.
     * @returns {Object} Nuevo estado con la tarjeta movida.
     */
    moverTarjeta: function(estado, tarjetaId, columnaDestinoId) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));
        let cardToMove = null;
        let sourceColIndex = -1;

        // 1. Encontrar la tarjeta y su columna origen
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            const cardIndex = col.tarjetas.findIndex(card => card.id === tarjetaId);

            if (cardIndex !== -1) {
                // Encontramos la tarjeta. Clonamos la tarjeta para asegurar que el estado final tenga una copia limpia.
                cardToMove = JSON.parse(JSON.stringify(col.tarjetas[cardIndex]));
                sourceColIndex = i;
                break;
            }
        }

        if (!cardToMove) {
            console.error("Tarjeta no encontrada.");
            return estado; // No se puede mover si la tarjeta no existe
        }

        // 2. Crear el nuevo estado (Inmutabilidad)
        let nuevoColumnas = [...nuevoEstado.columnas];

        // A. Eliminar de la columna origen
        if (sourceColIndex !== -1) {
            newColumnas[sourceColIndex] = {
                ...nuevoColumnas[sourceColIndex],
                tarjetas: newColumnas[sourceColIndex].tarjetas.filter(card => card.id !== tarjetaId)
            };
        }

        // B. Añadir a la columna destino (si es diferente de la origen)
        if (columnaDestinoId && nuevoEstado.columnas.find((col, index) => col.id === columnaDestinoId)) {
            const destColIndex = newColumnas.findIndex(col => col.id === columnaDestinoId);

            // Aseguramos que la tarjeta movida sea el objeto en sí, no solo una referencia si se clonó antes.
             newColumnas[destColIndex] = {
                ...newColumnas[destColIndex],
                tarjetas: [...newColumnas[destColIndex].tarjetas, cardToMove]
            };
        }

        return { ...nuevoestado, columnas: newColumnas };
    },

    /**
     * @description Añade un nuevo comentario a una tarjeta específica.
     * @param {Object} estado - El estado actual.
     * @param {string} tarjetaId - ID de la tarjeta objetivo.
     * @param {string} contenido - Contenido del mensaje.
     * @param {string} autor - Autor del comentario.
     * @returns {Object} Nuevo estado con el comentario añadido.
     */
    agregarComentario: function(estado, tarjetaId, contenido, autor) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));
        const nuevoComentario = {
            autor: autor,
            contenido: contenido,
            timestamp: Date.now()
        };

        // Recorrer todas las columnas para encontrar la tarjeta
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            const cardIndex = col.tarjetas.findIndex(card => card.id === tarjetaId);

            if (cardIndex !== -1) {
                // 1. Clonar la columna y el array de tarjetas
                let nuevasTarjetas = [...col.tarjetas];
                let nuevaTarjetaObjetivo = JSON.parse(JSON.stringify(nuevoEstado.columnas[i].tarjetas[cardIndex]));

                // 2. Actualizar la tarjeta objetivo añadiendo el comentario
                nuevaTarjetaObjetivo.comentarios = [...newTarjetas[cardIndex].comentarios, nuevoComentario];

                // 3. Reemplazar la tarjeta en el array de tarjetas (y por ende, en el estado)
                nuevasTarjetas[cardIndex] = nuevaTarjetaObjetivo;

                // 4. Crear una copia profunda del estado con los cambios aplicados
                let nuevoColumnas = [...nuevoEstado.columnas];
                newColumnas[i] = {
                    ...nuevoEstado.columnas[i],
                    tarjetas: nuevasTarjetas
                };

                return { ...nuevoestado, columnas: nuevoColumnas };
            }
        }

        console.error("Tarjeta no encontrada para agregar comentario.");
        return estado;
    },

    /**
     * @description Asigna una etiqueta a la tarjeta especificada.
     * @param {Object} estado - El estado actual.
     * @param {string} tarjetaId - ID de la tarjeta objetivo.
     * @param {string} nombre - Nombre de la etiqueta.
     * @param {string} color - Color hexadecimal de la etiqueta.
     * @returns {Object} Nuevo estado con la etiqueta añadida.
     */
    agregarEtiqueta: function(estado, tarjetaId, nombre, color) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));
        const nuevaEtiqueta = { nombre: nombre, color: color };

        // Recorrer todas las columnas para encontrar la tarjeta
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            const cardIndex = col.tarjetas.findIndex(card => card.id === tarjetaId);

            if (cardIndex !== -1) {
                // 1. Clonar la columna y el array de tarjetas
                let nuevasTarjetas = [...col.tarjetas];
                let nuevaTarjetaObjetivo = JSON.parse(JSON.stringify(nuevoEstado.columnas[i].tarjetas[cardIndex]));

                // 2. Actualizar la etiqueta añadiendo la etiqueta
                nuevaTarjetaObjetivo.labels = [...newTarjetas[cardIndex].labels, nuevaEtiqueta];

                // 3. Reemplazar la tarjeta en el array de tarjetas
                nuevasTarjetas[cardIndex] = nuevaTarjetaObjetivo;

                // 4. Crear una copia profunda del estado con los cambios aplicados
                let nuevoColumnas = [...nuevoEstado.columnas];
                newColumnas[i] = {
                    ...nuevoEstado.columnas[i],
                    tarjetas: nuevasTarjetas
                };

                return { ...nuevoestado, columnas: nuevoColumnas };
            }
        }

        console.error("Tarjeta no encontrada para agregar etiqueta.");
        return estado;
    },

    /**
     * @description Actualiza el título y la descripción de una tarjeta.
     * @param {Object} estado - El estado actual.
     * @param {string} tarjetaId - ID de la tarjeta objetivo.
     * @param {string} nuevoTitulo - Nuevo título deseado.
     * @param {string} nuevaDescripcion - Nueva descripción deseada.
     * @returns {Object} Nuevo estado con los datos editados.
     */
    editarTarjeta: function(estado, tarjetaId, nuevoTitulo, nuevaDescripcion) {
        let nuevoEstado = JSON.parse(JSON.stringify(estado));

        // Recorrer todas las columnas para encontrar la tarjeta
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            const cardIndex = col.tarjetas.findIndex(card => card.id === tarjetaId);

            if (cardIndex !== -1) {
                // 1. Clonar la tarjeta y actualizar propiedades
                let nuevaTarjetaObjetivo = JSON.parse(JSON.stringify(nuevoEstado.columnas[i].tarjetas[cardIndex]));

                nuevaTarjetaObjetivo.titulo = nuevoTitulo;
                nuevaTarjetaObjetivo.descripcion = nuevaDescripcion;

                // 2. Reemplazar la tarjeta en el array de tarjetas
                let nuevasTarjetas = [...col.tarjetas];
                nuevasTarjetas[cardIndex] = nuevaTarjetaObjetivo;

                // 3. Crear una copia profunda del estado con los cambios aplicados
                let nuevoColumnas = [...nuevoestado.columnas];
                nuevoColumnas[i] = {
                    ...nuevoestado.columnas[i],
                    tarjetas: nuevasTarjetas
                };

                return { ...nuevoestado, columnas: nuevoColumnas };
            }
        }

        console.error("Tarjeta no encontrada para editar.");
        return estado;
    },

    /**
     * @description Elimina completamente una tarjeta del estado en todas las columnas.
     * @param {Object} estado - El estado actual.
     * @param {string} tarjetaId - ID de la tarjeta a borrar.
     * @returns {Object} Nuevo estado sin la tarjeta eliminada.
     */
    borrarTarjeta: function(estado, tarjetaId) {
        let nuevoColumnas = [];

        for (const columna of estado.columnas) {
            // Filtramos el array de tarjetas para mantener solo aquellas que NO coinciden con el ID a borrar
            const nuevasTarjetas = columna.tarjetas.filter(card => card.id !== tarjetaId);

            nuevoColumnas.push({
                ...columna,
                tarjetas: nuevasTarjetas
            });
        }

        // Retornar el estado completamente nuevo con las columnas actualizadas
        return { ...estado, columnas: nuevoColumnas };
    }
};
