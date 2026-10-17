function dibujar(estado) {
    const appDiv = document.getElementById('app');
    if (!appDiv) return;

    // 1. Limpiar el contenedor principal
    appDiv.innerHTML = '';

    // --- Función auxiliar para obtener valor de prioridad numérico ---
    function getPriorityValue(prioridad) {
        switch (prioridad) {
            case 'alta': return 1;
            case 'media': return 2;
            case 'baja': return 3;
            default: return 4;
        }
    }

    // --- Función auxiliar para renderizar una tarjeta individual ---
    function crearElementoTarjeta(tarjeta, estado) {
        const card = document.createElement('div');
        card.className = 'tarjeta';
        card.setAttribute('data-id', tarjeta.id);

        // Estructura interna de la tarjeta (Drag Handle + Body/Actions)
        // Usamos textContent para asegurar que el contenido es seguro.
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';

        const topDiv = document.createElement('div');
        topDiv.className = 'top';

        const titleH3 = document.createElement('h3');
        titleH3.className = 'columna-title';
        titleH3.textContent = tarjeta.titulo;

        // Contenedor de acciones (Aquí se colocarán los controles generados por controlesDe)
        const accionesDiv = document.createElement('div');
        accionesDiv.className = 'acciones';
        topDiv.appendChild(titleH3);
        topDiv.appendChild(accionesDiv); // Aquí va el resultado de controlesDe("cards", ...)

        cardBody.appendChild(topDiv);

        // Descripción y Prioridad
        const pDesc = document.createElement('p');
        pDesc.textContent = tarjeta.descripcion;
        cardBody.appendChild(pDesc);

        const etiquetaPrioridad = document.createElement('div');
        etiquetaPrioridad.className = `prioridad-etiqueta prioridad-${tarjeta.prioridad}`;
        etiquetaPrioridad.textContent = 'Prioridad: ' + tarjeta.prioridad;
        cardBody.appendChild(etiquetaPrioridad);

        // Ensamblar la tarjeta
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '⠿'; // Usamos textContent para el emoji/símbolo
        card.appendChild(dragHandle);
        card.appendChild(cardBody);

        return card;
    }


    // --- 2. Renderizar Columnas ---
    const contenedorColumnas = document.createElement('div');
    contenedorColumnas.className = 'kanban-board'; // Clase contenedora general si es necesario

    estado.columnas.forEach(columna => {
        const columnaDiv = document.createElement('div');
        columnaDiv.className = 'columna';

        // Header de la Columna (Título y Contador)
        const header = document.createElement('div');
        header.className = 'columna-header';
        
        const titleH2 = document.createElement('h2');
        titleH2.className = 'columna-title';
        titleH2.textContent = columna.title;

        const contadorSpan = document.createElement('span');
        contadorSpan.className = 'columna-contador';
        contadorSpan.textContent = `(${columna.contador})`;
        
        header.appendChild(titleH2);
        header.appendChild(contadorSpan);
        columnaDiv.appendChild(header);

        // Botón Agregar Tarjeta (Solo en 'Pendiente')
        if (columna.tieneAgregarBtn) {
            const agregarBtn = document.createElement('button');
            agregarBtn.className = 'agregar-tarjeta-btn';
            // El texto del botón es fijo y no viene del estado, por lo que se puede usar textContent.
            agregarBtn.textContent = '➕ Agregar tarjeta'; 
            columnaDiv.appendChild(agregarBtn);
        }

        // Contenedor de Tarjetas (Scrollable)
        const cardContainer = document.createElement('div');
        cardContainer.className = 'card-container';
        cardContainer.setAttribute('data-column-id', columna.id); 

        // 3. Ordenamiento de Tarjetas: Alta > Media > Baja, luego por fecha descendente
        const sortedCards = [...columna.cards].sort((a, b) => {
            const pA = getPriorityValue(a.prioridad);
            const pB = getPriorityValue(b.prioridad);

            // 1. Comparar prioridad (menor valor numérico es mayor prioridad)
            if (pA !== pB) {
                return pA - pB;
            }
            // 2. Si la prioridad es igual, comparar por fecha de creación (más reciente primero)
            return b.fechaCreacion - a.fechaCreacion;
        });

        // Renderizar tarjetas ordenadas
        sortedCards.forEach(tarjeta => {
            const cardElement = crearElementoTarjeta(tarjeta, estado);
            cardContainer.appendChild(cardElement);
        });

        columnaDiv.appendChild(cardContainer);
        contenedorColumnas.appendChild(columnaDiv);
    });

    appDiv.appendChild(contenedorColumnas);


    // --- 4. Renderizar Controles de Aplicación (App Actions) ---
    // Los controles generales se añaden al final del #app, después de todo el tablero.
    const appControlsContainer = document.createElement('div');
    appControlsContainer.className = 'app-controls'; 

    // Llamar a controlesDe para las acciones globales (Mostrar Crear Modal, Cerrar Modal, Crear Tarjeta)
    // El segundo argumento es null porque no hay un elemento específico al que pertenezcan estas acciones.
    const appActionsDiv = document.createElement('div');
    appActionsDiv.className = 'global-actions'; 
    appActionsDiv.appendChild(controlesDe("app", null, estado));

    // Añadir el contenedor de acciones globales después del tablero
    appDiv.appendChild(document.createElement('hr')); // Separador visual
    appDiv.appendChild(appActionsDiv);
}
