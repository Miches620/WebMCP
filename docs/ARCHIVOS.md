# Archivos de webmcp

> Qué hace cada archivo, por carpeta, y la API del server. Movido desde el README el 06/10/2026, sin cambios de contenido. Volver al [README](../README.md).

## Pipeline detallado

```
Tipo de proyecto (lo elige Miche: web/landing, web/app…)  → profiles/   [ver profiles/README.md]
Intención del usuario
   ↓  Intent Forge v0.4 (plantilla de 4 campos → entrevista de completitud, hasta 10 preguntas → Qwen clasifica cada línea)
refined_prompt + answer_key_requirements
   ↓  confirmación humana (Confirmar / Ajustar)
TechLeader  → plan de fases   (recibe la ETAPA y su criterio desde context/ProjectStage.md)
   ↓
Stage Check del plan (Qwen, un veredicto por fase)  → si hay fases fuera de etapa, rehace el plan (máx. 2)
   ↓
Atomic Graph (Atomizer → Checker → Re-Atomizer) + reconciliación de dependencias
   ↓
Validation Profile: role_dependencies  (determinista, sin LLM)
   ↓
Completeness Reviewer v3 (schema acotado + reglas del harness)
   ↓
APPROVED  ·  o reintento de TechLeader con feedback (máx. 3)  ·  o decisión humana
   ↓  snapshot del estado (localStorage "webmcp_state" → JSON)
Specialist (Gemma)  → lo pone el profile (landing: por componentes)   [build/ + profiles/<tipo>/]
   ↓   esqueleto del harness + contrato api.js↔app.js
Artefacto: app/index.html + styles.css + api.js (mock) + app.js
   ↓
Validation: requisito → chequeos del catálogo (Qwen elige, el código ejecuta en Chromium)   [profiles/web/validation/]
   ↓   control: los mismos chequeos sobre el esqueleto vacío
Evidence por requisito: PASS / FAIL / SIN_EVIDENCIA / SIN_CHEQUEO   (build/runs/<fecha>/evidence.json)
```

## Core (raíz del repo)

