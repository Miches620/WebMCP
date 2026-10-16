// js/controles.js — lo escribe el harness a partir del contrato (Standard web/app/estado). No lo escribe el modelo.
let estado = App.crear();
// el valor del campo data-campo="<param>" que está al lado del botón (en su mismo elemento padre)
function campo(b, p) { var f = b.parentElement && b.parentElement.querySelector('[data-campo="' + p + '"]'); return f ? f.value : undefined; }
function num(v) { return v === undefined || v === "" ? undefined : Number(v); }
document.getElementById("app").addEventListener("click", function (ev) {
  var b = ev.target.closest("[data-accion]");
  if (!b) return;
  switch (b.dataset.accion) {
    case "mostrarCrearTarjeta": estado = App.mostrarCrearTarjeta(estado); break;
    case "cerrarModal": estado = App.cerrarModal(estado); break;
    case "crearTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "" || campo(b, "prioridad") === "") return; estado = App.crearTarjeta(estado, campo(b, "titulo"), campo(b, "descripcion"), campo(b, "prioridad")); break;
    case "editarTarjeta": if (campo(b, "titulo") === "" || campo(b, "descripcion") === "" || campo(b, "prioridad") === "") return; estado = App.editarTarjeta(estado, num(b.dataset.id), campo(b, "titulo"), campo(b, "descripcion"), campo(b, "prioridad")); break;
    case "eliminarTarjeta": estado = App.eliminarTarjeta(estado, num(b.dataset.id), b.dataset.columna); break;
    case "moverTarjeta": estado = App.moverTarjeta(estado, num(b.dataset.id), b.dataset.origencolumna, campo(b, "destinoColumna")); break;
    default: return;
  }
  dibujar(estado);
});
dibujar(estado);
