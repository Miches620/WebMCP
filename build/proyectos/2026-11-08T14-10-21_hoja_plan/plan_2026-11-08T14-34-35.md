# Plan: cómo se va a construir

23 tareas en 5 fases, en el orden en que se van a hacer. Cada tarea dice qué pruebas de la planilla la verifican ("sin prueba" = preparación).

**Cobertura completa:** todo requisito tiene su fase y toda prueba tiene al menos una tarea.

## F1. Creación de la estructura base de la hoja de cálculo
_Implementar el esqueleto visual de la aplicación. Esto incluye dibujar las 20 filas y 10 columnas (A a J) con sus respectivas etiquetas en los bordes, asegurando que cada celda esté correctamente nombrada por su columna y su fila (ej: A1, B2)._ · cubre: R2

- **F1.1** Crear y posicionar las etiquetas de columna (A a J) en la cabecera superior.
  Implementar el código para dibujar una fila de 10 elementos etiquetados secuencialmente desde 'A' hasta 'J', ubicándolos en la parte superior del área de trabajo, sirviendo como encabezado de las columnas.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)
- **F1.2** Crear y posicionar las etiquetas de fila (1 a 20) en el lateral izquierdo.
  Implementar el código para dibujar una columna vertical de 20 elementos etiquetados secuencialmente desde '1' hasta '20', ubicándolos en la parte izquierda del área de trabajo, sirviendo como encabezado de las filas.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)
- **F1.3** Generar y poblar el esqueleto principal de celdas (20x10) con nomenclatura correcta.
  Crear la matriz contenedora para las 20 filas y 10 columnas. Debe generar 200 elementos de celda individuales, asegurando que cada celda esté correctamente identificada (ej: A1, B5, J20) mediante su estructura DOM o atributos internos.
  verifican: R2.1 (→ se ven las letras A a J arriba, en una fila, cada una justo encima de su columna de celdas, y los números 1 a 20 a la izquierda, uno debajo del otro, cada uno al lado de su fila de celdas)

## F2. Manejo de datos básicos e interacción con celdas
_Permitir la edición de contenido en las celdas, ya sea mediante un clic para escribir directamente (editar celdas inline) o al hacer click en una celda. Además, se debe implementar el guardado automático del estado completo de la hoja en localStorage para que los datos persistan tras recargar la página._ · cubre: R1, R9, R10, R17

- **F2.1** Implementar la funcionalidad de edición inline en celdas al hacer click o enfocar. _(después de F1.3)_
  Añadir los manejadores de eventos (click/focus) a las celdas generadas en F1.3 para que, al interactuar con ellas, se conviertan en un campo editable (input o similar), permitiendo la escritura directa del contenido.
  verifican: R1.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió) · R10.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió)
- **F2.2** Actualizar el estado interno de la hoja al finalizar la edición de una celda. _(después de F2.1)_
  Implementar la lógica para capturar el valor escrito por el usuario cuando termina la edición (ej. evento blur o Enter) y actualizar de forma atómica el objeto de estado en memoria con este nuevo valor, sin modificar la visualización aún.
  verifican: R1.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió) · R10.1 (Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió)
- **F2.3** Implementar el guardado automático del estado completo de la hoja en localStorage tras cualquier cambio de datos. _(después de F2.2)_
  Añadir un observador o disparador que, cada vez que el estado interno (objeto JavaScript) sea modificado exitosamente (después de F2.2), serialice y guarde la totalidad del objeto de estado en localStorage.
  verifican: R9.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió) · R17.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió)
- **F2.4** Cargar el estado inicial completo de la hoja desde localStorage al iniciar la aplicación.
  Al cargar la página, verificar si existe un estado guardado en localStorage. Si lo hay, debe inicializar el objeto de estado interno con esos datos antes de dibujar o mostrar cualquier contenido.
  verifican: R9.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió) · R17.1 (Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió)

## F3. Implementación del motor de fórmulas y cálculos
_Desarrollar la lógica para que las celdas puedan contener fórmulas estilo Excel, empezando con '='. Esto incluye soportar funciones como =SUMA(rango) o =SUMA(celdas sueltas), y manejar operaciones matemáticas básicas (resta, multiplicación y división). Es crucial asegurar que si cambia una celda que la fórmula usa, el resultado de esa fórmula se actualice automáticamente._ · cubre: R3, R4, R11, R12

