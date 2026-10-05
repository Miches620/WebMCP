// profiles/web/app/profile.mjs — TIPO "app": una aplicación interactiva de una
// pantalla (Kanban, tracker, juego simple…).
//
// DRAFT VACÍO A PROPÓSITO (refactor 05/10, decisión de Miche: mover sin cambiar
// conducta). Hoy NO tiene build propio: usa el de web/landing, que es lo que
// webmcp ya hacía con cualquier proyecto. `borrowed` lo deja a la vista para
// que nadie confunda "funciona" con "está diseñado para apps".

export default {
  id: "web/app",
  extends: "web",
  label: "App interactiva (DRAFT, usa el build de landing)",
  kind: "type",
  selectable: true,
  status: "DRAFT",
  version: "0.0",
  describe: "Aplicación de una pantalla con estado y acciones (crear, editar, borrar, arrastrar). Todavía usa el build de landing.",
  build: "web/landing",
  borrowed: {
    from: "web/landing",
    what: ["page plan (header/secciones/footer)", "Specialist por componentes", "reglas del traductor (secciones, hero, carrusel)", "catálogo de chequeos"],
  },
  // Lo que falta, con la evidencia que lo pide (pendientes 4 y 5 de webmcp).
  pending: [
    "Plan de componentes de app (tablero, columna, tarjeta, modal) en vez de secciones: Project23 armó 1 sección con 8 de 9 features, 30 min y 7981/8000 tokens.",
    "Chequeos de flujo: crear → +1, arrastrar → cambia de columna, editar → el valor queda, borrar → −1. Casos: bugs del Kanban v1 (editar borra etiquetas, [object HTMLDivElement], modal sin scroll, doble confirm, título no editable, + Añadir Columna muerto).",
    "Reglas del traductor propias (sin hero/footer/carrusel) y catálogo acotado.",
    "Juegos (Project25 Boxworld): ¿web/app o un tipo web/game? Decidir con la primera corrida.",
  ],
  evidence: [
    "Project23 (Kanban, 03/10): claude/evidencia_project23_2026-10-03.md.",
  ],
};
