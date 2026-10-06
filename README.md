# WebMCP — MicheLab

Motor local de orquestación que convierte una intención humana en un **prototipo construido y validado**,
pensado para correr con modelos chicos en una GPU de 8 GB (LM Studio).

Lo que lo guía:

- **Validar con evidencia, no con opiniones.** El juez es Validation ejecutando el artefacto en Chromium, comparado contra un esqueleto vacío como control.
- **Determinista antes que LLM.** El harness valida, repara y corta lo que puede decidir por código. Al modelo se le piden decisiones acotadas.
- **Falla fuerte.** Sin etapa, sin tipo de proyecto o sin revisión no se sigue en silencio.
- **Core universal, tipo de proyecto en `profiles/`.** Cada tipo (landing, app, juego) trae sus propias reglas, y todos nacen DRAFT.

## Pipeline

```
Tipo de proyecto (lo elige Miche: web/landing, web/app, web/game)   → profiles/
Intención del usuario
   ↓  Intent Forge: plantilla de 4 campos → entrevista (≤10 preguntas) → un ítem tipado por línea
refined_prompt  (+ confirmación humana: Confirmar / Ajustar)
   ↓  TechLeader: plan de fases, con la ETAPA de context/ProjectStage.md
   ↓  Stage Check del plan (rehace el plan si hay fases fuera de etapa)
   ↓  Atomic Graph: Atomizer → Checker → Re-Atomizer + dependencias
   ↓  role_dependencies (determinista) → Completeness Reviewer (acotado) → aprobado / reintento / decisión humana
snapshot del estado
   ↓  Specialist (Gemma): lo pone el profile (landing: por componentes; game: un archivo por paso)
Artefacto
   ↓  Validation: requisito → chequeos del catálogo, ejecutados en Chromium, con control sobre el esqueleto
Evidence por requisito: PASS / FAIL / SIN_EVIDENCIA / SIN_CHEQUEO
```

## Arranque

Requisitos: **Node.js 22+** y **LM Studio** en `http://127.0.0.1:1234`, con **CORS habilitado** (TechLeader y el Atomic Engine llaman desde el navegador). Modelos:

- `google/gemma-4-e4b` para TechLeader, Atomic Engine y Specialist.
- `qwen2.5-7b-instruct` para Intent Forge, el reviewer, el page plan y el traductor de chequeos.

```bash
npm install && npx playwright install chromium   # una vez (build y Validation)
node server.mjs                                  # UI en http://localhost:3000
node build/run_build.mjs snapshot.json           # construir y validar un proyecto aprobado
npm test                                         # todos los tests deterministas (sin LM Studio)
```

Un snapshot de antes del 05/10 no declara tipo: agregale `--profile web/landing`.

## Estructura

| Dónde | Qué |
|---|---|
| raíz | **Core**: `server.mjs` (API), `index.html` + `script.js` (UI y orquestación), `intent_brief.mjs` (Intent Forge), `techleader_prompt.mjs`, `atomic_engine_v5.js`, `plan_stage_check.mjs`, `completeness_reviewer3.mjs`, `review_gate.mjs`, `validation_profile_role_dependencies.mjs` |
| `context/` | `ProjectStage.md`: etapas (PROTOTYPE / MVP / FINAL) y criterio que reciben TechLeader y el reviewer |
| `build/` | **Core del build**: `run_build.mjs` (plan → Specialist → traducción → Validation con control → Evidence), `lm_stream.mjs`, `tokens.mjs` |
| `harness/` | **Motor general por archivos** (`files_engine.mjs`): corre los pasos que declara un Standard. No nombra ningún dominio (lo vigila `test_files_engine.mjs`) |
| `standards/` | **Standards** (lo que recibe el Specialist para un tipo de proyecto): hoy `web/game/grilla` (DRAFT). Ver [`standards/README.md`](standards/README.md) |
| `profiles/` | **Tipos de proyecto** (`web` plataforma, `web/landing`, `web/app`, `web/game`): plan, traductor, Validation y qué Standard usa cada uno. Ver [`profiles/README.md`](profiles/README.md) |
| `pilot/`, `experiments/` | Piloto del formulario (30/09) y experimentos del reviewer y del traductor |
| `evidence/`, `build/runs/` | Salidas de cada corrida (evidencia) |
| `_archivo/` | Versiones anteriores, fuera de git |

## Documentación

- [docs/ARCHIVOS.md](docs/ARCHIVOS.md): qué hace cada archivo, el build, Validation y la API del server.
- [docs/CAMBIOS.md](docs/CAMBIOS.md): historial de cambios, cada uno con su evidencia de origen y cómo se probó.
- [docs/EXPERIMENTOS.md](docs/EXPERIMENTOS.md): piloto Specialist → Validation y experimentos del Completeness Reviewer.
- [docs/PENDIENTES.md](docs/PENDIENTES.md): deuda y huecos conocidos.
- [profiles/README.md](profiles/README.md): contrato de un profile y cómo agregar un tipo.

`refined_prompt.json` y `answer_key_requirements.json` son salidas de cada corrida y están en `.gitignore`.

**Convención:** el README cuenta qué es y cómo se usa. Cada cambio nuevo se anota en `docs/CAMBIOS.md`, no acá.
