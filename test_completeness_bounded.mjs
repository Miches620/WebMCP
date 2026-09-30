// test_completeness_bounded.mjs — mismo caso "recetas" de siempre, con el
// reviewer de schema acotado (completeness_reviewer3.mjs / v0.5-bounded).
// Prompt y atomicTasks IDÉNTICOS a test_completeness_artificial_2.mjs, para
// que la única variable que cambia sea el schema del reviewer.
import { runCompletenessReview } from "./completeness_reviewer3.mjs";

const prompt = `
Construir un prototipo web de una app de recetas de cocina.

El prototipo debe permitir:

1. Mostrar un listado de recetas.
2. Ver el detalle de una receta, incluyendo ingredientes y pasos de preparación.
3. Guardar recetas como favoritas.
4. Filtrar recetas por tipo de comida (desayuno, almuerzo, cena, postre).
5. Permitir al usuario dejar una valoración (rating) de 1 a 5 estrellas por receta.

Restricciones:
- Es un Prototype.
- No requiere backend real: los datos pueden vivir en memoria o mockeados en el frontend.
- No requiere autenticación de usuarios.
- No se pide en esta etapa ningún sistema de comentarios ni de compartir en redes sociales.
`;

const atomicTasks = [
  { id: "F1.1", phase: 1, role: "Frontend", task: "Crear la estructura base de la aplicación.", depends_on: [] },
  { id: "F1.2", phase: 1, role: "Frontend", task: "Mostrar un listado de recetas con datos mockeados.", depends_on: ["F1.1"] },
  { id: "F1.3", phase: 1, role: "Frontend", task: "Implementar vista de detalle con ingredientes y pasos de preparación.", depends_on: ["F1.2"] },
  { id: "F1.4", phase: 1, role: "Frontend", task: "Implementar función de marcar y desmarcar una receta como favorita usando estado local del navegador.", depends_on: ["F1.2"] },
  { id: "F1.5", phase: 1, role: "Frontend", task: "Implementar filtro de recetas por tipo de comida.", depends_on: ["F1.2"] },
  { id: "F1.6", phase: 1, role: "Frontend", task: "Implementar sistema de comentarios con moderación y reporte de spam en cada receta.", depends_on: ["F1.3"] },
  { id: "F1.7", phase: 1, role: "Frontend", task: "Integrar inicio de sesión con Google y Facebook.", depends_on: ["F1.1"] },
  { id: "F1.8", phase: 1, role: "DevOps", task: "Configurar pipeline de CI/CD con despliegue automático a AWS.", depends_on: ["F1.1"] },
];

const result = await runCompletenessReview(prompt, atomicTasks);
console.log("\n========== RESULTADO ==========\n");
console.log(JSON.stringify(result, null, 2));
console.log("\n========== FIN ==========\n");
