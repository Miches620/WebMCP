# Historial de cambios

> Cada cambio con su evidencia de origen, qué se hizo y cómo se probó. Más nuevo primero (aprox.). Antes era la sección "Cambios desde el último commit". Movido desde el README el 06/10/2026, sin cambios de contenido. Volver al [README](../README.md).

**Punto 9: 1ª corrida con Gemma → receta v0.2 y métricas v0.2 (14/10)**
- *Corrida:* `build/bench/recipe_2026-10-14T15-27-26` (las mismas 4 fases para las dos condiciones, n=1). Quedó guardada como fixture en `build/fixtures/recipe_bench_2026-10-14.json`. Análisis completo: doc del proyecto `claude/evidencia_receta_atomizer_2026-10-14.md`.
- *Leída a mano:*
  - Con receta, las tareas `logica` salen como funciones puras con datos con nombre: crear (título, descripción), mover (id, origen, destino), editar, borrar, comentar. Desaparecen las elecciones de framework. 23 de 23 piezas válidas.
  - **Lo que no anduvo:** la regla suelta "los controles los pone el harness" se ignoró en 5 tareas `vista` (botón o icono, formulario, modal, confirmación).
- *Métricas v0.2 (tenían falsos positivos):*
  - "A/B" se cuenta aparte (`barras`), porque "oscuro/industrial" es un par, no dos caminos;
  - "e.g." sí cuenta como alternativa;
  - "mezcla" mira solo el título y descarta la maquinaria ("crear el componente", "actualizar el estado");
  - "información (autor, timestamp)" no es vaga;
  - "confirmación" cuenta como trabajo del harness;
  - nueva métrica `vista_con_controles`.
  - Con v0.2, la 1ª corrida da 7/18 tareas con problema sin receta y 7/23 con receta. La línea base del 12/10 sigue en 5/16.
- *Receta v0.2:*
  - la restricción de controles va **dentro** de la definición de `vista` ("NO incluye botones, campos, formularios, modales ni confirmaciones");
  - `logica` = una acción del usuario, y mostrar en pantalla es `vista` (F2.6 venía mal etiquetada);
  - `datos` = 2 o 3 ejemplos por lista, la pantalla nunca arranca vacía (F1.3 salió vacía; el Standard pide ejemplos).
- *Bench:* `--phases` acepta también el fixture, y al final imprime el comando para repetir con las mismas fases.
- *Probado:* `test_recipe` 36/36, con la 1ª corrida real como regresión: `vista_con_controles` = 5 (F2.4, F3.4, F3.5, F3.7, F4.5).

**Punto 9: receta del Standard para el Atomizer + campo "pieza" (14/10) — receta web/app/estado v0.1 (DRAFT)**
- *Por qué:* el Atomizer partía las fases sin consultar ningún Standard. En el Kanban del 12/10, 5 de 16 tareas traían señales de problema: "ej. drag-and-drop o botón" (F2.5), "componente o modal" (F3.4), "placeholders para metadata" (F1.3)… El Specialist recibía decisiones abiertas y trabajo que en este Standard hace el harness.
- *Decisión de Miche (14/10):* "ANTES atomizer generaba las tareas sin tener un Standard de consulta. HOY ya lo tenemos". Y sobre arrastrar: el Standard **no lo prohíbe** (nunca lo prohibió: "arrastrar puede ir además, nunca en vez del botón"). El "sin arrastrar" estaba en mi borrador de la receta y se sacó. Pendiente: que el harness genere arrastrar a partir del plan de controles.
- *Qué se hizo:*
  - `standards/web/app/estado/recipe.mjs`: solo datos. Cuatro piezas (datos, logica, vista, estilo), cada una atada a pasos reales del Standard (`PIEZA_STEPS`), y 6 reglas que salen del Standard (una acción = una tarea "logica"; los controles los pone el harness; arrastrar puede sumarse con el botón siempre; un texto o número por dato; campos con nombre; sin "X o Y"). Unos 1.250 caracteres.
  - `profiles/web/app/profile.mjs` → `atomizerRecipe`. `registry.mjs`: `standard` y `atomizerRecipe` los pone el tipo más específico que declara Standard. web/game (grilla) **no** hereda la receta de estado.
  - `atomic_engine_v5.js` (core): si el profile trae receta, el prompt la suma antes de SALIDA y el formato pide `"pieza"`. Sin receta el prompt queda igual que antes, byte a byte. `normalizeAtomicTask` guarda `pieza`, y una subtarea re-atomizada hereda la de su madre. El core no sabe de qué Standard es la receta: lee solo `piezas` y `text`.
  - `build/recipe_metrics.mjs` y `build/recipe_bench.mjs`: miden la salida cruda del Atomizer **sin** y **con** receta sobre las MISMAS fases (TechLeader las arma una vez y quedan guardadas). Señales que mide: alternativas, trabajo del harness, campos vagos, acciones mezcladas, pieza válida.
- *Ojo:* desde este cambio, la UI usa la receta en todo proyecto web/app. Si la medición sale peor, se apaga sacando una línea del profile.
- *Probado:* `build/test_recipe.mjs` 25/25 (incluye la línea base real: Kanban del 12/10 = 16 tareas, 5 con señales). Se probó el bench contra un LM falso: fases → sin → con → tabla. Falta la corrida real con Gemma.

**Corrida con v0.4.2 (14/10, `2026-10-14T13-44-34`): el aviso de XSS funciona**
- *Antes:* la corrida `2026-10-13T08-11-39` salió con v0.4.1, porque la v0.4.2 no había llegado bien al disco (ver nota). Pasos de Gemma idénticos, SEG-1 FAIL: es la línea base sin aviso.
- *Con v0.4.2:* dibujo 1er intento igual que siempre (innerHTML en contenido y comentarios) → aviso "escribe los textos del estado como HTML… usá textContent" → **reintento 1 correcto**: Gemma cambió los tres lugares a `textContent` (dejó comentarios `// CORRECCIÓN: Usar textContent para evitar XSS`). **SEG-1 PASS.** El resto igual: 7 PASS / 1 FAIL (R3) / 1 SIN_EVIDENCIA (R7), compuerta 6/6.
- *Costo:* 1 reintento (79 s, unos 1.300 tokens de prompt más: 2.474 contra 1.552). Pico de la sesión: 4.213 tokens.
- *Lectura:* el circuito acordado el 12/10 anda de punta a punta: el profile de tema detecta y el aviso al autor corrige. Una corrida no alcanza para decir que siempre lo corrige (n=1).
- *Nota de proceso:* la escritura al disco del 13/10 dejó `standard.mjs`, `test_controls.mjs` y `CAMBIOS.md` con su versión anterior, sin que se notara. Desde el 14/10, después de cada escritura se vuelven a leer los archivos y se comparan byte a byte.

**Seguridad, el aviso vuelve al autor: sonda de dibujo con trampa de HTML (13/10) — Standard web/app/estado v0.4.2**
- *Por qué:* SEG-1 (Validation, profile de tema) detecta el XSS al final, pero el arreglo es de quien escribió el código (decisión del 12/10). Tiene que enterarse mientras construye, no después.
- *Qué se hizo:* después de sus chequeos de siempre, la sonda del paso de dibujo vuelve a dibujar con cada texto del estado (lo que escribe una persona; los ids no se tocan) convertido en HTML con una trampa (`<img … onerror>`). Si aparece como elemento o se ejecuta, el paso tiene un problema que no rompe el archivo, se reintenta y el aviso es: "dibujar escribe los textos del estado como HTML (innerHTML…): si una persona escribe "<img src=x onerror=...>" se ejecuta código. Pasó con: "…". Mostrá cada texto con textContent…". Después vuelve a dibujar el estado de verdad.
- *A propósito, el pedido inicial a Gemma NO cambia.* Así se mide por separado: (1) si Gemma lo corrige con el aviso, que es la próxima corrida; (2) después, con la Skill de Frontend, si lo hace bien al primer intento.
- *Con el dibujo real de la 6ª/7ª corrida:* aviso en "Diseñar arquitectura inicial del sistema", "Admin" y "Revisar API endpoints…" (contenido y comentarios con innerHTML). Las etiquetas no, porque ahí usó textContent.
- *Probado:* `test_controls` 29/29 (3 nuevos: dibujo real → aviso; textContent → sin aviso; la pantalla queda bien después de la trampa). Sin cambios en el resto.

**Validation profiles POR TEMA: web/seguridad v0.1 con SEG-1 (XSS) (12/10)**
- *Evidencia:* en la 7ª corrida (`2026-10-12T21-30-27`, v0.4.1), probando la app como una persona, escribir `<img src=x onerror=alert()>` en "Editar tarjeta" **ejecutó código**: `dibujo.js` arma el texto del usuario con `innerHTML`. Ningún chequeo lo veía.
- *Decisión de Miche (12/10):* la seguridad no va en el profile de un tipo (web/app), porque cruza todos los tipos. Los Validation profiles tienen **dos ejes**: **tipo** (web → web/app → web/game) y **tema** (seguridad; después accesibilidad, rendimiento…). Un profile de tema se suma solo a todo proyecto de su plataforma, no es elegible y no da roles. Hay tres cosas distintas:
  - escribir código seguro → Skill del Role del autor;
  - revisar si es seguro → Validation profile de tema;
  - trabajo de seguridad como fase propia (login, permisos, backend) → un Specialist de seguridad, que se crea cuando haya un proyecto con ese trabajo.
- *Qué se hizo:*
  - `profiles/web/seguridad/profile.mjs`: solo datos, lo carga también el navegador.
  - `profiles/web/seguridad/validation.mjs`: Node + Chromium.
  - `profiles/registry.mjs`: `CONCERNS` y `concernsFor(resolved)`.
  - Core (`run_build.mjs`): corre los profiles de tema después de los requisitos. Sus criterios van aparte (`evidence.concerns`), en una sección propia de la consola y en la línea final ("por tema: SEG-1 FAIL"). No son requisitos del usuario y no cambian el conteo de requisitos.
- *SEG-1 `text_stays_text`:* por cada campo de texto visible, escribe un texto con HTML (en todos los campos del grupo), aprieta el botón del grupo y mira:
  - **FAIL** si el HTML se volvió elementos o se ejecutó código;
  - **PASS** si se ve tal cual, como texto;
  - **SIN_EVIDENCIA** si el texto no volvió a aparecer.
  No lee el contrato ni sabe de dominios: solo campos, botones y la página. Sirve también para formularios de landing.
- *Resultado con la 7ª corrida real:* **SEG-1 FAIL** en "Agregar comentario", "Editar tarjeta" y "Agregar tarjeta". "Agregar etiqueta" no, porque ahí Gemma usó `textContent`: el chequeo es preciso.
- *Probado:* `test_seguridad` 10/10 (nuevo): registro de los dos ejes, innerHTML → FAIL, textContent → PASS, sin campos → SIN_EVIDENCIA, formulario de landing, y la corrida real (fixture `real_kanban_c6`). Sin cambios en el resto.
- *Falta:* que el aviso vuelva al autor. En el paso de dibujo, la sonda puede probar el estado con un texto con HTML y decirle a Gemma "usá textContent". Después, una Skill del Role de Frontend para web/app, medida con y sin.

**6ª corrida real (v0.4.0) + v0.4.1: un destino sin "origen" no es contexto (12/10)**
- *Corrida (Gemma, Project23, `2026-10-12T20-41-59`):* **los 6 pasos OK al primer intento, por primera vez.** Gemma usó `controlesDe("cards", …)` y `controlesDe("columns", …)` como pedía el contrato. Lógica 32/32. Validation 7 PASS / 1 FAIL / 1 SIN_EVIDENCIA y compuerta 6/6. Unos 8 minutos de Gemma en total.
- *PASS falso que encontró la revisión:* R2 "Mover". El contrato de esta corrida es `moverTarjeta(tarjetaId, nuevaColumnaId)`, sin columna de origen. La regla v0.4.0 tomaba el primer id del tipo padre como contexto, así que el botón movía la tarjeta **a la misma columna**. La lógica la sacaba y la volvía a poner al final, y cambiaba `last_updated`: la pantalla "cambiaba" y `action_changes` aprobaba.
- *v0.4.1:* un id del tipo de un ancestro es contexto solo si **el ejemplo del contrato** es justo el ancestro donde está el elemento del ejemplo. Si no, es un destino: un `<select>` que no ofrece el lugar donde ya está el elemento. Con el contrato de la 6ª: mover → elección y borrar → contexto. Con el de la 4ª no cambia nada (origen = contexto, destino = elección).
- *Probado con los archivos reales de la 6ª corrida (fixture `real_kanban_c6`):* con su `acciones.js` (v0.4.0) la tarjeta queda en la misma columna; con v0.4.1 cambia de columna y el desplegable ofrece solo las otras 2. `test_controls` 26/26 (6 nuevos). Sin cambios en el resto.
- *Lección (candidata a Knowledge, 1 caso):* "algo cambió en la pantalla" no alcanza para aprobar una acción. Un cambio de orden o de fecha cuenta como cambio. Validation todavía no tiene cómo saber que mover tiene que dejar el elemento en otro lugar.

**Punto 8 (segunda parte): los controles de cada elemento los arma el código (12/10) — Standard web/app/estado v0.4.0, files_engine v0.11.1**
- *Evidencia:* 5ª corrida (`2026-10-12T19-25-55`, v0.3.0, controles del harness). Los pasos 1 a 4 salieron idénticos a la 4ª, byte a byte (temperatura 0, mismo pedido), y Validation dio lo mismo que la simulación sin Gemma: 1/6 acciones. Todo lo que falla está en dibujo.js, que en las 5 corridas falló los 3 intentos: botón de mover que falta, `data-labelid` que falta, campos ocultos o en otro `div`.
- *Idea (lo mecánico lo escribe el código, lo visual el modelo):* un paso nuevo, `acciones` (clase `written`), escribe `js/acciones.js` con `controlesDe(tipo, elemento, estado)`, que devuelve los campos y el botón de cada acción de ese elemento. Gemma, en dibujo, muestra los textos de cada elemento y agrega `controlesDe(...)` adentro. **No dibuja botones ni campos.**
- *Plan de controles (`controls.mjs`), sale de la forma del estado y del contrato, sin nombrar dominios:*
  - **Tipos:** listas cuyos elementos tienen `id`, con su padre.
  - **Dueño:** el primer id de la acción dice en qué elemento van sus controles; sin ids, la acción es general ("app").
  - **Contexto:** un id del tipo de un ancestro sale de dónde está el elemento.
  - **Elección:** cualquier otro id es un `<select>` con los elementos de ese tipo (sin el propio, si es del mismo tipo).
  - **Campos:** `<input>` visibles; si el elemento ya tiene ese dato, arrancan con él (editar).
  - Probado con 5 formas: lista, contador, el Kanban real (3ª y 4ª corrida) y una biblioteca de 3 niveles con socios aparte, que el código nunca había visto.
