let estado = App.crear();

document.getElementById('app').addEventListener('click', function(ev) {
    const b = ev.target.closest("[data-accion]");
    if (!b) return;

    let nuevoEstado = estado;
    let accion = b.dataset.accion;
    // El padre del botón contiene los campos de input asociados a la acción
    let parentElement = b.parentElement; 

    try {
        switch (accion) {
            case "crearTarjeta":
                const columnIdCreate = b.dataset.columnid;
                const contentCreate = parentElement.querySelector('[data-campo="content"]').value;
                if (columnIdCreate && contentCreate) {
                    nuevoEstado = App.crearTarjeta(estado, columnIdCreate, contentCreate);
                }
                break;

            case "moverTarjeta":
                const cardIdMove = b.dataset.cardid;
                const sourceColumnIdMove = b.dataset.sourcecolumnid;
                const targetColumnIdMove = b.dataset.targetcolumnid;
                if (cardIdMove && sourceColumnIdMove && targetColumnIdMove) {
                    nuevoEstado = App.moverTarjeta(estado, cardIdMove, sourceColumnIdMove, targetColumnIdMove);
                }
                break;

            case "agregarComentario":
                const cardIdComment = b.dataset.cardid;
                const commentText = parentElement.querySelector('[data-campo="commentText"]').value;
                if (cardIdComment && commentText) {
                    nuevoEstado = App.agregarComentario(estado, cardIdComment, commentText);
                }
                break;

            case "agregarEtiqueta":
                const cardIdTag = b.dataset.cardid;
                // Se usa .trim() para asegurar que no se añadan etiquetas vacías
                const tagName = parentElement.querySelector('[data-campo="tagName"]').value.trim(); 
                if (cardIdTag && tagName) {
                    nuevoEstado = App.agregarEtiqueta(estado, cardIdTag, tagName);
                }
                break;

            case "editarTarjeta":
                const cardIdEdit = b.dataset.cardid;
                const newContent = parentElement.querySelector('[data-campo="newContent"]').value;
                if (cardIdEdit && newContent) {
                    nuevoEstado = App.editarTarjeta(estado, cardIdEdit, newContent);
                }
                break;

            case "borrarTarjeta":
                const cardIdDelete = b.dataset.cardid;
                const columnIdDelete = b.dataset.columnid;
                if (cardIdDelete && columnIdDelete) {
                    nuevoEstado = App.borrarTarjeta(estado, cardIdDelete, columnIdDelete);
                }
                break;

            default:
                console.warn("Acción no reconocida:", accion);
        }
    } catch (e) {
        console.error("Error al procesar la acción:", e);
    }

    // Actualizar el estado global y redibujar
    estado = nuevoEstado;
    dibujar(estado);
});

// Dibujar el tablero inicial al cargar la aplicación
dibujar(estado);
