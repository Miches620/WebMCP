| Documento | Etapas de Proyecto |
|-------|-------|
| Version | 0.1 |
| Estado | Borrador (reconstrucción). Sin oficializar por Governance |
| Propósito | Definir las etapas de madurez de un proyecto en MicheLab y el horizonte de decisiones que cada etapa habilita |
| Última actualización | 2026-09-24 |

Se prevé que este documento evolucione.
Los cambios deben estar respaldados por evidencia, no por preferencias.
***
# ProjectStage

## Naturaleza
#### Propósito
Definir la naturaleza de ProjectStage dentro de MicheLab.

#### Alcance
ProjectStage es un concepto fundacional propuesto.

Representa el nivel de madurez declarado de un proyecto y, con él, el horizonte de decisiones apropiado para esa etapa.

No es un componente arquitectónico.

No es un requisito del producto. Es una regla del laboratorio sobre cuánto trabajo corresponde a la versión actual de un proyecto.

Un proyecto se encuentra siempre en una única etapa.

#### Límites
ProjectStage:

- no describe el producto;
- no crea requisitos;
- no reemplaza el juicio profesional de los Specialists;
- no constituye un Standard mientras no exista evidencia que lo respalde.

#### Información permitida
- Naturaleza del concepto.
- Relación entre etapa y horizonte de decisiones.

#### Información prohibida
- Tecnologías concretas.
- Ejemplos.
***
## Responsabilidad
#### Propósito
Definir la responsabilidad exclusiva de ProjectStage.

#### Alcance
ProjectStage establece, para cada etapa, qué trabajo corresponde a la versión actual del proyecto y qué trabajo, siendo válido, pertenece a una etapa posterior.

Acota el horizonte, no las decisiones profesionales. Dentro del horizonte, los Specialists conservan la libertad de decidir cómo construir.

#### Límites
ProjectStage no:

- coordina la ejecución (Orchestrator);
- interpreta evidencia (Knowledge);
- oficializa conocimiento (Governance);
- evalúa artefactos (Validation);
- define requisitos de producto.

#### Información permitida
- Responsabilidad sobre el horizonte de trabajo.
- Separación respecto de otros componentes.

#### Información prohibida
- Procedimientos de coordinación.
- Criterios de oficialización.
***
## Alcance
#### Propósito
Definir el ámbito de aplicación de ProjectStage.

#### Alcance
Aplica a todo proyecto de MicheLab desde su creación.

Todo proyecto nuevo comienza en PROTOTYPE, salvo indicación explícita de Miche.

La etapa la declara Miche. Ningún Specialist, modelo ni componente la modifica por sí mismo.

En esta versión solo PROTOTYPE está definida. Las etapas posteriores (MVP y producto final) se reconocen, pero no se definen hasta que exista evidencia que las respalde.

#### Límites
No define el contenido de las etapas posteriores.

No define cuándo un proyecto debe cambiar de etapa: esa decisión es de Miche.

#### Información permitida
- Ámbito de aplicación.
- Regla por defecto.
- Autoridad sobre la declaración de la etapa.

#### Información prohibida
- Definiciones de etapas sin evidencia.
- Casos particulares.
***
## Principios estructurales
#### Propósito
Definir los principios que gobiernan ProjectStage.

#### Alcance
- Todo proyecto comienza en PROTOTYPE salvo indicación explícita de Miche.
- La etapa la declara Miche.
- La etapa acota el horizonte, no la libertad profesional.
- Lo que excede la etapa no es necesariamente incorrecto: se difiere, no se descarta.
- Lo diferido se conserva como decisión recuperable.
- La etapa nunca elimina un requisito explícito del proyecto.
- La etapa nunca crea un requisito que el proyecto no pidió.
- El proyecto evoluciona por incrementos: cada incremento se observa antes de definir el siguiente.
- La participación de una disciplina depende de la etapa. Ninguna disciplina queda excluida por definición.

#### Límites
Estos principios no definen procedimientos ni criterios de oficialización.

#### Información permitida
- Principios arquitectónicos.

#### Información prohibida
- Reglas editoriales.
- Procedimientos.
***
## Etapa PROTOTYPE
#### Propósito
Definir la etapa inicial de todo proyecto.

#### Alcance
PROTOTYPE es la etapa inicial. Su objetivo es una primera versión funcional que pueda ejecutarse, observarse y probarse para obtener feedback de Miche.

Criterio de pertenencia:

- Un trabajo pertenece a PROTOTYPE si es necesario para que la primera versión exista, pueda ejecutarse, o pueda observarse y probarse.
- Un trabajo pertenece a una etapa posterior si su propósito es operar, sostener, escalar, endurecer o automatizar el producto para su uso real sostenido, y la primera versión podría ejecutarse, observarse y probarse sin él.

La pertenencia la determina el criterio, no la presencia literal del trabajo en el pedido.

Cada disciplina participa con la profundidad necesaria para cumplir el criterio.

#### Límites
PROTOTYPE no fija una cantidad de tareas, de roles ni de tecnologías.

No define un nivel mínimo de calidad.

#### Información permitida
- Objetivo de la etapa.
- Criterio de pertenencia.

#### Información prohibida
- Listas de tecnologías o tareas.
- Ejemplos.
***
## Decisiones respecto de la etapa
#### Propósito
Definir cómo se clasifica un trabajo respecto de la etapa vigente.

#### Alcance
Todo trabajo de un plan se clasifica, respecto de la etapa vigente, como:

- IN_SCOPE: cumple el criterio de pertenencia de la etapa.
- DEFERRED: trabajo profesional válido que pertenece a una etapa posterior. No es un error ni una falta del Specialist. Se conserva como decisión recuperable.
- EXCESS: amplía el alcance del proyecto sin estar pedido ni ser necesario para la etapa, o contradice una restricción explícita del proyecto.

