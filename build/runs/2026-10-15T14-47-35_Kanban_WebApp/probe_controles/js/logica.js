const App = {
    /**
     * Devuelve una COPIA profunda del estado inicial.
     * @returns {Object} Estado clonado.
     */
    crear: function() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta en una columna específica y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} columnId - ID de la columna destino.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} descripcion - Descripción inicial de la tarjeta.
     * @returns {Object} Nuevo estado con la tarjeta añadida.
     */
crearTarjeta: function(estado, columnId, titulo, descripcion) {
        // 1. Creamos una copia profunda del estado para asegurar la inmutabilidad.
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        // 2. Generamos la nueva tarjeta.
        const nuevaTarjeta = {
            id: 'card_' + Date.now() + Math.random().toString(36).substring(2, 9),
            título: titulo,
            descripción: descripcion,
            contenido_adicional: null,
            labels: [],
            comentarios: []
        };

        // 3. Reconstruimos el array de columnas para garantizar que la columna modificada y el estado en sí sean nuevos objetos/arrays.
        const nuevaColumnas = nuevoEstado.columnas.map(columna => {
            if (columna.id === columnId) {
                // Si es la columna destino, devolvemos un objeto copiado con la lista de tarjetas actualizada.
                return {
                    ...columna, // Copia las propiedades existentes de la columna
                    tarjetas: [...columna.tarjetas, nuevaTarjeta] // Creamos una nueva copia del array de tarjetas
                };
            } else {
                // Para otras columnas, devolvemos una copia profunda para mantener la integridad del estado.
                return JSON.parse(JSON.stringify(columna)); 
            }
        });

        // 4. Devolvemos el nuevo estado con las columnas actualizadas.
        return {
            ...nuevoEstado, // Copiamos otras propiedades de nivel superior (si existieran)
            columnas: nuevaColumnas
        };
    },

    /**
     * Mueve una tarjeta entre dos columnas y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} columnaOrigenId - ID de la columna origen.
     * @param {string} columnaDestinoId - ID de la columna destino.
     * @returns {Object} Nuevo estado con la tarjeta movida.
     */
