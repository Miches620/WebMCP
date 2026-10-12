let estado = App.crear();

document.getElementById('app').addEventListener('click', function(ev) {
    const b = ev.target.closest("[data-accion]");
    if (!b) return;

    let nuevoEstado = estado;

    switch (b.dataset.accion) {
        case "crearTarjeta":
            const tituloNuevo = b.parentElement.querySelector('[data-campo="titulo"]').value;
            const contenidoNuevo = b.parentElement.querySelector('[data-campo="contenido"]').value;
            nuevoEstado = App.crearTarjeta(estado, b.dataset.columnaId, tituloNuevo, contenidoNuevo);
            break;

        case "moverTarjeta":
            // No requiere campos de texto adicionales, solo IDs del dataset
            nuevoEstado = App.moverTarjeta(estado, b.dataset.cardId, b.dataset.origenColumnaId, b.dataset.destinoColumnaId);
            break;

        case "agregarComentario":
            const textoComentario = b.parentElement.querySelector('[data-campo="texto"]').value;
            nuevoEstado = App.agregarComentario(estado, b.dataset.cardId, textoComentario);
            break;

        case "agregarEtiqueta":
            const etiquetaTexto = b.parentElement.querySelector('[data-campo="etiquetaTexto"]').value;
            nuevoEstado = App.agregarEtiqueta(estado, b.dataset.cardId, etiquetaTexto);
            break;

        case "editarTarjeta":
            const tituloNuevoEditado = b.parentElement.querySelector('[data-campo="tituloNuevo"]').value;
            const contenidoNuevoEditado = b.parentElement.querySelector('[data-campo="contenidoNuevo"]').value;
            nuevoEstado = App.editarTarjeta(estado, b.dataset.cardId, tituloNuevoEditado, contenidoNuevoEditado);
            break;

        case "borrarTarjeta":
            // No requiere campos de texto adicionales, solo el ID del dataset
            nuevoEstado = App.borrarTarjeta(estado, b.dataset.cardId);
            break;
    }

    if (nuevoEstado !== estado) {
        estado = nuevoEstado;
        dibujar(estado);
    }
});

// Dibujar el estado inicial al cargar la aplicación
dibujar(estado);
