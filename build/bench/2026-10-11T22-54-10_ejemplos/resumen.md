# Ejemplos de Gemma como compuerta (web/game/grilla v0.1.7)

- banco: build\bench\2026-10-11T02-18-05_reglas, build\bench\2026-10-11T06-27-35_reglas, build\bench\2026-10-11T15-53-42_reglas, build\bench\2026-10-11T17-53-04_reglas, build\runs
- casos: build\runs\2026-10-07T15-53-19_Boxworld, build\runs\2026-10-07T14-03-47_Deposito, build\runs\2026-10-10T06-21-54_Invernadero
- k=5, temperature 0

| ejemplos de Gemma | total |
|---|---|
| muestras (sin error) | 14/15 |
| ejemplos propuestos | 100 |
| descartados por forma | 82 |
| flojos (pasan sobre el esqueleto) | 0 |
| válidos | 18 |
| **con la expectativa equivocada** (fallan en la referencia) | 5 de 18 |
| muestras con TODOS los ejemplos correctos | 10/14 |

| como compuerta (149 versiones; muestras con al menos un ejemplo: 11 y 10) | todos los válidos | solo los correctos |
|---|---|---|
| rota y la atrapa | 1027 | 860 |
| **rota y se le escapa** | 139 | 200 |
| **buena y la rechaza** (falsa alarma) | 177 | 5 |
| buena y la deja pasar | 296 | 425 |

Expectativas equivocadas más repetidas:
- 1× con ["#####","#   #","#@$ #","#  .#","#####"] y flechas [derecha] esperaba jugad
- 1× con ["#######","#@ $. #","#  $. #","#     #","#######"] y flechas [derecha, abaj
- 1× con ["######","#@$. #","# $. #","######"] y flechas [derecha] esperaba cajas [{f
- 1× con ["#####","#@$.#","#####"] y flechas [derecha, derecha] esperaba jugador {fil
- 1× con ["#######","#@    #","#     #","# $ . #","#######"] y flechas [abajo, derech

1 muestra(s) con ERROR: Expected double-quoted property name in JSON at position 279 (line 7 column 1)
