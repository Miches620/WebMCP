# Plan: cómo se va a construir

21 tareas en 5 fases, en el orden en que se van a hacer. Cada tarea dice qué pruebas de la planilla la verifican ("sin prueba" = preparación).

**Cobertura completa:** todo requisito tiene su fase y toda prueba tiene al menos una tarea.

## F1. Establecimiento de la estructura base de la hoja de cálculo
_Crear el esqueleto visual de la aplicación, incluyendo las 10 columnas (A a J) y 20 filas (1 a 20). Se debe dibujar la cuadrícula completa con los encabezados de letras arriba y los números al costado para que cada celda sea nombrada por su columna y fila (R2)._ · cubre: R2

- **F1.1** Establecer la estructura base del contenedor de la hoja de cálculo y su CSS.
  Crear el elemento principal (contenedor) que albergará toda la cuadrícula, aplicando los estilos CSS necesarios para definir un layout de tabla o grid que contenga las 20 filas y 10 columnas. Este paso sienta las bases visuales sin añadir contenido específico aún.
  sin prueba (preparación)
- **F1.2** Dibujar los encabezados de columna (A a J) en la primera fila. _(después de F1.1)_
  Generar y dibujar los 10 elementos de texto o contenedores que muestren las letras A, B, C... hasta J, ubicándolos en la parte superior de la cuadrícula para identificar cada columna.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)
- **F1.3** Dibujar los encabezados de fila (1 a 20) en la primera columna. _(después de F1.1)_
  Generar y dibujar los 20 elementos de texto o contenedores que muestren los números del 1 al 20, ubicándolos en el lateral izquierdo de la cuadrícula para identificar cada fila.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)
- **F1.4** Popular las 200 celdas internas de la cuadrícula (A1 a J20). _(después de F1.2, F1.3)_
  Generar y dibujar los 200 elementos de celda vacía que componen el cuerpo principal de la hoja de cálculo, asegurando que cada celda tenga las dimensiones correctas para completar el esqueleto visual.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)

## F2. Manejo de la entrada de datos y persistencia del estado
_Implementar la funcionalidad para que el usuario pueda editar celdas con un simple clic (R1, R10). Además, se debe asegurar que los datos ingresados en las celdas se guarden automáticamente en localStorage y que al recargar la página, los datos sigan visibles (R9, R17)._ · cubre: R1, R9, R10, R17

- **F2.1** Implementar la funcionalidad de edición en celdas individuales al hacer clic o enfocar. _(después de F1.4)_
  Añadir manejadores de eventos a las celdas (div/input) para que, al hacer clic o enfocar, se conviertan en un campo editable donde el usuario pueda escribir texto.
  verifican: R1.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió) · R10.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió)
- **F2.2** Implementar la persistencia de datos al modificar celdas (Guardado automático). _(después de F2.1, F1.4)_
  Añadir escuchadores de eventos 'input' o 'change' a todas las celdas editables para que, cada vez que el contenido cambie, el valor se guarde automáticamente en localStorage.
  verifican: R9.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió) · R17.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió)
- **F2.3** Implementar la carga de estado inicial desde localStorage al cargar la página. _(después de F1.4)_
  Al iniciar la aplicación, leer los valores guardados en localStorage para cada celda y poblar el contenido de las celdas correspondientes del DOM.
  verifican: R9.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió) · R17.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió)

## F3. Motor de cálculo y manejo de fórmulas complejas
_Desarrollar la lógica para interpretar fórmulas estilo Excel en castellano, que deben empezar con '='. Esto incluye implementar funciones como =SUMA(rango) o =SUMA(celdas sueltas), y manejar operaciones básicas de resta (=A1-B1), multiplicación (=A1*B1) y división (=A1/B1). Es crucial asegurar que si cambia una celda utilizada en la fórmula, el resultado se actualice automáticamente (R3, R4, R11, R12)._ · cubre: R3, R4, R11, R12

- **F3.1** Implementar el motor de parsing de fórmulas: Detectar si una celda contiene una fórmula (empieza con '=') y extraer la sintaxis interna. _(después de F2.1, F2.2)_
  Desarrollar la lógica JavaScript que, al detectar un contenido que comienza con '=', lo interprete como una fórmula. Esta tarea debe ser capaz de distinguir entre referencias a celdas (A1), operadores (+, -, *, /) y nombres de funciones (SUMA). El resultado es el objeto sintáctico interno listo para la evaluación.
  sin prueba (preparación)
