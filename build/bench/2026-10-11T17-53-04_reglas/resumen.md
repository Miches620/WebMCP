# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), con reparación por función, temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 0/5 | 4/5 | 5/5 | 7.2 | 6.0 |
| Boxworld con:recorre-el-nivel-que-recibe | 1/5 | 5/5 | 2/5 | 5.0 | 4.4 |
| Deposito sin | 0/5 | 3/5 | 5/5 | 11.6 | 9.2 |
| Deposito con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 4/5 | 7.0 | 6.2 |
| Invernadero sin | 0/5 | 3/5 | 5/5 | 11.0 | 7.9 |
| Invernadero con:recorre-el-nivel-que-recibe | 2/5 | 2/5 | 3/5 | 7.0 | 5.6 |
| **todos sin** | 0/15 | 10/15 | 15/15 | 9.9 | 7.7 |
| **todos con:recorre-el-nivel-que-recibe** | 3/15 | 7/15 | 9/15 | 6.3 | 5.4 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 12× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 12× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 12× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 12× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined
- 12× caja contra pared no se mueve: tiró un error: Cannot read properties of undefined (reading

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe, en cuántas muestras):
- 7× caja en el objetivo = ganado: tiró un error: state is not defined
- 6× la pared bloquea: tiró un error: state is not defined
- 6× empujar una caja: tiró un error: state is not defined
- 6× mover no modifica el estado que recibe: tiró un error: state is not defined
- 6× de a un casillero: tiró un error: state is not defined
