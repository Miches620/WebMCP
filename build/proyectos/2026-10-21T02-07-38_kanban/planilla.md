# Planilla: qué se va a probar

**Primero, el glosario** (de esto dependen muchas pruebas): lo que el usuario crea se llama **tarjeta**; los lugares con nombre donde están se llaman **columna**, y lo que se crea aparece en **Pendiente**. Si no es así, avisá: se corrige con `--glosario '{"item":"…","grupo":"…","inicio":"…"}'` y se vuelve a armar.

**Corregí un nombre** (pusiste dos nombres para lo mismo): usé **"Completa"** (aparece 6 veces) en vez de "Completado" (1). Si era al revés, o eran cosas distintas, avisá y se corrige el pedido.

Después, leé cada requisito y lo que se va a probar. Si una prueba está mal, decí su número (p. ej. R10.3) y se saca con `npm run proyecto -- quitar <carpeta> R10.3`.

## R1. Crear tarjetas
- **R1.1** · Creo una tarjeta con un título cualquiera. → la tarjeta aparece en "Pendiente"

## R2. Primera columna -> div contenedor de columna 'Pendiente' + botón 'Agregar tarjeta' debajo
- **R2.1** · → hay un botón que dice "Agregar tarjeta" y está solo en "Pendiente"

## R3. Asignar prioridad a una tarjeta desde una lista (etiqueta: alta: color rojo, media: color amarillo, baja: color verde) en el modal de creación o edición de tarjetas
- **R3.1** · Creo una tarjeta con un título cualquiera y prioridad "alta". → la tarjeta muestra "alta"

## R4. Campos que tendrá cada tarjeta al momento de crearla: Titulo, descripción, y prioridad (etiqueta)
- **R4.1** · Creo una tarjeta con un título cualquiera y Descripción (un texto cualquiera) y Prioridad "alta". → la tarjeta muestra el texto que se cargó, "alta"

## R5. Campos que se pueden editar al presionar el botón 'editar tarjeta': Titulo, descripción, y prioridad (etiqueta)
- **R5.1** · Antes: creo una tarjeta. Edito la tarjeta: le cambio el título y le pongo descripción (un texto cualquiera) y prioridad "alta". → el título nuevo aparece · el título viejo ya no está · la tarjeta muestra el texto que se cargó, "alta"

## R6. Usar funcionalidad de drag&drop: la tarjeta estara compuesta por un contenedor con 2 divs dentro; Un div de 24px (⠿) sera el encargado de la funcion drag&drop (class='drag-handle' draggable='true' ondragstart / ondragend)
- **R6.1** · Antes: creo una tarjeta. Muevo la tarjeta a "En Curso" arrastrándola desde su manija "⠿". → la tarjeta aparece en "En Curso" · el contador de "Pendiente" baja 1 · el contador de "En Curso" sube 1

## R7. Comportamiento al borrar una tarjeta: Eliminar(🗑️) abre un modal para consultarle al usuario 'Esta seguro de borrar la tarjeta?' y si el usuario confirma, la tarjeta sera eliminada de la columna donde se encontrara, reduciendo el contador de tarjetas de dicha columna
- **R7.1** · Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → al apretar borrar, antes de confirmar, aparece "Esta seguro de borrar la tarjeta?" · la tarjeta ya no está
- **R7.2** · Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está · el contador de "Pendiente" baja 1

## R8. Campos que tendrá cada columna: title ('Pendiente', 'En Curso', 'Completa'), y counter (contador de tarjetas dentro de la columna); La Columna 'Pendiente' sera la unica que tendra debajo el botón 'Agregar tarjeta'
- **R8.1** · → se ve "Pendiente" · se ve "En Curso" · se ve "Completa"
- **R8.2** · → hay un botón que dice "Agregar tarjeta" y está solo en "Pendiente"

## R9. Fondo: #102C54, columnas: #8FB3C7, tarjetas: #F2E9D8
- **R9.1** · → la página tiene background-color: #102C54
- **R9.2** · → la columna "Pendiente" tiene background-color: #8FB3C7
- **R9.3** · Antes: creo una tarjeta. → la tarjeta tiene background-color: #F2E9D8

## R10. Columnas con overflow:scroll, width:248px, header con title ('Pendiente', 'En Curso', o 'Completa') y contador de tarjetas en columna
- **R10.1** · Antes: creo 10 tarjetas. → con 10 tarjetas en "Pendiente", se desplaza (scroll) adentro de la columna y la página NO se desplaza
- **R10.2** · Antes: creo 10 tarjetas. Antes: muevo esas 10 tarjetas a "En Curso", de a una. → con 10 tarjetas en "En Curso", se desplaza (scroll) adentro de la columna y la página NO se desplaza
- **R10.3** · Antes: creo 10 tarjetas. Antes: muevo esas 10 tarjetas a "Completa", de a una. → con 10 tarjetas en "Completa", se desplaza (scroll) adentro de la columna y la página NO se desplaza
- **R10.4** · → la columna "Pendiente" tiene width: 248px
- **R10.5** · → la columna "En Curso" tiene width: 248px
- **R10.6** · → la columna "Completa" tiene width: 248px

## R11. Botón 'Agregar tarjeta': padding: 8px, border: 1px dashed, border radius: 8px, abre modal de creación de tarjetas
- **R11.1** · → el botón "Agregar tarjeta" tiene padding: 8px
- **R11.2** · → el botón "Agregar tarjeta" tiene border-top-style: dashed
- **R11.3** · → el botón "Agregar tarjeta" tiene border-top-left-radius: 8px