- *controles.js (v0.3.0) ahora sale del mismo plan:* dueño y contexto desde `b.dataset`; elecciones y campos desde el grupo del botón.
- *Motor v0.11.1 (universal):* clase de paso `written`, un archivo que escribe solo el código. Se juzga con `st.check` del Standard si lo da; si no, alcanza con que exista. Un paso sin pedido para el modelo lo escribe siempre el código, aunque se pida `--gemma-writes-all`.
- *Pedidos a Gemma que cambian:* el texto del contrato (archivos, acciones sin detalles de botones, la regla de `controlesDe`), pantalla (estilo para `.ctl-controles`, `.ctl-accion`, `.ctl-boton`, `input` y `select`) y dibujo (los tipos con sus acciones y un ejemplo de la forma). El pedido de dibujo bajó de unos 2.260 a unos 1.550 tokens. La sonda de dibujo ahora dice: "faltan los controles de: X (agregá controlesDe("tipo", elemento, estado)…)". Las clases `ctl-` no cuentan como "sin estilo".
- *Verificación sin Gemma:* con la lógica real de la 4ª corrida y un dibujo simple que solo muestra textos y agrega `controlesDe`, la compuerta da **6/6** (antes 1/6). El build completo con un LM falso que contesta lo de la 4ª corrida da **7 PASS / 1 FAIL / 1 SIN_EVIDENCIA** (antes 3/5/1). El FAIL es R3 `counter_on_action` (el traductor pidió un contador de comentarios); el SIN_EVIDENCIA es R7, el estilo, que sigue sin un chequeo que discrimine.
- *Probado:* `test_controls` 20/20 (nuevo), motor 34/34 (3 nuevos), Standard 52/52 (6 tests ajustados a los textos nuevos, sin perder lo que cuidaban). Sin cambios: grilla 104, catálogo 53, app 24, calls_gate 22, profiles 30, landing 21/28/68, piloto 8.
- *Falta:* la corrida real con Gemma. Riesgo anotado: si el estado tiene una forma rara (listas sin `id`, ids sueltos), el plan avisa en `warnings` y ese id va como campo; no adivina.

**Punto 8 (primera parte): un paso puede escribirlo el código y no el modelo (12/10) — files_engine v0.11.0, Standard web/app/estado v0.3.0**
- *Evidencia:* 4 corridas del Kanban, y en las 4 falló la unión entre dibujo.js y controles.js. Cada vez Gemma inventó otra forma: formularios fijos → `data-*` en camelCase → grupos ocultos → formularios vacíos y campos en otro `div`. Ya estaba anotado como idea: "si la 4ª trae otra variante, que controles.js lo escriba el harness".
- *Motor (universal, decisión de Miche: el harness no puede quedar hecho a la medida de un Kanban):* cualquier paso de cualquier Standard puede declarar `write(ctx) → { archivo: contenido }`. El motor no llama al modelo, escribe eso y lo juzga con el mismo juez de la clase de paso. No reintenta, porque el mismo código da lo mismo: si quedan problemas, vienen de un paso anterior. El motor no sabe de qué dominio es (el test que lo vigila sigue en verde). `--gemma-writes-all` (`opts.noWrite`) hace que todo lo escriba el modelo, para comparar. Cada paso queda marcado con quién lo escribió (`by`: harness / modelo).
- *Standard web/app/estado v0.3.0:* `controles.js` lo escribe el harness desde el contrato (`controlesJs`): un `case` por acción, ids desde `b.dataset` (en minúsculas, con `Number` si el ejemplo es número) y campos desde el elemento padre del botón. Si falta un campo, la acción se llama con `undefined` y la compuerta de Validation lo dice tal cual. Si el campo está vacío, no se hace nada. **Los pedidos a Gemma de los pasos 1 a 4 no cambian.** Grilla no cambia: sus controles los sigue escribiendo Gemma (pedidos idénticos byte a byte).
- *Medición sin Gemma (dibujo.js reales de las corridas 3ª y 4ª + controles generado):* el resultado no cambia (1/6 acciones en las dos), porque esos dibujos no cumplen el contrato. El diagnóstico sí cambia: casi todos los problemas señalan el dato que falta en dibujo (`titulo = undefined`, `labelId = undefined`, `targetColumnId = undefined`) en vez de "ningún botón llama a la acción". **Falta la prueba real:** saber si Gemma corrige dibujo cuando es la única pieza libre y el aviso es así de preciso.
- *Probado:* motor 31/31 (3 nuevos), Standard 52/52 (4 nuevos: generador, llamadas en Chromium con un dibujo que cumple, campo faltante → `undefined` sin error de JS, otra app sin params). Sin cambios: grilla 104, catálogo 53, app 24, calls_gate 22, profiles 30, landing 21/28/68, piloto 8.

**Punto 7: Validation usa la sonda de llamadas del Standard (12/10) — Standard web/app/estado v0.2.3, calls_gate v0.1**
- *Evidencia (Kanban, 4ª corrida, `2026-10-12T17-09-25`, Standard v0.2.2):* R4 "Etiquetar" dio **PASS falso**. El botón no traía `data-labelid`, entonces `agregarEtiqueta(estado, "card1", undefined)` agregaba una etiqueta vacía y la pantalla "cambiaba". El paso de controles del Specialist sí lo había detectado ("falta labelid"). **El juez final era más blando que el control interno.**
- *Qué se hizo:*
  - **Sonda de llamadas** (`page_tools.runCallsProbe`): además de qué métodos se llaman, guarda con qué argumentos (`args`, resumidos: textos, números, `__undefined__`, `__NaN__`, `__object__`) y desde qué control (`via`). Lo que ya devolvía no cambia.
  - **Standard v0.2.3:** declara lo que Validation puede leer (`validation.contract`, `calls`, `actions`, `idValues`). Es la misma convención de grilla (`standard.validation`). **Los pedidos a Gemma no cambian.**
  - **`profiles/web/app/calls_gate.mjs`:** por cada acción del contrato, FAIL en sus requisitos si nadie la llama, si en ninguna llamada llegan todos los datos (vacío, `undefined`, `NaN` en un id, o un id que no existe en el estado) o si después no se dibuja. Un `NaN` en un campo que escribe el usuario no cuenta: la sonda escribe "Prueba" y un campo numérico dibujado como texto da `NaN`.
  - **Core (`run_build.mjs`):** gancho genérico `B.validationGates` como cuarta compuerta, junto a piezas visibles, componentes que dibujan y las compuertas del profile. Va a `evidence.validation.standard_gates` y a la consola.
- *Independencia (decisión de Miche del 12/10, `action_changes` independiente del contrato):* es una **compuerta**: nunca suma un PASS. El contrato solo dice qué acción va con qué requisito. Si Gemma se olvida de una acción, esto no aprueba nada.
- *Resultado con las corridas reales (re-validadas, sin Gemma):*
  - 4ª corrida: de 4 PASS / 4 FAIL a **3 PASS / 5 FAIL**. R4 pasa a FAIL ("data-accion=agregarEtiqueta llama a App.agregarEtiqueta con labelId = undefined"). R2 ahora dice el motivo verdadero ("ningún botón llama a App.moverTarjeta"; antes "clic ✏️ Editar → no cambia nada"). R6 Borrar sigue PASS.
  - 3ª corrida: R1–R5 FAIL y R6 PASS, que es lo que de verdad pasaba en la app.
- *Probado:* `test_calls_gate` 22/22, nuevo (juez sin navegador; lista bien hecha → PASS sin compuertas, que no da FAIL falsos; tres versiones rotas; las dos corridas reales como fixtures `real_kanban_c3/c4`). Sin cambios: catálogo 53, app 24, Standard 48, motor 28, grilla 104, profiles 30, landing 21/28/68, piloto 8.
- *Mismo día:* `lm_stream` mide el prefill (ms hasta el primer texto) y `files_engine` guarda por intento los tokens reales que informa LM Studio (`prompt_tokens`, `completion_tokens`, `reasoning_tokens`, `context_used`, `context_limit`, `prefill_ms`). Antes solo se guardaba la estimación largo/3,2. 4ª corrida con 12k de contexto: pico de 5.694 tokens (47%), entre 15 y 70% de la respuesta es "pensamiento", y la estimación da entre 10 y 18% de más. El contexto del motor sale de `WEBMCP_CONTEXT` (16000 por defecto; LM Studio está en 12000).

**Kanban real, 3ª corrida (v0.2.1) → v0.2.2 (12/10): campos ocultos y "mover" sin destino**
- *Corrida (Gemma, Project23):* los ids en minúsculas funcionaron (`data-cardid`, `b.dataset.cardid`). Validation pasó de 1 a **5 PASS** / 3 FAIL. Contrato con 1 reintento (otra vez las features de estilo); lógica 32/32 (el 1er intento trajo app.html y el aviso de "archivo de otro paso" lo corrigió). **Dibujo y controles fallaron los 3 intentos.**
- *Causas (probadas con los archivos reales en Chromium):*
  - **Campos ocultos:** Gemma dibujó un ícono (✏️ 💬 🏷️) y, aparte, un grupo con `display:none` (campo + "Guardar") que nada muestra. "Crear" tenía su textarea oculto. En la app real **solo Borrar funciona**.
  - **Mover sin destino:** un solo botón "➡️" sin la columna destino (ni Gemma sabía cuál poner).
  - **PASS falso de Validation:** `action_changes` llenaba el textarea oculto de "Crear", que una persona no puede escribir. R1 pasaba en falso.
  - **Traductor:** usó `click_reveals` para comentar y etiquetar. No aplica a una acción.
- *v0.2.2:*
  - **Sonda de dibujo:** vale cualquier botón de la acción (ícono + "Guardar"), se queda con el que menos le falta. Un campo o un botón oculto no cuenta. Mensaje propio: "están ocultos (display:none) y nada los muestra: dibujá el campo VISIBLE al lado de su botón".
  - **Contrato y pedido:** si un id no es del elemento donde está el botón (un destino), se dibuja un botón por cada valor posible. Los campos van visibles, sin abrirse con otro botón. A la falta de id se le suma la misma pista.
  - **Contrato (paso 1):** el pedido dice que las features de aspecto (colores, estilo, sombras, hover) van en `se_ve`, para ahorrar el reintento.
  - **Validation:** `action_changes` y la sonda de llamadas completan solo campos **visibles**. `click_reveals` sale del traductor de web/app por archivos (si llega, se convierte en `action_changes`).
  - Con los archivos reales de la 3ª corrida: dibujo da los 2 problemas correctos, controles los 5 que no se pueden usar, y Validation da R1–R5 FAIL y R6 PASS, lo que de verdad pasa en la app.
- *Probado:* Standard 48, app 24, catálogo 53, motor 28, grilla 104, profiles 30. Grilla: pedidos idénticos byte a byte.
- *Lectura honesta:* cada corrida arregla la falla anterior, pero Gemma inventa otra forma de interfaz (formularios fijos → `data-*` en camelCase → grupos ocultos). La regla "botón y campo visibles juntos" es simple y comprobable. Si la 4ª corrida trae otra variante, la idea anotada es que **controles.js lo escriba el harness** (sale entero del contrato) y que Gemma haga solo el dibujo.

**Kanban real, 2ª corrida (v0.2.0) → v0.2.1 (12/10): data-* en minúsculas y Validation sin formularios**
- *Corrida (Gemma, Project23):* contrato con 1 reintento: las features 7–9, de estilo, no estaban cubiertas, porque el snapshot es anterior a `estilo`. Lógica 32/32 (reparación de `crear` y `moverTarjeta`). Pantalla ✓, solo título y `#app`. **Dibujo y controles fallaron los 3 intentos.** Validation 1 PASS / 7 FAIL.
- *Causa (verificada en Chromium):* **el HTML pasa los `data-*` a minúsculas.** Dibujo escribió `data-cardId="…"` en `innerHTML`, que queda como `dataset.cardid`. La sonda y controles buscaban `b.dataset.cardId`, que daba `undefined`. Error de diseño del contrato, no de Gemma.
  - En dibujo: "falta el id" en todos los botones.
  - En controles: las acciones se llamaban con `undefined` y devolvían el mismo estado. Como el `if (nuevoEstado !== estado)` de Gemma no redibujaba, aparecía "después de App.x no se llama a dibujar".
  - En Validation: Borrar sin efecto.
- *v0.2.1:*
  - **Los ids van en `b.dataset.<param en minúsculas>`** (en HTML, `data-cardid`). Así lo dicen el contrato, el pedido de dibujo, la llamada exacta de controles y la sonda. Hay una prueba con `innerHTML` y `data-itemId`. Con el `dibujo.js` real de esta corrida, la sonda ya no da ningún problema.
  - **Clases sin estilo, más fina:** con el CSS real, `.tag` (que se pinta con `.etiquetas span`) y `.tarjetas` daban un aviso falso. Ahora solo avisa si una clase sin estilo **se parece** a una del CSS que nadie usa (`kanban-card` ↔ `card`, el caso de la 1ª corrida) o si menos de la mitad de los elementos tiene alguna clase con estilo.
- *Validation (decisión de Miche: chequeo nuevo, independiente del contrato):*
  - **`action_changes`** (Validation profile web/app): elige el control que mejor coincide con las palabras. Las palabras pesan por orden (el verbo primero), se comparan por raíz de 6 letras y con unos pocos sinónimos de acciones. También lee `title`, `aria-label` y `data-accion`. Completa los campos del mismo elemento padre (cambia también los que ya traen texto, para que "Editar" cambie algo), aprieta y mira que la pantalla cambie.
  - **Traductor de web/app por archivos** (`APP_FILES_TRANSLATOR`): sin chequeos de formulario; las acciones van con `action_changes`. Si el modelo igual elige uno (`translator.accept`), `postprocessChecks` lo cambia por **un** `action_changes`, con palabras del requisito y de sus params. Lo decide el código. Con `--legacy-components` sigue el traductor de antes.
  - **FAIL falsos de la corrida, arreglados:** hover no encontraba `class="tarjeta"` (ahora entra `[class*=tarjet]`); "comentarios" no matcheaba "Añadir Comentario" (ahora una palabra de 6 letras o más matchea sin la s final). Cambia para todos los profiles: los tests del catálogo dan 53/53.
