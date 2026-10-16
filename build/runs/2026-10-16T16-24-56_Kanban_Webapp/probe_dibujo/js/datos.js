// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columns": {
    "Pendiente": {
      "title": "Pendiente",
      "counter": 2
    },
    "En_Curso": {
      "title": "En Curso",
      "counter": 1
    },
    "Completa": {
      "title": "Completa",
      "counter": 0
    }
  },
  "cards": [
    {
      "id": "c1",
      "titulo": "Diseñar wireframe inicial",
      "descripcion": "Bocetar la estructura principal de las tres secciones.",
      "prioridad": "alta",
      "columnaId": "Pendiente",
      "fechaCreacion": 1678886400000
    },
    {
      "id": "c2",
      "titulo": "Revisar requisitos de usuario",
      "descripcion": "Confirmar los flujos de trabajo con el cliente.",
      "prioridad": "media",
      "columnaId": "Pendiente",
      "fechaCreacion": 1678886500000
    },
    {
      "id": "c3",
      "titulo": "Implementar drag&drop básico",
      "descripcion": "Asegurar que el movimiento de tarjetas funcione correctamente.",
      "prioridad": "alta",
      "columnaId": "En_Curso",
      "fechaCreacion": 1678886600000
    }
  ]
};
