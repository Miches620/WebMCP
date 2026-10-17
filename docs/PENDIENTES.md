# Pendientes conocidos

> Deuda y huecos conocidos. Revisado contra el código el 16/10/2026: lo que ya no era cierto se sacó (abajo, al final, qué y por qué). Volver al [README](../README.md).

## Nuevos (16/10)

- **Contexto de Gemma: el Specialist calcula con 16000 y Gemma está cargada con 12000.** `harness/files_engine.mjs` usa `WEBMCP_CONTEXT` (por defecto 16000) para decidir cuánto puede responder cada paso, y cuánto pedir en un reintento. Con Gemma en 12000, un paso largo puede pedir más de lo que entra. Hasta decidir el valor por defecto: `WEBMCP_CONTEXT=12000`.
- **Qwen ya escribe la planilla (`planilla_writer`), pero falta medirlo** contra la planilla a mano del Kanban (`npm run comparar`). Hasta que no coincida bien, la planilla de Qwen no reemplaza a la vara. Miche la edita y la aprueba (decisión del 16/10).
- **La planilla todavía no llega a la UI ni al Specialist.** `run_build` la usa si viene en `refined_prompt.planilla`, pero Intent Forge todavía no la arma, y el Specialist no la ve como "esto es lo que se va a probar" (paso del librito libre).
- **Searcher v0.1 solo por consola.** Falta llevar sus preguntas a la UI de Intent Forge (Miche acepta o no cada una), medir con y sin Searcher (cuántas preguntas nuevas, cuántas acepta Miche, cuántas terminan PASS) y correrlo de verdad con SearXNG.
- **`flow_delete` busca la confirmación igual que hacía la planilla antes del arreglo** (cualquier botón "Borrar" fuera de la tarjeta marcada). Su veredicto no cambia (mira que el texto desaparezca), pero puede borrar una tarjeta de más.
- **Partes de requisitos que la planilla no prueba:** el "efecto de movimiento durante el drag" (R15) y la forma del handle (R6). Están escritos en la planilla como `parcial`.
- **Temperatura 0 no es determinista en LM Studio** (hallazgo del 12/10): dos corridas iguales pueden diferir. Antes de concluir hay que sumar corridas.
- **La comparación estado contra plantillas no fue controlada:** "PASO n de 7 / 8" cambió el contrato entre las dos. Rehacerla con la planilla, con el mismo número de pasos.
- **El Kanban del equipo vive en `build/runs/2026-10-03T15-28-39_Kanban_WebApp/`**, junto con las corridas.

## Siguen abiertos

- **Persistencia en SQLite desconectada.** La ruta `/api/projects` (con `db.mjs`) existía en una versión anterior de `server.mjs` y se perdió. `persistProject()` sigue en `script.js`, pero nada la llama. `db.mjs` y `test_db.mjs` quedan archivados hasta decidir si vuelve.
- **El build se corre por consola** (`node build/run_build.mjs <snapshot>`). La UI ya guarda el snapshot sola y verifica e instala los requisitos, pero no lanza el build.
- **Los "criterios_holdout" no son holdout en el pipeline:** `buildTechLeaderInput` (`intent_brief.mjs`) se los manda a TechLeader como "Criterios de éxito". El piloto los mantiene fuera del Specialist; falta decidir si TechLeader debe verlos. Con la planilla puede dejar de importar: la planilla es el holdout de verdad.
- **web/landing: `restricciones` y `estilo` no llegan al Specialist** (lee solo `features`). En web/app y web/game sí llegan, como `REGLAS DEL USUARIO` (`rulesBrief`).
- **Cortes por `length` en web/landing** cuando los archivos crecen: se acepta lo que vino completo y se pierde el resto. El motor por archivos (web/app, web/game) reintenta con el doble de espacio.
- **Chequeo de etapa: evidencia parcial** (bench v0.2, 30/09, `evidence/stage_check_2026-09-30T15-31-06.json`). En los 4 casos **con descripción de fase**: 0 falsos OUT sobre 55 juicios IN y 15/15 OUT detectados. Todos los errores (14 falsos OUT, 5 OUT perdidos) caen en fases que **solo tienen nombre** ("Formulario de contacto" como DEFERRED; "Pruebas Funcionales, Optimización y Despliegue" como IN_SCOPE). Las fases con nombre ambiguo ("Configuración del entorno") quedan como `ANY` en la matriz.
- **Gap que el reviewer no ve** (30/09): en Project20, F4.1 pide "nombre, email, mensaje" y no el campo de preferencias de la Feature 2; el reviewer v3 la dio por cubierta. El piloto (C4) lo detectó; el reviewer LLM no discrimina. El reviewer de hoy (v0.8, por tandas) no cambió esa parte.
- `deferredWork` se guarda en el estado del navegador, pero no se muestra en la UI ni se persiste fuera del navegador.
- `runDependencyResolverTests()` (`atomic_engine_v5.js`): **el TEST 7 falla** desde antes del 06/10. El motor sí rechaza la dependencia-objeto, pero el test busca el texto `INVALID_DEPENDENCY` y el mensaje real es otro. Además, los tests usan `console.assert` e imprimen "✓" aunque fallen.
- TechLeader y el Atomic Engine llaman a LM Studio desde el navegador (requiere CORS). Pasarlos por `server.mjs` unificaría logs y errores.

## Sacados en esta revisión (16/10)

- *"Build: un solo proyecto validado (n=1)":* ya se construyeron y validaron landing (café), Project22, Boxworld (web/game) y varias corridas del Kanban (web/app).
- *"restricciones y estilo no llegan al Specialist"* como algo general: era cierto solo para web/landing; quedó escrito así arriba.
- El aviso "⚠️ Revisar (06/10)": esta revisión lo resuelve.