- *Probado:* grilla, pedidos idénticos byte a byte. Tests: Standard 45, app 24, catálogo 53, motor 28, grilla 104, profiles 30. LM falso: errores sembrados en su paso, y Validation con chequeos de formulario convertidos (R1–R4 PASS).
- *Pendiente anotado:* los snapshots viejos no traen `estilo`, y el contrato gasta un reintento en cubrir las features de estilo.

**Kanban real con web/app/estado v0.1 → v0.2 (12/10): los errores eran de coordinación entre pasos**
- *Corrida (Gemma, Project23, 9 features):* contrato bien al 1er intento (6 acciones). Lógica 32/32 con el arreglo de `state` → `estado` y 4 reparaciones por función. Pantalla y dibujo ✓. **Controles falló los 3 intentos con los mismos 4 problemas.** Validation 2 PASS / 6 FAIL. Tiempo 13 min.
- *Por qué falló (mirando los archivos):* ninguno de los errores era de un solo archivo.
  - app.html tenía formularios fijos que necesitaban datos del estado: un `<select>` de columnas vacío ("lo llena JS", nadie lo llenaba) e `<input type="hidden">` con el id de la tarjeta que nadie completaba. El botón "Añadir Comentario" de dibujo tenía `data-accion="setCommentCardId"`, que controles no maneja. Controles no podía arreglarlo: el problema estaba en app.html y dibujo.js, y **el harness reintentaba el archivo equivocado**.
  - styles.css usaba `.card` y `.column`; dibujo.js puso `.kanban-card` y `.kanban-column`. El estilo no se aplicaba → R8/R9 FAIL (real).
  - Mover era "arrastrar": no había botón y no se probaba.
  - R6 "Borrar": **FAIL falso** de Validation, que descartaba el `confirm()`.
- *v0.2 (decisiones de Miche):*
  - **app.html solo lleva el título y `#app`.** Si trae `<form>`, `<input>`, `<button>`, `<select>` o `<textarea>`, es un problema (`forbidTags` en el kit). Todo lo que depende del estado lo dibuja `dibujar()`.
  - **Toda acción es un botón** que dibuja `dibujar()`, con `b.dataset.accion`. Se sacó "control" del contrato. Arrastrar puede ir además del botón, nunca en vez de él.
  - **El harness separa los params:** si el ejemplo de un param es el id de un elemento del estado, es un **id** y va en `b.dataset.<param>`. Si no, es un **campo** que escribe el usuario: `<input data-campo="<param>">` en el mismo elemento padre que el botón. Un campo con una lista de ejemplo se descarta (un elemento por vez). Un contador de arriba (`nextCardId`) no cuenta como id.
  - El contrato y los pedidos de dibujo y controles dicen, por acción, el botón, los ids, los campos y la llamada exacta: `App.x(estado, Number(b.dataset.id), b.parentElement.querySelector('[data-campo="texto"]').value)`.
  - **Sonda de dibujo:** cada acción tiene su botón, con sus ids y sus campos. Y **clases sin estilo**: si `dibujar` usa clases que el CSS no tiene y el CSS tiene clases que nadie usa, es un problema. Las clases del CSS se le pasan a la sonda (en `file://`, Chromium no deja leer `cssRules`) y van en el pedido de dibujo ("usalas").
  - **Validation acepta `confirm()`** (framework.mjs). Afecta a todos los profiles. Tests del catálogo 53/53; hay que mirarlo en la próxima landing.
- *Probado:* grilla, pedidos idénticos byte a byte (18 + 18 + 7). LM falso: Kanban con errores nuevos sembrados (form en app.html, campo que falta, `.kanban-card` sin estilo, borrar sin conectar), cada uno en su paso. Contador limpio. Tests: Standard 42, motor 28, catálogo 53, grilla 104, app 20.
- *Lección:* cuando el error de un paso viene de otro archivo, reintentar el mismo paso no sirve (3 × 100 s perdidos). La solución fue de diseño: que no exista la coordinación (todo lo dibuja `dibujar()`). Queda anotado para el motor: **un problema puede culpar a otro paso**.

**Paso 2 del borde: web/app por archivos con su propio Standard (12/10, `web/app/estado` DRAFT v0.1.0, motor v0.10.1)**
- *Por qué (Miche, 12/10):* "pulamos eso antes de web/app". web/app seguía con el motor por componentes de landing (todo en una respuesta). Diseño aprobado: "construilo así".
- *Lo nuevo de una app:* el contrato **no se conoce de antemano** (un Kanban y un contador no tienen las mismas acciones). Entonces el paso 1 lo propone Gemma **como datos** y el harness lo valida, igual que los niveles en grilla.
- *Los 5 pasos:*
  1. **contrato** (data): `contrato.json` con `estado` (inicial, con ejemplos) y `acciones` (`nombre`, `params`, `ejemplo`, `hace`, `control`, `features`, `cambia`) + `se_ve`. El harness arregla los nombres (`"agregar tarea"` → `agregarTarea`), saca `estado` de `params`, descarta las que no sirven (reservadas, repetidas, `ejemplo` que no coincide) y exige que cada feature (menos las de estilo) esté cubierta. Escribe `js/datos.js` con `ESTADO_INICIAL`.
  2. **logica** (logic): `const App = { crear(), <acciones> }`. Pruebas **generales** que salen del contrato: `crear()` = copia profunda de `ESTADO_INICIAL`; cada acción con su `ejemplo`: devuelve un estado, no modifica el que recibe, conserva las claves, hace algo (o lo hace después de otra acción: `reiniciar`), y el estado son solo datos (Kanban v1: `[object HTMLDivElement]`). Cada acción se prueba con su propia copia del estado inicial: si `crear()` comparte el objeto, lo dice solo la prueba de `crear`. Lo que Gemma dijo en `cambia` se **observa** y se guarda (`observations`), **no bloquea**.
  3. **pantalla** (screen): `app.html` + `styles.css`, con `#app`; ningún botón con `disabled`.
  4. **dibujo** (render): `dibujar(estado)` en Chromium: dibuja algo, los textos del estado para personas se ven, no aparece `[object …]`, ni `undefined`/`NaN`.
  5. **controles** (wiring): sonda nueva `runCallsProbe` (en `page_tools`, la puede usar Validation): envuelve `App.*` y `dibujar`, completa los campos y aprieta cada botón como una persona. Problemas: acción de botón/formulario que ningún control llama (Kanban v1: "+ Añadir Columna" muerto), acción sin `dibujar` después, formulario que recarga la página (falta `preventDefault`).
- *Motor v0.10.1 (genérico):* `S.contract` puede ser función del contexto; `st.resolve(ctx)` completa un paso con lo que dieron los anteriores; `st.check` en datos da problemas que no rompen; `st.observe` en logic guarda observaciones. Kit web: `noDisabled` en screen, `calls` en wiring.
- *Profile web/app v0.2:* `standard: "web/app/estado"`, motor universal + `WEB_FILES`. `--legacy-components` vuelve al motor de landing. Landing no se tocó.
- *Probado:*
  - Grilla: pedidos a Gemma **idénticos byte a byte** (build, `--skills`, banco: 18 + 18 + 7) con un LM falso, después de todos los cambios.
  - LM falso con **dos apps distintas**: Kanban con errores sembrados (feature sin cubrir, `crear` que comparte el objeto, `moverTarea` que modifica lo que recibe, botón con `disabled`, `[object Object]` en pantalla, formulario sin `preventDefault`, borrar sin conectar): cada uno lo encontró su paso y se corrigió en el reintento o con la reparación por función. Contador limpio: todo al primer intento. Validation 6/6 y 5/5.
  - Tests: Standard 37 (incluye "no nombra ninguna app" y la sonda de llamadas en Chromium con tres versiones de controles), motor 28, app 20, grilla 104.
- *Sin evidencia todavía:* todo es diseño. Primera corrida real: el Kanban (Project23/24). Arrastrar y teclado no se prueban en controles.

**Cierre de la rama reglas (12/10): medición final con reparación, y temperature 0 no es determinista**
- *Corrida final:* reglas, grilla v0.1.8 + motor v0.9.9, k=5, 3 juegos, `--repair`.

| de 15 | sin | con recorre |
|---|---|---|
| bien al 1er intento | 2 | 8 |
| **bien al final** | 9 | 10 |
| rotas al 1er intento | 13 | 3 |
| min por muestra | 8,5 | 5,4 |

- **Hallazgo: con temperature 0, LM Studio no responde siempre igual.** Con la misma configuración (`bench.json` igual salvo `repair`), el mismo pedido y la misma referencia, `Boxworld sin #1` dio dos `reglas.js` distintos en la corrida de las 00:12 y en la de las 02:11. En la misma condición, "con recorre", el 1er intento dio 3/15 en una y 8/15 en la otra. La hipótesis más probable es la caché de pedidos de llama.cpp: según lo que se corrió antes, cambia cómo se procesa el pedido y aparecen diferencias numéricas chicas. **No está comprobada.** Consecuencias:
  - La comparación de b13/b14 (idénticos) fue suerte o dependía de que no hubiera nada antes en la caché. No hay que contar con el determinismo.
  - El banco ya mide una distribución (k referencias), así que sigue sirviendo. Pero con 15 muestras por condición, **dos corridas iguales pueden diferir en 5 de 15**. Hay que sumar corridas antes de sacar conclusiones.
- *Sumando las corridas comparables (30 muestras por condición):*
  - bien al 1er intento: sin **4/30** (13 %), con recorre **11/30** (37 %);
  - bien al final, con reparación: sin **19/30**, con recorre **17/30**: **sin diferencia**;
  - tiempo por muestra: con la Skill, un 36 % menos (5,4 contra 8,5 min); rotas al 1er intento: 3 contra 13 de 15 en esta corrida.
- *Lectura:* `recorre-el-nivel-que-recibe` sirve para **primer intento, tiempo y robustez**, pero **no cambia el resultado final**: la reparación por función ya cubre ese error. Queda DRAFT con esa evidencia.
- *Cierre de la rama:* lo que queda en reglas son errores de lógica de `mover` (empujar, caja contra pared) que varían de muestra a muestra. Seguir acá tiene rendimiento decreciente. Se pasa a web/app con lo aprendido.

**El borde del harness: motor universal + kit de la plataforma web (12/10, files_engine v0.10.0)**
- *Por qué (Miche):* antes de pasar a web/app, "¿tenemos un harness y un Validation que funcionen de forma universal?". No: `files_engine.mjs` importaba 7 módulos de `profiles/web/` (brief, plan de componentes, reparación de sintaxis, `fixRedeclare`, chequeos, reglas de app, sondas de página), y 3 de sus 5 clases de paso eran de web.
- *Qué:*
  - `harness/files_engine.mjs` = **motor universal**: corre los pasos, intentos, puntaje, `needs`, arreglos, banco y la clase `data`. Recibe `opts.platform`; sin plataforma falla con `PLATFORM_REQUIRED`.
  - `harness/js_tools.mjs` y `harness/kinds_js.mjs` = **lenguaje JavaScript** (no web): cargar y probar lógica en Node, clase `logic`.
  - `profiles/web/specialist/files_kit.mjs` = **plataforma web**: pedido de sistema, contexto del pedido, clases `screen`/`render`/`wiring`, arreglo previo de un `.js`, armado de `index.html` + `styles.css` y `baselinePage`. Qué globales no puede usar la lógica pura (`document`, `window`) también lo dice la plataforma.
  - Interfaz de una clase de paso: `make` (juez/arreglo/reparación), `store` (guarda el resultado) y `frozen` (banco). Así el motor ya no tiene `if (kind === "screen")`.
  - web/game le pasa `platform: WEB_FILES` al motor.
- *Sin cambios de conducta, verificado:* con un LM falso que guarda cada pedido, los pedidos a Gemma de un build, un build con `--skills` y un banco con reparación son **idénticos byte a byte** antes y después (18 + 18 + 7 pedidos). También salen iguales la `app/`, la evidencia y los resultados del banco. Con temperature 0, eso quiere decir que Gemma va a responder lo mismo.
- *Tests nuevos (motor 25):* el harness no importa nada de `profiles/`, `standards/` ni `roles/`; no nombra cosas de web (`document`, `styles.css`, `index.html`, `playwright`…); sin plataforma → `PLATFORM_REQUIRED`. Grilla 104, roles 11.
- *Lo que todavía no es universal (anotado):* web/app y landing siguen con el motor viejo por componentes. Validation tiene el framework separado de los profiles, pero el framework es web (Chromium). "Universal" se demuestra recién con una segunda plataforma.

**Mediciones hacia adelante (12/10): ejemplos v0.3 y reglas con grilla v0.1.8 + motor v0.9.9**
- *Ejemplos v0.3 (respuestas nuevas):* 88 de 104 válidos (85 %), 75 correctos (85 % de los válidos). La retro daba 89 y 73: **se confirma**.
  - **Pero un solo ejemplo malo arruina la compuerta.** En las 8 muestras con al menos uno mal, la compuerta rechaza las 52 versiones buenas. En las 6 muestras con todos correctos: se escapan entre 7 y 15 rotas de 97, y aparecen 6 a 10 "falsas alarmas" de 52.
  - Esas "falsas alarmas" con ejemplos correctos son versiones que el harness da por buenas pero que se comportan distinto que la referencia en un ejemplo de Gemma. **Pueden ser huecos de las pruebas del harness**, no errores de los ejemplos. Hay que mirarlas.
  - Con solo los ejemplos correctos, atrapa 1147 de 1261 rotas (91 %).
- *Reglas, 1ª respuesta (k=5, 3 juegos):*

| de 15 | sin | con recorre |
|---|---|---|
| bien al 1er intento | 2 | 3 |
| rotas | 13 | **5** |
| problemas (promedio) | 8,3 | 4,3 |

  - La retro (16/30) **no se confirma**: salen 3/15. La retro miraba respuestas viejas, y con k=5 el ruido es grande. Lo que sí se repite en todas las corridas: la Skill baja mucho las rotas (13 → 5).
  - El arreglo de variables se usó en 4 muestras (`state` → `estado`). Las 4 dejaron de romperse, pero ninguna pasó todo.
  - Lo que queda con la Skill ya no son nombres ni tamaños: son **errores de lógica de `mover`**. Empuja mal la caja (6), mueve la caja contra la pared (5), deja `@`/`$` en el mapa (5).

