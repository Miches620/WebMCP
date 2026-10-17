# WebMCP — MicheLab

Motor local que convierte una idea de Miche en un **prototipo construido y validado**, pensado para modelos chicos en una GPU de 8 GB (LM Studio).

Lo que lo guía:

- **Validar con evidencia, no con opiniones.** El juez es Validation: usa la app en Chromium como una persona y la compara contra un esqueleto vacío como control.
- **Estricto en el QUÉ, flexible en el CÓMO.** Lo que tiene que hacer la app se escribe como una *planilla de comportamientos* verificables. Cómo se programa lo decide el Specialist, guiado por un Standard.
- **Gemma sola es la línea base.** Todo experimento se compara contra lo que hace el mismo modelo sin webmcp (`build/validate_external.mjs`). Si el sistema no le gana, el cuello de botella somos nosotros.
- **Determinista antes que LLM.** El harness valida, repara y corta lo que puede decidir por código. A los modelos se les piden decisiones acotadas.
- **Falla fuerte.** Sin etapa, sin tipo de proyecto o sin revisión, no se sigue en silencio.
- **Core universal, tipo de proyecto en `profiles/`, forma de trabajar en `standards/`.** Todo nace DRAFT; pasar a OFICIAL lo decide la evidencia.

## Pipeline (16/10)

```
Tipo de proyecto + Standard (los elige Miche en la UI)                 → profiles/, standards/
Idea de Miche
   ↓  [próximo] Searcher: busca en la web (SearXNG local) y deja fichas con fuentes
   ↓  Intent Forge: plantilla → entrevista (≤10 preguntas) → un ítem tipado por línea
refined_prompt  (+ confirmación humana: Confirmar / Ajustar)
   ↓  TechLeader: plan de fases, con la ETAPA (context/ProjectStage.md) y el STACK del Standard
   ↓  Stage Check + Stack Check del plan (rehace el plan si se sale de la etapa o nombra otro stack)
   ↓  Atomic Graph: Atomizer (también recibe el STACK) → Checker → Re-Atomizer + dependencias
   ↓  role_dependencies (determinista) → Completeness Reviewer (Qwen, por tandas, 3 reintentos) → aprobado / decisión humana
snapshot automático  (build/snapshots/auto/)
   ↓  Requisitos del Standard: se verifican y, con tu confirmación, se instalan
   ↓  Specialist (Gemma) por pasos del Standard (contrato → lógica → acciones → pantalla → dibujo → controles)
Artefacto (build/runs/<fecha>_<proyecto>/app/)
   ↓  Validation: con PLANILLA (dado / hago / veo) si el refinado la trae; si no, traductor + flujos
Evidence por requisito: PASS / FAIL / SIN_EVIDENCIA / SIN_CHEQUEO
```

## Qué hay que instalar

