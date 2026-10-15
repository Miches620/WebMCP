// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "crearTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "") return; estado = App.crearTarjeta(estado, campo(b, "titulo"), campo(b, "descripcion")); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, b.dataset.cardid, campo(b, "nuevaColumnaId")); break;
    case "agregarComentario": if (campo(b, "contenido") === "" || campo(b, "autor") === "") return; estado = App.agregarComentario(estado, b.dataset.cardid, campo(b, "contenido"), campo(b, "autor")); break;
    case "editarTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "" || campo(b, "contenidoAdicional") === "") return; estado = App.editarTarjeta(estado, b.dataset.cardid, campo(b, "titulo"), campo(b, "descripcion"), campo(b, "contenidoAdicional")); break;
    case "eliminarTarjeta": estado = App.eliminarTarjeta(estado, b.dataset.cardid); break;
    case "agregarEtiqueta": if (campo(b, "nombreEtiqueta") === "" || campo(b, "colorHex") === "") return; estado = App.agregarEtiqueta(estado, b.dataset.cardid, campo(b, "nombreEtiqueta"), campo(b, "colorHex")); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
