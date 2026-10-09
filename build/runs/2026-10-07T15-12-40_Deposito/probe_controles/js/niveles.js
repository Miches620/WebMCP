// js/niveles.js — lo escribe el harness a partir de los niveles que propuso el Specialist
// (coordenadas → strings Sokoban: # pared, espacio piso, . objetivo, $ caja, * caja sobre
// objetivo, @ jugador, + jugador sobre objetivo). Cada nivel fue verificado con un solver.
const NIVELES = [
  // Nivel 1 — resoluble (el solver lo ganó con 2 empujes)
  [
    "########",
    "#      #",
    "#      #",
    "# @ $. #",
    "#   $. #",
    "#      #",
    "#      #",
    "########"
  ],
  // Nivel 2 — resoluble (el solver lo ganó con 2 empujes)
  [
    "########",
    "#      #",
    "# @    #",
    "# $  $ #",
    "# .  . #",
    "#      #",
    "#      #",
    "########"
  ],
  // Nivel 3 — resoluble (el solver lo ganó con 3 empujes)
  [
    "########",
    "##    ##",
    "#   @  #",
    "#   $  #",
    "#   .  #",
    "# $  $ #",
    "##.  .##",
    "########"
  ],
  // Nivel 4 — resoluble (el solver lo ganó con 4 empujes)
  [
    "########",
    "#   ## #",
    "#  .$  #",
    "#  $ . #",
    "#@   $.#",
    "#      #",
    "#      #",
    "########"
  ]
];
