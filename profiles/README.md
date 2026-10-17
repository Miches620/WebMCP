# profiles/ — Validation Profiles + Standards por tipo de artefacto

Refactor del 05/10 (decisión de Miche): el harness (core) no sabe de landings,
apps ni firmware. Lo que es propio de un tipo de artefacto vive acá, como DRAFT,
y el core le pide a cada llamada solo la parte que le toca.

```
profiles/
  registry.mjs          qué profiles existen y cómo se combinan (navegador + Node)
  web/                  PLATAFORMA web
    profile.mjs         roles, reglas por rol del Atomizer, reglas de role_dependencies
    validation/         Validation FRAMEWORK (framework.mjs: cómo se valida), profile "web" (validation_web.mjs),
                        lib.mjs, page_tools.mjs (también lo usa el harness), traductor, fixtures;
                        check_catalog.mjs junta todos (compatibilidad);
                        flows.mjs (16/10): FLUJOS como una persona (crear / editar / borrar / mover / guardar);
                        planilla.mjs (16/10): PLANILLA de comportamientos (dado / hago / veo), chequeo planilla_fila
    specialist/         encapsulado de componentes (CSS/HTML/JS), window.api, html_dom
  web/landing/          TIPO landing (página de secciones)
    profile.mjs         datos del tipo
    build.mjs           contrato con build/run_build.mjs (Node)
    page_plan.mjs       header / secciones / footer
    specialist_components.mjs, components.mjs   Specialist v0.7 por componentes
    specialist_spa.mjs, file_diet.mjs           Specialist v0.6.1 (--legacy)
    translator_rules.mjs, check_postprocess.mjs reglas 5-6 del traductor, anclaje de sección
    validation.mjs      Validation profile web/landing: secciones, carrusel, scroll, animaciones
  web/app/              TIPO app de UNA pantalla (base de web/game)
    profile.mjs         datos del tipo; Standard por defecto web/app/estado (se puede elegir web/app/plantillas)
    build.mjs           build por ARCHIVOS (harness/files_engine.mjs) con el Standard elegido (standardId + receta los
                        pasa run_build); makeScreenBuild(cfg) lo reusa web/game;
                        postprocessChecks: según el verbo del requisito, cambia action_changes por los FLUJOS
    page_plan.mjs       plan determinista: un componente principal, sin header/footer; estilo → transversal
    translator_rules.mjs  regla 5: lo que el usuario puede HACER (key_changes, click_changes, counter_on_action);
                          APP_FILES_ADDED: chequeos que NO elige el traductor (flow_*, planilla_fila)
    specialist_rules.mjs  A1–A4 (estado + dibujar(), un componente) y rulesBrief (restricciones → brief)
    validation.mjs        Validation profile web/app: teclas, clics, contadores, flujos y filas de la planilla
    task_verdict.mjs      veredicto por Atomic Task
    calls_gate.mjs        compuerta de acciones (¿cada botón llama a su acción y cambia el estado?)
    test_app.mjs
  web/game/             TIPO juego — extends web/app (cadena web → web/app → web/game)
    profile.mjs, build.mjs  build por ARCHIVOS con el motor general (harness/files_engine.mjs) y el
                            Standard que declara el profile (standard: "web/game/grilla", DRAFT);
                            --legacy-components = componente único (v0.7.6)
    translator_rules.mjs    regla 6: board_changes, not_won_immediately, reset_restores, game_levels,
                            moves_one_cell, fixed_map_size, game_scenario
    validation.mjs          Validation profile web/game: LEE el Standard (env.standard.validation);
                            game_scenario, looks_distinct y layout_stable (estos dos, siempre)
```

Fuera de profiles/ (06/10, esquema de Miche: Harness → Standard → Validation profile):

