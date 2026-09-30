// test_completeness_bounded_2.mjs — mismo caso "instrumentos" de siempre,
// con el reviewer de schema acotado. Prompt y atomicTasks IDÉNTICOS a
// test_completeness_artificial.mjs.
import { runCompletenessReview } from "./completeness_reviewer3.mjs";

const prompt = `
Construir un prototipo web de una tienda de instrumentos musicales.

El prototipo debe permitir:

1. Mostrar un catálogo de instrumentos musicales.
2. Buscar instrumentos por nombre.
3. Filtrar instrumentos por categoría.
4. Ver el detalle de un instrumento.
5. Agregar instrumentos al carrito.
6. Ver el carrito con los productos agregados.
7. Modificar la cantidad de productos del carrito.
8. Mostrar el precio total del carrito.

Restricciones:
- Es un Prototype.
- No requiere autenticación.
- No requiere persistencia de datos.
- No requiere pagos reales.
- Los datos pueden ser ficticios.
`;

const atomicTasks = [
  { id: "F1.1", phase: 1, role: "Frontend", task: "Crear la estructura base de la aplicación web.", depends_on: [] },
  { id: "F1.2", phase: 1, role: "Frontend", task: "Mostrar un catálogo de instrumentos musicales.", depends_on: ["F1.1"] },
  { id: "F1.3", phase: 1, role: "Frontend", task: "Implementar búsqueda de instrumentos por nombre.", depends_on: ["F1.2"] },
  { id: "F1.4", phase: 1, role: "Frontend", task: "Crear un sistema de autenticación con login, registro y recuperación de contraseña.", depends_on: ["F1.1"] },
  { id: "F1.5", phase: 1, role: "Frontend", task: "Configurar un clúster Kubernetes multi-región para desplegar la aplicación.", depends_on: ["F1.1"] },
  { id: "F1.6", phase: 1, role: "Frontend", task: "Crear una página de inicio con información de contacto de la empresa.", depends_on: ["F1.1"] },
];

const result = await runCompletenessReview(prompt, atomicTasks);
console.log("\n========== RESULTADO ==========\n");
console.log(JSON.stringify(result, null, 2));
console.log("\n========== FIN ==========\n");
