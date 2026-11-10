# Puestos de los LLMs

Qué modelo ocupa cada puesto de webmcp. El código no nombra modelos: le pregunta a esta tabla
(`modelos.mjs`, `modeloDe("specialist")`). Si un LLM reemplaza a otro en un puesto (por ejemplo,
cuando lo decida el Benchmark), se cambia el nombre acá y el sistema sigue igual: solo cambia a quién llama.

- **modelo**: el nombre EXACTO con que lo conoce LM Studio (`curl http://127.0.0.1:1234/v1/models`, campo `id`).
- Para probar otro modelo una sola vez, sin tocar la tabla: `set MODELO_SPECIALIST=otro-modelo` (MODELO_ + el puesto en mayúsculas).

| puesto | modelo | role que asume | qué hace |
|---|---|---|---|
| specialist | gemma-4-e4b-it | FrontEnd Senior (roles/web-app) | escribe y arregla el código de la app |
| techleader | gemma-4-e4b-it | — | arma las fases del plan y las tareas atómicas |
| intent | qwen2.5-7b-instruct | — | Intent Forge: entrevista al usuario y arma el brief |
| revisor | qwen2.5-7b-instruct | — | revisa el plan: completitud (Completeness Reviewer) y etapa (stage check) |
| planilla | qwen2.5-7b-instruct | — | escribe la planilla de pruebas |
| buscador | qwen2.5-7b-instruct | — | busca en internet para informarse del dominio |
