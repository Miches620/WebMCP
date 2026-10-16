function dibujar(estado) {
    const app = document.getElementById('app');
    if (!app) return;

    // 1. Limpiar el contenido actual del tablero
    app.innerHTML = '';

    // 2. Iterar sobre las columnas para construir la estructura principal
    estado.columnas.forEach(columna => {
        const columnaDiv = document.createElement('div');
        columnaDiv.className = 'columna';
        columnaDiv.dataset.columnaId = columna.id;

        // --- Header de Columna ---
        const headerDiv = document.createElement('div');
        headerDiv.className = 'columna-header';
        
        // Título (usando textContent para seguridad)
        const titleElement = document.createElement('h3');
        titleElement.textContent = columna.titulo;
        headerDiv.appendChild(titleElement);

        // Contador de tarjetas (Usaremos un p simple dentro del header, ya que no hay clase específica para el contador en el brief/styles)
        const counterElement = document.createElement('p');
        counterElement.textContent = `(${columna.tarjetas.length})`;
        headerDiv.appendChild(counterElement);

        columnaDiv.appendChild(headerDiv);

        // 3. Controles de la Columna (Agregar Tarjeta)
        // Esto añade los controlesDe("columnas", columna, estado)
        const columnControls = controlesDe("columnas", columna, estado);
        if (columnControls && columnControls.children.length > 0) {
             columnaDiv.appendChild(columnControls);
        }


        // --- Contenedor de Tarjetas ---
        const tarjetasContainer = document.createElement('div');
        tarjetasContainer.className = 'tarjetas-container';
        tarjetasContainer.dataset.columnaId = columna.id;

        // 4. Renderizar las tarjetas dentro del contenedor
        columna.tarjetas.forEach(tarjeta => {
            const tarjetaDiv = document.createElement('div');
            tarjetaDiv.className = 'tarjeta';
            tarjetaDiv.dataset.cardId = tarjeta.id;

            // Contenedor de Drag & Drop (24px)
            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';
            dragHandle.setAttribute('draggable', 'true');
            dragHandle.textContent = '⠿'; // Icono de arrastre
            tarjetaDiv.appendChild(dragHandle);

            // Cuerpo de la tarjeta (Título, Descripción, Prioridad)
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'tarjeta-body';
            
            // Título (usando textContent para seguridad)
            const titleElement = document.createElement('h4');
            titleElement.textContent = tarjeta.titulo;
            bodyDiv.appendChild(titleElement);

            // Descripción (usando textContent para seguridad)
            const descriptionElement = document.createElement('p');
            descriptionElement.textContent = tarjeta.descripcion;
            bodyDiv.appendChild(descriptionElement);

            // Etiqueta de prioridad
            const priorityLabel = document.createElement('span');
            priorityLabel.className = `prioridad-etiqueta prioridad-${tarjeta.prioridad}`;
            priorityLabel.textContent = tarjeta.prioridad;
            bodyDiv.appendChild(priorityLabel);

            tarjetaDiv.appendChild(bodyDiv);

            // Acciones (Editar/Eliminar) - Aquí se inyectan los controles de js/acciones.js
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'tarjeta-actions';
            // Se pasa el tipo "tarjetas" porque la tarjeta tiene acciones asociadas
            actionsContainer.appendChild(controlesDe("tarjetas", tarjeta, estado)); 

            tarjetaDiv.appendChild(actionsContainer);
            tarjetasContainer.appendChild(tarjetaDiv);
        });

        columnaDiv.appendChild(tarjetasContainer);
        app.appendChild(columnaDiv);
    });
}