- **F3.1** Implementar la detección de fórmulas y el parsing inicial de argumentos. _(después de F2.1, F2.2)_
  Modificar la lógica de edición para detectar si el contenido ingresado en una celda comienza con '='. Si lo hace, debe extraer la cadena completa de la fórmula y sus argumentos (ej: 'SUMA(A1:A3)' o 'B1+C1'), almacenando esta estructura en el estado interno de la hoja.
  verifican: R3.1 (Antes: escribo "2" en A1, "3" en A2, "4" en A3. Escribo "=SUMA(A1:A3)" en B4. → B4 muestra "9") · R4.1 (Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "4" en B1. → A1 muestra "7") · R11.1 (Antes: escribo "5" en A1, "3" en B1, "" en C1. Escribo "=SUMA(A1;B1)" en C1. → C1 muestra "8") · R12.1 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1-B1" en C1. → C1 muestra "2") · R12.2 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1*B1" en D1. → D1 muestra "8") · R12.3 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1/B1" en E1. → E1 muestra "2")
- **F3.2** Implementar el motor de cálculo para operaciones matemáticas básicas (suma, resta, multiplicación, división). _(después de F3.1, F2.2)_
  Desarrollar la lógica de evaluación para fórmulas que contienen operadores matemáticos básicos (+, -, *, /) y referencias directas a celdas (ej: =A1+B1). Esta tarea debe ser capaz de resolver las referencias de celda usando los valores actuales del estado interno.
  verifican: R4.1 (Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "4" en B1. → A1 muestra "7") · R12.1 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1-B1" en C1. → C1 muestra "2") · R12.2 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1*B1" en D1. → D1 muestra "8") · R12.3 (Antes: escribo "4" en A1, "2" en B1. Escribo "=A1/B1" en E1. → E1 muestra "2")
- **F3.3** Implementar el cálculo de funciones de rango (ej: SUMA). _(después de F3.1, F2.2)_
  Desarrollar la lógica para identificar y procesar referencias de rango (ej: A1:A3 o A1;B1). Debe implementar funciones como SUMA, iterando sobre todas las celdas dentro del rango especificado y aplicando la función requerida.
  verifican: R3.1 (Antes: escribo "2" en A1, "3" en A2, "4" en A3. Escribo "=SUMA(A1:A3)" en B4. → B4 muestra "9") · R11.1 (Antes: escribo "5" en A1, "3" en B1, "" en C1. Escribo "=SUMA(A1;B1)" en C1. → C1 muestra "8")
- **F3.4** Implementar el sistema de dependencia y actualización automática de fórmulas. _(después de F2.2, F3.2, F3.3)_
  Crear un mecanismo que, cada vez que se actualiza una celda (después de F2.2), identifique todas las demás celdas en la hoja que dependan del valor cambiado. Para estas celdas dependientes, debe forzar el re-ejecución del motor de cálculo (F3.2 o F3.3) y actualizar su valor visible.
  verifican: R4.1 (Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "4" en B1. → A1 muestra "7") · R3.1 (Antes: escribo "2" en A1, "3" en A2, "4" en A3. Escribo "=SUMA(A1:A3)" en B4. → B4 muestra "9")

## F4. Funcionalidades de formato y manipulación de celdas individuales
_Implementar la capacidad de cambiar el color de fondo de una celda específica al hacer clic en ella. Esta funcionalidad debe actualizar tanto el estado interno como la representación visual de la celda._ · cubre: R5

- **F4.1** Implementar un manejador de eventos (event listener) en las celdas para detectar clics y obtener la coordenada de la celda objetivo. _(después de F1.3)_
  Añadir la lógica JavaScript necesaria para que, al hacer clic en cualquier celda del grid, se capture su identificador único (coordenadas A1, B5, etc.).
  sin prueba (preparación)
