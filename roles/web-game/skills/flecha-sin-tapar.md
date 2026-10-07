---
id: flecha-sin-tapar
status: DRAFT
pasos: logic, render
evidencia: b9 (dibujo: `c => c.fila === r && c.col === c` nunca dibujaba cajas), b13/b14 (el mismo error en dibujo.js)
detecta: tapa a la variable
---
Dentro de un `for (let r …)` / `for (let c …)`, el parámetro de una flecha no puede llamarse igual que la variable del for: escribí `p => p.fila === r && p.col === c`, nunca `c => c.fila === r && c.col === c`.
