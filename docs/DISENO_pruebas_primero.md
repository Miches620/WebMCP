# Diseño: "pruebas primero" para el Specialist (DRAFT, 11/10)

> Estado: propuesta, sin código. Nace de la charla del 11/10 (Miche: "inculcarles una forma prolija de trabajar ANTES de tocar una línea de código") y de la evidencia del banco de reglas.

## El problema que resuelve

En web/game el Standard trae las pruebas de la lógica porque el contrato es fijo (`crearEstado`, `mover`, `ganado`). En una **webapp** cada proyecto tiene funciones propias ("pasar de macerado a hervor a los 60 min", "mover una tarjeta de columna"): el Standard no las puede saber de antemano. Hoy web/app no tiene pruebas de su lógica: solo los chequeos de interacción de Validation, al final.

## Lo que ya sabemos (evidencia)

- **TDD ya funciona cuando las pruebas las escribe otro.** El banco de reglas encontró el error de tamaño fijo (20/30) porque las pruebas del harness usan niveles de 3x5. Si Gemma hubiera escrito las pruebas con la misma idea equivocada (niveles de 9x9), habrían pasado.
- **El "rojo" ya existe en Validation:** un chequeo que da PASS sobre el esqueleto vacío no cuenta (SIN_EVIDENCIA).
- **Gemma propone datos mejor que código:** los niveles en coordenadas (y no dibujados) sacaron al paso de niveles de sus fallas. El harness arma el `.js`.
- **Los nombres que cambian a mitad de camino** son el error que más se repite después del tamaño fijo (`state`/`estado`, `{r,c}` vs `.fila`).

## La propuesta: TDD es un ORDEN DE PASOS, no una Skill

Una Skill es un saber hacer dentro de un paso. TDD es una secuencia, y la secuencia la controla el harness. En cada paso Gemma propone y el sistema controla:

| # | Paso | Clase | Gemma escribe | El harness hace |
|---|---|---|---|---|
| 1 | contrato | data | JSON: forma del estado + lista de acciones `{nombre, params, qué hace}` a partir de las features | valida (identificadores válidos, cada feature tiene al menos una acción, sin duplicados) y **fija los nombres**: todos los pasos siguientes los reciben escritos |
| 2 | pruebas | data | JSON de **ejemplos**, no código: `{acción, antes, args, espera}` | los convierte en pruebas ejecutables. **Rojo:** las corre contra un esqueleto que no hace nada; un ejemplo que pasa sobre el esqueleto no prueba nada y se descarta. Verifica que cada acción tenga al menos un ejemplo y que los campos existan en el contrato |
| 3 | lógica | logic | `js/logica.js` con el contrato | **Verde:** la juzga con sus ejemplos + las pruebas generales del Standard (lógica pura, devuelve un estado nuevo, no modifica el que recibe) |
| 4–6 | pantalla, dibujo, controles | screen / render / wiring | igual que en grilla | igual que en grilla |
| 7 | Validation | — | — | criterios holdout que ningún paso vio |

**Separación de funciones:** el paso 2 no ve código y el paso 3 no ve el razonamiento del 2, solo los ejemplos que pasaron el rojo. Es lo mismo que en MicheLab: quien escribe no se valida a sí mismo.

**Por qué el paso 1 también ayuda con los nombres:** si el harness escribe los nombres (del estado, de las acciones, de los campos) y todos los pasos los reciben iguales, se achica el espacio donde aparecen `state`/`estado` o `{r,c}`/`.fila`. Esto se puede medir.

## Riesgos (para medir, no para discutir)

1. **Ejemplos con la expectativa equivocada.** La lógica correcta fallaría. Hay que saber cuántos ejemplos de Gemma están mal antes de usarlos como compuerta.
2. **Ejemplos flojos:** pasan el rojo pero no atrapan errores reales.
3. **Contexto:** contrato + ejemplos tienen que entrar en 16k junto con el resto del pedido.

## Primer experimento (barato y con verdad conocida): en grilla, no en web/app

En grilla ya tenemos lo que en una webapp no hay: **pruebas buenas (las del harness) y ~100 versiones de `reglas.js` de los bancos, cada una con su veredicto.** Eso permite medir el paso 2 solo:

1. Gemma escribe ejemplos para `crearEstado`/`mover`/`ganado` (paso "pruebas", k=5 por juego).
2. **¿Son correctos?** Se corren contra un `reglas.js` de referencia que pasa todas las pruebas del harness. Un ejemplo que falla ahí tiene la expectativa equivocada (riesgo 1).
3. **¿Atrapan errores?** Se corren contra las ~100 versiones del banco. Por cada versión que el harness marca rota, ¿algún ejemplo de Gemma también la marca? (riesgo 2). Y al revés: versiones buenas que los ejemplos marcan como rotas.
4. Resultado: dos números por condición. Esos números dicen si el paso 2 sirve como compuerta.

Si los números dan bien, se arma el Standard `web/app` por archivos con los pasos 1–7, usando como piloto una app real.

## Lo que haría falta construir

- Paso de clase `data` "pruebas" + conversor ejemplo → prueba ejecutable (como `levelsFromSpecs`).
- Esqueleto "que no hace nada" para el rojo (generado desde el contrato).
- Medidor del experimento: ejemplos × versiones del banco → matriz de acuerdos con el harness.
- Después: Standard `web/app/…` con el paso "contrato".
