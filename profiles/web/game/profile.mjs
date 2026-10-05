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
  version: "0.1",
  describe: "Juego de una pantalla: niveles, teclado o clics, condición de victoria, reiniciar. Hereda de web/app; Validation prueba que se pueda jugar y que no se gane solo.",
  build: "web/game",
  borrowed: {
    from: "web/landing",
    what: ["motor del Specialist por componentes (vía web/app)"],
  },
  pending: [
    "Chequeos de reglas que hoy quedan SIN_CHEQUEO: de a un casillero, paredes que bloquean, cantidad de niveles, próximo nivel después de ganar.",
    "Las reglas del Specialist salen de un Sokoban: ver si sirven para otro juego (snake, memoria, tetris) antes de generalizar.",
  ],
  evidence: [
    "Project25 Boxworld build 3 (05/10): ganaba con el primer movimiento (comparaba los objetivos consigo mismos), reiniciar quedaba deshabilitado, cajas y avatar como casilleros extra de la grilla, y las restricciones (las reglas del juego) nunca llegaban al Specialist.",
  ],
};
