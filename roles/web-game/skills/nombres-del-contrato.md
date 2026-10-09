---
id: nombres-del-contrato
status: DRAFT
pasos: logic
evidencia: b8 (ganado() usaba `state` en vez de `estado`, 3 reintentos), b13/b14 (el mismo error, arreglado por función)
detecta: state is not defined
medicion: 08/10 (v1), con y sin: Boxworld 7→7, Depósito 0→0. SIN EFECTO. v2 (08/10): la v1 nombraba la palabra prohibida (`state`); hipótesis: nombrarla la sugiere. La v2 no la nombra. Si la v2 tampoco baja el error, se descarta.
---
Adentro de cada función usá el nombre del parámetro tal cual lo recibe la función (si el parámetro se llama `estado`, todo el cuerpo dice `estado`). Antes de devolver la función, revisá que cada variable que usás esté declarada o sea un parámetro.
