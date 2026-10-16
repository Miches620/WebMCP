// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "pendiente",
      "titulo": "Pendiente",
      "tarjetas": [
        {
          "id": 1,
          "titulo": "Diseñar Wireframe",
          "descripcion": "Crear el esquema visual inicial de la app.",
          "prioridad": "alta",
          "timestamp": 1678886400
        },
        {
          "id": 2,
          "titulo": "Revisión UX/UI",
          "descripcion": "Asegurar que la experiencia del usuario sea fluida.",
          "prioridad": "media",
          "timestamp": 1678886500
        }
      ]
    },
    {
      "id": "en_curso",
      "titulo": "En Curso",
      "tarjetas": [
        {
          "id": 3,
          "titulo": "Implementar Drag & Drop",
          "descripcion": "Asegurar la funcionalidad de arrastrar y soltar tarjetas.",
          "prioridad": "alta",
          "timestamp": 1678886600
        }
      ]
    },
    {
      "id": "completa",
      "titulo": "Completa",
      "tarjetas": [
        {
          "id": 4,
          "titulo": "Configurar Estilos Base",
          "descripcion": "Aplicar los colores y estilos definidos en el brief.",
          "prioridad": "baja",
          "timestamp": 1678886700
        }
      ]
    }
  ],
  "nextCardId": 5
};
