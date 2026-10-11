# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), sin reparación por función, temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 0/5 | 0/5 | 5/5 | 7.2 | 2.3 |
| Boxworld con:recorre-el-nivel-que-recibe | 3/5 | 3/5 | 1/5 | 2.4 | 2.5 |
| Boxworld con:recorre-el-nivel-que-recibe+nombres-del-contrato | 2/5 | 2/5 | 2/5 | 5.6 | 2.3 |
| Deposito sin | 0/5 | 0/5 | 5/5 | 10.0 | 2.0 |
| Deposito con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 5/5 | 7.8 | 2.1 |
| Deposito con:recorre-el-nivel-que-recibe+nombres-del-contrato | 0/5 | 0/5 | 4/5 | 7.8 | 2.2 |
| Invernadero sin | 0/5 | 0/5 | 5/5 | 11.2 | 2.0 |
| Invernadero con:recorre-el-nivel-que-recibe | 0/5 | 0/5 | 3/5 | 3.6 | 2.2 |
| Invernadero con:recorre-el-nivel-que-recibe+nombres-del-contrato | 0/5 | 0/5 | 4/5 | 5.6 | 2.6 |
| **todos sin** | 0/15 | 0/15 | 15/15 | 9.5 | 2.1 |
| **todos con:recorre-el-nivel-que-recibe** | 3/15 | 3/15 | 9/15 | 4.6 | 2.3 |
| **todos con:recorre-el-nivel-que-recibe+nombres-del-contrato** | 2/15 | 2/15 | 10/15 | 6.3 | 2.3 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 11× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 11× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 11× la pared bloquea: tiró un error: Cannot read properties of undefined (reading '#')
- 11× empujar una caja: tiró un error: Cannot read properties of undefined (reading '#')
- 11× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe, en cuántas muestras):
- 4× la pared bloquea: tiró un error: state is not defined
- 4× crearEstado(["######","#@$ .#","######"]): mapa: cada fila tiene que ser un STRING (como "
- 4× la pared bloquea: tiró un error: Cannot read properties of undefined (reading 'undefined')
- 4× empujar una caja: tiró un error: Cannot read properties of undefined (reading 'undefined')
- 4× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 

Problemas más repetidos al 1er intento (con:recorre-el-nivel-que-recibe+nombres-del-contrato, en cuántas muestras):
- 8× crearEstado(["######","#@$ .#","######"]): mapa: cada fila tiene que ser un STRING (como "
- 8× la pared bloquea: tiró un error: state is not defined
- 8× empujar una caja: tiró un error: state is not defined
- 8× caja en el objetivo = ganado: tiró un error: state is not defined
- 8× mover no modifica el estado que recibe: tiró un error: state is not defined
