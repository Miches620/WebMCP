// standards/web/app/estado/recipe.mjs — RECETA del Standard para el Atomizer.
//
// Punto 9 (14/10, decisión de Miche): antes el Atomizer partía las fases sin
// consultar ningún Standard; las tareas salían con "o" (dos caminos), trabajo que
// hace el harness (cablear botones, formularios) y campos vagos ("metadata").
// La receta le dice al Atomizer EN QUÉ PIEZAS se construye este tipo de proyecto,
// para que cada Atomic Task caiga en una pieza que el Specialist sabe ejecutar.
//
// Solo datos (la cargan el navegador vía el profile web/app y Node). Cada regla
// sale del Standard web/app/estado (standard.mjs); si el Standard cambia, esto
// cambia con él. NO agrega prohibiciones propias: arrastrar está permitido
// (14/10, Miche: "una cosa es que yo lo vete, otra que el Standard lo prohíba").

export const PIEZAS = Object.freeze({
  datos: "estado inicial (qué cosas hay, qué campos tienen, 2 o 3 ejemplos) y la lista de acciones del usuario (nombre, qué recibe, qué cambia). Sin código.",
  logica: "UNA acción como función pura: recibe el estado y sus datos, devuelve el estado nuevo. Sin pantalla.",
  vista: "cómo se ve el estado: qué elementos hay y qué texto o dato muestra cada uno.",
  estilo: "colores, tamaños, espacios, efectos al pasar el mouse.",
});

// De qué paso del Standard sale cada pieza (para el Specialist, más adelante).
export const PIEZA_STEPS = Object.freeze({
  datos: ["contrato"],
  logica: ["logica"],
  vista: ["pantalla", "dibujo"],
  estilo: ["pantalla"],
});

const REGLAS = [
  "Cada acción del usuario es su propia tarea \"logica\": crear, editar, borrar y mover van separadas.",
  "Los botones y campos de cada acción los agrega el harness solo, en el elemento que cambia: no hagas tareas de cablear botones, eventos o formularios.",
  "Arrastrar puede sumarse; toda acción también se puede hacer con un botón en el elemento que cambia.",
  "Lo que el usuario escribe es un texto o un número por dato; una lista se agrega de a un elemento.",
  "Nombrá los campos concretos (por ejemplo \"título y descripción\"), nunca \"metadata\" ni \"información\".",
  "No dejes decisiones abiertas: nada de \"X o Y\" ni \"etc.\"; si dudás, elegí la más simple.",
];

const BASE = {
  standard: "web/app/estado",
  version: "0.1",
  status: "DRAFT",
  piezas: PIEZAS,
  reglas: Object.freeze(REGLAS),
};

/** Texto que se suma al prompt del Atomizer (≈350 tokens). */
export function recipeText(r = BASE) {
  const piezas = Object.entries(r.piezas).map(([k, v]) => `- "${k}": ${v}`).join("\n");
  const reglas = r.reglas.map((x) => `- ${x}`).join("\n");
  return `RECETA DEL STANDARD ${r.standard} (cómo se construye este tipo de proyecto):

Cada Atomic Task pertenece a UNA de estas piezas y la indica en "pieza":
${piezas}

REGLAS DE LA RECETA:
${reglas}
`;
}

// El Atomizer (core) solo lee recipe.piezas y recipe.text: no sabe de qué Standard es.
export const recipe = Object.freeze({ ...BASE, text: recipeText(BASE) });

export default recipe;
