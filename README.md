# WebMCP — MicheLab

Motor local de orquestación que convierte una intención humana en un **grafo de Atomic Tasks**
validado, pensado para correr con modelos chicos en una GPU de 8 GB (LM Studio).

```
Intención del usuario
   ↓  Intent Forge (entrevista, 1 pregunta por vez, hasta 10 iteraciones)
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
Specialist (Gemma)  → construye la SPA tarea por tarea, back simulado      [build/]
   ↓   esqueleto del harness + contrato api.js↔app.js
Artefacto: app/index.html + styles.css + api.js (mock) + app.js
   ↓
Validation: requisito → chequeos del catálogo (Qwen elige, el código ejecuta en Chromium)   [validation/]
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
| `atomic_engine_v5.js` | Atomizer / Checker / Re-Atomizer y `resolveDependencies`. |
| `validation_profile_role_dependencies.mjs` | Validation Profile determinista (4 reglas: 2 FAIL, 2 WARN) con 8 tests propios (`node validation_profile_role_dependencies.mjs`). |
| `completeness_reviewer3.mjs` | Completeness Reviewer v0.6-bounded: un veredicto por requisito y por tarea; el harness corrige `covered=true` sin tareas citadas. Acepta `opts.model` y `opts.logCallback`. |
| `context/ProjectStage.md` | Definición de etapas (PROTOTYPE / MVP / FINAL). El bloque entre `BEGIN_STAGE_BLOCK` / `END_STAGE_BLOCK` se inyecta en el reviewer. |
| `context/stage_loader.mjs` | Extrae ese bloque (con hash SHA-256) y **falla fuerte** si falta. También devuelve `stage` (p.ej. `PROTOTYPE`) y `criterion` (el bloque hasta "Cómo aplicarlo al revisar:", que es lo que recibe TechLeader). |
| `plan_stage_check.mjs` | Chequeo de etapa **a nivel plan**, antes de atomizar: un veredicto por fase (IN_SCOPE / DEFERRED / EXCESS), validado por el harness como el reviewer v3. Arma el feedback para TechLeader. |
| `test_plan_stage_check.mjs` | 8 tests deterministas (fetch simulado): `node test_plan_stage_check.mjs`. |
| `bench_stage_check.mjs` | **Matriz de briefs contra LM Studio real** (6 casos: Project20 intentos 1-3, deploy pedido, operación/hardening, exceso no pedido). `node bench_stage_check.mjs 5` → `evidence/stage_check_<fecha>.json`. |
| `intent_forge_v02.ps1` | **Herramienta manual de debug**, no forma parte del pipeline. Su system prompt es parecido pero distinto al de `server.mjs`: editar uno no cambia el otro. |
| `test_completeness_bounded.mjs`, `test_completeness_bounded_2.mjs` | Casos de prueba del reviewer v3 (recetas / instrumentos). |
| `intent_mention_check.mjs` | Chequeo determinista "mencionaste y no incluí": frases del usuario en la entrevista cuyas palabras de contenido no aparecen en el refined_prompt. Lo usa la tarjeta de confirmación. |
| `test_mention_check.mjs` | 10 tests del chequeo anterior, con la conversación real de Project20: `node test_mention_check.mjs`. |
| `term_coverage_check.mjs` | Aviso determinista (sin LLM) de cobertura por palabras: por requisito, las palabras **propias** que no aparecen en ninguna tarea (título + descripción). Corre dentro de `/api/completeness-review`; **no bloquea** ni dispara reintentos. |
| `test_reviewer_quotes.mjs` | 9 tests de la regla de cita v0.7 (opt-in, no adoptada). |
| `test_phase_dependency_check.mjs` | Regresión del chequeo de dependencias por fase (caso Project20). Determinista: `node test_phase_dependency_check.mjs`. |

### Piloto Specialist → Artifact → Validation (`pilot/`)

| Archivo | Rol |
|---|---|
| `pilot/form_pilot.json` | Brief y las 6 tareas de la Feature "Formulario de contacto", copiadas textuales del graph aprobado de Project20. **Sin** criterios_holdout. |
| `pilot/specialist_runner.mjs` | Specialist Frontend (Gemma, temperatura 0): una llamada por Atomic Task, en orden de dependencias, sobre un único `index.html`. Guarda el HTML y la respuesta cruda de cada paso. Corta si le llega texto del holdout. |
| `pilot/holdout/form_holdout.mjs` | **Validation**: abre el artefacto en Chromium real (Playwright), sin red, y decide PASS/FAIL por código. "Obligatorio" se mide por comportamiento (se vacía un campo y se envía), no por el atributo `required`. El Specialist nunca lo ve. |
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

### Build: graph → SPA completa (`build/`)

| Archivo | Rol |
|---|---|
| `build/run_build.mjs` | `node build/run_build.mjs snapshot.json` construye y valida. `--resume DIR` retoma una construcción cortada. `--validate DIR` solo valida (reusa `checks.json`); con `--retranslate` vuelve a traducir y archiva el `checks.json` anterior. Escribe `build/runs/<fecha>_<proyecto>/`: un directorio por paso, respuestas crudas, `steps.json`, `checks.json`, `baseline/` y `evidence.json`. |
| `build/specialist_spa.mjs` | Specialist v0.6 (gemma-4-e4b, temp 0). Cuatro archivos (`index.html`, `styles.css`, `api.js` = back simulado en `window.api`, `app.js`); Gemma devuelve solo los que cambia (`### FILE:`). El harness arma el esqueleto desde el plan de página (header + nav, secciones con `data-feature`, footer). Las exclusiones de Intent Forge no le llegan (son para TechLeader). Un criterio holdout que repite una feature no dispara la guardia de holdout. Después de cada paso, chequeo de contrato sin LLM (ejecuta `api.js` en un sandbox y compara con las llamadas de `app.js`) y un reintento si falta algo. "SIN CAMBIOS" no es error. |
| `build/page_plan.mjs` | **Plan de página (v0.5, 02/10)**: antes del build, Qwen propone header, secciones en orden, footer y qué features son transversales (diseño, responsive, hover, código); el harness lo valida (toda feature con lugar, ids únicos, refs válidas; un reintento) y el esqueleto se arma con eso (`data-feature="R3"`, una feature puede estar en varias secciones). Si el plan falla: esqueleto mínimo. Se guarda en `page_plan.json` de la corrida. Probarlo sin construir: `node build/page_plan.mjs snapshot.json 3`. Tests: `node build/test_page_plan.mjs` (14). |
| `build/file_diet.mjs` | **Dieta de archivos (Specialist v0.6, 02/10)** para PCs de 8 GB (Gemma con ~12k de contexto). Cada tarea recibe completos solo los archivos de su tipo principal (sale del título: estructura → index.html, estilo → styles.css, lógica → app.js + api.js, Backend/DBA → api.js); el resto va como RESUMEN (ids/clases, selectores, funciones). Gemma responde con `### APPEND: styles.css|app.js|api.js`, `### SECTION: <id>` (reemplaza ese elemento de index.html; si pierde `data-feature`, el harness lo repone) o `### FILE:` solo para archivos recibidos completos. Si el prompt no deja ≥3500 tokens para responder, los secundarios pasan a resumen (los más grandes primero); `max_tokens` = contexto − prompt. Tests: `node build/test_file_diet.mjs` (23). Evidencia de origen: Project22, 10/31 pasos cortados con prompt + respuesta = 12032. |
| `build/lm_stream.mjs` | Llamadas a LM Studio en streaming (evita el corte de 300 s de undici en tareas largas). |

