// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col-pendiente",
      "nombre": "Pendiente"
    },
    {
      "id": "col-en_curso",
      "nombre": "En Curso"
    },
    {
      "id": "col-completado",
      "nombre": "Completado"
    }
  ],
  "tarjetas": {
    "col-pendiente": [
      {
        "id": "card-101",
        "titulo": "Diseñar estructura Kanban",
        "descripcion": "Definir el flujo de trabajo y las columnas necesarias.",
        "etiquetas": [
          {
            "nombre": "UX",
            "color": "#ff9800"
          }
        ],
        "comentarios": [
          {
            "autor": "Admin",
            "contenido": "Definir 3 estados: Pendiente, En Curso, Completado.",
            "timestamp": "2023-10-27T10:00:00Z"
          }
        ]
      },
      {
        "id": "card-102",
        "titulo": "Definir API de estado",
        "descripcion": "Asegurar que todas las acciones devuelvan el estado completo.",
        "etiquetas": [],
        "comentarios": []
      }
    ],
    "col-en_curso": [
      {
        "id": "card-201",
        "titulo": "Implementar lógica de movimiento",
        "descripcion": "Manejar la transición entre columnas sin perder datos.",
        "etiquetas": [
          {
            "nombre": "Lógica",
            "color": "#2196f3"
          }
        ],
        "comentarios": []
      }
    ],
    "col-completado": []
  }
};
