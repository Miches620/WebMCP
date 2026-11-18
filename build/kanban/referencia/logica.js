// logica.js de referencia (lo que tendría que lograr Gemma): las reglas del tablero del proyecto Kanban (2026-10-21, 38 pruebas).
function crear(estado, tarjeta) {
  if (!tarjeta.titulo) return "La tarjeta necesita un título";
  estado.tarjetas.push(tarjeta);
}
function editar(estado, id, datos) {
  const t = estado.tarjetas.find((x) => x.id === id);
  if (!t) return;
  if (datos.titulo) t.titulo = datos.titulo;
  t.campos = { ...t.campos, ...datos.campos };
}
function borrar(estado, id) {
  const t = estado.tarjetas.find((x) => x.id === id);
  if (t && t.columna === "Completa") return "No se puede eliminar una tarjeta completada";
  estado.tarjetas = estado.tarjetas.filter((x) => x.id !== id);
}
function mover(estado, id, columna) {
  const t = estado.tarjetas.find((x) => x.id === id);
  if (t) t.columna = columna;
}
const PESO = { alta: 0, media: 1, baja: 2 };
function ordenar(tarjetas, columna) {
  const p = (t) => PESO[String(t.campos.Prioridad || "").toLowerCase()] ?? 3;
  return tarjetas.slice().sort((a, b) => p(a) - p(b) || b.creada - a.creada);
}
function preguntaBorrar(tarjeta) {
  if (tarjeta.columna === "Completa") return null; // no se pregunta: borrar avisa que no se puede
  return "¿Está seguro de borrar la tarjeta?";
}
