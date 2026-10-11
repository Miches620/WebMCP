# Banco por paso: reglas

- Boxworld: build\runs\2026-10-07T15-53-19_Boxworld
- Deposito: build\runs\2026-10-07T14-03-47_Deposito
- Invernadero: build\runs\2026-10-10T06-21-54_Invernadero
- k=5, 1 intento(s), temperature 0

| reglas | bien al 1er intento | bien tras reparar | roto (no carga / tira error) | problemas (promedio) | min por muestra |
|---|---|---|---|---|---|
| Boxworld sin | 0/5 | 1/5 | 4/5 | 11.4 | 10.5 |
| Boxworld con | 0/5 | 1/5 | 4/5 | 9.6 | 9.1 |
| Deposito sin | 0/5 | 1/5 | 3/5 | 4.4 | 6.4 |
| Deposito con | 0/5 | 0/5 | 4/5 | 9.8 | 9.3 |
| Invernadero sin | 0/5 | 0/5 | 0/5 | 1.0 | 1.1 |
| Invernadero con | 0/5 | 0/5 | 5/5 | 10.6 | 9.6 |
| **todos sin** | 0/15 | 2/15 | 7/15 | 5.6 | 6.0 |
| **todos con** | 0/15 | 1/15 | 13/15 | 10.0 | 9.3 |

Problemas más repetidos al 1er intento (sin, en cuántas muestras):
- 5× js/reglas.js no puede usar document ni window (es lógica pura).
- 4× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 4× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 4× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 4× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined

Problemas más repetidos al 1er intento (con, en cuántas muestras):
- 10× crearEstado lee jugador, cajas y objetivos: tiró un error: Cannot read properties of undef
- 10× recién creado no está ganado: tiró un error: Cannot read properties of undefined (reading 
- 10× caja en el objetivo = ganado: tiró un error: Cannot read properties of undefined (reading 
- 10× mover no modifica el estado que recibe: tiró un error: Cannot read properties of undefined
- 10× caja contra pared no se mueve: tiró un error: Cannot read properties of undefined (reading
