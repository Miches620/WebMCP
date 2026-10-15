// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col-pendiente",
      "nombre": "Pendiente",
      "cards": [
        {
          "id": "card-1",
          "titulo": "Diseño del Dashboard Principal",
          "descripcion": "Maquetar la estructura principal y el flujo de navegación.",
          "etiquetas": [
            {
              "nombre": "UX/UI",
              "color": "#ff9800"
            }
          ],
          "comentarios": [
            {
              "autor": "Jefe Proyecto",
              "contenido": "Asegurar compatibilidad móvil en las vistas principales.",
              "timestamp": 1678886400
            }
          ]
        },
        {
          "id": "card-2",
          "titulo": "Integrar API de Pagos",
          "descripcion": "Conectar el endpoint de pagos con la base de datos transaccional.",
          "etiquetas": [
            {
              "nombre": "Backend",
              "color": "#4caf50"
            }
          ],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col-en_curso",
      "nombre": "En Curso",
      "cards": [
        {
          "id": "card-3",
          "titulo": "Implementar lógica de estado Kanban",
          "descripcion": "Actualizar el manejo de la transición entre columnas en js/logica.js.",
          "etiquetas": [
            {
              "nombre": "JavaScript",
              "color": "#2196f3"
            }
          ],
          "comentarios": []
        }
      ]
    },
    {
      "id": "col-completado",
      "nombre": "Completado",
      "cards": [
        {
          "id": "card-4",
          "titulo": "Configurar Estilos Base",
          "descripcion": "Aplicar la paleta oscura e industrial en todos los componentes.",
          "etiquetas": [],
          "comentarios": [
            {
              "autor": "Diseñador Web",
              "contenido": "Se ajustaron las sombras y el efecto hover para mejorar la experiencia visual.",
              "timestamp": 1678886400
            }
          ]
        }
      ]
    }
  ]
};