**Ejemplos v0.3 y prueba del mapa más flexible (12/10, grilla v0.1.8)**
- *examples_bench, 2ª corrida (v0.2, en coordenadas):* 82 de 100 ejemplos se descartaron igual, y 5 de los 18 válidos tenían la expectativa mal. Revisando los descartes, **casi ninguno era un ejemplo malo**: el validador usaba las reglas de un nivel jugable.
  - 47: cantidad de cajas distinta de la de objetivos, o sin cajas. Un ejemplo de "moverse a un piso libre" no necesita cajas.
  - 25: posiciones en el borde. El `tamaño` que puso Gemma no coincidía con sus coordenadas.
- *examples v0.3:*
  - Sin `tamaño`: el harness arma el nivel justo para que entren todas las posiciones, las del nivel y las de `espera`, con un borde de pared alrededor.
  - No exige cantidades; solo que nada se pise.
  - Sin objetivos, se ignora la parte `ganado`, no el ejemplo entero.
- *Retro con las mismas 14 respuestas de Gemma:* válidos **18 → 89 de 100**; correctos 13 → **73** (82 % de los válidos); las 14 muestras tienen al menos un ejemplo correcto. Las expectativas equivocadas que quedan (16) son de **simulación**: Gemma calcula mal dónde termina una caja o el jugador después de dos flechas. Eso no lo arregla el formato. Antes de usar los ejemplos como compuerta hay que resolver cómo se filtran.
- *grilla v0.1.8, decisión de Miche:* la prueba "mapa sin cajas ni jugador" acepta cada fila como string **o como array de caracteres**. En el juego se lee igual (`mapa[f][c]`). Lo que se mira es el contenido: sin `@` ni `$`, con los objetivos.
- *Retro de reglas (75 primeras respuestas, arreglo de variables + v0.1.8):* con recorre **10/30 → 16/30** bien. El cambio del mapa sumó 3, no 10: varias de esas respuestas con array también tenían otro error.
- Ojo: el banco de examples_bench se recalcula con las pruebas actuales. Con v0.1.8 cambian los veredictos de "buena" o "rota", así que la próxima corrida no se compara número a número con las anteriores.
- Tests: grilla 104.

**Arreglo determinista de variables sin declarar (12/10, files_engine v0.9.9, decisión de Miche)**
- *Por qué:* con `--repair`, lo que la reparación por función no arregla es `state` adentro de `mover(estado, …)` (8 de 9 reparaciones de mover fallan). Igual que `fixRedeclare`, lo arregla el harness sin Gemma.
- *Qué (`harness/undeclared.mjs`, general):* si las pruebas dicen "X is not defined", X no está declarado en ningún lado y lo usa una función que tiene **un solo** nombre propio (parámetro o declaración local) que es su traducción, se renombra X solo en esa función y solo como identificador. Hay dos formas de encontrar la traducción:
  - un **alias del Standard**: `S.aliases`, en grilla `estado: ["state"]`, `objetivos: ["goals", "objectives"]`…;
  - **casi el mismo nombre**: distancia de edición ≤ 2, con 6 letras o más (`objectivos` → `objetivos`).

  No toca textos, comentarios ni `e.state`. Con dos candidatos no adivina. El cambio se queda solo si bajan las pruebas que fallan. Corre antes de juzgar, en todos los intentos (como `fixRedeclare`), así que el banco lo cuenta dentro del "1er intento". El banco anota `arreglos` por muestra.
- *Evidencia retrospectiva* (las 75 primeras respuestas de reglas de los bancos 2 y 3, con las pruebas de grilla v0.1.7): mejora 23 de 75 y pasan todo:

| | sin | con recorre | con recorre + nombres |
|---|---|---|---|
| bien antes | 1/30 | 9/30 | 2/15 |
| bien con el arreglo | 3/30 | **13/30** | 3/15 |

- *Lo que queda después del arreglo:* en 16 muestras falta **una sola** prueba, "mapa sin cajas ni jugador": en 10, `mapa` es un array de caracteres en vez de strings; en 5 deja `@` y `$` en el mapa; en 1 pisa los objetivos.
- Tests: motor 22 (4 nuevos).

**Dos lecturas del 11/10: la reparación cambia el resultado; los ejemplos dibujados no sirven (examples v0.2)**
- *Banco de reglas con `--repair` (k=5, 3 juegos):*

| de 15 | sin | con recorre-el-nivel-que-recibe |
|---|---|---|
| bien al 1er intento | 0 | 3 |
| **bien al final (con reparación)** | **10** | 7 |
| min por muestra | 7,7 | 5,4 |

  - La reparación por función **arregla sola el error de tamaño fijo** (crearEstado: 21 de 24 reparaciones bien). Por eso "sin" termina bien en 10 de 15.
  - Con la Skill, lo que queda es `state is not defined` adentro de `mover` (parámetro `estado`, cuerpo con `state.mapa`). La reparación de `mover` falla en 8 de 9 intentos: es la función más larga. 6 de las 8 muestras que no llegan terminan con ese error.
  - Lectura: la Skill ahorra un 30 % del tiempo y da respuestas buenas al primer intento, pero **no mejora el resultado final**. 10/15 contra 7/15 puede ser ruido. Lo que importa en el pipeline es el final, no el primer intento. Para mejorar el final hay que atacar lo que la reparación no puede arreglar.
- *Ejemplos de Gemma (examples_bench v0.1, k=5, banco de 149 versiones: 43 buenas y 106 rotas):*
  - **103 de 115 ejemplos se descartaron por forma**: filas de largos distintos (45), distinta cantidad de `$` y `.` (23). De los 12 válidos, 6 tenían la expectativa corrida en una posición. Es lo mismo que pasó con los niveles en b8: **Gemma no puede dibujar ni contar caracteres.**
  - Bug del medidor: una muestra sin ejemplos válidos contaba como "rechaza todo" y llenaba las falsas alarmas (43/43 en 6 muestras). Sin esas 6, con un solo ejemplo correcto por muestra: atrapa 484 de 636 rotas (76 %) y **0 falsas alarmas**. Es una señal: hasta un ejemplo bueno sirve como compuerta.
  - → **examples v0.2:** el ejemplo va en coordenadas (`tamaño`, `jugador`, `cajas`, `objetivos`, `paredes`), igual que `niveles.json`, y el harness arma el nivel con `levelFromSpec`. examples_bench v0.2 cuenta aparte las muestras "sin compuerta". Tests: grilla 100.

**"Pruebas primero", experimento 1: ¿sirven los ejemplos de Gemma como compuerta? (11/10)**
- *Diseño:* `docs/DISENO_pruebas_primero.md`. TDD como orden de pasos. Gemma escribe EJEMPLOS como datos (nivel chico + flechas + lo que espera) y el harness los convierte en pruebas. No escribe código de prueba.
- *Standard:* `standards/web/game/grilla/examples.mjs` declara el formato, el pedido, el validador (descarta con el porqué: sin `espera`, filas de largos distintos, flechas que no existen), el corredor y el esqueleto que no hace nada (rojo). Queda en `S.examples`. **Todavía no es un paso del build.**
- *Medidor:* `build/examples_bench.mjs --k 5 --bank <carpetas> <run_dir> …`. Es general: lee `S.examples`. Por muestra mide:
  1. **¿Correctos?** Se corren contra la lógica de referencia (`fixtures/game_files_ok/js/reglas.js`, que pasa todas las pruebas del harness).
  2. **¿Atrapan errores?** Se corren contra un banco de versiones de `reglas.js` (las de los bancos por paso y de los builds), con el veredicto del harness recalculado con el Standard actual. Da 4 casilleros: rota y la atrapa / **rota y se le escapa** / **buena y la rechaza** / buena y la deja pasar. Se calcula con todos los ejemplos válidos (como se usaría de verdad) y solo con los correctos (el techo).
- *Límite conocido:* con este formato el rojo casi nunca descarta nada (el esqueleto devuelve `{}`, así que cualquier `espera` falla). Lo que de verdad mide si un ejemplo es flojo es el banco.
- Probado con un LM falso (ejemplos buenos, uno con la expectativa mal y dos con mala forma) y un banco de 3 versiones (buena, `state` sin declarar, tamaño fijo). Tests: grilla 99.

**Banco, 3ª corrida (11/10): las primeras respuestas buenas; se descarta nombres-del-contrato**
- *Corrida:* reglas, grilla v0.1.7 (sin `+`/`*`), k=5, 3 juegos, solo la 1ª respuesta. Condiciones: `sin`, `con:recorre-el-nivel-que-recibe` y `con:recorre…+nombres-del-contrato`.

| de 15 muestras | sin | con recorre | con recorre + nombres |
|---|---|---|---|
| **bien al 1er intento** | 0 | **3** | 2 |
| rotas | 15 | 9 | 10 |
| tamaño fijo | 11 | 0 | 0 |
| variable sin declarar | 5 | 6 | 9 |
| mapa que no es string | 1 | 4 | 8 |
| problemas (promedio) | 9,5 | 4,6 | 6,3 |

- *recorre-el-nivel-que-recibe:* se confirma. El error de tamaño fijo baja de 11 a 0, y aparecen las **primeras 3 respuestas que pasan todas las pruebas sin reparar** (las 3 en Boxworld).
- *nombres-del-contrato v2:* no ayuda. Con ella hay más variables sin declarar (`state`: 4 → 8) y una respuesta buena menos. Con 15 muestras la diferencia puede ser ruido, pero no hay nada a favor después de 3 mediciones (v1: 7→7; v2: peor). → **Descartada.** Se conserva con su evidencia en `roles/web-game/descartadas/`, junto con su placebo.
- *El punto flojo que sigue: nombres que se cambian a mitad de camino.* Depósito no pasó ninguna: en 4 de 5, la función auxiliar de `mover` devuelve `{r, c}` y el resto del código lee `.fila` y `.col` → `undefined`. Junto con `state`/`estado`, `objectivesSet`/`objetivos` y `objectivos`, es siempre lo mismo: Gemma mezcla nombres en inglés y en español, o se inventa uno y después usa otro.

**Banco, 2ª corrida (11/10): la Skill recorre-el-nivel-que-recibe sirve**
- *Corrida:* reglas, k=5, `sin` vs `con:recorre-el-nivel-que-recibe` (solo esa Skill), 3 juegos, solo la 1ª respuesta (~2,7 min por muestra).

| muestras con… (de 15) | sin | con la Skill |
|---|---|---|
| tamaño fijo (`Cannot read properties of undefined`) | 9 | **0** |
| variable sin declarar (`state is not defined`…) | 5 | 7 |
| no lee `+` y `*` | 6 | 15 |
| rotas (no carga / tira error) | 13 | 7 |
| problemas (promedio) | 9,1 | 5,3 |

- *Lectura:* la Skill hace lo que dice en los 3 juegos: el error de tamaño fijo desaparece (9 → 0), con 5 referencias distintas por juego. Es la primera Skill con evidencia de ese tipo.
- *Lo que queda al descubierto:* `+` y `*` falla en las 15. Sin la Skill no se veía porque la función se rompía antes. Variable sin declarar: 7 de 15 (lo que intentaba `nombres-del-contrato`).
- *Bien al 1er intento:* sigue 0/15 en las dos condiciones. Si se resuelven `+`/`*` y la variable sin declarar, "con" pasaría en unas 8 de 15 (las que hoy tienen solo el problema de `+`/`*`).
- *Decisión de Miche: que el harness no use `+` ni `*` → Standard web/game/grilla v0.1.7.* El modelo propone y el sistema controla: si el formato no los tiene, reglas no tiene que leerlos.
  - `levelFromSpec` descarta el nivel si una caja o el jugador empiezan sobre un objetivo, y dice por qué. El paso de niveles lo pide ("ninguna caja ni el jugador empiezan sobre un objetivo"). `validateLevels` marca `*`/`+` si aparecen.
  - El contrato ya no los nombra: el formato es `# . $ @` y espacio.
  - Se sacó la prueba "lee `*` y `+`". De ella queda lo que sí importa: el mapa son strings con solo `#`, ` ` y `.` (prueba nueva "mapa sin cajas ni jugador").
  - Costo: no hay niveles que empiecen con una caja ya acomodada.
  - Las entradas fijas del banco (niveles de los 3 builds "sin") no tienen `*` ni `+`: siguen sirviendo.
  - Tests: grilla 95, catálogo 53, app 20, motor 18, roles 11, profiles 30.

**Banco por paso, 1ª corrida: reglas (11/10) → files_engine v0.9.8, step_bench v0.2, Skill candidata**
- *Corrida:* reglas, k=5, sin/con (todas las Skills), entradas fijas de los 3 builds "sin" (Boxworld, Depósito, Invernadero) = 30 muestras, con reparación por función (~10 min por muestra).

| reglas | bien al 1er intento | bien tras reparar | roto |
|---|---|---|---|
| todos sin | 0/15 | 2/15 | 7/15 |
| todos con | 0/15 | 1/15 | 13/15 |

- *Lo principal:* **reglas no sale bien al primer intento en ninguna de las 30.** Es el punto flojo.
- *Causa más repetida (20 de 30):* la función que arma el estado recorre un tamaño fijo, `for (r < 10)` o `for (r < 9)`, que sale del tamaño del mapa del brief. Las pruebas del harness usan niveles chicos (3x5) → `Cannot read properties of undefined (reading '0' / 'split')`. En el juego real andaría (todos los niveles son NxN), pero el contrato pide que sirva para cualquier nivel, y Validation también prueba con uno chico (`game_scenario`). Otras causas: `{row}` en vez de `{fila}`, `state` sin declarar, `+` y `*` sin leer.
- *Dos fallas del banco/harness que la corrida destapó:*
  1. **La línea neutra al final tapaba el pedido.** En Invernadero "sin", Gemma escribió `js/dibujo.js` las 5 veces, y en Depósito una vez `juego.html`. → step_bench v0.2: la línea va al **principio** y el pedido del paso sigue siendo lo último que lee Gemma. Las 30 muestras de esta corrida no se pueden usar para comparar sin/con.
  2. **El harness juzgaba otro archivo como si fuera el pedido.** `extractFile` caía "por extensión" en `js/dibujo.js` y decía "reglas.js no puede usar document". → v0.9.8: un bloque con nombre de otro archivo del proyecto no se toma, y el problema lo dice ("Trajiste js/dibujo.js: ese archivo es de otro paso…"). Esto también vale para los builds.
