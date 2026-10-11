---
id: nombres-del-contrato
status: DESCARTADA
pasos: logic
evidencia: b8 (ganado() usaba `state` en vez de `estado`, 3 reintentos), b13/b14 (el mismo error, arreglado por función)
detecta: state is not defined
medicion: 08/10 (v1), con y sin: Boxworld 7→7, Depósito 0→0. SIN EFECTO. v2 (08/10): la v1 nombraba la palabra prohibida (`state`); hipótesis: nombrarla la sugiere. La v2 no la nombra. Si la v2 tampoco baja el error, se descarta. · banco 11/10 (v2, junto con recorre-el-nivel-que-recibe, 15 muestras): variable sin declarar 6/15 sin ella → 9/15 con ella ('state' 4 → 8); bien al 1er intento 3/15 → 2/15. No ayuda: se descarta (se conserva acá con su evidencia).
---
Adentro de cada función usá el nombre del parámetro tal cual lo recibe la función (si el parámetro se llama `estado`, todo el cuerpo dice `estado`). Antes de devolver la función, revisá que cada variable que usás esté declarada o sea un parámetro.
