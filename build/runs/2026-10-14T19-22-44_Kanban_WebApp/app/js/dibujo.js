function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Limpiar el contenedor principal
    appContainer.innerHTML = '';

    // --- Renderizar Controles de Aplicación (Crear Tarjeta) ---
    // "app" (acciones generales, elemento null): una vez, al final de #app
    const appControls = controlesDe("app", null, estado);
    if (appControls) {
        appContainer.appendChild(appControls);
    }

    // 2. Crear el contenedor principal del tablero (Kanban Board Wrapper)
    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'kanban-board'; // Clase para el wrapper general
    appContainer.appendChild(boardWrapper);


    // 3. Iterar sobre las columnas y renderizar cada una
    estado.columnas.forEach(columna => {
        const columnaDiv = document.createElement('div');
        columnaDiv.className = 'columna-container';

        // Título de la Columna
        const tituloColumna = document.createElement('h2');
        tituloColumna.className = 'columna-titulo';
        tituloColumna.textContent = columna.nombre;
        columnaDiv.appendChild(tituloColumna);

        // Contenedor donde irán las tarjetas (Scrollable area)
        const cardList = document.createElement('div');
        cardList.className = 'card-list'; // Clase para el área de tarjetas
        columnaDiv.appendChild(cardList);


        // 4. Iterar sobre las tarjetas y renderizar cada una dentro de la columna
        columna.tarjetas.forEach(tarjeta => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'card';

            // Título y Descripción
            const tituloCard = document.createElement('h3');
            tituloCard.className = 'card-titulo';
            tituloCard.textContent = tarjeta.titulo;
            cardDiv.appendChild(tituloCard);

            const descripcionCard = document.createElement('p');
            descripcionCard.className = 'card-descripcion';
            descripcionCard.textContent = tarjeta.descripcion;
            cardDiv.appendChild(descripcionCard);

            // Etiquetas (F4.2)
            if (tarjeta.etiquetas && tarjeta.etiquetas.length > 0) {
                const etiquetasContainer = document.createElement('div');
                etiquetasContainer.className = 'etiquetas-container';
                tarjeta.etiquetas.forEach(etiqueta => {
                    const etiquetaDiv = document.createElement('span');
                    etiquetaDiv.className = 'etiqueta';
                    etiquetaDiv.style.backgroundColor = etiqueta.color;
                    etiquetaDiv.textContent = etiqueta.nombre;
                    etiquetasContainer.appendChild(etiquetaDiv);
                });
                cardDiv.appendChild(etiquetasContainer);
            }

            // Comentarios (F4.6)
            if (tarjeta.comentarios && tarjeta.comentarios.length > 0) {
                const comentariosSeccion = document.createElement('div');
                comentariosSeccion.className = 'comentarios-seccion';
                
                // Ordenar por timestamp para mostrar cronológicamente (más antiguo arriba)
                const sortedComments = [...tarjeta.comentarios].sort((a, b) => a.timestamp - b.timestamp);

                sortedComments.forEach(comentario => {
                    const comentarioItem = document.createElement('div');
                    comentarioItem.className = 'comentario-item';

                    // Autor y Timestamp
                    const autorSpan = document.createElement('span');
                    autorSpan.className = 'comentario-autor';
                    autorSpan.textContent = `👤 ${comentario.autor}`;
                    
                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'comentario-timestamp';
                    // Formatear la fecha para mejor lectura
                    const date = new Date(comentario.timestamp * 1000);
                    timestampSpan.textContent = `(${date.toLocaleDateString()} ${date.toLocaleTimeString()})`;

                    // Contenido del comentario
                    const contenidoP = document.createElement('p');
                    contenidoP.className = 'comentario-contenido';
                    contenidoP.textContent = comentario.contenido;

                    comentarioItem.appendChild(autorSpan);
                    comentarioItem.appendChild(timestampSpan);
                    comentarioItem.appendChild(document.createElement('br')); // Separador visual
                    comentarioItem.appendChild(contenidoP);

                    comentariosSeccion.appendChild(comentarioItem);
                });

                cardDiv.appendChild(comentariosSeccion);
            }


            // 5. Agregar Controles de la Tarjeta (Mover, Comentar, Etiquetar, Editar, Borrar)
            const cardControls = controlesDe("tarjetas", tarjeta, estado);
            if (cardControls) {
                cardDiv.appendChild(cardControls);
            }

            // 6. Añadir la tarjeta al listado de la columna
            cardList.appendChild(cardDiv);
        });

        // 7. Añadir el contenedor completo de la columna al wrapper del tablero
        boardWrapper.appendChild(columnaDiv);
    });
}