| Qué | Para qué | Cómo |
|---|---|---|
| **Node.js 22+** | todo | [nodejs.org](https://nodejs.org) |
| **LM Studio** | los modelos | servidor en `http://127.0.0.1:1234`, con **CORS habilitado** (TechLeader y el Atomic Engine llaman desde el navegador) |
| `google/gemma-4-e4b` | TechLeader, Atomic Engine, Specialist | cargado con **12000** de contexto (ver variables abajo) |
| `qwen2.5-7b-instruct` | Intent Forge, Completeness Reviewer, traductor de chequeos; **filas de la planilla** (próximo) | cargado con **16000** de contexto |
| Paquetes de npm + Chromium | build y Validation (Playwright), Standard `web/app/plantillas` (Handlebars) | `npm install` y `npx playwright install chromium` (una vez) |
| **SearXNG** (Docker) | el **Searcher** (en construcción): busca en la web antes de Intent Forge | paso a paso abajo. Hasta que el Searcher exista, el pipeline anda sin él |

Los requisitos de cada Standard (Node, Playwright, Chromium, Handlebars…) los verifica webmcp antes de construir. Si falta algo, te ofrece instalarlo (botón en la UI, o `s/N` en la consola) y corre solo el comando escrito en la ficha del Standard. También a mano: `npm run requisitos`.

### Variables (opcionales)

| Variable | Por defecto | Qué es |
|---|---|---|
| `WEBMCP_CONTEXT` | `16000` | contexto con el que está cargada **Gemma** en LM Studio. El Specialist calcula con esto cuánto puede responder. **Si la tenés en 12000, poné `WEBMCP_CONTEXT=12000`** |
| `REVIEWER_MODEL` | `qwen2.5-7b-instruct` | modelo del Completeness Reviewer |
| `REVIEWER_CONTEXT` | `16000` | contexto con el que está cargado ese modelo |
| `SEARXNG_URL` | `http://127.0.0.1:8888` | dónde está SearXNG |

En PowerShell, para la sesión: `$env:WEBMCP_CONTEXT = "12000"`.

### SearXNG, paso a paso (Windows)

SearXNG es un buscador que corre en tu máquina y junta resultados de varios buscadores. El Searcher le va a pedir los resultados en JSON.

1. **Instalá Docker Desktop** ([docker.com](https://www.docker.com/products/docker-desktop/)). Usa WSL 2; si Windows lo pide, aceptá y reiniciá. Abrilo y esperá a que diga *Engine running*.
2. **Creá las carpetas** (fuera del repo, por ejemplo en `E:\Servicios`). En PowerShell:
   ```powershell
   mkdir E:\Servicios\searxng\config, E:\Servicios\searxng\data
   ```
3. **Arrancá el contenedor**, abierto solo para tu máquina (`127.0.0.1`), en el puerto 8888:
   ```powershell
   docker run --name searxng -d --restart unless-stopped `
     -p 127.0.0.1:8888:8080 `
     -v "E:\Servicios\searxng\config:/etc/searxng" `
     -v "E:\Servicios\searxng\data:/var/cache/searxng" `
     docker.io/searxng/searxng:latest
   ```
   La primera vez baja la imagen y crea `E:\Servicios\searxng\config\settings.yml`.
4. **Editá `settings.yml`** (Bloc de notas o VS Code). Empieza con `use_default_settings: true`: SearXNG usa sus valores por defecto y en el archivo va **solo lo que cambiás**. Así tiene que quedar (dejá tu `secret_key` como está):
   ```yaml
   use_default_settings: true

   server:
     secret_key: "<la que generó el contenedor>"
     image_proxy: true
     limiter: false        # el limitador es para instancias públicas; esta es solo tuya

   search:                 # esta sección no viene: se agrega entera
     formats:
       - html
       - json              # sin esto, todo pedido en JSON da 403 Forbidden
   ```
   - `search:` va pegado al margen; las líneas de adentro, con espacios (YAML no acepta tabulaciones).
   - Si `secret_key:` dice `"ultrasecretkey"`, cambiala por cualquier texto largo al azar.
5. **Reiniciá:** `docker restart searxng`.
6. **Probalo:** abrí `http://localhost:8888` en el navegador (tiene que aparecer el buscador) y después corré, en la carpeta de webmcp:
   ```
   npm run searxng
   ```
   Si algo falta, te dice qué (no responde → arrancá el contenedor; 403 → falta `json`; 429 → falta `limiter: false`).

Después de reiniciar la PC, Docker Desktop vuelve a levantar SearXNG solo (por `--restart unless-stopped`). Para frenarlo: `docker stop searxng`.

Fuentes: [instalación con contenedor (docs de SearXNG)](https://docs.searxng.org/admin/installation-docker.html), [SearXNG con JSON (Open WebUI)](https://docs.openwebui.com/features/chat-conversations/web-search/providers/searxng).

## Uso

```bash
node server.mjs                                       # UI en http://localhost:3000
node build/run_build.mjs build/snapshots/auto/<archivo>.json            # construir y validar
node build/run_build.mjs <snapshot> --standard web/app/plantillas      # con otro Standard del mismo tipo
node build/run_build.mjs --validate build/runs/<carpeta>               # solo validar una corrida
node build/validate_external.mjs <carpeta de la app> <snapshot> --planilla <planilla.json>   # app hecha afuera (Gemma sola)
npm test                                              # todos los tests deterministas (sin LM Studio)
npm run searxng                                       # ¿SearXNG está listo?
```

- El snapshot se guarda solo al terminar el Atomic Tree (o al aprobar sin revisión), en `build/snapshots/auto/`.
- Un snapshot de antes del 05/10 no declara tipo: agregale `--profile web/landing`.
- `npm test` incluye `roles/test_roles.mjs`, que necesita LM Studio. El resto corre sin modelos.

## Estructura

| Dónde | Qué |
|---|---|
| raíz | **Core**: `server.mjs` (API), `index.html` + `script.js` (UI y orquestación), `intent_brief.mjs` (Intent Forge), `techleader_prompt.mjs`, `atomic_engine_v5.js`, `plan_stage_check.mjs`, `plan_stack_check.mjs`, `completeness_reviewer3.mjs`, `review_gate.mjs`, `validation_profile_role_dependencies.mjs` |
| `context/` | `ProjectStage.md`: etapas (PROTOTYPE / MVP / FINAL) y el criterio que reciben TechLeader y el reviewer. Es una **entrada de los prompts**: cambiarlo cambia lo que ven los modelos |
| `build/` | **Core del build**: `run_build.mjs` (Specialist → Validation con control → Evidence), `requisitos.mjs`, `snapshot_auto.mjs`, `validate_external.mjs`, réplicas y benchs |
| `harness/` | **Motor general por archivos** (`files_engine.mjs`): corre los pasos que declara un Standard. No nombra ningún dominio |
| `standards/` | **Standards**: `catalog.mjs` (fichas: estado, stack, requisitos) y `registry.mjs`. Hoy: `web/app/estado` (DRAFT), `web/app/plantillas` (DRAFT, Handlebars), `web/game/grilla` (DRAFT) |
| `profiles/` | **Tipos de proyecto** (`web`, `web/landing`, `web/app`, `web/game`): plan, traductor, Validation (flujos y planilla en `profiles/web/validation/`). Ver [`profiles/README.md`](profiles/README.md) |
| `searcher/` | **Searcher** (en construcción). Hoy: `check_searxng.mjs` |
| `roles/` | roles y Skills de `web/game` (los `.md` de `roles/web-game/skills/` son entrada de los prompts) |
| `pilot/`, `experiments/` | piloto del formulario (30/09) y experimentos del reviewer y del traductor |
| `evidence/`, `build/runs/`, `build/snapshots/` | salidas de cada corrida (evidencia) |
| `_archivo/` | versiones anteriores, fuera de git |

## Documentación

- [docs/ARCHIVOS.md](docs/ARCHIVOS.md): qué hace cada archivo, el build, Validation y la API del server.
- [docs/CAMBIOS.md](docs/CAMBIOS.md): historial de cambios, cada uno con su evidencia de origen y cómo se probó.
- [docs/EXPERIMENTOS.md](docs/EXPERIMENTOS.md): experimentos y sus resultados.
- [docs/PENDIENTES.md](docs/PENDIENTES.md): deuda y huecos conocidos.
- [docs/DISENO_pruebas_primero.md](docs/DISENO_pruebas_primero.md): diseño de "pruebas primero" (11/10) y en qué quedó.
- [profiles/README.md](profiles/README.md): contrato de un profile y cómo agregar un tipo.
- El Kanban del equipo: `build/runs/2026-10-03T15-28-39_Kanban_WebApp/Kanban_pendientes_webmcp.html`.
- Las decisiones y la evidencia larga viven en el Project de MicheLab (docs `claude/…`).

`refined_prompt.json` y `answer_key_requirements.json` son salidas de cada corrida y están en `.gitignore`.

**Convención:** el README cuenta qué es y cómo se usa. Cada cambio nuevo se anota en `docs/CAMBIOS.md`, no acá.
