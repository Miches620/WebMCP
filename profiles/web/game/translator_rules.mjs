// translator_rules.mjs — web/game: reglas de app + las de un juego.

import { APP_CATALOG, APP_RULE } from "../app/translator_rules.mjs";

export const GAME_RULE = `Es un JUEGO de una pantalla:
   - "Acomodar / llegar a / completar el nivel / ganar / objetivo del nivel" → not_won_immediately (un solo movimiento no puede ganar).
   - "Botón reiniciar / volver a empezar" → control_visible con ["reiniciar"] y reset_restores con click = ["reiniciar"].
   - "Botón próximo / siguiente nivel" → control_visible con ["proximo", "siguiente"] (NUNCA "nivel" solo: está en toda la pantalla).
   - "De a un casillero", "cantidad de niveles", "tamaño del mapa", "clásico X" → todavía no se pueden medir con el catálogo: "checks": [] y explicalo en "sin_chequeo".`;

export const GAME_TRANSLATOR = {
  catalog: [...APP_CATALOG, "not_won_immediately", "reset_restores"],
  rules: [APP_RULE, GAME_RULE],
};
