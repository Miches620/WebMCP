// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columns": [
    {
      "id": "todo",
      "title": "Pendientes",
      "cards": [
        {
          "id": "card1",
          "titulo": "Diseñar estructura base",
          "contenido": "Definir el esqueleto HTML y CSS inicial.",
          "labels": [
            "feature"
          ],
          "comments": [
            {
              "usuario": "Admin",
              "texto": "Recordar la paleta oscura."
            }
          ]
        },
        {
          "id": "card2",
          "titulo": "Implementar lógica de movimiento",
          "contenido": "Manejar el estado al arrastrar y soltar.",
          "labels": [],
          "comments": []
        }
      ]
    },
    {
      "id": "in_progress",
      "title": "En Progreso",
      "cards": [
        {
          "id": "card3",
          "titulo": "Agregar funcionalidad de comentarios",
          "contenido": "Crear el formulario y la lógica para guardar comentarios.",
          "labels": [
            "feature"
          ],
          "comments": []
        }
      ]
    },
    {
      "id": "done",
      "title": "Completado",
      "cards": [
        {
          "id": "card4",
          "titulo": "Definir contrato de datos",
          "contenido": "Finalizar la estructura JSON para el estado.",
          "labels": [
            "feature"
          ],
          "comments": []
        }
      ]
    }
  ],
  "labels": [
    {
      "id": "bug",
      "name": "Bug"
    },
    {
      "id": "feature",
      "name": "Feature"
    }
  ]
};
