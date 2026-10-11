# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), sin reparación por función, temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 0/5 | 0/5 | 5/5 | 9.0 | 2.8 |
| Boxworld con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 3/5 | 9.0 | 2.8 |
| Deposito sin | 0/5 | 0/5 | 4/5 | 9.0 | 2.7 |
| Deposito con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 0/5 | 1.0 | 2.7 |
| Invernadero sin | 0/5 | 0/5 | 4/5 | 9.2 | 2.7 |
| Invernadero con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 4/5 | 5.8 | 2.5 |
| **todos sin** | 0/15 | 0/15 | 13/15 | 9.1 | 2.7 |
| **todos con:recorre-el-nivel-que-recibe** | 0/15 | 0/15 | 7/15 | 5.3 | 2.7 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 9× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 9× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 9× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 9× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined
- 9× caja contra pared no se mueve: tiró un error: Cannot read properties of undefined (reading

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe, en cuántas muestras):
- 15× crearEstado(["######","#+$ *#","######"]): jugador: tendría que ser {fila:#,col:#} ('+' = 
- 6× caja en el objetivo = ganado: tiró un error: state is not defined
- 5× la pared bloquea: tiró un error: state is not defined
- 5× caja contra pared no se mueve: tiró un error: state is not defined
- 5× caja contra caja no se mueve: tiró un error: state is not defined