- *Más rápido:* el banco mide por defecto solo la primera respuesta de Gemma (`--repair` para incluir la reparación). Por muestra pasa de ~10 min a ~1–3 min.
- *Medir una Skill sola:* condición `con:<id>[+<id>]`. Skill candidata nueva: `recorre-el-nivel-que-recibe` (DRAFT, logic), con su placebo-7. Ojo: "con" (todas) ahora son 7 Skills.
- *Sobre Skills:* esta corrida no dice nada a favor ni en contra. Las 6 Skills no evitan el error principal porque ninguna habla de él.
- Tests: motor 18, roles 11, grilla 92.

**Banco por paso (10/10, files_engine v0.9.7)**
- *Por qué:* el control de Skills mostró que 1 build por condición no mide nada. Un cambio en un paso se agranda en los siguientes, y cada build es 1 sola muestra de 20–30 min.
- *Qué:* `build/step_bench.mjs --step reglas --k 5 --conds sin,con <run_dir> …`
  - Cada `run_dir` es un build anterior. De ahí salen el brief, el plan, los archivos de los pasos previos (`app/`) y las respuestas crudas del paso de datos. Esos pasos **no se le piden a Gemma**: son entradas fijas.
  - Corre solo el paso pedido, k veces por condición. Cada muestra lleva al final una línea neutra distinta ("Referencia del pedido: BX-1042"…). La diferencia entre muestras de una misma condición es el ruido. Las referencias son las mismas en todas las condiciones, así que se comparan de a pares.
  - Mide con las pruebas del harness, sin Validation: bien al 1er intento, bien tras la reparación por función, roto (no carga o tira error), cantidad de problemas y minutos. También los problemas más repetidos.
  - Retoma: una muestra con `result.json` no se vuelve a correr (`--out <dir>`). Muestra afuera, condición adentro: si LM Studio se pone lento, le toca a todas por igual.
- *Motor (v0.9.7):* `opts.bench` (paso, entradas fijas, intentos, línea final), `opts.temperature` y `first_problems` en cada intento (lo que dio Gemma antes de reparar). Sin `opts.bench`, el pedido es idéntico al de antes.
- *Probado* con un LM falso: 3 respuestas distintas según la referencia (bien, `state` sin declarar → reparada, sintaxis rota). El paso de datos no se llama, `--skills` y `--placebo` llegan al pedido, y retoma. Motor 17 (2 nuevos: paso inexistente y entradas faltantes fallan antes de llamar a Gemma).

**Resultado del control de Skills (10/10): el ruido es tan grande como el efecto**
- *Corridas (Gemma real; Boxworld y Depósito "sin/con" son las del 08/10, Boxworld ya con el FAIL falso del avatar sacado):*

| | sin | con Skills | placebo |
|---|---|---|---|
| Boxworld | 7/0 · 17 problemas · 25 min | 7/0 · 16 · 17 min | **3/4** · 38 · 31 min |
| Depósito | 2/5 · 59 · 31 min | 7/0 · 11 · 17 min | **1/6** · 13 · 21 min |
| Invernadero (juego nuevo) | 7/1 · 8 · 19 min | **6/2** · 17 · 24 min | — |

- *Los FAIL son reales* (revisados en evidence.json): placebo Boxworld, el jugador sin fila (`undefined,2`) y el juego se bloquea al pasar de nivel; placebo Depósito, `Reglas` no queda definido y dibujo/controles no se corren; Invernadero con Skills, al ganar no muestra "¡Nivel completado!" (error de JS). R8 de Invernadero (sin y con): a 390 px el tablero de 9x9 desborda (26 y 7 px).
- *Lectura:*
  1. **El placebo no es igual a "con Skills":** en Boxworld y Depósito salió peor que "sin". Agregar texto neutro movió Boxworld de 7/0 a 3/4. El efecto mariposa existe y es grande, para los dos lados.
  2. **En los dos juegos donde nacieron, las Skills le ganaron al placebo** (14 PASS contra 4). Pero las Skills se escribieron mirando los errores de esos dos juegos: es como medir con el examen que se usó para estudiar.
  3. **En el juego nuevo, las Skills no ayudaron** (6/2 contra 7/1). Los errores que apuntan casi no aparecieron (flecha 1→0, grilla 1→1, el resto 0).
  4. Las veces que aparece cada error también se mueven con el placebo: `piezas-aparte-del-mapa` en Depósito 9 sin → 0 con → 0 placebo; `nombres-del-contrato` en Boxworld 7 → 7 → 0. Bajar ese número con 1 corrida no prueba nada.
- *Conclusión:* no hay evidencia de que las Skills sirvan en general. Quedan DRAFT. Lo más importante que se aprendió es otra cosa: **1 build por condición no alcanza para medir nada** (tampoco los arreglos del harness medidos con un build antes y uno después). Con temperature 0 la variación no viene del sorteo, viene de cualquier cambio en el pedido.
- *Siguiente:* medir por paso y no por build entero. Mismo paso, mismo contrato, varias versiones del pedido (k placebos distintos = muestras del ruido), sin/con. Es más barato (un paso tarda 1–3 min, un build 20–30) y da una distribución en vez de un número. Es la misma herramienta que hace falta para el Benchmark de modelos.

**Control de las Skills (09/10): placebo + 3er juego (Invernadero)**
- *Por qué:* la 2ª vuelta mostró mejora, pero con `temperature 0` cualquier texto agregado cambia la salida. Hay que ver si mejora por lo que dicen las Skills o solo por agregar texto.
- *Placebo (`--placebo`):* `roles/web-game/placebo/` tiene 6 fichas, una por Skill (`par:`), en el mismo paso, con el mismo encabezado "HABILIDADES" y largo parecido (±15%). El texto es de estilo (comillas, sangría, camelCase) y no toca ningún error conocido. `loadRole(id, { placebo: true })` las carga con status PLACEBO; `compare_runs` muestra la columna como "placebo".
  - Lectura: si placebo ≈ con Skills, la mejora era el efecto mariposa. Si placebo ≈ sin, la mejora es de las Skills.
  - Ojo: la corrida "con" del 08/10 usó `nombres-del-contrato` v1. La v2 se mide en el 3er juego.
- *3er juego:* `build/snapshots/project27_invernadero_snapshot.json`. Misma familia (empujar piezas en grilla), otro tema (jardinero, macetas, canteros), otro tamaño (9x9) y otra paleta (tonos tierra), con al menos 5 niveles. Se corre sin y con Skills.
- *Traductor web/game:* `click_changes` se queda solo si nombra un botón (siguiente, reiniciar, botón…). Antes había una lista de piezas (avatar, operario, caja…), o sea Boxworld y Depósito metidos en el profile; con "jardinero" o "maceta" se volvía a romper. Tests: grilla 92, roles 11.

**Experimento de Skills, 2ª vuelta (08/10): con Skills, mejor en los dos juegos**
- *Corridas (Gemma real, mismo código, solo cambia `--skills`):*

| | min | intentos (niv/regl/pant/dib/ctrl) | problemas | Validation |
|---|---|---|---|---|
| Boxworld sin | 25,3 | 2/2/3/2/2 | 17 | 6 PASS / 1 FAIL |
| Boxworld con | 17,4 | 2/3/1/1/1 | 16 | 6 PASS / 1 FAIL |
| Depósito sin | 31,0 | 3/3/3/3/3 | 59 | 2 PASS / 5 FAIL |
| Depósito con | 17,5 | 3/2/1/2/1 | 11 | 7 PASS / 0 FAIL |

- *Por Skill (veces que apareció su error, sin → con):* `botones-habilitados` Boxworld 1→0; `flecha-sin-tapar` Boxworld 1→0; `grilla-que-no-se-estira` v2 Boxworld 1→0, Depósito 3→0; `piezas-aparte-del-mapa` Depósito 9→0; `siempre-jugable` Boxworld 1→0; **`nombres-del-contrato` Boxworld 7→7: sin efecto** (v2: deja de nombrar la palabra prohibida `state`; hipótesis: nombrarla la sugería). Quedó anotado en cada Skill (`medicion`).
- *El FAIL de los dos Boxworld* era falso: el traductor puso `click_changes` con "avatar" en R1 (el avatar no es un botón). Ahora el postproceso de web/game saca `click_changes` cuyas palabras son piezas del juego (avatar, jugador, caja…). Con eso, los dos Boxworld quedan 7/0.
- *Cuidado con la lectura:* es 1 corrida por condición y con `temperature 0`: cualquier texto agregado al pedido cambia la respuesta de Gemma ("efecto mariposa"), así que parte de la mejora podría venir de cambiar el pedido y no del contenido de las Skills. Para separarlo: una corrida "placebo" (mismo largo de texto, sin contenido útil) y un 3er juego.
- *Lo que sí es claro:* en Depósito sin Skills, `crearEstado` devolvía el jugador indefinido y los 3 reintentos de reglas, dibujo y controles cayeron en cascada (59 problemas); con Skills, 11 problemas y 7 PASS. En Boxworld, las Skills de pantalla, dibujo y controles dejaron esos pasos en 1 intento.

**Primer experimento de Skills (07/10): salió peor, y por qué → files_engine v0.9.6, grilla v0.1.6, json_loose v0.2**
- *Boxworld con `--skills` (b15):* 2 PASS / 5 FAIL (b14 sin Skills: 7 / 0). Tablero de 28 px, injugable (Miche). Tres causas, y solo una es de las Skills:
  1. **Bug del harness:** `reglas.js` traía el comentario "No utiliza DOM ni window." y el lint de lógica pura buscaba `window.` en el texto con comentarios: los 3 intentos se rechazaron por eso y nunca se reportó el error real (`state.mapa` en `mover`). → el lint mira el código sin comentarios (`stripComments`).
  2. **Skill dañina:** `grilla-que-no-se-estira` v1 decía solo "width: max-content"; Gemma lo aplicó con celdas sin tamaño y la grilla se encogió a 28 px. Ni el Specialist ni Validation lo vieron (`looks_distinct` PASS, `layout_stable` "28px igual"). → Skill v2 pide primero celdas de tamaño fijo; pantalla, dibujo y Validation (`looks_distinct`, compuerta) dan problema si una celda mide menos de 12 px.
  3. **Cascada:** con `mover` tirando "state is not defined", controles se reintentó 3 veces. → si una prueba de la lógica TIRA un error, el paso queda roto y no se corre lo de abajo.
  - Lo que sí hicieron las Skills (1 corrida, señal débil): pantalla salió al primer intento sin `disabled` (b14: 3 intentos) y dibujo sin la variable tapada (b14: 2 intentos). `nombres-del-contrato` **no** evitó `state`.
- *Depósito (sin y con `--skills`):* se cortó en el paso de niveles (que no lleva Skills), idéntico en las dos: intento 1 = JSON sin la última llave; intento 2 = escribió `js/niveles.js` con strings (el reintento ya no mostraba el formato); intento 3 = coordenadas con corchetes de más (`[[1,2]]`). → `json_loose` v0.2 cierra lo que quedó abierto; el Standard acepta un nivel de corchetes de más; si falta `niveles.json`, el problema recuerda el formato. Con los textos reales: intento 1 se lee entero, intento 3 da 1 nivel válido.
- *Lectura:* el experimento todavía no mide las Skills: se cruzaron un bug nuestro y un formato frágil. Una Skill mal escrita empeora (grilla v1): por eso son DRAFT y se miden. Fixtures: `real_boxworld_b15_skills/`, `real_deposito_niveles_a0/a1/a2.txt`. Tests: grilla 90, catálogo 53, motor 15, json_loose 8.

**Paso 3: Role web-game con 6 Skills DRAFT + experimento con y sin (07/10, files_engine v0.9.5)**
- *Por qué (Miche):* "todos estos ajustes que hace el harness para que un validador sepa qué errores auditar, ¿no debería tenerlos el LLM en una skill?". Sin Skills, la única forma de aprender es por error (evidencia sobre relato, pero caro: un reintento por error, build tras build).
- *Qué:* `roles/web-game/` (Role DRAFT) con 6 Skills en Markdown, cada una nacida de un error que ya se repitió en builds reales: `nombres-del-contrato` (b8, b13), `piezas-aparte-del-mapa` (b9), `flecha-sin-tapar` (b9, b13), `siempre-jugable` (b11, b13), `botones-habilitados` (b3, b11, b12, b13), `grilla-que-no-se-estira` (b12, b13). Cada Skill dice a qué clase de paso aplica (solo entra en ese paso: 16k de contexto) y qué problema del harness la delata (`detecta`). `roles/registry.mjs` (loadRole, parseSkill). El motor suma las Skills del paso con `--skills`; **sin el flag el pedido a Gemma es idéntico al de b14**. `evidence.json` guarda `specialist.skills`. Profile web/game v0.4: `role: "web-game"`.
- *Medición:* `build/compare_runs.mjs` compara corridas: minutos, intentos por paso, problemas, Validation, y cuántas veces apareció el error de cada Skill. Segundo proyecto de la misma familia para no medir sobre una sola entrada (con temperature 0, Boxworld sin Skills ya se sabe: b14): `build/snapshots/project26_deposito_snapshot.json` (Depósito: 8x8, 4 niveles, operario, estilo Game Boy; mismas 25 tareas adaptadas).
- *Probado:* 8 tests de roles (cada Skill detecta el texto real del problema que la originó y solo ese; no nombran el contrato; cortas), 84 de grilla, 14 del motor; LM Studio simulado: con `--skills` cada paso recibe solo las suyas (lógica 3, pantalla 2, dibujo 1, controles 1, niveles 0).

**Boxworld b14 (07/10): primera corrida real con los Validation profiles**
- *Qué pasó:* 7 PASS / 0 FAIL / 1 SIN_CHEQUEO. El log muestra "Validation profile: web → web/app → web/game · Standard web/game/grilla v0.1.5", `looks_distinct` PASS (compuerta) y `layout_stable` PASS (468 px igual con el mensaje largo); `game_scenario` corrió y pasó (en el esqueleto, FAIL).
- *Hallazgo 1 — determinismo:* los 6 archivos de b14 son **idénticos** a los de b13 (mismos niveles, mismos errores de Gemma en el mismo orden, mismas correcciones). Con `temperature: 0` y la misma entrada, Gemma responde siempre lo mismo. Consecuencia: b13 + b14 no son 2 pruebas del Specialist sino 1; para medir si el método es robusto hacen falta entradas distintas (otro proyecto, otro tipo) o variar la temperatura a propósito. Lo que b14 sí prueba es el paso 2 (Validation nuevo sobre el mismo artefacto).
- *Hallazgo 2:* el traductor (Qwen) puso `game_scenario` en R1 y no en R2, que es el que pide "próximo nivel". Cambio: el postproceso de web/game agrega `game_scenario` a todo requisito que diga "próximo / siguiente nivel" o "avanzar de nivel" (lo decide el código, no el modelo). 83 tests de grilla.
- *Dato:* `reasoning_chars` confirma que Gemma "piensa" en un canal aparte: entre 1.200 y 11.000 caracteres por pedido; las reparaciones por función son las que más gastan (b9: respuestas vacías con tope 3000).

