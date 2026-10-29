# Planilla: qué se va a probar

**Primero, el glosario** (de esto dependen muchas pruebas): la pantalla es una grilla de **celdas** fijas, que se nombran por su columna y su fila (A1, B2…); el usuario no crea cosas nuevas (todo ya está en la pantalla). Si no es así, avisá: se corrige con `--glosario '{"item":"…","grupo":"…","inicio":"…","lugar":"…"}'` y se vuelve a armar.

Después, leé cada requisito y lo que se va a probar. Si una prueba está mal, decí su número (p. ej. R10.3) y se saca con `npm run proyecto -- quitar <carpeta> R10.3`.

## R1. Editar celdas inline: un clic en la celda y se escribe ahí mismo
- **R1.1** · Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió

## R2. La hoja tiene 10 columnas (A a J) y 20 filas (1 a 20), con las letras arriba y los números al costado, como en Excel; cada celda se nombra por su columna y su fila (A1, B2...)
- **R2.1** · → se ven los encabezados de columna A a J y de fila 1 a 20

## R3. Fórmulas estilo Excel en castellano, empezando con '=': suma con =SUMA(A1:A3) (un rango) o =SUMA(A1;B2;C3) (celdas sueltas); resta, multiplicación y división con signos: =A1-B1, =A1*B1, =A1/B1. La celda muestra el resultado
- **R3.1** · Antes: escribo "2" en A1, "3" en A2, "4" en A3. Escribo "=SUMA(A1:A3)" en B4. → B4 muestra "9"
- **R3.2** · Antes: escribo "2" en A1, "5" en B2, "3" en C3. Escribo "=A1-B2*C3" en D6. → D6 muestra "-7"

## R4. Cada celda puede tener su propia fórmula; si cambia una celda que la fórmula usa, el resultado se actualiza
- **R4.1** · Antes: escribo "=B1+C1" en A1, "2" en B1, "3" en C1. Escribo "5" en A1. → A1 muestra "8"

## R5. Cambiar el color de fondo de una celda
- **R5.1** · Antes: hago clic en A1. Elijo el color de fondo #FF0000. → A1 tiene fondo #FF0000

## R6. Seleccionar una columna haciendo clic en su letra y poder: borrar la columna, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- **R6.1** · Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve
- **R6.2** · Antes: hago clic en la columna A (en su letra). Elijo el color de fondo #ff0000. → A1 tiene fondo #ff0000 · A2 tiene fondo #ff0000
- **R6.3** · Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de vaciar (borrar el contenido). → A1 queda vacía · A2 queda vacía

## R7. Seleccionar una fila haciendo clic en su número y poder: borrar la fila, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- **R7.1** · Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve
- **R7.2** · Antes: hago clic en la fila 3 (en su número). Elijo el color de fondo #ff0000. → A3 tiene fondo #ff0000 · B3 tiene fondo #ff0000
- **R7.3** · Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de vaciar (borrar el contenido). → A3 queda vacía · B3 queda vacía

## R8. Ocultar una columna y ocultar una fila
- **R8.1** · Antes: escribo un texto cualquiera en A1, un texto cualquiera en A2. Antes: hago clic en la columna A (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna A ya no se ve
- **R8.2** · Antes: escribo un texto cualquiera en A1, un texto cualquiera en B1. Antes: hago clic en la fila 1 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 1 ya no se ve

## R9. Los datos se guardan en localStorage: al recargar la página la hoja sigue igual
- **R9.1** · Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió

## R10. Se puede editar una celda con solo clickearla
- **R10.1** · Escribo un texto cualquiera en A1. → A1 muestra el texto que se escribió

## R11. Una celda puede tener una fórmula que suma 2 o más celdas, y muestra el resultado
- **R11.1** · Antes: escribo "5" en A1, "3" en B1, "" en C1. Escribo "=SUMA(A1;B1)" en C1. → C1 muestra "8"

## R12. Se puede restar, multiplicar y dividir entre celdas
- **R12.1** · Antes: escribo "4" en A1, "2" en B1. Escribo "=A1-B1" en C1. → C1 muestra "2"
- **R12.2** · Antes: escribo "4" en A1, "2" en B1. Escribo "=A1*B1" en D1. → D1 muestra "8"
- **R12.3** · Antes: escribo "4" en A1, "2" en B1. Escribo "=A1/B1" en E1. → E1 muestra "2"

## R13. Se puede borrar una columna
- **R13.1** · Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de borrar. → lo que se escribió ya no se ve

## R14. Se puede ocultar una columna
- **R14.1** · Antes: escribo un texto cualquiera en B1, un texto cualquiera en B2. Antes: hago clic en la columna B (en su letra). Uso el control de ocultar. → lo que se escribió ya no se ve · la columna B ya no se ve

## R15. Se puede borrar una fila
- **R15.1** · Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de borrar. → lo que se escribió ya no se ve

## R16. Se puede ocultar una fila
- **R16.1** · Antes: escribo un texto cualquiera en A3, un texto cualquiera en B3. Antes: hago clic en la fila 3 (en su número). Uso el control de ocultar. → lo que se escribió ya no se ve · la fila 3 ya no se ve

## R17. Al recargar la página, los datos siguen ahí
- **R17.1** · Antes: escribo un texto cualquiera en B2. Recargo la página. → B2 muestra el texto que se escribió

## R18. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R19. Restricción: Sin múltiples hojas
- (sin prueba: dice cómo está programada por dentro)

## R20. Restricción: Sin login
- (sin prueba: dice cómo está programada por dentro)
