// translator_rules.mjs — lo que el traductor de chequeos necesita saber de una LANDING.
//
// Extraído de check_translator.mjs (refactor de profiles, 05/10), texto sin cambios:
// las reglas 5 y 6 hablan de secciones, hero, footer, estadísticas, carrusel…
// Antes las recibía TODO requisito de TODO proyecto (~540 tokens), también un Kanban.

export const LANDING_TRANSLATOR = {
  // Tipos del catálogo web que el traductor puede elegir en una landing (orden del catálogo).
  catalog: [
    "no_js_errors", "text_visible", "control_visible", "field_exists", "field_required", "field_optional",
    "submit_empty_blocked", "valid_submit_passes", "section_content", "section_items", "carousel",
    "section_control", "no_horizontal_scroll", "hover_changes", "nav_scroll", "reveal_on_scroll",
    "entrance_animation", "numbers_animate", "click_reveals",
  ],
  rules: [
    `La página ya trae un título y un link del menú por cada sección, así que text_visible con el nombre de la sección NO demuestra nada. Verificá el CONTENIDO:
   - "Sección X con historia / descripción / información" → section_content con section = nombre de X.
   - "Catálogo / lista / carta / menú de productos", "productos disponibles", "en tarjetas" → section_items con section = nombre de la sección.
   - "en carrusel / carrousel / slider" → carousel con section = nombre de la sección.
   En section ponés 2 a 4 palabras con las que se llamaría la sección (ej. ["carta", "menu"], ["catalogo", "cafes"]).`,
    `Requisitos de cualidad o interacción (catálogo v0.4):
   - "Hero / portada con título, subtítulo y botón" → section_content y section_control de esa sección. "animación de entrada" → entrance_animation de esa sección.
   - "Pie de página / footer completo" → section_content con section = ["pie", "footer"].
   - "Barra de navegación / menú fijo", "scroll suave a cada sección" → nav_scroll.
   - "Responsive", "escritorio y móvil" → no_horizontal_scroll.
   - "Efectos hover en botones y tarjetas" → hover_changes con elementos = ["boton", "tarjeta"] (solo los que nombre).
   - "Animaciones al hacer scroll", "elementos que aparecen" → reveal_on_scroll.
   - "Estadísticas / contadores animados" → numbers_animate de esa sección (además de section_items si pide varias).
   - "Visualmente atractivo", "diseño moderno", "código limpio/comentado" no se pueden medir ejecutando la página: devolvé "checks": [] y explicalo en "sin_chequeo".
   Nunca uses como texto a buscar las palabras que describen la pieza ("título", "subtítulo", "botón", "llamada a la acción", "pie", "footer", "sección"): nadie las escribe en la página.`,
  ],
};