**Paso 2: Validation profiles por tipo que leen el Standard (06/10, catálogo v0.9)**
- *Por qué:* `check_catalog.mjs` era un solo archivo de 63 KB con chequeos de landing, app y juego mezclados ("una salvajada", Miche), y los chequeos de juego nombraban el contrato de Boxworld (`NIVELES`, `Reglas`, `#tablero`). Además b10–b12 mostraron que Validation miraba menos que el Specialist: 5 PASS con el juego invisible, con el avatar bloqueado al ganar y con el tablero deformado.
- *Qué:* **framework** (`validation/framework.mjs`: cómo se valida) + **un Validation profile por tipo**, junto a su tipo: `web` (`validation/validation_web.mjs`), `web/landing`, `web/app`, `web/game` (`<tipo>/validation.mjs`). Cada build usa solo la cadena de su tipo (`validationFor`). El de **web/game lee el Standard** (`standards/…/standard.mjs` → `validation`: niveles, lógica, tablero, escenarios, cómo se ve, estabilidad); sin Standard, esos chequeos dan NOT_APPLICABLE. Tres chequeos nuevos de juego: `game_scenario` (el traductor lo usa para "próximo nivel"), `looks_distinct` (siempre, **compuerta**) y `layout_stable` (siempre, informa). Las herramientas de página (`page_tools.mjs`) pasaron del harness a Validation: el Specialist y Validation usan el mismo código. `evidence.json` guarda `validation: { profile, standard, always }`.
- *Sin cambio de conducta (verificado):* el corte fue mecánico (cada caso del `switch` pasó tal cual a su profile, dentro de `do { } while (false)` para conservar los `break`); `test_check_catalog` 41/41 igual que antes con los fixtures del piloto, y todo lo demás igual (componentes 68, app 20, page_plan 21, file_diet 28, grilla 81, motor 14, profiles 30).
- *Probado (nuevo):* 52/52 en `test_check_catalog`: sin Standard → NOT_APPLICABLE; `web/landing` no tiene chequeos de juego; el profile de juego no nombra el contrato; `game_scenario` b11 → FAIL ("queda bloqueado"), b12 → PASS; `layout_stable` b12 → FAIL (huecos); `looks_distinct` b11 y b12 → PASS; el esqueleto vacío no pasa ninguno de los tres. LM Studio simulado de punta a punta: R2 con `game_scenario` PASS (esqueleto FAIL), compuerta y "informa" en el log.

**Boxworld b13 (06/10, motor v0.9.4 + grilla v0.1.5): 7 PASS / 0 FAIL por segunda vez**
- *Qué pasó:* los 5 pasos terminaron OK. Cada problema que apareció lo encontró un chequeo y se corrigió en 1 o 2 reintentos: niveles (cajas contra la pared, jugador sobre pared), `reglas.js` (`state` en vez de `estado`, el mismo error de b8, arreglado por función), pantalla (`disabled` en reiniciar y tablero que se estiraba con el mensaje), dibujo (variable `c` tapada) y controles (bloqueo al ganar, el que encontró Miche). Niveles más difíciles: 2, 6, 8, 10 y 20 empujes. Revisado aparte: el escenario "ganar y seguir" pasa y el tablero no cambia de tamaño con el mensaje largo.
- *Lectura:* ningún error de Gemma fue nuevo; todos ya tenían su chequeo. Es la primera vez que el build se repite sin intervención: n=2 (b12, b13).

**Miche jugó b12 → files_engine v0.9.4 + Standard grilla v0.1.5 (06/10)**
- *Evidencia de origen (Miche, captura):* al ganar un nivel el tablero se deformaba (franjas grises entre columnas) y volvía a la normalidad al reiniciar o pasar de nivel. Medido: el texto largo de #mensaje ("¡Nivel completado! Presiona 'Próximo Nivel'…") ensanchaba `main` de 408 px a 853 px; `#tablero` (grilla de columnas `1fr`, sin ancho propio) se estiraba igual y las celdas de 40 px fijos quedaban con huecos de 44 px. Al borrar el mensaje, todo volvía.
- *Cambio:* motor, paso `screen`: si el Standard declara `stable`, arma una grilla de prueba como la armaría el código de dibujo, mide, pone un texto largo en el elemento que cambia y mide otra vez; si la grilla cambia de tamaño o aparecen huecos, el problema va a styles.css con la pista (`width: max-content` o columnas fijas; `max-width` en el mensaje). Standard: `stable` en pantalla y una línea en el pedido.
- *Probado:* 81 tests de grilla (CSS real de b12 → problema con huecos; con `width: max-content` → estable; b11 con 600 px fijos → estable). Fixture `real_boxworld_b12/`.

**Boxworld b12 → Standard grilla v0.1.4 (06/10)**
- *Evidencia de origen (b12, Gemma real, motor v0.9.2):* **7 PASS / 0 FAIL / 1 SIN_CHEQUEO** (R8 estilo), primera vez sin FAIL. Mirado a mano y con el escenario nuevo: se ve (pared, piso, objetivo, caja y jugador distintos), se juega y "ganar y pasar al siguiente" pasa. Funcionaron los cambios de b10–b11: 5 niveles con el reintento que pide solo los que faltan, la prueba de `'*'`/`'+'` reparada por función con el mensaje nuevo (15/15), `disabled` en reiniciar detectado y corregido. Lo que quedó: el nivel 1 se ganaba con UNA flecha (`#  @$.   #`) y el chequeo `not_won_immediately` mandó a corregir `controles.js` 3 veces (~6 min) por un problema que era del nivel.
- *Cambio:* `winsInOneMove` en el Standard: un nivel que se gana con un solo movimiento se descarta y se explica; el pedido lo dice.
- *Probado:* 78 tests de grilla (nivel 1 real de b12 detectado).

**Miche jugó b11 → files_engine v0.9.3 + Standard grilla v0.1.3 (06/10)**
- *Evidencia de origen (Miche, jugando a mano):* b11 se veía y el avatar se movía y empujaba; **al ganar cualquier nivel el avatar quedaba bloqueado para siempre** (`controles.js` hacía `removeEventListener('keydown')` al ganar y `iniciarNivel()` nunca lo volvía a poner). Ningún chequeo jugaba más allá del nivel 1: ni el Specialist ni Validation lo podían ver.
- *Cambios:* motor, paso `wiring`: **escenarios** que declara el Standard (una partida corta con datos de prueba: teclas, clics, qué texto tiene que aparecer y qué tiene que cambiar), corridos en Chromium. Standard grilla: escenario "ganar un nivel y pasar al siguiente" con 2 niveles de prueba que se ganan con una flecha. La comparación visual vuelve a contar borde y sombra (b11 se distinguía así, según Miche).
- *Probado:* 75 tests de grilla (b11 real → "queda bloqueado"; sin el `removeEventListener` → pasa), 14 del motor; LM Studio simulado: controles con el bloqueo → reintento ✓.
- *Pendiente (paso 2):* el mismo escenario en el Validation profile de web/game (R2: "próximo nivel" tiene que llevar a un nivel que se pueda jugar).

**Boxworld b11 → files_engine v0.9.2 + Standard grilla v0.1.2 + catálogo v0.8.1 (06/10)**
- *Evidencia de origen (b11, primera corrida real con el motor general):* 5 PASS / 2 FAIL otra vez. El CSS ahora estaba bien, pero `dibujo.js` pintaba cada casillero con `style.backgroundColor` y le ganaba al CSS: caja y jugador del mismo gris que el piso, distinguibles solo por borde y brillo (*corrección de Miche, que lo jugó: se veía y se podía jugar; yo había dicho "invisibles"*). Además `#btn-reiniciar` vino con `disabled` en el HTML y nada lo habilitaba (igual que en b3). Validation no lo vio porque `reset_restores` apretaba ↑ ↓ ← → seguidas, el avatar volvía al casillero de inicio y daba FAIL falso "las teclas no cambian nada"; los 3 reintentos de controles persiguieron ese mensaje falso. Niveles: 4 de 5 de nuevo (el reintento re-mandaba los 5 y repetía el mismo error). `reglas.js` 13/14: la prueba de `'*'` y `'+'` falló 3 reparaciones con un mensaje que mezclaba lo que estaba bien y lo que estaba mal.
- *Cambios:* (1) motor, paso `render`: si el Standard declara `looks`, mira en Chromium cómo quedó lo DIBUJADO (no solo el CSS) y si el código pinta con `style.*` y eso deja dos piezas iguales, lo dice. Se compara lo que distingue una persona: fondo, borde, sombra, contorno, símbolo, texto. (2) motor, paso `screen`: los ids que el Standard declara en `enabled` no pueden traer `disabled`. (3) motor, paso `data`: el reintento muestra solo los problemas y el pedido es por los que faltan ("ya hay 4 válidos guardados"). (4) Standard: `looks` en dibujo, `enabled` en pantalla, sugerencia concreta para el nivel que falta; la prueba de `'*'` y `'+'` dice solo lo que está mal. (5) Validation (`check_catalog` v0.8.1): `reset_restores` juega tecla por tecla hasta que algo cambie. Con b11 ahora da el FAIL real: "después de jugar, Reiniciar Nivel está deshabilitado"; b10 sigue en PASS.
- *Probado:* 71 tests de grilla (b11 real: dibujo → "se ven iguales: .piso = .caja = .jugador" + pista de `style.backgroundColor`; sin los `style` → 0; `disabled` detectado), 14 del motor (sigue sin nombrar ningún dominio). LM Studio simulado: CSS con descendiente → `disabled` → OK; dibujo con variable tapada → con `style` → OK. Fixture `real_boxworld_b11/`.
- *Aprendizaje:* dos builds seguidos con 5 PASS y el juego invisible. El juez tiene que mirar lo que mira una persona; y un chequeo con un FAIL falso es peor que no tenerlo, porque manda a corregir lo que está bien.

**Boxworld b10 → files_engine v0.9.1 + Standard grilla v0.1.1 (06/10)**
- *Evidencia de origen (b10, Gemma real, todavía con game_files v0.8.2):* el mejor build hasta ahora en Validation, 5 PASS / 2 FAIL: reglas 13/14, pantalla, dibujo y controles al primer intento, el juego se mueve, empuja y gana. Pero, mirándolo: **el tablero se ve como 100 casilleros iguales** (styles.css con `.casillero .pared`, descendiente; `dibujar()` pone las clases en el mismo div → ningún color se aplica; con el selector corregido a mano se ve el juego completo). Validation no lo vio porque mira clases del DOM, no cómo se ve. R3 FAIL: 4 niveles de 5 (los 3 intentos trajeron un nivel con cajas contra la pared y el objetivo en otra columna; el harness solo decía "NO se puede ganar"; cada intento empezaba de cero: 4, 3 y 2 válidos). R1 FAIL **falso**: el traductor puso `click_changes` en "reiniciar" (recién cargado, reiniciar no tiene que cambiar nada; `reset_restores` dio PASS en el mismo requisito).
- *Cambios:* (1) motor, paso `screen`: si el Standard declara `swatches`, prueba en Chromium que cada variante (`class="casillero pared"`, …) se vea distinta de la base y entre sí; si el CSS usa descendiente, explica el selector. (2) motor, paso `data`: junta los datos válidos de TODOS los intentos (sin repetidos) y pide solo los que faltan. (3) Standard: casilleros vivos (`liveSquares`/`stuckBoxes`): la caja trabada contra la pared se informa con su posición y por qué; el solver poda con eso; los niveles se ordenan por empujes; prompt: ninguna caja pegada al borde salvo que su objetivo esté pegado a esa pared; número de nivel desde 1. (4) web/game (traductor): `click_changes` sobre reiniciar → `reset_restores`.
- *Probado:* 66 tests de grilla (b10 real: nivel 5 explicado, CSS real → 3 problemas con la pista del selector, CSS corregido → 0, referencia → 0), 14 del motor; LM Studio simulado: niveles 4 + 1 nuevo → 5 (empujes 3, 3, 4, 6, 7), CSS con descendiente → reintento ✓. Fixtures `real_boxworld_b10_styles.css`, `real_boxworld_b10_niveles.json`.
- *Aprendizaje:* 5 PASS no era "anda". Validation tiene que mirar lo que ve una persona, no solo el DOM (va al paso 2: un chequeo visual en el Validation profile de web/game).

**Harness → Standard → Validation profile, paso 1 (06/10, decisión de Miche)**
- *Por qué:* "Boxworld no puede existir dentro del Harness (hoy boxworld, mañana boxworld + snake, pasado + miner: inviable)". Esquema: el harness es general; lo de un tipo de proyecto lo declara un **Standard** que recibe el Specialist; el **Validation profile** lee ese Standard para saber qué verificar (no lo copia).
- *Qué:* `profiles/web/game/specialist_files.mjs` se partió en `harness/files_engine.mjs` (motor general, `files_engine v0.9`) y `standards/web/game/grilla/` (Standard DRAFT v0.1: contrato, los 5 pasos con su pedido, pruebas de aceptación, solver, sonda de `dibujar()`, chequeos de juego). `profiles/web/game/levels.mjs` → `standards/web/game/grilla/levels.mjs`. `profiles/web/game/profile.mjs` v0.3 declara `standard: "web/game/grilla"`. `evidence.json` guarda `specialist.standard`.
- *Sin cambio de conducta (verificado):* con LM Studio simulado la `app/` sale **idéntica** a la de v0.8.2 (diff vacío); mismos casos de reparación (declaración repetida, sombra, reparación por función, reglas rotas → pasos 4 y 5 no se corren). Únicos textos nuevos que ve Gemma: "programás un proyecto web" (antes "un juego web") y "Cómo trabajar:" (antes "Reglas:").
- *Tests:* `test_game_files.mjs` → `standards/web/game/grilla/test_grilla.mjs` (55, los mismos casos) + `harness/test_files_engine.mjs` (14: el motor no nombra ningún dominio, Standard de juguete, registro).
- *Pendiente:* paso 2, Validation profiles por tipo que lean el Standard (`check_catalog` de 63 KB nombra `Reglas`/`NIVELES` en moves_one_cell, game_levels, fixed_map_size); paso 3, skills del Role (la pista "en estado.mapa no hay cajas" está en el contrato y es una skill).

