const App = {
    /**
     * Crea una copia profunda del estado inicial.
     * @returns {object} El estado inicial copiado.
     */
    crear: function() {
        return JSON.parse(JSON.stringify(ESTADO_INICIAL));
    },

    /**
     * Crea una nueva tarjeta y la añade a 'Pendiente'.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} titulo - Título de la nueva tarjeta.
     * @param {string} descripcion - Descripción inicial.
     * @returns {object} Nuevo estado con la tarjeta agregada.
     */
    crearTarjeta: function(estado, titulo, descripcion) {
        const columnaPendiente = estado.columnas.find(c => c.id === 'pendiente');
        if (!columnaPendiente) return estado;

        // Generar un ID único simple (usando timestamp + aleatorio para simular unicidad)
        const newCardId = `card-${Date.now()}`;

        const nuevaTarjeta = {
            id: newCardId,
            titulo: titulo,
            descripcion: descripcion,
            contenido_adicional: "",
            labels: [],
            comentarios: []
        };

        // Crear la nueva estructura de estado (inmutabilidad)
        let nuevoColumnas = estado.columnas.map(columna => {
            if (columna.id === 'pendiente') {
                return {
                    ...columna,
                    tarjetas: [...columna.tarjetas, nuevaTarjeta]
                };
            }
            return columna;
        });

        const nuevoEstado = {
            ...estado,
            columnas: nuevoColumnas
        };

        return nuevoEstado;
    },

    /**
     * Mueve una tarjeta de su columna actual a la columna destino.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} cardId - ID de la tarjeta a mover.
     * @param {string} nuevaColumnaId - ID de la columna destino.
     * @returns {object} Nuevo estado con la tarjeta movida.
     */
    moverTarjeta: function(estado, cardId, nuevaColumnaId) {
        let nuevoColumnas = [];

        // 1. Mover y filtrar tarjetas en el proceso
        for (const columna of estado.columnas) {
            const nuevasTarjetas = columna.tarjetas.filter(card => card.id !== cardId);

            if (columna.id === nuevaColumnaId) {
                // Si es la columna destino, agregamos la tarjeta movida al final de su lista filtrada
                nuevoColumnas.push({
                    ...columna,
                    tarjetas: [...nuevasTarjetas, estado.columnas.find(c => c.id === cardId)?.tarjetas.find(t => t.id === cardId)]
                });
            } else {
                // Para todas las demás columnas, simplemente mantenemos la lista filtrada
                nuevoColumnas.push({
                    ...columna,
                    tarjetas: [...nuevasTarjetas]
                });
            }
        }

        // Ajuste crucial para el destino: necesitamos encontrar dónde estaba la tarjeta y moverla.
        let nuevoEstado = JSON.parse(JSON.stringify(estado)); // Clonar estado base
        let cardToMove = null;
        let sourceColIndex = -1;

        // 1. Encontrar la tarjeta y su columna de origen
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            cardToMove = col.tarjetas.find(t => t.id === cardId);
            if (cardToMove) {
                sourceColIndex = i;
                break;
            }
        }

        // Si la tarjeta no se encuentra, devolvemos el estado sin cambios
        if (!cardToMove || sourceColIndex === -1) return estado;


        // 2. Crear el nuevo estado inmutable
        let newColumnas = [];
        for (let i = 0; i < nuevoEstado.columnas.length; i++) {
            const col = nuevoEstado.columnas[i];
            if (i === sourceColIndex) {
                // Clonar la columna origen sin la tarjeta
                newColumnas.push({ ...col, tarjetas: col.tarjetas.filter(t => t.id !== cardId) });
            } else if (i === nuevoColumnas.findIndex(c => c.id === nuevaColumnaId)) {
                 // Clonar la columna destino y añadir la tarjeta al final
                newColumnas[i] = { ...col, tarjetas: [...col.tarjetas, cardToMove] };
            } else {
                // Copiar otras columnas sin cambios
                newColumnas.push({...col});
            }
        }

        return {
            ...nuevoEstado,
            columnas: newColumnas
        };
    },

    /**
     * Agrega un nuevo comentario a la tarjeta especificada.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} cardId - ID de la tarjeta.
     * @param {string} contenido - Contenido del mensaje.
     * @param {string} autor - Autor del comentario.
     * @returns {object} Nuevo estado con el comentario añadido.
     */
    agregarComentario: function(estado, cardId, contenido, autor) {
        const nuevoTimestamp = new Date().toISOString();

        // Clonar todo para asegurar inmutabilidad
        let nuevaEstado = JSON.parse(JSON.stringify(estado));

        for (let i = 0; i < nuevaEstado.columnas.length; i++) {
            const columna = nuevaEstado.columnas[i];
            const tarjetaIndex = columna.tarjetas.findIndex(t => t.id === cardId);

            if (tarjetaIndex !== -1) {
                // Crear una copia de la tarjeta y añadir el comentario
                const tarjetaActual = columna.tarjetas[tarjetaIndex];
                const nuevoComentario = { autor: autor, contenido: contenido, timestamp: nuevoTimestamp };
                const nuevasTarjetas = [...columna.tarjetas];
                nuevasTarjetas[tarjetaIndex] = {
                    ...tarjetaActual,
                    comentarios: [...tarjetaActual.comentarios, nuevoComentario]
                };

                // Reemplazar la columna en el estado
                nuevaEstado.columnas[i] = {
                    ...columna,
                    tarjetas: nuevasTarjetas
                };
                return nuevaEstado; // Retornamos inmediatamente al encontrar y modificar
            }
        }

        return estado; // No se encontró la tarjeta
    },

    /**
     * Actualiza los detalles principales de la tarjeta.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} cardId - ID de la tarjeta a editar.
     * @param {string} titulo - Nuevo título.
     * @param {string} descripcion - Nueva descripción.
     * @param {string} contenidoAdicional - Nuevo contenido adicional.
     * @returns {object} Nuevo estado con los datos actualizados.
     */
    editarTarjeta: function(estado, cardId, titulo, descripcion, contenidoAdicional) {
        let nuevaEstado = JSON.parse(JSON.stringify(estado));

        for (let i = 0; i < nuevaEstado.columnas.length; i++) {
            const columna = nuevaEstado.columnas[i];
            const tarjetaIndex = columna.tarjetas.findIndex(t => t.id === cardId);

            if (tarjetaIndex !== -1) {
                // Clonar la tarjeta y actualizar sus propiedades
                const tarjetaActual = columna.tarjetas[tarjetaIndex];
                const nuevaTarjeta = {
                    ...tarjetaActual,
                    titulo: titulo || tarjetaActual.titulo,
                    descripcion: descripcion || tarjetaActual.descripcion,
                    contenido_adicional: contenidoAdicional !== undefined ? contenidoAdicional : tarjetaActual.contenido_adicional
                };

                // Reemplazar la tarjeta en el array de tarjetas de la columna
                const nuevasTarjetas = [...columna.tarjetas];
                nuevasTarjetas[tarjetaIndex] = nuevaTarjeta;

                nuevaEstado.columnas[i] = {
                    ...columna,
                    tarjetas: nuevasTarjetas
                };
                return nuevaEstado;
            }
        }

        return estado; // No se encontró la tarjeta
    },

    /**
     * Elimina permanentemente la tarjeta del tablero.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} cardId - ID de la tarjeta a eliminar.
     * @returns {object} Nuevo estado sin la tarjeta.
     */
    eliminarTarjeta: function(estado, cardId) {
        let nuevoColumnas = [];

        for (const columna of estado.columnas) {
            // Filtrar las tarjetas de esta columna, manteniendo solo aquellas cuyo ID no coincida con el que se va a eliminar
            const nuevasTarjetas = columna.tarjetas.filter(card => card.id !== cardId);

            // Clonamos la columna y sus nuevas tarjetas
            nuevoColumnas.push({
                ...columna,
                tarjetas: [...nuevasTarjetas]
            });
        }

        return {
            ...estado,
            columnas: nuevoColumnas
        };
    },

    /**
     * Añade una nueva etiqueta a la tarjeta.
     * @param {object} estado - El estado actual de la aplicación.
     * @param {string} cardId - ID de la tarjeta.
     * @param {string} nombreEtiqueta - Nombre de la nueva etiqueta.
     * @param {string} colorHex - Color hexadecimal de la etiqueta.
     * @returns {object} Nuevo estado con la etiqueta añadida.
     */
    agregarEtiqueta: function(estado, cardId, nombreEtiqueta, colorHex) {
        // Clonar todo para asegurar inmutabilidad
        let nuevaEstado = JSON.parse(JSON.stringify(estado));

        for (let i = 0; i < nuevaEstado.columnas.length; i++) {
            const columna = nuevaEstado.columnas[i];
            const tarjetaIndex = columna.tarjetas.findIndex(t => t.id === cardId);

            if (tarjetaIndex !== -1) {
                const tarjetaActual = columna.tarjetas[tarjetaIndex];

                // Verificar si la etiqueta ya existe para evitar duplicados
                const etiquetasExistentes = tarjetaActual.labels;
                if (etiquetasExistentes.some(label => label.nombre === nombreEtiqueta)) {
                    return estado; // No hacer nada si ya existe
                }

                // Crear el nuevo objeto Etiqueta y actualizar la tarjeta
                const nuevaEtiqueta = { nombre: nombreEtiqueta, color: colorHex };
                const nuevasTarjetas = [...columna.tarjetas];
                nuevasTarjetas[tarjetaIndex] = {
                    ...tarjetaActual,
                    labels: [...etiquetasExistentes, nuevaEtiqueta]
                };

                // Reemplazar la columna en el estado
                nuevaEstado.columnas[i] = {
                    ...columna,
                    tarjetas: nuevasTarjetas
                };
                return nuevaEstado;
            }
        }

        return estado; // No se encontró la tarjeta
    }
};
