// profiles/web/app/profile.mjs — TIPO "app": una aplicación interactiva de UNA
// pantalla (Kanban, tracker, herramienta…). Base de web/game.
//
// v0.1 (05/10, decisión de Miche + Claude: web/game es hijo de web/app):
// plan de una pantalla (un componente principal, sin header/footer), reglas del
// Specialist para apps con estado, traductor sin secciones/hero/carrusel y
// chequeos de interacción (key_changes, click_changes, counter_on_action).
// Solo datos (lo carga también el navegador). El build vive en ./build.mjs.
// 14/10 (punto 9): la receta del Standard viaja con el profile hasta el Atomizer.

import recipe from "../../../standards/web/app/estado/recipe.mjs";

export default {
  id: "web/app",
  extends: "web",
  label: "App interactiva (una pantalla)",
  kind: "type",
  selectable: true,
  status: "DRAFT",
  version: "0.2",
  describe: "Aplicación de una pantalla con estado y acciones (crear, editar, borrar, arrastrar), escrita POR ARCHIVOS: el contrato (estado + acciones) lo propone Gemma como datos y el harness lo valida (Standard web/app/estado, DRAFT). Validation prueba interacciones.",
  build: "web/app",
  // v0.2 (12/10, paso 2 del borde): por archivos con su propio Standard (DRAFT). --legacy-components = motor de landing.
  standard: "web/app/estado",
  // Receta del Standard para el Atomizer (piezas datos/logica/vista/estilo). Va con el Standard, no se hereda sola.
  atomizerRecipe: recipe,
  borrowed: {
    from: "web/landing",
    what: ["plan de una pantalla y traductor de requisitos; el motor por componentes queda solo con --legacy-components"],
  },
  pending: [
    "Chequeos de flujo de datos: crear → +1, arrastrar → cambia de columna, editar → el valor queda, borrar → −1. Casos: bugs del Kanban v1 (editar borra etiquetas, [object HTMLDivElement], modal sin scroll, doble confirm, título no editable, + Añadir Columna muerto).",
    "Correr el Kanban (Project23/24) con este profile: hasta ahora solo hay evidencia de juego.",
  ],
  evidence: [
    "Project23 (Kanban, 03/10): claude/evidencia_project23_2026-10-03.md — 1 sección con 8 de 9 features, 30 min y 7981/8000 tokens.",
    "Project25 Boxworld build 3 (05/10): el page plan de landing partió el juego en dos secciones y el traductor usó numbers_animate para un contador de movimientos.",
  ],
};
