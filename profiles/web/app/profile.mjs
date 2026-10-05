// profiles/web/app/profile.mjs — TIPO "app": una aplicación interactiva de UNA
// pantalla (Kanban, tracker, herramienta…). Base de web/game.
//
// v0.1 (05/10, decisión de Miche + Claude: web/game es hijo de web/app):
// plan de una pantalla (un componente principal, sin header/footer), reglas del
// Specialist para apps con estado, traductor sin secciones/hero/carrusel y
// chequeos de interacción (key_changes, click_changes, counter_on_action).
// Solo datos (lo carga también el navegador). El build vive en ./build.mjs.

export default {
  id: "web/app",
  extends: "web",
  label: "App interactiva (una pantalla)",
  kind: "type",
  selectable: true,
  status: "DRAFT",
  version: "0.1",
  describe: "Aplicación de una pantalla con estado y acciones (crear, editar, borrar, arrastrar). Un componente principal, sin header ni footer; Validation prueba interacciones.",
  build: "web/app",
  borrowed: {
    from: "web/landing",
    what: ["motor del Specialist por componentes (encapsulado, chequeos por paso, reintento) con un plan de un solo componente"],
  },
  pending: [
    "Chequeos de flujo de datos: crear → +1, arrastrar → cambia de columna, editar → el valor queda, borrar → −1. Casos: bugs del Kanban v1 (editar borra etiquetas, [object HTMLDivElement], modal sin scroll, doble confirm, título no editable, + Añadir Columna muerto).",
    "Una pantalla grande en un solo paso de Gemma: con 25 tareas el componente usó ~7k tokens; si se corta, partir en pasos (estado → dibujo → acciones).",
    "Correr el Kanban (Project23/24) con este profile: hasta ahora solo hay evidencia de juego.",
  ],
  evidence: [
    "Project23 (Kanban, 03/10): claude/evidencia_project23_2026-10-03.md — 1 sección con 8 de 9 features, 30 min y 7981/8000 tokens.",
    "Project25 Boxworld build 3 (05/10): el page plan de landing partió el juego en dos secciones y el traductor usó numbers_animate para un contador de movimientos.",
  ],
};
