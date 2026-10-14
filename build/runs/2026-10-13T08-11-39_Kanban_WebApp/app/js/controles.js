// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "agregarTarjeta": if (campo(b, "contenido") === "") return; estado = App.agregarTarjeta(estado, campo(b, "contenido"), b.dataset.columnaid); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, b.dataset.tarjetaid, campo(b, "nuevaColumnaId")); break;
    case "agregarComentario": if (campo(b, "textoComentario") === "") return; estado = App.agregarComentario(estado, b.dataset.cardid, campo(b, "textoComentario")); break;
    case "agregarEtiqueta": if (campo(b, "etiquetaTexto") === "") return; estado = App.agregarEtiqueta(estado, b.dataset.cardid, campo(b, "etiquetaTexto")); break;
    case "editarTarjeta": if (campo(b, "nuevoContenido") === "") return; estado = App.editarTarjeta(estado, b.dataset.cardid, campo(b, "nuevoContenido")); break;
    case "borrarTarjeta": estado = App.borrarTarjeta(estado, b.dataset.tarjetaid, b.dataset.columnaid); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
