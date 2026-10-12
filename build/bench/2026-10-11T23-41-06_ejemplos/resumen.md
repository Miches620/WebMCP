# Ejemplos de Gemma como compuerta (web/game/grilla v0.1.8)

- banco: build\bench\2026-10-11T02-18-05_reglas, build\bench\2026-10-11T06-27-35_reglas, build\bench\2026-10-11T15-53-42_reglas, build\bench\2026-10-11T17-53-04_reglas, build\runs
- casos: build\runs\2026-10-07T15-53-19_Boxworld, build\runs\2026-10-07T14-03-47_Deposito, build\runs\2026-10-10T06-21-54_Invernadero
- k=5, temperature 0

| ejemplos de Gemma | total |
|---|---|
| muestras (sin error) | 14/15 |
| ejemplos propuestos | 104 |
| descartados por forma | 16 |
| flojos (pasan sobre el esqueleto) | 0 |
| válidos | 88 |
| **con la expectativa equivocada** (fallan en la referencia) | 13 de 88 |
| muestras con TODOS los ejemplos correctos | 6/14 |

| como compuerta (149 versiones; muestras con al menos un ejemplo: 13 y 13) | todos los válidos | solo los correctos |
|---|---|---|
| rota y la atrapa | 1215 | 1147 |
| **rota y se le escapa** | 46 | 114 |
| **buena y la rechaza** (falsa alarma) | 450 | 108 |
| buena y la deja pasar | 226 | 568 |

Expectativas equivocadas más repetidas:
- 1× con ["####","#  #","#@$#","# ##","####"] y flechas [abajo] esperaba jugador {fil
- 1× con ["#####","#   #","#   #","# $ #","#@  #","#  .#","#####"] y flechas [abajo] 
- 1× con ["##########","#       ##","#       $#","#@      ##","##########"] y flechas
- 1× con ["####","#  #","#  #","#  #","# $#","#@ #","# $#","####"] y flechas [abajo] 
- 1× con ["#####","#   #","# @ #","#  $#","#####"] y flechas [abajo] esperaba jugador
- 1× con ["#######","#    .#","#  #  #","#  @  #","#  #  #","#######"] y flechas [arr

1 muestra(s) con ERROR: Expected double-quoted property name in JSON at position 253 (line 7 column 1)
