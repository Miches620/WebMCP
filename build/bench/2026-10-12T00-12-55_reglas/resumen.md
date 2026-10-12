# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), sin reparación por función, temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 1/5 | 1/5 | 4/5 | 8.0 | 2.8 |
| Boxworld con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 1/5 | 4.4 | 2.8 |
| Deposito sin | 0/5 | 0/5 | 5/5 | 10.0 | 2.6 |
| Deposito con:recorre-el-nivel-que-recibe | 2/5 | 2/5 | 2/5 | 3.0 | 2.6 |
| Invernadero sin | 1/5 | 1/5 | 4/5 | 7.0 | 2.5 |
| Invernadero con:recorre-el-nivel-que-recibe | 1/5 | 1/5 | 2/5 | 5.6 | 2.6 |
| **todos sin** | 2/15 | 2/15 | 13/15 | 8.3 | 2.7 |
| **todos con:recorre-el-nivel-que-recibe** | 3/15 | 3/15 | 5/15 | 4.3 | 2.7 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 12× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 12× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 12× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 12× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined
- 12× caja contra pared no se mueve: tiró un error: Cannot read properties of undefined (reading

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe, en cuántas muestras):
- 6× con ["#####","#@$.#","#####"], mover(estado, "derecha") empuja la caja: jugador {fila:#,co
- 5× con ["####","#@$#","####"], la caja tiene una pared detrás: "derecha" no mueve nada (jugad
- 5× crearEstado(["######","#@$ .#","######"]): mapa fila # tendría que ser "#   .#" (en el map
- 3× con ["#####","#@$.#","#####"], después de mover "derecha" la única caja está en el único o
- 2× crearEstado(["#####","#@$.#","#####"]) tendría que dar jugador {fila:#,col:#}, cajas [{fil