| Archivo | Rol |
|---|---|
| `server.mjs` | Servidor HTTP (puerto 3000): sirve la UI y expone la API. |
| `index.html` | UI: chat único (Intent Forge + decisiones), refined_prompt fijo, panel de razonamiento, lista de tareas y preview. |
| `script.js` | Orquestación en el navegador: fases del chat, TechLeader, grafo, validaciones y reintentos. |
| `harness/files_engine.mjs` | **Motor UNIVERSAL del Specialist por archivos (v0.10, 12/10; v0.10.1 12/10: contrato como función del contexto, `resolve(ctx)` por paso, `check` en datos; v0.11.0 12/10: un paso con `write(ctx)` lo escribe el código y no el modelo, se juzga igual y queda marcado `by: "harness"`; `--gemma-writes-all` para comparar).** No sabe de web ni de ningún dominio: recibe el Standard (qué se construye) y una plataforma (con qué). Corre los pasos; clase de paso universal `data` (JSON → archivo que arma el Standard); reintentos solo del archivo que falla, arreglo previo de la plataforma, arreglos deterministas y reparación de la clase de paso, quedarse con el mejor intento, pasos con `needs` que no se corren si lo de arriba está roto, banco por paso. Tests: `node harness/test_files_engine.mjs` (incluye "no nombra ningún dominio", "no importa de profiles/standards/roles" y "no nombra cosas de web"). |
| `harness/js_tools.mjs` | Herramientas de lenguaje JavaScript: cargar scripts en Node, correr pruebas de aceptación, ubicar/reemplazar una función, lints de nombres. |
| `harness/kinds_js.mjs` | Clase de paso `logic` para JavaScript (lógica pura en Node + pruebas del Standard + arreglo de variables sin declarar + reparación por función). La registra la plataforma que programa en JS. |
| `harness/undeclared.mjs` | Arreglo determinista de una variable sin declarar que es la traducción de un parámetro (alias del Standard o nombre casi igual). |
| `profiles/web/specialist/files_kit.mjs` | **Kit de la plataforma web para el motor por archivos (12/10).** Pedido de sistema del Specialist web, contexto del pedido (brief, reglas del usuario, notas del TechLeader), clases de paso `screen`/`render`/`wiring` (sondas en Chromium y chequeos de Validation), arreglo previo de un `.js` (declaración repetida, sintaxis por tramo), armado de la app (`index.html` + `styles.css` + scripts) y `baselinePage`. |
| `roles/` | **Roles y sus Skills (07/10, paso 3).** `registry.mjs` (`loadRole`, `parseSkill`); `web-game/role.mjs` (DRAFT) y `web-game/skills/*.md`: fichas cortas de saber hacer, cada una con su evidencia (build real), a qué clase de paso aplica y qué problema la delata. Se usan con `node build/run_build.mjs … --skills`. Tests: `node roles/test_roles.mjs`. |
| `build/compare_runs.mjs` | Compara corridas (con/sin Skills, proyectos distintos): minutos, intentos por paso, problemas, Validation y cuántas veces apareció el error de cada Skill. |
| `build/step_bench.mjs` | Banco por paso: corre UN paso del Standard k veces por condición (sin/con/placebo), con las entradas fijas de builds anteriores. Mide cuántas veces sale bien al 1er intento. Resultados en `build/bench/`. |
| `build/examples_bench.mjs` | Experimento "pruebas primero": Gemma escribe ejemplos (datos) para la lógica; se mide si son correctos (contra una referencia) y si atrapan los errores que atrapa el harness (contra un banco de versiones). |
| `build/snapshots/` | Snapshots de prueba hechos a mano (p.ej. `project26_deposito_snapshot.json`, segundo juego de la familia de grilla). |
| `standards/` | **Standards por id (06/10).** `registry.mjs` (`getStandard`, falla fuerte). `web/game/grilla/` DRAFT v0.1: `standard.mjs` (contrato, pasos con su pedido, sonda, chequeos), `acceptance.mjs` (pruebas de `reglas.js`), `levels.mjs` (coordenadas → strings + solver), `test_grilla.mjs`. |
| `standards/web/app/estado/` | **Standard de app con estado (12/10, DRAFT v0.2.2: app.html solo título y #app; toda acción es un botón con ids en dataset (en minúsculas) y campos VISIBLES al lado; un botón por destino).** `standard.mjs` (5 pasos, contrato que se arma con lo que propone Gemma, sonda de dibujo), `contract.mjs` (valida `contrato.json`, arregla nombres, features cubiertas, `js/datos.js`), `acceptance.mjs` (pruebas generales de `js/logica.js` que salen del contrato + observaciones), `test_estado.mjs` (dos apps distintas, sondas en Chromium). |
| `profiles/` | **Tipos de proyecto (05/10).** `registry.mjs` resuelve el tipo declarado (`refined_prompt.profiles`). Ver [`profiles/README.md`](../profiles/README.md). |
| `techleader_prompt.mjs` | System prompt de TechLeader; los roles y el rol de ejemplo salen del profile. |
| `test_profiles.mjs` | 24 tests del registro de profiles, TechLeader, role_dependencies, Atomizer y traductor sin profile (fallan fuerte). |
| `test_role_dependencies.mjs` | Corre los 8 tests de role_dependencies (el auto-arranque del módulo no dispara en Windows). |
| `atomic_engine_v5.js` | Atomizer / Checker / Re-Atomizer y `resolveDependencies`. `runAtomicGraph(…, { profile })`: roles permitidos y reglas por rol del profile. |
| `validation_profile_role_dependencies.mjs` | Validador determinista v0.2: la regla universal (NO_PHASE_LEVEL_DEPENDENCY) + las reglas por rol que declara el profile (web: QA_REQUIRES_UPSTREAM_ARTIFACT FAIL, BACKEND_ROOT_WITHOUT_DBA y FRONTEND_ROOT_WITHOUT_BACKEND WARN). 8 tests: `node test_role_dependencies.mjs`. |
| `completeness_reviewer3.mjs` | Completeness Reviewer v0.6-bounded: un veredicto por requisito y por tarea; el harness corrige `covered=true` sin tareas citadas. Acepta `opts.model` y `opts.logCallback`. |
| `context/ProjectStage.md` | Definición de etapas (PROTOTYPE / MVP / FINAL). El bloque entre `BEGIN_STAGE_BLOCK` / `END_STAGE_BLOCK` se inyecta en el reviewer. |
| `context/stage_loader.mjs` | Extrae ese bloque (con hash SHA-256) y **falla fuerte** si falta. También devuelve `stage` (p.ej. `PROTOTYPE`) y `criterion` (el bloque hasta "Cómo aplicarlo al revisar:", que es lo que recibe TechLeader). |
| `plan_stage_check.mjs` | Chequeo de etapa **a nivel plan**, antes de atomizar: un veredicto por fase (IN_SCOPE / DEFERRED / EXCESS), validado por el harness como el reviewer v3. Arma el feedback para TechLeader. |
| `test_plan_stage_check.mjs` | 8 tests deterministas (fetch simulado): `node test_plan_stage_check.mjs`. |
| `bench_stage_check.mjs` | **Matriz de briefs contra LM Studio real** (6 casos: Project20 intentos 1-3, deploy pedido, operación/hardening, exceso no pedido). `node bench_stage_check.mjs 5` → `evidence/stage_check_<fecha>.json`. |
| `intent_brief.mjs` | **Intent Forge v1.1** (módulo puro, lo usan `server.mjs`, `script.js` e `intent_cli.mjs`): plantilla fija (qué querés construir / qué tiene que hacer / cómo se tiene que ver / qué no debe hacer), numera cada línea del usuario (L1, L2…), entrevista de completitud (Qwen propone UNA pregunta cerrada por turno sobre lo que falta, o dice LISTO; hasta 10; el usuario corta con "listo"; un "no" queda como restricción "Sin …"), después Qwen devuelve un ítem tipado por línea (contexto / feature / estilo / restriccion / descartado), el harness exige que **cada línea termine en al menos un ítem** (hasta 2 reintentos con feedback; lo que quede sin ubicar lo agrega el harness marcado `auto`). Arma el refined_prompt y el texto para TechLeader. Cada turno deja evidencia en `evidence/intent_forge/`. |
| `test_intent_brief.mjs` | 55 tests deterministas (modelo simulado), con Project23 reescrito en la plantilla: `node test_intent_brief.mjs`. |
| `intent_cli.mjs` | Intent Forge por consola (debug), con el mismo `intent_brief.mjs`: `node intent_cli.mjs [plantilla.txt]`. Deja la corrida en `evidence/intent_forge/cli_<fecha>.json`. Reemplaza a `intent_forge_v02.ps1` (va a `_archivo/`: tenía su propio prompt y divergía del server). |
| `test_completeness_bounded.mjs`, `test_completeness_bounded_2.mjs` | Casos de prueba del reviewer v3 (recetas / instrumentos). |
| `intent_mention_check.mjs`, `test_mention_check.mjs` | **Reemplazados por `intent_brief.mjs` (03/10)**, en `_archivo/`. |
| `json_loose.mjs` | Parseo tolerante del JSON de los modelos (fence, texto alrededor, comentarios, comas colgantes o faltantes entre líneas). TechLeader lo usa y, si igual no se puede leer, le pide el JSON de nuevo una vez (Project25: una coma faltante cortaba toda la corrida). Tests: `node test_json_loose.mjs`. |
| `review_gate.mjs` | Gate del Completeness Reviewer (`reviewStatus`): distingue "no corrió" (SYSTEM_ERROR, error de la llamada, sin findings) de "corrió y no encontró nada". Lo usa `script.js`. Tests: `node test_review_gate.mjs`. |
| `text_terms.mjs` | `norm` / `terms` / `synKey` (deterministas), extraídos tal cual de `intent_mention_check.mjs`: los usan `completeness_reviewer3.mjs` (regla de cita) y `term_coverage_check.mjs`. |
| `term_coverage_check.mjs` | Aviso determinista (sin LLM) de cobertura por palabras: por requisito, las palabras **propias** que no aparecen en ninguna tarea (título + descripción). Corre dentro de `/api/completeness-review`; **no bloquea** ni dispara reintentos. |
| `test_reviewer_quotes.mjs` | 9 tests de la regla de cita v0.7 (opt-in, no adoptada). |
| `test_phase_dependency_check.mjs` | Regresión del chequeo de dependencias por fase (caso Project20). Determinista: `node test_phase_dependency_check.mjs`. |

## Build: graph → SPA completa (`build/` core + `profiles/web/landing/`)

Desde el 05/10 `build/` tiene solo el core (`run_build.mjs`, `lm_stream.mjs`, `tokens.mjs`); el resto de esta tabla vive en `profiles/web/landing/` (y el encapsulado en `profiles/web/specialist/`). Los nombres de archivo no cambiaron.

| Archivo | Rol |
|---|---|
| `build/run_build.mjs` | **Core.** `node build/run_build.mjs snapshot.json` construye y valida con el profile del snapshot (`--profile web/landing` si es de antes del 05/10). `--resume DIR` retoma una construcción cortada. `--validate DIR` solo valida (reusa `checks.json`); con `--retranslate` vuelve a traducir y archiva el `checks.json` anterior. Escribe `build/runs/<fecha>_<proyecto>/`: un directorio por paso, respuestas crudas, `steps.json`, `checks.json`, `baseline/` y `evidence.json`. |
| `landing/specialist_spa.mjs` | Specialist v0.6 (gemma-4-e4b, temp 0). Cuatro archivos (`index.html`, `styles.css`, `api.js` = back simulado en `window.api`, `app.js`); Gemma devuelve solo los que cambia (`### FILE:`). El harness arma el esqueleto desde el plan de página (header + nav, secciones con `data-feature`, footer). Las exclusiones de Intent Forge no le llegan (son para TechLeader). Un criterio holdout que repite una feature no dispara la guardia de holdout. Después de cada paso, chequeo de contrato sin LLM (ejecuta `api.js` en un sandbox y compara con las llamadas de `app.js`) y un reintento si falta algo. "SIN CAMBIOS" no es error. |
| `landing/page_plan.mjs` | **Plan de página (v0.5, 02/10)**: antes del build, Qwen propone header, secciones en orden, footer y qué features son transversales (diseño, responsive, hover, código); el harness lo valida (toda feature con lugar, ids únicos, refs válidas; un reintento) y el esqueleto se arma con eso (`data-feature="R3"`, una feature puede estar en varias secciones). Si el plan falla: esqueleto mínimo. Se guarda en `page_plan.json` de la corrida. Probarlo sin construir: `node profiles/web/landing/page_plan.mjs snapshot.json 3`. Tests: `node profiles/web/landing/test_page_plan.mjs` (14). |
| `landing/file_diet.mjs` | **Dieta de archivos (Specialist v0.6, 02/10)** para PCs de 8 GB (Gemma con ~12k de contexto). Cada tarea recibe completos solo los archivos de su tipo principal (sale del título: estructura → index.html, estilo → styles.css, lógica → app.js + api.js, Backend/DBA → api.js); el resto va como RESUMEN (ids/clases, selectores, funciones). Gemma responde con `### APPEND: styles.css|app.js|api.js`, `### SECTION: <id>` (reemplaza ese elemento de index.html; si pierde `data-feature`, el harness lo repone) o `### FILE:` solo para archivos recibidos completos. Si el prompt no deja ≥3500 tokens para responder, los secundarios pasan a resumen (los más grandes primero); `max_tokens` = contexto − prompt. Tests: `node profiles/web/landing/test_file_diet.mjs` (23). Evidencia de origen: Project22, 10/31 pasos cortados con prompt + respuesta = 12032. |
| `landing/specialist_components.mjs` + `landing/components.mjs` (+ `web/specialist/encapsulation.mjs`) | **Specialist v0.7 por componentes (03/10, idea de Miche: "que programe como lo haría yo", estilo Angular). Es el default; `--legacy` vuelve a v0.6.1.** Los pasos salen del page plan, no de las tareas del graph: `tokens.css` (lo único global: variables, reset, `.btn`, `.container`) y un paso por componente (header, cada sección, footer). Gemma devuelve `componente.html/.css/.js` (+ `APPEND: api.js`) y ve solo su componente, los **criterios transversales** (van a todos los pasos), las tareas del TechLeader asignadas (notas; las de QA no van) y `tokens.css`: ~1.5–4k tokens de prompt. El harness impone: CSS encapsulado (todo selector se reescribe a `#id …`, reglas globales descartadas; `tokens.css` no puede ocultar section/header/footer), JS de cada componente en su propia función con `root` y su propio `<script>` (sin choques de nombres; un error de sintaxis se rechaza por componente), un elemento raíz con su `id` y `data-feature`, sin recursos externos ni `fetch`. Ensambla **un solo `index.html` autocontenido** (+ `app/src/` con los archivos por componente). Después de cada componente: chequeos de base en Chromium (se ve al llegar con el scroll, errores de JS, desborde horizontal, el nav enlaza todas las secciones, v0.7.3: su JS dibujó algo, ids sin repetir con otro componente) y un reintento con el problema concreto. v0.7.3: toda tarea del graph (menos QA) llega a un componente; las que no nombran ninguno, al principal. Tests: `node profiles/web/landing/test_components.mjs` (52). |
| `build/lm_stream.mjs` | Llamadas a LM Studio en streaming (evita el corte de 300 s de undici en tareas largas). |

**Evidencia (01/10, Landing de Café, 19 tareas):** v0.2 (un solo HTML) se cortó por `length` desde la tarea 12 · v0.3 (multi-archivo) terminó 19/19 pero sin header/footer y con `api.crearContacto()` inexistente · **v0.4: PASS 4/4, ningún PASS trivial** (`build/runs/2026-10-01T20-08-48_*`). Detalle en el doc del proyecto `claude/evidencia_build_landing_2026-10-01.md`.

## Validation como juez de cobertura (`profiles/web/validation/`)

Las reglas 5-6 del traductor (secciones, hero, footer, estadísticas) y el anclaje de sección son de landing: `profiles/web/landing/translator_rules.mjs` y `check_postprocess.mjs`.

| Archivo | Rol |
|---|---|
| `web/validation/framework.mjs` | **Validation framework (06/10, paso 2): CÓMO se valida.** Abre la página en Chromium, recarga antes de cada chequeo, junta errores y diálogos, y llama al chequeo del Validation profile. `composeValidation(cadena)`, `normalizeCheck(c, catálogo)`. |
| `web/validation/validation_web.mjs`, `web/landing/validation.mjs`, `web/app/validation.mjs`, `web/game/validation.mjs` | **Validation profiles, uno por tipo (paso 2): QUÉ se valida.** Se suman por la cadena del tipo (web → web/app → web/game; web → web/landing). El de juego lee el Standard que siguió el Specialist (`standard.validation`): dónde están los niveles, la lógica, el tablero y los escenarios; sin Standard esos chequeos dan NOT_APPLICABLE. Suma `game_scenario` (lo elige el traductor para "próximo nivel") y corre SIEMPRE `looks_distinct` (compuerta) y `layout_stable` (informa). |
| `web/validation/lib.mjs`, `web/validation/page_tools.mjs` | Piezas compartidas: funciones que corren en la página (SNAP, MARK_SECTION…) y herramientas de página (escenarios, cómo se ve lo dibujado, estabilidad, sonda de llamadas `runCallsProbe`). `page_tools` lo usan Validation y el harness: mismo código en los dos lados. Desde el 12/10 la sonda de llamadas guarda también con qué argumentos se llamó cada método (`args`) y desde qué control (`via`). |
| `profiles/web/seguridad/` (`profile.mjs`, `validation.mjs`, `test_seguridad.mjs`) | **Validation profile POR TEMA (12/10): seguridad web.** Segundo eje además del tipo: se suma solo a todo proyecto web (`concernsFor` en `profiles/registry.mjs`), no es elegible ni da roles. SEG-1 `text_stays_text`: lo que escribe el usuario se ve como texto y no se ejecuta (XSS). El core lo corre después de los requisitos y lo deja aparte en `evidence.concerns`. 10 tests. |
| `harness/assignments.mjs` + `test_assignments.mjs` | **Tareas → pasos del Specialist (14/10, punto 9).** Reparte las Atomic Tasks por su pieza según la receta (`recipe.pasos`, `recipe.autor`); el motor (v0.12) pone "TAREAS DE ESTE PASO" en cada pedido y guarda qué tareas recibió cada paso. Sin receta o sin piezas: notas, como antes. Tests: 19. |
| `build/snapshots/kanban_receta_v03_snapshot.json` | Brief del Kanban 14/10 + 28 tareas con pieza (3ª corrida del bench, rep 1), para correr el build del punto 9 sin la UI. |
| `standards/web/app/estado/recipe.mjs` | **Receta del Standard para el Atomizer (14/10, v0.3 DRAFT: pieza `controles`, que resuelve el harness).** Piezas datos/logica/vista/estilo/controles (atadas a pasos del Standard, con su autor: `PIEZA_AUTOR`) y reglas que salen del Standard. Viaja en el profile web/app (`atomizerRecipe`); el Atomizer la suma al prompt y pide `"pieza"` en cada tarea. |
| `build/recipe_bench.mjs` + `recipe_metrics.mjs` + `test_recipe.mjs` | **Medición de la receta (14/10).** Mismas fases, Atomizer sin y con receta; cuenta alternativas, pares A/B (aparte), trabajo del harness, campos vagos, acciones mezcladas, pieza válida, vista con controles, controles sin su logica (métricas v0.3). Deja `build/bench/recipe_<fecha>/`. Fixtures: `build/fixtures/recipe_bench_2026-10-14.json` (1ª corrida real, v0.1) `_v02.json` (2ª, 2 repeticiones) y `_v03.json` (3ª, pieza controles). Tests: 44. |
| `profiles/web/validation/fixtures/real_kanban_c10`, `real_kanban_c11` | Apps reales de los builds del 14/10 con tareas por paso (`2026-10-14T19-22-44`, `T20-08-35`): columnas apiladas por un contenedor de más dentro de `#app`. Las usa `test_controls` (v0.4.3). |
| `standards/web/app/estado/controls.mjs` + `test_controls.mjs` | **Plan de controles (12/10, v0.4.0).** De la forma del estado y el contrato saca los tipos de elemento, a qué elemento pertenece cada acción y de dónde sale cada param (dueño, contexto, elección, campo). Escribe `js/acciones.js` (`controlesDe(tipo, elemento, estado)`) y `js/controles.js`. No nombra ningún dominio. Tests: 26 (5 formas de estado, Chromium con una lista y con el Kanban real: 6/6; v0.4.1: un destino sin origen es elección, verificado con la 6ª corrida real `fixtures/real_kanban_c6`). |
| `web/app/calls_gate.mjs` + `web/app/test_calls_gate.mjs` | **Compuerta de llamadas (12/10, punto 7).** Usa la pantalla como una persona y mira, por cada acción del contrato, si alguna vez se llamó con datos de verdad (sin params vacíos, con ids que existen, y dibujando después). Si no, los requisitos de esa acción quedan FAIL. Nunca suma un PASS. Lee el contrato y las reglas del Standard (`standard.validation.contract/calls/actions/idValues`). La corre el core con `B.validationGates`. Tests: 22 (juez sin navegador, una lista bien hecha y rota en Chromium, y las corridas reales 3ª y 4ª del Kanban en `fixtures/real_kanban_c3` y `c4`). |
| `web/validation/check_catalog.mjs` | Compatibilidad (v0.9): junta todos los Validation profiles para el traductor y los tests; `validationFor(cadena, {standard})` arma el de un tipo. |
| `web/validation/check_translator.mjs` | Traductor v0.4 (Qwen); reglas comunes de la plataforma + las del profile: requisito → chequeos del catálogo. No escribe código; el harness descarta lo que no cumple el esquema. `anchorSections` (determinista, ahora en `landing/check_postprocess.mjs`) agrega a los chequeos de sección las palabras de la etiqueta de la feature y el ancla `data-feature`. |
| `web/validation/form_runtime.mjs` | Utilidades compartidas con el holdout del piloto: llenar y enviar formularios, juzgar envío bloqueado/aceptado, y `waitForSettle` (espera a que el DOM quede quieto, sin timers cortos pendientes ni "Cargando…"). |
| `web/validation/test_check_catalog.mjs` + `web/validation/fixtures/` | 27 casos (v0.6.1: `real_boxworld_b3`; v0.6: `render_ok/mal`, `real_boxworld_b2` y `real_p22_v071` para `components_render`; incluye `visible_ok/mal` y las dos corridas reales de Project22 `real_p22_v05` / `real_p22_v061` como control positivo y negativo de `sections_visible`); antes 13 casos de resultado conocido (formularios del piloto + secciones: ok, grilla sin carrusel, vacía, carga lenta). `node profiles/web/validation/test_check_catalog.mjs` |

Veredicto por requisito: **PASS** (todo pasa y al menos un chequeo falla en el esqueleto vacío) · **FAIL** · **SIN_EVIDENCIA** (todo pasa, pero también en el esqueleto: no discrimina) · **SIN_CHEQUEO** (el traductor no encontró chequeos).

Experimentos del traductor (con control): `experiments/exp_translator.mjs` (formulario del piloto, 4/5 traducciones discriminan) y `experiments/exp_translator_sections.mjs` (R1/R3/R4 de la landing sobre esqueleto, v0.3, v0.4 y fixtures; v0.1 dio R1 0/5 → `anchorSections`).

## API (`server.mjs`)

| Ruta | Qué hace |
|---|---|
| `POST /api/intent-forge` | Un paso de la entrevista. Al completar, escribe `refined_prompt.json` y `answer_key_requirements.json`. |
| `POST /api/approve-intent` | Reescribe esos dos archivos con la versión aprobada. |
| `GET /api/stage` | Etapa vigente + criterio + sha256 (leídos de `ProjectStage.md` en cada pedido). |
| `POST /api/stage-check` | `{brief, fases}` → veredicto por fase, `flagged`, `schema_complete`, `feedback` y `logs`. |
| `POST /api/completeness-review` | Corre el reviewer v3 sobre el grafo y devuelve `findings` (array plano con `.type`) + `logs` + `term_coverage` (aviso por palabras). Guarda cada revisión en `evidence/term_coverage/<review_id>.json`. |
| `GET /api/version` | `BUILD_ID` de `script.js` tal como está en disco. Si la pestaña abierta tiene otro, la UI avisa y bloquea "Confirmar" (evita correr JS viejo). Los estáticos se sirven con `Cache-Control: no-store`. |
| `POST /api/term-label` | `{review_id, requirement_id, label: "hueco_real" \| "falso_aviso" \| null}` → guarda la etiqueta de Miche en ese archivo. |

`refined_prompt.json` y `answer_key_requirements.json` son **salidas de cada corrida** y están en `.gitignore`.
