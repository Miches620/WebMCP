# standards/

Esquema (06/10, Miche):

```
Harness            motor general (harness/): pasos, reintentos, reparaciones, elegir intento
   │
Standard           qué recibe el Specialist para ESE tipo de proyecto (este directorio)
   │
Validation profile lee el Standard que se usó y verifica si se cumplió (no lo copia)
```

Un Standard declara: archivos, contrato, los pasos en orden (con el pedido de cada uno),
pruebas de aceptación, sondas y chequeos. El harness no nombra ningún dominio: lo vigila
`harness/test_files_engine.mjs`.

| id | estado | sale de |
|---|---|---|
| `web/game/grilla` | DRAFT v0.1 | Boxworld b2–b9 (un solo juego) |

DRAFT = propuesta. Pasa a Standard oficial solo con evidencia (otro proyecto de la familia,
Utility Score) y decisión de Governance.

Pendiente: paso 2 (Validation profiles que lean el Standard), paso 3 (skills del Role).
