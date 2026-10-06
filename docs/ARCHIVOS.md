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
| `harness/files_engine.mjs` | **Motor general del Specialist por archivos (06/10, files_engine v0.9).** Corre los pasos de un Standard; clases de paso `data` (JSON → .js que arma el Standard), `logic` (lógica pura cargada en Node + pruebas de aceptación del Standard + reparación por función), `screen` (HTML + CSS con los ids del Standard), `render` (sonda en Chromium del Standard), `wiring` (chequeos de interacción). Reintentos solo del archivo que falla, `fixRedeclare`, reparación de sintaxis por tramo, no-carga siempre pierde, pasos con `needs` que no se corren si lo de arriba está roto. Tests: `node harness/test_files_engine.mjs` (incluye "el motor no nombra ningún dominio"). |
| `standards/` | **Standards por id (06/10).** `registry.mjs` (`getStandard`, falla fuerte). `web/game/grilla/` DRAFT v0.1: `standard.mjs` (contrato, pasos con su pedido, sonda, chequeos), `acceptance.mjs` (pruebas de `reglas.js`), `levels.mjs` (coordenadas → strings + solver), `test_grilla.mjs`. |
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
| `web/validation/check_catalog.mjs` | Catálogo **cerrado** de chequeos que ejecuta Chromium (Playwright) y decide por código: `no_js_errors`, `text_visible`, `control_visible`, `field_exists`, `field_required`, `field_optional`, `submit_empty_blocked`, `valid_submit_passes`, `click_reveals`, y desde v0.3 `section_content`, `section_items`, `carousel` (miden el contenido de la sección, sin contar títulos). **v0.5 (03/10): `sections_visible`**, chequeo de base que corre siempre el harness (el traductor no lo ve): lleva cada pieza con `data-feature` a pantalla con la rueda y cuenta las palabras que se ven de verdad (opacidad acumulada, visibility, display, tamaño); si se ve menos del 50 %, el requisito de esa pieza es FAIL aunque sus chequeos pasen (compuerta, nunca suma PASS). Origen: en Project22 v0.6.1 hero, testimonios, estadísticas y contacto quedaron con `opacity:0` y el juez daba PASS. **v0.6 (05/10): `components_render`**, también de base y compuerta: por cada `<script data-component>`, los contenedores que su JS nombra (#id/.clase), vacíos en el HTML sin JS; si siguen todos vacíos después de cargar, el componente no dibujó nada (canvas: sin píxeles pintados). Origen: Boxworld build 2, tablero vacío por una función nunca llamada. |
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