- **F4.2** Crear y posicionar la interfaz de usuario para la selección del color de fondo.
  Implementar el componente visual (ej: paleta o selector) que permitirá al usuario elegir un nuevo color hexadecimal (#RRGGBB).
  sin prueba (preparación)
- **F4.3** Actualizar el estado interno de la hoja para registrar el color de fondo en una celda específica. _(después de F2.2, F4.1)_
  Desarrollar la lógica que, al recibir un color seleccionado y las coordenadas de la celda clickeada (F4.1), actualice el objeto de estado global con el nuevo valor de fondo para esa celda.
  sin prueba (preparación)
- **F4.4** Aplicar visualmente el color de fondo seleccionado a la celda en el DOM. _(después de F4.1, F4.3)_
  Implementar el mecanismo que, tras actualizar el estado (F4.3), modifique directamente el estilo CSS del elemento DOM de la celda clickeada para reflejar el nuevo color de fondo.
  verifican: R5.1 (Antes: hago clic en A1. Elijo el color de fondo #FF0000. → A1 tiene fondo #FF0000)

## F5. Gestión estructural avanzada: Filas y Columnas
_Implementar la funcionalidad de selección y manipulación masiva de secciones. Esto incluye poder seleccionar una columna haciendo clic en su letra para borrarla, cambiar el color de fondo de todas sus celdas o vaciar su contenido; lo mismo debe hacerse al seleccionar una fila por su número (borrar/cambiar color/vaciar). Adicionalmente, se deben implementar los controles para ocultar tanto columnas como filas._ · cubre: R6, R7, R13, R14, R15, R16, R8

- **F5.1** Implementar la detección de clics en las etiquetas de columna (A-J) para seleccionar y registrar el estado activo de una columna completa. _(después de F1.1)_
  Añadir manejadores de eventos a los encabezados de columna (F1.1) para que, al hacer clic, se identifique la columna seleccionada y se actualice el estado interno de la aplicación con esta información.
  verifican: R6.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve) · R6.2 (Antes: hago clic en la columna A (en su letra). Elijo el color de fondo #ff0000. → A1 tiene fondo #ff0000 · A2 tiene fondo #ff0000) · R6.3 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de vaciar (borrar el contenido). → A1 queda vacía · A2 queda vacía) · R8.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna A ya no se ve) · R13.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve) · R14.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna B ya no se ve)
- **F5.2** Implementar la detección de clics en las etiquetas de fila (1-20) para seleccionar y registrar el estado activo de una fila completa. _(después de F1.2)_
  Añadir manejadores de eventos a los encabezados de fila (F1.2) para que, al hacer clic, se identifique la fila seleccionada y se actualice el estado interno de la aplicación con esta información.
  verifican: R7.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve) · R7.2 (Antes: hago clic en la fila 3 (en su número). Elijo el color de fondo #ff0000. → A3 tiene fondo #ff0000 · B3 tiene fondo #ff0000) · R7.3 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de vaciar (borrar el contenido). → A3 queda vacía · B3 queda vacía) · R8.2 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en B1. Antes: hago clic en la fila 1 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 1 ya no se ve) · R15.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve) · R16.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 3 ya no se ve)
- **F5.3** Implementar la funcionalidad para vaciar o borrar el contenido de todas las celdas dentro de una columna previamente seleccionada. _(después de F5.1)_
  Utilizar el identificador de la columna activa (F5.1) para iterar sobre todas las celdas correspondientes en el DOM y establecer su contenido a vacío.
  verifican: R6.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve) · R6.3 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de vaciar (borrar el contenido). → A1 queda vacía · A2 queda vacía) · R13.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve)
- **F5.4** Implementar la funcionalidad para aplicar un color de fondo uniforme a todas las celdas dentro de una columna previamente seleccionada. _(después de F5.1, F4.4)_
  Utilizar el identificador de la columna activa (F5.1) y los mecanismos de color (F4.2, F4.3) para aplicar visualmente un fondo de color a todas las celdas de esa columna.
  verifican: R6.2 (Antes: hago clic en la columna A (en su letra). Elijo el color de fondo #ff0000. → A1 tiene fondo #ff0000 · A2 tiene fondo #ff0000)
- **F5.5** Implementar la funcionalidad para vaciar o borrar el contenido de todas las celdas dentro de una fila previamente seleccionada. _(después de F5.2)_
  Utilizar el identificador de la fila activa (F5.2) para iterar sobre todas las celdas correspondientes en el DOM y establecer su contenido a vacío.
  verifican: R7.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve) · R7.3 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de vaciar (borrar el contenido). → A3 queda vacía · B3 queda vacía) · R15.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve)
- **F5.6** Implementar la funcionalidad para aplicar un color de fondo uniforme a todas las celdas dentro de una fila previamente seleccionada. _(después de F5.2, F4.4)_
  Utilizar el identificador de la fila activa (F5.2) y los mecanismos de color (F4.2, F4.3) para aplicar visualmente un fondo de color a todas las celdas de esa fila.
  verifican: R7.2 (Antes: hago clic en la fila 3 (en su número). Elijo el color de fondo #ff0000. → A3 tiene fondo #ff0000 · B3 tiene fondo #ff0000)
- **F5.7** Implementar la funcionalidad para ocultar visualmente todas las celdas de una columna previamente seleccionada. _(después de F5.1)_
  Utilizar el identificador de la columna activa (F5.1) para aplicar un estilo CSS que oculte completamente todas las celdas pertenecientes a esa columna.
  verifican: R8.1 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna A ya no se ve) · R14.1 (Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna B ya no se ve)
- **F5.8** Implementar la funcionalidad para ocultar visualmente todas las celdas de una fila previamente seleccionada. _(después de F5.2)_
  Utilizar el identificador de la fila activa (F5.2) para aplicar un estilo CSS que oculte completamente todas las celdas pertenecientes a esa fila.
  verifican: R8.2 (Antes: escribo un texto cualquiera en A1, un texto cualquiera en B1. Antes: hago clic en la fila 1 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 1 ya no se ve) · R16.1 (Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 3 ya no se ve)

Si está bien, aprobalo con `npm run proyecto -- plan <carpeta> --aprobar`. Si no, decí qué tarea o prueba está mal.