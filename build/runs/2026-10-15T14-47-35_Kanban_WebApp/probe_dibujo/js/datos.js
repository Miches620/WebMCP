// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col_pendiente",
      "nombre": "Pendiente",
      "tarjetas": [
        {
          "id": "card1",
          "título": "Diseñar Maquetación Inicial",
          "descripción": "Crear el esqueleto de la app y definir los componentes visuales.",
          "contenido_adicional": "Usar paleta oscura e industrial.",
          "labels": [
            {
              "nombre": "UX/UI",
              "color": "#ff6b6b"
            }
          ],
          "comentarios": [
            {
              "autor": "System",
              "contenido": "Definir estructura de datos en js/datos.js.",
              "timestamp": 1678886400
            }
          ]
        },
        {
          "id": "card2",
          "título": "Implementar Lógica CRUD Base",
          "descripción": "Asegurar que las acciones de creación, lectura y eliminación funcionen.",
          "contenido_adicional": null,
          "labels": [
            {
              "nombre": "Backend",
              "color": "#4ecdc4"
            }
          ],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col_en_curso",
      "nombre": "En Curso",
      "tarjetas": [
        {
          "id": "card3",
          "título": "Diseñar Controles de Interacción",
          "descripción": "Asegurar que los formularios y botones de acciones se muestren correctamente.",
          "contenido_adicional": "",
          "labels": [],
          "comentarios": [
            {
              "autor": "User A",
              "contenido": "Recordar incluir manejo de etiquetas.",
              "timestamp": 1678900000
            }
          ]
        }
      ]
    },
    {
      "id": "col_completado",
      "nombre": "Completado",
      "tarjetas": []
    }
  ]
};
