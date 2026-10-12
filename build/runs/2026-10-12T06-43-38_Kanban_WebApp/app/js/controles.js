let estado = App.crear();

// --- 1. Manejador de Eventos para Acciones en el Tablero (Delegación) ---
const appContainer = document.getElementById('app');

if (appContainer) {
    appContainer.addEventListener('click', function(event) {
        let target = event.target;
        // Verificar si el clic ocurrió en un elemento con data-accion
        if (target.hasAttribute('data-accion')) {
            const accion = target.getAttribute('data-accion');

            switch (accion) {
                case 'borrarTarjeta':
                    const cardIdToDelete = target.getAttribute('data-card-id');
                    if (confirm("¿Estás seguro de que quieres borrar esta tarjeta y todos sus comentarios?")) {
                        estado = App.borrarTarjeta(estado, cardIdToDelete);
                        dibujar(estado);
                    }
                    break;

                // Aquí se podrían añadir más acciones basadas en data-accion si las hubiera (ej: abrirModalEditar)
            }
        }
    });
}


// --- 2. Manejadores de Formularios Fijos (Controles) ---

// A. Crear Tarjeta
const createCardForm = document.getElementById('createCardForm');
if (createCardForm) {
    createCardForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const contenido = document.getElementById('cardContentInput').value;
        const columnaId = document.getElementById('columnIdSelect').value;

        if (contenido && columnaId) {
            estado = App.crearTarjeta(estado, contenido, columnaId);
            dibujar(estado);
            // Limpiar formulario después de éxito
            createCardForm.reset();
        }
    });
}

// B. Añadir Comentario
const addCommentForm = document.getElementById('addCommentForm');
if (addCommentForm) {
    addCommentForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const cardId = document.getElementById('commentCardIdInput').value;
        const texto = document.getElementById('commentText').value;
        const usuario = document.getElementById('commentUserSelect').value;

        if (cardId && texto && usuario) {
            estado = App.agregarComentario(estado, cardId, texto, usuario);
            dibujar(estado);
            // Limpiar formulario después de éxito
            addCommentForm.reset();
        }
    });
}

// C. Editar Tarjeta
const editCardForm = document.getElementById('editCardForm');
if (editCardForm) {
    editCardForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const cardId = document.getElementById('editCardIdInput').value;
        const nuevoContenido = document.getElementById('newContentTextarea').value;

        if (cardId && nuevoContenido) {
            estado = App.editarTarjeta(estado, cardId, nuevoContenido);
            dibujar(estado);
            // Limpiar formulario después de éxito
            editCardForm.reset();
        }
    });
}

// D. Etiquetar Tarjeta
const labelCardForm = document.getElementById('labelCardForm');
if (labelCardForm) {
    labelCardForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const cardId = document.getElementById('labelCardIdInput').value;
        const labelsString = document.getElementById('newLabelsInput').value;

        // Convertir la cadena de etiquetas (separadas por coma) a un array limpio
        const nuevasEtiquetas = labelsString.split(',').map(s => s.trim()).filter(s => s);

        if (cardId && nuevasEtiquetas.length > 0) {
            estado = App.etiquetarTarjeta(estado, cardId, nuevasEtiquetas);
            dibujar(estado);
            // Limpiar formulario después de éxito
            labelCardForm.reset();
        }
    });
}

// --- Inicialización del Tablero ---
dibujar(estado);
