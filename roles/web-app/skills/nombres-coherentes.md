---
id: nombres-coherentes
status: DRAFT
pasos: borrador, arreglo
evidencia: hoja de cálculo 02/11–03/11: script.js buscaba .spreadsheet-cell y .row-number, pero creaba .cell y .row-label; styles.css estilaba .cell-grid, que no existía
---
Las clases, ids y atributos `data-` que usa script.js son exactamente los de index.html y styles.css, con la misma ortografía. Lo que se crea desde JavaScript lleva las mismas clases que espera el CSS. Antes de terminar, se revisa que cada selector de script.js exista.
