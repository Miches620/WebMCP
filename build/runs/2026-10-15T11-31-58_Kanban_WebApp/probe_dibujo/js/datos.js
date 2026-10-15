// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col_pendiente",
      "nombre": "Pendiente",
      "tarjetas": [
        {
          "id": "card_1",
          "titulo": "Diseñar estructura de datos",
          "descripcion": "Definir el modelo de datos para tarjetas, incluyendo etiquetas y comentarios.",
          "etiquetas": [
            {
              "nombre": "Backend",
              "color": "#007bff"
            }
          ],
          "comentarios": [
            {
              "autor": "Admin",
              "contenido": "Recordar incluir el manejo de timestamps.",
              "timestamp": "2023-10-26T10:00:00Z"
            }
          ]
        },
        {
          "id": "card_2",
          "titulo": "Implementar estilos oscuros",
          "descripcion": "Aplicar la paleta de colores industrial y sombras a todas las tarjetas.",
          "etiquetas": [
            {
              "nombre": "UI/UX",
              "color": "#ffc107"
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
          "id": "card_3",
          "titulo": "Conectar lógica de acciones",
          "descripcion": "Asegurar que las funciones App devuelvan siempre un estado nuevo.",
          "etiquetas": [],
          "comentarios": [
            {
              "autor": "Dev",
              "contenido": "Revisar la función de movimiento para asegurar atomicidad del estado.",
              "timestamp": "2023-10-26T11:30:00Z"
            }
          ]
        }
      ]
    },
    {
      "id": "col_completado",
      "nombre": "Completado",
      "tarjetas": [
        {
          "id": "card_4",
          "titulo": "Definir Contrato JSON",
          "descripcion": "Crear el contrato de la aplicación para que el harness pueda generar los archivos.",
          "etiquetas": [
            {
              "nombre": "Documentación",
              "color": "#28a745"
            }
          ],
          "comentarios": []
        }
      ]
    }
  ]
};
