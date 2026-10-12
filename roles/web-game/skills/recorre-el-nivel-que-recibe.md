---
id: recorre-el-nivel-que-recibe
status: DRAFT
pasos: logic
evidencia: banco 11/10 (reglas, 30 muestras): en 20 la función que arma el estado recorría 9 o 10 filas fijas (el tamaño del brief) y se rompía con los niveles chicos de las pruebas del harness. También en builds reales (reparaciones de crearEstado en Invernadero y Boxworld).
detecta: Cannot read properties of undefined \(reading '(0|split|length)'\)
medicion: banco 11/10 (reglas, 3 juegos, k=5, 1ª respuesta): error de tamaño fijo 9/15 sin → 0/15 con; muestras rotas 13/15 → 7/15. A favor. Quedan '+'/'*' (15/15) y variable sin declarar (7/15). · 2ª medición (11/10, grilla v0.1.7): tamaño fijo 11/15 → 0/15; bien al 1er intento 0/15 → 3/15 (las primeras del banco); rotas 15/15 → 9/15. · Total 12/10 (30 muestras por condición): bien al 1er intento 4/30 → 11/30; bien al final con reparación 19/30 → 17/30 (sin diferencia); 36 % menos de tiempo. Sirve para primer intento y tiempo, no para el resultado final.
---
La función que arma el estado no sabe de antemano el tamaño del nivel: recorré el nivel que recibe (filas = su largo, columnas = el largo de cada fila). Nunca pongas en un for el tamaño del mapa del brief: el harness también prueba con niveles más chicos.
