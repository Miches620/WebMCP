# Planilla: qué se va a probar

**Primero, el glosario** (de esto dependen muchas pruebas): lo que el usuario crea se llama **celda**; **no hay lugares con nombre donde se agrupen** (sin esto no se prueban mover, contadores ni orden). Si no es así, avisá: se corrige con `--glosario '{"item":"…","grupo":"…","inicio":"…"}'` y se vuelve a armar.

Después, leé cada requisito y lo que se va a probar. Si una prueba está mal, decí su número (p. ej. R10.3) y se saca con `npm run proyecto -- quitar <carpeta> R10.3`.

## R1. Editar celdas inline: un clic en la celda y se escribe ahí mismo
- **R1.1** · Antes: creo una celda. Edito la celda: le cambio el título. → el título nuevo aparece · el título viejo ya no está

## R2. La hoja tiene 10 columnas (A a J) y 20 filas (1 a 20), con las letras arriba y los números al costado, como en Excel; cada celda se nombra por su columna y su fila (A1, B2...)
- (sin prueba: Qwen no dio filas válidas)

## R3. Fórmulas estilo Excel en castellano, empezando con '=': suma con =SUMA(A1:A3) (un rango) o =SUMA(A1;B2;C3) (celdas sueltas); resta, multiplicación y división con signos: =A1-B1, =A1*B1, =A1/B1. La celda muestra el resultado
- (sin prueba: Qwen no dio filas válidas)

## R4. Cada celda puede tener su propia fórmula; si cambia una celda que la fórmula usa, el resultado se actualiza
- **R4.1** · Antes: creo una celda. Edito la celda: le cambio el título. → el título nuevo aparece · el título viejo ya no está

## R5. Cambiar el color de fondo de una celda
- (sin prueba: Qwen no dio filas válidas)

## R6. Seleccionar una columna haciendo clic en su letra y poder: borrar la columna, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- **R6.1** · Antes: creo una celda. Borro la celda (con su control de borrar; si pide confirmar, confirmo). → la celda ya no está
- **R6.2** · Antes: creo una celda. → la celda tiene background-color: cambiar

## R7. Seleccionar una fila haciendo clic en su número y poder: borrar la fila, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- (sin prueba: Qwen no dio filas válidas)

## R8. Ocultar una columna y ocultar una fila
- **R8.1** · → hay un botón que dice "Ocultar Columna"
- **R8.2** · → hay un botón que dice "Ocultar Fila"

## R9. Los datos se guardan en localStorage: al recargar la página la hoja sigue igual
- **R9.1** · Antes: creo una celda. Recargo la página. → la celda aparece

## R10. Se puede editar una celda con solo clickearla
- **R10.1** · Antes: creo una celda. Edito la celda: le cambio el título. → el título nuevo aparece · el título viejo ya no está

## R11. Una celda puede tener una fórmula que suma 2 o más celdas, y muestra el resultado
- (sin prueba: Qwen no dio filas válidas)

## R12. Se puede restar, multiplicar y dividir entre celdas
- (sin prueba: Qwen no dio filas válidas)

## R13. Se puede borrar una columna
- **R13.1** · Antes: creo una celda. Borro la celda (con su control de borrar; si pide confirmar, confirmo). → la celda ya no está

## R14. Se puede ocultar una columna
- **R14.1** · → hay un botón que dice "ocultar columna"

## R15. Se puede borrar una fila
- **R15.1** · Antes: creo una celda. Borro la celda (con su control de borrar; si pide confirmar, confirmo). → la celda ya no está

## R16. Se puede ocultar una fila
- **R16.1** · → hay un botón que dice "Ocultar fila"

## R17. Al recargar la página, los datos siguen ahí
- **R17.1** · Antes: creo una celda. Recargo la página. → la celda aparece

## R18. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R19. Restricción: Sin múltiples hojas
- (sin prueba: Qwen no dio filas válidas)

## R20. Restricción: Sin login
- (sin prueba: Qwen no dio filas válidas)
