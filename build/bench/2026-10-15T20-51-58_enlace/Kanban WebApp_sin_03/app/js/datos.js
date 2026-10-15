// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "pendiente",
      "titulo": "Pendiente",
      "descripcion_columna": "Tareas que requieren atención inicial.",
      "tarjetas": [
        {
          "id": "card-1",
          "titulo": "Implementar Login de Usuario",
          "descripcion": "Crear el flujo completo de registro e inicio de sesión utilizando JWT.",
          "contenido_adicional": "Revisar la documentación de autenticación OAuth 2.0.",
          "labels": [
            {
              "nombre": "backend",
              "color": "#3498db"
            }
          ],
          "comentarios": [
            {
              "autor": "Equipo Lead",
              "contenido": "Por favor, asegurar validación de credenciales en el backend.",
              "timestamp": "2023-10-25T09:00:00Z"
            }
          ]
        }
      ]
    },
    {
      "id": "en_curso",
      "titulo": "En Curso",
      "descripcion_columna": "Tareas activamente en desarrollo.",
      "tarjetas": [
        {
          "id": "card-2",
          "titulo": "Diseñar Componente de Dashboard",
          "descripcion": "Maquetar y prototipar los widgets principales del panel de control.",
          "contenido_adicional": "",
          "labels": [
            {
              "nombre": "ui/ux",
              "color": "#2ecc71"
            }
          ],
          "comentarios": []
        }
      ]
    },
    {
      "id": "completado",
      "titulo": "Completado",
      "descripcion_columna": "Tareas finalizadas y listas para QA.",
      "tarjetas": [
        {
          "id": "card-3",
          "titulo": "Configurar Estilos Globales",
          "descripcion": "Aplicar la paleta oscura e industrial a toda la aplicación.",
          "contenido_adicional": "Revisar contraste de texto en modo oscuro.",
          "labels": [
            {
              "nombre": "estilo",
              "color": "#f39c12"
            }
          ],
          "comentarios": [
            {
              "autor": "Diseñador A",
              "contenido": "El borde sutil ayuda mucho con el aspecto industrial.",
              "timestamp": "2023-10-24T15:30:00Z"
            }
          ]
        }
      ]
    }
  ]
};
