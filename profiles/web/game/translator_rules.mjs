// translator_rules.mjs — web/game: reglas de app + las de un juego.

import { APP_CATALOG, APP_RULE } from "../app/translator_rules.mjs";

export const GAME_RULE = `Es un JUEGO de una pantalla:
   - "El avatar / jugador / la pieza se mueve con las flechas o el teclado" → board_changes con keys = ["flechas"] (NO key_changes: un contador o un mensaje también cambian con una tecla, y eso no prueba que la pieza se mueva).
   - "Acomodar / llegar a / completar el nivel / ganar / objetivo del nivel" → not_won_immediately (un solo movimiento no puede ganar).
   - "Botón reiniciar / volver a empezar" → control_visible con ["reiniciar"] y reset_restores con click = ["reiniciar"].
   - "Botón próximo / siguiente nivel", "avanzar de nivel" → control_visible con ["proximo", "siguiente"] (NUNCA "nivel" solo: está en toda la pantalla) y game_scenario (juega: ganar un nivel, pasar al siguiente y seguir jugando).
   - click_changes solo con palabras de un BOTÓN que el requisito nombra; nunca con "avatar", "caja", "jugador" o "nivel" (no son botones).
   - "Al menos N niveles" → game_levels con min = ["N"]. "Se mueve de a un casillero" → moves_one_cell. "El tamaño del mapa es fijo" → fixed_map_size.
   - "Clásico X", estilo visual → no se pueden medir con el catálogo: "checks": [] y explicalo en "sin_chequeo".`;

export const GAME_TRANSLATOR = {
  catalog: [...APP_CATALOG, "board_changes", "not_won_immediately", "reset_restores", "game_levels", "moves_one_cell", "fixed_map_size", "game_scenario"],
  rules: [APP_RULE, GAME_RULE],
};