- **F3.2** Implementar la lógica de cálculo para operaciones aritméticas básicas (+, -, *, /) y referencias directas a celdas. _(después de F3.1, F2.1, F2.2)_
  Desarrollar la función de evaluación que tome una fórmula simple (ej: =A1-B1) y calcule el resultado utilizando los valores actuales de las celdas referenciadas. Esta tarea debe manejar correctamente la resolución de referencias de celda a su valor numérico.
  verifican: R4.1 (Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "4" en B1. → A1 muestra "7") · R12.1 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1-B1" en C1. → C1 muestra "2") · R12.2 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1*B1" en D1. → D1 muestra "8") · R12.3 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1/B1" en E1. → E1 muestra "2")
- **F3.3** Implementar la función SUMA para manejar rangos de celdas (ej: A1:A3) y listas separadas por punto y coma (ej: A1;B1). _(después de F3.1, F2.2)_
  Desarrollar la lógica específica para interpretar y calcular la función =SUMA(). Debe ser capaz de procesar tanto rangos continuos (ej: A1:A3) como múltiples celdas sueltas separadas por punto y coma, sumando sus valores.
  verifican: R3.1 (Antes: escribo "2" en A1, "3" en A2, "4" en A3. Escribo "=SUMA(A1:A3)" en B4. → B4 muestra "9") · R11.1 (Antes: escribo "5" en A1, "3" en B1, "" en C1. Escribo "=SUMA(A1;B1)" en C1. → C1 muestra "8")
- **F3.4** Implementar el sistema de seguimiento de dependencias y la actualización automática del cálculo. _(después de F3.2, F3.3, F2.1, F2.2)_
  Crear un mecanismo que, cada vez que se calcula una fórmula (F3.2 o F3.3), registre todas las celdas de entrada utilizadas en el estado global. Cuando cualquier celda registrada cambie su valor (evento de edición/guardado), este sistema debe identificar y forzar la recalculación de todas las fórmulas dependientes.
  verifican: R4.1 (Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "4" en B1. → A1 muestra "7")

## F4. Controles de formato y manipulación estructural básica (Filas/Columnas)
_Implementar la capacidad de cambiar el color de fondo de una celda al hacer clic en ella (#FF0000) (R5). Además, se deben implementar los controles para seleccionar y manipular columnas o filas completas: borrar el contenido de todas sus celdas (R6.3/R7.3), cambiar el color de fondo de todas sus celdas (R6.2/R7.2), y la capacidad de borrar una columna completa (R13) o una fila completa (R15)._ · cubre: R5, R6, R7, R13, R15

- **F4.1** Implementar la funcionalidad de cambiar el color de fondo de una celda individual al hacer clic en ella. _(después de F1.4)_
  Añadir un manejador de eventos que, al hacer clic en cualquier celda (ej: A1), aplique el color de fondo #FF0000 a esa única celda.
  verifican: R5.1 (Antes: hago clic en A1. Elijo el color de fondo #FF0000. → A1 tiene fondo #FF0000)
- **F4.2** Implementar la funcionalidad para aplicar un color de fondo a todas las celdas de una columna seleccionada. _(después de F1.4)_
  Crear el control y la lógica que, al seleccionar una columna completa (ej: Columna A), aplique un color de fondo específico (#FF0000) a todas las celdas visibles de esa columna.
  verifican: R6.2 (Antes: hago clic en la columna A (en su letra). Elijo el color de fondo #FF0000. → A1 tiene fondo #FF0000 · A2 tiene fondo #FF0000)
- **F4.3** Implementar la funcionalidad para aplicar un color de fondo a todas las celdas de una fila seleccionada. _(después de F1.4)_
  Crear el control y la lógica que, al seleccionar una fila completa (ej: Fila 3), aplique un color de fondo específico (#FF0000) a todas las celdas visibles de esa fila.
  verifican: R7.2 (Antes: hago clic en la fila 3 (en su número). Elijo el color de fondo #FF0000. → A3 tiene fondo #FF0000 · B3 tiene fondo #FF0000)
- **F4.4.R2.1** Implementar la lógica para vaciar el contenido de una columna seleccionada.
  Implementar la funcionalidad que, al usar el control 'vaciar' en una columna, borre el contenido de todas las celdas de esa columna. Esta tarea se enfoca únicamente en el manejo del estado de los datos (data state) y no debe realizar ninguna manipulación estructural de columnas.
  verifican: R6.3 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de vaciar (borrar el contenido). → A1 queda vacía · A2 queda vacía) · R6.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2, un texto cualquiera en B1. Antes: hago clic en la columna A (en su letra). Uso el control de borrar. → lo que se escribió en A1 ya no se ve · lo que se escribió en A2 ya no se ve · A1 muestra lo que se escribió en B1 (ocupó su lugar))
- **F4.4.R2.2** Implementar la lógica de desplazamiento horizontal de datos subsiguientes. _(después de F4.4.R2.1)_
  Después de que el contenido de una columna ha sido vaciado (Tarea 0), esta tarea debe manipular estructuralmente los datos restantes para desplazar todas las columnas subsiguientes hacia la izquierda, llenando el vacío creado. Esta es una manipulación compleja del layout.
  verifican: R6.3 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de vaciar (borrar el contenido). → A1 queda vacía · A2 queda vacía) · R6.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2, un texto cualquiera en B1. Antes: hago clic en la columna A (en su letra). Uso el control de borrar. → lo que se escribió en A1 ya no se ve · lo que se escribió en A2 ya no se ve · A1 muestra lo que se escribió en B1 (ocupó su lugar))
- **F4.5** Implementar la lógica para vaciar el contenido de una fila y manejar el desplazamiento vertical de datos (R7.3, R7.1). _(después de F1.4)_
  Implementar la lógica que, al usar el control 'vaciar' en una fila seleccionada: 1) Borre el contenido de todas las celdas de esa fila; y 2) Desplace verticalmente (hacia arriba) los datos de todas las filas subsiguientes para llenar el vacío.
  verifican: R7.3 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de vaciar (borrar el contenido). → A3 queda vacía · B3 queda vacía) · R7.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3, un texto cualquiera en A4. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió en A3 ya no se ve · lo que se escribió en B3 ya no se ve · A3 muestra lo que se escribió en A4 (ocupó su lugar))
