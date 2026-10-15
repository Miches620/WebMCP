// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col_pendiente",
      "nombre": "Pendiente",
      "tarjetas": [
        {
          "id": "card1",
          "titulo": "Diseñar estructura de datos",
          "descripcion": "Definir el modelo de datos para tarjetas y comentarios.",
          "etiquetas": [
            {
              "nombre": "Backend",
              "color": "#ff6347"
            }
          ],
          "comentarios": [
            {
              "autor": "Admin",
              "contenido": "Recordar incluir la estructura de etiquetas.",
              "timestamp": 1678886400
            }
          ]
        },
        {
          "id": "card2",
          "titulo": "Crear contrato JSON",
          "descripcion": "Definir el esquema de datos para que el harness pueda generar los archivos.",
          "etiquetas": [],
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
          "titulo": "Implementar lógica de movimiento",
          "descripcion": "Asegurar que el estado se actualice correctamente al arrastrar.",
          "etiquetas": [],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col_completado",
      "nombre": "Completado",
      "tarjetas": [
        {
          "id": "card4",
          "titulo": "Revisión de estilos CSS",
          "descripcion": "Asegurar el estilo oscuro e industrial.",
          "etiquetas": [],
          "comentarios": []
        }
      ]
    }
  ],
  "estado_transitorio_creacion": {
    "titulo": "",
    "descripcion": ""
  }
};