**Evidencia (01/10, Landing de Café, 19 tareas):** v0.2 (un solo HTML) se cortó por `length` desde la tarea 12 · v0.3 (multi-archivo) terminó 19/19 pero sin header/footer y con `api.crearContacto()` inexistente · **v0.4: PASS 4/4, ningún PASS trivial** (`build/runs/2026-10-01T20-08-48_*`). Detalle en el doc del proyecto `claude/evidencia_build_landing_2026-10-01.md`.

### Validation como juez de cobertura (`validation/`)

| Archivo | Rol |
|---|---|
| `validation/check_catalog.mjs` | Catálogo **cerrado** de chequeos que ejecuta Chromium (Playwright) y decide por código: `no_js_errors`, `text_visible`, `control_visible`, `field_exists`, `field_required`, `field_optional`, `submit_empty_blocked`, `valid_submit_passes`, `click_reveals`, y desde v0.3 `section_content`, `section_items`, `carousel` (miden el contenido de la sección, sin contar títulos). |
| `validation/check_translator.mjs` | Traductor v0.3 (Qwen): requisito → chequeos del catálogo. No escribe código; el harness descarta lo que no cumple el esquema. `anchorSections` (determinista) agrega a los chequeos de sección las palabras de la etiqueta de la feature y el ancla `data-feature`. |
| `validation/form_runtime.mjs` | Utilidades compartidas con el holdout del piloto: llenar y enviar formularios, juzgar envío bloqueado/aceptado, y `waitForSettle` (espera a que el DOM quede quieto, sin timers cortos pendientes ni "Cargando…"). |
| `validation/test_check_catalog.mjs` + `validation/fixtures/` | 13 casos de resultado conocido (formularios del piloto + secciones: ok, grilla sin carrusel, vacía, carga lenta). `node validation/test_check_catalog.mjs` |

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

