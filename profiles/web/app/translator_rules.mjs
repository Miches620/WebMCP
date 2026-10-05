// translator_rules.mjs — lo que el traductor de chequeos necesita saber de una APP
// de una pantalla (profile web/app). web/game suma lo suyo encima (game/translator_rules.mjs).
//
// Sin secciones, hero, footer ni carrusel: en una app lo que se verifica es lo que
// el usuario puede HACER. Evidencia: Boxworld build 3 con las reglas de landing —
// el contador de movimientos se tradujo a numbers_animate ("cambian solos"), las
// flechas quedaron SIN_CHEQUEO y "próximo nivel" pasó con el link "🗺️ Niveles".

export const APP_CATALOG = [
  "no_js_errors", "text_visible", "control_visible", "field_exists", "field_required", "field_optional",
  "submit_empty_blocked", "valid_submit_passes", "no_horizontal_scroll", "hover_changes",
  "key_changes", "click_changes", "counter_on_action", "click_reveals",
];

export const APP_RULE = `Es una APP de UNA pantalla (no hay secciones, hero, menú ni pie de página). Verificá lo que el usuario puede HACER:
   - "Botón para X" / "permitir X" → control_visible con 2 a 3 palabras del botón. Si además dice qué cambia al tocarlo y no nombra un texto que aparece → click_changes.
   - "Se maneja / se mueve con el teclado / las flechas / una tecla" → key_changes con keys = ["flechas"] (o la tecla que nombre: "espacio", "enter", una letra).
   - "Contador / puntaje / cantidad de X que cambia al usar la app" → counter_on_action con label = cómo se llama ese número en la pantalla (ej. ["movimientos", "pasos"]). NUNCA numbers_animate: eso es para contadores que se animan solos.
   - "Responsive" → no_horizontal_scroll. Estilo visual, "clásico", "código limpio", tamaños o cantidades internas → "checks": [] y explicalo en "sin_chequeo".
   En control_visible no uses palabras que aparecen en toda la pantalla (ej. "nivel", "juego", "app"): elegí las que solo tendría ESE botón.`;

export const APP_TRANSLATOR = { catalog: APP_CATALOG, rules: [APP_RULE] };
