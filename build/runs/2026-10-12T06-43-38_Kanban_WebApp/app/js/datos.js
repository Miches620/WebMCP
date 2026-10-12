// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columns": [
    {
      "id": "todo",
      "title": "Pendientes",
      "cards": [
        {
          "id": "card1",
          "content": "Diseñar arquitectura inicial",
          "labels": [
            "Backend"
          ],
          "comments": [
            {
              "user": "Admin",
              "text": "Revisar API endpoints."
            }
          ],
          "comment_ids": [
            "c1"
          ]
        },
        {
          "id": "card2",
          "content": "Crear estructura de base de datos",
          "labels": [],
          "comments": []
        }
      ]
    },
    {
      "id": "progreso",
      "title": "En Progreso",
      "cards": [
        {
          "id": "card3",
          "content": "Implementar lógica de estado",
          "labels": [
            "Frontend"
          ],
          "comments": [
            {
              "user": "Dev",
              "text": "Pendiente la validación del contrato."
            }
          ],
          "comment_ids": [
            "c2"
          ]
        }
      ]
    },
    {
      "id": "terminado",
      "title": "Terminado",
      "cards": [
        {
          "id": "card4",
          "content": "Diseño de UI/UX finalizado",
          "labels": [
            "UI/UX"
          ],
          "comments": []
        }
      ]
    }
  ],
  "nextCardId": 5,
  "nextCommentId": 3
};
