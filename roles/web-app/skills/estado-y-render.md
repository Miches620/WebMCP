---
id: estado-y-render
status: DRAFT
pasos: borrador, arreglo
evidencia: Kanban p26 y hoja de cálculo: la app guardaba en un lado y dibujaba desde otro (getCellElement que no encontraba nada, updateCellUI sin efecto)
---
Los datos viven en un objeto de JavaScript (la única fuente de verdad). Una función `render()` dibuja la pantalla entera desde ese objeto. Cada acción del usuario cambia el objeto, lo guarda en localStorage y llama a `render()`. Al arrancar: se carga de localStorage y se llama a `render()`.
