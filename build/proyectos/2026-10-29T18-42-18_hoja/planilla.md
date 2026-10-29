# Planilla: qué se va a probar

**Primero, el glosario** (de esto dependen muchas pruebas): lo que el usuario crea se llama **elemento**; **no hay lugares con nombre donde se agrupen** (sin esto no se prueban mover, contadores ni orden). Si no es así, avisá: se corrige con `--glosario '{"item":"…","grupo":"…","inicio":"…","lugar":"…"}'` y se vuelve a armar.

Después, leé cada requisito y lo que se va a probar. Si una prueba está mal, decí su número (p. ej. R10.3) y se saca con `npm run proyecto -- quitar <carpeta> R10.3`.

## R1. Editar celdas inline: un clic en la celda y se escribe ahí mismo
- (sin prueba: Qwen no dio filas válidas)

## R2. La hoja tiene 10 columnas (A a J) y 20 filas (1 a 20), con las letras arriba y los números al costado, como en Excel; cada celda se nombra por su columna y su fila (A1, B2...)
- (sin prueba: Qwen no dio filas válidas)

## R3. Fórmulas estilo Excel en castellano, empezando con '=': suma con =SUMA(A1:A3) (un rango) o =SUMA(A1;B2;C3) (celdas sueltas); resta, multiplicación y división con signos: =A1-B1, =A1*B1, =A1/B1. La celda muestra el resultado
- (sin prueba: Qwen no dio filas válidas)

## R4. Cada celda puede tener su propia fórmula; si cambia una celda que la fórmula usa, el resultado se actualiza
- (sin prueba: Qwen no dio filas válidas)

## R5. Cambiar el color de fondo de una celda
- (sin prueba: Qwen no dio filas válidas)

## R6. Seleccionar una columna haciendo clic en su letra y poder: borrar la columna, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- (sin prueba: Qwen no dio filas válidas)

## R7. Seleccionar una fila haciendo clic en su número y poder: borrar la fila, cambiar el color de fondo de todas sus celdas, borrar el contenido de todas sus celdas
- (sin prueba: Qwen no dio filas válidas)

## R8. Ocultar una columna y ocultar una fila
- (sin prueba: Qwen no dio filas válidas)

## R9. Los datos se guardan en localStorage: al recargar la página la hoja sigue igual
- **R9.1** · Antes: creo un elemento. Recargo la página. → el elemento aparece

## R10. Se puede editar una celda con solo clickearla
- (sin prueba: Qwen no dio filas válidas)

## R11. Una celda puede tener una fórmula que suma 2 o más celdas, y muestra el resultado
- (sin prueba: Qwen no dio filas válidas)

## R12. Se puede restar, multiplicar y dividir entre celdas
- (sin prueba: Qwen no dio filas válidas)

## R13. Se puede borrar una columna
- **R13.1** · Antes: creo un elemento. Borro el elemento (con su control de borrar; si pide confirmar, confirmo). → el elemento ya no está · el contador de "columnas" baja 1

## R14. Se puede ocultar una columna
- (sin prueba: el requisito no menciona la posibilidad de borrar una columna)

## R15. Se puede borrar una fila
- **R15.1** · Antes: creo un elemento. Borro el elemento (con su control de borrar; si pide confirmar, confirmo). → el elemento ya no está · el contador de "Fila" baja 1

## R16. Se puede ocultar una fila
- (sin prueba: Qwen no dio filas válidas)

## R17. Al recargar la página, los datos siguen ahí
- **R17.1** · Antes: creo un elemento. Recargo la página. → el elemento aparece

## R18. Restricción: Sin base de datos
- (sin prueba: dice cómo está programada por dentro)

## R19. Restricción: Sin múltiples hojas
- (sin prueba: dice cómo está programada por dentro)

## R20. Restricción: Sin login
- (sin prueba: dice cómo está programada por dentro)

## Lo que encontró el buscador

Leyó 6 página(s) (https://www.smartsheet.com/best-spreadsheet-apps-complete-comparison-guide?srsltid=AYCX9vImIc7CxrS_s2rNpONhDAAl9tYKN3-cZDruhbmZOe_byZky3s1B, https://github.com/storytold/gridcraft, https://ilabora.com/blog/que-es-microsoft-excel-y-para-que-sirve/, https://www.techradar.com/best/spreadsheet-software, https://www.microsoft.com/es-ar/microsoft-365/excel/spreadsheets, https://zapier.com/blog/best-spreadsheet-excel-alternative/). Lo que entendió de este tipo de app (lo usó Qwen para el glosario y el examen, con su cita):

- seleccionar una columna haciendo clic en su letra (S2: "Selecting a chart outlines its source data.")
- usar letras para columnas (A a J) (S3: "Las filas están numeradas y las columnas se identifican con letras.")
- usar números para filas (1 a 20) (S3: "Las filas están numeradas y las columnas se identifican con letras.")
- usar fórmulas estilo Excel (S3: "En esas celdas se pueden introducir textos, cifras, fechas y fórmulas.")
- insertar datos de Google Forms en hojas de cálculo (S1: "Google Forms, which can be embedded anywhere or sent in emails, can feed data into a dedicated Sheet with columns for each field")
- compatibilidad con archivos Excel y CSV (S1: "Google is also compatible with Excel files and .csv files, and can import and autoformat them with fairly accurate output.")
- introducir texto, números, fechas o fórmulas (S5: "Solo tienes que seleccionar una celda y escribir la información que quieras, como texto, números, fechas o fórmulas.")
- seleccionar una celda haciendo clic en ella (S5: "Haz clic en una celda para seleccionarla. Haz clic y arrastra para seleccionar varias celdas.")
- usar fórmulas predefinidas como SUMA, PROMEDIO o BUSCARV (S5: "Usa fórmulas para realizar cálculos y funciones predefinidas como SUMA, PROMEDIO o BUSCARV para automatizar tareas.")
- usar fórmulas para realizar cálculos (S5: "Usa fórmulas para realizar cálculos y funciones predefinidas como SUMA, PROMEDIO o BUSCARV para automatizar tareas.")

Cosas que tienen apps parecidas y vos **no** pediste. No entran solas: si querés alguna, se suma con `npm run proyecto -- agregar <carpeta> "…"`.

- insertar datos de Google Forms en hojas de cálculo (lo tienen 1 de 6 fuentes (S1))
- compatibilidad con archivos Excel y CSV (lo tienen 1 de 6 fuentes (S1))
- introducir texto, números, fechas o fórmulas (lo tienen 1 de 6 fuentes (S5))
- seleccionar una celda haciendo clic en ella (lo tienen 1 de 6 fuentes (S5))
- usar fórmulas predefinidas como SUMA, PROMEDIO o BUSCARV (lo tienen 1 de 6 fuentes (S5))
- usar fórmulas para realizar cálculos (lo tienen 1 de 6 fuentes (S5))