- **F4.6** Implementar la eliminación estructural completa de una columna y su manejo de desplazamiento horizontal (R13). _(después de F4.4.R2.1, F4.4.R2.2, F1.4)_
  Crear el control y la lógica que, al eliminar una columna: 1) Elimine estructuralmente la columna del DOM/estado; y 2) Desplace horizontalmente (hacia izquierda) los datos de todas las columnas subsiguientes para llenar el vacío.
  verifican: R13.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2, un texto cualquiera en C1. Antes: hago clic en la columna B (en su letra). Uso el control de borrar. → lo que se escribió en B1 ya no se ve · lo que se escribió en B2 ya no se ve · B1 muestra lo que se escribió en C1 (ocupó su lugar))
- **F4.7** Implementar la eliminación estructural completa de una fila y su manejo de desplazamiento vertical (R15). _(después de F4.5, F1.4)_
  Crear el control y la lógica que, al eliminar una fila: 1) Elimine estructuralmente la fila del DOM/estado; y 2) Desplace verticalmente (hacia arriba) los datos de todas las filas subsiguientes para llenar el vacío.
  verifican: R15.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3, un texto cualquiera en A4. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió en A3 ya no se ve · lo que se escribió en B3 ya no se ve · A3 muestra lo que se escribió en A4 (ocupó su lugar))

## F5. Gestión avanzada de visibilidad y estructura del tablero
_Implementar la funcionalidad para ocultar una columna (R14) o una fila (R16), lo que implica hacer desaparecer el contenido y la cabecera correspondiente. También se debe completar la gestión estructural con la capacidad de borrar una columna completa (R13) y borrar una fila completa (R15). Esta fase asegura que los datos restantes ocupen correctamente el lugar del elemento eliminado o ocultado, manteniendo la integridad visual y funcional del tablero._ · cubre: R8, R14, R16

- **F5.1** Implementar la funcionalidad para ocultar una columna completa (R14). Esto debe incluir hacer desaparecer el contenido de todas las celdas y la cabecera de la columna seleccionada, manteniendo la estructura visual del tablero intacta. _(después de F1.2, F1.3, F1.4)_
  Añadir el control y la lógica para manipular la visibilidad de una columna completa, asegurando que tanto los datos como el encabezado desaparezcan del DOM sin afectar a las columnas adyacentes.
  verifican: R8.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna A ya no se ve) · R14.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna B ya no se ve)
- **F5.2** Implementar la funcionalidad para ocultar una fila completa (R16). Esto debe incluir hacer desaparecer el contenido de todas las celdas y la cabecera de la fila seleccionada, manteniendo la estructura visual del tablero intacta. _(después de F1.2, F1.3, F1.4)_
  Añadir el control y la lógica para manipular la visibilidad de una fila completa, asegurando que tanto los datos como el encabezado desaparezcan del DOM sin afectar a las filas adyacentes.
  verifican: R8.2 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en B1. Antes: hago clic en la fila 1 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 1 ya no se ve) · R16.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 3 ya no se ve)

## Lo que TechLeader dejó para después
- Implementación de validaciones de datos o tipos específicos (ej. solo números en ciertas celdas).
- Funcionalidades avanzadas de formato condicional.
- Manejo de múltiples hojas de cálculo.

Si está bien, aprobalo con `npm run proyecto -- plan <carpeta> --aprobar`. Si no, decí qué tarea o prueba está mal.