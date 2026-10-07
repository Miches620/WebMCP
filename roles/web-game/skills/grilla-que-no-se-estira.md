---
id: grilla-que-no-se-estira
status: DRAFT
pasos: screen
evidencia: b12 (al ganar, el mensaje largo estiraba el tablero y aparecían franjas; lo vio Miche), b13/b14 (el mismo error, arreglado en el reintento). v2 (07/10): la v1 de esta skill decía solo "width: max-content" y en Boxworld --skills la grilla se encogió a 28 px (celdas sin tamaño): ahora pide primero el tamaño fijo de las celdas
detecta: cambia de tamaño|no se ven
---
Cada celda de la grilla tiene ancho y alto fijos en styles.css (por ejemplo `width: 40px; height: 40px;`). El contenedor de la grilla lleva `width: max-content` para medir lo que miden sus celdas, y los textos que pueden crecer llevan `max-width`, así un mensaje largo no ensancha la pantalla.
