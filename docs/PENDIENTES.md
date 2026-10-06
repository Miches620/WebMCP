# Pendientes conocidos

> Deuda y huecos conocidos. Movido desde el README el 06/10/2026, sin cambios de contenido. Volver al [README](../README.md).

> ⚠️ Revisar (06/10): algunos pueden haber quedado viejos con los cambios del 05–06/10 — "un solo proyecto validado (n=1)" (ya hubo landing de café, Project22 y Boxworld) y "restricciones y estilo no llegan al Specialist" (web/app y web/game las mandan como `REGLAS DEL USUARIO`; landing no). Se conservan hasta confirmarlo.

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
