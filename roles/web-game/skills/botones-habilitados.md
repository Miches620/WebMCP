---
id: botones-habilitados
status: DRAFT
pasos: screen
evidencia: b3, b11, b12 y b13/b14 (#btn-reiniciar nació con `disabled` en el HTML y nadie lo habilitaba)
detecta: atributo disabled
medicion: 08/10, con y sin: Boxworld 1→0, Depósito 0→0. A favor (débil: una sola aparición).
---
Los botones del HTML nacen habilitados: nunca escribas `disabled` en el HTML. Si alguna vez hay que deshabilitar uno, lo hace el código en el momento.