**Build + Validation de punta a punta (01/10)** — ver secciones `build/` y `validation/` arriba.

**Piloto, experimentos del reviewer y aviso por palabras (30/09)** — ver `pilot/` y `experiments/` arriba. `term_coverage` quedó **solo en el log** (la tarjeta de etiquetado se desactivó: pedirle a Miche que juzgue cada requisito no escala; el juez de cobertura pasa a ser Validation ejecutando el artefacto).

**Intent Forge:** una exclusión guarda las palabras faltantes **y** la frase original como contexto (`palabras (lo que dijiste: "...")`); TechLeader recibe "NO planificar lo que nombran estas palabras; el resto de la frase es solo contexto".

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
- **Los "criterios_holdout" no son holdout en el pipeline:** `buildTechLeaderInputFromRefinedPrompt` los manda a TechLeader como "Criterios de éxito". El piloto los mantiene fuera del Specialist; falta decidir si TechLeader debe verlos.
- **Gap que el reviewer no ve:** en Project20, F4.1 pide "nombre, email, mensaje" y no el campo de preferencias de la Feature 2; el reviewer v3 la dio por cubierta. El piloto (C4) lo detectó; el reviewer LLM no discrimina (experimentos 30/09).
- **Build: un solo proyecto validado (n=1).** Falta correr el pipeline completo en un segundo proyecto de otro tipo.
- **Build: cortes por `length`** en las últimas tareas (F5.1, F5.3) cuando los archivos crecen; se acepta lo que vino completo y se pierde el resto.
- **El build se corre por consola** desde un snapshot exportado; todavía no está integrado a la UI ni a `server.mjs`.
- **Intent Forge "Incluir":** el mensaje automático hace que Qwen pegue la frase literal como feature.
- `deferredWork` se guarda pero no se muestra en la UI ni se persiste fuera del navegador.
- **Chequeo de menciones es heurístico** (palabras de 4+ letras, raíz de 5, lista corta de sinónimos): va a dar falsos avisos con redacciones distintas y no detecta pedidos parafraseados. Por eso no decide nada, solo pregunta. Las exclusiones todavía no llegan al Completeness Reviewer (lee solo features de `answer_key_requirements.json`, lo cual hoy alcanza).
- `runDependencyResolverTests()` — **TEST 7 falla** desde antes de este cambio: el motor sí rechaza la dependencia-objeto, pero el test busca el texto `INVALID_DEPENDENCY` y el mensaje real es otro. Además los tests usan `console.assert` e imprimen "✓" aunque fallen.
- TechLeader y el Atomic Engine llaman a LM Studio desde el navegador (requiere CORS); pasarlos por `server.mjs` unificaría logs y errores.