**game_files v0.8.2 (06/10, Boxworld b9)**
- *Evidencia de origen:* b9 (Gemma real): niveles OK (5 resolubles), pantalla OK, controles bien. `reglas.js` declaró `const altura`/`ancho` dos veces en `mover()`; la reparación por tramo no veía la primera declaración y el harness se quedó con esa versión que no compilaba ("1 problema") sobre dos que cargaban (5 pruebas fallidas). `mover` buscaba cajas en `estado.mapa` (no las hay). 4 de 6 reparaciones por función vinieron vacías o cortadas (tope 3000). `dibujo.js`: `c => c.fila === r && c.col === c`. dibujo y controles cargaron con la culpa 11 min.
- *Cambios:* no compila / no carga / sin contrato = peor que cualquier cantidad de pruebas fallidas; `fixRedeclare` (encapsulation.mjs) arregla la declaración repetida sin Gemma; si `reglas.js` no carga, dibujo y controles no se corren; pista determinista "el jugador quedó encima de una caja"; "ganado después de mover" se atribuye a `mover`; reparación por función con 5000 tokens y `finish_reason`; `shadowProblems`; `lm_stream` cuenta `reasoning_chars`. Fixture `real_boxworld_b9_reglas.js`.

**Profiles: separar core de tipo de proyecto (05/10, decisión de Miche)**
- *Por qué:* el harness daba por hecho una página de header + secciones + footer; cada tipo nuevo (landing, Kanban, Boxworld) agregaba reglas que después recibían todos los proyectos. Ej.: el traductor mandaba las reglas de hero/footer/estadísticas (~540 tokens) y el catálogo entero con cada requisito, también al Kanban.
- *Qué:* `profiles/` con dos niveles: plataforma (`web`: roles, reglas por rol, catálogo de Chromium, encapsulado) y tipo (`web/landing`: page plan, Specialist por componentes, reglas 5-6 del traductor; `web/app`: DRAFT vacío que usa el build de landing y lo declara en `borrowed`). Todo DRAFT. El tipo lo elige Miche en un selector de la UI (como la etapa) y queda en `refined_prompt.profiles`; sin tipo, falla fuerte.
- *Sin cambio de conducta (verificado):* con un LM Studio simulado y Chromium, antes y después del refactor son **byte a byte iguales** todos los pedidos al modelo (TechLeader, Atomizer, Checker, Re-Atomizer, page plan, traductor, Specialist por componentes y legacy), los artefactos y las evidencias; solo se agregan la línea `[PROFILE]`, el campo `profiles` en `evidence.json` y `version: "0.2"` en role_dependencies. `npm test`: mismas cuentas que antes + 24 tests de profiles + role_dependencies y dependencias por fase (ahora en `npm test`).
- *Cambios chicos que salieron:* la nota "un carrusel se verifica con carousel" del traductor solo va si el profile tiene `carousel` en su catálogo; los tests de role_dependencies cortan si fallan (antes `console.assert` imprimía ✓ igual) y corren en Windows.
- *Pendiente:* llenar `web/app` (page plan de componentes de app, chequeos de flujo, reglas propias del traductor); decidir si Boxworld es `web/app` o `web/game`; build multi-artefacto (NodeMCU = firmware + web/app).

**web/game por archivos (06/10, decisión de Miche: "separar por componentes, como se programa prolijo… dejar de pedir html autocontenidos a modelos chicos")**
- *Evidencia de origen:* Boxworld b2–b7 con todo el juego en UNA respuesta de Gemma (~7k tokens): cada build trajo 1–2 bugs distintos y los reintentos completos se cortaron por `length` (3 de 3). b7 (06/10) quedó jugable recién con la reparación de sintaxis por tramo (59 s), con niveles de filas de largo distinto.
- *Cambio:* Specialist **game_files v0.8** (`profiles/web/game/specialist_files.mjs`). UN archivo = UN paso, con un **contrato fijo** del harness (nombres, forma del estado, ids): `js/niveles.js` (strings Sokoban; el harness valida filas, jugador, cajas = objetivos, tamaño y cantidad pedidos por el usuario) → `js/reglas.js` (`Reglas.crearEstado/mover/ganado`, sin DOM; **el harness lo prueba en Node** con 10 niveles chicos propios: pared, empujar, caja contra pared/caja, de a un casillero, `*` y `+`, no muta el estado) → `juego.html` + `styles.css` (ids fijos) → `js/dibujo.js` (probado en Chromium: un div por casillero, 1 jugador, cajas) → `js/controles.js` (board_changes, not_won_immediately, reset_restores, contador). Cada paso: reparación de sintaxis por tramo y hasta 2 reintentos SOLO de ese archivo, con el problema exacto. Resultado: `app/index.html` + `styles.css` + `app/js/*.js` (sin módulos: `file://` no los permite). `--legacy-components` vuelve al componente único.
- *Catálogo v0.8:* `game_levels`, `moves_one_cell`, `fixed_map_size` (sobre el contrato `NIVELES`/`Reglas` de la página) cierran R3, R5 y R6. La foto de pantalla incluye `data-*` y no cuenta los mensajes (reset_restores daba falso FAIL en b7; key_changes ya no se engaña con el cartel en b6).
- *Probado:* LM Studio simulado de punta a punta (1er intento con fila de largo distinto → reintento ✓; reglas con error de sintaxis → reintento ✓; dibujo sin appendChild → reintento ✓; Validation 7 PASS, ninguno trivial, R8 estilo SIN_CHEQUEO). 29 tests de `test_game_files.mjs`; referencia `fixtures/game_files_ok` (PPPPPP), b7 real (FFFPPP: no tiene el contrato). **Falta la corrida con Gemma real.**
- **Build 8 (06/10, primera corrida real por archivos) → v0.8.1:** 45 min y 2 PASS. (1) Gemma **no puede contar caracteres**: los niveles en strings tenían filas de 9 a 13 en un mapa de 10 y 13 objetivos para 3 cajas, en los 3 intentos y con el problema exacto. (2) Bug mío: un intento sin archivo (cortado por `length`) "ganó" por tener 1 problema contra 15 → `niveles.js` quedó VACÍO y los pasos 4 y 5 fallaron 3 veces cada uno por `NIVELES is not defined` (culpa de arriba). (3) `reglas.js` repitió el mismo bug en los 3 reintentos completos (`state` en vez de `estado` en `ganado()`, 13 min). (4) En el reintento de dibujo, Gemma metió el arranque del juego en `dibujo.js` y `controles.js` rompió con `nivelActual already declared`. Cambios: **niveles en coordenadas** (`profiles/web/game/levels.mjs`): Gemma propone jugador/cajas/objetivos/paredes interiores en JSON, el harness arma los strings y **los prueba con un solver** (A* por empujes, 4 s por nivel; descarta los irresolubles y pide otros solo si no alcanzan); un intento sin archivo nunca gana; `reglas.js` que falla pruebas → **reparación por método** (cada prueba sabe qué función mira: crearEstado / mover / ganado; Gemma devuelve solo esa); nombres declarados en dos archivos y arranque dentro de `dibujo.js` → problema concreto. Probado con LM Studio simulado (nivel irresoluble → reintento; `ganado` con `state` → reparación por método ✓; `nivelActual` en dibujo → reintento). 46 tests en `test_game_files.mjs`. **Falta la corrida con Gemma real.**