## R12. Tarjetas con overflow-y:scroll, width: 223px (24px para drag&drop y 199px restantes para el body), y alto según su contenido
- (sin prueba: Qwen no dio filas válidas)

## R13. Div 'top' con title y actions
- (sin prueba: Qwen no dio filas válidas)

## R14. Actions: botón eliminar y botón editar tarjeta, display on hover
- **R14.1** · Antes: creo una tarjeta. Paso el mouse por encima de la tarjeta. → al pasar el mouse por la tarjeta aparecen "🗑️", "✏️" (antes no se ven)

## R15. Sombras en tarjetas, efecto de movimiento durante drag&drop, actualización de contadores al mover tarjetas
- **R15.1** · Antes: creo una tarjeta. → la tarjeta tiene box-shadow: distinto de none

## R16. Tarjetas de la misma prioridad: Se prioriza la más reciente; en cada columna, las tarjetas se mostrarán y ordenarán de forma descendente sobre la columna, con las de prioridad alta arriba, luego las de prioridad media y debajo de todo las de prioridad baja
- **R16.1** · Antes: creo 4 tarjetas, en este orden: prioridad alta · prioridad baja · prioridad media · prioridad alta. → en "Pendiente" quedan de arriba abajo: la de prioridad alta creada después · la de prioridad alta creada primero · la de prioridad media · la de prioridad baja

## R17. Botones 'Eliminar' y 'Editar': Eliminar: 🗑️, Editar: ✏️ (visibles solo al hacer hover en la tarjeta)
- **R17.1** · Antes: creo una tarjeta. Paso el mouse por encima de la tarjeta. → al pasar el mouse por la tarjeta aparecen "🗑️", "✏️" (antes no se ven)

## R18. Se puede crear una tarjeta
- **R18.1** · Creo una tarjeta con un título cualquiera. → la tarjeta aparece en "Pendiente"

## R19. Se pueden leer las tarjetas (verlas)
- (sin prueba: Qwen no dio filas válidas)

## R20. Se pueden actualizar las tarjetas (editar)
- **R20.1** · Antes: creo una tarjeta. Edito la tarjeta: le cambio el título y le pongo descripción (un texto cualquiera) y prioridad "alta". → el título nuevo aparece · el título viejo ya no está · la tarjeta muestra el texto que se cargó, "alta"

## R21. Se pueden eliminar las tarjetas
- **R21.1** · Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está · el contador de "Pendiente" baja 1

## R22. Se pueden arrastrar y mover las tarjetas entre columnas (nombre de columnas: Pendiente, En Curso, Completa)
- **R22.1** · Antes: creo una tarjeta. Muevo la tarjeta a "En Curso" (arrastrando, o con su control de mover). → la tarjeta aparece en "En Curso" · el contador de "Pendiente" baja 1 · el contador de "En Curso" sube 1
- **R22.2** · Antes: creo una tarjeta. Muevo la tarjeta a "Completa" (arrastrando, o con su control de mover). → la tarjeta aparece en "Completa" · el contador de "Pendiente" baja 1 · el contador de "Completa" sube 1

## R23. Se guardan los datos en localstorage
- **R23.1** · Antes: creo una tarjeta. Recargo la página. → la tarjeta aparece

## R24. Se muestran los colores especificados para el fondo, columnas y tarjetas
- (sin prueba: Qwen no dio filas válidas)

## R25. El botón 'Agregar tarjeta' abre un modal para crear nuevas tarjetas
- **R25.1** · → hay un botón que dice "Agregar tarjeta" y está solo en "Pendiente"

## R26. Se muestra un mensaje de confirmación antes de eliminar una tarjeta
- **R26.1** · Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → al apretar borrar, antes de confirmar, aparece "Esta seguro de borrar la tarjeta?" · la tarjeta ya no está

## R27. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R28. Restricción: Sin crear nuevas columnas, permitir tarjetas vacías, eliminar tarjetas en columna 'Completa'
- **R28.1** · Antes: creo una tarjeta. Antes: muevo la tarjeta a "Completa". Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta sigue en "Completa" (no se borró)

## R29. Restricción: Sin búsqueda de tarjetas por título o contenido
- (sin prueba: dice cómo está programada por dentro)

## R30. Restricción: Sin agregar subtarjetas o tareas dentro de una tarjeta
- (sin prueba: dice cómo está programada por dentro)

## R31. Las columnas centradas horizontalmente en la página
- **R31.1** · → las columnas quedan centradas en la página (mismo espacio libre a la izquierda y a la derecha)

## R32. Cada tarjeta muestra su manija ⠿ y se arrastra desde ella
- **R32.1** · Antes: creo una tarjeta. Muevo la tarjeta a "En Curso" arrastrándola desde su manija "⠿". → la tarjeta aparece en "En Curso"

## R33. Al intentar eliminar una tarjeta en 'Completa', mostrar el mensaje 'No se puede eliminar una tarjeta completada'
- **R33.1** · Antes: creo una tarjeta. Antes: muevo la tarjeta a "Completa". Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → al apretar borrar, antes de confirmar, aparece "'No se puede eliminar una tarjeta completada'" · la tarjeta sigue en "Completa" (no se borró)
