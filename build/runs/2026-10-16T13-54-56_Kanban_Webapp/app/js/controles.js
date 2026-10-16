// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "crearTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "" || campo(b, "prioridad") === "") return; estado = App.crearTarjeta(estado, campo(b, "titulo"), campo(b, "descripcion"), campo(b, "prioridad"), b.dataset.columnaorigenid); break;
    case "editarTarjeta": if (campo(b, "nuevoTitulo") === "" || campo(b, "nuevaDescripcion") === "" || campo(b, "nuevaPrioridad") === "") return; estado = App.editarTarjeta(estado, num(b.dataset.id), campo(b, "nuevoTitulo"), campo(b, "nuevaDescripcion"), campo(b, "nuevaPrioridad")); break;
    case "borrarTarjeta": estado = App.borrarTarjeta(estado, num(b.dataset.id), b.dataset.columnaid); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, num(b.dataset.cardid), b.dataset.origencolumnaid, campo(b, "destinoColumnaId")); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