**Profiles web/app y web/game (05/10, Boxworld build 3; decisión de Miche: juego = `web/game`, hijo de `web/app`)**
- *Evidencia de origen (build 3, jugado con Playwright):* el page plan de landing partió el juego en #juego + #niveles (dos juegos movidos por las mismas flechas); ganaba con el primer movimiento (comparaba los objetivos consigo mismos); al ganar, reiniciar quedaba deshabilitado; cajas y avatar como casilleros extra de la grilla; el contador se verificó con `numbers_animate`; 5 de 8 requisitos SIN_CHEQUEO. Y las **restricciones** (las reglas del juego: paredes, empujar, cuándo se gana, 10x10) nunca llegaban al Specialist: `briefText` solo manda objetivo + features.
- *web/app v0.1:* plan determinista de una pantalla (un componente con todas las features; las de `refined.estilo` como transversales; sin header ni footer), restricciones y contexto del usuario en el brief (`REGLAS DEL USUARIO`), reglas A1–A4 (estado + `dibujar()`, sin DOMContentLoaded), hasta 11k tokens de respuesta, traductor sin secciones/hero/carrusel.
- *web/game v0.1 (extends web/app):* reglas G1–G6 (niveles como datos con posiciones iniciales y objetivos por separado, victoria desde el estado, reiniciar desde los datos, un listener de teclado, grilla dibujada entera) y `not_won_immediately` como chequeo de base del Specialist (con reintento).
- *Catálogo v0.7 (interacción):* `key_changes`, `click_changes`, `counter_on_action`, `not_won_immediately`, `reset_restores`. Probado sobre un juego correcto (`game_ok`: PPPP), uno con los bugs de b3 (`game_mal`: gana con un movimiento, reiniciar deshabilitado → PPFF), el b3 real (PPFF) y una página sin JS (FFFF → los PASS no son triviales).
- *Core:* la guardia de holdout cuenta como visible lo que el profile le pasa al Specialist (`specialistSees`): 5 de los 6 criterios holdout de Boxworld eran copia de restricciones del usuario y cortaban el build. `planPage(features, { refined })`. `componentsFromPlan` acepta `header: null` / `footer: null`.
- *Probado:* build completo con LM Studio simulado (perfil web/game: plan de 1 componente, 25 notas, reglas en el brief, el 1er intento con el bug de victoria → reintento por `not_won_immediately` → OK; traductor con catálogo de juego; R1, R2, R4, R7 PASS no triviales). 16 tests de web/app/game, 30 de profiles, 52 de componentes, 6 casos nuevos del catálogo. **Falta la corrida con Gemma y Qwen reales.**
- *Para Boxworld:* el snapshot declara `"profiles": ["web/app"]`; cambiarlo a `["web/game"]` (o elegir "Juego" en la UI en un proyecto nuevo).
- **Build 4 (05/10, primera corrida real con web/game):** plan de 1 componente con R1–R7, 25 notas, reglas del usuario en el brief, sin header/footer ni segundo juego; ~17 min (el 1er JS tenía un error de sintaxis, el reintento salió bien). La lógica mejoró de verdad: victoria contra objetivos guardados aparte, empuje con chequeo de pared y de otra caja, reiniciar desde los datos. Validation: 3 PASS (R2, R4, R7) / 1 FAIL (R1) / 4 SIN_CHEQUEO. Jugándolo: **el avatar no se mueve en pantalla** — el estado cambia y el contador sube, pero `dibujar()` no se vuelve a llamar después de mover. `reset_restores` lo detectó ("las teclas no cambian nada"); `key_changes` dio **PASS falso** en R4 porque cambiaban el contador y el mensaje. Catálogo v0.7.1: `board_changes` (solo el tablero: la grilla con más casilleros o un canvas), en el traductor de juego para "el avatar se mueve" y como chequeo de base del Specialist (con reintento: "llamá a dibujar() después de cada movimiento"); regla G5 lo dice explícito; el traductor de juego no usa click_changes con "avatar/caja/jugador". Fixture `real_boxworld_b4`.
- **Build 5 (05/10):** página sin JS. El 1er `componente.js` (~14k caracteres) tenía UN error de sintaxis repetido en los datos de los niveles (`playerStart: {…};` en vez de `,`) y se rechazó entero; el reintento reescribía todo y se cortó por `length` → sin JS. Validation dio FAIL honesto (`board_changes`: no hay tablero). En build 4 había pasado lo mismo (`walls: [[r, c] => …]`). Además 3 de 5 niveles empezaban con las cajas sobre los objetivos. Cambios: **Specialist v0.7.5 — reparación acotada de sintaxis** (el harness ubica la línea, le muestra a Gemma un tramo numerado de ~27 líneas y reemplaza solo ese tramo; hasta 6 rondas mientras avance, tope 3000 tokens por ronda; si no avanza, sigue el reintento completo de siempre; queda en `syntax_repair` del paso). Regla G2: niveles en formato Sokoban de strings (`#`, `.`, `$`, `*`, `@`, `+`) y al menos una caja fuera de los objetivos. Catálogo v0.7.2: `not_won_immediately` falla si la victoria ya se ve al cargar (fixture `game_ganado`).
- **Build 6 (05/10):** el JS compiló (niveles en strings Sokoban: sin errores de sintaxis) pero falló al ejecutarse por dos bugs de UNA línea: `dibujar()` creaba los 100 casilleros y nunca hacía `appendChild`, y `mostrarMensaje()` pisaba el `<h3>` del overlay con `textContent` y después lo buscaba (null). El reintento completo se cortó por `length` (3 de 3 reintentos de #juego en b3–b6). Con esas dos líneas corregidas a mano el tablero anda, y aparece el siguiente bug: gana con un movimiento (1 caja y 5 objetivos; la victoria contaba cajas, no objetivos). **Specialist v0.7.6 — reparación por función:** antes del reintento completo, el harness ubica la función (línea del error en el index.html → función del componente.js; la que nombra el contenedor vacío; la del teclado o la de la victoria según el chequeo que falló), Gemma devuelve SOLO esa función (tope 3500 tokens) y el harness la reemplaza si compila y es la misma función; se queda si no empeora (hasta 4 rondas, `fn_repair` en el paso). Con LM Studio simulado sobre la respuesta real de b6: mostrarMensaje ✓, dibujar ✓, checkWinCondition ✓ → sin problemas y sin reintento completo. Catálogo v0.7.3: `no_js_errors` da la línea del error. Reglas G3 (todos los objetivos ocupados; tantas cajas como objetivos) y G6 (appendChild explícito). Fixture `real_boxworld_b6`.

**Build: lo que se perdía entre el graph y la página (05/10, Boxworld build 2)**
- *Evidencia de origen:* de 25 tareas del graph, al Specialist llegaron 2 (las que decían "juego"/"nivel"); la grilla, el avatar, las flechas, las colisiones, el empuje y los botones no los vio nadie. El `componente.js` de #juego era una sola función anónima `(root) => {…}` que nunca se llamaba: 330 líneas muertas, tablero vacío. El 1er intento se había rechazado por `const root = document.getElementById("juego")` (SyntaxError) y el reintento costó 6½ min. #niveles repitió ids de #juego. Validation dio PASS igual en lo que miró.
- *Cambios (core, valen para cualquier tipo):* `assignTasks`: toda tarea que no es de QA llega a un componente, por palabra clave o, si no nombra ninguno, al **principal** (la sección con más requisitos); el prompt lista todas con título y las primeras 12 con descripción (Boxworld: +~1k tokens). `autoInvoke` llama una función anónima que es todo el archivo; `dropRootRedeclare` saca `const root = …#mismo-id`. Chequeos de base por componente (con reintento): `components_render` (catálogo v0.6: los contenedores que su JS nombra siguen todos vacíos → no dibujó nada; no cuentan los "a demanda" como mensajes, feedback o lo que está dentro de un form) e ids repetidos con otro componente. En Validation, `components_render` es **compuerta** como `sections_visible`: los requisitos de un componente que no dibujó nada son FAIL. `evidence.json` guarda `components_render` y `specialist.tasks_assigned`.
- *Probado:* 52 tests de componentes (24 nuevos) y 4 casos nuevos del catálogo: `render_ok/mal`, Boxworld build 2 real (FAIL en #juego y #niveles) y Project22 v0.7.1 real (PASS: su `#formFeedback` vacío no cuenta). Con la función anónima llamada, el juego de Boxworld corre y aparece su error real (`classList.add('')`), que antes estaba escondido: ahora el reintento lo recibe. **Falta la corrida con Gemma real.**
- *Riesgo a mirar:* #juego ya usaba ~6.2k de 8k tokens de respuesta; con 25 notas puede cortarse por `length`.
- **Build 3 (05/10, con Gemma real):** las 25 tareas llegaron a #juego y el tablero de 10x10 se dibuja (`components_render` PASS, sin ids repetidos). Pero `sections_visible` dio **FAIL falso** en #juego (10/21): las 11 palabras eran el overlay de victoria con `style="display:none"`, que aparece al ganar; el reintento por ese falso problema se cortó por `length` (6 min perdidos). Catálogo v0.6.1: el texto dentro de un descendiente con `hidden` o `display:none` inline cuenta aparte ("a demanda"); la pieza misma oculta y el ocultamiento por CSS siguen fallando. Fixture `real_boxworld_b3`. Jugando con Playwright: el primer movimiento ya "gana" el nivel (compara las cajas con sus propios objetivos), las cajas y el avatar quedan como casilleros extra de la grilla, y #niveles es un segundo juego de 5x5 que también se mueve con las flechas. Nada de eso lo ve hoy Validation: falta un chequeo de interacción (punto 2).

**Build + Validation de punta a punta (01/10)** — ver [ARCHIVOS.md](ARCHIVOS.md) (Build y Validation).

**Piloto, experimentos del reviewer y aviso por palabras (30/09)** — ver [EXPERIMENTOS.md](EXPERIMENTOS.md). `term_coverage` quedó **solo en el log** (la tarjeta de etiquetado se desactivó: pedirle a Miche que juzgue cada requisito no escala; el juez de cobertura pasa a ser Validation ejecutando el artefacto).

**Intent Forge v0.3 — plantilla + clasificación acotada (03/10, Project23)**
- *Evidencia de origen:* el chequeo "mencionaste y no incluí" dio 13 avisos en Project23, 3 pérdidas reales (nombres de columnas, drag & drop, efecto al soltar) y 10 ruido léxico ("posibilidad", "sombas", "actualizamos"). "Excluir" mandó palabras sueltas como órdenes negativas a TechLeader ("NO planificar: frontend") y el drag & drop terminó diferido. La pérdida venía de Intent Forge resumiendo, no del prompt del usuario.
- *Cambio (decisión de Miche):* el input arranca con una plantilla de 4 campos (Ctrl+Enter para mandar) y un ejemplo en el chat. Qwen **no resume**: clasifica cada línea numerada en ítems tipados, con la regla de cobertura del harness (misma lección que el reviewer v0.6-bounded). El campo es una pista del tipo; si Qwen lo cambia, la tarjeta lo muestra como "↪ movido".
- La tarjeta de confirmación muestra "dijiste → quedó como" línea por línea. No hay avisos ni botones Incluir/Excluir: se corrige con ✏️ Ajustar (el mensaje entra como línea `[ajuste]`; para sacar algo Qwen usa `descartado`).
- refined_prompt: `features` = feature + estilo (para que reviewer, page plan, traductor y Specialist lean lo mismo que antes); además `restricciones`, `estilo`, `contexto` y `brief` (líneas + ítems). TechLeader recibe las restricciones después de los criterios; desaparece "Fuera de alcance".
- **v0.4 (mismo día, pedido de Miche):** entrevista de completitud antes de clasificar, hasta 10 preguntas no obligatorias (Qwen dice LISTO cuando alcanza). Preguntar de más cuesta un "no", que queda como restricción y evita que TechLeader o el Specialist lo inventen. Respuestas "listo/nada más" cortan la entrevista y no son líneas. Después de un COMPLETE, Ajustar reclasifica sin volver a entrevistar.
- **v0.5 (03/10, evidencia Project24):** Qwen copió cada línea entera como un ítem (2 features en vez de ~8; el semáforo de prioridad quedó como estilo) y el entrevistador dijo LISTO sin preguntar nada. Cambios: el harness corta cada línea por oración antes de numerar (`splitSentences`); una feature con 2+ acciones (`actionVerbs`: infinitivos distintos antes de la primera subordinada, sin auxiliares) vuelve al modelo en el mismo reintento de cobertura y, si sigue compuesta, la tarjeta la marca; el clasificador tiene reglas explícitas "una feature = una acción" y "si necesita un dato del usuario (prioridad, estado, etiquetas) es feature"; el entrevistador primero lista hasta 3 `faltantes` (JSON) y después pregunta por el primero, con un checklist (vagas, nombres/cantidades, datos de cada cosa, cómo se usa, lo típico no mencionado). Los faltantes quedan en la evidencia del turno.
- **v0.6 (03/10, 2ª corrida de Project24 por consola):** la clasificación separó bien crear/editar/borrar/arrastrar, pero el JSON traía un `"` suelto después de la última `}` y el parser lo descartó 3 veces (todo terminó por la red del harness, ~8 min). El parser ahora recorta al último `}` y el reintento le dice al modelo el error real. El entrevistador hizo 4 de 5 preguntas sobre el semáforo con otras palabras: el harness detecta el mismo tema (`sameTopicAsked`) y pasa al siguiente faltante. Una respuesta que detalla una feature se escribe dentro de esa feature (citando las dos líneas). "Arrastrar y soltar" cuenta como una acción.
- **v0.7 (04/10, 3ª corrida de Project24):** 6 preguntas útiles y crear/editar/borrar/arrastrar separados, pero el modelo no ubicó L10 ("lista desplegable") y tras 2 reintentos la "cubrió" con un ítem inventado ("Sin login"); además detectó "cuántas columnas y qué estados" como faltante y nunca lo preguntó. Cambios: un ítem tiene que compartir al menos una palabra con las líneas que cita o con su pregunta (`grounded`), si no es inválido; el reintento muestra el texto y la pregunta de cada línea sin ubicar y sugiere sumarla al ítem que detalla; los faltantes de cada turno viajan en el historial (`faltantes` en el mensaje del asistente) y los no preguntados se le recuerdan al entrevistador y alimentan el reemplazo de preguntas repetidas.
- **v0.8 (04/10, 4ª corrida de Project24):** nada se perdió (columnas capturadas), pero el entrevistador preguntó cómo persistir cuando el usuario ya había dicho "sin base de datos" (la respuesta "localStorage" contradijo "se pierde al recargar"), repitió la prioridad, preguntó un ítem del checklist ("nombres o cantidades que faltan") y varias respuestas quedaron como features duplicadas. Cambios: no se pregunta sobre lo que tocan las líneas de "qué no debe hacer" (`touchesRestriction`); las palabras comunes salen solo de la plantilla; se descartan faltantes genéricos (`isGenericGap`); una feature que sale solo de respuestas y repite otra vuelve al modelo como detalle de esa (`detailDuplicates`). La evidencia guarda una copia de los mensajes de cada llamada (antes guardaba la referencia y todas mostraban el estado final).
- **v0.9 (05/10, hold-out Project25 "Boxworld", primera prueba fuera del Kanban):** capturó todo (nada inventado, nada perdido, preguntas útiles sobre niveles, empujar cajas, reinicio y fin de nivel, ninguna contra restricciones). Falla general encontrada: "no lo sé" se leyó como un NO y terminó en la restricción "No se genera aleatoriamente", que contradice la feature; además preguntó cómo implementar la generación aleatoria y gastó las últimas preguntas en detalles que el usuario dejó "a criterio". Cambios: respuestas delegadas (`isDelegated`: "no lo sé", "a criterio", "da igual") se marcan, van como contexto y no pueden sostener una restricción; dos delegadas seguidas cortan la entrevista; el entrevistador no pregunta cómo se implementa algo ni detalles chicos. Quedan sin resolver features duplicadas por paráfrasis ("botón próximo nivel" en L3 y L10) y preguntas repetidas por sinónimos ("qué pasa"/"qué ocurre", "tamaño"/"qué tan grande"): no se agregan más heurísticas léxicas hasta ver si molestan aguas abajo.
- **v1.0 (05/10, 2ª corrida del hold-out P25):** dos preguntas repetidas las puso el harness (pendientes de turnos viejos ya preguntados con otras palabras). Ahora los pendientes salen solo del turno anterior; una pregunta propuesta por el harness se descarta si comparte una palabra de tema con algo ya preguntado (`sharesTopicWithAsked`, sin contar verbos como "incluirá"/"tendrá"); las preguntas de implementación ("¿cómo se generan…?") se descartan en el harness (`isImplementationQuestion`), porque el modelo ignora esa regla del prompt.
- **v1.1 (05/10, Project25 por la UI):** el refined llegó con 3 features: el modelo juntó L2 (el juego) y L3 (los botones), y respuestas que describen lo que hace el juego (10 niveles, qué pasa al reiniciar, inicio automático) quedaron como restricción/contexto, que el reviewer no ve. TechLeader las planificó igual, el reviewer marcó EXCESS y en el reintento TechLeader difirió hasta el estilo NES (GAP). Cambios: una feature no puede juntar dos líneas de "qué tiene que hacer"; regla explícita de que una respuesta que describe lo que la app hace o tiene es feature (restricción solo para "no/sin/solo/máximo").
- Probado: 55 tests del módulo; `intent_cli.mjs` y flujo en navegador con server real y LM Studio simulado (falta una línea → reintento → tarjeta; Ajustar → descartado; prompt de TechLeader; recarga sin JSON crudo). **Falta la evidencia con Qwen real.**

**Gate del reviewer (05/10, evidencia Project23):** un `SYSTEM_ERROR` ("fetch failed") se aprobaba porque solo frenaban GAP/EXCESS. Ahora `runGenerationAttempt` devuelve `REVIEW_ERROR` si el reviewer no corrió (también si la llamada misma falla) y `handleContinuePlan` no rehace el plan: pide decisión con `reintentar revisión` (solo el reviewer, mismo graph), `aprobar sin revisión` (queda `reviewSkipped: true` en el estado) o `rehacer plan`. Si el reintento corre y encuentra GAP/EXCESS: `rehacer plan` / `seguir con hallazgos`. Probado: 4 tests del módulo + los caminos de decisión en navegador con el endpoint simulado (falla → vuelve a pedir; corre limpio → aprobada; aprobar sin revisión → marcado). El camino completo (TechLeader → graph → reviewer caído) no se probó con LM Studio real.

**UI:** `BUILD_ID` + `/api/version` + `no-store` (Project21 corrió JS viejo en una pestaña abierta).

**Etapa del proyecto en TechLeader + chequeo de etapa del plan (D12 / D14, Project20)**
- *Evidencia de origen:* Project20 intento 2 armó "F7 Pruebas Funcionales, Optimización y Despliegue"; se atomizó 30 min y recién el reviewer marcó EXCESS=15. Además el reviewer marcó AMBIGUOUS la frase fija "El prototipo debe permitir:".
- Sale la instrucción de **Context7** del prompt de TechLeader (no había herramienta; el modelo no podía usarla). Entra una sección ETAPA: planificar solo el trabajo de la etapa y listar lo posterior en un campo nuevo `"diferido"`.
- El input de TechLeader dice `Features:` en vez de "El prototipo debe permitir:" y recibe al final el **criterio** de la etapa (`/api/stage`), sin las reglas para revisores. `webmcpState.prompt` (lo que ve el reviewer) queda sin el criterio: el reviewer ya lo recibe como CONTEXTO.
- `refined_prompt.project_stage` lo pone **server.mjs** desde `ProjectStage.md` (si Intent Forge devolviera otra etapa, se pisa: la etapa la declara Miche). Se ve como chip en la tarjeta de confirmación.
- Después de cada plan corre `/api/stage-check`. Si marca fases DEFERRED/EXCESS, TechLeader rehace **solo el plan** con feedback por fase (segundos, no el atomizado), hasta 2 veces; después sigue y el reviewer decide. Si el chequeo no puede correr, se avisa en rojo y se sigue (es red, no compuerta). Un veredicto faltante se reporta como "incompleto", nunca como "en alcance".
- Lo diferido se conserva (`webmcpState.deferredWork`: lo que marcó el chequeo + el `diferido` de TechLeader) y cada chequeo queda en `webmcpState.stageChecks` con el sha256 de la etapa.
- Probado: 7 tests del módulo; flujo completo en navegador con server real y LM Studio simulado (plan con despliegue → marcado → plan rehecho sin él → diferido registrado). **Falta la evidencia con Qwen real: correr `bench_stage_check.mjs`.**

**Limpieza**
- Reviewers anteriores (`completeness_reviewer.mjs`, `2`, `4`, `v2_qwen`), sus tests (`test_completeness_artificial*.mjs`), la copia de respaldo `porlasdudas/` y `michelab_council.html` pasan a `_archivo/` (fuera de git). Siguen disponibles en el historial.
