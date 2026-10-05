# WebMCP — MicheLab

Motor local de orquestación que convierte una intención humana en un **grafo de Atomic Tasks**
validado, pensado para correr con modelos chicos en una GPU de 8 GB (LM Studio).

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

---

## Requisitos y arranque

- **Node.js 22+** (usa `fetch` nativo y ES modules).
- **LM Studio** en `http://127.0.0.1:1234` con:
  - `google/gemma-4-e4b` → TechLeader y Atomic Engine.
  - `qwen2.5-7b-instruct` → Intent Forge y Completeness Reviewer.
  - **CORS habilitado**: TechLeader y el Atomic Engine llaman a LM Studio directo desde el navegador.

```bash
node server.mjs
# → http://localhost:3000
```

Para el build y Validation (una vez): `npm install` y `npx playwright install chromium`.

---

## Archivos

| Archivo | Rol |
|---|---|
| `server.mjs` | Servidor HTTP (puerto 3000): sirve la UI y expone la API. |
| `index.html` | UI: chat único (Intent Forge + decisiones), refined_prompt fijo, panel de razonamiento, lista de tareas y preview. |
| `script.js` | Orquestación en el navegador: fases del chat, TechLeader, grafo, validaciones y reintentos. |
| `profiles/` | **Validation Profiles + Standards por tipo de artefacto (05/10).** `registry.mjs` resuelve el tipo declarado (`refined_prompt.profiles`). Ver `profiles/README.md`. |
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

### Piloto Specialist → Artifact → Validation (`pilot/`)

| Archivo | Rol |
|---|---|
| `pilot/form_pilot.json` | Brief y las 6 tareas de la Feature "Formulario de contacto", copiadas textuales del graph aprobado de Project20. **Sin** criterios_holdout. |
| `pilot/specialist_runner.mjs` | Specialist Frontend (Gemma, temperatura 0): una llamada por Atomic Task, en orden de dependencias, sobre un único `index.html`. Guarda el HTML y la respuesta cruda de cada paso. Corta si le llega texto del holdout. |
| `pilot/holdout/form_holdout.mjs` | **Validation** (usa `profiles/web/validation/form_runtime.mjs`): abre el artefacto en Chromium real (Playwright), sin red, y decide PASS/FAIL por código. "Obligatorio" se mide por comportamiento (se vacía un campo y se envía), no por el atributo `required`. El Specialist nunca lo ve. |
| `pilot/test_form_holdout.mjs` + `pilot/fixtures/` | Calibración del validador: 8 artefactos de resultado conocido (HTML5, validación JS, alert, sin preferencias, todo opcional, error JS, sin form). |
| `pilot/run_pilot.mjs` | Corre todo y escribe `pilot/runs/<fecha>/evidence.json`, con Validation sobre **cada paso** y sobre el final. `--validate DIR` revalida una corrida. |

```bash
npm install                      # instala playwright (una vez)
npx playwright install chromium  # descarga el navegador (una vez)
node pilot/test_form_holdout.mjs # 8/8 antes de confiar en la Evidence
node pilot/run_pilot.mjs         # con LM Studio (gemma-4-e4b)
```

Criterios del holdout (aprobados 30/09): C1 carga sin errores de JS · C2 hay un form visible · C3 todos los campos son obligatorios salvo a lo sumo uno · C4 hay exactamente un campo opcional y es el de preferencias (si falta → FAIL) · C5 envío vacío bloqueado · C6 email mal formado bloqueado (N/A si no hay email) · C7 datos válidos → el envío pasa. Info sin FAIL: campos sin label.

**Evidencia del piloto (30/09, `pilot/runs/`):**

| Corrida | F4.1 | Resultado | Falla |
|---|---|---|---|
| `2026-09-30T15-57-28` (graph real de Project20) | "nombre, email, mensaje" | **FAIL** | C4: no hay campo de preferencias (aparece en F4.1 y ningún paso posterior lo corrige) |
| `2026-09-30T20-59-26_form_pilot_f41_pref` (contrafactual) | + "un campo de preferencias del cliente que sea opcional" | **PASS** 7/7 | — |

