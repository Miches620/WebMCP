---
id: nombres-del-contrato
status: DRAFT
pasos: logic
evidencia: b8 (ganado() usaba `state` en vez de `estado`, 3 reintentos), b13/b14 (el mismo error, arreglado por función)
detecta: state is not defined
---
Usá exactamente los nombres que trae la función: si recibe `estado`, adentro es `estado` (nunca `state`, `s` ni otro). No inventes variables que nadie declaró.