La etapa no modifica los conceptos GAP ni AMBIGUOUS.

Asunción de v0.1, pendiente de decisión: mientras la revisión de completitud no posea un veredicto propio para DEFERRED, el trabajo diferido se reporta bajo EXCESS indicando que se trata de trabajo diferido y no de un error.

#### Límites
Esta clasificación no determina qué Specialist interviene ni cuándo se ejecuta el trabajo diferido.

#### Información permitida
- Clasificación respecto de la etapa.
- Relación con las lentes de la revisión de completitud.

#### Información prohibida
- Procedimientos de revisión.
- Formatos de salida.
***
## Relaciones
#### Propósito
Definir la relación de ProjectStage con los componentes que lo utilizan.

#### Alcance
**Specialists.** Deciden con libertad profesional dentro del horizonte de la etapa. Deben discriminar el trabajo necesario para una primera versión testeable. Su seniority incluye saber qué corresponde ahora y qué después. Informan el trabajo diferido, no lo descartan.

**Orchestrator.** Mantiene la etapa como parte del contexto del proyecto y la incluye en las asignaciones. No la modifica.

**Completeness Review.** Usa la etapa como contexto para distinguir trabajo necesario, diferido y excedente. No fija ni modifica la etapa, y no la convierte en requisito del producto.

**Governance.** Toda oficialización o modificación de este documento sigue los criterios de Governance.

#### Límites
Ningún componente asume las responsabilidades de otro por su relación con ProjectStage.

#### Información permitida
- Relaciones de uso.
- Límites entre componentes.

#### Información prohibida
- Procedimientos operativos.
- Implementaciones.
***
## Ciclo evolutivo
#### Propósito
Definir cómo evoluciona un proyecto entre etapas.

#### Alcance
El proyecto avanza por incrementos. Se construye la versión correspondiente a la etapa vigente, Miche la observa y de esa observación surge la nueva intención: lo que falta o lo que cambiaría. Esa intención origina el siguiente incremento.

Cuando Miche considera suficiente el estado alcanzado, declara el cambio de etapa. En el MVP el proyecto se prueba en uso real. La evidencia obtenida alimenta la evolución hacia el producto final.

PROTOTYPE → iteraciones → MVP → uso real → Evidence → producto final

#### Límites
No define la duración ni el número de incrementos.

#### Información permitida
- Ciclo de evolución.
- Relación con Evidence.

#### Información prohibida
- Planes de proyecto.
- Criterios de oficialización.
***
## Bloque operativo
#### Propósito
Proveer la formulación normativa mínima de la etapa PROTOTYPE para los componentes que revisan trabajo.

#### Alcance
El siguiente bloque es la formulación normativa de la etapa PROTOTYPE para su consumo directo. Su contenido no puede diferir de las secciones anteriores.

<!-- BEGIN_STAGE_BLOCK -->
ETAPA DEL PROYECTO: PROTOTYPE

Esto es una regla del laboratorio. No es un requisito del producto y no está en el brief.

PROTOTYPE es la etapa inicial de todo proyecto. Su objetivo es una primera versión funcional que se pueda ejecutar, observar y probar para recibir feedback.

Criterio de pertenencia:
- Un trabajo pertenece a esta etapa si es necesario para que la primera versión exista, se pueda ejecutar, o se pueda observar y probar.
- Un trabajo pertenece a una etapa posterior (DEFERRED) si su propósito es operar, sostener, escalar, endurecer o automatizar el producto para uso real sostenido, y la primera versión funcionaría, se observaría y se probaría igual sin él.

Cómo aplicarlo al revisar:
1. La etapa no elimina ningún requisito explícito del brief. Todo lo pedido debe estar cubierto: GAP sigue aplicando igual.
2. La etapa no agrega requisitos. No la uses para reportar GAP.
3. Que una tarea no aparezca literalmente en el brief no la hace excesiva ni diferida: si es necesaria para construir, ejecutar o probar lo pedido, pertenece a esta etapa.
4. Una tarea DEFERRED es trabajo profesional válido, no un error. Se reporta bajo EXCESS y el detalle debe indicar que es trabajo diferido a una etapa posterior.
5. Si el brief pide expresamente algo que este criterio consideraría diferido, prevalece el brief.
6. Una ambigüedad se reporta igual que siempre. En esta etapa puede resolverse de forma provisional y reversible.
<!-- END_STAGE_BLOCK -->

#### Límites
El bloque no define formatos de salida ni esquemas de los revisores.

No nombra tareas, tecnologías ni casos.

#### Información permitida
- Criterio de pertenencia.
- Reglas de interpretación de la etapa.

#### Información prohibida
- Ejemplos.
- Listas de tecnologías.
- Instrucciones de formato de salida.
***
## Estado del documento

Borrador reconstruido a partir de las decisiones debatidas por el Consejo. No se localizó el diseño original.

No está oficializado por Governance y no posee evidencia experimental propia. La primera evidencia prevista proviene de experimentos controlados que comparen una misma revisión con y sin el bloque operativo.

Las modificaciones deberán realizarse mediante una nueva versión del documento y estar respaldadas por evidencia.
***
## Historial de cambios
### v0.1
- Reconstrucción inicial del concepto ProjectStage.
- Definición de la regla por defecto (PROTOTYPE) y de la autoridad de Miche sobre la etapa.
- Definición del criterio de pertenencia de PROTOTYPE y de las categorías IN_SCOPE, DEFERRED y EXCESS.
- Incorporación del bloque operativo para los revisores.
