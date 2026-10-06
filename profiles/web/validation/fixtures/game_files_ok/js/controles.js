let nivelActual = 0; let estado;
function iniciarNivel(i) { nivelActual = i; estado = Reglas.crearEstado(NIVELES[i]); document.getElementById("mensaje").textContent = ""; dibujar(estado, i + 1); }
const DIRS = { ArrowUp: "arriba", ArrowDown: "abajo", ArrowLeft: "izquierda", ArrowRight: "derecha" };
document.addEventListener("keydown", (e) => {
  const d = DIRS[e.key]; if (!d) return; e.preventDefault();
  if (Reglas.ganado(estado)) return;
  estado = Reglas.mover(estado, d); dibujar(estado, nivelActual + 1);
  if (Reglas.ganado(estado)) document.getElementById("mensaje").textContent = "¡Nivel completado!";
});
document.getElementById("btn-reiniciar").addEventListener("click", () => iniciarNivel(nivelActual));
document.getElementById("btn-siguiente").addEventListener("click", () => { if (nivelActual + 1 < NIVELES.length) iniciarNivel(nivelActual + 1); });
iniciarNivel(0);
