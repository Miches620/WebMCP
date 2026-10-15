// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col-1",
      "nombre": "Pendiente",
      "tarjetas": [
        {
          "id": "card-1",
          "titulo": "Implementar Login",
          "descripcion": "Crear el flujo de autenticación y manejo de tokens.",
          "contenido_adicional": null,
          "etiquetas": [
            {
              "nombre": "Backend",
              "color": "#ff9800"
            }
          ],
          "comentarios": [
            {
              "autor": "Admin",
              "contenido": "Revisar endpoints y manejo de errores.",
              "timestamp": "2023-10-26T10:00:00Z"
            }
          ]
        },
        {
          "id": "card-2",
          "titulo": "Diseño UI Kanban",
          "descripcion": "Definir la paleta de colores y el layout general del tablero.",
          "contenido_adicional": null,
          "etiquetas": [],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col-2",
      "nombre": "En Curso",
      "tarjetas": [
        {
          "id": "card-3",
          "titulo": "Configurar API",
          "descripcion": "Conectar el frontend con los servicios de datos y realizar pruebas unitarias.",
          "contenido_adicional": null,
          "etiquetas": [
            {
              "nombre": "API",
              "color": "#2196f3"
            }
          ],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col-3",
      "nombre": "Completado",
      "tarjetas": []
    }
  ]
};