```
harness/files_engine.mjs     motor GENERAL por archivos (pasos data/logic/screen/render/wiring,
                             reintentos, reparaciones, elegir intento, no culpar pasos de abajo).
                             No nombra ningún dominio: lo vigila harness/test_files_engine.mjs
standards/catalog.mjs        FICHAS de los Standards (16/10): estado (DRAFT/OFICIAL/SUPERSEDED), stack (usa / no_usa),
                             requisitos (cómo verificarlos e instalarlos). La lee también el navegador
standards/registry.mjs       Standards por id
standards/web/app/estado/    Standard DRAFT "app de una pantalla con estado": contrato → lógica → acciones →
                             pantalla → dibujo (document.createElement) → controles; compuerta de acciones
standards/web/app/plantillas/  Standard DRAFT: igual que estado, pero el dibujo es una plantilla Handlebars
standards/web/game/grilla/   Standard DRAFT "juego de grilla": contrato, pasos con su pedido,
                             pruebas de aceptación (acceptance.mjs), solver (levels.mjs), sonda
                             del dibujo, chequeos de juego; test_grilla.mjs
```

Un tipo puede extender otro tipo: `web/game` extiende `web/app`, que extiende `web`.
Roles y reglas se suman por toda la cadena; el build es el de la hoja.

## Quién elige el profile (y el Standard)

Miche, en la UI (selector "Tipo de proyecto", antes de mandar la plantilla), igual
que la etapa. El Standard del tipo también lo elige Miche (selector "Standard", queda en
`refined_prompt.standard`); sin elegir, el del tipo. El stack lo fija el Standard: TechLeader
y el Atomizer lo reciben como dato y ningún modelo lo sugiere. Queda en `refined_prompt.profiles`. Ningún modelo lo decide y no hay
tipo por defecto: sin tipo, el pipeline falla (`PROFILE_REQUIRED`).
Para snapshots viejos: `node build/run_build.mjs snapshot.json --profile web/landing`.

## Contrato de un profile

**`profile.mjs`** (solo datos; lo carga el navegador):

| Campo | Para qué |
|---|---|
| `id`, `extends`, `label`, `describe` | identidad; `extends` apunta a la plataforma o a otro tipo |
| `selectable` | `true` en tipos (se eligen), `false` en plataformas |
| `status`, `version` | todo nace `DRAFT`; pasar a Standard lo decide Governance con evidencia |
| `roles`, `defaultRole`, `exampleRole` | roles de TechLeader / Atomizer (plataforma) |
| `atomizerRoleRules` | "REGLAS ESPECÍFICAS POR ROL" del Atomizer |
| `roleDependencyRules` | reglas de `validation_profile_role_dependencies.mjs` (`requires_upstream`, `root_without`) |
| `build` | qué `profiles/<build>/build.mjs` usa el build |
| `borrowed` | lo que un DRAFT usa prestado de otro tipo (deuda a la vista) |
| `pending`, `evidence` | qué falta y qué corridas respaldan lo que hay |

**`build.mjs`** (Node): `planPage`, `planText`, `PAGE_PLAN_VERSION`, `build`,
`writeBaseline`, `translateRequirement`, `postprocessChecks`, `runChecks`,
`normalizeCheck`, `CATALOG_VERSION`. Opcional: `specialistSees(refined)` — texto del
usuario que el Specialist ve además de objetivo + features (la guardia de holdout del core
no lo cuenta como filtración). `planPage(features, { refined })`.

## Cómo se combinan

`resolveProfiles(["web/landing"])` → cadena `web → web/landing`. Los roles y las
reglas se suman; los valores únicos (`defaultRole`, `exampleRole`) no pueden
contradecirse; dos tipos con builds distintos (ej. NodeMCU = firmware + web/app)
fallan con `PROFILE_MULTI_BUILD` hasta que exista el build multi-artefacto.

## Agregar un tipo

1. `profiles/<plataforma>/<tipo>/profile.mjs` con `status: "DRAFT"`.
2. Importarlo en `registry.mjs`.
3. Si no tiene build propio, `build` + `borrowed` apuntando al que usa.
4. Tests en `test_profiles.mjs`.
