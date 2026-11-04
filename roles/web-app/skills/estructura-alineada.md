---
id: estructura-alineada
status: DRAFT
pasos: borrador, arreglo
evidencia: hoja de cálculo 30/10–03/11: 5 borradores armaron letras y celdas en contenedores separados y 160 vueltas se fueron en alinearlos (apiladas, al costado, 11 cosas en 10 columnas, celdas de 18px bajo letras de 115px)
---
Lo que se ve en filas y columnas alineadas (encabezados arriba y a la izquierda, datos en el medio) se arma con una `<table>` (encabezados de arriba en `<thead>`, el de cada fila como primer `<th>` de su `<tr>`) o con UNA sola CSS grid que contiene encabezados y datos. Nunca con dos contenedores separados que se intentan alinear a mano.
