// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columns": [
    {
      "id": "todo",
      "title": "Pendientes",
      "cards": [
        {
          "id": "card1",
          "content": "Diseñar el flujo principal de la app y los componentes base.",
          "tags": [
            "UX"
          ],
          "comments": [
            {
              "user": "Admin",
              "text": "Revisar wireframes antes de empezar a codificar."
            }
          ]
        },
        {
          "id": "card2",
          "content": "Escribir la lógica de manejo de estado y las funciones CRUD.",
          "tags": [
            "JS"
          ],
          "comments": []
        }
      ]
    },
    {
      "id": "progreso",
      "title": "En Curso",
      "cards": [
        {
          "id": "card3",
          "content": "Definir la estructura de datos y el contrato JSON.",
          "tags": [
            "Backend"
          ],
          "comments": [
            {
              "user": "Admin",
              "text": "Listo para revisión del equipo."
            }
          ]
        }
      ]
    },
    {
      "id": "terminado",
      "title": "Completado",
      "cards": []
    }
  ]
};
