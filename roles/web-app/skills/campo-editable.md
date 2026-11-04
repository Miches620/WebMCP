---
id: campo-editable
status: DRAFT
pasos: borrador, arreglo
evidencia: hoja de cálculo 01/11–03/11: celdas <div tabindex> sin contenteditable (no se podía escribir) y un handler que leía event.target.value de un div
---
Todo lugar donde el usuario escribe es un `<input>` / `<textarea>`, o tiene `contenteditable="true"`. El valor se lee de `.value` en un input y de `.textContent` en un contenteditable. Lo escrito se confirma con Enter o al salir (blur), y recién ahí se calcula y se guarda.
