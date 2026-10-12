# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), con reparación por función, temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 2/5 | 5/5 | 3/5 | 4.8 | 5.3 |
| Boxworld con:recorre-el-nivel-que-recibe | 4/5 | 5/5 | 0/5 | 0.4 | 3.9 |
| Deposito sin | 0/5 | 2/5 | 5/5 | 10.0 | 11.4 |
| Deposito con:recorre-el-nivel-que-recibe | 3/5 | 3/5 | 1/5 | 3.2 | 5.4 |
| Invernadero sin | 0/5 | 2/5 | 5/5 | 10.6 | 9.0 |
| Invernadero con:recorre-el-nivel-que-recibe | 1/5 | 2/5 | 2/5 | 4.8 | 7.0 |
| **todos sin** | 2/15 | 9/15 | 13/15 | 8.5 | 8.5 |
| **todos con:recorre-el-nivel-que-recibe** | 8/15 | 10/15 | 3/15 | 2.8 | 5.4 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 11× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 11× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 11× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 11× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined
- 11× caja contra pared no se mueve: tiró un error: Cannot read properties of undefined (reading

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe, en cuántas muestras):
- 5× con ["#####","#@$.#","#####"], mover(estado, "derecha") empuja la caja: jugador {fila:#,co
- 5× con ["####","#@$#","####"], la caja tiene una pared detrás: "derecha" no mueve nada (jugad
- 4× con ["######","#@$$.#","######"], la caja tiene otra caja detrás: "derecha" no mueve nada 
- 3× crearEstado(["#####","#@$.#","#####"]) tendría que dar jugador {fila:#,col:#}, cajas [{fil
- 3× con ["#####","#@$.#","#####"], mover(estado, "izquierda") choca con la pared: el jugador s