moverTarjeta: function(estado, cardId, columnaOrigenId, columnaDestinoId) {
    if (columnaOrigenId === columnaDestinoId) {
        return estado; 
    }

    let tarjetaAMover = null;
    let origenEncontrado = false;

    // 1. Intentar encontrar la tarjeta y actualizar el estado de origen en una copia profunda
    const nuevoEstado = JSON.parse(JSON.stringify(estado));

    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];

        if (!origenEncontrado && col.id === columnaOrigenId) {
            // Extraer la tarjeta a mover del estado actual antes de modificar el array en nuevoEstado
            tarjetaAMover = col.tarjetas.find(card => card.id === cardId);
            
            if (!tarjetaAMover) {
                console.error("Tarjeta no encontrada en la columna origen.");
                return estado; 
            }

            // Crear una nueva estructura de columna para nuevoEstado, sin incluir la tarjeta movida
            const nuevasTarjetas = col.tarjetas.filter(card => card.id !== cardId);
            nuevoEstado.columnas[i] = { ...col, tarjetas: [...nuevasTarjetas] };
            origenEncontrado = true;
        } 
    }

    // Si no se encontró la columna de origen o la tarjeta (debería haber sido manejado arriba, pero como chequeo extra)
    if (!origenEncontrado || !tarjetaAMover) {
         return estado;
    }


    // 2. Añadir la tarjeta a la columna de destino en nuevoEstado
    for (let i = 0; i < nuevoEstado.columnas.length; i++) {
        const col = nuevoEstado.columnas[i];

        if (col.id === columnaDestinoId) {
            // Actualizar el array de tarjetas de la columna destino en nuevoEstado
            nuevoEstado.columnas[i] = { 
                ...col, 
                tarjetas: [...col.tarjetas, tarjetaAMover] 
            };
            return nuevoEstado; // Éxito: devolver el estado modificado
        }
    }

    console.error("Columna destino no encontrada:", columnaDestinoId);
    return estado; // Fallo: devolver el estado original
},

    /**
     * Agrega un comentario a una tarjeta existente y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} autor - Nombre del usuario que comenta.
     * @param {string} contenido - Contenido del comentario.
     * @returns {Object} Nuevo estado con el comentario añadido.
     */
    agregarComentario: function(estado, cardId, autor, contenido) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));
        const timestamp = Math.floor(Date.now() / 1000);

        let tarjetaEncontrada = false;
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            let tarjetaActualizada = false;
            // Iterar sobre las tarjetas de la columna actual
            const nuevasTarjetas = columna.tarjetas.map(card => {
                if (card.id === cardId) {
                    tarjetaEncontrada = true;
                    // Creamos una copia de la tarjeta para modificarla
                    const nuevaTarjeta = { ...card };
                    nuevaTarjeta.comentarios = [...card.comentarios, { autor: autor, contenido: contenido, timestamp: timestamp }];
                    tarjetaActualizada = true;
                    return nuevaTarjeta;
                }
                return card;
            });

            if (tarjetaActualizada) {
                // Actualizar la columna en el nuevo estado con las tarjetas modificadas
                nuevoEstado.columnas[i] = { ...columna, tarjetas: [...nuevasTarjetas] };
                break; // Asumimos que un ID de tarjeta es único
            }
        }

        if (!tarjetaEncontrada) {
            console.error("Tarjeta no encontrada para añadir comentario:", cardId);
            return estado;
        }
        return nuevoEstado;
    },

    /**
     * Edita el título y la descripción de una tarjeta existente y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} tituloNuevo - Nuevo título.
     * @param {string} descripcionNueva - Nueva descripción.
     * @returns {Object} Nuevo estado con los datos editados.
     */
    editarTarjeta: function(estado, cardId, tituloNuevo, descripcionNueva) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let tarjetaActualizada = false;
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const nuevasTarjetas = columna.tarjetas.map(card => {
                if (card.id === cardId) {
                    tarjetaActualizada = true;
                    // Creamos una copia de la tarjeta y actualizamos los campos
                    return { ...card, título: tituloNuevo, descripción: descripcionNueva };
                }
                return card;
            });

            nuevoEstado.columnas[i] = { ...columna, tarjetas: [...nuevasTarjetas] };
        }

        if (!tarjetaActualizada) {
            console.error("Tarjeta no encontrada para editar:", cardId);
            return estado;
        }
        return nuevoEstado;
    },

    /**
     * Elimina completamente una tarjeta del estado y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta a borrar.
     * @returns {Object} Nuevo estado sin la tarjeta eliminada.
     */
    borrarTarjeta: function(estado, cardId) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let tarjetaEliminada = false;
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            // Filtramos las tarjetas de la columna actual, excluyendo cardId
            const nuevasTarjetas = nuevoEstado.columnas[i].tarjetas.filter(card => card.id !== cardId);

            if (nuevasTarjetas.length < nuevoEstado.columnas[i].tarjetas.length) {
                // Si hubo un cambio, actualizamos la columna en el estado copiado
                nuevoEstado.columnas[i] = { ...nuevoEstado.columnas[i], tarjetas: [...nuevasTarjetas] };
                tarjetaEliminada = true;
            }
        }

        if (!tarjetaEliminada) {
            console.error("Tarjeta no encontrada para borrar:", cardId);
            return estado;
        }
        return nuevoEstado;
    },

    /**
     * Agrega una etiqueta (label) a una tarjeta existente y devuelve el nuevo estado.
     * @param {Object} estado - Estado actual del tablero.
     * @param {string} cardId - ID de la tarjeta objetivo.
     * @param {string} nombreEtiqueta - Nombre visible de la etiqueta.
     * @param {string} colorHex - Código hexadecimal del color de la etiqueta.
     * @returns {Object} Nuevo estado con la etiqueta añadida.
     */
    agregarEtiqueta: function(estado, cardId, nombreEtiqueta, colorHex) {
        const nuevoEstado = JSON.parse(JSON.stringify(estado));

        let tarjetaActualizada = false;
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const columna = nuevoEstado.columnas[i];
            const nuevasTarjetas = columna.tarjetas.map(card => {
                if (card.id === cardId) {
                    tarjetaActualizada = true;
                    // Creamos una copia de la tarjeta y añadimos la etiqueta al array
                    return { ...card, labels: [...card.labels, { nombre: nombreEtiqueta, color: colorHex }] };
                }
                return card;
            });

            nuevoEstado.columnas[i] = { ...columna, tarjetas: [...nuevasTarjetas] };
        }

        if (!tarjetaActualizada) {
            console.error("Tarjeta no encontrada para añadir etiqueta:", cardId);
            return estado;
        }
        return nuevoEstado;
    }
};
