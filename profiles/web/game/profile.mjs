// profiles/web/game/profile.mjs — TIPO "juego": un juego de una pantalla con
// niveles, teclado y condición de victoria (Boxworld). Hijo de web/app.
//
// v0.1 (05/10): hereda de web/app el plan de una pantalla, el estado + dibujar()
// y los chequeos de interacción; suma lo propio de un juego: niveles como datos
// (posiciones iniciales separadas de los objetivos), victoria calculada desde el
// estado, reiniciar desde los datos del nivel, un solo listener de teclado, y dos
// chequeos: not_won_immediately (también de base en el Specialist) y reset_restores.
// Todo sale de UN juego (Boxworld): es DRAFT hasta que otro juego lo confirme.

export default {
  id: "web/game",
  extends: "web/app",
  label: "Juego (una pantalla, niveles, teclado)",
  kind: "type",
  selectable: true,
  status: "DRAFT",
  version: "0.3",
  describe: "Juego de una pantalla escrito POR ARCHIVOS, un archivo por paso de Gemma. Cómo se arma (archivos, contrato, pruebas) lo declara el Standard (hoy web/game/grilla, DRAFT); el motor es general. Validation prueba que se pueda jugar y que no se gane solo.",
  build: "web/game",
  // v0.3 (06/10): el contrato, los pasos y las pruebas salieron del harness a un Standard DRAFT.
  standard: "web/game/grilla",
  borrowed: {
    from: "web/landing",
    what: ["motor del Specialist por componentes (vía web/app)"],
  },
  // v0.2 (06/10, decisión de Miche: "dejar de pedir html autocontenidos a modelos chicos"):
  // Specialist por archivos (specialist_files.mjs), contrato NIVELES/Reglas/dibujar, pruebas de
  // reglas en Node con niveles del harness, chequeos game_levels / moves_one_cell / fixed_map_size.
  pending: [
    "Validation profile web/game que LEA el Standard (hoy check_catalog nombra Reglas/NIVELES por su cuenta: moves_one_cell, game_levels, fixed_map_size).",
    "El estilo (R8 NES 8 bits) sigue sin chequeo y Gemma lo ignoró en b2–b7.",
    "Próximo nivel después de ganar (cambia el tablero) todavía sin chequeo.",
    "Las reglas del Specialist salen de un Sokoban: ver si sirven para otro juego (snake, memoria, tetris) antes de generalizar.",
  ],
  evidence: [
    "Project25 Boxworld b2–b7 (05/10): con todo el juego en una respuesta (~7k tokens) cada build trajo 1–2 bugs y los reintentos completos se cortaron por length (3 de 3); b7 jugable recién con reparación de sintaxis.",
    "Project25 Boxworld build 3 (05/10): ganaba con el primer movimiento (comparaba los objetivos consigo mismos), reiniciar quedaba deshabilitado, cajas y avatar como casilleros extra de la grilla, y las restricciones (las reglas del juego) nunca llegaban al Specialist.",
  ],
};
