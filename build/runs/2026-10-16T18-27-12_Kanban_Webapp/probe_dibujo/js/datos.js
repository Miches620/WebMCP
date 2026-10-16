// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "Pendiente",
      "title": "Pendiente",
      "cards": [
        {
          "id": 1,
          "titulo": "Implementar Login",
          "descripcion": "Crear la funcionalidad de autenticación.",
          "prioridad": "alta",
          "fechaCreacion": 1678886400000
        },
        {
          "id": 2,
          "titulo": "Diseñar UI Dashboard",
          "descripcion": "Bocetos iniciales para el dashboard.",
          "prioridad": "media",
          "fechaCreacion": 1678886500000
        },
        {
          "id": 3,
          "titulo": "Revisar documentación",
          "descripcion": "Leer la guía de estilo del proyecto.",
          "prioridad": "baja",
          "fechaCreacion": 1678886600000
        }
      ],
      "contador": 3,
      "tieneAgregarBtn": true
    },
    {
      "id": "En Curso",
      "title": "En Curso",
      "cards": [
        {
          "id": 4,
          "titulo": "Integrar API de pagos",
          "descripcion": "Conectar el servicio de Stripe.",
          "prioridad": "alta",
          "fechaCreacion": 1678887000000
        }
      ],
      "contador": 1,
      "tieneAgregarBtn": false
    },
    {
      "id": "Completa",
      "title": "Completa",
      "cards": [
        {
          "id": 5,
          "titulo": "Configurar entorno base",
          "descripcion": "Instalar dependencias iniciales.",
          "prioridad": "baja",
          "fechaCreacion": 1678885000000
        }
      ],
      "contador": 1,
      "tieneAgregarBtn": false
    }
  ],
  "modalVisible": {
    "crear": false,
    "editar": false,
    "borrar": false
  }
};
