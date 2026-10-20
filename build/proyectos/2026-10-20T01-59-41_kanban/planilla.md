# Planilla: qué se va a probar

**Primero, el glosario** (de esto dependen muchas pruebas): lo que el usuario crea se llama **tarjeta**; los lugares con nombre donde están se llaman **pendiente**. Si no es así, avisá: se corrige con `--glosario '{"item":"…","grupo":"…"}'` y se vuelve a armar.

Después, leé cada requisito y lo que se va a probar. Si algo está mal o falta, decímelo.

## R1. Crear tarjetas
- (sin prueba: Qwen no dio filas válidas)

## R2. Primera columna -> div contenedor de columna 'Pendiente' + botón 'Agregar tarjeta' debajo
- (sin prueba: Qwen no dio filas válidas)

## R3. Asignar prioridad a una tarjeta desde una lista (etiqueta: alta: color rojo, media: color amarillo, baja: color verde) en el modal de creación o edición de tarjetas
- Creo una tarjeta con un título cualquiera y prioridad "alta". → la tarjeta muestra "alta"
- Creo una tarjeta con un título cualquiera y prioridad "alta". → la tarjeta muestra "alta" · la tarjeta se pinta de rojo donde dice "alta"
- Creo una tarjeta con un título cualquiera y prioridad "media". → la tarjeta muestra "media" · la tarjeta se pinta de amarillo donde dice "media"
- Creo una tarjeta con un título cualquiera y prioridad "baja". → la tarjeta muestra "baja" · la tarjeta se pinta de verde donde dice "baja"

## R4. Campos que tendrá cada tarjeta al momento de crearla: Titulo, descripción, y prioridad (etiqueta)
- Creo una tarjeta con un título cualquiera y Descripción (un texto cualquiera) y prioridad "alta". → la tarjeta muestra el texto que se cargó, "alta"

## R5. Campos que se pueden editar al presionar el botón 'editar tarjeta': Titulo, descripción, y prioridad (etiqueta)
- (sin prueba: Qwen no dio filas válidas)

## R6. Usar funcionalidad de drag&drop: la tarjeta estara compuesta por un contenedor con 2 divs dentro; Un div de 24px (⠿) sera el encargado de la funcion drag&drop (class='drag-handle' draggable='true' ondragstart / ondragend)
- (sin prueba: Qwen no dio filas válidas)

## R7. Comportamiento al borrar una tarjeta: Eliminar(🗑️) abre un modal para consultarle al usuario 'Esta seguro de borrar la tarjeta?' y si el usuario confirma, la tarjeta sera eliminada de la columna donde se encontrara, reduciendo el contador de tarjetas de dicha columna
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → al apretar borrar, antes de confirmar, aparece "Esta seguro de borrar la tarjeta?" · la tarjeta ya no está

## R8. Campos que tendrá cada columna: title ('Pendiente', 'En Curso', 'Completa'), y counter (contador de tarjetas dentro de la columna); La Columna 'Pendiente' sera la unica que tendra debajo el botón 'Agregar tarjeta'
- (sin prueba: Qwen no dio filas válidas)

## R9. Fondo: #102C54, columnas: #8FB3C7, tarjetas: #F2E9D8
- → la página tiene background-color: #102C54
- Antes: creo una tarjeta. → la tarjeta tiene background-color: #F2E9D8

## R10. Columnas con overflow:scroll, width:248px, header con title ('Pendiente', 'En Curso', o 'Completa') y contador de tarjetas en columna
- → el pendiente "En Curso" tiene overflow-y: scroll o auto
- → el pendiente "Completa" tiene overflow-y: scroll o auto
- Creo una tarjeta con un título cualquiera. → el contador de "En Curso" sube 1
- Creo una tarjeta con un título cualquiera. → el contador de "Completa" sube 1

## R11. Botón 'Agregar tarjeta': padding: 8px, border: 1px dashed, border radius: 8px, abre modal de creación de tarjetas
- → hay un botón que dice "Agregar tarjeta"

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
- (sin prueba: Qwen no dio filas válidas)

## R19. Se pueden leer las tarjetas (verlas)
- (sin prueba: Qwen no dio filas válidas)

## R20. Se pueden actualizar las tarjetas (editar)
- (sin prueba: Qwen no dio filas válidas)

## R21. Se pueden eliminar las tarjetas
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está · el contador de "En Curso" baja 1
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta ya no está · el contador de "Completa" baja 1

## R22. Se pueden arrastrar y mover las tarjetas entre columnas (nombre de columnas: Pendiente, En Curso, Completado)
- Antes: creo una tarjeta. Muevo la tarjeta a "En Curso" (arrastrando, o con su control de mover). → la tarjeta aparece en "En Curso" · el contador de "Completado" baja 1 · el contador de "En Curso" sube 1

## R23. Se guardan los datos en localstorage
- Antes: creo una tarjeta. Recargo la página. → la tarjeta aparece
- Antes: creo una tarjeta. Recargo la página. → la tarjeta aparece
- Antes: creo una tarjeta. Recargo la página. → la tarjeta aparece

## R24. Se muestran los colores especificados para el fondo, columnas y tarjetas
- (sin prueba: Qwen no dio filas válidas)

## R25. El botón 'Agregar tarjeta' abre un modal para crear nuevas tarjetas
- (sin prueba: Qwen no dio filas válidas)

## R26. Se muestra un mensaje de confirmación antes de eliminar una tarjeta
- Antes: creo una tarjeta. Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → al apretar borrar, antes de confirmar, aparece "Esta seguro de borrar la tarjeta?" · la tarjeta ya no está

## R27. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R28. Restricción: Sin crear nuevas columnas, permitir tarjetas vacías, eliminar tarjetas en columna 'Completa'
- Antes: creo una tarjeta. Antes: muevo la tarjeta a "Completa". Borro la tarjeta (con su control de borrar; si pide confirmar, confirmo). → la tarjeta sigue en "Completa" (no se borró)

## R29. Restricción: Sin búsqueda de tarjetas por título o contenido
- (sin prueba: No se implementa búsqueda de tarjetas por título o contenido)

## R30. Restricción: Sin agregar subtarjetas o tareas dentro de una tarjeta
- (sin prueba: dice cómo está programada por dentro)
