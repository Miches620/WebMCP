# Piloto y experimentos

> Experimentos y sus resultados, el más nuevo primero. Lo del 30/09 (piloto y Completeness Reviewer) se movió desde el README el 06/10/2026, sin cambios. La evidencia completa de cada uno está en el Project de MicheLab (docs `claude/evidencia_…`). Volver al [README](../README.md).

## Del 10 al 16/10 (resumen)

| Fecha | Experimento | Resultado | Doc del Project |
|---|---|---|---|
| 16/10 | **Planilla de comportamientos** a mano (22 filas del Kanban) contra 4 apps | Por requisito: Gemma sola rota 2 · **Gemma sola arreglada 10** · pipeline estado 5 · pipeline plantillas 6 (de 16 con filas). La arreglada falla justo en lo que no hizo (prioridad, padding, tamaño de tarjeta) | `evidencia_planilla_2026-10-16.md` |
| 16/10 | **Validation de flujo** (crear / editar / borrar / mover / guardar como una persona) | Antes, la app de Gemma sola rota y la arreglada daban igual (6 y 6 PASS). Con flujos: 2 y 7 | `evidencia_gemma_sola_2026-10-16.md` |
| 16/10 | **Gemma 4 E4B sola**, sin webmcp, en LM Studio (6618 tokens) | Kanban con drag & drop y localStorage andando; crear roto por una línea, XSS, sin prioridad. Es la **línea base** de todo experimento | `evidencia_gemma_sola_2026-10-16.md` |
| 16/10 | Standard **estado contra plantillas** (Handlebars), mismo snapshot | Plantillas 6 PASS contra 3, con la mitad del dibujo (~255 s contra ~540 s). **No controlada**: cambió el número de pasos del contrato. La 1ª corrida no valió (bug de `--standard`) | `evidencia_comparacion_estado_plantillas_2026-10-16.md` |
| 15/10 | **Réplicas** a temperatura 0.7 (3 seeds) del Kanban | A temperatura 0 repetir daba lo mismo byte a byte: "n=2" era una sola muestra. Con seeds: 3 / 8 / 2 PASS, y destaparon dos agujeros de la compuerta. Desde ahí, "anda" se informa como k/n | `evidencia_replicas_2026-10-15.md` |
| 12/10 | **Pruebas primero:** ejemplos de Gemma como compuerta (grilla) | v0.3: 88/104 válidos y 75 correctos (85%). Un solo ejemplo malo rechaza todas las versiones buenas. Sigue como experimento. **Temperatura 0 no es determinista en LM Studio** | `evidencia_pruebas_primero_2026-10-12.md` |
| 10/10 | **Skills con placebo** (6 fichas neutras del mismo largo) | Un texto neutro cambió Boxworld de 7/0 a 3/4: el ruido de cualquier cambio en el pedido es tan grande como el efecto. Las Skills no ayudan en un juego nuevo. Siguen DRAFT | `evidencia_control_skills_2026-10-10.md` |

**Lo que dejaron como forma de trabajar:**
- un control (placebo o línea base) en cada comparación;
- k/n réplicas, nunca una sola corrida;
- lo esperado de un test se saca probando la app a mano, no del juez.

## Piloto Specialist → Artifact → Validation (`pilot/`)

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

## Experimentos sobre el Completeness Reviewer (`experiments/`)

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
