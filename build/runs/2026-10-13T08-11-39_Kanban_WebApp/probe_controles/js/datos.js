// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columns": [
    {
      "id": "col-pendiente",
      "title": "Pendiente",
      "cards": [
        {
          "id": "card-1",
          "content": "Diseñar arquitectura inicial del sistema.",
          "labels": [
            "Backend"
          ],
          "comments": [
            {
              "user": "Admin",
              "text": "Revisar API endpoints y estructura de datos."
            }
          ],
          "last_updated": 1
        },
        {
          "id": "card-2",
          "content": "Crear maquetación base con estilo oscuro.",
          "labels": [
            "UI/UX"
          ],
          "comments": [],
          "last_updated": 2
        }
      ]
    },
    {
      "id": "col-progreso",
      "title": "En Progreso",
      "cards": [
        {
          "id": "card-3",
          "content": "Implementar lógica de estado y acciones.",
          "labels": [
            "JS"
          ],
          "comments": [
            {
              "user": "DevA",
              "text": "Necesito ayuda con el flujo de datos entre componentes."
            }
          ],
          "last_updated": 3
        }
      ]
    },
    {
      "id": "col-completado",
      "title": "Completado",
      "cards": []
    }
  ]
};
