// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "pendiente",
      "nombre": "Pendiente",
      "tarjetas": []
    },
    {
      "id": "en_curso",
      "nombre": "En Curso",
      "tarjetas": []
    },
    {
      "id": "completado",
      "nombre": "Completado",
      "tarjetas": []
    }
  ],
  "tarjetas": [
    {
      "id": "card1",
      "titulo": "Diseñar Estructura Kanban",
      "descripcion": "Definir el flujo de trabajo y las columnas necesarias.",
      "contenido_adicional": "Revisar los requisitos del usuario antes de empezar a codificar la lógica.",
      "labels": [
        {
          "nombre": "UX",
          "color": "#ff9800"
        }
      ],
      "comentarios": [
        {
          "autor": "Admin",
          "contenido": "Recordar definir el estado inicial en js/datos.js",
          "timestamp": 1678886400000
        }
      ]
    },
    {
      "id": "card2",
      "titulo": "Implementar Backend Lógica",
      "descripcion": "Programar las acciones de estado (creación, movimiento, etc.) en js/logica.js.",
      "contenido_adicional": null,
      "labels": [
        {
          "nombre": "Backend",
          "color": "#2196f3"
        }
      ],
      "comentarios": []
    }
  ]
};
