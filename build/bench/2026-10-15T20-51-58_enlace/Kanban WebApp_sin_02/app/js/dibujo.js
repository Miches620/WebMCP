function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Limpiar contenedor principal
    appContainer.innerHTML = '';

    // 2. Renderizar Controles de Aplicación (Crear Tarjeta)
    const appControls = controlesDe("app", null, estado);
    if (appControls) {
        appContainer.appendChild(appControls);
    }

    // 3. Renderizar Columnas y Tarjetas
    estado.columnas.forEach(columna => {
        const columnaEl = document.createElement('div');
        columnaEl.className = 'columna';
        columnaEl.setAttribute('data-columna-id', columna.id);

        // Título y Descripción de la Columna (Usando DOM seguro)
        const tituloCol = document.createElement('h2');
        tituloCol.textContent = columna.titulo;
        columnaEl.appendChild(tituloCol);

        const pDescripcion = document.createElement('p');
        pDescripcion.className = 'descripcion-columna';
        pDescripcion.textContent = columna.descripcion_columna;
        columnaEl.appendChild(pDescripcion);

        // Contenedor de tarjetas (donde se apilan las cards)
        const cardListContainer = document.createElement('div');
        cardListContainer.className = 'card-list';
        columnaEl.appendChild(cardListContainer);

        // 3a. Renderizar Tarjetas dentro de la Columna
        columna.tarjetas.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.setAttribute('data-card-id', card.id);

            // Contenido principal de la tarjeta (Construcción segura)
            let contentHtml = '';
            
            // Título
            const h3Titulo = document.createElement('h3');
            h3Titulo.textContent = card.titulo;
            contentHtml += h3Titulo; // Temporalmente guardamos el elemento

            // Descripción
            if (card.descripcion) {
                const pDescripcionCard = document.createElement('p');
                pDescripcionCard.className = 'descripcion';
                pDescripcionCard.textContent = card.descripcion;
                contentHtml += pDescripcionCard;
            }
            
            // Contenido Adicional
            if (card.contenido_adicional) {
                const divDetalle = document.createElement('div');
                divDetalle.className = 'contenido-adicional';
                divDetalle.innerHTML = `<strong>Detalle:</strong> `; // El strong es seguro
                // Aquí usamos textContent para el texto variable
                divDetalle.appendChild(document.createTextNode(card.contenido_adicional)); 
                contentHtml += divDetalle;
            }


            // 3b. Renderizar Labels (Construcción segura)
            const labelsContainer = document.createElement('div');
            labelsContainer.className = 'labels-container';
            if (card.labels && card.labels.length > 0) {
                card.labels.forEach(label => {
                    const labelEl = document.createElement('span');
                    labelEl.className = 'label';
                    // Usamos estilo en línea, pero el contenido es texto plano
                    labelEl.setAttribute('style', `background-color: ${label.color};`);
                    labelEl.textContent = label.nombre; 
                    labelsContainer.appendChild(labelEl);
                });
            } else {
                 const pSinLabels = document.createElement('p');
                 pSinLabels.textContent = 'Sin etiquetas.';
                 labelsContainer.appendChild(pSinLabels);
            }
            contentHtml += labelsContainer;

            // 3c. Renderizar Comentarios (Construcción segura)
            const commentsContainer = document.createElement('div');
            commentsContainer.className = 'comments-container';
            if (card.comentarios && card.comentarios.length > 0) {
                card.comentarios.forEach(comment => {
                    const date = new Date(comment.timestamp);
                    // Usamos toLocaleString para formatear, el resultado es texto seguro
                    const formattedDate = date.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });

                    const commentEl = document.createElement('div');
                    commentEl.className = 'comment';

                    // Header (Autor y Fecha)
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'comment-header';
                    
                    const strongAutor = document.createElement('strong');
                    strongAutor.textContent = comment.autor;
                    headerDiv.appendChild(strongAutor);

                    const spanRaya = document.createTextNode(' - '); // Separador de texto puro
                    headerDiv.appendChild(spanRaya);
                    
                    const spanFecha = document.createTextNode(formattedDate);
                    headerDiv.appendChild(spanFecha);
                    
                    commentEl.appendChild(headerDiv);

                    // Contenido del comentario (Texto seguro)
                    const pContenido = document.createElement('p');
                    pContenido.textContent = comment.contenido;
                    commentEl.appendChild(pContenido);

                    commentsContainer.appendChild(commentEl);
                });
            } else {
                 const pSinComentarios = document.createElement('p');
                 pSinComentarios.className = 'sin-comentarios';
                 pSinComentarios.textContent = 'Aún no hay comentarios.';
                 commentsContainer.appendChild(pSinComentarios);
            }
            contentHtml += commentsContainer;


            // Ensamblar el cuerpo de la tarjeta (usando appendChild en lugar de innerHTML)
            cardEl.appendChild(h3Titulo); 
            
            let currentElement = cardEl;

            // Añadir descripción y contenido adicional
            if (card.descripcion) {
                currentElement.appendChild(document.createElement('p')).className = 'descripcion';
                currentElement.querySelector('.descripcion').textContent = card.descripcion;
            }
            
            if (card.contenido_adicional) {
                const divDetalle = document.createElement('div');
                divDetalle.className = 'contenido-adicional';
                // Añadir strong con texto seguro y luego el contenido adicional como texto puro
                divDetalle.innerHTML = `<strong>Detalle:</strong> `; 
                divDetalle.appendChild(document.createTextNode(card.contenido_adicional)); 
                currentElement.appendChild(divDetalle);
            }

            // Labels
            currentElement.appendChild(labelsContainer);
            
            // Contenedor de acciones (Aquí va el contenido generado por controlesDe)
            const cardActionsContainer = document.createElement('div');
            cardActionsContainer.className = 'acciones-tarjeta'; // Clase para los controles
            currentElement.appendChild(cardActionsContainer);

            // Comentarios
            currentElement.appendChild(commentsContainer);


            // 3d. Añadir controles de acción a la tarjeta (Mover, Comentar, Editar, Eliminar, Etiquetar)
            const controls = controlesDe("tarjetas", card, estado);
            if (controls) {
                cardActionsContainer.appendChild(controls);
            }

            // 3e. Añadir tarjeta al listado de columnas
            cardListContainer.appendChild(cardEl);
        });

        // 4. Añadir columna completa al contenedor principal
        appContainer.appendChild(columnaEl);
    });
}
