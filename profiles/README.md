# profiles/ — Validation Profiles + Standards por tipo de artefacto

Refactor del 05/10 (decisión de Miche): el harness (core) no sabe de landings,
apps ni firmware. Lo que es propio de un tipo de artefacto vive acá, como DRAFT,
y el core le pide a cada llamada solo la parte que le toca.

```
profiles/
  registry.mjs          qué profiles existen y cómo se combinan (navegador + Node)
  web/                  PLATAFORMA web
    profile.mjs         roles, reglas por rol del Atomizer, reglas de role_dependencies
    validation/         catálogo de chequeos (Chromium), traductor (reglas comunes), fixtures
    specialist/         encapsulado de componentes (CSS/HTML/JS), window.api, html_dom
  web/landing/          TIPO landing (página de secciones)
    profile.mjs         datos del tipo
    build.mjs           contrato con build/run_build.mjs (Node)
    page_plan.mjs       header / secciones / footer
    specialist_components.mjs, components.mjs   Specialist v0.7 por componentes
    specialist_spa.mjs, file_diet.mjs           Specialist v0.6.1 (--legacy)
    translator_rules.mjs, check_postprocess.mjs reglas 5-6 del traductor, anclaje de sección
  web/app/              TIPO app de UNA pantalla (base de web/game)
    profile.mjs         datos del tipo (borrowed: motor del Specialist por componentes de landing)
    build.mjs           contrato + makeScreenBuild(cfg) que reusa web/game
    page_plan.mjs       plan determinista: un componente principal, sin header/footer; estilo → transversal
    translator_rules.mjs  regla 5: lo que el usuario puede HACER (key_changes, click_changes, counter_on_action)
    specialist_rules.mjs  A1–A4 (estado + dibujar(), un componente) y rulesBrief (restricciones → brief)
    test_app.mjs
  web/game/             TIPO juego — extends web/app (cadena web → web/app → web/game)
    profile.mjs, build.mjs  reglas G1–G6 del Specialist y chequeo de base not_won_immediately
    translator_rules.mjs    regla 6: not_won_immediately, reset_restores, "próximo" sin "nivel"
```

Un tipo puede extender otro tipo: `web/game` extiende `web/app`, que extiende `web`.
Roles y reglas se suman por toda la cadena; el build es el de la hoja.

## Quién elige el profile

Miche, en la UI (selector "Tipo de proyecto", antes de mandar la plantilla), igual
que la etapa. Queda en `refined_prompt.profiles`. Ningún modelo lo decide y no hay
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
