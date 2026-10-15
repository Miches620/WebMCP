// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "agregarTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "") return; estado = App.agregarTarjeta(estado, b.dataset.columnaid, campo(b, "titulo"), campo(b, "descripcion")); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, num(b.dataset.cardid), campo(b, "columnaOrigenId"), b.dataset.columnadestinoid); break;
    case "editarTarjeta": if (campo(b, "tituloNuevo") === "" || campo(b, "descripcionNueva") === "") return; estado = App.editarTarjeta(estado, num(b.dataset.cardid), campo(b, "tituloNuevo"), campo(b, "descripcionNueva")); break;
    case "borrarTarjeta": estado = App.borrarTarjeta(estado, num(b.dataset.cardid)); break;
    case "agregarComentario": if (campo(b, "contenidoComentario") === "") return; estado = App.agregarComentario(estado, num(b.dataset.cardid), campo(b, "contenidoComentario")); break;
    case "anadirEtiqueta": if (campo(b, "nombreEtiqueta") === "" || campo(b, "colorEtiqueta") === "") return; estado = App.anadirEtiqueta(estado, num(b.dataset.cardid), campo(b, "nombreEtiqueta"), campo(b, "colorEtiqueta")); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
