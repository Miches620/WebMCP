// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "crearTarjeta": if (campo(b, "titulo") === "" || campo(b, "contenido") === "") return; estado = App.crearTarjeta(estado, b.dataset.columnid, campo(b, "titulo"), campo(b, "contenido")); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, b.dataset.cardid, b.dataset.sourcecolumnid, b.dataset.targetcolumnid); break;
    case "agregarComentario": if (campo(b, "texto") === "") return; estado = App.agregarComentario(estado, b.dataset.cardid, campo(b, "texto")); break;
    case "agregarEtiqueta": estado = App.agregarEtiqueta(estado, b.dataset.cardid, b.dataset.labelid); break;
    case "editarTarjeta": if (campo(b, "titulo") === "" || campo(b, "contenido") === "") return; estado = App.editarTarjeta(estado, b.dataset.cardid, campo(b, "titulo"), campo(b, "contenido")); break;
    case "borrarTarjeta": estado = App.borrarTarjeta(estado, b.dataset.cardid, b.dataset.columnid); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
