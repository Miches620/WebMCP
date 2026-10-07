---
id: grilla-que-no-se-estira
status: DRAFT
pasos: screen
evidencia: b12 (al ganar, el mensaje largo estiraba el tablero y aparecían franjas; lo vio Miche), b13/b14 (el mismo error, arreglado en el reintento)
detecta: cambia de tamaño
---
La grilla mide lo que miden sus celdas: en styles.css poné `width: max-content` en el contenedor de la grilla (o columnas del mismo ancho fijo que las celdas), y `max-width` en los textos que pueden crecer, para que un mensaje largo no ensanche la pantalla.
