// profiles/web/seguridad/profile.mjs — Validation profile POR TEMA: seguridad en la plataforma web (12/10).
//
// Decisión de Miche (12/10): la seguridad no vive en el profile de un tipo (web/app) porque cruza todos los
// tipos (landing, app, juego, la página de un NodeMCU). Los Validation profiles tienen DOS ejes:
//   tipo  (web → web/app → web/game): qué se valida según lo que se construye;
//   tema  (seguridad, más adelante accesibilidad, rendimiento…): criterios que valen para toda la plataforma.
// Un profile de tema se suma solo a todo proyecto de su plataforma (default: true). No asigna roles ni fases:
// eso sería un Specialist de seguridad, que se crea cuando un proyecto tenga trabajo de seguridad propio.
// Cuando un criterio falla, el arreglo es del que escribió el código (Skill de su Role), no de otro Specialist.
//
// Solo datos (lo carga también el navegador). Los chequeos corren en Node: ./validation.mjs.

export default {
  id: "web/seguridad",
  label: "Seguridad (web)",
  kind: "concern",
  platform: "web",
  default: true, // se suma a todo proyecto web
  status: "DRAFT",
  version: "0.1",
  criteria: [
    { id: "SEG-1", text: "Lo que escribe el usuario se muestra como texto: no se ejecuta como HTML ni como código (XSS)" },
  ],
  evidence: [
    "SEG-1: Kanban 7ª corrida (12/10): escribir <img src=x onerror=alert()> en 'Editar tarjeta' ejecutó código (dibujo.js usaba innerHTML con el texto del usuario). Ningún chequeo lo veía.",
  ],
};
