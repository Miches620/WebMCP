// specialist_rules.mjs — web/game: reglas de app + las de un juego.
// Cada regla viene de un bug de Boxworld build 3 (05/10).

import { APP_SPECIALIST_RULES } from "../app/specialist_rules.mjs";

export const GAME_SPECIALIST_RULES = `${APP_SPECIALIST_RULES}

ESTE PROYECTO ES UN JUEGO:
G1. estado = { nivel, posiciones de cada cosa que se mueve (jugador, cajas…), movimientos, fase: "jugando" | "ganado" }.
G2. Los niveles son DATOS (un array). Si el juego es de grilla, escribí cada nivel como un array de strings, una fila por string, con el formato clásico de Sokoban: # pared, espacio piso, . objetivo, $ caja, * caja sobre objetivo, @ jugador, + jugador sobre objetivo. Una función cargarNivel() lo convierte a posiciones (las iniciales y los objetivos POR SEPARADO). Nunca uses la lista de objetivos como posición actual. Al empezar un nivel, al menos una caja NO está sobre un objetivo.
G3. Ganar = TODOS los objetivos ocupados por cajas (cada nivel tiene tantas cajas como objetivos, y todas las filas del mismo largo). Se calcula con la posición ACTUAL de cada caja. Con el nivel recién cargado no se puede estar ganando, y con un solo movimiento tampoco.
G4. Reiniciar = volver a cargar el nivel desde sus datos (copia profunda). El botón reiniciar está habilitado siempre mientras se juega.
G5. Teclado: UN solo listener keydown en document, preventDefault en las flechas, cada tecla mueve un paso y DESPUÉS llama a dibujar() (si no, cambia el estado pero el tablero queda igual).
G6. Grilla: dibujar() vacía la grilla y la arma entera desde el estado: crea un elemento por casillero con sus clases (pared, piso, caja, objetivo, jugador) y lo AGREGA a la grilla (appendChild). No muevas piezas con transform ni las agregues como hijos extra de la grilla.`;
