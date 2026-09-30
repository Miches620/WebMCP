# WebMCP — MicheLab

Motor local de orquestación que convierte una intención humana en un **grafo de Atomic Tasks**
validado, pensado para correr con modelos chicos en una GPU de 8 GB (LM Studio).

```
Intención del usuario
   ↓  Intent Forge (entrevista, 1 pregunta por vez, hasta 10 iteraciones)
refined_prompt + answer_key_requirements
   ↓  confirmación humana (Confirmar / Ajustar)
TechLeader  → plan de fases
   ↓
Atomic Graph (Atomizer → Checker → Re-Atomizer) + reconciliación de dependencias
   ↓
Validation Profile: role_dependencies  (determinista, sin LLM)
   ↓
Completeness Reviewer v3 (schema acotado + reglas del harness)
   ↓
APPROVED  ·  o reintento de TechLeader con feedback (máx. 3)  ·  o decisión humana
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
| `context/stage_loader.mjs` | Extrae ese bloque (con hash SHA-256) y **falla fuerte** si falta. |
| `intent_forge_v02.ps1` | **Herramienta manual de debug**, no forma parte del pipeline. Su system prompt es parecido pero distinto al de `server.mjs`: editar uno no cambia el otro. |
| `test_completeness_bounded.mjs`, `test_completeness_bounded_2.mjs` | Casos de prueba del reviewer v3 (recetas / instrumentos). |
| `intent_mention_check.mjs` | Chequeo determinista "mencionaste y no incluí": frases del usuario en la entrevista cuyas palabras de contenido no aparecen en el refined_prompt. Lo usa la tarjeta de confirmación. |
| `test_mention_check.mjs` | 10 tests del chequeo anterior, con la conversación real de Project20: `node test_mention_check.mjs`. |
| `test_phase_dependency_check.mjs` | Regresión del chequeo de dependencias por fase (caso Project20). Determinista: `node test_phase_dependency_check.mjs`. |

### API (`server.mjs`)

| Ruta | Qué hace |
|---|---|
| `POST /api/intent-forge` | Un paso de la entrevista. Al completar, escribe `refined_prompt.json` y `answer_key_requirements.json`. |
| `POST /api/approve-intent` | Reescribe esos dos archivos con la versión aprobada. |
| `POST /api/completeness-review` | Corre el reviewer v3 sobre el grafo y devuelve `findings` (array plano con `.type`) + `logs`. |

`refined_prompt.json` y `answer_key_requirements.json` son **salidas de cada corrida** y están en `.gitignore`.

---

## Cambios desde el último commit (`feat: integrar completeness review y ciclo de validación`)

**Intent Forge integrado como chat**
- Un solo input y un solo botón; su texto y estado salen de una única función de fase
  (`IDLE / ASKING / AWAITING_CONFIRMATION / GENERATING / HUMAN_DECISION / DEFAULT`).
- Confirmar / Ajustar como botones dentro de la burbuja del chat; el refined_prompt queda fijo arriba del panel de razonamiento.
- System prompt reforzado: nunca `COMPLETE` en la primera respuesta, no inventar features cuando el usuario da solo una cantidad, features atómicas (sin "CRUD completo"), `criterios_holdout`.

**Bugs corregidos**
1. Aprobar mandaba a TechLeader solo `refined_prompt.objetivo`; ahora va el refined_prompt completo en el mismo formato de lista numerada que lee el reviewer.
2. El mensaje del usuario llegaba **duplicado** a Intent Forge (script.js y server.mjs lo agregaban los dos).
3. La UI leía `summary.gap_count` / `findings.GAP` como objeto por lente: el reintento por completitud **nunca se disparaba**. Ahora usa el array plano `findings[].type`.
4. En Intent Forge, un estado `ERROR` se pisaba con `ASKING` en el `finally`.

**Completeness Reviewer v3**
- Reemplaza a `completeness_reviewer.mjs` en el pipeline (`/api/completeness-review`).
- `extractRequirements` reconoce secciones (Features / Restricciones / Criterios de éxito) en vez de tomar la primera lista del texto.
- Soporta `opts.model` y `opts.logCallback` (los logs llegan al panel de Razonamiento).
- Inyecta el bloque de `context/ProjectStage.md` vía `stage_loader.mjs`.

**Chequeo de dependencias por fase (fix Project20)**
- El chequeo temprano que corre al terminar cada fase daba un **falso `MISSING_DEPENDENCY`** cuando una tarea dependía de otra que el Re-Atomizer había partido (Project20, intento 1: `F5.5 → F5.3`, con F5.3 reemplazada por `F5.3.R2.1..3`). Perdía un intento completo aunque la reconciliación final lo resolvía.
- Ahora el chequeo expande los ids reemplazados igual que `reconcileDependencies()` y exige que existan todos los reemplazos terminales. Sigue detectando ids inventados y autodependencias. 7 tests en `test_phase_dependency_check.mjs`.

**"Mencionaste y no incluí" en la confirmación de Intent Forge (Project20)**
- Al llegar el `COMPLETE`, la tarjeta de confirmación compara los mensajes del usuario con el refined_prompt (`intent_mention_check.mjs`, sin LLM) y lista las frases que quedaron afuera, con las palabras faltantes.
- Cada aviso se decide: **Incluir** · **Excluir a propósito** · **Falso aviso**. "Confirmar y generar" queda bloqueado hasta decidir todos.
- Con algún *Incluir*, el botón pasa a "Pedir a Intent Forge que agregue (N)": se manda un mensaje automático (marcado `auto`, no cuenta para el chequeo), Intent Forge reescribe el refined_prompt y el chequeo corre de nuevo. Una frase pedida se da por atendida si se cubrió al menos una de sus palabras faltantes; si no se cubrió ninguna, vuelve a aparecer.
- *Excluir* guarda las **palabras faltantes** (no la frase entera, que puede contener features válidas) y TechLeader las recibe en una sección final "Fuera de alcance … NO planificar". *Falso aviso* no vuelve a salir. Ambas persisten en `intentForge.exclusiones` / `ignoredMentions`.
- Los botones usan un listener delegado (el chat se reescribe con `innerHTML +=`), las tarjetas viejas quedan deshabilitadas y la tarjeta se reconstruye al recargar.
- Probado en navegador con la conversación de Project20 y Intent Forge simulado: 5 avisos → 2 Incluir, 1 Excluir, 2 Falso aviso → reescritura → 0 avisos → prompt de TechLeader con 6 features y "Fuera de alcance: precios".

**Limpieza**
- Reviewers anteriores (`completeness_reviewer.mjs`, `2`, `4`, `v2_qwen`), sus tests (`test_completeness_artificial*.mjs`), la copia de respaldo `porlasdudas/` y `michelab_council.html` pasan a `_archivo/` (fuera de git). Siguen disponibles en el historial.

---

## Pendientes conocidos

- **Persistencia en SQLite desconectada.** La ruta `/api/projects` (con `db.mjs`) existía en una versión anterior de `server.mjs` y se perdió; `persistProject()` sigue en `script.js` pero nada la llama. `db.mjs` y `test_db.mjs` quedan archivados hasta decidir si vuelve.
- **TechLeader no conoce el PROJECT_STAGE.** Resultado del debate del 29/09 (sin ratificar): sacar la instrucción de Context7 del prompt, agregar `project_stage` al refined_prompt y un chequeo de etapa a nivel **plan** (antes de atomizar), construido sobre `stage_loader.mjs`, verificado con una matriz de briefs.
- **Chequeo de menciones es heurístico** (palabras de 4+ letras, raíz de 5, lista corta de sinónimos): va a dar falsos avisos con redacciones distintas y no detecta pedidos parafraseados. Por eso no decide nada, solo pregunta. Las exclusiones todavía no llegan al Completeness Reviewer (lee solo features de `answer_key_requirements.json`, lo cual hoy alcanza).
- `runDependencyResolverTests()` — **TEST 7 falla** desde antes de este cambio: el motor sí rechaza la dependencia-objeto, pero el test busca el texto `INVALID_DEPENDENCY` y el mensaje real es otro. Además los tests usan `console.assert` e imprimen "✓" aunque fallen.
- TechLeader y el Atomic Engine llaman a LM Studio desde el navegador (requiere CORS); pasarlos por `server.mjs` unificaría logs y errores.
