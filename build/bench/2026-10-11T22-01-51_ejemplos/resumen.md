# Ejemplos de Gemma como compuerta (web/game/grilla v0.1.7)

- banco: build\bench\2026-10-11T02-18-05_reglas, build\bench\2026-10-11T06-27-35_reglas, build\bench\2026-10-11T15-53-42_reglas, build\bench\2026-10-11T17-53-04_reglas, build\runs
- casos: build\runs\2026-10-07T15-53-19_Boxworld, build\runs\2026-10-07T14-03-47_Deposito, build\runs\2026-10-10T06-21-54_Invernadero
- k=5, temperature 0

| ejemplos de Gemma | total |
|---|---|
| muestras (sin error) | 15/15 |
| ejemplos propuestos | 115 |
| descartados por forma | 103 |
| flojos (pasan sobre el esqueleto) | 0 |
| válidos | 12 |
| **con la expectativa equivocada** (fallan en la referencia) | 6 de 12 |
| muestras con TODOS los ejemplos correctos | 10/15 |

| como compuerta (149 versiones × 15 muestras) | todos los válidos | solo los correctos |
|---|---|---|
| rota y la atrapa | 1490 | 1438 |
| **rota y se le escapa** | 100 | 152 |
| **buena y la rechaza** (falsa alarma) | 473 | 387 |
| buena y la deja pasar | 172 | 258 |

Expectativas equivocadas más repetidas:
- 1× con ["#####","#@ $.","#   #"] y flechas [] esperaba jugador {fila:#,col:#} y dio
- 1× con ["#####","#@$.#","#####"] y flechas [derecha] esperaba ganado false y dio tr
- 1× con ["#####","#@$.#","#####"] y flechas [] esperaba jugador {fila:#,col:#} y dio
- 1× con ["#####","#@$$.","#.###","#####"] y flechas [derecha] esperaba cajas [{fila:
- 1× con ["#####","@$ .#","#####"] y flechas [derecha] esperaba jugador {fila:#,col:#
- 1× con ["#####","#@$#.","# ###"] y flechas [derecha] esperaba jugador {fila:#,col:#
