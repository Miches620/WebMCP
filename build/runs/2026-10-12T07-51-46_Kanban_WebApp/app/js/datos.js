// js/datos.js — lo escribe el harness a partir de contrato.json (Standard web/app/estado)
const ESTADO_INICIAL = {
  "columnas": [
    {
      "id": "col_pendiente",
      "titulo": "Pendiente",
      "tarjetas": [
        {
          "id": "card_1",
          "titulo": "Diseñar estructura Kanban",
          "contenido": "Definir el estado inicial y las acciones CRUD.",
          "etiquetas": [
            "backend"
          ],
          "comentarios": [
            {
              "autor": "admin",
              "texto": "Empezar por definir el contrato."
            }
          ],
          "estado_columna": "Pendiente"
        },
        {
          "id": "card_2",
          "titulo": "Implementar estilos oscuros",
          "contenido": "Aplicar la paleta industrial y sombras.",
          "etiquetas": [
            "ui/ux"
          ],
          "comentarios": [],
          "estado_columna": "Pendiente"
        }
      ]
    },
    {
      "id": "col_progreso",
      "titulo": "En Progreso",
      "tarjetas": [
        {
          "id": "card_3",
          "titulo": "Crear lógica de movimiento",
          "contenido": "Mover tarjetas entre columnas usando la función App.moverTarjeta.",
          "etiquetas": [
            "logica"
          ],
          "comentarios": [],
          "estado_columna": "En Progreso"
        }
      ]
    },
    {
      "id": "col_completo",
      "titulo": "Completado",
      "tarjetas": []
    }
  ]
};
