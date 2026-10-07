---
id: piezas-aparte-del-mapa
status: DRAFT
pasos: logic
evidencia: b9 (mover buscaba las cajas en el mapa y el jugador quedaba encima de una caja, 2 reintentos completos y 6 reparaciones fallidas)
detecta: ENCIMA de una caja
---
En un juego de grilla, lo fijo (paredes, piso, objetivos) va en el mapa y lo que se mueve (jugador, cajas) va en listas aparte. Para saber si hay una caja en un casillero, buscala en la lista de cajas, no en el mapa.