- Única variable cambiada: la descripción de F4.1. Los pasos F1.1, F1.2 y F1.6 dieron el **mismo sha256** en las dos corridas: Gemma a temperatura 0 fue determinista con el mismo input.
- Conclusión: el Specialist cumple la tarea tal como está escrita (tenía la Feature completa en el brief y no agregó el campo por su cuenta). El defecto está **arriba**: la Feature 2 se perdió al traducirse a tareas (TechLeader/Atomizer), y el Completeness Reviewer v3 la dio por cubierta. Validation ejecutando el artefacto fue lo único que lo detectó.
- Costo: ~10 min por corrida de 6 tareas en gemma-4-e4b (F4.2 y F4.3 ~2,5 min cada una).

### Experimentos sobre el Completeness Reviewer (`experiments/`)

Caso: Project20, graph real (F4.1 sin campo de preferencias) y graph contrafactual (F4.1 con el campo). `experiments/p20_graph.json` guarda las 19 tareas.

**1. `exp_split_reviewer.mjs` (v0.6, 5 reps por celda)** — `evidence/split_reviewer_2026-09-30T21-44-13.json`

| Requisitos \ Tareas | solo títulos | título + descripción |
|---|---|---|
| 4 originales | 0/5 GAP | 0/5 GAP |
| R2 partido (R2a/R2b) | 3/5 GAP | 1/5 GAP |

Cuando dice "cubierto", el reason copia el texto del requisito sin respaldo en las tareas.

**2. `exp_quote_reviewer.mjs` (v0.7, regla de cita, opt-in `requireQuotes`)** — `evidence/quote_reviewer_2026-09-30T22-34-18.json`

| Celda | Esperado | Resultado |
|---|---|---|
| A partido + real | GAP solo en R2b | R2b GAP 5/5, pero **R2a falso GAP 5/5** |
| B partido + contrafactual (control) | ningún GAP | **R2b falso GAP 5/5**, R2a falso GAP 5/5, R4 1/5 |
| C sin partir + real | sin GAP | sin GAP 5/5 (no detecta) |

- El "acierto" de A no es discriminación: Qwen dice R2b no cubierto **también** cuando F4.1 lo pide literal (B). Sin el control lo habríamos dado por bueno.
- R2a cae siempre porque Qwen cita **títulos** ("Implementar la estructura HTML del formulario de contacto") y la palabra propia ("obligatorios") está en la descripción.
- **v0.7 no se adopta.** Queda opt-in, apagada en el pipeline.

**3. Análisis determinista (sin LLM), sobre los mismos datos:** términos propios de cada requisito (`distinctiveTerms`) presentes en alguna tarea (título + descripción):
- A: R2b 1/3 (faltan *opcional, preferencias*) · B: R2b 3/3 · C (sin partir): R2 3/5 (faltan *opcional, preferencias*).
- Ruido en los tres: R1 (faltan *superior, inferior*) y R4 (faltan *actualmente, obtenidos*).
- Discrimina A vs B sin modelo y aun sin partir la Feature.

**4. `term_coverage.mjs` sobre los 3 casos con verdad conocida (P20, recetas, instrumentos):** los 9 requisitos no cubiertos tienen ≥1 palabra propia faltante (9/9); pero 8 de 13 cubiertos también (buscar/búsqueda, guardar/marcar favorita, ejemplos enumerados, superior/inferior). Con umbral <50%: 7/9 y 1 falso aviso, umbral elegido mirando los mismos datos → **no se usa umbral**.
- **Decisión (30/09):** entra al pipeline como **aviso informativo** con la lista de palabras faltantes, y Miche etiqueta cada aviso (🕳️ hueco real / 🙈 falso aviso) en una tarjeta del chat. Las etiquetas quedan en `evidence/term_coverage/` y son los casos para calibrarlo.

