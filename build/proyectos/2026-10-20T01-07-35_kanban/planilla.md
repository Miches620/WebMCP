# Planilla: qué se va a probar

Glosario: item = tarjeta, grupo = (no tiene)

Leé cada requisito y lo que se va a probar. Si algo está mal o falta, decímelo (o corregí planilla.json).

## R1. Crear tarjetas
- Creo una tarjeta con un título cualquiera. → la tarjeta aparece

## R2. Primera columna -> div contenedor de columna 'Pendiente' + botón 'Agregar tarjeta' debajo
- → hay un botón que dice "Agregar tarjeta"
- → se ve "Pendiente"

## R3. Asignar prioridad a una tarjeta desde una lista (etiqueta: alta: color rojo, media: color amarillo, baja: color verde) en el modal de creación o edición de tarjetas
- Creo una tarjeta con un título cualquiera y prioridad "alta". → la tarjeta muestra "alta"
- Creo una tarjeta con un título cualquiera y prioridad "alta". → la tarjeta muestra "alta" · la tarjeta se pinta de rojo donde dice "alta"
- Creo una tarjeta con un título cualquiera y prioridad "media". → la tarjeta muestra "media" · la tarjeta se pinta de amarillo donde dice "media"
- Creo una tarjeta con un título cualquiera y prioridad "baja". → la tarjeta muestra "baja" · la tarjeta se pinta de verde donde dice "baja"

## R4. Campos que tendrá cada tarjeta al momento de crearla: Titulo, descripción, y prioridad (etiqueta)
- Creo una tarjeta con un título cualquiera y Descripción (un texto cualquiera) y Prioridad "alta". → la tarjeta muestra el texto que se cargó, "alta"

## R5. Campos que se pueden editar al presionar el botón 'editar tarjeta': Titulo, descripción, y prioridad (etiqueta)
- Antes: creo una tarjeta. Edito la tarjeta: le cambio el título y le pongo Descripción (un texto cualquiera) y Prioridad "media". → el título nuevo aparece · el título viejo ya no está · la tarjeta muestra el texto que se cargó, "media"

## R6. Usar funcionalidad de drag&drop: la tarjeta estara compuesta por un contenedor con 2 divs dentro; Un div de 24px (⠿) sera el encargado de la funcion drag&drop (class='drag-handle' draggable='true' ondragstart / ondragend)
- (sin prueba: Qwen no dio filas válidas)

## R7. Comportamiento al borrar una tarjeta: Eliminar(🗑️) abre un modal para consultarle al usuario 'Esta seguro de borrar la tarjeta?' y si el usuario confirma, la tarjeta sera eliminada de la columna donde se encontrara, reduciendo el contador de tarjetas de dicha columna
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está
- → se ve "Esta seguro de borrar la tarjeta?"

## R8. Campos que tendrá cada columna: title ('Pendiente', 'En Curso', 'Completa'), y counter (contador de tarjetas dentro de la columna); La Columna 'Pendiente' sera la unica que tendra debajo el botón 'Agregar tarjeta'
- → se ve "Pendiente" · se ve "En Curso" · se ve "Completa"
- → se ve "contador de tarjetas dentro de la columna"
- → hay un botón que dice "Agregar tarjeta"

## R9. Fondo: #102C54, columnas: #8FB3C7, tarjetas: #F2E9D8
- → la página tiene background-color: #102C54
- Antes: creo una tarjeta. → la tarjeta tiene background-color: #F2E9D8

## R10. Columnas con overflow:scroll, width:248px, header con title ('Pendiente', 'En Curso', o 'Completa') y contador de tarjetas en columna
- → se ve "Pendiente" · se ve "En Curso" · se ve "Completa"

## R11. Botón 'Agregar tarjeta': padding: 8px, border: 1px dashed, border radius: 8px, abre modal de creación de tarjetas
- → el botón "Agregar tarjeta" tiene padding: 8px
- → el botón "Agregar tarjeta" tiene border-top-style: dashed
- → el botón "Agregar tarjeta" tiene border-top-left-radius: 8px

## R12. Tarjetas con overflow-y:scroll, height:250px, width: 223px (24px para drag&drop y 199px restantes para el body)
- Antes: creo una tarjeta. → la tarjeta tiene overflow-y: scroll o auto
- Antes: creo una tarjeta. → la tarjeta tiene height: 250px
- Antes: creo una tarjeta. → la tarjeta tiene width: 223px

## R13. Div 'top' con title y actions
- (sin prueba: Qwen no dio filas válidas)

## R14. Actions: botón eliminar y botón editar tarjeta, display on hover
- Antes: creo una tarjeta. Paso el mouse por encima de la tarjeta. → al pasar el mouse por la tarjeta aparecen "🗑️", "✏️" (antes no se ven)

## R15. Sombras en tarjetas, efecto de movimiento durante drag&drop, actualización de contadores al mover tarjetas
- Antes: creo una tarjeta. → la tarjeta tiene box-shadow: distinto de none

## R16. Tarjetas de la misma prioridad: Se prioriza la más reciente; en cada columna, las tarjetas se mostrarán y ordenarán de forma descendente sobre la columna, con las de prioridad alta arriba, luego las de prioridad media y debajo de todo las de prioridad baja
- (sin prueba: Qwen no dio filas válidas)

## R17. Botones 'Eliminar' y 'Editar': Eliminar: 🗑️, Editar: ✏️ (visibles solo al hacer hover en la tarjeta)
- Antes: creo una tarjeta. Paso el mouse por encima de la tarjeta. → al pasar el mouse por la tarjeta aparecen "🗑️", "✏️" (antes no se ven)

## R18. Se puede crear una tarjeta
- Creo una tarjeta con un título cualquiera. → la tarjeta aparece

## R19. Se pueden leer las tarjetas (verlas)
- (sin prueba: Qwen no dio filas válidas)

## R20. Se pueden actualizar las tarjetas (editar)
- Antes: creo una tarjeta. Edito la tarjeta: le cambio el título y le pongo descripcion (un texto cualquiera) y prioridad "media". → el título nuevo aparece · el título viejo ya no está · la tarjeta muestra el texto que se cargó, "media"

## R21. Se pueden eliminar las tarjetas
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está

## R22. Se pueden arrastrar y mover las tarjetas entre columnas (nombre de columnas: Pendiente, En Curso, Completado)
- (sin prueba: Qwen no dio filas válidas)

## R23. Se guardan los datos en localstorage
- Antes: creo una tarjeta. Recargo la página. → la tarjeta aparece

## R24. Se muestran los colores especificados para el fondo, columnas y tarjetas
- (sin prueba: El requisito no especifica colores para el fondo, columnas y tarjetas.)

## R25. El botón 'Agregar tarjeta' abre un modal para crear nuevas tarjetas
- → hay un botón que dice "Agregar tarjeta"
- → se ve "Crear nuevas tarjetas"

## R26. Se muestra un mensaje de confirmación antes de eliminar una tarjeta
- → hay un botón que dice "Esta seguro de borrar la tarjeta?"

## R27. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R28. Restricción: Sin crear nuevas columnas, permitir tarjetas vacías, eliminar tarjetas en columna 'Completa'
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está
- → se ve "Completa"

## R29. Restricción: Sin búsqueda de tarjetas por título o contenido
- (sin prueba: No se implementa búsqueda de tarjetas por título o contenido)

## R30. Restricción: Sin agregar subtarjetas o tareas dentro de una tarjeta
- (sin prueba: No se puede comprobar esta restricción usando la app, ya que no hay funcionalidad para agregar subtarjetas o tareas.)
