function dibujar(estado) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. Vaciar el contenedor principal
    appContainer.innerHTML = '';

    /**
     * Renderiza los controles de acción para una tarjeta específica.
     * @param {string} cardId - ID de la tarjeta.
     * @param {string} origenColumnaId - ID de la columna actual (para mover).
     * @returns {string} HTML con todos los botones y campos de acción.
     */
    function renderActionControls(cardId, origenColumnaId) {
        let actionHTML = '';

        // 1. Mover Tarjeta
        actionHTML += `<div class="acciones">`;
        estado.columnas.forEach(col => {
            if (col.id !== origenColumnaId) {
                actionHTML += `<button data-accion="moverTarjeta" 
                                    data-cardId="${cardId}" 
                                    data-origenColumnaId="${origenColumnaId}" 
                                    data-destinoColumnaId="${col.id}">
                                Mover a ${col.titulo}</button>`;
            }
        });

        // 2. Agregar Comentario
        actionHTML += `<div class="acciones-group">
                            <button data-accion="agregarComentario" data-cardId="${cardId}">💬 Añadir Comentario</button>
                            <div style="margin-top: 5px;">
                                <textarea data-campo="texto" placeholder="Escribe tu comentario..."></textarea>
                            </div>
                        </div>`;

        // 3. Agregar Etiqueta
        actionHTML += `<div class="acciones-group">
                            <button data-accion="agregarEtiqueta" data-cardId="${cardId}">🏷️ Añadir Etiqueta</button>
                            <div style="margin-top: 5px;">
                                <input type="text" data-campo="etiquetaTexto" placeholder="Ej: Bug, UI">
                            </div>
                        </div>`;

        // 4. Editar Tarjeta
        actionHTML += `<div class="acciones-group">
                            <button data-accion="editarTarjeta" data-cardId="${cardId}">✏️ Editar</button>
                            <div style="margin-top: 5px;">
                                <input type="text" data-campo="tituloNuevo" placeholder="Nuevo Título"><br>
                                <textarea data-campo="contenidoNuevo" placeholder="Contenido actualizado..."></textarea>
                            </div>
                        </div>`;

        // 5. Borrar Tarjeta
        actionHTML += `<div class="acciones-group">
                            <button data-accion="borrarTarjeta" data-cardId="${cardId}">🗑️ Eliminar Tarjeta</button>
                        </div>`;

        actionHTML += `</div>`; // Cierre de .acciones

        return actionHTML;
    }


    // 2. Iterar sobre las columnas para construir el tablero
    estado.columnas.forEach(columna => {
        const columnaDiv = document.createElement('div');
        columnaDiv.className = 'columna';

        // Título de la Columna
        let colTitle = document.createElement('h2');
        colTitle.textContent = columna.titulo;
        columnaDiv.appendChild(colTitle);

        // Controles para crear nueva tarjeta en esta columna (Usando .nueva-tarjeta-form)
        const createControls = document.createElement('div');
        createControls.className = 'crear-card-controls'; // Usando la clase de estilos existente
        createControls.innerHTML = `
            <button data-accion="crearTarjeta" data-columnaId="${columna.id}">+ Crear Tarjeta</button>
            <div style="margin-top: 10px;">
                <input type="text" data-campo="titulo" placeholder="Título de la tarjeta">
                <textarea data-campo="contenido" placeholder="Descripción inicial..."></textarea>
            </div>
        `;
        columnaDiv.appendChild(createControls);

        // Contenedor para las tarjetas (Solo contenedor, sin clase problemática)
        const cardsContainer = document.createElement('div'); 

        // 3. Iterar sobre las tarjetas de la columna
        columna.tarjetas.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'tarjeta';
            cardDiv.dataset.cardId = card.id;

            // Contenido principal (Título y Descripción)
            let contentHTML = `<h3 class="card-title">${card.titulo}</h3><p class="contenido">${card.contenido}</p>`;
            cardDiv.innerHTML += contentHTML;

            // Etiquetas
            if (card.etiquetas && card.etiquetas.length > 0) {
                let tagsHTML = '<div class="etiquetas">';
                card.etiquetas.forEach(tag => {
                    // Usamos un span simple, confiando en que la clase .etiquetas lo agrupe bien
                    tagsHTML += `<span>${tag}</span>`; 
                });
                tagsHTML += '</div>';
                cardDiv.innerHTML += tagsHTML;
            }

            // Comentarios
            if (card.comentarios && card.comentarios.length > 0) {
                let commentsHTML = '<div class="comentarios">';
                card.comentarios.forEach(comment => {
                    commentsHTML += `
                        <div class="comentario-item">
                            <p class="comentario-autor">${comment.autor}</p>
                            <p>${comment.texto}</p>
                        </div>`;
                });
                commentsHTML += '</div>';
                cardDiv.innerHTML += commentsHTML;
            }

            // 4. Renderizar Controles de Acción (Botones)
            const actionControls = renderActionControls(card.id, columna.id);
            cardDiv.innerHTML += `<div class="acciones">${actionControls}</div>`;


            // Añadir la tarjeta al contenedor de tarjetas
            cardsContainer.appendChild(cardDiv);
        });

        columnaDiv.appendChild(cardsContainer);
        appContainer.appendChild(columnaDiv);
    });
}