### Build: graph → SPA completa (`build/` core + `profiles/web/landing/`)

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

### Validation como juez de cobertura (`profiles/web/validation/`)

Las reglas 5-6 del traductor (secciones, hero, footer, estadísticas) y el anclaje de sección son de landing: `profiles/web/landing/translator_rules.mjs` y `check_postprocess.mjs`.

| Archivo | Rol |
|---|---|
| `web/validation/check_catalog.mjs` | Catálogo **cerrado** de chequeos que ejecuta Chromium (Playwright) y decide por código: `no_js_errors`, `text_visible`, `control_visible`, `field_exists`, `field_required`, `field_optional`, `submit_empty_blocked`, `valid_submit_passes`, `click_reveals`, y desde v0.3 `section_content`, `section_items`, `carousel` (miden el contenido de la sección, sin contar títulos). **v0.5 (03/10): `sections_visible`**, chequeo de base que corre siempre el harness (el traductor no lo ve): lleva cada pieza con `data-feature` a pantalla con la rueda y cuenta las palabras que se ven de verdad (opacidad acumulada, visibility, display, tamaño); si se ve menos del 50 %, el requisito de esa pieza es FAIL aunque sus chequeos pasen (compuerta, nunca suma PASS). Origen: en Project22 v0.6.1 hero, testimonios, estadísticas y contacto quedaron con `opacity:0` y el juez daba PASS. **v0.6 (05/10): `components_render`**, también de base y compuerta: por cada `<script data-component>`, los contenedores que su JS nombra (#id/.clase), vacíos en el HTML sin JS; si siguen todos vacíos después de cargar, el componente no dibujó nada (canvas: sin píxeles pintados). Origen: Boxworld build 2, tablero vacío por una función nunca llamada. |
| `web/validation/check_translator.mjs` | Traductor v0.4 (Qwen); reglas comunes de la plataforma + las del profile: requisito → chequeos del catálogo. No escribe código; el harness descarta lo que no cumple el esquema. `anchorSections` (determinista, ahora en `landing/check_postprocess.mjs`) agrega a los chequeos de sección las palabras de la etiqueta de la feature y el ancla `data-feature`. |
| `web/validation/form_runtime.mjs` | Utilidades compartidas con el holdout del piloto: llenar y enviar formularios, juzgar envío bloqueado/aceptado, y `waitForSettle` (espera a que el DOM quede quieto, sin timers cortos pendientes ni "Cargando…"). |
| `web/validation/test_check_catalog.mjs` + `web/validation/fixtures/` | 27 casos (v0.6.1: `real_boxworld_b3`; v0.6: `render_ok/mal`, `real_boxworld_b2` y `real_p22_v071` para `components_render`; incluye `visible_ok/mal` y las dos corridas reales de Project22 `real_p22_v05` / `real_p22_v061` como control positivo y negativo de `sections_visible`); antes 13 casos de resultado conocido (formularios del piloto + secciones: ok, grilla sin carrusel, vacía, carga lenta). `node profiles/web/validation/test_check_catalog.mjs` |

Veredicto por requisito: **PASS** (todo pasa y al menos un chequeo falla en el esqueleto vacío) · **FAIL** · **SIN_EVIDENCIA** (todo pasa, pero también en el esqueleto: no discrimina) · **SIN_CHEQUEO** (el traductor no encontró chequeos).

Experimentos del traductor (con control): `experiments/exp_translator.mjs` (formulario del piloto, 4/5 traducciones discriminan) y `experiments/exp_translator_sections.mjs` (R1/R3/R4 de la landing sobre esqueleto, v0.3, v0.4 y fixtures; v0.1 dio R1 0/5 → `anchorSections`).

### API (`server.mjs`)

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

---

## Cambios desde el último commit (`feat: aviso 'mencionaste y no incluí'…`)

**Profiles: separar core de tipo de proyecto (05/10, decisión de Miche)**
- *Por qué:* el harness daba por hecho una página de header + secciones + footer; cada tipo nuevo (landing, Kanban, Boxworld) agregaba reglas que después recibían todos los proyectos. Ej.: el traductor mandaba las reglas de hero/footer/estadísticas (~540 tokens) y el catálogo entero con cada requisito, también al Kanban.
- *Qué:* `profiles/` con dos niveles: plataforma (`web`: roles, reglas por rol, catálogo de Chromium, encapsulado) y tipo (`web/landing`: page plan, Specialist por componentes, reglas 5-6 del traductor; `web/app`: DRAFT vacío que usa el build de landing y lo declara en `borrowed`). Todo DRAFT. El tipo lo elige Miche en un selector de la UI (como la etapa) y queda en `refined_prompt.profiles`; sin tipo, falla fuerte.
- *Sin cambio de conducta (verificado):* con un LM Studio simulado y Chromium, antes y después del refactor son **byte a byte iguales** todos los pedidos al modelo (TechLeader, Atomizer, Checker, Re-Atomizer, page plan, traductor, Specialist por componentes y legacy), los artefactos y las evidencias; solo se agregan la línea `[PROFILE]`, el campo `profiles` en `evidence.json` y `version: "0.2"` en role_dependencies. `npm test`: mismas cuentas que antes + 24 tests de profiles + role_dependencies y dependencias por fase (ahora en `npm test`).
- *Cambios chicos que salieron:* la nota "un carrusel se verifica con carousel" del traductor solo va si el profile tiene `carousel` en su catálogo; los tests de role_dependencies cortan si fallan (antes `console.assert` imprimía ✓ igual) y corren en Windows.
- *Pendiente:* llenar `web/app` (page plan de componentes de app, chequeos de flujo, reglas propias del traductor); decidir si Boxworld es `web/app` o `web/game`; build multi-artefacto (NodeMCU = firmware + web/app).

**Profiles web/app y web/game (05/10, Boxworld build 3; decisión de Miche: juego = `web/game`, hijo de `web/app`)**
- *Evidencia de origen (build 3, jugado con Playwright):* el page plan de landing partió el juego en #juego + #niveles (dos juegos movidos por las mismas flechas); ganaba con el primer movimiento (comparaba los objetivos consigo mismos); al ganar, reiniciar quedaba deshabilitado; cajas y avatar como casilleros extra de la grilla; el contador se verificó con `numbers_animate`; 5 de 8 requisitos SIN_CHEQUEO. Y las **restricciones** (las reglas del juego: paredes, empujar, cuándo se gana, 10x10) nunca llegaban al Specialist: `briefText` solo manda objetivo + features.
- *web/app v0.1:* plan determinista de una pantalla (un componente con todas las features; las de `refined.estilo` como transversales; sin header ni footer), restricciones y contexto del usuario en el brief (`REGLAS DEL USUARIO`), reglas A1–A4 (estado + `dibujar()`, sin DOMContentLoaded), hasta 11k tokens de respuesta, traductor sin secciones/hero/carrusel.
- *web/game v0.1 (extends web/app):* reglas G1–G6 (niveles como datos con posiciones iniciales y objetivos por separado, victoria desde el estado, reiniciar desde los datos, un listener de teclado, grilla dibujada entera) y `not_won_immediately` como chequeo de base del Specialist (con reintento).
- *Catálogo v0.7 (interacción):* `key_changes`, `click_changes`, `counter_on_action`, `not_won_immediately`, `reset_restores`. Probado sobre un juego correcto (`game_ok`: PPPP), uno con los bugs de b3 (`game_mal`: gana con un movimiento, reiniciar deshabilitado → PPFF), el b3 real (PPFF) y una página sin JS (FFFF → los PASS no son triviales).
- *Core:* la guardia de holdout cuenta como visible lo que el profile le pasa al Specialist (`specialistSees`): 5 de los 6 criterios holdout de Boxworld eran copia de restricciones del usuario y cortaban el build. `planPage(features, { refined })`. `componentsFromPlan` acepta `header: null` / `footer: null`.
- *Probado:* build completo con LM Studio simulado (perfil web/game: plan de 1 componente, 25 notas, reglas en el brief, el 1er intento con el bug de victoria → reintento por `not_won_immediately` → OK; traductor con catálogo de juego; R1, R2, R4, R7 PASS no triviales). 16 tests de web/app/game, 30 de profiles, 52 de componentes, 6 casos nuevos del catálogo. **Falta la corrida con Gemma y Qwen reales.**
- *Para Boxworld:* el snapshot declara `"profiles": ["web/app"]`; cambiarlo a `["web/game"]` (o elegir "Juego" en la UI en un proyecto nuevo).

**Build: lo que se perdía entre el graph y la página (05/10, Boxworld build 2)**
- *Evidencia de origen:* de 25 tareas del graph, al Specialist llegaron 2 (las que decían "juego"/"nivel"); la grilla, el avatar, las flechas, las colisiones, el empuje y los botones no los vio nadie. El `componente.js` de #juego era una sola función anónima `(root) => {…}` que nunca se llamaba: 330 líneas muertas, tablero vacío. El 1er intento se había rechazado por `const root = document.getElementById("juego")` (SyntaxError) y el reintento costó 6½ min. #niveles repitió ids de #juego. Validation dio PASS igual en lo que miró.
- *Cambios (core, valen para cualquier tipo):* `assignTasks`: toda tarea que no es de QA llega a un componente, por palabra clave o, si no nombra ninguno, al **principal** (la sección con más requisitos); el prompt lista todas con título y las primeras 12 con descripción (Boxworld: +~1k tokens). `autoInvoke` llama una función anónima que es todo el archivo; `dropRootRedeclare` saca `const root = …#mismo-id`. Chequeos de base por componente (con reintento): `components_render` (catálogo v0.6: los contenedores que su JS nombra siguen todos vacíos → no dibujó nada; no cuentan los "a demanda" como mensajes, feedback o lo que está dentro de un form) e ids repetidos con otro componente. En Validation, `components_render` es **compuerta** como `sections_visible`: los requisitos de un componente que no dibujó nada son FAIL. `evidence.json` guarda `components_render` y `specialist.tasks_assigned`.
- *Probado:* 52 tests de componentes (24 nuevos) y 4 casos nuevos del catálogo: `render_ok/mal`, Boxworld build 2 real (FAIL en #juego y #niveles) y Project22 v0.7.1 real (PASS: su `#formFeedback` vacío no cuenta). Con la función anónima llamada, el juego de Boxworld corre y aparece su error real (`classList.add('')`), que antes estaba escondido: ahora el reintento lo recibe. **Falta la corrida con Gemma real.**
- *Riesgo a mirar:* #juego ya usaba ~6.2k de 8k tokens de respuesta; con 25 notas puede cortarse por `length`.
- **Build 3 (05/10, con Gemma real):** las 25 tareas llegaron a #juego y el tablero de 10x10 se dibuja (`components_render` PASS, sin ids repetidos). Pero `sections_visible` dio **FAIL falso** en #juego (10/21): las 11 palabras eran el overlay de victoria con `style="display:none"`, que aparece al ganar; el reintento por ese falso problema se cortó por `length` (6 min perdidos). Catálogo v0.6.1: el texto dentro de un descendiente con `hidden` o `display:none` inline cuenta aparte ("a demanda"); la pieza misma oculta y el ocultamiento por CSS siguen fallando. Fixture `real_boxworld_b3`. Jugando con Playwright: el primer movimiento ya "gana" el nivel (compara las cajas con sus propios objetivos), las cajas y el avatar quedan como casilleros extra de la grilla, y #niveles es un segundo juego de 5x5 que también se mueve con las flechas. Nada de eso lo ve hoy Validation: falta un chequeo de interacción (punto 2).

**Build + Validation de punta a punta (01/10)** — ver secciones `build/` y `validation/` arriba.

**Piloto, experimentos del reviewer y aviso por palabras (30/09)** — ver `pilot/` y `experiments/` arriba. `term_coverage` quedó **solo en el log** (la tarjeta de etiquetado se desactivó: pedirle a Miche que juzgue cada requisito no escala; el juez de cobertura pasa a ser Validation ejecutando el artefacto).

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

---

## Pendientes conocidos

- **Persistencia en SQLite desconectada.** La ruta `/api/projects` (con `db.mjs`) existía en una versión anterior de `server.mjs` y se perdió; `persistProject()` sigue en `script.js` pero nada la llama. `db.mjs` y `test_db.mjs` quedan archivados hasta decidir si vuelve.
- **Chequeo de etapa: evidencia parcial.** Bench 30/09 con v0.1: 30/30 corridas con veredicto **solo para F1** (JSON válido, `finish_reason=stop`, ~70 tokens): Qwen copiaba el ejemplo de un elemento del system prompt → 0 fases evaluadas más allá de F1. v0.2 cambia una sola variable: el pedido es un esqueleto con todas las fases precargadas (`"?"` a completar).
  - **Bench v0.2 (30/09, 5 reps, `evidence/stage_check_2026-09-30T15-31-06.json`):** sin veredicto 0 (antes 21/25 por corrida). En los 4 casos **con descripción de fase**: 0 falsos OUT sobre 55 juicios IN (incluye "deploy pedido" 10/10 IN, regla 5 respetada) y 15/15 OUT detectados (hardening, admin no pedido). Todos los errores (14 falsos OUT, 5 OUT perdidos) caen en Project20 intentos 1-2, que **solo tienen nombre de fase**: marca "Formulario de contacto" como DEFERRED (4/5, es Feature explícita) y deja "Pruebas Funcionales, Optimización y Despliegue" IN_SCOPE (5/5, fase mixta leída por "Pruebas"). El admin no pedido sale DEFERRED en vez de EXCESS (para el reintento da igual). Límite conocido: fases con nombre ambiguo ("Configuración del entorno") quedan como `ANY` en la matriz.
- **Los "criterios_holdout" no son holdout en el pipeline:** `buildTechLeaderInput` (intent_brief.mjs) los manda a TechLeader como "Criterios de éxito". El piloto los mantiene fuera del Specialist; falta decidir si TechLeader debe verlos.
- **Gap que el reviewer no ve:** en Project20, F4.1 pide "nombre, email, mensaje" y no el campo de preferencias de la Feature 2; el reviewer v3 la dio por cubierta. El piloto (C4) lo detectó; el reviewer LLM no discrimina (experimentos 30/09).
- **Build: un solo proyecto validado (n=1).** Falta correr el pipeline completo en un segundo proyecto de otro tipo.
- **Build: cortes por `length`** en las últimas tareas (F5.1, F5.3) cuando los archivos crecen; se acepta lo que vino completo y se pierde el resto.
- **El build se corre por consola** desde un snapshot exportado; todavía no está integrado a la UI ni a `server.mjs`.
- **Intent Forge v0.3: `restricciones` y `estilo` no llegan todavía al Specialist** (lee solo `features`, donde el estilo sigue incluido).
- `deferredWork` se guarda pero no se muestra en la UI ni se persiste fuera del navegador.
- `runDependencyResolverTests()` — **TEST 7 falla** desde antes de este cambio: el motor sí rechaza la dependencia-objeto, pero el test busca el texto `INVALID_DEPENDENCY` y el mensaje real es otro. Además los tests usan `console.assert` e imprimen "✓" aunque fallen.
- TechLeader y el Atomic Engine llaman a LM Studio desde el navegador (requiere CORS); pasarlos por `server.mjs` unificaría logs y errores.
